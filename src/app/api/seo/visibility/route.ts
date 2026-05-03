import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * AI Visibility Scan
 *
 * IMPORTANT: This endpoint does NOT have real API connections to ChatGPT, Gemini,
 * Perplexity, Claude, or Copilot. All results are marked as scan_mode: "simulated".
 *
 * No fake mentions, no fake positions, no fake competitors.
 * Every result clearly states it is simulated.
 */

const ENGINES = ['ChatGPT', 'Gemini', 'Perplexity', 'Claude', 'Copilot'] as const;

export async function POST(req: NextRequest) {
  try {
    const { queries, businessName, websiteUrl } = await req.json();
    if (!queries?.length) {
      return NextResponse.json({ error: 'queries required' }, { status: 400 });
    }

    // Since we have no real AI API connections, return "unavailable" results
    // with clear labeling that this is not real data.
    const results = [];

    for (const q of queries) {
      for (const engine of ENGINES) {
        results.push({
          queryId: q.id,
          query: q.query,
          engine,
          mentioned: false,
          position: null,
          context: '',
          sentiment: 'unavailable',
          competitorsMentioned: [],
          scannedAt: new Date().toISOString(),
          scan_mode: 'simulated' as const,
          note: 'No real AI API connected. Results are simulated — do not treat as real data.',
        });
      }
    }

    // Visibility score = 0 since we have no real data
    const visibilityScore = 0;

    return NextResponse.json({
      results,
      visibilityScore,
      scan_mode: 'simulated',
      warning: 'AI visibility results are simulated. No real API connections to AI engines are configured. Connect real APIs to get actual visibility data.',
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
