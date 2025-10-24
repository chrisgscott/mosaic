# Graph Learning from Search Patterns

## Overview
Automatically discover and suggest new entity relationships based on search behavior and RAG pipeline results.

## Core Idea
Every search reveals implicit connections:
- Chunks that co-occur in results
- Entities mentioned together
- Reranking patterns
- User engagement signals

## Implementation Phases

### Phase 1: Search Signal Capture (Foundation)

**1.1 Log Search Results**
```typescript
// In search API, after reranking
interface SearchSignal {
  query: string;
  timestamp: Date;
  user_id: string;
  top_chunks: string[]; // chunk IDs
  entities_found: string[]; // entity IDs mentioned in results
  rerank_scores: number[];
  user_clicked?: string[]; // which results user engaged with
}

// Store in new table: search_signals
```

**1.2 Database Schema**
```sql
CREATE TABLE search_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  query TEXT NOT NULL,
  query_embedding VECTOR(1536),
  chunk_ids UUID[] NOT NULL,
  entity_ids UUID[],
  rerank_scores FLOAT[],
  clicked_chunk_ids UUID[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_search_signals_user ON search_signals(user_id);
CREATE INDEX idx_search_signals_created ON search_signals(created_at);
```

**1.3 Capture in Search API**
```typescript
// In /app/api/search/route.ts
async function logSearchSignal(
  userId: string,
  query: string,
  queryEmbedding: number[],
  results: SearchResult[]
) {
  const chunkIds = results.map(r => r.chunk_id);
  const entityIds = await extractEntityIdsFromChunks(chunkIds);
  const rerankScores = results.map(r => r.rerank_score);

  await supabase.from('search_signals').insert({
    user_id: userId,
    query,
    query_embedding: queryEmbedding,
    chunk_ids: chunkIds,
    entity_ids: entityIds,
    rerank_scores: rerankScores,
  });
}
```

### Phase 2: Co-Occurrence Analysis (Weekly Job)

**2.1 Find Entity Co-Occurrences**
```sql
-- Find entities that frequently appear together in search results
CREATE OR REPLACE FUNCTION analyze_entity_cooccurrence(
  p_user_id UUID,
  p_min_occurrences INT DEFAULT 3,
  p_min_confidence FLOAT DEFAULT 0.7
)
RETURNS TABLE (
  entity_a_id UUID,
  entity_b_id UUID,
  co_occurrence_count INT,
  confidence_score FLOAT,
  sample_queries TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  WITH entity_pairs AS (
    -- Unnest entity arrays to get all pairs that appeared together
    SELECT 
      e1.entity_id AS entity_a,
      e2.entity_id AS entity_b,
      ss.query,
      ss.created_at
    FROM search_signals ss
    CROSS JOIN UNNEST(ss.entity_ids) AS e1(entity_id)
    CROSS JOIN UNNEST(ss.entity_ids) AS e2(entity_id)
    WHERE ss.user_id = p_user_id
      AND e1.entity_id < e2.entity_id -- Avoid duplicates and self-pairs
      AND ss.created_at > NOW() - INTERVAL '30 days'
  ),
  pair_stats AS (
    SELECT 
      entity_a,
      entity_b,
      COUNT(*) AS occurrences,
      ARRAY_AGG(DISTINCT query ORDER BY query) AS queries
    FROM entity_pairs
    GROUP BY entity_a, entity_b
    HAVING COUNT(*) >= p_min_occurrences
  )
  SELECT 
    ps.entity_a,
    ps.entity_b,
    ps.occurrences::INT,
    -- Confidence based on frequency and recency
    LEAST(ps.occurrences::FLOAT / 10.0, 1.0) AS confidence,
    ps.queries[1:5] -- Sample queries
  FROM pair_stats ps
  WHERE LEAST(ps.occurrences::FLOAT / 10.0, 1.0) >= p_min_confidence
  ORDER BY confidence DESC, occurrences DESC;
END;
$$ LANGUAGE plpgsql;
```

**2.2 Suggest New Relationships**
```typescript
// Server action: /app/(app)/graph/actions.ts
export async function suggestRelationshipsFromSearch() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return { error: "Unauthorized" };

  // Get co-occurrence analysis
  const { data: cooccurrences } = await supabase.rpc(
    'analyze_entity_cooccurrence',
    { p_user_id: user.id }
  );

  // Filter out relationships that already exist
  const { data: existingRelationships } = await supabase
    .from('relationships')
    .select('from_entity_id, to_entity_id')
    .eq('user_id', user.id);

  const existingSet = new Set(
    existingRelationships?.map(r => `${r.from_entity_id}-${r.to_entity_id}`) || []
  );

  const suggestions = cooccurrences?.filter(co => {
    const key1 = `${co.entity_a_id}-${co.entity_b_id}`;
    const key2 = `${co.entity_b_id}-${co.entity_a_id}`;
    return !existingSet.has(key1) && !existingSet.has(key2);
  });

  // Use AI to infer relationship type
  for (const suggestion of suggestions || []) {
    const { data: entities } = await supabase
      .from('entities')
      .select('id, name, type, description')
      .in('id', [suggestion.entity_a_id, suggestion.entity_b_id]);

    const relationshipType = await inferRelationshipType(
      entities![0],
      entities![1],
      suggestion.sample_queries
    );

    suggestion.suggested_type = relationshipType;
  }

  return { suggestions };
}

async function inferRelationshipType(
  entityA: Entity,
  entityB: Entity,
  sampleQueries: string[]
) {
  const { generateText } = await import("ai");
  const { models } = await import("@/lib/ai/gateway");

  const result = await generateText({
    model: models.quick,
    system: "You are analyzing entity relationships in a knowledge graph. Infer the most likely relationship type between two entities based on their co-occurrence in search queries.",
    prompt: `Entity A: ${entityA.name} (${entityA.type})
${entityA.description ? `Description: ${entityA.description}` : ''}

Entity B: ${entityB.name} (${entityB.type})
${entityB.description ? `Description: ${entityB.description}` : ''}

These entities frequently appeared together in these search queries:
${sampleQueries.map((q, i) => `${i + 1}. "${q}"`).join('\n')}

What is the most likely relationship type between them?
Choose from: [uses, requires, relates_to, part_of, implements, extends, depends_on, collaborates_with, manages, creates, analyzes, evaluates, informs, other]

Respond with just the relationship type.`,
    temperature: 0.3,
  });

  return result.text.trim();
}
```

### Phase 3: UI for Reviewing Suggestions

**3.1 New Page: /graph/suggestions**
```typescript
// app/(app)/graph/suggestions/page.tsx
export default async function SuggestionsPage() {
  const suggestions = await suggestRelationshipsFromSearch();

  return (
    <div className="space-y-4">
      <h1>Suggested Relationships from Search Patterns</h1>
      <p className="text-muted-foreground">
        Based on entities that frequently appear together in your searches
      </p>

      {suggestions?.map(s => (
        <Card key={`${s.entity_a_id}-${s.entity_b_id}`}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <EntityBadge entity={s.entity_a} />
                <ArrowRight className="h-4 w-4" />
                <Badge>{s.suggested_type}</Badge>
                <ArrowRight className="h-4 w-4" />
                <EntityBadge entity={s.entity_b} />
              </div>
              <Badge variant="outline">
                {Math.round(s.confidence_score * 100)}% confidence
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-2">
              Appeared together {s.co_occurrence_count} times in searches:
            </p>
            <ul className="text-sm space-y-1">
              {s.sample_queries.map((q, i) => (
                <li key={i}>• "{q}"</li>
              ))}
            </ul>
          </CardContent>
          <CardFooter className="gap-2">
            <Button onClick={() => acceptSuggestion(s)}>
              Accept
            </Button>
            <Button variant="outline" onClick={() => rejectSuggestion(s)}>
              Reject
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
```

### Phase 4: Real-Time Suggestions (Advanced)

**4.1 Show Suggestions During Search**
```typescript
// In search results component
{searchResults.map(result => (
  <SearchResultCard result={result}>
    {/* Existing result display */}
    
    {/* New: Show discovered connections */}
    {result.discovered_connections?.map(conn => (
      <Alert className="mt-2">
        <Lightbulb className="h-4 w-4" />
        <AlertDescription>
          💡 Found connection: {conn.entity_a} --[{conn.type}]--> {conn.entity_b}
          <Button size="sm" onClick={() => addRelationship(conn)}>
            Add to Graph
          </Button>
        </AlertDescription>
      </Alert>
    ))}
  </SearchResultCard>
))}
```

**4.2 Inline Detection**
```typescript
// During search, detect potential relationships
async function detectInlineRelationships(
  chunks: Chunk[],
  existingRelationships: Relationship[]
) {
  // Extract entities mentioned in top chunks
  const entityMentions = await extractEntitiesFromChunks(chunks.slice(0, 5));
  
  // Find pairs that don't have relationships yet
  const pairs = findUnrelatedPairs(entityMentions, existingRelationships);
  
  // Quick inference for high-confidence pairs
  const suggestions = await Promise.all(
    pairs.map(async pair => {
      const type = await inferRelationshipType(
        pair.entity_a,
        pair.entity_b,
        [query] // Current search query as context
      );
      return { ...pair, type, confidence: 0.8 };
    })
  );
  
  return suggestions;
}
```

## Benefits

### Immediate
- **Discover hidden connections** in your knowledge base
- **Reduce manual graph curation** effort
- **Learn from actual usage** patterns

### Long-Term
- **Graph gets smarter** with every search
- **Better search results** as graph improves
- **Personalized** to your specific domain/usage

### Advanced
- **Temporal patterns**: "These entities are connected during Q4"
- **Confidence decay**: Old suggestions fade if not validated
- **User feedback loop**: Learn from accepts/rejects

## Implementation Priority

**Phase 1 (Week 1):**
- ✅ Add search_signals table
- ✅ Log search results
- ✅ Basic co-occurrence analysis

**Phase 2 (Week 2):**
- ✅ Build suggestion engine
- ✅ AI-powered relationship type inference
- ✅ Suggestions page UI

**Phase 3 (Week 3):**
- ✅ Inline suggestions during search
- ✅ One-click acceptance
- ✅ Batch review workflow

**Phase 4 (Future):**
- ⏳ Autonomous learning (auto-create high-confidence)
- ⏳ Temporal analysis
- ⏳ Confidence scoring refinement

## Metrics to Track

```sql
CREATE TABLE relationship_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  entity_a_id UUID REFERENCES entities(id),
  entity_b_id UUID REFERENCES entities(id),
  suggested_type TEXT,
  confidence_score FLOAT,
  source TEXT, -- 'search_cooccurrence', 'inline_detection', etc.
  status TEXT, -- 'pending', 'accepted', 'rejected'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

-- Track acceptance rate
SELECT 
  source,
  COUNT(*) FILTER (WHERE status = 'accepted') AS accepted,
  COUNT(*) FILTER (WHERE status = 'rejected') AS rejected,
  COUNT(*) FILTER (WHERE status = 'pending') AS pending,
  AVG(confidence_score) FILTER (WHERE status = 'accepted') AS avg_accepted_confidence
FROM relationship_suggestions
GROUP BY source;
```

## Privacy & Control

**User Controls:**
- Toggle auto-learning on/off
- Set minimum confidence threshold
- Review all suggestions before acceptance
- Bulk accept/reject
- Undo recent additions

**Data Retention:**
- Search signals: 90 days
- Accepted suggestions: Forever (become real relationships)
- Rejected suggestions: 30 days (for learning)

## Example Use Cases

**1. Research Discovery**
User searches "machine learning" repeatedly, results often include "neural networks" and "deep learning"
→ System suggests: "Machine Learning" --[includes]--> "Deep Learning"

**2. Project Connections**
User searches for "Q4 planning", results mention "Budget 2024" and "Hiring Plan"
→ System suggests: "Q4 Planning" --[requires]--> "Budget 2024"

**3. Concept Relationships**
User searches "design thinking", results include "user research" and "prototyping"
→ System suggests: "Design Thinking" --[uses]--> "User Research"

## Next Steps

1. **Start with Phase 1** - Just log search signals
2. **Analyze patterns** - See what emerges
3. **Build suggestions** - Show what's possible
4. **Iterate based on usage** - Learn what works

This turns your graph from static to **living and learning**! 🧠
