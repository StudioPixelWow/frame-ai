/**
 * SEO/GEO API — shared helpers
 * Validation, error handling, permissions, activity logging, retry logic
 */

import { NextRequest, NextResponse } from 'next/server';
import { seoPlans } from '@/lib/db';
import { getRequestRole, getRequestClientId, scopeForClient } from '@/lib/auth/api-guard';
import type { SeoPlan } from '@/lib/db/schema';

// ── Response factories ──────────────────────────────────────────────────────

export function ok(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function created(data: unknown) {
  return NextResponse.json(data, { status: 201 });
}

export function err(message: string, status = 400) {
  return NextResponse.json({ error: message, ts: new Date().toISOString() }, { status });
}

export function notFound(entity = 'Resource') {
  return err(`${entity} not found`, 404);
}

export function forbidden(msg = 'אין הרשאה לפעולה זו') {
  return err(msg, 403);
}

// ── Validation ──────────────────────────────────────────────────────────────

export function validateRequired(body: Record<string, unknown>, fields: string[]): string | null {
  const missing = fields.filter(f => body[f] === undefined || body[f] === null || body[f] === '');
  return missing.length > 0 ? `Missing required fields: ${missing.join(', ')}` : null;
}

export function validateEnum(value: string, allowed: string[], fieldName: string): string | null {
  if (!allowed.includes(value)) {
    return `Invalid ${fieldName}: must be one of ${allowed.join(', ')}`;
  }
  return null;
}

export function validateUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

// ── Plan loader with permission check ───────────────────────────────────────

export interface PlanLoadResult {
  plan: SeoPlan | null;
  error: NextResponse | null;
}

export async function loadPlan(planId: string, req?: NextRequest): Promise<PlanLoadResult> {
  if (!planId || planId === 'undefined') {
    return { plan: null, error: err('planId is required', 400) };
  }

  let plan: SeoPlan | null = null;
  try {
    plan = await seoPlans.getByIdAsync(planId);
  } catch (e) {
    console.error('[SEO-API] loadPlan error:', e);
    return { plan: null, error: err('Failed to load plan', 500) };
  }

  if (!plan) {
    return { plan: null, error: notFound('Plan') };
  }

  // Permission check
  if (req) {
    const accessErr = checkPlanAccess(req, plan);
    if (accessErr) return { plan: null, error: accessErr };
  }

  return { plan, error: null };
}

// ── Permission helpers ──────────────────────────────────────────────────────

export function checkPlanAccess(req: NextRequest, plan: SeoPlan): NextResponse | null {
  const role = getRequestRole(req);
  if (role === 'admin' || role === 'employee') return null;
  if (role === 'client') {
    const clientId = getRequestClientId(req);
    if (!clientId || plan.clientId !== clientId) {
      return forbidden('אין גישה לתוכנית זו');
    }
  }
  return null;
}

export function requireStaff(req: NextRequest): NextResponse | null {
  const role = getRequestRole(req);
  if (role !== 'admin' && role !== 'employee') {
    return forbidden('פעולה זו דורשת הרשאת צוות');
  }
  return null;
}

export function scopePlansForClient(req: NextRequest, plans: SeoPlan[]): SeoPlan[] {
  return scopeForClient(req, plans, (p) => p.clientId);
}

// ── Activity logging ────────────────────────────────────────────────────────

export function logActivity(planId: string, action: string, details?: Record<string, unknown>) {
  const entry = {
    ts: new Date().toISOString(),
    planId,
    action,
    ...(details || {}),
  };
  console.log('[SEO-ACTIVITY]', JSON.stringify(entry).slice(0, 500));
  // TODO: persist to activity_log table when available
}

// ── Safe plan update with retry ─────────────────────────────────────────────

export async function updatePlanSafe(
  planId: string,
  data: Partial<SeoPlan>,
  maxRetries = 2
): Promise<SeoPlan | null> {
  let attempt = 0;
  while (attempt <= maxRetries) {
    try {
      const updated = await seoPlans.updateAsync(planId, {
        ...data,
        updatedAt: new Date().toISOString(),
      } as Partial<SeoPlan>);
      return updated;
    } catch (e) {
      attempt++;
      if (attempt > maxRetries) {
        console.error(`[SEO-API] updatePlanSafe failed after ${maxRetries + 1} attempts:`, e);
        throw e;
      }
      await new Promise(r => setTimeout(r, 200 * attempt));
    }
  }
  return null;
}

// ── Safe JSON body parse ────────────────────────────────────────────────────

export async function parseBody<T = Record<string, unknown>>(req: NextRequest): Promise<{ body: T | null; error: NextResponse | null }> {
  try {
    const body = await req.json() as T;
    return { body, error: null };
  } catch {
    return { body: null, error: err('Invalid JSON body', 400) };
  }
}

// ── Keyword merger ─────────────────────────────────────────────────────────
// Merges clientKeywords (user-entered, priority) with aiKeywords (AI-generated)
// into a flat string[]. clientKeywords come first (higher priority).

export function mergeAllKeywords(plan: any): string[] {
  // Extract client keywords — handle both string[] and object[] formats
  const clientKws: string[] = (Array.isArray(plan.clientKeywords) ? plan.clientKeywords : [])
    .map((k: any) => (typeof k === 'string' ? k : k?.keyword || '').trim())
    .filter(Boolean);

  // Extract AI keywords
  const aiKws: string[] = (Array.isArray(plan.aiKeywords) ? plan.aiKeywords : [])
    .map((k: any) => (typeof k === 'string' ? k : k?.keyword || '').trim())
    .filter(Boolean);

  if (clientKws.length === 0) return aiKws;
  if (aiKws.length === 0) return clientKws;

  // Merge: client first, then AI (no duplicates)
  const seen = new Set(clientKws.map(k => k.toLowerCase()));
  const merged = [...clientKws];
  for (const kw of aiKws) {
    if (!seen.has(kw.toLowerCase())) {
      merged.push(kw);
      seen.add(kw.toLowerCase());
    }
  }
  return merged;
}

// ── ID generator ────────────────────────────────────────────────────────────

export function generateId(prefix: string): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${ts}_${rand}`;
}

// ── Wrap handler with error boundary ────────────────────────────────────────

type Handler = (req: NextRequest, ctx?: any) => Promise<NextResponse>;

export function withErrorBoundary(handler: Handler): Handler {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Internal server error';
      console.error('[SEO-API] Unhandled error:', error);
      return err(msg, 500);
    }
  };
}
