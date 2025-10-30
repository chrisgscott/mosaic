# Architecture Decision: Unified Search Pipeline for Chat

**Date:** October 19, 2025  
**Status:** ✅ Implemented  
**Impact:** High - Affects all RAG chat functionality

## Decision

The RAG chat feature (`/api/chat`) **reuses the full search API** (`/api/search`) instead of implementing its own search logic.

## Context

When implementing Phase 6.5 (RAG Answer Generation), we initially built a basic semantic search directly in the chat API. However, this bypassed all the sophisticated RAG enhancements we had already built:

- HyDE (Hypothetical Document Embeddings)
- Multi-Query (query variations)
- Hybrid Search (Semantic + BM25 with RRF)
- Reranking (Cohere)
- Graph Search (for relationship queries)
- System settings (database-driven configuration)

## Solution

The chat API now calls the search API internally:

```typescript
// Chat API calls Search API
const searchResponse = await searchAPI(searchRequest);
const results = searchData.results;

// Then feeds results to LLM
const streamResult = await generateStreamingAnswer({
  query,
  searchResults: results,
  // ...
});
```

## Benefits

### ✅ Consistency
- Search page and chat page use identical search logic
- Users get the same quality results in both interfaces

### ✅ Settings Respect
- Chat automatically respects system settings from `/settings/general`
- Admins can toggle HyDE, Multi-Query, Reranking, Graph Search
- Changes apply to both search and chat immediately

### ✅ Single Source of Truth
- One place to improve search quality
- Fixes and enhancements benefit both features
- Easier to maintain and test

### ✅ Feature Parity
- Complex queries benefit from HyDE
- Relationship queries use graph search
- All results are reranked for quality
- Multi-query improves recall

## Trade-offs

### Considered Alternative: Duplicate Logic
We could have duplicated the search logic in the chat API.

**Rejected because:**
- Violates DRY principle
- Settings changes wouldn't apply to chat
- Bug fixes would need to be applied twice
- Divergence over time is inevitable

### Performance Impact
Calling the search API adds minimal overhead (~10-50ms) compared to the benefits of using the full pipeline.

## Implementation

### Before (Basic Search)
```typescript
// Direct database call - bypasses all enhancements
const { data } = await supabase.rpc("search_chunks_hybrid", {
  query_text: query,
  query_embedding: embedding,
  // ...
});
```

### After (Full Pipeline)
```typescript
// Use search API - gets all enhancements
const searchResponse = await searchAPI(searchRequest);
const results = searchData.results;
```

## System Settings Integration

The search API checks `system_settings` table for configuration:

```sql
SELECT key, value FROM system_settings 
WHERE category = 'search';
```

Settings respected:
- `search.useHyDE` - Enable HyDE for complex queries
- `search.useMultiQuery` - Generate query variations
- `search.useReranking` - Use Cohere rerank
- `search.useGraphSearch` - Enable graph traversal

## Future Considerations

### Phase 6.5.2: Context Management
When implementing smart context window management, we may need to:
- Add chunk prioritization logic
- Implement context compression
- This should still use search API results as input

### Phase 6.5.4: Deep Research Mode
For multi-step reasoning with CrewAI:
- Each research step should use the search API
- CrewAI agents can call search API multiple times
- Maintains consistency across all retrieval

## Lessons Learned

1. **Reuse before rebuild** - Check existing APIs before implementing new logic
2. **Settings-driven** - Database configuration is more flexible than hardcoded logic
3. **Modular design** - Search API was designed to be composable
4. **Test both paths** - Ensure search page and chat page get same results

## Related Files

- `/apps/web/app/api/search/route.ts` - Full search pipeline
- `/apps/web/app/api/chat/route.ts` - Chat API (calls search API)
- `/apps/web/lib/ai/answer-generator.ts` - LLM answer generation
- `/apps/web/app/(app)/settings/general/page.tsx` - Settings UI

## References

- BUILD_PLAN.md - Phase 6.5 specification
- COMPLETED_ITEMS.md - Phases 1-5 (search pipeline)
- docs/graph-rag.md - Graph search documentation
