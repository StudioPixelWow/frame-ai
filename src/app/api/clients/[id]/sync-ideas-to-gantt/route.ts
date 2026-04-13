/**
 * POST /api/clients/[id]/sync-ideas-to-gantt
 * Takes selected content ideas from research and generates full AI creative for each,
 * then creates gantt items. Also supports manual topic entry and holiday auto-injection.
 */

import { NextRequest, NextResponse } from 'next/server';
import { clients, clientGanttItems } from '@/lib/db';
import { clientResearch } from '@/lib/db/collections';
import { ensureSeeded } from '@/lib/db/seed';
import { generateWithAI, getClientKnowledgeContext } from '@/lib/ai/openai-client';
import { getHolidaysForMonth } from '@/lib/israeli-holidays';
import type { ClientGanttItem, ContentFormat, ClientResearch } from '@/lib/db';

interface SelectedIdea {
  id: string;
  title: string;
  explanation: string;
  category: string;
}

interface SyncRequest {
  ideas: SelectedIdea[];
  month: number; // 1-12
  year: number;
  researchId?: string;
  // Manual entry mode
  manualTopic?: string;
  manualDate?: string; // ISO date string
  manualContentType?: string; // post / reel / story
  // Holiday injection mode
  injectHolidays?: boolean;
}

interface GeneratedCreative {
  title: string;
  ideaSummary: string;
  graphicText: string;
  caption: string;
  cta: string;
  visualConcept: string;
  platform: string;
  format: string;
}

function daysInMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate();
}

const HEBREW_MONTHS: Record<number, string> = {
  1: 'ינואר', 2: 'פברואר', 3: 'מרץ', 4: 'אפריל', 5: 'מאי', 6: 'יוני',
  7: 'יולי', 8: 'אוגוסט', 9: 'ספטמבר', 10: 'אוקטובר', 11: 'נובמבר', 12: 'דצמבר',
};

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  ensureSeeded();

  try {
    const { id } = await context.params;
    const body: SyncRequest = await req.json();

    const client = clients.getById(id);
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 400 });
    }

    // Load research for context
    const researchRecords = clientResearch.query((r: ClientResearch) => r.clientId === id);
    const latestResearch = researchRecords.length > 0 ? researchRecords[researchRecords.length - 1] : null;

    // Build client context for AI
    const researchContext = latestResearch ? buildResearchContext(latestResearch) : '';
    const knowledgeContext = getClientKnowledgeContext(id);

    // ============================================================
    // MODE 1: Manual topic entry
    // ============================================================
    if (body.manualTopic) {
      console.log(`[SyncToGantt] Manual entry mode for client ${client.name}: "${body.manualTopic}"`);
      const creative = await generateCreativeForIdea(
        {
          id: 'manual_' + Date.now(),
          title: body.manualTopic,
          explanation: 'נושא שהוזן ידנית על ידי המשתמש',
          category: 'brand',
        },
        client,
        researchContext,
        knowledgeContext,
        latestResearch
      );

      const itemDate = body.manualDate || new Date(body.year, body.month - 1, 1).toISOString().split('T')[0];
      const contentTypeMap: Record<string, string> = {
        post: 'social_post',
        reel: 'reel',
        story: 'story',
        carousel: 'carousel',
      };
      const itemType = contentTypeMap[body.manualContentType || 'post'] || 'social_post';
      const format = body.manualContentType === 'reel' ? 'reel' : body.manualContentType === 'story' ? 'story' : 'image';

      const ganttItem = createGanttItem(
        id, creative, body.month, body.year, itemDate,
        'manual', body.manualTopic,
        undefined, itemType, creative.platform || 'instagram', format as ContentFormat,
        client
      );
      clientGanttItems.create(ganttItem);

      return NextResponse.json({
        success: true,
        message: 'רשומה ידנית נוצרה והושלמה על ידי AI',
        items: [ganttItem],
        source: 'manual',
      });
    }

    // ============================================================
    // MODE 2: Holiday auto-injection
    // ============================================================
    if (body.injectHolidays) {
      console.log(`[SyncToGantt] Holiday injection for ${HEBREW_MONTHS[body.month]} ${body.year}`);
      const holidays = getHolidaysForMonth(body.month, body.year);
      const existingItems = clientGanttItems.getAll().filter(
        (item) => item.clientId === id && item.month === body.month && item.year === body.year
      );

      const holidayItems: ClientGanttItem[] = [];
      for (const holiday of holidays) {
        // Dedup check: skip if holiday already exists
        const alreadyExists = existingItems.some(
          (item) => item.holidayTag === holiday.hebrewName || (item.title && item.title.includes(holiday.hebrewName))
        );
        if (alreadyExists) {
          console.log(`[SyncToGantt] Holiday "${holiday.hebrewName}" already exists, skipping`);
          continue;
        }

        // Generate creative AI content for the holiday
        const creative = await generateCreativeForIdea(
          {
            id: `holiday_${holiday.name}`,
            title: `תוכן ל${holiday.hebrewName}`,
            explanation: `פוסט יצירתי ל${holiday.hebrewName} שמחבר את החג לעסק של ${client.name}. לא "חג שמח מ..." — אלא ערך אמיתי ללקוח.`,
            category: 'seasonal',
          },
          client,
          researchContext,
          knowledgeContext,
          latestResearch
        );

        const itemDate = new Date(body.year, body.month - 1, holiday.approximateDay).toISOString().split('T')[0];

        const ganttItem = createGanttItem(
          id, creative, body.month, body.year, itemDate,
          'holiday', holiday.hebrewName,
          holiday.hebrewName, 'social_post', creative.platform || 'instagram', (creative.format || 'image') as ContentFormat,
          client
        );
        clientGanttItems.create(ganttItem);
        holidayItems.push(ganttItem);
      }

      return NextResponse.json({
        success: true,
        message: `${holidayItems.length} חגים הוספו לגאנט`,
        items: holidayItems,
        source: 'holidays',
        skipped: holidays.length - holidayItems.length,
      });
    }

    // ============================================================
    // MODE 3: Selected ideas from research → Gantt
    // ============================================================
    if (!body.ideas || body.ideas.length === 0) {
      return NextResponse.json({ error: 'לא נבחרו רעיונות' }, { status: 400 });
    }

    console.log(`[SyncToGantt] Syncing ${body.ideas.length} ideas to gantt for ${client.name}, month: ${body.month}/${body.year}`);

    const totalDays = daysInMonth(body.month, body.year);
    const daysBetween = Math.max(1, Math.floor(totalDays / body.ideas.length));
    const newItems: ClientGanttItem[] = [];

    for (let i = 0; i < body.ideas.length; i++) {
      const idea = body.ideas[i];
      console.log(`[SyncToGantt] Generating creative ${i + 1}/${body.ideas.length}: "${idea.title}"`);

      const creative = await generateCreativeForIdea(
        idea,
        client,
        researchContext,
        knowledgeContext,
        latestResearch
      );

      const dayInMonth = Math.min(1 + i * daysBetween, totalDays);
      const itemDate = new Date(body.year, body.month - 1, dayInMonth).toISOString().split('T')[0];

      const ganttItem = createGanttItem(
        id, creative, body.month, body.year, itemDate,
        'research-selection', idea.title,
        undefined, 'social_post', creative.platform || 'instagram', (creative.format || 'image') as ContentFormat,
        client,
        idea.id, idea.title, body.researchId
      );
      clientGanttItems.create(ganttItem);
      newItems.push(ganttItem);
    }

    console.log(`[SyncToGantt] ✅ Created ${newItems.length} gantt items from research ideas`);

    return NextResponse.json({
      success: true,
      message: `${newItems.length} רעיונות נוספו לגאנט ונבנה עבורם תוכן`,
      items: newItems,
      source: 'research-selection',
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[SyncToGantt] Error:', errorMessage);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// ============================================================
// AI Creative Generation per idea
// ============================================================
async function generateCreativeForIdea(
  idea: SelectedIdea,
  client: Record<string, any>,
  researchContext: string,
  knowledgeContext: string,
  latestResearch: ClientResearch | null
): Promise<GeneratedCreative> {
  const systemPrompt = `אתה מנוע יצירתי מקצועי ליצירת תוכן שיווקי בעברית בלבד.
אתה מקבל רעיון תוכן אסטרטגי ומפיק ממנו תוכן שיווקי מלא ומוכן.

כללים:
1. כל השדות חייבים להיגזר מהרעיון שהתקבל — אסור ליצור תוכן עצמאי
2. עברית בלבד — אסור אנגלית
3. כל שדה חייב להיות שונה מהאחר — מגוון בסגנון, טון, זווית
4. הטקסט לגרפיקה (graphicText) חייב להיות קצר וחזק — 2-5 מילים מקסימום
5. הכיתוב (caption) חייב להיות מותאם לרשתות חברתיות — מעורר עניין, עם CTA
6. הקונספט הויזואלי (visualConcept) חייב להיות תיאור מפורט למעצב
7. אסור תוכן גנרי כמו "חג שמח מ..." או "שנה טובה לכולם"

${researchContext}`;

  const toneInfo = latestResearch?.identity?.tone || 'מקצועי ונגיש';
  const audienceInfo = latestResearch?.audience?.primary || 'קהל היעד של העסק';

  const userPrompt = `## רעיון תוכן שנבחר:
כותרת: ${idea.title}
הסבר: ${idea.explanation}
קטגוריה: ${idea.category}

## נתוני העסק:
שם: ${client.name}
תחום: ${client.businessField}
טון מותג: ${toneInfo}
קהל יעד: ${audienceInfo}
מטרות שיווקיות: ${client.marketingGoals || '(לא הוגדר)'}
מסרים: ${client.keyMarketingMessages || '(לא הוגדר)'}

${knowledgeContext ? `## מידע נוסף:\n${knowledgeContext}` : ''}

## השב בפורמט JSON בדיוק (בלי markdown, בלי backticks):

{
  "title": "כותרת/הוק חזק בעברית — שורה אחת שתופסת תשומת לב",
  "ideaSummary": "הרחבה של הרעיון — 2-3 משפטים שמסבירים את הזווית",
  "graphicText": "2-5 מילים חזקות לגרפיקה",
  "caption": "כיתוב מלא לפוסט ברשתות חברתיות — 3-5 משפטים עם הוק, ערך, ו-CTA",
  "cta": "קריאה לפעולה ברורה",
  "visualConcept": "תיאור מפורט של הויזואל למעצב — צבעים, אלמנטים, סגנון, תחושה",
  "platform": "instagram",
  "format": "image"
}`;

  try {
    const result = await generateWithAI(systemPrompt, userPrompt, { temperature: 0.8, maxTokens: 2000 });

    if (result.success && result.data) {
      try {
        // If data is already parsed JSON object, use it directly
        if (typeof result.data === 'object') {
          const parsed = result.data as GeneratedCreative;
          return {
            title: parsed.title || idea.title,
            ideaSummary: parsed.ideaSummary || idea.explanation,
            graphicText: parsed.graphicText || idea.title.slice(0, 30),
            caption: parsed.caption || `${idea.title}\n\n${idea.explanation}`,
            cta: parsed.cta || 'למידע נוסף →',
            visualConcept: parsed.visualConcept || `תמונה מקצועית שמייצגת: ${idea.title}`,
            platform: parsed.platform || 'instagram',
            format: parsed.format || 'image',
          };
        }
        // Extract JSON from raw string response
        const jsonMatch = String(result.data).match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]) as GeneratedCreative;
          return {
            title: parsed.title || idea.title,
            ideaSummary: parsed.ideaSummary || idea.explanation,
            graphicText: parsed.graphicText || idea.title.slice(0, 30),
            caption: parsed.caption || `${idea.title}\n\n${idea.explanation}`,
            cta: parsed.cta || 'למידע נוסף →',
            visualConcept: parsed.visualConcept || `תמונה מקצועית שמייצגת: ${idea.title}`,
            platform: parsed.platform || 'instagram',
            format: parsed.format || 'image',
          };
        }
      } catch (parseErr) {
        console.warn('[SyncToGantt] Failed to parse AI JSON, using fallback:', parseErr);
      }
    }
  } catch (aiErr) {
    console.warn('[SyncToGantt] AI call failed, using fallback:', aiErr);
  }

  // Fallback — deterministic content from the idea itself
  return {
    title: idea.title,
    ideaSummary: idea.explanation,
    graphicText: idea.title.split(' ').slice(0, 4).join(' '),
    caption: `${idea.title}\n\n${idea.explanation}\n\nלמידע נוסף — לינק בביו`,
    cta: 'למידע נוסף →',
    visualConcept: `עיצוב נקי ומקצועי שמייצג: ${idea.title}. צבעי המותג, טיפוגרפיה חזקה.`,
    platform: 'instagram',
    format: 'image',
  };
}

// ============================================================
// Build research context for AI prompt
// ============================================================
function buildResearchContext(r: ClientResearch): string {
  const parts: string[] = [];
  parts.push('\n## הקשר מחקרי:');
  if (r.identity) {
    parts.push(`מוכרים: ${r.identity.whatTheySell}`);
    parts.push(`מיצוב: ${r.identity.positioning}`);
    parts.push(`טון: ${r.identity.tone}`);
    parts.push(`ערך ייחודי: ${r.identity.uniqueValue}`);
  }
  if (r.audience) {
    parts.push(`קהל: ${r.audience.primary}`);
    if (r.audience.painPoints?.length > 0) {
      parts.push(`נקודות כאב: ${r.audience.painPoints.join(', ')}`);
    }
  }
  if (r.strategicNotes?.trim()) {
    parts.push(`\n⭐ הערות אסטרטגיות: ${r.strategicNotes.trim()}`);
  }
  return parts.join('\n');
}

// ============================================================
// Create Gantt Item helper
// ============================================================
function createGanttItem(
  clientId: string,
  creative: GeneratedCreative,
  month: number,
  year: number,
  date: string,
  source: string,
  sourceName: string,
  holidayTag?: string,
  itemType?: string,
  platform?: string,
  format?: ContentFormat,
  client?: Record<string, any>,
  researchIdeaId?: string,
  researchTitle?: string,
  researchId?: string
): ClientGanttItem {
  const now = new Date().toISOString();
  return {
    id: 'cgi_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9),
    clientId,
    ganttType: 'monthly',
    month,
    year,
    date,
    title: creative.title,
    ideaSummary: creative.ideaSummary,
    graphicText: creative.graphicText,
    caption: creative.caption,
    visualConcept: creative.visualConcept,
    itemType: (itemType || 'social_post') as any,
    platform: (platform || 'instagram') as any,
    format: (format || 'image') as ContentFormat,
    relatedVideoId: '',
    relatedFileUrl: '',
    imageUrls: [],
    attachedFiles: [],
    assigneeId: client?.assignedManagerId,
    assignedManagerId: client?.assignedManagerId,
    status: 'new_idea',
    internalNotes: '',
    clientNotes: '',
    holidayTag: holidayTag || '',
    campaignTag: '',
    monthTheme: '',
    suggestedRhythm: '',
    keyOpportunities: `Hook: ${creative.title}\nCTA: ${creative.cta}`,
    researchSource: source as any,
    researchReason: sourceName,
    researchVersionUsed: researchId,
    ganttGeneratedAt: now,
    createdAt: now,
    updatedAt: now,
  } as ClientGanttItem;
}
