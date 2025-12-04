# INBOX - Future Features & Ideas

Quick capture for ideas that need processing later. Run `/cleanup` to move items to build plans.

---

## Current Items

### RSS/External Content Integration
**Added:** 2025-12-03
**Status:** 💭 Future Enhancement
**Priority:** Medium (when migrating ELLEN to Mosaic)

**Context:**
ELLEN (TTI Strategic Materials project) has an `rss_feeds` table with ~3,700 news articles. Currently this content is:
- Stored with metadata (title, snippet, source, assessment, implications)
- Displayed in a news feed UI
- **NOT** chunked, embedded, or entity-extracted
- **NOT** available to chat/RAG functionality

The TTI Supabase project has empty infrastructure for this:
- `rss_feed_chunks` table (0 rows) - has `feed_id`, `chunk_index`, `content`, `embedding_1536`
- `rss_embed_jobs` table (3,687 jobs) - status tracking exists but not processing

**Problem:**
News articles can't be searched alongside documents or connected to the knowledge graph. Users can't ask "what recent news mentions lithium supply chain issues?" and get RAG-powered answers.

**Proposed Solution:**
When migrating ELLEN to Mosaic, treat RSS articles as documents:

```
rss_feeds → documents table → chunks → entities/relationships
```

**Implementation Approach:**
1. **RSS Fetcher stays app-level** - ELLEN handles polling feeds, deduplication, metadata extraction
2. **Content flows to Mosaic** - After fetching, POST article content to `/api/ingest`
3. **Mosaic processes normally** - Chunking, embeddings, entity extraction, graph building
4. **Add source_type marker** - `documents.metadata.source_type = 'rss'` for filtering

**Benefits:**
- Articles searchable alongside uploaded docs
- Entities extracted (people, orgs, materials mentioned in news)
- Graph connections between news and existing knowledge
- Chat can reference recent news in responses

**Migration Steps:**
1. Add `source_type` to documents metadata schema
2. Create RSS→Mosaic adapter in ELLEN
3. Backfill existing `rss_feeds` content through ingest pipeline
4. Deprecate `rss_feed_chunks` table (use unified `chunks`)
5. Update ELLEN chat to query Mosaic

**Estimated Effort:** 1-2 days when ready to migrate

**Dependencies:**
- ELLEN migration to Mosaic-based architecture
- Mosaic ingest API working (✅ complete)

---

## Template

```markdown
### [Feature Name]
**Added:** YYYY-MM-DD
**Status:** 💭 Idea / 🎯 Priority / 📋 Planned
**Priority:** High/Medium/Low

**Problem:** What problem does this solve?
**Proposed Solution:** Brief description
**Estimated Effort:** Time estimate
**Dependencies:** What needs to exist first?
```
