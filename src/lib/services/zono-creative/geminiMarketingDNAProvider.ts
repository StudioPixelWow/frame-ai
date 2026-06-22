/**
 * Gemini Vision Marketing DNA Provider
 *
 * Uses Gemini 2.0 Flash (Vision) to analyze brand assets with actual image
 * understanding. Downloads images from Supabase Storage, converts to base64,
 * and sends to Gemini's multimodal API.
 *
 * Server-side only — never import in client components.
 */

import type { BrandAsset, MarketingDNAResult } from '@/lib/db/schema';
import type {
  MarketingDNAProvider,
  MarketingDNAProviderParams,
} from './aiMarketingDNAProvider';
import {
  isImageMime,
} from './aiMarketingDNAProvider';
import { getAssetImageBase64 } from './marketingAnalysisService';
import { buildMarketingDNASystemPrompt, buildMarketingDNAUserPrompt } from './marketingDNAPrompts';

/* ── Constants ─────────────────────────────────────────────────────────── */

const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

/* ── Provider Implementation ───────────────────────────────────────────── */

async function analyze(params: MarketingDNAProviderParams): Promise<MarketingDNAResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('[GeminiDNA] GEMINI_API_KEY is not configured');
  }

  const { assets, entityType, entityId, entityName, approvedAssets, rejectedAssets } = params;

  // ── Build image parts for Gemini multimodal request ──────────────────
  const imageParts: Array<{ inline_data: { mime_type: string; data: string } }> = [];
  const textAssetDescriptions: string[] = [];

  for (const asset of assets) {
    if (isImageMime(asset.fileMimeType)) {
      try {
        const imageData = await getAssetImageBase64(asset);
        if (imageData) {
          imageParts.push({
            inline_data: {
              mime_type: imageData.mimeType,
              data: imageData.base64,
            },
          });
        }
      } catch (err) {
        console.warn(
          `[GeminiDNA] Failed to load image for asset ${asset.id}:`,
          err instanceof Error ? err.message : String(err),
        );
      }
    }

    // Always include metadata for every asset (image or not)
    const meta = buildAssetMetadataText(asset, approvedAssets, rejectedAssets);
    if (meta) textAssetDescriptions.push(meta);
  }

  console.log(
    `[GeminiDNA] Analyzing entity=${entityId} type=${entityType} ` +
    `images=${imageParts.length} textDescriptions=${textAssetDescriptions.length}`,
  );

  // ── Build Gemini request ────────────────────────────────────────────
  const systemPrompt = buildMarketingDNASystemPrompt(entityType, entityName);
  const userPrompt = buildMarketingDNAUserPrompt({
    entityType,
    entityName,
    entityId,
    totalAssets: assets.length,
    approvedCount: approvedAssets.length,
    rejectedCount: rejectedAssets.length,
    assetDescriptions: textAssetDescriptions,
  });

  // Gemini content parts: text prompt first, then images
  const userParts: Array<Record<string, any>> = [
    { text: userPrompt },
    ...imageParts,
  ];

  const requestBody = {
    system_instruction: {
      parts: [{ text: systemPrompt }],
    },
    contents: [
      {
        role: 'user',
        parts: userParts,
      },
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 4096,
      responseMimeType: 'application/json',
    },
  };

  // ── Call Gemini API ─────────────────────────────────────────────────
  const url = `${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'no body');
    throw new Error(
      `[GeminiDNA] API request failed (${response.status}): ${errorText.slice(0, 500)}`,
    );
  }

  const responseData = await response.json();

  // ── Parse response ──────────────────────────────────────────────────
  const candidate = responseData?.candidates?.[0];
  if (!candidate) {
    throw new Error('[GeminiDNA] No candidates in response');
  }

  const textContent = candidate.content?.parts?.[0]?.text;
  if (!textContent) {
    throw new Error('[GeminiDNA] Empty text content in response');
  }

  const result = parseJSONResponse(textContent);
  return result;
}

/* ── Helpers ───────────────────────────────────────────────────────────── */

/**
 * Build a text description of an asset's metadata for the prompt.
 */
function buildAssetMetadataText(
  asset: BrandAsset,
  approvedAssets: BrandAsset[],
  rejectedAssets: BrandAsset[],
): string {
  const isApproved = approvedAssets.some((a) => a.id === asset.id);
  const isRejected = rejectedAssets.some((a) => a.id === asset.id);
  const statusLabel = isApproved ? '[מאושר]' : isRejected ? '[נדחה]' : '';

  const parts: string[] = [
    `${statusLabel} ${asset.assetType}: ${asset.title || asset.fileName}`,
  ];

  if (asset.description) parts.push(`  תיאור: ${asset.description}`);
  if (asset.tags?.length) parts.push(`  תגיות: ${asset.tags.join(', ')}`);
  if (asset.aiSummary) parts.push(`  סיכום AI: ${asset.aiSummary}`);

  return parts.join('\n');
}

/**
 * Parse a JSON response from the AI, stripping markdown code fences if present.
 */
function parseJSONResponse(text: string): MarketingDNAResult {
  // Strip markdown code fences (```json ... ``` or ``` ... ```)
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }

  try {
    const parsed = JSON.parse(cleaned);
    return validateMarketingDNAResult(parsed);
  } catch (err) {
    throw new Error(
      `[GeminiDNA] Failed to parse JSON response: ${err instanceof Error ? err.message : String(err)}. ` +
      `Raw text (first 300 chars): ${text.slice(0, 300)}`,
    );
  }
}

/**
 * Ensure the parsed object has all required MarketingDNAResult fields with safe defaults.
 */
function validateMarketingDNAResult(raw: Record<string, any>): MarketingDNAResult {
  return {
    dna_summary: String(raw.dna_summary ?? ''),
    visual_personality: String(raw.visual_personality ?? ''),
    copywriting_tone: String(raw.copywriting_tone ?? ''),
    real_estate_positioning: String(raw.real_estate_positioning ?? ''),
    primary_colors: Array.isArray(raw.primary_colors) ? raw.primary_colors : [],
    secondary_colors: Array.isArray(raw.secondary_colors) ? raw.secondary_colors : [],
    accent_colors: Array.isArray(raw.accent_colors) ? raw.accent_colors : [],
    forbidden_colors: Array.isArray(raw.forbidden_colors) ? raw.forbidden_colors : [],
    preferred_typography: (raw.preferred_typography && typeof raw.preferred_typography === 'object') ? raw.preferred_typography : {},
    forbidden_typography: (raw.forbidden_typography && typeof raw.forbidden_typography === 'object') ? raw.forbidden_typography : {},
    preferred_layouts: Array.isArray(raw.preferred_layouts) ? raw.preferred_layouts : [],
    rejected_layouts: Array.isArray(raw.rejected_layouts) ? raw.rejected_layouts : [],
    preferred_visual_styles: Array.isArray(raw.preferred_visual_styles) ? raw.preferred_visual_styles : [],
    rejected_visual_styles: Array.isArray(raw.rejected_visual_styles) ? raw.rejected_visual_styles : [],
    preferred_image_styles: Array.isArray(raw.preferred_image_styles) ? raw.preferred_image_styles : [],
    rejected_image_styles: Array.isArray(raw.rejected_image_styles) ? raw.rejected_image_styles : [],
    preferred_campaign_angles: Array.isArray(raw.preferred_campaign_angles) ? raw.preferred_campaign_angles : [],
    rejected_campaign_angles: Array.isArray(raw.rejected_campaign_angles) ? raw.rejected_campaign_angles : [],
    preferred_cta_styles: Array.isArray(raw.preferred_cta_styles) ? raw.preferred_cta_styles : [],
    whatsapp_cta_style: (raw.whatsapp_cta_style && typeof raw.whatsapp_cta_style === 'object') ? raw.whatsapp_cta_style : {},
    target_audiences: Array.isArray(raw.target_audiences) ? raw.target_audiences : [],
    property_marketing_style: (raw.property_marketing_style && typeof raw.property_marketing_style === 'object') ? raw.property_marketing_style : {},
    project_marketing_style: (raw.project_marketing_style && typeof raw.project_marketing_style === 'object') ? raw.project_marketing_style : {},
    agent_marketing_style: (raw.agent_marketing_style && typeof raw.agent_marketing_style === 'object') ? raw.agent_marketing_style : {},
    seller_recruitment_style: (raw.seller_recruitment_style && typeof raw.seller_recruitment_style === 'object') ? raw.seller_recruitment_style : {},
    buyer_recruitment_style: (raw.buyer_recruitment_style && typeof raw.buyer_recruitment_style === 'object') ? raw.buyer_recruitment_style : {},
    neighborhood_storytelling_style: (raw.neighborhood_storytelling_style && typeof raw.neighborhood_storytelling_style === 'object') ? raw.neighborhood_storytelling_style : {},
    brand_rules: Array.isArray(raw.brand_rules) ? raw.brand_rules : [],
    avoid_rules: Array.isArray(raw.avoid_rules) ? raw.avoid_rules : [],
    approved_patterns: Array.isArray(raw.approved_patterns) ? raw.approved_patterns : [],
    rejected_patterns: Array.isArray(raw.rejected_patterns) ? raw.rejected_patterns : [],
    luxury_score: clampScore(raw.luxury_score),
    urgency_score: clampScore(raw.urgency_score),
    modern_score: clampScore(raw.modern_score),
    sales_aggressiveness_score: clampScore(raw.sales_aggressiveness_score),
    investment_focus_score: clampScore(raw.investment_focus_score),
    lifestyle_focus_score: clampScore(raw.lifestyle_focus_score),
    seller_focus_score: clampScore(raw.seller_focus_score),
    buyer_focus_score: clampScore(raw.buyer_focus_score),
    visual_density_score: clampScore(raw.visual_density_score),
    ai_generated_score: clampScore(raw.ai_generated_score),
    ai_confidence_score: clampScore(raw.ai_confidence_score),
  };
}

function clampScore(val: any): number {
  const n = Number(val);
  if (isNaN(n)) return 50;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/* ── Export ─────────────────────────────────────────────────────────────── */

export const geminiMarketingDNAProvider: MarketingDNAProvider = {
  name: 'gemini',
  analyze,
};
