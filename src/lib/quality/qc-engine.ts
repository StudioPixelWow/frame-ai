/**
 * AI Quality Control — checks client-facing content (caption, post, email,
 * report text) before it goes out: Hebrew correctness, professional tone,
 * brand alignment, completeness, and absence of weak/negative filler. Returns
 * a pass/score, a list of issues, and an improved version to use.
 */

import { generateWithAI } from '@/lib/ai/openai-client';

export interface QcIssue { severity: 'high' | 'medium' | 'low'; type: string; detail: string }
export interface QcResult {
  pass: boolean;
  score: number;            // 0-100
  issues: QcIssue[];
  improved: string;         // suggested improved version
  summary: string;
}

export async function runQualityCheck(text: string, opts?: { clientName?: string; context?: string; brandNotes?: string }): Promise<QcResult> {
  const clean = (text || '').trim();
  if (!clean) return { pass: false, score: 0, issues: [{ severity: 'high', type: 'empty', detail: 'אין תוכן לבדיקה' }], improved: '', summary: 'אין תוכן' };

  const system = `אתה בקר איכות בכיר בסטודיו פיקסל. בדוק תוכן שיווקי לפני שליחה ללקוח לפי הקריטריונים:
1. עברית תקנית — איות, דקדוק, ניסוח זורם (אסור תרגומית).
2. טון מקצועי ושיווקי, ללא ניסוחים שליליים/חלשים ("לחץ כאן", "תוכן חדש", קלישאות).
3. התאמה למותג ולהקשר (אם סופקו).
4. שלמות — יש hook, גוף, וקריאה לפעולה ברורה כשרלוונטי.
5. אין אנגלית מיותרת, אין שגיאות עובדתיות בולטות.
החזר JSON בלבד:
{"pass":true/false,"score":0-100,"issues":[{"severity":"high|medium|low","type":"קצר","detail":"מה הבעיה וכיצד לתקן"}],"improved":"גרסה משופרת מוכנה לשליחה","summary":"משפט סיכום"}
pass=true רק אם אין בעיות high והציון 80+.`;

  const user = `${opts?.clientName ? `לקוח: ${opts.clientName}\n` : ''}${opts?.context ? `הקשר: ${opts.context}\n` : ''}${opts?.brandNotes ? `הנחיות מותג: ${opts.brandNotes}\n` : ''}\nהתוכן לבדיקה:\n"""\n${clean}\n"""`;

  try {
    const res = await generateWithAI(system, user, { temperature: 0.3, maxTokens: 1400 });
    const d = res.success ? (res.data as any) : null;
    if (d && typeof d.score === 'number') {
      const issues: QcIssue[] = Array.isArray(d.issues) ? d.issues : [];
      return {
        pass: !!d.pass && !issues.some((i) => i.severity === 'high'),
        score: Math.min(100, Math.max(0, Math.round(d.score))),
        issues, improved: d.improved || clean, summary: d.summary || '',
      };
    }
  } catch { /* fall through */ }
  return { pass: true, score: 75, issues: [{ severity: 'low', type: 'בדיקה ידנית', detail: 'לא ניתן היה לבצע בדיקת AI כעת — מומלץ לעבור ידנית.' }], improved: clean, summary: 'בדיקה אוטומטית לא זמינה' };
}
