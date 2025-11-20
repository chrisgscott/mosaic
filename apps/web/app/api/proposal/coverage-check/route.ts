import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * POST /api/proposal/coverage-check
 * 
 * Analyzes semantic coverage of proposal text against PWS tasks.
 * Returns coverage score and gaps for each task.
 * 
 * Request body:
 * {
 *   "proposal_text": string,
 *   "pws_tasks": Array<{ id: string, text: string }>,
 *   "session_id"?: string
 * }
 * 
 * Response:
 * {
 *   "coverage": Array<{
 *     "task_id": string,
 *     "coverage_score": number,
 *     "matched_chunks": Array<{ text: string, similarity: number }>,
 *     "gaps": string[]
 *   }>,
 *   "overall_score": number
 * }
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Authenticate user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.error("[Coverage Check] Authentication failed:", authError);
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { proposal_text, pws_tasks, session_id } = body;

    // Validate inputs
    if (!proposal_text || typeof proposal_text !== 'string') {
      return NextResponse.json(
        { error: "Missing or invalid proposal_text" },
        { status: 400 }
      );
    }

    if (!Array.isArray(pws_tasks) || pws_tasks.length === 0) {
      return NextResponse.json(
        { error: "Missing or invalid pws_tasks array" },
        { status: 400 }
      );
    }

    console.log(`[Coverage Check] Analyzing ${pws_tasks.length} tasks against proposal (${proposal_text.length} chars)`);

    // Note: We generate embeddings per task below for better accuracy
    console.log(`[Coverage Check] Analyzing ${pws_tasks.length} tasks`);

    // Analyze coverage for each task
    const coverageResults = await Promise.all(
      pws_tasks.map(async (task) => {
        if (!task.id || !task.text) {
          console.warn("[Coverage Check] Skipping invalid task:", task);
          return null;
        }

        try {
          // Generate embedding for task
          const taskEmbedding = await openai.embeddings.create({
            model: "text-embedding-3-small",
            input: task.text,
          });
          const taskVector = taskEmbedding.data[0].embedding;

          // Search for relevant chunks using hybrid search
          const searchParams: Record<string, any> = {
            query_text: task.text,
            query_embedding: taskVector,
            match_count: 5,
            match_threshold: 0.5,
          };

          // Add session filter if provided
          if (session_id) {
            searchParams.filter_session_id = session_id;
          }

          const { data: chunks, error: searchError } = await supabase
            .rpc('search_chunks_hybrid', searchParams);

          if (searchError) {
            console.error(`[Coverage Check] Search error for task ${task.id}:`, searchError);
            return {
              task_id: task.id,
              coverage_score: 0,
              matched_chunks: [],
              gaps: ["Error performing search"],
            };
          }

          // Calculate coverage score based on top matches
          const matchedChunks = (chunks || []).map((chunk: { content: string; similarity: number }) => ({
            text: chunk.content,
            similarity: chunk.similarity,
          }));

          // Coverage score is the average of top 3 similarities (or fewer if less available)
          const topMatches = matchedChunks.slice(0, 3);
          const coverageScore = topMatches.length > 0
            ? topMatches.reduce((sum: number, m: { similarity: number }) => sum + m.similarity, 0) / topMatches.length
            : 0;

          // Identify gaps if coverage is low
          const gaps: string[] = [];
          if (coverageScore < 0.7) {
            gaps.push("Low semantic similarity - proposal may not adequately address this task");
          }
          if (matchedChunks.length === 0) {
            gaps.push("No relevant content found in proposal");
          }

          return {
            task_id: task.id,
            coverage_score: Math.round(coverageScore * 100) / 100,
            matched_chunks: matchedChunks,
            gaps,
          };
        } catch (error) {
          console.error(`[Coverage Check] Error processing task ${task.id}:`, error);
          return {
            task_id: task.id,
            coverage_score: 0,
            matched_chunks: [],
            gaps: ["Error processing task"],
          };
        }
      })
    );

    // Filter out null results and calculate overall score
    const validResults = coverageResults.filter(r => r !== null);
    const overallScore = validResults.length > 0
      ? validResults.reduce((sum, r) => sum + r!.coverage_score, 0) / validResults.length
      : 0;

    const totalTime = Date.now() - startTime;
    console.log(`[Coverage Check] Completed in ${totalTime}ms - Overall score: ${overallScore.toFixed(2)}`);

    return NextResponse.json({
      coverage: validResults,
      overall_score: Math.round(overallScore * 100) / 100,
    });

  } catch (error) {
    console.error("[Coverage Check] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
