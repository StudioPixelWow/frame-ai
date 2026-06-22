/**
 * OpenAI Vision Marketing DNA Provider
 *
 * Uses GPT-4o (Vision) to analyze brand assets with actual image
 * understanding. Downloads images from Supabase Storage, converts to base64,
 * and sends to OpenAI's Chat Completions API with image_url content parts.
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

const OPENAI_MODEL = 'gpt-4o';
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

/* ── Provider Implementation ───────────────────────────────────────────── */

async function analyze(params: MarketingDNAProviderParams): Promise<MarketingDNAResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('[OpenAIDNA] OPENAI_API_KEY is not configured');
  }

  const { assets, entityType, entityId, entityName, approvedAssets, rejectedAssets } = params;

  // ── Build content parts for OpenAI multimodal message ────────────────
  const contentParts: Array<Record<string, any>> = [];
  const textAssetDescriptions: string[] = [];

  for (const asset of assets) {
    if (isImageMime(asset.fileMimeType)) {
      try {
        const imageData = await getAssetImageBase64(asset);
        if (imageData) {
          contentParts.push({
            type: 'image_url',
            image_url: {
              url: `data:${imageData.mimeType};base64,${imageData.base64}`,
              detail: 'low', // 'low' to reduce token cost; switch to 'auto' for higher fidelity
            },
          });
        }
      } catch (err) {
        console.warn(
          `[OpenAIDNA] Failed to load image for asset ${asset.id}:`,
          err instanceof Error ? err.message : String(err),
        );
      }
    }

    // Always include metadata for every asset (image or not)
    const meta = buildAssetMetadataText(asset, approvedAssets, rejectedAssets);
    if (meta) textAssetDescriptions.push(meta);
  }

  console.log(
    `[OpenAIDNA] Analyzing entity=${entityId} type=${entityType} ` +
    `images=${contentParts.length} textDescriptions=${textAssetDescriptions.length}`,
  );

  // ── Build OpenAI request ────────────────────────────────────────────
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

  // Text prompt goes first, then image parts
  const userContentParts: Array<Record<string, any>> = [
    { type: 'text', text: userPrompt },
    ...contentParts,
  ];

  const requestBody = {
    model: OPENAI_MODEL,
    messages: [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: userContentParts,
      },
    ],
    temperature: 0.2,
    max_tokens: 4096,
    response_format: { type: 'json_object' },
  };

  // ── Call OpenAI API ─────────────────────────────────────────────────
  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'no body');
    throw new Error(
      `[OpenAIDNA] API request failed (${response.status}): ${errorText.slice(0, 500)}`,
    );
  }

  const responseData = await response.json();

  // ── Parse response ──────────────────────────────────────────────────
  const messageContent = responseData?.choices?.[0]?.message?.content;
  if (!messageContent) {
    throw new Error('[OpenAIDNA] Empty response content from API');
  }

  const result = parseJSONResponse(messageContent);
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
      `[OpenAIDNA] Failed to parse JSON response: ${err instanceof Error ? err.message : String(err)}. ` +
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

export const openaiMarketingDNAProvider: MarketingDNAProvider = {
  name: 'openai',
  analyze,
};
