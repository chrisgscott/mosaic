import { NextRequest, NextResponse } from "next/server";
import { models } from "@/lib/ai/gateway";
import { generateText } from "ai";
import { getPrompt } from "@/lib/ai/prompts";

export async function POST(request: NextRequest) {
  try {
    const { entityName, entityType, descriptions } = await request.json();

    if (!descriptions || descriptions.length === 0) {
      return NextResponse.json(
        { error: "No descriptions provided" },
        { status: 400 }
      );
    }

    const prompt = `You are synthesizing a description for a merged knowledge graph entity.

Entity Name: ${entityName}
Entity Type: ${entityType}

The following descriptions come from ${descriptions.length} duplicate entities that are being merged:

${descriptions.map((d: string, i: number) => `${i + 1}. ${d}`).join("\n\n")}

Create a single, comprehensive description that:
1. Combines the key information from all descriptions
2. Removes redundancy and contradictions
3. Maintains factual accuracy
4. Is concise (2-3 sentences max)
5. Uses clear, professional language

Return ONLY the synthesized description, nothing else.`;

    // Get entity synthesis prompt from settings
    const systemPrompt = await getPrompt("entitySynthesis");

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
    console.error("Description synthesis error:", error);
    return NextResponse.json(
      { error: "Failed to synthesize description" },
      { status: 500 }
    );
  }
}
