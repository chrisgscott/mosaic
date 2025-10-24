import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import OpenAI from "openai";
import { generateText } from "ai";
import { models } from "@/lib/ai/gateway";
import { getPrompt } from "@/lib/ai/prompts";

// OpenAI SDK still needed for embeddings (AI SDK doesn't support embeddings yet)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
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

    const { type, name, entityType, sourceEntityName, targetEntityName, relationshipType } = await request.json();

    if (!type || !name) {
      return NextResponse.json(
        { error: "Missing required fields: type and name" },
        { status: 400 }
      );
    }

    let prompt: string;

    if (type === "entity") {
      // Generate entity description using RAG

      // Search for relevant context about this entity
      const searchQuery = `${name} ${entityType || ""}`;
      const embeddingResponse = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: searchQuery,
        encoding_format: "float",
      });

      const queryEmbedding = embeddingResponse.data[0].embedding;

      // Perform hybrid search for context
      const { data: searchResults, error: searchError } = await supabase.rpc(
        "search_chunks_hybrid",
        {
          query_text: searchQuery,
          query_embedding: queryEmbedding,
          match_threshold: 0.3,
          match_count: 5,
          filter_user_id: user.id,
          rrf_k: 60,
        }
      );

      if (searchError) {
        console.error("[Generate Description] Search error:", searchError);
      }

      const context = searchResults
        ?.map((r: { content: string }, i: number) => `[${i + 1}] ${r.content}`)
        .join("\n\n") || "No relevant context found.";

      // Build prompt with entity details and context
      prompt = `Generate a clear, concise description for this knowledge graph entity:

Entity Name: ${name}
Entity Type: ${entityType || "unknown"}

Relevant context from documents:
${context}

Requirements:
1. Write 2-3 sentences maximum
2. Focus on what this entity IS and what it DOES
3. Use information from the context if relevant
4. If context is limited, provide a general but accurate description
5. Use clear, professional language
6. Do NOT include phrases like "based on the context" or "according to the documents"

Return ONLY the description, nothing else.`;
    } else if (type === "relationship") {
      // Generate relationship description

      // Search for context about both entities and their relationship
      const searchQuery = `${sourceEntityName} ${relationshipType} ${targetEntityName}`;
      const embeddingResponse = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: searchQuery,
        encoding_format: "float",
      });

      const queryEmbedding = embeddingResponse.data[0].embedding;

      const { data: searchResults, error: searchError } = await supabase.rpc(
        "search_chunks_hybrid",
        {
          query_text: searchQuery,
          query_embedding: queryEmbedding,
          match_threshold: 0.3,
          match_count: 5,
          filter_user_id: user.id,
          rrf_k: 60,
        }
      );

      if (searchError) {
        console.error("[Generate Description] Search error:", searchError);
      }

      const context = searchResults
        ?.map((r: { content: string }, i: number) => `[${i + 1}] ${r.content}`)
        .join("\n\n") || "No relevant context found.";

      // Build prompt with relationship details and context
      prompt = `Generate a clear, concise description for this knowledge graph relationship:

Source Entity: ${sourceEntityName}
Relationship Type: ${relationshipType}
Target Entity: ${targetEntityName}

Relevant context from documents:
${context}

Requirements:
1. Write 1-2 sentences maximum
2. Explain HOW and WHY these entities are connected
3. Use information from the context if relevant
4. Focus on the specific nature of this relationship
5. Use clear, professional language
6. Do NOT include phrases like "based on the context" or "according to the documents"

Return ONLY the description, nothing else.`;
    } else {
      return NextResponse.json(
        { error: "Invalid type. Must be 'entity' or 'relationship'" },
        { status: 400 }
      );
    }

    // Get appropriate system prompt from settings
    const systemPrompt = await getPrompt(
      type === "entity" ? "entityDescription" : "relationshipDescription"
    );

    const result = await generateText({
      model: models.standard,
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
      temperature: 0.3,
    });

    const description = result.text.trim();

    if (!description) {
      return NextResponse.json(
        { error: "Failed to generate description" },
        { status: 500 }
      );
    }

    return NextResponse.json({ description });
  } catch (error) {
    console.error("[Generate Description] Error:", error);
    return NextResponse.json(
      { error: "Failed to generate description" },
      { status: 500 }
    );
  }
}
