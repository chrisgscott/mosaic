/**
 * Search API - Core RAG Search
 * 
 * Simplified search pipeline:
 * 1. Embed user query
 * 2. Hybrid search (semantic + BM25 with RRF)
 * 3. Cohere reranking
 * 4. Return results
 * 
 * Optional features (disabled by default):
 * - Multi-query expansion
 * - Graph-enhanced search
 * 
 * Removed features:
 * - HyDE (hypothetical document generation) - caused hallucinations
 * - Augmented question processing - now filtered at search time
 */

import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { createProgressEvent, type ProgressCallback } from "@/lib/search-progress";
import { addProgress } from '../chat/[id]/progress/route';
import { graphEnhancedSearch, isRelationshipQuery } from "@/lib/graph/graph-search";
import { authenticateRequest } from "@/lib/api-auth";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ============================================================================
// SETTINGS
// ============================================================================

interface SearchSettings {
  useReranking: boolean;
  useGraphSearch: boolean;
  useMultiQuery: boolean;
}

/**
 * Fetch search settings from database with sensible defaults
 * 
 * Defaults are conservative (features off) to ensure predictable behavior.
 * Enable features explicitly via admin settings.
 */
async function getSearchSettings(supabase: SupabaseClient): Promise<SearchSettings> {
  // Conservative defaults - features off unless explicitly enabled
  const defaults: SearchSettings = {
    useReranking: true,      // Reranking is high-value, low-risk
    useGraphSearch: false,   // Graph search is optional, off by default
    useMultiQuery: false,    // Multi-query adds latency, off by default
  };

  try {
    const { data: settings, error } = await supabase
      .from("system_settings")
      .select("key, value")
      .eq("category", "search");

    if (error || !settings) {
      console.warn("[Settings] Error fetching settings, using defaults:", error);
      return defaults;
    }

    // Map database settings to our interface
    const settingsMap = new Map(
      settings.map((s: { key: string; value: boolean | string }) => [
        s.key,
        s.value === true || s.value === "true"
      ])
    );

    return {
      useReranking: settingsMap.get("search.useReranking") ?? defaults.useReranking,
      useGraphSearch: settingsMap.get("search.useGraphSearch") ?? defaults.useGraphSearch,
      useMultiQuery: settingsMap.get("search.useMultiQuery") ?? defaults.useMultiQuery,
    };
  } catch (error) {
    console.warn("[Settings] Error fetching settings, using defaults:", error);
    return defaults;
  }
}

// ============================================================================
// RERANKING
// ============================================================================

/**
 * Rerank results using Cohere Rerank API
 * 
 * This is the primary quality improvement step - takes hybrid search candidates
 * and reorders them by semantic relevance to the query.
 */
async function rerankResults(query: string, results: SearchResult[]): Promise<SearchResult[]> {
  if (!process.env.COHERE_API_KEY) {
    console.warn("[Rerank] No COHERE_API_KEY found, skipping reranking");
    return results;
  }

  if (results.length === 0) {
    return results;
  }

  try {
    const startTime = Date.now();
    
    const response = await fetch("https://api.cohere.com/v2/rerank", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.COHERE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "rerank-english-v3.0",
        query: query,
        documents: results.map(r => r.content),
        top_n: results.length,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("[Rerank] API error:", error);
      return results;
    }

    const responseData = await response.json();
    const rerankTime = Date.now() - startTime;
    
    console.log(`[Rerank] Completed in ${rerankTime}ms`);

    // Cohere returns: { results: [{ index: 0, relevance_score: 0.95 }, ...] }
    const rerankedResults = responseData.results.map((item: { index: number; relevance_score: number }) => ({
      ...results[item.index],
      rerank_score: item.relevance_score,
    }));

    // Log top results for debugging
    rerankedResults.slice(0, 3).forEach((result: SearchResult, i: number) => {
      console.log(`  ${i + 1}. Score: ${result.rerank_score?.toFixed(3)} | Doc: ${result.document_name}`);
    });

    return rerankedResults;
  } catch (error) {
    console.error("[Rerank] Error:", error);
    return results;
  }
}

// ============================================================================
// TYPES
// ============================================================================

export interface SearchResult {
  chunk_id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  similarity: number;
  bm25_score?: number;
  rrf_score?: number;
  rerank_score?: number;
  document_name: string;
  document_file_type: string;
  // Structural hierarchy fields
  chunk_type?: string;
  parent_chunk_id?: string;
  metadata?: Record<string, unknown>;
  // Source tracking
  graph_source?: boolean;
  id?: string;
}

export interface SearchResponse {
  results: SearchResult[];
  query: string;
  count: number;
  processing_time_ms: number;
}

// ============================================================================
// SEARCH API HANDLER
// ============================================================================

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // 1. Authenticate
    const auth = await authenticateRequest(request);
    if (!auth.authenticated) {
      return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 });
    }

    const supabase = auth.supabase || await createClient();
    const user = auth.user;

    // 2. Load settings
    const settings = await getSearchSettings(supabase);
    
    // 3. Parse request
    const body = await request.json();
    const {
      query,
      session_id,
      match_threshold = 0.5,
      match_count = 10,
      graph_hops = 1,
      // Tool overrides (allow tools to disable features for speed)
      skip_graph_search = false,
      skip_reranking = false,
      force_graph_search = false,
    } = body;

    if (!query || typeof query !== "string") {
      return NextResponse.json(
        { error: "Query parameter is required and must be a string" },
        { status: 400 }
      );
    }

    console.log(`[Search] Query: "${query.substring(0, 50)}..." | session: ${session_id || 'none'}`);

    // Progress helper
    const onProgress: ProgressCallback = (event) => {
      if (session_id) {
        addProgress(session_id, event.message, event.status as 'in-progress' | 'completed');
      }
    };

    // Determine which features to use
    const useReranking = settings.useReranking && !skip_reranking;
    const useGraphSearch = (settings.useGraphSearch || force_graph_search) && !skip_graph_search;

    // 4. Generate query embedding
    onProgress(createProgressEvent('creating-embeddings', 'in-progress'));
    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: query,
      encoding_format: "float",
    });
    const queryEmbedding = embeddingResponse.data[0].embedding;
    onProgress(createProgressEvent('creating-embeddings', 'completed'));

    // 5. Check for session-specific documents
    let filterSessionId: string | null = null;
    if (session_id) {
      const { data: sessionDocs } = await supabase
        .from('documents')
        .select('id, status')
        .eq('session_id', session_id);
      
      const readyDocs = sessionDocs?.filter((d: { status: string }) => d.status === 'ready') || [];
      if (readyDocs.length > 0) {
        filterSessionId = session_id;
        console.log(`[Search] Filtering to ${readyDocs.length} session documents`);
      }
    }

    // 6. Hybrid search (semantic + BM25 with RRF)
    onProgress(createProgressEvent('searching', 'in-progress'));
    const candidateCount = match_count * 2; // Get extra candidates for reranking
    
    const { data: searchData, error: searchError } = await supabase.rpc("search_chunks_hybrid", {
      query_text: query,
      query_embedding: queryEmbedding,
      match_threshold,
      match_count: candidateCount,
      filter_user_id: auth.useServiceRole ? null : user.id,
      filter_session_id: filterSessionId,
      rrf_k: 60,
    });

    if (searchError) {
      console.error("[Search] Database error:", searchError);
      return NextResponse.json(
        { error: "Search failed", details: searchError.message },
        { status: 500 }
      );
    }

    // Filter out AUGMENTED_QUESTION chunks - only return real document chunks
    let results: SearchResult[] = (searchData || []).filter(
      (r: SearchResult) => r.chunk_type !== 'AUGMENTED_QUESTION'
    );
    
    console.log(`[Search] Found ${searchData?.length || 0} candidates, ${results.length} after filtering augmented`);
    onProgress(createProgressEvent('searching', 'completed'));

    // 7. Optional: Graph-enhanced search
    if (useGraphSearch && results.length > 0) {
      const isRelQuery = await isRelationshipQuery(query);
      if (isRelQuery) {
        try {
          onProgress(createProgressEvent('searching-graph', 'in-progress'));
          
          const graphResults = await graphEnhancedSearch({
            query,
            userId: user.id,
            limit: match_count,
            includeRelationships: true,
            maxHops: graph_hops,
            entitySimilarityThreshold: 0.5,
          });

          if (graphResults.relatedChunkIds.length > 0) {
            const { data: graphChunks } = await supabase
              .from('chunks')
              .select(`
                id, content, chunk_index, metadata, chunk_type,
                document:documents!inner(id, file_name, file_type)
              `)
              .in('id', graphResults.relatedChunkIds)
              .neq('chunk_type', 'AUGMENTED_QUESTION')
              .limit(match_count);

            if (graphChunks) {
              const graphSearchResults = graphChunks.map((chunk: {
                id: string;
                content: string;
                chunk_index: number;
                metadata: Record<string, unknown>;
                document: { id: string; file_name: string; file_type: string }[];
              }) => {
                const doc = Array.isArray(chunk.document) ? chunk.document[0] : chunk.document;
                return {
                  chunk_id: chunk.id,
                  content: chunk.content,
                  chunk_index: chunk.chunk_index,
                  metadata: chunk.metadata,
                  document_id: doc.id,
                  document_name: doc.file_name,
                  document_file_type: doc.file_type,
                  similarity: 0.8,
                  rrf_score: 0.015,
                  graph_source: true,
                };
              });

              // Merge and deduplicate
              const merged = [...results, ...graphSearchResults];
              results = Array.from(new Map(merged.map(r => [r.chunk_id, r])).values());
              console.log(`[Graph] Added ${graphSearchResults.length} graph chunks`);
            }
          }
          
          onProgress(createProgressEvent('searching-graph', 'completed'));
        } catch (err) {
          console.error('[Graph] Error:', err);
          // Continue without graph results
        }
      }
    }

    // 8. Rerank results
    if (results.length > 0 && useReranking) {
      onProgress(createProgressEvent('reranking', 'in-progress'));
      results = await rerankResults(query, results);
      onProgress(createProgressEvent('reranking', 'completed'));
    }

    // 9. Limit to requested count
    results = results.slice(0, match_count);

    const processingTime = Date.now() - startTime;
    onProgress(createProgressEvent('complete', 'completed'));

    console.log(`[Search] Returning ${results.length} results in ${processingTime}ms`);

    return NextResponse.json({
      results,
      query,
      count: results.length,
      processing_time_ms: processingTime,
    });

  } catch (error) {
    console.error("[Search] Unexpected error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({
    message: "Search API - Core RAG",
    pipeline: "embed → hybrid search → rerank",
    status: "ready",
  });
}
