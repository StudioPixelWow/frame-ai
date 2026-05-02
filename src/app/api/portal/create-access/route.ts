/**
 * POST /api/portal/create-access
 * Body: { clientId, email, loginMethod: 'password' | 'magic_link' }
 * - Create a PortalUser with email, clientId, isActive: true, passwordHash: 'demo'
 * - Update the client: portalEnabled = true, portalUserId = new portalUser.id
 * - Return success with the new portalUser
 */

import { NextRequest, NextResponse } from 'next/server';
import { portalUsers } from '@/lib/db';
import { ensureSeeded } from '@/lib/db/seed';
import { getClientById, updateClientById } from '@/lib/db/client-helpers';

export async function POST(req: NextRequest) {
  ensureSeeded();
  try {
    const body = await req.json();
    const { clientId, email, loginMethod } = body;

    if (!clientId || !email) {
      return NextResponse.json(
        { error: 'clientId and email are required' },
        { status: 400 }
      );
    }

    // Check if client exists
    const client = await getClientById(clientId);
    if (!client) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      );
    }

    // Create portal user
    const newPortalUser = portalUsers.create({
      clientId,
      email,
      passwordHash: 'demo', // Simplified demo (no real hashing)
      magicLinkToken: loginMethod === 'magic_link' ? `token_${Date.now()}` : null,
      magicLinkExpiresAt: loginMethod === 'magic_link' ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : null,
      isActive: true,
      lastLoginAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Update client
    await updateClientById(clientId, {
      portalEnabled: true,
      portalUserId: newPortalUser.id,
    });

    return NextResponse.json({
      success: true,
      portalUser: newPortalUser,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating portal access:', error);
    return NextResponse.json(
      { error: 'Failed to create portal access' },
      { status: 500 }
    );
  }
}
