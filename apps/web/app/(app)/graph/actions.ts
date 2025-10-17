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
