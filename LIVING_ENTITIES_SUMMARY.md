# Living Entities: The Killer Feature

**Created:** 2025-10-29  
**Status:** Documented, Not Yet Implemented  
**Priority:** HIGH - This is what makes "Mosaic for X" truly powerful

---

## 🎯 **What Are Living Entities?**

**Living Entities** are continuously-updated, structured knowledge pages that serve as the **single source of truth** for critical domain entities. They transform Mosaic from "smart search" to "living knowledge base."

### **The Big Idea:**

When a user asks: *"I'm about to make a purchasing decision on 40 tons of Antimony, what do I need to know?"*

Instead of just search results, they get:
1. **A comprehensive Antimony page** with all relevant information in structured sections
2. **Inline links to related entities** (suppliers, mines, technologies, regulations)
3. **Contextual AI chat** grounded in the entity's knowledge
4. **Always current** - updated automatically as new information arrives

---

## 🔥 **Why This Is Revolutionary**

### **Graph Entities vs. Living Entities**

**Graph Entities** (What you have now):
- ✅ Lightweight, extracted automatically
- ✅ Simple schema: name, type, description, relationships
- ✅ Purpose: Enable semantic search and relationship discovery
- ✅ Example: "Strategic Planning" entity linking documents that mention it

**Living Entities** (What this adds):
- 🚀 Rich, curated, continuously updated
- 🚀 Complex templates with 10-20+ sections per entity type
- 🚀 Purpose: Single source of truth for critical domain entities
- 🚀 Example: "Antimony" page with supply chain, pricing, geopolitics, applications, etc.

**The Relationship:**
```
Graph Entities → Identify what matters (discovery)
Living Entities → Deep, structured knowledge about what matters (intelligence)
```

---

## 📊 **Architecture Overview**

### **Database Schema**

**Core Tables:**
1. `living_entities` - Main entity pages with JSONB sections
2. `living_entity_relationships` - Bidirectional links between entities
3. `living_entity_updates` - Complete audit trail of all changes
4. `living_entity_graph_links` - Links to graph entities

### **Template System**

Each entity type has a structured template:

```typescript
MaterialTemplate = {
  entity_type: 'material',
  sections: [
    'overview',           // Summary, chemical properties, criticality
    'supply_chain',       // Global production, major producers
    'pricing',            // Current prices, market trends
    'geopolitical_risk',  // Political risks, export controls
    'applications',       // Primary uses, industries
    'alternatives',       // Substitute materials
    'recent_developments' // Timeline of news/updates
  ]
}
```

### **CrewAI Update System**

**5 Specialized Agents:**
1. **Identifier Agent** - Which entities should be updated?
2. **Extractor Agent** - Pull structured info from content
3. **Synthesizer Agent** - Merge with existing content (no duplication)
4. **Linker Agent** - Create relationships between entities
5. **Validator Agent** - Ensure quality and accuracy

---

## 🎬 **Example: News Article Processing**

**Input:**
> "MP Materials announced a major supply agreement with the Defense Logistics Agency to provide Antimony for F-35 fighter jet production. The material will be sourced from their newly expanded Arizona mining operation, with deliveries beginning in Q2 2025."

**CrewAI Processing:**

1. **Identifier** finds 5 affected entities:
   - `antimony` (confidence: 0.95)
   - `mp-materials` (confidence: 0.95)
   - `defense-logistics-agency` (confidence: 0.90)
   - `f-35` (confidence: 0.85)
   - `arizona-mine` (confidence: 0.80)

2. **Extractor** pulls structured data:
   - For `antimony`: Add to recent_developments, update supply_chain
   - For `mp-materials`: Add to recent_activity
   - For `arizona-mine`: Update production data

3. **Synthesizer** merges with existing content:
   - Adds new timeline entry to `antimony.recent_developments`
   - Updates supplier list in `antimony.supply_chain`
   - No duplication of existing information

4. **Linker** creates relationships:
   - `mp-materials` → `produces` → `antimony`
   - `arizona-mine` → `produces` → `antimony`
   - `mp-materials` → `supplies` → `defense-logistics-agency`
   - `antimony` → `used_in` → `f-35`

5. **Validator** approves:
   - Factual accuracy: ✅ Pass
   - Source credibility: ✅ Pass
   - Schema compliance: ✅ Pass
   - Quality: ✅ Approved

**Result:** 5 entity pages updated, 4 relationships created, all with full audit trail

---

## 🏗️ **Implementation Status**

### **✅ What's Documented:**
- Complete architecture (database schema, templates, data model)
- CrewAI agent system (5 agents with detailed specs)
- Update workflow (end-to-end processing)
- UI components (planned)
- Implementation guide (step-by-step)

### **❌ What's Not Yet Built:**
- Database tables (need migrations)
- Template registry (TypeScript/Python)
- CrewAI agents (need implementation)
- Update workflow (need integration)
- UI components (need frontend)

---

## 🎯 **Use Cases by Domain**

### **Strategic Materials Platform** (Your Primary Use Case)
**Living Entity Types:**
- **Materials**: Lithium, Antimony, Rare Earths (80+ entities)
- **Mines**: Specific mining operations worldwide
- **Suppliers**: Companies in the supply chain
- **Technologies**: Applications and use cases
- **Agencies**: Government bodies and regulators

**User Workflow:**
1. Navigate to "Antimony" living entity page
2. See comprehensive, up-to-date information
3. Click link to "MP Materials" (major supplier)
4. Click link to "Arizona Mine" (production details)
5. Ask AI: "What are the geopolitical risks?"
6. Get grounded answer based on entity's knowledge

### **Nuclear Cybersecurity Platform**
- **Threat Actors**, **Vulnerabilities**, **Assets**, **Incidents**, **Mitigations**

### **Veteran Services Platform**
- **Individuals**, **Programs**, **Facilities**, **Risk Factors**, **Protective Factors**

---

## 💡 **How This Relates to Multi-Floor Architecture**

Living Entities would be **Floor D** in the multi-floor system:

```
Floor D (Living Entities) ← Curated, structured knowledge
    ↕ bridges
Floor B (Graph Entities)  ← Lightweight, extracted entities
    ↕ bridges
Floor A (Chunks)          ← Raw text
```

**The Flow:**
1. Documents → Chunks (Floor A)
2. Chunks → Graph Entities (Floor B) - automatic extraction
3. Graph Entities → Living Entities (Floor D) - CrewAI synthesis
4. Users navigate all floors via bridges

---

## 🚀 **Implementation Priority**

### **Recommended Sequence:**

1. **First: Multi-Floor Architecture** (3-5 days)
   - Get floor bridges working
   - Enable multi-hop traversal
   - Foundation for everything else

2. **Second: DEG-RAG** (1-2 weeks)
   - Clean up graph entities
   - Improve entity/relationship quality
   - Better foundation for Living Entities

3. **Third: Living Entities** (2-3 weeks)
   - Database schema and migrations
   - Template system
   - CrewAI agents
   - Update workflow
   - Basic UI

**Why This Order?**
- Multi-floor gives you the architecture
- DEG-RAG gives you clean graph entities
- Living Entities builds on both

---

## 📝 **Key Files to Review**

**Documentation:**
- `docs/living_entities/README.md` - Overview and concept
- `docs/living_entities/01_architecture.md` - Database schema and templates
- `docs/living_entities/02_crewai_agents.md` - AI agent system
- `docs/living_entities/03_update_workflow.md` - End-to-end workflow

**Not Yet Created:**
- Database migrations
- Template registry code
- CrewAI agent implementations
- Update workflow code
- UI components

---

## 🎓 **Key Insights**

### **This Is What Makes "Mosaic for X" Work**

Living Entities are the **differentiator** that makes Mosaic valuable for domain-specific platforms:

1. **Not just search** - Structured, comprehensive knowledge pages
2. **Not just RAG** - Continuously updated, never stale
3. **Not just graph** - Rich templates, not just name/description
4. **Not just AI** - Human-readable, navigable, explorable

### **The Value Proposition**

For a Strategic Materials platform:
- **Without Living Entities:** "Here are 50 documents mentioning Antimony"
- **With Living Entities:** "Here's everything you need to know about Antimony, always current, structured for decision-making"

That's the difference between a search engine and a knowledge platform.

---

## 🔧 **Integration Points**

### **With Existing Mosaic:**

1. **Document Processing Pipeline:**
   ```python
   # After standard processing
   async def process_document(doc_id):
       chunks = await chunk_document(doc_id)
       embeddings = await generate_embeddings(chunks)
       graph_entities = await extract_entities(chunks)
       
       # NEW: Trigger living entity update
       await trigger_living_entity_update(doc_id, 'document')
   ```

2. **Graph Entities:**
   - Living entities link to graph entities
   - Graph entities can "promote" to living entities
   - Bidirectional relationship

3. **Search:**
   - Search can return living entity pages
   - Living entities have their own search index
   - Contextual AI chat per entity

---

## 📊 **Expected Impact**

### **For Users:**
- **10x better decision-making** - All info in one place
- **Always current** - No stale knowledge
- **Explorable** - Navigate entity relationships
- **Trustworthy** - Full audit trail and sources

### **For Platform:**
- **Differentiation** - Not just another RAG tool
- **Stickiness** - Users rely on living entities
- **Scalability** - Handles thousands of entities
- **Extensibility** - Easy to add new entity types

---

## 🎯 **Bottom Line**

**Living Entities are THE killer feature that transforms Mosaic from:**
- "Smart document search" 
- **INTO** 
- "Living knowledge platform for expert decision-making"

**This is what makes "Mosaic for X" (Strategic Materials, Nuclear Cybersecurity, Veteran Services, etc.) truly valuable.**

It's not just about finding information - it's about **maintaining comprehensive, up-to-date, structured knowledge** about the entities that matter most in your domain.

---

**Status:** Fully documented, ready to implement after multi-floor + DEG-RAG  
**Priority:** HIGH - This is the vision  
**Timeline:** 2-3 weeks after foundation is solid
