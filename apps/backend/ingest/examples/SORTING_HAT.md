# The Sorting Hat 🎩✨

**Intelligent automatic routing to the optimal chunking strategy for each document.**

Like the Harry Potter Sorting Hat, but for chunking strategies!

## What It Does

The Sorting Hat analyzes each document and automatically determines the best chunking strategy based on:

- **Document type** (research paper, manual, card deck, article, etc.)
- **Structure** (hierarchical, sequential, card-based, unstructured)
- **Size** (small, medium, large, massive)
- **Complexity** (simple, moderate, complex)
- **Patterns** (repeating markers, consistent headings)
- **Content** (tables, code, figures)

## How It Works

### 1. Document Analysis
Samples the document (beginning, middle, end) and analyzes:

```json
{
  "document_type": "card_deck",
  "structure_type": "card_based",
  "complexity": "moderate",
  "has_clear_sections": true,
  "heading_consistency": "variable",
  "repeating_patterns": ["pipdecks.com", "numbered steps"],
  "estimated_size": "medium"
}
```

### 2. Strategy Recommendation
Based on analysis, recommends optimal strategy:

```json
{
  "recommended_strategy": "agentic",
  "reasoning": "Card deck with variable category labels (Purpose, Recipe, etc.) requires semantic understanding to identify card boundaries",
  "confidence": "high"
}
```

### 3. Configuration Generation
Creates complete chunking config:

```json
{
  "strategy": "agentic",
  "model": "gpt-4o-mini",
  "document_type": "card_deck",
  "instructions": "Each card has category label, title, description, steps, and footer. Keep cards together as chunks.",
  "max_chunk_tokens": 512
}
```

### 4. Automatic Routing
Document is routed to the appropriate chunker with optimal settings.

## Strategies

### Hybrid (Default)
**Best for:** General documents with clear hierarchy  
**When used:** Well-structured documents with consistent headings  
**Cost:** Free (no LLM calls)  
**Speed:** Fast

**Example:** Technical documentation, blog posts, articles

### Custom Boundary
**Best for:** Documents with consistent patterns  
**When used:** Repeating markers like "Chapter", "Recipe", "Section"  
**Cost:** Free (pattern matching)  
**Speed:** Fast

**Example:** Books with "Chapter N" markers, numbered sections

### Agentic
**Best for:** Variable structure needing semantic understanding  
**When used:** Inconsistent formatting, changing labels, complex layouts  
**Cost:** ~$0.30 per document  
**Speed:** Moderate

**Example:** Card decks with variable categories, mixed-format documents

### Planner-Executor
**Best for:** Large/complex documents  
**When used:** >500 pages, complex structure, need global awareness  
**Cost:** ~$0.07-0.60 depending on size  
**Speed:** Fast (parallel processing)

**Example:** Research papers, manuals, books, massive PDFs

## Usage

### Automatic (Recommended)

Just upload a document without specifying `chunking_config`:

```python
# Upload document
document_id = upload_document(file_data, file_name)

# Sorting Hat automatically:
# 1. Analyzes document
# 2. Chooses strategy
# 3. Configures chunker
# 4. Saves config to document
```

**Logs:**
```
🎩 No chunking config - consulting the Sorting Hat...
🎩 Sorting Hat analyzing: Strategy_Tactics_PDF.pdf
🎩 Sorted into: agentic (confidence: high)
   Reasoning: Card deck with variable category labels requires semantic understanding
🎩 Saved Sorting Hat decision to document
```

### Manual Override

You can still manually specify a strategy:

```sql
UPDATE documents
SET chunking_config = '{
  "strategy": "planner_executor",
  "planner_model": "gemini-2.0-flash-exp"
}'::jsonb
WHERE id = 'document-id';
```

### User Preferences

Pass preferences to influence the decision:

```python
user_preferences = {
    "prefer_speed": True,  # Favor faster strategies
    "prefer_accuracy": True,  # Favor more accurate strategies
    "max_cost": 0.10,  # Cost ceiling
    "force_strategy": "hybrid"  # Override completely
}
```

## Decision Matrix

| Document Type | Size | Structure | Recommended Strategy |
|---------------|------|-----------|---------------------|
| Research Paper | <200 pages | Hierarchical | **Hybrid** |
| Research Paper | >500 pages | Hierarchical | **Planner-Executor** |
| Card Deck | Any | Variable labels | **Agentic** |
| Manual | <300 pages | Consistent sections | **Custom Boundary** |
| Manual | >500 pages | Complex | **Planner-Executor** |
| Article | Any | Simple | **Hybrid** |
| Transcript | Any | Unstructured | **Hybrid** (sliding window) |
| Book | >500 pages | Chapters | **Planner-Executor** |

## Examples

### Example 1: Strategy Tactics (Card Deck)

**Input:** 113-page PDF with variable category labels

**Analysis:**
```json
{
  "document_type": "card_deck",
  "structure_type": "card_based",
  "heading_consistency": "variable",
  "repeating_patterns": ["pipdecks.com"],
  "recommended_strategy": "agentic"
}
```

**Decision:** Agentic chunking  
**Reasoning:** Variable category labels (Purpose, Recipe, etc.) need semantic understanding  
**Result:** Each card = one perfect chunk

### Example 2: Research Paper (850 pages)

**Input:** 850-page, 158MB PDF

**Analysis:**
```json
{
  "document_type": "research_paper",
  "structure_type": "hierarchical",
  "estimated_size": "massive",
  "has_clear_sections": true,
  "recommended_strategy": "planner_executor"
}
```

**Decision:** Planner-Executor with two-pass  
**Reasoning:** Too large for single-pass, needs global awareness  
**Result:** 2000 semantically coherent chunks

### Example 3: Blog Post (5 pages)

**Input:** 5-page article with clear headings

**Analysis:**
```json
{
  "document_type": "article",
  "structure_type": "hierarchical",
  "complexity": "simple",
  "has_clear_sections": true,
  "recommended_strategy": "hybrid"
}
```

**Decision:** Hybrid chunking  
**Reasoning:** Simple structure, clear headings, no need for expensive analysis  
**Result:** Fast, accurate chunks at no extra cost

## Cost Analysis

### Per Document

| Strategy | Analysis Cost | Chunking Cost | Total |
|----------|---------------|---------------|-------|
| Hybrid | $0 | $0 | **$0** |
| Custom Boundary | $0 | $0 | **$0** |
| Agentic | $0.001 | $0.30 | **$0.30** |
| Planner-Executor | $0.001 | $0.07-0.60 | **$0.07-0.60** |

**Sorting Hat analysis:** ~$0.001 per document (negligible)

### Value Proposition

**Without Sorting Hat:**
- User must manually choose strategy
- Wrong choice = bad chunks
- Fixing bad chunks = $2-5 + hours of work

**With Sorting Hat:**
- Automatic optimal choice
- Right strategy every time
- $0.001 analysis cost
- Saves time and money

## Benefits

### 1. Zero Configuration
- Upload and go
- No strategy knowledge needed
- Optimal results automatically

### 2. Intelligent Routing
- Analyzes each document individually
- Adapts to document characteristics
- Learns from patterns

### 3. Cost Optimization
- Uses cheapest strategy that works
- Avoids expensive strategies when unnecessary
- Maximizes accuracy per dollar

### 4. Transparency
- Logs decision and reasoning
- Saves config to document
- Can review and override

### 5. Consistency
- Same document type → same strategy
- Reproducible results
- Predictable costs

## Advanced Features

### Learning from Feedback

Future enhancement: Learn from user corrections

```python
# User corrects Sorting Hat decision
feedback = {
    "document_id": "doc-123",
    "suggested_strategy": "agentic",
    "actual_strategy": "planner_executor",
    "reason": "Document was larger than estimated"
}

# Sorting Hat learns and improves
```

### Strategy Templates

Pre-defined templates for common document types:

```python
templates = {
    "pip_decks_card_deck": {
        "strategy": "agentic",
        "document_type": "card_deck",
        "instructions": "Pip Decks card format..."
    },
    "academic_paper": {
        "strategy": "planner_executor",
        "document_type": "research_paper"
    }
}
```

### Confidence Thresholds

Require manual review for low-confidence decisions:

```python
if confidence == "low":
    # Flag for manual review
    notify_user("Sorting Hat unsure - please review")
```

## Implementation Status

✅ **Complete and Integrated!**

The Sorting Hat is:
- Fully implemented in `chunkers/sorting_hat.py`
- Integrated into main processing pipeline
- Automatically runs when no `chunking_config` specified
- Saves decisions to document for transparency

## Next Steps

1. **Just upload documents!** The Sorting Hat handles the rest
2. **Review decisions** in document `chunking_config` field
3. **Override if needed** by setting custom config
4. **Provide feedback** to improve future decisions

---

**"The Sorting Hat takes your qualities and finds you the perfect strategy!"** 🎩✨
