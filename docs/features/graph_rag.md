# Graph RAG: Knowledge Extraction & Search

**Status:** Implemented & Optimized

This document covers Mosaic's Graph RAG capabilities, from the automatic extraction of knowledge graphs during ingestion to the performance optimizations that make it scalable.

---

## 1. Automatic Graph Extraction

Mosaic automatically builds a knowledge graph from every document processed. This is handled by the Python worker during the ingestion pipeline.

### Key Features:
-   **Postgres-Native:** The graph lives entirely within Supabase, requiring no extra infrastructure.
-   **LLM-Driven Extraction:** Uses OpenAI's structured output (Pydantic models) to extract entities and relationships.
-   **Rich Schema:** Supports 11 entity types (Person, Organization, Concept, etc.) and 12 relationship types (Uses, Requires, etc.).
-   **Automatic Deduplication:** A three-layer approach (canonical names, pgvector similarity, and unique constraints) ensures entities are not duplicated.

## 2. Performance Optimization

Initial implementations of graph extraction faced significant performance bottlenecks, causing timeouts and overwhelming the database.

### The Problem
-   **No Caching:** The same entity (e.g., "China") was looked up from the database hundreds of times for a single document.
-   **Too Many Concurrent Workers:** 20+ workers exhausted the database connection pool.
-   **No Rate Limiting:** Thousands of simultaneous RPC calls were sent to `find_similar_entities`.

### The Fix

1.  **In-Memory Entity Cache:** A dictionary (`self.entity_cache`) now stores entity lookups for the duration of a document's processing. This reduced database calls by **50-80%**.
2.  **Rate Limiting:** A `min_db_interval` of 100ms was introduced between database calls to prevent overwhelming the connection pool.
3.  **Reduced Worker Count:** The default number of concurrent graph extraction workers was reduced from 20 to 5.
4.  **Cache Statistics:** The system now logs cache hit/miss rates to monitor efficiency.

### The Impact

-   **Database Calls:** Reduced from ~7,000 to ~1,500 per document.
-   **Processing Time:** Decreased from 10+ minutes to **2-3 minutes** per document.
-   **Stability:** Timeouts and connection errors have been eliminated.

## 3. Graph-Enhanced Search

The extracted knowledge graph is used to enhance search results by:

-   **Expanding Context:** Traversing relationships to find connected entities and concepts.
-   **Answering Relational Queries:** Directly answering questions like "How does X relate to Y?"
-   **Improving Precision:** Using the graph to disambiguate terms and understand user intent.
