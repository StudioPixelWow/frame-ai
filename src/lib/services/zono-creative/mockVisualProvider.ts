/**
 * Mock Visual Provider — Deterministic placeholder images for development
 *
 * Returns SVG data URLs with color-coded placeholders based on asset type.
 * Always available, no API keys required. Hebrew labels for mock descriptions.
 *
 * Server-side only.
 */
import type { VisualAssetType, VisualProvider } from '@/lib/db/schema';
import type {
  IVisualGenerationProvider,
  VisualGenerationRequest,
  VisualGenerationResult,
} from './visualGenerationProvider';

/** Color schemes per asset type — primary fill + accent */
const ASSET_TYPE_COLORS: Record<VisualAssetType, { bg: string; accent: string; label: string }> = {
  hero_image: { bg: '#1a1a2e', accent: '#e94560', label: 'תמונת גיבור' },
  advertising_visual: { bg: '#0f3460', accent: '#16c79a', label: 'ויזואל פרסומי' },
  background: { bg: '#2d2d2d', accent: '#666666', label: 'רקע' },
  project_render: { bg: '#1b262c', accent: '#3282b8', label: 'הדמיית פרויקט' },
  lifestyle_imagery: { bg: '#2c3e50', accent: '#e67e22', label: 'תמונת לייפסטייל' },
  scene_extension: { bg: '#1c1c3c', accent: '#8e44ad', label: 'הרחבת סצנה' },
  image_variation: { bg: '#2e4057', accent: '#048a81', label: 'וריאציית תמונה' },
  image_improvement: { bg: '#3c2a4d', accent: '#c0392b', label: 'שיפור תמונה' },
  image_upscale: { bg: '#1a3a3a', accent: '#1abc9c', label: 'הגדלת תמונה' },
  image_cleanup: { bg: '#2d3436', accent: '#dfe6e9', label: 'ניקוי תמונה' },
  object_replacement: { bg: '#2c3e50', accent: '#f39c12', label: 'החלפת אובייקט' },
  brand_visual: { bg: '#1a1a2e', accent: '#6c5ce7', label: 'ויזואל מותגי' },
};

/** Generate a single SVG placeholder as a data URL */
function generatePlaceholderSvg(
  width: number,
  height: number,
  colors: { bg: string; accent: string; label: string },
  index: number,
): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="grad${index}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${colors.bg};stop-opacity:1"/>
      <stop offset="100%" style="stop-color:${colors.accent};stop-opacity:0.7"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#grad${index})"/>
  <rect x="${width * 0.1}" y="${height * 0.3}" width="${width * 0.8}" height="${height * 0.4}" rx="12" fill="${colors.accent}" opacity="0.15"/>
  <text x="${width / 2}" y="${height * 0.45}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${Math.min(width, height) * 0.06}" fill="white" opacity="0.9">PIXEL Mock #${index + 1}</text>
  <text x="${width / 2}" y="${height * 0.55}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${Math.min(width, height) * 0.04}" fill="${colors.accent}" dir="rtl">${colors.label}</text>
  <text x="${width / 2}" y="${height * 0.65}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${Math.min(width, height) * 0.03}" fill="white" opacity="0.5">${width}x${height}</text>
</svg>`;
  const encoded = Buffer.from(svg).toString('base64');
  return `data:image/svg+xml;base64,${encoded}`;
}

export class MockVisualProvider implements IVisualGenerationProvider {
  provider: VisualProvider = 'mock';

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async generate(request: VisualGenerationRequest): Promise<VisualGenerationResult> {
    const count = Math.min(Math.max(request.count ?? 4, 1), 4);
    const colors = ASSET_TYPE_COLORS[request.assetType] ?? ASSET_TYPE_COLORS.brand_visual;

    // Simulate a short delay (200-500ms) to mimic real API calls
    await new Promise((resolve) => setTimeout(resolve, 200 + Math.random() * 300));

    const images = Array.from({ length: count }, (_, i) => {
      // Slightly vary colors per image by shifting hue
      const variedColors = {
        bg: colors.bg,
        accent: colors.accent,
        label: `${colors.label} - וריאציה ${i + 1}`,
      };

      return {
        url: generatePlaceholderSvg(request.width, request.height, variedColors, i),
        width: request.width,
        height: request.height,
        provider: this.provider as VisualProvider,
        metadata: {
          isMock: true,
          assetType: request.assetType,
          index: i,
          promptUsed: request.prompt.slice(0, 100),
          generatedAt: new Date().toISOString(),
          description: `תמונה מדומה - ${colors.label}`,
        },
      };
    });

    return {
      success: true,
      images,
      provider: this.provider,
    };
  }
}
