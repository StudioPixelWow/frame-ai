/**
 * GET /api/auth/gmail/status - Check Gmail OAuth configuration status
 * Returns which env vars are configured (without exposing values)
 */

import { NextResponse } from 'next/server';

export async function GET() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/gmail/callback';

  const vars = {
    GOOGLE_CLIENT_ID: !!clientId,
    GOOGLE_CLIENT_SECRET: !!clientSecret,
    GOOGLE_REDIRECT_URI: !!process.env.GOOGLE_REDIRECT_URI, // explicitly set?
  };

  const allSet = vars.GOOGLE_CLIENT_ID && vars.GOOGLE_CLIENT_SECRET;
  const isLocalhost = redirectUri.includes('localhost') || redirectUri.includes('127.0.0.1');

  return NextResponse.json({
    configured: allSet,
    vars,
    redirectUri,
    isLocalhost,
    // Masked preview of client ID (first 12 chars)
    clientIdPreview: clientId ? `${clientId.substring(0, 12)}...` : null,
  });
}
