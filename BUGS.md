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