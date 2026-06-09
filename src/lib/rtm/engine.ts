/**
 * RTM (Real-Time Marketing) Broadcast Engine
 * --------------------------------------------
 * Lets the agency push a single timely RTM topic to ALL publishing clients at
 * once. For each client the engine DEVELOPS the idea properly (tailored to that
 * client's business, tone and platform via AI) and slots it into the monthly
 * gantt on a chosen date — REPLACING any content that was pre-created for that
 * date (so a planned post is swapped out for the timely RTM post).
 *
 * Designed to run one client at a time (called per-client from the API) so the
 * UI can show live, one-by-one progress and we never hit a serverless timeout.
 */

import { clientGanttItems } from '@/lib/db';
import { getSupabase } from '@/lib/db/store';
import { getClientById } from '@/lib/db/client-helpers';
import { generateWithAI, getClientKnowledgeContext } from '@/lib/ai/openai-client';
import type { ClientGanttItem, GanttItemType } from '@/lib/db';

export interface RtmEligibleClient {
  id: string;
  name: string;
  businessField: string;
  color: string;
}

export interface RtmApplyInput {
  clientId: string;
  topic: string;        // the RTM topic / what changed
  date: string;         // YYYY-MM-DD — slot in the gantt
  platform?: string;    // facebook | instagram | tiktok | all
  format?: string;      // image | video | reel | story | carousel
  notes?: string;       // extra direction from the user
  seedTitle?: string;   // FIX MODE: a corrected idea/title to build the whole task around
  itemId?: string;      // FIX MODE: update this exact gantt item (skip date lookup)
}

export interface RtmApplyResult {
  clientId: string;
  clientName: string;
  replaced: boolean;    // true = swapped an existing pre-planned item
  itemId: string;
  title: string;
  caption: string;
  graphicText: string;
  usedAI: boolean;
  note?: string;
}

/**
 * Publishing clients = active social/advertising clients (clientType 'marketing').
 * These are the only clients that have a content gantt to slot RTM into.
 */
export async function listPublishingClients(): Promise<RtmEligibleClient[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('clients')
    .select('id, name, business_field, color, client_type, status')
    .eq('client_type', 'marketing')
    .eq('status', 'active')
    .order('name', { ascending: true });
  if (error) {
    console.error('[RTM] listPublishingClients error:', error.message);
    return [];
  }
  return (data || []).map((r: any) => ({
    id: r.id,
    name: r.name || '',
    businessField: r.business_field || '',
    color: r.color || '#00B5FE',
  }));
}

const PLATFORM_LABEL: Record<string, string> = {
  all: 'כל הפלטפורמות', facebook: 'פייסבוק', instagram: 'אינסטגרם', tiktok: 'טיקטוק',
};

function getItemType(format: string): GanttItemType {
  const map: Record<string, GanttItemType> = {
    image: 'social_post', video: 'social_post', reel: 'reel', carousel: 'carousel', story: 'story', text: 'social_post',
  };
  return map[format] || 'social_post';
}

/**
 * Develop the RTM idea into a full, client-specific post via AI.
 * Returns null on AI failure so the caller can decide how to surface the error.
 */
async function developRtmContent(
  client: { id: string; name: string; businessField: string; marketingGoals?: string; keyMarketingMessages?: string },
  input: RtmApplyInput,
): Promise<{ ok: true; data: any } | { ok: false; error: string }> {
  const platform = input.platform || 'all';
  const format = input.format || 'image';

  let knowledge = '';
  try { knowledge = await getClientKnowledgeContext(client.id); } catch { /* optional */ }

  const systemPrompt = `אתה מנהל קריאייטיב בכיר בסטודיו פיקסל — סוכנות שיווק ישראלית.
המשימה: לפתח פוסט RTM (Real-Time Marketing) — שיווק בזמן אמת שמגיב לאירוע/טרנד/חדשה עכשווית — ולהתאים אותו ספציפית לעסק מסוים.
RTM טוב הוא רלוונטי, מהיר, חכם, ומקשר בין האירוע למותג בצורה טבעית ולא מאולצת.
כתוב הכל בעברית מלאה, ברמה פרסומית גבוהה. אסור אנגלית (חוץ משמות פלטפורמות).
החזר אך ורק JSON תקין במבנה:
{
  "title": "כותרת קצרה לפריט הגאנט",
  "ideaSummary": "תיאור הרעיון ב-1-2 משפטים — איך האירוע מתחבר לעסק",
  "graphicText": "1-2 שורות קופי חד למקדם/לגרפיקה (headline)",
  "caption": "פוסט מלא לרשת — hook + גוף + CTA + 2-3 אימוג׳ים + האשטגים (300-400 תווים)",
  "visualConcept": "תיאור ויזואלי מפורט להפקה: קומפוזיציה, צבעים, אובייקטים, סגנון (80+ תווים)",
  "hook": "משפט פתיחה מושך",
  "cta": "קריאה לפעולה ספציפית"
}`;

  const seedBlock = input.seedTitle?.trim()
    ? `\n🎯 תיקון מנהל — בנה את כל המשימה סביב הרעיון/כותרת הבאה במדויק: "${input.seedTitle.trim()}".
זוהי ההנחיה המחייבת. פתח אותה לאפיון מלא (כותרת, רעיון, קופי גרפי, קאפשן, קונספט ויזואלי, hook, CTA) — אבל אל תסטה מהרעיון הזה.\n`
    : '';

  const userPrompt = `אירוע / נושא ה-RTM: "${input.topic}"
${input.notes ? `הנחיות נוספות: ${input.notes}\n` : ''}${seedBlock}
פתח פוסט RTM שמגיב לאירוע הזה ומותאם ספציפית לעסק הבא:
- שם העסק: ${client.name}
- תחום: ${client.businessField || 'לא צוין'}
${client.marketingGoals ? `- מטרות שיווק: ${client.marketingGoals}\n` : ''}${client.keyMarketingMessages ? `- מסרים מרכזיים: ${client.keyMarketingMessages}\n` : ''}${knowledge ? `\nידע על העסק:\n${knowledge}\n` : ''}
- פלטפורמה: ${PLATFORM_LABEL[platform] || platform}
- פורמט: ${format}

חשוב: חבר את האירוע לעסק בזווית חכמה וטבעית. אל תכתוב גנרי. הפוסט חייב להרגיש כאילו נכתב במיוחד לעסק הזה ולאירוע הזה. החזר JSON בלבד.`;

  const res = await generateWithAI(systemPrompt, userPrompt, { temperature: 0.8, maxTokens: 1500 });
  if (!res.success) return { ok: false, error: res.error || 'שגיאת AI' };
  const d = res.data as any;
  if (!d || typeof d !== 'object' || Array.isArray(d) || !d.caption) {
    return { ok: false, error: 'תגובת ה-AI לא תקינה' };
  }
  return { ok: true, data: d };
}

/**
 * Apply the RTM topic to a single client: develop it, then REPLACE the
 * pre-created gantt item on that date (or create one if none exists).
 */
export async function applyRtmToClient(input: RtmApplyInput): Promise<RtmApplyResult> {
  const client = await getClientById(input.clientId);
  if (!client) throw new Error('לקוח לא נמצא');

  const dev = await developRtmContent(client as any, input);
  if (!dev.ok) throw new Error(dev.error);
  const c = dev.data;

  const dateKey = input.date.slice(0, 10);
  const dt = new Date(`${dateKey}T09:00:00`);
  const month = dt.getMonth() + 1;
  const year = dt.getFullYear();
  const platform = (input.platform || 'all') as ClientGanttItem['platform'];
  const format = (input.format || 'image') as ClientGanttItem['format'];
  const now = new Date().toISOString();

  // Find the target item. FIX MODE targets a specific item by id; otherwise we
  // look for a pre-created monthly item on that date for this client.
  let existing: ClientGanttItem | undefined;
  try {
    const all = await clientGanttItems.getAllAsync();
    if (input.itemId) {
      existing = all.find((it: ClientGanttItem) => it.id === input.itemId);
    }
    if (!existing) {
      existing = all.find((it: ClientGanttItem) =>
        it.clientId === input.clientId &&
        it.ganttType === 'monthly' &&
        (it.date || '').slice(0, 10) === dateKey,
      );
    }
  } catch { /* table may be empty */ }

  const contentFields: Partial<ClientGanttItem> = {
    title: c.title || `RTM: ${input.topic}`.slice(0, 80),
    ideaSummary: c.ideaSummary || '',
    graphicText: c.graphicText || '',
    caption: c.caption || '',
    visualConcept: c.visualConcept || '',
    itemType: getItemType(format),
    platform,
    format,
    monthTheme: 'rtm_realtime',
    suggestedRhythm: 'rtm',
    keyOpportunities: `Hook: ${c.hook || ''}\nCTA: ${c.cta || ''}`,
    campaignTag: 'RTM',
    internalNotes: `🔴 RTM — ${input.topic}${input.notes ? ` | ${input.notes}` : ''}`,
    researchSource: 'manual_note' as any,
    researchReason: `RTM בזמן אמת: ${input.topic}`,
    status: 'new_idea',
    updatedAt: now,
  };

  if (existing) {
    const updated = await clientGanttItems.updateAsync(existing.id, contentFields as any);
    return {
      clientId: input.clientId, clientName: client.name, replaced: true,
      itemId: existing.id, title: contentFields.title || '', caption: contentFields.caption || '',
      graphicText: contentFields.graphicText || '', usedAI: true,
      note: 'הוחלף תוכן קיים בתאריך',
    };
  }

  const created = await clientGanttItems.createAsync({
    clientId: input.clientId,
    ganttType: 'monthly',
    month, year, date: dt.toISOString(),
    ...contentFields,
    relatedVideoId: '', relatedFileUrl: '', imageUrls: [], attachedFiles: [],
    assigneeId: (client as any).assignedManagerId || null,
    assignedManagerId: (client as any).assignedManagerId || null,
    clientNotes: '', holidayTag: '', monthTheme: 'rtm_realtime',
    ganttGeneratedAt: now, createdAt: now,
  } as Omit<ClientGanttItem, 'id'>);

  return {
    clientId: input.clientId, clientName: client.name, replaced: false,
    itemId: created.id, title: contentFields.title || '', caption: contentFields.caption || '',
    graphicText: contentFields.graphicText || '', usedAI: true,
    note: 'נוצר פריט חדש בתאריך',
  };
}
