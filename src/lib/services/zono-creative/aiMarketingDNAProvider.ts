/**
 * Marketing DNA AI Provider — Interface + Factory
 *
 * Abstracts the Vision AI provider used for ZONO Marketing DNA analysis.
 * Controlled by ZONO_MARKETING_ANALYSIS_PROVIDER env var:
 *   - 'gemini'  → Gemini 2.0 Flash (Vision)
 *   - 'openai'  → GPT-4o (Vision)
 *   - 'mock'    → Metadata-only heuristic (default, no API key needed)
 *
 * Server-side only — never import this in client components.
 */

import type { BrandAsset, MarketingDNAResult } from '@/lib/db/schema';

/* ── Provider Parameter & Interface Types ──────────────────────────────── */

export interface MarketingDNAProviderParams {
  /** All prioritized assets to analyze (images + metadata-only) */
  assets: BrandAsset[];
  /** Entity type: agent, office, property, project, seller_recruitment, buyer_recruitment, neighborhood_authority */
  entityType: string;
  /** Unique entity identifier */
  entityId: string;
  /** Human-readable entity name (Hebrew) */
  entityName: string;
  /** Assets explicitly marked as approved references */
  approvedAssets: BrandAsset[];
  /** Assets explicitly marked as rejected references */
  rejectedAssets: BrandAsset[];
}

export interface MarketingDNAProvider {
  /** Provider display name for logging and job records */
  name: string;
  /** Run the full Marketing DNA analysis and return a normalized result */
  analyze(params: MarketingDNAProviderParams): Promise<MarketingDNAResult>;
}

/* ── Shared Constants ──────────────────────────────────────────────────── */

/** Maximum images to send to any Vision AI provider */
export const MAX_TOTAL_IMAGES = 18;

/** Per-category image limits for asset prioritization */
export const IMAGE_LIMITS = {
  approved: 5,
  rejected: 3,
  property: 4,    // property_photo, project_render, floor_plan
  logos: 2,       // logo, brand_guideline
  brochures: 2,   // brochure, website_screenshot
  neighborhood: 2, // neighborhood_reference, competitor
} as const;

/** MIME types considered as images for Vision AI */
export const IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/bmp',
  'image/tiff',
]);

/** Check if a MIME type is a supported image format */
export function isImageMime(mimeType: string | null | undefined): boolean {
  if (!mimeType) return false;
  return IMAGE_MIME_TYPES.has(mimeType.toLowerCase());
}

/* ── Entity Type Labels (Hebrew) ───────────────────────────────────────── */

export const ENTITY_TYPE_LABELS: Record<string, string> = {
  agent: 'סוכן נדל"ן',
  office: 'משרד תיווך',
  property: 'נכס למכירה/השכרה',
  project: 'פרויקט יזמי',
  seller_recruitment: 'גיוס מוכרים',
  buyer_recruitment: 'גיוס קונים',
  neighborhood_authority: 'סמכות שכונתית',
};

/* ── Factory ───────────────────────────────────────────────────────────── */

/**
 * Returns the configured Marketing DNA provider.
 * Uses lazy imports to avoid loading unused provider modules.
 */
export function getMarketingDNAProvider(): MarketingDNAProvider {
  const provider = process.env.ZONO_MARKETING_ANALYSIS_PROVIDER || 'mock';

  switch (provider) {
    case 'gemini': {
      if (!process.env.GEMINI_API_KEY) {
        console.warn(
          '[MarketingDNA] GEMINI_API_KEY missing, falling back to mock provider',
        );
        return getMockProvider();
      }
      return getGeminiProvider();
    }
    case 'openai': {
      if (!process.env.OPENAI_API_KEY) {
        console.warn(
          '[MarketingDNA] OPENAI_API_KEY missing, falling back to mock provider',
        );
        return getMockProvider();
      }
      return getOpenAIProvider();
    }
    case 'mock':
    default:
      return getMockProvider();
  }
}

/* ── Lazy Provider Loaders ─────────────────────────────────────────────── */

function getGeminiProvider(): MarketingDNAProvider {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { geminiMarketingDNAProvider } = require('./geminiMarketingDNAProvider');
  return geminiMarketingDNAProvider;
}

function getOpenAIProvider(): MarketingDNAProvider {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { openaiMarketingDNAProvider } = require('./openaiMarketingDNAProvider');
  return openaiMarketingDNAProvider;
}

function getMockProvider(): MarketingDNAProvider {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { mockMarketingDNAProvider } = require('./mockMarketingDNAProvider');
  return mockMarketingDNAProvider;
}
