/**
 * PixelManageAI — Remotion Lambda Renderer
 *
 * Invokes Remotion's renderMediaOnLambda() to render video in AWS Lambda.
 * This replaces the local headless-Chromium worker that can't run on Vercel.
 *
 * Required env vars:
 *   REMOTION_AWS_REGION          — e.g. "us-east-1"
 *   REMOTION_AWS_ACCESS_KEY_ID   — IAM key with Lambda + S3 permissions
 *   REMOTION_AWS_SECRET_ACCESS_KEY
 *   REMOTION_LAMBDA_FUNCTION_NAME — the deployed Lambda function name
 *   REMOTION_SERVE_URL           — the S3 serve URL from `npx remotion lambda sites create`
 */

import { renderMediaOnLambda, getRenderProgress } from "@remotion/lambda/client";
import { updateRenderJob } from "@/lib/render-worker/job-manager";

const tag = "[LambdaRender]";

/* ── Config from env ────────────────────────────────────────────────────── */

function getConfig() {
  const region = process.env.REMOTION_AWS_REGION || "us-east-1";
  const functionName = process.env.REMOTION_LAMBDA_FUNCTION_NAME;
  const serveUrl = process.env.REMOTION_SERVE_URL;

  if (!functionName) throw new Error("Missing env: REMOTION_LAMBDA_FUNCTION_NAME");
  if (!serveUrl) throw new Error("Missing env: REMOTION_SERVE_URL");

  return { region: region as "us-east-1", functionName, serveUrl };
}

/* ── Types ──────────────────────────────────────────────────────────────── */

export interface LambdaRenderRequest {
  jobId: string;
  projectId: string;
  compositionId: string;
  inputProps: Record<string, unknown>;
  quality: "standard" | "premium" | "max";
  outputWidth?: number;
  outputHeight?: number;
}

/* ── Quality → codec + CRF mapping ─────────────────────────────────────── */

function qualitySettings(quality: string) {
  switch (quality) {
    case "max":
      return { codec: "h264" as const, crf: 15, concurrencyPerLambda: 1 };
    case "premium":
      return { codec: "h264" as const, crf: 18, concurrencyPerLambda: 1 };
    default: // standard
      return { codec: "h264" as const, crf: 23, concurrencyPerLambda: 1 };
  }
}

/* ── Main: fire render + poll progress ─────────────────────────────────── */

export async function invokeLambdaRender(req: LambdaRenderRequest): Promise<{
  renderId: string;
  bucketName: string;
}> {
  const config = getConfig();
  const qs = qualitySettings(req.quality);

  console.log(`${tag} Invoking Lambda render for job ${req.jobId}`);
  console.log(`${tag}   composition: ${req.compositionId}`);
  console.log(`${tag}   quality: ${req.quality} (crf=${qs.crf})`);
  console.log(`${tag}   function: ${config.functionName}`);

  // Update job status to "rendering"
  await updateRenderJob(req.jobId, {
    status: "rendering",
    stage: "Lambda invoke",
    progress: 5,
  });

  const { renderId, bucketName } = await renderMediaOnLambda({
    region: config.region,
    functionName: config.functionName,
    serveUrl: config.serveUrl,
    composition: req.compositionId,
    inputProps: req.inputProps,
    codec: qs.codec,
    crf: qs.crf,
    // framesPerLambda: 20,  // tune for cost/speed tradeoff
    privacy: "no-acl",
    downloadBehavior: { type: "play-in-browser" },
  });

  console.log(`${tag} ✅ Lambda render started: renderId=${renderId} bucket=${bucketName}`);
  return { renderId, bucketName };
}

/* ── Poll progress until done ──────────────────────────────────────────── */

export async function pollLambdaProgress(opts: {
  renderId: string;
  bucketName: string;
  jobId: string;
}): Promise<string> {
  const config = getConfig();
  const POLL_INTERVAL = 3000; // 3 seconds
  const MAX_POLLS = 300;      // 15 minutes max

  console.log(`${tag} Polling progress for renderId=${opts.renderId}`);

  for (let i = 0; i < MAX_POLLS; i++) {
    await sleep(POLL_INTERVAL);

    try {
      const progress = await getRenderProgress({
        renderId: opts.renderId,
        bucketName: opts.bucketName,
        functionName: config.functionName,
        region: config.region,
      });

      const pct = Math.round((progress.overallProgress ?? 0) * 100);

      // Update job progress in DB
      await updateRenderJob(opts.jobId, {
        progress: Math.min(pct, 95), // reserve 95-100 for upload
        stage: progress.fatalErrorEncountered
          ? "Lambda error"
          : `רינדור ${pct}%`,
      });

      if (progress.done) {
        if (progress.outputFile) {
          console.log(`${tag} ✅ Render complete: ${progress.outputFile}`);
          return progress.outputFile;
        }
        throw new Error("Render completed but no output file URL");
      }

      if (progress.fatalErrorEncountered) {
        const errMsg = progress.errors?.[0]?.message || "Unknown Lambda render error";
        console.error(`${tag} ❌ Fatal error during render: ${errMsg}`);
        throw new Error(`Lambda render failed: ${errMsg}`);
      }
    } catch (err) {
      // If it's our own thrown error, re-throw
      if (err instanceof Error && err.message.startsWith("Lambda render failed:")) throw err;
      if (err instanceof Error && err.message === "Render completed but no output file URL") throw err;
      // Otherwise log and continue polling
      console.warn(`${tag} Poll error (will retry): ${err instanceof Error ? err.message : err}`);
    }
  }

  throw new Error(`Lambda render timed out after ${MAX_POLLS * POLL_INTERVAL / 1000}s`);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
