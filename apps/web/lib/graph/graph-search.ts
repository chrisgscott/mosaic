/**
 * Graph-Enhanced Search for Graph RAG
 * 
 * Combines vector search with graph traversal to provide richer context.
 * Follows R2R's approach: hybrid vector+graph retrieval.
 */

import { createClient } from '@/lib/supabase/server';

// ============================================================================
// TYPES
// ============================================================================

export interface GraphSearchOptions {
  query: string;
  userId: string;
  limit?: number;
  includeRelationships?: boolean;
  maxHops?: number; // How many hops to traverse in the graph
  entitySimilarityThreshold?: number;
}

export interface EntityResult {
  id: string;
  name: string;
  type: string;
  description: string;
  similarity: number;
  documentIds: string[];
  chunkIds: string[];
}

export interface RelationshipResult {
  id: string;
  sourceEntity: EntityResult;
  targetEntity: EntityResult;
  relationshipType: string;
  description: string;
  documentIds: string[];
  chunkIds: string[];
}

export interface GraphSearchResult {
  entities: EntityResult[];
  relationships: RelationshipResult[];
  relatedChunkIds: string[]; // Chunk IDs to retrieve for context
}

// ============================================================================
// GRAPH SEARCH FUNCTIONS
// ============================================================================

/**
 * Search entities using semantic similarity
 */
export async function searchEntitiesSemantic(
  queryEmbedding: number[],
  userId: string,
  options?: {
    limit?: number;
    threshold?: number;
    entityTypes?: string[];
  }
): Promise<EntityResult[]> {
  const supabase = await createClient();
  const limit = options?.limit || 10;
  const threshold = options?.threshold || 0.7;

  try {
    // Use database pgvector similarity search for efficient entity matching
    const { data: entities, error } = await supabase.rpc('search_entities_semantic', {
      query_embedding: queryEmbedding,
      p_user_id: userId,
      similarity_threshold: threshold,
      result_limit: limit,
      entity_types: options?.entityTypes || null
    });

    if (error) {
      console.error('[Search Entities] RPC Error:', error);
      return [];
    }

    if (!entities || entities.length === 0) {
      console.log(`[Search Entities] No entities found above threshold ${threshold}`);
      console.log('[Search Entities] Falling back to get all entities (for debugging)');
      
      // Fallback: Get all entities to see what we have
      const { data: allEntities, error: fallbackError } = await supabase
        .from('entities')
        .select('id, name, type, description, document_ids, chunk_ids')
        .eq('user_id', userId)
        .limit(limit);
      
      if (fallbackError || !allEntities) {
        console.error('[Search Entities] Fallback error:', fallbackError);
        return [];
      }
      
      console.log(`[Search Entities] Fallback found ${allEntities.length} total entities`);
      if (allEntities.length > 0) {
        console.log('[Search Entities] Sample entities:');
        allEntities.slice(0, 5).forEach((e, i) => {
          console.log(`  ${i + 1}. ${e.name} (${e.type})`);
        });
      }
      
      // Return them with default similarity
      return allEntities.map(entity => ({
        id: entity.id,
        name: entity.name,
        type: entity.type,
        description: entity.description || '',
        similarity: 0.6, // Default similarity for fallback
        documentIds: entity.document_ids || [],
        chunkIds: entity.chunk_ids || [],
      }));
    }

    console.log(`[Search Entities] Found ${entities.length} entities via semantic search`);

    return entities.map((entity: any) => ({
      id: entity.id,
      name: entity.name,
      type: entity.type,
      description: entity.description || '',
      similarity: entity.similarity || 0,
      documentIds: entity.document_ids || [],
      chunkIds: entity.chunk_ids || [],
    }));
  } catch (err) {
    console.error('[Search Entities] Exception:', err);
    return [];
  }
}

/**
 * Get relationships for a set of entities (1-hop traversal)
 */
export async function getEntityRelationships(
  entityIds: string[],
  userId: string
): Promise<RelationshipResult[]> {
  if (entityIds.length === 0) return [];

  const supabase = await createClient();

  // Get all relationships where source or target is in our entity set
  const { data: relationships, error } = await supabase
    .from('relationships')
    .select(`
      *,
      source:source_entity_id(id, name, type, description, document_ids, chunk_ids),
      target:target_entity_id(id, name, type, description, document_ids, chunk_ids)
    `)
    .eq('user_id', userId)
    .or(`source_entity_id.in.(${entityIds.join(',')}),target_entity_id.in.(${entityIds.join(',')})`);

  if (error || !relationships) {
    console.error('[Get Relationships] Error:', error);
    return [];
  }

  return relationships.map(rel => ({
    id: rel.id,
    sourceEntity: {
      id: rel.source.id,
      name: rel.source.name,
      type: rel.source.type,
      description: rel.source.description,
      similarity: 0, // Not from similarity search
      documentIds: rel.source.document_ids || [],
      chunkIds: rel.source.chunk_ids || [],
    },
    targetEntity: {
      id: rel.target.id,
      name: rel.target.name,
      type: rel.target.type,
      description: rel.target.description,
      similarity: 0,
      documentIds: rel.target.document_ids || [],
      chunkIds: rel.target.chunk_ids || [],
    },
    relationshipType: rel.relationship_type,
    description: rel.description,
    documentIds: rel.document_ids || [],
    chunkIds: rel.chunk_ids || [],
  }));
}

/**
 * Expand entity search by traversing relationships (multi-hop)
 */
export async function expandEntitiesViaGraph(
  seedEntityIds: string[],
  userId: string,
  maxHops: number = 1
): Promise<Set<string>> {
  const supabase = await createClient();
  const allEntityIds = new Set<string>(seedEntityIds);
  let currentHopIds = seedEntityIds;

  for (let hop = 0; hop < maxHops; hop++) {
    if (currentHopIds.length === 0) break;

    // Get relationships for current hop
    const { data: relationships, error } = await supabase
      .from('relationships')
      .select('source_entity_id, target_entity_id')
      .eq('user_id', userId)
      .or(`source_entity_id.in.(${currentHopIds.join(',')}),target_entity_id.in.(${currentHopIds.join(',')})`);

    if (error || !relationships) {
      console.error('[Expand Entities] Error:', error);
      break;
    }

    // Collect new entity IDs for next hop
    const nextHopIds: string[] = [];
    relationships.forEach(rel => {
      if (!allEntityIds.has(rel.source_entity_id)) {
        allEntityIds.add(rel.source_entity_id);
        nextHopIds.push(rel.source_entity_id);
      }
      if (!allEntityIds.has(rel.target_entity_id)) {
        allEntityIds.add(rel.target_entity_id);
        nextHopIds.push(rel.target_entity_id);
      }
    });

    currentHopIds = nextHopIds;
  }

  return allEntityIds;
}

/**
 * Main graph-enhanced search function
 * 
 * Combines semantic entity search with graph traversal to find relevant context
 */
export async function graphEnhancedSearch(
  options: GraphSearchOptions
): Promise<GraphSearchResult> {
  const {
    query,
    userId,
    limit = 10,
    includeRelationships = true,
    maxHops = 1,
    entitySimilarityThreshold = 0.5, // Lowered from 0.7 for better recall
  } = options;

  try {
    console.log(`[Graph Search] Starting search for query: "${query}"`);
    console.log(`[Graph Search] Threshold: ${entitySimilarityThreshold}, Limit: ${limit}, MaxHops: ${maxHops}`);
    
    // 1. Generate embedding for query
    const queryEmbedding = await generateQueryEmbedding(query);
    console.log(`[Graph Search] Generated query embedding (${queryEmbedding.length} dimensions)`);

    // 2. Search for semantically similar entities
    const entities = await searchEntitiesSemantic(queryEmbedding, userId, {
      limit,
      threshold: entitySimilarityThreshold,
    });

    console.log(`[Graph Search] Found ${entities.length} similar entities`);
    if (entities.length > 0) {
      entities.forEach((e, i) => {
        console.log(`  ${i + 1}. ${e.name} (${e.type}) - similarity: ${e.similarity.toFixed(3)}`);
      });
    }

    if (entities.length === 0) {
      return { entities: [], relationships: [], relatedChunkIds: [] };
    }

    // 3. Optionally expand via graph traversal
    const entityIds = entities.map(e => e.id);
    let expandedEntityIds = new Set(entityIds);

    if (maxHops > 0) {
      expandedEntityIds = await expandEntitiesViaGraph(entityIds, userId, maxHops);
      console.log(`[Graph Search] Expanded to ${expandedEntityIds.size} entities via ${maxHops}-hop traversal`);
    }

    // 4. Get relationships between entities
    let relationships: RelationshipResult[] = [];
    if (includeRelationships) {
      relationships = await getEntityRelationships(Array.from(expandedEntityIds), userId);
      console.log(`[Graph Search] Found ${relationships.length} relationships`);
    }

    // 5. Collect all related chunk IDs for context retrieval
    const relatedChunkIds = new Set<string>();
    
    entities.forEach(entity => {
      entity.chunkIds.forEach(id => relatedChunkIds.add(id));
    });
    
    relationships.forEach(rel => {
      rel.chunkIds.forEach(id => relatedChunkIds.add(id));
    });

    console.log(`[Graph Search] Collected ${relatedChunkIds.size} related chunks`);

    return {
      entities,
      relationships,
      relatedChunkIds: Array.from(relatedChunkIds),
    };
  } catch (error) {
    console.error('[Graph Search] Error:', error);
    return { entities: [], relationships: [], relatedChunkIds: [] };
  }
}

/**
 * Detect if a query is relationship-focused
 */
export function isRelationshipQuery(query: string): boolean {
  const relationshipKeywords = [
    'relate',
    'relationship',
    'connection',
    'link',
    'associate',
    'connect',
    'between',
    'how does',
    'what is the relationship',
    'how are',
    'related to',
  ];

  const lowerQuery = query.toLowerCase();
  return relationshipKeywords.some(keyword => lowerQuery.includes(keyword));
}

/**
 * Detect if a query is entity-focused
 */
export function isEntityQuery(query: string): boolean {
  const entityKeywords = [
    'what is',
    'who is',
    'define',
    'explain',
    'describe',
    'tell me about',
    'information about',
  ];

  const lowerQuery = query.toLowerCase();
  return entityKeywords.some(keyword => lowerQuery.includes(keyword));
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate embedding for query
 */
async function generateQueryEmbedding(query: string): Promise<number[]> {
  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: query,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
  } catch (error) {
    console.error('[Query Embedding] Error:', error);
    throw error;
  }
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
