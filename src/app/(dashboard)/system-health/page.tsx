'use client';

import { useState, useEffect, useCallback } from 'react';

// ── Types ──

interface HealthCheck {
  name: string;
  status: 'healthy' | 'warning' | 'critical';
  message: string;
  checkedAt: string;
}

interface DashboardData {
  overallStatus: 'healthy' | 'warning' | 'critical';
  statusMessage: string;
  checks: HealthCheck[];
  recentErrors: any[];
  activeAlerts: any[];
  governanceRules: any[];
  stats: {
    totalErrors24h: number;
    criticalErrors24h: number;
    failedActions24h: number;
    failedSyncs24h: number;
    autopilotIssues24h: number;
    resolvedErrors24h: number;
  };
}

interface AdminSummary {
  autopilotActive: number;
  autopilotPaused: number;
  failedActions: number;
  unresolvedErrors: number;
  activeAlerts: number;
}

// ── Metadata ──

const STATUS_META: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  healthy: { label: 'תקין', icon: '✅', color: '#16a34a', bg: 'rgba(34,197,94,0.06)' },
  warning: { label: 'אזהרה', icon: '⚠️', color: '#ca8a04', bg: 'rgba(202,138,4,0.06)' },
  critical: { label: 'קריטי', icon: '🔴', color: '#dc2626', bg: 'rgba(220,38,38,0.06)' },
};

const SEVERITY_COLORS: Record<string, string> = {
  low: '#16a34a',
  medium: '#ca8a04',
  high: '#ea580c',
  critical: '#dc2626',
};

const SOURCE_ICONS: Record<string, string> = {
  api: '🌐', campaign: '📢', sync: '🔄', autopilot: '🤖',
  action: '⚡', db: '💾', validation: '🛡️', system: '⚙️',
};

// ── Page Component ──

export default function SystemHealthPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [admin, setAdmin] = useState<AdminSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'status' | 'errors' | 'alerts' | 'governance' | 'controls'>('status');

  const load = useCallback(() => {
    Promise.all([
      fetch('/api/data/system-health').then(r => r.ok ? r.json() : null),
      fetch('/api/data/system-health/controls').then(r => r.ok ? r.json() : null),
    ])
      .then(([d, a]) => {
        if (d) setData(d);
        if (a) setAdmin(a);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const doControl = useCallback(async (action: string, clientId?: string) => {
    try {
      await fetch('/api/data/system-health/controls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, clientId }),
      });
      load();
    } catch {}
  }, [load]);

  const doAlertAction = useCallback(async (action: string, alertId?: string) => {
    try {
      await fetch('/api/data/system-health/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, alertId }),
      });
      load();
    } catch {}
  }, [load]);

  const doResolveError = useCallback(async (errorId: string) => {
    try {
      await fetch('/api/data/system-health/errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resolve', errorId }),
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

  const overall = data?.overallStatus || 'healthy';
  const overallMeta = STATUS_META[overall];
  const stats = data?.stats || { totalErrors24h: 0, criticalErrors24h: 0, failedActions24h: 0, failedSyncs24h: 0, autopilotIssues24h: 0, resolvedErrors24h: 0 };

  return (
    <main dir="rtl" style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--foreground)', margin: 0 }}>
          🏥 בריאות המערכת
        </h1>
        <p style={{ fontSize: '0.82rem', color: 'var(--foreground-muted)', margin: '0.3rem 0 0' }}>
          ניטור, שגיאות, התראות ובקרה
        </p>
      </div>

      {/* Overall Status Banner */}
      <div style={{
        background: overallMeta.bg,
        border: `1px solid ${overallMeta.color}22`,
        borderRadius: '0.6rem',
        padding: '1rem 1.2rem',
        marginBottom: '1.2rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
      }}>
        <span style={{ fontSize: '2rem' }}>{overallMeta.icon}</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: '1rem', color: overallMeta.color }}>
            {data?.statusMessage || overallMeta.label}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--foreground-muted)', marginTop: '0.15rem' }}>
            {stats.totalErrors24h === 0 ? 'ללא שגיאות ב-24 שעות' : `${stats.totalErrors24h} שגיאות ב-24 שעות`}
            {stats.resolvedErrors24h > 0 && ` · ${stats.resolvedErrors24h} טופלו`}
          </div>
        </div>
      </div>

      {/* KPI Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0.6rem', marginBottom: '1.2rem' }}>
        <KPICard label="שגיאות 24ש" value={stats.totalErrors24h} icon="⚠️" color={stats.totalErrors24h > 0 ? '#ca8a04' : undefined} />
        <KPICard label="קריטיות" value={stats.criticalErrors24h} icon="🔴" color={stats.criticalErrors24h > 0 ? '#dc2626' : undefined} />
        <KPICard label="פעולות נכשלות" value={stats.failedActions24h} icon="❌" />
        <KPICard label="סנכרון נכשל" value={stats.failedSyncs24h} icon="🔗" />
        <KPICard label="בעיות אוטופיילוט" value={stats.autopilotIssues24h} icon="🤖" />
        <KPICard label="התראות פעילות" value={admin?.activeAlerts || 0} icon="🔔" color={(admin?.activeAlerts || 0) > 0 ? '#ca8a04' : undefined} />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
        {([
          { id: 'status' as const, label: 'סטטוס מערכת' },
          { id: 'errors' as const, label: `שגיאות${stats.totalErrors24h > 0 ? ` (${stats.totalErrors24h})` : ''}` },
          { id: 'alerts' as const, label: `התראות${(admin?.activeAlerts || 0) > 0 ? ` (${admin?.activeAlerts})` : ''}` },
          { id: 'governance' as const, label: 'מדיניות' },
          { id: 'controls' as const, label: 'בקרה' },
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

      {/* Tab Content */}
      {tab === 'status' && <StatusTab checks={data?.checks || []} />}
      {tab === 'errors' && <ErrorsTab errors={data?.recentErrors || []} onResolve={doResolveError} />}
      {tab === 'alerts' && <AlertsTab alerts={data?.activeAlerts || []} onAction={doAlertAction} />}
      {tab === 'governance' && <GovernanceTab rules={data?.governanceRules || []} />}
      {tab === 'controls' && <ControlsTab admin={admin} onAction={doControl} />}
    </main>
  );
}

// ── Components ──

function KPICard({ label, value, icon, color }: { label: string; value: number; icon: string; color?: string }) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: '0.5rem',
      padding: '0.6rem',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: '1.1rem' }}>{icon}</div>
      <div style={{ fontSize: '1.3rem', fontWeight: 800, color: color || 'var(--foreground)', marginTop: '0.15rem' }}>{value}</div>
      <div style={{ fontSize: '0.65rem', color: 'var(--foreground-muted)' }}>{label}</div>
    </div>
  );
}

function StatusTab({ checks }: { checks: HealthCheck[] }) {
  if (checks.length === 0) {
    return <EmptyCard message="המערכת פועלת בצורה תקינה" icon="✅" />;
  }
  return (
    <div style={{ display: 'grid', gap: '0.5rem' }}>
      {checks.map((check, i) => {
        const meta = STATUS_META[check.status] || STATUS_META.healthy;
        return (
          <div key={i} style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '0.5rem',
            padding: '0.7rem 1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.1rem' }}>{meta.icon}</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--foreground)' }}>{check.name}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--foreground-muted)' }}>{check.message}</div>
              </div>
            </div>
            <span style={{ fontSize: '0.7rem', color: meta.color, fontWeight: 600 }}>{meta.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function ErrorsTab({ errors, onResolve }: { errors: any[]; onResolve: (id: string) => void }) {
  if (errors.length === 0) {
    return <EmptyCard message="ללא שגיאות — המערכת פועלת בצורה תקינה" icon="✅" />;
  }
  return (
    <div style={{ display: 'grid', gap: '0.4rem' }}>
      {errors.map((err: any) => (
        <div key={err.id} style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '0.5rem',
          padding: '0.6rem 0.8rem',
          fontSize: '0.78rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span>{SOURCE_ICONS[err.source] || '⚙️'}</span>
              <span style={{ fontWeight: 600, color: 'var(--foreground)' }}>{err.type}</span>
              <span style={{ fontSize: '0.68rem', color: SEVERITY_COLORS[err.severity] || '#6b7280', fontWeight: 600 }}>
                {err.severity}
              </span>
            </div>
            {!err.resolved && (
              <button
                onClick={() => onResolve(err.id)}
                style={{ padding: '0.2rem 0.5rem', borderRadius: '0.3rem', border: '1px solid var(--border)', background: 'transparent', fontSize: '0.68rem', cursor: 'pointer', color: 'var(--foreground-muted)' }}
              >
                סמן כטופל
              </button>
            )}
            {err.resolved && (
              <span style={{ fontSize: '0.68rem', color: '#16a34a' }}>✅ טופל</span>
            )}
          </div>
          <div style={{ color: 'var(--foreground-muted)', fontSize: '0.72rem', marginTop: '0.2rem' }}>
            {err.message?.substring(0, 150)}
          </div>
          <div style={{ fontSize: '0.65rem', color: 'var(--foreground-muted)', marginTop: '0.1rem' }}>
            {err.createdAt ? new Date(err.createdAt).toLocaleString('he-IL') : ''}
          </div>
        </div>
      ))}
    </div>
  );
}

function AlertsTab({ alerts, onAction }: { alerts: any[]; onAction: (action: string, alertId?: string) => void }) {
  if (alerts.length === 0) {
    return <EmptyCard message="אין התראות פעילות" icon="🔔" />;
  }
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
        <button
          onClick={() => onAction('acknowledgeAll')}
          style={{ padding: '0.3rem 0.7rem', borderRadius: '0.3rem', border: '1px solid var(--border)', background: 'transparent', fontSize: '0.72rem', cursor: 'pointer', color: 'var(--foreground-muted)' }}
        >
          סמן הכל כנקרא
        </button>
      </div>
      <div style={{ display: 'grid', gap: '0.4rem' }}>
        {alerts.map((alert: any) => (
          <div key={alert.id} style={{
            background: 'var(--surface)',
            border: `1px solid ${SEVERITY_COLORS[alert.severity] || 'var(--border)'}33`,
            borderRadius: '0.5rem',
            padding: '0.6rem 0.8rem',
            fontSize: '0.78rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 600, color: 'var(--foreground)' }}>{alert.title}</div>
              <button
                onClick={() => onAction('acknowledge', alert.id)}
                style={{ padding: '0.2rem 0.5rem', borderRadius: '0.3rem', border: '1px solid var(--border)', background: 'transparent', fontSize: '0.68rem', cursor: 'pointer', color: 'var(--foreground-muted)' }}
              >
                סמן כנקרא
              </button>
            </div>
            <div style={{ color: 'var(--foreground-muted)', fontSize: '0.72rem', marginTop: '0.15rem' }}>
              {alert.message}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function GovernanceTab({ rules }: { rules: any[] }) {
  if (rules.length === 0) {
    return <EmptyCard message="כללי מדיניות לא הוגדרו" icon="🛡️" />;
  }
  return (
    <div style={{ display: 'grid', gap: '0.5rem' }}>
      {rules.map((rule: any) => (
        <div key={rule.id} style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '0.5rem',
          padding: '0.7rem 1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--foreground)' }}>
              🛡️ {rule.name}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--foreground-muted)', marginTop: '0.1rem' }}>
              {rule.description}
            </div>
          </div>
          <span style={{
            fontSize: '0.68rem',
            padding: '0.15rem 0.4rem',
            borderRadius: '0.25rem',
            background: rule.isActive ? 'rgba(34,197,94,0.1)' : 'rgba(107,114,128,0.1)',
            color: rule.isActive ? '#16a34a' : '#6b7280',
            fontWeight: 600,
          }}>
            {rule.isActive ? 'פעיל' : 'כבוי'}
          </span>
        </div>
      ))}
    </div>
  );
}

function ControlsTab({ admin, onAction }: { admin: AdminSummary | null; onAction: (action: string) => void }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
      {/* Autopilot Controls */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '0.6rem', padding: '1rem' }}>
        <h3 style={{ fontSize: '0.9rem', fontWeight: 700, margin: '0 0 0.75rem' }}>🤖 בקרת אוטופיילוט</h3>
        <div style={{ fontSize: '0.78rem', color: 'var(--foreground-muted)', marginBottom: '0.75rem' }}>
          פעילים: {admin?.autopilotActive || 0} · מושהים: {admin?.autopilotPaused || 0}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <ControlButton label="⏸️ השהה הכל" onClick={() => onAction('pauseGlobal')} variant="warning" />
          <ControlButton label="▶️ חדש הכל" onClick={() => onAction('resumeGlobal')} variant="success" />
        </div>
      </div>

      {/* Error Controls */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '0.6rem', padding: '1rem' }}>
        <h3 style={{ fontSize: '0.9rem', fontWeight: 700, margin: '0 0 0.75rem' }}>⚡ בקרת פעולות</h3>
        <div style={{ fontSize: '0.78rem', color: 'var(--foreground-muted)', marginBottom: '0.75rem' }}>
          נכשלו: {admin?.failedActions || 0} · שגיאות פתוחות: {admin?.unresolvedErrors || 0}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <ControlButton label="🔄 נסה שוב פעולות" onClick={() => onAction('retryFailed')} variant="primary" />
        </div>
      </div>
    </div>
  );
}

function ControlButton({ label, onClick, variant }: { label: string; onClick: () => void; variant: 'primary' | 'success' | 'warning' | 'danger' }) {
  const colors = {
    primary: { bg: '#2563eb', color: '#fff' },
    success: { bg: '#16a34a', color: '#fff' },
    warning: { bg: '#ca8a04', color: '#fff' },
    danger: { bg: '#dc2626', color: '#fff' },
  };
  const c = colors[variant];
  return (
    <button
      onClick={onClick}
      style={{
        padding: '0.4rem 0.8rem',
        borderRadius: '0.4rem',
        border: 'none',
        background: c.bg,
        color: c.color,
        fontWeight: 600,
        fontSize: '0.75rem',
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}

function EmptyCard({ message, icon }: { message: string; icon: string }) {
  return (
    <div style={{
      textAlign: 'center',
      padding: '2.5rem',
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: '0.6rem',
    }}>
      <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{icon}</div>
      <p style={{ fontSize: '0.85rem', color: 'var(--foreground-muted)', margin: 0 }}>{message}</p>
    </div>
  );
}
