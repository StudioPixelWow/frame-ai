/**
 * AI Proposal engine — turns a short brief (client, field, chosen services,
 * budget, goals) into a polished, persuasive Hebrew proposal: understanding of
 * needs, scope & deliverables per service, suggested package, why-us, process,
 * and a closing CTA. Marketing-grade, never invents fake credentials.
 */

import { generateWithAI } from '@/lib/ai/openai-client';

export interface ProposalInput {
  clientName: string;
  businessField?: string;
  services: string[];        // e.g. ['ניהול סושיאל','Google Ads','SEO/GEO']
  budget?: string;           // free text, e.g. "₪5,000/חודש" (optional)
  goals?: string;
  tone?: 'מקצועי' | 'חם' | 'חד';
}

export interface ProposalSection { title: string; body: string }
export interface ProposalDeliverable { service: string; items: string[] }
export interface Proposal {
  headline: string;
  intro: string;
  understanding: string;
  deliverables: ProposalDeliverable[];
  packageSummary: string;     // suggested package / pricing rationale
  process: string[];          // steps
  whyUs: string[];
  closing: string;
}

export async function generateProposal(input: ProposalInput): Promise<Proposal> {
  const services = (input.services || []).filter(Boolean);
  const system = `אתה מנהל לקוחות בכיר וקופירייטר בסטודיו פיקסל — סוכנות שיווק דיגיטלי ישראלית. כתוב הצעת מחיר/עבודה מקצועית, משכנעת וחמה בעברית, שמיועדת ללקוח.
כללים: עברית תקנית ושיווקית; ממוקד ערך ותוצאות; בלי הבטחות לא אמינות ובלי להמציא נתונים/לקוחות. אם לא ניתן תקציב — תן היגיון תמחור/מבנה חבילה במקום מספרים מומצאים.
החזר JSON בלבד:
{"headline":"כותרת","intro":"פסקת פתיחה","understanding":"הבנת הצורך של הלקוח (2-3 משפטים)","deliverables":[{"service":"שם השירות","items":["מה כלול","..."]}],"packageSummary":"מבנה החבילה והיגיון התמחור","process":["שלב 1","שלב 2"],"whyUs":["סיבה 1","סיבה 2","סיבה 3"],"closing":"פסקת סגירה + קריאה לפעולה"}`;

  const user = `לקוח: ${input.clientName}
תחום: ${input.businessField || 'לא צוין'}
שירותים מבוקשים: ${services.join(', ') || 'חבילת שיווק כללית'}
תקציב/טווח: ${input.budget || 'לא צוין — תן מבנה חבילה והיגיון תמחור'}
מטרות: ${input.goals || 'צמיחה ונוכחות דיגיטלית'}
טון: ${input.tone || 'מקצועי'}

כתוב הצעת עבודה מלאה. לכל שירות תן deliverables קונקרטיים.`;

  try {
    const res = await generateWithAI(system, user, { temperature: 0.7, maxTokens: 2200 });
    const d = res.success ? (res.data as any) : null;
    if (d && d.headline) {
      return {
        headline: String(d.headline),
        intro: String(d.intro || ''),
        understanding: String(d.understanding || ''),
        deliverables: Array.isArray(d.deliverables) ? d.deliverables.map((x: any) => ({ service: x.service || '', items: Array.isArray(x.items) ? x.items : [] })) : [],
        packageSummary: String(d.packageSummary || ''),
        process: Array.isArray(d.process) ? d.process : [],
        whyUs: Array.isArray(d.whyUs) ? d.whyUs : [],
        closing: String(d.closing || ''),
      };
    }
  } catch { /* fall through */ }

  // Deterministic fallback.
  return {
    headline: `הצעת עבודה ל${input.clientName}`,
    intro: `שמחים להציע ל${input.clientName} ליווי שיווקי מקיף שמותאם למטרות העסק.`,
    understanding: `זיהינו צורך בחיזוק הנוכחות הדיגיטלית והגדלת פניות איכותיות${input.businessField ? ` בתחום ${input.businessField}` : ''}.`,
    deliverables: services.map((s) => ({ service: s, items: ['אסטרטגיה והתאמה לעסק', 'ביצוע שוטף ומדידה', 'דיווח חודשי ושקיפות מלאה'] })),
    packageSummary: input.budget ? `החבילה מותאמת לתקציב ${input.budget} עם דגש על תשואה.` : 'נבנה חבילה מדורגת לפי היקף וצרכים, עם נקודת התחלה גמישה ואפשרות הרחבה.',
    process: ['אפיון ואסטרטגיה', 'הקמה והפעלה', 'אופטימיזציה שוטפת', 'דיווח וצמיחה'],
    whyUs: ['ליווי אישי וצמוד', 'מערכת ניהול וטכנולוגיית AI מתקדמת', 'שקיפות מלאה ודיווח שוטף'],
    closing: 'נשמח להתחיל ולהוביל את העסק שלכם קדימה. נדבר?',
  };
}
