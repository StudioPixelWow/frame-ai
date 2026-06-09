import type {
  PodcastEpisodeType,
  PodcastGoal,
  PodcastGuestPersona,
  PodcastEpisodeStructure,
  PodcastQuestion,
  PodcastQuestionType,
  PodcastQuestionLabel,
  PodcastClipIdea,
} from '@/lib/db/schema';

import { generateWithAI } from '@/lib/ai/openai-client';

// Strategic intent per episode type — fed to the model so each type feels distinct.
const EPISODE_INTENT: Record<string, string> = {
  deep_interview: 'ראיון עומק אישי — חושפים את המסע, נקודות המפנה, הכישלונות והלקחים של האורח. המטרה: חיבור רגשי ואותנטיות.',
  sales: 'פרק מכירתי עקיף — בונים את הבעיה בשוק, שוברים את הפתרונות הישנים, וממצבים את האורח כפתרון. המטרה: לידים והמרות בלי תחושת מכירה אגרסיבית.',
  educational: 'פרק חינוכי — האורח מלמד מסגרת/שיטה ברורה שהמאזין יכול ליישם מיד. המטרה: ערך פרקטי וביסוס סמכות.',
  viral_short: 'פרק קצר וויראלי — סיפור אחד חד עם טוויסט, בנוי לקליפים. המטרה: שיתופים והגעה אורגנית.',
  authority: 'פרק סמכות — מיצוב האורח כקול מוביל בתחום עם תובנות נדירות ודעות חדות. המטרה: בידול מקצועי ואמון.',
};

const GOAL_LABELS: Record<string, string> = {
  personal_exposure: 'חשיפה אישית', trust_building: 'בניית אמון',
  professional_differentiation: 'בידול מקצועי', lead_generation: 'יצירת לידים',
  sales: 'מכירות', market_education: 'חינוך שוק',
  storytelling: 'סיפור אישי', objection_handling: 'טיפול בהתנגדויות',
};

const SENIOR_PRODUCER_SYSTEM = `אתה פרודיוסר ראשי ועורך תוכן בכיר של פודקאסטים עסקיים מובילים בישראל, עם ניסיון בהפקת פרקים שהגיעו למיליוני האזנות.
אתה בונה אסטרטגיית פרק ברמה מקצועית גבוהה — לא טמפלייט גנרי.

כללי איכות מחייבים:
- עברית תקנית, זורמת וטבעית. אסור תרגומית, אסור ניסוח מסורבל.
- הכל ספציפי לאורח, לתחום ולקהל — לא משפטים כלליים שמתאימים לכל אחד.
- אסור קלישאות שחוקות כמו "לא תאמינו", "הסוד ש...", "מה שאף אחד לא מספר לכם", "תקשיבו עד הסוף".
- פתיחים (hooks) חייבים ליצור מתח אמיתי או סקרנות מבוססת-מהות, לא סנסציה ריקה.
- כל סגמנט כולל נקודות דיבור קונקרטיות ושאלה מובילה שמייצרת רגע "סאונדבייט".
- תחשוב כמו עורך: מבנה דרמטי עם עליות, נקודת מפנה, ושיא.
החזר JSON תקין בלבד, ללא טקסט נוסף וללא markdown.`;

/** Call the app's configured OpenAI and parse JSON. Returns null on failure. */
async function aiJson<T>(userPrompt: string, maxTokens: number): Promise<T | null> {
  try {
    const res = await generateWithAI(SENIOR_PRODUCER_SYSTEM, userPrompt, { temperature: 0.8, maxTokens });
    if (!res.success || !res.data) return null;
    return res.data as T;
  } catch (err) {
    console.error('[podcast strategy] AI call failed:', err);
    return null;
  }
}

// ───────────────────────────────────────────────────────────────────────────
// MOCK ENGINE (Template-based generation)
// ───────────────────────────────────────────────────────────────────────────

function generateMockEpisodeStructure(params: {
  episodeType: PodcastEpisodeType;
  goals: PodcastGoal[];
  clientName: string;
}): PodcastEpisodeStructure {
  const { episodeType, clientName } = params;

  // Different structures based on episode type
  switch (episodeType) {
    case 'deep_interview':
      return {
        openingHook: `מה אם הייתי אומר לך ש-${clientName} שינה את הכללים לגמרי?`,
        intro: `היום אנחנו יושבים עם ${clientName} כדי להבין איך הם הגיעו לשם בו הם נמצאים היום.`,
        segments: [
          {
            title: 'הסיפור מאחורי הקלעים',
            description: 'כיצד התחיל הסיפור וממה ${clientName} התחיל',
            durationMinutes: 15,
          },
          {
            title: 'הנקודה שהפכה הכל',
            description: 'הרגע המכריע שגרם לשינוי בדרך',
            durationMinutes: 15,
          },
          {
            title: 'המסר המרכזי',
            description: 'מה החוכמה שאפשר ללמוד מהחוויה הזאת',
            durationMinutes: 10,
          },
          {
            title: 'הצעדים הבאים',
            description: 'איך הם מתכננים להמשיך ולגדול',
            durationMinutes: 10,
          },
        ],
        transitions: [
          'אז עכשיו בואו נלך עמוק יותר',
          'אבל זה רק התחלה של הסיפור',
          'וכאן נכנסנו לנקודה קריטית',
          'אז מה התוצאה הסופית?',
        ],
        closingCTA:
          'אם רוצים ללמוד יותר על ${clientName} או להשתמש בשירותיהם, בואו לבדוק אותם באתר שלהם!',
      };

    case 'sales':
      return {
        openingHook: `בואו נדבר על משהו שכל עסק צריך לדעת - אבל לא מכל החברות יודעות.`,
        intro: `${clientName} הם מומחים בתחום הזה, וזה בדיוק מה שאנחנו הולכים לחקור.`,
        segments: [
          {
            title: 'בעיית המשוק',
            description: 'הבעיה הקריטית שעסקים מתמודדים איתה',
            durationMinutes: 12,
          },
          {
            title: 'למה הפתרונות הישנים לא עובדים',
            description: 'ניתוח של הגישות הקיימות וההגבלות שלהן',
            durationMinutes: 12,
          },
          {
            title: 'הגישה החדשה של ${clientName}',
            description: 'איך הם מתקרבים לבעיה בדרך שונה',
            durationMinutes: 12,
          },
          {
            title: 'תוצאות מהשטח',
            description: 'סיפורים של לקוחות שהשתנו בגלל הפתרון',
            durationMinutes: 8,
          },
        ],
        transitions: [
          'אז זו הבעיה, אבל מה פתרנו?',
          'וזה לא כל כך פשוט',
          'התעלומה היא למה הם יכלו',
          'תשמעו את זה בעיני פרטה',
        ],
        closingCTA:
          '${clientName} משנים את המשחק בתחום הזה. אם אתם מתעניינים, צרו איתם קשר!',
      };

    case 'educational':
      return {
        openingHook: `היום אנחנו הולכים ללמוד כמו שאף פעם לא למדנו קודם.`,
        intro: `${clientName} מעביר לנו שיעור שימושי שרלוונטי לכל אחד מכם.`,
        segments: [
          {
            title: 'היסודות',
            description: 'תשתית המושגים החיוניים',
            durationMinutes: 12,
          },
          {
            title: 'מקדימים בעולם האמיתי',
            description: 'דוגמאות פרקטיות שאפשר להשתמש בהן היום',
            durationMinutes: 12,
          },
          {
            title: 'טריקים והטיפים הסודיים',
            description: 'הדברים שלא למדים בתיכון',
            durationMinutes: 12,
          },
          {
            title: 'איך להתחיל מהיום',
            description: 'צעדים ממידיים שאפשר לנקוט בהם',
            durationMinutes: 8,
          },
        ],
        transitions: [
          'הבנתם את הבסיס, עכשיו בואו נעלה עוד שכבה',
          'וזה כשזה הופך למעניין',
          'אבל חכו, זה עדיין לא הכל',
          'ועכשיו בא החלק הזהב',
        ],
        closingCTA:
          'תודה ל-${clientName} על השיעור. אם רוצים עוד ידע, בדקו את המשאבים שלהם!',
      };

    case 'viral_short':
      return {
        openingHook: `לא תאמינו מה קרה`,
        intro: `${clientName} מספרים סיפור שרק צריך שתהיו שומעים.`,
        segments: [
          {
            title: 'ההתחלה הפוגעת',
            description: 'איך הכל התחיל בדרך לא צפויה',
            durationMinutes: 8,
          },
          {
            title: 'הטוויסט',
            description: 'מה קרה כשהכל בא מהצד השני',
            durationMinutes: 8,
          },
          {
            title: 'היום המרגיע',
            description: 'איך הסיפור הסתיים בדרך בלתי צפויה',
            durationMinutes: 6,
          },
        ],
        transitions: [
          'אבל חכו, זה עוד לא הסוף',
          'ואז זה קרה',
          'ובדיוק כאן הופיע הדרמה',
        ],
        closingCTA: `זה היה סיפור של ${clientName}. עקבו אחריהם להיום הבא!`,
      };

    case 'authority':
      return {
        openingHook: `בעולם מלא אנשים שחושבים שהם יודעים, ${clientName} באמת יודעים.`,
        intro: `היום אנחנו מדברים עם מישהו שהוא בראש המשחק בתחום שלהם.`,
        segments: [
          {
            title: 'הדרך להיות מומחה',
            description: 'איך ${clientName} הפכו לסמכות בתחום',
            durationMinutes: 15,
          },
          {
            title: 'מה משוננים לא מבינים',
            description: 'ההבדלים בין תיאוריה לפרקטיקה',
            durationMinutes: 15,
          },
          {
            title: 'הטיפים מהגבוה למעלה',
            description: 'מה שרק מומחים באמת יודעים',
            durationMinutes: 10,
          },
        ],
        transitions: [
          'וזה בדיוק מה שמבדיל בין הטובים לאחרים',
          'אבל זה רק אם אתה מבין זאת',
          'וכאן בא החלק שהרוב מפספסים',
        ],
        closingCTA:
          'כשאתם צריכים מומחה אמיתי, ${clientName} הם בחירה מובחרת. בקרו אותם!',
      };

    default:
      return {
        openingHook: `בואו נתחיל משהו חדש.`,
        intro: `אנחנו עם ${clientName} היום.`,
        segments: [
          {
            title: 'פתיח',
            description: 'התחלת הדיון',
            durationMinutes: 10,
          },
          {
            title: 'עמוק בתוך הנושא',
            description: 'הלחץ של הדיון',
            durationMinutes: 15,
          },
          {
            title: 'סיכום והנושאים העיקריים',
            description: 'מה למדנו',
            durationMinutes: 10,
          },
        ],
        transitions: ['אוקיי, בואו נראה', 'ואז זה קרה'],
        closingCTA: `תודה ל-${clientName} על הזמן היקר שלהם!`,
      };
  }
}

function generateMockQuestions(params: {
  episodeType: PodcastEpisodeType;
  clientName: string;
  industry: string;
}): PodcastQuestion[] {
  const { clientName, industry } = params;

  const questionTemplates = [
    {
      text: `איך התחלת ב-${industry} ומה היה הרגע הראשון שידעת שזה בשבילך?`,
      type: 'story' as const,
      labels: ['emotional' as const],
    },
    {
      text: `מה הוא הדבר הגדול ביותר ששינה בך או בחברה שלך בשלוש השנים האחרונות?`,
      type: 'authority' as const,
      labels: [],
    },
    {
      text: `אם היית יכול להחזיר זמן ולתת עצה לעצמך בהתחלה, מה היית אומר?`,
      type: 'story' as const,
      labels: ['emotional' as const],
    },
    {
      text: `מה האמת שלא מעט אנשים יודעים בתוך ה-${industry}?`,
      type: 'hook' as const,
      labels: ['viral' as const],
    },
    {
      text: `איך אתה מחליט בין הרבה אפשרויות כשכל אחד אומר משהו שונה?`,
      type: 'authority' as const,
      labels: [],
    },
    {
      text: `סיפור לי על פעם שהיית טועה לגמרי וגם משהו למדת מזה.`,
      type: 'story' as const,
      labels: ['emotional' as const],
    },
    {
      text: `מה הוא העיקרון הכי חשוב שכל אדם ב-${industry} צריך להבין?`,
      type: 'authority' as const,
      labels: [],
    },
    {
      text: `אם חברה רוצה להצליח כמוך, מה הם לא צריכים לעשות?`,
      type: 'objection' as const,
      labels: ['sales' as const],
    },
    {
      text: `איזה טעות רואה אתה שוב ושוב בעסקים בתחום שלך?`,
      type: 'hook' as const,
      labels: ['viral' as const],
    },
    {
      text: `אם היינו יכולים לעצור אנשים ברחוב ולתלמד אותם דבר אחד, מה זה היה?`,
      type: 'cta' as const,
      labels: [],
    },
    {
      text: `איך אתה משפר את השירות או המוצר שלך כל יום?`,
      type: 'authority' as const,
      labels: [],
    },
    {
      text: `מה הסיבה האמיתית שאנשים צריכים את זה שאתה מציע?`,
      type: 'sales' as const,
      labels: ['sales' as const],
    },
    {
      text: `סיפור לי על הלקוח או הפרויקט שגרם לך את ההכי גרדי להשתנות.`,
      type: 'story' as const,
      labels: ['emotional' as const],
    },
    {
      text: `מה הוא ההנחה שכל מתחיל עושה שמדי פעם יוצאת להיות כושלת?`,
      type: 'hook' as const,
      labels: ['viral' as const],
    },
    {
      text: `אם היית צריך להסביר את העבודה שלך לאדם שאין לו ידע כל לא בנושא?`,
      type: 'educational' as const,
      labels: [],
    },
    {
      text: `מה זה המוצר או השירות שאתה הכי גאה בו ולמה?`,
      type: 'authority' as const,
      labels: [],
    },
    {
      text: `מתי הם יודע שהמהלך של ${clientName} עובד?`,
      type: 'cta' as const,
      labels: ['sales' as const],
    },
    {
      text: `אילו אנשים או קבוצות הם הפרופיל הקלאסי שלך?`,
      type: 'authority' as const,
      labels: [],
    },
    {
      text: `מה הוא כמו חמס או הטעות שאתה רואה כל הזמן?`,
      type: 'objection' as const,
      labels: ['viral' as const],
    },
    {
      text: `אם התחילו מחדש מהיום, מה היית עושה בדרך שונה?`,
      type: 'story' as const,
      labels: ['emotional' as const],
    },
  ];

  return questionTemplates.map((template, i) => ({
    id: `q_${Date.now()}_${i}`,
    text: template.text,
    type: template.type as PodcastQuestionType,
    score: Math.floor(60 + Math.random() * 38),
    labels: template.labels,
    selected: false,
    order: i,
    status: 'pending' as const,
  }));
}

function generateMockClipIdeas(params: {
  questions: PodcastQuestion[];
  clientName: string;
}): PodcastClipIdea[] {
  const { questions, clientName } = params;

  const clipHookTemplates = [
    `"${clientName} אמר משהו שלא היו מצפים לשמוע"`,
    `"הרגע שהכל השתנה עבור ${clientName}"`,
    `"שום אדם לא מדבר על הדבר הזה כשמדובר בתחום"`,
    `"מה הסוד שרוק ${clientName} יודע"`,
    `"הטעות שהרוב עושה"`,
    `"הגדול ביותר שינוי שקרה לי"`,
    `"כשנתנו לשני אדם מקצוע"`,
    `"שינוי שלא היה צפוי"`,
  ];

  const clipCaptions = [
    'זה משנה הכל! 🎯',
    'מי היה יודע?! 🤯',
    'תעקבו עד הסוף 👇',
    'זה חייב להיות באוזניים שלך 🎙️',
    'הרגע הכי טוב של הפרק 💯',
    'זה מה שהם אף פעם לא אמרו בשיעור 📚',
    'שמעתם קודם? 🔥',
    'זה קריטי לדעת 💡',
  ];

  return questions.slice(0, Math.min(5, questions.length)).map((q, i) => ({
    questionId: q.id,
    clipTitle: `קליפ ${i + 1}: ${q.text.substring(0, 40)}...`,
    hookLine:
      clipHookTemplates[i % clipHookTemplates.length] ||
      `"${clientName} חושף משהו חשוב"`,
    captionIdea:
      clipCaptions[i % clipCaptions.length] || 'אתה חייב לשמוע את זה 🎧',
    platformFit: ['reels' as const, 'tiktok' as const, 'youtube_shorts' as const],
  }));
}

// ───────────────────────────────────────────────────────────────────────────
// REAL AI ENGINE (Anthropic API)
// ───────────────────────────────────────────────────────────────────────────

async function generateRealEpisodeStructure(params: {
  episodeType: PodcastEpisodeType;
  goals: PodcastGoal[];
  persona: PodcastGuestPersona;
  clientName: string;
  topics?: string;
  researchContext?: string;
}): Promise<PodcastEpisodeStructure | null> {
  const { episodeType, goals, persona, clientName, topics, researchContext } = params;
  const intent = EPISODE_INTENT[episodeType] || '';
  const goalsHe = goals.map((g) => GOAL_LABELS[g] || g).join(', ');
  const topicsBlock = topics?.trim()
    ? `\n🎯 הנושאים שחשוב למארח לכסות בפרק (בנה את המבנה סביבם — זו ההנחיה המרכזית):\n${topics.trim()}\n`
    : '';
  const researchBlock = researchContext?.trim()
    ? `\n📚 מה שלמדנו על העסק (מחקר לקוח) — השתמש בזה כדי שהמבנה יהיה ספציפי ומבוסס:\n${researchContext.trim()}\n`
    : '';

  const prompt = `בנה מבנה פרק פודקאסט מלא ומקצועי.

האורח / המותג: ${clientName}
סוג הפרק: ${episodeType} — ${intent}
מטרות הפרק: ${goalsHe}
תחום: ${persona.industry || 'לא צוין'}
קהל היעד: ${persona.audience || 'לא צוין'}
טון: ${persona.tone} | סגנון דיבור: ${persona.speakingStyle || 'לא צוין'} | רמת מומחיות: ${persona.expertiseLevel}
${topicsBlock}${researchBlock}
דרישות:
- openingHook: פתיח של 1-2 משפטים שיוצר מתח/סקרנות אמיתיים וספציפיים ל${clientName} ולתחום — לא קלישאה.
- intro: 2-3 משפטים שממסגרים למה הפרק הזה שווה את הזמן של המאזין דווקא עכשיו.
- segments: 4-5 סגמנטים. לכל סגמנט: title חד; description עשיר (2-3 משפטים) שכולל נקודות דיבור קונקרטיות + שאלה מובילה אחת שמייצרת רגע "סאונדבייט"; durationMinutes ריאלי.
- transitions: משפט מעבר חלק לכל סגמנט (אותו מספר כמו הסגמנטים).
- closingCTA: סגירה שמחברת למטרות (${goalsHe}) בלי תחושת מכירה אגרסיבית.

החזר JSON בלבד:
{"openingHook":"...","intro":"...","segments":[{"title":"...","description":"...","durationMinutes":12}],"transitions":["..."],"closingCTA":"..."}`;

  const parsed = await aiJson<any>(prompt, 2800);
  if (!parsed) return null;
  const structure = parsed.structure || parsed;
  if (!structure || !Array.isArray(structure.segments) || structure.segments.length === 0) return null;
  return {
    openingHook: structure.openingHook || '',
    intro: structure.intro || '',
    segments: structure.segments.map((s: any) => ({
      title: s.title || '',
      description: s.description || '',
      durationMinutes: Number(s.durationMinutes) || 10,
    })),
    transitions: Array.isArray(structure.transitions) ? structure.transitions : [],
    closingCTA: structure.closingCTA || '',
  };
}

async function generateRealQuestions(params: {
  episodeType: PodcastEpisodeType;
  goals: PodcastGoal[];
  persona: PodcastGuestPersona;
  clientName: string;
  industry: string;
  topics?: string;
  researchContext?: string;
}): Promise<PodcastQuestion[] | null> {
  const { episodeType, goals, persona, clientName, industry, topics, researchContext } = params;
  const intent = EPISODE_INTENT[episodeType] || '';
  const goalsHe = goals.map((g) => GOAL_LABELS[g] || g).join(', ');
  const topicsBlock = topics?.trim()
    ? `\n🎯 הנושאים שחשוב למארח לכסות בפרק — רוב השאלות חייבות להוביל אל הנושאים האלה:\n${topics.trim()}\n`
    : '';
  const researchBlock = researchContext?.trim()
    ? `\n📚 מה שלמדנו על העסק (מחקר לקוח) — בסס עליו שאלות ספציפיות וחדות:\n${researchContext.trim()}\n`
    : '';

  const prompt = `כתוב 20 שאלות ראיון לפודקאסט ברמה של מראיין מקצועי מעולה.

האורח / המותג: ${clientName}
סוג הפרק: ${episodeType} — ${intent}
מטרות: ${goalsHe}
תחום: ${industry}
קהל היעד: ${persona.audience || 'לא צוין'}
טון: ${persona.tone} | רמת מומחיות: ${persona.expertiseLevel}
${topicsBlock}${researchBlock}
דרישות איכות:
- כל שאלה ספציפית לתחום ${industry} ול${clientName} — לא שאלה גנרית שמתאימה לכל אורח.
- מבנה דרמטי מתקדם: התחלה שבונה קרבה ואמון → צלילה לסיפור ולנקודות מפנה → שאלות סמכות ותובנות → שאלות חדות/ויראליות → סגירה עם קריאה לפעולה.
- שאלות פתוחות שמזמינות סיפור, לא שאלות כן/לא.
- בלי קלישאות ובלי שאלות שטחיות ("ספר לי על עצמך").
- שלב 2-3 שאלות "סאונדבייט" שמייצרות אמירה חדה שאפשר לחתוך לקליפ.
- type: אחד מ-hook|story|authority|objection|cta. labels: עד 2 מתוך viral|emotional|sales (או ריק).
- score (1-100): פוטנציאל האנגייג'מנט/ויראליות האמיתי של השאלה.

החזר JSON בלבד:
{"questions":[{"text":"...","type":"story","score":82,"labels":["emotional"]}]}`;

  const parsed = await aiJson<any>(prompt, 4000);
  if (!parsed) return null;
  const arr: any[] = Array.isArray(parsed) ? parsed : (parsed.questions || []);
  if (!Array.isArray(arr) || arr.length === 0) return null;
  return arr.map((q, i) => ({
    id: `q_${Date.now()}_${i}`,
    text: q.text || '',
    type: (q.type || 'story') as PodcastQuestionType,
    score: Math.min(100, Math.max(1, Number(q.score) || 75)),
    labels: (Array.isArray(q.labels) ? q.labels : []) as PodcastQuestionLabel[],
    selected: false,
    order: i,
    status: 'pending' as const,
  }));
}

async function generateRealClipIdeas(params: {
  questions: PodcastQuestion[];
  clientName: string;
}): Promise<PodcastClipIdea[] | null> {
  const { questions, clientName } = params;
  if (questions.length === 0) return [];

  const questionList = questions.map((q) => `[${q.id}] ${q.text}`).join('\n');

  const prompt = `אתה עורך קליפים קצרים לרשתות (Reels/TikTok/Shorts) ברמה מקצועית.
בחר את 6-8 השאלות עם פוטנציאל הקליפ הגבוה ביותר וצור עבורן רעיון קליפ.

שם המותג: ${clientName}
שאלות (השתמש ב-id המדויק):
${questionList}

לכל קליפ:
- clipTitle: כותרת עבודה קצרה וברורה.
- hookLine: 3-6 שניות ראשונות שעוצרות גלילה — אמירה חדה/מסקרנת ספציפית, בלי קלישאות ("הסוד ש...", "לא תאמינו").
- captionIdea: כיתוב לרשת, משפט-שניים + 1-2 אימוג׳י + קריאה לפעולה קצרה.
- platformFit: 2-3 מתוך reels|tiktok|youtube_shorts לפי אופי הקליפ.

החזר JSON בלבד:
{"clips":[{"questionId":"...","clipTitle":"...","hookLine":"...","captionIdea":"...","platformFit":["reels","tiktok"]}]}`;

  const parsed = await aiJson<any>(prompt, 3000);
  if (!parsed) return null;
  const arr: any[] = Array.isArray(parsed) ? parsed : (parsed.clips || []);
  if (!Array.isArray(arr) || arr.length === 0) return null;
  return arr.map((clip) => ({
    questionId: clip.questionId || '',
    clipTitle: clip.clipTitle || '',
    hookLine: clip.hookLine || '',
    captionIdea: clip.captionIdea || '',
    platformFit: Array.isArray(clip.platformFit) && clip.platformFit.length ? clip.platformFit : ['reels'],
  }));
}

// ───────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ───────────────────────────────────────────────────────────────────────────

export async function generateEpisodeStructure(params: {
  episodeType: PodcastEpisodeType;
  goals: PodcastGoal[];
  persona: PodcastGuestPersona;
  clientName: string;
  useRealAI: boolean;
  topics?: string;
  researchContext?: string;
}): Promise<PodcastEpisodeStructure> {
  const { useRealAI } = params;

  if (useRealAI) {
    const result = await generateRealEpisodeStructure(params);
    if (result) return result;
  }

  // Fall back to mock
  return generateMockEpisodeStructure(params);
}

export async function generateQuestions(params: {
  episodeType: PodcastEpisodeType;
  goals: PodcastGoal[];
  persona: PodcastGuestPersona;
  clientName: string;
  industry: string;
  useRealAI: boolean;
  topics?: string;
  researchContext?: string;
}): Promise<PodcastQuestion[]> {
  const { useRealAI, clientName, industry } = params;

  if (useRealAI) {
    const result = await generateRealQuestions(params);
    if (result) return result;
  }

  // Fall back to mock
  return generateMockQuestions({
    episodeType: params.episodeType,
    clientName,
    industry,
  });
}

export async function generateClipIdeas(params: {
  questions: PodcastQuestion[];
  episodeType: PodcastEpisodeType;
  clientName: string;
  useRealAI: boolean;
}): Promise<PodcastClipIdea[]> {
  const { useRealAI, questions, clientName } = params;

  if (useRealAI) {
    const result = await generateRealClipIdeas({ questions, clientName });
    if (result) return result;
  }

  // Fall back to mock
  return generateMockClipIdeas({
    questions,
    clientName,
  });
}
