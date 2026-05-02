/**
 * POST /api/data/seed
 *
 * Seeding is disabled — critical collections are now on Supabase
 * and should not be wiped/re-seeded from this endpoint.
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(_req: NextRequest) {
  return NextResponse.json(
    {
      success: true,
      message: 'Seeding disabled — data is persisted in Supabase',
    },
    { status: 200 }
  );
}
