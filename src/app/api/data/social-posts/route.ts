/**
 * GET /api/data/social-posts - Get all social posts
 * POST /api/data/social-posts - Create a new social post
 */

import { NextRequest, NextResponse } from 'next/server';
import { socialPosts } from '@/lib/db';
import { ensureSeeded } from '@/lib/db/seed';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    ensureSeeded();
  } catch (seedErr) {
    console.warn('[social-posts GET] ensureSeeded failed:', seedErr instanceof Error ? seedErr.message : seedErr);
  }
  try {
    const all = socialPosts.getAll();
    return NextResponse.json(Array.isArray(all) ? all : []);
  } catch (error) {
    console.error('[social-posts GET] error:', error instanceof Error ? error.message : error);
    // Return empty array instead of 500 — prevents ERR_TOO_MANY_RETRIES from browser retry loops
    return NextResponse.json([], { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  try {
    ensureSeeded();
  } catch (seedErr) {
    console.warn('[social-posts POST] ensureSeeded failed:', seedErr instanceof Error ? seedErr.message : seedErr);
  }
  try {
    const body = await req.json();
    const created = socialPosts.create(body);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('[social-posts POST] error:', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: 'Failed to create social post' },
      { status: 400 }
    );
  }
}
