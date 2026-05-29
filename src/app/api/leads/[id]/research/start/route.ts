import { NextRequest, NextResponse } from 'next/server';
import { leads } from '@/lib/db/collections';
import { startLeadResearch, runPipelineAsync } from '@/lib/leads/lead-research-orchestrator';
import { getSupabase } from '@/lib/db/store';

// Allow long-running scan pipeline on Vercel (up to 5 min)
export const maxDuration = 300;

/** Ensure app_lead_research table exists — direct SQL, no RPC dependency */
async function ensureLeadResearchTable() {
  const sb = getSupabase();
  // Try a quick select first — if it works, table exists
  const { error } = await sb.from('app_lead_research').select('id').limit(1);
  if (!error) return; // Table exists

  // Table doesn't exist — try creating via REST SQL
  console.log('[LeadResearch] Table app_lead_research not found, attempting creation...');
  try {
    const { error: rpcErr } = await sb.rpc('exec_sql', {
      query: `
        CREATE TABLE IF NOT EXISTS public.app_lead_research (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          data JSONB NOT NULL DEFAULT '{}',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `
    });
    if (rpcErr) {
      console.warn('[LeadResearch] exec_sql not available:', rpcErr.message);
      console.warn('[LeadResearch] Please create table manually in Supabase SQL Editor:');
      console.warn('CREATE TABLE public.app_lead_research (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), data JSONB NOT NULL DEFAULT \'{}\', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());');
    }
  } catch (e) {
    console.warn('[LeadResearch] Table creation failed:', e);
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    console.log('[LeadResearch] START — leadId:', id);

    // Ensure table exists before anything else
    await ensureLeadResearchTable();

    // Get lead data
    const lead = await leads.getByIdAsync(id);
    console.log('[LeadResearch] Lead found:', !!lead, lead ? ((lead as any).fullName || (lead as any).name || 'no-name') : 'null');

    const leadName = lead
      ? ((lead as any).fullName || (lead as any).name || (lead as any).company || 'Unknown')
      : 'Unknown';

    // Extract website URL + optional social media URLs
    const body = await req.json().catch(() => ({}));
    const websiteUrl = body.websiteUrl || '';

    if (!websiteUrl) {
      return NextResponse.json({ error: 'websiteUrl is required' }, { status: 400 });
    }

    console.log('[LeadResearch] Starting research for:', websiteUrl);

    const options = {
      leadId: id,
      leadName,
      websiteUrl,
      email: (lead as any)?.email || '',
      phone: (lead as any)?.phone || '',
      socialUrls: body.socialUrls || {},
    };

    // Step 1: Create the research record in DB
    const researchId = await startLeadResearch(options);
    console.log('[LeadResearch] Record created:', researchId);

    // Check if we got a temp ID (table doesn't exist)
    if (researchId.startsWith('temp-')) {
      console.error('[LeadResearch] Got temp ID — table app_lead_research does not exist!');
      return NextResponse.json({
        error: 'טבלת app_lead_research לא קיימת. יש ליצור אותה ב-Supabase SQL Editor.',
        sql: 'CREATE TABLE public.app_lead_research (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), data JSONB NOT NULL DEFAULT \'{}\', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());',
      }, { status: 500 });
    }

    // Step 2: Run the FULL pipeline — MUST await so Vercel keeps function alive
    console.log('[LeadResearch] Running pipeline...');
    await runPipelineAsync(researchId, options);
    console.log('[LeadResearch] Pipeline completed');

    return NextResponse.json({ researchId, status: 'completed' });
  } catch (err: any) {
    console.error('[API] Start research error:', err?.message, err?.stack);
    return NextResponse.json({ error: err?.message || 'Failed to start research' }, { status: 500 });
  }
}
