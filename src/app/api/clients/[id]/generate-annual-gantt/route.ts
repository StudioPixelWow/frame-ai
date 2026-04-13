/**
 * POST /api/clients/[id]/generate-annual-gantt - Generate annual strategic gantt plan
 * Creates 12 monthly strategic items for the year
 */

import { NextResponse } from 'next/server';
import { clients, clientGanttItems } from '@/lib/db';
import type { ClientGanttItem } from '@/lib/db';

interface GenerateAnnualGanttRequest {
  year: number;
  customPrompt?: string;
}

// Helper: Generate deterministic variations based on input
function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

// Helper: pick random item from array using seed
function seedPick<T>(arr: T[], seed: number): T {
  const index = Math.floor(seededRandom(seed) * arr.length);
  return arr[index];
}

// Hebrew month names
const HEBREW_MONTHS = [
  'ינואר',
  'פברואר',
  'מרץ',
  'אפריל',
  'מאי',
  'יוני',
  'יולי',
  'אוגוסט',
  'ספטמבר',
  'אוקטובר',
  'נובמבר',
  'דצמבר',
];

// Season-based themes
const SEASON_THEMES: Record<number, string> = {
  1: 'התחדשות ובחינת החלטות',
  2: 'קרבה לאביב',
  3: 'יציאה לחדש',
  4: 'חגיגות ומשמעות',
  5: 'עלייה בפעילות',
  6: 'קיץ וחופשות',
  7: 'שיא הקיץ והנעת מכירות',
  8: 'תחילת היערכות חדשה',
  9: 'שנה חדשה ודחיפה',
  10: 'בניית תנופה',
  11: 'הכנה לחגים',
  12: 'סיכום שנה ותכנון קדימה',
};

// Posting rhythm suggestions based on season
const SUGGESTED_RHYTHMS: Record<number, string> = {
  1: '4 פוסטים בשבוע',
  2: '4 פוסטים בשבוע',
  3: '4 פוסטים בשבוע',
  4: '5 פוסטים בשבוע',
  5: '5 פוסטים בשבוע',
  6: '3 פוסטים בשבוע',
  7: '3 פוסטים בשבוע',
  8: '4 פוסטים בשבוע',
  9: '5 פוסטים בשבוע',
  10: '5 פוסטים בשבוע',
  11: '5 פוסטים בשבוע',
  12: '3 פוסטים בשבוע',
};

// Strategic themes based on client goals
function generateMonthTheme(
  month: number,
  clientBusinessField: string,
  clientGoals: string,
  seed: number
): string {
  const seasonTheme = SEASON_THEMES[month];

  const goalKeywords = clientGoals
    .split(',')
    .map((g) => g.trim())
    .filter(Boolean)
    .slice(0, 2);

  const focusAreas = [
    'בנייה ברנד',
    'הגברת מודעות',
    'עלייה במעורבות',
    'המרה לקנייה',
    'בניית קהילה',
    'חדשנות',
    'חיזוק שירות',
    'ערך מוסף',
  ];

  const focus = seedPick(focusAreas, seed);

  return `${seasonTheme} — ${focus}${goalKeywords.length > 0 ? ': ' + goalKeywords[0] : ''}`;
}

// Generate key opportunities for month
function generateKeyOpportunities(
  month: number,
  clientType: string,
  seed: number,
  _year?: number
): string {
  const genericOpportunities = [
    'שיתופי פעולה עם מובילים בתחום',
    'קמפיינים עסקיים ממוקדים',
    'תוכן חינוכי ורלוונטי',
    'מהלכי תוכן שמחזקים אמון',
  ];

  if (clientType) {
    return `${seedPick(genericOpportunities, seed)} | התאמה לסוג לקוח: ${clientType}`;
  }

  return seedPick(genericOpportunities, seed);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body: GenerateAnnualGanttRequest = await request.json();

    if (!body.year) {
      return NextResponse.json(
        { error: 'Missing year parameter' },
        { status: 400 }
      );
    }

    const client = clients.getById(id);
    if (!client) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      );
    }

    const newItems: ClientGanttItem[] = [];

    for (let month = 1; month <= 12; month++) {
      const monthTheme = generateMonthTheme(
        month,
        client.businessField || '',
        client.marketingGoals || '',
        month * 17
      );

      const suggestedRhythm = SUGGESTED_RHYTHMS[month];
      const keyOpportunities = generateKeyOpportunities(
        month,
        client.clientType || '',
        month * 23,
        body.year
      );

      const monthName = HEBREW_MONTHS[month - 1];
      const themeParts = monthTheme.split(' — ');
      const title = `${monthName} 📅 | ${themeParts[0]}`;

      const ganttItem: ClientGanttItem = {
        id: 'cgi_' + Date.now() + '_' + month + '_' + Math.random().toString(36).slice(2, 8),
        clientId: id,
        ganttType: 'annual',
        month,
        year: body.year,
        date: new Date(body.year, month - 1, 1).toISOString().split('T')[0],
        title,
        ideaSummary: `תכנון אסטרטגי לחודש ${monthName}`,
        graphicText: `${monthName}\n${themeParts[1] || themeParts[0]}`,
        caption: `תכנון עבודה שנתי - ${monthName}\n\n${monthTheme}\n\nקצב מומלץ: ${suggestedRhythm}`,
        visualConcept: `תכנון אסטרטגי ויזואלי לחודש ${monthName} — ${themeParts[0]}`,
        itemType: 'internal_task',
        platform: 'all',
        format: 'text',
        relatedVideoId: '',
        relatedFileUrl: '',
        imageUrls: [],
        attachedFiles: [],
        assigneeId: client.assignedManagerId || '',
        assignedManagerId: client.assignedManagerId || '',
        status: 'new_idea',
        internalNotes: body.customPrompt || '',
        clientNotes: `תכנון קונטנט ${monthName} - בהמתנה לאישור`,
        holidayTag: '',
        campaignTag: '',
        monthTheme,
        suggestedRhythm,
        keyOpportunities,
        researchSource: '',
        researchReason: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      newItems.push(ganttItem);
      clientGanttItems.create(ganttItem);
    }

    return NextResponse.json({
      success: true,
      message: `Generated annual strategic plan for ${body.year} (12 months)`,
      year: body.year,
      items: newItems,
      summary: {
        totalMonths: 12,
        clientName: client.name,
        businessField: client.businessField,
        generalStrategy: `תכנון שנתי עבור ${client.name} - מתמקד ב${client.businessField}${body.customPrompt ? '. ' + body.customPrompt : ''}`,
      },
    });
  } catch (error) {
    console.error('Error generating annual gantt:', error);
    return NextResponse.json(
      { error: 'Failed to generate annual gantt plan' },
      { status: 500 }
    );
  }
}