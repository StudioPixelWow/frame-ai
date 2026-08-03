/**
 * OpenAI Image Provider — gpt-image-2
 *
 * Generates and edits images using the OpenAI gpt-image-2 model.
 * Supports both the generations endpoint (text-to-image) and the
 * edits endpoint (image-to-image with reference images).
 *
 * Key differences from DALL-E 3:
 * - Flexible sizes (multiples of 16px, max 3840px per edge)
 * - Supports n > 1 in a single request
 * - Response format is always b64_json
 * - Quality options: low | medium | high | auto
 * - Edits endpoint supports up to 16 reference images
 *
 * Server-side only.
 */

const OPENAI_IMAGES_ENDPOINT = 'https://api.openai.com/v1/images/generations';
const OPENAI_EDITS_ENDPOINT = 'https://api.openai.com/v1/images/edits';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ImageGenerateParams {
  prompt: string;
  width?: number;
  height?: number;
  quality?: 'low' | 'medium' | 'high' | 'auto';
  outputFormat?: 'png' | 'jpeg' | 'webp';
  n?: number;
}

export interface ImageEditParams {
  prompt: string;
  referenceImages: Buffer[]; // up to 16 reference images
  width?: number;
  height?: number;
  quality?: 'low' | 'medium' | 'high' | 'auto';
  outputFormat?: 'png' | 'jpeg' | 'webp';
}

export interface ImageGenerationResult {
  success: boolean;
  images: Array<{
    base64: string;
    revisedPrompt?: string;
  }>;
  error?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getApiKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('Missing OPENAI_API_KEY environment variable');
  return key;
}

/**
 * Clamp a dimension to a valid gpt-image-2 value:
 * must be a multiple of 16, between 16 and 3840.
 */
function clampDimension(value: number): number {
  const clamped = Math.max(16, Math.min(3840, value));
  return Math.round(clamped / 16) * 16;
}

/**
 * Build the size string for gpt-image-2.
 * Format: "{width}x{height}" with each dimension a multiple of 16.
 */
function buildSize(width?: number, height?: number): string {
  const w = clampDimension(width ?? 1024);
  const h = clampDimension(height ?? 1024);
  return `${w}x${h}`;
}

/** Parse an OpenAI error response body into a readable message */
async function parseErrorBody(response: Response): Promise<string> {
  try {
    const body = await response.json();
    return body?.error?.message || response.statusText;
  } catch {
    try {
      return await response.text();
    } catch {
      return response.statusText;
    }
  }
}

// ---------------------------------------------------------------------------
// generateImage — text-to-image via /v1/images/generations
// ---------------------------------------------------------------------------

export async function generateImage(
  params: ImageGenerateParams,
): Promise<ImageGenerationResult> {
  try {
    const apiKey = getApiKey();
    const size = buildSize(params.width, params.height);
    const n = Math.max(1, Math.min(params.n ?? 1, 8));

    const response = await fetch(OPENAI_IMAGES_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-image-2',
        prompt: params.prompt,
        size,
        quality: params.quality ?? 'high',
        n,
        background: 'opaque',
        output_format: params.outputFormat ?? 'png',
      }),
    });

    if (!response.ok) {
      const errorMessage = await parseErrorBody(response);
      return {
        success: false,
        images: [],
        error: `OpenAI API error (${response.status}): ${errorMessage}`,
      };
    }

    const result = await response.json();
    const dataArray: any[] = result.data ?? [];

    if (!dataArray.length) {
      return {
        success: false,
        images: [],
        error: 'No image data returned from OpenAI',
      };
    }

    const images = dataArray.map((item: any) => ({
      base64: item.b64_json ?? '',
      revisedPrompt: item.revised_prompt ?? undefined,
    }));

    return { success: true, images };
  } catch (err) {
    return {
      success: false,
      images: [],
      error: `Network error: ${err instanceof Error ? err.message : 'Unknown'}`,
    };
  }
}

// ---------------------------------------------------------------------------
// editImage — image-to-image via /v1/images/edits (multipart/form-data)
// ---------------------------------------------------------------------------

export async function editImage(
  params: ImageEditParams,
): Promise<ImageGenerationResult> {
  try {
    const apiKey = getApiKey();
    const size = buildSize(params.width, params.height);

    if (!params.referenceImages.length) {
      return {
        success: false,
        images: [],
        error: 'At least one reference image is required for edits',
      };
    }

    if (params.referenceImages.length > 16) {
      return {
        success: false,
        images: [],
        error: 'Maximum 16 reference images allowed',
      };
    }

    // Build multipart/form-data
    const formData = new FormData();
    formData.append('model', 'gpt-image-2');
    formData.append('prompt', params.prompt);
    formData.append('size', size);
    formData.append('quality', params.quality ?? 'high');
    formData.append('background', 'opaque');
    formData.append('output_format', params.outputFormat ?? 'png');

    // Append each reference image as "image[]"
    for (let i = 0; i < params.referenceImages.length; i++) {
      const buf = params.referenceImages[i];
      const blob = new Blob([buf], { type: 'image/png' });
      formData.append('image[]', blob, `reference_${i}.png`);
    }

    const response = await fetch(OPENAI_EDITS_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        // Content-Type is set automatically by fetch for FormData
      },
      body: formData,
    });

    if (!response.ok) {
      const errorMessage = await parseErrorBody(response);
      return {
        success: false,
        images: [],
        error: `OpenAI Edits API error (${response.status}): ${errorMessage}`,
      };
    }

    const result = await response.json();
    const dataArray: any[] = result.data ?? [];

    if (!dataArray.length) {
      return {
        success: false,
        images: [],
        error: 'No image data returned from OpenAI edits endpoint',
      };
    }

    const images = dataArray.map((item: any) => ({
      base64: item.b64_json ?? '',
      revisedPrompt: item.revised_prompt ?? undefined,
    }));

    return { success: true, images };
  } catch (err) {
    return {
      success: false,
      images: [],
      error: `Network error: ${err instanceof Error ? err.message : 'Unknown'}`,
    };
  }
}
