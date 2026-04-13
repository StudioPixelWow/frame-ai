/**
 * GET /api/data/social-posts - Get all social posts
 * POST /api/data/social-posts - Create a new social post
 */

import { NextRequest, NextResponse } from 'next/server';
import { socialPosts } from '@/lib/db';
import { ensureSeeded } from '@/lib/db/seed';

export async function GET() {
  ensureSeeded();
  try {
    return NextResponse.json(socialPosts.getAll());
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch social posts' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  ensureSeeded();
  try {
    const body = await req.json();
    const created = socialPosts.create(body);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create social post' },
      { status: 400 }
    );
  }
}
