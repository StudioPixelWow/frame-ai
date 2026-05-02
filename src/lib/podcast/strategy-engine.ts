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

import Anthropic from '@anthropic-ai/sdk';

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
    type: template.type,
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

async function callAnthropicAPI(prompt: string): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    console.warn(
      'ANTHROPIC_API_KEY not set, falling back to mock generation'
    );
    return null;
  }

  try {
    const client = new Anthropic({ apiKey });

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    if (message.content[0]?.type === 'text') {
      return message.content[0].text;
    }

    return null;
  } catch (error) {
    console.error('Anthropic API call failed:', error);
    return null;
  }
}

async function generateRealEpisodeStructure(params: {
  episodeType: PodcastEpisodeType;
  goals: PodcastGoal[];
  persona: PodcastGuestPersona;
  clientName: string;
}): Promise<PodcastEpisodeStructure | null> {
  const { episodeType, goals, persona, clientName } = params;

  const prompt = `אתה מומחה בהפקת פודקאסטים וב-storytelling. צור מבנה אפיזודה פודקאסט בעברית עבור סוג אפיזודה "${episodeType}".

נתונים:
- שם הלקוח: ${clientName}
- יעדים: ${goals.join(', ')}
- טון הדברים: ${persona.tone}
- רמת ידע: ${persona.expertiseLevel}

הנא להחזיר JSON בדיוק בפורמט הזה (בעברית):
{
  "openingHook": "שורת פתיחה תופסת",
  "intro": "הקדמה של 2-3 משפטים",
  "segments": [
    {"title": "שם הסגמנט", "description": "תיאור קצר", "durationMinutes": 12}
  ],
  "transitions": ["מעבר 1", "מעבר 2"],
  "closingCTA": "קריאה לפעולה בסיום"
}`;

  const response = await callAnthropicAPI(prompt);
  if (!response) return null;

  try {
    // Extract JSON from response (in case there's extra text)
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      openingHook: parsed.openingHook || '',
      intro: parsed.intro || '',
      segments: parsed.segments || [],
      transitions: parsed.transitions || [],
      closingCTA: parsed.closingCTA || '',
    };
  } catch {
    return null;
  }
}

async function generateRealQuestions(params: {
  episodeType: PodcastEpisodeType;
  goals: PodcastGoal[];
  persona: PodcastGuestPersona;
  clientName: string;
  industry: string;
}): Promise<PodcastQuestion[] | null> {
  const { episodeType, goals, persona, clientName, industry } = params;

  const prompt = `אתה מומחה בהפקת פודקאסטים וב-crafting שאלות. צור 20 שאלות עבור פודקאסט בעברית.

נתונים:
- שם הלקוח: ${clientName}
- סוג אפיזודה: ${episodeType}
- יעדים: ${goals.join(', ')}
- תחום: ${industry}
- טון הדברים: ${persona.tone}

הנא להחזיר JSON בדיוק בפורמט הזה (מערך של 20 שאלות):
[
  {
    "text": "השאלה בעברית",
    "type": "hook|story|authority|objection|cta",
    "score": 75,
    "labels": ["viral|emotional|sales"]
  }
]

חשוב:
- כל שאלה חייבת להיות בעברית
- score בין 60 ל-100
- labels יכול להיות מערך ריק או עם עד 2 label
- צור שאלות מגוונות וחדשות
- הקפד על הרלוונטיות ל-${clientName} וה-${industry}`;

  const response = await callAnthropicAPI(prompt);
  if (!response) return null;

  try {
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return null;

    const parsed: any[] = JSON.parse(jsonMatch[0]);
    return parsed.map((q, i) => ({
      id: `q_${Date.now()}_${i}`,
      text: q.text || '',
      type: (q.type || 'story') as PodcastQuestionType,
      score: Math.min(100, Math.max(1, q.score || 75)),
      labels: (q.labels || []) as PodcastQuestionLabel[],
      selected: false,
      order: i,
      status: 'pending' as const,
    }));
  } catch {
    return null;
  }
}

async function generateRealClipIdeas(params: {
  questions: PodcastQuestion[];
  clientName: string;
}): Promise<PodcastClipIdea[] | null> {
  const { questions, clientName } = params;

  if (questions.length === 0) return [];

  const questionTexts = questions.map((q) => `- ${q.text}`).join('\n');

  const prompt = `אתה מומחה בקליפים לרשתות חברתיות ובעברית. צור קליפ ideas עבור שאלות פודקאסט.

שאלות:
${questionTexts}

שם הלקוח: ${clientName}

הנא להחזיר JSON בדיוק בפורמט הזה (קליפ עבור כל שאלה):
[
  {
    "questionId": "q_number",
    "clipTitle": "כותרת הקליפ",
    "hookLine": "שורת ווירוס/תופסת בעברית",
    "captionIdea": "טקסט הכיתוביון עם emoji",
    "platformFit": ["reels", "tiktok", "youtube_shorts"]
  }
]

חשוב:
- hookLine צריך להיות אטרקטיבי ובעברית
- captionIdea צריך להיות קצר וכולל emoji
- platformFit - בחר 2-3 פלטפורמות הרלוונטיות
- כל קליפ צריך להיות מחויב לשאלה מסוימת`;

  const response = await callAnthropicAPI(prompt);
  if (!response) return null;

  try {
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return null;

    const parsed: any[] = JSON.parse(jsonMatch[0]);
    return parsed.map((clip) => ({
      questionId: clip.questionId || '',
      clipTitle: clip.clipTitle || '',
      hookLine: clip.hookLine || '',
      captionIdea: clip.captionIdea || '',
      platformFit: clip.platformFit || ['reels'],
    }));
  } catch {
    return null;
  }
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
