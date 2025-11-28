# Graph Extraction Performance Fix

## Problem 🚨

Graph extraction was **timing out** and **overwhelming Supabase** with thousands of concurrent database calls:

```
2025-10-23 22:15:04 - ERROR - Error finding similar entity: The read operation timed out
2025-10-23 22:15:04 - ERROR - Error storing entity 'United States': The read operation timed out
2025-10-23 22:15:04 - ERROR - Error storing entity 'Silicon carbide': The read operation timed out
```

### Root Causes

1. **No caching** - Same entities looked up repeatedly (e.g., "China", "Aluminum" appeared 100+ times)
2. **Too many workers** - 20 concurrent workers → connection pool exhaustion
3. **No rate limiting** - Thousands of simultaneous RPC calls to `find_similar_entities`
4. **Inefficient pattern** - Every entity triggered a separate database round-trip

**Impact:**
- 1000 chunks × 5-7 entities/chunk = **5,000-7,000 RPC calls**
- Most timing out after 5-10 seconds
- Extraction taking 10+ minutes and failing

---

## Solution ✅

### 1. **Entity Cache** 🎯
```python
# Cache entity lookups by canonical_name:type
self.entity_cache: Dict[str, str] = {}  # canonical_name:type -> entity_id

# Check cache before DB lookup
cache_key = f"{canonical_name}:{entity_type}"
if cache_key in self.entity_cache:
    self.cache_hits += 1
    return self.entity_cache[cache_key]
```

**Benefits:**
- Avoids redundant `find_similar_entities` calls
- 50-80% reduction in DB calls expected
- Cleared after each batch to free memory

### 2. **Rate Limiting** ⏱️
```python
def _rate_limit_db_call(self):
    """Rate limit database calls to avoid overwhelming Supabase"""
    elapsed = time.time() - self.last_db_call
    if elapsed < self.min_db_interval:
        time.sleep(self.min_db_interval - elapsed)
    self.last_db_call = time.time()
```

**Benefits:**
- 100ms minimum interval between DB calls
- Prevents connection pool exhaustion
- Applied to all DB operations (find, insert, update)

### 3. **Reduced Workers** 👷
```python
self.max_workers = int(os.getenv("GRAPH_EXTRACTION_WORKERS", "5"))  # Was 20
```

**Benefits:**
- Fewer concurrent DB connections
- Still provides parallelism without overwhelming DB
- Can be tuned via environment variable

### 4. **Cache Statistics** 📊
```python
logger.info(f"Entity cache stats: {self.cache_hits} hits, {self.cache_misses} misses ({cache_hit_rate:.1f}% hit rate)")
```

**Benefits:**
- Monitor cache effectiveness
- Tune cache strategy based on real data
- Identify optimization opportunities

---

## Expected Impact 🎉

### Before
- ❌ 5,000-7,000 DB calls per document
- ❌ Timeout errors every few seconds
- ❌ 10+ minutes per document
- ❌ Connection pool exhaustion

### After
- ✅ 1,000-2,000 DB calls per document (50-80% reduction)
- ✅ No timeout errors
- ✅ 2-3 minutes per document (3-5x faster)
- ✅ Stable DB connections

---

## Testing Instructions 🧪

1. **Restart the worker:**
   ```bash
   # Stop current worker
   pkill -f "python main.py"
   
   # Start fresh worker
   cd apps/backend/ingest
   python main.py
   ```

2. **Re-upload the document:**
   - Delete existing document from UI
   - Upload the same document again
   - Watch the logs for:
     - No timeout errors
     - Cache hit rate statistics
     - Faster completion

3. **Monitor logs for:**
   ```
   ✅ "Entity cache stats: X hits, Y misses (Z% hit rate)"
   ✅ "Graph extraction complete: X entities, Y relationships"
   ✅ No "The read operation timed out" errors
   ```

4. **Expected cache hit rate:**
   - First 100 chunks: 10-20% (building cache)
   - After 200 chunks: 50-70% (cache warmed up)
   - After 500 chunks: 70-85% (mature cache)

---

## Environment Variables

You can tune performance via `.env`:

```bash
# Number of concurrent workers (default: 5)
GRAPH_EXTRACTION_WORKERS=5

# Entity similarity threshold (default: 0.85)
ENTITY_SIMILARITY_THRESHOLD=0.85
```

**Tuning guidance:**
- **More workers** = faster but more DB load
- **Fewer workers** = slower but more stable
- Start with 5, increase to 10 if no timeouts

---

## Files Changed

- `apps/backend/ingest/processors/graph_extractor.py`
  - Added entity cache
  - Added rate limiting
  - Reduced default workers
  - Added cache statistics

---

## Next Steps

If you still see timeouts after this fix:

1. **Increase rate limit interval:**
   ```python
   self.min_db_interval = 0.2  # 200ms instead of 100ms
   ```

2. **Further reduce workers:**
   ```bash
   GRAPH_EXTRACTION_WORKERS=3
   ```

3. **Check Supabase connection pool:**
   - May need to increase pool size in Supabase dashboard
   - Or add connection pooling (pgbouncer)

4. **Consider batch RPC calls:**
   - Modify `find_similar_entities` to accept multiple entities
   - Process in batches of 10-20 entities per call
