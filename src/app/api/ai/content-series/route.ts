import { NextRequest, NextResponse } from 'next/server';
import { getApiKeys } from '@/lib/db/api-keys';

interface ContentSeriesRequest {
  clientId: string;
  businessType: string;
  targetAudience: string;
  goals: string[];
  seriesCount: number;
  episodesPerSeries: number;
  platforms: string[];
}

interface Episode {
  episodeNumber: number;
  title: string;
  hook: string;
  contentIdea: string;
  visualConcept: string;
  cta: string;
  platform: string;
  format: string;
}

interface Series {
  id: string;
  name: string;
  theme: string;
  type: 'educational' | 'storytelling' | 'problem_solution' | 'behind_scenes' | 'authority';
  progressionLogic: string;
  episodes: Episode[];
}

interface ContentSeriesResponse {
  series: Series[];
  debug: Record<string, any>;
}

const SERIES_TEMPLATES = {
  educational: {
    theme: 'למד ממני',
    progressionLogic: 'כל פרק בונה על הקודם - מבסיס לתקדם',
    episodes: [
      { number: 1, title: 'היסודות', format: 'Carousel' },
      { number: 2, title: 'צעד הבא', format: 'Reel' },
      { number: 3, title: 'טריקים מתקדמים', format: 'Reel' },
      { number: 4, title: 'טעויות נפוצות', format: 'Post' },
      { number: 5, title: 'סיכום וטיפים', format: 'Carousel' },
    ],
  },
  storytelling: {
    theme: 'סיפורי הלקוח שלי',
    progressionLogic: 'כל פרק חולק חלק מהסיפור - בנייה דרמטית',
    episodes: [
      { number: 1, title: 'ההתחלה', format: 'Reel' },
      { number: 2, title: 'האתגר', format: 'Reel' },
      { number: 3, title: 'הפתרון', format: 'Video' },
      { number: 4, title: 'התוצאות', format: 'Carousel' },
      { number: 5, title: 'ההפתעה', format: 'Reel' },
    ],
  },
  problem_solution: {
    theme: 'בעיה → פתרון',
    progressionLogic: 'כל פרק מציג בעיה אחרת ופתרון מעשי',
    episodes: [
      { number: 1, title: 'הבעיה המשותפת', format: 'Post' },
      { number: 2, title: 'למה זה קורה', format: 'Carousel' },
      { number: 3, title: 'הפתרון הראשון', format: 'Reel' },
      { number: 4, title: 'הפתרון השני', format: 'Reel' },
      { number: 5, title: 'איך להתחיל', format: 'Post' },
    ],
  },
  behind_scenes: {
    theme: 'מאחורי הקלעים',
    progressionLogic: 'כל יום / שלב בתהליך העבודה',
    episodes: [
      { number: 1, title: 'בוקר עבודה', format: 'Stories' },
      { number: 2, title: 'התהליך בפועל', format: 'Reel' },
      { number: 3, title: 'האנשים שלנו', format: 'Carousel' },
      { number: 4, title: 'הטול בעבודה', format: 'Reel' },
      { number: 5, title: 'התוצר הסופי', format: 'Post' },
    ],
  },
  authority: {
    theme: 'אני הבחור בתחום',
    progressionLogic: 'כל פרק מציג מומחיות בזווית שונה',
    episodes: [
      { number: 1, title: 'האמת שלא אומרים', format: 'Post' },
      { number: 2, title: 'הטעות הגדולה', format: 'Reel' },
      { number: 3, title: 'הטרנד הבא בתחום', format: 'Carousel' },
      { number: 4, title: 'הסוד שלי', format: 'Video' },
      { number: 5, title: 'איך עשיתי את זה', format: 'Carousel' },
    ],
  },
};

async function callOpenAI(
  apiKey: string,
  prompt: string,
  fallbackContent: string
): Promise<string> {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4-turbo',
        messages: [
          {
            role: 'system',
            content: `You are an elite Israeli social media content strategist specializing in paid and organic content across Meta, TikTok, LinkedIn, and Google. Always respond in Hebrew.
Generate creative, engaging multi-episode content series that build on each other — designed to work both as organic posts AND as paid ad creative.

כללי מבנה כיתוב (caption) לכל פרק:
- שורה 1: Hook — משפט פתיחה חד שעומד לבד לפני חיתוך "עוד" (שאלה/הצהרה נועזת/מספר/ניגוד)
- שורות 2-4: גוף — הקשר, סיפור, ערך או תובנה
- שורה 5: CTA — קריאה לפעולה ברורה (← קישור בביו / שלחו "מעוניין" בוואטסאפ / תייגו חבר)
- שורה אחרונה: 5-10 האשטגים — מיקס עברית ואנגלית (#שיווק_דיגיטלי #marketing)

סגנונות hook: שאלה ("האם אתם עושים את הטעות הזו?"), הצהרה ("99% מהעסקים לא יודעים את זה"), מספר ("5 סיבות למה..."), ניגוד ("כולם אומרים X אבל האמת היא Y"), סיפור ("לפני שנה קרה משהו שהפך הכל...").

פורמטים מומלצים: Reels (15-60 שניות, 3 שניות ראשונות קריטיות), Carousel (5-10 שקפים, אחרון = CTA), Story (סקרים, שאלות, קישורים).

Paid Ads Creative Adaptation (חשוב!):
- TikTok Ads: Hook בפריים הראשון עם טקסט על המסך. 15-30 שניות לתשלום. וידאו אנכי 9:16 בלבד. אודיו עברית מקורי (לא מוזיקה אנגלית).
- Meta Paid: Lead Gen — "מחפשים [X]? ✅ יתרון 1 ✅ יתרון 2 — השאירו פרטים". Retargeting — "עוד לא החלטתם?" + הצעה.
- LinkedIn B2B: טון מקצועי. עברית לתעשיות מסורתיות (משפט, פיננסים). אנגלית/דו-לשוני לטק. Lead Gen Forms עם ערך מיידי.
- RTL חובה: לוגו בצד ימין. טקסט RTL. מספרים נבדקים (מוצגים LTR בתוך RTL).

רגולציה ישראלית:
- מחיר תמיד כולל מע"מ
- תוכן ממומן = חובת גילוי "#פרסום"
- אין הבטחות שווא או טיימרים מזויפים`,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.85,
        max_tokens: 2500,
      }),
    });

    if (!response.ok) {
      console.error(`[content-series] OpenAI API error: ${response.status}`);
      return fallbackContent;
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || fallbackContent;
  } catch (error) {
    console.error('[content-series] OpenAI call failed:', error);
    return fallbackContent;
  }
}

function generateFallbackSeries(
  seriesCount: number,
  episodesPerSeries: number,
  businessType: string,
  platforms: string[]
): Series[] {
  const series: Series[] = [];
  const types: Array<'educational' | 'storytelling' | 'problem_solution' | 'behind_scenes' | 'authority'> = [
    'educational',
    'storytelling',
    'problem_solution',
    'behind_scenes',
    'authority',
  ];

  for (let s = 1; s <= Math.min(seriesCount, 3); s++) {
    const seriesType = types[s - 1];
    const template = SERIES_TEMPLATES[seriesType];
    const platform = platforms[0] || 'instagram';

    const episodes: Episode[] = [];
    for (let e = 1; e <= Math.min(episodesPerSeries, 5); e++) {
      const templateEpisode = template.episodes[e - 1];
      episodes.push({
        episodeNumber: e,
        title: templateEpisode?.title || `פרק ${e}`,
        hook: `קחו את תשומת לבכם לפרק ${e}`,
        contentIdea: `רעיון תוכן בעברית לפרק ${e} בסדרה`,
        visualConcept: `קונספט חזותי ספציפי לפרק ${e} - תצלום, אנימציה, וטקסט עברי גדול וברור`,
        cta: e === episodesPerSeries ? 'צרו איתי קשר לעוד עצות' : `הישאר מעודכן לפרק ${e + 1}`,
        platform,
        format: templateEpisode?.format || 'Reel',
      });
    }

    series.push({
      id: `series-${s}`,
      name: `סדרה ${s}: ${template.theme}`,
      theme: template.theme,
      type: seriesType,
      progressionLogic: template.progressionLogic,
      episodes,
    });
  }

  return series;
}

export async function POST(req: NextRequest) {
  try {
    const body: ContentSeriesRequest = await req.json();
    const {
      clientId,
      businessType,
      targetAudience,
      goals,
      seriesCount,
      episodesPerSeries,
      platforms,
    } = body;

    console.log(
      `[content-series] Received request for client=${clientId}, type=${businessType}, series=${seriesCount}`
    );

    // Validate inputs
    if (
      !clientId ||
      !businessType ||
      seriesCount < 1 ||
      seriesCount > 5 ||
      episodesPerSeries < 5 ||
      episodesPerSeries > 10
    ) {
      return NextResponse.json(
        { error: 'Invalid request parameters' },
        { status: 400 }
      );
    }

    const apiKeys = getApiKeys();

    // Generate fallback series first
    const fallbackSeries = generateFallbackSeries(
      seriesCount,
      episodesPerSeries,
      businessType,
      platforms
    );

    let generatedSeries = fallbackSeries;
    let usedAI = false;

    // Try to use OpenAI if available
    if (apiKeys.openai) {
      console.log('[content-series] OpenAI key available, generating with AI');
      usedAI = true;

      const prompt = `
בעברית בלבד:

צריך להכין ${seriesCount} סדרות תוכן עם ${episodesPerSeries} פרקים כל אחת.

פרטי הלקוח:
- סוג עסק: ${businessType}
- קהל יעד: ${targetAudience}
- יעדים: ${goals.join(', ')}
- פלטפורמות: ${platforms.join(', ')}

דרישות:
1. כל סדרה חייבת להיות מסוג שונה מהאחרות: educational, storytelling, problem_solution, behind_scenes, או authority
2. כל פרק בונה על הקודם - לא יכול להיות מבודד
3. כל פרק צריך: hook, contentIdea, visualConcept ספציפי, cta וformat
4. לוג התקדמות בין פרקים ברור

צור JSON עם המבנה הזה:
{
  "series": [
    {
      "id": "series-1",
      "name": "שם הסדרה",
      "theme": "הנושא הכללי",
      "type": "educational|storytelling|problem_solution|behind_scenes|authority",
      "progressionLogic": "כיצד הפרקים מתקשרים",
      "episodes": [
        {
          "episodeNumber": 1,
          "title": "שם פרק",
          "hook": "משהו תופס עין",
          "contentIdea": "רעיון התוכן המדויק",
          "visualConcept": "תיאור מדויק של האנימציה/תצלום - לא גנרי",
          "cta": "קריאה לפעולה",
          "platform": "instagram|facebook|tiktok",
          "format": "Reel|Post|Carousel|Stories|Video"
        }
      ]
    }
  ]
}

חשוב: Visual concepts צריכים להיות ממש ספציפיים - צבעים, אלמנטים, אנימציות, לא רק "תמונה יפה".
`;

      const aiResponse = await callOpenAI(
        apiKeys.openai,
        prompt,
        JSON.stringify({ series: fallbackSeries })
      );

      try {
        const parsed = JSON.parse(aiResponse);
        if (Array.isArray(parsed.series) && parsed.series.length > 0) {
          generatedSeries = parsed.series.slice(0, seriesCount);
          console.log('[content-series] Successfully parsed AI response');
        }
      } catch (parseError) {
        console.error('[content-series] Failed to parse AI response:', parseError);
        // Use fallback
      }
    } else {
      console.log('[content-series] No OpenAI key, using fallback series');
    }

    const response: ContentSeriesResponse = {
      series: generatedSeries,
      debug: {
        clientId,
        businessType,
        targetAudience,
        goalsCount: goals.length,
        seriesCount: generatedSeries.length,
        episodesPerSeries,
        platforms,
        usedAI,
      },
    };

    console.log(
      `[content-series] Returning ${generatedSeries.length} series with ${episodesPerSeries} episodes each`
    );

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('[content-series] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
