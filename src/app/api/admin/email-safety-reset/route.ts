/**
 * POST /api/admin/email-safety-reset
 *
 * Prepares Pixel Prime for safe automation testing:
 * 1. Backs up ALL client email fields to app_settings
 * 2. Replaces every client email with office@s-pixel.co.il
 * 3. Enables email_automations_enabled = true
 *
 * GET /api/admin/email-safety-reset
 * Returns the backup data (for review/restore).
 *
 * POST with { action: 'restore' } restores original emails from backup.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/store';
import { clearEmailEnabledCache } from '@/lib/email/email-service';

export const dynamic = 'force-dynamic';

const SAFE_EMAIL = 'office@s-pixel.co.il';
const BACKUP_KEY = 'email_safety_backup';

interface BackupEntry {
  table: string;
  id: string;
  field: string;
  originalValue: string;
}

export async function GET() {
  try {
    const sb = getSupabase();
    const { data } = await sb
      .from('app_settings')
      .select('value')
      .eq('key', BACKUP_KEY)
      .maybeSingle();

    return NextResponse.json({
      hasBackup: !!data,
      backup: data?.value || null,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const sb = getSupabase();

    // ── RESTORE MODE ──
    if (body.action === 'restore') {
      const { data: backupRow } = await sb
        .from('app_settings')
        .select('value')
        .eq('key', BACKUP_KEY)
        .maybeSingle();

      if (!backupRow?.value?.entries) {
        return NextResponse.json({ error: 'No backup found to restore' }, { status: 404 });
      }

      const entries: BackupEntry[] = backupRow.value.entries;
      let restored = 0;

      for (const entry of entries) {
        try {
          await sb
            .from(entry.table)
            .update({ [entry.field]: entry.originalValue })
            .eq('id', entry.id);
          restored++;
        } catch (e) {
          console.warn(`[Email-Reset] Failed to restore ${entry.table}.${entry.field} id=${entry.id}:`, e);
        }
      }

      return NextResponse.json({
        success: true,
        action: 'restore',
        totalEntries: entries.length,
        restored,
      });
    }

    // ── BACKUP + REPLACE MODE ──
    const backup: BackupEntry[] = [];
    const stats: Record<string, number> = {};

    // 1. clients.email
    const { data: clients } = await sb
      .from('clients')
      .select('id, data')
      .not('data', 'is', null);

    for (const c of (clients || [])) {
      const email = c.data?.email;
      if (email && email !== SAFE_EMAIL) {
        backup.push({ table: 'clients', id: c.id, field: 'data', originalValue: email });
        // Update the email field inside the JSONB data column
        const updatedData = { ...c.data, email: SAFE_EMAIL };
        await sb.from('clients').update({ data: updatedData }).eq('id', c.id);
        stats['clients.email'] = (stats['clients.email'] || 0) + 1;
      }
    }

    // 2. leads.email
    const { data: leads } = await sb
      .from('leads')
      .select('id, data')
      .not('data', 'is', null);

    for (const l of (leads || [])) {
      const email = l.data?.email;
      if (email && email !== SAFE_EMAIL) {
        backup.push({ table: 'leads', id: l.id, field: 'data', originalValue: email });
        const updatedData = { ...l.data, email: SAFE_EMAIL };
        await sb.from('leads').update({ data: updatedData }).eq('id', l.id);
        stats['leads.email'] = (stats['leads.email'] || 0) + 1;
      }
    }

    // 3. seo_plans.clientEmail (inside data JSONB)
    const { data: seoPlans } = await sb
      .from('seo_plans')
      .select('id, data')
      .not('data', 'is', null);

    for (const p of (seoPlans || [])) {
      const email = p.data?.clientEmail;
      if (email && email !== SAFE_EMAIL) {
        backup.push({ table: 'seo_plans', id: p.id, field: 'data', originalValue: email });
        const updatedData = { ...p.data, clientEmail: SAFE_EMAIL };
        await sb.from('seo_plans').update({ data: updatedData }).eq('id', p.id);
        stats['seo_plans.clientEmail'] = (stats['seo_plans.clientEmail'] || 0) + 1;
      }
    }

    // 4. automation_rules.targetEmail (inside data JSONB)
    const { data: rules } = await sb
      .from('automation_rules')
      .select('id, data')
      .not('data', 'is', null);

    for (const r of (rules || [])) {
      const email = r.data?.targetEmail;
      if (email && email !== SAFE_EMAIL) {
        backup.push({ table: 'automation_rules', id: r.id, field: 'data', originalValue: email });
        const updatedData = { ...r.data, targetEmail: SAFE_EMAIL };
        await sb.from('automation_rules').update({ data: updatedData }).eq('id', r.id);
        stats['automation_rules.targetEmail'] = (stats['automation_rules.targetEmail'] || 0) + 1;
      }
    }

    // 5. sequence_subscribers.email (inside data JSONB)
    const { data: subs } = await sb
      .from('sequence_subscribers')
      .select('id, data')
      .not('data', 'is', null);

    for (const s of (subs || [])) {
      const email = s.data?.email;
      if (email && email !== SAFE_EMAIL) {
        backup.push({ table: 'sequence_subscribers', id: s.id, field: 'data', originalValue: email });
        const updatedData = { ...s.data, email: SAFE_EMAIL };
        await sb.from('sequence_subscribers').update({ data: updatedData }).eq('id', s.id);
        stats['sequence_subscribers.email'] = (stats['sequence_subscribers.email'] || 0) + 1;
      }
    }

    // Save backup to app_settings
    await sb.from('app_settings').upsert({
      key: BACKUP_KEY,
      value: {
        entries: backup,
        createdAt: new Date().toISOString(),
        totalBacked: backup.length,
        safeEmail: SAFE_EMAIL,
      },
    }, { onConflict: 'key' });

    // Enable email automations
    await sb.from('app_settings').upsert({
      key: 'email_automations_enabled',
      value: { enabled: true, updatedAt: new Date().toISOString() },
    }, { onConflict: 'key' });
    clearEmailEnabledCache();

    return NextResponse.json({
      success: true,
      action: 'backup_and_replace',
      totalBackedUp: backup.length,
      replacedWith: SAFE_EMAIL,
      emailAutomationsEnabled: true,
      stats,
      tablesProcessed: [
        'clients',
        'leads',
        'seo_plans',
        'automation_rules',
        'sequence_subscribers',
      ],
    });
  } catch (e: any) {
    console.error('[Email-Safety-Reset] Error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
