/**
 * Learning Loop API
 * GET: Get suggestions (optional ?industry=&status=pending|accepted|rejected)
 * POST: Analyze industry or update suggestion status
 */

import { NextRequest, NextResponse } from 'next/server';
import { analyzeAndSuggest, getSuggestions, updateSuggestionStatus } from '@/lib/agency-intelligence/learning-loop';

export async function GET(req: NextRequest) {
  try {
    const industry = req.nextUrl.searchParams.get('industry') || undefined;
    const status = req.nextUrl.searchParams.get('status') as 'pending' | 'accepted' | 'rejected' | undefined;
    const suggestions = await getSuggestions(industry, status || undefined);
    return NextResponse.json(suggestions);
  } catch {
    return NextResponse.json({ error: 'Failed to load suggestions' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Analyze industry
    if (body.action === 'analyze' && body.industry) {
      const suggestions = await analyzeAndSuggest(body.industry);
      return NextResponse.json({ success: true, suggestions });
    }

    // Update suggestion status
    if (body.action === 'update' && body.id && body.status) {
      const success = await updateSuggestionStatus(body.id, body.status);
      if (!success) return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'action required: analyze or update' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
