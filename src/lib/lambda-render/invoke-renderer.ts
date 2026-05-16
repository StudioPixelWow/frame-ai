/**
 * PixelManageAI — Render Invocation Layer (DEPRECATED)
 *
 * Lambda rendering has been deprecated in favor of the Railway worker.
 * These functions are kept as stubs to satisfy existing imports.
 * The actual rendering happens in src/lib/render-worker/worker.ts
 *
 * If Lambda is needed in the future, reinstall @remotion/lambda and restore.
 */

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

/* ── Stub: invokeLambdaRender ─────────────────────────────────────────── */

export async function invokeLambdaRender(_req: LambdaRenderRequest): Promise<{
  renderId: string;
  bucketName: string;
}> {
  throw new Error(
    "[LambdaRender] Lambda rendering is deprecated. Use the Railway worker instead. " +
    "Remove REMOTION_LAMBDA_FUNCTION_NAME from env to disable this code path."
  );
}

/* ── Stub: pollLambdaProgress ─────────────────────────────────────────── */

export async function pollLambdaProgress(_opts: {
  renderId: string;
  bucketName: string;
  jobId: string;
}): Promise<string> {
  throw new Error(
    "[LambdaRender] Lambda polling is deprecated. The Railway worker updates job progress directly in the DB."
  );
}
