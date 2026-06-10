/**
 * POST /api/seo/keyword-research
 *  - { action:'ideas', seed, country?, language?, limit? } → keyword ideas
 *  - { action:'ai_questions', keywords:[...], businessName? } → natural AI-search
 *    questions generated from the keywords (the SEO→GEO bridge)
 */
import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const maxDuration = 45;

import { ensureSeeded } from '@/lib/db/seed';
import { getKeywordIdeas, keywordProviderConfigured } from '@/lib/seo/keyword-research/provider';
import { generateWithAI } from '@/lib/ai/openai-client';

export async function POST(req: NextRequest) {
  ensureSeeded();
  try {
    const body = await req.json();
    const action = body.action || 'ideas';

    if (action === 'ai_questions') {
      const keywords: string[] = Array.isArray(body.keywords) ? body.keywords.slice(0, 30) : [];
      if (!keywords.length) return NextResponse.json({ error: 'בחר ביטויים' }, { status: 400 });
      const system = `אתה מומחה GEO (אופטימיזציה למנועי AI). הפוך ביטויי חיפוש לשאלות טבעיות שאנשים שואלים מנועי AI (ChatGPT/Gemini/Perplexity) — בעברית, בגוף ראשון, כפי שלקוח אמיתי ישאל לפני קנייה. החזר JSON בלבד: {"questions":["...","..."]}`;
      const user = `הביטויים:\n${keywords.join('\n')}\n\nצור שאלת AI אחת לכל ביטוי (שאלה אחת לכל שורה), טבעית וממירה.`;
      const res = await generateWithAI(system, user, { temperature: 0.7, maxTokens: 1200 });
      const d = res.success ? (res.data as any) : null;
      const questions: string[] = Array.isArray(d?.questions) ? d.questions : (Array.isArray(d) ? d : keywords.map((k) => `איפה ${k}?`));
      return NextResponse.json({ success: true, questions });
    }

    const seed = String(body.seed || '').trim();
    if (!seed) return NextResponse.json({ error: 'הזן ביטוי מקור' }, { status: 400 });
    const { ideas, mock } = await getKeywordIdeas(seed, body.country || 'Israel', body.language || 'Hebrew', Number(body.limit) || 100);
    return NextResponse.json({ success: true, ideas, mock, configured: keywordProviderConfigured() });
  } catch (e) {
    console.error('[keyword-research] error:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'החיפוש נכשל' }, { status: 400 });
  }
}
