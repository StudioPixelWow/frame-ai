/**
 * Creative Director Service
 *
 * Before any image is generated, this service acts as an AI Creative Director.
 * It takes the raw brief + brand intelligence and produces a full Creative Strategy
 * with an optimized prompt for the image generation model.
 *
 * Uses GPT-4.1 (chat completions) to transform a brief into a detailed
 * creative direction — composition, lighting, color palette, mood, typography,
 * element placement, and a refined image-generation prompt.
 *
 * Server-side only.
 */

import type { GenerationContext } from './generationContextBuilder';
import type { BrandIntelligence } from './brandIntelligenceService';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface CreativeStrategy {
  /** The core message the visual should communicate */
  centralMessage: string;
  /** The creative concept / big idea */
  creativeIdea: string;
  /** Information hierarchy — what the eye should see first, second, third */
  informationHierarchy: string[];
  /** Composition direction */
  composition: string;
  /** Lighting style */
  lighting: string;
  /** Camera angle / perspective */
  cameraAngle: string;
  /** Color palette to use (derived from brand + creative intent) */
  colorPalette: string[];
  /** Overall visual style */
  style: string;
  /** Mood / atmosphere */
  mood: string;
  /** Type of visual — photo, illustration, 3D render, etc. */
  visualType: string;
  /** Element placement description */
  elementPlacement: string;
  /** Luxury / premium level (1-10) */
  luxuryLevel: number;
  /** Typography direction */
  typographyStyle: string;
  /** Elements that must NOT change */
  immutableElements: string[];
  /** Reference image descriptions if applicable */
  referenceNotes: string;
  /** The optimized prompt for the image generation model */
  optimizedImagePrompt: string;
  /** Quality assessment notes from the creative director */
  directorNotes: string;
}

export interface CreativeDirectorResult {
  success: boolean;
  strategy: CreativeStrategy | null;
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

// ---------------------------------------------------------------------------
// System prompt for the Creative Director
// ---------------------------------------------------------------------------

const CREATIVE_DIRECTOR_SYSTEM_PROMPT = `You are a world-class Creative Director and Art Director working for Pixel, a premium Israeli marketing agency.

Your job: Take a marketing brief and brand intelligence, and produce a detailed Creative Strategy that will guide an AI image generation model to create a professional, commercial-grade marketing visual.

You think like the best creative directors in Tel Aviv — bold, modern, commercially effective.

RULES:
1. The visual must look like a REAL professional ad — not AI-generated, not generic stock.
2. Hebrew text (if specified) must be rendered accurately. Never transliterate or translate Hebrew text.
3. Brand colors are ABSOLUTELY NON-NEGOTIABLE — they must DOMINATE the visual. Include the exact hex values in the optimizedImagePrompt (e.g., "use #1B5E20 as the primary green color"). The generated image should be instantly identifiable as belonging to this brand through its color palette alone. Every major surface, background, clothing, prop, and environment element should reflect the brand colors.
4. Forbidden colors must NEVER appear.
5. DO NOT include any logo, wordmark, brand mark, or text resembling a logo in the generated image. The real logo will be composited onto the image programmatically AFTER generation. Leave clean visual space at the bottom of the image (roughly bottom 20-25%) for logo placement — avoid placing important elements there.
6. The composition must serve the marketing objective — what the viewer sees first matters.
7. Every visual must have a clear focal point and visual hierarchy.
8. Do NOT over-complicate. Commercial ads are clean, focused, and impactful.
9. Consider the platform — Instagram 4:5 requires different composition than a Facebook banner.
10. Think about text readability — if there's text overlay, ensure sufficient contrast.
11. The visual should feel premium, not cheap or template-like.
12. Reference images (brand assets, product photos, approved references) are being sent to the image generator for style/color reference. Your optimizedImagePrompt should mention "match the color palette and visual style from the brand assets". NEVER instruct the model to render or reproduce a logo — the logo is composited separately after generation.
13. TEXT MUST NEVER BE ON A FRAME, BANNER, OR BOX. Any text in the image must be beautiful, elegant typography floating directly on the visual with strong presence. No rectangles, no banners, no frames around text. Text should feel like a natural, artistic part of the composition with bold typographic presence.
14. PEOPLE'S CLOTHING AND UNIFORMS MUST MATCH THE BRAND COLORS. When people appear in the visual, their clothing, uniforms, accessories, and any wearable items must use the brand's primary colors. For example, if the brand colors are green and white, workers should wear green uniforms/shirts. This reinforces brand identity throughout the entire image.
15. BRAND COLOR SATURATION: The brand colors should appear in AT LEAST 60% of the visual's surface area. This includes backgrounds, clothing, objects, environments, lighting tints, and any other visual elements. The image should feel like it was shot on a branded set.
16. HEADLINE TYPOGRAPHY MUST BE PREMIUM AND DOMINANT. Headlines/titles must be large, bold, high-contrast, and visually commanding. Use thick, heavy-weight fonts. The headline should be the FIRST thing the viewer reads — not small, not subtle, not competing with other elements. Give it generous spacing, strong drop-shadow or outline for readability, and place it in the top third of the image for maximum visual impact. The headline is the hero of the text layer.
17. LOGO COLORS TAKE PRIORITY. When the brand has a logo with specific colors (e.g., green, blue), those exact logo colors must dominate the visual — NOT generic or guessed colors. The logo's color identity is sacred. If the brand profile lists green as a primary or accent color, green MUST appear prominently in clothing, environment, props, and backgrounds. Never substitute the logo's colors with unrelated hues.

OUTPUT FORMAT — respond with ONLY a valid JSON object (no markdown, no code fences, no explanation):
{
  "centralMessage": "string — the one message this visual communicates",
  "creativeIdea": "string — the creative concept / big idea",
  "informationHierarchy": ["first thing eye sees", "second", "third"],
  "composition": "string — detailed composition direction",
  "lighting": "string — lighting style",
  "cameraAngle": "string — camera angle / perspective",
  "colorPalette": ["#hex1", "#hex2", "..."],
  "style": "string — overall visual style",
  "mood": "string — mood / atmosphere",
  "visualType": "string — photo / illustration / 3D render / flat design / etc",
  "elementPlacement": "string — where each element goes",
  "luxuryLevel": 8,
  "typographyStyle": "string — if text is needed, what typography style",
  "immutableElements": ["element that must not change"],
  "referenceNotes": "string — any reference direction",
  "optimizedImagePrompt": "string — THE ACTUAL PROMPT to send to the image generation model. This must be extremely detailed, specific, and optimized for gpt-image-2. Include every visual detail: subject, composition, colors, lighting, camera angle, mood, style, text placement, and any specific elements. This is the most important field.",
  "directorNotes": "string — any notes about potential issues or things to watch for"
}`;

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

export async function runCreativeDirector(
  context: GenerationContext,
  brandIntel: BrandIntelligence,
  userInstruction: string,
  conversationHistory?: Array<{ role: string; content: string }>,
): Promise<CreativeDirectorResult> {
  try {
    const apiKey = getApiKey();

    // Build the user message with all context
    const userMessage = buildUserMessage(context, brandIntel, userInstruction, conversationHistory);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4.1',
        messages: [
          { role: 'system', content: CREATIVE_DIRECTOR_SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.7,
        max_tokens: 4000,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      return {
        success: false,
        strategy: null,
        error: `Creative Director API error (${response.status}): ${errBody}`,
      };
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;

    if (!content) {
      return { success: false, strategy: null, error: 'No response from Creative Director' };
    }

    // Parse the JSON response
    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        return { success: false, strategy: null, error: 'Invalid JSON from Creative Director' };
      }
    }

    const strategy: CreativeStrategy = {
      centralMessage: parsed.centralMessage || '',
      creativeIdea: parsed.creativeIdea || '',
      informationHierarchy: parsed.informationHierarchy || [],
      composition: parsed.composition || '',
      lighting: parsed.lighting || '',
      cameraAngle: parsed.cameraAngle || '',
      colorPalette: parsed.colorPalette || [],
      style: parsed.style || '',
      mood: parsed.mood || '',
      visualType: parsed.visualType || '',
      elementPlacement: parsed.elementPlacement || '',
      luxuryLevel: parsed.luxuryLevel || 7,
      typographyStyle: parsed.typographyStyle || '',
      immutableElements: parsed.immutableElements || [],
      referenceNotes: parsed.referenceNotes || '',
      optimizedImagePrompt: parsed.optimizedImagePrompt || '',
      directorNotes: parsed.directorNotes || '',
    };

    return { success: true, strategy };
  } catch (err) {
    return {
      success: false,
      strategy: null,
      error: `Creative Director error: ${err instanceof Error ? err.message : 'Unknown'}`,
    };
  }
}

// ---------------------------------------------------------------------------
// User message builder
// ---------------------------------------------------------------------------

function buildUserMessage(
  context: GenerationContext,
  brandIntel: BrandIntelligence,
  userInstruction: string,
  conversationHistory?: Array<{ role: string; content: string }>,
): string {
  const parts: string[] = [];

  // ── Brief ──
  parts.push('=== BRIEF ===');
  parts.push(`Title: ${context.ganttItem.title}`);
  if (context.ganttItem.ideaSummary) parts.push(`Concept: ${context.ganttItem.ideaSummary}`);
  if (context.ganttItem.visualConcept) parts.push(`Visual direction: ${context.ganttItem.visualConcept}`);
  if (context.ganttItem.graphicText) parts.push(`Text to appear on graphic (HEBREW — render exactly): "${context.ganttItem.graphicText}"`);
  if (context.ganttItem.caption) parts.push(`Caption/copy: ${context.ganttItem.caption}`);
  if (context.ganttItem.contentType) parts.push(`Content type: ${context.ganttItem.contentType}`);
  if (context.monthTheme) parts.push(`Monthly theme: ${context.monthTheme}`);
  if (context.campaignTag) parts.push(`Campaign: ${context.campaignTag}`);
  if (context.ganttItem.holidayTag) parts.push(`Holiday/occasion: ${context.ganttItem.holidayTag}`);
  if (context.platform) parts.push(`Platform: ${context.platform}`);
  if (context.format) parts.push(`Format: ${context.format}`);

  // ── Client ──
  parts.push('\n=== CLIENT ===');
  parts.push(`Name: ${context.clientName}`);
  parts.push(`Industry: ${context.businessField}`);

  // ── Brand Intelligence ──
  parts.push('\n=== BRAND INTELLIGENCE ===');
  parts.push(brandIntel.brandRulesSummary);

  // ── CRITICAL: Brand color enforcement ──
  if (brandIntel.primaryColors.length || brandIntel.secondaryColors.length) {
    parts.push('\n⚠️ CRITICAL — BRAND COLOR ENFORCEMENT:');
    if (brandIntel.primaryColors.length) {
      parts.push(`The PRIMARY brand colors are: ${brandIntel.primaryColors.join(', ')}. These MUST be the dominant colors in the visual. The image should be immediately recognizable as belonging to this brand through its color palette.`);
    }
    if (brandIntel.secondaryColors.length) {
      parts.push(`Secondary brand colors: ${brandIntel.secondaryColors.join(', ')}. Use these as supporting colors.`);
    }
    if (brandIntel.accentColors.length) {
      parts.push(`Accent colors: ${brandIntel.accentColors.join(', ')}. Use sparingly for highlights and CTAs.`);
    }
    if (brandIntel.forbiddenColors.length) {
      parts.push(`🚫 FORBIDDEN colors (NEVER use these): ${brandIntel.forbiddenColors.join(', ')}.`);
    }
    parts.push('Include the exact hex values in your optimizedImagePrompt so the image generator uses the precise brand colors.');
  }

  // ── Logo reference — DO NOT RENDER, only use for color/style ──
  if (brandIntel.logoUrl) {
    parts.push(`\n⚠️ BRAND LOGO — DO NOT RENDER: The client's logo is being sent as a reference image ONLY for color and style reference. DO NOT include any logo, wordmark, brand mark, emblem, or text that resembles a logo in the generated image. The real logo will be composited programmatically AFTER generation. Leave clean, uncluttered space at the bottom ~15-20% of the image for the logo overlay.`);
  }

  // ── Approved reference images ──
  if (brandIntel.approvedReferenceUrls.length) {
    parts.push(`\nApproved reference images (${brandIntel.approvedReferenceUrls.length} total) — these are being sent as reference images to the generator. Draw visual inspiration from their style, composition, and brand language.`);
    for (const url of brandIntel.approvedReferenceUrls.slice(0, 5)) {
      parts.push(`  - ${url}`);
    }
  }

  // ── Product images ──
  if (brandIntel.productImageUrls.length) {
    parts.push(`\nProduct images (${brandIntel.productImageUrls.length} total) — being sent as references. Use the actual product appearance from these images.`);
  }

  if (brandIntel.rejectedReferenceUrls.length) {
    parts.push(`\n🚫 Rejected references (${brandIntel.rejectedReferenceUrls.length} total) — AVOID similar styles.`);
  }

  // ── User instruction ──
  if (userInstruction) {
    parts.push('\n=== USER INSTRUCTION ===');
    parts.push(userInstruction);
  }

  // ── Conversation history (for refinements) ──
  if (conversationHistory?.length) {
    parts.push('\n=== CONVERSATION HISTORY (previous iterations) ===');
    for (const msg of conversationHistory) {
      parts.push(`[${msg.role}]: ${msg.content}`);
    }
    parts.push('Build upon the previous iterations. Improve based on the latest feedback.');
  }

  return parts.join('\n');
}
