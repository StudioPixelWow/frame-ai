/**
 * POST /api/seo-geo-plans/pr-opportunities   { planId }
 *
 * Off-site authority engine: AI proposes relevant publications, communities
 * (Reddit/Quora — heavily cited by Perplexity), directories and a ready-to-send
 * pitch + byline angle. This builds the EXTERNAL mentions that AI engines weigh
 * most. Admin/employee only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { seoPlans } from '@/lib/db';
import { getRequestRole } from '@/lib/auth/api-guard';
import { generateWithAI } from '@/lib/ai/openai-client';

export const dynamic = 'force-dynamic';
export const maxDuration = 90;

export async function POST(req: NextRequest) {
  if (getRequestRole(req) === 'client') {
    return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 });
  }
  try {
    const { planId } = await req.json().catch(() => ({}));
    if (!planId) return NextResponse.json({ error: 'planId נדרש' }, { status: 400 });
    const plan: any = await seoPlans.getByIdAsync(planId);
    if (!plan) return NextResponse.json({ error: 'התוכנית לא נמצאה' }, { status: 404 });

    const businessName = plan.businessName || plan.clientName || '';
    const facts = plan.websiteScan?.websiteFacts || {};
    const industry = facts.detected_industry?.value || facts.industry || plan.businessProfile?.industry || '';
    const location = facts.detected_location?.value || facts.location || plan.businessProfile?.location || 'ישראל';
    const kwList = (Array.isArray(plan.clientKeywords) && plan.clientKeywords.length ? plan.clientKeywords : plan.targetKeywords) || [];
    const keywords = kwList.map((k: any) => (typeof k === 'string' ? k : k?.keyword)).filter(Boolean).slice(0, 10);

    const system = 'אתה אסטרטג PR דיגיטלי ו-GEO. אתה מזהה הזדמנויות אזכור חיצוני שמנועי AI מצטטים (אתרי תוכן סמכותיים, Reddit, Quora, מדריכים, השוואות). החזר JSON תקין בלבד.';
    const user = `עסק: ${businessName}${industry ? `, תחום: ${industry}` : ''}, אזור: ${location}. ביטויי מפתח: ${keywords.join(', ') || '—'}.

הצע הזדמנויות לבניית סמכות חוץ-אתרית שיגרמו למנועי AI לצטט את העסק. החזר JSON:
{
  "outlets": [
    { "name": "שם הפרסום/קהילה", "type": "publication|reddit|quora|directory|guest_post", "why": "למה זה רלוונטי", "action": "מה לעשות בפועל" }
  ],
  "pitchEmail": { "subject": "נושא מייל פיץ'", "body": "גוף מייל קצר ומשכנע לעורך/בעל אתר" },
  "bylineIdea": { "title": "כותרת מאמר אורח מוצע", "angle": "הזווית הייחודית" }
}
דרישות: 6-10 outlets מגוונים (כולל Reddit/Quora רלוונטיים אם קיימים), בעברית. action קונקרטי.`;

    let data: any = {};
    try {
      const out = await generateWithAI(system, user, { temperature: 0.6, maxTokens: 1800 });
      data = JSON.parse(out.slice(out.indexOf('{'), out.lastIndexOf('}') + 1));
    } catch (e) {
      return NextResponse.json({ error: 'יצירת ההמלצות נכשלה — נסה שוב' }, { status: 502 });
    }

    return NextResponse.json({
      success: true,
      outlets: Array.isArray(data.outlets) ? data.outlets : [],
      pitchEmail: data.pitchEmail || null,
      bylineIdea: data.bylineIdea || null,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'נכשל' }, { status: 500 });
  }
}
