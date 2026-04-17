/**
 * GET /api/data/migrate-payments-table
 *
 * Temporary migration endpoint — rebuilds public.business_project_payments
 * with the correct schema. Preserves existing data via ADD COLUMN IF NOT EXISTS.
 *
 * DELETE THIS FILE after migration is confirmed.
 */

import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/store';

const TABLE = 'business_project_payments';

export async function GET() {
  const sb = getSupabase();
  const log: string[] = [];
  const errors: string[] = [];

  // ── Step 1: Check if table exists and count rows ─────────────────
  log.push('Step 1: Checking if table exists...');
  const { data: probe, error: probeErr } = await sb.from(TABLE).select('*').limit(100);
  if (probeErr) {
    const code = (probeErr as any)?.code ?? '';
    if (code === '42P01' || probeErr.message?.includes('does not exist')) {
      log.push(`Table "${TABLE}" does not exist. Will create from scratch.`);
    } else {
      log.push(`Probe error: ${probeErr.message}`);
    }
  }

  const existingRows = probe ?? [];
  log.push(`Existing rows found: ${existingRows.length}`);
  if (existingRows.length > 0) {
    log.push(`Sample row keys: ${Object.keys(existingRows[0]).join(', ')}`);
    log.push(`Rows data: ${JSON.stringify(existingRows, null, 2)}`);
  }

  // ── Step 2: Create table if not exists ───────────────────────────
  log.push('Step 2: CREATE TABLE IF NOT EXISTS...');
  const createDDL = `
    CREATE TABLE IF NOT EXISTS ${TABLE} (
      id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      business_project_id  TEXT,
      client_id            TEXT,
      milestone_id         TEXT,
      title                TEXT,
      description          TEXT,
      amount               NUMERIC NOT NULL DEFAULT 0,
      payment_type         TEXT,
      is_due               BOOLEAN NOT NULL DEFAULT false,
      is_paid              BOOLEAN NOT NULL DEFAULT false,
      status               TEXT NOT NULL DEFAULT 'pending',
      due_date             DATE,
      paid_at              TIMESTAMPTZ,
      created_at           TIMESTAMPTZ DEFAULT now(),
      updated_at           TIMESTAMPTZ DEFAULT now()
    );
  `;

  const { error: createErr } = await sb.rpc('exec_sql', { query: createDDL });
  if (createErr) {
    errors.push(`CREATE TABLE failed: ${createErr.message}`);
    log.push(`CREATE TABLE error: ${createErr.message}`);
  } else {
    log.push('CREATE TABLE: OK');
  }

  // ── Step 3: Add each column if not exists (idempotent) ───────────
  log.push('Step 3: Ensuring all required columns...');
  const columns = [
    { name: 'business_project_id', def: 'TEXT' },
    { name: 'client_id', def: 'TEXT' },
    { name: 'milestone_id', def: 'TEXT' },
    { name: 'title', def: 'TEXT' },
    { name: 'description', def: 'TEXT' },
    { name: 'amount', def: 'NUMERIC NOT NULL DEFAULT 0' },
    { name: 'payment_type', def: 'TEXT' },
    { name: 'is_due', def: 'BOOLEAN NOT NULL DEFAULT false' },
    { name: 'is_paid', def: 'BOOLEAN NOT NULL DEFAULT false' },
    { name: 'status', def: "TEXT NOT NULL DEFAULT 'pending'" },
    { name: 'due_date', def: 'DATE' },
    { name: 'paid_at', def: 'TIMESTAMPTZ' },
    { name: 'created_at', def: 'TIMESTAMPTZ DEFAULT now()' },
    { name: 'updated_at', def: 'TIMESTAMPTZ DEFAULT now()' },
  ];

  for (const col of columns) {
    const sql = `ALTER TABLE ${TABLE} ADD COLUMN IF NOT EXISTS ${col.name} ${col.def};`;
    const { error } = await sb.rpc('exec_sql', { query: sql });
    if (error) {
      errors.push(`ALTER ${col.name}: ${error.message}`);
      log.push(`  ${col.name}: FAILED — ${error.message}`);
    } else {
      log.push(`  ${col.name}: OK`);
    }
  }

  // ── Step 4: Verify final schema ──────────────────────────────────
  log.push('Step 4: Verifying final schema...');
  const schemaSQL = `
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = '${TABLE}'
    ORDER BY ordinal_position;
  `;
  const { data: schemaCols, error: schemaErr } = await sb.rpc('exec_sql', { query: schemaSQL });
  if (schemaErr) {
    errors.push(`Schema query failed: ${schemaErr.message}`);
    log.push(`Schema verification error: ${schemaErr.message}`);
  } else {
    log.push(`Schema columns returned: ${JSON.stringify(schemaCols)}`);
  }

  // ── Step 5: Test insert + delete to confirm write access ─────────
  log.push('Step 5: Testing insert...');
  const { data: testRow, error: testErr } = await sb.from(TABLE).insert({
    business_project_id: '__migration_test__',
    client_id: '__test__',
    title: 'Migration test row',
    amount: 0,
    payment_type: 'custom',
    is_due: false,
    is_paid: false,
    status: 'pending',
  }).select('id').single();

  if (testErr) {
    errors.push(`Test insert failed: ${testErr.message}`);
    log.push(`Test insert error: ${testErr.message}`);
  } else {
    log.push(`Test insert OK — id: ${testRow?.id}`);
    // Clean up test row
    const { error: delErr } = await sb.from(TABLE).delete().eq('id', testRow?.id);
    if (delErr) {
      log.push(`Test row cleanup failed: ${delErr.message}`);
    } else {
      log.push('Test row cleaned up.');
    }
  }

  // ── Step 6: Count final rows ─────────────────────────────────────
  const { data: finalRows, error: countErr } = await sb.from(TABLE).select('id, business_project_id, title, amount, payment_type, is_due, is_paid, status').limit(100);
  if (countErr) {
    log.push(`Final count error: ${countErr.message}`);
  } else {
    log.push(`Final row count: ${(finalRows ?? []).length}`);
    if ((finalRows ?? []).length > 0) {
      log.push(`Final rows: ${JSON.stringify(finalRows, null, 2)}`);
    }
  }

  return NextResponse.json({
    success: errors.length === 0,
    errors,
    log,
    existingRowCount: existingRows.length,
  }, { status: errors.length === 0 ? 200 : 500 });
}
