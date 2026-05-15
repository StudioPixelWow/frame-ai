import { NextRequest, NextResponse } from 'next/server';
import { scheduledSocialPosts } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/social — List scheduled posts
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const clientId = searchParams.get('clientId');
    const platform = searchParams.get('platform');
    const status = searchParams.get('status');

    let all = await scheduledSocialPosts.getAllAsync();
    if (clientId) all = all.filter((p: any) => p.clientId === clientId);
    if (platform) all = all.filter((p: any) => p.platform === platform);
    if (status) all = all.filter((p: any) => p.status === status);

    all.sort((a: any, b: any) => new Date(b.scheduledAt || b.createdAt).getTime() - new Date(a.scheduledAt || a.createdAt).getTime());
    return NextResponse.json(all);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to load posts' }, { status: 500 });
  }
}

// POST /api/social — Create a scheduled social post
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { clientId, clientName, platform, content, hashtags, scheduledAt, mediaUrls } = body;

    if (!clientId || !platform || !content) {
      return NextResponse.json({ error: 'Missing: clientId, platform, content' }, { status: 400 });
    }

    const post = await scheduledSocialPosts.createAsync({
      clientId,
      clientName: clientName || '',
      platform,
      content,
      mediaUrls: mediaUrls || [],
      hashtags: hashtags || [],
      scheduledAt: scheduledAt || new Date().toISOString(),
      publishedAt: null,
      status: scheduledAt ? 'scheduled' : 'draft',
      postizPostId: null,
      postizError: null,
      likes: 0,
      comments: 0,
      shares: 0,
      reach: 0,
      linkedGanttItemId: body.linkedGanttItemId || null,
    } as any);

    return NextResponse.json(post, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create post' }, { status: 500 });
  }
}
