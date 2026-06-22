/**
 * OpenAI Visual Provider — Image generation via DALL-E 3
 *
 * Uses the OpenAI Images API with DALL-E 3. Note: DALL-E 3 only supports
 * n=1 per request, so multiple images are generated via sequential calls.
 * Requires OPENAI_API_KEY environment variable.
 *
 * Server-side only.
 */
import type { VisualProvider } from '@/lib/db/schema';
import type {
  IVisualGenerationProvider,
  VisualGenerationRequest,
  VisualGenerationResult,
} from './visualGenerationProvider';

const OPENAI_IMAGES_ENDPOINT = 'https://api.openai.com/v1/images/generations';

/** Map requested dimensions to the closest DALL-E 3 supported size */
function mapToDalleSize(width: number, height: number): string {
  const ratio = width / height;
  if (ratio > 1.3) return '1792x1024'; // landscape
  if (ratio < 0.77) return '1024x1792'; // portrait
  return '1024x1024'; // square
}

export class OpenAIVisualProvider implements IVisualGenerationProvider {
  provider: VisualProvider = 'openai';

  async isAvailable(): Promise<boolean> {
    return !!process.env.OPENAI_API_KEY;
  }

  async generate(request: VisualGenerationRequest): Promise<VisualGenerationResult> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return {
        success: false,
        images: [],
        error: 'Missing OPENAI_API_KEY environment variable',
        provider: this.provider,
      };
    }

    const count = Math.min(Math.max(request.count ?? 1, 1), 4);
    const size = mapToDalleSize(request.width, request.height);

    const images: VisualGenerationResult['images'] = [];
    const errors: string[] = [];

    // DALL-E 3 only supports n=1, so loop for multiple images
    for (let i = 0; i < count; i++) {
      try {
        const response = await fetch(OPENAI_IMAGES_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: 'dall-e-3',
            prompt: request.prompt,
            size,
            quality: 'hd',
            n: 1,
          }),
        });

        if (!response.ok) {
          let errorMessage = response.statusText;
          try {
            const errorBody = await response.json();
            errorMessage = errorBody?.error?.message || response.statusText;
          } catch {
            errorMessage = await response.text();
          }
          errors.push(`Image ${i + 1}: OpenAI API error (${response.status}): ${errorMessage}`);
          continue;
        }

        const result = await response.json();
        const imageData = result.data?.[0];

        if (!imageData) {
          errors.push(`Image ${i + 1}: No image data in response`);
          continue;
        }

        const [wStr, hStr] = size.split('x');
        images.push({
          url: imageData.url ?? '',
          width: parseInt(wStr, 10),
          height: parseInt(hStr, 10),
          provider: this.provider,
          metadata: {
            revisedPrompt: imageData.revised_prompt ?? '',
            model: 'dall-e-3',
            quality: 'hd',
            requestedSize: size,
            index: i,
            generatedAt: new Date().toISOString(),
          },
        });
      } catch (err) {
        errors.push(
          `Image ${i + 1}: Network error: ${err instanceof Error ? err.message : 'Unknown'}`,
        );
      }
    }

    if (images.length === 0) {
      return {
        success: false,
        images: [],
        error: errors.join('; '),
        provider: this.provider,
      };
    }

    return {
      success: true,
      images,
      error: errors.length > 0 ? errors.join('; ') : undefined,
      provider: this.provider,
    };
  }
}
