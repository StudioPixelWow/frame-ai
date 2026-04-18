/**
 * GET /api/data/leads - Get all leads
 * POST /api/data/leads - Create a new lead
 */

import { NextRequest, NextResponse } from 'next/server';
import { leads } from '@/lib/db';
import { ensureSeeded } from '@/lib/db/seed';
import { requireRole } from '@/lib/auth/api-guard';
import { persistenceLog } from '@/lib/db/persistence-logger';

export async function GET(req: NextRequest) {
  const roleErr = requireRole(req, 'admin', 'employee');
  if (roleErr) return roleErr;

  ensureSeeded();
  const log = persistenceLog('leads', 'select', '/api/data/leads', 'leads.json');
  try {
    log.start();
    const data = leads.getAll();
    log.ok(data);
    return NextResponse.json(data);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    log.fail(msg);
    return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const postErr = requireRole(req, 'admin', 'employee');
  if (postErr) return postErr;

  ensureSeeded();
  const log = persistenceLog('leads', 'insert', '/api/data/leads', 'leads.json');
  try {
    const body = await req.json();
    log.start(body as Record<string, unknown>);
    const created = leads.create(body);
    log.ok(created);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    log.fail(msg);
    return NextResponse.json({ error: 'Failed to create lead' }, { status: 400 });
  }
}
