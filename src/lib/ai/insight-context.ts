/**
 * Central server-side context builder for all AI insight generators.
 *
 * Every generator (brand-weakness, customer-profile, trend-engine,
 * competitor-analysis, creative-dna) consumes the SAME InsightContext
 * object — no more ad-hoc payload shapes from the frontend.
 *
 * Usage from any API route:
 *   const ctx = await buildClientInsightContext(clientId);
 *   if (!ctx.valid) return NextResponse.json({ error: ctx.error }, { status: 400 });
 *   // use ctx.data.* for prompt building
 */

import { getClientById } from '@/lib/db/client-helpers';
import { getSupabase, ensureTable } from '@/lib/db/store';
import { clientKnowledge } from '@/lib/db/collections';
import type { ClientKnowledge } from '@/lib/db/schema';

// ============================================================================
// Types
// ============================================================================

export interface InsightContext {
  clientId: string;
  clientName: string;
  businessType: string;       // e.g. 'marketing', 'branding', 'ecommerce'
  businessField: string;      // e.g. 'real estate', 'restaurants'
  brandName: string;          // company name or client name
  targetAudience: string;     // from marketingGoals or research
  marketingGoals: string;
  keyMarketingMessages: string;
  offerSummary: string;       // derived from business field + type
  // URLs
  websiteUrl: string;
  facebookUrl: string;
  instagramUrl: string;
  tiktokUrl: string;
  platforms: string[];        // non-empty platform names
  // Research & knowledge
  researchSummary: string;    // concatenated research context
  researchExists: boolean;
  clientBrain: ClientKnowledge | null;
  // For trend-engine
  currentMonth: number;
  currentYear: number;
  // For competitor-analysis — extracted from research
  competitors: Array<{ name: string; instagramUrl?: string; facebookUrl?: string; websiteUrl?: string }>;
}

export type InsightContextResult =
  | { valid: true; data: InsightContext }
  | { valid: false; error: string; missingFields: string[] };

// ============================================================================
// Implementation
// ============================================================================

export async function buildClientInsightContext(clientId: string): Promise<InsightContextResult> {
  const missingFields: string[] = [];

  // 1. Fetch client from Supabase
  console.log(`[insight-context] Building context for clientId=${clientId}`);
  const client = await getClientById(clientId);
  if (!client) {
    console.warn(`[insight-context] Client not found: ${clientId}`);
    return { valid: false, error: `Client not found: ${clientId}`, missingFields: ['client'] };
  }

  // 2. Validate core required fields
  if (!client.businessField) missingFields.push('businessField');
  // businessType (clientType) has a default of 'marketing' from the helper, so it's always present

  // 3. Fetch client knowledge (brain) — non-fatal if missing
  let brain: ClientKnowledge | null = null;
  try {
    const allKnowledge = await clientKnowledge.getAllAsync();
    brain = allKnowledge.find((k: ClientKnowledge) => k.clientId === clientId) || null;
    console.log(`[insight-context] ClientKnowledge: ${brain ? 'found' : 'not found'}`);
  } catch (err) {
    console.warn('[insight-context] Failed to load clientKnowledge (table may not exist):', err instanceof Error ? err.message : err);
  }

  // 4. Fetch research from Supabase — non-fatal if missing
  let researchSummary = '';
  let researchExists = false;
  let competitors: Array<{ name: string; instagramUrl?: string; facebookUrl?: string; websiteUrl?: string }> = [];
  try {
    const sb = getSupabase();
    await ensureTable('client_research', `
      CREATE TABLE IF NOT EXISTS public.client_research (
        id text PRIMARY KEY,
        client_id text NOT NULL,
        summary text DEFAULT '',
        customer_profile text DEFAULT '',
        trend_engine text DEFAULT '',
        competitor_analysis text DEFAULT '',
        brand_weakness text DEFAULT '',
        client_brain text DEFAULT '',
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      );
    `);

    const { data, error } = await sb
      .from('client_research')
      .select('client_brain, competitor_analysis')
      .eq('client_id', clientId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      const brainJson = (data as Record<string, unknown>).client_brain as string;
      if (brainJson) {
        try {
          const parsed = JSON.parse(brainJson);
          if (parsed.status === 'complete') {
            researchExists = true;
            // Build summary from research sections
            const parts: string[] = [];
            if (parsed.identity) {
              if (parsed.identity.whatTheySell) parts.push(`מה הלקוח מוכר: ${parsed.identity.whatTheySell}`);
              if (parsed.identity.positioning) parts.push(`מיצוב: ${parsed.identity.positioning}`);
              if (parsed.identity.tone) parts.push(`טון: ${parsed.identity.tone}`);
              if (parsed.identity.uniqueValue) parts.push(`ערך ייחודי: ${parsed.identity.uniqueValue}`);
              if (parsed.identity.targetAudience) parts.push(`קהל יעד: ${parsed.identity.targetAudience}`);
            }
            if (parsed.audience?.primary) parts.push(`קהל עיקרי: ${parsed.audience.primary}`);
            if (parsed.audience?.painPoints?.length > 0) parts.push(`נקודות כאב: ${parsed.audience.painPoints.join(', ')}`);
            if (parsed.weaknesses?.length > 0) {
              parts.push(`חולשות: ${parsed.weaknesses.map((w: { area: string; description: string }) => `${w.area} — ${w.description}`).join('; ')}`);
            }
            researchSummary = parts.join('\n');

            // Extract competitors
            if (parsed.competitors && Array.isArray(parsed.competitors)) {
              competitors = parsed.competitors.map((c: { name?: string; instagramUrl?: string; facebookUrl?: string; websiteUrl?: string }) => ({
                name: c.name || 'Unknown',
                instagramUrl: c.instagramUrl,
                facebookUrl: c.facebookUrl,
                websiteUrl: c.websiteUrl,
              }));
            }
          }
        } catch {
          console.warn('[insight-context] Failed to parse research JSON');
        }
      }

      // Also try competitor_analysis column
      if (competitors.length === 0) {
        const compJson = (data as Record<string, unknown>).competitor_analysis as string;
        if (compJson) {
          try {
            const parsed = JSON.parse(compJson);
            if (parsed.competitors && Array.isArray(parsed.competitors)) {
              competitors = parsed.competitors.map((c: { name?: string; instagramUrl?: string; facebookUrl?: string; websiteUrl?: string }) => ({
                name: c.name || 'Unknown',
                instagramUrl: c.instagramUrl,
                facebookUrl: c.facebookUrl,
                websiteUrl: c.websiteUrl,
              }));
            }
          } catch { /* ignore */ }
        }
      }
    }
    console.log(`[insight-context] Research: exists=${researchExists}, competitors=${competitors.length}`);
  } catch (err) {
    console.warn('[insight-context] Failed to load research:', err instanceof Error ? err.message : err);
  }

  // 5. Build platforms list
  const platforms: string[] = [];
  if (client.facebookPageUrl) platforms.push('facebook');
  if (client.instagramProfileUrl) platforms.push('instagram');
  if (client.tiktokProfileUrl) platforms.push('tiktok');

  // 6. Derive target audience from multiple sources
  let targetAudience = '';
  if (brain?.audienceProfile) {
    targetAudience = brain.audienceProfile;
  } else if (client.marketingGoals) {
    targetAudience = client.marketingGoals;
  }

  // 7. Derive offer summary
  const offerSummary = `${client.name} — ${client.businessField || 'עסק'} (${client.clientType || 'marketing'})`;

  const now = new Date();

  const context: InsightContext = {
    clientId,
    clientName: client.name || '',
    businessType: client.clientType || 'marketing',
    businessField: client.businessField || '',
    brandName: client.company || client.name || '',
    targetAudience,
    marketingGoals: client.marketingGoals || '',
    keyMarketingMessages: client.keyMarketingMessages || '',
    offerSummary,
    websiteUrl: client.websiteUrl || '',
    facebookUrl: client.facebookPageUrl || '',
    instagramUrl: client.instagramProfileUrl || '',
    tiktokUrl: client.tiktokProfileUrl || '',
    platforms,
    researchSummary,
    researchExists,
    clientBrain: brain,
    currentMonth: now.getMonth() + 1,
    currentYear: now.getFullYear(),
    competitors,
  };

  // If critical fields are missing, still return valid but log warnings
  if (missingFields.length > 0) {
    console.warn(`[insight-context] Soft missing fields (non-blocking): ${missingFields.join(', ')}`);
  }

  console.log(`[insight-context] Context built: clientName="${context.clientName}", businessType="${context.businessType}", businessField="${context.businessField}", research=${researchExists}, brain=${!!brain}, competitors=${competitors.length}, platforms=${platforms.join(',')}`);
  return { valid: true, data: context };
}
