# CrewAI Agents for Living Entity Updates

## Overview

Living Entities are automatically updated by a multi-agent CrewAI system that processes new content (documents, news, data) and extracts relevant information to update entity pages. The system consists of 5 specialized agents working together in a coordinated workflow.

## The Update Crew

### Agent 1: Entity Identifier Agent

**Role:** Identify which living entity pages should be updated based on new content

**Goal:** Accurately identify all living entities mentioned or affected by new content

**Backstory:**
```
You are an expert at recognizing when new information is relevant to specific entities 
in our knowledge base. You understand the domain deeply and can identify both direct 
mentions (explicit entity names) and indirect relevance (implications for entities not 
directly mentioned). You're conservative but thorough - you don't want to miss important 
updates, but you also don't want to create noise with irrelevant updates.
```

**Tools:**
- `search_living_entities` - Search existing living entities by name/type
- `search_graph_entities` - Search graph entities for potential matches
- `semantic_similarity` - Calculate similarity between content and entities
- `get_entity_aliases` - Get all known aliases for entities

**Example Task:**
```python
identifier_task = Task(
    description="""
    Analyze this news article and identify which living entities should be updated:
    
    Article: "MP Materials announced a major supply agreement with the Defense Logistics 
    Agency to provide Antimony for F-35 fighter jet production. The material will be 
    sourced from their newly expanded Arizona mining operation, with deliveries beginning 
    in Q2 2025."
    
    Identify:
    1. All living entities explicitly mentioned
    2. Living entities implicitly affected
    3. Confidence score for each (0-1)
    """,
    expected_output="""
    List of living entity slugs with confidence scores:
    - antimony (confidence: 0.95, reason: "primary subject")
    - mp-materials (confidence: 0.95, reason: "supplier mentioned")
    - defense-logistics-agency (confidence: 0.90, reason: "buyer mentioned")
    - f-35 (confidence: 0.85, reason: "end-use application")
    - arizona-mine (confidence: 0.80, reason: "source location")
    """,
    agent=identifier_agent
)
```

### Agent 2: Information Extractor Agent

**Role:** Extract specific information from content that fits entity page templates

**Goal:** Pull out structured, relevant information for each section of affected entity pages

**Backstory:**
```
You are an expert at reading documents and extracting structured information that fits 
into predefined templates. You understand the schema for each entity type and know 
exactly which pieces of information belong in which sections. You're precise and 
thorough - you extract all relevant information but don't make up or infer information 
that isn't clearly stated in the source.
```

**Tools:**
- `read_content` - Read the full content being processed
- `get_entity_template` - Get the template schema for an entity type
- `extract_structured_data` - Use LLM to extract structured data
- `validate_extraction` - Validate extracted data against schema

**Example Task:**
```python
extractor_task = Task(
    description="""
    Extract information from this content for the "antimony" living entity page.
    
    Entity Type: material
    Template Sections: overview, supply_chain, pricing, geopolitical_risk, applications, 
                       alternatives, recent_developments
    
    Content: [news article text]
    
    For each relevant section, extract:
    1. The specific information that should be added/updated
    2. The confidence score (0-1)
    3. The exact text from source (for citation)
    """,
    expected_output="""
    {
      "recent_developments": {
        "content": {
          "date": "2025-10-16",
          "title": "MP Materials Signs Major DLA Supply Agreement",
          "description": "MP Materials announced supply agreement with Defense Logistics 
                         Agency to provide Antimony for F-35 production from Arizona mine",
          "source": "Industry Weekly",
          "related_entities": ["mp-materials", "defense-logistics-agency", "f-35", "arizona-mine"]
        },
        "confidence": 0.95,
        "source_text": "MP Materials announced a major supply agreement..."
      },
      "supply_chain": {
        "content": {
          "major_suppliers": [
            {
              "name": "MP Materials",
              "source_location": "Arizona",
              "status": "active",
              "notes": "Expanded operations, Q2 2025 deliveries"
            }
          ]
        },
        "confidence": 0.90,
        "source_text": "material will be sourced from their newly expanded Arizona mining operation"
      }
    }
    """,
    agent=extractor_agent,
    context=[identifier_task]
)
```

### Agent 3: Content Synthesizer Agent

**Role:** Merge new information with existing content without duplication

**Goal:** Create coherent, non-redundant content that preserves important details

**Backstory:**
```
You are an expert at synthesizing information from multiple sources into coherent, 
non-redundant content. You can identify when new information duplicates existing 
content, when it adds new details, and when it contradicts existing information. 
You preserve the most accurate and up-to-date information while maintaining readability 
and structure. You're careful not to lose important nuances or details during synthesis.
```

**Tools:**
- `get_existing_content` - Retrieve current content from entity section
- `compare_content` - Identify similarities and differences
- `merge_content` - Intelligently merge content
- `deduplicate` - Remove redundant information
- `resolve_conflicts` - Handle contradictory information

**Example Task:**
```python
synthesizer_task = Task(
    description="""
    Synthesize new information with existing content for the "antimony" entity's 
    "recent_developments" section.
    
    Existing Content:
    [Current timeline with 5 recent developments]
    
    New Content:
    {
      "date": "2025-10-16",
      "title": "MP Materials Signs Major DLA Supply Agreement",
      "description": "...",
      "related_entities": [...]
    }
    
    Strategy: append (add to timeline, maintain chronological order)
    
    Ensure:
    1. No duplicate entries
    2. Chronological order maintained
    3. Related entities properly linked
    4. Source attribution preserved
    """,
    expected_output="""
    {
      "timeline": [
        {
          "date": "2025-10-16",
          "title": "MP Materials Signs Major DLA Supply Agreement",
          "description": "MP Materials announced supply agreement with Defense Logistics 
                         Agency to provide Antimony for F-35 production from Arizona mine",
          "source": "Industry Weekly",
          "source_url": "https://...",
          "related_entities": ["mp-materials", "defense-logistics-agency", "f-35", "arizona-mine"]
        },
        // ... existing timeline items in chronological order
      ]
    }
    """,
    agent=synthesizer_agent,
    context=[extractor_task]
)
```

### Agent 4: Relationship Linker Agent

**Role:** Create and maintain links between related living entities

**Goal:** Build a rich network of bidirectional relationships between entities

**Backstory:**
```
You are an expert at identifying relationships between entities and creating meaningful, 
contextual links. You understand different relationship types (produces, supplies, 
regulates, competes_with, etc.) and their significance in the domain. You create 
bidirectional links so users can navigate in both directions. You provide context 
for each relationship so users understand why entities are connected.
```

**Tools:**
- `find_related_entities` - Search for entities mentioned together
- `create_relationship` - Create a new relationship link
- `update_relationship` - Update existing relationship
- `validate_relationship` - Ensure relationship makes sense

**Example Task:**
```python
linker_task = Task(
    description="""
    Create relationships between entities based on this content:
    
    "MP Materials announced supply agreement with Defense Logistics Agency to provide 
    Antimony for F-35 production from Arizona mine"
    
    Identified Entities:
    - antimony (material)
    - mp-materials (supplier)
    - defense-logistics-agency (agency)
    - f-35 (technology)
    - arizona-mine (mine)
    
    Create appropriate relationships with:
    1. Relationship type (from allowed types)
    2. Context (why they're related)
    3. Strength (0-1, how strong is the connection)
    4. Bidirectional (should it work both ways?)
    """,
    expected_output="""
    [
      {
        "source": "mp-materials",
        "target": "antimony",
        "type": "produces",
        "context": "MP Materials produces Antimony from their Arizona mine for DLA",
        "strength": 0.95,
        "bidirectional": true
      },
      {
        "source": "arizona-mine",
        "target": "antimony",
        "type": "produces",
        "context": "Arizona mine produces Antimony for F-35 production",
        "strength": 0.90,
        "bidirectional": true
      },
      {
        "source": "mp-materials",
        "target": "defense-logistics-agency",
        "type": "supplies",
        "context": "MP Materials supplies Antimony to DLA under major agreement",
        "strength": 0.95,
        "bidirectional": false
      },
      {
        "source": "antimony",
        "target": "f-35",
        "type": "used_in",
        "context": "Antimony used in F-35 fighter jet production",
        "strength": 0.85,
        "bidirectional": false
      },
      {
        "source": "mp-materials",
        "target": "arizona-mine",
        "type": "operates",
        "context": "MP Materials operates the Arizona mine",
        "strength": 0.95,
        "bidirectional": false
      }
    ]
    """,
    agent=linker_agent,
    context=[extractor_task]
)
```

### Agent 5: Quality Validator Agent

**Role:** Ensure updates maintain high quality and accuracy standards

**Goal:** Validate that updates are accurate, well-sourced, and improve the entity page

**Backstory:**
```
You are a quality control expert who validates that updates are accurate, well-sourced, 
and improve the entity page. You catch errors, inconsistencies, and low-quality 
information before it gets published. You check that sources are credible, information 
is factual, and updates follow the template schema. You're thorough but not overly 
strict - you approve good updates quickly while catching real problems.
```

**Tools:**
- `fact_check` - Verify factual claims
- `source_validation` - Check source credibility
- `consistency_check` - Ensure consistency with existing content
- `schema_validation` - Validate against template schema
- `confidence_assessment` - Assess overall confidence

**Example Task:**
```python
validator_task = Task(
    description="""
    Validate this proposed update to the "antimony" living entity page.
    
    Proposed Update:
    Section: recent_developments
    Content: [synthesized content from previous agent]
    Source: Industry Weekly news article
    Confidence: 0.95
    
    Validate:
    1. Factual accuracy (are the claims verifiable?)
    2. Source credibility (is Industry Weekly reliable?)
    3. Schema compliance (does it match the template?)
    4. Consistency (does it conflict with existing content?)
    5. Overall quality (does it improve the page?)
    
    Provide:
    - Approval status (approved/pending/rejected)
    - Confidence score (0-1)
    - Issues found (if any)
    - Recommendations (if needed)
    """,
    expected_output="""
    {
      "status": "approved",
      "confidence": 0.95,
      "issues": [],
      "validation_checks": {
        "factual_accuracy": "pass",
        "source_credibility": "pass",
        "schema_compliance": "pass",
        "consistency": "pass",
        "quality": "pass"
      },
      "recommendation": "Approve update. High-quality information from credible source."
    }
    """,
    agent=validator_agent,
    context=[synthesizer_task, linker_task]
)
```

## The Crew

### Crew Configuration

```python
from crewai import Crew, Process

living_entity_update_crew = Crew(
    agents=[
        identifier_agent,
        extractor_agent,
        synthesizer_agent,
        linker_agent,
        validator_agent
    ],
    tasks=[
        identifier_task,
        extractor_task,
        synthesizer_task,
        linker_task,
        validator_task
    ],
    process=Process.sequential,  # Execute tasks in order
    verbose=True,
    memory=True,  # Enable memory for context sharing
    cache=True    # Cache results for efficiency
)
```

### Execution

```python
async def process_new_content(content_id: str, content_type: str):
    """
    Process new content and update affected living entities.
    
    Args:
        content_id: ID of the document/news/data
        content_type: 'document', 'news', 'data'
    """
    
    # Prepare inputs for the crew
    inputs = {
        'content_id': content_id,
        'content_type': content_type,
        'organization_id': get_organization_id(),
        'timestamp': datetime.now().isoformat()
    }
    
    # Execute the crew
    result = await living_entity_update_crew.kickoff_async(inputs=inputs)
    
    # Apply approved updates
    if result.validation_status == 'approved':
        for entity_slug in result.affected_entities:
            await apply_entity_update(
                entity_slug=entity_slug,
                updates=result.entity_updates[entity_slug],
                relationships=result.relationships,
                source_id=content_id,
                source_type=content_type
            )
            
            logger.info(f"Updated living entity: {entity_slug}")
    
    return result
```

## Agent Tools

### Custom Tools for Living Entities

```python
from crewai_tools import tool

@tool("Search Living Entities")
def search_living_entities(query: str, entity_type: str = None) -> list:
    """
    Search for living entities by name or content.
    
    Args:
        query: Search query
        entity_type: Optional filter by entity type
    
    Returns:
        List of matching entities with slugs and relevance scores
    """
    # Implementation using database full-text search
    pass

@tool("Get Entity Template")
def get_entity_template(entity_type: str) -> dict:
    """
    Get the template schema for an entity type.
    
    Args:
        entity_type: Type of entity (material, mine, supplier, etc.)
    
    Returns:
        Template definition with sections and schemas
    """
    from template_registry import templateRegistry
    return templateRegistry.get(entity_type)

@tool("Extract Structured Data")
def extract_structured_data(content: str, schema: dict) -> dict:
    """
    Use LLM to extract structured data matching a schema.
    
    Args:
        content: Text content to extract from
        schema: JSON Schema defining the structure
    
    Returns:
        Extracted data matching the schema
    """
    # Implementation using OpenAI structured outputs
    pass

@tool("Get Existing Content")
def get_existing_content(entity_slug: str, section: str) -> dict:
    """
    Retrieve current content from an entity section.
    
    Args:
        entity_slug: Entity identifier
        section: Section name
    
    Returns:
        Current section content
    """
    # Implementation using database query
    pass

@tool("Create Relationship")
def create_relationship(
    source: str,
    target: str,
    relationship_type: str,
    context: str,
    strength: float = 1.0
) -> dict:
    """
    Create a relationship between two living entities.
    
    Args:
        source: Source entity slug
        target: Target entity slug
        relationship_type: Type of relationship
        context: Description of the relationship
        strength: Relationship strength (0-1)
    
    Returns:
        Created relationship object
    """
    # Implementation using database insert
    pass
```

## Monitoring & Observability

### Logging

```python
import logging

logger = logging.getLogger('living_entities.crew')

# Log all agent actions
logger.info(f"Identifier Agent found {len(entities)} affected entities")
logger.info(f"Extractor Agent extracted {len(sections)} sections")
logger.info(f"Synthesizer Agent merged content for {entity_slug}")
logger.info(f"Linker Agent created {len(relationships)} relationships")
logger.info(f"Validator Agent approved update with confidence {confidence}")
```

### Metrics

Track key metrics for monitoring:
- **Entities updated per content item** - How many entities affected
- **Update success rate** - Percentage of approved updates
- **Average confidence score** - Quality of updates
- **Processing time** - Time to process and update
- **Validation failures** - Updates rejected by validator

### Error Handling

```python
try:
    result = await living_entity_update_crew.kickoff_async(inputs=inputs)
except Exception as e:
    logger.error(f"Crew execution failed: {e}")
    # Fallback: Store for manual review
    await store_failed_update(content_id, error=str(e))
    # Notify admin
    await notify_admin(f"Living entity update failed for {content_id}")
```

---

**Next:** Read `03_update_workflow.md` to see the complete end-to-end update process.
