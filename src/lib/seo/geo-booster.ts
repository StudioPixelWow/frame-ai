// מנוע GEO Booster — שיפור נראות במנועי חיפוש AI
// AI Visibility Booster (GEO Engine) — improve visibility in AI search engines

import { generateWithAI } from '@/lib/ai/openai-client';

// ============================================================================
// ממשקים — Interfaces
// ============================================================================

export interface GEOStrategy {
  clientId: string;
  domain: string;
  currentVisibility: {
    google_ai_overview: number; // 0-100
    chatgpt: number;
    perplexity: number;
    claude: number;
    gemini: number;
  };
  strategies: Array<{
    type: 'structured_data' | 'citation_building' | 'entity_optimization' | 'authority_content' | 'pr_distribution' | 'directory_listings';
    priority: 'critical' | 'high' | 'medium' | 'low';
    title: string;
    description: string;
    estimatedImpact: string;
    steps: string[];
    status: 'pending' | 'in_progress' | 'completed';
  }>;
  generatedAt: string;
}

export interface AIVisibilityReport {
  domain: string;
  keywords: string[];
  platforms: {
    name: string;
    estimatedVisibility: number;
    mentionLikelihood: 'high' | 'medium' | 'low' | 'none';
    recommendations: string[];
  }[];
  overallScore: number;
  analyzedAt: string;
}

export interface CitationStrategy {
  domain: string;
  niche: string;
  existingCitations: string[];
  recommendedSources: Array<{
    source: string;
    type: 'news' | 'academic' | 'industry' | 'directory' | 'social' | 'forum';
    difficulty: 'easy' | 'medium' | 'hard';
    impact: 'high' | 'medium' | 'low';
    action: string;
  }>;
  contentRecommendations: string[];
  generatedAt: string;
}

export interface MentionTrack {
  domain: string;
  platform: string;
  query: string;
  mentioned: boolean;
  context: string;
  sentiment: 'positive' | 'neutral' | 'negative' | 'unknown';
  checkedAt: string;
}

export interface DirectoryListing {
  name: string;
  url: string;
  category: string;
  authority: number; // 0-100
  listed: boolean;
  priority: 'high' | 'medium' | 'low';
}

// ============================================================================
// ניתוח נראות AI — AI Visibility Analysis
// ============================================================================

export async function analyzeAIVisibility(
  domain: string,
  keywords: string[]
): Promise<{ report: AIVisibilityReport | null; error?: string }> {
  const systemPrompt = `אתה מומחה GEO (Generative Engine Optimization) שמנתח נראות של אתרים במנועי חיפוש AI.
נתח את הסבירות שהדומיין מוזכר על ידי AI בתשובות לשאילתות מפתח.
הערך על בסיס:
- חוזק הדומיין ומוניטין
- איכות התוכן והנתונים המובנים
- אזכורים ברשת ומקורות סמכותיים
- מבנה טכני של האתר

החזר JSON:
{
  "platforms": [
    { "name": "Google AI Overview", "estimatedVisibility": 0-100, "mentionLikelihood": "high|medium|low|none", "recommendations": ["..."] },
    { "name": "ChatGPT", "estimatedVisibility": 0-100, "mentionLikelihood": "...", "recommendations": ["..."] },
    { "name": "Perplexity", "estimatedVisibility": 0-100, "mentionLikelihood": "...", "recommendations": ["..."] },
    { "name": "Claude", "estimatedVisibility": 0-100, "mentionLikelihood": "...", "recommendations": ["..."] },
    { "name": "Gemini", "estimatedVisibility": 0-100, "mentionLikelihood": "...", "recommendations": ["..."] }
  ],
  "overallScore": 0-100
}
כתוב בעברית.`;

  const userPrompt = `דומיין: ${domain}
מילות מפתח: ${keywords.join(', ')}

נתח את הנראות הנוכחית במנועי AI.`;

  try {
    const result = await generateWithAI(systemPrompt, userPrompt, { temperature: 0.4, maxTokens: 2000 });
    if (!result.success || !result.data) {
      return { report: null, error: result.error || 'שגיאה בניתוח נראות AI' };
    }

    const raw = typeof result.data === 'string' ? result.data : JSON.stringify(result.data);
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { report: null, error: 'פורמט לא תקין' };

    const parsed = JSON.parse(jsonMatch[0]);
    const report: AIVisibilityReport = {
      domain,
      keywords,
      platforms: parsed.platforms || [],
      overallScore: parsed.overallScore || 0,
      analyzedAt: new Date().toISOString(),
    };

    return { report };
  } catch (error) {
    return { report: null, error: `שגיאה: ${(error as Error).message}` };
  }
}

// ============================================================================
// אסטרטגיית ציטוטים — Citation Strategy
// ============================================================================

export async function generateCitationStrategy(
  domain: string,
  niche: string
): Promise<{ strategy: CitationStrategy | null; error?: string }> {
  const systemPrompt = `אתה אסטרטג GEO שבונה אסטרטגיות ציטוט למנועי AI.
מנועי AI מצטטים מקורות סמכותיים. בנה אסטרטגיה להשגת ציטוטים.
החזר JSON:
{
  "existingCitations": [],
  "recommendedSources": [
    { "source": "...", "type": "news|academic|industry|directory|social|forum", "difficulty": "easy|medium|hard", "impact": "high|medium|low", "action": "..." }
  ],
  "contentRecommendations": ["..."]
}
הצע 10-15 מקורות. כתוב בעברית.`;

  const userPrompt = `דומיין: ${domain}
נישה: ${niche}

בנה אסטרטגיית ציטוט למנועי AI.`;

  try {
    const result = await generateWithAI(systemPrompt, userPrompt, { temperature: 0.6, maxTokens: 2000 });
    if (!result.success || !result.data) {
      return { strategy: null, error: result.error || 'שגיאה' };
    }

    const raw = typeof result.data === 'string' ? result.data : JSON.stringify(result.data);
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { strategy: null, error: 'פורמט לא תקין' };

    const parsed = JSON.parse(jsonMatch[0]);
    const strategy: CitationStrategy = {
      domain,
      niche,
      existingCitations: parsed.existingCitations || [],
      recommendedSources: parsed.recommendedSources || [],
      contentRecommendations: parsed.contentRecommendations || [],
      generatedAt: new Date().toISOString(),
    };

    return { strategy };
  } catch (error) {
    return { strategy: null, error: `שגיאה: ${(error as Error).message}` };
  }
}

// ============================================================================
// פערי סמכות — Authority Gaps
// ============================================================================

export async function identifyAuthorityGaps(
  domain: string,
  competitors: string[]
): Promise<{ gaps: Array<{ area: string; yourScore: number; competitorAvg: number; action: string }>; error?: string }> {
  const systemPrompt = `אתה מנתח GEO. זהה פערי סמכות בין הדומיין למתחרים.
בדוק: נתונים מובנים, backlinks, אזכורים, תוכן מומחה, E-E-A-T.
החזר JSON:
{
  "gaps": [
    { "area": "...", "yourScore": 0-100, "competitorAvg": 0-100, "action": "..." }
  ]
}
כתוב בעברית.`;

  const userPrompt = `דומיין: ${domain}
מתחרים: ${competitors.join(', ')}

זהה פערי סמכות.`;

  try {
    const result = await generateWithAI(systemPrompt, userPrompt, { temperature: 0.5, maxTokens: 1500 });
    if (!result.success || !result.data) {
      return { gaps: [], error: result.error || 'שגיאה' };
    }

    const raw = typeof result.data === 'string' ? result.data : JSON.stringify(result.data);
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { gaps: [], error: 'פורמט לא תקין' };

    const parsed = JSON.parse(jsonMatch[0]);
    return { gaps: parsed.gaps || [] };
  } catch (error) {
    return { gaps: [], error: `שגיאה: ${(error as Error).message}` };
  }
}

// ============================================================================
// נתונים מובנים — Structured Data for AI
// ============================================================================

export async function generateStructuredData(
  pageContent: string,
  pageType: 'article' | 'product' | 'service' | 'local_business' | 'faq' | 'how_to' | 'review'
): Promise<{ schema: Record<string, unknown>; error?: string }> {
  const systemPrompt = `אתה מומחה Schema Markup ו-GEO. צור נתונים מובנים מתקדמים שמנועי AI יכולים לקרוא בקלות.
סוג הדף: ${pageType}
הנתונים המובנים צריכים לכלול:
- Schema.org markup מלא
- כל השדות הרלוונטיים לסוג הדף
- אותות E-E-A-T (author, publisher, dateModified)
- breadcrumbs אם רלוונטי
החזר JSON-LD בלבד (ללא עטיפת script tag).`;

  const userPrompt = `תוכן הדף (תקציר):
${pageContent.substring(0, 2000)}

צור Schema Markup מתקדם.`;

  try {
    const result = await generateWithAI(systemPrompt, userPrompt, { temperature: 0.3, maxTokens: 1500 });
    if (!result.success || !result.data) {
      return { schema: {}, error: result.error || 'שגיאה' };
    }

    const raw = typeof result.data === 'string' ? result.data : JSON.stringify(result.data);
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { schema: {}, error: 'פורמט לא תקין' };

    const schema = JSON.parse(jsonMatch[0]);
    return { schema };
  } catch (error) {
    return { schema: {}, error: `שגיאה: ${(error as Error).message}` };
  }
}

// ============================================================================
// תוכן Knowledge Panel — Knowledge Panel Content
// ============================================================================

export async function generateKnowledgePanelContent(
  businessName: string,
  data: Record<string, unknown>
): Promise<{ content: Record<string, unknown>; error?: string }> {
  const systemPrompt = `אתה מומחה GEO שיוצר תוכן מותאם ל-Knowledge Panels של Google ומנועי AI.
התוכן צריך:
- להיות עובדתי ומדויק
- לכלול כל המידע שמנוע AI יצפה למצוא
- לכלול ישויות ברורות (entities)
- מובנה בצורה שקלה לניתוח
החזר JSON:
{
  "entityName": "...",
  "entityType": "Organization|Person|Product|Place",
  "description": "תיאור קצר (160 תווים)",
  "longDescription": "תיאור מלא (500 תווים)",
  "facts": { "key": "value" },
  "relatedEntities": ["..."],
  "sources": ["..."]
}
כתוב בעברית.`;

  const userPrompt = `שם העסק: ${businessName}
מידע נוסף: ${JSON.stringify(data)}

צור תוכן Knowledge Panel.`;

  try {
    const result = await generateWithAI(systemPrompt, userPrompt, { temperature: 0.4, maxTokens: 1000 });
    if (!result.success || !result.data) {
      return { content: {}, error: result.error || 'שגיאה' };
    }

    const raw = typeof result.data === 'string' ? result.data : JSON.stringify(result.data);
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { content: {}, error: 'פורמט לא תקין' };

    return { content: JSON.parse(jsonMatch[0]) };
  } catch (error) {
    return { content: {}, error: `שגיאה: ${(error as Error).message}` };
  }
}

// ============================================================================
// אופטימיזציה ל-AI Overview — Optimize for AI Overview
// ============================================================================

export async function optimizeForAIOverview(
  query: string,
  existingContent: string
): Promise<{ optimizedContent: string; changes: string[]; error?: string }> {
  const systemPrompt = `אתה מומחה GEO שמשפר תוכן כדי שייבחר על ידי Google AI Overview.
קריטריונים ל-AI Overview:
- תשובה ישירה לשאילתה ב-2-3 משפטים ראשונים
- מבנה ברור עם כותרות
- מידע עובדתי ומדויק
- נתונים ומספרים
- רשימות ממוספרות/תבליטים
- מקורות אמינים
שפר את התוכן בלי לשנות את המהות.
החזר JSON:
{
  "optimizedContent": "...",
  "changes": ["שינוי 1", "שינוי 2"]
}`;

  const userPrompt = `שאילתה שמטרגטים: "${query}"
תוכן קיים:
${existingContent.substring(0, 3000)}

שפר עבור AI Overview.`;

  try {
    const result = await generateWithAI(systemPrompt, userPrompt, { temperature: 0.5, maxTokens: 3000 });
    if (!result.success || !result.data) {
      return { optimizedContent: '', changes: [], error: result.error || 'שגיאה' };
    }

    const raw = typeof result.data === 'string' ? result.data : JSON.stringify(result.data);
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { optimizedContent: '', changes: [], error: 'פורמט לא תקין' };

    const parsed = JSON.parse(jsonMatch[0]);
    return { optimizedContent: parsed.optimizedContent || '', changes: parsed.changes || [] };
  } catch (error) {
    return { optimizedContent: '', changes: [], error: `שגיאה: ${(error as Error).message}` };
  }
}

// ============================================================================
// קישורי ישויות — Entity Links
// ============================================================================

export async function generateEntityLinks(
  content: string,
  domain: string
): Promise<{ linkedContent: string; entities: Array<{ entity: string; url: string }>; error?: string }> {
  const systemPrompt = `אתה מומחה GEO שמעשיר תוכן בקישורי ישויות (entity links).
מנועי AI מבינים טוב יותר תוכן עם:
- קישורים פנימיים לדפים רלוונטיים
- קישורים לישויות (entities) מוכרות
- קישורי הקשר שמחזקים את הנושא
זהה ישויות בתוכן והצע קישורים פנימיים.
החזר JSON:
{
  "entities": [{ "entity": "שם הישות", "url": "/path-on-site" }],
  "linkedContent": "התוכן עם קישורי HTML"
}`;

  const userPrompt = `דומיין: ${domain}
תוכן:
${content.substring(0, 2000)}

הוסף קישורי ישויות.`;

  try {
    const result = await generateWithAI(systemPrompt, userPrompt, { temperature: 0.4, maxTokens: 3000 });
    if (!result.success || !result.data) {
      return { linkedContent: '', entities: [], error: result.error || 'שגיאה' };
    }

    const raw = typeof result.data === 'string' ? result.data : JSON.stringify(result.data);
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { linkedContent: '', entities: [], error: 'פורמט לא תקין' };

    const parsed = JSON.parse(jsonMatch[0]);
    return { linkedContent: parsed.linkedContent || '', entities: parsed.entities || [] };
  } catch (error) {
    return { linkedContent: '', entities: [], error: `שגיאה: ${(error as Error).message}` };
  }
}

// ============================================================================
// אסטרטגיית אזכורים — Mention Strategy
// ============================================================================

export async function buildMentionStrategy(
  domain: string,
  niche: string
): Promise<{ strategies: Array<{ channel: string; action: string; difficulty: string; timeline: string }>; error?: string }> {
  const systemPrompt = `אתה אסטרטג GEO. בנה אסטרטגיה להשגת אזכורים באתרים סמכותיים.
מנועי AI לומדים מאזכורים באתרי חדשות, בלוגים מקצועיים, ויקיפדיה, פורומים ועוד.
הצע 8-10 ערוצים עם פעולות ספציפיות.
החזר JSON:
{
  "strategies": [
    { "channel": "...", "action": "...", "difficulty": "קל|בינוני|קשה", "timeline": "..." }
  ]
}
כתוב בעברית.`;

  const userPrompt = `דומיין: ${domain}
נישה: ${niche}

בנה אסטרטגיית אזכורים.`;

  try {
    const result = await generateWithAI(systemPrompt, userPrompt, { temperature: 0.6, maxTokens: 1500 });
    if (!result.success || !result.data) {
      return { strategies: [], error: result.error || 'שגיאה' };
    }

    const raw = typeof result.data === 'string' ? result.data : JSON.stringify(result.data);
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { strategies: [], error: 'פורמט לא תקין' };

    const parsed = JSON.parse(jsonMatch[0]);
    return { strategies: parsed.strategies || [] };
  } catch (error) {
    return { strategies: [], error: `שגיאה: ${(error as Error).message}` };
  }
}

// ============================================================================
// תוכן ברמת ויקיפדיה — Wikipedia-Ready Content
// ============================================================================

export async function generateWikipediaReadyContent(
  topic: string,
  sources: string[]
): Promise<{ content: string; meetsCriteria: boolean; gaps: string[]; error?: string }> {
  const systemPrompt = `אתה עורך תוכן שמכיר את סטנדרטי ויקיפדיה.
צור תוכן שעומד בקריטריונים של נוטביליות ויקיפדית:
- נקודת מבט ניטרלית
- מבוסס על מקורות חיצוניים
- מידע עובדתי ומאומת
- סגנון אנציקלופדי
- ללא שיווק או פרסום
הערך אם התוכן עומד בסטנדרטים.
החזר JSON:
{
  "content": "...",
  "meetsCriteria": true/false,
  "gaps": ["מה חסר"]
}
כתוב בעברית.`;

  const userPrompt = `נושא: ${topic}
מקורות זמינים: ${sources.join(', ')}

צור תוכן ברמת ויקיפדיה.`;

  try {
    const result = await generateWithAI(systemPrompt, userPrompt, { temperature: 0.4, maxTokens: 2000 });
    if (!result.success || !result.data) {
      return { content: '', meetsCriteria: false, gaps: [], error: result.error || 'שגיאה' };
    }

    const raw = typeof result.data === 'string' ? result.data : JSON.stringify(result.data);
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { content: '', meetsCriteria: false, gaps: [], error: 'פורמט לא תקין' };

    const parsed = JSON.parse(jsonMatch[0]);
    return { content: parsed.content || '', meetsCriteria: parsed.meetsCriteria || false, gaps: parsed.gaps || [] };
  } catch (error) {
    return { content: '', meetsCriteria: false, gaps: [], error: `שגיאה: ${(error as Error).message}` };
  }
}

// ============================================================================
// מעקב אזכורי AI — Track AI Mentions
// ============================================================================

export async function trackAIMentions(
  domain: string,
  platforms: string[]
): Promise<{ mentions: MentionTrack[]; error?: string }> {
  // Note: Real AI mention tracking requires API access to each platform.
  // This provides a simulated framework — replace with actual API calls when available.
  const mentions: MentionTrack[] = platforms.map(platform => ({
    domain,
    platform,
    query: `מידע על ${domain}`,
    mentioned: false,
    context: '',
    sentiment: 'unknown' as const,
    checkedAt: new Date().toISOString(),
  }));

  return {
    mentions,
    error: 'מעקב אזכורי AI בזמן אמת דורש חיבור API לכל פלטפורמה. תוצאות משוערות בלבד.',
  };
}

// ============================================================================
// הודעה לעיתונות — Press Release
// ============================================================================

export async function generatePressRelease(
  clientId: string,
  businessName: string,
  angle: string,
  facts: Record<string, unknown>
): Promise<{ pressRelease: string; distributionTips: string[]; error?: string }> {
  const systemPrompt = `אתה כותב הודעות לעיתונות מקצועי.
צור הודעה לעיתונות שתתפרסם באתרי חדשות ותיצור אזכורים סמכותיים.
ההודעה צריכה:
- כותרת חדשותית מושכת
- פסקה ראשונה עם כל המידע החשוב (מי, מה, מתי, איפה, למה)
- ציטוט מנציג העסק
- עובדות ונתונים
- פרטי יצירת קשר
- אורך 300-500 מילים
כתוב בעברית. החזר JSON:
{
  "pressRelease": "...",
  "distributionTips": ["..."]
}`;

  const userPrompt = `עסק: ${businessName} (מזהה: ${clientId})
זווית: ${angle}
עובדות: ${JSON.stringify(facts)}

כתוב הודעה לעיתונות.`;

  try {
    const result = await generateWithAI(systemPrompt, userPrompt, { temperature: 0.6, maxTokens: 1500 });
    if (!result.success || !result.data) {
      return { pressRelease: '', distributionTips: [], error: result.error || 'שגיאה' };
    }

    const raw = typeof result.data === 'string' ? result.data : JSON.stringify(result.data);
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { pressRelease: '', distributionTips: [], error: 'פורמט לא תקין' };

    const parsed = JSON.parse(jsonMatch[0]);
    return { pressRelease: parsed.pressRelease || '', distributionTips: parsed.distributionTips || [] };
  } catch (error) {
    return { pressRelease: '', distributionTips: [], error: `שגיאה: ${(error as Error).message}` };
  }
}

// ============================================================================
// מדריכי ספריות — Directory Listings
// ============================================================================

export async function suggestDirectoryListings(
  niche: string,
  location: string
): Promise<{ directories: DirectoryListing[]; error?: string }> {
  const systemPrompt = `אתה מומחה Local SEO ו-GEO. הצע ספריות ואתרי ציטוט רלוונטיים.
כלול:
- ספריות עסקיות כלליות (Google, Bing, Apple Maps)
- ספריות ענפיות
- ספריות מקומיות לישראל
- אתרי ביקורות
- ספריות מקצועיות
החזר JSON:
{
  "directories": [
    { "name": "...", "url": "...", "category": "...", "authority": 0-100, "listed": false, "priority": "high|medium|low" }
  ]
}
הצע 15-20 ספריות. כתוב בעברית.`;

  const userPrompt = `נישה: ${niche}
מיקום: ${location}

הצע ספריות לרישום.`;

  try {
    const result = await generateWithAI(systemPrompt, userPrompt, { temperature: 0.5, maxTokens: 2000 });
    if (!result.success || !result.data) {
      return { directories: [], error: result.error || 'שגיאה' };
    }

    const raw = typeof result.data === 'string' ? result.data : JSON.stringify(result.data);
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { directories: [], error: 'פורמט לא תקין' };

    const parsed = JSON.parse(jsonMatch[0]);
    return { directories: parsed.directories || [] };
  } catch (error) {
    return { directories: [], error: `שגיאה: ${(error as Error).message}` };
  }
}

// ============================================================================
// יצירת אסטרטגיה מלאה — Full GEO Strategy
// ============================================================================

export async function generateFullGEOStrategy(
  clientId: string,
  domain: string,
  niche: string,
  keywords: string[]
): Promise<{ strategy: GEOStrategy | null; error?: string }> {
  const systemPrompt = `אתה אסטרטג GEO בכיר. בנה אסטרטגיה מקיפה לשיפור נראות במנועי AI.
כלול אסטרטגיות מכל הסוגים:
- structured_data — נתונים מובנים
- citation_building — בניית ציטוטים
- entity_optimization — אופטימיזציית ישויות
- authority_content — תוכן סמכותי
- pr_distribution — הפצת PR
- directory_listings — רישום בספריות

החזר JSON:
{
  "currentVisibility": {
    "google_ai_overview": 0-100,
    "chatgpt": 0-100,
    "perplexity": 0-100,
    "claude": 0-100,
    "gemini": 0-100
  },
  "strategies": [
    {
      "type": "...",
      "priority": "critical|high|medium|low",
      "title": "...",
      "description": "...",
      "estimatedImpact": "...",
      "steps": ["..."],
      "status": "pending"
    }
  ]
}
הצע 8-12 אסטרטגיות. כתוב בעברית.`;

  const userPrompt = `דומיין: ${domain}
נישה: ${niche}
מילות מפתח: ${keywords.join(', ')}

בנה אסטרטגיית GEO מקיפה.`;

  try {
    const result = await generateWithAI(systemPrompt, userPrompt, { temperature: 0.5, maxTokens: 3000 });
    if (!result.success || !result.data) {
      return { strategy: null, error: result.error || 'שגיאה' };
    }

    const raw = typeof result.data === 'string' ? result.data : JSON.stringify(result.data);
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { strategy: null, error: 'פורמט לא תקין' };

    const parsed = JSON.parse(jsonMatch[0]);
    const strategy: GEOStrategy = {
      clientId,
      domain,
      currentVisibility: parsed.currentVisibility || { google_ai_overview: 0, chatgpt: 0, perplexity: 0, claude: 0, gemini: 0 },
      strategies: (parsed.strategies || []).map((s: Record<string, unknown>) => ({ ...s, status: s.status || 'pending' })),
      generatedAt: new Date().toISOString(),
    };

    return { strategy };
  } catch (error) {
    return { strategy: null, error: `שגיאה: ${(error as Error).message}` };
  }
}
