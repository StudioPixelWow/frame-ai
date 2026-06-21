/**
 * POST /api/daily-tasks/regenerate
 * Regenerates a Gantt item's content using AI.
 */

import { NextRequest, NextResponse } from 'next/server';
import { clientGanttItems } from '@/lib/db/collections';
import { generateWithAI, getClientKnowledgeContext } from '@/lib/ai/openai-client';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { ganttItemId, clientId } = await req.json();

    if (!ganttItemId || !clientId) {
      return NextResponse.json({ error: 'Missing ganttItemId or clientId' }, { status: 400 });
    }

    // Load client knowledge context
    let clientContext = '';
    try {
      clientContext = await getClientKnowledgeContext(clientId);
    } catch { /* fallback to empty */ }

    // Load existing gantt item
    const allItems = await clientGanttItems.queryFilteredAsync([
      { column: 'id', op: 'eq', value: ganttItemId }
    ]);
    const item = allItems?.[0];

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    // Load other items for this client to understand their content patterns
    let recentItems: any[] = [];
    try {
      recentItems = await clientGanttItems.queryFilteredAsync([
        { column: 'data->>clientId', op: 'eq', value: clientId }
      ], { limit: 10 });
    } catch { /* ok */ }

    const recentTitles = recentItems
      .filter((r: any) => r.id !== ganttItemId && r.title)
      .map((r: any) => `- ${r.title}: ${r.ideaSummary || ''}`)
      .slice(0, 5)
      .join('\n');

    const systemPrompt = `אתה מומחה לשיווק דיגיטלי בישראל. אתה יוצר תוכן לפוסטים ברשתות חברתיות.
צור פוסט חדש עבור הלקוח.
הפלטפורמה: ${item.platform || 'facebook'}
הפורמט: ${item.format || 'image'}

${clientContext ? `\nמידע על הלקוח:\n${clientContext}` : ''}
${recentTitles ? `\nפוסטים אחרונים של הלקוח (לא לחזור על נושאים):\n${recentTitles}` : ''}

החזר JSON בלבד (ללא markdown) בפורמט:
{
  "title": "כותרת קצרה וקולעת",
  "ideaSummary": "תיאור הרעיון ב-2-3 משפטים",
  "caption": "כיתוב מלא לפוסט עם אמוג'ים והנעה לפעולה, 3-5 משפטים",
  "graphicText": "2 שורות קצרות לעיצוב הגרפי",
  "visualConcept": "תיאור מפורט של הקונספט הוויזואלי, צבעים, אלמנטים"
}`;

    const userPrompt = `צור פוסט חדש ומקורי עבור הפלטפורמה ${item.platform || 'facebook'} בפורמט ${item.format || 'image'}.
הפוסט הנוכחי שצריך לעדכן: "${item.title || ''}"
תיאור נוכחי: "${item.ideaSummary || ''}"
צור גרסה חדשה ושונה לחלוטין, יצירתית ומעניינת.`;

    const result = await generateWithAI(systemPrompt, userPrompt, { temperature: 0.85, maxTokens: 1500 });

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

    const updates = {
      title: parsed.title || item.title,
      ideaSummary: parsed.ideaSummary || item.ideaSummary,
      caption: parsed.caption || item.caption,
      graphicText: parsed.graphicText || item.graphicText,
      visualConcept: parsed.visualConcept || item.visualConcept,
    };

    await clientGanttItems.updateAsync(ganttItemId, updates);

    return NextResponse.json({ success: true, updatedItem: updates });
  } catch (err: any) {
    console.error('[daily-tasks/regenerate] Error:', err);
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}
