"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/admin-check";
import { createHash, randomUUID } from "crypto";

/**
 * Hash an API key using SHA256
 */
function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/**
 * Generate a new API key (server-side only)
 */
function generateApiKey(): {
  key: string;
  keyHash: string;
  keyPrefix: string;
} {
  const randomPart = randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "");
  const key = `msk_${randomPart}`;

  return {
    key,
    keyHash: hashApiKey(key),
    keyPrefix: key.substring(0, 12) + "...",
  };
}

/**
 * Create a new API key
 */
export async function createApiKey(data: { name: string; description?: string }) {
  await requireAdmin();

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user) {
    return { error: "Unauthorized" };
  }

  // Generate the key
  const { key, keyHash, keyPrefix } = generateApiKey();

  // Store in database
  const { error } = await supabase.from("api_keys").insert({
    name: data.name.trim(),
    description: data.description?.trim() || null,
    key_hash: keyHash,
    key_prefix: keyPrefix,
    created_by: userData.user.id,
  });

  if (error) {
    console.error("Error creating API key:", error);
    return { error: error.message };
  }

  // Return the full key (only time it's visible)
  return { success: true, key };
}

/**
 * Revoke an API key
 */
export async function revokeApiKey(keyId: string) {
  await requireAdmin();

  const supabase = await createClient();

  const { error } = await supabase
    .from("api_keys")
    .update({ is_active: false })
    .eq("id", keyId);

  if (error) {
    console.error("Error revoking API key:", error);
    return { error: error.message };
  }

  return { success: true };
}
