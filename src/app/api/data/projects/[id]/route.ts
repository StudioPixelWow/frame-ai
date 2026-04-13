/**
 * GET /api/data/projects/[id] - Get a single project
 * PUT /api/data/projects/[id] - Update a project
 * DELETE /api/data/projects/[id] - Delete a project
 */

import { NextRequest, NextResponse } from 'next/server';
import { projects } from '@/lib/db';
import { ensureSeeded } from '@/lib/db/seed';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }<{ id: string }> }
) {
  ensureSeeded();
  try {
    const { id } = params;
    const project = projects.getById(id);
    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }
    return NextResponse.json(project);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch project' },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }<{ id: string }> }
) {
  ensureSeeded();
  try {
    const { id } = params;
    const body = await req.json();
    const updated = projects.update(id, body);
    if (!updated) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update project' },
      { status: 400 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }<{ id: string }> }
) {
  ensureSeeded();
  try {
    const { id } = params;
    const deleted = projects.delete(id);
    if (!deleted) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete project' },
      { status: 500 }
    );
  }
}
