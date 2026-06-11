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

    // 2) A/B/C/D visuals via Higgsfield (2 prompts × 2 = 4). Best-effort.
    const abcd: { label: string; url: string; prompt: string }[] = [];
    let genError: string | null = null;
    if (higgsfieldConfigured()) {
      const labels = ['A', 'B', 'C', 'D'];
      const isStory = item.format === 'story' || item.itemType === 'story';
      const size = isStory ? '1536x2048' : '1536x1536';
      // Soul accepts batch_size 1 or 4 → one call for 4 on-brand A/B/C/D variations.
      const prompt = (spec.posts[0]?.imagePrompt || spec.posts[1]?.imagePrompt || spec.headline) as string;
      try {
        const start = await startSoulImages(prompt, { count: 4, size, quality: '1080p', referenceImageUrls: refs });
        const immediate = start.immediateUrls || [];
        let urls: string[] = immediate;
        if (!urls.length && start.ok && start.jobs[0]) {
          const polled = await pollSoulJob(start.jobs[0], { tries: 40, intervalMs: 3500 }); // ~140s
          urls = polled.urls;
          if (!urls.length) genError = `poll_${polled.status}`;
        } else if (!urls.length && !start.ok) {
          genError = start.error || 'start_failed';
        }
        urls.slice(0, 4).forEach((url, i) => abcd.push({ label: labels[i] || `V${i + 1}`, url, prompt }));
      } catch (e) { genError = e instanceof Error ? e.message : 'generation_failed'; }
      // If we got at least one image, don't surface a partial error as a hard failure.
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
