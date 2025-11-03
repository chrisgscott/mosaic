"""
Graph RAG Entity and Relationship Extractor

Extracts entities and relationships from text chunks using OpenAI structured outputs.
Implements deduplication via pgvector similarity and canonical name matching.
"""

import os
import logging
import time
from typing import List, Dict, Any, Optional, Tuple, Set
from openai import OpenAI, RateLimitError
from pydantic import BaseModel, Field
from enum import Enum
from concurrent.futures import ThreadPoolExecutor, as_completed
from collections import defaultdict
import json

logger = logging.getLogger(__name__)


# ============================================================================
# SCHEMAS (Pydantic models for structured output)
# ============================================================================

class EntityType(str, Enum):
    """Entity types for classification"""
    PERSON = "person"
    ORGANIZATION = "organization"
    CONCEPT = "concept"
    METHODOLOGY = "methodology"
    FRAMEWORK = "framework"
    TOOL = "tool"
    TECHNOLOGY = "technology"
    LOCATION = "location"
    EVENT = "event"
    DOCUMENT = "document"
    OTHER = "other"


class RelationshipType(str, Enum):
    """Relationship types for classification"""
    USES = "uses"
    REQUIRES = "requires"
    RELATES_TO = "relates_to"
    PART_OF = "part_of"
    IMPLEMENTS = "implements"
    EXTENDS = "extends"
    DEPENDS_ON = "depends_on"
    COLLABORATES_WITH = "collaborates_with"
    MANAGES = "manages"
    CREATES = "creates"
    ANALYZES = "analyzes"
    EVALUATES = "evaluates"
    OTHER = "other"


class Entity(BaseModel):
    """Entity extracted from text"""
    name: str = Field(description="The name of the entity")
    type: str = Field(description="The type/category of the entity")
    description: str = Field(description="A brief description of what this entity is or represents")
    aliases: List[str] = Field(default_factory=list, description="Alternative names or acronyms for this entity")


class Relationship(BaseModel):
    """Relationship between two entities"""
    source: str = Field(description="The name of the source entity")
    target: str = Field(description="The name of the target entity")
    type: str = Field(description="The type of relationship between the entities")
    description: str = Field(description="A brief description of how these entities are related")
    bidirectional: bool = Field(default=False, description="Whether this relationship works both ways")


class ExtractionResult(BaseModel):
    """Result of entity and relationship extraction"""
    entities: List[Entity] = Field(description="List of entities found in the text")
    relationships: List[Relationship] = Field(description="List of relationships between entities")


# ============================================================================
# DYNAMIC ENUM CREATION
# ============================================================================

def create_entity_enum(entity_types: List[Dict[str, str]]) -> type:
    """
    Dynamically create EntityType enum from database settings.
    
    Args:
        entity_types: List of entity type dictionaries from database
        
    Returns:
        Enum class for entity types
    """
    # Fallback to hardcoded types if no database types
    if not entity_types:
        return EntityType
    
    # Create enum from database types
    enum_values = {}
    for entity_type in entity_types:
        name = entity_type.get('name', '').upper().replace(' ', '_')
        # Clean name to be valid Python identifier
        name = ''.join(c if c.isalnum() or c == '_' else '_' for c in name)
        enum_values[name] = entity_type.get('name', '').lower()
    
    # Add OTHER as fallback
    enum_values['OTHER'] = 'other'
    
    return Enum('EntityType', enum_values)


def create_relationship_enum(relationship_types: List[Dict[str, str]]) -> type:
    """
    Dynamically create RelationshipType enum from database settings.
    
    Args:
        relationship_types: List of relationship type dictionaries from database
        
    Returns:
        Enum class for relationship types
    """
    # Fallback to hardcoded types if no database types
    if not relationship_types:
        return RelationshipType
    
    # Create enum from database types
    enum_values = {}
    for rel_type in relationship_types:
        name = rel_type.get('name', '').upper().replace(' ', '_')
        # Clean name to be valid Python identifier
        name = ''.join(c if c.isalnum() or c == '_' else '_' for c in name)
        enum_values[name] = rel_type.get('name', '').lower()
    
    # Add OTHER as fallback
    enum_values['OTHER'] = 'other'
    
    return Enum('RelationshipType', enum_values)


# ============================================================================
# GRAPH EXTRACTOR
# ============================================================================

class GraphExtractor:
    """Extracts entities and relationships from text chunks"""
    
    def __init__(self, supabase_client, openai_api_key: Optional[str] = None, settings_service=None):
        """
        Initialize the graph extractor.
        
        Args:
            supabase_client: Supabase client for database operations
            openai_api_key: OpenAI API key (defaults to OPENAI_API_KEY env var)
            settings_service: Optional settings service for reading model configuration
        """
        self.supabase = supabase_client
        self.openai = OpenAI(api_key=openai_api_key or os.getenv("OPENAI_API_KEY"))
        self.settings_service = settings_service
        self.similarity_threshold = float(os.getenv("ENTITY_SIMILARITY_THRESHOLD", "0.85"))
        self.max_workers = int(os.getenv("GRAPH_EXTRACTION_WORKERS", "5"))  # Reduced from 20 to 5
        
        # Load entity and relationship types from database
        self.entity_types = []
        self.relationship_types = []
        self.EntityType = EntityType  # Default to hardcoded
        self.RelationshipType = RelationshipType  # Default to hardcoded
        
        if self.settings_service:
            try:
                self.entity_types = self.settings_service.get_entity_types()
                self.relationship_types = self.settings_service.get_relationship_types()
                
                # Create dynamic enums from database settings
                self.EntityType = create_entity_enum(self.entity_types)
                self.RelationshipType = create_relationship_enum(self.relationship_types)
                
                logger.info(f"Loaded {len(self.entity_types)} entity types and {len(self.relationship_types)} relationship types from database")
            except Exception as e:
                logger.warning(f"Failed to load schema types from database, using defaults: {e}")
        
        # Entity cache to avoid redundant lookups within same document
        self.entity_cache: Dict[str, str] = {}  # canonical_name -> entity_id
        self.cache_hits = 0
        self.cache_misses = 0
        
        # Rate limiting
        self.last_db_call = 0
        self.min_db_interval = 0.1  # 100ms between DB calls
        
        logger.info(f"Initialized GraphExtractor (similarity_threshold={self.similarity_threshold}, max_workers={self.max_workers})")
    
    def _get_extraction_prompt(self) -> str:
        """
        Generate extraction prompt with dynamic entity and relationship types.
        
        Returns:
            Prompt string with current schema types
        """
        # Build entity types section
        entity_types_desc = []
        if self.entity_types:
            for entity_type in self.entity_types[:10]:  # Limit to first 10 to avoid prompt overflow
                entity_types_desc.append(f"- ✅ {entity_type['name']}: {entity_type['description']}")
        else:
            # Fallback to hardcoded types
            entity_types_desc = [
                "- ✅ Person: Individual people, including names, roles, and personal identifiers",
                "- ✅ Organization: Companies, agencies, institutions, and other organized groups",
                "- ✅ Location: Geographic places, facilities, and spatial locations",
                "- ✅ Technology: Software, hardware, systems, platforms, and technical tools",
                "- ✅ Concept: Abstract ideas, methodologies, and principles"
            ]
        
        # Build relationship types section
        relationship_types_desc = []
        if self.relationship_types:
            for rel_type in self.relationship_types[:10]:  # Limit to first 10
                relationship_types_desc.append(f"- ✅ {rel_type['name']}: {rel_type['description']} ({rel_type.get('direction', 'Entity → Entity')})")
        else:
            # Fallback to hardcoded types
            relationship_types_desc = [
                "- ✅ uses: Technology or tool usage (Person/Organization → Technology)",
                "- ✅ part_of: Component or membership relationship (Part → Whole)",
                "- ✅ manages: Management or oversight relationship (Person → Organization/Project)",
                "- ✅ creates: Creation or production relationship (Person/Organization → Product/Document)",
                "- ✅ related_to: General association or connection (Entity ↔ Entity)"
            ]
        
        return f"""You are an expert at extracting entities and relationships from text for knowledge graph construction.

**ENTITY EXTRACTION RULES:**

Extract MAXIMUM 3-7 entities per chunk. ONLY extract proper nouns or significant domain concepts.

**NEVER extract (FORBIDDEN):**
- ❌ ANY number, date, or year (e.g., "2024", "2020-2025", "January")
- ❌ ANY dollar amount or price (e.g., "$34 billion", "$450 billion")
- ❌ ANY percentage or statistic (e.g., "15%", "0.85")
- ❌ ANY measurement or quantity (e.g., "90 tons", "21 States", "27 companies")
- ❌ ANY technical ID or code (e.g., "#ffffff", "8112.99.9100", "4.1-specific-gravity")
- ❌ Generic descriptors (e.g., "high", "low", "significant", "advanced")
- ❌ Common industry terms (e.g., "production", "supply chains", "industry")

**ALLOWED ENTITY TYPES:**
{chr(10).join(entity_types_desc)}

**RELATIONSHIP EXTRACTION RULES:**

For each pair of entities that are meaningfully connected in the text, extract their relationship.

**ALLOWED RELATIONSHIP TYPES:**
{chr(10).join(relationship_types_desc)}

**Extract relationships when:**
- ✅ One entity uses, requires, or depends on another
- ✅ One entity is part of or belongs to another
- ✅ One entity creates, manages, or analyzes another
- ✅ Entities collaborate, compete, or interact
- ✅ There's a clear action or connection between entities

**DO NOT extract relationships when:**
- ❌ Entities are only mentioned in the same sentence but not connected
- ❌ The connection is vague or unclear
- ❌ You're guessing at a relationship not stated in the text

**Relationship quality:** Only extract relationships that are explicitly stated or strongly implied in the text."""
    
    def extract_from_chunk(self, text: str, max_retries: int = 3) -> ExtractionResult:
        """
        Extract entities and relationships from a single text chunk.
        
        Args:
            text: The text to extract from
            max_retries: Maximum number of retries for rate limit errors
            
        Returns:
            ExtractionResult with entities and relationships
        """
        # Get graph model from settings (default to gpt-4o-mini for entity extraction)
        graph_model = "gpt-4o-mini"
        if self.settings_service:
            graph_model = self.settings_service.get_string('llm.standardModel', 'gpt-4o-mini')
        
        for attempt in range(max_retries):
            try:
                response = self.openai.beta.chat.completions.parse(
                    model=graph_model,
                    messages=[
                        {
                            "role": "system",
                            "content": self._get_extraction_prompt()
                        },
                        {
                            "role": "user",
                            "content": f"Text to analyze:\n\n{text}"
                        }
                    ],
                    response_format=ExtractionResult,
                    temperature=0.3
                )
                
                result = response.choices[0].message.parsed
                logger.debug(f"Extracted {len(result.entities)} entities and {len(result.relationships)} relationships")
                return result
                
            except RateLimitError as e:
                if attempt < max_retries - 1:
                    # Exponential backoff: 2s, 4s, 8s
                    wait_time = 2 ** (attempt + 1)
                    logger.warning(f"Rate limit hit, retrying after {wait_time}s (attempt {attempt + 1}/{max_retries})")
                    time.sleep(wait_time)
                else:
                    logger.error(f"Rate limit exceeded after {max_retries} attempts")
                    return ExtractionResult(entities=[], relationships=[])
                    
            except Exception as e:
                logger.error(f"Error extracting entities/relationships: {e}")
                # Return empty result on error (graceful degradation)
                return ExtractionResult(entities=[], relationships=[])
        
        # Should never reach here, but just in case
        return ExtractionResult(entities=[], relationships=[])
    
    def normalize_entity_name(self, name: str) -> str:
        """Normalize entity name for deduplication"""
        return name.lower().strip().replace("  ", " ")
    
    def generate_entity_embedding(self, text: str) -> List[float]:
        """Generate embedding for entity description"""
        try:
            response = self.openai.embeddings.create(
                model="text-embedding-3-small",
                input=text
            )
            return response.data[0].embedding
        except Exception as e:
            logger.error(f"Error generating entity embedding: {e}")
            raise
    
    def _rate_limit_db_call(self):
        """Rate limit database calls to avoid overwhelming Supabase"""
        elapsed = time.time() - self.last_db_call
        if elapsed < self.min_db_interval:
            time.sleep(self.min_db_interval - elapsed)
        self.last_db_call = time.time()
    
    def _merge_descriptions(self, existing: str, new: str) -> str:
        """
        Intelligently merge entity descriptions.
        
        Strategy:
        1. If new description is empty, keep existing
        2. If existing is empty, use new
        3. If new description adds information not in existing, append it
        4. Otherwise, keep existing (avoid redundancy)
        
        Args:
            existing: Current entity description
            new: New description from latest extraction
            
        Returns:
            Merged description
        """
        if not new or not new.strip():
            return existing
        
        if not existing or not existing.strip():
            return new
        
        # Normalize for comparison
        existing_lower = existing.lower()
        new_lower = new.lower()
        
        # If new description is substantially different, append it
        # Check if new description adds meaningful content
        if new_lower not in existing_lower and existing_lower not in new_lower:
            # Avoid duplicating similar content - check for significant overlap
            new_words = set(new_lower.split())
            existing_words = set(existing_lower.split())
            overlap = len(new_words & existing_words) / len(new_words) if new_words else 0
            
            # If less than 70% overlap, it's adding new information
            if overlap < 0.7:
                return f"{existing}. {new}"
        
        # Otherwise keep existing (new is redundant or subset)
        return existing
    
    def find_similar_entity(
        self, 
        user_id: str, 
        name: str, 
        entity_type: str, 
        embedding: List[float]
    ) -> Optional[str]:
        """
        Find similar entity in database using pgvector similarity with caching.
        
        Args:
            user_id: User ID for filtering
            name: Entity name
            entity_type: Entity type
            embedding: Entity embedding vector
            
        Returns:
            Entity ID if similar entity found, None otherwise
        """
        # Check cache first
        canonical_name = self.normalize_entity_name(name)
        cache_key = f"{canonical_name}:{entity_type}"
        
        if cache_key in self.entity_cache:
            self.cache_hits += 1
            return self.entity_cache[cache_key]
        
        self.cache_misses += 1
        
        try:
            # Rate limit to avoid overwhelming Supabase
            self._rate_limit_db_call()
            
            # Call the find_similar_entities function with timeout
            result = self.supabase.rpc(
                "find_similar_entities",
                {
                    "p_user_id": user_id,
                    "p_name": name,
                    "p_type": entity_type,
                    "p_embedding": embedding,
                    "p_similarity_threshold": self.similarity_threshold
                }
            ).execute()
            
            if result.data and len(result.data) > 0:
                entity_id = result.data[0]["entity_id"]
                similarity = result.data[0]["similarity_score"]
                logger.debug(f"Found similar entity '{name}' (similarity={similarity:.3f})")
                
                # Cache the result
                self.entity_cache[cache_key] = entity_id
                return entity_id
            
            # Cache negative result (no match found)
            self.entity_cache[cache_key] = None
            return None
            
        except Exception as e:
            logger.error(f"Error finding similar entity: {e}")
            return None
    
    def store_entity(
        self,
        entity: Entity,
        user_id: str,
        document_id: str,
        chunk_id: str
    ) -> Optional[str]:
        """
        Store entity in database with deduplication.
        
        Args:
            entity: Entity to store
            user_id: User ID
            document_id: Document ID
            chunk_id: Chunk ID
            
        Returns:
            Entity ID (existing or new)
        """
        try:
            canonical_name = self.normalize_entity_name(entity.name)
            
            # Generate embedding for entity
            embedding_text = f"{entity.name}: {entity.description}"
            embedding = self.generate_entity_embedding(embedding_text)
            
            # Handle entity.type - could be string or enum
            entity_type = entity.type.value if hasattr(entity.type, 'value') else entity.type
            
            # Check for similar entity
            existing_entity_id = self.find_similar_entity(
                user_id, 
                entity.name, 
                entity_type, 
                embedding
            )
            
            if existing_entity_id:
                # Entity exists - enrich it with new information
                # Rate limit before DB call
                self._rate_limit_db_call()
                
                # Fetch current entity with all fields
                result = self.supabase.table("entities").select("*").eq("id", existing_entity_id).single().execute()
                
                if result.data:
                    existing = result.data
                    doc_ids = existing.get("document_ids", []) or []
                    chunk_ids = existing.get("chunk_ids", []) or []
                    existing_aliases = existing.get("aliases", []) or []
                    existing_description = existing.get("description", "")
                    
                    # Add new IDs if not present
                    if document_id not in doc_ids:
                        doc_ids.append(document_id)
                    if chunk_id not in chunk_ids:
                        chunk_ids.append(chunk_id)
                    
                    # Merge descriptions intelligently
                    enriched_description = self._merge_descriptions(
                        existing_description,
                        entity.description
                    )
                    
                    # Accumulate new aliases
                    new_aliases = [a for a in entity.aliases if a and a not in existing_aliases]
                    enriched_aliases = existing_aliases + new_aliases
                    
                    # Rate limit before DB call
                    self._rate_limit_db_call()
                    
                    # Update entity with enriched data
                    update_data = {
                        "document_ids": doc_ids,
                        "chunk_ids": chunk_ids,
                        "description": enriched_description,
                        "aliases": enriched_aliases,
                        "updated_at": "now()"
                    }
                    
                    self.supabase.table("entities").update(update_data).eq("id", existing_entity_id).execute()
                    
                    logger.debug(f"Enriched existing entity: {entity.name} (added {len(new_aliases)} aliases)")
                    return existing_entity_id
            
            # New entity - insert
            # Rate limit before DB call
            self._rate_limit_db_call()
            
            result = self.supabase.table("entities").insert({
                "user_id": user_id,
                "name": entity.name,
                "type": entity_type,
                "description": entity.description,
                "canonical_name": canonical_name,
                "aliases": entity.aliases,
                "embedding": embedding,
                "document_ids": [document_id],
                "chunk_ids": [chunk_id],
                "extraction_confidence": 0.9
            }).execute()
            
            if result.data:
                entity_id = result.data[0]["id"]
                logger.debug(f"Stored new entity: {entity.name} ({entity_type})")
                return entity_id
            
            return None
            
        except Exception as e:
            logger.error(f"Error storing entity '{entity.name}': {e}")
            return None
    
    def store_relationship(
        self,
        relationship: Relationship,
        entity_name_to_id: Dict[str, str],
        user_id: str,
        document_id: str,
        chunk_id: str
    ) -> bool:
        """
        Store relationship in database, appending to existing arrays if it already exists.
        
        Args:
            relationship: Relationship to store
            entity_name_to_id: Mapping of entity names to IDs
            user_id: User ID
            document_id: Document ID
            chunk_id: Chunk ID
            
        Returns:
            True if stored successfully, False otherwise
        """
        try:
            # Try to get entity IDs from local mapping first
            source_id = entity_name_to_id.get(relationship.source)
            target_id = entity_name_to_id.get(relationship.target)
            
            # If not in local mapping, look up in database by canonical name
            if not source_id:
                self._rate_limit_db_call()
                source_canonical = self.normalize_entity_name(relationship.source)
                result = self.supabase.table("entities").select("id").eq("user_id", user_id).eq("canonical_name", source_canonical).limit(1).execute()
                if result.data and len(result.data) > 0:
                    source_id = result.data[0]["id"]
                    logger.debug(f"Found source entity '{relationship.source}' in database")
            
            if not target_id:
                self._rate_limit_db_call()
                target_canonical = self.normalize_entity_name(relationship.target)
                result = self.supabase.table("entities").select("id").eq("user_id", user_id).eq("canonical_name", target_canonical).limit(1).execute()
                if result.data and len(result.data) > 0:
                    target_id = result.data[0]["id"]
                    logger.debug(f"Found target entity '{relationship.target}' in database")
            
            if not source_id or not target_id:
                logger.warning(f"Missing entity IDs for relationship: {relationship.source} -> {relationship.target}")
                return False
            
            # Check if relationship already exists
            existing = self.supabase.table("relationships").select("id, document_ids, chunk_ids").match({
                "user_id": user_id,
                "source_entity_id": source_id,
                "target_entity_id": target_id,
                "relationship_type": relationship.type.value
            }).execute()
            
            if existing.data and len(existing.data) > 0:
                # Relationship exists - append to arrays
                rel = existing.data[0]
                doc_ids = rel.get("document_ids", []) or []
                chunk_ids = rel.get("chunk_ids", []) or []
                
                # Add new IDs if not present
                if document_id not in doc_ids:
                    doc_ids.append(document_id)
                if chunk_id not in chunk_ids:
                    chunk_ids.append(chunk_id)
                
                # Update relationship
                self.supabase.table("relationships").update({
                    "document_ids": doc_ids,
                    "chunk_ids": chunk_ids,
                    "updated_at": "now()"
                }).eq("id", rel["id"]).execute()
                
                logger.debug(f"Updated existing relationship: {relationship.source} -{relationship.type.value}-> {relationship.target}")
                return True
            else:
                # New relationship - insert
                self.supabase.table("relationships").insert({
                    "user_id": user_id,
                    "source_entity_id": source_id,
                    "target_entity_id": target_id,
                    "relationship_type": relationship.type.value,
                    "description": relationship.description,
                    "bidirectional": relationship.bidirectional,
                    "document_ids": [document_id],
                    "chunk_ids": [chunk_id],
                    "extraction_confidence": 0.9
                }).execute()
                
                logger.debug(f"Stored new relationship: {relationship.source} -{relationship.type.value}-> {relationship.target}")
                return True
            
        except Exception as e:
            logger.error(f"Error storing relationship: {e}")
            return False
    
    def process_chunk(
        self,
        chunk_id: str,
        chunk_content: str,
        document_id: str,
        user_id: str
    ) -> Tuple[int, int]:
        """
        Extract and store entities/relationships for a single chunk.
        
        Args:
            chunk_id: Chunk ID
            chunk_content: Chunk text content
            document_id: Document ID
            user_id: User ID
            
        Returns:
            Tuple of (entity_count, relationship_count)
        """
        # Extract entities and relationships
        extraction = self.extract_from_chunk(chunk_content)
        
        # Store entities and build name->ID mapping
        entity_name_to_id = {}
        for entity in extraction.entities:
            entity_id = self.store_entity(entity, user_id, document_id, chunk_id)
            if entity_id:
                entity_name_to_id[entity.name] = entity_id
        
        # Store relationships
        relationship_count = 0
        for relationship in extraction.relationships:
            if self.store_relationship(relationship, entity_name_to_id, user_id, document_id, chunk_id):
                relationship_count += 1
        
        return len(entity_name_to_id), relationship_count
    
    def process_chunks_batch(
        self,
        chunks: List[Dict[str, Any]],
        document_id: str,
        user_id: str,
        max_workers: Optional[int] = None
    ) -> Tuple[int, int]:
        """
        Process a batch of chunks for graph extraction in parallel.
        
        Args:
            chunks: List of chunk dictionaries with 'id' and 'content'
            document_id: Document ID
            user_id: User ID
            max_workers: Number of parallel workers (default: from GRAPH_EXTRACTION_WORKERS env var, or 6)
            
        Returns:
            Tuple of (total_entities, total_relationships)
        """
        total_entities = 0
        total_relationships = 0
        
        # Use configured max_workers if not specified
        workers = max_workers if max_workers is not None else self.max_workers
        
        logger.info(f"Starting parallel graph extraction with {workers} workers for {len(chunks)} chunks")
        
        # Process chunks in parallel using ThreadPoolExecutor
        with ThreadPoolExecutor(max_workers=workers) as executor:
            # Submit all chunks for processing
            future_to_chunk = {
                executor.submit(
                    self.process_chunk,
                    chunk["id"],
                    chunk["content"],  # Always use full content
                    document_id,
                    user_id
                ): chunk
                for chunk in chunks
            }
            
            # Collect results as they complete
            completed = 0
            for future in as_completed(future_to_chunk):
                completed += 1
                chunk = future_to_chunk[future]
                
                try:
                    entity_count, rel_count = future.result()
                    total_entities += entity_count
                    total_relationships += rel_count
                    
                    if completed % 10 == 0:
                        logger.info(f"Processed {completed}/{len(chunks)} chunks for graph extraction")
                        
                except Exception as e:
                    logger.error(f"Error processing chunk {chunk.get('id')}: {e}")
                    continue
        
        # Log cache statistics
        total_lookups = self.cache_hits + self.cache_misses
        cache_hit_rate = (self.cache_hits / total_lookups * 100) if total_lookups > 0 else 0
        logger.info(f"Graph extraction complete: {total_entities} entities, {total_relationships} relationships from {len(chunks)} chunks")
        logger.info(f"Entity cache stats: {self.cache_hits} hits, {self.cache_misses} misses ({cache_hit_rate:.1f}% hit rate)")
        
        # Clear cache after batch to free memory
        self.entity_cache.clear()
        self.cache_hits = 0
        self.cache_misses = 0
        
        return total_entities, total_relationships
    
    def _merge_duplicate_entities(self, entities: List[Dict[str, Any]], user_id: str) -> int:
        """
        Merge entities with the same canonical name but different types.
        
        Args:
            entities: List of entity dictionaries
            user_id: User ID
            
        Returns:
            Number of entities merged
        """
        # Group entities by canonical name
        from collections import defaultdict
        by_canonical = defaultdict(list)
        
        for entity in entities:
            canonical = self.normalize_entity_name(entity['name'])
            by_canonical[canonical].append(entity)
        
        # Find duplicates (same canonical name, multiple entities)
        duplicates = {k: v for k, v in by_canonical.items() if len(v) > 1}
        
        if not duplicates:
            return 0
        
        logger.info(f"Found {len(duplicates)} sets of duplicate entities to merge")
        
        merged_count = 0
        for canonical_name, dupe_entities in duplicates.items():
            # Pick the "best" entity to keep (prefer more specific types)
            type_priority = {
                'person': 1,
                'organization': 2,
                'location': 3,
                'technology': 4,
                'framework': 5,
                'methodology': 6,
                'event': 7,
                'document': 8,
                'concept': 9,
                'other': 10
            }
            
            # Sort by type priority (lower = better)
            dupe_entities.sort(key=lambda e: type_priority.get(e['type'], 99))
            
            # Keep the first (best) entity
            keep_entity = dupe_entities[0]
            merge_entities = dupe_entities[1:]
            
            # Merge document_ids and chunk_ids from all duplicates
            all_doc_ids = set(keep_entity.get('document_ids', []))
            all_chunk_ids = set(keep_entity.get('chunk_ids', []))
            
            for merge_entity in merge_entities:
                all_doc_ids.update(merge_entity.get('document_ids', []))
                all_chunk_ids.update(merge_entity.get('chunk_ids', []))
                
                # Update relationships to point to keep_entity
                self.supabase.table("relationships")\
                    .update({"source_entity_id": keep_entity['id']})\
                    .eq("source_entity_id", merge_entity['id'])\
                    .execute()
                
                self.supabase.table("relationships")\
                    .update({"target_entity_id": keep_entity['id']})\
                    .eq("target_entity_id", merge_entity['id'])\
                    .execute()
                
                # Delete the duplicate entity
                self.supabase.table("entities")\
                    .delete()\
                    .eq("id", merge_entity['id'])\
                    .execute()
                
                merged_count += 1
                logger.debug(f"Merged '{merge_entity['name']}' ({merge_entity['type']}) into '{keep_entity['name']}' ({keep_entity['type']})")
            
            # Update keep_entity with merged IDs
            self.supabase.table("entities")\
                .update({
                    "document_ids": list(all_doc_ids),
                    "chunk_ids": list(all_chunk_ids)
                })\
                .eq("id", keep_entity['id'])\
                .execute()
        
        return merged_count
    
    def cleanup_junk_entities(self, user_id: str, document_id: str) -> int:
        """
        Second-pass cleanup: Review all entities for a document and remove junk.
        
        This catches entities that slipped through the extraction rules by reviewing
        the full list with global context. Also merges duplicates across types.
        
        Args:
            user_id: User ID
            document_id: Document ID
            
        Returns:
            Number of entities deleted
        """
        logger.info("🧹 Starting second-pass entity cleanup...")
        
        # Get all entities for this document
        result = self.supabase.table("entities")\
            .select("id, name, type, description, document_ids, chunk_ids")\
            .eq("user_id", user_id)\
            .contains("document_ids", [document_id])\
            .execute()
        
        if not result.data or len(result.data) == 0:
            logger.info("No entities to clean up")
            return 0
        
        entities = result.data
        logger.info(f"Reviewing {len(entities)} entities for cleanup...")
        
        # First, merge duplicates (same name, different types)
        merged_count = self._merge_duplicate_entities(entities, user_id)
        if merged_count > 0:
            logger.info(f"Merged {merged_count} duplicate entities")
            # Refresh entity list after merging
            result = self.supabase.table("entities")\
                .select("id, name, type, description, document_ids, chunk_ids")\
                .eq("user_id", user_id)\
                .contains("document_ids", [document_id])\
                .execute()
            entities = result.data
        
        logger.info(f"Reviewing {len(entities)} entities for junk removal...")
        
        # Prepare entity list for LLM review
        entity_list = "\n".join([
            f"- {e['name']} ({e['type']})"
            for e in entities
        ])
        
        # Ask LLM to identify junk entities
        try:
            response = self.openai.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": """Review this list of extracted entities and identify ONLY the most obvious junk that should be deleted.

**BE CONSERVATIVE - When in doubt, KEEP the entity!**

**ONLY DELETE if entity is clearly:**
- A standalone number/year (e.g., "2024", "1959") - NOT part of a name
- A dollar amount (e.g., "$34 billion", "$450 billion")
- A percentage (e.g., "15%", "0.85")
- A generic measurement (e.g., "90 tons", "4.1-specific-gravity")
- A technical code/ID (e.g., "#ffffff", "8112.99.9100")
- A single generic word (e.g., "advanced", "high", "production")

**ALWAYS KEEP (even if they seem generic):**
- ANY proper name (person, organization, location, country, state, city)
- ANY mineral, material, chemical, or element name
- ANY technology, system, or product name
- ANY document, act, program, or initiative name
- ANY compound term with multiple words (e.g., "United States", "Silicon carbide")
- ANY entity that could be part of a relationship

**CRITICAL:** Only return entities you are 100% certain are junk. If unsure, DO NOT include it.

Return ONLY the names of entities to DELETE, one per line. If no entities should be deleted, return "none"."""
                    },
                    {
                        "role": "user",
                        "content": f"Entity list:\n\n{entity_list}\n\nWhich entities are DEFINITELY junk and should be DELETED?"
                    }
                ],
                temperature=0.0
            )
            
            # Parse response to get entity names to delete
            to_delete_text = response.choices[0].message.content.strip()
            if not to_delete_text or to_delete_text.lower() in ["none", "no entities", ""]:
                logger.info("✅ No junk entities found!")
                return 0
            
            to_delete_names = [
                line.strip().lstrip('-').strip()
                for line in to_delete_text.split('\n')
                if line.strip() and not line.strip().startswith('#')
            ]
            
            # Deduplicate the list (LLM might return duplicates)
            to_delete_names = list(set(to_delete_names))
            
            logger.info(f"Found {len(to_delete_names)} junk entities to delete")
            
            # Delete junk entities
            deleted_count = 0
            deleted_ids = set()  # Track deleted IDs to avoid duplicates
            
            for name in to_delete_names:
                # Find entity ID by name
                entity = next((e for e in entities if e['name'] == name and e['id'] not in deleted_ids), None)
                if entity:
                    # Delete relationships first
                    self.supabase.table("relationships")\
                        .delete()\
                        .or_(f"source_entity_id.eq.{entity['id']},target_entity_id.eq.{entity['id']}")\
                        .execute()
                    
                    # Delete entity
                    self.supabase.table("entities")\
                        .delete()\
                        .eq("id", entity['id'])\
                        .execute()
                    
                    deleted_ids.add(entity['id'])  # Mark as deleted
                    deleted_count += 1
                    logger.debug(f"Deleted junk entity: {name}")
            
            logger.info(f"🧹 Cleanup complete: Deleted {deleted_count} junk entities")
            return deleted_count
            
        except Exception as e:
            logger.error(f"Error during entity cleanup: {e}")
            return 0
