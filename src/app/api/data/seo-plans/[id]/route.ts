import { NextRequest, NextResponse } from 'next/server';
import { seoPlans } from '@/lib/db';

/**
 * SERVER-SIDE sanitization — ensures no {value, confidence, source} objects
 * ever reach the client. This is the DEFINITIVE fix for React Error #310.
 */
const CONTAINER_KEYS = new Set([
  'websiteScan','goals','insights','visibilityResults','visibilityQueries',
  'weeks','phases','days','tasks','results','issues','aiQueries',
  'scannedPages','platformStatuses','websiteFacts','metrics',
  'h1Tags','h2Tags','schemaTypes','techStack',
  'wpConnection','businessProfile','automationLog','automationResults',
  'clientKeywords','aiKeywords','aiArticles','aiCompetitors','aiContentGaps',
  'contentGaps','competitors','gmailSettings','emailSettings',
]);

function serverSanitize(obj: any, depth = 0): any {
  if (depth > 40) return typeof obj === 'object' ? JSON.stringify(obj) : obj;
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (obj instanceof Date) return obj.toISOString();
  if (Array.isArray(obj)) return obj.map(item => serverSanitize(item, depth + 1));

  const result: any = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val === null || val === undefined || typeof val !== 'object') {
      result[key] = val;
    } else if (val instanceof Date) {
      result[key] = (val as Date).toISOString();
    } else if (Array.isArray(val)) {
      result[key] = val.map(item => serverSanitize(item, depth + 1));
    } else {
      // It's a plain object
      if (CONTAINER_KEYS.has(key)) {
        // Recurse into container objects
        result[key] = serverSanitize(val, depth + 1);
      } else if ('value' in (val as any)) {
        // Evidence-pattern object {value, confidence?, source?} — flatten to value
        const v = (val as any).value;
        result[key] = (v !== null && v !== undefined && typeof v === 'object') ? JSON.stringify(v) : v;
      } else {
        // Unknown object at a non-container key — check if it has renderable sub-objects
        const hasNestedObjects = Object.values(val as any).some(
          (v: any) => v !== null && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date)
        );
        if (hasNestedObjects) {
          result[key] = serverSanitize(val, depth + 1);
        } else {
          // Flat object with only primitive values — stringify it
          result[key] = JSON.stringify(val);
        }
      }
    }
  }
  return result;
}

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const item = await seoPlans.getByIdAsync(id);
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    // DEBUG: Log raw clientKeywords from DB
    const rawCK = (item as any).clientKeywords;
    console.log(`[SEO-PLAN-GET] id=${id} clientKeywords type=${typeof rawCK} isArray=${Array.isArray(rawCK)} length=${rawCK?.length ?? 'N/A'}`);
    if (rawCK) console.log(`[SEO-PLAN-GET] clientKeywords sample:`, JSON.stringify(rawCK)?.slice(0, 300));
    // SERVER-SIDE sanitization — strip all evidence-pattern objects before sending to client
    const sanitized = serverSanitize(JSON.parse(JSON.stringify(item)));
    const sanitizedCK = (sanitized as any).clientKeywords;
    console.log(`[SEO-PLAN-GET] AFTER sanitize clientKeywords type=${typeof sanitizedCK} isArray=${Array.isArray(sanitizedCK)} length=${sanitizedCK?.length ?? 'N/A'}`);
    return NextResponse.json(sanitized);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    const updated = await seoPlans.updateAsync(id, { ...body, updatedAt: new Date().toISOString() });
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update' }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const deleted = await seoPlans.deleteAsync(id);
    if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
