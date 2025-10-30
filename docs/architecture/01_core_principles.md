# Mosaic Architecture: Core Principles

## The Multifloor Model

Mosaic is built on a **multifloor traversal framework**, a topic-agnostic, extensible system that supports multi-hop reasoning, temporal tracking, and layered data representation. Each **floor** represents a coherent layer of the same corpus.

### Core Floors:
-   **Floor A – Text Semantics:** Sentence, paragraph, or document embeddings.
-   **Floor B – Symbolic/Relational:** The Knowledge Graph, with entities and typed relationships.
-   **Floor C – Structure & Provenance:** Files, chunks, timestamps, and sources.
-   **Floor D – Living Entities:** Curated, structured knowledge pages (the highest level of abstraction).

This model allows both AI agents and human users to traverse the same graph, moving **up** for abstraction and **down** for grounding and evidence.

## Human-AI Traversal Parity

A key principle is that both AI and human users traverse the same graph, ensuring explainability, transparency, and a consistent mental model between human and machine.

## Temporal Modeling

The system supports time-aware graph traversal, allowing for:
-   **"As-of" queries** to reconstruct a point-in-time subgraph.
-   **Diff trails** to reveal changes between versions.
