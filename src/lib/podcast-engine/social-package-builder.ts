/**
 * FrameAI — Social Package Builder for AI Clip Engine
 *
 * Assembles platform-ready social media packages from clip data,
 * hook packages, and thumbnails. Exports metadata JSON and CSV.
 */

import type { PodcastClipCandidate, ClipHookPackage } from "@/lib/db/schema";

// ── Types ──────────────────────────────────────────────────────────────────

/** Matches the socialPackage field on PodcastRenderedClip in schema.ts. */
export interface SocialPackageData {
  platform: string;
  title: string;
  caption: string;
  hashtags: string[];
  cta: string;
  thumbnailPath: string | null;
  videoPath: string | null;
  recommendedPostTime: string | null;
  altText: string;
  clipDuration: number;
  sourceEpisode: string;
}

// ── Constants ──────────────────────────────────────────────────────────────

/** Recommended posting windows per platform (IL timezone context). */
const RECOMMENDED_POST_TIMES: Record<string, string> = {
  youtube: "17:00",
  instagram: "12:00",
  tiktok: "20:00",
  linkedin: "08:30",
  twitter: "13:00",
  facebook: "11:00",
};

/** Platform-specific alt-text templates (Hebrew). */
const ALT_TEXT_TEMPLATES: Record<string, (title: string) => string> = {
  youtube: (t) => `קליפ וידאו מפודקאסט: ${t}`,
  instagram: (t) => `רילס מפודקאסט: ${t}`,
  tiktok: (t) => `סרטון קצר מפודקאסט: ${t}`,
  linkedin: (t) => `סרטון מקצועי מפודקאסט: ${t}`,
  twitter: (t) => `קליפ קצר: ${t}`,
  facebook: (t) => `סרטון מפודקאסט: ${t}`,
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function buildAltText(title: string, platform: string): string {
  const builder = ALT_TEXT_TEMPLATES[platform];
  return builder ? builder(title) : `קליפ מפודקאסט: ${title}`;
}

function computeClipDuration(clip: PodcastClipCandidate): number {
  const start = clip.userAdjustedStart ?? clip.startTime;
  const end = clip.userAdjustedEnd ?? clip.endTime;
  return Math.max(0, end - start);
}

// ── Main exports ───────────────────────────────────────────────────────────

/**
 * Build a complete social media package for a single clip.
 *
 * Merges clip metadata, hook content, thumbnail paths, and platform
 * configuration into a ready-to-publish SocialPackageData object.
 *
 * @param clip            The clip candidate with timing and metadata.
 * @param hookPackage     Generated hook content (titles, caption, CTA, hashtags).
 * @param thumbnailPaths  Array of generated thumbnail file paths.
 * @param platform        Target social platform (youtube/instagram/tiktok/etc.).
 * @returns               Complete SocialPackageData ready for export.
 */
export function buildSocialPackage(
  clip: PodcastClipCandidate,
  hookPackage: ClipHookPackage,
  thumbnailPaths: string[],
  platform: string
): SocialPackageData {
  const title = hookPackage.titles[0] || clip.title;
  const duration = computeClipDuration(clip);

  return {
    platform,
    title,
    caption: hookPackage.caption,
    hashtags: hookPackage.hashtags,
    cta: hookPackage.cta,
    thumbnailPath: thumbnailPaths.length > 0 ? thumbnailPaths[0] : null,
    videoPath: null, // set after render
    recommendedPostTime: RECOMMENDED_POST_TIMES[platform] ?? null,
    altText: buildAltText(title, platform),
    clipDuration: duration,
    sourceEpisode: clip.episodeId,
  };
}

/**
 * Generate a metadata.json string from an array of social packages.
 *
 * Produces a formatted JSON document suitable for batch upload tools
 * or manual review of all clip packages in a session.
 *
 * @param clips  Array of SocialPackageData objects.
 * @returns      Pretty-printed JSON string.
 */
export function buildMetadataJson(clips: SocialPackageData[]): string {
  const metadata = {
    version: "1.0",
    generatedAt: new Date().toISOString(),
    totalClips: clips.length,
    platforms: [...new Set(clips.map((c) => c.platform))],
    clips: clips.map((clip, index) => ({
      index: index + 1,
      ...clip,
    })),
  };

  return JSON.stringify(metadata, null, 2);
}

/**
 * Generate a CSV export string from an array of social packages.
 *
 * Columns: title, caption, hashtags, cta
 * Uses standard CSV escaping (double-quote fields containing commas/newlines).
 *
 * @param clips  Array of SocialPackageData objects.
 * @returns      CSV string with header row and one data row per clip.
 */
export function buildCsvExport(clips: SocialPackageData[]): string {
  const header = "title,caption,hashtags,cta";

  const rows = clips.map((clip) => {
    const title = escapeCsvField(clip.title);
    const caption = escapeCsvField(clip.caption);
    const hashtags = escapeCsvField(
      clip.hashtags.map((h) => `#${h}`).join(" ")
    );
    const cta = escapeCsvField(clip.cta);
    return `${title},${caption},${hashtags},${cta}`;
  });

  return [header, ...rows].join("\n");
}

// ── CSV helpers ────────────────────────────────────────────────────────────

function escapeCsvField(value: string): string {
  if (
    value.includes(",") ||
    value.includes('"') ||
    value.includes("\n") ||
    value.includes("\r")
  ) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
