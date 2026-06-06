/**
 * POST /api/ugc/generate   { projectId }
 *
 * Generates the full UGC production package (3 variations + storyboard + tool
 * prompts + QC) for a project, persists it, and returns it. Admin/employee only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/store';
import { getRequestRole } from '@/lib/auth/api-guard';
import { ensureUgcTables, ugcId } from '@/lib/ugc/ugc-db';
import { generateUgcPackage, type UgcBrief } from '@/lib/ugc/ugc-generator';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  if (getRequestRole(req) === 'client') return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 });
  try {
    await ensureUgcTables();
    const { projectId } = await req.json().catch(() => ({}));
    if (!projectId) return NextResponse.json({ error: 'projectId נדרש' }, { status: 400 });
    const sb = getSupabase();
    const { data: project } = await sb.from('ugc_projects').select('*').eq('id', projectId).maybeSingle();
    if (!project) return NextResponse.json({ error: 'הפרויקט לא נמצא' }, { status: 404 });

    const b: any = (project as any).brief_json || {};
    const brief: UgcBrief = {
      businessName: b.businessName || (project as any).business_name,
      businessType: b.businessType || (project as any).business_type || 'אחר',
      goal: b.goal || (project as any).goal || '',
      targetAudience: b.targetAudience || (project as any).target_audience || '',
      tone: b.tone || (project as any).tone || 'אותנטי',
      sellingPoints: b.sellingPoints || '',
      location: b.location || '',
      presenterType: b.presenterType || 'real',
      existingAssets: b.existingAssets || '',
      duration: b.duration || (project as any).duration || 30,
      language: b.language || (project as any).language || 'he',
      style: b.style || (project as any).style || '',
    };

    const pkg = await generateUgcPackage(brief);

    // Persist: result_json on project + script/prompt rows (best-effort).
    const now = new Date().toISOString();
    await sb.from('ugc_projects').update({ result_json: pkg, status: 'generated', updated_at: now }).eq('id', projectId);
    try {
      for (const v of pkg.variations) {
        await sb.from('ugc_scripts').insert({
          id: ugcId('ugcs'), project_id: projectId, variation_label: v.label, hook: v.hook,
          full_script: v.fullScript, shot_breakdown: v.shots, captions: v.captions, cta: v.cta,
          status: 'generated', created_at: now,
        });
        for (const p of v.toolPrompts) {
          await sb.from('ugc_prompts').insert({
            id: ugcId('ugcp'), project_id: projectId, variation_label: v.label,
            tool_name: p.tool, prompt_type: p.type, prompt_text: p.prompt, status: 'ready', created_at: now,
          });
        }
      }
    } catch { /* optional record-keeping */ }

    return NextResponse.json({ success: true, package: pkg });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'failed';
    if (/timeout|abort/i.test(msg)) return NextResponse.json({ error: 'היצירה ארכה מדי — נסה שוב' }, { status: 504 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
