import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { generateText } from 'ai';
import { getModelForDepth, type ModelDepth } from '@/lib/ai/gateway';
import { getPrompt } from '@/lib/ai/prompts';
import { createProgressEvent, type ProgressCallback } from "@/lib/search-progress";
import { addProgress } from '../chat/[id]/progress/route';
import { graphEnhancedSearch, isRelationshipQuery } from "@/lib/graph/graph-search";
import { logSearchSignal } from "@/lib/graph/search-signals";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Fetch system settings from database
async function getSystemSettings(supabase: SupabaseClient): Promise<Record<string, boolean>> {
  try {
    const { data: settings, error } = await supabase
      .from("system_settings")
      .select("key, value")
      .in("category", ["search"]);

    if (error) {
      console.warn("[Settings] Error fetching settings, using defaults:", error);
      return {
        "search.useHyDE": true,
        "search.useMultiQuery": true,
        "search.useReranking": true,
        "search.useGraphSearch": true,
      };
    }

    // Convert to key-value object with boolean values
    const settingsObj: Record<string, boolean> = {};
    settings.forEach((setting: { key: string; value: boolean | string }) => {
      // Handle both boolean and string "true"/"false" values
      settingsObj[setting.key] = setting.value === true || setting.value === "true";
    });

    console.log("[Settings] Loaded system settings:", settingsObj);
    return settingsObj;
  } catch (error) {
    console.warn("[Settings] Error fetching settings, using defaults:", error);
    return {
      "search.useHyDE": true,
      "search.useMultiQuery": true,
      "search.useReranking": true,
      "search.useGraphSearch": true,
    };
  }
}

// Detect if query is complex enough to benefit from HyDE
function shouldUseHyDE(query: string): boolean {
  const wordCount = query.trim().split(/\s+/).length;
  const hasQuestionWords = /\b(how|why|what|when|where|which|explain|describe|compare|difference)\b/i.test(query);
  const hasComplexStructure = query.includes('?') || query.includes(',') || query.includes('and') || query.includes('or');
  
  // Use HyDE for:
  // - Questions with 5+ words
  // - Queries with question words (how, why, etc.)
  // - Complex multi-part queries
  const isComplex = wordCount >= 5 || (hasQuestionWords && wordCount >= 3) || hasComplexStructure;
  
  console.log(`[HyDE] Query complexity: ${wordCount} words, complex=${isComplex}`);
  return isComplex;
}

// Multi-Query: Generate multiple query variations for better coverage
async function generateMultiQuery(query: string): Promise<string[]> {
  try {
    const startTime = Date.now();
    
    // Get multi-query prompt from settings
    const prompt = await getPrompt('multiQuery', { query });
    
    const { text } = await generateText({
      model: await getModelForDepth('quick' as ModelDepth),
      prompt,
      temperature: 0.8,
    });

    const variations = text.trim().split('\n').filter(v => v.trim().length > 0).slice(0, 3);
    const multiQueryTime = Date.now() - startTime;
    
    console.log(`[Multi-Query] Generated ${variations.length} variations in ${multiQueryTime}ms`);
    variations.forEach((v, i) => console.log(`  ${i + 1}. ${v}`));
    
    return variations;
  } catch (error) {
    console.error("[Multi-Query] Error generating variations:", error);
    // Fallback to original query only
    return [query];
  }
}

// HyDE: Generate hypothetical document for better retrieval
async function generateHyDE(query: string): Promise<string> {
  try {
    const startTime = Date.now();
    
    // Get HyDE prompt from settings
    const prompt = await getPrompt('hyde', { query });
    
    const { text } = await generateText({
      model: await getModelForDepth('quick' as ModelDepth),
      prompt,
      temperature: 0.7,
    });

    const hydeTime = Date.now() - startTime;
    console.log(`[HyDE] Generated hypothetical document in ${hydeTime}ms`);
    console.log(`[HyDE] Preview: ${text.substring(0, 150)}...`);
    
    return text;
  } catch (error) {
    console.error("[HyDE] Error generating hypothetical document:", error);
    // Fallback to original query
    return query;
  }
}

// Process augmented question results - replace with parent chunks
async function processAugmentedResults(supabase: SupabaseClient, results: SearchResult[]): Promise<SearchResult[]> {
  // Find all AUGMENTED_QUESTION results
  const augmentedResults = results.filter(r => r.chunk_type === 'AUGMENTED_QUESTION');
  
  if (augmentedResults.length === 0) {
    return results; // No augmented questions, return as-is
  }
  
  console.log(`[Augmentation] Found ${augmentedResults.length} augmented question matches, fetching parent chunks`);
  
  // Get parent chunk IDs
  const parentChunkIds = augmentedResults
    .map(r => r.parent_chunk_id)
    .filter((id): id is string => id !== null && id !== undefined);
  
  if (parentChunkIds.length === 0) {
    return results;
  }
  
  // Fetch parent chunks
  const { data: parentChunks, error } = await supabase
    .from('chunks')
    .select('*')
    .in('id', parentChunkIds);
  
  if (error) {
    console.error("[Augmentation] Error fetching parent chunks:", error);
    return results; // Fallback to original results
  }
  
  // Create a map of parent chunks by ID
  const parentChunkMap = new Map(parentChunks?.map(chunk => [chunk.id, chunk]) || []);
  
  // Replace augmented questions with their parent chunks
  const processedResults = results.map(result => {
    if (result.chunk_type === 'AUGMENTED_QUESTION' && result.parent_chunk_id) {
      const parentChunk = parentChunkMap.get(result.parent_chunk_id);
      if (parentChunk) {
        console.log(`[Augmentation] Replaced question "${result.content.substring(0, 50)}..." with parent chunk`);
        // Return parent chunk but preserve the rerank score from the question match
        return {
          ...parentChunk,
          rerank_score: result.rerank_score,
          rrf_score: result.rrf_score,
          matched_via_question: true, // Flag to indicate this was matched via a question
        };
      }
    }
    return result;
  });
  
  // Remove duplicates (same parent chunk matched by multiple questions)
  const uniqueResults = Array.from(
    new Map(processedResults.map(r => [r.chunk_id || r.id, r])).values()
  );
  
  console.log(`[Augmentation] Processed ${results.length} results → ${uniqueResults.length} unique chunks`);
  
  return uniqueResults;
}

// Rerank results using Cohere Rerank API
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
    
    const response = await fetch(
      "https://api.cohere.com/v2/rerank",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.COHERE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "rerank-english-v3.0",
          query: query,
          documents: results.map(r => r.content),
          top_n: results.length, // Return all, we'll slice later
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("[Rerank] API error:", error);
      return results; // Fallback to original results
    }

    const responseData = await response.json();
    const rerankTime = Date.now() - startTime;
    
    console.log(`[Rerank] Completed in ${rerankTime}ms`);

    // Cohere returns: { results: [{ index: 0, relevance_score: 0.95 }, ...] }
    const rerankedResults = responseData.results.map((item: { index: number; relevance_score: number }) => ({
      ...results[item.index],
      rerank_score: item.relevance_score,
    }));

    console.log(`[Rerank] Score changes:`);
    rerankedResults.slice(0, 3).forEach((result: SearchResult, i: number) => {
      const originalIndex = results.findIndex(r => r.chunk_id === result.chunk_id);
      console.log(`  ${i + 1}. Rerank: ${result.rerank_score?.toFixed(3)} | RRF: ${result.rrf_score?.toFixed(4)} | Moved from position ${originalIndex + 1}`);
    });

    return rerankedResults;
  } catch (error) {
    console.error("[Rerank] Error:", error);
    return results; // Fallback to original results
  }
}

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
  chunk_type?: string;  // 'ORIGINAL' or 'AUGMENTED_QUESTION'
  parent_chunk_id?: string;  // For AUGMENTED_QUESTION chunks
  matched_via_question?: boolean;  // Flag when result was matched via augmented question
  id?: string;  // Chunk ID (alternative to chunk_id)
}

export interface SearchResponse {
  results: SearchResult[];
  query: string;
  count: number;
  processing_time_ms: number;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const supabase = await createClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch system settings
    const systemSettings = await getSystemSettings(supabase);
    
    // Parse request body
    const body = await request.json();
    const {
      query,
      session_id,  // Optional session ID for SSE progress streaming
      match_threshold = 0.5,  // Lowered from 0.7 - semantic search typically gets 0.5-0.8 scores
      match_count = 10,
      graph_hops = 1,    // Number of hops for graph traversal
      // Tool-specific overrides
      skip_multi_query = false,
      skip_graph_search = false,
      skip_reranking = false,
      force_graph_search = false,
      extended_graph_traversal = false,
    } = body;
    
    // System settings take precedence over request body
    const use_hyde = systemSettings["search.useHyDE"] ?? true;
    let use_multi_query = systemSettings["search.useMultiQuery"] ?? true;
    let use_reranking = systemSettings["search.useReranking"] ?? true;
    let use_graph = systemSettings["search.useGraphSearch"] ?? true;
    
    // Apply tool-specific overrides
    if (skip_multi_query) use_multi_query = false;
    if (skip_graph_search) use_graph = false;
    if (skip_reranking) use_reranking = false;
    if (force_graph_search) use_graph = true;
    
    // Use extended graph hops if requested
    const effective_graph_hops = extended_graph_traversal ? Math.max(graph_hops, 3) : graph_hops;

    if (!query || typeof query !== "string") {
      return NextResponse.json(
        { error: "Query parameter is required and must be a string" },
        { status: 400 }
      );
    }

    // Progress tracking helper with SSE streaming
    const onProgress: ProgressCallback = (event) => {
      console.log(`[Progress] ${event.message} (${event.status})`);
      
      // Stream to frontend via SSE if session_id is provided
      if (session_id) {
        addProgress(session_id, event.message, event.status as 'in-progress' | 'completed');
      }
    };

    // Detect if this is a relationship query that would benefit from graph search
    const isRelQuery = use_graph && await isRelationshipQuery(query);
    if (isRelQuery) {
      console.log(`[Graph] Relationship query detected - will use graph search`);
    }

    // Smart query enhancement: Use HyDE + Multi-Query for complex queries
    const isComplexQuery = shouldUseHyDE(query);
    const useHyDE = use_hyde && isComplexQuery;
    const useMultiQuery = use_multi_query && isComplexQuery;
    
    console.log(`[Settings] use_hyde=${use_hyde}, use_multi_query=${use_multi_query}, isComplexQuery=${isComplexQuery}`);
    console.log(`[Settings] Final: useHyDE=${useHyDE}, useMultiQuery=${useMultiQuery}`);
    
    if (isComplexQuery) {
      const techniques = [];
      if (useHyDE) techniques.push('HyDE');
      if (useMultiQuery) techniques.push('Multi-Query');
      
      console.log(`[Search] Complex query detected - using ${techniques.join(' + ') || 'basic search'}`);
      onProgress(createProgressEvent('analyzing', 'completed'));
      
      if (useMultiQuery) {
        onProgress(createProgressEvent('generating-variations', 'in-progress'));
      }
      if (useHyDE) {
        onProgress(createProgressEvent('generating-hyde', 'in-progress'));
      }
      
      // Run HyDE and Multi-Query generation in parallel (if enabled)
      const hydePromise = useHyDE ? generateHyDE(query) : Promise.resolve(query);
      const multiQueryPromise = useMultiQuery ? generateMultiQuery(query) : Promise.resolve([]);
      
      const [hydeDoc, queryVariations] = await Promise.all([
        hydePromise,
        multiQueryPromise,
      ]);
      
      onProgress(createProgressEvent('generating-variations', 'completed'));
      onProgress(createProgressEvent('generating-hyde', 'completed'));
      
      // Generate embeddings for all queries in parallel
      onProgress(createProgressEvent('creating-embeddings', 'in-progress'));
      const allQueries = [hydeDoc, ...queryVariations];
      console.log(`[Search] Generating embeddings for ${allQueries.length} query variations`);
      
      const embeddingPromises = allQueries.map(q =>
        openai.embeddings.create({
          model: "text-embedding-3-small",
          input: q,
          encoding_format: "float",
        })
      );
      
      const embeddings = await Promise.all(embeddingPromises);
      onProgress(createProgressEvent('creating-embeddings', 'completed'));
      
      // Search with all query variations in parallel
      onProgress(createProgressEvent('searching', 'in-progress'));
      const candidateCount = match_count * 2;
      console.log(`[Search] Running ${embeddings.length} parallel searches`);
      
      const searchPromises = embeddings.map((embResp, idx) =>
        supabase.rpc("search_chunks_hybrid", {
          query_text: allQueries[idx],
          query_embedding: embResp.data[0].embedding,
          match_threshold,
          match_count: candidateCount,
          filter_user_id: user.id,
          rrf_k: 60,
        })
      );
      
      const searchResults = await Promise.all(searchPromises);
      
      // Check for errors
      const firstError = searchResults.find(r => r.error);
      if (firstError?.error) {
        console.error("[Search] Database error:", firstError.error);
        return NextResponse.json(
          { error: "Search failed", details: firstError.error.message },
          { status: 500 }
        );
      }
      
      onProgress(createProgressEvent('searching', 'completed'));
      
      // Merge and deduplicate results from all searches
      onProgress(createProgressEvent('merging-results', 'in-progress'));
      const allResults = searchResults.flatMap(r => r.data || []);
      const uniqueResults = Array.from(
        new Map(allResults.map(item => [item.chunk_id, item])).values()
      );
      
      console.log(`[Search] Merged ${allResults.length} results into ${uniqueResults.length} unique chunks`);
      onProgress(createProgressEvent('merging-results', 'completed'));
      
      console.log(`[Search] Found ${uniqueResults.length} unique hybrid search candidates`);
      
      let finalResults: SearchResult[] = uniqueResults;
      
      // Run graph search if this is a relationship query
      if (isRelQuery) {
        try {
          onProgress(createProgressEvent('searching-graph', 'in-progress'));
          console.log(`[Graph] Running graph-enhanced search`);
          
          const graphResults = await graphEnhancedSearch({
            query,
            userId: user.id,
            limit: match_count,
            includeRelationships: true,
            maxHops: effective_graph_hops,
            entitySimilarityThreshold: 0.5, // Lowered for better entity matching
          });
          
          console.log(`[Graph] Found ${graphResults.entities.length} entities, ${graphResults.relationships.length} relationships`);
          
          // If graph found related chunks, fetch them and add to results
          if (graphResults.relatedChunkIds.length > 0) {
            onProgress(createProgressEvent('expanding-graph', 'in-progress'));
            console.log(`[Graph] Fetching ${graphResults.relatedChunkIds.length} related chunks`);
            
            const { data: graphChunks, error: graphError } = await supabase
              .from('chunks')
              .select(`
                id,
                content,
                chunk_index,
                token_count,
                metadata,
                document:documents!inner(
                  id,
                  file_name,
                  file_type
                )
              `)
              .in('id', graphResults.relatedChunkIds)
              .limit(match_count);
            
            if (!graphError && graphChunks) {
              // Add graph chunks to results with a graph_source flag
              const graphSearchResults = graphChunks.map((chunk: {
                id: string;
                content: string;
                chunk_index: number;
                token_count: number;
                metadata: Record<string, unknown>;
                document: { id: string; file_name: string; file_type: string }[];
              }) => {
                const doc = Array.isArray(chunk.document) ? chunk.document[0] : chunk.document;
                return {
                  chunk_id: chunk.id,
                  content: chunk.content,
                  chunk_index: chunk.chunk_index,
                  token_count: chunk.token_count,
                  metadata: chunk.metadata,
                  document_id: doc.id,
                  document_name: doc.file_name,
                  document_file_type: doc.file_type,
                  similarity: 0.9,
                  rrf_score: 0.02,
                  graph_source: true,
                };
              });
              
              // Merge with vector search results, deduplicate
              const mergedResults = [...finalResults, ...graphSearchResults];
              finalResults = Array.from(
                new Map(mergedResults.map(item => [item.chunk_id, item])).values()
              );
              
              console.log(`[Graph] Added ${graphSearchResults.length} graph chunks, total now ${finalResults.length}`);
            }
            
            onProgress(createProgressEvent('expanding-graph', 'completed'));
          }
          
          onProgress(createProgressEvent('searching-graph', 'completed'));
        } catch (graphError) {
          console.error('[Graph] Error during graph search:', graphError);
          // Continue with vector-only results if graph search fails
        }
      }
      
      // Rerank the candidates (if enabled)
      if (finalResults.length > 0 && use_reranking) {
        onProgress(createProgressEvent('reranking', 'in-progress'));
        finalResults = await rerankResults(query, finalResults);
        finalResults = finalResults.slice(0, match_count);
        onProgress(createProgressEvent('reranking', 'completed'));
      } else if (finalResults.length > 0) {
        // Just limit to match_count if reranking is disabled
        finalResults = finalResults.slice(0, match_count);
        
        console.log(`[Search] Final top 3 results after reranking:`);
        finalResults.slice(0, 3).forEach((result, i) => {
          console.log(`  ${i + 1}. Rerank: ${result.rerank_score?.toFixed(3)} | RRF: ${result.rrf_score?.toFixed(4)} | Doc: ${result.document_name}`);
          console.log(`     Preview: ${result.content.substring(0, 80)}...`);
        });
      }
      
      // Process augmented question results - replace with parent chunks
      if (finalResults.length > 0) {
        finalResults = await processAugmentedResults(supabase, finalResults);
      }
      
      const processingTime = Date.now() - startTime;
      onProgress(createProgressEvent('complete', 'completed'));
      
      // Log search signal for graph learning (complex query path)
      // Use the first embedding (original query) for the signal
      try {
        const originalQueryEmbedding = embeddings[0].data[0].embedding;
        await logSearchSignal(user.id, {
          query,
          queryEmbedding: originalQueryEmbedding,
          chunkIds: finalResults.map(r => r.chunk_id),
          rerankScores: finalResults.map(r => r.rerank_score || 0),
        });
      } catch (err) {
        console.error("[Search] Failed to log search signal:", err);
        // Don't fail the search if logging fails
      }
      
      return NextResponse.json({
        results: finalResults,
        query,
        count: finalResults.length,
        processing_time_ms: processingTime,
      });
    } else {
      // Simple query: skip HyDE, use direct embedding
      console.log(`[Search] Simple query, skipping HyDE`);
      onProgress(createProgressEvent('analyzing', 'completed'));
      
      onProgress(createProgressEvent('creating-embeddings', 'in-progress'));
      const embeddingResponse = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: query,
        encoding_format: "float",
      });
      
      const queryEmbedding = embeddingResponse.data[0].embedding;
      console.log(`[Search] Generated embedding (${queryEmbedding.length} dimensions)`);
      onProgress(createProgressEvent('creating-embeddings', 'completed'));
      
      // Perform hybrid search
      onProgress(createProgressEvent('searching', 'in-progress'));
      const candidateCount = match_count * 2;
      console.log(`[Search] Hybrid search with threshold=${match_threshold}, candidates=${candidateCount}, user=${user.id}`);
      const { data, error } = await supabase.rpc("search_chunks_hybrid", {
        query_text: query,
        query_embedding: queryEmbedding,
        match_threshold,
        match_count: candidateCount,
        filter_user_id: user.id,
        rrf_k: 60,
      });

      if (error) {
        console.error("[Search] Database error:", error);
        return NextResponse.json(
          { error: "Search failed", details: error.message },
          { status: 500 }
        );
      }

      console.log(`[Search] Found ${data?.length || 0} hybrid search candidates`);
      onProgress(createProgressEvent('searching', 'completed'));
      
      let finalResults: SearchResult[] = data || [];
      
      // Rerank the candidates to get best final results (if enabled)
      if (finalResults.length > 0 && use_reranking) {
        onProgress(createProgressEvent('reranking', 'in-progress'));
        finalResults = await rerankResults(query, finalResults);
        // Limit to requested count after reranking
        finalResults = finalResults.slice(0, match_count);
        onProgress(createProgressEvent('reranking', 'completed'));
      } else if (finalResults.length > 0) {
        // Just limit to match_count if reranking is disabled
        finalResults = finalResults.slice(0, match_count);
        
        console.log(`[Search] Final top 3 results after reranking:`);
        finalResults.slice(0, 3).forEach((result, i) => {
          console.log(`  ${i + 1}. Rerank: ${result.rerank_score?.toFixed(3)} | RRF: ${result.rrf_score?.toFixed(4)} | Doc: ${result.document_name}`);
          console.log(`     Preview: ${result.content.substring(0, 80)}...`);
        });
      }

      // Process augmented question results - replace with parent chunks
      if (finalResults.length > 0) {
        finalResults = await processAugmentedResults(supabase, finalResults);
      }

      const processingTime = Date.now() - startTime;
      onProgress(createProgressEvent('complete', 'completed'));

      // Log search signal for graph learning
      // Note: We await this to ensure it completes in serverless environment
      try {
        await logSearchSignal(user.id, {
          query,
          queryEmbedding: queryEmbedding,
          chunkIds: finalResults.map(r => r.chunk_id),
          rerankScores: finalResults.map(r => r.rerank_score || 0),
          // Entity IDs will be extracted asynchronously in the background
        });
      } catch (err) {
        console.error("[Search] Failed to log search signal:", err);
        // Don't fail the search if logging fails
      }

      return NextResponse.json({
        results: finalResults,
        query,
        count: finalResults.length,
        processing_time_ms: processingTime,
      });
    }
  } catch (error) {
    console.error("Unexpected error in search:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// Optional: GET endpoint for testing
export async function GET() {
  return NextResponse.json({
    message: "Semantic search API",
    usage: "POST /api/search with { query: string, match_threshold?: number, match_count?: number }",
    status: "ready",
  });
}
