import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/proposal/graph-suggest
 * 
 * Graph traversal for related concepts with filtering and suggestions.
 * 
 * Request body:
 * {
 *   "entity_name": string,
 *   "max_depth"?: number (default: 2),
 *   "relationship_types"?: string[] (optional filter),
 *   "session_id"?: string
 * }
 * 
 * Response:
 * {
 *   "entity": { name: string, type: string, summary: string },
 *   "related_entities": Array<{
 *     "entity": { name: string, type: string, summary: string },
 *     "relationship": { type: string, direction: "outgoing" | "incoming" },
 *     "depth": number
 *   }>,
 *   "suggestions": Array<{ text: string, reason: string }>
 * }
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Authenticate user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.error("[Graph Suggest] Authentication failed:", authError);
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { 
      entity_name, 
      max_depth = 2, 
      relationship_types,
      session_id 
    } = body;

    // Validate inputs
    if (!entity_name || typeof entity_name !== 'string') {
      return NextResponse.json(
        { error: "Missing or invalid entity_name" },
        { status: 400 }
      );
    }

    if (max_depth < 1 || max_depth > 3) {
      return NextResponse.json(
        { error: "max_depth must be between 1 and 3" },
        { status: 400 }
      );
    }

    console.log(`[Graph Suggest] Traversing graph from "${entity_name}" (depth: ${max_depth})`);

    // Get the starting entity
    let entityQuery = supabase
      .from('entities')
      .select('name, entity_type, summary')
      .eq('name', entity_name)
      .limit(1);

    if (session_id) {
      entityQuery = entityQuery.eq('session_id', session_id);
    }

    const { data: entities, error: entityError } = await entityQuery;

    if (entityError || !entities || entities.length === 0) {
      console.error("[Graph Suggest] Entity not found:", entity_name);
      return NextResponse.json(
        { error: "Entity not found" },
        { status: 404 }
      );
    }

    const startEntity = {
      name: entities[0].name,
      type: entities[0].entity_type,
      summary: entities[0].summary,
    };

    // Traverse the graph using BFS
    const visited = new Set<string>([entity_name]);
    const relatedEntities: Array<{
      entity: { name: string; type: string; summary: string };
      relationship: { type: string; direction: "outgoing" | "incoming" };
      depth: number;
    }> = [];

    // Queue: [entity_name, depth]
    const queue: Array<[string, number]> = [[entity_name, 0]];

    while (queue.length > 0) {
      const [currentEntity, currentDepth] = queue.shift()!;

      if (currentDepth >= max_depth) {
        continue;
      }

      // Get outgoing relationships
      let outgoingQuery = supabase
        .from('relationships')
        .select('target_entity_name, relationship_type')
        .eq('source_entity_name', currentEntity);

      if (relationship_types && relationship_types.length > 0) {
        outgoingQuery = outgoingQuery.in('relationship_type', relationship_types);
      }

      const { data: outgoing } = await outgoingQuery;

      if (outgoing) {
        for (const rel of outgoing) {
          if (!visited.has(rel.target_entity_name)) {
            visited.add(rel.target_entity_name);
            queue.push([rel.target_entity_name, currentDepth + 1]);

            // Get entity details
            let targetQuery = supabase
              .from('entities')
              .select('name, entity_type, summary')
              .eq('name', rel.target_entity_name)
              .limit(1);

            if (session_id) {
              targetQuery = targetQuery.eq('session_id', session_id);
            }

            const { data: targetEntities } = await targetQuery;

            if (targetEntities && targetEntities.length > 0) {
              relatedEntities.push({
                entity: {
                  name: targetEntities[0].name,
                  type: targetEntities[0].entity_type,
                  summary: targetEntities[0].summary,
                },
                relationship: {
                  type: rel.relationship_type,
                  direction: "outgoing",
                },
                depth: currentDepth + 1,
              });
            }
          }
        }
      }

      // Get incoming relationships
      let incomingQuery = supabase
        .from('relationships')
        .select('source_entity_name, relationship_type')
        .eq('target_entity_name', currentEntity);

      if (relationship_types && relationship_types.length > 0) {
        incomingQuery = incomingQuery.in('relationship_type', relationship_types);
      }

      const { data: incoming } = await incomingQuery;

      if (incoming) {
        for (const rel of incoming) {
          if (!visited.has(rel.source_entity_name)) {
            visited.add(rel.source_entity_name);
            queue.push([rel.source_entity_name, currentDepth + 1]);

            // Get entity details
            let sourceQuery = supabase
              .from('entities')
              .select('name, entity_type, summary')
              .eq('name', rel.source_entity_name)
              .limit(1);

            if (session_id) {
              sourceQuery = sourceQuery.eq('session_id', session_id);
            }

            const { data: sourceEntities } = await sourceQuery;

            if (sourceEntities && sourceEntities.length > 0) {
              relatedEntities.push({
                entity: {
                  name: sourceEntities[0].name,
                  type: sourceEntities[0].entity_type,
                  summary: sourceEntities[0].summary,
                },
                relationship: {
                  type: rel.relationship_type,
                  direction: "incoming",
                },
                depth: currentDepth + 1,
              });
            }
          }
        }
      }
    }

    // Generate suggestions based on graph structure
    const suggestions: Array<{ text: string; reason: string }> = [];

    // Suggest entities at depth 1 (direct connections)
    const directConnections = relatedEntities.filter(r => r.depth === 1);
    if (directConnections.length > 0) {
      suggestions.push({
        text: `Consider including: ${directConnections.slice(0, 3).map(r => r.entity.name).join(', ')}`,
        reason: "Directly related concepts from knowledge graph",
      });
    }

    // Suggest relationship patterns
    const relationshipCounts = new Map<string, number>();
    relatedEntities.forEach(r => {
      const count = relationshipCounts.get(r.relationship.type) || 0;
      relationshipCounts.set(r.relationship.type, count + 1);
    });

    const topRelationship = Array.from(relationshipCounts.entries())
      .sort((a, b) => b[1] - a[1])[0];

    if (topRelationship) {
      suggestions.push({
        text: `Most common relationship: ${topRelationship[0]}`,
        reason: `Found ${topRelationship[1]} instances of this relationship type`,
      });
    }

    const totalTime = Date.now() - startTime;
    console.log(`[Graph Suggest] Completed in ${totalTime}ms - Found ${relatedEntities.length} related entities`);

    return NextResponse.json({
      entity: startEntity,
      related_entities: relatedEntities,
      suggestions,
    });

  } catch (error) {
    console.error("[Graph Suggest] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
