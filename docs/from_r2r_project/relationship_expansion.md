# Relation Expansion (REG) Module for R2R (Full OSS)

**Purpose:** Add a complementary module to DEG‑RAG that **discovers missed relationships** in an R2R project graph and inserts them **only when verified with evidence**. Designed for Mosaic/Ellen on **R2R Full OSS**.

> TL;DR: DEG‑RAG cleans what exists; **REG** finds what’s missing (with provenance).

---

## 1) Scope & Goals

* **Scope:** Project‑level graph (`graphs_entities`, `graphs_relationships`) after R2R extraction, doc‑dedup, and graph pull.
* **Goal:** Improve **recall** (graph completeness) without sacrificing **precision** by:

  1. Proposing candidate relations (hypotheses),
  2. Verifying them against source text (quotes), and
  3. Inserting only **supported** relations via R2R Graph APIs.

**Non‑Goals:** Ontology invention, hallucinated links without primary‑source evidence, unrestricted KG induction.

---

## 2) Where REG fits (with DEG‑RAG)

```
R2R: ingest → chunk → embed → extract (E/R) → doc‑dedup → graphs.pull
                                     ↓
                           DEG‑RAG: denoise (merge + prune)
                                     ↓
                            REG: discover + verify + insert
```

* **Order:** Run REG **after** DEG‑RAG to search over a clean(er) KG.
* **Feedback:** Inserted edges become inputs to future DEG‑RAG triple reflection.

---

## 3) High‑Level Flow

1. **Gap Detection (Candidate Generation)** – Find likely missing edges.
2. **Evidence Retrieval** – Collect spans/snippets from documents that could support the edge.
3. **LLM Verification** – Judge support for the specific triple; extract quotes.
4. **Decision & Insert** – If supported ≥ threshold, create/attach relation in R2R graph; log provenance.
5. **Post‑Insert Checks** – Direction, type rules, contradiction checks (reuse DEG‑RAG logic).

---

## 4) Candidate Generation Strategies

Use any combination (tunable by config):

**A. Co‑Mention Heuristic**

* If entities **A** and **B** co‑occur in ≥ *N* chunks/sections, propose a relation candidate with type from the ontology shortlist.

**B. KG Neighborhood Gaps**

* For an entity **A**, if peers of the same type tend to connect to **B**‑type via relation **R**, but **A** has no **R** to any **B**, propose (`A R ?`).

**C. Pattern Mining / Templates**

* Use weak patterns in text: e.g., *"X acquired Y"*, *"Y is a subsidiary of X"*, *"X supplies Y"* → propose relation with direction from the template.

**D. Question‑Guided Expansion**

* From frequent queries, generate targeted gaps (e.g., many queries combine **Material** and **Company** without existing **supplies/refines** edges).

**E. Document Re‑Extraction Anchored by Entities**

* Re‑prompt extraction **anchoring** on a pair `(A,B)` or on `(A, ?)` with relation type hints to sweep for missed evidence.

> All strategies only produce **candidates**. Nothing is inserted before verification.

---

## 5) Aux Schema (Supabase/Postgres)

```sql
create schema if not exists kg_ops;

-- Proposed but not yet accepted relations
create table if not exists kg_ops.candidate_new_relations (
  id uuid primary key default gen_random_uuid(),
  graph_id uuid not null,
  head_entity text not null,          -- graphs_entities.id
  relation text not null,             -- ontology label
  tail_entity text not null,          -- graphs_entities.id
  source_strategy text not null,      -- co_mention|neighborhood|pattern|question|anchored_reextract
  evidence jsonb,                     -- provisional: spans/quotes found so far
  score real,                         -- heuristic score pre‑verification
  status text default 'pending',      -- pending|verified|rejected|inserted
  created_at timestamptz default now()
);

-- LLM verification results per candidate
create table if not exists kg_ops.candidate_verifications (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid references kg_ops.candidate_new_relations(id) on delete cascade,
  supported boolean,
  confidence real,
  quotes jsonb,                        -- ["quote1", "quote2", ...]
  notes text,
  created_at timestamptz default now()
);

-- Audit of inserts into R2R
create table if not exists kg_ops.insert_audit (
  id uuid primary key default gen_random_uuid(),
  graph_id uuid not null,
  relation_id text,                   -- graphs_relationships.id (after insert)
  candidate_id uuid,
  payload jsonb,                      -- what was inserted (head/tail/relation/attrs/evidence)
  created_at timestamptz default now()
);
```

> Keep `kg_ops` separate to avoid coupling with R2R’s internal schemas while maintaining full traceability.

---

## 6) Ontology & Rules

Maintain a small, explicit **ontology** file/table:

* Allowed relation labels: `part_of`, `has_part`, `acquired`, `subsidiary_of`, `supplies`, `refines`, `located_in`, ...
* Allowed **head/tail** entity types per relation.
* Directionality rules (see DEG‑RAG direction section).
* Minimum evidence requirement per relation class (e.g., M&A needs ≥2 independent quotes).

This ontology is used for:

* Candidate generation (template mapping),
* Pre‑validation (filter illegal head/tail types),
* Post‑insert checks.

---

## 7) Evidence Retrieval

Given a candidate `(A, R, B)`:

1. **Targeted search** across chunks:

   * Chunks mentioning **A** and **B** inside a window (same section, page, or within *K* sentences).
   * Chunks mentioning **A** plus **R**‑keywords.
2. **Section expansion**: include surrounding context (±1 chunk or heading‑bounded block).
3. Aggregate a shortlist of candidate spans for LLM verification.

---

## 8) LLM Verification Prompts

**Binary Support (direction‑aware):**

```
SYSTEM: Determine whether the claim is supported by the evidence and whether the direction is correct.
CLAIM: "{HEAD}" {RELATION} "{TAIL}"
EVIDENCE (verbatim quotes):
- "{q1}"
- "{q2}"
Return JSON:
{"supported": true|false, "confidence": 0-1,
 "direction_ok": true|false, "reversed": true|false,
 "suggested_relation": "<rel-or-null>",
 "quotes": ["..."], "notes": "..."}
```

**Anchored Re‑Extract (to discover evidence):**

```
SYSTEM: Extract text spans that explicitly state a relationship between the two entities.
ENTITIES: A="{A}", B="{B}"
RELATION HINTS: {hints}
TEXT: {chunk_or_section}
Return JSON: {"spans": [{"quote":"...","reason":"..."}, ...]}
```

Thresholds (tunable): `supported=true` and `confidence ≥ 0.65` → eligible for insert.

---

## 9) Insert Policy (via R2R Graph APIs)

For a **verified** candidate:

1. Normalize relation label per ontology; apply direction fix if `reversed=true`.
2. Insert into `graphs_relationships` with attributes:

   * `confidence`, `source_strategy`, `evidence_quotes` (first 1‑3 quotes), `verifier_model`, `inserted_by="REG"`.
3. Write `kg_ops.insert_audit` referencing the candidate.
4. Trigger DEG‑RAG’s contradiction/direction checks (idempotent).

If **not supported**:

* Mark candidate `rejected` with reason; do not insert.

---

## 10) Scheduling & Ops

* **After DEG‑RAG nightly:** Run REG pipeline.
* **Hourly (lightweight):** Co‑mention sweep for fresh candidates (status `pending`).
* **On‑demand:** Query‑guided expansion for hot questions.

Cost controls:

* Cap candidates per run.
* Batch verification prompts (group by relation type).
* Prefer section‑bounded evidence windows.

---

## 11) Evaluation

Metrics to track:

* **Precision of inserted relations** (spot‑check via human or second LLM with stricter threshold).
* **Coverage gain**: (#relations after REG − before REG) / (#before).
* **Impact on retrieval**: nDCG@k / Recall@k deltas for hybrid search.
* **Latency/cost** per accepted relation.

A/B modes:

* A: Vector‑only
* B: Vector + DEG‑RAG (clean KG)
* C: Vector + DEG‑RAG + **REG** (clean + expanded KG)

---

## 12) Minimal Admin UI

Views:

* **Candidates** (table): head, rel, tail, strategy, pre‑score, status, created_at.
* **Evidence panel**: quotes, source doc/section, preview.
* **Verifier result**: supported?, confidence, reversed?, suggested_relation.
  Actions:
* Accept (insert), Reject, Re‑verify, Edit relation label.

---

## 13) Integration with Hybrid Retrieval

* Treat inserted edges as first‑class graph edges (with provenance attrs).
* During expansion, filter by `confidence ≥ τ` and exclude edges marked `pruned` by DEG‑RAG.
* Prefer edges with **evidence quotes** when constructing context packs (surface quotes alongside chunks for traceable answers).

---

## 14) Safety & Governance

* Never insert edges without at least one verbatim **quote**.
* Preserve provenance (doc id, section, page) for each quote.
* Run direction/contradiction/type checks pre‑insert and post‑insert.
* Full audit trail in `kg_ops.insert_audit`.

---

## 15) Deliverables (Drop‑in)

* **SQL**: aux tables above.
* **Jobs**: `reg_candidates.py`, `reg_verify.py`, `reg_insert.py` (or n8n equivalents).
* **Config**: `ontology.yaml` (relations, types, direction rules), thresholds.
* **Prompts**: verification + anchored re‑extract.
* **Docs**: `docs/architecture/relation-expansion.md` (this file).

---

## 16) Summary

* **DEG‑RAG**: improves **precision** by cleaning.
* **REG**: improves **recall** by discovering and **verifying** missed edges.
* Together they produce a graph that is both **lean** and **complete** for superior hybrid RAG performance.
