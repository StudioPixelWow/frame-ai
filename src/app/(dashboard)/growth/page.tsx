'use client';

/**
 * Auto Growth Engine Dashboard
 *
 * Premium, calm, trust-first design.
 * Shows: KPIs, opportunities, risks, draft actions, pending approvals, recent activity, learning loop.
 * Hebrew RTL. No scary automation language.
 */

import React, { useState, useEffect, useCallback } from 'react';

// ── Types ──

interface GrowthKPIs {
  opportunitiesFound: number;
  pendingApprovals: number;
  actionsPrepared: number;
  highRiskClients: number;
  potentialImpact: string;
}

interface GrowthOpportunity {
  id: string;
  clientId: string;
  clientName: string;
  campaignId: string | null;
  campaignName: string | null;
  platform: string | null;
  type: string;
  severity: string;
  confidence: number;
  title: string;
  reason: string;
  expectedImpact: string;
  status: string;
  createdAt: string;
}

interface GrowthAction {
  id: string;
  opportunityId: string;
  clientId: string;
  clientName: string;
  campaignName: string | null;
  platform: string | null;
  actionType: string;
  title: string;
  reason: string;
  expectedImpact: string;
  confidenceScore: number;
  riskLevel: string;
  approvalStatus: string;
  executionStatus: string;
  suggestedNextStep: string;
  createdAt: string;
}

interface GrowthRun {
  id: string;
  status: string;
  clientsScanned: number;
  campaignsScanned: number;
  opportunitiesFound: number;
  actionsGenerated: number;
  summary: string;
  startedAt: string;
  finishedAt: string | null;
}

interface DashboardData {
  lastRun: GrowthRun | null;
  runs: GrowthRun[];
  opportunities: GrowthOpportunity[];
  actions: GrowthAction[];
  kpis: GrowthKPIs;
}

// ── Metadata ──

const OPP_TYPE_META: Record<string, { icon: string; label: string; color: string; bgColor: string }> = {
  scale: { icon: '📈', label: 'הזדמנות להרחבה', color: '#22c55e', bgColor: '#f0fdf4' },
  creative_replacement: { icon: '🎨', label: 'החלפת קריאייטיב', color: '#f59e0b', bgColor: '#fffbeb' },
  budget_waste: { icon: '💸', label: 'בזבוז תקציב', color: '#ef4444', bgColor: '#fef2f2' },
  platform_shift: { icon: '🔄', label: 'שינוי פלטפורמה', color: '#8b5cf6', bgColor: '#f5f3ff' },
  audience_expansion: { icon: '🎯', label: 'הרחבת קהל', color: '#3b82f6', bgColor: '#eff6ff' },
  funnel_leak: { icon: '🔍', label: 'דליפה במשפך', color: '#f97316', bgColor: '#fff7ed' },
  content_to_campaign: { icon: '✨', label: 'תוכן לקמפיין', color: '#06b6d4', bgColor: '#ecfeff' },
  client_risk: { icon: '⚠️', label: 'סיכון לקוח', color: '#dc2626', bgColor: '#fef2f2' },
};

const SEVERITY_META: Record<string, { label: string; color: string; bgColor: string }> = {
  low: { label: 'נמוכה', color: '#6b7280', bgColor: '#f3f4f6' },
  medium: { label: 'בינונית', color: '#f59e0b', bgColor: '#fffbeb' },
  high: { label: 'גבוהה', color: '#ef4444', bgColor: '#fef2f2' },
  critical: { label: 'קריטית', color: '#dc2626', bgColor: '#fef2f2' },
};

const ACTION_TYPE_META: Record<string, { icon: string; label: string }> = {
  create_ad_variation: { icon: '🎨', label: 'יצירת וריאציה' },
  duplicate_winning_ad: { icon: '📋', label: 'שכפול מודעה מנצחת' },
  create_new_adset: { icon: '🎯', label: 'קבוצת מודעות חדשה' },
  suggest_budget_increase: { icon: '📈', label: 'הגדלת תקציב' },
  suggest_budget_reduction: { icon: '📉', label: 'הפחתת תקציב' },
  pause_weak_ad: { icon: '⏸️', label: 'השהיית מודעה' },
  create_campaign_from_content: { icon: '✨', label: 'קמפיין מתוכן' },
  create_campaign_from_podcast: { icon: '🎙️', label: 'קמפיין מפודקאסט' },
  create_retargeting_campaign: { icon: '🔄', label: 'ריטרגטינג' },
  create_report: { icon: '📊', label: 'יצירת דוח' },
  create_followup_task: { icon: '📌', label: 'משימת מעקב' },
};

const APPROVAL_META: Record<string, { label: string; color: string; bgColor: string }> = {
  draft: { label: 'טיוטה', color: '#6b7280', bgColor: '#f3f4f6' },
  pending_admin: { label: 'ממתין לאישור', color: '#f59e0b', bgColor: '#fffbeb' },
  pending_client: { label: 'ממתין ללקוח', color: '#3b82f6', bgColor: '#eff6ff' },
  approved: { label: 'אושר', color: '#22c55e', bgColor: '#f0fdf4' },
  rejected: { label: 'נדחה', color: '#ef4444', bgColor: '#fef2f2' },
};

// ── Component ──

export default function GrowthDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [activeTab, setActiveTab] = useState<'opportunities' | 'actions' | 'approvals' | 'activity' | 'learning'>('opportunities');
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/data/growth');
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה בטעינת נתונים');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const runScan = async () => {
    setScanning(true);
    try {
      const res = await fetch('/api/data/growth/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ triggeredBy: 'manual' }) });
      if (!res.ok) throw new Error('Scan failed');
      await fetchData();
    } catch (e) {
      setError('לא ניתן להשלים בדיקת צמיחה כרגע');
    } finally {
      setScanning(false);
    }
  };

  const handleAction = async (actionId: string, action: 'approve' | 'reject' | 'execute', reason?: string) => {
    try {
      const res = await fetch('/api/data/growth/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionId, action, reason }),
      });
      if (!res.ok) throw new Error('Action failed');
      await fetchData();
    } catch {
      setError('שגיאה בביצוע הפעולה');
    }
  };

  if (loading) {
    return (
      <div style={{ direction: 'rtl', padding: '40px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        <div style={{ textAlign: 'center', color: '#6b7280', marginTop: 80 }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🌱</div>
          <div>טוען את מנוע הצמיחה...</div>
        </div>
      </div>
    );
  }

  const kpis = data?.kpis;
  const opportunities = data?.opportunities || [];
  const actions = data?.actions || [];
  const pendingActions = actions.filter(a => a.approvalStatus === 'pending_admin' || a.approvalStatus === 'pending_client');
  const draftActions = actions.filter(a => a.approvalStatus === 'draft' || a.executionStatus === 'not_started');
  const risks = opportunities.filter(o => o.type === 'client_risk' || o.severity === 'critical');
  const lastRun = data?.lastRun;

  const tabs = [
    { key: 'opportunities' as const, label: 'הזדמנויות', count: opportunities.filter(o => o.status === 'new').length },
    { key: 'actions' as const, label: 'פעולות מוכנות', count: draftActions.length },
    { key: 'approvals' as const, label: 'ממתין לאישור', count: pendingActions.length },
    { key: 'activity' as const, label: 'פעילות אחרונה', count: 0 },
    { key: 'learning' as const, label: 'לומד מתוצאות', count: 0 },
  ];

  return (
    <div style={{ direction: 'rtl', padding: '24px 32px', fontFamily: 'system-ui, -apple-system, sans-serif', maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827', margin: 0 }}>
            🌱 מנוע צמיחה אוטומטי
          </h1>
          <p style={{ color: '#6b7280', margin: '4px 0 0', fontSize: 14 }}>
            זיהוי הזדמנויות, הכנת פעולות, ולמידה מתוצאות — הכל באישור מלא שלך
          </p>
        </div>
        <button
          onClick={runScan}
          disabled={scanning}
          style={{
            padding: '10px 20px',
            borderRadius: 8,
            border: 'none',
            background: scanning ? '#d1d5db' : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
            color: '#fff',
            fontWeight: 600,
            fontSize: 14,
            cursor: scanning ? 'wait' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {scanning ? '⏳ סורק...' : '🔍 הרץ בדיקת צמיחה חכמה'}
        </button>
      </div>

      {/* Trust banner */}
      <div style={{
        padding: '12px 16px',
        background: '#f0fdf4',
        borderRadius: 8,
        border: '1px solid #bbf7d0',
        marginBottom: 24,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 13,
        color: '#166534',
      }}>
        🔒 לא תבוצע פעולה חיה ללא אישור מפורש שלך
      </div>

      {error && (
        <div style={{ padding: '12px 16px', background: '#fef2f2', borderRadius: 8, border: '1px solid #fecaca', marginBottom: 16, color: '#991b1b', fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* KPI Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 24 }}>
        <KPICard label="הזדמנויות חדשות" value={kpis?.opportunitiesFound || 0} icon="🔍" color="#3b82f6" />
        <KPICard label="ממתין לאישור" value={kpis?.pendingApprovals || 0} icon="⏳" color="#f59e0b" />
        <KPICard label="פעולות מוכנות" value={kpis?.actionsPrepared || 0} icon="⚡" color="#8b5cf6" />
        <KPICard label="לקוחות בסיכון" value={kpis?.highRiskClients || 0} icon="⚠️" color="#ef4444" />
        <KPICard label="פוטנציאל" value={kpis?.potentialImpact || '—'} icon="📈" color="#22c55e" isText />
      </div>

      {/* Last run info */}
      {lastRun && (
        <div style={{ padding: '10px 14px', background: '#f9fafb', borderRadius: 8, marginBottom: 20, fontSize: 13, color: '#6b7280', display: 'flex', gap: 16, alignItems: 'center' }}>
          <span>סריקה אחרונה: {new Date(lastRun.startedAt).toLocaleString('he-IL')}</span>
          <span>{lastRun.summary}</span>
          <span style={{ color: lastRun.status === 'completed' ? '#22c55e' : '#ef4444' }}>
            {lastRun.status === 'completed' ? '✓ הושלמה' : '✗ נכשלה'}
          </span>
        </div>
      )}

      {/* Risks section */}
      {risks.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: '#991b1b', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            ⚠️ סיכונים דורשי תשומת לב ({risks.length})
          </h2>
          <div style={{ display: 'grid', gap: 8 }}>
            {risks.slice(0, 5).map(r => (
              <div key={r.id} style={{ padding: '12px 16px', background: '#fef2f2', borderRadius: 8, border: '1px solid #fecaca' }}>
                <div style={{ fontWeight: 600, color: '#991b1b', fontSize: 14 }}>{r.title}</div>
                <div style={{ color: '#b91c1c', fontSize: 13, marginTop: 4 }}>{r.reason}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid #e5e7eb', paddingBottom: 0 }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '8px 16px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: activeTab === tab.key ? 600 : 400,
              color: activeTab === tab.key ? '#2563eb' : '#6b7280',
              borderBottom: activeTab === tab.key ? '2px solid #2563eb' : '2px solid transparent',
              marginBottom: -1,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {tab.label}
            {tab.count > 0 && (
              <span style={{ background: activeTab === tab.key ? '#2563eb' : '#e5e7eb', color: activeTab === tab.key ? '#fff' : '#374151', borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 600 }}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'opportunities' && (
        <OpportunitiesTab opportunities={opportunities.filter(o => o.status === 'new' || o.status === 'acknowledged')} />
      )}
      {activeTab === 'actions' && (
        <ActionsTab actions={draftActions} onAction={handleAction} />
      )}
      {activeTab === 'approvals' && (
        <ApprovalsTab actions={pendingActions} onAction={handleAction} />
      )}
      {activeTab === 'activity' && (
        <ActivityTab runs={data?.runs || []} actions={actions} />
      )}
      {activeTab === 'learning' && (
        <LearningTab />
      )}

      {/* Empty state */}
      {opportunities.length === 0 && actions.length === 0 && !scanning && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#6b7280' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🌱</div>
          <div style={{ fontSize: 16, fontWeight: 500 }}>אין עדיין מספיק נתונים לזיהוי הזדמנויות צמיחה</div>
          <div style={{ fontSize: 14, marginTop: 8 }}>חברו פלטפורמות פרסום והריצו בדיקת צמיחה ראשונה</div>
        </div>
      )}
    </div>
  );
}

// ── KPI Card ──

function KPICard({ label, value, icon, color, isText }: { label: string; value: number | string; icon: string; color: string; isText?: boolean }) {
  return (
    <div style={{ padding: '16px', background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', textAlign: 'center' }}>
      <div style={{ fontSize: 20, marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: isText ? 14 : 28, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{label}</div>
    </div>
  );
}

// ── Opportunities Tab ──

function OpportunitiesTab({ opportunities }: { opportunities: GrowthOpportunity[] }) {
  if (opportunities.length === 0) {
    return <EmptyState text="המערכת לא זיהתה בעיות משמעותיות כרגע" icon="✅" />;
  }

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {opportunities.map(opp => {
        const meta = OPP_TYPE_META[opp.type] || { icon: '📌', label: opp.type, color: '#6b7280', bgColor: '#f3f4f6' };
        const sev = SEVERITY_META[opp.severity] || SEVERITY_META.medium;

        return (
          <div key={opp.id} style={{ padding: '14px 18px', background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', borderRight: `4px solid ${meta.color}` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 18 }}>{meta.icon}</span>
                <span style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>{opp.title}</span>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: sev.bgColor, color: sev.color, fontWeight: 500 }}>
                  {sev.label}
                </span>
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: meta.bgColor, color: meta.color, fontWeight: 500 }}>
                  {meta.label}
                </span>
                <span style={{ fontSize: 11, color: '#9ca3af' }}>
                  ביטחון: {opp.confidence}%
                </span>
              </div>
            </div>
            <div style={{ fontSize: 13, color: '#4b5563', marginBottom: 4 }}>{opp.reason}</div>
            <div style={{ fontSize: 12, color: '#059669' }}>💡 {opp.expectedImpact}</div>
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 6 }}>
              {opp.clientName}{opp.campaignName ? ` — ${opp.campaignName}` : ''}{opp.platform ? ` | ${opp.platform}` : ''}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Actions Tab ──

function ActionsTab({ actions, onAction }: { actions: GrowthAction[]; onAction: (id: string, action: 'approve' | 'reject' | 'execute') => void }) {
  if (actions.length === 0) {
    return <EmptyState text="אין פעולות מוכנות כרגע — הריצו בדיקת צמיחה כדי לייצר" icon="⚡" />;
  }

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {actions.map(act => {
        const meta = ACTION_TYPE_META[act.actionType] || { icon: '📌', label: act.actionType };
        const riskColor = act.riskLevel === 'high' ? '#ef4444' : act.riskLevel === 'medium' ? '#f59e0b' : '#22c55e';

        return (
          <div key={act.id} style={{ padding: '14px 18px', background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 18 }}>{meta.icon}</span>
                <span style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>{act.title}</span>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: '#f3f4f6', color: riskColor, fontWeight: 500 }}>
                  סיכון: {act.riskLevel === 'high' ? 'גבוה' : act.riskLevel === 'medium' ? 'בינוני' : 'נמוך'}
                </span>
                <span style={{ fontSize: 11, color: '#9ca3af' }}>ביטחון: {act.confidenceScore}%</span>
              </div>
            </div>
            <div style={{ fontSize: 13, color: '#4b5563', marginBottom: 4 }}>{act.reason}</div>
            <div style={{ fontSize: 12, color: '#059669', marginBottom: 4 }}>💡 {act.expectedImpact}</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>📋 {act.suggestedNextStep}</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                onClick={() => onAction(act.id, 'approve')}
                style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #22c55e', background: '#f0fdf4', color: '#166534', fontSize: 13, cursor: 'pointer', fontWeight: 500 }}
              >
                ✓ אשר לביצוע
              </button>
              <button
                onClick={() => onAction(act.id, 'reject')}
                style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', color: '#6b7280', fontSize: 13, cursor: 'pointer' }}
              >
                ✗ דחה
              </button>
              <span style={{ fontSize: 11, color: '#9ca3af', marginRight: 'auto' }}>
                {act.clientName}{act.platform ? ` | ${act.platform}` : ''}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Approvals Tab ──

function ApprovalsTab({ actions, onAction }: { actions: GrowthAction[]; onAction: (id: string, action: 'approve' | 'reject' | 'execute') => void }) {
  if (actions.length === 0) {
    return <EmptyState text="אין פעולות ממתינות לאישור" icon="✅" />;
  }

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {actions.map(act => {
        const approvalInfo = APPROVAL_META[act.approvalStatus] || APPROVAL_META.pending_admin;

        return (
          <div key={act.id} style={{ padding: '14px 18px', background: '#fff', borderRadius: 10, border: `1px solid ${approvalInfo.color}20`, borderRight: `4px solid ${approvalInfo.color}` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>{act.title}</span>
              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: approvalInfo.bgColor, color: approvalInfo.color, fontWeight: 500 }}>
                {approvalInfo.label}
              </span>
            </div>
            <div style={{ fontSize: 13, color: '#4b5563', marginBottom: 8 }}>{act.reason}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {act.approvalStatus === 'approved' ? (
                <button
                  onClick={() => onAction(act.id, 'execute')}
                  style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: '#2563eb', color: '#fff', fontSize: 13, cursor: 'pointer', fontWeight: 500 }}
                >
                  ▶ בצע עכשיו
                </button>
              ) : (
                <>
                  <button
                    onClick={() => onAction(act.id, 'approve')}
                    style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #22c55e', background: '#f0fdf4', color: '#166534', fontSize: 13, cursor: 'pointer', fontWeight: 500 }}
                  >
                    ✓ אשר
                  </button>
                  <button
                    onClick={() => onAction(act.id, 'reject')}
                    style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', color: '#6b7280', fontSize: 13, cursor: 'pointer' }}
                  >
                    ✗ דחה
                  </button>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Activity Tab ──

function ActivityTab({ runs, actions }: { runs: GrowthRun[]; actions: GrowthAction[] }) {
  const recentActions = actions
    .filter(a => a.approvalStatus === 'approved' || a.approvalStatus === 'rejected' || a.executionStatus === 'completed')
    .slice(0, 15);

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Recent runs */}
      <div>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 8 }}>סריקות אחרונות</h3>
        {runs.length === 0 ? (
          <EmptyState text="לא בוצעו סריקות עדיין" icon="🔍" />
        ) : (
          <div style={{ display: 'grid', gap: 6 }}>
            {runs.slice(0, 5).map(run => (
              <div key={run.id} style={{ padding: '10px 14px', background: '#f9fafb', borderRadius: 8, fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{run.summary || `סריקה — ${run.clientsScanned} לקוחות, ${run.opportunitiesFound} הזדמנויות`}</span>
                <span style={{ color: '#9ca3af', fontSize: 12 }}>{new Date(run.startedAt).toLocaleString('he-IL')}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent action decisions */}
      <div>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 8 }}>פעולות אחרונות</h3>
        {recentActions.length === 0 ? (
          <EmptyState text="אין פעולות שבוצעו/נדחו לאחרונה" icon="📋" />
        ) : (
          <div style={{ display: 'grid', gap: 6 }}>
            {recentActions.map(act => {
              const statusLabel = act.executionStatus === 'completed' ? '✓ בוצע' : act.approvalStatus === 'approved' ? '✓ אושר' : '✗ נדחה';
              const statusColor = act.approvalStatus === 'rejected' ? '#ef4444' : '#22c55e';
              return (
                <div key={act.id} style={{ padding: '10px 14px', background: '#f9fafb', borderRadius: 8, fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{act.title} — {act.clientName}</span>
                  <span style={{ color: statusColor, fontWeight: 500 }}>{statusLabel}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Learning Tab ──

function LearningTab() {
  const [learningData, setLearningData] = useState<any>(null);

  useEffect(() => {
    fetch('/api/data/growth/results')
      .then(r => r.json())
      .then(setLearningData)
      .catch(() => {});
  }, []);

  if (!learningData || learningData.totalResults === 0) {
    return <EmptyState text="עדיין אין מספיק נתונים ללמידה — הריצו פעולות ומדדו תוצאות" icon="📚" />;
  }

  const { outcomes, successRate } = learningData;

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        <KPICard label="שיעור הצלחה" value={`${successRate}%`} icon="📊" color="#22c55e" isText />
        <KPICard label="השתפר" value={outcomes.improved} icon="📈" color="#22c55e" />
        <KPICard label="ללא שינוי" value={outcomes.noChange} icon="➡️" color="#6b7280" />
        <KPICard label="ירד" value={outcomes.declined} icon="📉" color="#ef4444" />
      </div>

      {learningData.recentResults?.length > 0 && (
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 8 }}>תוצאות אחרונות</h3>
          <div style={{ display: 'grid', gap: 6 }}>
            {learningData.recentResults.slice(0, 10).map((r: any) => (
              <div key={r.id} style={{ padding: '10px 14px', background: '#f9fafb', borderRadius: 8, fontSize: 13 }}>
                <span>{r.impactSummary}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Empty State ──

function EmptyState({ text, icon }: { text: string; icon: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af' }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 14 }}>{text}</div>
    </div>
  );
}
