/**
 * Search Signal Logging for Graph Learning
 * 
 * Captures search patterns to discover implicit entity relationships.
 * Part of Phase 1: Search Signal Capture
 */

import { createClient } from "@/lib/supabase/server";

export interface SearchSignalData {
  query: string;
  queryEmbedding: number[];
  chunkIds: string[];
  entityIds?: string[];
  rerankScores?: number[];
}

/**
 * Log a search signal for graph learning analysis
 * 
 * This captures which chunks and entities appear together in search results,
 * enabling later analysis to discover implicit relationships.
 * 
 * @param userId - User ID performing the search
 * @param data - Search signal data (query, results, scores)
 * @returns Promise that resolves when signal is logged (fire-and-forget)
 */
export async function logSearchSignal(
  userId: string,
  data: SearchSignalData
): Promise<void> {
  try {
    const supabase = await createClient();

    // Fire-and-forget: Don't await, don't block search response
    supabase
      .from("search_signals")
      .insert({
        user_id: userId,
        query: data.query,
        query_embedding: data.queryEmbedding,
        chunk_ids: data.chunkIds,
        entity_ids: data.entityIds || [],
        rerank_scores: data.rerankScores || [],
      })
      .then(({ error }) => {
        if (error) {
          console.warn("[Search Signals] Failed to log search signal:", error);
        } else {
          console.log(`[Search Signals] Logged signal for query: "${data.query.substring(0, 50)}..."`);
        }
      });
  } catch (error) {
    // Silent fail - don't break search if logging fails
    console.warn("[Search Signals] Error logging search signal:", error);
  }
}

/**
 * Extract entity IDs from search results
 * 
 * Queries the chunks table to find which entities are mentioned
 * in the returned chunks.
 * 
 * @param chunkIds - Array of chunk IDs from search results
 * @returns Promise resolving to array of entity IDs
 */
export async function extractEntityIdsFromChunks(
  chunkIds: string[]
): Promise<string[]> {
  if (chunkIds.length === 0) return [];

  try {
    const supabase = await createClient();

    // Query chunks to get their entity references
    const { data: chunks, error } = await supabase
      .from("chunks")
      .select("entity_ids")
      .in("id", chunkIds);

    if (error) {
      console.warn("[Search Signals] Error fetching entity IDs:", error);
      return [];
    }

    // Flatten and deduplicate entity IDs
    const entityIds = new Set<string>();
    chunks?.forEach((chunk) => {
      if (chunk.entity_ids && Array.isArray(chunk.entity_ids)) {
        chunk.entity_ids.forEach((id: string) => entityIds.add(id));
      }
    });

    return Array.from(entityIds);
  } catch (error) {
    console.warn("[Search Signals] Error extracting entity IDs:", error);
    return [];
  }
}
