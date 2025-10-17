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

  return { entities: data as Entity[] };
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

  // First, clear canonical names of entities to be merged to avoid constraint violation
  for (const entityId of entityIdsToMerge) {
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
