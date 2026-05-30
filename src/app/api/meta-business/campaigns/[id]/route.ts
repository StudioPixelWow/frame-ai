/**
 * PUT /api/meta-business/campaigns/[id]
 *   Manage a campaign on Meta (pause/resume/budget/name). [id] = META campaign id.
 *   Body: { clientId?, status?, dailyBudget?, lifetimeBudget?, name?, accessToken? }
 *   Token is resolved server-side from the client record or the system BM token
 *   unless an explicit accessToken is provided.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/store';
import { updateMetaCampaign } from '@/lib/meta-ads/write-service';

export const dynamic = 'force-dynamic';

async function resolveToken(clientId: string | undefined): Promise<string | null> {
  const sb = getSupabase();
  if (clientId) {
    const { data } = await sb.from('clients').select('*').eq('id', clientId).maybeSingle();
    const c = data as any;
    const token = c?.meta_access_token || c?.metaAccessToken;
    if (token) return token;
  }
  // Fall back to the system Business Manager token
  const { data: settings } = await sb
    .from('app_settings')
    .select('value')
    .eq('key', 'meta_business_token')
    .maybeSingle();
  return (settings as any)?.value?.access_token || null;
}

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));
    const { clientId, status, dailyBudget, lifetimeBudget, name } = body as {
      clientId?: string;
      status?: 'ACTIVE' | 'PAUSED';
      dailyBudget?: number;
      lifetimeBudget?: number;
      name?: string;
    };

    const accessToken = body.accessToken || (await resolveToken(clientId));
    if (!accessToken) {
      return NextResponse.json(
        { error: 'לא נמצא אסימון גישה — חבר את Meta Business Manager או את הלקוח' },
        { status: 400 },
      );
    }

    const result = await updateMetaCampaign({ accessToken, adAccountId: '' }, id, {
      status,
      dailyBudget,
      lifetimeBudget,
      name,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'עדכון הקמפיין נכשל', rawResponse: result }, { status: 400 });
    }

    return NextResponse.json({ success: true, metaCampaignId: id, result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'שגיאה לא צפויה';
    console.error('[meta-business/campaigns/[id]] PUT error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
