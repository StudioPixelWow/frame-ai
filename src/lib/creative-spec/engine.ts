/**
 * Per-task PREMIUM creative engine.
 *
 * Produces, for one content idea, a small set of *campaign-grade* visual concepts
 * — Apple / Tesla / Nike / Lamborghini / Cannes-Lions level — as VISUAL-ONLY
 * Higgsfield prompts (no text/letters/numbers baked in). All headlines, CTA and
 * logo are added later in the design/overlay layer.
 *
 * Internally the model runs: analyze brand → generate many concepts → score each
 * (wow / premium / stopping-power / originality / brand-fit / clarity) → keep the
 * strongest → emit final structured prompts + per-variation overlay guidance.
 */

import { generateWithAI } from '@/lib/ai/openai-client';

export interface SpecInput {
  ideaTitle: string;
  ideaSummary?: string;
  businessName: string;
  businessField?: string;
  marketingGoals?: string;
  keyMessages?: string;
  brandLanguage?: string;   // free text: colors / style / tone if known
  hasLogo?: boolean;
  brandAssetCount?: number;
  platform?: string;
}

export interface OverlayGuidance {
  headline: string;        // Hebrew — added in the design layer, NOT in the image
  subheadline: string;
  cta: string;
  logoPlacement: string;   // e.g. "top-right" / "bottom-center"
  textSafeArea: string;    // where the visual leaves clean space for text
}

export interface Variation {
  label: string;           // A / B / C / D
  tier: string;            // "פרימיום בטוח" / "פוטוריסטי נועז" / "עוצר-גלילה פרוע"
  concept: string;         // the visual metaphor in one Hebrew sentence
  heroObject: string;      // the dominant hero object (Hebrew)
  imagePrompt: string;     // FINAL structured VISUAL-ONLY Higgsfield prompt (English)
  negativePrompt: string;  // strong no-text / no-cheap-AI negative
  overlay: OverlayGuidance;
  aspectRatio: string;     // "1:1" | "4:5" | "9:16"
}

export interface VideoConcept {
  label: string; title: string; concept: string; hook: string;
  scenes: { shot: string; action: string; onScreenText: string }[];
  style: string; music: string; cta: string; durationSec: number;
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
  posts?: Variation[]; // back-compat alias
}

// Hard, always-appended negative prompt — VISUAL ONLY, no text, no cheap-AI look.
export const SOUL_NEGATIVE = 'text, typography, letters, words, hebrew text, english text, numbers, signs, slogans, captions, watermark, logo text, fake logo, ui, labels, caption bar, distorted text, gibberish text, stock photo look, generic AI render, cheap flyer, brochure, canva template, clipart, low quality, blurry, noisy, deformed, extra limbs, messy clutter, oversaturated neon, random colors, flat dull lighting, amateur';

// Quality / render scaffolding appended to every visual prompt.
const QUALITY = '[QUALITY] Ultra realistic premium 3D advertising render, cinematic, high-end campaign visual, luxury brand commercial quality, volumetric and dramatic rim lighting, soft glow, clean reflections, atmospheric depth, subtle fog, studio-grade shadows, high contrast, razor-sharp polished details, 8K, award-winning, Cannes Lions / Apple keynote / Lamborghini studio quality. VISUAL ONLY — absolutely no text, no letters, no numbers, no signs, no logos in the image; leave clean negative space for a text overlay added later.';

function decorate(prompt: string): string {
  const p = (prompt || '').trim().replace(/\s*\[QUALITY\][\s\S]*$/i, '').trim();
  return `${p}\n${QUALITY}`;
}

export async function generateTaskCreativeSpec(input: SpecInput): Promise<CreativeSpec> {
  const system = `אתה Creative Director, אסטרטג ו-Prompt Architect ברמת פרסים בינלאומיים (Cannes Lions). אתה מאפיין קמפיין ויזואלי פרימיום לעסק, ומפיק פרומפטים ל-Higgsfield AI שמייצרים ויזואלים פרסומיים 3D קולנועיים — לא תמונות סטוק זולות.

# התהליך הפנימי (בצע אותו בשקט, החזר רק את התוצאה)
1. נתח את העסק: תחום, קהל, הצעה, טון, שפה ויזואלית, מטרת קמפיין.
2. ייצר 10 קונספטים ויזואליים חזקים — כל אחד עם מטאפורה ויזואלית (לא ליטרלי, לא משעמם).
3. דרג כל קונספט 1–10 על: WOW, פרימיום, עוצר-גלילה, מקוריות, התאמה למותג, בהירות.
4. בחר את 3–4 הקונספטים החזקים בלבד (ציון ממוצע ≥ 8.5). פסול כל מה שנראה כמו סטוק/פלייר/רנדר AI גנרי/תמונת מוצר רגילה/סצנה ריאליסטית משעממת.
5. הפק 3–4 פרומפטים סופיים: אחד "פרימיום בטוח", אחד "פוטוריסטי נועז", אחד "עוצר-גלילה פרוע" (וריאציה רביעית אופציונלית).

# חוקי ברזל ל-imagePrompt (באנגלית בלבד)
- הירו אובייקט דומיננטי אחד, חזק ופרימיום. הגזם בקנה מידה פרסומי (גדול פי 10–100 מהמציאות כשרלוונטי).
- מטאפורה ויזואלית, לא ליטרלי. (רע: "פאנלים סולאריים על גג". טוב: "בית פרטי שהופך לתחנת אנרגיה עתידנית, קווי אנרגיה זוהרים זורמים מהגג אל ליבת סוללה 3D פרימיום").
- צבעי המותג כחומרים/תאורה/אווירה/אנרגיה — לא כלוגו טקסטואלי.
- בלי שום טקסט/אותיות/מספרים/שלטים/לוגו בתוך התמונה. השאר מרחב נקי לטקסט שיתווסף בשכבת עיצוב.
- מבנה ה-imagePrompt (באנגלית, בשורות):
[FORMAT] Social media visual, aspect ratio: {1:1 / 4:5 / 9:16}
[CORE CONCEPT] the powerful visual metaphor.
[SCENE] environment, setting, scale, mood.
[HERO OBJECT] main object — material, shape, scale, position.
[BRAND MATERIALS] brand colors as materials, lighting accents, premium textures.
[LIGHTING] cinematic volumetric lighting + atmosphere.
[COMPOSITION] camera angle, framing, depth, clean negative space reserved for a later text overlay.
(אל תוסיף [QUALITY] או [NEGATIVE] — הם יתווספו אוטומטית.)

# overlay (שכבת העיצוב — נפרד מהתמונה)
לכל וריאציה: headline (כותרת פרסומית קצרה בעברית), subheadline, cta, logoPlacement, textSafeArea. אלה נוספים מאוחר יותר, לא בתוך התמונה.

# פלט — JSON בלבד:
{"headline":"כותרת-על","brandNotes":"איך מתחבר לשפת המותג","coreIdea":"הקונספט המרכזי במשפט","variations":[{"label":"A","tier":"פרימיום בטוח","concept":"המטאפורה במשפט","heroObject":"אובייקט ההירו","aspectRatio":"4:5","imagePrompt":"[FORMAT]...","overlay":{"headline":"","subheadline":"","cta":"","logoPlacement":"","textSafeArea":""}},{"label":"B","tier":"פוטוריסטי נועז",...},{"label":"C","tier":"עוצר-גלילה פרוע",...}],"video":{"label":"A","title":"","concept":"","hook":"","scenes":[{"shot":"","action":"","onScreenText":""}],"style":"","music":"","cta":"","durationSec":15}}
דרישות: 3–4 variations חזקות (A,B,C[,D]) של אותו רעיון בעוצמות שונות. video אחד עם 3–4 scenes.`;

  const user = `עסק: ${input.businessName}${input.businessField ? ` · תחום: ${input.businessField}` : ''}
פלטפורמה: ${input.platform || 'אינסטגרם'}
רעיון התוכן: ${input.ideaTitle}${input.ideaSummary ? `\nתקציר: ${input.ideaSummary}` : ''}
${input.marketingGoals ? `מטרות שיווק: ${input.marketingGoals}\n` : ''}${input.keyMessages ? `מסרים מרכזיים: ${input.keyMessages}\n` : ''}${input.brandLanguage ? `שפה גרפית: ${input.brandLanguage}\n` : ''}${input.hasLogo ? 'יש לוגו מותג — שמור לו מקום בשכבת העיצוב, אל תייצר לוגו בתוך התמונה.\n' : ''}${input.brandAssetCount ? `יש ${input.brandAssetCount} נכסי מותג להשראת חומרים/צבעים.\n` : ''}
הפק קונספטים פרסומיים פרימיום ברמת Apple/Tesla/Nike/Lamborghini/Cannes — ויזואל בלבד, בלי טקסט בתמונה.`;

  try {
    const res: any = await generateWithAI(system, user, { temperature: 0.9, maxTokens: 3200 });
    let d: any = res?.success ? res.data : null;
    if (typeof d === 'string') { try { d = JSON.parse(d.slice(d.indexOf('{'), d.lastIndexOf('}') + 1)); } catch { d = null; } }
    if (d && Array.isArray(d.variations) && d.variations.length) {
      const labels = ['A', 'B', 'C', 'D'];
      const variations: Variation[] = d.variations.slice(0, 4).map((v: any, i: number) => {
        const ov = v.overlay || {};
        return {
          label: v.label || labels[i],
          tier: String(v.tier || ['פרימיום בטוח', 'פוטוריסטי נועז', 'עוצר-גלילה פרוע', 'קונספט'][i] || ''),
          concept: String(v.concept || ''),
          heroObject: String(v.heroObject || ''),
          imagePrompt: decorate(String(v.imagePrompt || '')),
          negativePrompt: SOUL_NEGATIVE,
          aspectRatio: String(v.aspectRatio || '4:5'),
          overlay: {
            headline: String(ov.headline || ''), subheadline: String(ov.subheadline || ''),
            cta: String(ov.cta || ''), logoPlacement: String(ov.logoPlacement || 'top-right'),
            textSafeArea: String(ov.textSafeArea || 'bottom third'),
          },
        };
      });
      const vraw = d.video || (Array.isArray(d.videos) ? d.videos[0] : null);
      const videos: VideoConcept[] = vraw ? [{
        label: vraw.label || 'A', title: String(vraw.title || input.ideaTitle), concept: String(vraw.concept || ''),
        hook: String(vraw.hook || ''),
        scenes: Array.isArray(vraw.scenes) ? vraw.scenes.slice(0, 5).map((s: any) => ({ shot: String(s.shot || ''), action: String(s.action || ''), onScreenText: String(s.onScreenText || '') })) : [],
        style: String(vraw.style || ''), music: String(vraw.music || ''), cta: String(vraw.cta || ''), durationSec: Number(vraw.durationSec) || 15,
      }] : [];
      if (variations.length) {
        return {
          headline: String(d.headline || input.ideaTitle), brandNotes: String(d.brandNotes || ''),
          coreIdea: String(d.coreIdea || input.ideaTitle), variations, videos, posts: variations,
          negativePrompt: SOUL_NEGATIVE, generatedAt: new Date().toISOString(), usedAI: true,
        };
      }
    }
  } catch { /* fall through */ }

  // Deterministic premium fallback — strong metaphors, visual-only.
  const field = input.businessField || 'brand';
  const tiers = [
    { tier: 'פרימיום בטוח', concept: `הירו אובייקט של ${field} מרחף על משטח שחור מבריק עם תאורת rim דרמטית`, hero: `a premium oversized hero product object representing ${field}, floating above a glossy black reflective surface`, ar: '4:5' },
    { tier: 'פוטוריסטי נועז', concept: `הרעיון של ${input.ideaTitle} כמכונה עתידנית שנפתחת וחושפת ליבת אנרגיה זוהרת`, hero: `a futuristic machine/architectural cutaway opening to reveal a glowing energy core, exaggerated 50x scale`, ar: '1:1' },
    { tier: 'עוצר-גלילה פרוע', concept: `ענק 3D סמלי של ${field} שולט בפריים עם חלקיקים הולוגרפיים מרחפים`, hero: `a colossal symbolic 3D sculpture connected to ${field}, dominating the frame, floating holographic particles`, ar: '9:16' },
  ];
  const labels = ['A', 'B', 'C'];
  const variations: Variation[] = tiers.map((t, i) => ({
    label: labels[i], tier: t.tier, concept: t.concept, heroObject: t.hero,
    imagePrompt: decorate(`[FORMAT] Social media visual, aspect ratio: ${t.ar}\n[CORE CONCEPT] ${t.concept}\n[SCENE] dramatic premium dark studio environment, advertising scale, cinematic mood\n[HERO OBJECT] ${t.hero}\n[BRAND MATERIALS] brand colors used as glowing energy, matte and metallic premium materials, luxury textures\n[LIGHTING] volumetric cinematic lighting, dramatic rim light, soft glow, subtle fog, studio reflections\n[COMPOSITION] hero centered, strong depth, clean negative space reserved for a later text overlay; concept: ${input.ideaTitle}`),
    negativePrompt: SOUL_NEGATIVE, aspectRatio: t.ar,
    overlay: { headline: input.ideaTitle, subheadline: input.businessName, cta: 'לפרטים', logoPlacement: 'top-right', textSafeArea: 'bottom third' },
  }));
  const videos: VideoConcept[] = [{
    label: 'A', title: `${input.ideaTitle} — קמפיין`, concept: `סרטון קצר קולנועי שמציג את ${input.ideaTitle}.`, hook: '3 שניות פתיחה שעוצרות גלילה',
    scenes: [{ shot: 'תקריב הירו', action: 'חשיפה דרמטית', onScreenText: '' }, { shot: 'בינוני', action: 'הדגמת ערך', onScreenText: '' }, { shot: 'סיום', action: 'לוגו + CTA (בשכבת עריכה)', onScreenText: '' }],
    style: 'עריכה קולנועית, תאורה פרימיום, מיתוג עקבי.', music: 'אפי מודרני', cta: 'לפרטים בביו', durationSec: 15,
  }];
  return {
    headline: input.ideaTitle, brandNotes: `אפיון פרימיום עבור ${input.businessName} (ללא AI — חבר מפתח OpenAI לאיכות מלאה).`,
    coreIdea: input.ideaTitle, variations, videos, posts: variations,
    negativePrompt: SOUL_NEGATIVE, generatedAt: new Date().toISOString(), usedAI: false,
  };
}
