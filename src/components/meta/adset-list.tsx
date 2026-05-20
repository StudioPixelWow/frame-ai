'use client';

import React, { useState, useEffect, useCallback } from 'react';
import AdSetBuilder from './adset-builder';

/* ═══════════════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════════════ */

interface AdSetListProps {
  adAccountId: string;
  accessToken: string;
  campaignId: string;
  localCampaignId?: string;
  onAdSetChange?: () => void;
}

interface MetaAdSet {
  id: string;
  name: string;
  status: string;
  daily_budget?: string;
  lifetime_budget?: string;
  optimization_goal?: string;
  billing_event?: string;
  bid_strategy?: string;
  start_time?: string;
  end_time?: string;
  targeting?: {
    age_min?: number;
    age_max?: number;
    genders?: number[];
    geo_locations?: {
      countries?: string[];
      cities?: { name: string }[];
    };
    interests?: { name: string; id: string }[];
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   Constants & Styles
   ═══════════════════════════════════════════════════════════════════════════ */

const META_BLUE = '#1877f2';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: 'פעיל', color: '#22c55e' },
  PAUSED: { label: 'מושהה', color: '#f59e0b' },
  DELETED: { label: 'נמחק', color: '#6b7280' },
  ARCHIVED: { label: 'בארכיון', color: '#6b7280' },
  IN_PROCESS: { label: 'בתהליך', color: '#3b82f6' },
  WITH_ISSUES: { label: 'עם בעיות', color: '#ef4444' },
};

const containerStyle: React.CSSProperties = {
  direction: 'rtl',
};

const headerRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 20,
};

const titleStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  color: 'var(--foreground, #1f2937)',
  margin: 0,
};

const createBtnStyle: React.CSSProperties = {
  padding: '10px 20px',
  borderRadius: 10,
  border: 'none',
  background: META_BLUE,
  color: '#fff',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  transition: 'opacity 0.2s',
};

const cardStyle: React.CSSProperties = {
  background: 'var(--background, #fff)',
  borderRadius: 14,
  border: '1px solid var(--border, #e5e7eb)',
  padding: 20,
  marginBottom: 12,
  transition: 'box-shadow 0.2s',
};

const cardHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  marginBottom: 12,
};

const cardTitleStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 600,
  color: 'var(--foreground, #1f2937)',
  margin: 0,
};

const statusBadgeStyle = (color: string): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  padding: '4px 10px',
  borderRadius: 20,
  fontSize: 12,
  fontWeight: 600,
  background: `${color}15`,
  color,
  whiteSpace: 'nowrap',
});

const metaRowStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 16,
  marginBottom: 12,
};

const metaItemStyle: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--foreground, #6b7280)',
};

const metaValueStyle: React.CSSProperties = {
  fontWeight: 600,
  color: 'var(--foreground, #374151)',
};

const actionsRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  marginTop: 12,
  paddingTop: 12,
  borderTop: '1px solid var(--border, #f3f4f6)',
};

const actionBtnStyle: React.CSSProperties = {
  padding: '6px 14px',
  borderRadius: 8,
  border: '1px solid var(--border, #d1d5db)',
  background: 'var(--background, #fff)',
  color: 'var(--foreground, #374151)',
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
  transition: 'all 0.2s',
};

const toggleBtnStyle = (isActive: boolean): React.CSSProperties => ({
  ...actionBtnStyle,
  background: isActive ? '#fef3c7' : '#ecfdf5',
  borderColor: isActive ? '#f59e0b' : '#22c55e',
  color: isActive ? '#b45309' : '#15803d',
});

const emptyStyle: React.CSSProperties = {
  padding: 40,
  textAlign: 'center',
  color: 'var(--foreground, #9ca3af)',
  fontSize: 14,
};

const loadingStyle: React.CSSProperties = {
  padding: 40,
  textAlign: 'center',
  color: 'var(--foreground, #9ca3af)',
  fontSize: 14,
};

const errorStyle: React.CSSProperties = {
  padding: '12px 16px',
  borderRadius: 10,
  background: '#fef2f2',
  border: '1px solid #fca5a5',
  color: '#dc2626',
  fontSize: 13,
  marginBottom: 16,
};

const targetingSummaryStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--foreground, #9ca3af)',
  marginTop: 4,
};

/* ═══════════════════════════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════════════════════════ */

export default function AdSetList({
  adAccountId,
  accessToken,
  campaignId,
  localCampaignId,
  onAdSetChange,
}: AdSetListProps) {
  const [adSets, setAdSets] = useState<MetaAdSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingAdSet, setEditingAdSet] = useState<MetaAdSet | null>(null);
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());

  const fetchAdSets = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const actId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
      const params = new URLSearchParams({
        adAccountId: actId,
        accessToken,
      });

      const res = await fetch(`/api/meta-business/adsets?${params}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch ad sets');
      }

      // Filter to only ad sets belonging to this campaign
      const allAdSets: MetaAdSet[] = data.data || [];
      // If we have a Meta campaign ID, filter by it
      // Otherwise show all (when campaignId is the Meta campaign ID itself)
      setAdSets(allAdSets);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה בטעינת קבוצות מודעות');
    } finally {
      setLoading(false);
    }
  }, [adAccountId, accessToken]);

  useEffect(() => {
    if (adAccountId && accessToken) {
      fetchAdSets();
    }
  }, [fetchAdSets, adAccountId, accessToken]);

  const handleToggleStatus = useCallback(async (adSet: MetaAdSet) => {
    const newStatus = adSet.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    setTogglingIds(prev => new Set(prev).add(adSet.id));

    try {
      const res = await fetch(`/api/meta-business/adsets/${adSet.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken,
          status: newStatus,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update status');
      }

      // Update local state
      setAdSets(prev =>
        prev.map(s => s.id === adSet.id ? { ...s, status: newStatus } : s)
      );
      onAdSetChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה בעדכון סטטוס');
    } finally {
      setTogglingIds(prev => {
        const next = new Set(prev);
        next.delete(adSet.id);
        return next;
      });
    }
  }, [accessToken, onAdSetChange]);

  const handleEdit = useCallback((adSet: MetaAdSet) => {
    setEditingAdSet(adSet);
    setBuilderOpen(true);
  }, []);

  const handleCreateNew = useCallback(() => {
    setEditingAdSet(null);
    setBuilderOpen(true);
  }, []);

  const handleBuilderSuccess = useCallback(() => {
    fetchAdSets();
    onAdSetChange?.();
  }, [fetchAdSets, onAdSetChange]);

  /* ── Helpers ── */

  function formatBudget(adSet: MetaAdSet): string {
    if (adSet.daily_budget) {
      return `₪${(parseInt(adSet.daily_budget, 10) / 100).toFixed(0)} / יום`;
    }
    if (adSet.lifetime_budget) {
      return `₪${(parseInt(adSet.lifetime_budget, 10) / 100).toFixed(0)} כולל`;
    }
    return 'לא הוגדר';
  }

  function formatGoal(goal?: string): string {
    const map: Record<string, string> = {
      LINK_CLICKS: 'קליקים',
      IMPRESSIONS: 'חשיפות',
      REACH: 'טווח הגעה',
      CONVERSIONS: 'המרות',
      LANDING_PAGE_VIEWS: 'צפיות בדף נחיתה',
      LEAD_GENERATION: 'לידים',
    };
    return map[goal || ''] || goal || 'לא הוגדר';
  }

  function buildTargetingSummary(targeting?: MetaAdSet['targeting']): string {
    if (!targeting) return '';
    const parts: string[] = [];

    if (targeting.geo_locations?.countries) {
      parts.push(targeting.geo_locations.countries.join(', '));
    }
    if (targeting.age_min || targeting.age_max) {
      parts.push(`גיל ${targeting.age_min || 13}–${targeting.age_max || '65+'}`);
    }
    if (targeting.genders && targeting.genders.length > 0) {
      const labels = targeting.genders.map(g => g === 1 ? 'גברים' : g === 2 ? 'נשים' : 'כולם');
      parts.push(labels.join(', '));
    }
    if (targeting.interests && targeting.interests.length > 0) {
      const interestNames = targeting.interests.slice(0, 3).map(i => i.name);
      const suffix = targeting.interests.length > 3 ? ` +${targeting.interests.length - 3}` : '';
      parts.push(interestNames.join(', ') + suffix);
    }

    return parts.join(' | ');
  }

  /* ── Render ── */

  return (
    <div style={containerStyle}>
      <div style={headerRowStyle}>
        <h3 style={titleStyle}>קבוצות מודעות</h3>
        <button style={createBtnStyle} onClick={handleCreateNew}>
          <span style={{ fontSize: 18, lineHeight: 1 }}>+</span>
          צור קבוצה חדשה
        </button>
      </div>

      {error && <div style={errorStyle}>{error}</div>}

      {loading ? (
        <div style={loadingStyle}>טוען קבוצות מודעות מ-Meta...</div>
      ) : adSets.length === 0 ? (
        <div style={emptyStyle}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
          <div>אין קבוצות מודעות עדיין</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>לחץ על &quot;צור קבוצה חדשה&quot; כדי להתחיל</div>
        </div>
      ) : (
        adSets.map(adSet => {
          const statusInfo = STATUS_MAP[adSet.status] || { label: adSet.status, color: '#6b7280' };
          const isActive = adSet.status === 'ACTIVE';
          const isToggling = togglingIds.has(adSet.id);

          return (
            <div key={adSet.id} style={cardStyle}>
              <div style={cardHeaderStyle}>
                <div>
                  <h4 style={cardTitleStyle}>{adSet.name}</h4>
                  <div style={targetingSummaryStyle}>{buildTargetingSummary(adSet.targeting)}</div>
                </div>
                <span style={statusBadgeStyle(statusInfo.color)}>
                  <span style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: statusInfo.color,
                  }} />
                  {statusInfo.label}
                </span>
              </div>

              <div style={metaRowStyle}>
                <div style={metaItemStyle}>
                  תקציב: <span style={metaValueStyle}>{formatBudget(adSet)}</span>
                </div>
                <div style={metaItemStyle}>
                  אופטימיזציה: <span style={metaValueStyle}>{formatGoal(adSet.optimization_goal)}</span>
                </div>
                {adSet.start_time && (
                  <div style={metaItemStyle}>
                    התחלה: <span style={metaValueStyle}>
                      {new Date(adSet.start_time).toLocaleDateString('he-IL')}
                    </span>
                  </div>
                )}
                {adSet.end_time && (
                  <div style={metaItemStyle}>
                    סיום: <span style={metaValueStyle}>
                      {new Date(adSet.end_time).toLocaleDateString('he-IL')}
                    </span>
                  </div>
                )}
              </div>

              <div style={actionsRowStyle}>
                <button
                  style={actionBtnStyle}
                  onClick={() => handleEdit(adSet)}
                >
                  ערוך
                </button>
                <button
                  style={toggleBtnStyle(isActive)}
                  onClick={() => handleToggleStatus(adSet)}
                  disabled={isToggling}
                >
                  {isToggling
                    ? '...'
                    : isActive
                    ? 'השהה'
                    : 'הפעל'}
                </button>
              </div>
            </div>
          );
        })
      )}

      {/* Builder Modal */}
      <AdSetBuilder
        isOpen={builderOpen}
        onClose={() => {
          setBuilderOpen(false);
          setEditingAdSet(null);
        }}
        adAccountId={adAccountId}
        accessToken={accessToken}
        campaignId={campaignId}
        editAdSet={editingAdSet}
        onSuccess={handleBuilderSuccess}
      />
    </div>
  );
}
