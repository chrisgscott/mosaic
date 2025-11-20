import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";

/**
 * POST /api/proposal/terminology
 * 
 * Validates terminology usage and provides suggestions from knowledge graph.
 * 
 * Request body:
 * {
 *   "terms": Array<{ term: string, context?: string }>,
 *   "session_id"?: string
 * }
 * 
 * Response:
 * {
 *   "results": Array<{
 *     "term": string,
 *     "is_valid": boolean,
 *     "entity_match"?: { name: string, type: string, summary: string },
 *     "suggestions": Array<{ term: string, reason: string }>,
 *     "related_concepts": Array<string>
 *   }>
 * }
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Authenticate user (supports both cookie and API key)
    const auth = await authenticateRequest(request);
    if (!auth.authenticated) {
      console.error("[Terminology] Authentication failed:", auth.error);
      return NextResponse.json(
        { error: auth.error || "Unauthorized" },
        { status: 401 }
      );
    }

    // Use service role client for API key auth (bypasses RLS), otherwise use regular client
    const supabase = auth.supabase || await createClient();

    // Parse request body
    const body = await request.json();
    const { terms, session_id } = body;

    // Validate inputs
    if (!Array.isArray(terms) || terms.length === 0) {
      return NextResponse.json(
        { error: "Missing or invalid terms array" },
        { status: 400 }
      );
    }

    console.log(`[Terminology] Validating ${terms.length} terms`);

    // Process each term
    const results = await Promise.all(
      terms.map(async (termObj) => {
        const term = typeof termObj === 'string' ? termObj : termObj.term;
        const context = typeof termObj === 'object' ? termObj.context : undefined;

        if (!term || typeof term !== 'string') {
          console.warn("[Terminology] Skipping invalid term:", termObj);
          return null;
        }

        try {
          // Search for exact entity match
          let entityQuery = supabase
            .from('entities')
            .select('name, type, summary')
            .ilike('name', `%${term}%`)
            .limit(1);

          // Add session filter if provided
          if (session_id) {
            entityQuery = entityQuery.eq('session_id', session_id);
          }

          const { data: entities, error: entityError } = await entityQuery;

          if (entityError) {
            console.error(`[Terminology] Entity search error for "${term}":`, entityError);
          }

          const entityMatch = entities && entities.length > 0 ? entities[0] : null;

          // Search for related entities and concepts
          let relatedQuery = supabase
            .from('entities')
            .select('name')
            .or(`name.ilike.%${term}%,summary.ilike.%${term}%`)
            .neq('name', term)
            .limit(5);

          if (session_id) {
            relatedQuery = relatedQuery.eq('session_id', session_id);
          }

          const { data: relatedEntities } = await relatedQuery;

          // If entity exists, look for relationships
          const relatedConcepts: string[] = [];
          if (entityMatch) {
            const { data: relationships } = await supabase
              .from('relationships')
              .select('target_entity_name, relationship_type')
              .eq('source_entity_name', entityMatch.name)
              .limit(5);

            if (relationships) {
              relatedConcepts.push(...relationships.map(r => r.target_entity_name));
            }
          }

          // Add related entities to concepts
          if (relatedEntities) {
            relatedConcepts.push(...relatedEntities.map(e => e.name));
          }

          // Generate suggestions based on findings
          const suggestions: Array<{ term: string; reason: string }> = [];
          
          if (!entityMatch && relatedEntities && relatedEntities.length > 0) {
            // Suggest similar terms
            relatedEntities.slice(0, 3).forEach(e => {
              suggestions.push({
                term: e.name,
                reason: "Similar term found in knowledge base",
              });
            });
          }

          return {
            term,
            is_valid: !!entityMatch,
            entity_match: entityMatch ? {
              name: entityMatch.name,
              type: entityMatch.type,
              summary: entityMatch.summary,
            } : undefined,
            suggestions,
            related_concepts: [...new Set(relatedConcepts)].slice(0, 5),
          };
        } catch (error) {
          console.error(`[Terminology] Error processing term "${term}":`, error);
          return {
            term,
            is_valid: false,
            suggestions: [],
            related_concepts: [],
          };
        }
      })
    );

    // Filter out null results
    const validResults = results.filter(r => r !== null);

    const totalTime = Date.now() - startTime;
    console.log(`[Terminology] Completed in ${totalTime}ms - Validated ${validResults.length} terms`);

    return NextResponse.json({
      results: validResults,
    });

  } catch (error) {
    console.error("[Terminology] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
