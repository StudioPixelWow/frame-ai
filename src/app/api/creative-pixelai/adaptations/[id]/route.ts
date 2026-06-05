/**
 * GET    /api/creative-pixelai/adaptations/[id]  → single adaptation + outputs
 * DELETE /api/creative-pixelai/adaptations/[id]  → delete (outputs cascade)
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/db/store";
import { getRequestRole } from "@/lib/auth/api-guard";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const sb = getSupabase();
    const { data: row, error } = await sb.from("creative_adaptations").select("*").eq("id", id).maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
    const { data: outputs } = await sb.from("creative_adaptation_outputs").select("*").eq("adaptation_id", id);
    return NextResponse.json({ adaptation: { ...(row as any), outputs: outputs || [] } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const role = getRequestRole(req);
    if (role !== "admin" && role !== "employee") {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    const { id } = await context.params;
    const sb = getSupabase();
    const { error } = await sb.from("creative_adaptations").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
  }
}
