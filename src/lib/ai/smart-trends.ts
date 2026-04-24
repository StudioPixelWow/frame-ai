/**
 * Smart Trends Engine — Hebrew Marketing Agency Platform
 * Deterministic (non-AI) utility that generates smart, differentiated weekly trends
 * and per-client content suggestions.
 *
 * All text is in Hebrew. Uses date/week for deterministic rotation to ensure
 * variety and client-specific personalization.
 */

import { getHolidaysForMonth, type IsraeliHoliday } from '@/lib/israeli-holidays';
import type { ClientType } from '@/lib/db/schema';

// ═══════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════

export interface SmartTrend {
  id: string;
  icon: string;
  title: string;
  description: string;
  urgency: 'high' | 'medium' | 'low';
  relevanceScore: number;
  source: 'calendar' | 'industry' | 'platform' | 'seasonal' | 'data';
  actionText?: string;
  actionHref?: string;
  contentFormats?: string[];
}

export interface ContentIdea {
  id: string;
  title: string;
  description: string;
  format: 'reel' | 'carousel' | 'story' | 'post' | 'video';
  platform: string;
  category: 'engagement' | 'brand' | 'seasonal' | 'trend' | 'value' | 'social_proof';
  urgencyLabel: string;
}

export interface Client {
  id: string;
  name: string;
  clientType: ClientType;
  businessField: string;
  status: 'active' | 'inactive' | 'prospect';
  marketingGoals?: string;
  keyMarketingMessages?: string;
}

export interface GanttItem {
  clientId: string;
  status: string;
  date?: string;
  platform?: string;
}

export interface Campaign {
  id: string;
  status: string;
  platform?: string;
  clientId?: string;
}

export interface SocialPost {
  id: string;
  clientId?: string;
  createdAt?: string;
  platform?: string;
}

// ═══════════════════════════════════════════════════════════════════════
// INTERNAL MAPPINGS & CONSTANTS
// ═══════════════════════════════════════════════════════════════════════

const PLATFORM_FORMATS: Record<string, string[]> = {
  instagram: ['reel', 'carousel', 'story', 'post'],
  facebook: ['post', 'carousel', 'video', 'story'],
  tiktok: ['reel', 'video'],
  linkedin: ['post', 'carousel', 'video'],
  youtube: ['video'],
  twitter: ['post'],
};

const INDUSTRY_CONTENT_ANGLES: Record<string, string[]> = {
  'קמעונאות': ['טיפים לקנייה חכמה', 'מוצרים חדשים שהגיעו', 'צילומי מוצר בסגנון לייפסטייל'],
  'תזונה': ['טיפים לתזונה נכונה', 'מתכונים פשוטים ובריאים', 'סיפורי שינוי של לקוחות'],
  'ספורט': ['סרטוני אימון קצרים', 'השראה מאימון אמיתי', 'טיפ מקצועי יומי'],
  'בריאות': ['מידע שימושי ונגיש', 'טיפים ליומיום בריא', 'מאחורי הקלעים של הטיפול'],
  'טכנולוגיה': ['הדגמה מהירה של פיצ׳ר', 'חדשות ועדכוני תעשייה', 'טיפים לייעול עם הכלי'],
  'חינוך': ['טיפ פדגוגי שבועי', 'סיפורים מהשטח', 'תוכן ערך להורים ותלמידים'],
  'אופנה': ['טרנדים של העונה', 'סטיילינג טיפ מהיר', 'השראה ממראות שונים'],
  'מסעדות': ['צילום מנה מפתה', 'מאחורי הקלעים במטבח', 'סיפור על מנה חדשה'],
  'נדל"ן': ['סיור וידאו בנכס', 'טיפים לרוכשים', 'סיפור עסקה שהצליחה'],
  'רכב': ['טיפים לתחזוקה', 'השוואת דגמים', 'חוויית לקוח אמיתית'],
  'תיירות': ['יעד מומלץ השבוע', 'טיפים לטיסה חכמה', 'סיפורי מטיילים'],
  'כללי': ['טיפ מקצועי מהתחום', 'מאחורי הקלעים של העסק', 'סיפור הצלחה של לקוח'],
};

const SEASONAL_THEMES: Record<number, string> = {
  1: 'התחלות חדשות — יעדים, מוטיבציה, תוכנית פעולה',
  2: 'ט״ו בשבט ואהבה — צמיחה, חידוש, גדילה',
  3: 'פורים ואביב — יצירתיות, כיף, צבעוניות',
  4: 'פסח וחירות — התחדשות, ניקיון, שינוי',
  5: 'יום העצמאות — גאווה, קהילה, ישראליות',
  6: 'שבועות וקיץ — התחלת עונת הקיץ',
  7: 'שיא הקיץ — אווירת חופש, חוויות, שמש',
  8: 'ט״ו באב וסוף קיץ — אהבה, רומנטיקה, נוסטלגיה',
  9: 'חזרה לשגרה — ראש השנה, סדר, התחלה חדשה',
  10: 'חגי תשרי — חשבון נפש, ערכים, משפחה',
  11: 'בלאק פריידיי — מבצעים, הנחות, הזדמנויות',
  12: 'חנוכה וסילבסטר — סיכום שנה, חגיגות, תוכן חם',
};

// Platform rotation for weekly trends (4-week cycle)
const PLATFORM_TRENDS = [
  {
    title: 'Reels קצרים של 15 שניות — צפיות כפולות',
    description: 'ריל קצר ותופס עין מקבל פי 2 חשיפה מפוסט רגיל. הקפידו על הוק בשנייה הראשונה.',
    contentFormats: ['reel', 'video'],
  },
  {
    title: 'קרוסלות טיפים — שיעור engagement הגבוה ביותר',
    description: 'קרוסלות עם 5-7 שקפים של ערך אמיתי הם הפורמט עם הכי הרבה שמירות ושיתופים.',
    contentFormats: ['carousel', 'post'],
  },
  {
    title: 'סטוריז אינטראקטיביים — סקרים ושאלות',
    description: 'הוסיפו סקר, חידון או שאלה פתוחה בסטוריז. מעלה תגובות ומגביר את האלגוריתם.',
    contentFormats: ['story'],
  },
  {
    title: 'תוכן UGC — הלקוחות שלך מייצרים תוכן בשבילך',
    description: 'שתפו תוכן שלקוחות יצרו עליכם. אמין יותר, אותנטי יותר, ועולה פחות.',
    contentFormats: ['post', 'carousel'],
  },
];

// ═══════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════

function getWeekNumber(date: Date = new Date()): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function getDaysUntilDate(targetMonth: number, targetDay: number): number {
  const today = new Date();
  const targetDate = new Date(today.getFullYear(), targetMonth - 1, targetDay);
  if (targetDate < today) {
    targetDate.setFullYear(targetDate.getFullYear() + 1);
  }
  return Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function generateId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get upcoming holidays within 30 days from now
 */
function getUpcomingHolidays(days: number = 30): IsraeliHoliday[] {
  const today = new Date();
  const upcoming: IsraeliHoliday[] = [];

  // Check current month and next month
  const currentMonth = today.getMonth() + 1;
  const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
  const currentYear = today.getFullYear();
  const nextYear = currentMonth === 12 ? currentYear + 1 : currentYear;

  const holidaysThisMonth = getHolidaysForMonth(currentMonth, currentYear);
  const holidaysNextMonth = getHolidaysForMonth(nextMonth, nextYear);

  const allHolidays = [...holidaysThisMonth, ...holidaysNextMonth];

  for (const holiday of allHolidays) {
    const daysUntil = getDaysUntilDate(holiday.month, holiday.approximateDay);
    if (daysUntil > 0 && daysUntil <= days) {
      upcoming.push(holiday);
    }
  }

  // Sort by proximity
  upcoming.sort((a, b) => getDaysUntilDate(a.month, a.approximateDay) - getDaysUntilDate(b.month, b.approximateDay));

  return upcoming;
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════

export function generateWeeklyTrends(params: {
  clients: Client[];
  ganttItems: GanttItem[];
  campaigns: Campaign[];
  socialPosts: SocialPost[];
}): SmartTrend[] {
  const trends: SmartTrend[] = [];
  const now = new Date();
  const weekNum = getWeekNumber(now);
  const currentMonth = now.getMonth() + 1;

  // 1. Holiday trends — if upcoming holidays, suggest content preparation
  const upcomingHolidays = getUpcomingHolidays(30);
  if (upcomingHolidays.length > 0) {
    const nearestHoliday = upcomingHolidays[0];
    const daysUntil = getDaysUntilDate(nearestHoliday.month, nearestHoliday.approximateDay);

    const urgency = daysUntil <= 7 ? 'high' : daysUntil <= 14 ? 'medium' : 'low';

    trends.push({
      id: generateId('trend_holiday'),
      icon: '🗓️',
      title: `${nearestHoliday.hebrewName} מתקרב — הכינו תוכן`,
      description: daysUntil <= 7
        ? `${nearestHoliday.hebrewName} בעוד ${daysUntil} ימים! שלחו ברכות, פרסמו מבצעים וצרו תוכן חגיגי עכשיו.`
        : `${nearestHoliday.hebrewName} בעוד ${daysUntil} ימים. זמן מצוין לתכנן תוכן ייעודי ולהקדים את המתחרים.`,
      urgency,
      relevanceScore: Math.max(0.6, 1 - daysUntil / 30),
      source: 'calendar',
      actionText: 'צפה בלקוחות',
      actionHref: '/clients',
      contentFormats: nearestHoliday.contentIdeas.slice(0, 2),
    });
  }

  // 2. Seasonal trend — based on current month
  const seasonalMessage = SEASONAL_THEMES[currentMonth];
  if (seasonalMessage) {
    trends.push({
      id: generateId('trend_seasonal'),
      icon: '🌍',
      title: `הנושא של החודש: ${seasonalMessage.split('—')[0].trim()}`,
      description: `${seasonalMessage}. תכנון תוכן סביב הנושאים האלו מגביר רלוונטיות וחשיפה.`,
      urgency: 'medium',
      relevanceScore: 0.75,
      source: 'seasonal',
    });
  }

  // 3. Platform trend — rotated weekly
  const platformTrendIndex = weekNum % 4;
  const platformTrend = PLATFORM_TRENDS[platformTrendIndex];
  if (platformTrend) {
    trends.push({
      id: generateId('trend_platform'),
      icon: '📱',
      title: platformTrend.title,
      description: platformTrend.description,
      urgency: 'high',
      relevanceScore: 0.85,
      source: 'platform',
      contentFormats: platformTrend.contentFormats,
    });
  }

  // 4. Data-driven trends
  const activeClients = params.clients.filter((c) => c.status === 'active');
  const lowActivityClients = activeClients.filter((client) => {
    const clientPosts = params.socialPosts.filter((p) => p.clientId === client.id);
    return clientPosts.length < 2; // fewer than 2 posts recently
  });

  if (lowActivityClients.length >= activeClients.length * 0.4 && lowActivityClients.length > 0) {
    trends.push({
      id: generateId('trend_content_sprint'),
      icon: '⚡',
      title: `${lowActivityClients.length} לקוחות עם פעילות נמוכה`,
      description: `חצי מהלקוחות הפעילים שלך עם מעט תוכן השבוע. זה הזמן לספרינט תוכן — תכנן 2-3 פוסטים לכל אחד.`,
      urgency: 'high',
      relevanceScore: 0.88,
      source: 'data',
      actionText: 'תכנן תוכן',
      actionHref: '/clients',
    });
  }

  const activeCampaigns = params.campaigns.filter((c) => c.status === 'active');
  if (activeCampaigns.length >= 3) {
    trends.push({
      id: generateId('trend_campaign_optimization'),
      icon: '🎯',
      title: `${activeCampaigns.length} קמפיינים רצים — זמן לאופטימיזציה`,
      description: `בדקו ביצועים, העיפו תקציב למודעות שעובדות, ועצרו את מה שלא מביא תוצאות.`,
      urgency: 'medium',
      relevanceScore: 0.72,
      source: 'data',
      actionText: 'נהל קמפיינים',
      actionHref: '/campaigns',
    });
  }

  // 5. Engagement trend (rotated weekly)
  const engagementTrends = [
    { title: 'שבוע של engagement — הגיבו, שאלו, שתפו', description: 'שאלו את הקהל שאלה פתוחה, שתפו סקר בסטוריז, והגיבו על כל תגובה. האלגוריתם יתגמל.' },
    { title: 'שבוע של social proof — תנו ללקוחות לדבר', description: 'צרו פוסט עם ציטוט לקוח, צילום מסך של ביקורת, או סרטון עדות. אמינות מנצחת.' },
    { title: 'שבוע של behind the scenes — הראו את מי שעומד מאחורי', description: 'צלמו את הצוות בעבודה, את התהליך מאחורי המוצר, את המשרד. אנשים מתחברים לאנשים.' },
    { title: 'שבוע של ערך — תנו טיפ שאפשר ליישם מיד', description: 'פרסמו טיפ מקצועי אחד שאפשר ליישם תוך דקה. תוכן ערך מקבל הכי הרבה שמירות.' },
  ];
  const engagementIdx = weekNum % engagementTrends.length;
  if (activeClients.length > 0) {
    trends.push({
      id: generateId('trend_engagement'),
      icon: '💬',
      ...engagementTrends[engagementIdx],
      urgency: 'medium' as const,
      relevanceScore: 0.68,
      source: 'industry' as const,
    });
  }

  // Return 4-6 trends (slice to variety)
  return trends.slice(0, 6);
}

export function generateClientContentIdeas(params: {
  client: Client;
  recentGanttItems: GanttItem[];
  recentPosts: SocialPost[];
}): ContentIdea[] {
  const ideas: ContentIdea[] = [];
  const client = params.client;
  const clientSeed = client.id.charCodeAt(0) + getWeekNumber();

  // Deterministic shuffling for variety
  const getIdeaIndex = (offset: number): number => {
    return Math.abs((clientSeed + offset) % 3);
  };

  // 1. Client-type-based angle
  const clientTypeAngles: Record<ClientType, { focus: string; formats: Array<'reel' | 'carousel' | 'story' | 'post' | 'video'> }> = {
    marketing: {
      focus: 'אסטרטגיה, ROI, מקרי לימוד',
      formats: ['carousel', 'video', 'post'],
    },
    branding: {
      focus: 'זהות חזותית, קול מותג, סיפור',
      formats: ['reel', 'carousel', 'story'],
    },
    websites: {
      focus: 'נוכחות דיגיטלית, UX, המרה',
      formats: ['video', 'post', 'carousel'],
    },
    hosting: {
      focus: 'אמינות, עלות הפעלה, טכנולוגיה',
      formats: ['post', 'carousel', 'video'],
    },
    podcast: {
      focus: 'אודיו, ראיונות, עומק',
      formats: ['video', 'post', 'carousel'],
    },
    lead: {
      focus: 'מודעות, רושם ראשון, הצעה ערך',
      formats: ['reel', 'video', 'carousel'],
    },
  };

  const clientAngle = clientTypeAngles[client.clientType];

  // 2. Industry-based content angles
  const industryAngles = INDUSTRY_CONTENT_ANGLES[client.businessField] || INDUSTRY_CONTENT_ANGLES['כללי'];

  // 3. Activity check — if low activity, suggest catch-up content
  const recentPostCount = params.recentPosts.length;
  const isCatchingUp = recentPostCount < 2;

  // 4. Holiday relevance
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const upcomingHolidays = getUpcomingHolidays(21);
  const relevantHoliday = upcomingHolidays.length > 0 ? upcomingHolidays[0] : null;

  // Build 3 unique ideas
  const allIdeas: ContentIdea[] = [];

  // Idea 1: Client-type + industry focused
  const idea1Angle = industryAngles[getIdeaIndex(0) % industryAngles.length];
  allIdeas.push({
    id: generateId('idea'),
    title: idea1Angle,
    description: isCatchingUp
      ? `${client.name} צריך תוכן דחוף! פרסם ${idea1Angle} שמתחבר ל"${client.marketingGoals || 'חיזוק המותג'}".`
      : `רעיון ל${client.name}: ${idea1Angle} — מתאים למטרה "${client.marketingGoals || 'חשיפה וצמיחה'}".`,
    format: clientAngle.formats[getIdeaIndex(1) % clientAngle.formats.length],
    platform: 'instagram',
    category: 'value',
    urgencyLabel: isCatchingUp ? 'דחוף — מעט תוכן לאחרונה' : 'מומלץ',
  });

  // Idea 2: Holiday/seasonal or engagement-focused
  if (relevantHoliday) {
    allIdeas.push({
      id: generateId('idea'),
      title: `${relevantHoliday.hebrewName} — תוכן חגיגי`,
      description: `${relevantHoliday.contentIdeas[0] || 'תוכן ייעודי לחג'} — התאם את זה ל${client.name} ולקהל שלהם.`,
      format: clientAngle.formats[getIdeaIndex(2) % clientAngle.formats.length],
      platform: 'facebook',
      category: 'seasonal',
      urgencyLabel: 'רלוונטי עכשיו',
    });
  } else {
    allIdeas.push({
      id: generateId('idea'),
      title: 'שאלה פתוחה לקהל',
      description: `שאל את העוקבים של ${client.name} שאלה על ${client.businessField} — למשל "מה הדבר הראשון שאתם בודקים כש...?" — מניע תגובות ושיחה.`,
      format: 'story',
      platform: 'instagram',
      category: 'engagement',
      urgencyLabel: 'קל להפקה',
    });
  }

  // Idea 3: Format variety or social proof
  const formatIndex = getIdeaIndex(3) % clientAngle.formats.length;
  const idea3Format = clientAngle.formats[formatIndex];

  allIdeas.push({
    id: generateId('idea'),
    title: idea3Format === 'carousel' ? `5 טיפים מהירים בתחום ${client.businessField}` : 'סיפור לקוח — הוכחה חברתית',
    description: idea3Format === 'carousel'
      ? `קרוסלה עם 5 טיפים שימושיים בתחום ${client.businessField}. פורמט שמקבל הכי הרבה שמירות.`
      : `שתף ציטוט, ביקורת, או סיפור הצלחה של לקוח של ${client.name}. אמינות מנצחת פרסום.`,
    format: idea3Format,
    platform: idea3Format === 'reel' ? 'tiktok' : 'instagram',
    category: idea3Format === 'carousel' ? 'value' : 'social_proof',
    urgencyLabel: 'מומלץ',
  });

  // Return the 3 ideas
  return allIdeas;
}
