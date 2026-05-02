export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import {
  generateEpisodeStructure,
  generateQuestions,
  generateClipIdeas,
} from "@/lib/podcast/strategy-engine";
import type {
  PodcastEpisodeType,
  PodcastGoal,
  PodcastGuestPersona,
  PodcastQuestion,
  PodcastEpisodeStructure,
  PodcastClipIdea,
} from "@/lib/db/schema";

/**
 * Request body types
 */
interface GenerateStructureRequest {
  action: "structure";
  episodeType: PodcastEpisodeType;
  goals: PodcastGoal[];
  persona: PodcastGuestPersona;
  clientName: string;
  useRealAI: boolean;
}

interface GenerateQuestionsRequest {
  action: "questions";
  episodeType: PodcastEpisodeType;
  goals: PodcastGoal[];
  persona: PodcastGuestPersona;
  clientName: string;
  industry: string;
  useRealAI: boolean;
}

interface GenerateClipsRequest {
  action: "clips";
  clientName: string;
  questions: PodcastQuestion[];
  useRealAI: boolean;
}

type PodcastStrategyRequest =
  | GenerateStructureRequest
  | GenerateQuestionsRequest
  | GenerateClipsRequest;

/**
 * Response types
 */
interface SuccessResponse {
  success: true;
  data: PodcastEpisodeStructure | PodcastQuestion[] | PodcastClipIdea[];
  action: string;
}

interface ErrorResponse {
  success: false;
  error: string;
}

/**
 * Validate request body
 */
function validateRequest(body: unknown): {
  valid: boolean;
  error?: string;
  data?: PodcastStrategyRequest;
} {
  if (typeof body !== "object" || !body) {
    return { valid: false, error: "Body must be a JSON object" };
  }

  const req = body as Record<string, unknown>;

  // Check action
  if (!req.action || !["structure", "questions", "clips"].includes(req.action as string)) {
    return { valid: false, error: "action must be 'structure', 'questions', or 'clips'" };
  }

  const action = req.action as string;

  // Validate clientName
  if (typeof req.clientName !== "string" || !req.clientName) {
    return { valid: false, error: "clientName must be a non-empty string" };
  }

  // Validate useRealAI
  if (typeof req.useRealAI !== "boolean") {
    return { valid: false, error: "useRealAI must be a boolean" };
  }

  // Action-specific validation
  if (action === "structure") {
    if (typeof req.episodeType !== "string" || !req.episodeType) {
      return { valid: false, error: "episodeType is required for structure action" };
    }
    if (!Array.isArray(req.goals) || req.goals.length === 0) {
      return { valid: false, error: "goals must be a non-empty array" };
    }
    if (typeof req.persona !== "object" || !req.persona) {
      return { valid: false, error: "persona is required and must be an object" };
    }
  } else if (action === "questions") {
    if (typeof req.episodeType !== "string" || !req.episodeType) {
      return { valid: false, error: "episodeType is required for questions action" };
    }
    if (!Array.isArray(req.goals) || req.goals.length === 0) {
      return { valid: false, error: "goals must be a non-empty array" };
    }
    if (typeof req.persona !== "object" || !req.persona) {
      return { valid: false, error: "persona is required and must be an object" };
    }
    if (typeof req.industry !== "string" || !req.industry) {
      return { valid: false, error: "industry is required for questions action" };
    }
  } else if (action === "clips") {
    if (!Array.isArray(req.questions) || req.questions.length === 0) {
      return { valid: false, error: "questions must be a non-empty array" };
    }
  }

  return { valid: true, data: req as PodcastStrategyRequest };
}

/**
 * POST /api/podcast-strategy-generate
 *
 * Generates podcast strategy components (structure, questions, or clip ideas)
 * by calling the appropriate strategy engine functions.
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<SuccessResponse | ErrorResponse>> {
  const startTime = Date.now();
  console.log("[podcast-strategy-generate] Request received");

  try {
    // Parse request body
    const body = await request.json();
    const validation = validateRequest(body);

    if (!validation.valid) {
      console.error(
        `[podcast-strategy-generate] Validation error: ${validation.error}`
      );
      return NextResponse.json(
        {
          success: false,
          error: validation.error || "Invalid request",
        },
        { status: 400 }
      );
    }

    const req = validation.data!;
    console.log(
      `[podcast-strategy-generate] Processing action: ${req.action}`
    );

    let data: PodcastEpisodeStructure | PodcastQuestion[] | PodcastClipIdea[];

    // Route to appropriate generator function
    if (req.action === "structure") {
      const structureReq = req as GenerateStructureRequest;
      data = await generateEpisodeStructure({
        episodeType: structureReq.episodeType,
        goals: structureReq.goals,
        persona: structureReq.persona,
        clientName: structureReq.clientName,
        useRealAI: structureReq.useRealAI,
      });
    } else if (req.action === "questions") {
      const questionsReq = req as GenerateQuestionsRequest;
      data = await generateQuestions({
        episodeType: questionsReq.episodeType,
        goals: questionsReq.goals,
        persona: questionsReq.persona,
        clientName: questionsReq.clientName,
        industry: questionsReq.industry,
        useRealAI: questionsReq.useRealAI,
      });
    } else if (req.action === "clips") {
      const clipsReq = req as GenerateClipsRequest;
      data = await generateClipIdeas({
        questions: clipsReq.questions,
        episodeType: "deep_interview", // default, not used in clip generation
        clientName: clipsReq.clientName,
        useRealAI: clipsReq.useRealAI,
      });
    } else {
      return NextResponse.json(
        { success: false, error: "Unknown action" },
        { status: 400 }
      );
    }

    const latencyMs = Date.now() - startTime;
    console.log(
      `[podcast-strategy-generate] Success (${req.action}): ${latencyMs}ms`
    );

    return NextResponse.json({
      success: true,
      data,
      action: req.action,
    });
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    console.error(`[podcast-strategy-generate] Error (${latencyMs}ms):`, error);

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { success: false, error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
