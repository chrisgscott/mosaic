# Known Bugs

## Graph Visualization - Horizontal Overflow Issue

**Date:** January 17, 2025  
**Component:** `/graph/visualize` page with ForceGraph2D (Obsidian-style layout)  
**Status:** 🔴 Open

### Problem
The graph visualization extends beyond the viewport width, causing horizontal scrolling. The entity details panel (when opened by clicking a node) appears off the right side of the screen.

### Context
- Using `react-force-graph-2d` for Obsidian-style force-directed graph
- Page layout follows standard pattern with sidebar
- Graph should fit within available space (viewport width - sidebar width)
- Entity details panel should be visible on the right when a node is clicked

### What We've Tried

1. **Added `overflow-hidden` to parent containers**
   - Page: `<div className="flex-1 overflow-hidden">`
   - Component: `<div className="flex gap-4 h-full w-full p-4 overflow-hidden">`
   - Result: ❌ Still overflows

2. **Used flex layout with constraints**
   - Main graph: `<div className="flex-1 min-w-0 border rounded-lg overflow-hidden bg-background relative">`
   - Entity panel: `<div className="w-80 flex-shrink-0 overflow-auto max-h-full">`
   - Result: ❌ Still overflows

3. **Tried responsive width settings**
   - Changed `w-full` to `max-w-full`
   - Result: ❌ Still overflows

4. **Measured container dimensions with useRef**
   - Added `containerRef` to measure actual container size
   - Pass measured `width` and `height` to ForceGraph2D
   - Added resize listener to update dimensions
   - Result: ❌ Still overflows

### Current Code State
**Files:**
- `/apps/web/app/(app)/graph/visualize/page.tsx` - Page wrapper
- `/apps/web/components/graph-visualization.tsx` - Main component with ForceGraph2D

**ForceGraph2D props:**
```typescript
<ForceGraph2D
  graphData={forceGraphData}
  width={dimensions.width}  // Measured from container
  height={dimensions.height}
  // ... other props
/>
```

### Possible Solutions to Try

1. **Check if ForceGraph2D is creating a canvas larger than specified**
   - Inspect actual canvas element size in dev tools
   - May need to add CSS to force canvas max-width

2. **Use CSS to constrain the canvas**
   ```css
   canvas { max-width: 100% !important; }
   ```

3. **Account for padding/borders in dimension calculation**
   - Subtract padding (16px * 2 = 32px) from measured width
   - Subtract border widths

4. **Try different ForceGraph2D sizing approach**
   - Use `width={containerRef.current?.clientWidth}` directly
   - Or remove width/height props entirely and let it auto-size

5. **Simplify layout**
   - Remove all padding from page level
   - Let component handle all spacing internally

6. **Check if control panel is affecting layout**
   - The left control panel (Search, Layout, Filter) is absolutely positioned
   - May need to account for its width in calculations

7. **Debug actual rendered sizes**
   - Console.log the measured dimensions
   - Inspect canvas element in dev tools to see actual vs specified size
   - Check if ForceGraph2D is ignoring the width/height props

### Related Files
- `/apps/web/app/(app)/graph/visualize/page.tsx`
- `/apps/web/components/graph-visualization.tsx`

### Priority
Medium - Feature works but UX is poor with horizontal scrolling

---

## Chunk Display Limit Issue

**Date:** October 19, 2025  
**Component:** Document details page (`/documents/[id]`)  
**Status:** 🔴 Open

### Problem
The document details page shows "Chunks (1000)" even when documents have more chunks (e.g., 1972 chunks). The query includes `.limit(10000)` but appears to be capped at 1000.

### Context
- Chunks are stored correctly in the database
- The issue is purely display/query related
- Doesn't affect functionality - all chunks are processed and searchable
- Likely a Supabase/PostgREST default limit

### Investigation Needed
- Verify Supabase query is actually using the limit parameter
- Check if there's a separate Supabase configuration limiting results
- Investigate Next.js caching behavior
- Consider if there's a PostgREST limit configuration (default is 1000 rows)

### Possible Solutions

1. **Fix the count (Quick - 30 min)**
   - Use separate count query: `select count(*) from chunks where document_id = ?`
   - Show accurate count without loading all chunks
   - Recommended: Solves user-facing issue immediately

2. **Implement pagination (Medium - 1-2 hours)**
   - Load chunks 100 at a time with "Load More" button
   - Better UX for documents with many chunks
   - Reduces initial load time

3. **Fix Supabase limit (Proper - 2-3 hours)**
   - Investigate PostgREST configuration
   - May need to set `max-rows` in Supabase settings
   - Could be client-side limit in Supabase JS library

### Related Files
- `/apps/web/app/(app)/documents/[id]/page.tsx` - Document details page
- Supabase query for chunks

### Priority
Low - Cosmetic issue only. Chunks are stored correctly and all functionality works.

---

## Upload Modal Filename Truncation Not Working

**Date:** October 19, 2025  
**Component:** Document upload modal  
**Status:** 🔴 Open

### Problem
Long filenames in the upload modal overflow their container instead of truncating with ellipsis, despite having the correct CSS classes applied.

### Context
- Filenames are still readable
- Tooltip shows the full name on hover
- Purely cosmetic issue
- CSS classes for truncation are applied but not working

### Investigation Needed
- Check if there's a conflicting CSS rule from shadcn/ui Dialog component
- Inspect computed styles in browser to see what's overriding truncation
- Test if the issue is specific to the Dialog component's rendering
- Verify that the text element has an actual width constraint from its parent

### Possible Solutions

1. **Add explicit width constraint**
   - Ensure parent container has defined width
   - May need `max-w-[XXXpx]` instead of relative width

2. **Use CSS override**
   - Add `!important` to truncation styles if Dialog component is overriding
   - Or use more specific CSS selector

3. **Check Dialog component props**
   - shadcn/ui Dialog may have props to control content overflow
   - Review Dialog documentation for overflow handling

### Related Files
- Document upload modal component
- shadcn/ui Dialog component

### Priority
Low - Cosmetic issue only. Filenames are still readable and the tooltip shows the full name on hover.

---

## Chat Sources Temporarily Disappear During Race Condition

**Date:** November 6, 2025  
**Component:** Chat interface (`/admin/chat/[id]`)  
**Status:** 🟡 Low Priority

### Problem
When the LLM answers a follow-up question without calling any tools (using only conversation context), source citations from ALL previous messages in the session temporarily disappear from the UI. They reappear when the next message that calls a tool completes.

### Context
- **Trigger**: LLM decides it has enough context from previous messages to answer without searching
- **Example**: User asks "How does that copper relate to use cases?" after already discussing copper specs
- **LLM behavior**: Answers from conversation memory, no `search_documents` tool call
- **Result**: Sources vanish briefly, then reappear on next tool-calling message

### Root Cause
The chat route uses a **DELETE + INSERT** pattern instead of UPDATE when saving messages:

```typescript
// Delete ALL messages for session
await supabase.from('chat_messages').delete().eq('session_id', chatId);

// Insert ALL messages fresh (including old ones with sources)
await supabase.from('chat_messages').insert(messagesToSave);
```

**Race condition timeline:**
1. Message 3 completes (no tool call, no sources)
2. `onFinish` triggers → DELETE all messages
3. Frontend `onFinish` (500ms delay) → Fetches messages from DB
4. **Race**: Fetch happens during DELETE but before INSERT completes
5. Frontend gets empty or incomplete message set
6. Sources disappear from UI
7. Message 4 completes (with tool call)
8. `onFinish` triggers → DELETE + INSERT all 8 messages with sources
9. Frontend reload → Gets complete data
10. Sources reappear ✅

### What We've Verified

1. ✅ **Sources are saved correctly** - Backend logs confirm extraction and DB save
2. ✅ **Data is never lost** - Sources persist in database
3. ✅ **Self-correcting** - Next message reload fixes the display
4. ✅ **Page refresh works** - Always shows correct data from DB
5. ✅ **LLM behavior is correct** - Should use conversation context when available

### Logs Evidence

**Message 3 (no tool):**
```
[Chat] Extracted 0 sources from tool results
[Chat] Saved 6 messages to session 7c5e32a4-9053-4cc7-b127-566d3493c2eb
POST /api/chat 200 in 8872ms
GET /api/chat/7c5e32a4-9053-4cc7-b127-566d3493c2eb/messages 200 in 408ms
```

**Message 4 (with tool):**
```
[Chat] Extracted 10 sources from tool results
[Chat] Saved 8 messages to session 7c5e32a4-9053-4cc7-b127-566d3493c2eb
POST /api/chat 200 in 8743ms
GET /api/chat/7c5e32a4-9053-4cc7-b127-566d3493c2eb/messages 200 in 418ms
```

The messages GET happens ~400ms after POST completes, but frontend has 500ms delay, creating the race window.

### Possible Solutions

1. **Use UPSERT instead of DELETE+INSERT** (Recommended - 1 hour)
   - Use `upsert()` with `onConflict` on message ID
   - Atomic operation, no race condition
   - More efficient (updates only changed rows)
   ```typescript
   await supabase.from('chat_messages')
     .upsert(messagesToSave, { onConflict: 'id' });
   ```

2. **Add database transaction** (Medium - 1-2 hours)
   - Wrap DELETE+INSERT in transaction
   - Ensures atomic operation
   - Prevents partial reads during save

3. **Optimistic UI updates** (Complex - 2-3 hours)
   - Don't reload from DB after every message
   - Merge sources into existing message state
   - Only reload on page load or explicit refresh
   - More complex state management

4. **Increase frontend delay** (Quick hack - 5 min)
   - Change 500ms delay to 1000ms
   - Reduces race window but doesn't eliminate it
   - Not a real fix

### Related Files
- `/apps/web/app/api/chat/route.ts` - DELETE+INSERT logic in `onFinish`
- `/apps/web/components/enhanced-chat-client.tsx` - Frontend reload logic
- `/apps/web/app/api/chat/[id]/messages/route.ts` - Messages fetch endpoint

### Priority
**Low** - This is a minor UX quirk with acceptable workarounds:
- Only happens when LLM doesn't call tools (rare)
- Self-corrects on next message
- No data loss
- Page refresh always shows correct data
- Doesn't affect core functionality

**Recommendation:** Fix when doing broader chat persistence refactor, not urgent.

---

## Extract Entities from Chunk Not Working

**Date:** November 10, 2025  
**Component:** Document details page - Extract Entities feature  
**Status:** 🔴 Open

### Problem
The "Extract Entities" button on the document details page (`/admin/documents/[id]`) throws an error when trying to extract entities from a chunk.

### Error Message
```
Extract entities from chunk error: Error: Models not initialized. Call initModels() first.
    at Object.get (lib/ai/gateway.ts:99:13)
    at extractEntitiesFromChunk (app/(app)/admin/graph/actions.ts:1120:21)
   97 |   get(target, prop) {
   98 |     if (!cachedModels) {
>  99 |       throw new Error('Models not initialized. Call initModels() first.');
      |             ^
  100 |     }
  101 |     return cachedModels[prop as keyof typeof cachedModels];
  102 |   }
```

### Context
- The AI gateway models are initialized in middleware for API routes
- Server actions (like `extractEntitiesFromChunk`) run in a different context
- The models proxy checks for `cachedModels` but it's not available in server action context
- This is a server-side initialization issue, not a client-side problem

### Root Cause
Server actions don't go through the middleware that initializes the AI models. The `models` proxy in `lib/ai/gateway.ts` expects `cachedModels` to be set by `initModels()`, but this never happens for server actions.

### What We've Tried
Nothing yet - bug just discovered.

### Possible Solutions

1. **Call initModels() in server action** (Quick - 30 min)
   - Add `await initModels()` at the start of `extractEntitiesFromChunk`
   - Ensures models are available before use
   - May have performance impact if called repeatedly
   ```typescript
   export async function extractEntitiesFromChunk(...) {
     await initModels();
     // ... rest of function
   }
   ```

2. **Create a wrapper for server actions** (Medium - 1 hour)
   - Create `withModels()` HOF that initializes models
   - Wrap all server actions that need AI models
   - Centralizes initialization logic
   ```typescript
   export const withModels = (action) => async (...args) => {
     await initModels();
     return action(...args);
   };
   ```

3. **Lazy initialize in models proxy** (Proper - 1-2 hours)
   - Modify the proxy getter to auto-initialize if not cached
   - Makes models "just work" everywhere
   - Need to handle async initialization in getter
   ```typescript
   get(target, prop) {
     if (!cachedModels) {
       await initModels(); // Problem: getters can't be async
     }
     return cachedModels[prop];
   }
   ```

4. **Use direct model creation** (Alternative - 30 min)
   - Don't use the cached models in server actions
   - Create models directly using `getModelForDepth()` or similar
   - Bypasses the caching system entirely
   - May be less efficient but more reliable

### Related Files
- `/apps/web/lib/ai/gateway.ts` - Models proxy and initialization
- `/apps/web/app/(app)/admin/graph/actions.ts` - `extractEntitiesFromChunk` function
- `/apps/web/middleware.ts` - Where models are initialized for API routes

### Priority
Medium - Feature is broken but has workaround (extract entities during document processing instead of on-demand)

### Recommended Fix
**Option 1** (Quick fix): Add `await initModels()` to `extractEntitiesFromChunk` and any other server actions that use AI models. This is the fastest path to working functionality.

**Option 4** (Better long-term): Refactor server actions to use direct model creation instead of relying on the cached proxy. This makes the code more explicit and avoids initialization issues.