# DEG-RAG Integration Guide for R2R (Full OSS Version)

This document explains the **DEG-RAG** (Denoising Knowledge Graphs for Retrieval-Augmented Generation) approach and provides a step-by-step implementation plan for integrating it into an **R2R-based RAG platform**, such as **Mosaic** or **Ellen**. It is written to guide AI IDEs (like Windsurf or CrewAI) in understanding *what* they're adding to your project, *why* it matters, and *how* to integrate it cleanly.

---

## 1. Concept Overview: What is DEG-RAG?

**DEG-RAG** ("Less is More: Denoising Knowledge Graphs for Retrieval-Augmented Generation") is a technique introduced to improve the performance of graph-based RAG systems. It addresses a key issue: as LLMs extract entities and relations from text, they often produce **noisy, redundant, or incorrect knowledge graphs (KGs)**. These errors—duplicate entities, conflicting relationships, and irrelevant connections—can degrade retrieval quality and increase hallucinations.

### The Core Problem

* **LLMs lack persistent memory**: They may extract similar entities multiple times under slightly different names (e.g., *MP Materials* vs. *MP Materials Corp*).
* **Relations get cluttered**: Over time, graphs accumulate contradictory or low-confidence edges.
* **Retrieval precision declines**: As graph noise increases, query expansion through the graph retrieves irrelevant or misleading context.

### The DEG-RAG Solution

DEG-RAG applies a **two-phase denoising process** on top of a standard RAG knowledge graph:

1. **Entity Resolution (Deduplication):** Detect and merge duplicate or near-duplicate entities using text similarity, embedding proximity, and optional LLM verification.
2. **Triple Reflection (Relation Pruning):** Identify and remove incorrect or weak relationships based on evidence count, contradiction analysis, and LLM-based fact verification.

The result is a **cleaner, leaner KG** that enhances retrieval accuracy, reduces redundancy, and stabilizes RAG behavior.

---

## 2. Why It Matters for R2R Projects

R2R (Read → Reason → Respond) already handles ingestion, chunking, entity/relation extraction, and graph assembly through its built-in pipelines. In the **Full OSS version**, R2R maintains both:

* **Document-level entities and relationships** (`documents_entities`, `documents_relationships`)
* **Project-level (graph-level) entities and relationships** (`graphs_entities`, `graphs_relationships`)

These structures are ideal for applying DEG-RAG since R2R’s base schema and APIs already provide the foundation for knowledge graphs.

**DEG-RAG doesn’t replace R2R functionality—it enhances it.**

By layering DEG-RAG on top of R2R’s `graphs_*` tables, you:

* Improve coherence and factual reliability of graph traversal queries.
* Increase retrieval precision during hybrid (vector + graph) search.
* Keep your project-level KGs optimized as new documents are added.

---

## 3. Where DEG-RAG Fits in R2R’s Pipeline

### R2R’s native flow (simplified)

```
1. Ingest → 2. Chunk → 3. Embed → 4. Extract Entities/Relations
   ↓
5. Deduplicate (within-document)
   ↓
6. Pull into Graph (project-level)
```

### Extended flow with DEG-RAG

```
7. Cross-document Entity Resolution (merge duplicates across docs)
8. Triple Reflection (prune bad/weak relations)
9. Audit + Hybrid Retrieval
```

DEG-RAG steps 7–9 can run as periodic background jobs or post-`graphs.pull` hooks.

---

## 4. Implementation Architecture

### Key Idea

You’ll **extend** R2R’s graph structure with a lightweight auxiliary schema (`kg_ops`) to manage candidate merges, relation prunes, and audit logs without modifying R2R’s core tables.

### Schema Additions (Supabase/Postgres)

```sql
create schema if not exists kg_ops;

create table if not exists kg_ops.candidate_merges (
  id uuid primary key default gen_random_uuid(),
  graph_id uuid not null,              -- R2R graph (collection) id
  entity_a_id text not null,           -- graphs_entities.id
  entity_b_id text not null,           -- graphs_entities.id
  score real check (score between 0 and 1),
  reason jsonb,
  status text default 'pending'        -- pending|accepted|rejected
);

create table if not exists kg_ops.candidate_relation_prune (
  id uuid primary key default gen_random_uuid(),
  graph_id uuid not null,
  relation_id text not null,           -- graphs_relationships.id
  score real check (score between 0 and 1),
  reason jsonb,
  status text default 'pending'
);

create table if not exists kg_ops.audit_log (
  id uuid primary key default gen_random_uuid(),
  graph_id uuid not null,
  event text,                          -- 'merge_entities' or 'prune_relation'
  payload jsonb,
  created_at timestamptz default now()
);
```

---

## 5. DEG-RAG Processing Steps

### Step 1 — Cross-Document Entity Resolution

R2R already deduplicates entities within individual documents. DEG-RAG adds cross-document resolution at the project graph level.

**Process:**

1. Pull all `graphs_entities` for a given graph ID.
2. Generate candidate pairs using:

   * **Blocking rules:** name prefix, acronym, alias overlap.
   * **Semantic similarity:** embeddings of canonical names + summaries (`cosine_sim > 0.85`).
3. Insert pairs into `kg_ops.candidate_merges`.
4. Optionally, verify borderline cases using an LLM adjudication prompt:

```text
SYSTEM: Decide if two graph entities are the same real-world entity.
INPUT:
A: {canonical_name_a} | summary: {summary_a} | aliases: {aliases_a}
B: {canonical_name_b} | summary: {summary_b} | aliases: {aliases_b}
OUTPUT JSON: {"same": true|false, "confidence": 0-1, "rationale": "..."}
```

5. Merge accepted pairs by updating R2R via its `graphs/entities` API (transfer relations, merge aliases, delete duplicates).
6. Record merges in `kg_ops.audit_log`.

### Step 2 — Triple Reflection (Relation Pruning)

**Goal:** Reduce low-confidence or conflicting relationships.

**Signals:**

* Few or single weak evidence references.
* Contradictory relations (same head + relation, multiple conflicting tails).
* Relation types inconsistent with entity types.

**Process:**

1. Query `graphs_relationships`.
2. Score each relation:

   ```python
   score = 0.6 * avg_conf + 0.3 * min(1, evidence_count / 3) - (0.4 if contradiction else 0)
   ```
3. Push low-score relations (<0.35) into `kg_ops.candidate_relation_prune`.
4. Optional LLM verification:

```text
SYSTEM: Verify if the relation is supported by its quoted evidence.
CLAIM: "{head}" {relation} "{tail}"
EVIDENCE:
- "..."
- "..."
OUTPUT: {"supported": true|false, "confidence": 0-1}
```

5. Accepted prunes → update or delete via R2R’s `graphs/relationships` API.
6. Record in `kg_ops.audit_log`.

### Step 3 — Hybrid Retrieval

Integrate the cleaned KG into your hybrid retrieval process:

1. Embed the query and retrieve top-k chunks via vector search.
2. Run NER on the query → map entities to `graphs_entities`.
3. Pull 1–2 hop neighbors (filter out pruned relations).
4. Combine vector and graph results using a rank-blending algorithm (e.g., Reciprocal Rank Fusion).
5. Feed the merged context pack into your synthesis model.

---

## 6. Automation Pipeline (Example)

### n8n or CrewAI Flow

```yaml
crew:
  name: deg-rag-r2r-pipeline
  agents:
    - name: r2r_ingester
      tasks: [extract, deduplicate, pull_graph]
    - name: entity_resolver
      tasks: [generate_merge_candidates, adjudicate_merges, apply_merges]
    - name: relation_reflector
      tasks: [score_relations, verify_relations, prune_relations]
    - name: hybrid_retriever
      tasks: [retrieve_hybrid, synthesize]
```

### Suggested Schedule

* **On ingest:** R2R extraction + doc dedup + graph pull.
* **Hourly:** Candidate entity merge generation.
* **Nightly:** Adjudication + merge + relation pruning.
* **Weekly:** Graph health check + retrieval evaluation.

---

## 7. Evaluation & Monitoring

Track improvements using:

* **Entity merge ratio:** % of duplicates merged.
* **Relation prune ratio:** % of invalid triples removed.
* **Retrieval metrics:** Recall@k and nDCG@k before/after denoising.
* **Answer quality:** LLM-as-judge factuality scores.

Integrate into your Supabase/Metabase dashboard for automated QA.

---

## 8. Governance

* Always apply merges and prunes via R2R’s APIs to maintain schema consistency.
* Keep audit trails for all merges/prunes.
* Allow human review through a lightweight admin panel or CLI command set.

---

## 9. Summary

| Problem                        | R2R Handles | DEG-RAG Adds |
| ------------------------------ | ----------- | ------------ |
| Within-doc entity dedup        | ✅           | –            |
| Cross-doc entity dedup         | ❌           | ✅            |
| Weak/contradictory relations   | ❌           | ✅            |
| Graph assembly                 | ✅           | –            |
| Vector retrieval               | ✅           | –            |
| Hybrid retrieval with clean KG | ⚠️ Partial  | ✅            |

**End Result:** A more precise, compact, and trustworthy knowledge graph that strengthens retrieval accuracy and long-context reasoning across your R2R-based RAG applications.

---

**Document Maintainer:** `mosaic/r2r/deg-rag.md`

**Applies to:** R2R OSS (Full version) — 2025+

**Dependencies:** Supabase, pgvector, n8n or CrewAI orchestrator, OpenAI API or equivalent LLM.

---

## 5.2.1 Directionality Corrections (Triple Reflection Enhancements)

Some relation errors are **directional** (e.g., *“SDA is a part of RPM”* instead of *“RPM is a part of SDA”*). Extend Triple Reflection with the following checks and fixes:

**A) Relation-Type Rule Set (Domain Constraints)**

* Define, per relation type, the **expected head/tail entity types** and **allowed direction(s)**. Examples:

  * `part_of`: (Child → Parent) and **not** (Parent → Child)
  * `located_in`: (Entity → Place)
  * `supplies`: (Supplier → Customer)
* Persist these rules in code or a small config table and validate all `graphs_relationships` against them to flag suspicious edges.

**B) Reverse-Pair & Contradiction Detection**

* For hierarchical relations (e.g., `part_of`, `subclass_of`, `reports_to`), detect **reverse pairs**: if both `A part_of B` and `B part_of A` exist, mark as a contradiction and flag for correction.
* Increase the contradiction penalty in your scoring function for such reverse pairs so they are always reviewed.

**C) Direction-Aware LLM Verification**
Prompt template for flagged edges:

```
SYSTEM: Verify whether the relation direction is correct.
CLAIM: "{HEAD}" {RELATION} "{TAIL}"
EVIDENCE:
- "{quote1}"
- "{quote2}"
OUTPUT JSON: {"correct": true|false, "reversed": true|false, "suggested_relation": "<rel or null>", "confidence": 0-1, "notes": "..."}
```

* If `reversed=true`, propose a **flip** (swap head/tail and optionally map to the correct relation verb if your ontology distinguishes `part_of` vs `has_part`).

**D) Apply Fixes via R2R Graph APIs**

* **Flip policy**: Update the relationship to swap head/tail and (optionally) normalize the relation label; migrate evidence.
* **Prune policy**: If evidence is weak/inconclusive, mark as pruned or delete.
* Always write an audit entry noting the action and the verifier output.

**E) Retrieval Safeguards**

* Exclude flagged or pruned edges from graph expansion during hybrid retrieval until resolved.

---

## Schema Delta (Aux Layer)

To support directionality review and fix proposals, extend the aux table:

```sql
alter table if exists kg_ops.candidate_relation_prune
  add column if not exists direction_issue boolean default false,
  add column if not exists suggested_fix jsonb;  -- e.g., {"action":"flip","new_relation":"has_part"}
```

During candidate creation, set `direction_issue=true` when a rule violation or reverse pair is detected; store any LLM suggestion in `suggested_fix`.
