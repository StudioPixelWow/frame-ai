/**
 * Learning Loop
 *
 * Auto-suggests playbook updates from campaign performance data.
 * Analyzes winning hooks, CTAs, angles from real results
 * and proposes additions to the industry playbook.
 *
 * Flow:
 * 1. Scan campaign performance → find winners/losers
 * 2. Extract patterns (hooks, CTAs, audiences)
 * 3. Generate LearningSuggestion entries
 * 4. Admin reviews: accept → updates playbook, reject → archived
 *
 * No AI calls — rule-based pattern matching.
 */

import { createClient } from '@supabase/supabase-js';
import type { LearningSuggestion, AgencyCalibration } from './types';
import { getCalibration } from './calibration';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
);

// ── Campaign Performance Data (from existing tables) ──

interface CampaignPerformanceRow {
  id: string;
  clientId: string;
  industry: string;
  campaignName: string;
  adName?: string;
  hookText?: string;
  ctaText?: string;
  cpl: number;
  ctr: number;
  spend: number;
  leads: number;
  createdAt: string;
}

// ── Analyze & Generate Suggestions ──

export async function analyzeAndSuggest(industry: string): Promise<LearningSuggestion[]> {
  const suggestions: LearningSuggestion[] = [];
  const calibration = await getCalibration();
  const idealCPL = calibration.idealCplPerIndustry[industry] || calibration.idealCplPerIndustry.general || 100;

  // Fetch recent campaign data for this industry
  const performances = await getRecentPerformance(industry);
  if (performances.length === 0) return suggestions;

  // Find winning hooks (CTR > high threshold)
  const winningHooks = performances.filter(
    p => p.ctr >= calibration.highPerformanceThreshold && p.hookText
  );

  for (const winner of winningHooks) {
    if (!winner.hookText) continue;
    suggestions.push({
      id: `ls_hook_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      industry,
      type: 'hook',
      text: winner.hookText,
      reason: `CTR ${winner.ctr.toFixed(1)}% — מעל סף ביצועים גבוהים (${calibration.highPerformanceThreshold}%)`,
      confidence: Math.min(95, Math.round(50 + winner.ctr * 10)),
      source: `campaign: ${winner.campaignName} — CTR ${winner.ctr.toFixed(1)}%`,
      status: 'pending',
      createdAt: new Date().toISOString(),
    });
  }

  // Find winning CTAs (CPL < ideal)
  const winningCTAs = performances.filter(
    p => p.cpl > 0 && p.cpl < idealCPL * 0.8 && p.ctaText
  );

  for (const winner of winningCTAs) {
    if (!winner.ctaText) continue;
    suggestions.push({
      id: `ls_cta_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      industry,
      type: 'cta',
      text: winner.ctaText,
      reason: `CPL ₪${Math.round(winner.cpl)} — מתחת ל-80% מהאידיאל (₪${idealCPL})`,
      confidence: Math.min(90, Math.round(40 + (1 - winner.cpl / idealCPL) * 80)),
      source: `campaign: ${winner.campaignName} — CPL ₪${Math.round(winner.cpl)}`,
      status: 'pending',
      createdAt: new Date().toISOString(),
    });
  }

  // Find patterns to avoid (CTR < low threshold with significant spend)
  const losingPatterns = performances.filter(
    p => p.ctr < calibration.lowPerformanceThreshold && p.spend > 100 && p.hookText
  );

  for (const loser of losingPatterns) {
    if (!loser.hookText) continue;
    suggestions.push({
      id: `ls_avoid_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      industry,
      type: 'what_to_avoid',
      text: `הימנעו מהוק בסגנון: "${loser.hookText}"`,
      reason: `CTR ${loser.ctr.toFixed(1)}% עם הוצאה של ₪${Math.round(loser.spend)} — לא עובד`,
      confidence: Math.min(85, Math.round(30 + loser.spend / 10)),
      source: `campaign: ${loser.campaignName} — CTR ${loser.ctr.toFixed(1)}%, spend ₪${Math.round(loser.spend)}`,
      status: 'pending',
      createdAt: new Date().toISOString(),
    });
  }

  // High-performing content ideas (campaigns with leads > 10 and good CPL)
  const successfulCampaigns = performances.filter(
    p => p.leads >= 10 && p.cpl > 0 && p.cpl <= idealCPL
  );

  for (const success of successfulCampaigns.slice(0, 3)) {
    suggestions.push({
      id: `ls_content_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      industry,
      type: 'content_idea',
      text: `תוכן בסגנון: "${success.campaignName}" — ${success.leads} לידים ב-CPL ₪${Math.round(success.cpl)}`,
      reason: `קמפיין מצליח עם ${success.leads} לידים ו-CPL מתחת לאידיאל`,
      confidence: Math.min(80, Math.round(40 + success.leads * 2)),
      source: `campaign: ${success.campaignName}`,
      status: 'pending',
      createdAt: new Date().toISOString(),
    });
  }

  // Save suggestions to DB
  if (suggestions.length > 0) {
    await saveSuggestions(suggestions);
  }

  return suggestions;
}

// ── Suggestion CRUD ──

export async function getSuggestions(
  industry?: string,
  status?: LearningSuggestion['status']
): Promise<LearningSuggestion[]> {
  try {
    let query = supabase.from('agency_learning_suggestions').select('*').order('created_at', { ascending: false });
    if (industry) query = query.eq('industry', industry);
    if (status) query = query.eq('status', status);
    const { data } = await query;
    if (!data) return [];
    return data.map(mapSuggestionRow);
  } catch {
    return [];
  }
}

export async function updateSuggestionStatus(
  id: string,
  status: 'accepted' | 'rejected'
): Promise<boolean> {
  try {
    await supabase.from('agency_learning_suggestions').update({ status }).eq('id', id);
    return true;
  } catch {
    return false;
  }
}

async function saveSuggestions(suggestions: LearningSuggestion[]): Promise<void> {
  try {
    const rows = suggestions.map(s => ({
      id: s.id,
      industry: s.industry,
      type: s.type,
      text: s.text,
      reason: s.reason,
      confidence: s.confidence,
      source: s.source,
      status: s.status,
      created_at: s.createdAt,
    }));
    await supabase.from('agency_learning_suggestions').insert(rows);
  } catch { /* fire and forget */ }
}

// ── Get Recent Performance Data ──

async function getRecentPerformance(industry: string): Promise<CampaignPerformanceRow[]> {
  try {
    // Pull from campaigns table — join with clients for industry
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: clients } = await supabase
      .from('clients')
      .select('id')
      .eq('industry', industry);

    if (!clients || clients.length === 0) return [];
    const clientIds = clients.map(c => c.id);

    const { data: campaigns } = await supabase
      .from('campaigns')
      .select('*')
      .in('client_id', clientIds)
      .gte('created_at', thirtyDaysAgo);

    if (!campaigns) return [];

    return campaigns.map((c: any) => ({
      id: c.id,
      clientId: c.client_id,
      industry,
      campaignName: c.name || c.campaign_name || '',
      hookText: c.hook_text || c.hook || null,
      ctaText: c.cta_text || c.cta || null,
      cpl: parseFloat(c.cost_per_lead || c.cpl || '0') || 0,
      ctr: parseFloat(c.ctr || '0') || 0,
      spend: parseFloat(c.spend || c.total_spend || '0') || 0,
      leads: parseInt(c.leads || c.total_leads || '0', 10) || 0,
      createdAt: c.created_at || '',
    }));
  } catch {
    return [];
  }
}

// ── Row Mapper ──

function mapSuggestionRow(row: any): LearningSuggestion {
  return {
    id: row.id,
    industry: row.industry || '',
    type: row.type || 'hook',
    text: row.text || '',
    reason: row.reason || '',
    confidence: row.confidence || 0,
    source: row.source || '',
    status: row.status || 'pending',
    createdAt: row.created_at || '',
  };
}
