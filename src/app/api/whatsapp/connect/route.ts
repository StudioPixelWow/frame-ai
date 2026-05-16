import { NextRequest, NextResponse } from 'next/server';
import { checkConnectionStatus, getQRCode } from '@/lib/whatsapp/whatsapp-service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/whatsapp/connect — Check WhatsApp connection status
 */
export async function GET() {
  try {
    const status = await checkConnectionStatus();

    // Try to get QR code if connected
    let qrCode = null;
    if (status.connected && status.phoneNumberId) {
      qrCode = await getQRCode(status.phoneNumberId);
    }

    return NextResponse.json({
      ...status,
      qrCode,
    });
  } catch (error) {
    return NextResponse.json(
      { connected: false, error: 'שגיאה בבדיקת חיבור WhatsApp' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/whatsapp/connect — Save WhatsApp connection settings
 * Body: { phoneNumberId, accessToken, businessAccountId, verifyToken? }
 *
 * NOTE: In production, these are stored as environment variables.
 * This endpoint validates the credentials by making an API call,
 * then stores them in the Supabase settings table for runtime use.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phoneNumberId, accessToken, businessAccountId, verifyToken } = body;

    if (!phoneNumberId || !accessToken) {
      return NextResponse.json(
        { error: 'חסרים שדות חובה: Phone Number ID ו-Access Token' },
        { status: 400 }
      );
    }

    // Validate credentials by calling the WhatsApp API
    const apiVersion = 'v18.0';
    const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}`;

    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json(
        {
          success: false,
          error: err?.error?.message || `אימות נכשל — HTTP ${res.status}`,
        },
        { status: 400 }
      );
    }

    const phoneData = await res.json();

    // Store settings in Supabase (app_settings table)
    // Using dynamic import to avoid circular deps
    const { getSupabase } = await import('@/lib/db/store');
    const supabase = getSupabase();

    const settings = {
      whatsapp_phone_number_id: phoneNumberId,
      whatsapp_access_token: accessToken,
      whatsapp_business_account_id: businessAccountId || '',
      whatsapp_verify_token: verifyToken || 'pixelmanage_verify',
      whatsapp_connected: true,
      whatsapp_display_phone: phoneData.display_phone_number || '',
      whatsapp_quality_rating: phoneData.quality_rating || '',
      updated_at: new Date().toISOString(),
    };

    // Upsert into app_settings
    await supabase
      .from('app_settings')
      .upsert(
        { id: 'whatsapp_config', data: settings },
        { onConflict: 'id' }
      );

    // Also set process.env for immediate use in this runtime
    process.env.WHATSAPP_PHONE_NUMBER_ID = phoneNumberId;
    process.env.WHATSAPP_ACCESS_TOKEN = accessToken;
    process.env.WHATSAPP_BUSINESS_ACCOUNT_ID = businessAccountId || '';
    if (verifyToken) process.env.WHATSAPP_VERIFY_TOKEN = verifyToken;

    return NextResponse.json({
      success: true,
      connected: true,
      displayPhone: phoneData.display_phone_number,
      qualityRating: phoneData.quality_rating,
    });
  } catch (error) {
    console.error('[WhatsApp Connect] Error:', error);
    return NextResponse.json(
      { success: false, error: 'שגיאה בשמירת הגדרות WhatsApp' },
      { status: 500 }
    );
  }
}
