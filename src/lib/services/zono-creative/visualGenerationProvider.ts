/**
 * Visual Generation Provider — Interface abstraction for image generation
 *
 * Defines a standard interface for visual generation providers (Gemini, OpenAI, Mock).
 * Factory function `getVisualProvider()` returns the active provider based on env config.
 *
 * Server-side only.
 */
import type { VisualAssetType, VisualProvider } from '@/lib/db/schema';

export interface VisualGenerationRequest {
  prompt: string;
  negativePrompt?: string;
  width: number;
  height: number;
  assetType: VisualAssetType;
  style?: string;
  count?: number; // how many images to generate (1-4)
}

export interface VisualGenerationResult {
  success: boolean;
  images: Array<{
    url: string; // base64 data URL or remote URL
    width: number;
    height: number;
    provider: VisualProvider;
    metadata: Record<string, any>;
  }>;
  error?: string;
  provider: VisualProvider;
}

export interface IVisualGenerationProvider {
  provider: VisualProvider;
  generate(request: VisualGenerationRequest): Promise<VisualGenerationResult>;
  isAvailable(): Promise<boolean>;
}

export function getVisualProvider(): IVisualGenerationProvider {
  const providerName = process.env.VISUAL_PROVIDER || 'mock';
  switch (providerName) {
    case 'gemini': {
      const { GeminiVisualProvider } = require('./geminiVisualProvider');
      return new GeminiVisualProvider();
    }
    case 'openai': {
      const { OpenAIVisualProvider } = require('./openaiVisualProvider');
      return new OpenAIVisualProvider();
    }
    default: {
      const { MockVisualProvider } = require('./mockVisualProvider');
      return new MockVisualProvider();
    }
  }
}
