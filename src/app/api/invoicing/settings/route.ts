import { NextRequest, NextResponse } from 'next/server';
import { greenInvoiceSettingsStore } from '@/lib/db';
import { checkConnection } from '@/lib/invoicing/green-invoice-client';

export const dynamic = 'force-dynamic';

// GET /api/invoicing/settings
export async function GET() {
  try {
    const all = await greenInvoiceSettingsStore.getAllAsync();
    const settings = all[0] || null;

    // Don't expose the API secret in response
    if (settings) {
      return NextResponse.json({
        ...(settings as any),
        apiSecret: (settings as any).apiSecret ? '••••••••' : '',
      });
    }

    return NextResponse.json(null);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 });
  }
}

// POST /api/invoicing/settings — Save or update Green Invoice settings
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { apiId, apiSecret, sandbox, businessName, businessTaxId, defaultDocType, autoIssueOnPayment } = body;

    if (!apiId || !apiSecret) {
      return NextResponse.json({ error: 'API ID and Secret are required' }, { status: 400 });
    }

    // Set env vars for connection test
    process.env.GREEN_INVOICE_API_ID = apiId;
    process.env.GREEN_INVOICE_API_SECRET = apiSecret;
    process.env.GREEN_INVOICE_SANDBOX = sandbox ? 'true' : 'false';

    // Test connection
    const connectionResult = await checkConnection();

    const settingsData = {
      apiId,
      apiSecret,
      sandbox: sandbox || false,
      businessName: connectionResult.businessName || businessName || '',
      businessTaxId: businessTaxId || '',
      defaultDocType: defaultDocType || 210,
      autoIssueOnPayment: autoIssueOnPayment || false,
      connected: connectionResult.connected,
      lastSyncAt: connectionResult.connected ? new Date().toISOString() : null,
    };

    // Upsert — check if settings already exist
    const existing = await greenInvoiceSettingsStore.getAllAsync();
    let result;
    if (existing.length > 0) {
      result = await greenInvoiceSettingsStore.updateAsync((existing[0] as any).id, {
        ...settingsData,
        updatedAt: new Date().toISOString(),
      } as any);
    } else {
      result = await greenInvoiceSettingsStore.createAsync(settingsData as any);
    }

    return NextResponse.json({
      success: true,
      connected: connectionResult.connected,
      businessName: connectionResult.businessName,
      error: connectionResult.error,
    });
  } catch (error) {
    console.error('[GREEN-INVOICE] Settings error:', error);
    return NextResponse.json({
      error: 'Failed to save settings',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
