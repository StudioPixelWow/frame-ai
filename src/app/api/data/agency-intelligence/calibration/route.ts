/**
 * Calibration API
 * GET: Get calibration settings
 * POST: Save calibration settings
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCalibration, saveCalibration } from '@/lib/agency-intelligence/calibration';

export async function GET() {
  try {
    const calibration = await getCalibration();
    return NextResponse.json(calibration);
  } catch {
    return NextResponse.json({ error: 'Failed to load calibration' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const success = await saveCalibration(body);
    if (!success) return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
