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

Your job: Given a marketing brief, client data, and brand intelligence, write THREE DIFFERENT creative concepts in Hebrew. Each concept is a distinct creative direction for an AI image generation system. The system will generate 3 visual options simultaneously — one from each concept.

The 3 concepts must be GENUINELY DIFFERENT from each other — different composition, different mood, different visual approach:
- Concept 1: A bold, dramatic approach (e.g., close-up, high contrast, emotional impact)
- Concept 2: A clean, professional approach (e.g., wide shot, organized layout, minimal)
- Concept 3: A creative/artistic approach (e.g., unusual angle, metaphorical, stylized)

ABSOLUTE COLOR RULE — THIS IS THE #1 PRIORITY RULE:
- You will receive a section called "ALLOWED COLORS" with exact hex codes.
- You may ONLY reference colors from that list. Copy the exact hex codes.
- Do NOT invent ANY color. Do NOT approximate. Do NOT add colors like black, white, gray, blue, red, or any color not in the list.
- If you write a hex code that is NOT in the ALLOWED COLORS list, the entire output is REJECTED.
- If no colors are provided, describe the mood/atmosphere without mentioning any specific colors or hex codes.

RULES:
1. Write in Hebrew. The instruction is for an Israeli marketing team.
2. Be specific about visual elements: what appears in the image, composition, mood, styling.
3. Every color reference must be an EXACT hex code from the ALLOWED COLORS list. No exceptions.
4. If people appear, describe their appearance, clothing, and positioning.
5. Describe the typography style — text should NEVER be on frames or banners, always elegant floating text.
6. Include the emotional tone and atmosphere.
7. Each concept should be 3-5 sentences with specific, unique creative direction.
8. The 3 concepts must look COMPLETELY DIFFERENT from each other — not variations of the same idea.

OUTPUT FORMAT — write exactly in this structure:
---CONCEPT1---
[Hebrew creative instruction for concept 1]
---CONCEPT2---
[Hebrew creative instruction for concept 2]
---CONCEPT3---
[Hebrew creative instruction for concept 3]

No explanations, no prefixes, no quotes outside the concepts.`;

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

    // Build explicit ALLOWED COLORS block — this is the #1 priority
    const allAllowedColors = [
      ...brandIntel.primaryColors,
      ...brandIntel.secondaryColors,
      ...brandIntel.accentColors,
    ].filter(Boolean);

    if (allAllowedColors.length > 0) {
      parts.push(`\n=== ALLOWED COLORS (USE ONLY THESE — NO OTHER COLORS PERMITTED) ===`);
      parts.push(allAllowedColors.join(', '));
      parts.push(`ANY hex code not in this list = REJECTED OUTPUT.`);
      if (brandIntel.primaryColors.length) {
        parts.push(`Primary (must dominate): ${brandIntel.primaryColors.join(', ')}`);
      }
      if (brandIntel.secondaryColors.length) {
        parts.push(`Secondary: ${brandIntel.secondaryColors.join(', ')}`);
      }
      if (brandIntel.accentColors.length) {
        parts.push(`Accent: ${brandIntel.accentColors.join(', ')}`);
      }
    } else {
      parts.push(`\n=== NO BRAND COLORS DEFINED ===`);
      parts.push(`Do NOT mention any specific colors or hex codes. Describe mood and atmosphere only.`);
    }

    if (brandIntel.forbiddenColors.length) {
      parts.push(`\nFORBIDDEN colors (NEVER use): ${brandIntel.forbiddenColors.join(', ')}`);
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
    const rawContent = result.choices?.[0]?.message?.content?.trim();

    if (!rawContent) {
      return NextResponse.json(
        { error: 'No instruction generated' },
        { status: 500 }
      );
    }

    // Parse 3 concepts from the structured output
    const concepts: string[] = [];
    const conceptMatches = rawContent.split(/---CONCEPT\d+---/).filter((s: string) => s.trim());

    if (conceptMatches.length >= 3) {
      concepts.push(conceptMatches[0].trim());
      concepts.push(conceptMatches[1].trim());
      concepts.push(conceptMatches[2].trim());
    } else {
      // Fallback: if format didn't parse, use the whole text as concept 1
      concepts.push(rawContent);
    }

    // Return both the first concept as the textarea instruction AND all 3 concepts
    return NextResponse.json({
      instruction: concepts[0],
      concepts,
    });
  } catch (error: any) {
    console.error('[auto-brief] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate auto-brief' },
      { status: 500 }
    );
  }
}
