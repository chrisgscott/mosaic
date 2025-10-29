"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type Entity = {
  id: string;
  user_id: string;
  name: string;
  type: string;
  description: string | null;
  document_ids: string[];
  chunk_ids: string[];
  canonical_name: string | null;
  aliases: string[];
  metadata: Record<string, unknown>;
  extraction_confidence: number | null;
  created_at: string;
  updated_at: string;
  relationship_count?: number;
};

export type Relationship = {
  id: string;
  user_id: string;
  source_entity_id: string;
  target_entity_id: string;
  relationship_type: string;
  description: string | null;
  document_ids: string[];
  chunk_ids: string[];
  extraction_confidence: number | null;
  created_at: string;
  updated_at: string;
  source?: Entity;
  target?: Entity;
};

export async function getEntities() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "Unauthorized" };
  }

  const { data, error } = await supabase
    .from("entities")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching entities:", error);
    return { error: error.message };
  }

  // Also fetch relationships
  const { data: relationships, error: relError } = await supabase
    .from("relationships")
    .select("*")
    .eq("user_id", user.id);

  if (relError) {
    console.error("Error fetching relationships:", relError);
  }

  return { 
    entities: data as Entity[],
    relationships: relationships || []
  };
}

export async function deleteEntity(entityId: string) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "Unauthorized" };
  }

  // Get the entity to verify ownership
  const { data: entity, error: fetchError } = await supabase
    .from("entities")
    .select("user_id")
    .eq("id", entityId)
    .single();

  if (fetchError || !entity) {
    return { error: "Entity not found" };
  }

  // Verify ownership
  if (entity.user_id !== user.id) {
    return { error: "Unauthorized" };
  }

  // Delete the entity (relationships cascade automatically via foreign keys)
  const { error: dbError } = await supabase
    .from("entities")
    .delete()
    .eq("id", entityId);

  if (dbError) {
    console.error("Database deletion error:", dbError);
    return { error: `Failed to delete entity: ${dbError.message}` };
  }

  revalidatePath("/graph");

  return { success: true };
}

export async function updateEntity(
  entityId: string,
  updates: {
    name?: string;
    type?: string;
    description?: string | null;
    aliases?: string[];
    extraction_confidence?: number;
  }
) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "Unauthorized" };
  }

  // Get the entity to verify ownership
  const { data: entity, error: fetchError } = await supabase
    .from("entities")
    .select("user_id")
    .eq("id", entityId)
    .single();

  if (fetchError || !entity) {
    return { error: "Entity not found" };
  }

  // Verify ownership
  if (entity.user_id !== user.id) {
    return { error: "Unauthorized" };
  }

  // Update canonical_name if name is being updated
  const updateData: Record<string, unknown> = { ...updates };
  if (updates.name) {
    updateData.canonical_name = updates.name.toLowerCase().trim();
  }
  updateData.updated_at = new Date().toISOString();

  // Update the entity
  const { error: updateError } = await supabase
    .from("entities")
    .update(updateData)
    .eq("id", entityId);

  if (updateError) {
    console.error("Update error:", updateError);
    return { error: `Failed to update entity: ${updateError.message}` };
  }

  revalidatePath("/graph");

  return { success: true };
}

export async function bulkUpdateEntityType(
  entityIds: string[],
  newType: string
) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "Unauthorized" };
  }

  if (entityIds.length === 0) {
    return { error: "No entities provided" };
  }

  // Verify all entities belong to the user
  const { data: entities, error: fetchError } = await supabase
    .from("entities")
    .select("id, user_id")
    .in("id", entityIds);

  if (fetchError || !entities) {
    return { error: "Failed to fetch entities" };
  }

  // Check ownership
  const unauthorized = entities.some((entity) => entity.user_id !== user.id);
  if (unauthorized) {
    return { error: "Unauthorized: You don't own all selected entities" };
  }

  // Update all entities
  const { error: updateError } = await supabase
    .from("entities")
    .update({
      type: newType,
      updated_at: new Date().toISOString(),
    })
    .in("id", entityIds);

  if (updateError) {
    console.error("Bulk update error:", updateError);
    return { error: `Failed to update entities: ${updateError.message}` };
  }

  revalidatePath("/graph");

  return { success: true, count: entityIds.length };
}

export async function mergeEntities(
  primaryEntityId: string,
  entityIdsToMerge: string[],
  mergedData: {
    name: string;
    type: string;
    description: string | null;
    aliases: string[];
  }
) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "Unauthorized" };
  }

  // Verify all entities exist and belong to user
  const { data: entitiesToMerge, error: fetchError } = await supabase
    .from("entities")
    .select("*")
    .in("id", [primaryEntityId, ...entityIdsToMerge])
    .eq("user_id", user.id);

  if (fetchError || !entitiesToMerge || entitiesToMerge.length !== entityIdsToMerge.length + 1) {
    return { error: "One or more entities not found" };
  }

  // Collect all document_ids and chunk_ids
  const allDocumentIds = new Set<string>();
  const allChunkIds = new Set<string>();
  const allAliases = new Set<string>(mergedData.aliases);

  entitiesToMerge.forEach((entity) => {
    entity.document_ids?.forEach((id: string) => allDocumentIds.add(id));
    entity.chunk_ids?.forEach((id: string) => allChunkIds.add(id));
    entity.aliases?.forEach((alias: string) => allAliases.add(alias));
    // Add the entity names as aliases
    if (entity.name !== mergedData.name) {
      allAliases.add(entity.name);
    }
  });

  // Check if canonical name is already in use by another entity
  const targetCanonicalName = mergedData.name.toLowerCase().trim();
  const allEntityIds = [primaryEntityId, ...entityIdsToMerge];
  
  const { data: existingEntity } = await supabase
    .from("entities")
    .select("id, name")
    .eq("user_id", user.id)
    .eq("canonical_name", targetCanonicalName)
    .not("id", "in", `(${allEntityIds.join(",")})`)
    .maybeSingle();

  if (existingEntity) {
    return { 
      error: `Cannot merge: Another entity "${existingEntity.name}" already has this name. Please merge with that entity first, or choose a different name.` 
    };
  }

  // First, clear canonical names of ALL entities (including primary) to avoid constraint violation
  for (const entityId of allEntityIds) {
    await supabase
      .from("entities")
      .update({ canonical_name: null })
      .eq("id", entityId);
  }

  // Update primary entity with merged data
  const { error: updateError } = await supabase
    .from("entities")
    .update({
      name: mergedData.name,
      type: mergedData.type,
      description: mergedData.description,
      aliases: Array.from(allAliases),
      document_ids: Array.from(allDocumentIds),
      chunk_ids: Array.from(allChunkIds),
      canonical_name: mergedData.name.toLowerCase().trim(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", primaryEntityId);

  if (updateError) {
    return { error: `Failed to update primary entity: ${updateError.message}` };
  }

  // Update all relationships pointing to merged entities to point to primary entity
  for (const entityId of entityIdsToMerge) {
    // Update source relationships
    await supabase
      .from("relationships")
      .update({ source_entity_id: primaryEntityId })
      .eq("source_entity_id", entityId);

    // Update target relationships
    await supabase
      .from("relationships")
      .update({ target_entity_id: primaryEntityId })
      .eq("target_entity_id", entityId);
  }

  // Delete duplicate relationships (same source, target, and type)
  const { data: relationships } = await supabase
    .from("relationships")
    .select("id, source_entity_id, target_entity_id, relationship_type")
    .or(`source_entity_id.eq.${primaryEntityId},target_entity_id.eq.${primaryEntityId}`);

  if (relationships) {
    const seen = new Set<string>();
    const duplicateIds: string[] = [];

    relationships.forEach((rel) => {
      const key = `${rel.source_entity_id}-${rel.target_entity_id}-${rel.relationship_type}`;
      if (seen.has(key)) {
        duplicateIds.push(rel.id);
      } else {
        seen.add(key);
      }
    });

    if (duplicateIds.length > 0) {
      await supabase.from("relationships").delete().in("id", duplicateIds);
    }
  }

  // Delete the merged entities
  const { error: deleteError } = await supabase
    .from("entities")
    .delete()
    .in("id", entityIdsToMerge);

  if (deleteError) {
    return { error: `Failed to delete merged entities: ${deleteError.message}` };
  }

  revalidatePath("/graph");

  return { success: true, primaryEntityId };
}

// ============================================================================
// Relationship Management Actions
// ============================================================================

export async function getRelationships(filters?: {
  entityId?: string;
  relationshipType?: string;
  searchQuery?: string;
}) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "Unauthorized" };
  }

  let query = supabase
    .from("relationships")
    .select(`
      *,
      source:entities!relationships_source_entity_id_fkey(id, name, type),
      target:entities!relationships_target_entity_id_fkey(id, name, type)
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  // Filter by entity (either source or target)
  if (filters?.entityId) {
    query = query.or(`source_entity_id.eq.${filters.entityId},target_entity_id.eq.${filters.entityId}`);
  }

  // Filter by relationship type
  if (filters?.relationshipType) {
    query = query.eq("relationship_type", filters.relationshipType);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching relationships:", error);
    return { error: error.message };
  }

  // Client-side search filtering if needed
  let relationships = data as Relationship[];
  if (filters?.searchQuery) {
    const search = filters.searchQuery.toLowerCase();
    relationships = relationships.filter(
      (rel) =>
        rel.relationship_type.toLowerCase().includes(search) ||
        rel.description?.toLowerCase().includes(search) ||
        rel.source?.name.toLowerCase().includes(search) ||
        rel.target?.name.toLowerCase().includes(search)
    );
  }

  return { relationships };
}

export async function updateRelationship(
  relationshipId: string,
  updates: {
    relationship_type?: string;
    description?: string | null;
    source_entity_id?: string;
    target_entity_id?: string;
  }
) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "Unauthorized" };
  }

  // Get the relationship to verify ownership
  const { data: relationship, error: fetchError } = await supabase
    .from("relationships")
    .select("user_id, source_entity_id, target_entity_id")
    .eq("id", relationshipId)
    .single();

  if (fetchError || !relationship) {
    return { error: "Relationship not found" };
  }

  // Verify ownership
  if (relationship.user_id !== user.id) {
    return { error: "Unauthorized" };
  }

  // If changing entities, verify they exist and belong to user
  if (updates.source_entity_id || updates.target_entity_id) {
    const entityIds = [
      updates.source_entity_id || relationship.source_entity_id,
      updates.target_entity_id || relationship.target_entity_id,
    ];

    const { data: entities, error: entitiesError } = await supabase
      .from("entities")
      .select("id, user_id")
      .in("id", entityIds)
      .eq("user_id", user.id);

    if (entitiesError || !entities || entities.length !== 2) {
      return { error: "One or both entities not found" };
    }

    // Check for duplicate relationship with new entities
    const sourceId = updates.source_entity_id || relationship.source_entity_id;
    const targetId = updates.target_entity_id || relationship.target_entity_id;
    const relType = updates.relationship_type;

    if (relType) {
      const { data: existing } = await supabase
        .from("relationships")
        .select("id")
        .eq("source_entity_id", sourceId)
        .eq("target_entity_id", targetId)
        .eq("relationship_type", relType)
        .neq("id", relationshipId)
        .maybeSingle();

      if (existing) {
        return { error: "A relationship with this type already exists between these entities" };
      }
    }
  }

  // Update the relationship
  const updateData: Record<string, unknown> = { ...updates };
  updateData.updated_at = new Date().toISOString();

  const { error: updateError } = await supabase
    .from("relationships")
    .update(updateData)
    .eq("id", relationshipId);

  if (updateError) {
    console.error("Update error:", updateError);
    return { error: `Failed to update relationship: ${updateError.message}` };
  }

  revalidatePath("/graph");

  return { success: true };
}

export async function deleteRelationship(relationshipId: string) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "Unauthorized" };
  }

  // Get the relationship to verify ownership
  const { data: relationship, error: fetchError } = await supabase
    .from("relationships")
    .select("user_id")
    .eq("id", relationshipId)
    .single();

  if (fetchError || !relationship) {
    return { error: "Relationship not found" };
  }

  // Verify ownership
  if (relationship.user_id !== user.id) {
    return { error: "Unauthorized" };
  }

  // Delete the relationship
  const { error: deleteError } = await supabase
    .from("relationships")
    .delete()
    .eq("id", relationshipId);

  if (deleteError) {
    console.error("Delete error:", deleteError);
    return { error: `Failed to delete relationship: ${deleteError.message}` };
  }

  revalidatePath("/graph");

  return { success: true };
}

export async function createRelationship(data: {
  source_entity_id: string;
  target_entity_id: string;
  relationship_type: string;
  description?: string | null;
}) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "Unauthorized" };
  }

  // Verify both entities exist and belong to user
  const { data: entities, error: entitiesError } = await supabase
    .from("entities")
    .select("id, user_id")
    .in("id", [data.source_entity_id, data.target_entity_id])
    .eq("user_id", user.id);

  if (entitiesError || !entities || entities.length !== 2) {
    return { error: "One or both entities not found" };
  }

  // Check if relationship already exists
  const { data: existing } = await supabase
    .from("relationships")
    .select("id")
    .eq("source_entity_id", data.source_entity_id)
    .eq("target_entity_id", data.target_entity_id)
    .eq("relationship_type", data.relationship_type)
    .maybeSingle();

  if (existing) {
    return { error: "This relationship already exists" };
  }

  // Create the relationship
  const { data: newRelationship, error: createError } = await supabase
    .from("relationships")
    .insert({
      user_id: user.id,
      source_entity_id: data.source_entity_id,
      target_entity_id: data.target_entity_id,
      relationship_type: data.relationship_type,
      description: data.description || null,
      document_ids: [],
      chunk_ids: [],
      extraction_confidence: null, // Manual relationships have no confidence
    })
    .select()
    .single();

  if (createError) {
    console.error("Create error:", createError);
    return { error: `Failed to create relationship: ${createError.message}` };
  }

  revalidatePath("/graph");

  return { success: true, relationship: newRelationship };
}

export async function bulkCreateRelationships(data: {
  sourceEntityIds: string[];
  targetEntityId: string;
  relationshipType: string;
  description?: string | null;
}) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "Unauthorized" };
  }

  if (data.sourceEntityIds.length === 0) {
    return { error: "No source entities provided" };
  }

  // Verify all entities exist and belong to user
  const allEntityIds = [...data.sourceEntityIds, data.targetEntityId];
  const { data: entities, error: entitiesError } = await supabase
    .from("entities")
    .select("id, user_id")
    .in("id", allEntityIds)
    .eq("user_id", user.id);

  if (entitiesError || !entities || entities.length !== allEntityIds.length) {
    return { error: "One or more entities not found or unauthorized" };
  }

  // Check for existing relationships to avoid duplicates
  const { data: existingRels } = await supabase
    .from("relationships")
    .select("source_entity_id, target_entity_id")
    .in("source_entity_id", data.sourceEntityIds)
    .eq("target_entity_id", data.targetEntityId)
    .eq("relationship_type", data.relationshipType);

  const existingPairs = new Set(
    existingRels?.map((r) => `${r.source_entity_id}-${r.target_entity_id}`) || []
  );

  // Filter out entities that already have this relationship
  const newSourceIds = data.sourceEntityIds.filter(
    (sourceId) => !existingPairs.has(`${sourceId}-${data.targetEntityId}`)
  );

  if (newSourceIds.length === 0) {
    return { error: "All selected entities already have this relationship" };
  }

  // Create relationships for all source entities
  const relationshipsToCreate = newSourceIds.map((sourceId) => ({
    user_id: user.id,
    source_entity_id: sourceId,
    target_entity_id: data.targetEntityId,
    relationship_type: data.relationshipType,
    description: data.description || null,
    document_ids: [],
    chunk_ids: [],
    extraction_confidence: null, // Manual relationships have no confidence
  }));

  const { error: createError } = await supabase
    .from("relationships")
    .insert(relationshipsToCreate);

  if (createError) {
    console.error("Bulk create error:", createError);
    return { error: `Failed to create relationships: ${createError.message}` };
  }

  revalidatePath("/graph");

  const skipped = data.sourceEntityIds.length - newSourceIds.length;
  return {
    success: true,
    count: newSourceIds.length,
    skipped,
  };
}

export async function createEntity(data: {
  name: string;
  type: string;
  description?: string | null;
  chunkIds?: string[];
  documentIds?: string[];
}) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "Unauthorized" };
  }

  // Check if entity with this name already exists
  const { data: existing } = await supabase
    .from("entities")
    .select("id, name")
    .eq("user_id", user.id)
    .ilike("name", data.name)
    .maybeSingle();

  if (existing) {
    return { error: `An entity named "${existing.name}" already exists` };
  }

  // Create the entity
  const { data: newEntity, error: createError } = await supabase
    .from("entities")
    .insert({
      user_id: user.id,
      name: data.name,
      type: data.type,
      description: data.description || null,
      canonical_name: data.name,
      aliases: [],
      document_ids: data.documentIds || [],
      chunk_ids: data.chunkIds || [],
      metadata: data.chunkIds?.length ? { rag_sourced: true } : {},
      extraction_confidence: null, // Manual entities have no confidence
    })
    .select()
    .single();

  if (createError) {
    console.error("Create entity error:", createError);
    return { error: `Failed to create entity: ${createError.message}` };
  }

  revalidatePath("/graph");

  return { success: true, entity: newEntity };
}

export async function generateEntityDescription(data: {
  entityName: string;
  entityType: string;
  existingEntities: Array<{ name: string; type: string }>;
}) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "Unauthorized" };
  }

  try {
    // Get AI settings
    const { data: settings } = await supabase
      .from("llm_settings")
      .select("*")
      .eq("user_id", user.id)
      .single();

    const embeddingModel = settings?.embedding_model || "text-embedding-3-small";

    // Import OpenAI for embeddings (AI SDK doesn't support embeddings yet)
    const { OpenAI } = await import("openai");
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    // Import AI SDK for text generation
    const { generateText } = await import("ai");
    const { models } = await import("@/lib/ai/gateway");

    // Use RAG to find relevant content about this entity
    let ragContext = "";
    let sourceChunkIds: string[] = [];
    let sourceDocumentIds: string[] = [];
    
    try {
      // Generate embedding for the entity name
      const embeddingResponse = await openai.embeddings.create({
        model: embeddingModel,
        input: `${data.entityName} ${data.entityType}`,
      });

      const embedding = embeddingResponse.data[0].embedding;

      // Search for relevant chunks (0.5 threshold for better recall)
      const { data: chunks } = await supabase.rpc("search_chunks", {
        query_embedding: embedding,
        match_threshold: 0.5,
        match_count: 5,
      });

      if (chunks && chunks.length > 0) {
        ragContext = chunks
          .map((chunk: { content: string }) => chunk.content)
          .join("\n\n---\n\n")
          .slice(0, 2000); // Limit context size
        
        // Collect chunk and document IDs
        sourceChunkIds = chunks.map((chunk: { id: string }) => chunk.id);
        sourceDocumentIds = Array.from(
          new Set(chunks.map((chunk: { document_id: string }) => chunk.document_id))
        );
        
        console.log(`[Entity Description] Found ${chunks.length} relevant chunks for "${data.entityName}"`);
      } else {
        console.log(`[Entity Description] No relevant chunks found for "${data.entityName}" - using AI general knowledge`);
      }
    } catch (ragError) {
      console.warn("RAG search failed, falling back to entity-only context:", ragError);
    }

    // Build context about existing entities
    const entityContext = data.existingEntities
      .slice(0, 30) // Reduced since we have RAG context now
      .map((e) => `- ${e.name} (${e.type})`)
      .join("\n");

    const prompt = ragContext
      ? `You are helping to build a knowledge graph. Generate a concise, informative description for the following entity based on the provided context from the user's documents.

Entity Name: ${data.entityName}
Entity Type: ${data.entityType}

Relevant content from documents:
${ragContext}

Other entities in the knowledge graph:
${entityContext}

Based on the document content above, generate a 2-3 sentence description that:
1. Explains what this entity is based on how it's described in the documents
2. Highlights its key characteristics or purpose as mentioned in the content
3. Is specific and grounded in the provided context (not generic)

If the entity is not clearly described in the content, provide a general but informative description based on the entity name and type.

Description:`
      : `You are helping to build a knowledge graph. Generate a concise, informative description for the following entity:

Entity Name: ${data.entityName}
Entity Type: ${data.entityType}

Context - Other entities in the knowledge graph:
${entityContext}

Generate a 2-3 sentence description that:
1. Explains what this entity is
2. Highlights its key characteristics or purpose
3. Is specific and informative (not generic)

Description:`;

    // Use AI SDK for text generation
    const result = await generateText({
      model: models.standard,
      messages: [
        {
          role: "system",
          content: "You are an expert at writing clear, concise entity descriptions for knowledge graphs. Keep descriptions factual and grounded in the provided context.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
    });

    const description = result.text.trim();

    return { 
      success: true, 
      description, 
      usedRag: !!ragContext,
      chunkIds: sourceChunkIds,
      documentIds: sourceDocumentIds,
    };
  } catch (error) {
    console.error("Generate description error:", error);
    return { error: "Failed to generate description" };
  }
}

export async function suggestEntityRelationships(data: {
  entityName: string;
  entityType: string;
  entityDescription?: string;
  existingEntities: Array<{ id: string; name: string; type: string; description?: string | null }>;
}) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "Unauthorized" };
  }

  try {
    // Import AI SDK for text generation
    const { generateText } = await import("ai");
    const { models } = await import("@/lib/ai/gateway");

    // Build context about existing entities
    const entityContext = data.existingEntities
      .slice(0, 100) // Limit to prevent token overflow
      .map((e) => {
        const desc = e.description ? ` - ${e.description.slice(0, 100)}` : "";
        return `- ${e.name} (${e.type})${desc}`;
      })
      .join("\n");

    const prompt = `You are analyzing a knowledge graph to suggest relationships for a new entity.

New Entity:
- Name: ${data.entityName}
- Type: ${data.entityType}
${data.entityDescription ? `- Description: ${data.entityDescription}` : ""}

Existing Entities in Knowledge Graph:
${entityContext}

Analyze the new entity and suggest up to 5 most relevant relationships with existing entities.

For each relationship, provide:
1. target_entity_name: The name of the existing entity (must match exactly from the list above)
2. relationship_type: One of [uses, requires, relates_to, part_of, implements, extends, depends_on, collaborates_with, manages, creates, analyzes, evaluates, other]
3. confidence: A score from 0.0 to 1.0 indicating how confident you are
4. reasoning: Brief explanation of why this relationship makes sense

Only suggest relationships where confidence >= 0.6. Be conservative - only suggest relationships that are clearly supported.

Respond with a JSON array of relationship suggestions:`;

    // Use AI SDK for text generation with JSON output
    const result = await generateText({
      model: models.standard,
      system: "You are an expert at analyzing knowledge graphs and identifying meaningful relationships between entities. Be precise and conservative in your suggestions. Always respond with valid JSON.",
      prompt: prompt,
      temperature: 0.3,
    });

    let content = result.text.trim();
    
    // Remove markdown code fences if present
    if (content.startsWith('```json')) {
      content = content.replace(/^```json\s*\n/, '').replace(/\n```\s*$/, '');
    } else if (content.startsWith('```')) {
      content = content.replace(/^```\s*\n/, '').replace(/\n```\s*$/, '');
    }
    
    const parsed = JSON.parse(content);
    const suggestions = parsed.relationships || parsed.suggestions || [];

    // Validate and map to entity IDs
    const validSuggestions = suggestions
      .filter((s: { target_entity_name?: string; relationship_type?: string; confidence?: number }) => {
        const entity = data.existingEntities.find(
          (e) => e.name.toLowerCase() === s.target_entity_name?.toLowerCase()
        );
        return entity && s.relationship_type && s.confidence && s.confidence >= 0.6;
      })
      .map((s: { target_entity_name: string; relationship_type: string; confidence: number; reasoning?: string }) => {
        const entity = data.existingEntities.find(
          (e) => e.name.toLowerCase() === s.target_entity_name.toLowerCase()
        )!;
        return {
          targetEntityId: entity.id,
          targetEntityName: entity.name,
          targetEntityType: entity.type,
          relationshipType: s.relationship_type,
          confidence: s.confidence,
          reasoning: s.reasoning || "",
        };
      });

    return { success: true, suggestions: validSuggestions };
  } catch (error) {
    console.error("Suggest relationships error:", error);
    return { error: "Failed to suggest relationships" };
  }
}

export async function extractEntitiesFromChunk(data: {
  chunkContent: string;
  chunkId: string;
  documentId: string;
}) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "Unauthorized" };
  }

  try {
    // Import AI SDK for text generation
    const { generateText } = await import("ai");
    const { models } = await import("@/lib/ai/gateway");

    // Use similar prompt to backend graph extraction
    const prompt = `You are an expert at extracting entities from text for knowledge graph construction.

Analyze the following text chunk and extract ONLY the most significant entities.

**ENTITY EXTRACTION RULES:**

Extract MAXIMUM 3-7 entities. ONLY extract proper nouns or significant domain concepts.

**NEVER extract (FORBIDDEN):**
- ❌ ANY number, date, or year
- ❌ ANY dollar amount or price
- ❌ ANY percentage or statistic
- ❌ ANY measurement or quantity
- ❌ ANY technical ID or code
- ❌ Generic descriptors
- ❌ Common industry terms

**ONLY extract (ALLOWED):**
- ✅ Named people
- ✅ Named organizations/companies
- ✅ Specific countries/cities/regions
- ✅ Named minerals/materials/products
- ✅ Named technologies/systems
- ✅ Named events/initiatives
- ✅ Named documents/frameworks/methodologies

For each entity, provide:
1. name: The entity name
2. type: One of [person, organization, location, methodology, framework, tool, concept, program, project, other]
3. description: A brief 1-2 sentence description of what this entity is and why it's significant

Text chunk:
${data.chunkContent}

Respond with a JSON object containing an array of entities:`;

    // Use AI SDK for text generation with JSON output
    const result = await generateText({
      model: models.standard,
      system: "You are an expert at extracting entities from text for knowledge graphs. Be selective and only extract truly significant entities. Always respond with valid JSON.",
      prompt: prompt,
      temperature: 0.3,
    });

    let content = result.text.trim();
    
    // Remove markdown code fences if present
    if (content.startsWith('```json')) {
      content = content.replace(/^```json\s*\n/, '').replace(/\n```\s*$/, '');
    } else if (content.startsWith('```')) {
      content = content.replace(/^```\s*\n/, '').replace(/\n```\s*$/, '');
    }
    
    const parsed = JSON.parse(content);
    const extractedEntities = parsed.entities || [];

    if (extractedEntities.length === 0) {
      return { error: "No significant entities found in this chunk" };
    }

    // Get existing entities to check for duplicates
    const { data: existingEntities } = await supabase
      .from("entities")
      .select("id, name")
      .eq("user_id", user.id);

    const existingNames = new Set(
      existingEntities?.map((e) => e.name.toLowerCase()) || []
    );

    // Filter out entities that already exist and create new ones
    const newEntities = extractedEntities.filter(
      (e: { name: string }) => !existingNames.has(e.name.toLowerCase())
    );

    if (newEntities.length === 0) {
      return { error: "All extracted entities already exist in your knowledge graph" };
    }

    // Create the entities
    const entitiesToCreate = newEntities.map((e: { name: string; type: string; description?: string }) => ({
      user_id: user.id,
      name: e.name,
      type: e.type || "other",
      description: e.description || null,
      canonical_name: e.name,
      aliases: [],
      document_ids: [data.documentId],
      chunk_ids: [data.chunkId],
      metadata: { extracted_from_chunk: true },
      extraction_confidence: 0.8, // Medium-high confidence for manual chunk extraction
    }));

    const { data: createdEntities, error: createError } = await supabase
      .from("entities")
      .insert(entitiesToCreate)
      .select();

    if (createError) {
      console.error("Create entities error:", createError);
      return { error: `Failed to create entities: ${createError.message}` };
    }

    revalidatePath("/graph");

    const skipped = extractedEntities.length - newEntities.length;
    return {
      success: true,
      entities: createdEntities,
      count: createdEntities?.length || 0,
      skipped,
    };
  } catch (error) {
    console.error("Extract entities from chunk error:", error);
    return { error: "Failed to extract entities from chunk" };
  }
}
