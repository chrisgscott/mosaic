import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Reset all prompts to their default values
 */
export async function POST() {
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

    // Re-run the migration to reset prompts to defaults
    // This is safe because we use ON CONFLICT DO UPDATE
    const { error } = await supabase.rpc('exec_sql', {
      sql: `
        -- Reset all prompts to defaults by re-running inserts
        INSERT INTO system_settings (key, value, description, category, created_at, updated_at)
        VALUES 
          ('prompts.chat', '"You are a helpful AI assistant that answers questions based on provided context.\\n\\n## Context from Retrieved Documents:\\n\\n{context}\\n\\n## Instructions:\\n- Answer using ONLY information from the provided context\\n- If context is insufficient, say so clearly\\n- Cite sources using [1], [2], etc.\\n- Use markdown formatting for readability\\n- Your answer is ANALYSIS based on source documents (which are FACTS)\\n- Be transparent about uncertainty"', 'System prompt for chat responses. Use {context} placeholder for retrieved documents.', 'prompts', NOW(), NOW()),
          ('prompts.entityExtraction', '"You are an expert at extracting entities and relationships from text for knowledge graph construction.\\n\\nAnalyze the following text and extract:\\n1. **Entities**: Important concepts, people, organizations, methodologies, frameworks, tools, etc.\\n2. **Relationships**: How these entities relate to each other\\n\\nGuidelines:\\n- Be precise and specific with entity names\\n- Include acronyms as aliases (e.g., \\"SDA\\" as alias for \\"Strategic Design Approaches\\")\\n- Only extract relationships that are explicitly stated or strongly implied\\n- Use descriptive relationship types that capture the nature of the connection\\n- Focus on meaningful entities (not common words or generic concepts)\\n- Descriptions should be concise but informative\\n\\nText to analyze:\\n{text}"', 'Prompt for extracting entities and relationships from text. Use {text} placeholder.', 'prompts', NOW(), NOW()),
          ('prompts.entityDescription', '"You are a knowledge graph expert who writes clear, concise entity descriptions based on available context from documents."', 'System prompt for generating entity descriptions from RAG context.', 'prompts', NOW(), NOW()),
          ('prompts.relationshipDescription', '"You are a knowledge graph expert who writes clear, concise relationship descriptions that explain how two entities are connected."', 'System prompt for generating relationship descriptions.', 'prompts', NOW(), NOW()),
          ('prompts.entityMerge', '"You are a knowledge graph expert who helps merge duplicate entities. CRITICAL: Use ONLY information from the [Chunk N] sections provided. DO NOT invent, expand, or guess what abbreviations mean. If an abbreviation''s full form is not in the chunks, leave it as an abbreviation. Write specific, concrete descriptions using only terminology that appears in the source chunks. If chunks lack information, write shorter descriptions."', 'System prompt for generating entity merge suggestions.', 'prompts', NOW(), NOW()),
          ('prompts.entitySynthesis', '"You are a knowledge graph expert who synthesizes entity descriptions. You combine multiple descriptions into a single, accurate, concise description."', 'System prompt for synthesizing multiple entity descriptions into one.', 'prompts', NOW(), NOW()),
          ('prompts.hyde', '"You are an expert assistant. Given a user''s question, write a detailed, comprehensive answer that would perfectly answer their question. This hypothetical answer will be used to find similar documents.\\n\\nQuestion: {query}\\n\\nWrite a detailed answer (2-3 paragraphs) that would perfectly answer this question. Use specific terminology and concepts that would appear in relevant documents."', 'Prompt for HyDE (Hypothetical Document Embeddings) generation. Use {query} placeholder.', 'prompts', NOW(), NOW()),
          ('prompts.multiQuery', '"Generate 3 different variations of this search query to improve search coverage. Each variation should:\\n- Rephrase the question differently\\n- Use different terminology or synonyms\\n- Approach the topic from a different angle\\n\\nOriginal query: \\"{query}\\"\\n\\nReturn ONLY the 3 variations, one per line, without numbering or explanation."', 'Prompt for generating multiple query variations. Use {query} placeholder.', 'prompts', NOW(), NOW())
        ON CONFLICT (key) DO UPDATE SET
          value = EXCLUDED.value,
          description = EXCLUDED.description,
          updated_at = NOW();
      `
    });

    if (error) {
      console.error("[Reset Prompts] Error:", error);
      return NextResponse.json(
        { error: "Failed to reset prompts" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Reset Prompts] Error:", error);
    return NextResponse.json(
      { error: "Failed to reset prompts" },
      { status: 500 }
    );
  }
}
