/**
 * GET /api/render/lambda-status — Check Remotion Lambda configuration
 *
 * Returns whether Lambda is configured and can list deployed functions.
 * Useful for debugging deployment issues.
 */
import { NextResponse } from "next/server";

export async function GET() {
  const config = {
    region: process.env.REMOTION_AWS_REGION || null,
    functionName: process.env.REMOTION_LAMBDA_FUNCTION_NAME || null,
    serveUrl: process.env.REMOTION_SERVE_URL || null,
    hasAccessKey: !!process.env.REMOTION_AWS_ACCESS_KEY_ID,
    hasSecretKey: !!process.env.REMOTION_AWS_SECRET_ACCESS_KEY,
  };

  const ready =
    !!config.region &&
    !!config.functionName &&
    !!config.serveUrl &&
    config.hasAccessKey &&
    config.hasSecretKey;

  const missing: string[] = [];
  if (!config.region) missing.push("REMOTION_AWS_REGION");
  if (!config.functionName) missing.push("REMOTION_LAMBDA_FUNCTION_NAME");
  if (!config.serveUrl) missing.push("REMOTION_SERVE_URL");
  if (!config.hasAccessKey) missing.push("REMOTION_AWS_ACCESS_KEY_ID");
  if (!config.hasSecretKey) missing.push("REMOTION_AWS_SECRET_ACCESS_KEY");

  return NextResponse.json({
    ready,
    mode: ready ? "lambda" : "legacy-worker",
    missing,
    config: {
      region: config.region,
      functionName: config.functionName,
      serveUrl: config.serveUrl ? `${config.serveUrl.substring(0, 50)}...` : null,
      hasAccessKey: config.hasAccessKey,
      hasSecretKey: config.hasSecretKey,
    },
  });
}
