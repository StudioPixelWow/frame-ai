/**
 * GET /api/data/email-templates/[id] - Get a single email template
 * PUT /api/data/email-templates/[id] - Update an email template
 * DELETE /api/data/email-templates/[id] - Delete an email template
 */

import { NextRequest, NextResponse } from 'next/server';
import { emailTemplates } from '@/lib/db';
import { ensureSeeded } from '@/lib/db/seed';

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  ensureSeeded();
  try {
    const { id } = await context.params;
    const template = emailTemplates.getById(id);
    if (!template) {
      return NextResponse.json(
        { error: 'Email template not found' },
        { status: 404 }
      );
    }
    return NextResponse.json(template);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch email template' },
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
    const updated = emailTemplates.update(id, body);
    if (!updated) {
      return NextResponse.json(
        { error: 'Email template not found' },
        { status: 404 }
      );
    }
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update email template' },
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
    const deleted = emailTemplates.delete(id);
    if (!deleted) {
      return NextResponse.json(
        { error: 'Email template not found' },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete email template' },
      { status: 500 }
    );
  }
}
