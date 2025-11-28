# Living Entities: The Core of Mosaic's Intelligence

## Overview

Living Entities are **continuously-updated, structured knowledge pages** that serve as the single source of truth for critical domain entities in Mosaic-based platforms. Unlike traditional static pages or simple graph entities, Living Entities evolve automatically as new information is ingested, maintaining comprehensive, up-to-date profiles for the most important entities in your domain.

## What Makes Living Entities Different

### Graph Entities vs. Living Entities

**Graph Entities** (Lightweight, extracted automatically):
- Extracted from documents during ingestion
- Simple schema: name, type, description, relationships
- Purpose: Enable semantic search and relationship discovery
- Lifecycle: Created during ingestion, merged/deduplicated
- Example: "Strategic Planning" entity linking documents that mention it

**Living Entities** (Rich, curated, continuously updated):
- Curated, structured pages with domain-specific schemas
- Complex templates with 10-20+ sections per entity type
- Purpose: Single source of truth for critical domain entities
- Lifecycle: Persistent, evolving knowledge bases updated by AI agents
- Example: "Antimony" page with supply chain, pricing, geopolitics, applications, etc.

**The Relationship:**
```
Graph Entities → Identify what matters (discovery)
Living Entities → Deep, structured knowledge about what matters (intelligence)
```

## Core Concept

When a user asks: **"I'm about to make a purchasing decision on 40 tons of Antimony, what do I need to know?"**

The platform provides:
1. **A comprehensive Antimony living entity page** with all relevant information in a structured format
2. **Inline links to related entities** (suppliers, mines, technologies, regulations)
3. **Contextual AI chat** grounded in the entity's knowledge
4. **Always current** - updated automatically as new information arrives

## Key Features

### 1. Template-Based Consistency
Every entity of the same type follows the same structure:
- All "Material" pages have the same sections (supply chain, pricing, geopolitics, etc.)
- All "Mine" pages have the same sections (location, production, ownership, etc.)
- Makes entities comparable and predictable

### 2. Automatic Updates via CrewAI
When new content is ingested (documents, news, data):
- AI agents identify affected living entities
- Extract relevant information for each entity's template
- Synthesize with existing content (no duplication)
- Create/update cross-links between entities
- Validate quality and apply updates

### 3. Automatic Cross-Linking
One piece of content can update multiple entities:
- News: "MP Materials signs Antimony deal with DLA for F-35s from Arizona mine"
- Updates: Antimony page, MP Materials page, DLA page, F-35 page, Arizona Mine page
- Creates bidirectional links between all related entities

### 4. Contextual AI Chat
Each living entity page has its own AI chat:
- Scoped to that entity's knowledge
- Grounded in the entity's sources
- Can answer specific questions about that entity
- Provides precise, cited answers

### 5. Complete Audit Trail
Every update is tracked:
- What changed (section, content)
- When it changed (timestamp)
- Why it changed (source document/news/data)
- Who changed it (AI agent or user)
- Can view entity evolution over time

## Use Cases

### Strategic Materials Platform
**Living Entity Types:**
- **Materials**: Lithium, Antimony, Rare Earths, etc. (80+ entities)
- **Mines**: Specific mining operations worldwide
- **Suppliers**: Companies in the supply chain
- **Technologies**: Applications and use cases
- **Agencies**: Government bodies and regulators

**User Workflow:**
1. User navigates to "Antimony" living entity page
2. Sees comprehensive, up-to-date information in structured sections
3. Clicks link to "MP Materials" to learn about major supplier
4. Clicks link to "Arizona Mine" to see production details
5. Asks AI: "What are the geopolitical risks for Antimony supply?"
6. Gets grounded answer based on entity's knowledge

### Nuclear Cybersecurity Platform
**Living Entity Types:**
- **Threat Actors**: APT groups, nation-states
- **Vulnerabilities**: CVEs, zero-days
- **Assets**: Control systems, facilities
- **Incidents**: Past attacks, security events
- **Mitigations**: Patches, procedures, controls

### Veteran Services Platform
**Living Entity Types:**
- **Individuals**: Veterans with risk profiles (anonymized)
- **Programs**: Intervention programs and services
- **Facilities**: VA centers, community organizations
- **Risk Factors**: PTSD, TBI, social isolation
- **Protective Factors**: Support systems, resources

## Architecture Overview

Living Entities consist of:

1. **Database Schema** - Flexible JSONB storage for template-based content
2. **Template Definitions** - Domain-specific schemas for each entity type
3. **CrewAI Update Crew** - Multi-agent system for automatic updates
4. **UI Components** - Rich, interactive entity pages
5. **API Endpoints** - CRUD operations and search

## Documentation Structure

This directory contains detailed documentation for implementing Living Entities:

- **`01_architecture.md`** - Database schema, templates, and data model
- **`02_crewai_agents.md`** - AI agents that update living entities
- **`03_update_workflow.md`** - How content flows from ingestion to entity updates
- **`04_ui_components.md`** - Frontend components for entity pages
- **`05_implementation_guide.md`** - Step-by-step implementation plan

## Quick Start

To implement Living Entities in your Mosaic-based platform:

1. **Define your entity types** - What are the critical entities in your domain?
2. **Design templates** - What sections should each entity type have?
3. **Set up database schema** - Create tables for living entities
4. **Build CrewAI update crew** - Configure agents to update entities
5. **Create UI components** - Build entity page templates
6. **Connect to ingestion pipeline** - Trigger updates when new content arrives

## Benefits

### For Users
- **Single source of truth** for any entity
- **Always up-to-date** without manual curation
- **Structured, comparable** information across entities
- **Deep exploration** via entity links
- **Grounded AI answers** scoped to entity context

### For Platform Builders
- **Scalable** - Handles thousands of entities automatically
- **Extensible** - Easy to add new entity types
- **Maintainable** - AI handles updates, not manual curation
- **Auditable** - Complete history of all changes
- **Flexible** - Templates adapt to domain needs

## This Is The Killer Feature

Living Entities transform Mosaic from "smart search" to "living knowledge base." They are what make "Mosaic for X" truly powerful for any domain where expert decision-making creates value.

---

**Next:** Read `01_architecture.md` to understand the database schema and template system.
