'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { PremiumStatGrid, PremiumKpiCard, BRAND } from '@/components/charts';

// ── Types ──

interface KPIs {
  clientsMonitored: number;
  actionsToday: number;
  approvalsPending: number;
  executedThisWeek: number;
  successRate: number;
}

interface DashboardData {
  kpis: KPIs;
  highRiskClients: Array<{ clientId: string; clientName: string; reason: string; severity: string }>;
  recentActions: any[];
  pendingApprovals: any[];
  recentActivity: any[];
  clientSummaries: Array<{
    clientId: string;
    clientName: string;
    mode: string;
    isActive: boolean;
    isPaused: boolean;
    lastScanAt: string | null;
    pendingActions: number;
    totalActions: number;
  }>;
}

// ── Metadata ──

const MODE_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  recommend_only: { label: 'המלצה בלבד', icon: '💡', color: '#2563eb' },
  approval_required: { label: 'אישור נדרש', icon: '🔒', color: '#16a34a' },
  safe_internal: { label: 'פנימי בלבד', icon: '🛡️', color: '#ca8a04' },
  full_auto: { label: 'נעול', icon: '⚡', color: '#9ca3af' },
};

const STATUS_META: Record<string, { label: string; icon: string; color: string }> = {
  draft: { label: 'טיוטה', icon: '📝', color: '#6b7280' },
  pending_approval: { label: 'ממתין', icon: '⏳', color: '#ca8a04' },
  approved: { label: 'אושר', icon: '✅', color: '#16a34a' },
  blocked: { label: 'חסום', icon: '🚫', color: '#dc2626' },
  executed: { label: 'בוצע', icon: '🎯', color: '#2563eb' },
  failed: { label: 'נכשל', icon: '❌', color: '#dc2626' },
};

const ACTIVITY_META: Record<string, { label: string; icon: string }> = {
  scan_started: { label: 'סריקה החלה', icon: '🔍' },
  scan_completed: { label: 'סריקה הושלמה', icon: '✅' },
  opportunity_detected: { label: 'הזדמנות', icon: '💡' },
  approval_requested: { label: 'בקשת אישור', icon: '⏳' },
  approved: { label: 'אושר', icon: '✅' },
  rejected: { label: 'נדחה', icon: '❌' },
  executed: { label: 'בוצע', icon: '🎯' },
  execution_failed: { label: 'נכשל', icon: '⚠️' },
  autopilot_paused: { label: 'הושהה', icon: '⏸️' },
  learning_updated: { label: 'למידה', icon: '📊' },
};

// ── Page Component ──

export default function AutopilotPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [tab, setTab] = useState<'overview' | 'clients' | 'actions' | 'activity'>('overview');

  const load = useCallback(() => {
    fetch('/api/data/autopilot')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setData(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const runScan = useCallback(async () => {
    setScanning(true);
    try {
      await fetch('/api/data/autopilot/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ triggeredBy: 'manual' }),
      });
      load();
    } catch {}
    setScanning(false);
  }, [load]);

  const handleAction = useCallback(async (actionId: string, status: string) => {
    try {
      await fetch('/api/data/autopilot/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionId, status, approvedBy: 'admin', rejectedBy: status === 'approved' ? undefined : 'admin' }),
      });
      load();
    } catch {}
  }, [load]);

  if (loading) {
    return (
      <main dir="rtl" style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', color: 'var(--foreground-muted)', padding: '4rem' }}>טוען...</div>
      </main>
    );
  }

  const kpis = data?.kpis || { clientsMonitored: 0, actionsToday: 0, approvalsPending: 0, executedThisWeek: 0, successRate: 0 };
  const hasData = data && (kpis.clientsMonitored > 0 || (data.recentActions || []).length > 0);

  return (
    <main dir="rtl" style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--foreground)', margin: 0 }}>
            🤖 אוטופיילוט — Agency Autopilot
          </h1>
          <p style={{ fontSize: '0.82rem', color: 'var(--foreground-muted)', margin: '0.3rem 0 0' }}>
            AI Growth Manager שעובד בשבילך
          </p>
        </div>
        <button
          onClick={runScan}
          disabled={scanning}
          style={{
            padding: '0.6rem 1.2rem',
            borderRadius: '0.5rem',
            border: 'none',
            background: scanning ? '#9ca3af' : '#2563eb',
            color: '#fff',
            fontWeight: 600,
            fontSize: '0.82rem',
            cursor: scanning ? 'not-allowed' : 'pointer',
          }}
        >
          {scanning ? '⏳ סורק...' : '🔍 הרץ סריקה אוטונומית עכשיו'}
        </button>
      </div>

      {/* Safety Banner */}
      <div style={{
        background: 'rgba(34,197,94,0.06)',
        border: '1px solid rgba(34,197,94,0.15)',
        borderRadius: '0.5rem',
        padding: '0.6rem 1rem',
        marginBottom: '1.2rem',
        fontSize: '0.78rem',
        color: '#166534',
        textAlign: 'center',
      }}>
        🔒 לא תבוצע פעולה חיה ללא אישור — המערכת פועלת במצב בטוח
      </div>

      {/* KPI Strip */}
      <PremiumStatGrid
        items={[
          { label: 'לקוחות מנוטרים', value: kpis.clientsMonitored, icon: '👥', format: 'number' },
          { label: 'פעולות היום', value: kpis.actionsToday, icon: '📋', format: 'number' },
          { label: 'ממתינות לאישור', value: kpis.approvalsPending, icon: '⏳', format: 'number', color: kpis.approvalsPending > 0 ? '#ca8a04' : undefined },
          { label: 'בוצעו השבוע', value: kpis.executedThisWeek, icon: '✅', format: 'number' },
          { label: 'אחוז הצלחה', value: kpis.successRate, icon: '📈', format: 'percent' },
        ]}
        columns={5}
        variant="light"
      />


      {/* High Risk Clients */}
      {(data?.highRiskClients || []).length > 0 && (
        <div style={{
          background: 'rgba(220,38,38,0.04)',
          border: '1px solid rgba(220,38,38,0.15)',
          borderRadius: '0.5rem',
          padding: '0.8rem 1rem',
          marginBottom: '1rem',
          fontSize: '0.78rem',
        }}>
          <div style={{ fontWeight: 700, color: '#dc2626', marginBottom: '0.4rem' }}>⚠️ לקוחות בסיכון גבוה</div>
          {data!.highRiskClients.map((c, i) => (
            <div key={i} style={{ color: '#991b1b' }}>
              {c.clientName} — {c.reason}
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
        {([
          { id: 'overview' as const, label: 'סקירה כללית' },
          { id: 'clients' as const, label: 'לקוחות' },
          { id: 'actions' as const, label: 'פעולות' },
          { id: 'activity' as const, label: 'יומן פעילות' },
        ]).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '0.4rem 0.8rem',
              borderRadius: '0.4rem',
              border: 'none',
              background: tab === t.id ? '#2563eb' : 'transparent',
              color: tab === t.id ? '#fff' : 'var(--foreground-muted)',
              fontWeight: tab === t.id ? 600 : 400,
              fontSize: '0.8rem',
              cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {!hasData ? (
        <EmptyState />
      ) : (
        <>
          {tab === 'overview' && <OverviewTab data={data!} onAction={handleAction} />}
          {tab === 'clients' && <ClientsTab summaries={data!.clientSummaries} />}
          {tab === 'actions' && <ActionsTab actions={data!.recentActions} onAction={handleAction} />}
          {tab === 'activity' && <ActivityTab log={data!.recentActivity} />}
        </>
      )}
    </main>
  );
}

// ── Components ──

function EmptyState() {
  return (
    <div style={{
      textAlign: 'center',
      padding: '3rem',
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: '0.75rem',
    }}>
      <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🤖</div>
      <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--foreground)', margin: '0 0 0.5rem' }}>
        אין מספיק נתונים להפעלת אוטופיילוט
      </h3>
      <p style={{ fontSize: '0.82rem', color: 'var(--foreground-muted)', margin: 0 }}>
        הפעל אוטופיילוט עבור לקוחות דרך דף הלקוח, ולחץ על &quot;הרץ סריקה&quot; להתחלה
      </p>
    </div>
  );
}

function OverviewTab({ data, onAction }: { data: DashboardData; onAction: (id: string, status: string) => void }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
      {/* Pending Approvals */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '0.6rem', padding: '1rem' }}>
        <h3 style={{ fontSize: '0.9rem', fontWeight: 700, margin: '0 0 0.75rem' }}>⏳ ממתינות לאישור</h3>
        {data.pendingApprovals.length === 0 ? (
          <div style={{ fontSize: '0.78rem', color: 'var(--foreground-muted)', textAlign: 'center', padding: '1rem' }}>
            המערכת לא זיהתה פעולות כרגע
          </div>
        ) : (
          <ActionsList actions={data.pendingApprovals.slice(0, 5)} onAction={onAction} />
        )}
      </div>

      {/* Recent Activity */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '0.6rem', padding: '1rem' }}>
        <h3 style={{ fontSize: '0.9rem', fontWeight: 700, margin: '0 0 0.75rem' }}>📋 פעילות אחרונה</h3>
        {data.recentActivity.length === 0 ? (
          <div style={{ fontSize: '0.78rem', color: 'var(--foreground-muted)', textAlign: 'center', padding: '1rem' }}>
            אין פעילות עדיין
          </div>
        ) : (
          data.recentActivity.slice(0, 8).map((entry: any) => {
            const meta = ACTIVITY_META[entry.activityType] || { label: entry.activityType, icon: '📄' };
            return (
              <div key={entry.id} style={{
                padding: '0.4rem 0',
                borderBottom: '1px solid var(--border)',
                fontSize: '0.75rem',
              }}>
                <span>{meta.icon} {entry.title}</span>
                <div style={{ color: 'var(--foreground-muted)', fontSize: '0.68rem', marginTop: '0.1rem' }}>
                  {entry.details?.substring(0, 80)}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function ClientsTab({ summaries }: { summaries: DashboardData['clientSummaries'] }) {
  if (summaries.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--foreground-muted)', fontSize: '0.82rem' }}>
        אין לקוחות מחוברים לאוטופיילוט
      </div>
    );
  }
  return (
    <div style={{ display: 'grid', gap: '0.6rem' }}>
      {summaries.map(client => {
        const modeMeta = MODE_LABELS[client.mode] || MODE_LABELS.approval_required;
        return (
          <div key={client.clientId} style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '0.6rem',
            padding: '0.8rem 1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--foreground)' }}>
                {client.clientName || client.clientId}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--foreground-muted)', marginTop: '0.15rem' }}>
                {modeMeta.icon} {modeMeta.label}
                {client.isPaused && ' · מושהה'}
                {client.lastScanAt && ` · סריקה אחרונה: ${new Date(client.lastScanAt).toLocaleDateString('he-IL')}`}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', color: 'var(--foreground-muted)' }}>
              <span>⏳ {client.pendingActions} ממתינות</span>
              <span>📊 {client.totalActions} סה&quot;כ</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ActionsTab({ actions, onAction }: { actions: any[]; onAction: (id: string, status: string) => void }) {
  if (actions.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--foreground-muted)', fontSize: '0.82rem' }}>
        המערכת לא זיהתה פעולות כרגע
      </div>
    );
  }
  return <ActionsList actions={actions} onAction={onAction} />;
}

function ActionsList({ actions, onAction }: { actions: any[]; onAction: (id: string, status: string) => void }) {
  return (
    <div style={{ display: 'grid', gap: '0.5rem' }}>
      {actions.map((action: any) => {
        const statusMeta = STATUS_META[action.status] || STATUS_META.draft;
        return (
          <div key={action.id} style={{
            padding: '0.6rem 0.8rem',
            borderRadius: '0.5rem',
            background: 'var(--surface-raised)',
            border: '1px solid var(--border)',
            fontSize: '0.78rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 600, color: 'var(--foreground)' }}>
                {action.title}
              </div>
              <span style={{ color: statusMeta.color, fontSize: '0.7rem' }}>
                {statusMeta.icon} {statusMeta.label}
              </span>
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--foreground-muted)', marginTop: '0.2rem' }}>
              {action.clientName} · ביטחון {action.confidence}% · סיכון {action.riskLevel === 'low' ? 'נמוך' : action.riskLevel === 'medium' ? 'בינוני' : 'גבוה'}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--foreground-muted)', marginTop: '0.1rem' }}>
              {action.reason?.substring(0, 100)}
            </div>
            {action.status === 'pending_approval' && (
              <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.4rem' }}>
                <button
                  onClick={() => onAction(action.id, 'approved')}
                  style={{ padding: '0.25rem 0.6rem', borderRadius: '0.3rem', border: 'none', background: '#16a34a', color: '#fff', fontSize: '0.7rem', cursor: 'pointer', fontWeight: 600 }}
                >
                  ✅ אשר
                </button>
                <button
                  onClick={() => onAction(action.id, 'blocked')}
                  style={{ padding: '0.25rem 0.6rem', borderRadius: '0.3rem', border: '1px solid #dc2626', background: 'transparent', color: '#dc2626', fontSize: '0.7rem', cursor: 'pointer', fontWeight: 600 }}
                >
                  ❌ דחה
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ActivityTab({ log }: { log: any[] }) {
  if (log.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--foreground-muted)', fontSize: '0.82rem' }}>
        אין פעילות עדיין
      </div>
    );
  }
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '0.6rem', padding: '1rem' }}>
      {log.map((entry: any) => {
        const meta = ACTIVITY_META[entry.activityType] || { label: entry.activityType, icon: '📄' };
        const time = entry.createdAt ? new Date(entry.createdAt).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
        return (
          <div key={entry.id} style={{
            padding: '0.5rem 0',
            borderBottom: '1px solid var(--border)',
            fontSize: '0.78rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.5rem',
          }}>
            <span style={{ fontSize: '1rem', flexShrink: 0, marginTop: '0.1rem' }}>{meta.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, color: 'var(--foreground)' }}>{entry.title}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--foreground-muted)', marginTop: '0.1rem' }}>
                {entry.details}
              </div>
            </div>
            <span style={{ fontSize: '0.68rem', color: 'var(--foreground-muted)', flexShrink: 0 }}>{time}</span>
          </div>
        );
      })}
    </div>
  );
}
