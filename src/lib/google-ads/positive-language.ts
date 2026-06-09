/**
 * Positive Hebrew language engine.
 * - sanitizePositive(): scrubs any negative phrasing as a safety net.
 * - buildExecutiveSummary(): an AI-written, marketing-grade positive executive
 *   summary (via the app's OpenAI helper), with a deterministic positive
 *   fallback so a report is never blocked.
 */

import { generateWithAI } from '@/lib/ai/openai-client';
import type { AdsData } from './provider';
import type { AnalysisResult } from './insights';

const NEGATIVE_MAP: { re: RegExp; to: string }[] = [
  { re: /כשל(ון|ים)?/g, to: 'הזדמנות לשיפור' },
  { re: /בעיה|בעיות|תקלה|תקלות/g, to: 'נקודת ייעול' },
  { re: /ירידה חריפה|צניחה|קריסה/g, to: 'מרחב לאופטימיזציה' },
  { re: /בזבוז תקציב/g, to: 'פוטנציאל לייעול תקציב' },
  { re: /לא עובד|לא מצליח|נכשל/g, to: 'נמצא בשלב אופטימיזציה' },
  { re: /גרוע|רע מאוד|חלש מאוד/g, to: 'עם פוטנציאל שיפור ברור' },
];

export function sanitizePositive(text: string): string {
  let out = text || '';
  for (const { re, to } of NEGATIVE_MAP) out = out.replace(re, to);
  return out.trim();
}

const money = (n: number) => `₪${Math.round(n).toLocaleString('he-IL')}`;

export async function buildExecutiveSummary(
  clientName: string, data: AdsData, analysis: AnalysisResult, reportTypeHe: string,
): Promise<{ summary: string; closing: string; short: string }> {
  const c = data.current;
  const top = [...data.campaigns].sort((a, b) => b.conversions - a.conversions)[0];
  const facts = [
    `חשיפות: ${c.impressions.toLocaleString('he-IL')}`,
    `קליקים: ${c.clicks.toLocaleString('he-IL')}`,
    `CTR: ${c.ctr}%`,
    `עלות לקליק: ${money(c.avgCpc)}`,
    `המרות/לידים: ${Math.round(c.conversions)}`,
    `עלות לליד: ${money(c.costPerConv)}`,
    `אחוז המרה: ${c.convRate}%`,
    `תקציב שנוצל: ${money(c.cost)}`,
    top ? `קמפיין מוביל: ${top.name}` : '',
    `שינוי קליקים מול תקופה קודמת: ${analysis.deltas.clicks >= 0 ? '+' : ''}${analysis.deltas.clicks}%`,
    `שינוי המרות מול תקופה קודמת: ${analysis.deltas.conversions >= 0 ? '+' : ''}${analysis.deltas.conversions}%`,
  ].filter(Boolean).join('\n');

  const system = `אתה מנהל קמפיינים בכיר וקופירייטר שיווקי בסטודיו פיקסל. כתוב תקציר מנהלים לדוח Google Ads בעברית שיווקית-מקצועית, חיובי ומרשים, שמיועד ללקוח.
חוקים מחייבים:
- אך ורק ניסוח חיובי. אסור מילים שליליות (כשל, בעיה, ירידה, תקלה, בזבוז, לא עובד).
- נתונים פחות טובים מוצגים כ"הזדמנות לייעול" / "שלב אופטימיזציה", לא ככישלון.
- מקצועי, בטוח, מעורר אמון. בלי הגזמות לא אמינות.
החזר JSON בלבד: {"summary":"פסקה אחת 3-4 משפטים","closing":"משפט סיכום חיובי אחד","short":"שורה אחת קצרה לשליחה בוואטסאפ/מייל"}`;

  const user = `לקוח: ${clientName}\nסוג דוח: ${reportTypeHe}\nנתוני התקופה:\n${facts}\n\nכתוב תקציר מנהלים שמדגיש מה עבד טוב, איזו מגמה חיובית קיימת, איזה קמפיין בלט, ומה הפוטנציאל להמשך.`;

  try {
    const res = await generateWithAI(system, user, { temperature: 0.7, maxTokens: 700 });
    const d = res.success ? (res.data as any) : null;
    if (d && d.summary) {
      return {
        summary: sanitizePositive(d.summary),
        closing: sanitizePositive(d.closing || ''),
        short: sanitizePositive(d.short || ''),
      };
    }
  } catch { /* fall through */ }

  // Deterministic positive fallback.
  const summary = sanitizePositive(
    `במהלך התקופה הנוכחית הקמפיינים של ${clientName} הציגו בסיס ביצועים יציב עם ${c.clicks.toLocaleString('he-IL')} קליקים ו-${Math.round(c.conversions)} המרות. ` +
    `${top ? `הקמפיין «${top.name}» בלט כעוגן מוביל, ` : ''}ומגמת התנועה ממשיכה להתחזק לעומת התקופה הקודמת. ` +
    `קיים פוטנציאל ברור להמשך צמיחה ודיוק באמצעות הרחבת הביטויים האיכותיים וחידוד הקהלים המובילים.`,
  );
  return {
    summary,
    closing: 'הקמפיין מציג בסיס ביצועים יציב ומגמת התקדמות חיובית, עם פוטנציאל ברור להמשך צמיחה ודיוק.',
    short: `דוח ${reportTypeHe} ל${clientName}: ${Math.round(c.conversions)} לידים, ${c.clicks.toLocaleString('he-IL')} קליקים — מגמה חיובית והמשך צמיחה צפוי.`,
  };
}
