import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface Entity {
  id: string;
  name: string;
  type: string;
  description: string | null;
  canonical_name: string | null;
  aliases: string[];
  document_ids: string[];
  chunk_ids: string[];
  extraction_confidence: number | null;
}

interface DuplicateGroup {
  entities: Entity[];
  similarityScore: number;
}

// Calculate Levenshtein distance for string similarity
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

function calculateNameSimilarity(name1: string, name2: string): number {
  const n1 = name1.toLowerCase().trim();
  const n2 = name2.toLowerCase().trim();

  // Exact match
  if (n1 === n2) return 1.0;

  // Check if one is abbreviation of the other
  const words1 = n1.split(/\s+/);
  const words2 = n2.split(/\s+/);
  const initials1 = words1.map((w) => w[0]).join("");
  const initials2 = words2.map((w) => w[0]).join("");

  if (n1 === initials2 || n2 === initials1) return 0.9;

  // Levenshtein similarity
  const maxLen = Math.max(n1.length, n2.length);
  const distance = levenshteinDistance(n1, n2);
  const similarity = 1 - distance / maxLen;

  return similarity;
}

// Simple heuristics for suggested name (no AI needed)
function suggestName(entities: Entity[]): string {
  // Find longest name (likely the full version)
  const longest = entities.reduce((a, b) => (a.name.length > b.name.length ? a : b));
  
  // Find shortest name (likely abbreviation)
  const shortest = entities.reduce((a, b) => (a.name.length < b.name.length ? a : b));
  
  // If there's a significant length difference, use "Full Name (ABBR)" format
  if (longest.name.length > shortest.name.length * 1.5) {
    return `${longest.name} (${shortest.name})`;
  }
  
  // Otherwise, use the most common or first one
  return longest.name;
}

// Simple heuristic for suggested type (no AI needed)
function suggestType(entities: Entity[]): string {
  // Count occurrences of each type
  const typeCounts = entities.reduce((acc, e) => {
    acc[e.type] = (acc[e.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  // Return most common type
  return Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0][0];
}

export async function POST() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch all entities for the user
    const { data: entities, error: fetchError } = await supabase
      .from("entities")
      .select("*")
      .eq("user_id", user.id);

    if (fetchError || !entities) {
      return NextResponse.json(
        { error: "Failed to fetch entities" },
        { status: 500 }
      );
    }

    // Build similarity graph - compare ALL pairs
    const similarityEdges: Map<string, Set<string>> = new Map();
    const entityMap = new Map(entities.map(e => [e.id, e]));
    
    for (let i = 0; i < entities.length; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        const similarity = calculateNameSimilarity(
          entities[i].name,
          entities[j].name
        );

        // High similarity threshold for name matching
        if (similarity >= 0.75) {
          // Add bidirectional edges
          if (!similarityEdges.has(entities[i].id)) {
            similarityEdges.set(entities[i].id, new Set());
          }
          if (!similarityEdges.has(entities[j].id)) {
            similarityEdges.set(entities[j].id, new Set());
          }
          similarityEdges.get(entities[i].id)!.add(entities[j].id);
          similarityEdges.get(entities[j].id)!.add(entities[i].id);
        }
      }
    }

    // Find connected components using DFS (transitive closure)
    const visited = new Set<string>();
    const duplicateGroups: DuplicateGroup[] = [];

    function dfs(entityId: string, component: Entity[]) {
      if (visited.has(entityId)) return;
      visited.add(entityId);
      
      const entity = entityMap.get(entityId);
      if (entity) {
        component.push(entity);
      }
      
      const neighbors = similarityEdges.get(entityId);
      if (neighbors) {
        for (const neighborId of neighbors) {
          dfs(neighborId, component);
        }
      }
    }

    // Find all connected components
    for (const entity of entities) {
      if (!visited.has(entity.id)) {
        const component: Entity[] = [];
        dfs(entity.id, component);
        
        // Only add groups with 2+ entities
        if (component.length >= 2) {
          // Calculate average similarity for the group
          let totalSimilarity = 0;
          let comparisons = 0;
          
          for (let i = 0; i < component.length; i++) {
            for (let j = i + 1; j < component.length; j++) {
              totalSimilarity += calculateNameSimilarity(
                component[i].name,
                component[j].name
              );
              comparisons++;
            }
          }
          
          const avgSimilarity = comparisons > 0 ? totalSimilarity / comparisons : 0;

          duplicateGroups.push({
            entities: component,
            similarityScore: avgSimilarity,
          });
        }
      }
    }

    // Sort by similarity score (highest first)
    duplicateGroups.sort((a, b) => b.similarityScore - a.similarityScore);

    return NextResponse.json({
      duplicateGroups,
      totalGroups: duplicateGroups.length,
      totalEntities: duplicateGroups.reduce(
        (sum, g) => sum + g.entities.length,
        0
      ),
    });
  } catch (error) {
    console.error("Duplicate detection error:", error);
    return NextResponse.json(
      { error: "Failed to detect duplicates" },
      { status: 500 }
    );
  }
}
