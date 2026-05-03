import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 30;

const ENGINES = ['chatgpt', 'gemini', 'perplexity', 'claude', 'copilot'] as const;

export async function POST(req: NextRequest) {
  try {
    const { queries, businessName, websiteUrl } = await req.json();
    if (!queries?.length) return NextResponse.json({ error: 'queries required' }, { status: 400 });

    // Generate simulated visibility results
    // In production, this would call actual AI APIs
    const results = [];

    for (const q of queries) {
      for (const engine of ENGINES) {
        const mentioned = Math.random() > 0.5;
        results.push({
          queryId: q.id,
          query: q.query,
          engine,
          mentioned,
          position: mentioned ? Math.floor(Math.random() * 5) + 1 : null,
          context: mentioned
            ? `${businessName} הוזכר כאחד הספקים המובילים בתחום`
            : '',
          sentiment: mentioned
            ? (['positive', 'neutral', 'positive'][Math.floor(Math.random() * 3)])
            : 'not_mentioned',
          competitorsMentioned: ['מתחרה א', 'מתחרה ב'].filter(() => Math.random() > 0.5),
          scannedAt: new Date().toISOString(),
        });
      }
    }

    // Calculate visibility score
    const totalChecks = results.length;
    const mentionedCount = results.filter(r => r.mentioned).length;
    const visibilityScore = Math.round((mentionedCount / totalChecks) * 100);

    return NextResponse.json({ results, visibilityScore });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
