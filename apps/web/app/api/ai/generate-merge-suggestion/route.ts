import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { models } from "@/lib/ai/gateway";
import { generateObject } from "ai";
import { z } from "zod";
import { getPrompt } from "@/lib/ai/prompts";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { entityIds } = await request.json();

    if (!entityIds || entityIds.length < 2) {
      return NextResponse.json(
        { error: "At least 2 entity IDs required" },
        { status: 400 }
      );
    }

    // Fetch entities with their chunks
    const { data: entities, error: fetchError } = await supabase
      .from("entities")
      .select("*")
      .in("id", entityIds)
      .eq("user_id", user.id);

    if (fetchError || !entities || entities.length === 0) {
      return NextResponse.json(
        { error: "Failed to fetch entities" },
        { status: 500 }
      );
    }

    // Fetch user's reranking preference
    const { data: settings } = await supabase
      .from("user_settings")
      .select("key, value")
      .eq("user_id", user.id)
      .eq("key", "search.useReranking")
      .single();

    const useReranking = settings?.value === true || settings?.value === "true";

    // Use single RAG search for all entities combined
    let sharedChunks: string[] = [];
    
    try {
      // Build combined query with all entity names
      const entityNames = entities.map(e => e.name).join(", ");
      const searchQuery = `What is ${entityNames}`;
      
      const searchResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/search`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Cookie": request.headers.get("cookie") || "",
        },
        body: JSON.stringify({
          query: searchQuery,
          limit: 10, // More chunks since searching for multiple entities
          searchType: "hybrid",
          useReranking,
        }),
      });

      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        sharedChunks = searchData.results?.slice(0, 10).map((r: { content: string }) => 
          r.content.substring(0, 300)
        ) || [];
      }
    } catch (error) {
      console.error(`Failed to search for entities:`, error);
    }

    // If RAG search failed, fall back to direct chunk fetch
    if (sharedChunks.length === 0) {
      const allChunkIds = entities.flatMap(e => e.chunk_ids || []).slice(0, 10);
      if (allChunkIds.length > 0) {
        const { data: chunks } = await supabase
          .from("chunks")
          .select("content")
          .in("id", allChunkIds);
        
        sharedChunks = chunks?.map((c: { content: string }) => c.content.substring(0, 300)) || [];
      }
    }

    // Use the same chunks for all entities
    const entitiesWithContext = entities.map(entity => ({
      ...entity,
      sampleChunks: sharedChunks,
    }));

    const prompt = `Analyze these ${entities.length} entities and generate merge suggestions:

${entitiesWithContext
  .map(
    (e, i) => `
Entity ${i + 1}: "${e.name}" (${e.type})
Description: ${e.description || "None"}
Aliases: ${e.aliases?.join(", ") || "None"}
Documents: ${e.document_ids?.length || 0}
Chunks: ${e.chunk_ids?.length || 0}
`
  )
  .join("\n")}

VERIFIED SOURCE CONTEXT (from RAG search, ranked by relevance):
${sharedChunks.map((chunk, idx) => {
  if (idx === 0) {
    return `[Chunk 1 - MOST RELEVANT - PRIORITIZE THIS]: "${chunk}"`;
  }
  return `[Chunk ${idx + 1}]: "${chunk}"`;
}).join("\n\n")}

NAMING CONVENTION RULES:
- If one entity is an abbreviation and another is the full name, use: "Full Name (ABBR)" format
- Examples: "Strategic Design Approaches (SDA)", "Child Care Assistance Program (CCAAPPI)"
- If both are full names or both are abbreviations, choose the most common/correct version
- Always prefer clarity and searchability

DESCRIPTION WRITING RULES - FOLLOW STRICTLY:
- PRIORITIZE information from [Chunk 1 - MOST RELEVANT] - this is the best match from our search
- Use ONLY information that appears in the [Chunk N] sections above
- CRITICAL: If an abbreviation's full form does NOT appear in the chunks, DO NOT expand it
  * Example: If chunks say "WTPS" but never define it, write "WTPS" NOT "Workforce Training and Planning System (WTPS)"
- DO NOT invent, guess, or assume what abbreviations stand for
- Be specific and concrete - avoid generic buzzwords like "comprehensive," "essential," "enhancing"
- Mention related entities, frameworks, or methodologies BY NAME only if they appear in the chunks
- Include concrete applications, use cases, or domains only if mentioned in the chunks
- Use terminology directly from the source material - quote it when possible
- Focus on what makes this entity distinctive based on the chunks provided
- If chunks don't provide enough information, write a shorter description using only what's there
- When chunks conflict, trust [Chunk 1 - MOST RELEVANT] over others

Provide your suggestions in JSON format:
{
  "suggestedName": "best canonical name following naming convention rules (use abbreviations ONLY if they appear in source text)",
  "suggestedType": "most appropriate entity type",
  "suggestedDescription": "synthesized description optimized for knowledge graph retrieval (2-3 sentences). Be specific and concrete, using terminology from source material. Mention related entities by name. Avoid generic buzzwords."
}`;

    const MergeSuggestionSchema = z.object({
      suggestedName: z.string(),
      suggestedType: z.string(),
      suggestedDescription: z.string(),
    });

    // Get entity merge prompt from settings
    const systemPrompt = await getPrompt("entityMerge");

    const result = await generateObject({
      model: models.standard,
      schema: MergeSuggestionSchema,
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.1,
    });

    return NextResponse.json({
      suggestedName: result.object.suggestedName || entities[0].name,
      suggestedType: result.object.suggestedType || entities[0].type,
      suggestedDescription: result.object.suggestedDescription || entities[0].description || "",
    });
  } catch (error) {
    console.error("Generate merge suggestion error:", error);
    return NextResponse.json(
      { error: "Failed to generate suggestions" },
      { status: 500 }
    );
  }
}
