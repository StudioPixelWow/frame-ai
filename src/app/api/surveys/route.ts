import { NextRequest, NextResponse } from 'next/server';
import { surveys, surveyResponses } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/surveys
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const clientId = searchParams.get('clientId');
    const status = searchParams.get('status');

    let all = await surveys.getAllAsync();
    if (clientId) all = all.filter((s: any) => s.clientId === clientId);
    if (status) all = all.filter((s: any) => s.status === status);
    all.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json(all);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to load surveys' }, { status: 500 });
  }
}

// POST /api/surveys — Create survey
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, type, questions } = body;

    if (!title || !type) {
      return NextResponse.json({ error: 'Missing: title, type' }, { status: 400 });
    }

    const survey = await surveys.createAsync({
      clientId: body.clientId || null,
      title,
      description: body.description || '',
      type,
      status: 'draft',
      questions: questions || [],
      distributionChannels: body.distributionChannels || ['link'],
      shareUrl: '', // Generated after creation
      totalResponses: 0,
      avgScore: null,
      npsScore: null,
      isRtl: true,
      language: 'he',
      brandColor: body.brandColor || '#3b82f6',
      thankYouMessage: body.thankYouMessage || 'תודה על המשוב! 🙏',
    } as any);

    return NextResponse.json(survey, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create survey' }, { status: 500 });
  }
}
