/**
 * Postiz API Client — Social media scheduling via Postiz (open-source)
 *
 * Postiz REST API integration for PixelManageAI.
 * Supports: Facebook, Instagram, TikTok, LinkedIn, Twitter
 */

import type { SocialPlatformType } from '@/lib/db/schema';

// ── Configuration ──────────────────────────────────────────────────────────────

const POSTIZ_API_URL = process.env.POSTIZ_API_URL || 'http://localhost:3333';
const POSTIZ_API_KEY = process.env.POSTIZ_API_KEY || '';

function getHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    ...(POSTIZ_API_KEY ? { Authorization: `Bearer ${POSTIZ_API_KEY}` } : {}),
  };
}

// ── Types ──────────────────────────────────────────────────────────────────────

export interface PostizPostPayload {
  content: string;
  platforms: SocialPlatformType[];
  mediaUrls?: string[];
  hashtags?: string[];
  scheduledAt?: string; // ISO date string
}

export interface PostizPost {
  id: string;
  content: string;
  platforms: SocialPlatformType[];
  mediaUrls: string[];
  hashtags: string[];
  status: 'draft' | 'scheduled' | 'published' | 'failed';
  scheduledAt: string | null;
  publishedAt: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PostizListParams {
  page?: number;
  limit?: number;
  status?: string;
  platform?: SocialPlatformType;
}

export interface PostizHealthStatus {
  ok: boolean;
  version?: string;
  message: string;
  timestamp: string;
}

// ── API Helpers ────────────────────────────────────────────────────────────────

async function postizFetch<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${POSTIZ_API_URL}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: { ...getHeaders(), ...(options.headers ?? {}) },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(
      `Postiz API error ${res.status} ${res.statusText}: ${body}`,
    );
  }

  return res.json() as Promise<T>;
}

// ── Core API Functions ─────────────────────────────────────────────────────────

/**
 * Create a new post (draft or immediate publish).
 */
export async function createPost(
  payload: PostizPostPayload,
): Promise<PostizPost> {
  return postizFetch<PostizPost>('/api/posts', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Create and schedule a post for future publication.
 */
export async function schedulePost(
  payload: PostizPostPayload & { scheduledAt: string },
): Promise<PostizPost> {
  return postizFetch<PostizPost>('/api/posts', {
    method: 'POST',
    body: JSON.stringify({ ...payload, scheduledAt: payload.scheduledAt }),
  });
}

/**
 * Get a single post by ID.
 */
export async function getPost(postId: string): Promise<PostizPost> {
  return postizFetch<PostizPost>(`/api/posts/${postId}`);
}

/**
 * List posts with optional filters.
 */
export async function listPosts(
  params: PostizListParams = {},
): Promise<PostizPost[]> {
  const qs = new URLSearchParams();
  if (params.page) qs.set('page', String(params.page));
  if (params.limit) qs.set('limit', String(params.limit));
  if (params.status) qs.set('status', params.status);
  if (params.platform) qs.set('platform', params.platform);

  const query = qs.toString();
  const endpoint = `/api/posts${query ? `?${query}` : ''}`;
  return postizFetch<PostizPost[]>(endpoint);
}

/**
 * Delete a post by ID.
 */
export async function deletePost(postId: string): Promise<void> {
  await postizFetch<unknown>(`/api/posts/${postId}`, { method: 'DELETE' });
}

// ── Health Check ───────────────────────────────────────────────────────────────

/**
 * Check Postiz API connection health.
 */
export async function checkHealth(): Promise<PostizHealthStatus> {
  try {
    const res = await fetch(`${POSTIZ_API_URL}/api/health`, {
      headers: getHeaders(),
      signal: AbortSignal.timeout(5000),
    });

    if (res.ok) {
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      return {
        ok: true,
        version: typeof data.version === 'string' ? data.version : undefined,
        message: 'Postiz API is reachable',
        timestamp: new Date().toISOString(),
      };
    }

    return {
      ok: false,
      message: `Postiz API returned ${res.status}`,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    };
  }
}

// ── Israeli Social Content Helpers ─────────────────────────────────────────────

/**
 * Best posting times for Israeli audience.
 * Israeli work week: Sunday-Thursday. Friday is half-day, Saturday is Shabbat.
 */
export interface IsraeliTimeslot {
  dayOfWeek: number; // 0=Sun, 1=Mon, ..., 6=Sat
  dayNameHe: string;
  hour: number;
  label: string;
  score: number; // 1-10 engagement score
}

const HEBREW_DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

/**
 * Returns recommended posting times for each platform,
 * optimized for the Israeli market (IDT timezone, Sun-Thu work week).
 */
export function getIsraeliPostingTimes(
  platform: SocialPlatformType,
): IsraeliTimeslot[] {
  const platformSlots: Record<SocialPlatformType, Array<{ day: number; hour: number; score: number; label: string }>> = {
    facebook: [
      { day: 0, hour: 10, score: 8, label: 'ראשון בוקר - תחילת שבוע' },
      { day: 0, hour: 20, score: 9, label: 'ראשון ערב - שיא גלישה' },
      { day: 1, hour: 12, score: 7, label: 'שני צהריים - הפסקה' },
      { day: 2, hour: 20, score: 8, label: 'שלישי ערב' },
      { day: 3, hour: 13, score: 7, label: 'רביעי צהריים' },
      { day: 4, hour: 10, score: 8, label: 'חמישי בוקר - לפני סוף שבוע' },
    ],
    instagram: [
      { day: 0, hour: 9, score: 8, label: 'ראשון בוקר - פתיחת שבוע' },
      { day: 0, hour: 19, score: 9, label: 'ראשון ערב - שיא אינסטגרם' },
      { day: 1, hour: 18, score: 8, label: 'שני אחר הצהריים' },
      { day: 2, hour: 12, score: 7, label: 'שלישי צהריים' },
      { day: 3, hour: 20, score: 9, label: 'רביעי ערב - שיא' },
      { day: 4, hour: 11, score: 8, label: 'חמישי בוקר' },
      { day: 5, hour: 10, score: 6, label: 'שישי בוקר - לפני שבת' },
    ],
    tiktok: [
      { day: 0, hour: 18, score: 9, label: 'ראשון ערב - שיא טיקטוק' },
      { day: 1, hour: 20, score: 8, label: 'שני ערב' },
      { day: 2, hour: 19, score: 9, label: 'שלישי ערב' },
      { day: 3, hour: 21, score: 10, label: 'רביעי לילה - שיא מוחלט' },
      { day: 4, hour: 17, score: 8, label: 'חמישי אחה"צ' },
      { day: 6, hour: 21, score: 7, label: 'מוצ"ש - חזרה מסוף שבוע' },
    ],
    linkedin: [
      { day: 0, hour: 8, score: 9, label: 'ראשון בוקר - פתיחת שבוע עסקי' },
      { day: 0, hour: 12, score: 8, label: 'ראשון צהריים' },
      { day: 1, hour: 9, score: 8, label: 'שני בוקר' },
      { day: 2, hour: 10, score: 7, label: 'שלישי בוקר' },
      { day: 3, hour: 8, score: 8, label: 'רביעי בוקר' },
      { day: 4, hour: 9, score: 7, label: 'חמישי בוקר' },
    ],
    twitter: [
      { day: 0, hour: 9, score: 8, label: 'ראשון בוקר' },
      { day: 0, hour: 21, score: 9, label: 'ראשון ערב' },
      { day: 1, hour: 12, score: 7, label: 'שני צהריים' },
      { day: 2, hour: 18, score: 8, label: 'שלישי אחה"צ' },
      { day: 3, hour: 20, score: 8, label: 'רביעי ערב' },
      { day: 4, hour: 10, score: 7, label: 'חמישי בוקר' },
    ],
  };

  const slots = platformSlots[platform] ?? platformSlots.facebook;
  return slots.map((s) => ({
    dayOfWeek: s.day,
    dayNameHe: HEBREW_DAY_NAMES[s.day],
    hour: s.hour,
    label: s.label,
    score: s.score,
  }));
}

/**
 * Hebrew hashtag utilities.
 * Cleans and formats hashtags for Hebrew content.
 */
export function formatHebrewHashtags(tags: string[]): string[] {
  return tags.map((tag) => {
    // Remove existing # if present
    let cleaned = tag.replace(/^#/, '').trim();
    // Remove spaces within the tag (hashtags can't have spaces)
    cleaned = cleaned.replace(/\s+/g, '_');
    return cleaned ? `#${cleaned}` : '';
  }).filter(Boolean);
}

/**
 * Generates trending Hebrew hashtag suggestions based on category.
 */
export function suggestHebrewHashtags(
  category: 'business' | 'food' | 'tech' | 'lifestyle' | 'marketing' | 'general',
): string[] {
  const hashtagSets: Record<string, string[]> = {
    business: ['#עסקים', '#יזמות', '#עסק_קטן', '#שיווק_דיגיטלי', '#הצלחה', '#עסקים_בישראל', '#טיפים_לעסקים'],
    food: ['#אוכל', '#מתכון', '#אוכל_ישראלי', '#בישול', '#שף', '#פוד', '#אוכל_ביתי'],
    tech: ['#טכנולוגיה', '#הייטק', '#סטארטאפ', '#חדשנות', '#תכנות', '#טק_ישראלי', '#AI'],
    lifestyle: ['#לייפסטייל', '#השראה', '#חיים_טובים', '#מוטיבציה', '#ישראל', '#תל_אביב'],
    marketing: ['#שיווק', '#מיתוג', '#דיגיטל', '#תוכן', '#סושיאל', '#קריאייטיב', '#שיווק_תוכן'],
    general: ['#ישראל', '#תוכן', '#שיתוף', '#קהילה', '#טרנד', '#חדשות'],
  };

  return hashtagSets[category] ?? hashtagSets.general;
}

/**
 * Platform display info (icon + Hebrew label).
 */
export const PLATFORM_INFO: Record<SocialPlatformType, { icon: string; labelHe: string }> = {
  facebook: { icon: '📘', labelHe: 'פייסבוק' },
  instagram: { icon: '📸', labelHe: 'אינסטגרם' },
  tiktok: { icon: '🎵', labelHe: 'טיקטוק' },
  linkedin: { icon: '💼', labelHe: 'לינקדאין' },
  twitter: { icon: '🐦', labelHe: 'טוויטר / X' },
};

/**
 * Returns the next recommended posting slot for a given platform.
 * Looks forward from "now" in Israel timezone.
 */
export function getNextRecommendedSlot(
  platform: SocialPlatformType,
): { date: Date; label: string } | null {
  const slots = getIsraeliPostingTimes(platform);
  if (slots.length === 0) return null;

  // Current Israel time
  const nowISO = new Date().toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' });
  const now = new Date(nowISO);
  const currentDay = now.getDay();
  const currentHour = now.getHours();

  // Sort by score descending to prefer the best slot
  const sorted = [...slots].sort((a, b) => b.score - a.score);

  for (const slot of sorted) {
    let daysAhead = slot.dayOfWeek - currentDay;
    if (daysAhead < 0) daysAhead += 7;
    if (daysAhead === 0 && slot.hour <= currentHour) daysAhead += 7;

    const target = new Date(now);
    target.setDate(target.getDate() + daysAhead);
    target.setHours(slot.hour, 0, 0, 0);

    return { date: target, label: slot.label };
  }

  return null;
}
