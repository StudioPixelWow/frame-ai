import { NextResponse } from 'next/server';
import { knowledgeItems } from '@/lib/db';
import { findSimilarClients, getKnowledgeSuggestions } from '@/lib/knowledge';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');

    if (!clientId) {
      return NextResponse.json(
        { error: 'clientId is required' },
        { status: 400 }
      );
    }

    const allItems = await knowledgeItems.getAllAsync();
    const similarity = findSimilarClients(clientId, allItems);
    const suggestions = getKnowledgeSuggestions(clientId, allItems);

    return NextResponse.json({ similarity, suggestions });
  } catch (error) {
    console.error('[knowledge/similarity] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to compute similarity' },
      { status: 500 }
    );
  }
}
