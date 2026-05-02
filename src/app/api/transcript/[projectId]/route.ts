/**
 * GET  /api/transcript/:projectId  — retrieve stored analysis
 * DELETE /api/transcript/:projectId — delete stored analysis
 */

import { NextRequest, NextResponse }        from "next/server";
import { getAnalysis, deleteAnalysis }      from "@/lib/transcript";

type Params = { params: Promise<{ projectId: string }> };

export async function GET(_req: NextRequest, context: Params) {
  const { projectId } = await context.params;
  const analysis = await getAnalysis(projectId);
  if (!analysis) {
    return NextResponse.json(
      { error: `No analysis found for project "${projectId}"` },
      { status: 404 }
    );
  }
  return NextResponse.json(analysis);
}

export async function DELETE(_req: NextRequest, context: Params) {
  const { projectId } = await context.params;
  const deleted = await deleteAnalysis(projectId);
  if (!deleted) {
    return NextResponse.json(
      { error: `No analysis found for project "${projectId}"` },
      { status: 404 }
    );
  }
  return NextResponse.json({ deleted: true, projectId });
}
