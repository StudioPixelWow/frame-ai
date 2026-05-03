'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';

// ==================== TYPES ====================
interface SeoPlan {
  id: string;
  clientId: string;
  clientName: string;
  websiteUrl: string;
  status: 'draft' | 'scanning' | 'goals_set' | 'visibility_done' | 'insights_ready' | 'plan_generated' | 'tasks_created' | 'active' | 'completed';
  overallScore: number;
  completedTasks: number;
  totalTasks: number;
  createdAt: string;
}

// ==================== COLORS & STYLES ====================
const COLORS = {
  primary: '#00B5FE',
  accent: '#E8F401',
  background: '#F7F9FC',
  card: '#FFFFFF',
  text: '#1A1A1A',
  textMuted: '#666666',
  border: '#E8E8E8',
  draft: '#999999',
  blue: '#0066FF',
  orange: '#FF9933',
  green: '#22C55E',
  emerald: '#10B981',
};

const statusBadgeColors: Record<string, { bg: string; text: string }> = {
  draft: { bg: '#F3F3F3', text: '#666666' },
  scanning: { bg: '#E3F2FD', text: '#0066FF' },
  goals_set: { bg: '#E3F2FD', text: '#0066FF' },
  visibility_done: { bg: '#E3F2FD', text: '#0066FF' },
  insights_ready: { bg: '#E3F2FD', text: '#0066FF' },
  plan_generated: { bg: '#FFF3E0', text: '#FF9933' },
  tasks_created: { bg: '#FFF3E0', text: '#FF9933' },
  active: { bg: '#E8F5E9', text: '#22C55E' },
  completed: { bg: '#E0F2F1', text: '#10B981' },
};

const statusLabels: Record<string, string> = {
  draft: 'טיוטה',
  scanning: 'סורק',
  goals_set: 'יעדים מוגדרים',
  visibility_done: 'נראות נסרקה',
  insights_ready: 'תובנות מוכנות',
  plan_generated: 'תוכנית נוצרה',
  tasks_created: 'משימות נוצרו',
  active: 'פעיל',
  completed: 'הושלם',
};

// ==================== HELPERS ====================
function getStatusBadgeColor(status: string): { bg: string; text: string } {
  return statusBadgeColors[status] || statusBadgeColors.draft;
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('he-IL', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

function scoreColor(score: number): string {
  if (score >= 80) return COLORS.green;
  if (score >= 60) return COLORS.blue;
  if (score >= 40) return COLORS.orange;
  return '#FF6B6B';
}

// ==================== MAIN COMPONENT ====================
export default function SeoGeoDashboard() {
  const [plans, setPlans] = useState<SeoPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch SEO plans on mount
  useEffect(() => {
    const fetchPlans = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/data/seo-plans', { cache: 'no-store' });
        if (!res.ok) throw new Error('Failed to fetch plans');
        const data = await res.json();
        setPlans(Array.isArray(data.plans) ? data.plans : []);
      } catch (err) {
        console.error('Error fetching plans:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setPlans([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPlans();
  }, []);

  // Calculate KPIs
  const kpis = useMemo(() => {
    const total = plans.length;
    const active = plans.filter((p) => p.status === 'active').length;
    const avgScore = plans.length > 0 ? Math.round(plans.reduce((sum, p) => sum + p.overallScore, 0) / plans.length) : 0;
    const completedTasks = plans.reduce((sum, p) => sum + p.completedTasks, 0);
    const totalTasks = plans.reduce((sum, p) => sum + p.totalTasks, 0);
    const completionRatio = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return { total, active, avgScore, completionRatio };
  }, [plans]);

  return (
    <div style={{ direction: 'rtl', padding: '32px', maxWidth: '1400px', margin: '0 auto', fontFamily: 'system-ui, -apple-system, sans-serif', backgroundColor: COLORS.background, minHeight: '100vh' }}>
      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .kpi-card {
          background: ${COLORS.card};
          border-radius: 20px;
          padding: 24px;
          box-shadow: 0 2px 12px rgba(0,0,0,0.06);
          animation: fade-in 0.4s ease both;
        }
        .plan-card {
          background: ${COLORS.card};
          border-radius: 20px;
          padding: 24px;
          box-shadow: 0 2px 12px rgba(0,0,0,0.06);
          border: 1px solid ${COLORS.border};
          transition: all 0.3s ease;
          animation: fade-in 0.4s ease both;
        }
        .plan-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 8px 24px rgba(0,0,0,0.1);
        }
        .score-circle {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 80px;
          height: 80px;
          border-radius: 50%;
          font-weight: 700;
          font-size: 24px;
        }
        .progress-bar {
          height: 8px;
          background: ${COLORS.border};
          border-radius: 4px;
          overflow: hidden;
          margin-top: 12px;
        }
        .progress-fill {
          height: 100%;
          border-radius: 4px;
          transition: width 0.6s cubic-bezier(0.4,0,0.2,1);
        }
        .status-badge {
          display: inline-block;
          padding: 6px 14px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 600;
        }
        .action-button {
          padding: 8px 16px;
          border-radius: 8px;
          border: none;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          text-decoration: none;
          display: inline-block;
        }
        .action-button-primary {
          background: ${COLORS.primary};
          color: white;
        }
        .action-button-primary:hover {
          opacity: 0.9;
        }
        .action-button-secondary {
          background: transparent;
          color: ${COLORS.primary};
          border: 1.5px solid ${COLORS.primary};
        }
        .action-button-secondary:hover {
          background: ${COLORS.primary}08;
        }
        .empty-state {
          text-align: center;
          padding: 60px 32px;
          color: ${COLORS.textMuted};
        }
        .empty-state-icon {
          font-size: 64px;
          margin-bottom: 16px;
        }
      `}</style>

      {/* ══════════ HEADER ══════════ */}
      <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: '700', color: COLORS.text, margin: '0 0 8px 0' }}>
            מרכז SEO/GEO
          </h1>
          <p style={{ fontSize: '14px', color: COLORS.textMuted, margin: 0 }}>
            סקירה כללית של כל תוכניות SEO וGEO שלך על פני כל הלקוחות
          </p>
        </div>
        <Link href="/seo-geo" style={{
          padding: '12px 24px',
          borderRadius: '12px',
          fontSize: '14px',
          fontWeight: '600',
          background: COLORS.primary,
          color: 'white',
          textDecoration: 'none',
          transition: 'all 0.2s ease',
          whiteSpace: 'nowrap',
        }}>
          תוכנית חדשה +
        </Link>
      </div>

      {/* ══════════ KPI CARDS ROW ══════════ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        <div className="kpi-card" style={{ animationDelay: '0s' }}>
          <div style={{ fontSize: '13px', color: COLORS.textMuted, fontWeight: '600', marginBottom: '12px' }}>
            סה"כ תוכניות
          </div>
          <div style={{ fontSize: '40px', fontWeight: '700', color: COLORS.primary }}>
            {kpis.total}
          </div>
        </div>

        <div className="kpi-card" style={{ animationDelay: '0.08s' }}>
          <div style={{ fontSize: '13px', color: COLORS.textMuted, fontWeight: '600', marginBottom: '12px' }}>
            תוכניות פעילות
          </div>
          <div style={{ fontSize: '40px', fontWeight: '700', color: COLORS.green }}>
            {kpis.active}
          </div>
        </div>

        <div className="kpi-card" style={{ animationDelay: '0.16s' }}>
          <div style={{ fontSize: '13px', color: COLORS.textMuted, fontWeight: '600', marginBottom: '12px' }}>
            ניקוד ממוצע
          </div>
          <div style={{ fontSize: '40px', fontWeight: '700', color: COLORS.blue }}>
            {kpis.avgScore}
          </div>
        </div>

        <div className="kpi-card" style={{ animationDelay: '0.24s' }}>
          <div style={{ fontSize: '13px', color: COLORS.textMuted, fontWeight: '600', marginBottom: '12px' }}>
            יחס משימות הושלמו
          </div>
          <div style={{ fontSize: '40px', fontWeight: '700', color: COLORS.accent }}>
            {kpis.completionRatio}%
          </div>
        </div>
      </div>

      {/* ══════════ PLANS LIST/GRID ══════════ */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 32px', color: COLORS.textMuted }}>
          טוען תוכניות...
        </div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: '60px 32px', color: '#FF6B6B' }}>
          שגיאה בטעינה: {error}
        </div>
      ) : plans.length === 0 ? (
        <div className="plan-card" style={{ textAlign: 'center' }}>
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <h3 style={{ fontSize: '20px', fontWeight: '600', color: COLORS.text, marginBottom: '8px' }}>
              אין תוכניות עדיין
            </h3>
            <p style={{ marginBottom: '24px' }}>
              צור את התוכנית הראשונה שלך כדי להתחיל
            </p>
            <Link href="/seo-geo" style={{
              display: 'inline-block',
              padding: '12px 24px',
              borderRadius: '12px',
              background: COLORS.primary,
              color: 'white',
              textDecoration: 'none',
              fontWeight: '600',
              fontSize: '14px',
            }}>
              צור תוכנית חדשה
            </Link>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '20px' }}>
          {plans.map((plan, idx) => {
            const badge = getStatusBadgeColor(plan.status);
            const taskProgress = plan.totalTasks > 0 ? Math.round((plan.completedTasks / plan.totalTasks) * 100) : 0;
            const scoreCol = scoreColor(plan.overallScore);

            return (
              <div key={plan.id} className="plan-card" style={{ animationDelay: `${idx * 0.08}s` }}>
                {/* Header: Client name + Status */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: '18px', fontWeight: '700', color: COLORS.text, margin: '0 0 4px 0' }}>
                      {plan.clientName}
                    </h3>
                    <p style={{ fontSize: '13px', color: COLORS.textMuted, margin: 0, wordBreak: 'break-all' }}>
                      {plan.websiteUrl}
                    </p>
                  </div>
                  <div className="status-badge" style={{ background: badge.bg, color: badge.text }}>
                    {statusLabels[plan.status] || plan.status}
                  </div>
                </div>

                {/* Score Circle */}
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
                  <div className="score-circle" style={{ background: `${scoreCol}15`, color: scoreCol }}>
                    {plan.overallScore}
                  </div>
                </div>

                {/* Progress Bar */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', color: COLORS.textMuted, fontWeight: '500' }}>
                      התקדמות משימות
                    </span>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: COLORS.text }}>
                      {plan.completedTasks}/{plan.totalTasks}
                    </span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{
                      width: `${taskProgress}%`,
                      background: taskProgress >= 75 ? COLORS.green : taskProgress >= 50 ? COLORS.blue : COLORS.orange,
                    }} />
                  </div>
                  <div style={{ fontSize: '12px', color: COLORS.textMuted, marginTop: '4px', textAlign: 'center' }}>
                    {taskProgress}%
                  </div>
                </div>

                {/* Created Date */}
                <div style={{ fontSize: '12px', color: COLORS.textMuted, marginTop: '12px', paddingTop: '12px', borderTop: `1px solid ${COLORS.border}` }}>
                  נוצר ב: {formatDate(plan.createdAt)}
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                  <Link href={`/seo-geo/dashboard/${plan.id}`} className="action-button action-button-primary" style={{ flex: 1, textAlign: 'center' }}>
                    צפה
                  </Link>
                  <button className="action-button action-button-secondary" style={{ flex: 1 }} onClick={() => {
                    // Placeholder for continue wizard
                    window.location.href = `/seo-geo/dashboard/${plan.id}`;
                  }}>
                    המשך
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
