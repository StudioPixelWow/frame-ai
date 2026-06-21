/**
 * POST /api/daily-tasks/generate
 * Creates a new Gantt item for a client using AI.
 */

import { NextRequest, NextResponse } from 'next/server';
import { clientGanttItems } from '@/lib/db/collections';
import { generateWithAI, getClientKnowledgeContext } from '@/lib/ai/openai-client';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { clientId, date } = await req.json();

    if (!clientId || !date) {
      return NextResponse.json({ error: 'Missing clientId or date' }, { status: 400 });
    }

    // Load client knowledge
    let clientContext = '';
    try {
      clientContext = await getClientKnowledgeContext(clientId);
    } catch { /* fallback */ }

    // Load recent items to avoid duplicates
    let recentItems: any[] = [];
    try {
      recentItems = await clientGanttItems.queryFilteredAsync([
        { column: 'data->>clientId', op: 'eq', value: clientId }
      ], { limit: 10 });
    } catch { /* ok */ }

    const recentTitles = recentItems
      .filter((r: any) => r.title)
      .map((r: any) => `- ${r.title}`)
      .slice(0, 8)
      .join('\n');

    const dateObj = new Date(date + 'T12:00:00');
    const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
    const dayName = dayNames[dateObj.getDay()];

    const systemPrompt = `אתה מומחה לשיווק דיגיטלי בישראל. צור פוסט חדש ומקורי לרשתות חברתיות.
היום: יום ${dayName}, ${dateObj.toLocaleDateString('he-IL')}

${clientContext ? `מידע על הלקוח:\n${clientContext}` : ''}
${recentTitles ? `\nפוסטים אחרונים (לא לחזור עליהם):\n${recentTitles}` : ''}

החזר JSON בלבד (ללא markdown) בפורמט:
{
  "title": "כותרת קצרה",
  "ideaSummary": "תיאור הרעיון ב-2-3 משפטים",
  "caption": "כיתוב מלא לפוסט עם אמוג'ים, 3-5 משפטים",
  "graphicText": "2 שורות קצרות לעיצוב הגרפי",
  "visualConcept": "תיאור הקונספט הוויזואלי",
  "platform": "facebook",
  "format": "image"
}`;

    const userPrompt = `צור פוסט יצירתי ומקורי ללקוח עבור היום. הפוסט צריך להיות רלוונטי, מעניין, ולגרום לתגובות ושיתופים.`;

    const result = await generateWithAI(systemPrompt, userPrompt, { temperature: 0.9, maxTokens: 1500 });

    if (!result.success || !result.data) {
      return NextResponse.json({ error: result.error || 'AI generation failed' }, { status: 500 });
    }

    let parsed: any;
    try {
      // generateWithAI already attempts JSON parsing — data may be a parsed object or raw string
      if (typeof result.data === 'string') {
        const cleaned = result.data.replace(/```json\s*\n?/g, '').replace(/```\s*/g, '').trim();
        parsed = JSON.parse(cleaned);
      } else {
        parsed = result.data;
      }
    } catch {
      return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 });
    }

    const newItem = {
      clientId,
      ganttType: 'monthly' as const,
      month: dateObj.getMonth() + 1,
      year: dateObj.getFullYear(),
      date,
      title: parsed.title || 'פוסט חדש',
      ideaSummary: parsed.ideaSummary || '',
      caption: parsed.caption || '',
      graphicText: parsed.graphicText || '',
      visualConcept: parsed.visualConcept || '',
      platform: parsed.platform || 'facebook',
      format: parsed.format || 'image',
      itemType: 'educational',
      status: 'planned',
      relatedVideoId: '',
      relatedFileUrl: '',
      imageUrls: [],
      attachedFiles: [],
      assigneeId: null,
      assignedManagerId: null,
      internalNotes: '',
      clientNotes: '',
      holidayTag: '',
      campaignTag: '',
      monthTheme: '',
      suggestedRhythm: '',
      keyOpportunities: '',
    };

    const created = await clientGanttItems.createAsync(newItem);

    return NextResponse.json({ success: true, createdItem: created });
  } catch (err: any) {
    console.error('[daily-tasks/generate] Error:', err);
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}
