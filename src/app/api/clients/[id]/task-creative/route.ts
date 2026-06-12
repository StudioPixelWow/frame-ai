/**
 * POST /api/clients/[id]/task-creative  { ganttItemId, regenerate? }
 *
 * For a gantt content item: builds a deep creative spec (2 posts + 2 videos),
 * then generates 4 on-brand visual variations (A/B/C/D) via Higgsfield Soul —
 * conditioned on the client's logo + brand-assets folder — and saves both the
 * spec and the A/B/C/D images onto the gantt item.
 *
 * If Higgsfield isn't configured/usable, the spec is still saved (with the ready
 * image prompts) so nothing is lost.
 */
import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

import { clientGanttItems, clientFiles } from '@/lib/db';
import { getClientById } from '@/lib/db/client-helpers';
import { generateTaskCreativeSpec } from '@/lib/creative-spec/engine';
import { generateFullPost } from '@/lib/social-post/ai-generate';
import { uploadToStorage } from '@/lib/storage/upload';

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: clientId } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const ganttItemId = body.ganttItemId;
    if (!ganttItemId) return NextResponse.json({ error: 'ganttItemId נדרש' }, { status: 400 });

    const item: any = await clientGanttItems.getByIdAsync(ganttItemId);
    if (!item) return NextResponse.json({ error: 'פריט גאנט לא נמצא' }, { status: 404 });
    const client: any = await getClientById(clientId);

    // Brand references: logo + brand-asset images.
    let brandRefs: string[] = [];
    try {
      const files = await clientFiles.getAllAsync();
      brandRefs = (files as any[]).filter((f) => f.clientId === clientId && f.category === 'brand_asset' && f.fileUrl)
        .map((f) => f.fileUrl).slice(0, 6);
    } catch { /* */ }
    const logoUrl = client?.logoUrl || '';
    const refs = [logoUrl, ...brandRefs].filter(Boolean);

    // 1) Deep creative spec.
    const spec = await generateTaskCreativeSpec({
      ideaTitle: item.title || item.ideaSummary || 'תוכן',
      ideaSummary: item.ideaSummary || item.visualConcept || '',
      businessName: client?.name || '',
      businessField: client?.businessField || client?.clientType || '',
      marketingGoals: client?.marketingGoals || '',
      keyMessages: client?.keyMarketingMessages || '',
      hasLogo: !!logoUrl,
      brandAssetCount: brandRefs.length,
      platform: item.platform || 'instagram',
    });

    // 2) 4 DISTINCT FINISHED posts via a text-capable model (gpt-image-1). Each
    //    post is fully designed by the AI — visual + Hebrew headline + brand —
    //    no rigid template. Generated in parallel, then hosted on Supabase.
    const abcd: { label: string; url: string; prompt: string; message?: string; cta?: string; approach?: string; engine?: string }[] = [];
    let genError: string | null = null;
    const isStory = item.format === 'story' || item.itemType === 'story';
    const size: '1024x1536' | '1024x1024' = '1024x1536';
    const variations = (spec.variations?.length ? spec.variations : []).slice(0, 4);
    const brandLine = [
      client?.name ? `Brand: ${client.name}` : '',
      client?.businessField ? `(${client.businessField})` : '',
    ].filter(Boolean).join(' ');

    const buildPostPrompt = (v: { imagePrompt: string; message: string; cta: string }) => [
      `Design ONE complete, finished, premium Instagram ${isStory ? 'story (9:16)' : 'feed post (4:5 portrait)'} for a real advertising campaign.`,
      brandLine,
      `Visual concept: ${v.imagePrompt}`,
      v.message ? `Render this EXACT Hebrew headline text large, bold and perfectly legible as the main typography (spell every Hebrew letter correctly, right-to-left): "${v.message}".` : '',
      v.cta ? `Add a small, tasteful call-to-action in Hebrew: "${v.cta}".` : '',
      `Strong understanding of the brand's visual language: use the brand's real colors and logo from the references, harmonious typography, clean premium layout, clear hierarchy, one dominant hero subject, award-winning agency quality, ultra realistic where relevant. The result must look like a polished, ready-to-publish social post — NOT a plain photo and NOT a generic template.`,
    ].filter(Boolean).join(' ');

    try {
      const results = await Promise.all(variations.map(async (v) => {
        const prompt = buildPostPrompt(v);
        const r = await generateFullPost(prompt, refs, size);
        if (!r.b64) return { v, prompt, error: r.error || 'no_image' };
        try {
          const buf = Buffer.from(r.b64, 'base64');
          const up = await uploadToStorage({
            buffer: buf, fileName: `post-${ganttItemId}-${v.label}-${Date.now()}.png`,
            contentType: 'image/png', maxSize: 15 * 1024 * 1024,
          });
          return { v, prompt, url: up.publicUrl, engine: r.engine };
        } catch (e) { return { v, prompt, error: `upload_${e instanceof Error ? e.message : 'failed'}` }; }
      }));
      for (const r of results) {
        if ((r as any).url) abcd.push({ label: r.v.label, url: (r as any).url, prompt: r.prompt, message: r.v.message, cta: r.v.cta, approach: r.v.approach, engine: (r as any).engine });
        else genError = (r as any).error || genError;
      }
    } catch (e) { genError = e instanceof Error ? e.message : 'generation_failed'; }
    if (abcd.length > 0) genError = null;

    // 3) Persist onto the gantt item.
    const creative = { spec, abcd, genError, updatedAt: new Date().toISOString() };
    await clientGanttItems.updateAsync(ganttItemId, { creative } as any);

    return NextResponse.json({ success: true, creative, imagesGenerated: abcd.length, genError });
  } catch (e) {
    console.error('[task-creative] error:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'יצירת האפיון נכשלה' }, { status: 500 });
  }
}
