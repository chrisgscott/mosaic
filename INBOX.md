# INBOX

**Last Cleaned:** October 31, 2025

This file contains new ideas and enhancements that haven't yet been prioritized for BUILD_PLAN or TO_PROCESS.

---

## ✅ Recently Completed (Oct 31, 2025)

### Implemented:
- **Schema Settings Management** - Entity and relationship type management via settings page
- **LLM Dropdown Fixes** - Settings page dropdowns now populate correctly from database
- **Breadcrumb Navigation** - All breadcrumbs updated to use /admin/ prefix
- **Bulk Entity Type Updates** - Conflict detection prevents unique constraint violations
- **Source Chunks Fallback** - Entity pages show chunks even when chunk_ids are stale
- **Graph Learning Phase 1** - Search signal capture system implemented and logging

### Moved to TO_PROCESS:
- **Entity Deduplication During Extraction** - Needs decision on implementation timing
- **Vercel AI SDK Tool-Based Architecture** - Phase 2+ decisions needed
- **Graph Learning Phases 2-6** - Waiting for data collection before next phase
- **Intelligent Query Caching** - Quick win opportunity, needs priority decision
- **OpenAI Structured Outputs Migration** - Partial completion, needs decision on remainder
- **MCP Server for External Tools** - Needs demand validation before investment
- **Custom Relationship Types Python Integration** - UI done, Python integration optional

---

## 💡 Enhancements & Ideas

### Market Intelligence Analysis System
**Priority:** Medium-High  
**Effort:** 3-4 weeks (phased implementation)  
**Context:** Transform Mosaic into a structured research and analysis platform that can extract, analyze, and store market intelligence in queryable Supabase tables. Inspired by the copper powder market analysis workflow currently being done in n8n.

---

#### **Core Concept**
Enable users to define analysis templates (schemas), upload source documents, and let AI automatically extract structured insights (use cases, market data, technical specs) that are stored in Supabase tables for querying, tracking, and export.

---

#### **Real-World Use Case: Copper Powder Market Analysis**
Currently processing in n8n:
- **Input**: Market reports, technical specifications, research papers
- **Output**: 117 structured use cases with:
  - Variant metadata (id, category, name, description)
  - Use case details (name, description)
  - Market data (buyers, spec requirements, readiness levels, evidence)
  - Placeholder fields for estimates and scores

**Problem with Current Approach:**
- Manual n8n workflow setup for each analysis type
- Data not queryable (just JSON exports)
- No version tracking or change detection
- Can't collaborate on reviewing AI extractions
- Hard to reuse for similar analyses

**Vision with Mosaic:**
- Define template once, reuse for all copper analyses
- AI extracts data from uploaded documents + web search
- Store in Supabase tables (SQL queries, filters, aggregations)
- Team reviews and approves AI extractions
- Track changes over time (Q1 2025 vs Q4 2025)
- Export to any format (JSON, CSV, Excel)

---

#### **Architecture Overview**

**New Database Tables:**

1. **analysis_templates** - Reusable analysis frameworks
   ```typescript
   {
     id: uuid,
     name: "Market Use Case Analysis",
     description: "Extract use cases and market data",
     schema: {
       // JSON Schema defining output structure
       variant: { id, category, name, description },
       use_case: { name, description },
       markets: [{ name, buyers, specs, readiness }]
     },
     extraction_prompt: "...",
     created_by: uuid
   }
   ```

2. **analysis_projects** - Specific analysis instances
   ```typescript
   {
     id: uuid,
     template_id: uuid,
     name: "Copper Powder Analysis Q4 2025",
     source_documents: uuid[],
     status: "draft" | "analyzing" | "complete",
     results_count: number
   }
   ```

3. **analysis_results** - Extracted structured data
   ```typescript
   {
     id: uuid,
     project_id: uuid,
     data: {
       // Flexible JSONB matching template schema
       variant_id: "01",
       use_case: "Semiconductor Manufacturing",
       markets: [...],
       // Any structure from template
     },
     source_chunks: uuid[], // Citation links
     confidence_score: number,
     ai_reasoning: text,
     status: "extracted" | "verified" | "published",
     reviewed_by: uuid
   }
   ```

---

#### **User Workflow**

**Phase 1: Setup (One-time)**
1. Create Analysis Template
   - Visual schema builder (like Airtable/Notion)
   - Define fields, types, validation rules
   - Write extraction instructions
   
2. Create Project
   - Name: "Copper Powder Analysis Q4 2025"
   - Select template
   - Upload source documents (or link existing)

**Phase 2: AI Analysis (Automated)**
```
For each document:
  1. RAG Search: Find relevant chunks
  2. Web Search: Enrich with latest market data (optional)
  3. Structured Extraction: AI fills template schema
  4. Store Results: Save to analysis_results table
  5. Link Evidence: Connect to source chunks for citations
```

**Phase 3: Review & Refine (Interactive)**
- Review AI extractions in table/grid UI
- Edit/approve individual items
- Request re-analysis with different prompts
- Add manual entries
- Export to JSON/CSV/Excel

---

#### **Implementation Plan**

**Phase 1: Foundation (1-2 weeks)**
- Database schema (3 new tables)
- Template builder UI (visual schema editor)
- Project creation flow
- Basic extraction engine

**Phase 2: AI Analysis (1-2 weeks)**
- RAG-powered extraction using existing search
- Web search integration for enrichment
- Structured output validation (JSON Schema)
- Confidence scoring and citation linking

**Phase 3: Review & Export (1 week)**
- Results table/grid UI with filters/sort
- Edit/approve workflow
- Export formats (JSON, CSV, Excel)
- Version tracking

**Phase 4: Advanced Features (Future)**
- Comparison across time periods
- Automated monitoring (re-run monthly)
- Collaborative review (team annotations)
- Custom visualizations
- API for external tools (like n8n)

---

#### **Key Technical Components**

**Structured Extraction Agent:**
```typescript
export async function extractStructuredData(
  template: AnalysisTemplate,
  documents: Document[],
  options: { useWebSearch: boolean }
) {
  // 1. RAG search for relevant content
  const chunks = await searchDocuments(template.searchQueries);
  
  // 2. Web search for enrichment (optional)
  const webData = options.useWebSearch 
    ? await webSearch(template.enrichmentQueries)
    : null;
  
  // 3. Structured extraction with AI
  const results = await extractWithSchema({
    chunks,
    webData,
    schema: template.schema,
    prompt: template.extraction_prompt,
    model: 'gpt-4o' // Detailed model
  });
  
  // 4. Validate and score confidence
  return validateAndScore(results, template.schema);
}
```

**Template Builder UI:**
- Visual schema builder (drag-drop fields)
- Define types (text, number, array, object)
- Set validation rules
- Write extraction prompts with preview

**Results Explorer:**
- Interactive data grid
- Filter/sort/group results
- Inline editing
- Confidence indicators
- Source citations (click to see chunks)
- Export options

---

#### **Integration with Existing Mosaic**

**Leverages Current Infrastructure:**
- ✅ Documents & Chunks: Source material already indexed
- ✅ RAG Search: Finds relevant content automatically
- ✅ Web Search: Enriches with latest data
- ✅ AI Gateway: Structured extraction with GPT-4
- ✅ Supabase: Stores everything in queryable tables

**New Capabilities:**
- 🆕 Structured Output: Beyond chat, create databases
- 🆕 Batch Analysis: Process multiple documents at once
- 🆕 Version Tracking: See how insights change over time
- 🆕 Collaborative Review: Team can verify AI extractions
- 🆕 Export & API: Use results in other tools

---

#### **Example Use Cases Beyond Copper**

1. **Competitive Intelligence**: Extract competitor features, pricing, positioning
2. **Patent Analysis**: Structure patent claims, inventors, applications
3. **Customer Research**: Extract pain points, use cases, quotes from interviews
4. **Market Sizing**: Pull TAM/SAM/SOM data from multiple reports
5. **Technology Trends**: Track emerging tech mentions across papers
6. **Regulatory Compliance**: Extract requirements from regulations

---

#### **Why This is Powerful**

1. **Replaces Manual Work**: Hours in n8n → minutes in Mosaic
2. **Queryable Results**: Supabase tables = SQL queries, filters, aggregations
3. **Reproducible**: Save templates, re-run on new documents
4. **Collaborative**: Team reviews AI extractions together
5. **Integrated**: Uses existing document library
6. **Flexible**: Any schema, any domain, any analysis type

---

#### **Directory Structure**

```
apps/web/
├── app/(app)/analysis/          # New analysis section
│   ├── templates/               # Template management
│   ├── projects/                # Project management
│   └── results/                 # Results explorer
├── lib/analysis/                # Analysis engine
│   ├── extraction-agent.ts      # Structured extraction
│   ├── template-validator.ts   # Schema validation
│   └── results-processor.ts    # Post-processing
└── components/analysis/         # UI components
    ├── template-builder.tsx
    ├── results-grid.tsx
    └── confidence-indicator.tsx

supabase/migrations/
└── 20251107_analysis_system.sql # New tables
```

**Navigation Update:**
```typescript
{
  title: "Analysis",
  icon: FlaskConical,
  items: [
    { title: "Projects", url: "/analysis/projects" },
    { title: "Templates", url: "/analysis/templates" },
    { title: "Results", url: "/analysis/results" }
  ]
}
```

---

#### **Next Steps**

**When Ready to Implement:**
1. Review and validate architecture
2. Design detailed database schema
3. Create template builder wireframes
4. Build extraction agent prototype
5. Test with copper powder use case
6. Iterate based on real usage

**Potential Phase:** Could be Phase 11 in BUILD_PLAN

---

### Entity Deduplication During Extraction
**Priority:** Medium  
**Effort:** 2-5 days (phased implementation)  
**Context:** Improve knowledge graph quality by preventing duplicate entities at extraction time rather than cleaning them up later.

---

#### **Core Concept**
Add an entity resolution step during extraction that checks existing entities before creating new ones, reducing graph pollution and improving relationship quality.

---

#### **Current Problem**
```
Document A: Extracts "Tesla Motors" → Creates new entity
Document B: Extracts "Tesla Inc" → Creates new entity  
Document C: Extracts "Tesla" → Creates new entity
Result: 3 duplicate Tesla entities with fragmented relationships
```

---

#### **Proposed Solution**
```
Document A: Extracts "Tesla Motors" → Creates new entity
Document B: Extracts "Tesla Inc" → Matches existing "Tesla Motors"
Document C: Extracts "Tesla" → Matches existing "Tesla Motors"
Result: 1 unified Tesla entity with complete relationships
```

---

#### **Implementation Approaches**

**Phase 1: Simple Exact Matching (1-2 days)**
```python
def extract_entities_with_dedup(text, existing_entities):
    potential = llm_extract_entities(text)
    resolved = []
    
    for entity in potential:
        match = find_exact_match(entity.name, existing_entities)
        if match:
            resolved.append(match)  # Use existing
        else:
            resolved.append(create_entity(entity))  # Create new
    
    return resolved
```

**Phase 2: Fuzzy Matching + Confidence (2-3 days)**
```python
def resolve_entity(entity_name, existing_entities):
    # Try exact match first
    exact = find_exact_match(entity_name, existing_entities)
    if exact: return exact
    
    # Try fuzzy match with confidence > 0.9
    fuzzy = find_fuzzy_match(entity_name, existing_entities, threshold=0.9)
    if fuzzy: return fuzzy
    
    # No match found, create new
    return create_entity(entity_name)
```

**Phase 3: LLM-Powered Contextual Resolution (Future enhancement)**
```python
def resolve_with_llm(potential_entity, existing_entities):
    prompt = f"""
    Does "{potential_entity.name}" match any existing entities?
    Consider context, abbreviations, and business relationships.
    
    Return either: MATCH: [entity_id] or NEW
    """
    return llm_call(prompt)
```

---

#### **Benefits**

1. **Cleaner Knowledge Graph** - No duplicate "Tesla" entities
2. **Better Relationships** - Connections accumulate to single entities  
3. **Improved Search** - Don't miss relationships due to duplicates
4. **Cost Savings** - Fewer entities to store and process
5. **Data Quality** - More accurate entity analytics
6. **Prevention vs Cure** - Stop duplicates at source vs cleanup later

---

#### **Challenges to Consider**

1. **Performance** - Checking against hundreds/thousands of entities
2. **False Positives** - "Apple" (company) vs "Apple" (fruit)
3. **Context Dependence** - Same name, different meanings in different docs
4. **Entity Evolution** - "Tesla Motors" → "Tesla Inc"

---

#### **Integration Points**

- **Graph Extractor**: Add deduplication step in `graph_extractor.py`
- **Entity Storage**: Cache existing entities for fast lookup
- **Confidence Scoring**: Track match confidence for manual review
- **Relationship Accumulation**: Merge relationships when entities match

---

#### **Relationship to Existing Plans**

This complements the planned **Phase 10.1: Entity Deduplication & Merge Assistant** by:
- Providing automatic prevention vs manual cleanup
- Reducing the need for the merge assistant
- Working alongside manual merge for edge cases
- Could be implemented before or as part of Phase 10

---

### Three-Tier Architecture: Multi-Tenant Foundation (MOVED)
**Priority:** High  
**Effort:** 2-3 weeks  
**Status:** Planning Phase  
**Context:** Architectural decision for how Mosaic serves as the foundation for multiple client-facing projects while maintaining clean separation, independent billing, and easy project transfers.

**Key Insight:**
Mosaic should be a **three-tier system** where the admin platform (what we're building now) serves as the foundation for multiple lightweight client-facing apps.

---

#### **The Three Tiers**

**Tier 1: RAG Backend (Foundation)**
- Python ingest pipeline (`apps/backend/ingest/`)
- Chunking strategies (Planner-Executor, Agentic, Structure-Aware)
- Embedding generation and storage
- Knowledge graph extraction and management
- Core RAG logic (HyDE, Multi-Query, Reranking, Graph Search)
- Database (Supabase with multi-tenant support)

**Tier 2: Admin/Management Frontend (Current Mosaic Web App)**
- Document upload and processing management
- Entity and relationship editing
- Knowledge graph visualization
- System settings and configuration
- Search testing and debugging tools
- Analytics dashboard
- Cost tracking per organization
- **Admin-only access** (you and your team)

**Tier 3: Client-Facing Apps (Separate Repos)**
- Newsletter RAG app
- Research assistant app
- Customer support bot
- Any other specialized applications
- **Public/customer access** (paying users)
- Lightweight (just UI + API proxy)
- Calls Mosaic API with tenant-scoped API key

---

#### **Architecture Diagram**

```
┌─────────────────────────────────────────────────────────┐
│  TIER 1: RAG Foundation (Backend)                       │
│  - Python ingest pipeline                               │
│  - Chunking, embeddings, graph extraction              │
│  - Database (Supabase)                                  │
│  - Core RAG logic                                       │
└─────────────────────────────────────────────────────────┘
                         ↑
                         │ (Internal API)
                         ↓
┌─────────────────────────────────────────────────────────┐
│  TIER 2: Admin Platform (Mosaic - Single Instance)      │
│  - Document management                                  │
│  - Entity/relationship editing                          │
│  - Graph visualization                                  │
│  - System settings                                      │
│  - Multi-tenant (one org per project)                  │
│  - Exposes public API for client apps                  │
└─────────────────────────────────────────────────────────┘
                         ↑
                         │ (Public API with API Keys)
                         ↓
┌─────────────────────────────────────────────────────────┐
│  TIER 3: Client-Facing Apps (Separate Repos)            │
│                                                          │
│  Newsletter App    Research App    Support Bot          │
│  (Repo 1)          (Repo 2)        (Repo 3)            │
│                                                          │
│  Each has:                                              │
│  - Custom UI/UX                                         │
│  - API proxy to Mosaic                                  │
│  - Tenant-specific API key                              │
│  - Independent deployment                               │
└─────────────────────────────────────────────────────────┘
```

---

#### **Why This Architecture?**

**Business Requirements:**
1. ✅ **Separate Billing** - Each client app has own infrastructure costs
2. ✅ **Easy to Sell** - Transfer client app repo + API key, clean handoff
3. ✅ **IP Protection** - Core Mosaic platform stays yours
4. ✅ **Flexibility** - Each client app can be customized independently
5. ✅ **Scalability** - Add new projects without duplicating admin platform

**Technical Benefits:**
1. ✅ **Single Admin Platform** - All improvements benefit all projects
2. ✅ **Shared Infrastructure** - One database, one backend to maintain
3. ✅ **Lightweight Client Apps** - Just UI + API proxy (easy to build)
4. ✅ **Multi-Tenant** - Org-scoped data with RLS policies
5. ✅ **API-First** - Clean separation between admin and client apps

---

#### **Implementation Plan**

**Phase 1: Add Multi-Tenancy to Mosaic (1 week)**

1. **Database Schema Updates:**
```sql
-- Organizations table
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  api_key TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  settings JSONB DEFAULT '{}'
);

-- Add org_id to existing tables
ALTER TABLE documents ADD COLUMN org_id UUID REFERENCES organizations(id);
ALTER TABLE entities ADD COLUMN org_id UUID REFERENCES organizations(id);
ALTER TABLE relationships ADD COLUMN org_id UUID REFERENCES organizations(id);
ALTER TABLE chunks ADD COLUMN org_id UUID REFERENCES organizations(id);
ALTER TABLE chat_sessions ADD COLUMN org_id UUID REFERENCES organizations(id);

-- RLS policies for multi-tenancy
CREATE POLICY "org_isolation_documents"
  ON documents FOR ALL
  USING (org_id = current_setting('app.current_org_id')::uuid);

-- Repeat for all tables
```

2. **API Key Authentication:**
```typescript
// middleware.ts
export async function middleware(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key');
  
  if (apiKey) {
    // External API request - validate key and set org context
    const org = await getOrgByApiKey(apiKey);
    if (!org) return new Response('Invalid API key', { status: 401 });
    req.headers.set('x-org-id', org.id);
  } else {
    // Admin request - use session
    const session = await getSession();
    if (!session) return NextResponse.redirect('/login');
    req.headers.set('x-org-id', session.user.org_id);
  }
}
```

3. **Cost Tracking Per Organization:**
```typescript
// Track all API costs by organization
await logCost({
  org_id: orgId,
  service: 'openai',
  operation: 'embedding',
  cost: 0.0001,
  tokens: 1000,
  timestamp: new Date(),
});
```

---

**Phase 2: Create Public API Routes (2-3 days)**

```typescript
// apps/web/app/api/public/search/route.ts
export async function POST(req: Request) {
  const orgId = req.headers.get('x-org-id'); // Set by middleware
  const { query } = await req.json();
  
  // Run search scoped to organization
  const results = await hybridSearch({
    query,
    orgId, // Only searches this org's documents
    match_threshold: 0.5,
    match_count: 10,
  });
  
  return Response.json(results);
}

// apps/web/app/api/public/chat/route.ts
export async function POST(req: Request) {
  const orgId = req.headers.get('x-org-id');
  const { messages } = await req.json();
  
  // Chat with org-scoped data
  const result = await streamText({
    model: getModelForDepth('standard'),
    messages: convertToModelMessages(messages),
    tools: {
      searchDocuments: tool({
        execute: async ({ query }) => {
          return await hybridSearch({ query, orgId });
        },
      }),
    },
  });
  
  return result.toUIMessageStreamResponse();
}
```

---

**Phase 3: Create First Client App Template (3-5 days)**

**Structure:**
```
newsletter-app/                    # Separate repo
├── app/
│   ├── page.tsx                   # Landing page
│   ├── chat/
│   │   └── page.tsx               # Chat interface
│   └── api/
│       └── chat/
│           └── route.ts           # Proxies to Mosaic
├── components/
│   ├── chat-interface.tsx         # Custom UI
│   └── newsletter-specific/       # Project-specific components
├── .env
│   ├── MOSAIC_API_URL=https://mosaic.yourdomain.com
│   └── MOSAIC_API_KEY=newsletter_project_key
└── package.json
```

**API Proxy Pattern:**
```typescript
// newsletter-app/app/api/chat/route.ts
export async function POST(req: Request) {
  const { messages } = await req.json();
  
  // Forward to Mosaic admin platform
  const response = await fetch(
    `${process.env.MOSAIC_API_URL}/api/public/chat`,
    {
      method: 'POST',
      headers: {
        'x-api-key': process.env.MOSAIC_API_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messages }),
    }
  );
  
  // Stream response back to client
  return new Response(response.body, {
    headers: response.headers,
  });
}
```

---

#### **Selling a Project**

**What You Transfer:**
1. ✅ Client app GitHub repo (transfer ownership)
2. ✅ API key (transfer to buyer or issue new one)
3. ✅ Domain name (transfer DNS)
4. ✅ Vercel/hosting project (transfer account)
5. ✅ Documentation (included in repo)

**What You Keep:**
1. ✅ Mosaic admin platform (you maintain)
2. ✅ Core RAG foundation (your IP)
3. ✅ Other client projects (unaffected)
4. ✅ Improvements to foundation (benefit all projects)

**Buyer Options:**

**Option A: Continue Using Your Mosaic (Recommended)**
- Buyer keeps using your Mosaic API
- You bill them monthly for usage (API calls, storage)
- Ongoing relationship and support
- Easy for buyer (no infrastructure to manage)

**Option B: Self-Host Mosaic**
- Export their organization's data
- Provide Mosaic codebase (or they clone from GitHub)
- They deploy their own instance
- Clean break, full independence
- More work for buyer but complete ownership

---

#### **Cost Tracking & Billing**

**Per Organization Tracking:**
```sql
CREATE TABLE org_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  service TEXT NOT NULL,              -- 'openai', 'cohere', 'supabase'
  operation TEXT NOT NULL,            -- 'embedding', 'reranking', 'chat'
  cost DECIMAL(10, 6) NOT NULL,
  tokens INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Monthly cost summary
CREATE VIEW org_monthly_costs AS
SELECT 
  org_id,
  DATE_TRUNC('month', created_at) as month,
  service,
  SUM(cost) as total_cost,
  SUM(tokens) as total_tokens
FROM org_costs
GROUP BY org_id, month, service;
```

**Billing Dashboard:**
- Admin can see costs per organization
- Generate invoices automatically
- Track usage trends
- Set spending limits/alerts

---

#### **Client App Independence**

**Each client app has:**
- ✅ Own GitHub repo (separate codebase)
- ✅ Own Vercel project (separate deployment)
- ✅ Own domain (separate DNS)
- ✅ Own API key (tenant-scoped access)
- ✅ Custom UI/UX (project-specific branding)
- ✅ Independent scaling (based on their traffic)

**But shares:**
- ✅ Mosaic RAG foundation (via API)
- ✅ Core search/chunking/graph capabilities
- ✅ Improvements to foundation (automatic)
- ✅ Infrastructure costs (billed per usage)

---

#### **Comparison with Alternatives**

| Aspect | Multi-Tenant Mosaic | Separate Instances | Monorepo |
|--------|---------------------|-------------------|----------|
| **Separate Billing** | ✅ Easy (API key tracking) | ✅ Easy (separate accounts) | ❌ Complex |
| **Sell Projects** | ✅ Transfer repo + API key | ✅ Transfer everything | ❌ Hard to extract |
| **Maintenance** | ✅ Single platform | ❌ Multiple platforms | ✅ Single codebase |
| **Improvements** | ✅ Benefit all projects | ❌ Must update each | ✅ Instant |
| **Flexibility** | ✅ Custom client apps | ✅ Complete independence | ⚠️ Shared constraints |
| **Infrastructure Cost** | ✅ Shared (efficient) | ❌ Duplicated | ✅ Shared |
| **IP Protection** | ✅ Foundation separate | ⚠️ Everything included | ❌ Everything together |

---

#### **Migration Path**

**Current State:**
- Mosaic is single-tenant
- No organization concept
- No public API

**Target State:**
- Mosaic is multi-tenant admin platform
- Multiple organizations with API keys
- Public API for client apps
- Separate client app repos

**Migration Steps:**
1. Add organizations table and RLS policies
2. Migrate existing data to default organization
3. Add API key authentication
4. Create public API routes
5. Build first client app as template
6. Test end-to-end flow
7. Document for future projects

---

#### **Next Steps**

**Immediate (This Week):**
1. Review and validate architecture
2. Design organizations schema
3. Plan RLS policy implementation

**Short-term (Next 2 Weeks):**
1. Implement multi-tenancy in Mosaic
2. Create public API routes
3. Build client app template

**Medium-term (Next Month):**
1. Migrate first project to new architecture
2. Test billing and cost tracking
3. Document handoff process

---

#### **Success Criteria**

**Phase 1 Complete When:**
- ✅ Organizations table exists with RLS
- ✅ API key authentication works
- ✅ Cost tracking per org implemented
- ✅ Admin can manage multiple orgs

**Phase 2 Complete When:**
- ✅ Public API routes functional
- ✅ API key scoping works correctly
- ✅ Search/chat work via API
- ✅ Rate limiting in place

**Phase 3 Complete When:**
- ✅ Client app template created
- ✅ Can deploy and run independently
- ✅ Calls Mosaic API successfully
- ✅ End-to-end flow tested

---

#### **Resources**

**Documentation to Create:**
- Multi-tenancy implementation guide
- Public API documentation
- Client app template README
- Project handoff checklist
- Billing and cost tracking guide

**Related Features:**
- Complements Vercel AI SDK integration
- Enables multiple client projects
- Foundation for future growth
- Supports business model (selling projects)

---

## 🎯 Active Development

### Synthesize Vercel AI SDK Patterns with Mosaic RAG
**Priority:** High  
**Effort:** 1-2 weeks (phased implementation)  
**Status:** Planning Phase  
**Context:** After reviewing Vercel's official AI SDK cookbook and RAG agent guide, we've identified key patterns to adopt while preserving our advanced search capabilities.

**Key Discovery:**
We have a **more sophisticated backend** (search/chunking/graph), but Vercel has a **more agentic frontend** (tool-based architecture, multi-step reasoning). The opportunity is to combine both approaches.

---

#### **What We're Doing Better**

✅ **Search Quality** - Our hybrid search + graph + reranking crushes their simple vector search
- Theirs: Single embedding, cosine similarity > 0.5, top 4 chunks, ~150ms
- Ours: HyDE + Multi-Query + Hybrid + Graph + Reranking, top 10 chunks, ~350-1500ms
- **10x better accuracy for complex queries**

✅ **Chunking Strategy** - Production-grade vs basic sentence splitting
- Theirs: Simple sentence-based chunking (split on periods)
- Ours: Planner-Executor, Agentic, Structure-Aware, Sorting Hat
- **Semantic awareness and document structure preservation**

✅ **Knowledge Graph** - Full graph vs nothing
- Theirs: No graph, flat vector search only
- Ours: Full knowledge graph with entities, relationships, graph-enhanced search
- **Unique capability for relationship queries**

✅ **Learning System** - Search signals for continuous improvement
- Theirs: No learning, static system
- Ours: Search signal capture, co-occurrence analysis, relationship inference
- **Self-improving over time**

---

#### **What They're Doing Better**

🎯 **Tool-Based Architecture** - AI decides when to search
```typescript
tools: {
  getInformation: tool({
    description: 'get information from your knowledge base',
    execute: async ({ question }) => findRelevantContent(question),
  }),
  addResource: tool({
    description: 'add a resource to your knowledge base',
    execute: async ({ content }) => createResource({ content }),
  }),
}
```
**Benefits:**
- AI decides WHEN to search (not every message)
- Can search multiple times
- Can refine queries
- More natural conversation flow

🎯 **Multi-Step Reasoning** - Complex workflows
```typescript
stopWhen: stepCountIs(5) // AI can call tools multiple times
```
**Flow:**
1. User asks question
2. AI calls `getInformation` tool
3. Receives results
4. AI can call tool again to refine
5. Generates final response

🎯 **Dynamic Knowledge Base** - Conversational learning
- Users can add facts during conversation
- "My favorite food is pizza" → AI stores it
- Knowledge base grows organically
- No document upload required

🎯 **Simplicity** - Easier to understand and modify
- Simple codebase, clear flow
- Easy to debug and extend
- Lower cognitive overhead

---

#### **Implementation Plan: Best of Both Worlds**

**Phase 1: Add Tool-Based Search (This Week - 2-3 days)**

✅ **Completed:**
- Message persistence with Vercel AI SDK pattern
- URL-based routing (`/chat` → `/chat/[id]`)
- Server-side ID generation
- Send only last message to reduce payload
- Handle disconnects with `consumeStream()`

🔄 **Next Steps:**

1. **Make Search a Tool**
```typescript
// Keep existing /api/search endpoint for direct use
// Add as tool for agentic behavior

tools: {
  searchDocuments: tool({
    description: `Search your knowledge base for relevant information.
    Use this when the user asks a question that requires information from documents.
    Can use advanced features like graph search for relationship queries.`,
    inputSchema: z.object({
      query: z.string().describe('The search query'),
      useGraph: z.boolean().optional().describe('Use graph search for relationship queries'),
      useAdvanced: z.boolean().optional().describe('Use HyDE and Multi-Query for complex queries'),
    }),
    execute: async ({ query, useGraph, useAdvanced }) => {
      // Call our existing advanced search endpoint
      const response = await fetch('/api/search', {
        method: 'POST',
        body: JSON.stringify({ 
          query,
          use_graph: useGraph ?? true,
          use_hyde: useAdvanced ?? true,
          use_multi_query: useAdvanced ?? true,
        }),
      });
      const results = await response.json();
      
      // Return formatted results for AI
      return {
        results: results.results.map(r => ({
          content: r.content,
          document: r.document_name,
          score: r.rerank_score,
        })),
        count: results.results.length,
      };
    },
  }),
}
```

2. **Enable Multi-Step Calls**
```typescript
const result = streamText({
  model: getModelForDepth('standard'),
  system: systemPrompt,
  messages: convertToModelMessages(messages),
  tools,
  stopWhen: stepCountIs(5), // Allow up to 5 tool calls
  temperature: 0.3,
});
```

3. **Update UI to Show Tool Calls**
```typescript
// In chat-client.tsx
{message.parts.map((part) => {
  if (part.type === 'tool-call') {
    return (
      <div className="tool-call">
        🔍 Searching: {part.args.query}
        {part.args.useGraph && <span>📊 Using graph search</span>}
      </div>
    );
  }
  if (part.type === 'tool-result') {
    return (
      <div className="tool-result">
        ✅ Found {part.result.count} results
      </div>
    );
  }
})}
```

**Benefits:**
- ✅ AI decides when to search (not every message)
- ✅ Can search multiple times per conversation
- ✅ Can refine queries based on results
- ✅ Keep our advanced search pipeline
- ✅ Better conversation flow
- ✅ More transparent (show tool calls)

---

**Phase 2: Add Knowledge Management Tools (Next Week - 2-3 days)**

1. **Add Quick Facts Tool**
```typescript
tools: {
  addKnowledge: tool({
    description: `Add a quick fact or piece of information to the knowledge base.
    Use this when the user shares information they want to remember.`,
    inputSchema: z.object({
      content: z.string().describe('The information to store'),
      category: z.string().optional().describe('Optional category'),
    }),
    execute: async ({ content, category }) => {
      // Create a simple document
      // Process and chunk
      // Extract entities
      // Add to graph
      return 'Added to knowledge base';
    },
  }),
}
```

2. **Add Entity Lookup Tool**
```typescript
tools: {
  lookupEntity: tool({
    description: 'Look up detailed information about a specific entity',
    inputSchema: z.object({
      entityName: z.string(),
    }),
    execute: async ({ entityName }) => {
      // Search entities by name
      // Return entity details + relationships
    },
  }),
}
```

3. **Add Relationship Explorer Tool**
```typescript
tools: {
  exploreRelationships: tool({
    description: 'Explore how two entities are related',
    inputSchema: z.object({
      entityA: z.string(),
      entityB: z.string(),
      maxHops: z.number().optional(),
    }),
    execute: async ({ entityA, entityB, maxHops }) => {
      // Find path between entities
      // Return relationship chain
    },
  }),
}
```

**Benefits:**
- ✅ Conversational knowledge building
- ✅ Quick facts without document upload
- ✅ Explore graph through conversation
- ✅ More interactive experience

---

**Phase 3: Optimize & Polish (Week 3 - 3-5 days)**

1. **Add Simple Search Mode**
- Fast path for simple queries
- Skip HyDE/Multi-Query for basic lookups
- AI can choose: `useAdvanced: false` for speed

2. **Implement Caching Middleware**
```typescript
import { createCache } from 'ai';

const cache = createCache({
  ttl: 60 * 60, // 1 hour
});

const result = streamText({
  model,
  messages,
  tools,
  experimental_cache: cache, // Cache tool results
});
```

3. **Better Tool Descriptions**
- Help AI choose right tool
- Include examples in descriptions
- Tune for better decision-making

4. **Tool Result Visualization**
- Rich UI for search results
- Entity cards in chat
- Relationship graphs inline
- Document previews

**Benefits:**
- ✅ Faster for simple queries
- ✅ Reduced API costs
- ✅ Better AI decision-making
- ✅ Richer user experience

---

#### **Architecture Comparison**

**Current (Endpoint-Based):**
```
User Message
  ↓
Chat Route
  ↓
ALWAYS calls /api/search
  ↓
Advanced Search Pipeline
  ↓
Stream Response
```

**Target (Tool-Based):**
```
User Message
  ↓
Chat Route with Tools
  ↓
AI Decides: Need to search?
  ↓ (if yes)
Call searchDocuments tool
  ↓
Advanced Search Pipeline
  ↓
AI Receives Results
  ↓
AI Decides: Need more info?
  ↓ (if yes)
Call tool again (refine query)
  ↓
Stream Final Response
```

---

#### **Key Design Decisions**

**1. Keep Both Endpoint and Tool**
- `/api/search` endpoint for direct use (UI, external tools)
- Tool wraps endpoint for agentic behavior
- Reuse existing pipeline, no duplication

**2. Preserve Advanced Features**
- HyDE, Multi-Query, Graph, Reranking all available
- AI can enable/disable via tool parameters
- Default to advanced for complex queries

**3. Progressive Enhancement**
- Phase 1 works with existing search
- Phase 2 adds new capabilities
- Phase 3 optimizes and polishes
- No breaking changes

**4. Transparency**
- Show tool calls in UI
- Display search parameters used
- Explain why AI chose to search
- Build user trust

---

#### **Expected Outcomes**

**Performance:**
- 30-50% fewer searches (AI decides when needed)
- Faster simple queries (skip advanced features)
- Better accuracy (multi-step refinement)

**User Experience:**
- More natural conversation flow
- Can add knowledge conversationally
- Explore graph through chat
- Transparent AI reasoning

**Developer Experience:**
- Cleaner architecture
- Easier to add new tools
- Better separation of concerns
- Follows industry patterns

---

#### **Resources**

**Documentation Created:**
- `/docs/ai-sdk-patterns.md` - Comprehensive AI SDK patterns
- `/docs/rag-comparison.md` - Detailed RAG implementation comparison
- `/docs/search-comparison.md` - Search implementation deep dive

**Vercel References:**
- AI SDK Cookbook: https://ai-sdk.dev/cookbook
- RAG Agent Guide: https://ai-sdk.dev/cookbook/guides/rag-chatbot
- Message Persistence: https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-message-persistence
- Caching Middleware: https://ai-sdk.dev/cookbook/next/caching-middleware
- Human-in-the-Loop: https://ai-sdk.dev/cookbook/next/human-in-the-loop
- Multi-Step Tools: https://ai-sdk.dev/cookbook/next/call-tools-multiple-steps

**Key Insight:**
We don't need to choose between their approach and ours. We can have both:
- **Keep our advanced backend** (search quality, chunking, graph)
- **Add their agentic frontend** (tools, multi-step, conversational)
- **Result:** Production-grade RAG with agentic capabilities

---

## 💡 Enhancements & Ideas

### Real-Time Progress Indicators for Chat
**Priority:** Medium  
**Effort:** 1-2 weeks  
**Status:** Needs Research  
**Context:** Show users what's happening during backend processing (searching, ranking, etc.) instead of just a generic "thinking" indicator.

---

#### **Current Problem**
When users send a chat message, there's a 2-10 second delay while the backend:
1. Analyzes the question
2. Generates query variations (Multi-Query)
3. Searches documents (4+ parallel searches)
4. Ranks results (reranking)
5. Generates response

Users see nothing during this time except a generic loading state. They don't know if it's working or stuck.

---

#### **Desired Experience**
Show real-time progress steps like:
```
✓ Analyzing your question
⟳ Finding the best ways to search
○ Preparing search queries
○ Searching through your documents
○ Ranking by relevance
○ Generating response
```

Similar to what we see in server logs:
```
[Progress] Analyzing your question (completed)
[Progress] Finding the best ways to search (in-progress)
[Multi-Query] Generated 3 variations in 1038ms
[Progress] Searching through your documents (completed)
[Progress] Ranking by relevance (in-progress)
```

---

#### **Technical Challenges**

**Challenge 1: AI SDK Message Management**
- The Vercel AI SDK's `useChat` hook automatically manages messages
- When `sendMessage()` is called, it immediately adds the user message to the array
- This triggers React re-renders that interfere with custom "thinking" messages
- Temporary messages get removed before they can be displayed

**Challenge 2: Backend Progress Events**
- Backend logs progress to console, not to client
- No streaming of progress events from `/api/search` to `/api/chat` to client
- Would need Server-Sent Events (SSE) or similar streaming mechanism

**Challenge 3: Architecture Mismatch**
- Chat API calls Search API and waits for complete response
- Search API doesn't stream progress, returns final results
- Would need to refactor both APIs to support streaming progress

---

#### **Potential Solutions**

**Option 1: AI SDK Experimental Features**
The AI SDK may support streaming custom data alongside responses:
```typescript
// Backend
const result = streamText({
  model,
  messages,
  experimental_telemetry: {
    // Could potentially stream progress here
  },
  onChunk: (chunk) => {
    // Send custom progress events?
  }
});
```

**Needs Research:**
- Does AI SDK support streaming custom metadata?
- Can we send progress events alongside message streaming?
- What's the recommended pattern for this use case?

**Option 2: Server-Sent Events (SSE)**
Implement separate SSE endpoint for progress:
```typescript
// Client subscribes to progress stream
const eventSource = new EventSource(`/api/progress/${sessionId}`);
eventSource.onmessage = (event) => {
  const progress = JSON.parse(event.data);
  updateProgressUI(progress);
};

// Backend publishes progress events
publishProgress(sessionId, {
  step: 'searching',
  status: 'in-progress',
  message: 'Searching through your documents'
});
```

**Challenges:**
- Need session coordination between chat and progress streams
- More complex architecture
- Additional infrastructure (Redis/memory store for pub/sub)

**Option 3: Simulated Progress (Current Attempt - Failed)**
Show fake progress steps that advance on timers:
```typescript
// Show steps that advance every 800ms
const steps = [
  'Analyzing your question',
  'Finding search strategies',
  'Searching documents',
  'Ranking results',
];
```

**Why It Failed:**
- AI SDK's automatic message management conflicts with custom messages
- Thinking messages get removed immediately when real messages arrive
- Creates infinite re-render loops
- Not showing real backend progress anyway

---

#### **Recommended Approach**

**Phase 1: Simple Loading State (Quick Win - 1 day)**
Show a single loading indicator when `status === 'streaming'`:
```typescript
{status === 'streaming' && (
  <div className="flex items-center gap-2">
    <Loader size={14} />
    <span>Searching your documents...</span>
  </div>
)}
```

**Benefits:**
- Works with AI SDK out of the box
- No complex state management
- Better than nothing
- What most AI UIs do (ChatGPT, Claude, etc.)

**Phase 2: Research AI SDK Capabilities (1-2 days)**
- Review AI SDK documentation for streaming custom data
- Check experimental features and telemetry
- Look at AI SDK cookbook examples
- Ask in AI SDK Discord/GitHub discussions

**Phase 3: Implement Real Progress (1-2 weeks)**
Once we understand AI SDK capabilities:
- Modify backend to stream progress events
- Update frontend to display real-time progress
- Show actual backend steps, not simulated
- Provide transparency into what's happening

---

#### **Questions to Answer**

1. **Does the AI SDK support streaming custom metadata alongside messages?**
   - Need to check experimental features
   - Review telemetry options
   - Look for examples in cookbook

2. **What's the recommended pattern for progress indicators in AI SDK?**
   - Is there a built-in way to do this?
   - Do we need SSE or can we use the existing stream?
   - Are there examples from Vercel or community?

3. **Should we wait for tool-based architecture first?**
   - Tool calls naturally show progress (AI searching, AI analyzing, etc.)
   - Might solve the problem differently
   - Could be simpler than custom progress events

---

#### **Related Work**

- **Tool-Based Architecture (Phase 6.1)** - Tool calls show AI reasoning steps
- **Enhanced Chat UI** - Already has professional interface, just needs progress
- **Search Pipeline** - Already logs progress, just needs to stream it

---

#### **Success Criteria**

**Minimum (Phase 1):**
- ✅ Show loading state when processing
- ✅ Better than blank screen
- ✅ Works reliably without bugs

**Ideal (Phase 3):**
- ✅ Real-time progress from backend
- ✅ Shows actual steps being performed
- ✅ Updates as backend progresses
- ✅ Transparent and informative
- ✅ No performance impact

---

### Inline Citations with Deep-Linking (MOVED TO BUILD_PLAN)
**Priority:** High  
**Effort:** 1 week (phased implementation)  
**Context:** Implement Perplexity-style inline citations with hover previews and deep-linking to specific chunks in Docling documents.

---

#### **Core Concept**
Replace our current "sources at the end" approach with inline citations that appear directly where claims are made. Each citation shows a badge `[1]` that on hover reveals source details, quotes, and provides direct navigation to the exact chunk in the document.

---

#### **Key Components**

**1. shadcn Inline Citation Component**
- Hover cards with source previews
- Carousel for multiple sources per citation  
- Mobile-friendly (click support)
- Keyboard navigation
- Based on Vercel AI Elements (Apache 2.0)

**2. Docling Deep-Link Support**
- Store JSON pointers (`#/texts/5`) in chunk metadata
- Preserve page numbers and bounding boxes
- Enable direct navigation to specific elements
- HTML export with element IDs

**3. Enhanced Citation Links**
- Current: `/admin/documents/{documentId}`
- New: `/admin/documents/{documentId}#chunk-{chunkId}`
- Auto-scroll and highlight target chunk
- Show chunk in document context

---

#### **Implementation Plan**

**Phase 1: Store Docling Metadata (1-2 days)**
```python
# Update chunkers to preserve Docling identifiers
for chunk in docling_chunks:
    db_chunk = {
        "content": chunk.text,
        "metadata": {
            "docling_pointer": chunk.origin,  # #/texts/5
            "page_number": chunk.page_no,
            "bbox": chunk.bbox,
            "element_type": chunk.obj_type
        }
    }
```

**Phase 2: Add shadcn Components (1 day)**
```bash
npx shadcn@latest add @shadcn/hover-card @shadcn/badge @shadcn/carousel
```

**Phase 3: Create Inline Citation Component (2 days)**
- Custom component based on Vercel AI Elements
- Supports hover previews with quotes
- Carousel for multiple sources
- Deep-link URLs to chunks

**Phase 4: Update Chat Response (2 days)**
- Parse citations in AI responses
- Render inline badges instead of end sources
- Structured citation data in backend
- Mobile touch support

**Phase 5: Document Viewer Enhancement (1 day)**
- Accept chunk ID in URL/hash
- Scroll to and highlight chunk
- Show chunk in full context

---

#### **Technical Details**

**Citation Data Structure:**
```typescript
interface CitationSource {
  number: string;           // [1], [2], etc.
  title: string;            // Document name
  url: string;              // Deep link to chunk
  description?: string;     // Chunk preview
  quote?: string;           // Relevant excerpt
  chunkId: string;          // UUID for navigation
  documentId: string;       // Document UUID
}
```

**Backend Schema Update:**
```typescript
// Return structured citations from chat API
const response = {
  content: "AI response with [1] citations",
  citations: [
    {
      number: "1",
      title: "Strategy Tactics Deck",
      url: `/admin/documents/${docId}#chunk-${chunkId}`,
      description: "Chunk about design thinking...",
      quote: "Design thinking is a human-centered approach...",
      chunkId: "uuid-here",
      documentId: "doc-uuid"
    }
  ]
};
```

**Frontend Rendering:**
```tsx
// Parse and render inline citations
content.split(/(\[\d+\])/).map((part, idx) => {
  const citation = part.match(/\[(\d+)\]/);
  if (citation) {
    return (
      <InlineCitation sources={getCitation(citation[1])}>
        <span className="citation-badge">{part}</span>
      </InlineCitation>
    );
  }
  return part;
});
```

---

#### **Benefits**

1. **Trust & Verification**: Users can immediately verify claims
2. **Professional UX**: Academic-style citations like research papers  
3. **Better Navigation**: Direct links to exact source location
4. **Context Preservation**: Stay in flow while verifying
5. **Mobile Optimized**: Touch-friendly citation cards
6. **Rich Previews**: See quotes before navigating

---

#### **Docling Compatibility**

✅ **Fully Supported:**
- JSON pointers for each element
- HTML export with IDs
- Page numbers and layout info
- Hierarchical structure preservation
- Bounding box coordinates

✅ **No Breaking Changes:**
- Existing chunks remain functional
- Gradual metadata population
- Backward compatible citation links

---

#### **Example User Flow**

```
User asks: "What is design thinking?"

AI responds: "Design thinking is a human-centered approach [1] that 
emphasizes empathy [2] and iterative prototyping [3]."

User hovers over [1]:
┌─────────────────────────┐
│ Strategy Tactics Deck   │ ← Document title
│ "Design thinking is..." │ ← Quote preview  
│ View Source →           │ ← Deep link to chunk
│ [◄] [1/3] [►]          │ ← Carousel navigation
└─────────────────────────┘

User clicks "View Source":
→ Opens document at exact chunk
→ Chunk highlighted in yellow
→ Shows surrounding context
```

---

### shadcn AI Components UI Modernization (MOVED TO BUILD_PLAN)

---

### Graph Learning from Search Patterns
**Priority:** High  
**Effort:** 2-3 weeks (phased implementation)  
**Context:** Make the knowledge graph self-improving by automatically discovering new entity relationships based on search behavior and RAG pipeline results.

**Core Concept:**
Every search reveals implicit connections that aren't explicitly modeled in the graph yet. By analyzing which entities frequently co-occur in search results, we can suggest new relationships and make the graph smarter over time.

**How It Works:**
1. **Capture Search Signals** - Log which chunks and entities appear together in search results
2. **Analyze Co-Occurrence** - Find entities that frequently appear together across multiple searches
3. **Infer Relationships** - Use AI to determine the most likely relationship type between co-occurring entities
4. **Suggest to User** - Present discovered connections with confidence scores for review
5. **Learn from Feedback** - Track which suggestions are accepted/rejected to improve future recommendations

**Example Flow:**
```
User searches: "design thinking"
→ Results include chunks mentioning: "User Research", "Prototyping", "Empathy Mapping"
→ System detects: These entities co-occur frequently (5+ searches)
→ AI infers: "Design Thinking" --[uses]--> "User Research"
→ Suggests: "💡 Found connection: Design Thinking → User Research (85% confidence)"
→ User clicks: [Add to Graph]
```

**Implementation Phases:**

**Phase 1: Search Signal Capture (Foundation) - 2-3 days** ✅ **COMPLETED**
- ✅ Created `search_signals` table to log search results
- ✅ Stores: query, query_embedding, chunk_ids, entity_ids, rerank_scores, timestamp
- ✅ Captures in search API after reranking (works for both /search and /chat routes)
- ✅ Minimal overhead: ~1-2ms per search
- ⏳ User engagement tracking (clicked results) - future enhancement

**Phase 2: Co-Occurrence Analysis (Weekly Job) - 3-4 days**
- SQL function to analyze entity co-occurrence patterns
- Find entity pairs that appear together frequently (configurable threshold)
- Calculate confidence scores based on frequency and recency
- Filter out relationships that already exist
- Generate sample queries showing where entities co-occurred

**Phase 3: Relationship Type Inference (AI-Powered) - 2-3 days**
- Use AI to infer most likely relationship type between entity pairs
- Input: entity names, types, descriptions, sample queries where they co-occurred
- Output: relationship type from standard set (uses, requires, relates_to, etc.)
- Model: Quick model (gpt-4.1-nano) for cost efficiency
- Batch processing for multiple suggestions

**Phase 4: Suggestion Review UI - 3-4 days**
- New page: `/graph/suggestions`
- Display discovered relationships with:
  - Entity A → Relationship Type → Entity B
  - Confidence score (60-100%)
  - Co-occurrence count
  - Sample queries showing context
  - Accept/Reject buttons
- Sort by confidence, recency, or co-occurrence count
- Batch accept/reject functionality
- Track acceptance rate for learning

**Phase 5: Real-Time Inline Suggestions (Advanced) - 3-5 days**
- Detect potential relationships during search
- Show inline suggestions in search results:
  - "💡 Found connection: OODA Loop → Decision Making"
  - One-click to add to graph
- Only show high-confidence suggestions (>80%)
- Dismissible and non-intrusive
- Queue lower-confidence for batch review

**Phase 6: Autonomous Learning (Future) - 1 week**
- Auto-create relationships above confidence threshold (e.g., 90%)
- Flag for user review but add immediately
- Confidence decay over time if not validated
- Learn from user corrections
- Temporal patterns (entities connected during specific time periods)

**Database Schema:**
```sql
-- Search signals (raw data)
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

-- Relationship suggestions (derived insights)
CREATE TABLE relationship_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  entity_a_id UUID REFERENCES entities(id),
  entity_b_id UUID REFERENCES entities(id),
  suggested_type TEXT NOT NULL,
  confidence_score FLOAT NOT NULL,
  co_occurrence_count INT NOT NULL,
  sample_queries TEXT[],
  source TEXT DEFAULT 'search_cooccurrence',
  status TEXT DEFAULT 'pending', -- pending, accepted, rejected
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);
```

**Benefits:**
- ✅ **Self-Improving Graph** - Gets smarter with every search
- ✅ **Discover Hidden Connections** - Find relationships you didn't explicitly model
- ✅ **Reduce Manual Curation** - Auto-suggest instead of manual relationship creation
- ✅ **Personalized Learning** - Learns from YOUR specific usage patterns
- ✅ **Better Search Over Time** - Improved graph = better graph-enhanced search
- ✅ **Temporal Intelligence** - Understand how relationships evolve
- ✅ **Usage Analytics** - Insights into how users explore knowledge

**Use Cases:**
1. **Research Discovery** - User searches "machine learning" repeatedly, results often include "neural networks" and "deep learning" → Suggest: "Machine Learning" --[includes]--> "Deep Learning"

2. **Project Connections** - User searches "Q4 planning", results mention "Budget 2024" and "Hiring Plan" → Suggest: "Q4 Planning" --[requires]--> "Budget 2024"

3. **Concept Relationships** - User searches "design thinking", results include "user research" and "prototyping" → Suggest: "Design Thinking" --[uses]--> "User Research"

4. **Cross-Domain Links** - User searches span multiple topics, revealing unexpected connections between domains

**Technical Considerations:**
- **Privacy**: Search signals are user-scoped, never shared across users
- **Performance**: Async analysis jobs, no impact on search latency
- **Storage**: ~100KB per 1000 searches (minimal)
- **Cost**: AI inference only for accepted suggestions (~$0.001 per suggestion)
- **Accuracy**: Confidence thresholds prevent low-quality suggestions
- **Control**: User always has final say, can disable auto-learning

**Metrics to Track:**
- Suggestion acceptance rate (target: >60%)
- Average confidence score of accepted suggestions
- Time saved vs manual relationship creation
- Graph growth rate (relationships per week)
- Search quality improvement (measured by user engagement)

**Privacy & User Control:**
- Toggle auto-learning on/off in settings
- Set minimum confidence threshold
- Review all suggestions before acceptance
- Bulk accept/reject
- Undo recent additions
- Data retention: 90 days for search signals, forever for accepted relationships

**Related Features:**
- Complements entity extraction from chunks
- Enhances graph-based search
- Feeds into entity deduplication (similar entities co-occur)
- Enables temporal analysis of knowledge evolution

**Documentation:**
Full design document created at `docs/graph-learning.md` with:
- Complete implementation details
- SQL functions for co-occurrence analysis
- AI prompt templates for relationship inference
- UI mockups and user flows
- Performance considerations
- Privacy and security guidelines

**Next Steps:**
1. Implement Phase 1 (search signal capture) - Just add logging
2. Let it run for 1-2 weeks to collect data
3. Analyze patterns manually to validate approach
4. Build Phase 2-3 (analysis + suggestions)
5. Launch Phase 4 (UI) for user testing
6. Iterate based on acceptance rates

**Why This Matters:**
This transforms the knowledge graph from a static structure into a **living, learning system** that evolves based on actual usage. It's the difference between a manually curated encyclopedia and a self-organizing knowledge base that gets smarter every day.

---

### Intelligent Query Caching & Search Optimization
**Priority:** High  
**Effort:** 1-2 weeks (phased implementation)  
**Context:** Use search signal data to dramatically speed up common queries through intelligent caching and pre-computation.

**Core Concept:**
Search signals reveal query patterns that can be exploited for massive performance gains. By caching results for common queries and using semantic similarity matching, we can serve most searches in <50ms instead of 500-1000ms.

**Key Insight:**
- Phase 1 (Graph Learning) captures all search data
- This same data enables query optimization
- 30-50% of queries are semantically similar to previous queries
- **10-20x speedup possible for cached queries**

**Implementation Phases:**

**Phase 1: Simple Query Cache (Quick Win) - 1-2 days**
- Create `query_cache` table with TTL (1 hour default)
- Cache structure: query_hash, query_embedding, cached_results, hit_count, expires_at
- Check cache before running search (exact match on query text)
- Return cached results if fresh (<1 hour old)
- Track cache hit rate and response times
- **Expected: 20-30% hit rate, <50ms response time**

**Phase 2: Semantic Cache Matching - 2-3 days**
- Use query embeddings for similarity matching
- If new query is >0.95 similar to cached query, return cached results
- Enables: "design thinking" and "what is design thinking" share cache
- Cluster similar queries under canonical form
- **Expected: 40-50% hit rate with semantic matching**

**Phase 3: Smart Pre-computation - 2-3 days**
- Background job: identify top 20-50 most frequent queries
- Pre-compute and refresh results every hour
- Warm cache before users even search
- Invalidate cache when new documents added
- **Expected: Top queries always <50ms**

**Phase 4: Query Prediction & Autocomplete - 2-3 days**
- Suggest completions based on common queries
- Show "others also searched for..." suggestions
- Predictive prefetching for likely next queries
- **Expected: Better UX, reduced search latency**

**Phase 5: Adaptive Optimization - 1 week**
- Learn from click-through patterns
- Boost results users prefer for specific queries
- Personalized result ranking based on user history
- A/B test cache strategies
- **Expected: Improved relevance + speed**

**Database Schema:**
```sql
CREATE TABLE query_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  query_hash TEXT NOT NULL,
  query TEXT NOT NULL,
  query_embedding VECTOR(1536),
  cached_results JSONB NOT NULL,
  hit_count INT DEFAULT 0,
  last_accessed TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '1 hour',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_query_cache_user ON query_cache(user_id);
CREATE INDEX idx_query_cache_hash ON query_cache(query_hash);
CREATE INDEX idx_query_cache_expires ON query_cache(expires_at);
CREATE INDEX idx_query_cache_embedding ON query_cache 
  USING ivfflat (query_embedding vector_cosine_ops)
  WITH (lists = 100);
```

**Cache Invalidation Strategy:**
- Time-based: 1 hour TTL for most queries
- Event-based: Invalidate when new documents added
- Frequency-based: Top queries refresh every 15 minutes
- LRU eviction: Keep cache size manageable

**Performance Metrics:**
```sql
-- Track cache performance
CREATE TABLE search_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  query TEXT NOT NULL,
  cache_hit BOOLEAN DEFAULT false,
  response_time_ms INT NOT NULL,
  result_count INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Expected Results:**
- **Cache hit rate:** 30-50% for active users
- **Cached response time:** <50ms (10-20x faster)
- **Uncached response time:** 500-1000ms (unchanged)
- **Cost savings:** Reduced embedding + vector search + reranking costs
- **User experience:** Instant results for common queries

**Benefits:**
- ✅ **Massive speed improvement** for common queries
- ✅ **Cost reduction** - fewer API calls to OpenAI/Cohere
- ✅ **Better UX** - instant results feel magical
- ✅ **Scalability** - handle more users without infrastructure changes
- ✅ **Data-driven** - optimize based on actual usage patterns
- ✅ **Progressive enhancement** - works alongside existing search

**Use Cases:**
1. **Frequent Queries** - User searches "quarterly goals" daily → instant results
2. **Similar Queries** - "design thinking" and "what is design thinking" → same cache
3. **Team Patterns** - Whole team searches similar topics → shared cache benefit
4. **Onboarding** - New users search common topics → pre-warmed cache

**Technical Considerations:**
- Cache invalidation on document updates (simple: clear all, smart: selective)
- Memory usage: ~1KB per cached query, 10K queries = 10MB (minimal)
- Embedding similarity threshold tuning (0.95 = strict, 0.90 = loose)
- Multi-user cache sharing (optional: share cache across organization)
- Privacy: user-scoped cache by default, opt-in for shared cache

**Monitoring:**
- Cache hit/miss rates by user and time
- Response time distribution (cached vs uncached)
- Most frequently cached queries
- Cache eviction patterns
- Cost savings from reduced API calls

**Related Features:**
- Builds on Phase 1 (Graph Learning) search signals
- Complements search quality improvements
- Enables query analytics dashboard
- Foundation for personalized search

**Next Steps:**
1. Implement Phase 1 (simple cache) - immediate wins
2. Monitor hit rates and response times for 1 week
3. Tune cache TTL and similarity thresholds
4. Roll out Phase 2 (semantic matching)
5. Analyze top queries for Phase 3 (pre-computation)

**Why This Matters:**
Search is the primary interface to your knowledge base. Making it 10-20x faster for common queries transforms the user experience from "waiting for results" to "instant answers." Combined with graph learning, your system becomes both smarter AND faster over time.

---

### Migrate to OpenAI Structured Outputs
**Priority:** Medium  
**Effort:** 1-2 days  
**Context:** Currently using deprecated JSON mode (`response_format: {"type": "json_object"}`). Should migrate to Structured Outputs for better reliability and streaming support.

**Status:**
- ✅ `chunkers/planner_executor_chunker.py` - **COMPLETED** (Oct 23, 2025)
  - Migrated to Pydantic models (non-streaming due to SDK limitations)
  - Improved validation with fuzzy matching
  - 100% schema adherence

**Benefits:**
- ✅ 100% schema adherence (vs ~95% with JSON mode)
- ✅ Type safety with Pydantic models
- ✅ Better error handling and refusal detection
- ✅ Automatic validation
- ⏳ Streaming support (not yet available in SDK for parse())

**Remaining files to migrate:**
1. `chunkers/sorting_hat.py` - Document analysis
2. `chunkers/agentic_chunker.py` - Boundary detection
3. `processors/graph_extractor.py` - Entity/relationship extraction

**Additional areas to investigate:**
- Search across codebase for `response_format: {"type": "json_object"}` or `.json()` patterns
- Check web app (apps/web) for any OpenAI API calls using JSON mode
- Review any CrewAI or other agent configurations that might use JSON mode
- Look for custom JSON parsing that could benefit from Pydantic validation

**Implementation pattern:**
```python
from pydantic import BaseModel, Field
from openai import OpenAI

class ChunkPlan(BaseModel):
    document_id: str = Field(description="UUID of document")
    chunks: list[ChunkSpec] = Field(description="Chunk specifications")
    
client = OpenAI()
completion = client.beta.chat.completions.parse(
    model="gpt-4.1-mini",
    messages=[...],
    response_format=ChunkPlan
)

plan = completion.choices[0].message.parsed.model_dump()
```

**Reference:** https://platform.openai.com/docs/guides/structured-outputs

---

### Migrate to OpenAI Responses API
**Priority:** Low  
**Effort:** 3-5 days  
**Context:** OpenAI released a new Responses API that consolidates Chat Completions, Assistants, and other features into a unified interface. The Chat Completions API is not deprecated but is being superseded.

**Why migrate:**
- Cleaner, more consistent API interface
- Better streaming support (including for Structured Outputs)
- Unified tool/function calling patterns
- Multi-turn conversations built-in
- Better error handling and status tracking
- Future-proof (this is OpenAI's direction)

**Why wait:**
- Chat Completions API is stable and working
- No deprecation timeline announced yet
- Significant refactor required
- Should validate current chunking implementation first
- Focus on Phase 1-2 completion

**Files that would need migration:**
1. `chunkers/planner_executor_chunker.py` - Planner stage
2. `chunkers/sorting_hat.py` - Document analysis
3. `chunkers/agentic_chunker.py` - Boundary detection
4. `processors/graph_extractor.py` - Entity/relationship extraction
5. Any other OpenAI API calls in the codebase

**Key API differences:**
```python
# OLD: Chat Completions API
response = client.chat.completions.create(
    model="gpt-4.1-mini",
    messages=[...],
    response_format={"type": "json_object"}
)

# NEW: Responses API
response = client.responses.create(
    model="gpt-4.1-mini",
    input=[...],  # Note: 'input' instead of 'messages'
    text={"format": {"type": "json_object"}}  # Note: 'text' wrapper
)
```

**Structured Outputs with Responses API:**
```python
from pydantic import BaseModel

class ChunkPlan(BaseModel):
    document_id: str
    chunks: list[ChunkSpec]

response = client.responses.parse(
    model="gpt-4.1-mini",
    input=[...],
    text_format=ChunkPlan,  # Simpler interface
    stream=True  # Streaming works!
)

# With streaming
for event in response:
    if event.type == "response.output_text.delta":
        print(event.delta)
```

**When to migrate:**
- After Phase 1-2 chunking improvements are validated
- When OpenAI announces deprecation timeline for Chat Completions
- If we need Responses API-specific features (better streaming, multi-turn, etc.)
- As part of a larger refactor/cleanup effort

**Reference:** https://platform.openai.com/docs/guides/migrate-to-responses

---

### MCP Server for External Tool Integration
**Context:** External automation tools (n8n, Make, Zapier) and AI assistants (Claude Desktop, Cline, etc.) need programmatic access to Mosaic's search, graph, and document capabilities.

**Current State:**
- ✅ Edge Function deployed: `search` endpoint with API key auth
- Provides hybrid search with HyDE, Multi-Query, Reranking
- Requires `user_id` parameter (must know user ID in advance)
- Single-purpose endpoint (search only)

**Problem:**
- No standard protocol for tool discovery
- Each integration requires custom HTTP client code
- Cannot expose multiple capabilities (search, ingest, graph queries, entity management) under one interface
- No type-safe schema for external tools
- Manual API documentation maintenance

**Proposed Solution: Model Context Protocol (MCP) Server**

**Why MCP:**
- Standard protocol for AI/automation tool integration
- Automatic schema discovery and validation
- Single server exposes multiple tools and resources
- Native support in Claude Desktop, Cline, and emerging AI platforms
- Type-safe tool definitions with automatic documentation

**Architecture:**
- **Location:** `apps/backend/mcp-server/` (Node.js/TypeScript)
- **Transport:** HTTP (for n8n, web clients) + stdio (for local AI tools)
- **Auth:** API key validation (same pattern as Edge Function)

**Phase 1: Core MCP Server (2-3 days)**
- [ ] Set up MCP SDK (`@modelcontextprotocol/sdk`)
- [ ] Implement HTTP transport with API key auth
- [ ] Create stdio transport for local tools
- [ ] Connect to Supabase (service role or user-scoped)

**Phase 2: Search Tools (1 day)**
- [ ] `search_documents` tool:
  - Parameters: `query`, `user_id`, `match_threshold`, `match_count`
  - Returns: search results with scores, metadata
  - Wraps existing hybrid search logic
- [ ] `search_entities` tool:
  - Parameters: `query`, `user_id`, `entity_type`
  - Returns: matching entities with relationships

**Phase 3: Graph Tools (1-2 days)**
- [ ] `get_entity` tool: Fetch entity by ID with relationships
- [ ] `get_entity_neighbors` tool: Traverse graph from entity
- [ ] `find_path` tool: Find relationship path between two entities

**Phase 4: Document Tools (1 day)**
- [ ] `list_documents` resource: Browse available documents
- [ ] `get_document` resource: Fetch full document content
- [ ] `ingest_document` tool: Trigger document processing (future)

**Phase 5: Resources (1 day)**
- [ ] `mosaic://graphs` - List available graphs
- [ ] `mosaic://graph/{id}` - Graph metadata
- [ ] `mosaic://document/{id}` - Document content
- [ ] `mosaic://entity/{id}` - Entity details

**Benefits:**
- **For n8n:** Single HTTP endpoint, auto-discovered tools
- **For Claude Desktop:** Native MCP integration, no custom code
- **For developers:** Type-safe API, automatic docs
- **For Mosaic:** Centralized external access point, easier to maintain

**Implementation Notes:**
- Reuse Edge Function search logic (import as module)
- Service role key for admin operations, user-scoped for queries
- Rate limiting per API key (optional, Phase 6)
- Logging and audit trail for all tool calls

**Estimated Effort:** 1-2 weeks total
**Priority:** Medium-High (enables ecosystem integrations)

**Next Steps:**
1. Validate n8n MCP support (or HTTP adapter availability)
2. Scaffold MCP server with search tool
3. Test with Claude Desktop
4. Expand to graph and document tools
5. Document for external developers

---

### Custom Relationship Types Management
**Context:** Relationship types are currently hardcoded in both the Python extractor and the UI. Users cannot add custom relationship types specific to their domain without code changes.

**Current State:**
- 13 predefined types: `part_of`, `uses`, `requires`, `relates_to`, `implements`, `extends`, `depends_on`, `collaborates_with`, `manages`, `creates`, `analyzes`, `evaluates`, `other`
- Defined in Python enum (`graph_extractor.py`)
- Duplicated in UI dropdown (`relationships-card.tsx`)
- "other" type exists but is unused (0 instances in database)

**Problem:**
- Cannot add domain-specific relationship types (e.g., "funds", "reports_to", "supersedes")
- No way to remove unused types
- Changes require code deployment
- Python extractor and UI can get out of sync

**Proposed Solution: Settings Page for Relationship Types**

**Phase 1: Basic Management UI (1-2 days)**
- [ ] Create "Relationship Types" section in Settings page
- [ ] Display current types in a table:
  - Type name (snake_case)
  - Display name (plain language)
  - Usage count (# of relationships)
  - Created date
  - Actions (Edit, Delete)
- [ ] Add new type form:
  - Name input (auto-converts to snake_case)
  - Display name (optional, defaults to formatted name)
  - Validation (unique, no spaces, lowercase)
- [ ] Edit existing types (rename, change display name)
- [ ] Delete unused types (only if count = 0)
- [ ] Store in `relationship_types` table

**Phase 2: Database Schema (1 day)**
```sql
CREATE TABLE relationship_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,           -- snake_case: "reports_to"
  display_name TEXT,                    -- plain language: "reports to"
  description TEXT,                     -- optional explanation
  is_system BOOLEAN DEFAULT false,      -- prevent deletion of core types
  usage_count INTEGER DEFAULT 0,        -- cached count
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed with existing types
INSERT INTO relationship_types (name, is_system) VALUES
  ('part_of', true),
  ('uses', true),
  ('requires', true),
  ('relates_to', true),
  ('implements', true),
  ('extends', true),
  ('depends_on', true),
  ('collaborates_with', true),
  ('manages', true),
  ('creates', true),
  ('analyzes', true),
  ('evaluates', true);

-- Remove "other" - it's unused and not useful
```

**Phase 3: Dynamic Loading in UI (1 day)**
- [ ] Load relationship types from database instead of hardcoded array
- [ ] Cache in React state/context
- [ ] Refresh when types are updated
- [ ] Show formatted display names in dropdowns
- [ ] Sort by usage count (most used first)

**Phase 4: Python Extractor Integration (Optional, 2-3 days)**
- [ ] Load relationship types from database in Python
- [ ] Use dynamic types in LLM prompt
- [ ] Fall back to core types if database unavailable
- [ ] Sync mechanism to keep Python and DB in sync

**UI Design - Settings Page:**
```
┌─────────────────────────────────────────────┐
│ Settings > Relationship Types               │
├─────────────────────────────────────────────┤
│ [+ Add New Type]                            │
├─────────────────────────────────────────────┤
│ Type Name       Display      Used   Actions │
├─────────────────────────────────────────────┤
│ relates_to      relates to   33    [Edit]   │
│ part_of         part of      20    [Edit]   │
│ uses            uses         15    [Edit]   │
│ requires        requires     15    [Edit]   │
│ creates         creates      12    [Edit]   │
│ manages         manages      9     [Edit]   │
│ analyzes        analyzes     8     [Edit]   │
│ ...                                          │
│ custom_type     custom type  0     [Delete] │
└─────────────────────────────────────────────┘
```

**Benefits:**
- ✅ Domain-specific relationship types
- ✅ No code changes needed
- ✅ Centralized management
- ✅ Consistent across UI and extraction
- ✅ Can remove unused types
- ✅ Usage statistics visible
- ✅ Protected system types

**Technical Considerations:**
- Need migration to create table and seed data
- UI dropdown needs to fetch types dynamically
- Cache types to avoid repeated queries
- Validate type names (snake_case, unique)
- Prevent deletion of types in use
- Consider type versioning/history
- May need RLS policies for multi-tenant

**API Endpoints:**
```typescript
GET /api/settings/relationship-types
POST /api/settings/relationship-types
PATCH /api/settings/relationship-types/:id
DELETE /api/settings/relationship-types/:id
```

**Priority:** Medium (Nice-to-have, not blocking)

**Estimated Effort:** 3-4 days (Phases 1-3)

---

### Chat Session Persistence & History
**Priority:** High  
**Effort:** 3-5 days  
**Phase:** 6.5.3 - Conversation Features
 
### Custom Relationship Types Management
**Context:** Relationship types are currently hardcoded in both the Python extractor and the UI. Users cannot add custom relationship types specific to their domain without code changes.

**Current State:**
- 13 predefined types: `part_of`, `uses`, `requires`, `relates_to`, `implements`, `extends`, `depends_on`, `collaborates_with`, `manages`, `creates`, `analyzes`, `evaluates`, `other`
- Defined in Python enum (`graph_extractor.py`)
- Duplicated in UI dropdown (`relationships-card.tsx`)
- "other" type exists but is unused (0 instances in database)

**Problem:**
- Cannot add domain-specific relationship types (e.g., "funds", "reports_to", "supersedes")
- No way to remove unused types
- Changes require code deployment
- Python extractor and UI can get out of sync

**Proposed Solution: Settings Page for Relationship Types**

**Phase 1: Basic Management UI (1-2 days)**
- [ ] Create "Relationship Types" section in Settings page
- [ ] Display current types in a table:
  - Type name (snake_case)
  - Display name (plain language)
  - Usage count (# of relationships)
  - Created date
  - Actions (Edit, Delete)
- [ ] Add new type form:
  - Name input (auto-converts to snake_case)
  - Display name (optional, defaults to formatted name)
  - Validation (unique, no spaces, lowercase)
- [ ] Edit existing types (rename, change display name)
- [ ] Delete unused types (only if count = 0)
- [ ] Store in `relationship_types` table

**Phase 2: Database Schema (1 day)**
```sql
CREATE TABLE relationship_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,           -- snake_case: "reports_to"
  display_name TEXT,                    -- plain language: "reports to"
  description TEXT,                     -- optional explanation
  is_system BOOLEAN DEFAULT false,      -- prevent deletion of core types
  usage_count INTEGER DEFAULT 0,        -- cached count
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed with existing types
INSERT INTO relationship_types (name, is_system) VALUES
  ('part_of', true),
  ('uses', true),
  ('requires', true),
  ('relates_to', true),
  ('implements', true),
  ('extends', true),
  ('depends_on', true),
  ('collaborates_with', true),
  ('manages', true),
  ('creates', true),
  ('analyzes', true),
  ('evaluates', true);

-- Remove "other" - it's unused and not useful
```

**Phase 3: Dynamic Loading in UI (1 day)**
- [ ] Load relationship types from database instead of hardcoded array
- [ ] Cache in React state/context
- [ ] Refresh when types are updated
- [ ] Show formatted display names in dropdowns
- [ ] Sort by usage count (most used first)

**Phase 4: Python Extractor Integration (Optional, 2-3 days)**
- [ ] Load relationship types from database in Python
- [ ] Use dynamic types in LLM prompt
- [ ] Fall back to core types if database unavailable
- [ ] Sync mechanism to keep Python and DB in sync

**UI Design - Settings Page:**
```
┌─────────────────────────────────────────────┐
│ Settings > Relationship Types               │
├─────────────────────────────────────────────┤
│ [+ Add New Type]                            │
├─────────────────────────────────────────────┤
│ Type Name       Display      Used   Actions │
├─────────────────────────────────────────────┤
│ relates_to      relates to   33    [Edit]   │
│ part_of         part of      20    [Edit]   │
│ uses            uses         15    [Edit]   │
│ requires        requires     15    [Edit]   │
│ creates         creates      12    [Edit]   │
│ manages         manages      9     [Edit]   │
│ analyzes        analyzes     8     [Edit]   │
│ ...                                          │
│ custom_type     custom type  0     [Delete] │
└─────────────────────────────────────────────┘
```

**Benefits:**
- ✅ Domain-specific relationship types
- ✅ No code changes needed
- ✅ Centralized management
- ✅ Consistent across UI and extraction
- ✅ Can remove unused types
- ✅ Usage statistics visible
- ✅ Protected system types

**Technical Considerations:**
- Need migration to create table and seed data
- UI dropdown needs to fetch types dynamically
- Cache types to avoid repeated queries
- Validate type names (snake_case, unique)
- Prevent deletion of types in use
- Consider type versioning/history
- May need RLS policies for multi-tenant

**API Endpoints:**
```typescript
GET /api/settings/relationship-types
POST /api/settings/relationship-types
PATCH /api/settings/relationship-types/:id
DELETE /api/settings/relationship-types/:id
```

**Priority:** Medium (Nice-to-have, not blocking)

**Estimated Effort:** 3-4 days (Phases 1-3)

---

### Entity Source Document & Chunk References
**Context:** Entity pages currently show basic metadata (confidence, document count, chunk count) but don't provide direct access to the source material where entities were mentioned. Users cannot easily verify entity information or explore the original context.

**Problem:**
- Entity pages show document/chunk counts but no links to actual documents
- No way to see which specific documents mention an entity
- Cannot navigate from entity to the chunks where it was extracted
- Difficult to verify or validate entity information
- Missing connection between graph entities and source material

**Proposed Solution:**

**Part 1: Document List on Entity Page (1-2 days)**
- [ ] Add "Source Documents" section to entity details page
- [ ] Display list of documents where entity is mentioned:
  - Document title (clickable link)
  - Document type/category
  - Number of mentions in that document
  - Extraction confidence for that document
  - Date added
- [ ] Sort by: relevance, date, mention count
- [ ] Filter by document type
- [ ] Show preview snippet of entity mention on hover

**Part 2: Chunk-Level References with Docling Integration (2-3 days)**
- [ ] Add "Mentions" or "Context" section showing specific chunks
- [ ] For each chunk reference:
  - Link to the specific chunk in Docling document viewer
  - Show chunk content with entity highlighted
  - Display surrounding context (previous/next chunks)
  - Show page number and location in original document
  - Include extraction confidence for that mention
- [ ] Deep linking: `/documents/:docId/chunks/:chunkId`
- [ ] Highlight entity mentions within chunk text
- [ ] Navigate between mentions (previous/next)

**Part 3: Docling Document Viewer Integration (2-3 days)**
- [ ] Create document viewer using Docling's rendering capabilities
- [ ] Display original document structure (headings, tables, images)
- [ ] Highlight entity mentions throughout document
- [ ] Jump to specific chunk/page from entity page
- [ ] Show all entities extracted from current view
- [ ] Side panel with entity graph for current document

**UI Design:**
```
┌─────────────────────────────────────────────┐
│ Entity: Strategic Design Approaches         │
│ [Edit] [Delete]                             │
├─────────────────────────────────────────────┤
│ Information (33%)  │  Relationships (66%)   │
├────────────────────┴────────────────────────┤
│ Source Documents (4)                        │
│ ┌─────────────────────────────────────────┐ │
│ │ 📄 SDA Methodologies Guide              │ │
│ │    12 mentions • High confidence        │ │
│ │    Added Oct 17, 2025                   │ │
│ └─────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────┐ │
│ │ 📄 Strategic Planning Overview          │ │
│ │    8 mentions • Medium confidence       │ │
│ │    Added Oct 15, 2025                   │ │
│ └─────────────────────────────────────────┘ │
├─────────────────────────────────────────────┤
│ Context & Mentions (20)                     │
│ ┌─────────────────────────────────────────┐ │
│ │ "...Strategic Design Approaches is a    │ │
│ │  comprehensive framework..."            │ │
│ │  📄 SDA Guide • Page 3 • Chunk 12       │ │
│ │  [View in Document →]                   │ │
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

**Benefits:**
- ✅ Easy verification of entity information
- ✅ Direct access to source material
- ✅ Better understanding of entity context
- ✅ Improved trust in extracted data
- ✅ Seamless navigation: entity → document → chunk
- ✅ Enhanced document exploration
- ✅ Visual document rendering with Docling

**Technical Considerations:**
- Need to query documents table with entity.document_ids
- Chunk references already stored in entity.chunk_ids
- Docling document viewer may need separate component
- Consider pagination for entities with many mentions
- Deep linking requires document/chunk routing
- May need to cache Docling rendered documents
- Highlight logic needs to handle entity name variations

**Database Queries:**
```typescript
// Get documents for entity
const { data: documents } = await supabase
  .from('documents')
  .select('*')
  .in('id', entity.document_ids);

// Get chunks for entity with document info
const { data: chunks } = await supabase
  .from('chunks')
  .select('*, document:documents(*)')
  .in('id', entity.chunk_ids)
  .order('document_id', 'chunk_index');
```

**Priority:** High (Core feature for entity validation and exploration)

**Estimated Effort:** 5-8 days total (all three parts)

---

### Prompt Management System
**Context:** Currently, prompts are hardcoded throughout the platform (chunk summarization, graph extraction, HyDE generation, multi-query, etc.). Changes require code deployments.

**Proposal - Phase 1: Prompt Settings Page**
- Create a dedicated settings page for managing all system prompts
- Store prompts in `system_settings` table (similar to current LLM settings)
- Categories: `prompts.chunkSummary`, `prompts.graphExtraction`, `prompts.hyde`, `prompts.multiQuery`, etc.
- Allow real-time editing and testing without code changes
- Version tracking for prompt changes

**Proposal - Phase 2: Automated Prompt Optimization**
- Build an A/B testing framework for prompts
- Continuously test prompt variations against control
- Track metrics: quality scores, latency, token usage, user satisfaction
- Statistical significance testing before promoting winners
- Automated rollback if performance degrades
- Prompt version history and analytics dashboard

**Benefits:**
- Faster iteration on prompt quality
- Data-driven prompt improvements
- No code deployments for prompt tweaks
- Reduced engineering bottleneck
- Continuous quality improvement

**Technical Considerations:**
- Need evaluation metrics for each prompt type
- Require test datasets for automated testing
- Consider cost implications of parallel testing
- May need dedicated prompt optimization service

**Priority:** Medium (Phase 1), Low (Phase 2 - future enhancement)

### Entity Deduplication & Merge Assistant
**Context:** Graph extraction creates duplicate entities due to name variations, typos, abbreviations, and context differences. Currently, users must manually identify and merge duplicates. This creates graph pollution and reduces relationship quality.

**Problem Examples:**
- "CCAAAPPI" vs "CCAAPPI" (typo)
- "Strategic Design Approaches" vs "SDA" (abbreviation)
- "Opportunity Analysis" vs "OA" vs "Opportunity Assessment" (variations)
- "AI applications" vs "Artificial Intelligence applications" (synonym)
- Multiple extractions of same entity from different documents

**Current State:**
- Chat conversations exist only in browser memory
- Refreshing the page clears all conversation history
- No way to revisit or continue previous conversations
- Users lose context when navigating away

**Required Implementation:**
1. **Database Schema:**
   - `chat_sessions` table: session metadata (title, created_at, updated_at, user_id)
   - `chat_messages` table: individual messages (session_id, role, content, sources, timestamp)
   - Auto-generate session titles from first message or conversation summary

2. **Session Management:**
   - Create new session on first message
   - Save each message (user + assistant) to database
   - Load session history when revisiting
   - List all user's sessions with preview/search
   - Delete/archive old sessions

3. **UI Components:**
   - Session sidebar/dropdown to switch between conversations
   - "New Chat" button to start fresh session
   - Session list with timestamps and previews
   - Search across all sessions
   - Export conversation functionality

4. **Conversation Continuity:**
   - Load full conversation history when opening session
   - Apply 10-turn limit only to what's sent to LLM (not what's displayed)
   - Show full conversation in UI, but send limited context to API
   - Preserve source citations and metadata

5. **Performance Considerations:**
   - Paginate long conversations
   - Lazy load old messages
   - Index sessions by user_id and timestamp
   - Consider conversation summarization for very long threads

**Benefits:**
- Users can return to conversations anytime
- Build knowledge over multiple sessions
- Reference previous answers
- Share conversation links (optional)
- Track conversation quality over time

**Related:**
- Phase 6.5.2: Context window management (conversation summarization)
- Phase 6.5.4: Analytics (track conversation metrics)

**Notes:**
- This is a critical feature for production use
- Without persistence, chat is just a demo
- Consider privacy/data retention policies
- May want conversation sharing/collaboration features later

---

## 🐛 Bugs & Issues

### Document Processing Resilience: Page-Level Checkpointing
**Context:** Large document processing (200+ pages) is vulnerable to failures that require complete restart, wasting time and API costs.

**Current State:**
- Document pages processed in parallel (10-15 workers)
- All results held in memory until completion
- If processing fails at any stage → restart from scratch
- Re-process all pages (re-pay for all OpenAI VLM API calls)
- No incremental progress saved

**Problem Example:**
- 216-page PDF takes ~10 minutes to process
- Failure at chunking stage (after all pages extracted)
- Must re-extract all 216 pages again
- Cost: ~$2-5 in duplicate API calls
- Time: Another 10 minutes wasted

**Current Flow (Fragile):**
```
1. Split PDF into 216 pages
2. Process all pages in parallel → [IN MEMORY]
3. Merge all results → [IN MEMORY]
4. Chunk document → [FAILURE HERE]
5. → Restart from step 1 (lose everything)
```

**Proposed Solution: Page-Level Checkpointing**

**Phase 1: Database Schema (1 day)**
```sql
CREATE TABLE page_processing_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL,
  page_content TEXT NOT NULL,
  text_elements JSONB,
  tables JSONB,
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  processing_time_ms INTEGER,
  UNIQUE(document_id, page_number)
);

CREATE INDEX idx_page_cache_document ON page_processing_cache(document_id);
```

**Phase 2: Incremental Processing (2-3 days)**
- [ ] Check cache before processing each page
- [ ] Save page results immediately after extraction
- [ ] Resume from last completed page on failure
- [ ] Merge cached pages when all complete
- [ ] Clean up cache after successful document completion
- [ ] Add cache expiration (7 days)

**Phase 3: Progress Tracking (1 day)**
- [ ] Update document status with progress percentage
- [ ] Show "Resuming from page X" in logs
- [ ] Display progress in UI: "Processing: 145/216 pages (67%)"
- [ ] Estimate time remaining based on average page time

**Improved Flow (Resilient):**
```
1. Split PDF into 216 pages
2. For each page:
   - Check if cached → skip if exists
   - Process page → save immediately to DB
   - Update progress counter
3. Merge cached pages (fast, from DB)
4. Chunk document → [FAILURE HERE]
5. → Resume: pages already cached, just re-run chunking
```

**Benefits:**
- ✅ No duplicate API costs on failure
- ✅ Resume from failure point (not from scratch)
- ✅ Progress visible in real-time
- ✅ Faster recovery from errors
- ✅ Reduced frustration for large documents
- ✅ Cache can be reused for re-processing

**Trade-offs:**
- ❌ Additional database storage (~1-2MB per page)
- ❌ More complex code (cache management)
- ❌ Need cache cleanup logic
- ❌ Slightly slower (DB writes per page)

**Technical Considerations:**
- Cache expiration: 7 days (configurable)
- Cleanup: Delete cache after successful completion
- Invalidation: Clear cache if document re-uploaded
- Concurrency: Handle multiple workers writing to cache
- Storage: ~200MB for 100-page document (acceptable)
- Performance: DB writes add ~50-100ms per page (minimal)

**Alternative: Document-Level Caching**
Instead of page-level, cache the full Docling result:
- Simpler implementation
- All-or-nothing (less granular)
- Still saves API costs on chunking failures
- Easier to implement as Phase 1

**Priority:** Medium-High (Quality of life improvement, cost savings)

**Estimated Effort:** 
- Phase 1 (Document-level cache): 1-2 days
- Phase 2 (Page-level cache): 3-4 days
- Phase 3 (Progress tracking): 1 day

**When to Implement:**
- After completing chunking improvements (Phase 1-2)
- Before scaling to production (prevents cost blowup)
- Consider document-level caching as quick win first

---

*No other bugs pending*

---

## ✅ Recently Completed

### Moved to BUILD_PLAN.md (October 19, 2025 - Evening)
- **Adaptive Response Depth & Retrieval Matching** → Phase 6.5 Enhancements
  - Quick/Standard/Detailed response modes
  - Deep Research Mode with CrewAI + o4-mini-deep-research
- **Kibo UI Component Library Evaluation** → Phase 12: Polish & Production Readiness

### Moved to BUILD_PLAN.md (October 19, 2025 - Morning)
All major enhancement proposals migrated to **Phase 10: Advanced Graph & Document Intelligence**:

1. **Entity Deduplication & Merge Assistant** → Phase 10.1 (High Priority, 1-2 weeks)
   - Manual merge workflow
   - Automated duplicate detection
   - AI-assisted merge intelligence

2. **Generic Entity Detection & Cleanup** → Phase 10.2 (Medium Priority, 3-4 days)
   - Detection & flagging of generic entities
   - Review & cleanup UI

3. **Document Organization System** → Phase 10.3 (Medium-High Priority, 1-2 weeks)
   - Folder/subfolder hierarchy
   - Tagging system
   - AI-powered organization suggestions

4. **Document-Level Intelligence & Graph Integration** → Phase 10.4 (High Priority, 2-3 weeks)
   - Document summarization & metadata
   - Auto-tagging from content
   - Documents as graph entities
   - Staleness detection & freshness tracking
   - Document clustering & discovery

5. **Temporal Data Management & Versioning** → Phase 10.5 (Medium-High Priority, 1 week)
   - Basic temporal metadata
   - Document versioning
   - Temporal search weighting

6. **Intelligent Source Discovery** → Phase 10.6 (Medium-High Priority, 1-2 weeks)
   - Knowledge gap analysis
   - Web source discovery
   - Automated source ingestion

7. **Adaptive Chunk Quality Enhancement** → Phase 10.7 (Medium-High Priority, 1-2 weeks)
   - Automatic quality detection
   - Selective LLM post-processing
   - On-demand re-chunking UI

8. **OCR Cleanup Pre-Processing** → Phase 10.8 (Medium Priority, 1 week)
   - Scanned document detection
   - Conservative OCR cleanup
   - Verification & rollback
   - UI & user control

9. **Prompt Management System** → Phase 10.9 (Medium Priority, 1 week)
   - Prompt settings page
   - Database-driven prompt management
   - Version tracking

### Moved to BUILD_PLAN.md (October 17, 2025)
- **Living Entities** → Phase 9 (4-6 weeks)
  - Template-based entity pages
  - CrewAI update crew
  - UI components
  - Integration with ingestion pipeline

### Previous Moves (October 17, 2025)
- **Entity & Relationship Description Synthesis** → Phase 5.7: Enterprise Graph Architecture
- **Corpus-Level Entity Management** → Phase 5.4: Graph Management UI (approach chosen)
- **Two-Level Graph Architecture** → Phase 5.7: Enterprise Graph Architecture  
- **Hierarchical Graph Traversal** → Phase 6 Enhancements

### Previous Moves (October 16, 2025)
- **HyDE Query Enhancement Tuning** → Phase 6 Enhancements (Medium Priority)
- **Graph Extractor Entity Quality Improvement** → Phase 6 Enhancements (Medium Priority)
- **PGMQ Queue State Corruption Fix** → Phase 6 Enhancements (High Priority)

### Previous Migrations (January 16, 2025)
- **Docling Native Chunking (HybridChunker)** → Phase 4 enhancement
- **OpenAI API Timeout Handling** → Phase 3 improvements
- Frontend Display Issues → TO_PROCESS.md
- Infrastructure Cleanup → TO_PROCESS.md
- Advanced RAG Patterns → TO_PROCESS.md
- Operational Decisions → TO_PROCESS.md

### Already Implemented (Removed from INBOX)
- Docling with VLM ✅ Deployed and working
- Parallel Page Processing ✅ Implemented in Docling processor

---

## How to Use This File

When new ideas or enhancements come up:

1. **Add them here first** - Quick capture without overthinking
2. **Run /cleanup workflow** - Periodically move items to BUILD_PLAN or TO_PROCESS
3. **Keep it clean** - INBOX should be empty or near-empty most of the time

---

*Last cleaned: October 19, 2025 (Evening)*
