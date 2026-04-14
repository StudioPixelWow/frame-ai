import { NextRequest, NextResponse } from 'next/server';
import { getApiKeys } from '@/lib/db/api-keys';
import { getHolidaysForMonth } from '@/lib/israeli-holidays';

interface ClientBrain {
  toneOfVoice?: string;
  keySellingPoints?: string[];
  audienceProfile?: string;
}

interface TrendEngineRequest {
  clientId: string;
  businessType: string;
  businessField: string;
  month: number;
  year: number;
  platforms: string[];
  clientBrain?: ClientBrain;
}

interface ContentIdea {
  hook: string;
  mainMessage: string;
  visualConcept: string;
  platform: string;
  format: string;
}

interface TrendSuggestion {
  trendName: string;
  whyTrending: string;
  relevanceScore: number;
  urgency: 'low' | 'medium' | 'high';
  contentIdea: ContentIdea;
}

interface WeeklyPost {
  title: string;
  hook: string;
  reason: string;
  urgencyScore: number;
}

interface WeeklyRecommendation {
  week: number;
  posts: WeeklyPost[];
}

interface TrendEngineResponse {
  trendSuggestions: TrendSuggestion[];
  weeklyRecommendations: WeeklyRecommendation[];
  debug: Record<string, any>;
}

const HEBREW_TRENDS_FALLBACK = {
  'ecommerce': [
    { trend: 'סטוריז מצחיקים', format: 'סטורי / Reel', message: 'בדיחה שמעורבבת עם מוצר' },
    { trend: 'Before/After', format: 'Reel', message: 'טרנספורמציה או שדרוג' },
    { trend: 'טיפים מעשיים', format: 'Carousel', message: '5 טיפים בנושא הנישה שלכם' },
  ],
  'marketing': [
    { trend: 'וידיאו POV', format: 'Reel', message: '"כשאתה משתמש ב-..."' },
    { trend: 'סיפור מותגי', format: 'Carousel', message: 'היסטוריה של המוצר' },
    { trend: 'עדויות לקוחות', format: 'Reel', message: 'סרטון קצר של לקוח מרוצה' },
  ],
  'services': [
    { trend: 'מאחורי הקלעים', format: 'Reel', message: 'תהליך העבודה שלכם' },
    { trend: 'שאלות נפוצות', format: 'Carousel', message: 'פתרון לבעיה משותפת' },
    { trend: 'טיפול תזה', format: 'Post', message: 'כתבה קצרה בנושא חם' },
  ],
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
            content: 'You are a Hebrew social media marketing expert. Always respond in Hebrew. Provide actionable, specific content ideas for Israeli audiences.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.8,
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      console.error(`[trend-engine] OpenAI API error: ${response.status}`);
      return fallbackContent;
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || fallbackContent;
  } catch (error) {
    console.error('[trend-engine] OpenAI call failed:', error);
    return fallbackContent;
  }
}

function generateFallbackTrends(
  businessType: string,
  month: number,
  holidays: any[]
): TrendSuggestion[] {
  const trends: TrendSuggestion[] = [];
  const safeHolidays = Array.isArray(holidays) ? holidays : [];
  const bt = (businessType || '').toLowerCase();
  const fallbackData = HEBREW_TRENDS_FALLBACK[bt] || HEBREW_TRENDS_FALLBACK['marketing'];

  (fallbackData || []).forEach((item, idx) => {
    trends.push({
      trendName: item.trend,
      whyTrending: `טרנד פופולרי בחודש ${month} - ${item.message}`,
      relevanceScore: 75 - idx * 5,
      urgency: idx === 0 ? 'high' : 'medium',
      contentIdea: {
        hook: `קחו את תשומת לבכם - ${item.trend}`,
        mainMessage: item.message,
        visualConcept: `תצלום מקרוב של המוצר עם אנימציה קטנה, טקסט בעברית גדול וצבעוני, על רקע בהיר`,
        platform: 'instagram',
        format: item.format,
      },
    });
  });

  // Add holiday-based trends
  safeHolidays.forEach((holiday) => {
    const holidayName = holiday?.hebrewName ?? '';
    const ideas = Array.isArray(holiday?.contentIdeas) ? holiday.contentIdeas : [];
    trends.push({
      trendName: `קמפיין ${holidayName}`,
      whyTrending: `חג חשוב בישראל - הזדמנות למכירות`,
      relevanceScore: 85,
      urgency: 'high',
      contentIdea: {
        hook: ideas[0] || `ברוכים הבאים ל${holidayName}`,
        mainMessage: `חגיגה של ${holidayName} - טיפול מיוחד לקהל שלכם`,
        visualConcept: `עיצוב חגיגי בנושא ${holidayName}, צבעים חמים, סמלים קשורים לחג`,
        platform: 'facebook',
        format: 'Reel',
      },
    });
  });

  return trends;
}

function generateWeeklyRecommendations(
  trends: TrendSuggestion[]
): WeeklyRecommendation[] {
  const weeks: WeeklyRecommendation[] = [];
  const safeTrends = Array.isArray(trends) ? trends : [];

  for (let week = 1; week <= 4; week++) {
    const weekTrends = safeTrends.slice((week - 1) * 2, week * 2);
    const posts: WeeklyPost[] = (weekTrends || []).map((trend, idx) => ({
      title: `שבוע ${week} - פוסט ${idx + 1}`,
      hook: trend?.contentIdea?.hook ?? '',
      reason: `${trend?.trendName ?? ''} - רלוונטי לנישה שלכם`,
      urgencyScore: trend?.urgency === 'high' ? 90 : trend?.urgency === 'medium' ? 70 : 50,
    }));

    weeks.push({
      week,
      posts: posts.length > 0 ? posts : [
        {
          title: `שבוע ${week} - פוסט יום שני`,
          hook: 'טיפ מעשי לקהל שלכם',
          reason: 'בנאי בטחון ומעניין',
          urgencyScore: 65,
        },
      ],
    });
  }

  return weeks;
}

export async function POST(req: NextRequest) {
  try {
    let body: Partial<TrendEngineRequest> = {};
    try {
      body = (await req.json()) as Partial<TrendEngineRequest>;
    } catch {
      console.warn('[trend-engine] Invalid or empty JSON body');
    }

    const clientId = body?.clientId;
    const businessType = body?.businessType;
    const businessField = body?.businessField ?? '';
    const month = body?.month;
    const year = body?.year ?? new Date().getFullYear();
    const platforms: string[] = Array.isArray(body?.platforms) ? body!.platforms! : [];
    const clientBrain = body?.clientBrain;

    console.log(
      `[trend-engine] Received request for client=${clientId ?? '(missing)'}, type=${businessType ?? '(missing)'}, month=${month ?? '(missing)'}`
    );

    // Validate required inputs — report each missing field
    const missing: string[] = [];
    if (!clientId) missing.push('clientId');
    if (!businessType) missing.push('businessType');
    if (typeof month !== 'number' || month < 1 || month > 12) missing.push('month (1-12)');

    if (missing.length > 0) {
      console.warn(`[trend-engine] Missing fields: ${missing.join(', ')}`);
      return NextResponse.json(
        { error: 'Missing or invalid required fields', missing },
        { status: 400 }
      );
    }

    // Get API keys and holidays
    const apiKeys = getApiKeys();
    const holidaysRaw = getHolidaysForMonth(month as number);
    const holidays = Array.isArray(holidaysRaw) ? holidaysRaw : [];

    console.log(`[trend-engine] Found ${holidays.length} holidays for month ${month}`);

    // Generate fallback trends
    const fallbackTrends = generateFallbackTrends(businessType as string, month as number, holidays);

    let trends = fallbackTrends;
    let usedAI = false;

    // Try to use OpenAI if available
    if (apiKeys.openai) {
      console.log('[trend-engine] OpenAI key available, generating with AI');
      usedAI = true;

      const prompt = `
בשפה עברית בלבד:

אני צריך להמליץ על ${(platforms || []).length} טרנדים לעסק מסוג "${businessType}" בתחום "${businessField}".
חודש: ${month}/2024-2030, שנה: ${year}
פלטפורמות: ${(platforms || []).join(', ')}

מידע על הלקוח:
${clientBrain?.toneOfVoice ? `- טון קול: ${clientBrain.toneOfVoice}` : ''}
${Array.isArray(clientBrain?.keySellingPoints) && clientBrain!.keySellingPoints!.length > 0 ? `- נקודות מכירה: ${clientBrain!.keySellingPoints!.join(', ')}` : ''}
${clientBrain?.audienceProfile ? `- פרופיל קהל: ${clientBrain.audienceProfile}` : ''}

חגים רלוונטיים לחודש זה:
${(holidays || []).map(h => `- ${h?.hebrewName ?? ''} (${h?.name ?? ''}): ${Array.isArray(h?.contentIdeas) ? h.contentIdeas.join(', ') : ''}`).join('\n') || '- אין חגים בחודש זה'}

אנא תן 5 טרנדים ספציפיים עם:
1. שם הטרנד (בעברית)
2. למה זה טרנדי עכשיו
3. ציון רלוונטיות (0-100)
4. דחיפות (low/medium/high)
5. идея תוכן עם:
   - hook תופס את העין
   - הודעה ראשית
   - קונספט חזותי מדויק (לא גנרי)
   - פלטפורמה מומלצת
   - פורמט (Reel/Post/Carousel/Stories/Video)

עיצוב JSON:
{
  "trends": [
    {
      "trendName": "שם בעברית",
      "whyTrending": "הסבר",
      "relevanceScore": 85,
      "urgency": "high",
      "contentIdea": {
        "hook": "hook",
        "mainMessage": "ההודעה",
        "visualConcept": "תצוגה מדויקת",
        "platform": "instagram",
        "format": "Reel"
      }
    }
  ]
}
`;

      const aiResponse = await callOpenAI(
        apiKeys.openai,
        prompt,
        JSON.stringify({ trends: fallbackTrends })
      );

      try {
        const parsed = JSON.parse(aiResponse);
        if (Array.isArray(parsed?.trends)) {
          // Normalize every trend entry so downstream .length/.map never blow up
          trends = parsed.trends.map((t: any) => ({
            trendName: t?.trendName ?? '',
            whyTrending: t?.whyTrending ?? '',
            relevanceScore: typeof t?.relevanceScore === 'number' ? t.relevanceScore : 50,
            urgency: (t?.urgency === 'high' || t?.urgency === 'low' || t?.urgency === 'medium') ? t.urgency : 'medium',
            contentIdea: {
              hook: t?.contentIdea?.hook ?? '',
              mainMessage: t?.contentIdea?.mainMessage ?? '',
              visualConcept: t?.contentIdea?.visualConcept ?? '',
              platform: t?.contentIdea?.platform ?? 'instagram',
              format: t?.contentIdea?.format ?? 'Post',
            },
          }));
          console.log('[trend-engine] Successfully parsed AI response');
        }
      } catch (parseError) {
        console.error('[trend-engine] Failed to parse AI response:', parseError);
        // Use fallback
      }
    } else {
      console.log('[trend-engine] No OpenAI key, using fallback trends');
    }

    // Generate weekly recommendations
    const safeTrends = Array.isArray(trends) ? trends : [];
    const weeklyRecommendations = generateWeeklyRecommendations(safeTrends);

    const response: TrendEngineResponse = {
      trendSuggestions: safeTrends,
      weeklyRecommendations: Array.isArray(weeklyRecommendations) ? weeklyRecommendations : [],
      debug: {
        clientId,
        businessType,
        businessField,
        month,
        year,
        platforms: platforms || [],
        holidaysCount: (holidays || []).length,
        usedAI,
        trendsCount: safeTrends.length,
      },
    };

    console.log(`[trend-engine] Returning ${safeTrends.length} trends with ${response.weeklyRecommendations.length} weeks`);

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('[trend-engine] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
