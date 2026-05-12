/**
 * AI Image Generation Service for SEO Articles
 * Uses OpenAI DALL-E API to generate ultra-realistic featured images
 */

import { getApiKeys } from '@/lib/db/api-keys';

export interface ImageGenerationResult {
  success: boolean;
  imageUrl?: string;       // DALL-E generated URL (temporary)
  imageBuffer?: Buffer;    // Downloaded image buffer (for WP upload)
  error?: string;
}

/**
 * Generate an ultra-realistic featured image for an SEO article
 */
export async function generateArticleImage(
  articleTitle: string,
  keyword: string,
  businessType: string,
  options?: { size?: '1024x1024' | '1792x1024' | '1024x1792' }
): Promise<ImageGenerationResult> {
  // Use same key resolution as the rest of the system: env var → settings UI → api-keys file
  const apiKeys = getApiKeys();
  const apiKey = apiKeys.openai;
  if (!apiKey) {
    console.error('[IMAGE-GEN] No OpenAI API key found (env, settings, or api-keys file)');
    return { success: false, error: 'Missing OpenAI API key — הגדר מפתח API בהגדרות המערכת' };
  }

  // Build a detailed prompt for ultra-realistic image
  const prompt = buildImagePrompt(articleTitle, keyword, businessType);

  try {
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt,
        n: 1,
        size: options?.size || '1792x1024', // Landscape for blog featured images
        quality: 'hd',
        style: 'natural', // Ultra-realistic
      }),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      const errorMsg = (errorBody as any)?.error?.message || response.statusText;
      return { success: false, error: `DALL-E API error (${response.status}): ${errorMsg}` };
    }

    const result = await response.json();
    const imageUrl = result.data?.[0]?.url;

    if (!imageUrl) {
      return { success: false, error: 'No image URL returned from DALL-E' };
    }

    // Download the image as buffer for WordPress upload
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      return { success: true, imageUrl, error: 'Image generated but download failed' };
    }

    const arrayBuffer = await imageResponse.arrayBuffer();
    const imageBuffer = Buffer.from(arrayBuffer);

    console.log(`[IMAGE-GEN] Generated image for "${articleTitle}" (${imageBuffer.length} bytes)`);

    return {
      success: true,
      imageUrl,
      imageBuffer,
    };
  } catch (error) {
    return {
      success: false,
      error: `Image generation failed: ${error instanceof Error ? error.message : 'Unknown'}`,
    };
  }
}

/**
 * Build a detailed DALL-E prompt for ultra-realistic article images
 */
function buildImagePrompt(articleTitle: string, keyword: string, businessType: string): string {
  // Clean title for prompt
  const cleanTitle = articleTitle
    .replace(/["""]/g, '')
    .replace(/\d{4}/g, '')
    .trim();

  return `Ultra-realistic, professional photograph for a blog article about "${cleanTitle}".
The image should represent the concept of "${keyword}" in the context of ${businessType || 'business'}.
Style: High-end editorial photography, cinematic lighting, shallow depth of field,
warm professional color palette. NO text, NO watermarks, NO logos, NO letters in the image.
The image should feel premium, modern, and suitable as a featured image for a professional website.
Aspect ratio: landscape (16:9), high detail, photorealistic.`;
}
