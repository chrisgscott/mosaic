# AI SDK Patterns & Best Practices

Based on Vercel AI SDK Cookbook: https://ai-sdk.dev/cookbook

## Current Implementation Status

### ✅ Implemented
- **Message Persistence** - Following official pattern
- **URL-based routing** - `/chat` → `/chat/[id]`
- **Server-side ID generation** - `createIdGenerator()`
- **Send only last message** - `prepareSendMessagesRequest`
- **Handle disconnects** - `consumeStream()`

### 🔄 Should Implement Next

#### 1. **Caching Middleware** (High Priority)
**Source:** https://ai-sdk.dev/cookbook/next/caching-middleware

**Benefits:**
- Reduce API costs by caching identical requests
- Faster responses for repeated queries
- Built-in cache invalidation

**Implementation:**
```typescript
import { createCache } from 'ai';

const cache = createCache({
  ttl: 60 * 60, // 1 hour
});

const result = streamText({
  model: openai('gpt-4'),
  messages,
  experimental_cache: cache,
});
```

**Use Cases:**
- Cache search results for identical queries
- Cache entity descriptions
- Cache relationship suggestions

---

#### 2. **Human-in-the-Loop** (Medium Priority)
**Source:** https://ai-sdk.dev/cookbook/next/human-in-the-loop

**Benefits:**
- User confirmation before executing tools
- Better control over AI actions
- Safer for destructive operations

**Implementation:**
- Tools without `execute` function require confirmation
- Client shows confirmation UI
- Server waits for approval before executing

**Use Cases:**
- Confirm before deleting entities
- Confirm before bulk operations
- Confirm before merging entities

---

#### 3. **Multi-Step Tool Calls** (Medium Priority)
**Source:** https://ai-sdk.dev/cookbook/next/call-tools-multiple-steps

**Benefits:**
- AI can call multiple tools in sequence
- More complex workflows
- Better problem solving

**Implementation:**
```typescript
const result = streamText({
  model: openai('gpt-4'),
  messages,
  tools,
  maxSteps: 5, // Allow up to 5 tool calls
});
```

**Use Cases:**
- Search → Extract entities → Create relationships
- Find duplicates → Merge → Update graph
- Complex multi-step analysis

---

#### 4. **Shared Chat Context** (Low Priority)
**Source:** https://ai-sdk.dev/cookbook/next/use-shared-chat-context

**Benefits:**
- Share chat state across components
- Cleaner component architecture
- Better separation of concerns

**Implementation:**
- Create ChatContext with React Context
- Wrap app in provider
- Access chat state anywhere

---

#### 5. **Visual Interface in Chat** (Low Priority)
**Source:** https://ai-sdk.dev/cookbook/next/render-visual-interface-in-chat

**Benefits:**
- Rich UI components in chat
- Interactive elements
- Better UX for complex data

**Implementation:**
- Stream UI components alongside text
- Render React components in chat
- Interactive data visualizations

**Use Cases:**
- Show entity cards in chat
- Interactive graph visualizations
- Document previews

---

## RAG-Specific Patterns

### From RAG Agent Guide
**Source:** https://ai-sdk.dev/cookbook/guides/rag-chatbot

**Key Learnings:**

1. **Chunking Strategy**
   - Break content into semantic units
   - Sentence-based chunking is simple and effective
   - Experiment with chunk size

2. **Embedding Best Practices**
   - Smaller chunks = better embeddings
   - Use consistent embedding model
   - Store embeddings with chunks

3. **Retrieval Strategy**
   - Use cosine similarity for semantic search
   - Consider hybrid search (semantic + keyword)
   - Rerank results for better relevance

4. **Context Management**
   - Limit context size to avoid token limits
   - Include source citations
   - Balance context quality vs quantity

---

## Chat with PDF Pattern
**Source:** https://ai-sdk.dev/cookbook/next/chat-with-pdf

**Relevant for our document processing:**

1. **File Upload Handling**
   - Accept PDF uploads
   - Extract text server-side
   - Process and chunk immediately

2. **Document-Specific Chat**
   - Filter search to specific document
   - Show document context
   - Link to source pages

**Could Implement:**
- Upload PDF → auto-process → chat about it
- Document-specific chat sessions
- Page-level citations

---

## Performance Optimizations

### 1. **Caching Strategy**
```typescript
// Cache search results
const searchCache = createCache({ ttl: 3600 });

// Cache entity descriptions
const entityCache = createCache({ ttl: 7200 });

// Cache relationship suggestions
const relationshipCache = createCache({ ttl: 3600 });
```

### 2. **Streaming Optimizations**
```typescript
// Use consumeStream() to handle disconnects
result.consumeStream();

// Use server-side IDs for consistency
generateMessageId: createIdGenerator({ prefix: 'msg', size: 16 })
```

### 3. **Payload Reduction**
```typescript
// Send only last message
prepareSendMessagesRequest({ messages, id }) {
  return { body: { message: messages[messages.length - 1], id } };
}
```

---

## Recommended Implementation Order

### Phase 1: Performance (1-2 days)
1. ✅ Message persistence (DONE)
2. **Add caching middleware** for search results
3. **Optimize payload** with better chunking

### Phase 2: Safety (2-3 days)
1. **Human-in-the-loop** for destructive operations
2. **Confirmation UI** for bulk actions
3. **Better error handling**

### Phase 3: Features (1 week)
1. **Multi-step tool calls** for complex workflows
2. **Visual interface** for entity cards
3. **Document-specific chat**

### Phase 4: Polish (3-5 days)
1. **Shared chat context** for cleaner code
2. **Better UI components**
3. **Performance monitoring**

---

## Key Takeaways

1. **Follow Official Patterns** - Vercel has solved these problems
2. **Start Simple** - Implement core patterns first
3. **Measure Performance** - Cache what's expensive
4. **User Safety** - Confirm destructive actions
5. **Iterate** - Add features based on usage

---

## Resources

- **Main Cookbook:** https://ai-sdk.dev/cookbook
- **RAG Guide:** https://ai-sdk.dev/cookbook/guides/rag-chatbot
- **Message Persistence:** https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-message-persistence
- **Caching:** https://ai-sdk.dev/cookbook/next/caching-middleware
- **Human-in-the-Loop:** https://ai-sdk.dev/cookbook/next/human-in-the-loop
- **Multi-Step Tools:** https://ai-sdk.dev/cookbook/next/call-tools-multiple-steps

---

## Next Actions

**Immediate (Today):**
- ✅ Message persistence implemented
- Review caching middleware docs
- Plan human-in-the-loop for bulk operations

**This Week:**
- Implement caching for search results
- Add confirmation UI for destructive actions
- Test multi-step tool calls

**This Month:**
- Visual interface for entities
- Document-specific chat
- Performance monitoring
