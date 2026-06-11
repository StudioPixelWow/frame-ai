/**
 * Per-task creative spec engine — turns a gantt content item into a premium,
 * deep visual brief: 2 static post concepts + 2 social-campaign video concepts.
 * Each concept carries enough direction to drive a top-tier, on-brand design AND
 * a ready-to-use image prompt (later fed to Higgsfield / Creative PixelAI for the
 * A/B/C/D variations). Grounded in the client's brand language + logo.
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

export interface PostConcept {
  label: string;            // "A" / "B" …
  title: string;
  concept: string;          // the idea in 1-2 sentences
  visualDirection: string;  // composition, layout, focal point
  colorPalette: string;     // on-brand colors
  typography: string;       // headline/body type direction
  hook: string;             // the on-image headline
  cta: string;
  imagePrompt: string;      // English prompt ready for the image engine
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
  posts: PostConcept[];
  videos: VideoConcept[];
  generatedAt: string;
  usedAI: boolean;
}

export async function generateTaskCreativeSpec(input: SpecInput): Promise<CreativeSpec> {
  const system = `אתה מנהל קריאייטיב בכיר (Creative Director) בסוכנות שיווק פרימיום. צור אפיון עיצובי עמוק, חדשני ומושך ברמה הגבוהה ביותר — שמתחבר ישירות לעסק ולשפה הוויזואלית שלו.
כללים: עברית מקצועית; קונקרטי וניתן לביצוע; חדשני אך נאמן למותג; בלי קלישאות. כל imagePrompt באנגלית, עשיר ומדויק (composition, lighting, style, brand colors, mood), מוכן למנוע יצירת תמונות.
החזר JSON בלבד במבנה:
{"headline":"כותרת-על לאפיון","brandNotes":"איך האפיון מתחבר למותג ולשפה הגרפית","posts":[{"label":"A","title":"","concept":"","visualDirection":"","colorPalette":"","typography":"","hook":"","cta":"","imagePrompt":""}],"videos":[{"label":"A","title":"","concept":"","hook":"","scenes":[{"shot":"","action":"","onScreenText":""}],"style":"","music":"","cta":"","durationSec":15}]}
דרישות: בדיוק 2 posts (label A,B) ו-2 videos (label A,B). לכל וידאו 3-4 scenes.`;

  const user = `עסק: ${input.businessName}${input.businessField ? ` · תחום: ${input.businessField}` : ''}
פלטפורמה: ${input.platform || 'אינסטגרם'}
רעיון התוכן: ${input.ideaTitle}${input.ideaSummary ? `\nתקציר: ${input.ideaSummary}` : ''}
${input.marketingGoals ? `מטרות שיווק: ${input.marketingGoals}\n` : ''}${input.keyMessages ? `מסרים מרכזיים: ${input.keyMessages}\n` : ''}${input.brandLanguage ? `שפה גרפית: ${input.brandLanguage}\n` : ''}${input.hasLogo ? 'יש לוגו מותג — שלב אותו בהרמוניה.\n' : ''}${input.brandAssetCount ? `יש ${input.brandAssetCount} עזרים גרפיים בתיקיית המותג להשראה.\n` : ''}
צור אפיון פרימיום: 2 פוסטים סטטיים + 2 סרטוני קמפיין סושיאל, נראות הכי חדשנית ומושכת שמתחברת לעסק.`;

  try {
    const res: any = await generateWithAI(system, user, { temperature: 0.8, maxTokens: 2800 });
    let d: any = res?.success ? res.data : null;
    if (typeof d === 'string') { try { d = JSON.parse(d.slice(d.indexOf('{'), d.lastIndexOf('}') + 1)); } catch { d = null; } }
    if (d && (Array.isArray(d.posts) || Array.isArray(d.videos))) {
      const posts: PostConcept[] = (Array.isArray(d.posts) ? d.posts : []).slice(0, 2).map((p: any, i: number) => ({
        label: p.label || ['A', 'B'][i], title: String(p.title || ''), concept: String(p.concept || ''),
        visualDirection: String(p.visualDirection || ''), colorPalette: String(p.colorPalette || ''),
        typography: String(p.typography || ''), hook: String(p.hook || ''), cta: String(p.cta || ''),
        imagePrompt: String(p.imagePrompt || ''),
      }));
      const videos: VideoConcept[] = (Array.isArray(d.videos) ? d.videos : []).slice(0, 2).map((v: any, i: number) => ({
        label: v.label || ['A', 'B'][i], title: String(v.title || ''), concept: String(v.concept || ''),
        hook: String(v.hook || ''), scenes: Array.isArray(v.scenes) ? v.scenes.slice(0, 5).map((s: any) => ({ shot: String(s.shot || ''), action: String(s.action || ''), onScreenText: String(s.onScreenText || '') })) : [],
        style: String(v.style || ''), music: String(v.music || ''), cta: String(v.cta || ''), durationSec: Number(v.durationSec) || 15,
      }));
      if (posts.length || videos.length) {
        return { headline: String(d.headline || input.ideaTitle), brandNotes: String(d.brandNotes || ''), posts, videos, generatedAt: new Date().toISOString(), usedAI: true };
      }
    }
  } catch { /* fall through */ }

  // Deterministic fallback.
  const mk = (label: string, angle: string): PostConcept => ({
    label, title: `${input.ideaTitle} — ${angle}`, concept: `הצגת ${input.ideaTitle} בזווית ${angle} עבור ${input.businessName}.`,
    visualDirection: 'פוקוס מרכזי על המוצר/המסר, מרחב נקי, היררכיה ויזואלית ברורה.', colorPalette: 'צבעי המותג כדומיננטיים + ניגוד אחד מדויק.',
    typography: 'כותרת עבה וקריאה, גוף משני עדין.', hook: input.ideaTitle, cta: 'לפרטים בקליק', imagePrompt: `Premium ${input.businessField || 'brand'} social post, clean composition, brand colors, modern typography, high-end studio lighting, ${input.ideaTitle}`,
  });
  const vid = (label: string): VideoConcept => ({
    label, title: `${input.ideaTitle} — קמפיין`, concept: `סרטון קצר וקצבי שמציג את ${input.ideaTitle}.`, hook: '3 שניות פתיחה שעוצרות גלילה',
    scenes: [{ shot: 'תקריב מוצר', action: 'חשיפה דרמטית', onScreenText: input.ideaTitle }, { shot: 'בינוני', action: 'הדגמת ערך', onScreenText: 'הערך ללקוח' }, { shot: 'סיום', action: 'לוגו + CTA', onScreenText: 'צרו קשר' }],
    style: 'עריכה קצבית, מעברים חלקים, מיתוג עקבי.', music: 'אנרגטי מודרני', cta: 'לפרטים בביו', durationSec: 15,
  });
  return { headline: input.ideaTitle, brandNotes: `אפיון בסיסי עבור ${input.businessName} (ללא AI — חבר מפתח OpenAI לאיכות מלאה).`, posts: [mk('A', 'ישיר'), mk('B', 'רגשי')], videos: [vid('A'), vid('B')], generatedAt: new Date().toISOString(), usedAI: false };
}
