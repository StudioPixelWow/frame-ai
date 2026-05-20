import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
);

interface MetaAdAccount {
  id: string;
  name: string;
  account_status: number;
  business?: { id: string; name: string };
  currency: string;
  timezone_name: string;
}

interface AdAccountResult {
  id: string;
  name: string;
  accountStatus: number;
  businessName: string;
  currency: string;
  timezone: string;
  assignedClientId: string | null;
  assignedClientName: string | null;
}

const ACCOUNT_STATUS_MAP: Record<number, string> = {
  1: 'active',
  2: 'disabled',
  3: 'unsettled',
  7: 'pending_risk_review',
  8: 'pending_settlement',
  9: 'in_grace_period',
  100: 'pending_closure',
  101: 'closed',
  201: 'any_active',
  202: 'any_closed',
};

export async function GET(request: NextRequest) {
  try {
    const accessToken = request.nextUrl.searchParams.get('accessToken') || await getSystemToken();

    if (!accessToken) {
      return NextResponse.json(
        { error: 'חסר אסימון גישה — יש לחבר את Meta Business Manager תחילה' },
        { status: 400 },
      );
    }

    // Fetch all ad accounts with pagination
    const allAccounts: MetaAdAccount[] = [];
    let url: string | null = `https://graph.facebook.com/v19.0/me/adaccounts?fields=id,name,account_status,business,currency,timezone_name&limit=100&access_token=${encodeURIComponent(accessToken)}`;
    let pageCount = 0;

    while (url && pageCount < 20) {
      pageCount++;
      const res: Response = await fetch(url, { signal: AbortSignal.timeout(30000) });
      const body = await res.json();

      if (!res.ok || body.error) {
        const fbError = body.error;
        if (fbError?.code === 190 || fbError?.error_subcode === 463) {
          return NextResponse.json({ error: 'אסימון הגישה פג תוקף — יש לחדש את החיבור', code: 'TOKEN_EXPIRED' }, { status: 401 });
        }
        return NextResponse.json({ error: fbError?.message || `שגיאת Meta API: HTTP ${res.status}` }, { status: 502 });
      }

      if (body.data) {
        allAccounts.push(...body.data);
      }

      url = body.paging?.next || null;
    }

    // Fetch client assignments
    const { data: clients } = await supabase
      .from('clients')
      .select('id, name, meta_ad_account_id')
      .not('meta_ad_account_id', 'is', null);

    const assignmentMap = new Map<string, { clientId: string; clientName: string }>();
    if (clients) {
      for (const c of clients) {
        if (c.meta_ad_account_id) {
          assignmentMap.set(c.meta_ad_account_id, { clientId: c.id, clientName: c.name || '' });
        }
      }
    }

    // Map results
    const accounts: AdAccountResult[] = allAccounts.map((acc) => {
      const assignment = assignmentMap.get(acc.id);
      return {
        id: acc.id,
        name: acc.name || acc.id,
        accountStatus: acc.account_status,
        accountStatusLabel: ACCOUNT_STATUS_MAP[acc.account_status] || 'unknown',
        businessName: acc.business?.name || '',
        currency: acc.currency || '',
        timezone: acc.timezone_name || '',
        assignedClientId: assignment?.clientId || null,
        assignedClientName: assignment?.clientName || null,
      };
    });

    return NextResponse.json({
      accounts,
      total: accounts.length,
      assigned: accounts.filter((a) => a.assignedClientId).length,
      unassigned: accounts.filter((a) => !a.assignedClientId).length,
    });
  } catch (err) {
    console.error('[meta-business/accounts] Error:', err);
    const msg = err instanceof Error ? err.message : 'שגיאה לא צפויה';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

async function getSystemToken(): Promise<string | null> {
  try {
    // Try app_settings table first
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'meta_business_token')
      .single();

    if (!error && data?.value) {
      return typeof data.value === 'string' ? data.value : (data.value as any).access_token || null;
    }

    // Fallback: try app_meta_business table
    const { data: metaData, error: metaError } = await supabase
      .from('app_meta_business')
      .select('config')
      .single();

    if (!metaError && metaData?.config) {
      return (metaData.config as any).access_token || null;
    }

    return null;
  } catch {
    return null;
  }
}
