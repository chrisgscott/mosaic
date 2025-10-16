import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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

    // Parse request body
    const body = await request.json();
    const {
      query,
      match_threshold = 0.5,  // Lowered from 0.7 - semantic search typically gets 0.5-0.8 scores
      match_count = 10,
    } = body;

    if (!query || typeof query !== "string") {
      return NextResponse.json(
        { error: "Query parameter is required and must be a string" },
        { status: 400 }
      );
    }

    // Generate embedding for the search query
    console.log(`[Search] Generating embedding for query: "${query}"`);
    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: query,
      encoding_format: "float",
    });

    const queryEmbedding = embeddingResponse.data[0].embedding;
    console.log(`[Search] Generated embedding (${queryEmbedding.length} dimensions)`);

    // Perform hybrid search using RRF (Reciprocal Rank Fusion)
    // Get 2x candidates for reranking to improve final results
    const candidateCount = match_count * 2;
    console.log(`[Search] Hybrid search with threshold=${match_threshold}, candidates=${candidateCount}, user=${user.id}`);
    const { data, error } = await supabase.rpc("search_chunks_hybrid", {
      query_text: query,
      query_embedding: queryEmbedding,
      match_threshold,
      match_count: candidateCount,  // Get more candidates for reranking
      filter_user_id: user.id,
      rrf_k: 60,  // RRF constant
    });

    if (error) {
      console.error("[Search] Database error:", error);
      return NextResponse.json(
        { error: "Search failed", details: error.message },
        { status: 500 }
      );
    }

    console.log(`[Search] Found ${data?.length || 0} hybrid search candidates`);
    
    let finalResults: SearchResult[] = data || [];
    
    // Rerank the candidates to get best final results
    if (finalResults.length > 0) {
      finalResults = await rerankResults(query, finalResults);
      // Limit to requested count after reranking
      finalResults = finalResults.slice(0, match_count);
      
      console.log(`[Search] Final top 3 results after reranking:`);
      finalResults.slice(0, 3).forEach((result, i) => {
        console.log(`  ${i + 1}. Rerank: ${result.rerank_score?.toFixed(3)} | RRF: ${result.rrf_score?.toFixed(4)} | Doc: ${result.document_name}`);
        console.log(`     Preview: ${result.content.substring(0, 80)}...`);
      });
    }

    const processingTime = Date.now() - startTime;

    const response: SearchResponse = {
      results: finalResults,
      query,
      count: finalResults.length,
      processing_time_ms: processingTime,
    };

    return NextResponse.json(response);
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
