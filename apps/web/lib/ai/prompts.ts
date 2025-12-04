/**
 * Prompt Management System
 * 
 * Centralized prompt retrieval from database settings.
 * All prompts support placeholder substitution (e.g., {context}, {text}, {query}).
 */

import { createClient } from '@/lib/supabase/server';

export type PromptKey = 
  | 'chat'
  | 'entityExtraction'
  | 'entityDescription'
  | 'relationshipDescription'
  | 'entityMerge'
  | 'entitySynthesis'
  | 'hyde'
  | 'multiQuery';

/**
 * Default prompts (fallback if database is unavailable)
 */
const DEFAULT_PROMPTS: Record<PromptKey, string> = {
  chat: `You are a helpful AI assistant that answers questions based on provided context.

## Context from Retrieved Documents:

{context}

## Instructions:
- Answer using information from the provided context
- If context contains relevant information, USE IT to answer - don't say "no information available"
- Look carefully at tables, summaries, and all text in the context
- If context is truly insufficient or unrelated to the question, say so clearly
- **CRITICAL**: Add inline citations [1], [2], etc. immediately after each claim or fact
- Place citations right after the relevant sentence or phrase, before punctuation
- Each [N] corresponds to the source number in the context above
- Use multiple citations [1][2] when information comes from multiple sources
- Use markdown formatting for readability
- Your answer is ANALYSIS based on source documents (which are FACTS)
- Be transparent about uncertainty

Example: "React is a JavaScript library for building user interfaces[1]. It was created by Facebook[2] and is now maintained by Meta and the community[2][3]."`,

  entityExtraction: `You are an expert at extracting entities and relationships from text for knowledge graph construction.

Analyze the following text and extract:
1. **Entities**: Important concepts, people, organizations, methodologies, frameworks, tools, etc.
2. **Relationships**: How these entities relate to each other

Guidelines:
- Be precise and specific with entity names
- Include acronyms as aliases (e.g., "SDA" as alias for "Strategic Design Approaches")
- Only extract relationships that are explicitly stated or strongly implied
- Use descriptive relationship types that capture the nature of the connection
- Focus on meaningful entities (not common words or generic concepts)
- Descriptions should be concise but informative

Text to analyze:
{text}`,

  entityDescription: `You are a knowledge graph expert who writes clear, concise entity descriptions based on available context from documents.`,

  relationshipDescription: `You are a knowledge graph expert who writes clear, concise relationship descriptions that explain how two entities are connected.`,

  entityMerge: `You are a knowledge graph expert who helps merge duplicate entities. CRITICAL: Use ONLY information from the [Chunk N] sections provided. DO NOT invent, expand, or guess what abbreviations mean. If an abbreviation's full form is not in the chunks, leave it as an abbreviation. Write specific, concrete descriptions using only terminology that appears in the source chunks. If chunks lack information, write shorter descriptions.`,

  entitySynthesis: `You are a knowledge graph expert who synthesizes entity descriptions. You combine multiple descriptions into a single, accurate, concise description.`,

  hyde: `You are an expert assistant. Given a user's question, write a detailed, comprehensive answer that would perfectly answer their question. This hypothetical answer will be used to find similar documents.

Question: {query}

Write a detailed answer (2-3 paragraphs) that would perfectly answer this question. Use specific terminology and concepts that would appear in relevant documents.`,

  multiQuery: `Generate 3 different variations of this search query to improve search coverage. Each variation should:
- Rephrase the question differently
- Use different terminology or synonyms
- Approach the topic from a different angle

Original query: "{query}"

Return ONLY the 3 variations, one per line, without numbering or explanation.`,
};

/**
 * Get a prompt from database settings
 * 
 * @param key - The prompt key
 * @param variables - Optional variables to substitute in the prompt (e.g., {context}, {text})
 * @returns The prompt with variables substituted
 */
export async function getPrompt(
  key: PromptKey,
  variables?: Record<string, string>
): Promise<string> {
  try {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', `prompts.${key}`)
      .single();

    if (error || !data) {
      console.warn(`[Prompts] Failed to load prompt '${key}', using default`);
      return substituteVariables(DEFAULT_PROMPTS[key], variables);
    }

    // Value is already a string (stored as jsonb, retrieved as string)
    const prompt = data.value;
    return substituteVariables(prompt, variables);
  } catch (error) {
    console.error(`[Prompts] Error loading prompt '${key}':`, error);
    return substituteVariables(DEFAULT_PROMPTS[key], variables);
  }
}

/**
 * Get all prompts at once (useful for settings page)
 */
export async function getAllPrompts(): Promise<Record<PromptKey, string>> {
  try {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('system_settings')
      .select('key, value')
      .eq('category', 'prompts');

    if (error || !data) {
      console.warn('[Prompts] Failed to load prompts, using defaults');
      return DEFAULT_PROMPTS;
    }

    const prompts: Partial<Record<PromptKey, string>> = {};
    
    for (const setting of data) {
      const key = setting.key.replace('prompts.', '') as PromptKey;
      // Value is already a string (stored as jsonb, retrieved as string)
      prompts[key] = setting.value;
    }

    // Fill in any missing prompts with defaults
    return { ...DEFAULT_PROMPTS, ...prompts };
  } catch (error) {
    console.error('[Prompts] Error loading prompts:', error);
    return DEFAULT_PROMPTS;
  }
}

/**
 * Substitute variables in a prompt template
 * 
 * @param template - The prompt template with {variable} placeholders
 * @param variables - Variables to substitute
 * @returns The prompt with variables substituted
 */
function substituteVariables(
  template: string,
  variables?: Record<string, string>
): string {
  if (!variables) return template;

  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }
  return result;
}

/**
 * Prompt metadata for UI
 */
export const PROMPT_METADATA: Record<PromptKey, {
  title: string;
  description: string;
  placeholders: string[];
  usedIn: string[];
}> = {
  chat: {
    title: 'Chat System Prompt',
    description: 'Guides the AI when answering questions based on retrieved documents',
    placeholders: ['{context}'],
    usedIn: ['Chat interface', 'Q&A responses'],
  },
  entityExtraction: {
    title: 'Entity Extraction',
    description: 'Extracts entities and relationships from text for knowledge graph',
    placeholders: ['{text}'],
    usedIn: ['Document processing', 'Knowledge graph building'],
  },
  entityDescription: {
    title: 'Entity Description',
    description: 'Generates descriptions for entities using RAG context',
    placeholders: [],
    usedIn: ['Entity creation', 'Knowledge graph'],
  },
  relationshipDescription: {
    title: 'Relationship Description',
    description: 'Generates descriptions for relationships between entities',
    placeholders: [],
    usedIn: ['Relationship creation', 'Knowledge graph'],
  },
  entityMerge: {
    title: 'Entity Merge',
    description: 'Suggests how to merge duplicate entities',
    placeholders: [],
    usedIn: ['Entity deduplication', 'Knowledge graph cleanup'],
  },
  entitySynthesis: {
    title: 'Entity Synthesis',
    description: 'Combines multiple entity descriptions into one',
    placeholders: [],
    usedIn: ['Entity consolidation', 'Description merging'],
  },
  hyde: {
    title: 'HyDE Generation (Deprecated)',
    description: 'Creates hypothetical documents for improved search. DEPRECATED: Removed from core pipeline due to hallucination issues.',
    placeholders: ['{query}'],
    usedIn: ['Not currently used'],
  },
  multiQuery: {
    title: 'Multi-Query Generation (Deprecated)',
    description: 'Generates query variations for better search coverage. DEPRECATED: Removed from core pipeline for simplicity.',
    placeholders: ['{query}'],
    usedIn: ['Not currently used'],
  },
};
