import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface SearchResult {
  chunk_id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  similarity: number;
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

    // Perform semantic search using the database function
    console.log(`[Search] Searching with threshold=${match_threshold}, count=${match_count}, user=${user.id}`);
    const { data, error } = await supabase.rpc("search_chunks_semantic", {
      query_embedding: queryEmbedding,
      match_threshold,
      match_count,
      filter_user_id: user.id,
    });

    if (error) {
      console.error("[Search] Database error:", error);
      return NextResponse.json(
        { error: "Search failed", details: error.message },
        { status: 500 }
      );
    }

    console.log(`[Search] Found ${data?.length || 0} results`);
    if (data && data.length > 0) {
      console.log(`[Search] Top result similarity: ${data[0].similarity}`);
      console.log(`[Search] Top result preview: ${data[0].content.substring(0, 100)}...`);
    } else {
      // Debug: Try with lower threshold to see if we get ANY results
      console.log(`[Search] No results with threshold ${match_threshold}, trying with 0.0...`);
      const { data: debugData } = await supabase.rpc("search_chunks_semantic", {
        query_embedding: queryEmbedding,
        match_threshold: 0.0,
        match_count: 3,
        filter_user_id: user.id,
      });
      if (debugData && debugData.length > 0) {
        console.log(`[Search] DEBUG: Found ${debugData.length} results with threshold=0.0`);
        console.log(`[Search] DEBUG: Best similarity score: ${debugData[0].similarity}`);
      } else {
        console.log(`[Search] DEBUG: Still no results even with threshold=0.0 - checking embeddings exist...`);
      }
    }

    const processingTime = Date.now() - startTime;

    const response: SearchResponse = {
      results: data || [],
      query,
      count: data?.length || 0,
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
