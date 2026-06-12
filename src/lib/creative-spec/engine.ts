/**
 * Per-task creative spec engine — turns a gantt content item into a premium,
 * social-ready creative brief:
 *   • 4 DISTINCT visual variations of the SAME core idea (A/B/C/D) — each a
 *     finished, scroll-stopping ad creative (NOT a conceptual illustration or
 *     data-visualization), with a short Hebrew promotional message + a rich,
 *     production-grade English image prompt.
 *   • 1 social-campaign video concept.
 * Grounded in the client's brand language + logo. The 4 imagePrompts are fed to
 * Higgsfield Soul (one image each) so the result is 4 genuinely different visuals.
 */

import { generateWithAI } from '@/lib/ai/openai-client';

export interface SpecInput {
  ideaTitle: string;
  ideaSummary?: string;
  businessName: string;
  businessField?: string;
  marketingGoals?: string;
  keyMessages?: string;
  brandLanguage?: string;   // free text describing colors/style/tone if known
  hasLogo?: boolean;
  brandAssetCount?: number;
  platform?: string;        // instagram / facebook / tiktok
}

export interface Variation {
  label: string;            // "A" / "B" / "C" / "D"
  approach: string;         // the visual angle (hero product / lifestyle / typographic / detail …)
  message: string;          // SHORT Hebrew promotional line (the on-post hook / caption)
  cta: string;              // call to action (Hebrew)
  imagePrompt: string;      // rich English prompt for a finished ad visual
}
export interface VideoConcept {
  label: string;
  title: string;
  concept: string;
  hook: string;             // first 2 seconds
  scenes: { shot: string; action: string; onScreenText: string }[];
  style: string;            // editing/mood/pacing
  music: string;
  cta: string;
  durationSec: number;
}
export interface CreativeSpec {
  headline: string;
  brandNotes: string;
  coreIdea: string;
  variations: Variation[];
  videos: VideoConcept[];
  negativePrompt: string;
  generatedAt: string;
  usedAI: boolean;
  // Back-compat: some older readers expect `posts`; we mirror variations there.
  posts?: Variation[];
}

// Quality + safety scaffolding appended to every image prompt so Soul produces a
// clean, publishable AD creative — never an abstract concept map.
const PROMPT_QUALITY = 'professional advertising photography, high-end social media ad creative, commercial campaign quality, clean modern composition, beautiful studio or natural lighting, crisp focus, premium and aesthetic, negative space reserved for a text overlay, photorealistic, 8k, trending on Behance';
export const SOUL_NEGATIVE = 'abstract, conceptual illustration, data visualization, infographic, map, network diagram, charts, graphs, glowing dots, sci-fi hologram, wireframe, ugly, amateur, low quality, blurry, noisy, cluttered, distorted, deformed, watermark, text, words, letters, typography, logo, signature, frame, border';

function decorate(prompt: string): string {
  const p = (prompt || '').trim().replace(/\.$/, '');
  return `${p}. ${PROMPT_QUALITY}`;
}

export async function generateTaskCreativeSpec(input: SpecInput): Promise<CreativeSpec> {
  const system = `אתה Creative Director בכיר בסוכנת פרסום פרימיום. המשימה: לאפיין קמפיין סושיאל ברמה שיווקית גבוהה — קריאייטיב שמוכן לפרסום אמיתי באינסטגרם/פייסבוק, לא איור מושגי ולא אינפוגרפיקה.

חוקי ברזל ל-imagePrompt (חובה, באנגלית):
1. כל imagePrompt מתאר תמונת פרסומת מוגמרת ויפה — צילום מוצר/לייף-סטייל/דמויות אמיתיות או עיצוב גרפי מודרני ונקי. לא מפות, לא נקודות זוהרות, לא רשתות, לא תרשימים, לא הולוגרמות.
2. 4 הוריאציות הן אותו רעיון מרכזי ב-4 גישות ויזואליות שונות לחלוטין (למשל: A תקריב מוצר הירו, B סצנת לייף-סטייל עם אנשים, C עיצוב טיפוגרפי-גרפי נועז, D תקריב פרט/מרקם). שונות אמיתית בין הוריאציות.
3. אל תכתוב טקסט/מילים בתוך התמונה — הטקסט יתווסף בנפרד. השאר מרחב נקי לכותרת.
4. שלב את צבעי המותג והאווירה. אם יש לוגו — השאר לו מקום, אל תמציא לוגו.

לכל וריאציה:
- "message": משפט פרסומי קצר וחד בעברית (הוק/כותרת לפוסט) — מסחרי, לא תיאורי.
- "cta": קריאה לפעולה קצרה בעברית.
- "approach": הגישה הוויזואלית במילים ספורות (עברית).
- "imagePrompt": תיאור עשיר באנגלית של הוויזואל המוגמר.

החזר JSON בלבד:
{"headline":"כותרת-על","brandNotes":"איך מתחבר למותג","coreIdea":"הרעיון המרכזי במשפט","variations":[{"label":"A","approach":"","message":"","cta":"","imagePrompt":""},{"label":"B",...},{"label":"C",...},{"label":"D",...}],"video":{"label":"A","title":"","concept":"","hook":"","scenes":[{"shot":"","action":"","onScreenText":""}],"style":"","music":"","cta":"","durationSec":15}}
דרישות: בדיוק 4 variations (A,B,C,D), כולן אותו רעיון בגישות שונות. video אחד עם 3-4 scenes.`;

  const user = `עסק: ${input.businessName}${input.businessField ? ` · תחום: ${input.businessField}` : ''}
פלטפורמה: ${input.platform || 'אינסטגרם'}
רעיון התוכן: ${input.ideaTitle}${input.ideaSummary ? `\nתקציר: ${input.ideaSummary}` : ''}
${input.marketingGoals ? `מטרות שיווק: ${input.marketingGoals}\n` : ''}${input.keyMessages ? `מסרים מרכזיים: ${input.keyMessages}\n` : ''}${input.brandLanguage ? `שפה גרפית: ${input.brandLanguage}\n` : ''}${input.hasLogo ? 'יש לוגו מותג — השאר לו מקום, אל תמציא לוגו.\n' : ''}${input.brandAssetCount ? `יש ${input.brandAssetCount} עזרים גרפיים בתיקיית המותג להשראת סגנון.\n` : ''}
צור 4 וריאציות ויזואליות שונות על אותו רעיון + סרטון אחד. כל וריאציה = מסר פרסומי קצר + ויזואל פרסומי מוגמר ויפה שאפשר לפרסם מחר.`;

  try {
    const res: any = await generateWithAI(system, user, { temperature: 0.85, maxTokens: 2800 });
    let d: any = res?.success ? res.data : null;
    if (typeof d === 'string') { try { d = JSON.parse(d.slice(d.indexOf('{'), d.lastIndexOf('}') + 1)); } catch { d = null; } }
    if (d && Array.isArray(d.variations) && d.variations.length) {
      const labels = ['A', 'B', 'C', 'D'];
      const variations: Variation[] = d.variations.slice(0, 4).map((v: any, i: number) => ({
        label: v.label || labels[i],
        approach: String(v.approach || ''),
        message: String(v.message || ''),
        cta: String(v.cta || ''),
        imagePrompt: decorate(String(v.imagePrompt || '')),
      }));
      const vraw = d.video || (Array.isArray(d.videos) ? d.videos[0] : null);
      const videos: VideoConcept[] = vraw ? [{
        label: vraw.label || 'A', title: String(vraw.title || input.ideaTitle), concept: String(vraw.concept || ''),
        hook: String(vraw.hook || ''),
        scenes: Array.isArray(vraw.scenes) ? vraw.scenes.slice(0, 5).map((s: any) => ({ shot: String(s.shot || ''), action: String(s.action || ''), onScreenText: String(s.onScreenText || '') })) : [],
        style: String(vraw.style || ''), music: String(vraw.music || ''), cta: String(vraw.cta || ''), durationSec: Number(vraw.durationSec) || 15,
      }] : [];
      if (variations.length) {
        return {
          headline: String(d.headline || input.ideaTitle),
          brandNotes: String(d.brandNotes || ''),
          coreIdea: String(d.coreIdea || input.ideaTitle),
          variations, videos, posts: variations,
          negativePrompt: SOUL_NEGATIVE,
          generatedAt: new Date().toISOString(), usedAI: true,
        };
      }
    }
  } catch { /* fall through */ }

  // Deterministic fallback — 4 distinct approaches on the same idea.
  const field = input.businessField || 'brand';
  const approaches: { he: string; en: string }[] = [
    { he: 'תקריב מוצר הירו', en: `striking hero close-up product shot for ${field}, dramatic studio lighting on a clean seamless background, ${input.ideaTitle}` },
    { he: 'לייף-סטייל עם אנשים', en: `authentic lifestyle scene, real people enjoying the ${field} product in a bright modern setting, natural light, candid and aspirational, ${input.ideaTitle}` },
    { he: 'עיצוב גרפי נועז', en: `bold modern minimalist graphic design poster for ${field}, large geometric color blocks in brand colors, premium editorial layout with generous negative space, ${input.ideaTitle}` },
    { he: 'תקריב פרט ומרקם', en: `extreme macro detail and texture shot highlighting craftsmanship and quality of the ${field} product, soft elegant light, ${input.ideaTitle}` },
  ];
  const labels = ['A', 'B', 'C', 'D'];
  const variations: Variation[] = approaches.map((a, i) => ({
    label: labels[i], approach: a.he,
    message: `${input.ideaTitle} — ${input.businessName}`,
    cta: 'לפרטים בקליק',
    imagePrompt: decorate(a.en),
  }));
  const videos: VideoConcept[] = [{
    label: 'A', title: `${input.ideaTitle} — קמפיין`, concept: `סרטון קצר וקצבי שמציג את ${input.ideaTitle}.`, hook: '3 שניות פתיחה שעוצרות גלילה',
    scenes: [{ shot: 'תקריב מוצר', action: 'חשיפה דרמטית', onScreenText: input.ideaTitle }, { shot: 'בינוני', action: 'הדגמת ערך', onScreenText: 'הערך ללקוח' }, { shot: 'סיום', action: 'לוגו + CTA', onScreenText: 'צרו קשר' }],
    style: 'עריכה קצבית, מעברים חלקים, מיתוג עקבי.', music: 'אנרגטי מודרני', cta: 'לפרטים בביו', durationSec: 15,
  }];
  return {
    headline: input.ideaTitle, brandNotes: `אפיון בסיסי עבור ${input.businessName} (ללא AI — חבר מפתח OpenAI לאיכות מלאה).`,
    coreIdea: input.ideaTitle, variations, videos, posts: variations,
    negativePrompt: SOUL_NEGATIVE, generatedAt: new Date().toISOString(), usedAI: false,
  };
}
