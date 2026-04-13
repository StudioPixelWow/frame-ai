/**
 * GET /api/data/projects - Get all projects
 * POST /api/data/projects - Create a new project
 */

import { NextRequest, NextResponse } from 'next/server';
import { projects } from '@/lib/db';
import { ensureSeeded } from '@/lib/db/seed';

export async function GET() {
  ensureSeeded();
  try {
    return NextResponse.json(projects.getAll());
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  ensureSeeded();
  try {
    const body = await req.json();
    const created = projects.create(body);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create project' },
      { status: 400 }
    );
  }
}
