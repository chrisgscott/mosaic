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
      match_threshold = 0.7,
      match_count = 10,
    } = body;

    if (!query || typeof query !== "string") {
      return NextResponse.json(
        { error: "Query parameter is required and must be a string" },
        { status: 400 }
      );
    }

    // Generate embedding for the search query
    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: query,
      encoding_format: "float",
    });

    const queryEmbedding = embeddingResponse.data[0].embedding;

    // Perform semantic search using the database function
    const { data, error } = await supabase.rpc("search_chunks_semantic", {
      query_embedding: queryEmbedding,
      match_threshold,
      match_count,
      filter_user_id: user.id,
    });

    if (error) {
      console.error("Search error:", error);
      return NextResponse.json(
        { error: "Search failed", details: error.message },
        { status: 500 }
      );
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
