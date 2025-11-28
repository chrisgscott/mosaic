# Frontend Status & Architecture

**Created:** 2025-10-29  
**Status:** Vercel AI SDK Fully Integrated  
**Next:** Prepare for Living Entities UI

---

## ✅ **Current Frontend Stack**

### **Core Technologies:**
- **Next.js** (latest) with App Router
- **React 19** 
- **TypeScript**
- **Tailwind CSS** + shadcn/ui components
- **Supabase** (auth + database)

### **AI Integration:**
- ✅ **Vercel AI SDK** (`ai` v5.0.72)
- ✅ **AI SDK Gateway** (`@ai-sdk/gateway` v2.0.0)
- ✅ **AI SDK React** (`@ai-sdk/react` v2.0.76)
- ✅ **OpenAI Provider** (`@ai-sdk/openai` v2.0.52)
- ✅ **Anthropic Provider** (`@ai-sdk/anthropic` v2.0.33)

**Status:** ✅ **Fully migrated and operational**

---

## 🎨 **Current Page Structure**

### **Main Routes:**
```
/(app)/
├── page.tsx              # Dashboard/home
├── chat/                 # RAG chat interface
│   ├── page.tsx          # Creates new session, redirects to [id]
│   └── [id]/page.tsx     # Chat UI with useChat hook
├── documents/            # Document management
│   ├── page.tsx          # List, upload, manage documents
│   └── [id]/page.tsx     # Document details
├── graph/                # Graph visualization & management
│   ├── page.tsx          # Graph explorer
│   ├── cleanup/          # AI-driven entity cleanup
│   └── actions.ts        # Server actions for CRUD
├── search/               # Search interface
│   └── page.tsx          # Hybrid search UI
└── settings/             # System settings
    ├── page.tsx          # Settings overview
    ├── llm/              # LLM model configuration
    └── prompts/          # Prompt management
```

---

## 🤖 **Vercel AI SDK Implementation**

### **Chat Route** (`/api/chat/route.ts`)

**Pattern:** Follows official Vercel AI SDK pattern for message persistence

**Flow:**
```typescript
1. Receive last message + chatId from client
2. Load previous messages from database (chat_messages table)
3. Run search with latest query
4. Stream response with RAG context using streamText()
5. Save all messages to database
```

**Key Features:**
- ✅ Message persistence in Supabase
- ✅ Streaming responses with `streamText()`
- ✅ RAG context injection from search
- ✅ Model selection via AI Gateway
- ✅ Prompt management integration

### **Chat Page** (`/(app)/chat/[id]/page.tsx`)

**Uses:** `useChat()` hook from AI SDK React

**Features:**
- ✅ Real-time streaming
- ✅ Message history
- ✅ Optimistic updates
- ✅ Error handling
- ✅ Loading states

---

## 🎯 **AI Gateway Integration**

**File:** `lib/ai/gateway.ts`

**Purpose:** Centralized model management with dynamic loading from database

**Models Configured:**
1. **Quick Model** (`gpt-4.1-nano`) - HyDE, multi-query
2. **Summary Model** (`gpt-4o-mini`) - Chunk summaries
3. **Standard Model** (`gpt-4o-mini`) - Chat, entity extraction
4. **Detailed Model** (`gpt-4o`) - Complex analysis
5. **Deep Research** (`o4-mini-deep-research`) - Advanced reasoning
6. **VLM Model** (`gpt-4o`) - Vision/image analysis
7. **Embedding Model** (`text-embedding-3-small`) - Vector embeddings
8. **Temperature** (0.7) - Generation control

**Key Function:**
```typescript
getModelForDepth(depth: 'quick' | 'summary' | 'standard' | 'detailed' | 'deep')
```

---

## 📊 **Graph Visualization**

### **Current Implementation:**

**Libraries:**
- `react-force-graph-2d` (v1.29.0) - Force-directed graphs
- `reactflow` (v11.11.4) - Node-based UIs
- `dagre` (v0.8.5) - Directed graph layout
- `d3-force` (v3.0.0) - Force simulation

**Features:**
- ✅ Entity and relationship visualization
- ✅ Interactive graph explorer
- ✅ AI-driven cleanup UI
- ✅ Entity merge workflow
- ✅ CRUD operations

**Files:**
- `app/(app)/graph/page.tsx` - Main graph page
- `app/(app)/graph/cleanup/page.tsx` - Cleanup interface
- `app/(app)/graph/actions.ts` - Server actions
- `lib/graph/` - Graph utilities

---

## 🔮 **What's Missing for Living Entities**

### **New Routes Needed:**

```
/(app)/
└── entities/                    # NEW: Living Entities section
    ├── page.tsx                 # Entity list/directory
    ├── [slug]/                  # Individual entity page
    │   ├── page.tsx             # Entity detail view
    │   ├── edit/page.tsx        # Manual editing
    │   └── history/page.tsx     # Update history/audit trail
    └── templates/               # Template management
        └── page.tsx             # Create/edit templates
```

### **New Components Needed:**

**Entity Display:**
- `EntityPage` - Main entity page with sections
- `EntitySection` - Renders individual sections based on template
- `EntityTimeline` - Recent developments timeline
- `EntityRelationships` - Related entities graph
- `EntityChat` - Contextual AI chat scoped to entity

**Entity Management:**
- `EntityDirectory` - Browse all entities by type
- `EntitySearch` - Search living entities
- `EntityTemplateEditor` - Create/edit templates
- `EntityUpdateHistory` - Audit trail viewer

**Data Visualization:**
- `SupplyChainChart` - For Material entities
- `PricingChart` - Historical pricing data
- `GeopoliticalRiskMap` - Risk visualization
- `ProductionMap` - Mine locations

### **API Routes Needed:**

```typescript
/api/entities/
├── route.ts                    # List entities
├── [slug]/route.ts             # Get entity details
├── [slug]/update/route.ts      # Manual updates
└── [slug]/chat/route.ts        # Entity-scoped chat

/api/templates/
├── route.ts                    # List templates
└── [type]/route.ts             # Get template schema
```

---

## 🏗️ **Recommended Frontend Restructure**

### **Current Structure (Good):**
```
/(app)/
├── chat/         # RAG chat
├── documents/    # Document management
├── graph/        # Graph entities (lightweight)
├── search/       # Search
└── settings/     # Settings
```

### **Future Structure (With Living Entities):**
```
/(app)/
├── chat/         # RAG chat (keep as is)
├── documents/    # Document management (keep as is)
├── entities/     # 🆕 Living Entities (THE MAIN FEATURE)
│   ├── materials/    # Material entity pages
│   ├── mines/        # Mine entity pages
│   ├── suppliers/    # Supplier entity pages
│   └── [slug]/       # Dynamic entity pages
├── graph/        # Graph entities (discovery/exploration)
├── search/       # Search (keep as is)
└── settings/     # Settings (keep as is)
```

**Key Change:** Living Entities become the **primary navigation destination**

---

## 🎨 **UI Component Library**

### **Already Available (shadcn/ui):**
- ✅ Accordion, Alert Dialog, Avatar
- ✅ Badge, Button, Card, Checkbox
- ✅ Dialog, Dropdown Menu, Form
- ✅ Input, Label, Popover, Progress
- ✅ Select, Separator, Slider, Switch
- ✅ Table, Tabs, Textarea, Toast
- ✅ Tooltip, Toggle, Navigation Menu

### **Need to Add:**
- Timeline component (for recent developments)
- Rich text editor (for manual entity updates)
- Chart components (for pricing, supply chain)
- Map component (for geopolitical, mine locations)
- Diff viewer (for update history)

---

## 📱 **Responsive Design**

**Current Approach:**
- Mobile-first Tailwind CSS
- Responsive sidebar (collapsible)
- Breadcrumb navigation
- Consistent padding/spacing

**For Living Entities:**
- Desktop: Full entity page with sidebar navigation
- Tablet: Collapsible sections
- Mobile: Accordion-style sections

---

## 🔄 **Real-Time Updates**

**Current Implementation:**
- ✅ Supabase Realtime for document status
- ✅ Optimistic UI updates
- ✅ Toast notifications

**For Living Entities:**
- Subscribe to entity updates
- Show "Updated 2 minutes ago" badges
- Notify watchers when entity changes
- Live update indicators

---

## 🎯 **Integration Points**

### **1. Multi-Floor Navigation:**

```typescript
// User clicks entity in graph
// → Navigate to living entity page
// → Show floor bridges in sidebar

<EntityPage slug="antimony">
  <FloorBridges>
    <Bridge floor="B" count={45}>Graph Entities</Bridge>
    <Bridge floor="A" count={234}>Chunks</Bridge>
    <Bridge floor="C" count={12}>Documents</Bridge>
  </FloorBridges>
</EntityPage>
```

### **2. Search Integration:**

```typescript
// Search results can return living entities
// → Show entity card with quick stats
// → Click to navigate to full entity page

<SearchResults>
  <LivingEntityCard slug="antimony" />
  <DocumentCard id="doc_123" />
  <ChunkCard id="chunk_456" />
</SearchResults>
```

### **3. Chat Integration:**

```typescript
// Chat can reference living entities
// → Inline entity cards in chat
// → "Learn more" button → entity page

<ChatMessage>
  <Text>Antimony is a critical material...</Text>
  <EntityCard slug="antimony" inline />
</ChatMessage>
```

---

## 🚀 **Implementation Priority**

### **Phase 1: Foundation** (After Multi-Floor + DEG-RAG)

1. **Database Schema** (Week 1)
   - Create living_entities tables
   - Set up migrations
   - Create template registry

2. **Basic Entity Pages** (Week 2)
   - Entity list/directory
   - Individual entity page
   - Template-based section rendering

3. **Entity CRUD** (Week 3)
   - Manual entity creation
   - Section editing
   - Update history viewer

### **Phase 2: CrewAI Integration** (Week 4-5)

1. **Update Workflow**
   - CrewAI agent implementation
   - Trigger on document ingestion
   - Validation and approval flow

2. **Relationship Management**
   - Entity relationship UI
   - Bidirectional links
   - Relationship strength visualization

### **Phase 3: Polish** (Week 6)

1. **Advanced Features**
   - Entity-scoped chat
   - Timeline visualization
   - Charts and maps
   - Watch/subscribe to entities

---

## 📊 **Current Frontend Quality**

### **Strengths:**
- ✅ Modern stack (Next.js 15, React 19)
- ✅ Vercel AI SDK fully integrated
- ✅ Clean component architecture
- ✅ Consistent UI patterns
- ✅ Good TypeScript coverage
- ✅ shadcn/ui component library

### **Areas for Improvement:**
- ⚠️ No living entities UI yet
- ⚠️ Graph visualization could be enhanced
- ⚠️ Mobile experience needs testing
- ⚠️ No entity templates yet

---

## 🎓 **Key Takeaways**

1. **Vercel AI SDK:** ✅ Fully integrated and working
2. **Component Library:** ✅ Comprehensive (shadcn/ui)
3. **Architecture:** ✅ Clean, modern, maintainable
4. **Ready for Living Entities:** ⚠️ Need new routes and components
5. **Multi-Floor Integration:** ⚠️ Need bridge visualization

**Bottom Line:** Frontend is in excellent shape. Just need to add Living Entities UI layer on top of existing foundation.

---

**Status:** Production-ready for current features  
**Next:** Build Living Entities UI after backend is ready  
**Timeline:** 2-3 weeks for complete Living Entities frontend
