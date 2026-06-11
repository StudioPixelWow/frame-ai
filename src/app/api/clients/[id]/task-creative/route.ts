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
      const prompts = [spec.posts[0]?.imagePrompt, spec.posts[1]?.imagePrompt].filter(Boolean) as string[];
      const labels = ['A', 'B', 'C', 'D'];
      let li = 0;
      try {
        for (const prompt of (prompts.length ? prompts : [spec.headline])) {
          const start = await startSoulImages(prompt, { count: 2, size: item.format === 'story' || item.itemType === 'story' ? '1536x2048' : '2048x2048', quality: '1080p', referenceImageUrls: refs });
          if (start.ok && start.jobs[0]) {
            const polled = await pollSoulJob(start.jobs[0], { tries: 24, intervalMs: 3000 });
            for (const url of polled.urls.slice(0, 2)) { abcd.push({ label: labels[li++] || `V${li}`, url, prompt }); }
          } else if (start.error) { genError = start.error; }
        }
      } catch (e) { genError = e instanceof Error ? e.message : 'generation_failed'; }
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
