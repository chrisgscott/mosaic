# RAG Answer Generation

This directory contains the core RAG (Retrieval-Augmented Generation) answer generation functionality for Mosaic.

## Architecture

### Flow
1. **User Query** → Chat UI (`/chat`)
2. **Full Search Pipeline** → `/api/search` with all enhancements:
   - HyDE (Hypothetical Document Embeddings)
   - Multi-Query (query variations)
   - Hybrid Search (Semantic + BM25 with RRF)
   - Reranking (Cohere)
   - Graph Search (for relationship queries)
   - **Respects system settings** from database
3. **Context Building** → Format chunks with citations
4. **LLM Generation** → Stream answer with sources
5. **Display** → Show answer + clickable source citations

### Key Design Decision

**Chat uses the same search pipeline as the search page.** This ensures:
- ✅ Consistent search quality across features
- ✅ Respects user-configured system settings
- ✅ Benefits from all RAG enhancements (HyDE, Multi-Query, etc.)
- ✅ Single source of truth for search logic
- ✅ Graph search for relationship queries

### Components

#### `gateway.ts`
- Configures AI Gateway for unified model access
- Provides fallback chain: GPT-4o-mini → Claude 3.7 Sonnet
- Manages model selection by response depth (quick/standard/detailed)

#### `answer-generator.ts`
- Core RAG prompt building
- Streaming and non-streaming answer generation
- Source attribution and citation formatting
- Conversation history support

### API Endpoints

#### `POST /api/chat`
Streaming RAG chat endpoint with Server-Sent Events (SSE).

**Request:**
```json
{
  "query": "What are the main findings?",
  "depth": "standard",
  "match_threshold": 0.5,
  "match_count": 10,
  "conversationHistory": []
}
```

**Response Stream:**
```
data: {"type":"sources","sources":[...]}
data: {"type":"text","content":"Based on the documents..."}
data: {"type":"text","content":" the main findings are..."}
data: {"type":"done"}
```

## Response Depths

- **quick**: 1-2 paragraphs, GPT-4o-mini, ~500 tokens
- **standard**: 3-5 paragraphs with citations, GPT-4o-mini, ~1000 tokens
- **detailed**: Comprehensive analysis, GPT-4o, ~2000 tokens
- **deepResearch**: Multi-step reasoning, o4-mini-deep-research (future)

## Cost Estimates

Based on GPT-4o-mini pricing ($0.15/1M input, $0.60/1M output):

- **Standard query**: ~$0.001 (5K input + 500 output tokens)
- **1,000 queries/day**: ~$30/month
- **10,000 queries/day**: ~$300/month

## Environment Variables

```bash
# Required
OPENAI_API_KEY=sk-...

# Optional (for AI Gateway)
AI_GATEWAY_API_KEY=...
ANTHROPIC_API_KEY=...
```

## Usage Example

```typescript
import { generateStreamingAnswer } from '@/lib/ai/answer-generator';

const stream = await generateStreamingAnswer({
  query: "What are the main findings?",
  searchResults: chunks,
  depth: 'standard',
  includeSourceCitations: true,
});

// Stream to client
return new Response(stream.textStream, {
  headers: { 'Content-Type': 'text/event-stream' }
});
```

## Future Enhancements

1. **Deep Research Mode**: Multi-agent CrewAI orchestration
2. **Adaptive Depth**: Auto-select depth based on query complexity
3. **Citation Validation**: Verify LLM citations match actual sources
4. **Cost Tracking**: Per-user usage monitoring
5. **Model Fallback**: Automatic retry with Claude if OpenAI fails
