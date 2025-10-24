# Per-Document Chunk Size Optimization

**Status:** ✅ Implemented (Phase 1.1)  
**Date:** October 23, 2025

## Overview

The Sorting Hat now automatically analyzes each document and determines the optimal chunk size (128, 256, 512, or 1024 tokens) based on document characteristics. This is done using **fast heuristics** - no LLM calls needed!

## Why This Matters

Different documents need different chunk sizes, even within the same project:

- **Technical docs** with dense content → 128 tokens (precise)
- **Well-structured articles** → 256 tokens (balanced)
- **Long-form narratives** → 512 tokens (contextual)
- **Very long paragraphs** → 1024 tokens (preserve context)

A one-size-fits-all approach is suboptimal. Per-document analysis gives us the best of all worlds.

## How It Works

### Analysis Metrics

The system analyzes:

1. **Sentence length** - Average words per sentence
2. **Paragraph length** - Average words per paragraph
3. **Structure** - Presence of headers, lists, code blocks
4. **Information density** - Technical terms, numbers, acronyms

### Decision Logic

```python
# Very long sentences/paragraphs → 1024 tokens
if avg_sentence_len > 40 or avg_para_len > 120:
    return 1024

# Dense technical content → 128 tokens
elif density_score > 0.2:
    return 128

# Long-form narrative → 512 tokens
elif avg_para_len > 50 and avg_sentence_len > 15:
    return 512

# Well-structured content → 256 tokens
elif structure_score > 0.6 or (avg_para_len < 50 and avg_para_len > 5):
    return 256

# Default → 256 tokens
else:
    return 256
```

## Examples

### Dense Technical Content → 128 tokens

```
API endpoint: /v1/users
HTTP method: GET
Auth: Bearer token
Response: JSON
Status codes: 200, 401, 404
Rate limit: 100 req/min
TTL: 3600s
```

**Analysis:**
- Density score: 0.39 (high)
- Avg sentence: 28 words
- **Result:** 128 tokens

### Well-Structured Content → 256 tokens

```markdown
# Introduction

This document describes the architecture.

## Components

- Frontend: React
- Backend: Node.js
- Database: PostgreSQL

## Data Flow

1. User makes request
2. Frontend sends to API
3. API queries database
```

**Analysis:**
- Structure score: 0.67 (headers + lists)
- Avg paragraph: 7.8 words
- **Result:** 256 tokens

### Long-Form Narrative → 512 tokens

```
The history of artificial intelligence is a fascinating journey 
that spans several decades. It began in the 1950s when researchers 
first started exploring the possibility of creating machines that 
could think and learn like humans...

In the early days, researchers were optimistic about the potential 
of AI. They believed that within a few decades, machines would be 
able to perform any intellectual task that a human could do...
```

**Analysis:**
- Avg paragraph: 65 words
- Avg sentence: 17.7 words
- **Result:** 512 tokens

### Very Long Paragraphs → 1024 tokens

```
The comprehensive analysis of modern distributed systems architecture 
reveals a complex interplay between various components, each designed 
to handle specific aspects of scalability, reliability, and performance 
optimization, while simultaneously addressing the challenges of data 
consistency, network partitioning, and fault tolerance...
```

**Analysis:**
- Avg sentence: 149 words (very long!)
- **Result:** 1024 tokens

## Integration

### Automatic

The Sorting Hat automatically runs chunk size analysis when processing documents:

```python
from chunkers.sorting_hat import SortingHat

hat = SortingHat()
config = hat.sort(content, "document.pdf")

print(f"Strategy: {config['strategy']}")
print(f"Chunk size: {config['chunk_size']}")
print(f"Chunk overlap: {config['chunk_overlap']}")
print(f"Reasoning: {config['chunk_size_analysis']['reasoning']}")
```

### Manual Override

You can override the automatic analysis:

```python
user_preferences = {
    'chunk_size': 512,
    'chunk_overlap': 100
}

config = hat.sort(content, "document.pdf", user_preferences)
```

## Configuration Output

The Sorting Hat now returns:

```json
{
  "strategy": "hybrid",
  "chunk_size": 256,
  "chunk_overlap": 51,
  "confidence": "high",
  "reasoning": "Well-structured documentation",
  "chunk_size_analysis": {
    "optimal_size": 256,
    "reasoning": "Well-structured with clear sections and medium paragraphs - balanced chunk size",
    "confidence": 0.85,
    "metrics": {
      "avg_sentence_len": 10.0,
      "avg_para_len": 7.78,
      "density_score": 0.13,
      "structure_score": 0.67
    }
  }
}
```

## Benefits

✅ **Zero cost** - No LLM calls, just fast text statistics  
✅ **Automatic** - Works out of the box, no configuration needed  
✅ **Transparent** - Logs reasoning and metrics  
✅ **Overridable** - Can be manually configured if needed  
✅ **Consistent** - Same document always gets same chunk size  

## Performance

- **Analysis time:** <100ms per document
- **Cost:** $0 (no API calls)
- **Accuracy:** 100% on test suite

## Testing

Run the test suite:

```bash
cd apps/backend/ingest
python tests/test_chunk_size_analysis.py
```

All tests should pass:
- ✓ Dense technical content → 128 tokens
- ✓ Well-structured content → 256 tokens
- ✓ Long-form narrative → 512 tokens
- ✓ Very long paragraphs → 1024 tokens
- ✓ Mixed content → 256 tokens
- ✓ Full integration test

## Next Steps

- [x] Phase 1.1: Per-document chunk size optimization
- [ ] Phase 1.2: Document augmentation (question generation)
- [ ] Phase 2: Proposition chunking
- [ ] Phase 3: Advanced enhancements

## References

- Plan: `CHUNKING_IMPROVEMENTS_PLAN.md`
- Implementation: `chunkers/sorting_hat.py`
- Tests: `tests/test_chunk_size_analysis.py`
- Research: `/Users/chrisgscott/projects/meet-mosaic/docs/RAG_Techniques/all_rag_techniques_runnable_scripts/choose_chunk_size.py`
