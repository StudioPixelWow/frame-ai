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
import { higgsfieldConfigured, startSoulImages, pollSoulJob } from '@/lib/higgsfield/client';

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

    // 2) Premium VISUAL-ONLY backgrounds via Higgsfield Soul (no text in image).
    //    Headlines/CTA/logo are added later in the design/overlay layer. Each
    //    variation carries its own overlay guidance for the designer.
    const abcd: { label: string; url: string; prompt: string; tier?: string; concept?: string; heroObject?: string; overlay?: any; aspectRatio?: string; message?: string; cta?: string }[] = [];
    let genError: string | null = null;
    const variations = (spec.variations?.length ? spec.variations : []).slice(0, 4);
    // Higgsfield Soul valid sizes → map from the variation's aspect ratio.
    const sizeFor = (ar?: string) => (ar === '1:1' ? '1536x1536' : ar === '2:1' ? '2048x1536' : '1536x2048');

    if (higgsfieldConfigured()) {
      try {
        // Phase 1: fire all generations (fast POSTs) so they queue concurrently.
        const started = await Promise.all(variations.map(async (v) => {
          const start = await startSoulImages(v.imagePrompt, {
            count: 1, size: sizeFor(v.aspectRatio), quality: '1080p',
            referenceImageUrls: refs, negativePrompt: v.negativePrompt || spec.negativePrompt, enhancePrompt: true,
          });
          return { v, start };
        }));
        // Phase 2: poll each.
        for (const { v, start } of started) {
          let urls: string[] = start.immediateUrls || [];
          if (!urls.length && start.ok && start.jobs[0]) {
            const polled = await pollSoulJob(start.jobs[0], { tries: 36, intervalMs: 3000 });
            urls = polled.urls;
            if (!urls.length) genError = `poll_${polled.status}`;
          } else if (!urls.length && !start.ok) {
            genError = start.error || 'start_failed';
          }
          if (urls[0]) abcd.push({
            label: v.label, url: urls[0], prompt: v.imagePrompt,
            tier: v.tier, concept: v.concept, heroObject: v.heroObject,
            overlay: v.overlay, aspectRatio: v.aspectRatio,
            message: v.overlay?.headline, cta: v.overlay?.cta,
          });
        }
      } catch (e) { genError = e instanceof Error ? e.message : 'generation_failed'; }
      if (abcd.length > 0) genError = null;
    } else {
      genError = 'higgsfield_not_configured';
    }

    // 3) Persist onto the gantt item.
    const creative = { spec, abcd, genError, updatedAt: new Date().toISOString() };
    await clientGanttItems.updateAsync(ganttItemId, { creative } as any);

    return NextResponse.json({ success: true, creative, imagesGenerated: abcd.length, genError });
  } catch (e) {
    console.error('[task-creative] error:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'יצירת האפיון נכשלה' }, { status: 500 });
  }
}
