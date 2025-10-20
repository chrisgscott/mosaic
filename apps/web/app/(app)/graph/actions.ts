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
