/**
 * PixelManageAI — AI Decision Service
 *
 * Deterministic AI decision layer for:
 * - Lead quality analysis
 * - Best sales rep selection
 * - Message suggestion
 * - Campaign optimization suggestions
 */

import type { Lead, Employee, Campaign, Client } from '../db/schema';

// ── Lead Quality Analysis ────────────────────────────────────────────────

export interface LeadAnalysis {
  score: number; // 0-100
  level: 'high' | 'medium' | 'low';
  factors: string[];
  suggestedAction: string;
  urgency: 'immediate' | 'today' | 'this_week' | 'no_rush';
  estimatedValue: number;
}

export function analyzeLeadQuality(lead: Lead): LeadAnalysis {
  let score = 50; // baseline
  const factors: string[] = [];

  // Source quality
  const highValueSources = ['referral', 'website', 'google', 'linkedin'];
  if (highValueSources.some(s => lead.source?.toLowerCase().includes(s))) {
    score += 15;
    factors.push('מקור איכותי');
  }

  // Has company info
  if (lead.company && lead.company.length > 2) {
    score += 8;
    factors.push('פרטי חברה מלאים');
  }

  // Proposal amount indicates serious intent
  const amount = lead.proposalAmount || lead.value || 0;
  if (amount > 5000) {
    score += 15;
    factors.push(`ערך עסקה גבוה: ₪${amount.toLocaleString()}`);
  } else if (amount > 2000) {
    score += 8;
    factors.push(`ערך עסקה בינוני: ₪${amount.toLocaleString()}`);
  }

  // Campaign attribution = tracked funnel
  if (lead.campaignId) {
    score += 10;
    factors.push('מיוחס לקמפיין');
  }

  // Interest type weighting
  const highValueInterests: string[] = ['marketing', 'branding', 'website'];
  if (highValueInterests.includes(lead.interestType)) {
    score += 5;
    factors.push(`תחום עניין: ${lead.interestType}`);
  }

  // Status progression = engaged lead
  const engagedStatuses = ['interested', 'proposal_sent', 'negotiation', 'meeting_set'];
  if (engagedStatuses.includes(lead.status)) {
    score += 12;
    factors.push('ליד מעורב');
  }

  // Response time — if followUpAt exists and was set close to creation
  if (lead.followUpAt && lead.createdAt) {
    const created = new Date(lead.createdAt).getTime();
    const followUp = new Date(lead.followUpAt).getTime();
    const hoursToFollowUp = (followUp - created) / 3600000;
    if (hoursToFollowUp < 24) {
      score += 8;
      factors.push('תגובה מהירה');
    }
  }

  // Contact completeness
  if (lead.email && lead.phone) {
    score += 5;
    factors.push('פרטי קשר מלאים');
  }

  score = Math.min(100, Math.max(0, score));

  const level = score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low';

  // Suggested action
  let suggestedAction = 'המשך מעקב';
  let urgency: LeadAnalysis['urgency'] = 'this_week';
  if (level === 'high' && lead.status === 'new') {
    suggestedAction = 'צור קשר מיידי — ליד חם';
    urgency = 'immediate';
  } else if (lead.status === 'interested') {
    suggestedAction = 'שלח הצעת מחיר';
    urgency = 'today';
  } else if (lead.status === 'proposal_sent') {
    suggestedAction = 'מעקב — בדוק אם קראו';
    urgency = 'today';
  } else if (lead.status === 'negotiation') {
    suggestedAction = 'קבע פגישת סגירה';
    urgency = 'immediate';
  }

  return {
    score,
    level,
    factors,
    suggestedAction,
    urgency,
    estimatedValue: amount || (level === 'high' ? 5000 : level === 'medium' ? 3000 : 1000),
  };
}

// ── Best Sales Rep Selection ─────────────────────────────────────────────

export interface RepRecommendation {
  employeeId: string;
  employeeName: string;
  score: number;
  reasons: string[];
}

export function selectBestRep(
  lead: Lead,
  employees: Employee[],
  existingLeads: Lead[],
): RepRecommendation | null {
  const activeReps = employees.filter(e =>
    (e.role === 'admin' || e.role === 'manager') && e.status !== 'offline'
  );

  if (activeReps.length === 0) return null;

  const scored = activeReps.map(rep => {
    let score = 50;
    const reasons: string[] = [];

    // Workload — prefer less busy reps
    const repLeadCount = existingLeads.filter(l => l.assigneeId === rep.id && !['won', 'lost', 'not_relevant'].includes(l.status)).length;
    if (repLeadCount < 5) {
      score += 20;
      reasons.push(`עומס נמוך (${repLeadCount} לידים פעילים)`);
    } else if (repLeadCount < 10) {
      score += 10;
      reasons.push(`עומס בינוני (${repLeadCount} לידים)`);
    }

    // Skill match
    if (rep.skills?.some(s => s.toLowerCase().includes(lead.interestType))) {
      score += 15;
      reasons.push(`מומחיות ב-${lead.interestType}`);
    }

    // Online availability
    if (rep.status === 'online') {
      score += 10;
      reasons.push('זמין כרגע');
    }

    // Past success rate with this lead type
    const wonLeads = existingLeads.filter(l => l.assigneeId === rep.id && l.status === 'won');
    const totalAssigned = existingLeads.filter(l => l.assigneeId === rep.id);
    if (totalAssigned.length > 0) {
      const winRate = wonLeads.length / totalAssigned.length;
      if (winRate > 0.3) {
        score += 15;
        reasons.push(`אחוז סגירה גבוה (${Math.round(winRate * 100)}%)`);
      }
    }

    return { employeeId: rep.id, employeeName: rep.name, score, reasons };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0] ?? null;
}

// ── Message Suggestion ───────────────────────────────────────────────────

export interface MessageSuggestion {
  subject: string;
  body: string;
  channel: 'email' | 'whatsapp';
  tone: 'formal' | 'friendly' | 'urgent';
}

export function suggestMessage(lead: Lead): MessageSuggestion {
  const name = lead.fullName || lead.name || 'לקוח/ה';

  if (lead.status === 'new') {
    return {
      subject: `שלום ${name} — סטודיו פיקסל`,
      body: `שלום ${name},\n\nקיבלנו את פנייתך ונשמח לשמוע יותר על הצרכים שלך ב${lead.interestType === 'marketing' ? 'שיווק דיגיטלי' : lead.interestType}.\n\nמתי נוח לך לשיחה קצרה?\n\nבברכה,\nסטודיו פיקסל`,
      channel: lead.phone ? 'whatsapp' : 'email',
      tone: 'friendly',
    };
  }

  if (lead.status === 'interested' || lead.status === 'proposal_sent') {
    return {
      subject: `המשך לשיחתנו — ${name}`,
      body: `שלום ${name},\n\nרציתי לעקוב לגבי ההצעה שנשלחה. אשמח לענות על כל שאלה ולהתאים את הפתרון בדיוק לצרכים שלך.\n\nאשמח לקבוע שיחת הבהרה קצרה.\n\nבברכה,\nסטודיו פיקסל`,
      channel: 'email',
      tone: 'formal',
    };
  }

  if (lead.status === 'negotiation' || lead.status === 'meeting_set') {
    return {
      subject: `לקראת הפגישה — ${name}`,
      body: `שלום ${name},\n\nמצפה לפגישתנו. הכנתי סיכום של הנקודות המרכזיות שדיברנו עליהן.\n\nנתראה בקרוב!\n\nבברכה,\nסטודיו פיקסל`,
      channel: 'whatsapp',
      tone: 'friendly',
    };
  }

  return {
    subject: `מעקב — ${name}`,
    body: `שלום ${name},\n\nרציתי לבדוק מה שלומך ואם יש משהו שנוכל לעזור בו.\n\nבברכה,\nסטודיו פיקסל`,
    channel: lead.phone ? 'whatsapp' : 'email',
    tone: 'friendly',
  };
}

// ── Campaign Optimization ────────────────────────────────────────────────

export interface CampaignOptimization {
  campaignId: string;
  recommendations: string[];
  severity: 'critical' | 'warning' | 'info';
  estimatedImpact: string;
}

export function suggestCampaignOptimization(
  campaign: Campaign,
  leads: Lead[],
): CampaignOptimization {
  const recommendations: string[] = [];
  let severity: CampaignOptimization['severity'] = 'info';

  const campaignLeads = leads.filter(l => l.campaignId === campaign.id);
  const wonLeads = campaignLeads.filter(l => l.status === 'won');
  const budget = campaign.budget || 0;

  // ROI check
  if (campaignLeads.length === 0 && budget > 0) {
    recommendations.push('הקמפיין לא הניב לידים — שקול לעצור ולבדוק את הטרגוט');
    severity = 'critical';
  }

  // Conversion rate
  if (campaignLeads.length > 5) {
    const convRate = wonLeads.length / campaignLeads.length;
    if (convRate < 0.05) {
      recommendations.push('שיעור המרה נמוך — שפר את דף הנחיתה או ההצעה');
      severity = 'warning';
    }
  }

  // Cost per lead
  if (budget > 0 && campaignLeads.length > 0) {
    const cpl = budget / campaignLeads.length;
    if (cpl > 200) {
      recommendations.push(`עלות לליד גבוהה (₪${Math.round(cpl)}) — בדוק קהלי יעד`);
      if (severity === 'info') severity = 'warning';
    }
  }

  // Creative fatigue
  if (campaign.createdAt) {
    const daysSinceCreation = (Date.now() - new Date(campaign.createdAt).getTime()) / 86400000;
    if (daysSinceCreation > 30) {
      recommendations.push('הקמפיין רץ יותר מ-30 יום — שקול לרענן את הקריאייטיב');
    }
  }

  if (recommendations.length === 0) {
    recommendations.push('הקמפיין פועל כצפוי — המשך ניטור');
  }

  const totalValue = wonLeads.reduce((sum, l) => sum + (l.proposalAmount || l.value || 0), 0);
  const roi = budget > 0 ? ((totalValue - budget) / budget * 100).toFixed(0) : '0';

  return {
    campaignId: campaign.id,
    recommendations,
    severity,
    estimatedImpact: `ROI: ${roi}% | לידים: ${campaignLeads.length} | סגירות: ${wonLeads.length}`,
  };
}

// ── Conversion Metrics ───────────────────────────────────────────────────

export interface ConversionMetrics {
  totalLeads: number;
  wonLeads: number;
  lostLeads: number;
  closeRate: number;
  avgResponseTimeHours: number;
  avgDealValue: number;
  totalRevenue: number;
  roiPerCampaign: Record<string, { leads: number; won: number; revenue: number; cost: number; roi: number }>;
  closeRatePerSource: Record<string, { total: number; won: number; rate: number }>;
}

export function computeConversionMetrics(leads: Lead[], campaigns: Campaign[]): ConversionMetrics {
  const wonLeads = leads.filter(l => l.status === 'won');
  const lostLeads = leads.filter(l => l.status === 'lost');

  const totalRevenue = wonLeads.reduce((s, l) => s + (l.proposalAmount || l.value || 0), 0);
  const avgDealValue = wonLeads.length > 0 ? totalRevenue / wonLeads.length : 0;

  // Response times
  let totalResponseHours = 0;
  let responseCount = 0;
  for (const lead of leads) {
    if (lead.followUpAt && lead.createdAt) {
      const hours = (new Date(lead.followUpAt).getTime() - new Date(lead.createdAt).getTime()) / 3600000;
      if (hours > 0 && hours < 720) {
        totalResponseHours += hours;
        responseCount++;
      }
    }
  }

  // ROI per campaign
  const roiPerCampaign: ConversionMetrics['roiPerCampaign'] = {};
  for (const campaign of campaigns) {
    const cLeads = leads.filter(l => l.campaignId === campaign.id);
    const cWon = cLeads.filter(l => l.status === 'won');
    const revenue = cWon.reduce((s, l) => s + (l.proposalAmount || l.value || 0), 0);
    const cost = campaign.budget || 0;
    roiPerCampaign[campaign.id] = {
      leads: cLeads.length,
      won: cWon.length,
      revenue,
      cost,
      roi: cost > 0 ? ((revenue - cost) / cost) * 100 : 0,
    };
  }

  // Close rate per source
  const sourceGroups: Record<string, { total: number; won: number }> = {};
  for (const lead of leads) {
    const source = lead.source || 'unknown';
    if (!sourceGroups[source]) sourceGroups[source] = { total: 0, won: 0 };
    sourceGroups[source].total++;
    if (lead.status === 'won') sourceGroups[source].won++;
  }
  const closeRatePerSource: ConversionMetrics['closeRatePerSource'] = {};
  for (const [source, data] of Object.entries(sourceGroups)) {
    closeRatePerSource[source] = { ...data, rate: data.total > 0 ? data.won / data.total : 0 };
  }

  return {
    totalLeads: leads.length,
    wonLeads: wonLeads.length,
    lostLeads: lostLeads.length,
    closeRate: leads.length > 0 ? wonLeads.length / leads.length : 0,
    avgResponseTimeHours: responseCount > 0 ? totalResponseHours / responseCount : 0,
    avgDealValue,
    totalRevenue,
    roiPerCampaign,
    closeRatePerSource,
  };
}
