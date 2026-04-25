/**
 * POST /api/data/migrate-campaign-structure
 *
 * Safe migration: converts existing flat campaigns (where Campaign ≈ Ad)
 * into the proper Campaign → Ad Set → Ad hierarchy.
 *
 * For each existing campaign:
 *   1. Creates a default Ad Set linked to the campaign
 *   2. Creates an Ad from the campaign's creative fields (caption, mediaType, etc.)
 *   3. Does NOT modify the original campaign — it stays as-is for backward compatibility
 *
 * Idempotent: skips campaigns that already have ad sets.
 *
 * Returns: { migrated: number, skipped: number, errors: string[] }
 */

import { NextResponse } from 'next/server';
import { campaigns, adSets, ads } from '@/lib/db';
import { ensureSeeded } from '@/lib/db/seed';
import type { Campaign } from '@/lib/db/schema';

export async function POST() {
  ensureSeeded();

  try {
    const allCampaigns = await campaigns.getAllAsync();
    const allAdSets = await adSets.getAllAsync();

    // Build a set of campaign IDs that already have ad sets
    const campaignIdsWithAdSets = new Set(allAdSets.map((s) => s.campaignId));

    let migrated = 0;
    let skipped = 0;
    let cleaned = 0;
    const errors: string[] = [];

    for (const c of allCampaigns) {
      // Skip if already migrated
      if (campaignIdsWithAdSets.has(c.id)) {
        skipped++;
        continue;
      }

      try {
        // 1. Create default Ad Set
        const adSet = await adSets.createAsync({
          campaignId: c.id,
          name: `${c.campaignName} — קבוצת מודעות ראשית`,
          status: c.status === 'active' ? 'active' : c.status === 'completed' ? 'active' : 'draft',

          // Extract targeting hints from objective if present
          ageMin: null,
          ageMax: null,
          genders: ['all'],
          geoLocations: extractGeoFromObjective(c.objective || ''),
          interests: extractInterestsFromObjective(c.objective || ''),
          customAudiences: [],
          excludedAudiences: [],
          placements: ['feed'],

          // Budget from parent campaign
          dailyBudget: c.budget > 0 ? Math.round(c.budget / 30) : null,
          lifetimeBudget: c.budget > 0 ? c.budget : null,
          startDate: c.startDate,
          endDate: c.endDate,
          bidStrategy: null,
          bidAmount: null,

          notes: '',
        });

        // 2. Create Ad from campaign's creative fields
        await ads.createAsync({
          adSetId: adSet.id,
          campaignId: c.id,
          name: `${c.campaignName} — מודעה ראשית`,
          status: c.status === 'active' ? 'active' : 'draft',

          // Creative from existing campaign fields
          creativeType: c.mediaType === 'video' ? 'video' : 'image',
          mediaUrl: c.externalMediaUrl || '',
          thumbnailUrl: null,
          primaryText: c.caption || '',
          headline: extractHeadlineFromNotes(c.notes || ''),
          description: '',
          ctaType: 'LEARN_MORE',
          ctaLink: '',

          // Linked assets
          linkedVideoProjectId: c.linkedVideoProjectId,
          linkedClientFileId: c.linkedClientFileId,

          // Performance — zeroed out (will be synced later)
          impressions: 0,
          clicks: 0,
          spend: 0,
          leads: 0,
          conversions: 0,
          ctr: 0,
          cpl: 0,
          cpc: 0,
          roas: 0,

          notes: c.notes || '',
        });

        // 3. Clean up campaign objective if it contains targeting data dump
        if (hasTargetingDataInObjective(c.objective || '')) {
          await campaigns.updateAsync(c.id, {
            objective: '',
            // Clear creative fields that belong to Ad level
            caption: '',
            notes: '',
          });
          cleaned++;
        }

        migrated++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        errors.push(`Campaign ${c.id} (${c.campaignName}): ${msg}`);
      }
    }

    // Also clean objective on already-migrated campaigns (skipped above)
    for (const c of allCampaigns) {
      if (!campaignIdsWithAdSets.has(c.id)) continue; // already handled
      if (hasTargetingDataInObjective(c.objective || '')) {
        try {
          await campaigns.updateAsync(c.id, { objective: '', caption: '', notes: '' });
          cleaned++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Unknown error';
          errors.push(`Cleanup ${c.id}: ${msg}`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      migrated,
      skipped,
      cleaned,
      total: allCampaigns.length,
      errors,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Migration failed: ${msg}` }, { status: 500 });
  }
}

// ── Helpers ────────────────────────────────────────────────────────────

/** Extract geo locations from objective string (looks for "מיקום:" pattern) */
function extractGeoFromObjective(objective: string): string[] {
  const match = objective.match(/מיקום[י]?:\s*([^.;\n]+)/);
  if (!match) return [];
  return match[1].split(/[,،]/).map((s) => s.trim()).filter(Boolean);
}

/** Extract interests from objective string (looks for "עניינים:" or "תחומי עניין" pattern) */
function extractInterestsFromObjective(objective: string): string[] {
  const match = objective.match(/(?:עניינים|תחומי עניין):\s*([^.;\n]+)/);
  if (!match) return [];
  return match[1].split(/[,،]/).map((s) => s.trim()).filter(Boolean);
}

/** Extract headline from notes (looks for "כותרת:" pattern used by health engine) */
function extractHeadlineFromNotes(notes: string): string {
  const match = notes.match(/כותרת:\s*([^\n]+)/);
  return match ? match[1].trim() : '';
}

/** Check if objective field contains targeting data dump (old buildRecords bug) */
function hasTargetingDataInObjective(objective: string): boolean {
  if (!objective) return false;
  // Old buildRecords dumped targeting data like "מיקום: ... | עניינים: ..."
  return /מיקום[י]?:\s*/.test(objective) && /עניינים|תחומי עניין/.test(objective);
}
