/**
 * POST /api/visual-generation/auto-brief
 *
 * AI-powered auto-brief generator.
 * Takes ganttItemId + clientId, gathers all context from Gantt item + brand intelligence,
 * and uses GPT-4.1 to produce a creative instruction in Hebrew for the visual generation textarea.
 */

import { NextRequest, NextResponse } from 'next/server';
import { buildGenerationContext } from '@/lib/services/visual-generation/generationContextBuilder';
import { gatherBrandIntelligence } from '@/lib/services/visual-generation/brandIntelligenceService';

export const maxDuration = 60;

function getApiKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('Missing OPENAI_API_KEY environment variable');
  return key;
}

const AUTO_BRIEF_SYSTEM_PROMPT = `You are a senior Creative Director at Pixel, a premium Israeli marketing agency.

Your job: Given a marketing brief, client data, and brand intelligence, write a detailed CREATIVE INSTRUCTION in Hebrew that will guide AI image generation to produce a stunning, brand-accurate marketing visual.

The instruction you write will be passed to another AI system that generates the image. Your goal is to translate the raw brief data into a rich, specific creative direction.

RULES:
1. Write in Hebrew. The instruction is for an Israeli marketing team.
2. Be specific about visual elements: what appears in the image, composition, colors, mood, styling.
3. Reference the brand colors by their hex codes and describe how they should appear in the image.
4. If people appear, describe their appearance, clothing (must match brand colors), and positioning.
5. Describe the typography style — text should NEVER be on frames or banners, always elegant floating text.
6. Include the emotional tone and atmosphere.
7. Keep it concise but detailed — 3-6 sentences.
8. Do NOT include generic instructions. Every sentence should add specific creative direction.
9. Think about what would make this specific visual stand out on social media.

OUTPUT: Write ONLY the creative instruction text. No explanations, no prefixes, no quotes. Just the instruction itself.`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { ganttItemId, clientId } = body;

    if (!ganttItemId || !clientId) {
      return NextResponse.json(
        { error: 'ganttItemId and clientId are required' },
        { status: 400 }
      );
    }

    // Gather all context
    const [context, brandIntel] = await Promise.all([
      buildGenerationContext(ganttItemId, clientId),
      gatherBrandIntelligence(clientId),
    ]);

    // Build the user message with all available data
    const parts: string[] = [];

    parts.push('=== BRIEF ===');
    parts.push(`Title: ${context.ganttItem.title}`);
    if (context.ganttItem.ideaSummary) parts.push(`Concept: ${context.ganttItem.ideaSummary}`);
    if (context.ganttItem.visualConcept) parts.push(`Visual direction: ${context.ganttItem.visualConcept}`);
    if (context.ganttItem.graphicText) parts.push(`Text on graphic: "${context.ganttItem.graphicText}"`);
    if (context.ganttItem.caption) parts.push(`Caption: ${context.ganttItem.caption}`);
    if (context.ganttItem.contentType) parts.push(`Content type: ${context.ganttItem.contentType}`);
    if (context.monthTheme) parts.push(`Monthly theme: ${context.monthTheme}`);
    if (context.campaignTag) parts.push(`Campaign: ${context.campaignTag}`);
    if (context.ganttItem.holidayTag) parts.push(`Holiday: ${context.ganttItem.holidayTag}`);
    if (context.platform) parts.push(`Platform: ${context.platform}`);
    if (context.format) parts.push(`Format: ${context.format}`);

    parts.push('\n=== CLIENT ===');
    parts.push(`Name: ${context.clientName}`);
    parts.push(`Industry: ${context.businessField}`);

    parts.push('\n=== BRAND INTELLIGENCE ===');
    parts.push(brandIntel.brandRulesSummary);

    if (brandIntel.primaryColors.length) {
      parts.push(`\nPrimary colors: ${brandIntel.primaryColors.join(', ')}`);
    }
    if (brandIntel.secondaryColors.length) {
      parts.push(`Secondary colors: ${brandIntel.secondaryColors.join(', ')}`);
    }

    const apiKey = getApiKey();
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4.1',
        messages: [
          { role: 'system', content: AUTO_BRIEF_SYSTEM_PROMPT },
          { role: 'user', content: parts.join('\n') },
        ],
        temperature: 0.8,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      return NextResponse.json(
        { error: `Auto-brief API error (${response.status}): ${errBody}` },
        { status: 500 }
      );
    }

    const result = await response.json();
    const instruction = result.choices?.[0]?.message?.content?.trim();

    if (!instruction) {
      return NextResponse.json(
        { error: 'No instruction generated' },
        { status: 500 }
      );
    }

    return NextResponse.json({ instruction });
  } catch (error: any) {
    console.error('[auto-brief] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate auto-brief' },
      { status: 500 }
    );
  }
}
