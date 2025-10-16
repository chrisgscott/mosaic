"""
Graph RAG Entity and Relationship Extractor

Extracts entities and relationships from text chunks using OpenAI structured outputs.
Implements deduplication via pgvector similarity and canonical name matching.
"""

import os
import logging
from typing import List, Dict, Any, Optional, Tuple, Set
from openai import OpenAI
from pydantic import BaseModel, Field
from enum import Enum

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
    type: EntityType = Field(description="The type/category of the entity")
    description: str = Field(description="A brief description of what this entity is or represents")
    aliases: List[str] = Field(default_factory=list, description="Alternative names or acronyms for this entity")


class Relationship(BaseModel):
    """Relationship between two entities"""
    source: str = Field(description="The name of the source entity")
    target: str = Field(description="The name of the target entity")
    type: RelationshipType = Field(description="The type of relationship between the entities")
    description: str = Field(description="A brief description of how these entities are related")
    bidirectional: bool = Field(default=False, description="Whether this relationship works both ways")


class ExtractionResult(BaseModel):
    """Result of entity and relationship extraction"""
    entities: List[Entity] = Field(description="List of entities found in the text")
    relationships: List[Relationship] = Field(description="List of relationships between entities")


# ============================================================================
# GRAPH EXTRACTOR
# ============================================================================

class GraphExtractor:
    """Extracts entities and relationships from text chunks"""
    
    def __init__(self, supabase_client, openai_api_key: Optional[str] = None):
        """
        Initialize the graph extractor.
        
        Args:
            supabase_client: Supabase client for database operations
            openai_api_key: OpenAI API key (defaults to OPENAI_API_KEY env var)
        """
        self.supabase = supabase_client
        self.openai = OpenAI(api_key=openai_api_key or os.getenv("OPENAI_API_KEY"))
        self.similarity_threshold = float(os.getenv("ENTITY_SIMILARITY_THRESHOLD", "0.85"))
        
        logger.info(f"Initialized GraphExtractor (similarity_threshold={self.similarity_threshold})")
    
    def extract_from_chunk(self, text: str) -> ExtractionResult:
        """
        Extract entities and relationships from a single text chunk.
        
        Args:
            text: The text to extract from
            
        Returns:
            ExtractionResult with entities and relationships
        """
        try:
            response = self.openai.beta.chat.completions.parse(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": """You are an expert at extracting entities and relationships from text for knowledge graph construction.

Analyze the text and extract:
1. **Entities**: Important concepts, people, organizations, methodologies, frameworks, tools, etc.
2. **Relationships**: How these entities relate to each other

Guidelines:
- Be precise and specific with entity names
- Include acronyms as aliases (e.g., "SDA" as alias for "Strategic Design Approaches")
- Only extract relationships that are explicitly stated or strongly implied
- Use descriptive relationship types that capture the nature of the connection
- Focus on meaningful entities (not common words or generic concepts)
- Descriptions should be concise but informative"""
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
            
        except Exception as e:
            logger.error(f"Error extracting entities/relationships: {e}")
            # Return empty result on error (graceful degradation)
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
    
    def find_similar_entity(
        self, 
        user_id: str, 
        name: str, 
        entity_type: str, 
        embedding: List[float]
    ) -> Optional[str]:
        """
        Find similar entity in database using pgvector similarity.
        
        Args:
            user_id: User ID for filtering
            name: Entity name
            entity_type: Entity type
            embedding: Entity embedding vector
            
        Returns:
            Entity ID if similar entity found, None otherwise
        """
        try:
            # Call the find_similar_entities function
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
                return entity_id
            
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
            
            # Check for similar entity
            existing_entity_id = self.find_similar_entity(
                user_id, 
                entity.name, 
                entity.type.value, 
                embedding
            )
            
            if existing_entity_id:
                # Entity exists - update arrays
                # Fetch current entity
                result = self.supabase.table("entities").select("document_ids, chunk_ids").eq("id", existing_entity_id).single().execute()
                
                if result.data:
                    doc_ids = result.data.get("document_ids", []) or []
                    chunk_ids = result.data.get("chunk_ids", []) or []
                    
                    # Add new IDs if not present
                    if document_id not in doc_ids:
                        doc_ids.append(document_id)
                    if chunk_id not in chunk_ids:
                        chunk_ids.append(chunk_id)
                    
                    # Update entity
                    self.supabase.table("entities").update({
                        "document_ids": doc_ids,
                        "chunk_ids": chunk_ids,
                        "updated_at": "now()"
                    }).eq("id", existing_entity_id).execute()
                    
                    return existing_entity_id
            
            # New entity - insert
            result = self.supabase.table("entities").insert({
                "user_id": user_id,
                "name": entity.name,
                "type": entity.type.value,
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
                logger.debug(f"Stored new entity: {entity.name} ({entity.type.value})")
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
        Store relationship in database.
        
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
            source_id = entity_name_to_id.get(relationship.source)
            target_id = entity_name_to_id.get(relationship.target)
            
            if not source_id or not target_id:
                logger.warning(f"Missing entity IDs for relationship: {relationship.source} -> {relationship.target}")
                return False
            
            # Upsert relationship (will update if exists, insert if new)
            self.supabase.table("relationships").upsert({
                "user_id": user_id,
                "source_entity_id": source_id,
                "target_entity_id": target_id,
                "relationship_type": relationship.type.value,
                "description": relationship.description,
                "bidirectional": relationship.bidirectional,
                "document_ids": [document_id],
                "chunk_ids": [chunk_id],
                "extraction_confidence": 0.9
            }, on_conflict="user_id,source_entity_id,target_entity_id,relationship_type").execute()
            
            logger.debug(f"Stored relationship: {relationship.source} -{relationship.type.value}-> {relationship.target}")
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
        user_id: str
    ) -> Tuple[int, int]:
        """
        Process a batch of chunks for graph extraction.
        
        Args:
            chunks: List of chunk dictionaries with 'id' and 'content'
            document_id: Document ID
            user_id: User ID
            
        Returns:
            Tuple of (total_entities, total_relationships)
        """
        total_entities = 0
        total_relationships = 0
        
        for i, chunk in enumerate(chunks, 1):
            try:
                # Always use full content for graph extraction to capture all entities/relationships
                # Summaries are too compressed and miss important details
                text = chunk["content"]
                
                entity_count, rel_count = self.process_chunk(
                    chunk["id"],
                    text,
                    document_id,
                    user_id
                )
                total_entities += entity_count
                total_relationships += rel_count
                
                if i % 10 == 0:
                    logger.info(f"Processed {i}/{len(chunks)} chunks for graph extraction")
                    
            except Exception as e:
                logger.error(f"Error processing chunk {chunk.get('id')}: {e}")
                continue
        
        logger.info(f"Graph extraction complete: {total_entities} entities, {total_relationships} relationships from {len(chunks)} chunks")
        return total_entities, total_relationships
