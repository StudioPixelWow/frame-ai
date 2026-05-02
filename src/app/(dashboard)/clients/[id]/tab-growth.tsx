'use client';

/**
 * TabGrowth — Client-specific growth opportunities
 *
 * Shows opportunities, suggested actions, approval status, expected impact.
 * Client-facing mode: simplified language, read-only except approvals.
 */

import React, { useState, useEffect, useCallback } from 'react';

interface GrowthOpportunity {
  id: string;
  type: string;
  severity: string;
  confidence: number;
  title: string;
  reason: string;
  expectedImpact: string;
  status: string;
  campaignName: string | null;
  platform: string | null;
  createdAt: string;
}

interface GrowthAction {
  id: string;
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

interface GrowthDashboard {
  opportunities: GrowthOpportunity[];
  actions: GrowthAction[];
  kpis: {
    opportunitiesFound: number;
    pendingApprovals: number;
    actionsPrepared: number;
    highRiskClients: number;
    potentialImpact: string;
  };
}

const OPP_TYPE_META: Record<string, { icon: string; label: string; color: string }> = {
  scale: { icon: '📈', label: 'הרחבה', color: '#22c55e' },
  creative_replacement: { icon: '🎨', label: 'החלפת קריאייטיב', color: '#f59e0b' },
  budget_waste: { icon: '💸', label: 'בזבוז תקציב', color: '#ef4444' },
  platform_shift: { icon: '🔄', label: 'שינוי פלטפורמה', color: '#8b5cf6' },
  audience_expansion: { icon: '🎯', label: 'הרחבת קהל', color: '#3b82f6' },
  funnel_leak: { icon: '🔍', label: 'דליפה במשפך', color: '#f97316' },
  content_to_campaign: { icon: '✨', label: 'תוכן לקמפיין', color: '#06b6d4' },
  client_risk: { icon: '⚠️', label: 'סיכון', color: '#dc2626' },
};

const SEVERITY_BG: Record<string, string> = {
  critical: '#fef2f2',
  high: '#fef2f2',
  medium: '#fffbeb',
  low: '#f3f4f6',
};

export default function TabGrowth({ clientId, isClientPortal }: { clientId: string; isClientPortal?: boolean }) {
  const [data, setData] = useState<GrowthDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/data/growth?clientId=${clientId}`);
      if (res.ok) setData(await res.json());
    } catch {}
    setLoading(false);
  }, [clientId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const runClientScan = async () => {
    setScanning(true);
    try {
      await fetch('/api/data/growth/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, triggeredBy: 'manual' }),
      });
      await fetchData();
    } catch {}
    setScanning(false);
  };

  const handleAction = async (actionId: string, action: 'approve' | 'reject') => {
    try {
      await fetch('/api/data/growth/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionId, action }),
      });
      await fetchData();
    } catch {}
  };

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>טוען הזדמנויות צמיחה...</div>;
  }

  const opportunities = data?.opportunities || [];
  const actions = data?.actions || [];
  const pendingActions = actions.filter(a => a.approvalStatus === 'pending_admin' || a.approvalStatus === 'pending_client');

  return (
    <div style={{ direction: 'rtl' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: '#111827', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
            🌱 הזדמנויות צמיחה
          </h3>
          <p style={{ fontSize: 12, color: '#9ca3af', margin: '2px 0 0' }}>
            {isClientPortal ? 'הזדמנויות שזוהו עבורכם' : 'הזדמנויות ופעולות מוצעות ללקוח'}
          </p>
        </div>
        {!isClientPortal && (
          <button
            onClick={runClientScan}
            disabled={scanning}
            style={{
              padding: '6px 14px', borderRadius: 6, border: '1px solid #e5e7eb',
              background: scanning ? '#f3f4f6' : '#fff', color: '#374151',
              fontSize: 13, cursor: scanning ? 'wait' : 'pointer',
            }}
          >
            {scanning ? '⏳ סורק...' : '🔍 בדוק עכשיו'}
          </button>
        )}
      </div>

      {/* Trust banner */}
      <div style={{ padding: '8px 12px', background: '#f0fdf4', borderRadius: 6, border: '1px solid #bbf7d0', marginBottom: 16, fontSize: 12, color: '#166534' }}>
        🔒 לא תבוצע פעולה ללא אישור
      </div>

      {/* Quick stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
        <div style={{ padding: '10px 12px', background: '#f9fafb', borderRadius: 8, textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#3b82f6' }}>{opportunities.length}</div>
          <div style={{ fontSize: 11, color: '#6b7280' }}>הזדמנויות</div>
        </div>
        <div style={{ padding: '10px 12px', background: '#f9fafb', borderRadius: 8, textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#f59e0b' }}>{pendingActions.length}</div>
          <div style={{ fontSize: 11, color: '#6b7280' }}>ממתין לאישור</div>
        </div>
        <div style={{ padding: '10px 12px', background: '#f9fafb', borderRadius: 8, textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#22c55e' }}>
            {actions.filter(a => a.executionStatus === 'completed').length}
          </div>
          <div style={{ fontSize: 11, color: '#6b7280' }}>בוצעו</div>
        </div>
      </div>

      {/* Opportunities */}
      {opportunities.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h4 style={{ fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 8 }}>הזדמנויות שזוהו</h4>
          <div style={{ display: 'grid', gap: 6 }}>
            {opportunities.slice(0, 8).map(opp => {
              const meta = OPP_TYPE_META[opp.type] || { icon: '📌', label: opp.type, color: '#6b7280' };
              return (
                <div key={opp.id} style={{
                  padding: '10px 14px', background: SEVERITY_BG[opp.severity] || '#f9fafb',
                  borderRadius: 8, borderRight: `3px solid ${meta.color}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span>{meta.icon}</span>
                    <span style={{ fontWeight: 600, fontSize: 13, color: '#111827' }}>{opp.title}</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#4b5563' }}>{opp.reason}</div>
                  <div style={{ fontSize: 11, color: '#059669', marginTop: 4 }}>💡 {opp.expectedImpact}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Pending actions */}
      {pendingActions.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h4 style={{ fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 8 }}>פעולות ממתינות לאישור</h4>
          <div style={{ display: 'grid', gap: 6 }}>
            {pendingActions.map(act => (
              <div key={act.id} style={{ padding: '10px 14px', background: '#fffbeb', borderRadius: 8, border: '1px solid #fde68a' }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: '#111827', marginBottom: 4 }}>{act.title}</div>
                <div style={{ fontSize: 12, color: '#4b5563', marginBottom: 6 }}>{act.reason}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => handleAction(act.id, 'approve')}
                    style={{ padding: '4px 12px', borderRadius: 4, border: '1px solid #22c55e', background: '#f0fdf4', color: '#166534', fontSize: 12, cursor: 'pointer' }}
                  >
                    ✓ אשר
                  </button>
                  <button
                    onClick={() => handleAction(act.id, 'reject')}
                    style={{ padding: '4px 12px', borderRadius: 4, border: '1px solid #e5e7eb', background: '#fff', color: '#6b7280', fontSize: 12, cursor: 'pointer' }}
                  >
                    ✗ דחה
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {opportunities.length === 0 && actions.length === 0 && (
        <div style={{ textAlign: 'center', padding: '32px 0', color: '#9ca3af' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🌱</div>
          <div style={{ fontSize: 14 }}>אין עדיין מספיק נתונים לזיהוי הזדמנויות צמיחה</div>
          {!isClientPortal && (
            <div style={{ fontSize: 12, marginTop: 6 }}>חברו פלטפורמות פרסום והריצו בדיקה ראשונה</div>
          )}
        </div>
      )}
    </div>
  );
}
