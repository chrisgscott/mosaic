-- Add schema management settings for entity and relationship types
-- These settings control the allowed types during graph extraction

INSERT INTO system_settings (key, value, description, category) VALUES
  (
    'schema.entityTypes',
    '[
      {"name": "Person", "description": "Individual people, including names, roles, and personal identifiers"},
      {"name": "Organization", "description": "Companies, agencies, institutions, and other organized groups"},
      {"name": "Location", "description": "Geographic places, facilities, and spatial locations"},
      {"name": "Technology", "description": "Software, hardware, systems, platforms, and technical tools"},
      {"name": "Product", "description": "Commercial products, services, and offerings"},
      {"name": "Project", "description": "Initiatives, programs, and structured efforts"},
      {"name": "Document", "description": "Written materials, reports, and documentation"},
      {"name": "Event", "description": "Meetings, conferences, and time-based occurrences"},
      {"name": "Concept", "description": "Abstract ideas, methodologies, and principles"},
      {"name": "Date", "description": "Time references, deadlines, and temporal markers"}
    ]',
    'Allowed entity types during graph extraction. Each type has a name and description.',
    'schema'
  ),
  (
    'schema.relationshipTypes',
    '[
      {"name": "works_for", "description": "Employment or affiliation relationship", "direction": "Person → Organization"},
      {"name": "located_in", "description": "Geographic or spatial location", "direction": "Entity → Location"},
      {"name": "uses", "description": "Technology or tool usage", "direction": "Person/Organization → Technology"},
      {"name": "part_of", "description": "Component or membership relationship", "direction": "Part → Whole"},
      {"name": "manages", "description": "Management or oversight relationship", "direction": "Person → Organization/Project"},
      {"name": "creates", "description": "Creation or production relationship", "direction": "Person/Organization → Product/Document"},
      {"name": "related_to", "description": "General association or connection", "direction": "Entity ↔ Entity"},
      {"name": "precedes", "description": "Temporal or sequential relationship", "direction": "Event → Event"},
      {"name": "implements", "description": "Implementation or adoption relationship", "direction": "Organization → Technology/Concept"},
      {"name": "collaborates_with", "description": "Partnership or cooperation", "direction": "Entity ↔ Entity"}
    ]',
    'Allowed relationship types during graph extraction. Each type has name, description, and typical direction.',
    'schema'
  ),
  (
    'schema.enforceWhitelist',
    'true',
    'Whether to enforce the whitelist during extraction. If false, unknown types will be logged but allowed.',
    'schema'
  ),
  (
    'schema.logUnknownTypes',
    'true',
    'Whether to log entity/relationship types that are not in the whitelist for review.',
    'schema'
  )
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  updated_at = NOW();

-- Add comment explaining the schema category
COMMENT ON COLUMN system_settings.category IS 'Setting category: llm (models), search (RAG), processing (documents), prompts (system prompts), schema (graph structure)';
