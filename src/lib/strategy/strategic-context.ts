/**
 * Strategic Context Builder
 *
 * Collects all relevant data for a client and builds a comprehensive
 * strategic context object. This feeds the decision engine.
 *
 * Integrates: BI, Growth Engine, Knowledge Layer, Campaign System, Content, Client Data
 * No AI API calls. All data assembly is deterministic.
 */

import { createClient } from '@supabase/supabase-js';
import { campaigns, adSets, ads, leads, growthOpportunities, growthActions, knowledgeItems, approvals } from '@/lib/db/collections';
import type { Campaign, Ad, AdSet, Lead, GrowthOpportunity, GrowthAction, KnowledgeItem, Approval } from '@/lib/db/schema';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
);

// ── Strategic Context shape ──

export interface StrategicContext {
  client: ClientSnapshot;
  campaigns: CampaignSnapshot;
  performance: PerformanceSnapshot;
  leads: LeadSnapshot;
  content: ContentSnapshot;
  growth: GrowthSnapshot;
  knowledge: KnowledgeSnapshot;
  approvals: ApprovalSnapshot;
  platforms: PlatformSnapshot;
  risks: string[];
  strengths: string[];
  dataQuality: 'rich' | 'moderate' | 'sparse' | 'insufficient';
}

export interface ClientSnapshot {
  id: string;
  name: string;
  company: string;
  industry: string;
  status: string;
  retainerAmount: number;
  clientType: string;
  marketingGoals: string;
}

export interface CampaignSnapshot {
  total: number;
  active: number;
  paused: number;
  totalBudget: number;
  totalSpend: number;
  avgCampaignAge: number; // days
  platforms: string[];
}

export interface PerformanceSnapshot {
  totalImpressions: number;
  totalClicks: number;
  totalLeads: number;
  totalSpend: number;
  avgCtr: number;
  avgCpl: number;
  ctrTrend: 'up' | 'stable' | 'down' | 'unknown';
  cplTrend: 'up' | 'stable' | 'down' | 'unknown';
  bestCampaignId: string | null;
  worstCampaignId: string | null;
}

export interface LeadSnapshot {
  total: number;
  thisMonth: number;
  lastMonth: number;
  trend: 'growing' | 'stable' | 'declining' | 'unknown';
  avgQuality: number;
  conversionRate: number;
}

export interface ContentSnapshot {
  activeCampaignAds: number;
  highPerformingAds: number;
  lowPerformingAds: number;
  adVariety: 'diverse' | 'moderate' | 'stale';
}

export interface GrowthSnapshot {
  pendingOpportunities: number;
  pendingActions: number;
  executedActions: number;
  topOpportunityType: string | null;
}

export interface KnowledgeSnapshot {
  totalItems: number;
  highConfidenceItems: number;
  topInsight: string | null;
  industryPlaybookExists: boolean;
}

export interface ApprovalSnapshot {
  pendingCount: number;
  recentlyApproved: number;
  recentlyRejected: number;
}

export interface PlatformSnapshot {
  active: string[];
  bestPerforming: string | null;
  worstPerforming: string | null;
  unusedRecommended: string[];
}

// ── Main builder ──

export async function buildStrategicContext(clientId: string): Promise<StrategicContext | null> {
  // Load client
  const { data: clientData } = await supabase.from('clients').select('*').eq('id', clientId).single();
  if (!clientData) return null;

  // Load all related data in parallel
  const [allCampaigns, allAds, allAdSets, allLeads, allGrowthOpps, allGrowthActions, allKnowledge, allApprovals] = await Promise.all([
    campaigns.getAllAsync(),
    ads.getAllAsync(),
    adSets.getAllAsync(),
    leads.getAllAsync(),
    growthOpportunities.getAllAsync(),
    growthActions.getAllAsync(),
    knowledgeItems.getAllAsync(),
    approvals.getAllAsync(),
  ]);

  // Filter to client
  const clientCampaigns = allCampaigns.filter((c: any) => c.clientId === clientId);
  const campaignIds = new Set(clientCampaigns.map((c: any) => c.id));
  const clientAds = allAds.filter((a: any) => campaignIds.has(a.campaignId));
  const clientAdSets = allAdSets.filter((a: any) => campaignIds.has(a.campaignId));
  const clientLeads = allLeads.filter((l: any) => l.clientId === clientId);
  const clientGrowthOpps = allGrowthOpps.filter((g: any) => g.clientId === clientId);
  const clientGrowthActions = allGrowthActions.filter((g: any) => g.clientId === clientId);
  const clientKnowledge = allKnowledge.filter((k: any) => k.clientId === clientId || k.clientId === null);
  const clientApprovals = allApprovals.filter((a: any) => a.clientId === clientId);

  const industry = clientData.businessField || 'general';

  // Build snapshots
  const client = buildClientSnapshot(clientData);
  const campaignSnap = buildCampaignSnapshot(clientCampaigns);
  const performance = buildPerformanceSnapshot(clientCampaigns, clientAds);
  const leadSnap = buildLeadSnapshot(clientLeads);
  const content = buildContentSnapshot(clientAds);
  const growth = buildGrowthSnapshot(clientGrowthOpps, clientGrowthActions);
  const knowledge = buildKnowledgeSnapshot(clientKnowledge, industry);
  const approvalSnap = buildApprovalSnapshot(clientApprovals);
  const platformSnap = buildPlatformSnapshot(clientCampaigns, clientAds);

  // Identify risks and strengths
  const risks = identifyRisks(campaignSnap, performance, leadSnap, content);
  const strengths = identifyStrengths(performance, leadSnap, growth, knowledge);

  // Assess data quality
  const dataQuality = assessDataQuality(clientCampaigns, clientAds, clientLeads);

  return {
    client,
    campaigns: campaignSnap,
    performance,
    leads: leadSnap,
    content,
    growth,
    knowledge,
    approvals: approvalSnap,
    platforms: platformSnap,
    risks,
    strengths,
    dataQuality,
  };
}

// ── Build all clients context (for cross-client strategy) ──

export async function buildAllClientsContext(): Promise<StrategicContext[]> {
  const { data: clientsData } = await supabase.from('clients').select('*').eq('status', 'active');
  if (!clientsData || clientsData.length === 0) return [];

  const contexts: StrategicContext[] = [];
  for (const client of clientsData) {
    const ctx = await buildStrategicContext(client.id);
    if (ctx) contexts.push(ctx);
  }
  return contexts;
}

// ── Snapshot builders ──

function buildClientSnapshot(c: any): ClientSnapshot {
  return {
    id: c.id,
    name: c.name || c.company || '',
    company: c.company || '',
    industry: c.businessField || 'general',
    status: c.status || 'active',
    retainerAmount: Number(c.retainerAmount) || 0,
    clientType: c.clientType || 'marketing',
    marketingGoals: c.marketingGoals || '',
  };
}

function buildCampaignSnapshot(campaignsList: Campaign[]): CampaignSnapshot {
  const active = campaignsList.filter((c: any) => c.status === 'active');
  const paused = campaignsList.filter((c: any) => c.status === 'paused');
  const totalBudget = campaignsList.reduce((s, c: any) => s + (Number(c.budget) || 0), 0);
  const totalSpend = campaignsList.reduce((s, c: any) => s + (Number(c.spend) || 0), 0);
  const platforms = [...new Set(campaignsList.map((c: any) => c.platform || 'facebook').filter(Boolean))];

  const ages = campaignsList.map((c: any) => {
    const created = new Date(c.createdAt || Date.now()).getTime();
    return (Date.now() - created) / (1000 * 60 * 60 * 24);
  });
  const avgAge = ages.length > 0 ? ages.reduce((s, a) => s + a, 0) / ages.length : 0;

  return {
    total: campaignsList.length,
    active: active.length,
    paused: paused.length,
    totalBudget,
    totalSpend,
    avgCampaignAge: Math.round(avgAge),
    platforms,
  };
}

function buildPerformanceSnapshot(campaignsList: Campaign[], adsList: Ad[]): PerformanceSnapshot {
  let totalImp = 0, totalClicks = 0, totalLeads = 0, totalSpend = 0;

  for (const ad of adsList) {
    totalImp += Number(ad.impressions) || 0;
    totalClicks += Number(ad.clicks) || 0;
    totalLeads += Number(ad.leads) || Number(ad.conversions) || 0;
    totalSpend += Number(ad.spend) || 0;
  }

  const avgCtr = totalImp > 0 ? (totalClicks / totalImp) * 100 : 0;
  const avgCpl = totalLeads > 0 ? totalSpend / totalLeads : 0;

  // Find best/worst campaigns by CPL
  const campaignPerf: { id: string; cpl: number }[] = [];
  for (const c of campaignsList) {
    const cAds = adsList.filter((a: any) => a.campaignId === c.id);
    const cSpend = cAds.reduce((s, a) => s + (Number(a.spend) || 0), 0);
    const cLeads = cAds.reduce((s, a) => s + (Number(a.leads) || Number(a.conversions) || 0), 0);
    if (cLeads > 0) campaignPerf.push({ id: c.id, cpl: cSpend / cLeads });
  }
  campaignPerf.sort((a, b) => a.cpl - b.cpl);

  return {
    totalImpressions: totalImp,
    totalClicks,
    totalLeads,
    totalSpend,
    avgCtr: Math.round(avgCtr * 100) / 100,
    avgCpl: Math.round(avgCpl),
    ctrTrend: 'unknown', // Would need historical data
    cplTrend: 'unknown',
    bestCampaignId: campaignPerf[0]?.id || null,
    worstCampaignId: campaignPerf[campaignPerf.length - 1]?.id || null,
  };
}

function buildLeadSnapshot(leadsList: Lead[]): LeadSnapshot {
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const thisMonth = leadsList.filter(l => new Date(l.createdAt) >= thisMonthStart).length;
  const lastMonth = leadsList.filter(l => {
    const d = new Date(l.createdAt);
    return d >= lastMonthStart && d < thisMonthStart;
  }).length;

  let trend: 'growing' | 'stable' | 'declining' | 'unknown' = 'unknown';
  if (lastMonth > 0) {
    const change = (thisMonth - lastMonth) / lastMonth;
    if (change > 0.1) trend = 'growing';
    else if (change < -0.1) trend = 'declining';
    else trend = 'stable';
  }

  const qualityScores = leadsList.map((l: any) => Number(l.qualityScore) || 50);
  const avgQuality = qualityScores.length > 0
    ? qualityScores.reduce((s, q) => s + q, 0) / qualityScores.length
    : 0;

  const converted = leadsList.filter((l: any) => l.status === 'converted' || l.status === 'won').length;
  const conversionRate = leadsList.length > 0 ? (converted / leadsList.length) * 100 : 0;

  return {
    total: leadsList.length,
    thisMonth,
    lastMonth,
    trend,
    avgQuality: Math.round(avgQuality),
    conversionRate: Math.round(conversionRate * 10) / 10,
  };
}

function buildContentSnapshot(adsList: Ad[]): ContentSnapshot {
  const active = adsList.filter((a: any) => a.status === 'active' || !a.status);
  const highPerf = active.filter(a => {
    const imp = Number(a.impressions) || 0;
    const clicks = Number(a.clicks) || 0;
    return imp > 500 && (clicks / Math.max(imp, 1)) * 100 > 2;
  });
  const lowPerf = active.filter(a => {
    const imp = Number(a.impressions) || 0;
    const clicks = Number(a.clicks) || 0;
    return imp > 1000 && (clicks / Math.max(imp, 1)) * 100 < 0.8;
  });

  let variety: 'diverse' | 'moderate' | 'stale' = 'stale';
  if (active.length >= 10) variety = 'diverse';
  else if (active.length >= 4) variety = 'moderate';

  return {
    activeCampaignAds: active.length,
    highPerformingAds: highPerf.length,
    lowPerformingAds: lowPerf.length,
    adVariety: variety,
  };
}

function buildGrowthSnapshot(opps: GrowthOpportunity[], actions: GrowthAction[]): GrowthSnapshot {
  const pending = opps.filter((o: any) => o.status === 'new' || o.status === 'pending');
  const pendingActions = actions.filter((a: any) => a.approvalStatus === 'pending');
  const executed = actions.filter((a: any) => a.executionStatus === 'completed');

  // Most common opportunity type
  const typeCounts: Record<string, number> = {};
  for (const o of pending) {
    typeCounts[o.type] = (typeCounts[o.type] || 0) + 1;
  }
  const topType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  return {
    pendingOpportunities: pending.length,
    pendingActions: pendingActions.length,
    executedActions: executed.length,
    topOpportunityType: topType,
  };
}

function buildKnowledgeSnapshot(items: KnowledgeItem[], industry: string): KnowledgeSnapshot {
  const highConf = items.filter(i => i.confidenceScore >= 60);
  const topItem = highConf.sort((a, b) => b.confidenceScore - a.confidenceScore)[0];
  const hasPlaybook = items.some(i => i.industry === industry && i.type === 'pattern');

  return {
    totalItems: items.length,
    highConfidenceItems: highConf.length,
    topInsight: topItem?.summary?.substring(0, 100) || null,
    industryPlaybookExists: hasPlaybook,
  };
}

function buildApprovalSnapshot(approvalsList: Approval[]): ApprovalSnapshot {
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const pending = approvalsList.filter((a: any) => a.status === 'pending').length;
  const recent = approvalsList.filter(a => new Date(a.createdAt).getTime() > weekAgo);
  const approved = recent.filter((a: any) => a.status === 'approved').length;
  const rejected = recent.filter((a: any) => a.status === 'rejected').length;

  return { pendingCount: pending, recentlyApproved: approved, recentlyRejected: rejected };
}

function buildPlatformSnapshot(campaignsList: Campaign[], adsList: Ad[]): PlatformSnapshot {
  const platformPerf: Record<string, { spend: number; leads: number }> = {};

  for (const c of campaignsList) {
    const platform = (c as any).platform || 'facebook';
    if (!platformPerf[platform]) platformPerf[platform] = { spend: 0, leads: 0 };
    const cAds = adsList.filter((a: any) => a.campaignId === c.id);
    for (const ad of cAds) {
      platformPerf[platform].spend += Number(ad.spend) || 0;
      platformPerf[platform].leads += Number(ad.leads) || Number(ad.conversions) || 0;
    }
  }

  const active = Object.keys(platformPerf);
  const withLeads = Object.entries(platformPerf)
    .filter(([, v]) => v.leads > 0)
    .map(([p, v]) => ({ platform: p, cpl: v.spend / v.leads }))
    .sort((a, b) => a.cpl - b.cpl);

  const allPlatforms = ['facebook', 'instagram', 'google', 'tiktok'];
  const unused = allPlatforms.filter(p => !active.includes(p));

  return {
    active,
    bestPerforming: withLeads[0]?.platform || null,
    worstPerforming: withLeads[withLeads.length - 1]?.platform || null,
    unusedRecommended: unused,
  };
}

// ── Risk & strength identification ──

function identifyRisks(c: CampaignSnapshot, p: PerformanceSnapshot, l: LeadSnapshot, content: ContentSnapshot): string[] {
  const risks: string[] = [];
  if (c.active === 0) risks.push('אין קמפיינים פעילים');
  if (p.avgCtr < 1 && p.totalImpressions > 5000) risks.push('CTR נמוך מהממוצע');
  if (p.avgCpl > 100 && p.totalLeads > 0) risks.push('עלות ליד גבוהה');
  if (l.trend === 'declining') risks.push('מגמת ירידה בלידים');
  if (content.lowPerformingAds > content.highPerformingAds && content.activeCampaignAds > 3) risks.push('רוב המודעות בביצוע נמוך');
  if (content.adVariety === 'stale') risks.push('מגוון קריאייטיב נמוך');
  if (c.platforms.length === 1 && c.active >= 3) risks.push('תלות בפלטפורמה אחת');
  if (l.conversionRate < 5 && l.total > 10) risks.push('שיעור המרה נמוך');
  return risks;
}

function identifyStrengths(p: PerformanceSnapshot, l: LeadSnapshot, g: GrowthSnapshot, k: KnowledgeSnapshot): string[] {
  const strengths: string[] = [];
  if (p.avgCtr > 2.5) strengths.push('CTR גבוה — הקריאייטיב עובד');
  if (p.avgCpl > 0 && p.avgCpl < 40) strengths.push('עלות ליד יעילה');
  if (l.trend === 'growing') strengths.push('מגמת עלייה בלידים');
  if (l.conversionRate > 20) strengths.push('שיעור המרה מצוין');
  if (g.executedActions > 3) strengths.push('מנוע צמיחה פעיל');
  if (k.highConfidenceItems > 5) strengths.push('בסיס ידע עשיר');
  return strengths;
}

function assessDataQuality(c: Campaign[], a: Ad[], l: Lead[]): 'rich' | 'moderate' | 'sparse' | 'insufficient' {
  const score = (c.length > 3 ? 2 : c.length > 0 ? 1 : 0)
    + (a.length > 10 ? 2 : a.length > 3 ? 1 : 0)
    + (l.length > 20 ? 2 : l.length > 5 ? 1 : 0);

  if (score >= 5) return 'rich';
  if (score >= 3) return 'moderate';
  if (score >= 1) return 'sparse';
  return 'insufficient';
}
