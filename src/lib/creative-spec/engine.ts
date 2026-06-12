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

// Quality + safety scaffolding appended to every image prompt (the "Visual Quality"
// + "Composition" + "Output Style" sections of the master brief) so Soul produces a
// premium, award-winning advertising visual — never generic AI artwork or a concept map.
const PROMPT_QUALITY = 'Ultra realistic, photorealistic advertising campaign visual, award-winning creative-agency quality, luxury commercial photography. One dominant hero subject, single clear focal point, strong depth, premium cinematic and volumetric lighting, realistic reflections and shadows, premium materials, depth of field, subtle lens flare. Clean uncluttered background, highly readable advertising composition, generous negative space reserved for a headline. High-end 8K commercial advertisement.';
export const SOUL_NEGATIVE = 'generic AI look, AI artwork, random floating objects, objects placed side by side, too many elements, overloaded cluttered composition, cartoon, illustration, 3d render toy look, unrealistic proportions, deformed, stock photo feeling, weak branding, abstract, conceptual diagram, data visualization, infographic, map, network diagram, charts, graphs, glowing dots, sci-fi hologram, wireframe, ugly, amateur, low quality, blurry, noisy, watermark, text, words, letters, typography, fake logo, signature, frame, border';

function decorate(prompt: string): string {
  const p = (prompt || '').trim().replace(/\.$/, '');
  return `${p}. ${PROMPT_QUALITY}`;
}

export async function generateTaskCreativeSpec(input: SpecInput): Promise<CreativeSpec> {
  const system = `אתה Creative Director זוכה פרסים בסוכנת פרסום מובילה. אתה כותב brief ויזואלי לפרסומת סושיאל פרימיום שנראית כמו קמפיין אמיתי של סוכנות-על — לא AI גנרי, לא איור מושגי, לא אינפוגרפיקה.

# עקרון העל — קונספט אחד אינטגרטיבי
כל וריאציה מתחילה מרעיון ויזואלי חזק אחד שממזג יחד לסיפור ויזואלי אחד:
1. עולם המותג (לוגו, צבעים, מוצר, אישיות).
2. מסר הקמפיין.
3. הנושא/אירוע הנוכחי.
אסור להניח אובייקטים זה לצד זה — צריך לשלב אותם לאובייקט/סצנה אחת.
דוגמאות למיזוג נכון: חברת משלוחים → גביע מונדיאל בנוי מחבילות. חברת טעינה לרכב חשמלי → גביע שמופעל מאנרגיה. חברת ליסינג → רכב משולב בחוויית כדורגל.
הקונספט חייב להיות מובן תוך שנייה אחת.

# חוקי ברזל ל-imagePrompt (באנגלית, עשיר ומדויק)
1. תמונת פרסומת מוגמרת ופוטוריאליסטית — המוצר/השירות הוא ה-HERO ותמיד גלוי וברור. הצופה מבין מיד מה החברה עושה ומה מקודם.
2. אובייקט הירו דומיננטי אחד, פוקוס ברור, עומק, תאורה קולנועית/וולומטרית, רקע נקי, ללא עומס.
3. בלי מפות/נקודות זוהרות/רשתות/תרשימים/הולוגרמות, בלי אובייקטים מרחפים אקראיים, בלי סגנון קרטון, בלי תחושת סטוק.
4. בלי טקסט/אותיות בתוך התמונה — הטקסט יתווסף בנפרד; השאר מרחב נקי לכותרת.
5. צבעי המותג והאישיות בלבד — אל תמציא צבעים/סגנון זרים. אם יש לוגו — השאר לו מקום, אל תמציא לוגו.

# 4 הוריאציות
אותו קונספט קמפיין, 4 ביצועים ויזואליים שונים לחלוטין (זווית/קומפוזיציה/סצנה שונות) — לא 4 פעמים אותו דבר.

לכל וריאציה: "message" = משפט פרסומי קצר וחד בעברית (הוק מסחרי). "cta" = קריאה לפעולה קצרה. "approach" = הגישה הוויזואלית במילים ספורות (עברית). "imagePrompt" = ה-brief המלא באנגלית לפי הכללים מעלה.

החזר JSON בלבד:
{"headline":"כותרת-על","brandNotes":"איך מתחבר למותג","coreIdea":"הקונספט האינטגרטיבי המרכזי במשפט","variations":[{"label":"A","approach":"","message":"","cta":"","imagePrompt":""},{"label":"B",...},{"label":"C",...},{"label":"D",...}],"video":{"label":"A","title":"","concept":"","hook":"","scenes":[{"shot":"","action":"","onScreenText":""}],"style":"","music":"","cta":"","durationSec":15}}
דרישות: בדיוק 4 variations (A,B,C,D) של אותו קונספט אינטגרטיבי. video אחד עם 3-4 scenes.`;

  const user = `עסק: ${input.businessName}${input.businessField ? ` · תחום: ${input.businessField}` : ''}
פלטפורמה: ${input.platform || 'אינסטגרם'}
רעיון התוכן: ${input.ideaTitle}${input.ideaSummary ? `\nתקציר: ${input.ideaSummary}` : ''}
${input.marketingGoals ? `מטרות שיווק: ${input.marketingGoals}\n` : ''}${input.keyMessages ? `מסרים מרכזיים: ${input.keyMessages}\n` : ''}${input.brandLanguage ? `שפה גרפית: ${input.brandLanguage}\n` : ''}${input.hasLogo ? 'יש לוגו מותג — השאר לו מקום, אל תמציא לוגו.\n' : ''}${input.brandAssetCount ? `יש ${input.brandAssetCount} עזרים גרפיים בתיקיית המותג להשראת סגנון.\n` : ''}
צור קונספט קמפיין אחד אינטגרטיבי שממזג את עולם המותג + מסר הקמפיין + נושא התוכן לסיפור ויזואלי אחד מובן-תוך-שנייה, ואז 4 וריאציות ויזואליות שונות לחלוטין שלו + סרטון אחד. כל וריאציה = מסר פרסומי קצר + ויזואל פרסומי מוגמר ברמת סוכנות שאפשר לפרסם מחר.`;

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
    { he: 'הירו דרמטי', en: `hero advertising shot where the ${field} product is the dominant subject, dramatically lit on a clean seamless background, integrated single concept for: ${input.ideaTitle}` },
    { he: 'לייף-סטייל עם אנשים', en: `cinematic lifestyle scene, real people genuinely using the ${field} product in a bright modern setting, the product clearly the hero, aspirational mood, concept: ${input.ideaTitle}` },
    { he: 'מיזוג קונספטואלי', en: `one integrated conceptual hero visual that merges the ${field} brand world with the campaign theme into a single object/scene (not side by side), premium and instantly readable, concept: ${input.ideaTitle}` },
    { he: 'תקריב פרט ומרקם', en: `extreme macro detail shot highlighting craftsmanship, premium materials and quality of the ${field} product, elegant cinematic light, concept: ${input.ideaTitle}` },
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
