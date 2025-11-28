# Living Entities Architecture

## Database Schema

### Core Tables

#### `living_entities`
The main table storing all living entity pages.

```sql
CREATE TABLE living_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  
  -- Entity identification
  entity_type TEXT NOT NULL, -- 'material', 'mine', 'supplier', 'agency', 'technology'
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE, -- URL-friendly identifier
  
  -- Structured content (template-based, stored as JSONB for flexibility)
  sections JSONB NOT NULL DEFAULT '{}',
  
  -- Metadata
  last_updated TIMESTAMP DEFAULT NOW(),
  update_count INTEGER DEFAULT 0,
  source_count INTEGER DEFAULT 0,
  confidence_score FLOAT DEFAULT 0.0,
  
  -- Full-text search
  search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector('english', name || ' ' || COALESCE((sections::text), ''))
  ) STORED,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT living_entities_org_fk FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_living_entities_org ON living_entities(organization_id);
CREATE INDEX idx_living_entities_type ON living_entities(entity_type);
CREATE INDEX idx_living_entities_slug ON living_entities(slug);
CREATE INDEX idx_living_entities_search ON living_entities USING gin(search_vector);
CREATE INDEX idx_living_entities_sections ON living_entities USING gin(sections);
```

#### `living_entity_relationships`
Bidirectional links between living entities.

```sql
CREATE TABLE living_entity_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  
  source_entity_id UUID NOT NULL REFERENCES living_entities(id) ON DELETE CASCADE,
  target_entity_id UUID NOT NULL REFERENCES living_entities(id) ON DELETE CASCADE,
  
  relationship_type TEXT NOT NULL, -- 'produces', 'supplies', 'regulates', 'competes_with', 'located_in'
  context TEXT, -- "MP Materials produces Antimony at their Arizona mine"
  strength FLOAT DEFAULT 1.0, -- Relationship strength (0-1)
  
  -- Source attribution
  source_type TEXT, -- 'document', 'news', 'data', 'manual'
  source_id UUID, -- ID of document/news/data that created this relationship
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT living_entity_relationships_org_fk FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT no_self_reference CHECK (source_entity_id != target_entity_id)
);

-- Indexes
CREATE INDEX idx_living_entity_rels_source ON living_entity_relationships(source_entity_id);
CREATE INDEX idx_living_entity_rels_target ON living_entity_relationships(target_entity_id);
CREATE INDEX idx_living_entity_rels_type ON living_entity_relationships(relationship_type);
CREATE INDEX idx_living_entity_rels_org ON living_entity_relationships(organization_id);
```

#### `living_entity_updates`
Complete audit trail of all changes.

```sql
CREATE TABLE living_entity_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  entity_id UUID NOT NULL REFERENCES living_entities(id) ON DELETE CASCADE,
  
  -- What changed
  section_name TEXT NOT NULL, -- Which section was updated
  update_type TEXT NOT NULL, -- 'add', 'modify', 'remove', 'create'
  
  -- Content changes
  old_content JSONB,
  new_content JSONB,
  
  -- Source attribution
  source_type TEXT NOT NULL, -- 'document', 'news', 'data', 'manual'
  source_id UUID, -- ID of source that triggered update
  
  -- Who made the change
  updated_by TEXT NOT NULL, -- 'crewai_agent' or user_id
  agent_name TEXT, -- Specific agent if CrewAI
  
  -- Metadata
  confidence_score FLOAT,
  validation_status TEXT DEFAULT 'approved', -- 'approved', 'pending', 'rejected'
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT living_entity_updates_org_fk FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_living_entity_updates_entity ON living_entity_updates(entity_id);
CREATE INDEX idx_living_entity_updates_created ON living_entity_updates(created_at DESC);
CREATE INDEX idx_living_entity_updates_org ON living_entity_updates(organization_id);
```

#### `living_entity_graph_links`
Links between living entities and graph entities.

```sql
CREATE TABLE living_entity_graph_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  
  living_entity_id UUID NOT NULL REFERENCES living_entities(id) ON DELETE CASCADE,
  graph_entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  
  link_strength FLOAT DEFAULT 1.0, -- How strongly related (0-1)
  link_type TEXT DEFAULT 'mentions', -- 'mentions', 'describes', 'analyzes'
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT living_entity_graph_links_org_fk FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT unique_living_graph_link UNIQUE (living_entity_id, graph_entity_id)
);

-- Indexes
CREATE INDEX idx_living_graph_links_living ON living_entity_graph_links(living_entity_id);
CREATE INDEX idx_living_graph_links_graph ON living_entity_graph_links(graph_entity_id);
CREATE INDEX idx_living_graph_links_org ON living_entity_graph_links(organization_id);
```

## Template System

### Template Structure

Templates define the structure and schema for each entity type. They are defined in code (TypeScript/Python) and stored as configuration.

```typescript
interface EntityTemplate {
  entity_type: string;
  display_name: string;
  icon: string;
  sections: SectionDefinition[];
  quick_stats?: QuickStatDefinition[];
  relationships?: RelationshipTypeDefinition[];
}

interface SectionDefinition {
  key: string;
  title: string;
  description: string;
  schema: JSONSchema; // JSON Schema for validation
  update_strategy: 'replace' | 'merge' | 'append' | 'custom';
  display_component: string; // React component name
  priority: number; // Display order
  required: boolean;
}
```

### Example: Material Entity Template

```typescript
const MaterialTemplate: EntityTemplate = {
  entity_type: 'material',
  display_name: 'Strategic Material',
  icon: 'atom',
  
  sections: [
    {
      key: 'overview',
      title: 'Overview',
      description: 'High-level summary of the material',
      schema: {
        type: 'object',
        properties: {
          summary: { type: 'string' },
          chemical_symbol: { type: 'string' },
          atomic_number: { type: 'number' },
          classification: { type: 'string' },
          criticality_score: { type: 'number', minimum: 0, maximum: 10 }
        }
      },
      update_strategy: 'merge',
      display_component: 'MaterialOverview',
      priority: 1,
      required: true
    },
    {
      key: 'supply_chain',
      title: 'Supply Chain Analysis',
      description: 'Global supply chain and production data',
      schema: {
        type: 'object',
        properties: {
          global_production: { type: 'number' },
          major_producers: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                country: { type: 'string' },
                percentage: { type: 'number' },
                production_volume: { type: 'number' }
              }
            }
          },
          us_import_reliance: { type: 'number' },
          supply_risk_score: { type: 'number', minimum: 0, maximum: 10 }
        }
      },
      update_strategy: 'merge',
      display_component: 'SupplyChainAnalysis',
      priority: 2,
      required: true
    },
    {
      key: 'pricing',
      title: 'Pricing & Market Dynamics',
      description: 'Current pricing and market trends',
      schema: {
        type: 'object',
        properties: {
          current_price: { type: 'number' },
          price_unit: { type: 'string' },
          price_trend: { type: 'string', enum: ['rising', 'falling', 'stable'] },
          historical_prices: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                date: { type: 'string', format: 'date' },
                price: { type: 'number' }
              }
            }
          }
        }
      },
      update_strategy: 'merge',
      display_component: 'PricingData',
      priority: 3,
      required: true
    },
    {
      key: 'geopolitical_risk',
      title: 'Geopolitical Risk Assessment',
      description: 'Political and regulatory risks',
      schema: {
        type: 'object',
        properties: {
          risk_score: { type: 'number', minimum: 0, maximum: 10 },
          risk_factors: {
            type: 'array',
            items: { type: 'string' }
          },
          export_controls: { type: 'array', items: { type: 'string' } },
          trade_restrictions: { type: 'array', items: { type: 'string' } }
        }
      },
      update_strategy: 'merge',
      display_component: 'GeopoliticalRisk',
      priority: 4,
      required: true
    },
    {
      key: 'applications',
      title: 'Applications & Use Cases',
      description: 'Primary applications and industries',
      schema: {
        type: 'object',
        properties: {
          primary_applications: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                application: { type: 'string' },
                percentage_of_use: { type: 'number' },
                description: { type: 'string' }
              }
            }
          },
          industries: { type: 'array', items: { type: 'string' } }
        }
      },
      update_strategy: 'merge',
      display_component: 'Applications',
      priority: 5,
      required: true
    },
    {
      key: 'alternatives',
      title: 'Alternatives & Substitutes',
      description: 'Potential substitute materials',
      schema: {
        type: 'object',
        properties: {
          substitutes: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                material: { type: 'string' },
                substitution_feasibility: { type: 'string', enum: ['high', 'medium', 'low'] },
                performance_comparison: { type: 'string' },
                cost_comparison: { type: 'string' }
              }
            }
          }
        }
      },
      update_strategy: 'merge',
      display_component: 'Alternatives',
      priority: 6,
      required: false
    },
    {
      key: 'recent_developments',
      title: 'Recent Developments',
      description: 'Latest news and updates',
      schema: {
        type: 'object',
        properties: {
          timeline: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                date: { type: 'string', format: 'date-time' },
                title: { type: 'string' },
                description: { type: 'string' },
                source: { type: 'string' },
                source_url: { type: 'string', format: 'uri' },
                related_entities: { type: 'array', items: { type: 'string' } }
              }
            }
          }
        }
      },
      update_strategy: 'append', // New items added to timeline
      display_component: 'RecentDevelopments',
      priority: 7,
      required: false
    }
  ],
  
  quick_stats: [
    { key: 'global_production', label: 'Global Production', unit: 'MT/year', format: 'number' },
    { key: 'us_import_reliance', label: 'US Import Reliance', unit: '%', format: 'percentage' },
    { key: 'current_price', label: 'Current Price', unit: '$/MT', format: 'currency' },
    { key: 'risk_score', label: 'Risk Score', unit: '/10', format: 'score' }
  ],
  
  relationships: [
    { type: 'produced_by', label: 'Produced By', target_types: ['mine', 'supplier'] },
    { type: 'supplied_by', label: 'Supplied By', target_types: ['supplier'] },
    { type: 'used_in', label: 'Used In', target_types: ['technology', 'product'] },
    { type: 'regulated_by', label: 'Regulated By', target_types: ['agency'] },
    { type: 'alternative_to', label: 'Alternative To', target_types: ['material'] }
  ]
};
```

### Example: Mine Entity Template

```typescript
const MineTemplate: EntityTemplate = {
  entity_type: 'mine',
  display_name: 'Mining Operation',
  icon: 'mountain',
  
  sections: [
    {
      key: 'overview',
      title: 'Overview',
      description: 'Basic information about the mine',
      schema: {
        type: 'object',
        properties: {
          summary: { type: 'string' },
          mine_type: { type: 'string', enum: ['open_pit', 'underground', 'placer', 'in_situ'] },
          operational_status: { type: 'string', enum: ['active', 'inactive', 'planned', 'closed'] },
          established_year: { type: 'number' }
        }
      },
      update_strategy: 'merge',
      display_component: 'MineOverview',
      priority: 1,
      required: true
    },
    {
      key: 'location',
      title: 'Location & Geography',
      description: 'Geographic location and coordinates',
      schema: {
        type: 'object',
        properties: {
          country: { type: 'string' },
          region: { type: 'string' },
          coordinates: {
            type: 'object',
            properties: {
              latitude: { type: 'number' },
              longitude: { type: 'number' }
            }
          },
          nearest_city: { type: 'string' },
          distance_to_port: { type: 'number' }
        }
      },
      update_strategy: 'merge',
      display_component: 'LocationData',
      priority: 2,
      required: true
    },
    {
      key: 'production',
      title: 'Production Data',
      description: 'Output and production capacity',
      schema: {
        type: 'object',
        properties: {
          materials_produced: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                material: { type: 'string' },
                annual_production: { type: 'number' },
                unit: { type: 'string' },
                percentage_of_global: { type: 'number' }
              }
            }
          },
          production_capacity: { type: 'number' },
          capacity_utilization: { type: 'number' }
        }
      },
      update_strategy: 'merge',
      display_component: 'ProductionData',
      priority: 3,
      required: true
    },
    {
      key: 'ownership',
      title: 'Ownership & Management',
      description: 'Ownership structure and operators',
      schema: {
        type: 'object',
        properties: {
          owner: { type: 'string' },
          operator: { type: 'string' },
          ownership_percentage: { type: 'number' },
          parent_company: { type: 'string' },
          joint_venture_partners: { type: 'array', items: { type: 'string' } }
        }
      },
      update_strategy: 'merge',
      display_component: 'OwnershipStructure',
      priority: 4,
      required: true
    }
    // ... more sections
  ]
};
```

## Data Model

### TypeScript Interfaces

```typescript
interface LivingEntity {
  id: string;
  organization_id: string;
  entity_type: string;
  name: string;
  slug: string;
  sections: Record<string, any>; // Validated against template schema
  last_updated: Date;
  update_count: number;
  source_count: number;
  confidence_score: number;
  created_at: Date;
  updated_at: Date;
}

interface LivingEntityRelationship {
  id: string;
  organization_id: string;
  source_entity_id: string;
  target_entity_id: string;
  relationship_type: string;
  context: string;
  strength: number;
  source_type: string;
  source_id: string;
  created_at: Date;
  updated_at: Date;
}

interface LivingEntityUpdate {
  id: string;
  organization_id: string;
  entity_id: string;
  section_name: string;
  update_type: 'add' | 'modify' | 'remove' | 'create';
  old_content: any;
  new_content: any;
  source_type: string;
  source_id: string;
  updated_by: string;
  agent_name?: string;
  confidence_score: number;
  validation_status: 'approved' | 'pending' | 'rejected';
  created_at: Date;
}
```

## Template Registry

Templates are registered in a central registry for easy access and validation.

```typescript
class TemplateRegistry {
  private templates: Map<string, EntityTemplate> = new Map();
  
  register(template: EntityTemplate): void {
    this.templates.set(template.entity_type, template);
  }
  
  get(entity_type: string): EntityTemplate | undefined {
    return this.templates.get(entity_type);
  }
  
  validate(entity_type: string, sections: any): ValidationResult {
    const template = this.get(entity_type);
    if (!template) {
      return { valid: false, errors: ['Unknown entity type'] };
    }
    
    // Validate each section against its schema
    const errors: string[] = [];
    for (const [key, value] of Object.entries(sections)) {
      const sectionDef = template.sections.find(s => s.key === key);
      if (!sectionDef) {
        errors.push(`Unknown section: ${key}`);
        continue;
      }
      
      // Validate against JSON Schema
      const schemaErrors = validateAgainstSchema(value, sectionDef.schema);
      errors.push(...schemaErrors);
    }
    
    return { valid: errors.length === 0, errors };
  }
}

// Global registry
export const templateRegistry = new TemplateRegistry();

// Register templates
templateRegistry.register(MaterialTemplate);
templateRegistry.register(MineTemplate);
templateRegistry.register(SupplierTemplate);
// ... register all templates
```

---

**Next:** Read `02_crewai_agents.md` to learn about the AI agents that update living entities.
