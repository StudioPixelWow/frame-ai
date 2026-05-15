import { NextRequest, NextResponse } from 'next/server';
import { linkedInPosts } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/linkedin — List LinkedIn posts
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const clientId = searchParams.get('clientId');
    const status = searchParams.get('status');

    let all = await linkedInPosts.getAllAsync();
    if (clientId) all = all.filter((p: any) => p.clientId === clientId);
    if (status) all = all.filter((p: any) => p.status === status);
    all.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json(all);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to load LinkedIn posts' }, { status: 500 });
  }
}

// POST /api/linkedin — Create LinkedIn post
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { clientId, contentHebrew, contentEnglish, language, postType, industry, targetAudience } = body;

    if (!clientId || (!contentHebrew && !contentEnglish)) {
      return NextResponse.json({ error: 'Missing: clientId, content' }, { status: 400 });
    }

    const post = await linkedInPosts.createAsync({
      clientId,
      contentHebrew: contentHebrew || '',
      contentEnglish: contentEnglish || '',
      language: language || 'he',
      postType: postType || 'text',
      industry: industry || '',
      targetAudience: targetAudience || '',
      impressions: 0,
      reactions: 0,
      comments: 0,
      shares: 0,
      profileViews: 0,
      scheduledAt: body.scheduledAt || null,
      publishedAt: null,
      status: body.scheduledAt ? 'scheduled' : 'draft',
    } as any);

    return NextResponse.json(post, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create LinkedIn post' }, { status: 500 });
  }
}
