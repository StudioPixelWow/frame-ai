/**
 * Gemini Visual Provider — Image generation via Google Imagen 3
 *
 * Uses the Gemini generativelanguage API to generate images via Imagen 3.
 * Requires GEMINI_API_KEY environment variable.
 *
 * Server-side only.
 */
import type { VisualProvider } from '@/lib/db/schema';
import type {
  IVisualGenerationProvider,
  VisualGenerationRequest,
  VisualGenerationResult,
} from './visualGenerationProvider';

const GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict';

/** Map width x height to Gemini aspect ratio string */
function getAspectRatio(width: number, height: number): string {
  const ratio = width / height;
  if (ratio > 1.6) return '16:9';
  if (ratio > 1.2) return '4:3';
  if (ratio < 0.65) return '9:16';
  if (ratio < 0.85) return '3:4';
  return '1:1';
}

export class GeminiVisualProvider implements IVisualGenerationProvider {
  provider: VisualProvider = 'gemini';

  async isAvailable(): Promise<boolean> {
    return !!process.env.GEMINI_API_KEY;
  }

  async generate(request: VisualGenerationRequest): Promise<VisualGenerationResult> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return {
        success: false,
        images: [],
        error: 'Missing GEMINI_API_KEY environment variable',
        provider: this.provider,
      };
    }

    const sampleCount = Math.min(Math.max(request.count ?? 1, 1), 4);
    const aspectRatio = getAspectRatio(request.width, request.height);

    try {
      const response = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instances: [{ prompt: request.prompt }],
          parameters: {
            sampleCount,
            aspectRatio,
          },
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        return {
          success: false,
          images: [],
          error: `Gemini API error (${response.status}): ${errorBody}`,
          provider: this.provider,
        };
      }

      const result = await response.json();
      const predictions = result.predictions ?? [];

      if (predictions.length === 0) {
        return {
          success: false,
          images: [],
          error: 'Gemini returned no predictions',
          provider: this.provider,
        };
      }

      const images = predictions.map((pred: any, idx: number) => {
        const base64Data = pred.bytesBase64Encoded ?? pred.image?.bytesBase64Encoded ?? '';
        const mimeType = pred.mimeType ?? 'image/png';
        return {
          url: `data:${mimeType};base64,${base64Data}`,
          width: request.width,
          height: request.height,
          provider: this.provider as VisualProvider,
          metadata: {
            aspectRatio,
            index: idx,
            modelVersion: 'imagen-3.0-generate-002',
            generatedAt: new Date().toISOString(),
          },
        };
      });

      return {
        success: true,
        images,
        provider: this.provider,
      };
    } catch (err) {
      return {
        success: false,
        images: [],
        error: `Gemini network error: ${err instanceof Error ? err.message : 'Unknown'}`,
        provider: this.provider,
      };
    }
  }
}
