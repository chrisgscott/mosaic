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