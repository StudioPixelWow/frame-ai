/**
 * GET  /api/creative-pixelai/adaptations          → history list (with outputs)
 * POST /api/creative-pixelai/adaptations          → save adaptation + outputs
 *
 * Tables are auto-created via ensureTable (exec_sql RPC), matching the system's
 * existing pattern. IDs are TEXT to match the rest of the system (cli_..., emails).
 * Security follows the existing model: service-role server-side + role headers.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabase, ensureTable } from "@/lib/db/store";
import { getRequestRole } from "@/lib/auth/api-guard";

export const dynamic = "force-dynamic";

const T_MAIN = "creative_adaptations";
const T_OUT = "creative_adaptation_outputs";

export const DDL_MAIN = `
  CREATE TABLE IF NOT EXISTS public.${T_MAIN} (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id text NOT NULL DEFAULT 'admin',
    client_id text,
    campaign_id text,
    original_asset_url text NOT NULL,
    original_file_name text,
    original_width integer NOT NULL,
    original_height integer NOT NULL,
    original_mime_type text,
    openai_analysis_json jsonb,
    selected_formats text[] NOT NULL DEFAULT '{}',
    status text NOT NULL DEFAULT 'draft',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
  );
`;

export const DDL_OUT = `
  CREATE TABLE IF NOT EXISTS public.${T_OUT} (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    adaptation_id uuid NOT NULL REFERENCES public.${T_MAIN}(id) ON DELETE CASCADE,
    output_format text NOT NULL,
    output_width integer NOT NULL,
    output_height integer NOT NULL,
    output_asset_url text NOT NULL,
    background_type text,
    placement text,
    scale_mode text,
    padding integer,
    blur_amount integer,
    brightness numeric,
    export_type text,
    created_at timestamptz DEFAULT now()
  );
`;

async function ensureTables() {
  await ensureTable(T_MAIN, DDL_MAIN);
  await ensureTable(T_OUT, DDL_OUT);
}

function userIdFrom(req: NextRequest): string {
  return req.headers.get("x-app-user-id") || req.headers.get("x-app-employee-id") || "admin";
}

export async function GET(req: NextRequest) {
  try {
    await ensureTables();
    const sb = getSupabase();
    const role = getRequestRole(req);
    const uid = userIdFrom(req);

    let q = sb.from(T_MAIN).select("*").order("created_at", { ascending: false }).limit(100);
    if (role !== "admin") q = q.eq("user_id", uid);
    const { data: rows, error } = await q;
    if (error) return NextResponse.json({ adaptations: [], error: error.message });

    const ids = (rows || []).map((r: any) => r.id);
    let outputs: any[] = [];
    if (ids.length > 0) {
      const { data: outs } = await sb.from(T_OUT).select("*").in("adaptation_id", ids);
      outputs = outs || [];
    }

    const adaptations = (rows || []).map((r: any) => ({
      ...r,
      outputs: outputs.filter((o) => o.adaptation_id === r.id),
    }));
    return NextResponse.json({ adaptations });
  } catch (e) {
    return NextResponse.json({ adaptations: [], error: e instanceof Error ? e.message : "Unknown error" });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureTables();
    const sb = getSupabase();
    const body = await req.json();
    const uid = userIdFrom(req);

    const {
      originalAssetUrl, originalFileName, originalWidth, originalHeight, originalMimeType,
      clientId, campaignId, analysis, selectedFormats, status, outputs,
    } = body as any;

    if (!originalAssetUrl || !originalWidth || !originalHeight) {
      return NextResponse.json({ error: "originalAssetUrl + dimensions required" }, { status: 400 });
    }

    const { data: inserted, error } = await sb
      .from(T_MAIN)
      .insert({
        user_id: uid,
        client_id: clientId || null,
        campaign_id: campaignId || null,
        original_asset_url: originalAssetUrl,
        original_file_name: originalFileName || null,
        original_width: originalWidth,
        original_height: originalHeight,
        original_mime_type: originalMimeType || null,
        openai_analysis_json: analysis || null,
        selected_formats: Array.isArray(selectedFormats) ? selectedFormats : [],
        status: status || "completed",
        updated_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    let savedOutputs: any[] = [];
    if (Array.isArray(outputs) && outputs.length > 0) {
      const rows = outputs.map((o: any) => ({
        adaptation_id: (inserted as any).id,
        output_format: o.format,
        output_width: o.width,
        output_height: o.height,
        output_asset_url: o.url,
        background_type: o.backgroundType || null,
        placement: o.placement || null,
        scale_mode: o.scaleMode || null,
        padding: o.padding ?? null,
        blur_amount: o.blurAmount ?? null,
        brightness: o.brightness ?? null,
        export_type: o.exportType || "png",
      }));
      const { data: outRows, error: outErr } = await sb.from(T_OUT).insert(rows).select("*");
      if (outErr) console.warn("[creative-pixelai] outputs insert failed:", outErr.message);
      savedOutputs = outRows || [];
    }

    return NextResponse.json({ adaptation: { ...(inserted as any), outputs: savedOutputs } }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
  }
}
