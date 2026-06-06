/**
 * GET  /api/ugc/projects        → list UGC projects
 * POST /api/ugc/projects        → create a UGC project (brief)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/store';
import { getRequestRole } from '@/lib/auth/api-guard';
import { ensureUgcTables, ugcId } from '@/lib/ugc/ugc-db';

export const dynamic = 'force-dynamic';

function uid(req: NextRequest): string {
  return req.headers.get('x-app-user-id') || req.headers.get('x-app-employee-id') || 'admin';
}

export async function GET(req: NextRequest) {
  try {
    await ensureUgcTables();
    const sb = getSupabase();
    const role = getRequestRole(req);
    let q = sb.from('ugc_projects').select('*').order('created_at', { ascending: false }).limit(100);
    if (role !== 'admin') q = q.eq('user_id', uid(req));
    const { data, error } = await q;
    if (error) return NextResponse.json({ projects: [], error: error.message });
    return NextResponse.json({ projects: data || [] });
  } catch (e) {
    return NextResponse.json({ projects: [], error: e instanceof Error ? e.message : 'failed' });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureUgcTables();
    const sb = getSupabase();
    const body = await req.json();
    if (!body.businessName) return NextResponse.json({ error: 'שם העסק נדרש' }, { status: 400 });

    const id = ugcId();
    const now = new Date().toISOString();
    const row = {
      id, user_id: uid(req), client_id: body.clientId || null,
      business_name: body.businessName, business_type: body.businessType || null,
      goal: body.goal || null, target_audience: body.targetAudience || null,
      tone: body.tone || null, language: body.language || 'he',
      duration: body.duration || 30, style: body.style || null,
      brand_colors: body.brandColors || null, logo_url: body.logoUrl || null,
      brief_json: body, status: 'draft', created_at: now, updated_at: now,
    };
    const { data, error } = await sb.from('ugc_projects').insert(row).select('*').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Record inputs row (best-effort).
    try {
      await sb.from('ugc_video_inputs').insert({
        id: ugcId('ugci'), project_id: id, selling_points: body.sellingPoints || null,
        location: body.location || null, existing_assets: body.existingAssets || null,
        presenter_type: body.presenterType || null, ai_tools_selected: body.aiToolsSelected || null,
        notes: body.notes || null, created_at: now,
      });
    } catch { /* optional */ }

    return NextResponse.json({ project: data }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'failed' }, { status: 500 });
  }
}
