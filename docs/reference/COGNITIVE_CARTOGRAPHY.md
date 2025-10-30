# Goal

Develop Mosaic’s **multifloor traversal framework** — a topic-agnostic, extensible system that supports multi-hop reasoning, temporal tracking, and layered representation. This serves as the foundation for all domain-specific projects built on Mosaic.

# Multifloor Model Overview

Each **floor** represents a coherent representational layer of the same corpus. Floors can model domain data (entities, documents, metrics) or meta-layers (tasks, reasoning, governance). The system supports **unlimited floors**, configurable per implementation.

### Core Floors

* **Floor A – Text Semantics:** Sentence, paragraph, or document embeddings; edges built via cosine similarity or cross-encoder scores.
* **Floor B – Symbolic/Relational:** Entities (e.g., People, Organizations, Products, Concepts) and typed relationships (e.g., “produces”, “depends_on”, “references”).
* **Floor C – Structure & Provenance:** Files, chunks, timestamps, authors, pipelines, and sources.
* **Floor D – Task/Agent Layer:** Prompts, runs, evaluations, and decision traces.
* **Floor E – Metrics & Outcomes:** Quantitative or qualitative outputs such as performance, cost, accuracy, impact, or trust scores.
* **Floor F – Temporal Layer:** Versioned nodes and edges (`valid_from`, `valid_to`) for time-aware reasoning and historical exploration.

### Custom Domain/Meta Floors

Projects built on Mosaic can define custom floors through configuration. For example:

* A **methodology floor** could store frameworks or processes used in a specific domain.
* An **application floor** could represent projects or case studies.
* An **outcome floor** could represent measurable results or validations.

Each floor connects through **bridge edges** (e.g., `Document→Entity`, `Entity→Outcome`, `Task→Chunk`). These allow both AI and human traversal across contextual, structural, and temporal dimensions.

# Human and AI Traversal Parity

Vertical traversal is symmetrical between AI and humans:

* AI agents move **up** for abstraction (aggregating or summarizing concepts).
* AI agents move **down** for grounding (retrieving supporting evidence).
* Humans can traverse the same pathways visually in the Mosaic interface.
* Both can move **across time** to analyze changes, lineage, or drift.

This shared graph ensures explainability, transparency, and consistent mental models between human and machine.

# Temporal Modeling

The temporal floor enables time-aware graph traversal and comparison:

* Every node and edge includes temporal validity.
* “As-of” queries reconstruct a point-in-time subgraph.
* Diff trails reveal changes between versions.
* Optional integration with **TimescaleDB** or other temporal databases allows joining time series metrics to graph entities.

Hybrid storage design:

* **Postgres/pgvector:** Core graph and embeddings.
* **TimescaleDB:** Dense or high-frequency metrics.
* **Bridge tables:** Join graphs and metrics across time intervals.

# Traversal API (Trails)

Each Trail is a composable set of traversal steps:

1. **vector_expand** – semantic proximity on embedding floors.
2. **graph_hop** – relational traversal on symbolic floors.
3. **bridge** – movement between floors or across time.

Example Trail Template:

```yaml
Trail:
  start:
    floor: A|B|C|D|E|F
    selector: node_id | query | embedding
  steps:
    - type: vector_expand | graph_hop | bridge
      params: {...}
  limits:
    max_hops: 6
  ranking:
    combine: RRF | weighted_sum
  output:
    nodes: true
    edges: true
```

# Example Use Case

**Query:** “Show methods connected to high-performing outcomes in similar projects.”

1. Bridge: Outcome→Application (E→Custom)
2. Bridge: Application→Method (Custom→Custom)
3. Graph_hop: Method→Outcome (Custom→E)
4. Temporal filter: as_of="2024-12-31"
5. Bridge: Outcome→Document (E→A)
6. Vector_expand: retrieve relevant evidence text.

# Architecture Summary

| Layer               | Function                                         | Example Storage                  |
| ------------------- | ------------------------------------------------ | -------------------------------- |
| Domain Floors (A–E) | Semantic, relational, provenance, task, outcomes | Supabase/Postgres + pgvector     |
| Temporal Floors (F) | Versioning, historical lineage                   | TimescaleDB                      |
| Custom Floors       | Domain or meta-specific layers                   | Configurable via schema registry |
| Bridge Layers       | Cross-floor edges, temporal joins                | JSONB edge store                 |

# Governance & Safety

* Floor-specific access control and edge allowlists.
* Trail budgets, timeouts, and lineage audits.
* PII filters and compliance-aware scoring.
* Temporal reproducibility (“what was true when”).

# Licensing / IP Note

Mantis (MIT CSAIL, Kellis Lab) has no open-source license. Mosaic’s multifloor traversal system is an **independent implementation**, inspired by published research but not derived from Mantis code.

# Acceptance Criteria

* Multi-floor traversal with domain-agnostic configuration.
* Time-aware querying with version and diff support.
* Shared explainable Trails for human and AI agents.
* Integration with TimescaleDB or equivalent temporal backend.
* Extensible schema for project-specific floors.

# Why this matters

This model turns Mosaic into a **universal cognitive substrate**—a system where any organization can map, traverse, and reason across its entire data landscape over time. Each project (Ellen, SDAaaS, or beyond) can simply plug in new domain floors, while the multifloor engine remains the same core foundation for explainable, agentic knowledge exploration.
