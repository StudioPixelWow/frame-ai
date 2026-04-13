/**
 * GET /api/data/social-posts/[id] - Get a single social post
 * PUT /api/data/social-posts/[id] - Update a social post
 * DELETE /api/data/social-posts/[id] - Delete a social post
 */

import { NextRequest, NextResponse } from 'next/server';
import { socialPosts } from '@/lib/db';
import { ensureSeeded } from '@/lib/db/seed';

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  ensureSeeded();
  try {
    const { id } = await context.params;
    const socialPost = socialPosts.getById(id);
    if (!socialPost) {
      return NextResponse.json({ error: 'Social post not found' }, { status: 404 });
    }
    return NextResponse.json(socialPost);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch social post' },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  ensureSeeded();
  try {
    const { id } = await context.params;
    const body = await req.json();
    const updated = socialPosts.update(id, body);
    if (!updated) {
      return NextResponse.json({ error: 'Social post not found' }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update social post' },
      { status: 400 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  ensureSeeded();
  try {
    const { id } = await context.params;
    const deleted = socialPosts.delete(id);
    if (!deleted) {
      return NextResponse.json({ error: 'Social post not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete social post' },
      { status: 500 }
    );
  }
}
