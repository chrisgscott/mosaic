import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * POST /api/proposal/context
 * 
 * Returns relevant chunks and graph entities/relationships for prompt enrichment.
 * 
 * Request body:
 * {
 *   "query": string,
 *   "max_chunks"?: number (default: 10),
 *   "max_entities"?: number (default: 5),
 *   "session_id"?: string
 * }
 * 
 * Response:
 * {
 *   "chunks": Array<{ content: string, similarity: number, metadata: object }>,
 *   "entities": Array<{ name: string, type: string, summary: string }>,
 *   "relationships": Array<{ source: string, target: string, type: string }>
 * }
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Authenticate user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.error("[Context] Authentication failed:", authError);
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { 
      query, 
      max_chunks = 10, 
      max_entities = 5,
      session_id 
    } = body;

    // Validate inputs
    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: "Missing or invalid query" },
        { status: 400 }
      );
    }

    console.log(`[Context] Retrieving context for query: "${query.substring(0, 100)}..."`);

    // Generate embedding for query
    const embeddingStart = Date.now();
    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: query,
    });
    const queryEmbedding = embeddingResponse.data[0].embedding;
    console.log(`[Context] Generated embedding in ${Date.now() - embeddingStart}ms`);

    // Search for relevant chunks using hybrid search
    const searchParams: Record<string, any> = {
      query_text: query,
      query_embedding: queryEmbedding,
      match_count: max_chunks,
      match_threshold: 0.5,
    };

    if (session_id) {
      searchParams.filter_session_id = session_id;
    }

    const chunksStart = Date.now();
    const { data: chunks, error: searchError } = await supabase
      .rpc('search_chunks_hybrid', searchParams);

    if (searchError) {
      console.error("[Context] Chunk search error:", searchError);
      return NextResponse.json(
        { error: "Error searching chunks" },
        { status: 500 }
      );
    }

    console.log(`[Context] Retrieved ${chunks?.length || 0} chunks in ${Date.now() - chunksStart}ms`);

    // Format chunks with metadata
    const formattedChunks = (chunks || []).map((chunk: any) => ({
      content: chunk.content,
      similarity: chunk.similarity,
      metadata: {
        document_id: chunk.document_id,
        chunk_index: chunk.chunk_index,
      },
    }));

    // Search for relevant entities
    const entitiesStart = Date.now();
    let entityQuery = supabase
      .from('entities')
      .select('name, entity_type, summary')
      .or(`name.ilike.%${query}%,summary.ilike.%${query}%`)
      .limit(max_entities);

    if (session_id) {
      entityQuery = entityQuery.eq('session_id', session_id);
    }

    const { data: entities, error: entityError } = await entityQuery;

    if (entityError) {
      console.error("[Context] Entity search error:", entityError);
    }

    console.log(`[Context] Retrieved ${entities?.length || 0} entities in ${Date.now() - entitiesStart}ms`);

    // Get relationships for found entities
    const relationshipsStart = Date.now();
    const relationships: Array<{ source: string; target: string; type: string }> = [];
    
    if (entities && entities.length > 0) {
      const entityNames = entities.map(e => e.name);
      
      const { data: rels, error: relError } = await supabase
        .from('relationships')
        .select('source_entity_name, target_entity_name, relationship_type')
        .or(`source_entity_name.in.(${entityNames.join(',')}),target_entity_name.in.(${entityNames.join(',')})`)
        .limit(20);

      if (relError) {
        console.error("[Context] Relationship search error:", relError);
      } else if (rels) {
        relationships.push(...rels.map(r => ({
          source: r.source_entity_name,
          target: r.target_entity_name,
          type: r.relationship_type,
        })));
      }
    }

    console.log(`[Context] Retrieved ${relationships.length} relationships in ${Date.now() - relationshipsStart}ms`);

    const totalTime = Date.now() - startTime;
    console.log(`[Context] Completed in ${totalTime}ms`);

    return NextResponse.json({
      chunks: formattedChunks,
      entities: entities || [],
      relationships,
    });

  } catch (error) {
    console.error("[Context] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
