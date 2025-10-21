import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import OpenAI from "npm:openai@4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
};

const openai = new OpenAI({
  apiKey: Deno.env.get("OPENAI_API_KEY"),
});

// Fetch system settings from database
async function getSystemSettings(supabase: any): Promise<Record<string, boolean>> {
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

    const settingsObj: Record<string, boolean> = {};
    settings.forEach((setting: any) => {
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
  
  const isComplex = wordCount >= 5 || (hasQuestionWords && wordCount >= 3) || hasComplexStructure;
  console.log(`[HyDE] Query complexity: ${wordCount} words, complex=${isComplex}`);
  return isComplex;
}

// Generate multiple query variations
async function generateMultiQuery(query: string): Promise<string[]> {
  try {
    const startTime = Date.now();
    
    const response = await openai.chat.completions.create({
      model: "gpt-4.1-nano",
      messages: [{
        role: "user",
        content: `Generate 3 different variations of this search query to improve search coverage. Each variation should:
- Rephrase the question differently
- Use different terminology or synonyms
- Approach the topic from a different angle

Original query: "${query}"

Return ONLY the 3 variations, one per line, without numbering or explanation.`
      }],
      temperature: 0.8,
    });

    const text = response.choices[0]?.message?.content || "";
    const variations = text.trim().split('\n').filter(v => v.trim().length > 0).slice(0, 3);
    const multiQueryTime = Date.now() - startTime;
    
    console.log(`[Multi-Query] Generated ${variations.length} variations in ${multiQueryTime}ms`);
    variations.forEach((v, i) => console.log(`  ${i + 1}. ${v}`));
    
    return variations;
  } catch (error) {
    console.error("[Multi-Query] Error generating variations:", error);
    return [query];
  }
}

// Generate hypothetical document for HyDE
async function generateHyDE(query: string): Promise<string> {
  try {
    const startTime = Date.now();
    
    const response = await openai.chat.completions.create({
      model: "gpt-4.1-nano",
      messages: [{
        role: "user",
        content: `You are an expert assistant. Given a user's question, write a detailed, comprehensive answer that would perfectly answer their question. This hypothetical answer will be used to find similar documents.

Question: ${query}

Write a detailed answer (2-3 paragraphs) that would perfectly answer this question. Use specific terminology and concepts that would appear in relevant documents.`
      }],
      temperature: 0.7,
    });

    const text = response.choices[0]?.message?.content || query;
    const hydeTime = Date.now() - startTime;
    console.log(`[HyDE] Generated hypothetical document in ${hydeTime}ms`);
    console.log(`[HyDE] Preview: ${text.substring(0, 150)}...`);
    
    return text;
  } catch (error) {
    console.error("[HyDE] Error generating hypothetical document:", error);
    return query;
  }
}

// Rerank results using Cohere
async function rerankResults(query: string, results: any[]): Promise<any[]> {
  const cohereKey = Deno.env.get("COHERE_API_KEY");
  if (!cohereKey) {
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
        Authorization: `Bearer ${cohereKey}`,
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

    const rerankedResults = responseData.results.map((item: { index: number; relevance_score: number }) => ({
      ...results[item.index],
      rerank_score: item.relevance_score,
    }));

    console.log(`[Rerank] Score changes:`);
    rerankedResults.slice(0, 3).forEach((result: any, i: number) => {
      const originalIndex = results.findIndex(r => r.chunk_id === result.chunk_id);
      console.log(`  ${i + 1}. Rerank: ${result.rerank_score?.toFixed(3)} | RRF: ${result.rrf_score?.toFixed(4)} | Moved from position ${originalIndex + 1}`);
    });

    return rerankedResults;
  } catch (error) {
    console.error("[Rerank] Error:", error);
    return results;
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Authenticate via API key
    const apiKey = req.headers.get("x-api-key");
    const expectedKey = Deno.env.get("MOSAIC_N8N_SEARCH_KEY");
    
    if (!expectedKey) {
      console.error("[Auth] MOSAIC_N8N_SEARCH_KEY not configured");
      return new Response(
        JSON.stringify({ ok: false, error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    if (apiKey !== expectedKey) {
      console.warn("[Auth] Invalid API key attempt");
      return new Response(
        JSON.stringify({ ok: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const body = await req.json();
    const {
      query,
      user_id,
      match_threshold = 0.5,
      match_count = 10,
      graph_hops = 1,
    } = body;

    if (!query || typeof query !== "string") {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing 'query' parameter" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!user_id || typeof user_id !== "string") {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing 'user_id' parameter" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[Search] Query: "${query}" for user: ${user_id}`);

    // Create Supabase client with service role
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const startTime = Date.now();

    // Fetch system settings
    const systemSettings = await getSystemSettings(supabase);
    const use_hyde = systemSettings["search.useHyDE"] ?? true;
    const use_multi_query = systemSettings["search.useMultiQuery"] ?? true;
    const use_reranking = systemSettings["search.useReranking"] ?? true;

    // Smart query enhancement
    const isComplexQuery = shouldUseHyDE(query);
    const useHyDE = use_hyde && isComplexQuery;
    const useMultiQuery = use_multi_query && isComplexQuery;
    
    console.log(`[Settings] useHyDE=${useHyDE}, useMultiQuery=${useMultiQuery}`);

    let finalResults: any[] = [];

    if (isComplexQuery) {
      // Complex query: use HyDE + Multi-Query
      const techniques = [];
      if (useHyDE) techniques.push('HyDE');
      if (useMultiQuery) techniques.push('Multi-Query');
      console.log(`[Search] Complex query - using ${techniques.join(' + ') || 'basic search'}`);

      // Run HyDE and Multi-Query in parallel
      const hydePromise = useHyDE ? generateHyDE(query) : Promise.resolve(query);
      const multiQueryPromise = useMultiQuery ? generateMultiQuery(query) : Promise.resolve([]);
      
      const [hydeDoc, queryVariations] = await Promise.all([
        hydePromise,
        multiQueryPromise,
      ]);

      // Generate embeddings for all queries
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

      // Search with all query variations in parallel
      const candidateCount = match_count * 2;
      console.log(`[Search] Running ${embeddings.length} parallel searches`);
      
      const searchPromises = embeddings.map((embResp, idx) =>
        supabase.rpc("search_chunks_hybrid", {
          query_text: allQueries[idx],
          query_embedding: embResp.data[0].embedding,
          match_threshold,
          match_count: candidateCount,
          filter_user_id: user_id,
          rrf_k: 60,
        })
      );
      
      const searchResults = await Promise.all(searchPromises);
      
      // Check for errors
      const firstError = searchResults.find(r => r.error);
      if (firstError?.error) {
        console.error("[Search] Database error:", firstError.error);
        return new Response(
          JSON.stringify({ ok: false, error: "Search failed", details: firstError.error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Merge and deduplicate results
      const allResults = searchResults.flatMap(r => r.data || []);
      const uniqueResults = Array.from(
        new Map(allResults.map(item => [item.chunk_id, item])).values()
      );
      
      console.log(`[Search] Merged ${allResults.length} results into ${uniqueResults.length} unique chunks`);
      finalResults = uniqueResults;

      // Rerank if enabled
      if (finalResults.length > 0 && use_reranking) {
        finalResults = await rerankResults(query, finalResults);
        finalResults = finalResults.slice(0, match_count);
      } else if (finalResults.length > 0) {
        finalResults = finalResults.slice(0, match_count);
      }
    } else {
      // Simple query: direct embedding
      console.log(`[Search] Simple query, skipping HyDE`);
      const embeddingResponse = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: query,
        encoding_format: "float",
      });
      
      const queryEmbedding = embeddingResponse.data[0].embedding;
      console.log(`[Search] Generated embedding (${queryEmbedding.length} dimensions)`);

      // Hybrid search
      const candidateCount = match_count * 2;
      const { data, error } = await supabase.rpc("search_chunks_hybrid", {
        query_text: query,
        query_embedding: queryEmbedding,
        match_threshold,
        match_count: candidateCount,
        filter_user_id: user_id,
        rrf_k: 60,
      });

      if (error) {
        console.error("[Search] Database error:", error);
        return new Response(
          JSON.stringify({ ok: false, error: "Search failed", details: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[Search] Found ${data?.length || 0} hybrid search candidates`);
      finalResults = data || [];

      // Rerank if enabled
      if (finalResults.length > 0 && use_reranking) {
        finalResults = await rerankResults(query, finalResults);
        finalResults = finalResults.slice(0, match_count);
      } else if (finalResults.length > 0) {
        finalResults = finalResults.slice(0, match_count);
      }
    }

    const processingTime = Date.now() - startTime;

    console.log(`[Search] Returning ${finalResults.length} results in ${processingTime}ms`);

    return new Response(
      JSON.stringify({
        ok: true,
        results: finalResults,
        query,
        count: finalResults.length,
        processing_time_ms: processingTime,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("[Search] Unexpected error:", error);
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
