/**
 * Knowledge Engine — Orchestrator
 *
 * Runs a full knowledge extraction across all clients:
 * 1. Loads all data (clients, campaigns, ads, ad sets, leads)
 * 2. Builds ExtractionContext per client
 * 3. Runs extractAllKnowledge()
 * 4. Deduplicates against existing knowledge items
 * 5. Persists new items / updates existing ones
 * 6. Triggers playbook regeneration
 *
 * No AI API calls. Fully deterministic.
 */

import { createClient } from '@supabase/supabase-js';
import { campaigns, adSets, ads, leads, knowledgeItems, industryPlaybooks } from '@/lib/db';
import type { KnowledgeItem, IndustryPlaybook } from '@/lib/db/schema';
import { extractAllKnowledge, type ExtractionContext, type RawKnowledge } from './extraction-rules';
import { buildPlaybookForIndustry } from './industry-playbook';
import { applyDecay } from './confidence-decay';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
);

// ── Safety limits ──

const SAFETY = {
  maxItemsPerRun: 200,
  dedupeWindowDays: 30,
  minConfidenceToKeep: 15,
  maxDecayScore: 90,
};

// ── Types ──

export interface KnowledgeExtractionOptions {
  clientId?: string;      // single client, or all if omitted
  forceRefresh?: boolean; // re-extract even if recent items exist
  triggeredBy: string;    // 'manual' | 'scheduled' | 'growth_run'
}

export interface KnowledgeExtractionResult {
  status: 'completed' | 'failed';
  totalExtracted: number;
  newItems: number;
  updatedItems: number;
  skippedDuplicates: number;
  playbooksUpdated: number;
  decayApplied: number;
  errors: string[];
  durationMs: number;
}

// ── Main extraction runner ──

export async function runKnowledgeExtraction(
  options: KnowledgeExtractionOptions
): Promise<KnowledgeExtractionResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  let newItems = 0;
  let updatedItems = 0;
  let skippedDuplicates = 0;
  let playbooksUpdated = 0;
  let decayApplied = 0;

  try {
    // 1. Load all data
    const contexts = await buildExtractionContexts(options.clientId);
    if (contexts.length === 0) {
      return {
        status: 'completed',
        totalExtracted: 0,
        newItems: 0,
        updatedItems: 0,
        skippedDuplicates: 0,
        playbooksUpdated: 0,
        decayApplied: 0,
        errors: ['אין נתוני לקוחות להפקת ידע'],
        durationMs: Date.now() - startTime,
      };
    }

    // 2. Extract knowledge
    const rawItems = extractAllKnowledge(contexts);
    const capped = rawItems.slice(0, SAFETY.maxItemsPerRun);

    // 3. Load existing knowledge items for dedup
    const existing = await knowledgeItems.getAllAsync();

    // 4. Persist — dedup, create new, update existing
    for (const raw of capped) {
      try {
        const duplicate = findDuplicate(raw, existing);

        if (duplicate) {
          // Update confidence if the new evidence is stronger
          if (raw.confidenceScore > duplicate.confidenceScore) {
            await knowledgeItems.updateAsync(duplicate.id, {
              confidenceScore: raw.confidenceScore,
              evidenceData: raw.evidenceData,
              performanceMetrics: raw.performanceMetrics,
              summary: raw.summary,
              decayScore: 0, // reset decay on fresh evidence
              updatedAt: new Date().toISOString(),
            } as Partial<KnowledgeItem>);
            updatedItems++;
          } else {
            skippedDuplicates++;
          }
        } else {
          // Create new item
          const newItem: Omit<KnowledgeItem, 'id'> = {
            type: raw.type,
            industry: raw.industry,
            clientId: raw.clientId,
            clientName: raw.clientName,
            sourceType: raw.sourceType,
            sourceId: raw.sourceId,
            title: raw.title,
            summary: raw.summary,
            evidenceData: raw.evidenceData,
            performanceMetrics: raw.performanceMetrics,
            usageCount: 0,
            confidenceScore: raw.confidenceScore,
            decayScore: 0,
            tags: raw.tags,
            platform: raw.platform,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          await knowledgeItems.createAsync(newItem);
          newItems++;
        }
      } catch (err) {
        errors.push(`Failed to persist item: ${raw.title} — ${(err as Error).message}`);
      }
    }

    // 5. Apply decay to old items
    decayApplied = await applyDecayToOldItems();

    // 6. Regenerate playbooks for affected industries
    const industries = new Set(capped.map(r => r.industry).filter(Boolean));
    for (const industry of industries) {
      try {
        const allItems = await knowledgeItems.getAllAsync();
        const industryItems = allItems.filter(
          item => item.industry === industry && item.confidenceScore >= SAFETY.minConfidenceToKeep
        );
        const playbook = buildPlaybookForIndustry(industry, industryItems);
        await persistPlaybook(playbook);
        playbooksUpdated++;
      } catch (err) {
        errors.push(`Failed to update playbook for ${industry}: ${(err as Error).message}`);
      }
    }

    return {
      status: 'completed',
      totalExtracted: capped.length,
      newItems,
      updatedItems,
      skippedDuplicates,
      playbooksUpdated,
      decayApplied,
      errors,
      durationMs: Date.now() - startTime,
    };
  } catch (err) {
    return {
      status: 'failed',
      totalExtracted: 0,
      newItems: 0,
      updatedItems: 0,
      skippedDuplicates: 0,
      playbooksUpdated: 0,
      decayApplied: 0,
      errors: [`Fatal extraction error: ${(err as Error).message}`],
      durationMs: Date.now() - startTime,
    };
  }
}

// ── Dashboard data ──

export async function getKnowledgeDashboardData(clientId?: string) {
  const allItems = await knowledgeItems.getAllAsync();
  const allPlaybooks = await industryPlaybooks.getAllAsync();

  const filtered = clientId
    ? allItems.filter(i => i.clientId === clientId || i.clientId === null)
    : allItems;

  // Active items (confidence > min, decay < max)
  const activeItems = filtered.filter(
    i => i.confidenceScore >= SAFETY.minConfidenceToKeep && i.decayScore < SAFETY.maxDecayScore
  );

  // Group by type
  const byType: Record<string, KnowledgeItem[]> = {};
  for (const item of activeItems) {
    if (!byType[item.type]) byType[item.type] = [];
    byType[item.type].push(item);
  }

  // Sort each group by confidence descending
  for (const key of Object.keys(byType)) {
    byType[key].sort((a, b) => b.confidenceScore - a.confidenceScore);
  }

  // Top items across all types
  const topItems = [...activeItems]
    .sort((a, b) => b.confidenceScore - a.confidenceScore)
    .slice(0, 20);

  // KPIs
  const totalItems = activeItems.length;
  const avgConfidence = totalItems > 0
    ? activeItems.reduce((s, i) => s + i.confidenceScore, 0) / totalItems
    : 0;
  const crossClientPatterns = activeItems.filter(i => i.type === 'pattern').length;
  const industriesCovered = new Set(activeItems.map(i => i.industry).filter(Boolean)).size;
  const recentItems = activeItems.filter(i => {
    const diff = Date.now() - new Date(i.updatedAt).getTime();
    return diff < 7 * 24 * 60 * 60 * 1000; // last 7 days
  }).length;

  return {
    kpis: {
      totalItems,
      avgConfidence: Math.round(avgConfidence),
      crossClientPatterns,
      industriesCovered,
      recentItems,
    },
    byType,
    topItems,
    playbooks: allPlaybooks,
  };
}

// ── Helpers ──

async function buildExtractionContexts(clientId?: string): Promise<ExtractionContext[]> {
  // Load clients
  let clientsQuery = supabase.from('clients').select('*');
  if (clientId) {
    clientsQuery = clientsQuery.eq('id', clientId);
  }
  const { data: clientsData } = await clientsQuery;
  const clients = clientsData || [];

  if (clients.length === 0) return [];

  // Load related data
  const [allCampaigns, allAdSets, allAds, allLeads] = await Promise.all([
    campaigns.getAllAsync(),
    adSets.getAllAsync(),
    ads.getAllAsync(),
    leads.getAllAsync(),
  ]);

  const contexts: ExtractionContext[] = [];

  for (const client of clients) {
    if (client.status !== 'active') continue;

    const clientCampaigns = allCampaigns.filter((c: any) => c.clientId === client.id);
    const campaignIds = new Set(clientCampaigns.map((c: any) => c.id));

    const clientAdSets = allAdSets.filter((a: any) => campaignIds.has(a.campaignId));
    const adSetIds = new Set(clientAdSets.map((a: any) => a.id));

    const clientAds = allAds.filter((a: any) => campaignIds.has(a.campaignId) || adSetIds.has(a.adSetId));
    const clientLeads = allLeads.filter((l: any) => l.clientId === client.id);

    // Only include clients with enough data
    if (clientCampaigns.length === 0 && clientAds.length === 0) continue;

    contexts.push({
      clientId: client.id,
      clientName: client.name || client.company || '',
      industry: client.businessField || 'general',
      campaigns: clientCampaigns,
      adSets: clientAdSets,
      ads: clientAds,
      leads: clientLeads,
    });
  }

  return contexts;
}

function findDuplicate(raw: RawKnowledge, existing: KnowledgeItem[]): KnowledgeItem | null {
  // Match by type + industry + clientId + similar title
  for (const item of existing) {
    if (item.type !== raw.type) continue;
    if (item.industry !== raw.industry) continue;
    if (item.clientId !== raw.clientId) continue;

    // Check age — only dedup within window
    const ageMs = Date.now() - new Date(item.updatedAt).getTime();
    const windowMs = SAFETY.dedupeWindowDays * 24 * 60 * 60 * 1000;
    if (ageMs > windowMs) continue;

    // Title similarity — simple prefix match
    const existingPrefix = item.title.substring(0, 40).toLowerCase();
    const rawPrefix = raw.title.substring(0, 40).toLowerCase();
    if (existingPrefix === rawPrefix) return item;

    // Source match
    if (raw.sourceId && item.sourceId === raw.sourceId) return item;
  }

  return null;
}

async function applyDecayToOldItems(): Promise<number> {
  const allItems = await knowledgeItems.getAllAsync();
  let decayed = 0;

  for (const item of allItems) {
    const newDecay = applyDecay(item);
    if (newDecay !== item.decayScore) {
      await knowledgeItems.updateAsync(item.id, {
        decayScore: newDecay,
        updatedAt: new Date().toISOString(),
      } as Partial<KnowledgeItem>);
      decayed++;
    }
  }

  return decayed;
}

async function persistPlaybook(playbook: Omit<IndustryPlaybook, 'id'>): Promise<void> {
  const existing = await industryPlaybooks.getAllAsync();
  const match = existing.find(p => p.industry === playbook.industry);

  if (match) {
    await industryPlaybooks.updateAsync(match.id, {
      ...playbook,
      lastUpdated: new Date().toISOString(),
    } as Partial<IndustryPlaybook>);
  } else {
    await industryPlaybooks.createAsync({
      ...playbook,
      lastUpdated: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    });
  }
}
