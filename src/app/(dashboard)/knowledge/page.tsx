"use client";

import { useState, useEffect, useCallback } from "react";

// ── Types ──

interface KnowledgeItem {
  id: string;
  type: string;
  industry: string;
  clientId: string | null;
  clientName: string | null;
  sourceType: string;
  title: string;
  summary: string;
  performanceMetrics: Record<string, number>;
  confidenceScore: number;
  decayScore: number;
  tags: string[];
  platform: string | null;
  updatedAt: string;
}

interface PlaybookData {
  playbook: {
    id: string;
    industry: string;
    topHooks: PlaybookEntry[];
    bestCTAs: PlaybookEntry[];
    winningContentAngles: PlaybookEntry[];
    bestPlatforms: PlaybookEntry[];
    audienceNotes: PlaybookEntry[];
    failurePatterns: PlaybookEntry[];
  };
  summary: {
    industry: string;
    totalEntries: number;
    avgConfidence: number;
    clientCount: number;
  };
}

interface PlaybookEntry {
  text: string;
  confidenceScore: number;
  evidenceCount: number;
}

interface DashboardData {
  kpis: {
    totalItems: number;
    avgConfidence: number;
    crossClientPatterns: number;
    industriesCovered: number;
    recentItems: number;
  };
  byType: Record<string, KnowledgeItem[]>;
  topItems: KnowledgeItem[];
  playbooks: any[];
}

// ── Display metadata ──

const TYPE_META: Record<string, { label: string; icon: string; color: string; bgColor: string }> = {
  hook: { label: "הוקים מנצחים", icon: "🪝", color: "#F59E0B", bgColor: "#FEF3C7" },
  cta: { label: "CTAs חזקים", icon: "🎯", color: "#10B981", bgColor: "#D1FAE5" },
  visual: { label: "תבניות ויזואליות", icon: "🎨", color: "#EC4899", bgColor: "#FCE7F3" },
  audience: { label: "קהלים מנצחים", icon: "👥", color: "#8B5CF6", bgColor: "#EDE9FE" },
  content_angle: { label: "זוויות תוכן", icon: "📐", color: "#6366F1", bgColor: "#E0E7FF" },
  platform: { label: "תובנות פלטפורמה", icon: "📊", color: "#3B82F6", bgColor: "#DBEAFE" },
  failure: { label: "תבניות כישלון", icon: "⚠️", color: "#EF4444", bgColor: "#FEE2E2" },
  pattern: { label: "תבניות חוצות-לקוחות", icon: "🔗", color: "#14B8A6", bgColor: "#CCFBF1" },
};

const TABS = [
  { id: "overview", label: "סקירה כללית" },
  { id: "hooks", label: "הוקים" },
  { id: "ctas", label: "CTAs" },
  { id: "audiences", label: "קהלים" },
  { id: "platforms", label: "פלטפורמות" },
  { id: "failures", label: "כישלונות" },
  { id: "patterns", label: "תבניות" },
  { id: "playbooks", label: "פלייבוקים" },
];

export default function KnowledgePage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [playbooks, setPlaybooks] = useState<PlaybookData[]>([]);
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const [filterIndustry, setFilterIndustry] = useState("");
  const [filterPlatform, setFilterPlatform] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const [dashRes, playbookRes] = await Promise.all([
        fetch("/api/data/knowledge"),
        fetch("/api/data/knowledge/playbooks"),
      ]);
      if (dashRes.ok) setData(await dashRes.json());
      if (playbookRes.ok) setPlaybooks(await playbookRes.json());
    } catch (err) {
      console.error("Failed to load knowledge data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleExtract = async () => {
    setExtracting(true);
    try {
      const res = await fetch("/api/data/knowledge/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ triggeredBy: "manual" }),
      });
      if (res.ok) {
        await fetchData();
      }
    } catch (err) {
      console.error("Extraction failed:", err);
    } finally {
      setExtracting(false);
    }
  };

  // ── Filters ──

  const allIndustries = data
    ? [...new Set(data.topItems.map(i => i.industry).filter(Boolean))]
    : [];

  const allPlatforms = data
    ? [...new Set(data.topItems.map(i => i.platform).filter(Boolean) as string[])]
    : [];

  const filterItems = (items: KnowledgeItem[]) => {
    let filtered = items;
    if (filterIndustry) filtered = filtered.filter(i => i.industry === filterIndustry);
    if (filterPlatform) filtered = filtered.filter(i => i.platform === filterPlatform);
    return filtered;
  };

  // ── Render ──

  if (loading) {
    return (
      <div dir="rtl" style={{ padding: 32 }}>
        <div style={{ textAlign: "center", color: "#9CA3AF", padding: 64 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🧠</div>
          <div>טוען בסיס ידע...</div>
        </div>
      </div>
    );
  }

  const kpis = data?.kpis || { totalItems: 0, avgConfidence: 0, crossClientPatterns: 0, industriesCovered: 0, recentItems: 0 };

  return (
    <div dir="rtl" style={{ padding: "24px 32px", maxWidth: 1400, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: "#111827" }}>
            🧠 בסיס ידע סוכנותי
          </h1>
          <p style={{ color: "#6B7280", margin: "4px 0 0", fontSize: 14 }}>
            ידע מצטבר מכל הלקוחות, הקמפיינים, והמודעות — מתעדכן אוטומטית
          </p>
        </div>
        <button
          onClick={handleExtract}
          disabled={extracting}
          style={{
            padding: "10px 20px",
            borderRadius: 8,
            border: "none",
            background: extracting ? "#9CA3AF" : "#3B82F6",
            color: "#fff",
            fontSize: 14,
            fontWeight: 600,
            cursor: extracting ? "not-allowed" : "pointer",
          }}
        >
          {extracting ? "מפיק ידע..." : "🔍 הפק ידע חדש"}
        </button>
      </div>

      {/* KPI strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16, marginBottom: 24 }}>
        <KPICard label="פריטי ידע" value={kpis.totalItems} icon="📚" />
        <KPICard label="ביטחון ממוצע" value={`${kpis.avgConfidence}%`} icon="📈" />
        <KPICard label="תבניות חוצות-לקוחות" value={kpis.crossClientPatterns} icon="🔗" />
        <KPICard label="תעשיות" value={kpis.industriesCovered} icon="🏭" />
        <KPICard label="נוסף ב-7 ימים" value={kpis.recentItems} icon="🆕" />
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <select
          value={filterIndustry}
          onChange={e => setFilterIndustry(e.target.value)}
          style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #D1D5DB", fontSize: 13 }}
        >
          <option value="">כל התעשיות</option>
          {allIndustries.map(ind => (
            <option key={ind} value={ind}>{ind}</option>
          ))}
        </select>
        <select
          value={filterPlatform}
          onChange={e => setFilterPlatform(e.target.value)}
          style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #D1D5DB", fontSize: 13 }}
        >
          <option value="">כל הפלטפורמות</option>
          {allPlatforms.map(p => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 24, borderBottom: "1px solid #E5E7EB", overflowX: "auto" }}>
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
              whiteSpace: "nowrap",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "overview" && <OverviewTab data={data} filterItems={filterItems} />}
      {activeTab === "hooks" && <TypeTab items={filterItems(data?.byType?.hook || [])} meta={TYPE_META.hook} />}
      {activeTab === "ctas" && <TypeTab items={filterItems(data?.byType?.cta || [])} meta={TYPE_META.cta} />}
      {activeTab === "audiences" && <TypeTab items={filterItems(data?.byType?.audience || [])} meta={TYPE_META.audience} />}
      {activeTab === "platforms" && <TypeTab items={filterItems(data?.byType?.platform || [])} meta={TYPE_META.platform} />}
      {activeTab === "failures" && <TypeTab items={filterItems(data?.byType?.failure || [])} meta={TYPE_META.failure} />}
      {activeTab === "patterns" && <TypeTab items={filterItems(data?.byType?.pattern || [])} meta={TYPE_META.pattern} />}
      {activeTab === "playbooks" && <PlaybooksTab playbooks={playbooks} />}

      {/* Empty state */}
      {!data || kpis.totalItems === 0 ? (
        <div style={{ textAlign: "center", padding: "64px 32px", color: "#9CA3AF" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🧠</div>
          <h3 style={{ margin: "0 0 8px", color: "#6B7280" }}>בסיס הידע ריק</h3>
          <p style={{ margin: 0, fontSize: 14 }}>
            לחצו על &quot;הפק ידע חדש&quot; כדי לנתח את כל הנתונים ולהפיק תובנות
          </p>
        </div>
      ) : null}
    </div>
  );
}

// ── Sub-components ──

function KPICard({ label, value, icon }: { label: string; value: string | number; icon: string }) {
  return (
    <div style={{
      background: "#fff",
      border: "1px solid #E5E7EB",
      borderRadius: 12,
      padding: "16px 20px",
      textAlign: "center",
    }}>
      <div style={{ fontSize: 20, marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: "#111827" }}>{value}</div>
      <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>{label}</div>
    </div>
  );
}

function OverviewTab({ data, filterItems }: { data: DashboardData | null; filterItems: (items: KnowledgeItem[]) => KnowledgeItem[] }) {
  if (!data) return null;

  return (
    <div>
      {/* Type summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16, marginBottom: 32 }}>
        {Object.entries(TYPE_META).map(([type, meta]) => {
          const items = filterItems(data.byType?.[type] || []);
          if (items.length === 0) return null;
          const topItem = items[0];
          return (
            <div
              key={type}
              style={{
                background: "#fff",
                border: "1px solid #E5E7EB",
                borderRadius: 12,
                padding: 20,
                borderRight: `4px solid ${meta.color}`,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>
                  {meta.icon} {meta.label}
                </div>
                <span style={{
                  padding: "2px 8px",
                  borderRadius: 12,
                  background: meta.bgColor,
                  color: meta.color,
                  fontSize: 12,
                  fontWeight: 600,
                }}>
                  {items.length}
                </span>
              </div>
              {topItem && (
                <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.5 }}>
                  {topItem.summary.substring(0, 120)}
                  {topItem.summary.length > 120 ? "..." : ""}
                </div>
              )}
              {topItem && (
                <div style={{ marginTop: 8, display: "flex", gap: 8, fontSize: 11, color: "#9CA3AF" }}>
                  <span>ביטחון: {topItem.confidenceScore}%</span>
                  {topItem.clientName && <span>• {topItem.clientName}</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Top items */}
      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: "#111827" }}>
        🏆 פריטי הידע החזקים ביותר
      </h3>
      <ItemsList items={filterItems(data.topItems)} />
    </div>
  );
}

function TypeTab({ items, meta }: { items: KnowledgeItem[]; meta: { label: string; icon: string; color: string; bgColor: string } }) {
  if (items.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: 48, color: "#9CA3AF" }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>{meta.icon}</div>
        <p>אין עדיין פריטי ידע מסוג {meta.label}</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <span style={{ fontSize: 20 }}>{meta.icon}</span>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{meta.label}</h3>
        <span style={{
          padding: "2px 10px",
          borderRadius: 12,
          background: meta.bgColor,
          color: meta.color,
          fontSize: 12,
          fontWeight: 600,
        }}>
          {items.length}
        </span>
      </div>
      <ItemsList items={items} />
    </div>
  );
}

function ItemsList({ items }: { items: KnowledgeItem[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {items.map(item => {
        const meta = TYPE_META[item.type] || TYPE_META.pattern;
        const decay = item.decayScore || 0;
        const effective = Math.max(0, item.confidenceScore - decay);

        return (
          <div
            key={item.id}
            style={{
              background: "#fff",
              border: "1px solid #E5E7EB",
              borderRadius: 10,
              padding: "14px 18px",
              borderRight: `3px solid ${meta.color}`,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: "#111827" }}>
                {meta.icon} {item.title}
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "center" }}>
                <ConfidenceBadge score={effective} />
                {decay > 20 && (
                  <span style={{ fontSize: 11, color: "#F59E0B" }}>
                    {decay > 50 ? "🟡 מתיישן" : "🔵 עדכני"}
                  </span>
                )}
              </div>
            </div>
            <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.5, marginBottom: 6 }}>
              {item.summary}
            </div>
            <div style={{ display: "flex", gap: 10, fontSize: 11, color: "#9CA3AF", flexWrap: "wrap" }}>
              {item.clientName && <span>👤 {item.clientName}</span>}
              {item.industry && <span>🏭 {item.industry}</span>}
              {item.platform && <span>📱 {item.platform}</span>}
              <span>🕐 {new Date(item.updatedAt).toLocaleDateString("he-IL")}</span>
              {item.tags.slice(0, 3).map(tag => (
                <span key={tag} style={{
                  padding: "1px 6px",
                  borderRadius: 4,
                  background: "#F3F4F6",
                  fontSize: 10,
                }}>
                  {tag}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ConfidenceBadge({ score }: { score: number }) {
  let color = "#6B7280";
  if (score >= 80) color = "#10B981";
  else if (score >= 60) color = "#3B82F6";
  else if (score >= 40) color = "#F59E0B";
  else if (score >= 20) color = "#EF4444";

  return (
    <span style={{
      padding: "2px 8px",
      borderRadius: 10,
      background: `${color}15`,
      color,
      fontSize: 11,
      fontWeight: 600,
    }}>
      {score}%
    </span>
  );
}

function PlaybooksTab({ playbooks }: { playbooks: PlaybookData[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (playbooks.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: 48, color: "#9CA3AF" }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>📖</div>
        <p>אין עדיין פלייבוקים. הפיקו ידע כדי ליצור פלייבוק אוטומטי לכל תעשייה.</p>
      </div>
    );
  }

  const SECTION_META: Record<string, { label: string; icon: string }> = {
    topHooks: { label: "הוקים מנצחים", icon: "🪝" },
    bestCTAs: { label: "CTAs חזקים", icon: "🎯" },
    winningContentAngles: { label: "זוויות תוכן", icon: "📐" },
    bestPlatforms: { label: "פלטפורמות", icon: "📊" },
    audienceNotes: { label: "קהלים", icon: "👥" },
    failurePatterns: { label: "תבניות כישלון", icon: "⚠️" },
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {playbooks.map(({ playbook, summary }) => {
        const isExpanded = expanded === playbook.industry;
        return (
          <div
            key={playbook.industry}
            style={{
              background: "#fff",
              border: "1px solid #E5E7EB",
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            <button
              onClick={() => setExpanded(isExpanded ? null : playbook.industry)}
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
                  📖 פלייבוק: {playbook.industry}
                </div>
                <div style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>
                  {summary.totalEntries} פריטים • {summary.clientCount} לקוחות • ביטחון ממוצע {summary.avgConfidence}%
                </div>
              </div>
              <span style={{ fontSize: 18, color: "#9CA3AF" }}>
                {isExpanded ? "▲" : "▼"}
              </span>
            </button>

            {isExpanded && (
              <div style={{ padding: "0 20px 20px" }}>
                {Object.entries(SECTION_META).map(([key, meta]) => {
                  const entries = (playbook as any)[key] as PlaybookEntry[] | undefined;
                  if (!entries || entries.length === 0) return null;
                  return (
                    <div key={key} style={{ marginBottom: 16 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6, color: "#374151" }}>
                        {meta.icon} {meta.label}
                      </div>
                      {entries.map((entry, i) => (
                        <div
                          key={i}
                          style={{
                            padding: "8px 12px",
                            background: "#F9FAFB",
                            borderRadius: 6,
                            marginBottom: 4,
                            fontSize: 13,
                            color: "#374151",
                            display: "flex",
                            justifyContent: "space-between",
                          }}
                        >
                          <span>{entry.text}</span>
                          <span style={{ color: "#9CA3AF", fontSize: 11, flexShrink: 0, marginRight: 12 }}>
                            {entry.confidenceScore}% • {entry.evidenceCount} ראיות
                          </span>
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
