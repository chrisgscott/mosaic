import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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

    // Fetch sample chunks for context
    const entitiesWithContext = await Promise.all(
      entities.map(async (entity) => {
        if (!entity.chunk_ids || entity.chunk_ids.length === 0) {
          return { ...entity, sampleChunks: [] };
        }

        const { data: chunks } = await supabase
          .from("chunks")
          .select("content")
          .in("id", entity.chunk_ids.slice(0, 3));

        return {
          ...entity,
          sampleChunks: chunks?.map((c: any) => c.content.substring(0, 200)) || [],
        };
      })
    );

    const prompt = `Analyze these ${entities.length} entities and generate merge suggestions:

${entitiesWithContext
  .map(
    (e, i) => `
Entity ${i + 1}: "${e.name}" (${e.type})
Description: ${e.description || "None"}
Aliases: ${e.aliases?.join(", ") || "None"}
Documents: ${e.document_ids?.length || 0}
Sample contexts from documents:
${e.sampleChunks.length > 0 ? e.sampleChunks.map((chunk: string, idx: number) => `  ${idx + 1}. "${chunk}..."`).join("\n") : "  (No context available)"}
`
  )
  .join("\n")}

NAMING CONVENTION RULES:
- If one entity is an abbreviation and another is the full name, use: "Full Name (ABBR)" format
- Examples: "Strategic Design Approaches (SDA)", "Child Care Assistance Program (CCAAPPI)"
- If both are full names or both are abbreviations, choose the most common/correct version
- Always prefer clarity and searchability

DESCRIPTION WRITING RULES:
- Use ONLY information from the sample contexts provided
- DO NOT invent abbreviations - only use abbreviations that appear in the source text
- Be specific and concrete - avoid generic buzzwords like "comprehensive," "essential," "enhancing"
- Mention related entities, frameworks, or methodologies BY NAME when they appear in context
- Include concrete applications, use cases, or domains mentioned in the text
- Use terminology directly from the source material for better semantic matching
- Focus on what makes this entity distinctive, not generic platitudes

Provide your suggestions in JSON format:
{
  "suggestedName": "best canonical name following naming convention rules (use abbreviations ONLY if they appear in source text)",
  "suggestedType": "most appropriate entity type",
  "suggestedDescription": "synthesized description optimized for knowledge graph retrieval (2-3 sentences). Be specific and concrete, using terminology from source material. Mention related entities by name. Avoid generic buzzwords."
}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a knowledge graph expert who helps merge duplicate entities. Use ONLY information from the provided source contexts - do not invent details or abbreviations. Write specific, concrete descriptions using terminology from the source material. Mention related entities by name when they appear in context. Avoid generic buzzwords. Return only valid JSON.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.2,
      max_tokens: 400,
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(completion.choices[0]?.message?.content || "{}");

    return NextResponse.json({
      suggestedName: result.suggestedName || entities[0].name,
      suggestedType: result.suggestedType || entities[0].type,
      suggestedDescription: result.suggestedDescription || entities[0].description || "",
    });
  } catch (error) {
    console.error("Generate merge suggestion error:", error);
    return NextResponse.json(
      { error: "Failed to generate suggestions" },
      { status: 500 }
    );
  }
}
