/**
 * POST /api/data/meta-publish
 *
 * Publish an entire campaign hierarchy (Campaign → AdSet → Ads) to Meta.
 *
 * Flow:
 *   1. Validate campaign has ad sets and ads
 *   2. Fetch client Meta credentials
 *   3. Create campaign on Meta (if not already published)
 *   4. Create each ad set on Meta (if not already published)
 *   5. Create each ad on Meta (if not already published)
 *   6. Save Meta IDs to local DB
 *   7. Update campaign status to 'active'
 *
 * Safety:
 *   - Prevents double-publish (checks existing meta IDs)
 *   - Validates payload before sending
 *   - Logs all responses
 *   - Returns detailed step-by-step results
 *
 * Permissions:
 *   - admin: full access
 *   - employee: blocked (cannot execute Meta writes)
 *   - client: blocked (approve only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { campaigns, adSets, ads } from '@/lib/db';
import { getSupabase } from '@/lib/db/store';
import { logCampaignActivity } from '@/lib/optimization/activity-log';
import {
  createMetaCampaign,
  createMetaAdSet,
  createMetaAd,
  uploadImageToMeta,
  verifyPublishResults,
  getMetaRateLimit,
  mapObjectiveToMeta,
  mapCtaToMeta,
  type MetaCredentials,
  type MetaWriteResult,
} from '@/lib/meta-ads/write-service';

interface PublishStepResult {
  step: string;
  entity: string;
  entityId: string;
  success: boolean;
  metaId?: string;
  error?: string;
  skipped?: boolean;
}

export async function POST(req: NextRequest) {
  try {
    // ── Permission check ──
    const role = req.headers.get('x-user-role') || 'admin';
    if (role === 'client') {
      return NextResponse.json(
        { error: 'לקוחות לא יכולים לפרסם למטא — יש לפנות למנהל' },
        { status: 403 },
      );
    }
    if (role === 'employee') {
      return NextResponse.json(
        { error: 'עובדים לא יכולים לפרסם למטא — פנה למנהל מערכת' },
        { status: 403 },
      );
    }

    const body = await req.json();
    const { campaignId } = body as { campaignId: string };

    if (!campaignId) {
      return NextResponse.json({ error: 'campaignId is required' }, { status: 400 });
    }

    // ── Load campaign ──
    const campaign = await campaigns.getByIdAsync(campaignId);
    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // ── Load ad sets and ads ──
    const allAdSets = await adSets.getAllAsync();
    const campaignAdSets = allAdSets.filter(s => s.campaignId === campaignId);
    if (campaignAdSets.length === 0) {
      return NextResponse.json(
        { error: 'אין קבוצות מודעות בקמפיין — יש להוסיף קבוצת מודעות לפחות אחת לפני פרסום' },
        { status: 400 },
      );
    }

    const allAds = await ads.getAllAsync();
    const campaignAds = allAds.filter(a => a.campaignId === campaignId);

    // ── Get Meta credentials ──
    const creds = await getClientMetaCreds(campaign.clientId);
    if (!creds) {
      return NextResponse.json(
        { error: 'חסרים פרטי חיבור Meta — יש להגדיר Ad Account ID ו-Access Token בהגדרות הלקוח' },
        { status: 400 },
      );
    }

    const pageId = await getClientMetaPageId(campaign.clientId);
    if (!pageId) {
      return NextResponse.json(
        { error: 'חסר Meta Page ID — יש להגדיר בהגדרות חיבור הלקוח' },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();
    const results: PublishStepResult[] = [];
    let hasErrors = false;

    // ── Step 1: Publish Campaign ──
    let metaCampaignId = campaign.metaCampaignId || '';

    if (metaCampaignId) {
      results.push({
        step: 'campaign',
        entity: campaign.campaignName,
        entityId: campaign.id,
        success: true,
        metaId: metaCampaignId,
        skipped: true,
      });
      console.log(`[meta-publish] Campaign already published: ${metaCampaignId}`);
    } else {
      const campaignResult = await createMetaCampaign(creds, {
        name: campaign.campaignName,
        objective: mapObjectiveToMeta(campaign.objective || 'leads'),
        status: 'PAUSED',
        dailyBudget: campaign.budget ? Math.round(campaign.budget * 100) : undefined,
        specialAdCategories: [],
      });

      results.push({
        step: 'campaign',
        entity: campaign.campaignName,
        entityId: campaign.id,
        success: campaignResult.success,
        metaId: campaignResult.metaId,
        error: campaignResult.error,
      });

      if (campaignResult.success && campaignResult.metaId) {
        metaCampaignId = campaignResult.metaId;
        await campaigns.updateAsync(campaign.id, {
          metaCampaignId,
          metaSyncSource: 'local' as const,
          lastSyncedAt: now,
          updatedAt: now,
        });
      } else {
        hasErrors = true;
      }
    }

    // ── Step 2: Publish Ad Sets ──
    const adSetMetaIdMap: Record<string, string> = {};

    if (metaCampaignId) {
      for (const adSet of campaignAdSets) {
        if (adSet.metaAdSetId) {
          adSetMetaIdMap[adSet.id] = adSet.metaAdSetId;
          results.push({
            step: 'adset',
            entity: adSet.name,
            entityId: adSet.id,
            success: true,
            metaId: adSet.metaAdSetId,
            skipped: true,
          });
          continue;
        }

        // Build targeting
        const targeting: Record<string, unknown> = {};
        if (adSet.ageMin) targeting.age_min = adSet.ageMin;
        if (adSet.ageMax) targeting.age_max = adSet.ageMax;
        if (adSet.genders && adSet.genders.length > 0 && !adSet.genders.includes('all')) {
          targeting.genders = adSet.genders.map(g => g === 'male' ? 1 : g === 'female' ? 2 : 0).filter(Boolean);
        }
        if (adSet.geoLocations && adSet.geoLocations.length > 0) {
          targeting.geo_locations = { countries: adSet.geoLocations };
        }
        if (adSet.interests && adSet.interests.length > 0) {
          targeting.interests = adSet.interests.map(i => ({ id: i, name: i }));
        }
        // Ensure at least geo_locations
        if (!targeting.geo_locations) {
          targeting.geo_locations = { countries: ['IL'] };
        }

        const adSetResult = await createMetaAdSet(creds, {
          campaignId: metaCampaignId,
          name: adSet.name,
          status: 'PAUSED',
          dailyBudget: adSet.dailyBudget ? Math.round(adSet.dailyBudget * 100) : undefined,
          targeting,
          startTime: adSet.startDate || undefined,
          endTime: adSet.endDate || undefined,
        });

        results.push({
          step: 'adset',
          entity: adSet.name,
          entityId: adSet.id,
          success: adSetResult.success,
          metaId: adSetResult.metaId,
          error: adSetResult.error,
        });

        if (adSetResult.success && adSetResult.metaId) {
          adSetMetaIdMap[adSet.id] = adSetResult.metaId;
          await adSets.updateAsync(adSet.id, {
            metaAdSetId: adSetResult.metaId,
            lastSyncedAt: now,
            updatedAt: now,
          });
        } else {
          hasErrors = true;
        }
      }
    }

    // ── Step 3: Publish Ads ──
    if (Object.keys(adSetMetaIdMap).length > 0) {
      for (const ad of campaignAds) {
        if (ad.metaAdId) {
          results.push({
            step: 'ad',
            entity: ad.name,
            entityId: ad.id,
            success: true,
            metaId: ad.metaAdId,
            skipped: true,
          });
          continue;
        }

        const metaAdSetId = adSetMetaIdMap[ad.adSetId];
        if (!metaAdSetId) {
          results.push({
            step: 'ad',
            entity: ad.name,
            entityId: ad.id,
            success: false,
            error: 'Parent ad set was not published to Meta',
          });
          hasErrors = true;
          continue;
        }

        // Upload image to Meta CDN if mediaUrl exists (get image_hash for reliability)
        let imageHash: string | undefined;
        if (ad.mediaUrl) {
          const imgResult = await uploadImageToMeta(creds, {
            imageUrl: ad.mediaUrl,
            fileName: `${ad.name}_image`,
          });
          if (imgResult.success && imgResult.imageHash) {
            imageHash = imgResult.imageHash;
            console.log(`[meta-publish] ✅ Image uploaded for ad "${ad.name}": hash=${imageHash}`);
          } else {
            console.warn(`[meta-publish] ⚠️ Image upload failed for "${ad.name}": ${imgResult.error} — falling back to URL`);
          }
        }

        const adResult = await createMetaAd(creds, {
          adSetId: metaAdSetId,
          name: ad.name,
          status: 'PAUSED',
          creative: {
            pageId,
            message: ad.primaryText || undefined,
            headline: ad.headline || undefined,
            description: ad.description || undefined,
            linkUrl: ad.ctaLink || undefined,
            imageUrl: !imageHash ? (ad.mediaUrl || undefined) : undefined,
            imageHash: imageHash || undefined,
            callToAction: mapCtaToMeta(ad.ctaType || 'LEARN_MORE'),
          },
        });

        results.push({
          step: 'ad',
          entity: ad.name,
          entityId: ad.id,
          success: adResult.success,
          metaId: adResult.metaId,
          error: adResult.error,
        });

        if (adResult.success && adResult.metaId) {
          await ads.updateAsync(ad.id, {
            metaAdId: adResult.metaId,
            status: 'active',
            lastSyncedAt: now,
            updatedAt: now,
          });
        } else {
          hasErrors = true;
        }
      }
    }

    // ── Step 4: Update campaign status ──
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    const skipCount = results.filter(r => r.skipped).length;

    if (!hasErrors) {
      await campaigns.updateAsync(campaign.id, {
        status: 'active',
        updatedAt: now,
      });
    }

    // ── Step 5: Post-creation verification ──
    const entitiesToVerify = results
      .filter(r => r.success && !r.skipped && r.metaId)
      .map(r => ({
        type: r.step as 'campaign' | 'adset' | 'ad',
        metaId: r.metaId!,
      }));

    let verificationNote = '';
    if (entitiesToVerify.length > 0) {
      try {
        const verification = await verifyPublishResults(creds, entitiesToVerify);
        if (!verification.allVerified) {
          verificationNote = ` (⚠️ ${verification.failedCount} entities failed verification on Meta)`;
          console.warn(`[meta-publish] ⚠️ Verification: ${verification.failedCount}/${entitiesToVerify.length} entities NOT found on Meta`);
          for (const v of verification.results) {
            if (!v.exists) {
              console.error(`[meta-publish] ❌ ${v.entityType} ${v.metaId} NOT verified: ${v.error}`);
            }
          }
        } else {
          console.log(`[meta-publish] ✅ All ${entitiesToVerify.length} entities verified on Meta`);
        }
      } catch (verifyErr) {
        console.warn(`[meta-publish] ⚠️ Verification step failed (non-critical):`, verifyErr);
      }
    }

    // ── Check rate limits ──
    const rateLimit = getMetaRateLimit();
    if (rateLimit?.isThrottled) {
      console.warn(`[meta-publish] ⚠️ Rate limit warning after publish: call=${rateLimit.callCount}% cpu=${rateLimit.totalCputime}% time=${rateLimit.totalTime}%`);
    }

    // ── Log activity ──
    await logCampaignActivity(
      campaignId,
      campaign.clientId,
      hasErrors ? 'publish_partial' : 'publish_complete',
      hasErrors
        ? `פרסום חלקי למטא — ${successCount} הצליחו, ${failCount} נכשלו`
        : `הקמפיין פורסם למטא בהצלחה — ${successCount - skipCount} חדשים, ${skipCount} כבר קיימים`,
      JSON.stringify({ results }),
      'admin',
    );

    return NextResponse.json({
      success: !hasErrors,
      message: hasErrors
        ? `פרסום חלקי: ${successCount} הצליחו, ${failCount} נכשלו${verificationNote}`
        : `הקמפיין פורסם בהצלחה למטא!${verificationNote}`,
      results,
      summary: {
        total: results.length,
        success: successCount,
        failed: failCount,
        skipped: skipCount,
      },
      rateLimit: rateLimit ? {
        callCount: rateLimit.callCount,
        totalCputime: rateLimit.totalCputime,
        totalTime: rateLimit.totalTime,
        isThrottled: rateLimit.isThrottled,
      } : null,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[meta-publish] Error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ── Helpers (shared pattern with campaign-actions route) ──

async function getClientMetaCreds(clientId: string): Promise<MetaCredentials | null> {
  try {
    const sb = getSupabase();
    const { data } = await sb
      .from('clients')
      .select('meta_ad_account_id, meta_access_token')
      .eq('id', clientId)
      .maybeSingle();

    if (!data) return null;
    const adAccountId = (data as Record<string, unknown>).meta_ad_account_id as string;
    const accessToken = (data as Record<string, unknown>).meta_access_token as string;
    if (!adAccountId || !accessToken) return null;

    return { adAccountId, accessToken };
  } catch {
    return null;
  }
}

async function getClientMetaPageId(clientId: string): Promise<string | null> {
  try {
    const sb = getSupabase();
    const { data } = await sb
      .from('clients')
      .select('meta_page_id')
      .eq('id', clientId)
      .maybeSingle();
    return (data as Record<string, unknown>)?.meta_page_id as string || null;
  } catch {
    return null;
  }
}
