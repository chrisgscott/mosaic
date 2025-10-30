# Agentic & Structure-Aware Chunking

**Status:** Implemented

This document details Mosaic's advanced chunking strategies, which have evolved from a complex, multi-strategy approach to a simplified, two-pronged solution: a fast, structure-aware base chunker and an optional, powerful agentic chunker for complex documents.

---

## 1. The Default: Structure-Aware Chunking

Our primary chunking strategy is simple, fast, and cost-effective. It leverages the natural structure of a document as identified by the Docling VLM extractor.

### How It Works:
1.  **Docling Extracts Structure:** Identifies sections, paragraphs, tables, etc.
2.  **Use Sections as Boundaries:** Sections form the primary chunks.
3.  **Split/Merge Logic:**
    *   If a section is too large, it's split by paragraph.
    *   If a section is too small, it's merged with its neighbors.

### Benefits:
-   **Simple & Fast:** No LLM calls for base chunking.
-   **High Quality:** Respects document structure, preventing mid-sentence cuts.
-   **Free:** $0 cost for base chunking.

---

## 2. The Power Tool: Agentic Chunking

For complex documents with inconsistent formatting (like the Strategy Tactics card deck), we use an LLM-powered agentic chunker.

### The Problem It Solves

Documents like the Strategy Tactics cards have variable category labels ("Purpose", "Recipe", "Plays") and inconsistent formatting. Simple pattern matching fails. We need semantic understanding to identify where one card ends and another begins.

### How It Works

An `AgenticChunker` uses an LLM to:
1.  **Analyze Document Type:** Understands if it's a card deck, a manual, an article, etc., based on user-provided configuration.
2.  **Identify Semantic Boundaries:** Finds the logical edges of a concept (e.g., the end of a card).
3.  **Create Coherent Chunks:** Ensures each chunk is a complete, self-contained unit.

### Usage

Agentic chunking is enabled on a per-document basis by setting a `chunking_config` in the `documents` table:

```sql
UPDATE documents
SET chunking_config = '{
  "strategy": "agentic",
  "document_type": "card_deck",
  "instructions": "Each card is a complete tactic. Keep cards together as single chunks."
}'::jsonb
WHERE id = 'your-document-id';
```

The ingestion pipeline automatically routes the document to the correct chunker.

### Cost-Benefit

-   **Cost:** ~$0.03-$0.10 per document.
-   **Benefit:** It is **50-100x cheaper** than manually fixing bad chunks or dealing with poor retrieval results from improperly segmented content.

---

## 3. Enhancement: Document Augmentation (Question Generation)

To improve retrieval accuracy and eliminate the hallucinations sometimes caused by HyDE (Hypothetical Document Embeddings), we generate likely user questions for each chunk during ingestion.

### How It Works

1.  **Base Chunks Created:** The Structure-Aware Chunker creates initial chunks.
2.  **Questions Generated:** An LLM generates 5-10 potential questions that each chunk can answer.
3.  **Embed & Store:** Both the original chunk and the generated questions are embedded.

When a user query comes in, it has a much higher chance of creating a direct vector match with one of the pre-generated questions, leading the system directly to the correct source chunk.
