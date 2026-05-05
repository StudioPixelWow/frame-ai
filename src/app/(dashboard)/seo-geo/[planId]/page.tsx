"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";

// ══════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════

interface ScanResult {
  url: string; scannedAt: string; hasSSL: boolean; loadTimeMs: number;
  mobileOptimized: boolean; metaTitle: string; metaDescription: string;
  h1Tags: string[]; h2Tags?: string[]; totalPages: number; indexedPages: number; brokenLinks: number;
  hasRobotsTxt: boolean; hasSitemap: boolean; domainAuthority: number;
  structuredData: boolean; openGraph: boolean; canonicalTags: boolean;
  issues: { type: string; category: string; title: string; description: string; impact: string }[];
  // Fields from scan pipeline
  scanType?: string;
  scan_mode?: string;
  scannedPages?: any[];
  aiQueries?: any[];
  platformStatuses?: Record<string, any>;
  websiteFacts?: Record<string, any>;
  metrics?: Record<string, any>;
  scanDuration?: number;
  schemaTypes?: string[];
  techStack?: string[];
  cmsDetected?: string | null;
}

interface Goal {
  id: string; type: string; label: string; icon: string;
  selected: boolean; targetMetric: string; currentValue: number; targetValue: number; priority: string;
}

interface VisibilityQuery { id: string; query: string; category: string; intent: string; importance: string; }
interface VisibilityEngineResult { engine: string; mentioned: boolean; position: number | null; sentiment: string; }
interface VisibilityResult { queryId: string; query: string; results: VisibilityEngineResult[]; }
interface Insight { id: string; category: string; title: string; description: string; impact: string; action: string; }

interface PlanTask {
  id: string; title: string; category: string; priority: string;
  estimatedHours: number; deliverable: string; kpiTarget: string;
  status?: "todo" | "in_progress" | "waiting" | "done";
  description?: string; reason?: string; expectedOutcome?: string;
  contentBrief?: string; effortHours?: number; relatedPageUrl?: string;
  impactLevel?: string;
}

interface PlanWeek {
  weekNumber: number; startDate: string; endDate: string;
  theme: string; focus: string; tasks: PlanTask[];
}

interface PlanPhase {
  number: number; name: string; days: [number, number]; focus: string; tasks: PlanTask[];
}

interface PlanDay {
  day: number; date: string; phase: number; phaseNumber?: number; theme: string; focusTitle?: string; tasks: PlanTask[];
}

interface SeoPlan {
  id: string; clientId: string; clientName: string; websiteUrl: string; status: string;
  overallScore: number; technicalScore: number; contentScore: number; visibilityScore: number;
  totalTasks: number; completedTasks: number;
  createdAt: string; updatedAt: string; generatedAt: string | null;
  websiteScan: ScanResult | null;
  goals: Goal[];
  visibilityQueries: VisibilityQuery[];
  visibilityResults: VisibilityResult[];
  insights: Insight[];
  weeks?: PlanWeek[]; // fallback for backward compatibility
  phases?: PlanPhase[]; // new structure
  days?: PlanDay[]; // flat list of days
}

// ══════════════════════════════════════════════════════════════
// CONSTANTS
// ══════════════════════════════════════════════════════════════

const C = {
  primary: "#00B5FE", primaryDark: "#0095D0", primaryLight: "#E6F7FF",
  accent: "#E8F401", accentDark: "#C8D400",
  bg: "#F7F9FC", card: "#FFFFFF",
  text: "#1A1A2E", textSecondary: "#5A5A7A", textMuted: "#9A9AB0",
  border: "#E8EAF0", borderLight: "#F0F2F5",
  success: "#10B981", warning: "#F59E0B", danger: "#EF4444", info: "#3B82F6",
  neon: "#e9fe00", neonEnd: "#d3e200",
};

const AI_ENGINES = ["ChatGPT", "Gemini", "Perplexity", "Claude", "Copilot"];

const PLATFORM_DISPLAY: Record<string, { name: string; icon: string }> = {
  google_seo: { name: "Google SEO", icon: "🔍" },
  google_ai_overview: { name: "AI Overview", icon: "✨" },
  gemini: { name: "Gemini", icon: "💎" },
  chatgpt: { name: "ChatGPT", icon: "🤖" },
  claude: { name: "Claude", icon: "🧠" },
  perplexity: { name: "Perplexity", icon: "🔮" },
};

const AI_PLATFORM_IDS = ["chatgpt", "gemini", "perplexity", "claude", "google_ai_overview"] as const;

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  draft: { label: "טיוטה", color: "#6B7280" },
  scanning: { label: "בסריקה", color: C.info },
  goals_set: { label: "יעדים הוגדרו", color: C.warning },
  visibility_done: { label: "נראות הושלמה", color: C.primary },
  insights_ready: { label: "תובנות מוכנות", color: C.neonEnd },
  plan_generated: { label: "תוכנית מוכנה", color: C.success },
  tasks_created: { label: "משימות נוצרו", color: C.success },
  active: { label: "פעיל", color: C.success },
  completed: { label: "הושלם", color: C.primary },
};

type TabId = "overview" | "plan" | "tasks" | "ai" | "results" | "competitors" | "gaps" | "keywords" | "reports";

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: "overview", label: "סקירה", icon: "📊" },
  { id: "plan", label: "תוכנית 60 יום", icon: "📅" },
  { id: "tasks", label: "משימות", icon: "✅" },
  { id: "ai", label: "תוצאות AI", icon: "🤖" },
  { id: "results", label: "תוצאות נראות", icon: "🔎" },
  { id: "competitors", label: "מתחרים", icon: "🏆" },
  { id: "gaps", label: "פערי תוכן", icon: "📝" },
  { id: "keywords", label: "ביטויי SEO", icon: "🔑" },
  { id: "reports", label: "דוחות", icon: "📄" },
];

const KANBAN_COLS: { id: PlanTask["status"]; label: string; color: string; icon: string }[] = [
  { id: "todo", label: "לביצוע", color: C.textMuted, icon: "○" },
  { id: "in_progress", label: "בעבודה", color: C.primary, icon: "◉" },
  { id: "waiting", label: "ממתין ללקוח", color: C.warning, icon: "⏳" },
  { id: "done", label: "הושלם", color: C.success, icon: "✓" },
];

function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  try {
    const date = new Date(typeof d === 'object' ? String(d) : d);
    if (isNaN(date.getTime())) return "—";
    const m = ["ינו","פבר","מרץ","אפר","מאי","יונ","יול","אוג","ספט","אוק","נוב","דצמ"];
    return `${date.getDate()} ${m[date.getMonth()]} ${date.getFullYear()}`;
  } catch { return "—"; }
}

/**
 * Safely convert any value to a React-renderable string.
 * Objects/arrays are converted to a summary string instead of crashing React.
 */
function s(val: unknown): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  if (val instanceof Date) return val.toISOString();
  if (typeof val === 'object') {
    if ('value' in (val as any)) return String((val as any).value ?? '');
    if ('label' in (val as any)) return String((val as any).label ?? '');
    if ('name' in (val as any)) return String((val as any).name ?? '');
    return JSON.stringify(val);
  }
  return String(val);
}

/** Force any value to a number. Objects get 0. */
function n(val: unknown): number {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') return Number(val) || 0;
  if (val !== null && val !== undefined && typeof val === 'object') {
    if ('value' in (val as any)) return Number((val as any).value) || 0;
    return 0;
  }
  return Number(val) || 0;
}

/**
 * Recursive sanitization: walk the entire object tree and flatten evidence patterns.
 * No whitelist. Recurses into every key on every object.
 * Evidence patterns {value, confidence?, source?} are flattened to their primitive value.
 * After recursion into plain objects, the object itself is returned (needed for data structure).
 * Arrays are always recursed.
 * Primitives and Dates are returned as-is (or as strings for Dates).
 */
function nuke(val: any, depth: number): any {
  if (depth > 50) return typeof val === 'string' ? val : JSON.stringify(val ?? '');
  if (val === null || val === undefined) return val;
  if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') return val;
  if (val instanceof Date) return val.toISOString();

  // Arrays: always recurse into each element
  if (Array.isArray(val)) return val.map((item) => nuke(item, depth + 1));

  // Plain object: check for evidence pattern first
  if (typeof val === 'object') {
    // Evidence pattern shortcut: {value, confidence?, source?}
    if ('value' in val && ('confidence' in val || 'source' in val)) {
      const extracted = val.value;
      return (extracted !== null && extracted !== undefined && typeof extracted === 'object')
        ? JSON.stringify(extracted) : extracted;
    }

    // NOT an evidence pattern: recurse into every key, then return the recursed object
    const out: any = {};
    for (const [k, v] of Object.entries(val)) {
      out[k] = nuke(v, depth + 1);
    }
    return out;
  }

  return String(val);
}

// ══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════

export default function SeoPlanDetail() {
  const { planId } = useParams<{ planId: string }>();
  const router = useRouter();
  const [plan, setPlan] = useState<SeoPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set([1]));
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [drawerQuery, setDrawerQuery] = useState<VisibilityResult | null>(null);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [generatingPlan, setGeneratingPlan] = useState(false);
  const [reports, setReports] = useState<Array<{ id: string; name: string; generatedAt: string; type: string }>>([]);
  const [expandedKeyword, setExpandedKeyword] = useState<string | null>(null);

  // Fetch plan
  useEffect(() => {
    if (!planId) return;
    (async () => {
      try {
        const res = await fetch(`/api/data/seo-plans/${planId}`);
        if (res.ok) {
          const data = await res.json();

          // Normalize task statuses in weeks/phases
          if (data.weeks) {
            data.weeks = (Array.isArray(data.weeks) ? data.weeks : []).map((w: PlanWeek) => ({
              ...w,
              tasks: (Array.isArray(w?.tasks) ? w.tasks : []).map((t: PlanTask) => ({ ...t, status: t.status || "todo" })),
            }));
          }

          // Sanitize: single pass through entire object tree
          const sanitized = nuke(data, 0);
          setPlan(sanitized as SeoPlan);
        }
      } catch (e) {
        console.error("Failed to load plan:", e);
      }
      setLoading(false);
    })();
  }, [planId]);

  // All tasks flattened (supports both weeks and days/phases)
  const allTasks = useMemo(() => {
    if (!plan) return [];

    // If plan has days structure
    if (plan.days) {
      return plan.days.flatMap(d => d.tasks.map(t => ({ ...t, dayNumber: d.day, phaseNumber: d.phaseNumber, dayTheme: d.focusTitle })));
    }

    // Fallback to weeks structure
    if (plan.weeks) {
      return plan.weeks.flatMap(w => w.tasks.map(t => ({ ...t, weekNumber: w.weekNumber, weekTheme: w.theme })));
    }

    return [];
  }, [plan?.days, plan?.weeks]);

  // Update task status
  const updateTaskStatus = useCallback(async (taskId: string, newStatus: PlanTask["status"]) => {
    if (!plan) return;
    const updatedWeeks = (Array.isArray(plan.weeks) ? plan.weeks : []).map(w => ({
      ...w,
      tasks: w.tasks.map(t => t.id === taskId ? { ...t, status: newStatus } : t),
    }));
    const completedCount = updatedWeeks.flatMap(w => w.tasks).filter(t => t.status === "done").length;
    const updatedPlan = { ...plan, weeks: updatedWeeks, completedTasks: completedCount };
    setPlan(updatedPlan);

    try {
      await fetch(`/api/data/seo-plans/${plan.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weeks: updatedWeeks, completedTasks: completedCount }),
      });
    } catch (e) {
      console.error("Failed to update task:", e);
    }
  }, [plan]);

  // Load reports from plan data (sanitize to prevent #310)
  useEffect(() => {
    if (plan && (plan as any).reports) {
      const raw = (plan as any).reports;
      const safe = (Array.isArray(raw) ? raw : []).map((r: any) => ({
        id: String(r?.id ?? ''),
        name: String(r?.name ?? r?.value?.name ?? ''),
        generatedAt: String(r?.generatedAt ?? r?.value?.generatedAt ?? ''),
        type: String(r?.type ?? r?.value?.type ?? ''),
      }));
      setReports(safe);
    }
  }, [plan]);

  // Generate report and navigate to viewer
  const handleGenerateReport = useCallback(async () => {
    if (!plan) return;
    setGeneratingReport(true);
    try {
      const res = await fetch("/api/seo/generate-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan.id, language: "he" }),
      });
      if (res.ok) {
        const report = await res.json();
        // Update local reports list
        setReports(prev => [...prev, {
          id: report.id,
          name: `דוח PIXEL SEO/GEO — ${plan.clientName || "ללא שם"}`,
          generatedAt: report.generatedAt,
          type: "full",
        }]);
        // Navigate to report viewer
        router.push(`/seo-geo/${plan.id}/report?lang=he`);
      }
    } catch (e) {
      console.error("Failed to generate report:", e);
    }
    setGeneratingReport(false);
  }, [plan, router]);

  // Generate 60-day plan
  const handleGenerate60DayPlan = useCallback(async () => {
    if (!plan) return;
    setGeneratingPlan(true);
    try {
      const res = await fetch(`/api/seo-geo-plans/${plan.id}/generate-60-day-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        const data = await res.json();
        // Refresh plan data
        const refreshRes = await fetch(`/api/data/seo-plans/${plan.id}`);
        if (refreshRes.ok) {
          const refreshed = await refreshRes.json();
          if (refreshed.weeks) {
            refreshed.weeks = refreshed.weeks.map((w: any) => ({
              ...w,
              tasks: w.tasks.map((t: any) => ({ ...t, status: t.status || "todo" })),
            }));
          }
          // Add status defaults to days/tasks from 60-day plan
          if (refreshed.days) {
            refreshed.days = refreshed.days.map((d: any) => ({
              ...d,
              tasks: (d.tasks || []).map((t: any) => ({ ...t, status: t.status || "todo" })),
            }));
          }
          const sanitized = nuke(refreshed, 0);
          setPlan(sanitized as SeoPlan);
          setActiveTab("plan");
        }
      } else {
        console.error("Failed to generate 60-day plan:", await res.text());
      }
    } catch (e) {
      console.error("Failed to generate 60-day plan:", e);
    }
    setGeneratingPlan(false);
  }, [plan]);

  // ── PRE-RENDER SAFETY: ensure plan is fully sanitized (no objects as children) ──
  // CRITICAL: These useMemo hooks MUST be before any conditional returns (Rules of Hooks)
  const safePlan = useMemo(() => {
    if (!plan) return null;
    return nuke(plan, 0) as SeoPlan;
  }, [plan]);

  // ── Compute scores from websiteScan data (plan fields are often 0) ──
  const computedScores = useMemo(() => {
    if (!safePlan) return { technical: 0, visibility: 0, overall: 0 };
    const scan = safePlan.websiteScan;
    if (!scan) return { technical: n(safePlan.technicalScore), visibility: n(safePlan.visibilityScore), overall: n(safePlan.overallScore) };

    // Technical score: based on scan findings
    let tech = 50; // base
    if (scan.hasSSL === true) tech += 10;
    if (scan.mobileOptimized === true) tech += 10;
    if (scan.hasRobotsTxt === true) tech += 5;
    if (scan.hasSitemap === true) tech += 5;
    if (scan.structuredData === true) tech += 5;
    if (typeof scan.metaTitle === 'string' && scan.metaTitle) tech += 5;
    if (typeof scan.metaDescription === 'string' && scan.metaDescription) tech += 5;
    if (typeof scan.loadTimeMs === 'number' && scan.loadTimeMs < 3000) tech += 5;
    const issueCount = Array.isArray(scan.issues) ? scan.issues.length : 0;
    tech = Math.max(0, Math.min(100, tech - issueCount * 3));

    // Visibility score: based on AI queries
    const aiQueries = Array.isArray(scan.aiQueries) ? scan.aiQueries : [];
    const found = aiQueries.filter((q: any) => q.found === true).length;
    const vis = aiQueries.length > 0 ? Math.round((found / aiQueries.length) * 100) : n(safePlan.visibilityScore);

    // Overall = weighted average
    const overall = Math.round(tech * 0.4 + vis * 0.6);

    return {
      technical: n(safePlan.technicalScore) || tech,
      visibility: n(safePlan.visibilityScore) || vis,
      overall: n(safePlan.overallScore) || overall,
    };
  }, [safePlan]);

  // ── Auto-generate goals from scan data ──
  const autoGoals = useMemo(() => {
    if (!safePlan) return [];
    if (Array.isArray(safePlan.goals) && safePlan.goals.length > 0) return safePlan.goals;
    const scan = safePlan.websiteScan;
    if (!scan) return [];
    const goals: any[] = [];
    if (scan.loadTimeMs > 3000) goals.push({ id: 'g1', type: 'technical', label: `שיפור מהירות טעינה מ-${(scan.loadTimeMs/1000).toFixed(1)}s ל-2s`, targetMetric: 'loadTimeMs', currentValue: scan.loadTimeMs, targetValue: 2000, priority: 'high', icon: '⚡', selected: true });
    if (!scan.mobileOptimized) goals.push({ id: 'g2', type: 'technical', label: 'אופטימיזציה לניידים — עבור Mobile-Friendly Test', targetMetric: 'mobileOptimized', currentValue: 0, targetValue: 1, priority: 'high', icon: '📱', selected: true });
    const aiQueries = scan.aiQueries || [];
    const found = aiQueries.filter((q: any) => q.found).length;
    const total = aiQueries.length || 1;
    goals.push({ id: 'g3', type: 'visibility', label: `שיפור נראות AI מ-${Math.round(found/total*100)}% ל-60%+`, targetMetric: 'ai_visibility', currentValue: Math.round(found/total*100), targetValue: 60, priority: 'high', icon: '🤖', selected: true });
    goals.push({ id: 'g4', type: 'seo', label: 'הגעה לעמוד 1 בגוגל ב-5 ביטויים ליבה', targetMetric: 'top10_keywords', currentValue: 0, targetValue: 5, priority: 'high', icon: '🎯', selected: true });
    const pages = safePlan.websiteScan?.scannedPages || [];
    const thinPages = pages.filter((pg: any) => pg.wordCount < 300).length;
    if (thinPages > 0) goals.push({ id: 'g5', type: 'content', label: `שדרוג ${thinPages} עמודים עם תוכן תשוש (מתחת ל-300 מילים)`, targetMetric: 'thin_pages', currentValue: thinPages, targetValue: 0, priority: 'medium', icon: '📝', selected: true });
    if (!scan.structuredData) goals.push({ id: 'g6', type: 'technical', label: 'יישום Schema.org — LocalBusiness + FAQ + Service', targetMetric: 'schema', currentValue: 0, targetValue: 1, priority: 'high', icon: '📋', selected: true });
    if (!scan.hasSSL) goals.push({ id: 'g7', type: 'technical', label: 'התקנת SSL — HTTPS מלא', targetMetric: 'ssl', currentValue: 0, targetValue: 1, priority: 'critical', icon: '🔒', selected: true });
    if (scan.domainAuthority < 25) goals.push({ id: 'g8', type: 'authority', label: `העלאת Domain Authority מ-${scan.domainAuthority} ל-25+`, targetMetric: 'da', currentValue: scan.domainAuthority, targetValue: 25, priority: 'medium', icon: '📈', selected: true });
    return goals;
  }, [safePlan]);

  // ── Auto-generate insights from scan data ──
  const autoInsights = useMemo(() => {
    if (!safePlan) return [];
    if (Array.isArray(safePlan.insights) && safePlan.insights.length > 0) return safePlan.insights;
    const scan = safePlan.websiteScan;
    if (!scan) return [];
    const insights: any[] = [];
    if (!scan.structuredData) insights.push({ id: 'i1', category: 'opportunity', title: 'Schema.org חסר — הזדמנות לתוצאות עשירות', description: 'הוספת LocalBusiness, FAQ, Service Schema תגביר הזדמנויות להופיע ב-Rich Results וב-AI', impact: 'high', action: 'יישום Schema JSON-LD בכל עמוד' });
    const aiQueries = scan.aiQueries || [];
    const missed = aiQueries.filter((q: any) => !q.found);
    if (missed.length > 0) insights.push({ id: 'i2', category: 'threat', title: `${missed.length} שאילתות AI בהן העסק לא מוזכר`, description: `מנועי AI לא מזכירים את העסק ב-${missed.length} שאילתות רלוונטיות — מתחרים מקבלים את התנועה`, impact: 'high', action: 'יצירת תוכן ממוקד לכל שאילתה חסרה' });
    if (scan.hasSSL) insights.push({ id: 'i3', category: 'strength', title: 'HTTPS מאובטח — בסיס טכני טוב', description: 'האתר מאובטח עם SSL — Google מעריך זאת כגורם דירוג', impact: 'low', action: 'לשמור על תוקף תעודת SSL' });
    if (scan.hasSitemap) insights.push({ id: 'i4', category: 'strength', title: 'Sitemap קיים — Google יכול לזחול בקלות', description: 'Sitemap.xml קיים ומאפשר לגוגל למצוא את כל העמודים', impact: 'low', action: 'לעדכן Sitemap אחרי כל שינוי' });
    if (scan.loadTimeMs > 3000) insights.push({ id: 'i5', category: 'weakness', title: `אתר איטי — ${(scan.loadTimeMs/1000).toFixed(1)} שניות טעינה`, description: 'זמן טעינה מעל 3 שניות גורם לנטישה גבוהה ופוגע בדירוג', impact: 'high', action: 'דחיסת תמונות, Lazy Loading, minify CSS/JS' });
    if (!scan.mobileOptimized) insights.push({ id: 'i6', category: 'weakness', title: 'אתר לא מותאם לניידים', description: '60%+ מהחיפושים מגיעים מנייד — אתר לא responsive = דירוג נמוך', impact: 'critical', action: 'עיצוב responsive או AMP' });
    if (scan.brokenLinks > 0) insights.push({ id: 'i7', category: 'weakness', title: `${scan.brokenLinks} קישורים שבורים`, description: 'קישורים שבורים פוגעים בחוויית משתמש וב-crawl budget', impact: 'medium', action: 'סריקה ותיקון כל קישור שבור' });
    const found = aiQueries.filter((q: any) => q.found);
    if (found.length > 0) insights.push({ id: 'i8', category: 'strength', title: `מוזכר ב-${found.length} שאילתות AI`, description: `העסק כבר מופיע ב-${found.length} תוצאות AI — בסיס טוב לחיזוק`, impact: 'medium', action: 'חיזוק נוכחות בשאילתות קיימות + הרחבה לחדשות' });
    return insights;
  }, [safePlan]);

  // ── Auto-generate SEO keywords from scan data ──
  const autoKeywords = useMemo(() => {
    if (!safePlan) return [];

    const scan = safePlan.websiteScan;
    if (!scan) return [];

    const businessName = s(safePlan.clientName) || "העסק";
    const productsStr = s(scan.websiteFacts?.main_products_or_services || "");
    const products = productsStr
      ? productsStr.split(",").map((p: string) => p.trim()).filter((p: string) => p.length > 0).slice(0, 3)
      : [];
    const h1Tags = Array.isArray(scan.h1Tags) ? scan.h1Tags.filter((t: any) => typeof t === 'string' && t.length > 0).slice(0, 3) : [];
    const h2Tags = Array.isArray(scan.h2Tags) ? scan.h2Tags.filter((t: any) => typeof t === 'string' && t.length > 0).slice(0, 3) : [];

    // Extract location if available
    const websiteUrl = s(safePlan.websiteUrl || "");
    const locationMatch = websiteUrl.match(/\.([a-z]{2})($|\/)/i);
    const location = locationMatch ? (locationMatch[1] === "il" ? "ישראל" : locationMatch[1]) : "ישראל";

    // Keywords for each category
    const keywordsList: any[] = [];

    // 1. PURCHASE_INTENT (כוונת רכישה) - products + purchase terms
    const purchaseTerms = ["מחיר", "עלות", "הזמנת", "קנייה", "השכרת", "ביצוע"];
    if (products.length > 0) {
      products.slice(0, 2).forEach((prod: string) => {
        purchaseTerms.slice(0, 2).forEach((term: string) => {
          keywordsList.push({
            keyword: `${term} ${prod}`,
            category: "purchase_intent",
            categoryLabel: "כוונת רכישה",
          });
        });
      });
    }

    // 2. LOCATION (מיקום) - products + location
    if (products.length > 0) {
      products.slice(0, 2).forEach((prod: string) => {
        keywordsList.push({
          keyword: `${prod} ${location}`,
          category: "location",
          categoryLabel: "מיקום",
        });
      });
    }

    // 3. PRODUCT (מוצר/שירות) - direct products + h1/h2 tags
    products.slice(0, 4).forEach((prod: string) => {
      keywordsList.push({
        keyword: prod,
        category: "product",
        categoryLabel: "מוצר/שירות",
      });
    });
    h1Tags.slice(0, 2).forEach((tag: string) => {
      if (tag && tag.length < 60) {
        keywordsList.push({
          keyword: tag,
          category: "product",
          categoryLabel: "מוצר/שירות",
        });
      }
    });
    h2Tags.slice(0, 1).forEach((tag: string) => {
      if (tag && tag.length < 60) {
        keywordsList.push({
          keyword: tag,
          category: "product",
          categoryLabel: "מוצר/שירות",
        });
      }
    });

    // 4. TRUST (אמון ומותג) - business + trust terms
    const trustTerms = ["חוות דעת", "המלצות", "ביקורות", "ציונים", "הוכחות"];
    trustTerms.slice(0, 3).forEach((term: string) => {
      keywordsList.push({
        keyword: `${term} ${businessName}`,
        category: "trust",
        categoryLabel: "אמון ומותג",
      });
    });

    // Limit to 20 keywords total
    const limitedKeywords = keywordsList.slice(0, 20);

    // Map visibility results to find Google positions
    const visibilityResults: Record<string, number | null> = {};
    const aiFoundMap: Record<string, boolean> = {};

    if (Array.isArray(safePlan.visibilityResults)) {
      safePlan.visibilityResults.forEach((vr: any) => {
        const query = s(vr.query || "").toLowerCase();
        if (Array.isArray(vr.results)) {
          const googleResult = vr.results.find((r: any) => s(r.engine || "").toLowerCase() === "google_seo" || s(r.engine || "").toLowerCase() === "google");
          if (googleResult) {
            visibilityResults[query] = n(googleResult.position) || null;
          }
        }
      });
    }

    if (Array.isArray(scan.aiQueries)) {
      scan.aiQueries.forEach((aq: any) => {
        const query = s(aq.query || "").toLowerCase();
        if (aq.found === true) {
          aiFoundMap[query] = true;
        }
      });
    }

    // Add position and AI status to each keyword
    const enrichedKeywords = limitedKeywords.map((kw: any, idx: number) => {
      const keywordLower = kw.keyword.toLowerCase();
      const position = visibilityResults[keywordLower] || null;
      const aiMentioned = aiFoundMap[keywordLower] || false;

      // Generate action plan based on status
      let actionPlan = "";
      if (!aiMentioned) {
        actionPlan = `יצירת תוכן ממוקד לביטוי "${kw.keyword}" ברוח טבעית לשפע AI — שמור מרכוזות וסיכום בפסקה הראשונה`;
      } else if (!position || position > 10) {
        actionPlan = `שיפור תכולת קיימת עבור "${kw.keyword}" — הוסף קישורים פנימיים, שדרגו Meta Title ו-Description, בנה קישורים חיצוניים`;
      } else if (position > 5) {
        actionPlan = `לחצוץ "${kw.keyword}" מעמדה ${position} לעמוד 1 — חזקו עמוד יעד עם תוכן נוסף, קישורים ובדוקות בחוץ`;
      } else {
        actionPlan = `השמר על דירוג "${kw.keyword}" בעמוד 1 — שדרג תוכן באופן קבוע, עקבו אחר שינויים בתוצאות`;
      }

      return {
        id: `kw-${idx}`,
        keyword: kw.keyword,
        category: kw.category,
        categoryLabel: kw.categoryLabel,
        googlePosition: position,
        aiMentioned: aiMentioned,
        actionPlan: actionPlan,
      };
    });

    return enrichedKeywords;
  }, [safePlan]);

  // ── Loading ──
  if (loading) {
    return (
      <div style={{ direction: "rtl", padding: 40, background: C.bg, minHeight: "100vh" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          {[200, 100, 400].map((h, i) => (
            <div key={i} style={{
              height: h, borderRadius: 20, background: C.borderLight, marginBottom: 20,
              animation: "pulse 1.5s ease-in-out infinite",
            }} />
          ))}
        </div>
      </div>
    );
  }

  if (!plan || !safePlan) {
    return (
      <div style={{ direction: "rtl", padding: 60, background: C.bg, minHeight: "100vh", textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: C.text }}>תוכנית לא נמצאה</h2>
        <p style={{ fontSize: 14, color: C.textMuted, marginTop: 8 }}>ID: {planId}</p>
        <button onClick={() => router.push("/seo-geo/dashboard")} style={{
          marginTop: 24, padding: "12px 32px", background: C.primary, color: "#fff",
          border: "none", borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: "pointer",
        }}>חזרה למרכז PIXEL SEO/GEO</button>
      </div>
    );
  }

  // Use safePlan for ALL rendering below
  const p = safePlan;

  const status = STATUS_MAP[p.status] || STATUS_MAP.draft;
  const domain = p.websiteUrl?.replace(/^https?:\/\//, "").replace(/\/$/, "") || "—";
  const progress = n(p.totalTasks) > 0 ? Math.round((n(p.completedTasks) / (n(p.totalTasks) || 1)) * 100) : 0;
  const createdDate = p.createdAt ? new Date(typeof p.createdAt === 'string' ? p.createdAt : String(p.createdAt)) : new Date();
  const now = new Date();
  const daysSinceCreated = Math.max(0, Math.floor((now.getTime() - createdDate.getTime()) / 86400000));
  const daysRemaining = Math.max(0, 60 - daysSinceCreated);

  // Safe accessors for websiteScan (data from DB may have unexpected types)
  const scan = p.websiteScan || null;
  const safeLoadTime = typeof scan?.loadTimeMs === 'number' ? scan.loadTimeMs : 0;
  const safeDa = typeof scan?.domainAuthority === 'number' ? scan.domainAuthority : 0;
  const safeTotalPages = typeof scan?.totalPages === 'number' ? scan.totalPages : 0;
  const safeBrokenLinks = typeof scan?.brokenLinks === 'number' ? scan.brokenLinks : 0;

  // ══════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════

  return (
    <div style={{
      direction: "rtl", background: C.bg, minHeight: "100vh",
      fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
    }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "28px 32px" }}>

        {/* ═══ HEADER ═══ */}
        <div style={{
          background: C.card, borderRadius: 24, border: `1px solid ${C.border}`,
          padding: "28px 32px", marginBottom: 24,
          boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20 }}>
            {/* Left: info */}
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                <button onClick={() => router.push("/seo-geo/dashboard")} style={{
                  width: 36, height: 36, borderRadius: 10, border: `1px solid ${C.border}`,
                  background: "transparent", cursor: "pointer", fontSize: 16,
                  display: "flex", alignItems: "center", justifyContent: "center", color: C.textMuted,
                }}>→</button>
                <div style={{
                  width: 44, height: 44, borderRadius: 14,
                  background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`,
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22,
                }}>🔍</div>
                <div>
                  <h1 style={{ fontSize: 22, fontWeight: 800, color: C.text, margin: 0 }}>
                    {s(p.clientName) || "תוכנית PIXEL SEO/GEO"}
                  </h1>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
                    <span style={{ fontSize: 13, color: C.textSecondary }}>🌐 {s(domain)}</span>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: "3px 12px", borderRadius: 8,
                      background: `${status.color}15`, color: status.color,
                    }}>{s(status.label)}</span>
                    <span style={{ fontSize: 11, color: C.textMuted }}>נוצר {fmtDate(p.createdAt)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: action buttons */}
            <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
              <button
                onClick={handleGenerateReport}
                disabled={generatingReport}
                style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "9px 18px",
                  background: "transparent", color: C.textSecondary,
                  border: `1px solid ${C.border}`, borderRadius: 10,
                  fontSize: 12, fontWeight: 600, cursor: generatingReport ? "wait" : "pointer",
                  opacity: generatingReport ? 0.6 : 1, transition: "all 0.2s",
                }}
              >
                <span style={{ fontSize: 13 }}>📄</span> {generatingReport ? "מייצר..." : "הפק דוח PDF"}
              </button>
              {(!Array.isArray(p.days) || p.days.length === 0) && (
                <button
                  onClick={handleGenerate60DayPlan}
                  disabled={generatingPlan}
                  style={{
                    display: "flex", alignItems: "center", gap: 6, padding: "9px 18px",
                    background: C.primary, color: "#fff",
                    border: "none", borderRadius: 10,
                    fontSize: 12, fontWeight: 600, cursor: generatingPlan ? "wait" : "pointer",
                    opacity: generatingPlan ? 0.6 : 1, transition: "all 0.2s",
                  }}
                >
                  <span style={{ fontSize: 13 }}>📅</span> {generatingPlan ? "מייצר תוכנית..." : "צור תוכנית 60 יום"}
                </button>
              )}
              <button
                onClick={() => router.push(`/seo-geo/${p.id}/report?lang=he`)}
                style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "9px 18px",
                  background: "transparent", color: C.textSecondary,
                  border: `1px solid ${C.border}`, borderRadius: 10,
                  fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.2s",
                }}
              >
                <span style={{ fontSize: 13 }}>👁️</span> צפה בדוח
              </button>
              <button
                onClick={() => {
                  alert("בקרוב: שלח דוח ותוכנית ללקוח במייל וב-Dashboard");
                }}
                style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "9px 18px",
                  background: "transparent", color: C.textSecondary,
                  border: `1px solid ${C.border}`, borderRadius: 10,
                  fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.2s",
                }}
              >
                <span style={{ fontSize: 13 }}>📧</span> שלח ללקוח
              </button>
              <button
                onClick={() => {
                  alert("בקרוב: ממשק לייצירת משימה חדשה לתוכנית");
                }}
                style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "9px 18px",
                  background: C.primary, color: "#fff",
                  border: "none", borderRadius: 10,
                  fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.2s",
                }}
              >
                <span style={{ fontSize: 13 }}>+</span> הוסף משימה
              </button>
            </div>
          </div>
        </div>

        {/* ═══ KPI CARDS ═══ */}
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 14, marginBottom: 24,
        }}>
          {[
            { label: "ציון GEO", value: `${computedScores.visibility}%`, color: C.neonEnd, icon: "🤖", sub: "נראות במנועי AI" },
            { label: "ציון SEO", value: `${computedScores.technical}%`, color: C.info, icon: "🔧", sub: "ציון טכני" },
            { label: "נראות AI", value: `${computedScores.overall}%`, color: C.primary, icon: "📊", sub: "ציון כללי" },
            { label: "התקדמות", value: `${progress}%`, color: progress >= 60 ? C.success : C.warning, icon: "📈", sub: "התקדמות" },
            { label: "משימות שהושלמו", value: `${n(p.completedTasks)}`, color: C.success, icon: "✅", sub: `מתוך ${n(p.totalTasks)}` },
            { label: "ימים נותרו", value: `${daysRemaining}`, color: daysRemaining < 15 ? C.danger : C.primary, icon: "⏰", sub: `מתוך 60 יום` },
          ].map((kpi, i) => (
            <div key={i} style={{
              background: C.card, borderRadius: 18, border: `1px solid ${C.border}`,
              padding: "20px 16px", textAlign: "center",
              boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
              position: "relative", overflow: "hidden",
            }}>
              {/* Subtle top accent line */}
              <div style={{
                position: "absolute", top: 0, left: 0, right: 0, height: 3,
                background: kpi.color, borderRadius: "18px 18px 0 0",
              }} />
              <div style={{ fontSize: 22, marginBottom: 8 }}>{s(kpi.icon)}</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: kpi.color }}>{s(kpi.value)}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginTop: 4 }}>{s(kpi.label)}</div>
              <div style={{ fontSize: 10, color: C.textMuted, marginTop: 2 }}>{s(kpi.sub)}</div>
            </div>
          ))}
        </div>

        {/* ═══ TABS ═══ */}
        <div style={{
          display: "flex", gap: 4, marginBottom: 24, background: C.card,
          borderRadius: 16, border: `1px solid ${C.border}`, padding: 6,
          boxShadow: "0 1px 4px rgba(0,0,0,0.02)",
        }}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 1, padding: "12px 8px",
                background: activeTab === tab.id ? C.primary : "transparent",
                color: activeTab === tab.id ? "#fff" : C.textSecondary,
                border: "none", borderRadius: 12, cursor: "pointer",
                fontSize: 13, fontWeight: activeTab === tab.id ? 700 : 500,
                transition: "all 0.2s",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}
            >
              <span style={{ fontSize: 14 }}>{s(tab.icon)}</span> {s(tab.label)}
            </button>
          ))}
        </div>

        {/* ═══ TAB CONTENT ═══ */}

        {/* ── OVERVIEW ── */}
        {activeTab === "overview" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            {/* Goals */}
            <div style={{ ...cardStyle }}>
              <h3 style={{ ...sectionTitle }}>🎯 יעדים</h3>
              {(!Array.isArray(autoGoals) || autoGoals.length === 0) ? (
                <p style={{ fontSize: 13, color: C.textMuted }}>לא הוגדרו יעדים</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {autoGoals.filter(g => g && g.selected).map(g => {
                    const progress = g.targetValue > 0 ? Math.min(100, Math.round((g.currentValue / g.targetValue) * 100)) : 0;
                    return (
                      <div key={g.id} style={{
                        display: "flex", alignItems: "flex-start", gap: 12,
                        padding: "12px 14px", borderRadius: 12, background: C.bg,
                      }}>
                        <span style={{ fontSize: 22, flexShrink: 0 }}>{s(g.icon)}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{s(g.label)}</div>
                          <div style={{
                            height: 4, background: C.borderLight, borderRadius: 2, marginTop: 6, overflow: "hidden",
                          }}>
                            <div style={{
                              height: "100%", width: `${progress}%`, borderRadius: 2,
                              background: progress === 100 ? C.success : C.primary, transition: "width 0.4s",
                            }} />
                          </div>
                          <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>
                            {s(g.currentValue)} → {s(g.targetValue)} {s(g.targetMetric)}
                          </div>
                        </div>
                        <span style={{
                          fontSize: 10, fontWeight: 600, padding: "3px 10px", borderRadius: 6, flexShrink: 0,
                          background: g.priority === "high" ? `${C.danger}15` : g.priority === "medium" ? `${C.warning}15` : `${C.info}15`,
                          color: g.priority === "high" ? C.danger : g.priority === "medium" ? C.warning : C.info,
                        }}>
                          {g.priority === "high" ? "גבוהה" : g.priority === "medium" ? "בינונית" : "נמוכה"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Scan Summary */}
            <div style={{ ...cardStyle }}>
              <h3 style={{ ...sectionTitle }}>🔍 סריקה טכנית</h3>
              {!scan ? (
                <p style={{ fontSize: 13, color: C.textMuted }}>לא בוצעה סריקה</p>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                  {[
                    { l: "SSL", v: scan?.hasSSL === true ? "✓" : "✗", ok: scan?.hasSSL === true },
                    { l: "מהירות", v: `${(safeLoadTime / 1000).toFixed(1)}s`, ok: safeLoadTime < 3000 },
                    { l: "מובייל", v: scan?.mobileOptimized === true ? "✓" : "✗", ok: scan?.mobileOptimized === true },
                    { l: "Sitemap", v: scan?.hasSitemap === true ? "✓" : "✗", ok: scan?.hasSitemap === true },
                    { l: "Robots", v: scan?.hasRobotsTxt === true ? "✓" : "✗", ok: scan?.hasRobotsTxt === true },
                    { l: "DA", v: `${safeDa}`, ok: safeDa > 20 },
                    { l: "דפים", v: `${safeTotalPages}`, ok: true },
                    { l: "שבורים", v: `${safeBrokenLinks}`, ok: safeBrokenLinks === 0 },
                    { l: "Schema", v: scan?.structuredData === true ? "✓" : "✗", ok: scan?.structuredData === true },
                  ].map((item, i) => (
                    <div key={i} style={{
                      padding: "10px 12px", borderRadius: 10, background: C.bg,
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                    }}>
                      <span style={{ fontSize: 11, color: C.textMuted }}>{s(item.l)}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: item.ok ? C.success : C.danger }}>{s(item.v)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Insights SWOT */}
            <div style={{ ...cardStyle }}>
              <h3 style={{ ...sectionTitle }}>💡 תובנות</h3>
              {(!Array.isArray(autoInsights) || autoInsights.length === 0) ? (
                <p style={{ fontSize: 13, color: C.textMuted }}>אין תובנות</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {autoInsights.slice(0, 6).map(ins => {
                    const catConfig: Record<string, { icon: string; color: string }> = {
                      strength: { icon: "💪", color: C.success },
                      opportunity: { icon: "🚀", color: C.primary },
                      weakness: { icon: "⚠️", color: C.warning },
                      threat: { icon: "🛡️", color: C.danger },
                    };
                    const cc = catConfig[ins.category] || catConfig.opportunity;
                    return (
                      <div key={ins.id} style={{
                        display: "flex", alignItems: "flex-start", gap: 10,
                        padding: "10px 12px", borderRadius: 10, background: `${cc.color}06`,
                        border: `1px solid ${cc.color}18`,
                      }}>
                        <span style={{ fontSize: 16, flexShrink: 0 }}>{s(cc.icon)}</span>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{s(ins.title)}</div>
                          <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{s(ins.action)}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* AI Visibility Summary */}
            <div style={{ ...cardStyle }}>
              <h3 style={{ ...sectionTitle }}>🤖 נראות AI</h3>
              <div style={{
                textAlign: "center", padding: "20px 0 16px",
              }}>
                <div style={{
                  fontSize: 48, fontWeight: 800, color: C.primary,
                  background: `linear-gradient(135deg, ${C.neon}, ${C.neonEnd})`,
                  WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                }}>
                  {n(p.visibilityScore)}%
                </div>
                <div style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>ציון נראות כולל</div>
              </div>
              <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
                {AI_ENGINES.map(eng => {
                  const vrArr = Array.isArray(p.visibilityResults) ? p.visibilityResults : [];
                  const total = vrArr.length;
                  const mentioned = vrArr.filter(vr =>
                    (Array.isArray(vr.results) ? vr.results : []).some(r => r.engine === eng && r.mentioned)
                  ).length;
                  const pct = total > 0 ? Math.round((mentioned / total) * 100) : 0;
                  return (
                    <div key={eng} style={{
                      padding: "8px 14px", borderRadius: 10, background: C.bg,
                      border: `1px solid ${C.borderLight}`, textAlign: "center", minWidth: 80,
                    }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: pct > 50 ? C.success : C.danger }}>{s(pct)}%</div>
                      <div style={{ fontSize: 10, color: C.textMuted, marginTop: 2 }}>{s(eng)}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── 60-DAY PLAN ── */}
        {activeTab === "plan" && (
          <div>
            {/* Show generate button if no days exist */}
            {(!Array.isArray(p.days) || p.days.length === 0) && (
              <div style={{
                background: C.card, borderRadius: 20, border: `1px solid ${C.border}`,
                padding: "32px 24px", marginBottom: 20, textAlign: "center",
                boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
              }}>
                <div style={{ fontSize: 42, marginBottom: 12 }}>📅</div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 8 }}>
                  תוכנית 60 יום עדיין לא נוצרה
                </h3>
                <p style={{ fontSize: 13, color: C.textMuted, marginBottom: 20, maxWidth: 500, margin: "0 auto 20px" }}>
                  לחץ כדי ליצור תוכנית פעולה מפורטת עם משימות יומיות מותאמות לאתר שלך, מחולקת ל-5 שלבים
                </p>
                <button
                  onClick={handleGenerate60DayPlan}
                  disabled={generatingPlan}
                  style={{
                    padding: "14px 36px", borderRadius: 12, border: "none", cursor: generatingPlan ? "wait" : "pointer",
                    background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`,
                    color: "#fff", fontWeight: 700, fontSize: 15,
                    opacity: generatingPlan ? 0.7 : 1, transition: "all 0.2s",
                  }}
                >
                  {generatingPlan ? "⏳ מייצר תוכנית..." : "📅 צור תוכנית 60 יום"}
                </button>
              </div>
            )}

            {/* Phase + Day structure (new) */}
            {Array.isArray(p.phases) && p.phases.length > 0 && Array.isArray(p.days) && p.days.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {p.phases.map(phase => {
                  const phaseDays = (Array.isArray(p.days) ? p.days : []).filter(d => d.phaseNumber === phase.number);
                  const phaseDone = phaseDays.flatMap(d => d.tasks).filter(t => t.status === "done").length;
                  const phaseTotal = phaseDays.flatMap(d => d.tasks).length;
                  const phasePct = phaseTotal > 0 ? Math.round((phaseDone / phaseTotal) * 100) : 0;

                  return (
                    <div key={phase.number} style={{
                      background: C.card, borderRadius: 20,
                      border: `1px solid ${expandedWeeks.has(phase.number) ? `${C.primary}40` : C.border}`,
                      overflow: "hidden", transition: "border-color 0.2s",
                      boxShadow: expandedWeeks.has(phase.number) ? `0 4px 20px ${C.primary}10` : "0 2px 8px rgba(0,0,0,0.03)",
                    }}>
                      {/* Phase header */}
                      <button onClick={() => {
                        const next = new Set(expandedWeeks);
                        if (next.has(phase.number)) next.delete(phase.number); else next.add(phase.number);
                        setExpandedWeeks(next);
                      }} style={{
                        width: "100%", padding: "18px 24px",
                        display: "flex", alignItems: "center", gap: 16,
                        background: "transparent", border: "none", cursor: "pointer", textAlign: "right",
                      }}>
                        <div style={{
                          width: 48, height: 48, borderRadius: 14, flexShrink: 0,
                          background: `linear-gradient(135deg, ${C.primary}15, ${C.primary}05)`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 20, fontWeight: 800, color: C.primary,
                        }}>{s(phase.number)}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>
                            שלב {s(phase.number)}: {s(phase.name)}
                          </div>
                          <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
                            {s(phase.focus)} · {phaseDone}/{phaseTotal} משימות · ימים {s(phase.days?.[0])}-{s(phase.days?.[1])}
                          </div>
                        </div>
                        {/* Mini progress */}
                        <div style={{ width: 80, textAlign: "center", flexShrink: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: phasePct === 100 ? C.success : C.primary }}>{phasePct}%</div>
                          <div style={{
                            height: 4, background: C.borderLight, borderRadius: 2, marginTop: 4, overflow: "hidden",
                          }}>
                            <div style={{
                              height: "100%", width: `${phasePct}%`, borderRadius: 2,
                              background: phasePct === 100 ? C.success : C.primary, transition: "width 0.4s",
                            }} />
                          </div>
                        </div>
                        <span style={{
                          fontSize: 18, color: C.textMuted, transition: "transform 0.2s",
                          transform: expandedWeeks.has(phase.number) ? "rotate(180deg)" : "rotate(0deg)",
                        }}>▾</span>
                      </button>

                      {/* Days within phase */}
                      {expandedWeeks.has(phase.number) && (
                        <div style={{ padding: "0 24px 20px", borderTop: `1px solid ${C.borderLight}` }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 16 }}>
                            {phaseDays.map(day => {
                              const dayDone = day.tasks.filter(t => t.status === "done").length;
                              const dayTotal = day.tasks.length;
                              const dayPct = dayTotal > 0 ? Math.round((dayDone / dayTotal) * 100) : 0;

                              return (
                                <div key={day.day} style={{
                                  padding: "12px 16px", borderRadius: 14, background: C.bg,
                                  border: `1px solid ${C.borderLight}`, marginBottom: 8,
                                }}>
                                  <div style={{
                                    fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 8,
                                    display: "flex", justifyContent: "space-between", alignItems: "center",
                                  }}>
                                    <span>יום {s(day.day)}: {s(day.focusTitle)}</span>
                                    <span style={{ fontSize: 11, color: C.textMuted }}>{dayDone}/{dayTotal} משימות ({dayPct}%)</span>
                                  </div>
                                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                    {day.tasks.map(task => {
                                      const isExpanded = expandedTaskId === task.id;
                                      const taskDesc = (task as any).description || '';
                                      const taskReason = (task as any).reason || '';
                                      const taskOutcome = (task as any).expectedOutcome || '';
                                      const taskBrief = (task as any).contentBrief || '';
                                      const taskHours = (task as any).effortHours || (task as any).estimatedHours || 0;
                                      const taskUrl = (task as any).relatedPageUrl || '';

                                      return (
                                        <div key={task.id} style={{
                                          borderRadius: 10, background: C.card,
                                          border: `1px solid ${isExpanded ? C.primary : C.borderLight}`,
                                          overflow: "hidden",
                                        }}>
                                          {/* Task header - clickable */}
                                          <button onClick={() => setExpandedTaskId(isExpanded ? null : task.id)} style={{
                                            width: "100%", padding: "10px 12px",
                                            display: "flex", alignItems: "center", gap: 10,
                                            background: "transparent", border: "none", cursor: "pointer", textAlign: "right",
                                          }}>
                                            {/* Status toggle */}
                                            <select
                                              value={task.status || "todo"}
                                              onChange={e => {
                                                e.stopPropagation();
                                                updateTaskStatus(task.id, e.target.value as PlanTask["status"]);
                                              }}
                                              style={{
                                                padding: "4px 6px", borderRadius: 6, border: `1px solid ${C.border}`,
                                                fontSize: 10, background: C.card, cursor: "pointer", flexShrink: 0,
                                                color: task.status === "done" ? C.success : task.status === "in_progress" ? C.primary : C.textSecondary,
                                              }}
                                            >
                                              {KANBAN_COLS.map(col => (
                                                <option key={col.id} value={col.id}>{col.label}</option>
                                              ))}
                                            </select>

                                            {/* Content */}
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                              <div style={{
                                                fontSize: 12, fontWeight: 600, color: C.text,
                                                textDecoration: task.status === "done" ? "line-through" : "none",
                                                opacity: task.status === "done" ? 0.6 : 1,
                                              }}>{s(task.title)}</div>
                                            </div>

                                            {/* Impact badge */}
                                            <span style={{
                                              fontSize: 9, fontWeight: 600, padding: "2px 8px", borderRadius: 4, flexShrink: 0,
                                              background: task.impactLevel === "high" || task.impactLevel === "critical" ? `${C.danger}15` : task.impactLevel === "medium" ? `${C.warning}15` : `${C.info}15`,
                                              color: task.impactLevel === "high" || task.impactLevel === "critical" ? C.danger : task.impactLevel === "medium" ? C.warning : C.info,
                                            }}>
                                              {task.impactLevel === "critical" ? "קריטית" : task.impactLevel === "high" ? "גבוהה" : task.impactLevel === "medium" ? "בינו" : "נמוכה"}
                                            </span>

                                            {/* Expand arrow */}
                                            <span style={{
                                              fontSize: 14, color: C.textMuted,
                                              transition: "transform 0.2s",
                                              transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                                            }}>▾</span>
                                          </button>

                                          {/* Task details panel */}
                                          {isExpanded && (
                                            <div style={{
                                              padding: "14px 12px", borderTop: `1px solid ${C.borderLight}`,
                                              background: C.bg, fontSize: 13,
                                            }}>
                                              {taskDesc && (
                                                <div style={{ marginBottom: 12 }}>
                                                  <div style={{ fontSize: 11, fontWeight: 600, color: C.textSecondary, marginBottom: 6 }}>📝 תיאור המשימה</div>
                                                  <div style={{ fontSize: 12, color: C.text, lineHeight: 1.6 }}>{s(taskDesc)}</div>
                                                </div>
                                              )}

                                              {taskReason && (
                                                <div style={{ marginBottom: 12 }}>
                                                  <div style={{ fontSize: 11, fontWeight: 600, color: C.textSecondary, marginBottom: 6 }}>💡 למה זה חשוב?</div>
                                                  <div style={{ fontSize: 12, color: C.text, lineHeight: 1.6 }}>{s(taskReason)}</div>
                                                </div>
                                              )}

                                              {taskOutcome && (
                                                <div style={{ marginBottom: 12 }}>
                                                  <div style={{ fontSize: 11, fontWeight: 600, color: C.textSecondary, marginBottom: 6 }}>✅ תוצאה צפויה</div>
                                                  <div style={{ fontSize: 12, color: C.text, lineHeight: 1.6 }}>{s(taskOutcome)}</div>
                                                </div>
                                              )}

                                              {taskHours > 0 && (
                                                <div style={{ marginBottom: 12 }}>
                                                  <div style={{ fontSize: 11, fontWeight: 600, color: C.textSecondary, marginBottom: 6 }}>⏱️ שעות עבודה משוערות</div>
                                                  <div style={{ fontSize: 12, color: C.text }}>{s(taskHours)} שעות</div>
                                                </div>
                                              )}

                                              {taskBrief && (
                                                <div style={{ marginBottom: 0 }}>
                                                  <div style={{ fontSize: 11, fontWeight: 600, color: C.textSecondary, marginBottom: 6 }}>📋 תקציר תוכן מוכן</div>
                                                  <div style={{
                                                    background: C.card, border: `1px solid ${C.border}`,
                                                    borderRadius: 8, padding: "10px 12px", fontFamily: "monospace",
                                                    fontSize: 11, color: C.text, maxHeight: 120, overflow: "auto",
                                                    lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word",
                                                  }}>
                                                    {s(taskBrief)}
                                                  </div>
                                                  <button onClick={() => {
                                                    navigator.clipboard.writeText(String(taskBrief)).catch(() => {});
                                                  }} style={{
                                                    ...smallBtnStyle,
                                                    width: "100%", marginTop: 8,
                                                    background: `${C.primary}10`, color: C.primary, border: `1px solid ${C.primary}30`,
                                                  }}>
                                                    📋 העתק תקציר
                                                  </button>
                                                </div>
                                              )}

                                              {taskUrl && (
                                                <div style={{ marginTop: 12 }}>
                                                  <div style={{ fontSize: 11, fontWeight: 600, color: C.textSecondary, marginBottom: 6 }}>🔗 עמוד קשור</div>
                                                  <a href={s(taskUrl)} target="_blank" rel="noopener noreferrer" style={{
                                                    fontSize: 12, color: C.primary, textDecoration: "underline", cursor: "pointer",
                                                  }}>
                                                    {s(taskUrl)}
                                                  </a>
                                                </div>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (Array.isArray(p.weeks) && p.weeks.length > 0) ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {p.weeks.map(week => {
                  const isExpanded = expandedWeeks.has(week.weekNumber);
                  const weekDone = week.tasks.filter(t => t.status === "done").length;
                  const weekTotal = week.tasks.length;
                  const weekPct = weekTotal > 0 ? Math.round((weekDone / weekTotal) * 100) : 0;

                  return (
                    <div key={week.weekNumber} style={{
                      background: C.card, borderRadius: 20,
                      border: `1px solid ${isExpanded ? `${C.primary}40` : C.border}`,
                      overflow: "hidden", transition: "border-color 0.2s",
                      boxShadow: isExpanded ? `0 4px 20px ${C.primary}10` : "0 2px 8px rgba(0,0,0,0.03)",
                    }}>
                      {/* Week header */}
                      <button onClick={() => {
                        const next = new Set(expandedWeeks);
                        if (next.has(week.weekNumber)) next.delete(week.weekNumber); else next.add(week.weekNumber);
                        setExpandedWeeks(next);
                      }} style={{
                        width: "100%", padding: "18px 24px",
                        display: "flex", alignItems: "center", gap: 16,
                        background: "transparent", border: "none", cursor: "pointer", textAlign: "right",
                      }}>
                        <div style={{
                          width: 48, height: 48, borderRadius: 14, flexShrink: 0,
                          background: `linear-gradient(135deg, ${C.primary}15, ${C.primary}05)`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 20, fontWeight: 800, color: C.primary,
                        }}>{s(week.weekNumber)}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>
                            שבוע {s(week.weekNumber)}: {s(week.theme)}
                          </div>
                          <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
                            {s(week.focus)} · {weekDone}/{weekTotal} משימות · {fmtDate(week.startDate)} – {fmtDate(week.endDate)}
                          </div>
                        </div>
                        {/* Mini progress */}
                        <div style={{ width: 80, textAlign: "center", flexShrink: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: weekPct === 100 ? C.success : C.primary }}>{weekPct}%</div>
                          <div style={{
                            height: 4, background: C.borderLight, borderRadius: 2, marginTop: 4, overflow: "hidden",
                          }}>
                            <div style={{
                              height: "100%", width: `${weekPct}%`, borderRadius: 2,
                              background: weekPct === 100 ? C.success : C.primary, transition: "width 0.4s",
                            }} />
                          </div>
                        </div>
                        <span style={{
                          fontSize: 18, color: C.textMuted, transition: "transform 0.2s",
                          transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                        }}>▾</span>
                      </button>

                      {/* Tasks */}
                      {isExpanded && (
                        <div style={{ padding: "0 24px 20px", borderTop: `1px solid ${C.borderLight}` }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 16 }}>
                            {week.tasks.map(task => (
                              <div key={task.id} style={{
                                display: "flex", alignItems: "center", gap: 14,
                                padding: "14px 16px", borderRadius: 14, background: C.bg,
                                border: `1px solid ${C.borderLight}`,
                              }}>
                                {/* Status toggle */}
                                <select
                                  value={task.status || "todo"}
                                  onChange={e => updateTaskStatus(task.id, e.target.value as PlanTask["status"])}
                                  style={{
                                    padding: "4px 8px", borderRadius: 8, border: `1px solid ${C.border}`,
                                    fontSize: 11, background: C.card, cursor: "pointer", flexShrink: 0,
                                    color: task.status === "done" ? C.success : task.status === "in_progress" ? C.primary : C.textSecondary,
                                  }}
                                >
                                  {KANBAN_COLS.map(col => (
                                    <option key={col.id} value={col.id}>{col.label}</option>
                                  ))}
                                </select>

                                {/* Priority dot */}
                                <div style={{
                                  width: 8, height: 8, borderRadius: 4, flexShrink: 0,
                                  background: task.priority === "high" ? C.danger : task.priority === "medium" ? C.warning : C.info,
                                }} />

                                {/* Content */}
                                <div style={{ flex: 1 }}>
                                  <div style={{
                                    fontSize: 13, fontWeight: 600, color: C.text,
                                    textDecoration: task.status === "done" ? "line-through" : "none",
                                    opacity: task.status === "done" ? 0.6 : 1,
                                  }}>{s(task.title)}</div>
                                  <div style={{ display: "flex", gap: 10, marginTop: 6, flexWrap: "wrap" }}>
                                    <span style={{ ...tagStyle, background: `${C.primary}10`, color: C.primary }}>
                                      🏷️ {s(task.category)}
                                    </span>
                                    <span style={{ ...tagStyle, background: `${C.warning}10`, color: C.warning }}>
                                      ⏱️ {s(task.estimatedHours)}h
                                    </span>
                                    {task.deliverable && (
                                      <span style={{ ...tagStyle, background: `${C.success}10`, color: C.success }}>
                                        📦 {s(task.deliverable)}
                                      </span>
                                    )}
                                    {task.kpiTarget && (
                                      <span style={{ ...tagStyle, background: `${C.neon}20`, color: C.neonEnd }}>
                                        📊 {s(task.kpiTarget)}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Impact badge */}
                                <span style={{
                                  fontSize: 10, fontWeight: 600, padding: "3px 10px", borderRadius: 6, flexShrink: 0,
                                  background: task.priority === "high" ? `${C.danger}15` : task.priority === "medium" ? `${C.warning}15` : `${C.info}15`,
                                  color: task.priority === "high" ? C.danger : task.priority === "medium" ? C.warning : C.info,
                                }}>
                                  {task.priority === "high" ? "השפעה גבוהה" : task.priority === "medium" ? "בינונית" : "נמוכה"}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "60px 20px" }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>📅</div>
                <p style={{ fontSize: 16, color: C.textMuted, marginBottom: 24 }}>אין תוכנית 60 יום עדיין</p>
                <button
                  onClick={handleGenerate60DayPlan}
                  disabled={generatingPlan}
                  style={{
                    padding: "14px 36px",
                    background: `linear-gradient(135deg, ${C.neon}, ${C.neonEnd})`,
                    color: "#fff", border: "none", borderRadius: 14,
                    fontSize: 15, fontWeight: 700, cursor: generatingPlan ? "wait" : "pointer",
                    opacity: generatingPlan ? 0.6 : 1, transition: "all 0.3s",
                    boxShadow: `0 4px 16px ${C.primary}30`,
                  }}
                >
                  {generatingPlan ? "מייצר תוכנית..." : "צור תוכנית 60 יום"}
                </button>
                <p style={{ fontSize: 12, color: C.textMuted, marginTop: 12 }}>
                  התוכנית תיווצר על בסיס נתוני הסריקה, היעדים והתובנות
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── TASKS (KANBAN) ── */}
        {activeTab === "tasks" && (
          <div>
            {allTasks.length === 0 ? (
              <EmptyTab icon="✅" text="אין משימות בתוכנית. צור תוכנית 60 יום כדי ליצור משימות." />
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, alignItems: "flex-start" }}>
                {KANBAN_COLS.map(col => {
                  const colTasks = allTasks.filter(t => (t.status || "todo") === col.id);
                  return (
                    <div key={col.id} style={{
                      background: C.bg, borderRadius: 20, border: `1px solid ${C.border}`,
                      padding: "16px 14px", minHeight: 300,
                    }}>
                      {/* Column header */}
                      <div style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        marginBottom: 14, padding: "0 4px",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 16, color: col.color }}>{s(col.icon)}</span>
                          <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{s(col.label)}</span>
                        </div>
                        <span style={{
                          fontSize: 11, fontWeight: 600, padding: "2px 10px", borderRadius: 8,
                          background: `${col.color}15`, color: col.color,
                        }}>{s(colTasks.length)}</span>
                      </div>

                      {/* Task cards */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {colTasks.map(task => (
                          <div key={task.id} style={{
                            background: C.card, borderRadius: 14, border: `1px solid ${C.borderLight}`,
                            padding: "14px 16px", boxShadow: "0 1px 4px rgba(0,0,0,0.03)",
                          }}>
                            <div style={{
                              fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 8,
                              lineHeight: 1.5,
                            }}>{s(task.title)}</div>

                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                              <span style={{ ...tagStyle, background: `${C.primary}10`, color: C.primary }}>{s(task.category)}</span>
                              <span style={{ ...tagStyle, background: `${C.warning}10`, color: C.warning }}>{s(task.estimatedHours)}h</span>
                            </div>

                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <span style={{ fontSize: 10, color: C.textMuted }}>שבוע {s((task as any).weekNumber)}</span>
                              <select
                                value={task.status || "todo"}
                                onChange={e => updateTaskStatus(task.id, e.target.value as PlanTask["status"])}
                                style={{
                                  padding: "3px 6px", borderRadius: 6, border: `1px solid ${C.border}`,
                                  fontSize: 10, background: C.card, cursor: "pointer",
                                }}
                              >
                                {KANBAN_COLS.map(c => (
                                  <option key={c.id} value={c.id}>{c.label}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        ))}
                        {colTasks.length === 0 && (
                          <div style={{
                            padding: 24, textAlign: "center", fontSize: 12, color: C.textMuted,
                            border: `2px dashed ${C.borderLight}`, borderRadius: 14,
                          }}>אין משימות</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── AI RESULTS ── */}
        {activeTab === "ai" && (() => {
          // Read AI queries from scan pipeline format (websiteScan.aiQueries) or flat visibilityResults
          const aiQueries: Array<{platform: string; query: string; found: boolean; confidence: number; snippet?: string; scanMode?: string}> =
            (scan?.aiQueries as any[] || []).length > 0
              ? (scan?.aiQueries as any[])
              : (Array.isArray(p.visibilityResults) ? p.visibilityResults : []).map((vr: any) => ({
                  platform: vr.engine || '',
                  query: vr.query || '',
                  found: !!vr.mentioned,
                  confidence: vr.found ? 80 : 0,
                  snippet: vr.context || '',
                  scanMode: 'real',
                }));

          // Group by unique queries
          const uniqueQueries = Array.from(new Set(aiQueries.map(q => q.query)));
          // Group by platform
          const platforms = Array.from(new Set(aiQueries.map(q => q.platform)));
          const totalScanned = aiQueries.filter(q => q.scanMode === 'real').length;
          const totalFound = aiQueries.filter(q => q.scanMode === 'real' && q.found).length;
          const score = totalScanned > 0 ? Math.round((totalFound / totalScanned) * 100) : n(p.visibilityScore);

          return (
          <div>
            {aiQueries.length === 0 ? (
              <EmptyTab icon="🤖" text="אין תוצאות AI. חזור לאשף והרץ סריקת נראות." />
            ) : (
              <>
                {/* Score hero */}
                <div style={{
                  background: `linear-gradient(135deg, ${C.neon}, ${C.neonEnd})`,
                  borderRadius: 20, padding: 28, marginBottom: 20, color: "#1A1A2E",
                  display: "flex", alignItems: "center", gap: 32,
                }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 52, fontWeight: 800 }}>{score}%</div>
                    <div style={{ fontSize: 14, opacity: 0.8 }}>ציון נראות AI</div>
                  </div>
                  <div style={{ flex: 1, display: "flex", gap: 12, flexWrap: "wrap" }}>
                    {platforms.map(pid => {
                      const pd = PLATFORM_DISPLAY[pid] || { name: pid, icon: "🔍" };
                      const platQueries = aiQueries.filter(q => q.platform === pid);
                      const platFound = platQueries.filter(q => q.found).length;
                      return (
                        <div key={pid} style={{
                          background: "rgba(255,255,255,0.5)", borderRadius: 12,
                          padding: "12px 18px", textAlign: "center", minWidth: 100,
                        }}>
                          <div style={{ fontSize: 20, marginBottom: 4 }}>{pd.icon}</div>
                          <div style={{ fontSize: 18, fontWeight: 800 }}>{platFound}/{platQueries.length}</div>
                          <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>{pd.name}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Cross-platform matrix table */}
                <div style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: C.bg }}>
                        <th style={thStyle}>שאילתה</th>
                        {platforms.map(pid => {
                          const pd = PLATFORM_DISPLAY[pid] || { name: pid, icon: "🔍" };
                          return <th key={pid} style={{ ...thStyle, textAlign: "center", minWidth: 80 }}>{pd.icon} {pd.name}</th>;
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {uniqueQueries.map((query, i) => {
                        const decoded = (query || '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#39;/g, "'");
                        return (
                          <tr key={i} style={{ borderBottom: `1px solid ${C.borderLight}` }}>
                            <td style={{ ...tdStyle, maxWidth: 300, fontSize: 12 }}>{decoded}</td>
                            {platforms.map(pid => {
                              const result = aiQueries.find(q => q.platform === pid && q.query === query);
                              if (!result) return <td key={pid} style={{ ...tdStyle, textAlign: "center" }}>
                                <span style={{ color: C.textMuted, fontSize: 11 }}>—</span>
                              </td>;
                              return (
                                <td key={pid} style={{ ...tdStyle, textAlign: "center" }}>
                                  <div style={{
                                    width: 28, height: 28, borderRadius: 8, margin: "0 auto",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    fontSize: 14,
                                    background: result.found ? `${C.success}15` : `${C.danger}10`,
                                    color: result.found ? C.success : C.danger,
                                  }}>
                                    {result.found ? "✓" : "✗"}
                                  </div>
                                  {result.confidence > 0 && (
                                    <div style={{ fontSize: 9, color: C.textMuted, marginTop: 2 }}>{result.confidence}%</div>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Snippets section */}
                {aiQueries.filter(q => q.found && q.snippet).length > 0 && (
                  <div style={{ ...cardStyle, marginTop: 20 }}>
                    <h3 style={{ ...sectionTitle }}>💬 קטעי תשובה שבהם הוזכר העסק</h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {aiQueries.filter(q => q.found && q.snippet).slice(0, 8).map((q, i) => {
                        const pd = PLATFORM_DISPLAY[q.platform] || { name: q.platform, icon: "🔍" };
                        return (
                          <div key={i} style={{
                            padding: "14px 16px", borderRadius: 14, background: `${C.success}06`,
                            border: `1px solid ${C.success}20`,
                          }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                              <span style={{ fontSize: 16 }}>{pd.icon}</span>
                              <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{pd.name}</span>
                              <span style={{ fontSize: 10, color: C.textMuted }}>·</span>
                              <span style={{ fontSize: 11, color: C.textMuted }}>{(q.query || '').replace(/&quot;/g, '"').slice(0, 60)}</span>
                            </div>
                            <div style={{ fontSize: 12, color: C.textSecondary, lineHeight: 1.6, direction: "ltr", textAlign: "left" }}>
                              {(q.snippet || '').slice(0, 250)}{(q.snippet || '').length > 250 ? "..." : ""}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
          );
        })()}

        {/* ── RESULTS & VISIBILITY ── */}
        {activeTab === "results" && (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔎</div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 8 }}>תוצאות ונראות</h3>
            <p style={{ color: C.textSecondary, marginBottom: 20, maxWidth: 500, margin: "0 auto 20px" }}>
              צפה בתוצאות מפורטות לפי פלטפורמה — Google SEO, AI Overview, ChatGPT, Gemini, Claude, Perplexity
            </p>
            <button
              onClick={() => router.push(`/seo-geo/${planId}/results`)}
              style={{
                padding: "12px 32px", borderRadius: 10, border: "none", cursor: "pointer",
                background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`,
                color: "#fff", fontWeight: 600, fontSize: 15,
              }}
            >
              פתח דשבורד תוצאות ונראות →
            </button>
          </div>
        )}

        {/* ── COMPETITORS ── */}
        {activeTab === "competitors" && (() => {
          // Extract competitor data from scan pipeline aiQueries + plan.competitors
          const aiQueriesRaw: any[] = scan?.aiQueries as any[] || [];
          const planCompetitors: any[] = Array.isArray((p as any).competitors) ? (p as any).competitors : [];
          const scanCompetitors: any[] = Array.isArray((scan as any)?.competitors) ? (scan as any).competitors : [];
          const allCompetitors = [...planCompetitors, ...scanCompetitors];
          const businessProfile = (p as any).businessProfile || (scan as any)?.websiteFacts?.businessProfile;
          const knownCompetitors: string[] = businessProfile?.known_competitors || allCompetitors.map((c: any) => c.domain || c.name || '').filter(Boolean) || [];

          // Extract mentioned competitors from AI snippets
          const mentionedInAI = new Map<string, {platforms: Set<string>; queries: string[]}>();
          for (const q of aiQueriesRaw) {
            if (q.found && q.snippet) {
              for (const comp of knownCompetitors) {
                if (comp && q.snippet.toLowerCase().includes(comp.toLowerCase())) {
                  if (!mentionedInAI.has(comp)) mentionedInAI.set(comp, {platforms: new Set(), queries: []});
                  const entry = mentionedInAI.get(comp)!;
                  entry.platforms.add(q.platform);
                  if (!entry.queries.includes(q.query)) entry.queries.push(q.query);
                }
              }
            }
          }

          // Also check competitorsMentioned field from visibilityResults
          const visResults: any[] = Array.isArray(p.visibilityResults) ? p.visibilityResults : [];
          for (const vr of visResults) {
            const comps = vr.competitorsMentioned || [];
            for (const comp of comps) {
              if (!mentionedInAI.has(comp)) mentionedInAI.set(comp, {platforms: new Set(), queries: []});
              const entry = mentionedInAI.get(comp)!;
              entry.platforms.add(vr.engine || vr.platform || '');
              if (vr.query && !entry.queries.includes(vr.query)) entry.queries.push(vr.query);
            }
          }

          const hasCompData = knownCompetitors.length > 0 || mentionedInAI.size > 0 || planCompetitors.length > 0;

          return (
          <div>
            {!hasCompData ? (
              <EmptyTab icon="🏆" text="אין נתוני מתחרים עדיין. הרץ סריקת נראות כדי לזהות מתחרים שמוזכרים בתשובות AI." />
            ) : (
              <>
                {/* Summary */}
                <div style={{
                  display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 20,
                }}>
                  <div style={{ ...cardStyle, textAlign: "center" }}>
                    <div style={{ fontSize: 28, fontWeight: 800, color: C.primary }}>{knownCompetitors.length}</div>
                    <div style={{ fontSize: 12, color: C.textMuted }}>מתחרים מוכרים</div>
                  </div>
                  <div style={{ ...cardStyle, textAlign: "center" }}>
                    <div style={{ fontSize: 28, fontWeight: 800, color: C.warning }}>{mentionedInAI.size}</div>
                    <div style={{ fontSize: 12, color: C.textMuted }}>מתחרים שמוזכרים ב-AI</div>
                  </div>
                  <div style={{ ...cardStyle, textAlign: "center" }}>
                    <div style={{ fontSize: 28, fontWeight: 800, color: C.danger }}>
                      {aiQueriesRaw.filter(q => !q.found).length}
                    </div>
                    <div style={{ fontSize: 12, color: C.textMuted }}>שאילתות שלא מוזכרים בהן</div>
                  </div>
                </div>

                {/* Known competitors list */}
                <div style={{ ...cardStyle, marginBottom: 20 }}>
                  <h3 style={{ ...sectionTitle }}>🏆 מתחרים מוכרים</h3>
                  {knownCompetitors.length === 0 ? (
                    <p style={{ fontSize: 13, color: C.textMuted }}>לא הוגדרו מתחרים בפרופיל העסקי</p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {knownCompetitors.map((comp, i) => {
                        const aiData = mentionedInAI.get(comp);
                        return (
                          <div key={i} style={{
                            display: "flex", alignItems: "center", gap: 14,
                            padding: "14px 16px", borderRadius: 14, background: C.bg,
                            border: `1px solid ${C.borderLight}`,
                          }}>
                            <div style={{
                              width: 40, height: 40, borderRadius: 10,
                              background: aiData ? `${C.warning}15` : `${C.info}10`,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: 18, fontWeight: 700, color: aiData ? C.warning : C.info,
                            }}>{i + 1}</div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{comp}</div>
                              {aiData ? (
                                <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
                                  מוזכר ב-{aiData.platforms.size} פלטפורמות · {aiData.queries.length} שאילתות
                                </div>
                              ) : (
                                <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>לא זוהה בסריקת AI</div>
                              )}
                            </div>
                            {aiData && (
                              <div style={{ display: "flex", gap: 4 }}>
                                {Array.from(aiData.platforms).map(pid => {
                                  const pd = PLATFORM_DISPLAY[pid];
                                  return pd ? <span key={pid} title={pd.name} style={{ fontSize: 16 }}>{pd.icon}</span> : null;
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Plan competitors if available */}
                {planCompetitors.length > 0 && (
                  <div style={{ ...cardStyle }}>
                    <h3 style={{ ...sectionTitle }}>📊 ניתוח מתחרים מפורט</h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {planCompetitors.map((comp: any, i: number) => (
                        <div key={i} style={{
                          padding: "14px 16px", borderRadius: 14, background: C.bg,
                          border: `1px solid ${C.borderLight}`,
                        }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>
                              {comp.name || comp.domain || `מתחרה ${i + 1}`}
                            </div>
                            {comp.overlapScore !== undefined && (
                              <span style={{
                                ...tagStyle,
                                background: comp.overlapScore > 50 ? `${C.danger}15` : `${C.warning}15`,
                                color: comp.overlapScore > 50 ? C.danger : C.warning,
                              }}>חפיפה: {comp.overlapScore}%</span>
                            )}
                          </div>
                          {comp.domain && (
                            <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>🌐 {comp.domain}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
          );
        })()}

        {/* ── CONTENT GAPS ── */}
        {activeTab === "gaps" && (() => {
          // Build content gaps from AI queries where business was NOT found
          const aiQueriesRaw: any[] = scan?.aiQueries as any[] || [];
          const planGaps: any[] = Array.isArray((p as any).contentGaps) ? (p as any).contentGaps : [];

          // Find queries where business is missing per platform
          const missedByQuery = new Map<string, {platforms: string[]; totalPlatforms: number}>();
          const uniqueQueries = Array.from(new Set(aiQueriesRaw.map(q => q.query)));

          for (const query of uniqueQueries) {
            const queryResults = aiQueriesRaw.filter(q => q.query === query);
            const missed = queryResults.filter(q => !q.found).map(q => q.platform);
            const total = queryResults.length;
            if (missed.length > 0) {
              missedByQuery.set(query, { platforms: missed, totalPlatforms: total });
            }
          }

          // Sort by most missed (worst gaps first)
          const sortedGaps = Array.from(missedByQuery.entries()).sort((a, b) => {
            const aRatio = a[1].platforms.length / a[1].totalPlatforms;
            const bRatio = b[1].platforms.length / b[1].totalPlatforms;
            return bRatio - aRatio;
          });

          const hasGapData = sortedGaps.length > 0 || planGaps.length > 0;

          // Stats
          const totalGaps = sortedGaps.length;
          const criticalGaps = sortedGaps.filter(([, v]) => v.platforms.length === v.totalPlatforms).length;
          const partialGaps = totalGaps - criticalGaps;

          return (
          <div>
            {!hasGapData ? (
              <EmptyTab icon="📝" text="אין נתוני פערי תוכן. הרץ סריקת נראות AI כדי לזהות שאילתות שבהן העסק לא מופיע." />
            ) : (
              <>
                {/* Summary cards */}
                <div style={{
                  display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 20,
                }}>
                  <div style={{ ...cardStyle, textAlign: "center" }}>
                    <div style={{ fontSize: 28, fontWeight: 800, color: C.danger }}>{criticalGaps}</div>
                    <div style={{ fontSize: 12, color: C.textMuted }}>חסר בכל הפלטפורמות</div>
                  </div>
                  <div style={{ ...cardStyle, textAlign: "center" }}>
                    <div style={{ fontSize: 28, fontWeight: 800, color: C.warning }}>{partialGaps}</div>
                    <div style={{ fontSize: 12, color: C.textMuted }}>חסר בחלק מהפלטפורמות</div>
                  </div>
                  <div style={{ ...cardStyle, textAlign: "center" }}>
                    <div style={{ fontSize: 28, fontWeight: 800, color: C.success }}>
                      {uniqueQueries.length - totalGaps}
                    </div>
                    <div style={{ fontSize: 12, color: C.textMuted }}>מופיע בכל הפלטפורמות</div>
                  </div>
                </div>

                {/* Gaps list */}
                <div style={{ ...cardStyle }}>
                  <h3 style={{ ...sectionTitle }}>📝 שאילתות שבהן העסק לא מופיע</h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {sortedGaps.map(([query, data], i) => {
                      const decoded = query.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#39;/g, "'");
                      const isCritical = data.platforms.length === data.totalPlatforms;
                      return (
                        <div key={i} style={{
                          padding: "14px 16px", borderRadius: 14,
                          background: isCritical ? `${C.danger}04` : C.bg,
                          border: `1px solid ${isCritical ? `${C.danger}20` : C.borderLight}`,
                        }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 6 }}>
                                {decoded}
                              </div>
                              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                                {data.platforms.map(pid => {
                                  const pd = PLATFORM_DISPLAY[pid] || { name: pid, icon: "🔍" };
                                  return (
                                    <span key={pid} style={{
                                      ...tagStyle,
                                      background: `${C.danger}10`,
                                      color: C.danger,
                                    }}>
                                      {pd.icon} לא מופיע ב-{pd.name}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                            <span style={{
                              ...tagStyle, flexShrink: 0,
                              background: isCritical ? `${C.danger}15` : `${C.warning}15`,
                              color: isCritical ? C.danger : C.warning,
                            }}>
                              {isCritical ? "קריטי" : "חלקי"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Plan-level content gaps if available */}
                {planGaps.length > 0 && (
                  <div style={{ ...cardStyle, marginTop: 20 }}>
                    <h3 style={{ ...sectionTitle }}>🔍 הזדמנויות תוכן מזוהות</h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {planGaps.map((gap: any, i: number) => (
                        <div key={i} style={{
                          display: "flex", alignItems: "center", gap: 12,
                          padding: "12px 16px", borderRadius: 12, background: C.bg,
                          border: `1px solid ${C.borderLight}`,
                        }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{gap.query || gap.title}</div>
                            {gap.category && (
                              <span style={{ ...tagStyle, marginTop: 4, background: `${C.primary}10`, color: C.primary }}>
                                {gap.category}
                              </span>
                            )}
                          </div>
                          {gap.importance && (
                            <span style={{
                              ...tagStyle,
                              background: gap.importance === 'high' ? `${C.danger}15` : gap.importance === 'medium' ? `${C.warning}15` : `${C.info}15`,
                              color: gap.importance === 'high' ? C.danger : gap.importance === 'medium' ? C.warning : C.info,
                            }}>
                              {gap.importance === 'high' ? 'גבוהה' : gap.importance === 'medium' ? 'בינונית' : 'נמוכה'}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
          );
        })()}

        {/* ── SEO KEYWORDS ── */}
        {activeTab === "keywords" && (() => {
          // Group keywords by category
          const groupedByCategory = new Map<string, any[]>();
          autoKeywords.forEach(kw => {
            if (!groupedByCategory.has(kw.category)) {
              groupedByCategory.set(kw.category, []);
            }
            groupedByCategory.get(kw.category)!.push(kw);
          });

          // Category display config
          const categoryConfig: Record<string, { label: string; color: string; icon: string }> = {
            purchase_intent: { label: "כוונת רכישה", color: C.danger, icon: "💳" },
            location: { label: "מיקום", color: C.primary, icon: "📍" },
            product: { label: "מוצר/שירות", color: C.info, icon: "📦" },
            trust: { label: "אמון ומותג", color: C.success, icon: "⭐" },
          };

          // Calculate stats
          const totalKeywords = autoKeywords.length;
          const foundInGoogle = autoKeywords.filter(kw => kw.googlePosition !== null && kw.googlePosition <= 10).length;
          const foundInAI = autoKeywords.filter(kw => kw.aiMentioned).length;
          const avgPosition = autoKeywords
            .filter(kw => kw.googlePosition !== null)
            .reduce((sum, kw) => sum + (kw.googlePosition || 0), 0) / Math.max(1, autoKeywords.filter(kw => kw.googlePosition !== null).length);

          return (
            <div>
              {totalKeywords === 0 ? (
                <EmptyTab icon="🔑" text="אין ביטויי SEO זמינים. בדוק שהסריקה טכנית הושלמה." />
              ) : (
                <>
                  {/* Summary stats */}
                  <div style={{
                    display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 20,
                  }}>
                    {[
                      { label: "ביטויים כלל", value: totalKeywords, color: C.text, icon: "🔑" },
                      { label: "בעמוד 1 בגוגל", value: foundInGoogle, color: C.success, icon: "🏆" },
                      { label: "נמצאים ב-AI", value: foundInAI, color: C.primary, icon: "🤖" },
                      { label: "דירוג ממוצע", value: avgPosition > 0 ? Math.round(avgPosition) : "—", color: foundInGoogle > 0 ? C.success : C.warning, icon: "📊" },
                    ].map((stat, i) => (
                      <div key={i} style={{
                        background: C.card,
                        borderRadius: 14,
                        border: `1px solid ${C.border}`,
                        padding: "14px 16px",
                        textAlign: "center",
                      }}>
                        <div style={{ fontSize: 18, marginBottom: 6 }}>{stat.icon}</div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: stat.color, marginBottom: 4 }}>
                          {s(stat.value)}
                        </div>
                        <div style={{ fontSize: 11, color: C.textMuted }}>{stat.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Category sections */}
                  {Array.from(groupedByCategory.entries()).map(([catKey, keywords]) => {
                    const config = categoryConfig[catKey as string] || { label: catKey, color: C.text, icon: "📌" };
                    return (
                      <div key={catKey} style={{
                        marginBottom: 24,
                        ...cardStyle,
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                          <span style={{ fontSize: 18 }}>{config.icon}</span>
                          <h3 style={{ ...sectionTitle, margin: 0 }}>{config.label}</h3>
                          <span style={{
                            ...tagStyle,
                            background: `${config.color}15`,
                            color: config.color,
                            marginLeft: "auto",
                          }}>
                            {keywords.length} ביטויים
                          </span>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          {keywords.map(kw => {
                            const isExpanded = expandedKeyword === kw.id;
                            const statusColor = !kw.googlePosition
                              ? C.warning
                              : kw.googlePosition <= 5
                                ? C.success
                                : kw.googlePosition <= 10
                                  ? C.info
                                  : C.warning;

                            return (
                              <div
                                key={kw.id}
                                style={{
                                  padding: "14px 16px",
                                  borderRadius: 12,
                                  background: C.bg,
                                  border: `1px solid ${C.borderLight}`,
                                  cursor: "pointer",
                                  transition: "all 0.2s",
                                }}
                                onClick={() => setExpandedKeyword(isExpanded ? null : kw.id)}
                              >
                                <div style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  gap: 12,
                                }}>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{
                                      fontSize: 13,
                                      fontWeight: 600,
                                      color: C.text,
                                      wordBreak: "break-word",
                                    }}>
                                      {s(kw.keyword)}
                                    </div>
                                  </div>

                                  <div style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                    flexShrink: 0,
                                  }}>
                                    {/* Google position badge */}
                                    <span style={{
                                      ...tagStyle,
                                      background: `${statusColor}15`,
                                      color: statusColor,
                                      minWidth: 70,
                                      textAlign: "center",
                                    }}>
                                      {kw.googlePosition !== null ? `#${kw.googlePosition}` : "לא נמצא"}
                                    </span>

                                    {/* AI status badge */}
                                    <span style={{
                                      ...tagStyle,
                                      background: kw.aiMentioned ? `${C.success}15` : `${C.danger}15`,
                                      color: kw.aiMentioned ? C.success : C.danger,
                                    }}>
                                      {kw.aiMentioned ? "✓ AI" : "✗ AI"}
                                    </span>

                                    {/* Expand toggle */}
                                    <span style={{
                                      fontSize: 12,
                                      color: C.textMuted,
                                    }}>
                                      {isExpanded ? "▼" : "▶"}
                                    </span>
                                  </div>
                                </div>

                                {/* Expandable action plan */}
                                {isExpanded && (
                                  <div style={{
                                    marginTop: 12,
                                    paddingTop: 12,
                                    borderTop: `1px solid ${C.border}`,
                                  }}>
                                    <div style={{
                                      fontSize: 12,
                                      color: C.textSecondary,
                                      lineHeight: "1.5",
                                    }}>
                                      <span style={{ fontWeight: 600, color: C.text }}>תוכנית פעולה:</span>
                                      <br />
                                      {s(kw.actionPlan)}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          );
        })()}

        {/* ── REPORTS ── */}
        {activeTab === "reports" && (
          <div style={{ ...cardStyle }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <h3 style={{ ...sectionTitle, margin: 0 }}>📄 דוחות</h3>
              <button
                onClick={handleGenerateReport}
                disabled={generatingReport}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "10px 24px", background: C.primary, color: "#fff",
                  border: "none", borderRadius: 10, fontSize: 13, fontWeight: 600,
                  cursor: generatingReport ? "wait" : "pointer",
                  opacity: generatingReport ? 0.7 : 1,
                }}
              >
                <span>{generatingReport ? "⏳" : "+"}</span>
                {generatingReport ? "מייצר דוח..." : "הפק דוח חדש"}
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {reports.length > 0 ? reports.map((report) => (
                <div key={report.id} style={{
                  display: "flex", alignItems: "center", gap: 16,
                  padding: "16px 20px", borderRadius: 14, background: C.bg,
                  border: `1px solid ${C.borderLight}`,
                }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                    background: `${C.danger}10`, display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 22,
                  }}>📄</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{s(report.name)}</div>
                    <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
                      {fmtDate(report.generatedAt)}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      onClick={() => router.push(`/seo-geo/${p.id}/report?lang=he`)}
                      style={{ ...smallBtnStyle }}
                    >👁️ צפה</button>
                    <button
                      onClick={() => {
                        router.push(`/seo-geo/${p.id}/report?lang=he`);
                        // The report viewer page has a print button for PDF export
                      }}
                      style={{ ...smallBtnStyle }}
                    >📥 PDF</button>
                    <button style={{ ...smallBtnStyle }}>📧 שלח</button>
                  </div>
                </div>
              )) : null}

              {/* Empty / hint area */}
              <div style={{
                textAlign: "center", padding: reports.length === 0 ? 48 : 24,
                color: C.textMuted, fontSize: 13,
                border: `2px dashed ${C.borderLight}`, borderRadius: 14,
              }}>
                {reports.length === 0 ? (
                  <>
                    <div style={{
                      width: 56, height: 56, borderRadius: 14, margin: "0 auto 16px",
                      background: C.primaryLight, display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 28,
                    }}>📊</div>
                    <div style={{ fontWeight: 600, color: C.text, fontSize: 15, marginBottom: 6 }}>
                      עדיין לא הופק דוח
                    </div>
                    <div>
                      הפק דוח חדש כדי לשתף עם הלקוח ממצאי סריקה, תוצאות AI ותוכנית פעולה
                    </div>
                    <button
                      onClick={handleGenerateReport}
                      disabled={generatingReport}
                      style={{
                        marginTop: 16, padding: "10px 28px", background: C.primary, color: "#fff",
                        border: "none", borderRadius: 10, fontSize: 13, fontWeight: 600,
                        cursor: generatingReport ? "wait" : "pointer",
                      }}
                    >
                      {generatingReport ? "מייצר..." : "הפק דוח ראשון"}
                    </button>
                  </>
                ) : (
                  <>לחץ על &quot;הפק דוח חדש&quot; כדי ליצור דוח מעודכן</>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// SHARED STYLES
// ══════════════════════════════════════════════════════════════

const cardStyle: React.CSSProperties = {
  background: "#FFFFFF", borderRadius: 20, border: "1px solid #E8EAF0",
  padding: 24, boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
};

const sectionTitle: React.CSSProperties = {
  fontSize: 16, fontWeight: 700, color: "#1A1A2E", margin: "0 0 16px 0",
};

const tagStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 6,
  display: "inline-flex", alignItems: "center", gap: 3,
};

const thStyle: React.CSSProperties = {
  padding: "12px 14px", textAlign: "right", fontWeight: 600,
  color: "#9A9AB0", fontSize: 12, borderBottom: "2px solid #E8EAF0",
};

const tdStyle: React.CSSProperties = {
  padding: "12px 14px", verticalAlign: "middle",
};

const smallBtnStyle: React.CSSProperties = {
  padding: "6px 12px", background: "transparent",
  border: "1px solid #E8EAF0", borderRadius: 8,
  fontSize: 11, color: "#5A5A7A", cursor: "pointer", fontWeight: 500,
};

// ── Empty Tab Component ──
function EmptyTab({ icon, text }: { icon: string; text: string }) {
  return (
    <div style={{
      background: "#FFFFFF", borderRadius: 24, border: "1px solid #E8EAF0",
      padding: "64px 40px", textAlign: "center",
      boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
    }}>
      <div style={{
        width: 72, height: 72, borderRadius: 18, margin: "0 auto 20px",
        background: "#E6F7FF", display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 36,
      }}>{typeof icon === 'string' ? icon : String(icon)}</div>
      <p style={{ fontSize: 14, color: "#9A9AB0", maxWidth: 420, margin: "0 auto", lineHeight: 1.7 }}>{typeof text === 'string' ? text : String(text)}</p>
    </div>
  );
}
