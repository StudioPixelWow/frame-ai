/**
 * POST /api/portal/login
 * Body: { email, password? }
 * - Look up portalUsers by email
 * - Check isActive
 * - If found, return { success: true, clientId, portalUserId }
 * - If not found, return 401
 * - This is a simplified demo auth (no real password hashing)
 */

import { NextRequest, NextResponse } from 'next/server';
import { portalUsers } from '@/lib/db';
import { ensureSeeded } from '@/lib/db/seed';

export async function POST(req: NextRequest) {
  await ensureSeeded();
  try {
    const body = await req.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    const allPortalUsers = portalUsers.getAll();
    const user = allPortalUsers.find((u) => u.email === email && u.isActive);

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid credentials or account not active' },
        { status: 401 }
      );
    }

    // Update lastLoginAt
    portalUsers.update(user.id, {
      lastLoginAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      clientId: user.clientId,
      portalUserId: user.id,
      email: user.email,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to process login' },
      { status: 500 }
    );
  }
}
