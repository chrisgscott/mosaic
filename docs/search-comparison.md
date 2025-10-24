# Search Implementation Comparison

## Their Search (Vercel RAG Agent)

**From their `findRelevantContent` function:**

```typescript
export const findRelevantContent = async (userQuery: string) => {
  // 1. Embed the query
  const userQueryEmbedded = await generateEmbedding(userQuery);
  
  // 2. Calculate cosine similarity
  const similarity = sql<number>`1 - (${cosineDistance(
    embeddings.embedding,
    userQueryEmbedded,
  )})`;
  
  // 3. Query database
  const similarGuides = await db
    .select({ name: embeddings.content, similarity })
    .from(embeddings)
    .where(gt(similarity, 0.5))  // Threshold: 0.5
    .orderBy(t => desc(t.similarity))
    .limit(4);  // Return top 4
  
  return similarGuides;
}
```

### **Their Approach:**
1. Embed user query (single embedding)
2. Vector search with cosine similarity
3. Filter by similarity > 0.5
4. Return top 4 chunks
5. **That's it!**

### **Characteristics:**
- ✅ Simple
- ✅ Fast (~100-200ms)
- ✅ Easy to understand
- ❌ No query enhancement
- ❌ No reranking
- ❌ No graph
- ❌ Limited to 4 chunks
- ❌ No hybrid search

---

## Our Search (Mosaic)

**From `/apps/web/app/api/search/route.ts`:**

### **Our Pipeline:**

```
1. Query Analysis
   ↓
2. Complexity Detection (shouldUseHyDE)
   ↓
3a. Simple Query Path:           3b. Complex Query Path:
    - Single embedding               - HyDE generation
    - Vector search                  - Multi-Query generation
    - Reranking                      - Multiple embeddings
    - Top 10                         - Parallel vector searches
                                     - RRF fusion
                                     - Reranking
                                     - Top 10
   ↓
4. Graph Enhancement (optional)
   - Detect relationship queries
   - Traverse knowledge graph
   - Add connected entities
   ↓
5. Final Reranking (Cohere)
   ↓
6. Log Search Signals
   ↓
7. Return Results
```

### **Our Features:**

#### **1. Query Enhancement**
```typescript
// HyDE: Generate hypothetical document
const hydeDoc = await generateHyDE(query);
// "What is RAG?" → "RAG is a technique that combines..."

// Multi-Query: Generate variations
const variations = await generateMultiQuery(query);
// "What is RAG?" → [
//   "Explain retrieval augmented generation",
//   "How does RAG work in AI systems",
//   "RAG technique definition"
// ]
```

#### **2. Hybrid Search (RRF)**
```typescript
// Combine multiple search results with Reciprocal Rank Fusion
const fusedResults = fuseResults(searchResults, {
  k: 60,  // RRF constant
  weights: [1.0, 0.8, 0.6]  // Weight by query importance
});
```

#### **3. Graph Enhancement**
```typescript
// Detect relationship queries
if (isRelationshipQuery(query)) {
  // "How does X relate to Y?"
  const graphResults = await graphEnhancedSearch(query, {
    hops: 1,
    includeRelationships: true
  });
}
```

#### **4. Reranking (Cohere)**
```typescript
// Rerank with Cohere for precision
const reranked = await cohere.rerank({
  model: 'rerank-english-v3.0',
  query: query,
  documents: results.map(r => r.content),
  top_n: 10
});
```

#### **5. Search Signals**
```typescript
// Log for learning
await logSearchSignal(user.id, {
  query,
  queryEmbedding,
  chunkIds: results.map(r => r.chunk_id),
  rerankScores: results.map(r => r.rerank_score),
});
```

---

## Side-by-Side Comparison

| Feature | Theirs | Ours |
|---------|--------|------|
| **Embedding** | Single | Single OR Multiple (HyDE + Multi-Query) |
| **Vector Search** | Simple cosine | Hybrid (semantic + keyword via RRF) |
| **Query Enhancement** | None | HyDE + Multi-Query for complex queries |
| **Reranking** | None | Cohere rerank-v3 |
| **Graph Search** | None | Full knowledge graph traversal |
| **Result Count** | 4 chunks | 10 chunks |
| **Threshold** | 0.5 | 0.5 (configurable) |
| **Complexity Detection** | None | Automatic (word count, question words) |
| **Search Signals** | None | Full logging for learning |
| **Configuration** | Hardcoded | Database-driven settings |
| **Speed** | ~100-200ms | ~500-1500ms (depending on features) |
| **Accuracy** | Good | Excellent |

---

## Performance Comparison

### **Their Search:**
```
Query: "What is my favorite food?"
  ↓
Embed query (100ms)
  ↓
Vector search (50ms)
  ↓
Return 4 results
  ↓
Total: ~150ms
```

### **Our Search (Simple Query):**
```
Query: "favorite food"
  ↓
Detect: Simple query
  ↓
Embed query (100ms)
  ↓
Vector search (50ms)
  ↓
Rerank with Cohere (200ms)
  ↓
Return 10 results
  ↓
Total: ~350ms
```

### **Our Search (Complex Query):**
```
Query: "How does RAG improve LLM accuracy?"
  ↓
Detect: Complex query
  ↓
HyDE generation (500ms)
Multi-Query generation (500ms) [parallel]
  ↓
Generate 4 embeddings (400ms)
  ↓
4 parallel vector searches (200ms)
  ↓
RRF fusion (50ms)
  ↓
Rerank with Cohere (200ms)
  ↓
Graph enhancement (300ms) [if relationship query]
  ↓
Log search signals (50ms)
  ↓
Return 10 results
  ↓
Total: ~1200-1500ms
```

---

## Quality Comparison

### **Test Query: "How does X relate to Y?"**

**Their Result:**
- 4 chunks mentioning X or Y
- No relationship context
- May miss the connection

**Our Result:**
- 10 chunks about X, Y, and their relationship
- Graph traversal finds explicit relationships
- Reranking prioritizes relevant connections
- Higher accuracy

---

## When Each Approach Wins

### **Their Approach Wins When:**
- ✅ Speed is critical (< 200ms)
- ✅ Simple factual queries
- ✅ Small knowledge base
- ✅ Cost is a concern
- ✅ Simplicity is valued

### **Our Approach Wins When:**
- ✅ Complex queries
- ✅ Relationship queries
- ✅ Large knowledge base
- ✅ Accuracy is critical
- ✅ Learning from usage
- ✅ Need graph reasoning

---

## The Tool-Based Difference

### **Their Implementation:**
```typescript
// Search is a TOOL the AI calls
tools: {
  getInformation: tool({
    description: 'get information from your knowledge base',
    execute: async ({ question }) => findRelevantContent(question),
  }),
}
```

**Benefits:**
- AI decides WHEN to search
- Can search multiple times
- Can refine queries
- More agentic behavior

### **Our Implementation:**
```typescript
// Search is an ENDPOINT the chat route calls
const searchResponse = await fetch('/api/search', {
  method: 'POST',
  body: JSON.stringify({ query })
});
```

**Current State:**
- Chat always searches
- Single search per message
- No query refinement
- Less agentic

---

## What We Should Do

### **Option 1: Keep Separate (Current)**
**Pros:**
- Search endpoint useful for other features
- Can be called directly
- Easier to test

**Cons:**
- Chat always searches (even when not needed)
- No multi-step reasoning
- Less agentic

### **Option 2: Make Search a Tool (Recommended)**
**Pros:**
- AI decides when to search
- Can search multiple times
- Can refine queries
- More agentic behavior
- Still keep endpoint for other uses

**Cons:**
- More complex
- Need to handle tool calls in UI

### **Option 3: Both (Best of Both Worlds)**
```typescript
// Keep the endpoint
export async function POST(request: NextRequest) {
  // Full search pipeline
}

// Add as a tool
tools: {
  searchDocuments: tool({
    description: 'Search your knowledge base',
    execute: async ({ query, useGraph }) => {
      // Call our existing endpoint
      const response = await fetch('/api/search', {
        method: 'POST',
        body: JSON.stringify({ 
          query,
          use_graph: useGraph 
        })
      });
      return await response.json();
    },
  }),
}
```

**Benefits:**
- ✅ Keep endpoint for direct use
- ✅ Add tool for agentic behavior
- ✅ Reuse existing pipeline
- ✅ Best of both worlds

---

## Recommendation

### **Phase 1: Add Search Tool (This Week)**
1. Keep existing `/api/search` endpoint
2. Add `searchDocuments` tool to chat
3. Enable multi-step calls
4. AI decides when to search

### **Phase 2: Optimize (Next Week)**
1. Add "fast mode" for simple queries
2. Cache search results
3. Better tool descriptions

### **Phase 3: Advanced (This Month)**
1. Add query refinement tool
2. Add entity lookup tool
3. Add relationship exploration tool

---

## Conclusion

**Their search:**
- Simple, fast, effective for basic RAG
- 4 chunks, no enhancement, ~150ms

**Our search:**
- Advanced, accurate, production-grade
- 10 chunks, multiple enhancements, ~350-1500ms
- Much better for complex queries

**Best approach:**
- Keep our advanced search pipeline
- Add tool-based interface like theirs
- Get agentic behavior + advanced features
- Best of both worlds! 🚀
