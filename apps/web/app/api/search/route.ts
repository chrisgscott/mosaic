import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { generateText } from "ai";
import { openai as openaiProvider } from "@ai-sdk/openai";
import { createProgressEvent, type ProgressCallback } from "@/lib/search-progress";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
    
    const { text } = await generateText({
      model: openaiProvider("gpt-4.1-nano"),
      prompt: `Generate 3 different variations of this search query to improve search coverage. Each variation should:
- Rephrase the question differently
- Use different terminology or synonyms
- Approach the topic from a different angle

Original query: "${query}"

Return ONLY the 3 variations, one per line, without numbering or explanation.`,
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
    
    const { text } = await generateText({
      model: openaiProvider("gpt-4.1-nano"),
      prompt: `You are an expert assistant. Given a user's question, write a detailed, comprehensive answer that would perfectly answer their question. This hypothetical answer will be used to find similar documents.

Question: ${query}

Write a detailed answer (2-3 paragraphs) that would perfectly answer this question. Use specific terminology and concepts that would appear in relevant documents.`,
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
      use_hyde = true,  // Enable HyDE by default
    } = body;

    if (!query || typeof query !== "string") {
      return NextResponse.json(
        { error: "Query parameter is required and must be a string" },
        { status: 400 }
      );
    }

    // Progress tracking helper (logs for now, will stream to frontend later)
    const onProgress: ProgressCallback = (event) => {
      console.log(`[Progress] ${event.message} (${event.status})`);
      // TODO: Stream to frontend via SSE when we add streaming support
    };

    // Smart query enhancement: Use HyDE + Multi-Query for complex queries
    const useHyDE = use_hyde && shouldUseHyDE(query);
    
    if (useHyDE) {
      console.log(`[Search] Complex query detected - using HyDE + Multi-Query`);
      onProgress(createProgressEvent('analyzing', 'completed'));
      onProgress(createProgressEvent('generating-variations', 'in-progress'));
      onProgress(createProgressEvent('generating-hyde', 'in-progress'));
      
      // Run HyDE and Multi-Query generation in parallel
      const [hydeDoc, queryVariations] = await Promise.all([
        generateHyDE(query),
        generateMultiQuery(query),
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
      
      // Rerank the candidates
      if (finalResults.length > 0) {
        onProgress(createProgressEvent('reranking', 'in-progress'));
        finalResults = await rerankResults(query, finalResults);
        finalResults = finalResults.slice(0, match_count);
        onProgress(createProgressEvent('reranking', 'completed'));
        
        console.log(`[Search] Final top 3 results after reranking:`);
        finalResults.slice(0, 3).forEach((result, i) => {
          console.log(`  ${i + 1}. Rerank: ${result.rerank_score?.toFixed(3)} | RRF: ${result.rrf_score?.toFixed(4)} | Doc: ${result.document_name}`);
          console.log(`     Preview: ${result.content.substring(0, 80)}...`);
        });
      }
      
      const processingTime = Date.now() - startTime;
      onProgress(createProgressEvent('complete', 'completed'));
      
      return NextResponse.json({
        results: finalResults,
        query,
        count: finalResults.length,
        processing_time_ms: processingTime,
      });
    } else {
      // Simple query: skip HyDE, use direct embedding
      console.log(`[Search] Simple query, skipping HyDE`);
      const embeddingResponse = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: query,
        encoding_format: "float",
      });
      
      const queryEmbedding = embeddingResponse.data[0].embedding;
      console.log(`[Search] Generated embedding (${queryEmbedding.length} dimensions)`);
      
      // Perform hybrid search
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
