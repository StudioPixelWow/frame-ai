/**
 * AI מנכ״ל engine — turns the agency snapshot into (a) a sharp 3-line morning
 * brief with the top priorities, and (b) grounded answers to free-text questions.
 * Grounded strictly in the snapshot so it never invents numbers.
 */

import { generateWithAI } from '@/lib/ai/openai-client';
import type { AgencySnapshot } from './snapshot';

export interface DailyBrief {
  headline: string;
  priorities: string[];   // up to 3
  risks: string[];        // up to 2
  opportunity: string;
}

export async function buildDailyBrief(snap: AgencySnapshot): Promise<DailyBrief> {
  const system = `אתה מנכ״ל וירטואלי חד וענייני של סוכנות שיווק (Studio Pixel). קבל תמונת מצב ותן תדריך בוקר קצר ופרקטי בעברית.
דבר כמו מנכ״ל: ממוקד תוצאות והכנסה, בלי מילוי מילים. אל תמציא נתונים שלא נמצאים בתמונת המצב.
החזר JSON בלבד: {"headline":"שורה אחת שמסכמת את היום","priorities":["עד 3 פעולות הכי חשובות להיום"],"risks":["עד 2 סיכונים/דברים שדורשים תשומת לב"],"opportunity":"הזדמנות אחת לצמיחה"}`;
  const user = `תמונת מצב נוכחית של הסוכנות:\n${snap.text}\n\nתן תדריך בוקר.`;
  try {
    const res = await generateWithAI(system, user, { temperature: 0.5, maxTokens: 700 });
    const d = res.success ? (res.data as any) : null;
    if (d && d.headline) {
      return {
        headline: String(d.headline),
        priorities: Array.isArray(d.priorities) ? d.priorities.slice(0, 3) : [],
        risks: Array.isArray(d.risks) ? d.risks.slice(0, 2) : [],
        opportunity: String(d.opportunity || ''),
      };
    }
  } catch { /* fall through */ }
  // Deterministic fallback from the numbers.
  const t = snap.tasks;
  return {
    headline: `${snap.clients.active} לקוחות פעילים · ${t.dueToday} משימות להיום · ${t.overdue} באיחור`,
    priorities: [
      t.overdue ? `לטפל ב-${t.overdue} משימות באיחור` : 'אין משימות באיחור — מצוין',
      t.dueToday ? `להשלים ${t.dueToday} משימות שמתוזמנות להיום` : 'אין משימות להיום',
      `לוודא גבייה מ-${snap.collections.monthlyRetainerClients} לקוחות ריטיינר`,
    ],
    risks: t.missed ? [`${t.missed} משימות לא בוצעו — לבדוק מול הצוות`] : [],
    opportunity: 'להפיק דוחות Google Ads/GEO ללקוחות שלא קיבלו החודש — חיזוק שימור.',
  };
}

export async function answerAgencyQuestion(question: string, snap: AgencySnapshot): Promise<string> {
  const system = `אתה עוזר מנכ״ל של סוכנות שיווק. ענה בעברית, קצר וענייני, אך ורק על סמך תמונת המצב שתקבל.
אם המידע לא נמצא בתמונת המצב — אמור בפשטות שאין לך את הנתון הזה כרגע ומה צריך כדי לקבל אותו. אל תמציא מספרים.`;
  const user = `תמונת מצב:\n${snap.text}\n\nשאלה: ${question}`;
  try {
    const res = await generateWithAI(system, user, { temperature: 0.3, maxTokens: 500 });
    if (res.success && typeof res.data === 'string') return res.data;
    if (res.success && res.data) return String((res.data as any).answer || JSON.stringify(res.data));
  } catch { /* ok */ }
  return 'לא הצלחתי לעבד את השאלה כרגע. נסה שוב או נסח אחרת.';
}
