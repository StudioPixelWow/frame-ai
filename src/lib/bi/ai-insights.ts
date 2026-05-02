/**
 * AI Insights Generator
 *
 * Generates human-readable Hebrew explanations from BI data.
 * No AI API calls — deterministic rule-based generation.
 *
 * Example output:
 * "הקמפיין מראה ירידה בביצועים בגלל ירידה בעניין הקהל"
 */

import type { ClientHealthScore } from './client-health';
import type { ClientProfitability } from './profitability';
import type { ContentIntelligenceResult } from './content-intelligence';
import type { EarlyWarning } from './early-warnings';

// ── Types ──

export interface AIInsight {
  id: string;
  level: 'executive' | 'tactical' | 'operational';
  icon: string;
  title: string;
  body: string;
  recommendation: string;
  relatedClientIds: string[];
  generatedAt: string;
}

// ── Core ──

export function generateAIInsights(
  healthScores: ClientHealthScore[],
  profitability: ClientProfitability[],
  contentIntel: ContentIntelligenceResult,
  warnings: EarlyWarning[],
): AIInsight[] {
  const insights: AIInsight[] = [];
  const now = new Date().toISOString();

  // ── Executive-level insights ──

  // Overall portfolio health
  const withData = healthScores.filter(h => h.hasEnoughData);
  if (withData.length >= 2) {
    const avgScore = Math.round(withData.reduce((s, h) => s + h.score, 0) / withData.length);
    const healthyCount = withData.filter(h => h.status === 'healthy').length;
    const criticalCount = withData.filter(h => h.status === 'critical').length;

    if (avgScore >= 70) {
      insights.push({
        id: 'portfolio_health',
        level: 'executive',
        icon: '🟢',
        title: 'תיק הלקוחות בריא',
        body: `ציון בריאות ממוצע: ${avgScore}/100. ${healthyCount} מתוך ${withData.length} לקוחות במצב בריא.`,
        recommendation: 'המשיכו בקו הנוכחי — שקלו להרחיב תקציבים ללקוחות המצליחים',
        relatedClientIds: [],
        generatedAt: now,
      });
    } else if (avgScore >= 40) {
      insights.push({
        id: 'portfolio_health',
        level: 'executive',
        icon: '🟡',
        title: 'תיק הלקוחות דורש תשומת לב',
        body: `ציון בריאות ממוצע: ${avgScore}/100. ${criticalCount} לקוחות במצב קריטי מתוך ${withData.length}.`,
        recommendation: 'התמקדו בלקוחות הבעייתיים — שפרו קמפיינים או שנו אסטרטגיה',
        relatedClientIds: withData.filter(h => h.status === 'critical').map(h => h.clientId),
        generatedAt: now,
      });
    } else {
      insights.push({
        id: 'portfolio_health',
        level: 'executive',
        icon: '🔴',
        title: 'תיק הלקוחות בקושי',
        body: `ציון בריאות ממוצע: ${avgScore}/100. רוב הלקוחות לא מקבלים תוצאות מספקות.`,
        recommendation: 'נדרשת ישיבת חירום — בדקו טירגוט, קריאייטיבים, ותקציבים',
        relatedClientIds: withData.filter(h => h.status === 'critical').map(h => h.clientId),
        generatedAt: now,
      });
    }
  }

  // Revenue risk
  const unprofitable = profitability.filter(p => p.hasEnoughData && (p.level === 'critical' || p.level === 'inefficient'));
  if (unprofitable.length > 0) {
    const totalLoss = unprofitable.reduce((s, p) => s + Math.max(0, -p.estimatedProfit), 0);
    insights.push({
      id: 'revenue_risk',
      level: 'executive',
      icon: '💰',
      title: `${unprofitable.length} לקוחות לא רווחיים`,
      body: totalLoss > 0
        ? `הפסד מצטבר מוערך: ₪${totalLoss.toLocaleString('he-IL')}. ${unprofitable.map(p => p.clientName).join(', ')}.`
        : `${unprofitable.map(p => p.clientName).join(', ')} — יעילות נמוכה.`,
      recommendation: 'שקלו עדכון ריטיינר, שינוי אסטרטגיה, או שיחה עם הלקוח',
      relatedClientIds: unprofitable.map(p => p.clientId),
      generatedAt: now,
    });
  }

  // ── Tactical insights ──

  // Content performance
  if (contentIntel.hasEnoughData) {
    if (contentIntel.working.length > 0 && contentIntel.notWorking.length > 0) {
      insights.push({
        id: 'content_balance',
        level: 'tactical',
        icon: '🎨',
        title: 'תובנות קריאייטיב',
        body: `${contentIntel.working.length} דפוסים שעובדים, ${contentIntel.notWorking.length} שלא. ${contentIntel.totalAdsAnalyzed} מודעות נותחו.`,
        recommendation: contentIntel.working[0]?.detail || 'שכפלו את הקריאייטיבים שעובדים',
        relatedClientIds: [],
        generatedAt: now,
      });
    }

    if (contentIntel.bestCta) {
      insights.push({
        id: 'best_cta',
        level: 'tactical',
        icon: '🔘',
        title: `CTA מנצח: "${contentIntel.bestCta.cta}"`,
        body: `CTR ${contentIntel.bestCta.avgCtr.toFixed(1)}%, ${contentIntel.bestCta.leads} לידים — אפקטיבי יותר משאר ה-CTAs`,
        recommendation: 'השתמשו ב-CTA הזה במודעות חדשות',
        relatedClientIds: [],
        generatedAt: now,
      });
    }
  }

  // ── Operational insights ──

  // Critical warnings summary
  const criticalWarnings = warnings.filter(w => w.severity === 'critical');
  if (criticalWarnings.length > 0) {
    insights.push({
      id: 'critical_alerts',
      level: 'operational',
      icon: '🚨',
      title: `${criticalWarnings.length} התראות קריטיות`,
      body: criticalWarnings.map(w => w.title).slice(0, 3).join('. ') + '.',
      recommendation: 'טפלו בהתראות הקריטיות מיד — הן שורפות תקציב',
      relatedClientIds: [...Array.from(new Set(criticalWarnings.map(w => w.clientId)))],
      generatedAt: now,
    });
  }

  // Spend optimization
  const spendWarnings = warnings.filter(w => w.type === 'spend_no_results');
  if (spendWarnings.length > 0) {
    insights.push({
      id: 'spend_optimization',
      level: 'operational',
      icon: '⚡',
      title: 'הזדמנות לחיסכון בהוצאה',
      body: `${spendWarnings.length} קמפיינים שורפים תקציב ללא תוצאות`,
      recommendation: 'עצרו מודעות שלא מביאות תוצאות ונתבו את התקציב למנצחות',
      relatedClientIds: [...Array.from(new Set(spendWarnings.map(w => w.clientId)))],
      generatedAt: now,
    });
  }

  // Lead velocity
  const leadsWarnings = warnings.filter(w => w.type === 'no_leads');
  if (leadsWarnings.length > 0) {
    insights.push({
      id: 'lead_velocity',
      level: 'operational',
      icon: '📊',
      title: `${leadsWarnings.length} לקוחות עם בעיית לידים`,
      body: 'לקוחות שלא מקבלים לידים — הם יתחילו לשאול שאלות',
      recommendation: 'תעדפו אותם: בדקו טפסים, לנדינג פייג\'ים, וטירגוט',
      relatedClientIds: [...Array.from(new Set(leadsWarnings.map(w => w.clientId)))],
      generatedAt: now,
    });
  }

  return insights;
}
