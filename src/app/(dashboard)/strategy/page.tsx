"use client";

import { useState, useEffect, useCallback } from "react";

// ── Types ──

interface StrategySummary {
  clientId: string;
  clientName: string;
  headline: string;
  confidence: number;
  urgency: string;
  problemCount: number;
  opportunityCount: number;
  actionCount: number;
  topActions: string[];
  generatedAt: string;
  dataQuality: string;
}

interface StrategyFull {
  id: string;
  clientId: string;
  clientName: string;
  generatedAt: string;
  dataQuality: string;
  sections: Record<string, any>;
  decisions: any[];
  actionPlan: any[];
  overallConfidence: number;
  overallUrgency: string;
}

interface DashboardData {
  kpis: {
    totalStrategies: number;
    avgConfidence: number;
    totalDecisions: number;
    pendingActions: number;
    criticalCount: number;
  };
  summaries: StrategySummary[];
  strategies: StrategyFull[];
  topActions: any[];
  learning: {
    total: number;
    accepted: number;
    rejected: number;
    executed: number;
    acceptanceRate: number;
  };
}

// ── Display metadata ──

const URGENCY_META: Record<string, { label: string; color: string; icon: string }> = {
  critical: { label: "קריטי", color: "#DC2626", icon: "🔴" },
  high: { label: "גבוהה", color: "#F59E0B", icon: "🟠" },
  medium: { label: "בינונית", color: "#3B82F6", icon: "🔵" },
  low: { label: "נמוכה", color: "#6B7280", icon: "⚪" },
};

const SECTION_META: Record<string, { label: string; icon: string; color: string }> = {
  currentSituation: { label: "מצב נוכחי", icon: "📊", color: "#3B82F6" },
  keyProblems: { label: "בעיות מרכזיות", icon: "⚠️", color: "#EF4444" },
  opportunities: { label: "הזדמנויות", icon: "💡", color: "#10B981" },
  strategicDirection: { label: "כיוון אסטרטגי", icon: "🧭", color: "#8B5CF6" },
  recommendedActions: { label: "פעולות מומלצות", icon: "🎯", color: "#F59E0B" },
  expectedOutcomes: { label: "תוצאות צפויות", icon: "📈", color: "#14B8A6" },
};

const TABS = [
  { id: "overview", label: "סקירה כללית" },
  { id: "strategies", label: "אסטרטגיות" },
  { id: "actions", label: "תוכנית פעולה" },
  { id: "learning", label: "למידה" },
];

export default function StrategyPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [expandedStrategy, setExpandedStrategy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/data/strategy");
      if (res.ok) setData(await res.json());
    } catch (err) {
      console.error("Failed to load strategy data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/data/strategy/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ triggeredBy: "manual" }),
      });
      if (res.ok) await fetchData();
    } catch (err) {
      console.error("Generation failed:", err);
    } finally {
      setGenerating(false);
    }
  };

  const handleActionUpdate = async (strategyId: string, actionId: string, status: string) => {
    try {
      const res = await fetch("/api/data/strategy/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ strategyId, actionId, status }),
      });
      if (res.ok) await fetchData();
    } catch (err) {
      console.error("Action update failed:", err);
    }
  };

  if (loading) {
    return (
      <div dir="rtl" style={{ padding: 32, textAlign: "center", color: "#9CA3AF", paddingTop: 80 }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🧠</div>
        <div>טוען נתוני אסטרטגיה...</div>
      </div>
    );
  }

  const kpis = data?.kpis || { totalStrategies: 0, avgConfidence: 0, totalDecisions: 0, pendingActions: 0, criticalCount: 0 };

  return (
    <div dir="rtl" style={{ padding: "24px 32px", maxWidth: 1400, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: "#111827" }}>
            🧠 מוח אסטרטגי
          </h1>
          <p style={{ color: "#6B7280", margin: "4px 0 0", fontSize: 14 }}>
            מה לעשות עכשיו כדי לצמוח — החלטות מבוססות נתונים
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={handleGenerate}
            disabled={generating}
            style={{
              padding: "10px 20px",
              borderRadius: 8,
              border: "none",
              background: generating ? "#9CA3AF" : "#3B82F6",
              color: "#fff",
              fontSize: 14,
              fontWeight: 600,
              cursor: generating ? "not-allowed" : "pointer",
            }}
          >
            {generating ? "מייצר אסטרטגיה..." : "🧠 צור אסטרטגיה חדשה"}
          </button>
        </div>
      </div>

      {/* Safety banner */}
      <div style={{
        marginBottom: 20,
        padding: "10px 16px",
        borderRadius: 8,
        background: "rgba(34,197,94,0.06)",
        border: "1px solid rgba(34,197,94,0.15)",
        fontSize: 13,
        color: "#166534",
        textAlign: "center",
      }}>
        🔒 כל ההחלטות מבוססות נתונים אמיתיים. לא תבוצע פעולה ללא אישורך המפורש.
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16, marginBottom: 24 }}>
        <KPICard label="אסטרטגיות" value={kpis.totalStrategies} icon="📋" />
        <KPICard label="ביטחון ממוצע" value={`${kpis.avgConfidence}%`} icon="📈" />
        <KPICard label="החלטות" value={kpis.totalDecisions} icon="🧭" />
        <KPICard label="פעולות ממתינות" value={kpis.pendingActions} icon="🎯" />
        <KPICard label="קריטי" value={kpis.criticalCount} icon="🔴" color={kpis.criticalCount > 0 ? "#EF4444" : undefined} />
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 24, borderBottom: "1px solid #E5E7EB" }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: "10px 16px",
              border: "none",
              background: "none",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: activeTab === tab.id ? 600 : 400,
              color: activeTab === tab.id ? "#3B82F6" : "#6B7280",
              borderBottom: activeTab === tab.id ? "2px solid #3B82F6" : "2px solid transparent",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "overview" && (
        <OverviewTab
          data={data}
          onActionUpdate={handleActionUpdate}
        />
      )}
      {activeTab === "strategies" && (
        <StrategiesTab
          strategies={data?.strategies || []}
          expanded={expandedStrategy}
          onToggle={id => setExpandedStrategy(expandedStrategy === id ? null : id)}
        />
      )}
      {activeTab === "actions" && (
        <ActionsTab
          actions={data?.topActions || []}
          strategies={data?.strategies || []}
          onActionUpdate={handleActionUpdate}
        />
      )}
      {activeTab === "learning" && (
        <LearningTab learning={data?.learning} />
      )}

      {/* Empty state */}
      {(!data || kpis.totalStrategies === 0) && (
        <div style={{ textAlign: "center", padding: "64px 32px", color: "#9CA3AF" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🧠</div>
          <h3 style={{ margin: "0 0 8px", color: "#6B7280" }}>אין אסטרטגיות עדיין</h3>
          <p style={{ margin: 0, fontSize: 14 }}>
            לחצו על &quot;צור אסטרטגיה חדשה&quot; כדי לנתח את כל הלקוחות ולבנות תוכנית פעולה
          </p>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ──

function KPICard({ label, value, icon, color }: { label: string; value: string | number; icon: string; color?: string }) {
  return (
    <div style={{
      background: "#fff",
      border: "1px solid #E5E7EB",
      borderRadius: 12,
      padding: "16px 20px",
      textAlign: "center",
    }}>
      <div style={{ fontSize: 20, marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: color || "#111827" }}>{value}</div>
      <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>{label}</div>
    </div>
  );
}

function OverviewTab({ data, onActionUpdate }: { data: DashboardData | null; onActionUpdate: (sid: string, aid: string, s: string) => void }) {
  if (!data) return null;

  return (
    <div>
      {/* Client strategy cards */}
      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>📋 אסטרטגיות לקוח</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16, marginBottom: 32 }}>
        {data.summaries.map(s => {
          const urgency = URGENCY_META[s.urgency] || URGENCY_META.low;
          return (
            <div key={s.clientId} style={{
              background: "#fff",
              border: "1px solid #E5E7EB",
              borderRadius: 12,
              padding: 20,
              borderRight: `4px solid ${urgency.color}`,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontWeight: 600, fontSize: 15 }}>{s.clientName}</span>
                <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, background: `${urgency.color}15`, color: urgency.color, fontWeight: 600 }}>
                  {urgency.icon} {urgency.label}
                </span>
              </div>
              <div style={{ fontSize: 14, color: "#374151", fontWeight: 500, marginBottom: 8 }}>{s.headline}</div>
              <div style={{ display: "flex", gap: 12, fontSize: 12, color: "#6B7280", marginBottom: 8 }}>
                <span>ביטחון: {s.confidence}%</span>
                <span>בעיות: {s.problemCount}</span>
                <span>הזדמנויות: {s.opportunityCount}</span>
                <span>פעולות: {s.actionCount}</span>
              </div>
              {s.topActions.length > 0 && (
                <div style={{ fontSize: 12, color: "#374151" }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>פעולות עיקריות:</div>
                  {s.topActions.map((a, i) => (
                    <div key={i} style={{ padding: "3px 0", paddingRight: 8, borderRight: "2px solid #E5E7EB", marginBottom: 2 }}>
                      {a}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Top actions across all clients */}
      {data.topActions.length > 0 && (
        <>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>🎯 מה הכי חשוב לעשות עכשיו</h3>
          <ActionsList actions={data.topActions} strategies={data.strategies} onActionUpdate={onActionUpdate} />
        </>
      )}
    </div>
  );
}

function StrategiesTab({ strategies, expanded, onToggle }: { strategies: StrategyFull[]; expanded: string | null; onToggle: (id: string) => void }) {
  if (strategies.length === 0) {
    return <EmptyState icon="📋" text="אין אסטרטגיות עדיין" />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {strategies.map(s => {
        const isExpanded = expanded === s.id;
        const urgency = URGENCY_META[s.overallUrgency] || URGENCY_META.low;

        return (
          <div key={s.id} style={{
            background: "#fff",
            border: "1px solid #E5E7EB",
            borderRadius: 12,
            overflow: "hidden",
          }}>
            <button
              onClick={() => onToggle(s.id)}
              style={{
                width: "100%",
                padding: "16px 20px",
                border: "none",
                background: "none",
                cursor: "pointer",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                textAlign: "right",
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: 15, color: "#111827" }}>
                  {urgency.icon} {s.clientName}
                </div>
                <div style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>
                  {s.decisions.length} החלטות • {s.actionPlan.length} פעולות • ביטחון {s.overallConfidence}%
                  • {new Date(s.generatedAt).toLocaleDateString("he-IL")}
                </div>
              </div>
              <span style={{ fontSize: 18, color: "#9CA3AF" }}>{isExpanded ? "▲" : "▼"}</span>
            </button>

            {isExpanded && s.sections && (
              <div style={{ padding: "0 20px 20px" }}>
                {Object.entries(SECTION_META).map(([key, meta]) => {
                  const section = (s.sections as any)?.[key];
                  if (!section || !section.items || section.items.length === 0) return null;
                  return (
                    <div key={key} style={{ marginBottom: 16 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6, color: meta.color }}>
                        {meta.icon} {meta.label}
                      </div>
                      <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 6 }}>{section.summary}</div>
                      {section.items.map((item: any, i: number) => (
                        <div key={i} style={{
                          padding: "6px 10px",
                          background: "#F9FAFB",
                          borderRadius: 6,
                          marginBottom: 3,
                          fontSize: 13,
                          color: "#374151",
                          borderRight: `3px solid ${item.importance === 'high' ? '#EF4444' : item.importance === 'medium' ? '#F59E0B' : '#D1D5DB'}`,
                        }}>
                          {item.text}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ActionsTab({ actions, strategies, onActionUpdate }: { actions: any[]; strategies: StrategyFull[]; onActionUpdate: (sid: string, aid: string, s: string) => void }) {
  if (actions.length === 0) {
    return <EmptyState icon="🎯" text="אין פעולות ממתינות" />;
  }
  return <ActionsList actions={actions} strategies={strategies} onActionUpdate={onActionUpdate} />;
}

function ActionsList({ actions, strategies, onActionUpdate }: { actions: any[]; strategies: StrategyFull[]; onActionUpdate: (sid: string, aid: string, s: string) => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {actions.map((action: any, i: number) => {
        const strategy = strategies.find(s => s.actionPlan.some((a: any) => a.id === action.id));
        const strategyId = strategy?.id || '';
        const isProposed = action.status === 'proposed';

        return (
          <div key={action.id || i} style={{
            background: "#fff",
            border: "1px solid #E5E7EB",
            borderRadius: 10,
            padding: "12px 16px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: "#111827", marginBottom: 2 }}>
                {action.title}
              </div>
              <div style={{ fontSize: 12, color: "#6B7280" }}>
                {action.clientName && <span>👤 {action.clientName} • </span>}
                עדיפות {action.priority} • {action.estimatedTime || '—'}
              </div>
            </div>
            {isProposed && (
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={() => onActionUpdate(strategyId, action.id, 'approved')}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 6,
                    border: "none",
                    background: "#10B981",
                    color: "#fff",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  ✅ אשר
                </button>
                <button
                  onClick={() => onActionUpdate(strategyId, action.id, 'rejected')}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 6,
                    border: "1px solid #E5E7EB",
                    background: "#fff",
                    color: "#EF4444",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  ❌ דחה
                </button>
              </div>
            )}
            {!isProposed && (
              <span style={{
                fontSize: 11,
                padding: "3px 10px",
                borderRadius: 10,
                background: action.status === 'approved' ? '#D1FAE5' : action.status === 'executed' ? '#DBEAFE' : '#FEE2E2',
                color: action.status === 'approved' ? '#10B981' : action.status === 'executed' ? '#3B82F6' : '#EF4444',
                fontWeight: 600,
              }}>
                {action.status === 'approved' ? 'מאושר' : action.status === 'executed' ? 'בוצע' : 'נדחה'}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function LearningTab({ learning }: { learning?: DashboardData['learning'] }) {
  if (!learning || learning.total === 0) {
    return <EmptyState icon="📊" text="אין עדיין נתוני למידה. אשרו או דחו פעולות כדי לשפר אסטרטגיות עתידיות." />;
  }

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        <KPICard label="סה&quot;כ" value={learning.total} icon="📊" />
        <KPICard label="אושרו" value={learning.accepted} icon="✅" />
        <KPICard label="נדחו" value={learning.rejected} icon="❌" />
        <KPICard label="בוצעו" value={learning.executed} icon="🔵" />
      </div>
      <div style={{
        background: "#fff",
        border: "1px solid #E5E7EB",
        borderRadius: 12,
        padding: 20,
        textAlign: "center",
      }}>
        <div style={{ fontSize: 36, fontWeight: 700, color: learning.acceptanceRate > 60 ? "#10B981" : "#F59E0B" }}>
          {learning.acceptanceRate}%
        </div>
        <div style={{ fontSize: 14, color: "#6B7280" }}>שיעור קבלת החלטות</div>
        <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 4 }}>
          ככל שתאשרו או תדחו יותר החלטות, האסטרטגיה תשתפר
        </div>
      </div>
    </div>
  );
}

function EmptyState({ icon, text }: { icon: string; text: string }) {
  return (
    <div style={{ textAlign: "center", padding: 48, color: "#9CA3AF" }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>{icon}</div>
      <p style={{ margin: 0, fontSize: 14 }}>{text}</p>
    </div>
  );
}
