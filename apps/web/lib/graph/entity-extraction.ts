/**
 * Entity Extraction for Graph RAG
 * 
 * Extracts entities and relationships from text chunks using LLM with structured output.
 * Follows R2R's approach: LLM-driven extraction with deduplication.
 */

import { generateObject } from 'ai';
import { models } from '@/lib/ai/gateway';
import { z } from 'zod';
import { getPrompt } from '@/lib/ai/prompts';
import { createClient } from '@/lib/supabase/server';

// ============================================================================
// SCHEMAS
// ============================================================================

const EntitySchema = z.object({
  name: z.string().describe('The name of the entity'),
  type: z.enum([
    'person',
    'organization',
    'concept',
    'methodology',
    'framework',
    'tool',
    'technology',
    'location',
    'event',
    'document',
    'other'
  ]).describe('The type/category of the entity'),
  description: z.string().describe('A brief description of what this entity is or represents'),
  aliases: z.array(z.string()).optional().describe('Alternative names or acronyms for this entity'),
});

const RelationshipSchema = z.object({
  source: z.string().describe('The name of the source entity'),
  target: z.string().describe('The name of the target entity'),
  type: z.enum([
    'uses',
    'requires',
    'relates_to',
    'part_of',
    'implements',
    'extends',
    'depends_on',
    'collaborates_with',
    'manages',
    'creates',
    'analyzes',
    'evaluates',
    'other'
  ]).describe('The type of relationship between the entities'),
  description: z.string().describe('A brief description of how these entities are related'),
  bidirectional: z.boolean().optional().describe('Whether this relationship works both ways'),
});

const ExtractionResultSchema = z.object({
  entities: z.array(EntitySchema).describe('List of entities found in the text'),
  relationships: z.array(RelationshipSchema).describe('List of relationships between entities'),
});

export type Entity = z.infer<typeof EntitySchema>;
export type Relationship = z.infer<typeof RelationshipSchema>;
export type ExtractionResult = z.infer<typeof ExtractionResultSchema>;

// ============================================================================
// EXTRACTION FUNCTIONS
// ============================================================================

/**
 * Extract entities and relationships from a text chunk using LLM
 */
export async function extractEntitiesAndRelationships(
  text: string,
  options?: {
    model?: string;
    temperature?: number;
  }
): Promise<ExtractionResult> {
  const temperature = options?.temperature || 0.3;

  try {
    // Get entity extraction prompt from settings
    const prompt = await getPrompt('entityExtraction', { text });
    
    const result = await generateObject({
      model: models.standard,
      temperature,
      schema: ExtractionResultSchema,
      prompt,
    });

    return result.object;
  } catch (error) {
    console.error('[Entity Extraction] Error:', error);
    // Return empty result on error (graceful degradation)
    return { entities: [], relationships: [] };
  }
}

/**
 * Generate embedding for an entity description
 */
export async function generateEntityEmbedding(text: string): Promise<number[]> {
  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
  } catch (error) {
    console.error('[Entity Embedding] Error:', error);
    throw error;
  }
}

/**
 * Normalize entity name for deduplication
 */
export function normalizeEntityName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

// ============================================================================
// DATABASE OPERATIONS
// ============================================================================

/**
 * Store extracted entities in database with deduplication
 */
export async function storeEntities(
  entities: Entity[],
  userId: string,
  documentId: string,
  chunkId: string
): Promise<Map<string, string>> {
  const supabase = await createClient();
  const entityNameToIdMap = new Map<string, string>();

  for (const entity of entities) {
    try {
      const canonicalName = normalizeEntityName(entity.name);
      
      // Generate embedding for entity description
      const embeddingText = `${entity.name}: ${entity.description}`;
      const embedding = await generateEntityEmbedding(embeddingText);

      // Check for existing similar entities
      const { data: similarEntities } = await supabase.rpc('find_similar_entities', {
        p_user_id: userId,
        p_name: entity.name,
        p_type: entity.type,
        p_embedding: embedding,
        p_similarity_threshold: 0.85,
      });

      if (similarEntities && similarEntities.length > 0) {
        // Entity exists - update it by adding this document/chunk reference
        const existingEntityId = similarEntities[0].entity_id;
        
        // Fetch current entity to get existing arrays
        const { data: existingEntity } = await supabase
          .from('entities')
          .select('document_ids, chunk_ids')
          .eq('id', existingEntityId)
          .single();
        
        if (existingEntity) {
          const updatedDocIds = [...(existingEntity.document_ids || [])];
          const updatedChunkIds = [...(existingEntity.chunk_ids || [])];
          
          // Add new IDs if not already present
          if (!updatedDocIds.includes(documentId)) {
            updatedDocIds.push(documentId);
          }
          if (!updatedChunkIds.includes(chunkId)) {
            updatedChunkIds.push(chunkId);
          }
          
          const { error: updateError } = await supabase
            .from('entities')
            .update({
              document_ids: updatedDocIds,
              chunk_ids: updatedChunkIds,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingEntityId);

          if (updateError) {
            console.error('[Store Entity] Update error:', updateError);
          } else {
            entityNameToIdMap.set(entity.name, existingEntityId);
          }
        }
      } else {
        // New entity - insert it
        const { data: newEntity, error: insertError } = await supabase
          .from('entities')
          .insert({
            user_id: userId,
            name: entity.name,
            type: entity.type,
            description: entity.description,
            canonical_name: canonicalName,
            aliases: entity.aliases || [],
            embedding,
            document_ids: [documentId],
            chunk_ids: [chunkId],
            extraction_confidence: 0.9, // Default confidence
          })
          .select('id')
          .single();

        if (insertError) {
          console.error('[Store Entity] Insert error:', insertError);
        } else if (newEntity) {
          entityNameToIdMap.set(entity.name, newEntity.id);
        }
      }
    } catch (error) {
      console.error(`[Store Entity] Error storing entity "${entity.name}":`, error);
    }
  }

  return entityNameToIdMap;
}

/**
 * Store extracted relationships in database with deduplication
 */
export async function storeRelationships(
  relationships: Relationship[],
  entityNameToIdMap: Map<string, string>,
  userId: string,
  documentId: string,
  chunkId: string
): Promise<void> {
  const supabase = await createClient();

  for (const relationship of relationships) {
    try {
      const sourceEntityId = entityNameToIdMap.get(relationship.source);
      const targetEntityId = entityNameToIdMap.get(relationship.target);

      // Skip if we don't have IDs for both entities
      if (!sourceEntityId || !targetEntityId) {
        console.warn(`[Store Relationship] Missing entity IDs for: ${relationship.source} -> ${relationship.target}`);
        continue;
      }

      // Try to insert (will fail if duplicate due to unique constraint)
      const { error } = await supabase
        .from('relationships')
        .upsert({
          user_id: userId,
          source_entity_id: sourceEntityId,
          target_entity_id: targetEntityId,
          relationship_type: relationship.type,
          description: relationship.description,
          bidirectional: relationship.bidirectional || false,
          document_ids: [documentId],
          chunk_ids: [chunkId],
          extraction_confidence: 0.9,
        }, {
          onConflict: 'user_id,source_entity_id,target_entity_id,relationship_type',
          ignoreDuplicates: false,
        });

      if (error && !error.message.includes('duplicate')) {
        console.error('[Store Relationship] Error:', error);
      }
    } catch (error) {
      console.error(`[Store Relationship] Error storing relationship:`, error);
    }
  }
}

/**
 * Extract and store entities/relationships for a single chunk
 */
export async function processChunkForGraph(
  chunkId: string,
  chunkContent: string,
  documentId: string,
  userId: string
): Promise<{ entityCount: number; relationshipCount: number }> {
  try {
    // Extract entities and relationships
    const extraction = await extractEntitiesAndRelationships(chunkContent);

    // Store entities and get ID mappings
    const entityNameToIdMap = await storeEntities(
      extraction.entities,
      userId,
      documentId,
      chunkId
    );

    // Store relationships
    await storeRelationships(
      extraction.relationships,
      entityNameToIdMap,
      userId,
      documentId,
      chunkId
    );

    return {
      entityCount: extraction.entities.length,
      relationshipCount: extraction.relationships.length,
    };
  } catch (error) {
    console.error('[Process Chunk] Error:', error);
    return { entityCount: 0, relationshipCount: 0 };
  }
}

/**
 * Process all chunks for a document to build its knowledge graph
 */
export async function processDocumentForGraph(
  documentId: string,
  userId: string,
  options?: {
    batchSize?: number;
    onProgress?: (processed: number, total: number) => void;
  }
): Promise<{ totalEntities: number; totalRelationships: number }> {
  const supabase = await createClient();
  const batchSize = options?.batchSize || 5; // Process 5 chunks at a time

  // Get all chunks for this document
  const { data: chunks, error } = await supabase
    .from('chunks')
    .select('id, content')
    .eq('document_id', documentId)
    .eq('user_id', userId)
    .order('chunk_index');

  if (error || !chunks) {
    console.error('[Process Document] Error fetching chunks:', error);
    return { totalEntities: 0, totalRelationships: 0 };
  }

  let totalEntities = 0;
  let totalRelationships = 0;

  // Process chunks in batches
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    
    const results = await Promise.all(
      batch.map(chunk => 
        processChunkForGraph(chunk.id, chunk.content, documentId, userId)
      )
    );

    // Aggregate results
    results.forEach(result => {
      totalEntities += result.entityCount;
      totalRelationships += result.relationshipCount;
    });

    // Report progress
    if (options?.onProgress) {
      options.onProgress(Math.min(i + batchSize, chunks.length), chunks.length);
    }
  }

  console.log(`[Process Document] Extracted ${totalEntities} entities and ${totalRelationships} relationships from ${chunks.length} chunks`);

  return { totalEntities, totalRelationships };
}
