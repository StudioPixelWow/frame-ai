import { NextRequest, NextResponse } from 'next/server';
import { getApiKeys } from '@/lib/db/api-keys';

interface Competitor {
  name: string;
  instagramUrl?: string;
  facebookUrl?: string;
  websiteUrl?: string;
}

interface CompetitorAnalysisRequest {
  clientId: string;
  businessType: string;
  competitors: Competitor[];
}

interface CompetitorAnalysis {
  name: string;
  analysis: {
    contentTypes: string[];
    engagementPatterns: string;
    tone: string;
    strengths: string[];
    weaknesses: string[];
  };
}

interface ContentRecommendation {
  idea: string;
  hook: string;
  visualConcept: string;
  reason: string;
  competitorGap: string;
}

interface CompetitorAnalysisResponse {
  competitors: CompetitorAnalysis[];
  insights: {
    doMoreOf: string[];
    avoid: string[];
    opportunities: string[];
  };
  contentRecommendations: ContentRecommendation[];
  debug: Record<string, any>;
}

const INDUSTRY_PATTERNS = {
  'ecommerce': {
    contentTypes: [
      'תצוגת מוצרים',
      'טסטימוניאלים',
      'Before/After',
      'טיפים קריאיים',
      'Unboxing',
      'סטוריז אישיים',
    ],
    weaknesses: [
      'תוכן לא עקבי',
      'אין אינטראקציה עם הקהל',
      'תמונות באיכות נמוכה',
      'אין CTAs ברורים',
      'פוסטים ישנים',
    ],
    opportunities: [
      'שירות ללקוח טוב',
      'זמן דליווה מהיר',
      'חידוש עיצוב',
      'תוכן UGC (User Generated)',
      'קידום בקבוצות של פייסבוק',
    ],
  },
  'services': {
    contentTypes: [
      'מאחורי הקלעים',
      'סיפור לקוחות',
      'עדויות בתמונה',
      'טיפים מעשיים',
      'סרטוני חינוך',
      'שאלות נפוצות',
    ],
    weaknesses: [
      'תוכן קשה להבנה',
      'אין וידיאו',
      'אין הוכחה סוציאלית',
      'עדכון נדיר',
      'אין מעורבות בתגובות',
    ],
    opportunities: [
      'סרטוני הדרכה קצרים',
      'תעודות וסמיכויות',
      'Webinars או לייב סשנים',
      'מאז"ר מעוקורים יותר',
      'partnership עם influencers מקומיים',
    ],
  },
  'marketing': {
    contentTypes: [
      'טיפים בתחום',
      'קייס סטאדי',
      'אנליזות',
      'וידיאוים קצרים',
      'בלוג פוסטים',
      'ווביחרים',
    ],
    weaknesses: [
      'תוכן גנרי',
      'אין פילה בתחום',
      'אין דוגמאות ממשיות',
      'שפה קשה',
      'קונטן טו מוך',
    ],
    opportunities: [
      'מקרי הצלחה מפורטים',
      'תרגומים לעברית',
      'וידיאו טוסטוריאלים',
      'קהילה ברא',
      'תוכן טקטי וישימים',
    ],
  },
  'default': {
    contentTypes: [
      'תוכן חינוכי',
      'סטוריז אישיים',
      'טיפים',
      'עדויות',
      'וידיאו',
      'Carousel posts',
    ],
    weaknesses: [
      'עדכון נדיר',
      'אין ווידיאו',
      'תוכן סטאטי',
      'אין ממברשיפ',
      'אין CTAs',
    ],
    opportunities: [
      'תוכן וידיאו',
      'דיאלוג עם הקהל',
      'תרגומים לעברית',
      'שיתופי פעולה',
      'קמפייני מודעות',
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
            content: 'You are a Hebrew marketing analyst. Analyze competitor strategies and provide Hebrew insights. Focus on practical gaps and opportunities. Base analysis on industry patterns and business type, not actual scraping.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.8,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      console.error(`[competitor-analysis] OpenAI API error: ${response.status}`);
      return fallbackContent;
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || fallbackContent;
  } catch (error) {
    console.error('[competitor-analysis] OpenAI call failed:', error);
    return fallbackContent;
  }
}

function generateFallbackAnalysis(
  competitors: Competitor[],
  businessType: string
): CompetitorAnalysisResponse {
  const patterns = INDUSTRY_PATTERNS[businessType.toLowerCase()] || INDUSTRY_PATTERNS['default'];

  const competitorAnalyses: CompetitorAnalysis[] = (competitors || []).map((comp) => ({
    name: comp?.name ?? '(ללא שם)',
    analysis: {
      contentTypes: patterns.contentTypes,
      engagementPatterns: 'עדכונים שבועיים, עם תגובות ספורדיות',
      tone: 'פרופשיונלי עם מגע אישי קל',
      strengths: [
        'קונטן עקבי',
        'עיצוב נקי',
        'שימוש בתמונות איכותיות',
      ],
      weaknesses: patterns.weaknesses,
    },
  }));

  const opportunities: string[] = patterns.opportunities;
  const doMoreOf = [
    'וידיאו Reels (עדיין מתעוררים)',
    'Carousel posts (engagement גבוה)',
    'סטוריז עם שאלות וסקרים',
    'תוכן UGC מלקוחות',
  ];
  const avoid = [
    'עדכונים נדירים',
    'תמונות בטוב רע',
    'ספאם יתר',
    'ביקורות שליליות ללא מענה',
  ];

  const contentRecommendations: ContentRecommendation[] = [
    {
      idea: 'סדרת "טיפ של היום"',
      hook: 'קחו את תשומת לבכם - טיפ שיחסוך לכם זמן',
      visualConcept: 'טקסט גדול בצבע בולט על רקע גרדיאנט, איקונוגרפיה קטנה, לוגו במינימום',
      reason: 'חודש וחצי - עדכוני דיילי שומרים על engagement',
      competitorGap: 'המתחרים שלכם לא עדכנים יומיומי',
    },
    {
      idea: 'וידיאוי "בעד דקה"',
      hook: 'כל מה שצריך לדעת על [נושא] בדקה',
      visualConcept: 'וידיאו מהיר עם כתוביות בעברית גדולה, מוסיקה זהה חזקה, פלאשים וטרנזישנים מזוריזים',
      reason: 'וידיאו קצר עובד טוב בכל גיל',
      competitorGap: 'למתחרים אין וידיאו, או הם ארוכים יותר מדי',
    },
    {
      idea: 'Carousel של "קודם vs. אחרי"',
      hook: 'אם בחרת את זה בתחילה, אתה יודע למה מדברים',
      visualConcept: 'שתי תמונות זו לצד זו עם חץ, טקסט בעברית קטע לכל אחת, bg פשוט',
      reason: 'Carousels מקבלים יותר saves ושיירים',
      competitorGap: 'מתחרים משתמשים בפוסטים סטטיים בלבד',
    },
  ];

  return {
    competitors: competitorAnalyses,
    insights: {
      doMoreOf,
      avoid,
      opportunities,
    },
    contentRecommendations,
    debug: {
      method: 'fallback',
      competitorsCount: (competitors || []).length,
      businessType,
    },
  };
}

export async function POST(req: NextRequest) {
  try {
    let body: Partial<CompetitorAnalysisRequest> = {};
    try {
      body = (await req.json()) as Partial<CompetitorAnalysisRequest>;
    } catch {
      console.warn('[competitor-analysis] Invalid or empty JSON body');
    }

    const clientId = body?.clientId;
    const businessType = body?.businessType;
    const competitors: Competitor[] = Array.isArray(body?.competitors)
      ? (body!.competitors as Competitor[])
      : [];

    console.log(
      `[competitor-analysis] Received request for client=${clientId ?? '(missing)'}, type=${businessType ?? '(missing)'}, competitors=${(competitors || []).length}`
    );

    // Validate inputs — log exactly which fields are missing for debugging
    const missing: string[] = [];
    if (!clientId) missing.push('clientId');
    if (!businessType) missing.push('businessType');
    if (!Array.isArray(body?.competitors)) missing.push('competitors (not array)');
    else if (competitors.length === 0) missing.push('competitors (empty)');

    if (missing.length > 0) {
      console.warn(`[competitor-analysis] Missing fields: ${missing.join(', ')}`);
      return NextResponse.json(
        { error: 'Invalid request parameters', missing },
        { status: 400 }
      );
    }

    if (competitors.length > 10) {
      return NextResponse.json(
        { error: 'Maximum 10 competitors allowed' },
        { status: 400 }
      );
    }

    const apiKeys = getApiKeys();

    // Generate fallback analysis first
    const fallbackAnalysis = generateFallbackAnalysis(competitors, businessType);

    let response: CompetitorAnalysisResponse = fallbackAnalysis;
    let usedAI = false;

    // Try to use OpenAI if available
    if (apiKeys.openai) {
      console.log('[competitor-analysis] OpenAI key available, generating with AI');
      usedAI = true;

      const prompt = `
בעברית בלבד:

אנא עשו ניתוח תחרות עבור ${(competitors || []).length} מתחרים.

סוג העסק שלנו: ${businessType}

מתחרים:
${(competitors || []).map(c => `- ${c?.name ?? '(ללא שם)'} (Instagram: ${c?.instagramUrl || 'N/A'}, Facebook: ${c?.facebookUrl || 'N/A'}, Website: ${c?.websiteUrl || 'N/A'})`).join('\n')}

הערה חשובה: אנחנו לא יכולים לגשת לאתרים בעצמנו. אנא בנו ניתוח על:
1. תבניות תעשיה אופיניות לסוג עסק זה
2. שגיאות נפוצות שמתחרים עושים
3. הזדמנויות בהתחום הזה בישראל

עבור כל מתחרה:
- סוגי תוכן שבדרך כלל עסקים כמו שלהם משתמשים
- דפוסי engagement טיפיים
- טון קול סטנדרטי
- חוזקות אופייניות
- חולשות נפוצות

ספק JSON:
{
  "competitors": [
    {
      "name": "שם",
      "analysis": {
        "contentTypes": ["סוג1", "סוג2"],
        "engagementPatterns": "תיאור",
        "tone": "תיאור",
        "strengths": ["כוח1"],
        "weaknesses": ["חולשה1"]
      }
    }
  ],
  "insights": {
    "doMoreOf": ["פעולה1"],
    "avoid": ["דבר1"],
    "opportunities": ["הזדמנות1"]
  },
  "contentRecommendations": [
    {
      "idea": "רעיון קונטן",
      "hook": "hook תופס",
      "visualConcept": "קונספט מדויק",
      "reason": "למה זה טוב",
      "competitorGap": "איך זה עוזר לנו"
    }
  ]
}
`;

      const aiResponse = await callOpenAI(
        apiKeys.openai,
        prompt,
        JSON.stringify(fallbackAnalysis)
      );

      try {
        const parsed = JSON.parse(aiResponse);
        if (
          Array.isArray(parsed.competitors) &&
          parsed.insights &&
          Array.isArray(parsed.contentRecommendations)
        ) {
          response = parsed;
          console.log('[competitor-analysis] Successfully parsed AI response');
        }
      } catch (parseError) {
        console.error('[competitor-analysis] Failed to parse AI response:', parseError);
        // Use fallback
      }
    } else {
      console.log('[competitor-analysis] No OpenAI key, using fallback analysis');
    }

    // Normalize response shape so downstream consumers never see undefined arrays
    response.competitors = Array.isArray(response.competitors) ? response.competitors : [];
    response.contentRecommendations = Array.isArray(response.contentRecommendations)
      ? response.contentRecommendations
      : [];
    response.insights = response.insights || { doMoreOf: [], avoid: [], opportunities: [] };
    response.insights.doMoreOf = Array.isArray(response.insights.doMoreOf) ? response.insights.doMoreOf : [];
    response.insights.avoid = Array.isArray(response.insights.avoid) ? response.insights.avoid : [];
    response.insights.opportunities = Array.isArray(response.insights.opportunities) ? response.insights.opportunities : [];

    // Add debug info
    response.debug = {
      ...response.debug,
      clientId,
      businessType,
      competitorsAnalyzed: (competitors || []).length,
      usedAI,
      timestamp: new Date().toISOString(),
    };

    console.log(
      `[competitor-analysis] Returning analysis for ${(competitors || []).length} competitors with ${(response.contentRecommendations || []).length} recommendations`
    );

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('[competitor-analysis] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
