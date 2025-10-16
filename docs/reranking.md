# Reranking with Cohere Rerank API

## Overview

Reranking is the final step in our search pipeline that significantly improves result quality by re-scoring hybrid search candidates using a cross-encoder model.

## Search Pipeline

```
Query
  ↓
Embedding Generation (OpenAI text-embedding-3-small)
  ↓
Hybrid Search (Semantic + BM25 with RRF)
  ↓ (20 candidates)
Reranking (Cohere rerank-english-v3.0)
  ↓ (Top 10 final results)
User
```

## Why Reranking?

**Hybrid Search (RRF):**
- Fast (~1.3s)
- Good recall (finds relevant documents)
- Combines semantic + keyword matching
- Scores: 0.5-0.7 for relevant results

**Reranking:**
- Slower (+200-500ms)
- Excellent precision (orders results perfectly)
- Cross-encoder sees query + document together
- Scores: 0.7-0.95 for relevant results

**Result:** Better top 3-5 results, crucial for RAG chat where only top results go to LLM.

## Implementation

### Cohere Rerank API

**Why Cohere:**
- Production-ready reranking API
- State-of-the-art model (rerank-english-v3.0)
- Simple integration
- Reliable performance (~200ms)
- No cold starts

**Pricing:**
- **Free Trial:** 100 rerank requests/month
- **Production:** $1 per 1000 searches
- Very cost-effective for most use cases

**Get API Key:**
1. Go to https://dashboard.cohere.com/api-keys
2. Sign up for free account
3. Create API key
4. Add to `.env.local`: `COHERE_API_KEY=your_key`

## Configuration

### Environment Variables

```bash
# Required for reranking
COHERE_API_KEY=your_cohere_key

# If not set, reranking is skipped (graceful degradation)
```

### Search Parameters

```typescript
// In /api/search
const candidateCount = match_count * 2;  // Get 20 candidates
// Rerank to top 10 final results
```

## Performance

**Typical latency:**
- Hybrid search: ~1.3s
- Reranking: +200-500ms
- **Total: ~1.5-1.8s**

**Quality improvement:**
- Hybrid only: 0.5-0.7 similarity
- With reranking: 0.7-0.95 relevance scores
- Top 3 results significantly more accurate

## Monitoring

Check logs for reranking performance:

```
[Search] Found 20 hybrid search candidates
[Rerank] Completed in 234ms
[Rerank] Score changes:
  1. Rerank: 0.892 | RRF: 0.0312 | Moved from position 3
  2. Rerank: 0.847 | RRF: 0.0328 | Moved from position 1
  3. Rerank: 0.801 | RRF: 0.0295 | Moved from position 5
```

## Migration Path

### Phase 1: Free Tier (Current)
- Testing and validation
- 1000 requests/day
- $0 cost

### Phase 2: PRO Tier
- Production deployment
- Unlimited requests
- $9/month

### Phase 3: Self-Hosted
- When volume justifies it (>100k searches/month)
- Or for data security requirements
- Same BGE model, run on your infrastructure
- Use GPU for best performance (~100ms)

## Self-Hosting (Future)

When ready to self-host:

```python
# In your Python worker
from sentence_transformers import CrossEncoder

model = CrossEncoder('BAAI/bge-reranker-v2-m3')
scores = model.predict([(query, doc) for doc in candidates])
```

**Requirements:**
- 2GB RAM for model
- GPU recommended (10x faster)
- Can run in existing worker container

## Fallback Behavior

If reranking fails:
- ✅ Returns hybrid search results (graceful degradation)
- ✅ Logs error for monitoring
- ✅ No user-facing errors
- ✅ System continues to work

## Testing

Test reranking quality:

```bash
# Search for "What are the SDA methodologies?"
# Check logs for score improvements
# Compare results with/without HUGGINGFACE_API_KEY
```

## Cost Analysis

**Hugging Face PRO ($9/mo):**
- Unlimited searches
- Fixed cost, predictable
- Best for <100k searches/month

**Self-hosted:**
- $0 per search
- Infrastructure cost: ~$50-100/mo (GPU instance)
- Best for >100k searches/month

**Break-even: ~100k searches/month**

## Next Steps

1. ✅ Get free HF API key
2. ✅ Test reranking quality
3. ⏳ Upgrade to PRO when launching
4. ⏳ Self-host when volume justifies it
