// שירות Google Business Profile — ניהול נוכחות עסקית מקומית
// Google Business Profile Service — local business presence management

import { generateWithAI } from '@/lib/ai/openai-client';

// ============================================================================
// ממשקים — Interfaces
// ============================================================================

export interface GBPConnection {
  clientId: string;
  locationId: string;
  refreshToken: string;
  accessToken?: string;
  tokenExpiry?: number;
  connectionStatus: 'connected' | 'disconnected' | 'expired';
}

export interface GBPBusinessInfo {
  locationId: string;
  name: string;
  address: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  phone: string;
  website: string;
  category: string;
  additionalCategories: string[];
  hours: Record<string, { open: string; close: string } | 'closed'>;
  description: string;
  attributes: Record<string, string>;
}

export interface GBPReview {
  reviewId: string;
  reviewer: { displayName: string; profilePhotoUrl?: string };
  starRating: 1 | 2 | 3 | 4 | 5;
  comment: string;
  createTime: string;
  updateTime: string;
  reply?: { comment: string; updateTime: string };
}

export interface GBPReviewStats {
  averageRating: number;
  totalReviewCount: number;
  repliedCount: number;
  responseRate: number;
  ratingDistribution: Record<1 | 2 | 3 | 4 | 5, number>;
}

export interface GBPPost {
  type: 'OFFER' | 'EVENT' | 'UPDATE';
  title?: string;
  summary: string;
  callToAction?: { actionType: string; url: string };
  mediaUrl?: string;
  eventStart?: string;
  eventEnd?: string;
  offerCouponCode?: string;
}

export interface GBPInsights {
  locationId: string;
  startDate: string;
  endDate: string;
  metrics: {
    views: number;
    searches: number;
    directSearches: number;
    discoverySearches: number;
    websiteClicks: number;
    phoneCallClicks: number;
    directionRequests: number;
    photoViews: number;
  };
}

export interface LocalRanking {
  keyword: string;
  position: number | null;
  inLocalPack: boolean;
  localPackPosition: number | null;
  totalResults: number;
}

// ============================================================================
// אחסון חיבורים — Connection Storage (in-memory, replace with DB in production)
// ============================================================================

const connections = new Map<string, GBPConnection>();

// ============================================================================
// אימות ו-OAuth — Authentication & OAuth
// ============================================================================

async function getAccessToken(connection: GBPConnection): Promise<string> {
  if (connection.accessToken && connection.tokenExpiry && Date.now() < connection.tokenExpiry) {
    return connection.accessToken;
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('חסרים פרטי OAuth — GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET');
  }

  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: connection.refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`שגיאת OAuth: ${response.status} — ${errorText}`);
    }

    const data = await response.json();
    connection.accessToken = data.access_token;
    connection.tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
    connections.set(connection.clientId, connection);

    return data.access_token;
  } catch (error) {
    connection.connectionStatus = 'expired';
    connections.set(connection.clientId, connection);
    throw error;
  }
}

// ============================================================================
// חיבור GBP — Connect GBP
// ============================================================================

export function connectGBP(clientId: string, locationId: string, refreshToken: string): GBPConnection {
  const connection: GBPConnection = {
    clientId,
    locationId,
    refreshToken,
    connectionStatus: 'connected',
  };
  connections.set(clientId, connection);
  return connection;
}

export function getConnection(clientId: string): GBPConnection | null {
  return connections.get(clientId) || null;
}

// ============================================================================
// מידע עסקי — Business Info
// ============================================================================

export async function getBusinessInfo(locationId: string, clientId: string): Promise<GBPBusinessInfo> {
  const connection = connections.get(clientId);
  if (!connection) throw new Error('לא נמצא חיבור GBP ללקוח זה');

  const token = await getAccessToken(connection);

  const response = await fetch(
    `https://mybusinessbusinessinformation.googleapis.com/v1/${locationId}?readMask=name,storefrontAddress,phoneNumbers,websiteUri,regularHours,profile,categories`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!response.ok) {
    throw new Error(`שגיאה בקבלת מידע עסקי: ${response.status}`);
  }

  const data = await response.json();

  return {
    locationId,
    name: data.title || '',
    address: {
      street: data.storefrontAddress?.addressLines?.[0] || '',
      city: data.storefrontAddress?.locality || '',
      state: data.storefrontAddress?.administrativeArea || '',
      postalCode: data.storefrontAddress?.postalCode || '',
      country: data.storefrontAddress?.regionCode || 'IL',
    },
    phone: data.phoneNumbers?.primaryPhone || '',
    website: data.websiteUri || '',
    category: data.categories?.primaryCategory?.displayName || '',
    additionalCategories: data.categories?.additionalCategories?.map((c: { displayName: string }) => c.displayName) || [],
    hours: parseHours(data.regularHours),
    description: data.profile?.description || '',
    attributes: {},
  };
}

function parseHours(regularHours: unknown): Record<string, { open: string; close: string } | 'closed'> {
  const hours: Record<string, { open: string; close: string } | 'closed'> = {};
  const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

  if (!regularHours || typeof regularHours !== 'object') {
    days.forEach(d => { hours[d] = 'closed'; });
    return hours;
  }

  const periods = (regularHours as { periods?: Array<{ openDay: string; openTime: string; closeDay: string; closeTime: string }> }).periods || [];
  days.forEach(day => {
    const period = periods.find(p => p.openDay === day);
    hours[day] = period ? { open: period.openTime, close: period.closeTime } : 'closed';
  });

  return hours;
}

// ============================================================================
// ביקורות — Reviews
// ============================================================================

export async function getReviews(locationId: string, clientId: string, pageSize = 50): Promise<GBPReview[]> {
  const connection = connections.get(clientId);
  if (!connection) throw new Error('לא נמצא חיבור GBP ללקוח זה');

  const token = await getAccessToken(connection);

  const response = await fetch(
    `https://mybusiness.googleapis.com/v4/${locationId}/reviews?pageSize=${pageSize}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!response.ok) {
    throw new Error(`שגיאה בקבלת ביקורות: ${response.status}`);
  }

  const data = await response.json();
  const reviews: GBPReview[] = (data.reviews || []).map((r: Record<string, unknown>) => ({
    reviewId: r.reviewId as string,
    reviewer: r.reviewer as { displayName: string; profilePhotoUrl?: string },
    starRating: mapStarRating(r.starRating as string),
    comment: r.comment as string || '',
    createTime: r.createTime as string,
    updateTime: r.updateTime as string,
    reply: r.reviewReply ? {
      comment: (r.reviewReply as { comment: string }).comment,
      updateTime: (r.reviewReply as { updateTime: string }).updateTime,
    } : undefined,
  }));

  return reviews;
}

function mapStarRating(rating: string): 1 | 2 | 3 | 4 | 5 {
  const map: Record<string, 1 | 2 | 3 | 4 | 5> = {
    ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5,
  };
  return map[rating] || 5;
}

export async function getReviewStats(locationId: string, clientId: string): Promise<GBPReviewStats> {
  const reviews = await getReviews(locationId, clientId, 100);

  const totalReviewCount = reviews.length;
  const repliedCount = reviews.filter(r => r.reply).length;
  const ratingDistribution: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  let totalRating = 0;
  for (const review of reviews) {
    totalRating += review.starRating;
    ratingDistribution[review.starRating]++;
  }

  return {
    averageRating: totalReviewCount > 0 ? Math.round((totalRating / totalReviewCount) * 10) / 10 : 0,
    totalReviewCount,
    repliedCount,
    responseRate: totalReviewCount > 0 ? Math.round((repliedCount / totalReviewCount) * 100) : 0,
    ratingDistribution,
  };
}

// ============================================================================
// תגובה לביקורת — Reply to Review
// ============================================================================

export async function replyToReview(
  locationId: string,
  reviewId: string,
  replyText: string,
  clientId: string
): Promise<{ success: boolean; error?: string }> {
  const connection = connections.get(clientId);
  if (!connection) return { success: false, error: 'לא נמצא חיבור GBP ללקוח זה' };

  try {
    const token = await getAccessToken(connection);

    const response = await fetch(
      `https://mybusiness.googleapis.com/v4/${locationId}/reviews/${reviewId}/reply`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ comment: replyText }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      return { success: false, error: `שגיאה בשליחת תגובה: ${response.status} — ${errText}` };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: `שגיאה: ${(error as Error).message}` };
  }
}

// ============================================================================
// יצירת תגובה AI לביקורת — AI-Generated Review Response
// ============================================================================

export async function generateReviewResponse(
  review: GBPReview,
  businessName: string,
  tone: 'professional' | 'friendly' | 'empathetic' = 'professional'
): Promise<{ response: string; error?: string }> {
  const toneMap = {
    professional: 'מקצועי ועניני',
    friendly: 'חברי וחם',
    empathetic: 'אמפתי ומבין',
  };

  const systemPrompt = `אתה כותב תגובות לביקורות Google עבור העסק "${businessName}".
כתוב בעברית, בטון ${toneMap[tone]}.
הנחיות:
- תגובה קצרה (2-4 משפטים)
- תודה ללקוח על הביקורת
- אם הביקורת שלילית — הבע צער והצע פתרון
- אם חיובית — הדגש שאתם שמחים ומזמינים לחזור
- לא לחזור על תוכן הביקורת מילה במילה
- חתימה בשם העסק`;

  const userPrompt = `ביקורת (${review.starRating} כוכבים):
"${review.comment}"

כתוב תגובה מתאימה.`;

  try {
    const result = await generateWithAI(systemPrompt, userPrompt, { temperature: 0.7, maxTokens: 300 });
    if (!result.success || !result.data) {
      return { response: '', error: result.error || 'שגיאה ביצירת תגובה' };
    }
    return { response: result.data as string };
  } catch (error) {
    return { response: '', error: `שגיאה: ${(error as Error).message}` };
  }
}

// ============================================================================
// יצירת פוסט GBP — Create GBP Post
// ============================================================================

export async function createPost(
  locationId: string,
  post: GBPPost,
  clientId: string
): Promise<{ success: boolean; postId?: string; error?: string }> {
  const connection = connections.get(clientId);
  if (!connection) return { success: false, error: 'לא נמצא חיבור GBP ללקוח זה' };

  try {
    const token = await getAccessToken(connection);

    const body: Record<string, unknown> = {
      topicType: post.type,
      summary: post.summary,
      languageCode: 'he',
    };

    if (post.callToAction) {
      body.callToAction = post.callToAction;
    }
    if (post.mediaUrl) {
      body.media = [{ mediaFormat: 'PHOTO', sourceUrl: post.mediaUrl }];
    }
    if (post.type === 'EVENT' && post.eventStart && post.eventEnd) {
      body.event = {
        title: post.title || '',
        schedule: { startDate: post.eventStart, endDate: post.eventEnd },
      };
    }
    if (post.type === 'OFFER' && post.offerCouponCode) {
      body.offer = { couponCode: post.offerCouponCode };
    }

    const response = await fetch(
      `https://mybusiness.googleapis.com/v4/${locationId}/localPosts`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      return { success: false, error: `שגיאה ביצירת פוסט: ${response.status} — ${errText}` };
    }

    const result = await response.json();
    return { success: true, postId: result.name };
  } catch (error) {
    return { success: false, error: `שגיאה: ${(error as Error).message}` };
  }
}

// ============================================================================
// יצירת פוסט GBP ב-AI — AI-Generated GBP Post
// ============================================================================

export async function generateGBPPost(
  clientId: string,
  type: 'OFFER' | 'EVENT' | 'UPDATE',
  topic: string,
  businessName?: string
): Promise<{ post: GBPPost | null; error?: string }> {
  const typeMap = { OFFER: 'מבצע/הנחה', EVENT: 'אירוע', UPDATE: 'עדכון' };

  const systemPrompt = `אתה כותב פוסטים ל-Google Business Profile עבור "${businessName || 'העסק'}".
כתוב בעברית. הפוסט צריך להיות קצר (עד 300 תווים), מעניין ומושך.
סוג הפוסט: ${typeMap[type]}.
החזר JSON בפורמט:
{
  "title": "כותרת קצרה",
  "summary": "תוכן הפוסט",
  "callToAction": { "actionType": "LEARN_MORE", "url": "" }
}`;

  const userPrompt = `נושא: ${topic}
צור פוסט ${typeMap[type]} מעניין ומושך קליקים.`;

  try {
    const result = await generateWithAI(systemPrompt, userPrompt, { temperature: 0.8, maxTokens: 500 });
    if (!result.success || !result.data) {
      return { post: null, error: result.error || 'שגיאה ביצירת פוסט' };
    }

    const content = typeof result.data === 'string' ? result.data : JSON.stringify(result.data);
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { post: null, error: 'לא התקבל פורמט JSON תקין' };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const post: GBPPost = {
      type,
      title: parsed.title,
      summary: parsed.summary,
      callToAction: parsed.callToAction,
    };

    return { post };
  } catch (error) {
    return { post: null, error: `שגיאה: ${(error as Error).message}` };
  }
}

// ============================================================================
// תובנות — Insights
// ============================================================================

export async function getInsights(
  locationId: string,
  clientId: string,
  startDate: string,
  endDate: string
): Promise<GBPInsights> {
  const connection = connections.get(clientId);
  if (!connection) throw new Error('לא נמצא חיבור GBP ללקוח זה');

  const token = await getAccessToken(connection);

  const response = await fetch(
    `https://mybusiness.googleapis.com/v4/${locationId}/reportInsights`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        locationNames: [locationId],
        basicRequest: {
          metricRequests: [
            { metric: 'ALL' },
          ],
          timeRange: { startTime: startDate, endTime: endDate },
        },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`שגיאה בקבלת תובנות: ${response.status}`);
  }

  const data = await response.json();
  const metrics = data.locationMetrics?.[0]?.metricValues || [];

  const getMetricValue = (name: string): number => {
    const m = metrics.find((mv: { metric: string }) => mv.metric === name);
    return m?.totalValue?.value || 0;
  };

  return {
    locationId,
    startDate,
    endDate,
    metrics: {
      views: getMetricValue('VIEWS_MAPS') + getMetricValue('VIEWS_SEARCH'),
      searches: getMetricValue('QUERIES_DIRECT') + getMetricValue('QUERIES_INDIRECT'),
      directSearches: getMetricValue('QUERIES_DIRECT'),
      discoverySearches: getMetricValue('QUERIES_INDIRECT'),
      websiteClicks: getMetricValue('ACTIONS_WEBSITE'),
      phoneCallClicks: getMetricValue('ACTIONS_PHONE'),
      directionRequests: getMetricValue('ACTIONS_DRIVING_DIRECTIONS'),
      photoViews: getMetricValue('PHOTOS_VIEWS_MERCHANT'),
    },
  };
}

// ============================================================================
// עדכון מידע עסקי — Update Business Info
// ============================================================================

export async function updateBusinessInfo(
  locationId: string,
  clientId: string,
  updates: Partial<Pick<GBPBusinessInfo, 'phone' | 'website' | 'description' | 'hours'>>
): Promise<{ success: boolean; error?: string }> {
  const connection = connections.get(clientId);
  if (!connection) return { success: false, error: 'לא נמצא חיבור GBP ללקוח זה' };

  try {
    const token = await getAccessToken(connection);

    const updateMask: string[] = [];
    const body: Record<string, unknown> = {};

    if (updates.phone) {
      updateMask.push('phoneNumbers');
      body.phoneNumbers = { primaryPhone: updates.phone };
    }
    if (updates.website) {
      updateMask.push('websiteUri');
      body.websiteUri = updates.website;
    }
    if (updates.description) {
      updateMask.push('profile');
      body.profile = { description: updates.description };
    }
    if (updates.hours) {
      updateMask.push('regularHours');
      body.regularHours = { periods: formatHoursForAPI(updates.hours) };
    }

    const response = await fetch(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${locationId}?updateMask=${updateMask.join(',')}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      return { success: false, error: `שגיאה בעדכון: ${response.status} — ${errText}` };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: `שגיאה: ${(error as Error).message}` };
  }
}

function formatHoursForAPI(hours: Record<string, { open: string; close: string } | 'closed'>): Array<Record<string, string>> {
  const periods: Array<Record<string, string>> = [];
  for (const [day, value] of Object.entries(hours)) {
    if (value !== 'closed') {
      periods.push({
        openDay: day,
        openTime: value.open,
        closeDay: day,
        closeTime: value.close,
      });
    }
  }
  return periods;
}

// ============================================================================
// דירוגים מקומיים — Local Rankings (via Serper)
// ============================================================================

export async function getLocalRankings(
  businessName: string,
  location: string,
  keywords: string[]
): Promise<LocalRanking[]> {
  const serperKey = process.env.SERPER_API_KEY;
  if (!serperKey) {
    throw new Error('חסר SERPER_API_KEY לבדיקת דירוגים מקומיים');
  }

  const rankings: LocalRanking[] = [];

  for (const keyword of keywords) {
    try {
      const response = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: {
          'X-API-KEY': serperKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          q: `${keyword} ${location}`,
          gl: 'il',
          hl: 'he',
          num: 20,
        }),
      });

      if (!response.ok) {
        rankings.push({
          keyword,
          position: null,
          inLocalPack: false,
          localPackPosition: null,
          totalResults: 0,
        });
        continue;
      }

      const data = await response.json();

      // Check local pack (map results)
      let localPackPosition: number | null = null;
      const places = data.places || [];
      for (let i = 0; i < places.length; i++) {
        if (places[i].title?.toLowerCase().includes(businessName.toLowerCase())) {
          localPackPosition = i + 1;
          break;
        }
      }

      // Check organic results
      let position: number | null = null;
      const organic = data.organic || [];
      for (let i = 0; i < organic.length; i++) {
        if (
          organic[i].title?.toLowerCase().includes(businessName.toLowerCase()) ||
          organic[i].link?.toLowerCase().includes(businessName.toLowerCase().replace(/\s+/g, ''))
        ) {
          position = i + 1;
          break;
        }
      }

      rankings.push({
        keyword,
        position,
        inLocalPack: localPackPosition !== null,
        localPackPosition,
        totalResults: data.searchInformation?.totalResults || 0,
      });
    } catch (error) {
      console.error(`[GBP] שגיאה בבדיקת דירוג עבור "${keyword}":`, error);
      rankings.push({
        keyword,
        position: null,
        inLocalPack: false,
        localPackPosition: null,
        totalResults: 0,
      });
    }
  }

  return rankings;
}
