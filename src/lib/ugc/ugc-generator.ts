/**
 * UGC Business Video Generator — produces a FULL production package (not just a
 * generic prompt): 3 script variations, second-by-second storyboard, shot list,
 * on-screen captions, CTA, and ready-to-paste prompts for AI video / voice /
 * editing tools, plus an automatic Quality Check. Hebrew RTL by default.
 */

import { generateWithAI } from '@/lib/ai/openai-client';

export interface UgcBrief {
  businessName: string;
  businessType: string;   // נדל״ן / מסעדה / חנות / קליניקה / שירות / לוגיסטיקה / אולם / אחר
  goal: string;           // חשיפה / לידים / מכירה / ביקור במקום / השקת עסק / הצגת יתרונות
  targetAudience: string;
  tone: string;           // צעיר / פרימיום / רשמי / אותנטי / מצחיק / חד ומכירתי
  sellingPoints: string;
  location?: string;
  presenterType?: string; // 'real' | 'ai'
  existingAssets?: string;
  duration: number;       // 15 / 25 / 30 / 45
  language?: string;      // default he
  style?: string;         // אותנטי מהשטח / פרימיום עסקי / צעיר וטיקטוקי / נדל״ן מכירתי / המלצה אישית
  clientKnowledge?: string; // compact blob of everything we know about the client
}

export interface UgcShot {
  time: string;           // "0-3s"
  shotType: string;       // Selfie intro / Walk and talk / ...
  vo: string;             // presenter speech
  caption: string;        // on-screen caption (short)
  direction: string;      // filming direction
}

export interface UgcVariation {
  id: string;
  label: string;          // אותנטית ועדינה / מכירתית / פרימיום
  hook: string;
  fullScript: string;
  shots: UgcShot[];
  captions: string[];
  cta: string;
  abNote: string;
  toolPrompts: { tool: string; type: string; prompt: string }[];
}

export interface UgcQc {
  passed: boolean;
  checks: { id: string; label: string; ok: boolean; note?: string }[];
}

export interface UgcPackage {
  variations: UgcVariation[];
  qc: UgcQc;
}

const STYLE_HINT: Record<string, string> = {
  'אותנטי מהשטח': 'גלם, סלפי ביד, תאורה טבעית, תחושת "צילמתי עכשיו", בלי ליטוש.',
  'פרימיום עסקי': 'נקי, יציב יותר, צבעוניות עשירה, אך עדיין UGC ולא תדמית.',
  'צעיר וטיקטוקי': 'קצב מהיר מאוד, jump-cuts, אנרגיה גבוהה, סלנג קליל.',
  'נדל״ן מכירתי': 'הצגת נכס/פרויקט, דגש על מיקום ויתרונות, הנעה ללידים.',
  'המלצה אישית': 'גוף ראשון, חוויה אישית, אמינות, "באתי לבדוק והופתעתי".',
};

const DOMAIN_HINT: Record<string, string> = {
  'נדל״ן': 'כניסה לפרויקט, לובי/בניין/דירה/מרפסת/נוף/סביבת מגורים, יתרונות מיקום, מחיר/הטבה/אכלוס אם קיים, CTA ללידים.',
  'מסעדה': 'כניסה, אווירה, מנות, חוויה, בידול, CTA להזמנת שולחן/הגעה.',
  'חנות': 'כניסה, אווירה, מוצרים, מבצע/חוויה/בידול, CTA לביקור/השארת פרטים.',
  'קליניקה': 'הצגת הבעיה, הפתרון, אמינות, תהליך קצר, CTA לשיחת ייעוץ.',
  'שירות': 'הצגת הבעיה, הפתרון, אמינות, תהליך קצר, CTA לשיחת ייעוץ.',
  'לוגיסטיקה': 'הצגת היכולת/מתחם, אמינות, היקף, CTA ליצירת קשר עסקי.',
  'אולם': 'כניסה, חלל, אווירת אירוע, יתרונות, CTA לסיור/הזמנה.',
};

export async function generateUgcPackage(brief: UgcBrief): Promise<UgcPackage> {
  const lang = brief.language || 'he';
  const styleHint = brief.style ? (STYLE_HINT[brief.style] || brief.style) : '';
  const domainHint = DOMAIN_HINT[brief.businessType] || 'הצגת המקום/השירות, יתרונות מרכזיים, CTA מתאים.';

  const system = [
    'אתה מפיק/ת תוכן UGC עסקי מומחה/ית. אתה כותב/ת חבילת הפקה מלאה לסרטון UGC אנכי (9:16) שנראה כמו צילום אמיתי בטלפון — סלפי, walk & talk, B-roll, כתוביות קצרות, קצב מהיר, אותנטי אבל מסחרי.',
    lang === 'he' ? 'כתוב הכל בעברית תקינה ומיושרת RTL.' : `כתוב בשפה: ${lang}.`,
    'אל תייצר "פרסומת תדמית" מלוטשת — כן UGC אמין. החזר JSON תקין בלבד, ללא טקסט מסביב.',
  ].join(' ');

  const knowledgeBlock = brief.clientKnowledge?.trim()
    ? `\n\n=== ידע על הלקוח (חובה להתבסס על זה — מיצוב, קהל, טון, בידול) ===\n${brief.clientKnowledge.trim()}\n=== סוף ידע הלקוח ===`
    : '';

  const user = `בריף:
- עסק: ${brief.businessName}
- תחום: ${brief.businessType} (${domainHint})
- מטרה: ${brief.goal}
- קהל יעד: ${brief.targetAudience}
- טון: ${brief.tone}
- נקודות מכירה: ${brief.sellingPoints}
- מיקום: ${brief.location || '—'}
- פרזנטור: ${brief.presenterType === 'ai' ? 'פרזנטור AI (לייצר)' : 'פרזנטור אמיתי'}
- חומרים קיימים: ${brief.existingAssets || '—'}
- משך: ${brief.duration} שניות
${styleHint ? `- סגנון: ${styleHint}` : ''}${knowledgeBlock}

צור 3 וריאציות מלאות. החזר JSON:
{
  "variations": [
    {
      "label": "אותנטית ועדינה",
      "hook": "וו פתיחה חזק ל-3 שניות הראשונות (גוף ראשון, טבעי)",
      "fullScript": "תסריט דיבור מלא ורציף לפרזנטור, משפטים קצרים",
      "shots": [
        { "time": "0-3s", "shotType": "Selfie intro", "vo": "טקסט דיבור", "caption": "כתובית קצרה על המסך", "direction": "הנחיית צילום" }
      ],
      "captions": ["כתובית 1", "כתובית 2"],
      "cta": "קריאה לפעולה בסיום",
      "abNote": "למה הגרסה הזו (A/B)",
      "toolPrompts": [
        { "tool": "Sora", "type": "video", "prompt": "פרומפט באנגלית לסרטון" },
        { "tool": "Runway", "type": "video", "prompt": "..." },
        { "tool": "Kling", "type": "video", "prompt": "..." },
        { "tool": "Veo", "type": "video", "prompt": "..." },
        { "tool": "HeyGen", "type": "presenter", "prompt": "פרומפט/הנחיה לפרזנטור מדבר" },
        { "tool": "ElevenLabs", "type": "voice", "prompt": "טקסט קריינות + הנחיית טון" },
        { "tool": "CapCut", "type": "edit", "prompt": "מבנה עריכה, קצב, jump-cuts, כתוביות, מוזיקה" }
      ]
    },
    { "label": "מכירתית יותר", "...": "אותו מבנה" },
    { "label": "פרימיום ומסודרת", "...": "אותו מבנה" }
  ]
}
דרישות: כל וריאציה 5-7 שוטים שמסתכמים ל-${brief.duration} שניות, וו חזק ב-3 שניות, כתוביות קצרות (2-5 מילים), CTA ברור. שוטים מתוך: Selfie intro, Walk and talk, Entrance shot, Pointing to feature, Wide interior shot, Detail close-up, Before/after, Product/service demonstration, Reaction shot, CTA selfie ending. פרומפטים לכלים — תמציתיים וקונקרטיים, פרומפטי וידאו באנגלית, 9:16 vertical, handheld/selfie, natural movement.`;

  // generateWithAI returns { success, data } — data is already-parsed JSON (or raw string).
  const res: any = await generateWithAI(system, user, { temperature: 0.7, maxTokens: 7000 });
  if (!res?.success) throw new Error(res?.error || 'יצירת התסריט נכשלה — נסה שוב');
  let parsed: any = res.data;
  if (typeof parsed === 'string') {
    try { parsed = JSON.parse(parsed.slice(parsed.indexOf('{'), parsed.lastIndexOf('}') + 1)); } catch { throw new Error('יצירת התסריט נכשלה — נסה שוב'); }
  }
  if (!parsed || typeof parsed !== 'object') throw new Error('יצירת התסריט נכשלה — נסה שוב');

  const variations: UgcVariation[] = (Array.isArray(parsed.variations) ? parsed.variations : []).slice(0, 3).map((v: any, i: number) => ({
    id: `v${i + 1}`,
    label: v.label || ['אותנטית ועדינה', 'מכירתית יותר', 'פרימיום ומסודרת'][i] || `גרסה ${i + 1}`,
    hook: v.hook || '',
    fullScript: v.fullScript || '',
    shots: Array.isArray(v.shots) ? v.shots.map((s: any) => ({ time: s.time || '', shotType: s.shotType || '', vo: s.vo || '', caption: s.caption || '', direction: s.direction || '' })) : [],
    captions: Array.isArray(v.captions) ? v.captions : [],
    cta: v.cta || '',
    abNote: v.abNote || '',
    toolPrompts: Array.isArray(v.toolPrompts) ? v.toolPrompts.map((p: any) => ({ tool: p.tool || '', type: p.type || '', prompt: p.prompt || '' })) : [],
  }));

  // ── Quality Check (heuristic, deterministic) ──
  const qc = runQualityCheck(variations, brief);

  return { variations, qc };
}

function runQualityCheck(variations: UgcVariation[], brief: UgcBrief): UgcQc {
  const v = variations[0];
  const allCaptions = variations.flatMap((x) => [...x.captions, ...x.shots.map((s) => s.caption)]).filter(Boolean);
  const hasHook = !!v?.hook && v.hook.length > 4;
  const hasCta = variations.every((x) => !!x.cta);
  const shortCaptions = allCaptions.length > 0 && allCaptions.every((c) => c.split(/\s+/).length <= 6);
  const hasCaptions = allCaptions.length > 0;
  const notTooAdvertorial = !/(הטוב ביותר בעולם|מבצע הענק|אל תפספסו את ההזדמנות של פעם בחיים)/.test(JSON.stringify(variations));
  const hebrewOk = brief.language && brief.language !== 'he' ? true : /[֐-׿]/.test(v?.fullScript || '');
  const hasShots = (v?.shots?.length || 0) >= 4;

  const checks = [
    { id: 'hook', label: 'Hook חזק ב-3 שניות הראשונות', ok: hasHook },
    { id: 'silent', label: 'מובן בלי סאונד (יש כתוביות)', ok: hasCaptions },
    { id: 'short_caps', label: 'כתוביות קצרות', ok: shortCaptions },
    { id: 'cta', label: 'יש CTA בכל גרסה', ok: hasCta },
    { id: 'not_ad', label: 'לא פרסומי מדי', ok: notTooAdvertorial },
    { id: 'ugc', label: 'מבנה UGC (שוטים מגוונים)', ok: hasShots },
    { id: 'rtl', label: 'עברית תקינה / RTL', ok: hebrewOk },
  ];
  return { passed: checks.every((c) => c.ok), checks };
}
