/**
 * GET /api/data/email-templates - Get all email templates
 * POST /api/data/email-templates - Create a new email template
 */

import { NextRequest, NextResponse } from 'next/server';
import { emailTemplates } from '@/lib/db';
import { ensureSeeded } from '@/lib/db/seed';

export async function GET() {
  ensureSeeded();
  try {
    return NextResponse.json(emailTemplates.getAll());
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch email templates' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  ensureSeeded();
  try {
    const body = await req.json();
    const created = emailTemplates.create(body);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create email template' },
      { status: 400 }
    );
  }
}
