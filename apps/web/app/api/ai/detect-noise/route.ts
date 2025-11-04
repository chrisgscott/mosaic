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

interface NoiseGroup {
  entities: Entity[];
  noiseType: string;
  severity: number; // 0.0-1.0, higher = more likely noise
  reason: string;
}

// Generic business terms that are often extracted incorrectly
const GENERIC_TERMS = [
  "planning", "execution", "strategy", "management", "process",
  "development", "implementation", "analysis", "assessment", "evaluation",
  "coordination", "administration", "supervision", "monitoring", "control",
  "support", "assistance", "guidance", "direction", "leadership",
  "operation", "activity", "function", "service", "solution",
  "system", "framework", "methodology", "approach", "technique",
  "procedure", "protocol", "standard", "guideline", "policy",
  "objective", "goal", "target", "outcome", "result",
  "performance", "efficiency", "effectiveness", "quality", "improvement",
  "research", "study", "investigation", "examination", "review",
  "report", "document", "record", "file", "data",
  "information", "knowledge", "expertise", "skill", "capability",
  "resource", "asset", "tool", "instrument", "equipment",
  "project", "program", "initiative", "campaign", "effort",
  "team", "group", "organization", "department", "division",
  "company", "corporation", "business", "enterprise", "firm",
  "agency", "office", "bureau", "unit", "section",
  "meeting", "conference", "workshop", "session", "event",
  "training", "education", "learning", "instruction", "course",
  "communication", "correspondence", "message", "notification", "update",
  "decision", "choice", "selection", "determination", "judgment",
  "agreement", "contract", "arrangement", "understanding", "commitment",
  "relationship", "partnership", "collaboration", "cooperation", "alliance",
  "requirement", "specification", "criterion", "standard", "condition",
  "change", "modification", "adjustment", "revision", "update",
  "risk", "issue", "problem", "challenge", "opportunity",
  "benefit", "advantage", "value", "worth", "merit",
  "cost", "expense", "budget", "funding", "investment",
  "time", "period", "duration", "schedule", "timeline",
  "phase", "stage", "step", "level", "grade"
];

// Common stop words
const STOP_WORDS = new Set([
  "the", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with",
  "by", "from", "up", "about", "into", "through", "during", "before",
  "after", "above", "below", "between", "among", "under", "over", "above",
  "a", "an", "as", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could", "should"
]);

function calculateNoiseScore(entity: Entity): { score: number; type: string; reason: string } {
  const name = entity.name.toLowerCase().trim();
  let score = 0;
  let maxScore = 0;
  let reasons: string[] = [];
  let detectedType = "unknown";

  // 1. Generic terms (highest severity)
  maxScore += 0.3;
  if (GENERIC_TERMS.includes(name)) {
    score += 0.3;
    reasons.push("Generic business term");
    detectedType = "generic";
  }

  // 2. Very short names
  maxScore += 0.2;
  if (name.length <= 2) {
    score += 0.2;
    reasons.push("Very short name");
    detectedType = detectedType === "unknown" ? "short" : detectedType;
  }

  // 3. All uppercase (likely unprocessed abbreviation)
  maxScore += 0.15;
  if (name === name.toUpperCase() && name.length > 1) {
    score += 0.15;
    reasons.push("All uppercase abbreviation");
    detectedType = detectedType === "unknown" ? "abbreviation" : detectedType;
  }

  // 4. Mostly numbers/symbols
  maxScore += 0.2;
  const nonAlphaChars = (name.match(/[^a-zA-Z\s]/g) || []).length;
  if (nonAlphaChars / name.length > 0.5) {
    score += 0.2;
    reasons.push("Contains many numbers/symbols");
    detectedType = detectedType === "unknown" ? "numeric" : detectedType;
  }

  // 5. Low extraction confidence
  maxScore += 0.2;
  if (entity.extraction_confidence && entity.extraction_confidence < 0.6) {
    const confidenceScore = (0.6 - entity.extraction_confidence) * 0.5; // Scale to 0.2 max
    score += confidenceScore;
    reasons.push(`Low confidence (${entity.extraction_confidence.toFixed(2)})`);
    detectedType = detectedType === "unknown" ? "low_confidence" : detectedType;
  }

  // 6. Missing or very short description
  maxScore += 0.15;
  if (!entity.description || entity.description.trim().length < 10) {
    score += 0.15;
    reasons.push("Missing or very short description");
    detectedType = detectedType === "unknown" ? "no_description" : detectedType;
  }

  // 7. Single common words
  maxScore += 0.1;
  if (name.split(/\s+/).length === 1 && STOP_WORDS.has(name)) {
    score += 0.1;
    reasons.push("Common stop word");
    detectedType = detectedType === "unknown" ? "stop_word" : detectedType;
  }

  // 8. Name is just a year or quarter
  maxScore += 0.1;
  if (/^\d{4}$/.test(name) || /^q[1-4]\s*\d{4}$/i.test(name)) {
    score += 0.1;
    reasons.push("Year or quarter");
    detectedType = detectedType === "unknown" ? "temporal" : detectedType;
  }

  // Normalize score to 0-1 range
  const normalizedScore = maxScore > 0 ? score / maxScore : 0;

  return {
    score: normalizedScore,
    type: detectedType,
    reason: reasons.join(", ") || "General low quality"
  };
}

function groupNoiseEntities(entities: Entity[]): NoiseGroup[] {
  // Calculate noise scores for all entities
  const scoredEntities = entities.map(entity => ({
    entity,
    score: calculateNoiseScore(entity)
  }));

  // Filter out non-noise entities (score < 0.5)
  const noiseEntities = scoredEntities.filter(item => item.score.score >= 0.5);

  // Group by noise type
  const groupsByType = new Map<string, Entity[]>();
  
  noiseEntities.forEach(item => {
    const type = item.score.type;
    if (!groupsByType.has(type)) {
      groupsByType.set(type, []);
    }
    groupsByType.get(type)!.push(item.entity);
  });

  // Create noise groups
  const noiseGroups: NoiseGroup[] = [];
  
  groupsByType.forEach((entities, type) => {
    // Calculate average severity for the group
    const avgScore = entities.reduce((sum, entity) => {
      const score = calculateNoiseScore(entity);
      return sum + score.score;
    }, 0) / entities.length;

    // Determine reason based on type
    let reason = "";
    switch (type) {
      case "generic":
        reason = "Generic business terms that lack specificity";
        break;
      case "short":
        reason = "Very short entity names (1-2 characters)";
        break;
      case "abbreviation":
        reason = "Unprocessed abbreviations in all caps";
        break;
      case "numeric":
        reason = "Entities containing mostly numbers or symbols";
        break;
      case "low_confidence":
        reason = "Low extraction confidence scores";
        break;
      case "no_description":
        reason = "Missing or inadequate descriptions";
        break;
      case "stop_word":
        reason = "Common stop words that shouldn't be entities";
        break;
      case "temporal":
        reason = "Years, quarters, or temporal references";
        break;
      default:
        reason = "Various quality issues detected";
    }

    noiseGroups.push({
      entities,
      noiseType: type,
      severity: avgScore,
      reason
    });
  });

  // Sort by severity (highest first)
  noiseGroups.sort((a, b) => b.severity - a.severity);

  return noiseGroups;
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

    // Group noise entities
    const noiseGroups = groupNoiseEntities(entities);

    return NextResponse.json({
      noiseGroups,
      totalGroups: noiseGroups.length,
      totalEntities: noiseGroups.reduce(
        (sum, g) => sum + g.entities.length,
        0
      ),
    });
  } catch (error) {
    console.error("Noise detection error:", error);
    return NextResponse.json(
      { error: "Failed to detect noise" },
      { status: 500 }
    );
  }
}
