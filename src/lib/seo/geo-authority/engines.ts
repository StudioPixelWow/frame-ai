/**
 * GEO Authority — the three engines that did not previously exist as dedicated
 * modules: AI Citation Builder (#3), Brand Mention Agent (#4) and Schema
 * Automation Agent (#11). All are DRAFT-GATED: they produce drafts only; nothing
 * is published until the user approves and applies.
 *
 * generateWithAI(system, user, opts) → { success, data } where data is parsed JSON.
 */

import { generateWithAI } from '@/lib/ai/openai-client';
import { saveDraft } from './db';

interface Ctx {
  planId: string;
  clientId?: string | null;
  businessName: string;
  industry?: string;
  location?: string;
  websiteUrl?: string;
  pages?: Array<{ url?: string; title?: string; content?: string }>;
}

function firstJsonArray(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.items)) return data.items;
  if (typeof data === 'string') {
    try { const p = JSON.parse(data.slice(data.indexOf('['), data.lastIndexOf(']') + 1)); if (Array.isArray(p)) return p; } catch { /* noop */ }
  }
  return [];
}

/* ── #3 AI Citation Builder ──────────────────────────────────────────────── */
export async function runCitationBuilder(ctx: Ctx): Promise<{ drafts: number; items: any[] }> {
  const page = ctx.pages?.[0];
  const sys = 'אתה מומחה GEO. אתה מציע מקורות, נתונים וציטוטים אמינים שניתן לשבץ בעמוד כדי להפוך אותו לבר-ציטוט במנועי AI. החזר JSON array בלבד.';
  const user = `עסק: ${ctx.businessName}${ctx.industry ? `, תחום: ${ctx.industry}` : ''}${ctx.location ? `, אזור: ${ctx.location}` : ''}.
${page?.title ? `עמוד יעד: ${page.title}` : ''}
הצע 5 שיבוצי ציטוט/מקור. כל פריט: {"claim":"הטענה שתחוזק","suggestedSource":"סוג מקור אמין (מחקר/נתון/רגולציה)","exampleText":"משפט מוכן לשיבוץ בעברית עם המקור","placement":"היכן בעמוד"}`;
  const res = await generateWithAI(sys, user, { temperature: 0.4, maxTokens: 1200 });
  const items = res.success ? firstJsonArray(res.data) : [];
  for (const it of items) {
    await saveDraft({ planId: ctx.planId, clientId: ctx.clientId, moduleId: 'citation_builder', kind: 'citation', targetPage: page?.url, title: it.claim, payload: it });
  }
  return { drafts: items.length, items };
}

/* ── #4 Brand Mention Agent ──────────────────────────────────────────────── */
export async function runBrandMention(ctx: Ctx): Promise<{ drafts: number; items: any[] }> {
  const sys = 'אתה מומחה מיתוג ו-GEO. אתה מציע שיבוצי אזכור מותג טבעיים בהקשרים מקצועיים שמחזקים את הקשר מותג↔שירות. החזר JSON array בלבד.';
  const user = `מותג/עסק: ${ctx.businessName}${ctx.industry ? `, תחום: ${ctx.industry}` : ''}${ctx.location ? `, אזור: ${ctx.location}` : ''}.
הצע 5 שיבוצי אזכור מותג. כל פריט: {"context":"ההקשר המקצועי","mentionText":"משפט בעברית שמשלב את שם המותג באופן טבעי","page":"סוג העמוד המומלץ","why":"מדוע זה מחזק סמכות"}`;
  const res = await generateWithAI(sys, user, { temperature: 0.5, maxTokens: 1100 });
  const items = res.success ? firstJsonArray(res.data) : [];
  for (const it of items) {
    await saveDraft({ planId: ctx.planId, clientId: ctx.clientId, moduleId: 'brand_mention', kind: 'brand_mention', title: it.context, payload: it });
  }
  return { drafts: items.length, items };
}

/* ── #11 Schema Automation Agent ─────────────────────────────────────────── */
export async function runSchemaAutomation(ctx: Ctx): Promise<{ drafts: number; items: any[] }> {
  const sys = 'אתה מומחה SEO טכני. אתה מייצר JSON-LD Schema תקין לפי סוג העסק והעמוד. החזר JSON array בלבד, כל פריט עם JSON-LD חוקי.';
  const user = `עסק: ${ctx.businessName}${ctx.industry ? `, תחום: ${ctx.industry}` : ''}${ctx.location ? `, אזור: ${ctx.location}` : ''}${ctx.websiteUrl ? `, אתר: ${ctx.websiteUrl}` : ''}.
צור Schema מתאים: Organization/LocalBusiness לדף הבית, ו-Service/FAQ/Breadcrumb היכן שרלוונטי.
כל פריט: {"schemaType":"Organization|LocalBusiness|Service|FAQPage|BreadcrumbList","targetPage":"איזה עמוד","jsonLd":{...JSON-LD חוקי...},"notes":"הערות יישום"}`;
  const res = await generateWithAI(sys, user, { temperature: 0.2, maxTokens: 1600 });
  const items = res.success ? firstJsonArray(res.data) : [];
  for (const it of items) {
    // Light validity check: must have @context + @type.
    const valid = !!(it?.jsonLd && (it.jsonLd['@context'] || it.jsonLd['@type']));
    await saveDraft({ planId: ctx.planId, clientId: ctx.clientId, moduleId: 'schema_automation', kind: 'schema', targetPage: it.targetPage, title: it.schemaType, payload: { ...it, valid } });
  }
  return { drafts: items.length, items };
}
