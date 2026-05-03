"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// ══════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════

interface Client {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  websiteUrl: string;
  businessField: string;
  status: string;
}

interface Website {
  id: string;
  client_id: string;
  url: string;
  domain: string;
  label: string;
  is_primary: boolean;
  status: string;
}

interface ScanIssue {
  type: "critical" | "warning" | "info";
  category: string;
  title: string;
  description: string;
  impact: "high" | "medium" | "low";
}

interface ScanResult {
  url: string;
  scannedAt: string;
  hasSSL: boolean;
  loadTimeMs: number;
  mobileOptimized: boolean;
  metaTitle: string;
  metaDescription: string;
  h1Tags: string[];
  totalPages: number;
  indexedPages: number;
  brokenLinks: number;
  hasRobotsTxt: boolean;
  hasSitemap: boolean;
  domainAuthority: number;
  structuredData: boolean;
  openGraph: boolean;
  canonicalTags: boolean;
  issues: ScanIssue[];
}

interface Goal {
  id: string;
  type: string;
  label: string;
  icon: string;
  desc: string;
  selected: boolean;
  targetMetric: string;
  currentValue: number;
  targetValue: number;
  priority: "high" | "medium" | "low";
}

interface VisibilityQuery {
  id: string;
  query: string;
  category: string;
  intent: string;
  importance: string;
}

interface VisibilityEngineResult {
  engine: string;
  mentioned: boolean;
  position: number | null;
  sentiment: string;
}

interface VisibilityResult {
  queryId: string;
  query: string;
  results: VisibilityEngineResult[];
}

interface Insight {
  id: string;
  category: "opportunity" | "threat" | "strength" | "weakness";
  title: string;
  description: string;
  impact: "high" | "medium" | "low";
  action: string;
}

interface PlanWeek {
  weekNumber: number;
  startDate: string;
  endDate: string;
  theme: string;
  focus: string;
  tasks: PlanTask[];
}

interface PlanTask {
  id: string;
  title: string;
  category: string;
  priority: string;
  estimatedHours: number;
  deliverable: string;
  kpiTarget: string;
}

interface DayPlan {
  day: number;
  date: string;
  phase: string;
  phaseNumber: number;
  focusTitle: string;
  tasks: DayTask[];
}

interface DayTask {
  id: string;
  title: string;
  type: string;
  description: string;
  impactLevel: string;
  effortHours: number;
  relatedPageUrl: string | null;
  expectedOutcome: string;
  reason: string;
  contentBrief: string | null;
}

interface PhaseOverview {
  number: number;
  name: string;
  dayRange: string;
  taskCount: number;
  hours: number;
  focus: string;
}

interface WizardData {
  // Entry mode
  entryMode: "global" | "from_client";
  clientMode: "existing" | "new" | null;
  // Client
  clientId: string;
  clientName: string;
  clientCompany: string;
  clientEmail: string;
  clientPhone: string;
  clientBusinessField: string;
  // Website
  websiteId: string;
  websiteUrl: string;
  websiteLabel: string;
  // Scan
  scanResult: ScanResult | null;
  // Goals
  goals: Goal[];
  // AI Visibility
  visibilityQueries: VisibilityQuery[];
  visibilityResults: VisibilityResult[];
  visibilityScore: number;
  // Insights
  insights: Insight[];
  // Plan (new 60-day format)
  days: DayPlan[];
  phases: PhaseOverview[];
  // Plan (backward-compat weekly format)
  weeks: PlanWeek[];
  totalTasks: number;
  totalHours: number;
  // Save
  savedPlanId: string;
}

// ══════════════════════════════════════════════════════════════
// CONSTANTS
// ══════════════════════════════════════════════════════════════

const STEPS = [
  { key: 1, label: "בחירת לקוח", icon: "👤", desc: "בחר לקוח קיים או צור חדש" },
  { key: 2, label: "בחירת אתר", icon: "🌐", desc: "בחר או הוסף אתר ללקוח" },
  { key: 3, label: "הגדרת יעדים", icon: "🎯", desc: "הגדר יעדי SEO/GEO" },
  { key: 4, label: "סריקת אתר", icon: "🔍", desc: "סריקה טכנית מלאה" },
  { key: 5, label: "נראות AI", icon: "🤖", desc: "סריקת נוכחות במנועי AI" },
  { key: 6, label: "תובנות", icon: "💡", desc: "ניתוח ותובנות" },
  { key: 7, label: "תוכנית 60 יום", icon: "📋", desc: "תוכנית פעולה מפורטת" },
];

const GOAL_TYPES: Array<{ value: string; label: string; icon: string; desc: string; metric: string }> = [
  { value: "traffic", label: "תנועה אורגנית", icon: "📈", desc: "הגדלת תנועה מחיפוש אורגני", metric: "ביקורים/חודש" },
  { value: "leads", label: "לידים", icon: "🎯", desc: "הגדלת לידים מהאתר", metric: "לידים/חודש" },
  { value: "rankings", label: "דירוגים", icon: "🏆", desc: "שיפור מיקום בתוצאות חיפוש", metric: "מילים בעמוד 1" },
  { value: "local_visibility", label: "SEO מקומי", icon: "📍", desc: "חיזוק נוכחות מקומית", metric: "ביקורים מקומיים/חודש" },
  { value: "ai_visibility", label: "נראות AI", icon: "🤖", desc: "הופעה במנועי AI", metric: "% אזכורים" },
  { value: "brand_authority", label: "סמכות מותג", icon: "👑", desc: "בניית סמכות וE-E-A-T", metric: "Domain Authority" },
];

const AI_ENGINES = ["ChatGPT", "Gemini", "Perplexity", "Claude", "Copilot"];

const C = {
  primary: "#00B5FE",
  primaryDark: "#0095D0",
  primaryLight: "#E6F7FF",
  accent: "#E8F401",
  accentDark: "#C8D400",
  bg: "#F7F9FC",
  card: "#FFFFFF",
  text: "#1A1A2E",
  textSecondary: "#5A5A7A",
  textMuted: "#9A9AB0",
  border: "#E8EAF0",
  borderLight: "#F0F2F5",
  success: "#10B981",
  warning: "#F59E0B",
  danger: "#EF4444",
  info: "#3B82F6",
};

const INITIAL_DATA: WizardData = {
  entryMode: "global",
  clientMode: null,
  clientId: "",
  clientName: "",
  clientCompany: "",
  clientEmail: "",
  clientPhone: "",
  clientBusinessField: "",
  websiteId: "",
  websiteUrl: "",
  websiteLabel: "",
  scanResult: null,
  goals: GOAL_TYPES.map((g, i) => ({
    id: `goal_${i}`,
    type: g.value,
    label: g.label,
    icon: g.icon,
    desc: g.desc,
    selected: false,
    targetMetric: g.metric,
    currentValue: 0,
    targetValue: 0,
    priority: "medium" as const,
  })),
  visibilityQueries: [],
  visibilityResults: [],
  visibilityScore: 0,
  insights: [],
  days: [],
  phases: [],
  weeks: [],
  totalTasks: 0,
  totalHours: 0,
  savedPlanId: "",
};

// ══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════

export default function SeoGeoWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState(1);
  const [data, setData] = useState<WizardData>({ ...INITIAL_DATA });
  const [saving, setSaving] = useState(false);
  const [transitioning, setTransitioning] = useState(false);

  // Client lists
  const [clients, setClients] = useState<Client[]>([]);
  const [clientSearch, setClientSearch] = useState("");
  const [loadingClients, setLoadingClients] = useState(false);

  // Website lists
  const [websites, setWebsites] = useState<Website[]>([]);
  const [loadingWebsites, setLoadingWebsites] = useState(false);
  const [addingWebsite, setAddingWebsite] = useState(false);
  const [newWebsiteUrl, setNewWebsiteUrl] = useState("");

  // Scan state
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);

  // Visibility state
  const [scanningVisibility, setScanningVisibility] = useState(false);
  const [visibilityProgress, setVisibilityProgress] = useState(0);
  const [editingQueries, setEditingQueries] = useState(false);

  // Plan state
  const [generatingPlan, setGeneratingPlan] = useState(false);
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set([1]));
  const [expandedPhases, setExpandedPhases] = useState<Set<number>>(new Set([1]));
  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set());

  // New client form
  const [creatingClient, setCreatingClient] = useState(false);

  // Error handling
  const [errorMsg, setErrorMsg] = useState<string>("");

  // ── Initialize from URL params (entry mode detection) ──
  useEffect(() => {
    const clientId = searchParams.get("clientId");
    const clientName = searchParams.get("clientName");
    const websiteUrl = searchParams.get("websiteUrl");

    if (clientId) {
      // Mode A/C/D: Coming from client profile
      setData(prev => ({
        ...prev,
        entryMode: "from_client",
        clientMode: "existing",
        clientId,
        clientName: clientName ? decodeURIComponent(clientName) : "",
        websiteUrl: websiteUrl ? decodeURIComponent(websiteUrl) : "",
      }));
      // Skip step 1 — go directly to step 2
      setStep(2);
      // Fetch websites for this client
      fetchWebsites(clientId);
    } else {
      // Mode B/E: Global creation
      fetchClients();
    }
  }, [searchParams]);

  // ── API helpers ──
  const fetchClients = async () => {
    setLoadingClients(true);
    try {
      const res = await fetch("/api/data/clients");
      if (res.ok) {
        const list = await res.json();
        setClients(Array.isArray(list) ? list : []);
      }
    } catch (e) {
      console.error("Failed to fetch clients:", e);
      setErrorMsg("שגיאה: לא ניתן לטעון את רשימת הלקוחות");
    }
    setLoadingClients(false);
  };

  const fetchWebsites = async (clientId: string) => {
    setLoadingWebsites(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/websites`);
      if (res.ok) {
        const list = await res.json();
        setWebsites(Array.isArray(list) ? list : []);
      }
    } catch (e) {
      console.error("Failed to fetch websites:", e);
      setErrorMsg("שגיאה: לא ניתן לטעון את רשימת האתרים");
    }
    setLoadingWebsites(false);
  };

  const createClient = async () => {
    if (!data.clientName.trim()) return;
    setCreatingClient(true);
    try {
      const res = await fetch("/api/data/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.clientName,
          company: data.clientCompany,
          email: data.clientEmail,
          phone: data.clientPhone,
          businessField: data.clientBusinessField,
          websiteUrl: data.websiteUrl,
          status: "active",
          clientType: "marketing",
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setData(prev => ({ ...prev, clientId: created.id, clientMode: "existing" }));
        setErrorMsg("");
        await fetchClients();
        goToStep(2);
      } else {
        setErrorMsg("שגיאה: לא ניתן ליצור לקוח חדש");
      }
    } catch (e) {
      console.error("Failed to create client:", e);
      setErrorMsg("שגיאה: בעיה בחיבור לשרת");
    }
    setCreatingClient(false);
  };

  const runScan = async () => {
    if (!data.websiteUrl) return;
    setScanning(true);
    setScanProgress(0);
    setErrorMsg("");

    // Simulate progress
    const interval = setInterval(() => {
      setScanProgress(p => Math.min(p + Math.random() * 15, 90));
    }, 400);

    try {
      const res = await fetch("/api/seo/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: data.websiteUrl }),
      });
      if (res.ok) {
        const scan = await res.json();
        setScanProgress(100);
        setTimeout(() => {
          setData(prev => ({ ...prev, scanResult: scan }));
          setScanning(false);
        }, 500);
      } else {
        setErrorMsg("שגיאה: הסריקה נכשלה");
        setScanning(false);
      }
    } catch (e) {
      console.error("Scan failed:", e);
      setErrorMsg("שגיאה: בעיה בסריקת האתר");
      setScanning(false);
    }
    clearInterval(interval);
  };

  const runVisibilityScan = async () => {
    if (!data.visibilityQueries.length) return;
    setScanningVisibility(true);
    setVisibilityProgress(0);
    setErrorMsg("");

    const interval = setInterval(() => {
      setVisibilityProgress(p => Math.min(p + Math.random() * 12, 90));
    }, 500);

    try {
      const res = await fetch("/api/seo/visibility", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          queries: data.visibilityQueries,
          businessName: data.clientName,
          websiteUrl: data.websiteUrl,
        }),
      });
      if (res.ok) {
        const { results, visibilityScore } = await res.json();
        setVisibilityProgress(100);

        // Group results by query
        const grouped: VisibilityResult[] = [];
        const queryMap = new Map<string, VisibilityEngineResult[]>();
        for (const r of results) {
          if (!queryMap.has(r.queryId)) queryMap.set(r.queryId, []);
          queryMap.get(r.queryId)!.push({
            engine: r.engine,
            mentioned: r.mentioned,
            position: r.position,
            sentiment: r.sentiment,
          });
        }
        for (const q of data.visibilityQueries) {
          grouped.push({
            queryId: q.id,
            query: q.query,
            results: queryMap.get(q.id) || [],
          });
        }

        // Generate insights
        const insights = generateInsights(data.scanResult, visibilityScore, grouped);

        setTimeout(() => {
          setData(prev => ({
            ...prev,
            visibilityResults: grouped,
            visibilityScore,
            insights,
          }));
          setScanningVisibility(false);
        }, 500);
      } else {
        setErrorMsg("שגיאה: סריקת ה-AI נכשלה");
        setScanningVisibility(false);
      }
    } catch (e) {
      console.error("Visibility scan failed:", e);
      setErrorMsg("שגיאה: בעיה בסריקת ה-AI");
      setScanningVisibility(false);
    }
    clearInterval(interval);
  };

  const generateInsights = (scan: ScanResult | null, visScore: number, visResults: VisibilityResult[]): Insight[] => {
    const insights: Insight[] = [];
    let idx = 0;

    if (scan) {
      if (!scan.hasSSL) insights.push({ id: `ins_${idx++}`, category: "threat", title: "אין תעודת SSL", description: "האתר לא מאובטח ב-HTTPS. גוגל מעניש אתרים ללא SSL.", impact: "high", action: "התקן תעודת SSL מיידית" });
      if (scan.loadTimeMs > 3000) insights.push({ id: `ins_${idx++}`, category: "weakness", title: "זמן טעינה איטי", description: `זמן טעינה ${(scan.loadTimeMs/1000).toFixed(1)} שניות. מומלץ מתחת ל-3 שניות.`, impact: "medium", action: "בצע אופטימיזציית מהירות" });
      if (!scan.hasSitemap) insights.push({ id: `ins_${idx++}`, category: "weakness", title: "חסר Sitemap", description: "לא נמצא קובץ sitemap.xml. זה פוגע באינדוקס.", impact: "medium", action: "צור והגש sitemap.xml" });
      if (scan.brokenLinks > 0) insights.push({ id: `ins_${idx++}`, category: "threat", title: `${scan.brokenLinks} קישורים שבורים`, description: "קישורים שבורים פוגעים בחוויית המשתמש ובדירוג.", impact: "medium", action: "תקן או הסר קישורים שבורים" });
      if (scan.domainAuthority > 30) insights.push({ id: `ins_${idx++}`, category: "strength", title: "סמכות דומיין טובה", description: `DA ${scan.domainAuthority} — בסיס טוב לצמיחה.`, impact: "high", action: "המשך לבנות קישורים איכותיים" });
      if (scan.structuredData) insights.push({ id: `ins_${idx++}`, category: "strength", title: "Structured Data קיים", description: "האתר כולל נתונים מובנים — יתרון בתוצאות חיפוש.", impact: "medium", action: "הרחב Schema לדפים נוספים" });
    }

    if (visScore >= 60) insights.push({ id: `ins_${idx++}`, category: "strength", title: "נראות AI טובה", description: `ציון ${visScore}% — העסק מוזכר ברוב מנועי ה-AI.`, impact: "high", action: "שמור על נוכחות עקבית" });
    else if (visScore >= 30) insights.push({ id: `ins_${idx++}`, category: "opportunity", title: "פוטנציאל שיפור בנראות AI", description: `ציון ${visScore}% — יש מקום לשיפור משמעותי.`, impact: "high", action: "בנה תוכן E-E-A-T ו-Schema" });
    else insights.push({ id: `ins_${idx++}`, category: "threat", title: "נראות AI נמוכה", description: `ציון ${visScore}% — העסק כמעט לא מוזכר ב-AI.`, impact: "high", action: "אסטרטגיית GEO מיידית נדרשת" });

    insights.push({ id: `ins_${idx++}`, category: "opportunity", title: "תוכן מקצועי", description: "יצירת מאמרים מקצועיים תחזק סמכות ונראות.", impact: "high", action: "פרסם 2 מאמרים מקצועיים בחודש" });
    insights.push({ id: `ins_${idx++}`, category: "opportunity", title: "SEO מקומי", description: "אופטימיזציה מקומית תביא לקוחות מהאזור.", impact: "medium", action: "עדכן Google Business Profile" });

    return insights;
  };

  const generatePlan = async () => {
    setGeneratingPlan(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/seo/generate-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName: data.clientName,
          websiteUrl: data.websiteUrl,
          websiteScan: data.scanResult,
          scannedPages: [],
          visibilityResults: data.visibilityResults,
          visibilityQueries: data.visibilityQueries,
          competitors: [],
          contentGaps: [],
          goals: data.goals.filter(g => g.selected),
          targetKeywords: [],
          targetLocation: "ישראל",
          targetLanguage: "he",
          insights: data.insights,
        }),
      });
      if (res.ok) {
        const plan = await res.json();
        setData(prev => ({
          ...prev,
          days: plan.days || [],
          phases: plan.phases || [],
          weeks: plan.weeks || [],
          totalTasks: plan.totalTasks || 0,
          totalHours: Math.round(plan.totalHours || 0),
        }));
      } else {
        setErrorMsg("שגיאה: יצירת התוכנית נכשלה");
      }
    } catch (e) {
      console.error("Plan generation failed:", e);
      setErrorMsg("שגיאה: בעיה ביצירת התוכנית");
    }
    setGeneratingPlan(false);
  };

  const savePlan = async () => {
    setSaving(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/data/seo-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: data.clientId,
          clientName: data.clientName,
          websiteUrl: data.websiteUrl,
          status: "plan_generated",
          websiteScan: data.scanResult,
          goals: data.goals.filter(g => g.selected),
          visibilityQueries: data.visibilityQueries,
          visibilityResults: data.visibilityResults,
          insights: data.insights,
          days: data.days,
          phases: data.phases,
          weeks: data.weeks,
          overallScore: Math.round((
            (data.scanResult?.domainAuthority || 0) +
            data.visibilityScore +
            (data.scanResult?.hasSSL ? 20 : 0) +
            (data.scanResult?.hasSitemap ? 10 : 0)
          ) / 2),
          technicalScore: data.scanResult ? Math.round(
            (data.scanResult.hasSSL ? 25 : 0) +
            (data.scanResult.loadTimeMs < 3000 ? 25 : 10) +
            (data.scanResult.hasSitemap ? 25 : 0) +
            (data.scanResult.hasRobotsTxt ? 25 : 0)
          ) : 0,
          contentScore: Math.round(Math.random() * 30 + 40),
          visibilityScore: data.visibilityScore,
          totalTasks: data.totalTasks,
          completedTasks: 0,
        }),
      });
      if (res.ok) {
        const saved = await res.json();
        setData(prev => ({ ...prev, savedPlanId: saved.id }));
        router.push(`/seo-geo/${saved.id}`);
      } else {
        setErrorMsg("שגיאה: שמירת התוכנית נכשלה");
      }
    } catch (e) {
      console.error("Save failed:", e);
      setErrorMsg("שגיאה: בעיה בשמירת התוכנית");
    }
    setSaving(false);
  };

  // ── Navigation ──
  const goToStep = (target: number) => {
    if (target === step) return;
    setTransitioning(true);
    setTimeout(() => {
      setStep(target);
      setTransitioning(false);
    }, 200);
  };

  const canContinue = (): boolean => {
    switch (step) {
      case 1: return !!data.clientId;
      case 2: return !!data.websiteUrl;
      case 3: return data.goals.some(g => g.selected);
      case 4: return !!data.scanResult;
      case 5: return data.visibilityResults.length > 0;
      case 6: return data.insights.length > 0;
      case 7: return data.days.length > 0;
      default: return false;
    }
  };

  const handleNext = () => {
    if (step >= 7 || !canContinue()) return;
    const nextStep = step + 1;
    // Auto-generate visibility queries when entering step 5
    if (nextStep === 5 && data.visibilityQueries.length === 0) {
      const queries = generateDefaultQueries();
      setData(prev => ({ ...prev, visibilityQueries: queries }));
    }
    goToStep(nextStep);
  };

  const handleBack = () => {
    if (step > 1) {
      // If entered from client profile, don't go back to step 1
      if (step === 2 && data.entryMode === "from_client") {
        router.back();
        return;
      }
      goToStep(step - 1);
    }
  };

  const generateDefaultQueries = (): VisibilityQuery[] => {
    const business = data.clientName || data.clientCompany || "העסק";
    const field = data.clientBusinessField || "השירות";
    return [
      { id: "q1", query: `מה ה${field} הכי טוב בישראל?`, category: "comparison", intent: "commercial", importance: "high" },
      { id: "q2", query: `${business} ביקורות`, category: "brand", intent: "navigational", importance: "high" },
      { id: "q3", query: `איך לבחור ${field}?`, category: "general", intent: "informational", importance: "medium" },
      { id: "q4", query: `${field} מומלץ בתל אביב`, category: "local", intent: "commercial", importance: "high" },
      { id: "q5", query: `השוואת ${field}ים בישראל`, category: "comparison", intent: "commercial", importance: "medium" },
      { id: "q6", query: `מחיר ${field}`, category: "product", intent: "transactional", importance: "medium" },
      { id: "q7", query: `${field} למתחילים — מדריך`, category: "general", intent: "informational", importance: "low" },
      { id: "q8", query: `למה לבחור ב${business}?`, category: "brand", intent: "navigational", importance: "high" },
    ];
  };

  const updateData = (patch: Partial<WizardData>) => setData(prev => ({ ...prev, ...patch }));

  // ── Progress percentage ──
  const progress = Math.round((step / STEPS.length) * 100);

  // ══════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 999,
      display: "flex", flexDirection: "column",
      background: C.bg,
      direction: "rtl",
      fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
    }}>
      {/* ── TOP PROGRESS BAR ── */}
      <div style={{ height: 4, background: C.border, flexShrink: 0 }}>
        <div style={{
          height: "100%", width: `${progress}%`,
          background: `linear-gradient(90deg, ${C.primary}, ${C.accent})`,
          transition: "width 0.5s ease",
          borderRadius: "0 4px 4px 0",
        }} />
      </div>

      {/* ── MAIN LAYOUT ── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* ── LEFT STEP NAVIGATION (360px) ── */}
        <aside style={{
          width: 360, flexShrink: 0,
          background: C.card,
          borderLeft: `1px solid ${C.border}`,
          display: "flex", flexDirection: "column",
          padding: "32px 24px",
          overflowY: "auto",
        }}>
          {/* Header */}
          <div style={{ marginBottom: 40 }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 12,
              marginBottom: 8,
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 12,
                background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 20,
              }}>🔍</div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: C.text }}>SEO/GEO Plan</div>
                <div style={{ fontSize: 12, color: C.textMuted }}>בונה תוכנית צמיחה</div>
              </div>
            </div>
            {data.clientName && (
              <div style={{
                marginTop: 16, padding: "10px 14px",
                background: C.primaryLight, borderRadius: 10,
                fontSize: 13, color: C.primaryDark,
              }}>
                👤 {data.clientName}
                {data.websiteUrl && <span style={{ display: "block", fontSize: 11, marginTop: 2, color: C.textMuted }}>{data.websiteUrl}</span>}
              </div>
            )}
          </div>

          {/* Step list */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {STEPS.map((s, i) => {
              const isActive = s.key === step;
              const isCompleted = s.key < step;
              const isDisabled = s.key > step + 1;
              return (
                <button
                  key={s.key}
                  onClick={() => !isDisabled && goToStep(s.key)}
                  disabled={isDisabled}
                  style={{
                    display: "flex", alignItems: "center", gap: 14,
                    padding: "14px 16px",
                    background: isActive ? C.primaryLight : "transparent",
                    border: "none",
                    borderRadius: 12,
                    cursor: isDisabled ? "default" : "pointer",
                    opacity: isDisabled ? 0.4 : 1,
                    transition: "all 0.2s ease",
                    textAlign: "right",
                    width: "100%",
                  }}
                >
                  {/* Step number / check */}
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: isCompleted ? 16 : 14,
                    fontWeight: 700,
                    background: isCompleted ? C.success : isActive ? C.primary : C.borderLight,
                    color: isCompleted || isActive ? "#fff" : C.textMuted,
                    transition: "all 0.3s ease",
                    ...(isActive ? { boxShadow: `0 0 0 3px ${C.primary}33` } : {}),
                  }}>
                    {isCompleted ? "✓" : s.key}
                  </div>
                  {/* Label + desc */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 14, fontWeight: isActive ? 700 : 500,
                      color: isActive ? C.primary : C.text,
                      transition: "color 0.2s",
                    }}>{s.label}</div>
                    <div style={{
                      fontSize: 11, color: C.textMuted,
                      marginTop: 2,
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}>{s.desc}</div>
                  </div>
                  {/* Emoji */}
                  <span style={{ fontSize: 18, flexShrink: 0 }}>{s.icon}</span>
                </button>
              );
            })}
          </div>

          {/* Bottom exit button */}
          <div style={{ marginTop: "auto", paddingTop: 32 }}>
            <button
              onClick={() => router.push("/seo-geo/dashboard")}
              style={{
                width: "100%", padding: "12px 16px",
                background: "transparent", border: `1px solid ${C.border}`,
                borderRadius: 10, cursor: "pointer",
                fontSize: 13, color: C.textSecondary,
                transition: "all 0.2s",
              }}
            >
              → חזרה למרכז SEO/GEO
            </button>
          </div>
        </aside>

        {/* ── MAIN CONTENT AREA ── */}
        <main style={{
          flex: 1, overflow: "auto",
          display: "flex", flexDirection: "column",
        }}>
          {/* Content container */}
          <div style={{
            flex: 1, padding: "40px 48px",
            maxWidth: 980, margin: "0 auto", width: "100%",
            opacity: transitioning ? 0 : 1,
            transform: transitioning ? "translateY(10px)" : "translateY(0)",
            transition: "opacity 0.2s ease, transform 0.2s ease",
          }}>
            {/* Error banner */}
            {errorMsg && (
              <div style={{
                padding: "12px 20px", margin: "0 0 16px",
                background: "#FEE2E2", border: "1px solid #FCA5A5",
                borderRadius: 10, color: "#DC2626", fontSize: 14,
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <span>{errorMsg}</span>
                <button onClick={() => setErrorMsg("")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#DC2626" }}>✕</button>
              </div>
            )}
            {/* ═══ STEP 1: CLIENT SELECTION ═══ */}
            {step === 1 && (
              <div>
                <h1 style={{ fontSize: 28, fontWeight: 800, color: C.text, margin: 0 }}>בחירת לקוח</h1>
                <p style={{ fontSize: 15, color: C.textSecondary, marginTop: 8, marginBottom: 32 }}>
                  בחר לקוח קיים מהמערכת או צור לקוח חדש
                </p>

                {/* Mode cards */}
                {!data.clientMode && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 32 }}>
                    {[
                      { mode: "existing" as const, icon: "👥", title: "לקוח קיים", desc: "בחר מתוך הלקוחות במערכת" },
                      { mode: "new" as const, icon: "➕", title: "לקוח חדש", desc: "צור לקוח חדש ובנה תוכנית" },
                    ].map(m => (
                      <button key={m.mode} onClick={() => updateData({ clientMode: m.mode })} style={{
                        padding: 32, background: C.card, border: `2px solid ${C.border}`,
                        borderRadius: 20, cursor: "pointer", textAlign: "center",
                        transition: "all 0.2s",
                        boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
                      }}>
                        <div style={{ fontSize: 48, marginBottom: 16 }}>{m.icon}</div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: C.text }}>{m.title}</div>
                        <div style={{ fontSize: 13, color: C.textSecondary, marginTop: 8 }}>{m.desc}</div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Existing client search */}
                {data.clientMode === "existing" && !data.clientId && (
                  <div>
                    <input
                      value={clientSearch}
                      onChange={e => setClientSearch(e.target.value)}
                      placeholder="חפש לקוח לפי שם..."
                      style={{
                        width: "100%", padding: "14px 18px",
                        border: `1px solid ${C.border}`, borderRadius: 14,
                        fontSize: 15, outline: "none",
                        background: C.card,
                        marginBottom: 16,
                      }}
                    />
                    {loadingClients ? (
                      <div style={{ textAlign: "center", padding: 40, color: C.textMuted }}>
                        <div style={{ fontSize: 32, marginBottom: 12, animation: "spin 1s linear infinite" }}>⟳</div>
                        טוען לקוחות...
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 400, overflowY: "auto" }}>
                        {clients
                          .filter(c => !clientSearch || c.name.includes(clientSearch) || c.company?.includes(clientSearch))
                          .map(c => (
                            <button
                              key={c.id}
                              onClick={() => {
                                updateData({
                                  clientId: c.id,
                                  clientName: c.name,
                                  clientCompany: c.company,
                                  clientEmail: c.email,
                                  clientBusinessField: c.businessField || "",
                                  websiteUrl: c.websiteUrl || "",
                                });
                              }}
                              style={{
                                display: "flex", alignItems: "center", gap: 14,
                                padding: "16px 20px",
                                background: C.card, border: `1px solid ${C.border}`,
                                borderRadius: 14, cursor: "pointer",
                                textAlign: "right", width: "100%",
                                transition: "all 0.15s",
                              }}
                            >
                              <div style={{
                                width: 44, height: 44, borderRadius: 12,
                                background: C.primaryLight,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 18, fontWeight: 700, color: C.primary, flexShrink: 0,
                              }}>
                                {c.name.charAt(0)}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{c.name}</div>
                                <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
                                  {c.company && `${c.company} · `}{c.websiteUrl || "אין אתר"}
                                </div>
                              </div>
                              <span style={{ fontSize: 12, color: C.primary }}>בחר →</span>
                            </button>
                          ))}
                        {clients.length === 0 && !loadingClients && (
                          <div style={{ textAlign: "center", padding: 40, color: C.textMuted }}>
                            <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
                            <div>לא נמצאו לקוחות</div>
                            <button onClick={() => updateData({ clientMode: "new" })} style={{
                              marginTop: 12, padding: "8px 20px",
                              background: C.primary, color: "#fff",
                              border: "none", borderRadius: 8,
                              cursor: "pointer", fontSize: 13,
                            }}>צור לקוח חדש</button>
                          </div>
                        )}
                      </div>
                    )}
                    <button onClick={() => updateData({ clientMode: null })} style={{
                      marginTop: 16, fontSize: 13, color: C.textMuted,
                      background: "none", border: "none", cursor: "pointer",
                    }}>→ חזרה לבחירה</button>
                  </div>
                )}

                {/* New client form */}
                {data.clientMode === "new" && (
                  <div style={{
                    background: C.card, borderRadius: 20,
                    border: `1px solid ${C.border}`,
                    padding: 32, boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
                  }}>
                    <h3 style={{ fontSize: 18, fontWeight: 700, color: C.text, margin: "0 0 24px 0" }}>פרטי לקוח חדש</h3>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                      {[
                        { key: "clientName", label: "שם לקוח *", placeholder: "שם מלא", full: false },
                        { key: "clientCompany", label: "חברה", placeholder: "שם החברה", full: false },
                        { key: "clientEmail", label: "אימייל", placeholder: "email@example.com", full: false },
                        { key: "clientPhone", label: "טלפון", placeholder: "050-0000000", full: false },
                        { key: "clientBusinessField", label: "תחום עסקי", placeholder: "שיווק דיגיטלי, עיצוב...", full: false },
                        { key: "websiteUrl", label: "כתובת אתר *", placeholder: "https://example.co.il", full: false },
                      ].map(f => (
                        <div key={f.key} style={f.full ? { gridColumn: "1 / -1" } : {}}>
                          <label style={{ fontSize: 13, fontWeight: 600, color: C.textSecondary, display: "block", marginBottom: 6 }}>{f.label}</label>
                          <input
                            value={(data as any)[f.key] || ""}
                            onChange={e => updateData({ [f.key]: e.target.value } as any)}
                            placeholder={f.placeholder}
                            style={{
                              width: "100%", padding: "12px 16px",
                              border: `1px solid ${C.border}`, borderRadius: 10,
                              fontSize: 14, outline: "none", background: C.bg,
                            }}
                          />
                        </div>
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
                      <button
                        onClick={createClient}
                        disabled={!data.clientName.trim() || !data.websiteUrl.trim() || creatingClient}
                        style={{
                          padding: "12px 32px",
                          background: !data.clientName.trim() || !data.websiteUrl.trim() ? C.border : C.primary,
                          color: "#fff", border: "none", borderRadius: 10,
                          fontSize: 14, fontWeight: 600, cursor: "pointer",
                          opacity: creatingClient ? 0.7 : 1,
                        }}
                      >
                        {creatingClient ? "יוצר..." : "צור לקוח והמשך"}
                      </button>
                      <button onClick={() => updateData({ clientMode: null })} style={{
                        padding: "12px 20px", background: "transparent",
                        border: `1px solid ${C.border}`, borderRadius: 10,
                        fontSize: 13, color: C.textSecondary, cursor: "pointer",
                      }}>ביטול</button>
                    </div>
                  </div>
                )}

                {/* Selected client confirmation */}
                {data.clientId && data.clientMode === "existing" && (
                  <div style={{
                    background: C.card, borderRadius: 20,
                    border: `2px solid ${C.success}33`,
                    padding: 32, textAlign: "center",
                    boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
                  }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: C.text }}>{data.clientName}</div>
                    <div style={{ fontSize: 14, color: C.textSecondary, marginTop: 4 }}>
                      {data.clientCompany && `${data.clientCompany} · `}{data.websiteUrl || "אין אתר מוגדר"}
                    </div>
                    <button onClick={() => updateData({ clientId: "", clientName: "", clientMode: "existing" })} style={{
                      marginTop: 16, fontSize: 12, color: C.textMuted,
                      background: "none", border: "none", cursor: "pointer",
                    }}>שנה לקוח</button>
                  </div>
                )}
              </div>
            )}

            {/* ═══ STEP 2: WEBSITE SELECTION ═══ */}
            {step === 2 && (
              <div>
                <h1 style={{ fontSize: 28, fontWeight: 800, color: C.text, margin: 0 }}>בחירת אתר</h1>
                <p style={{ fontSize: 15, color: C.textSecondary, marginTop: 8, marginBottom: 32 }}>
                  בחר אתר קיים או הוסף כתובת אתר חדשה
                </p>

                {/* If client has a website URL, show it as option */}
                {data.websiteUrl && !addingWebsite && (
                  <div style={{
                    background: C.card, borderRadius: 20,
                    border: `2px solid ${C.primary}33`,
                    padding: 28, marginBottom: 20,
                    boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
                    display: "flex", alignItems: "center", gap: 16,
                  }}>
                    <div style={{
                      width: 52, height: 52, borderRadius: 14,
                      background: C.primaryLight,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 24,
                    }}>🌐</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{data.websiteUrl}</div>
                      <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>אתר ראשי של הלקוח</div>
                    </div>
                    <div style={{
                      padding: "6px 16px", background: `${C.success}15`,
                      color: C.success, borderRadius: 8,
                      fontSize: 13, fontWeight: 600,
                    }}>נבחר ✓</div>
                  </div>
                )}

                {/* Add new website */}
                {(!data.websiteUrl || addingWebsite) && (
                  <div style={{
                    background: C.card, borderRadius: 20,
                    border: `1px solid ${C.border}`,
                    padding: 32, boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
                  }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: C.text, margin: "0 0 16px 0" }}>
                      {addingWebsite ? "הוסף אתר נוסף" : "הזן כתובת אתר"}
                    </h3>
                    <div style={{ display: "flex", gap: 12 }}>
                      <input
                        value={newWebsiteUrl || data.websiteUrl}
                        onChange={e => {
                          if (addingWebsite) setNewWebsiteUrl(e.target.value);
                          else updateData({ websiteUrl: e.target.value });
                        }}
                        placeholder="https://example.co.il"
                        style={{
                          flex: 1, padding: "14px 18px",
                          border: `1px solid ${C.border}`, borderRadius: 12,
                          fontSize: 15, outline: "none", background: C.bg,
                        }}
                      />
                      <button
                        onClick={() => {
                          const urlToValidate = addingWebsite ? newWebsiteUrl : data.websiteUrl;
                          if (urlToValidate && (urlToValidate.startsWith("http://") || urlToValidate.startsWith("https://"))) {
                            if (addingWebsite && newWebsiteUrl) {
                              updateData({ websiteUrl: newWebsiteUrl });
                              setAddingWebsite(false);
                              setNewWebsiteUrl("");
                            }
                          }
                        }}
                        disabled={addingWebsite ? !newWebsiteUrl || (!newWebsiteUrl.startsWith("http://") && !newWebsiteUrl.startsWith("https://")) : (!data.websiteUrl || (!data.websiteUrl.startsWith("http://") && !data.websiteUrl.startsWith("https://")))}
                        style={{
                          padding: "14px 24px",
                          background: C.primary, color: "#fff",
                          border: "none", borderRadius: 12,
                          fontSize: 14, fontWeight: 600, cursor: "pointer",
                          opacity: (addingWebsite ? !newWebsiteUrl : !data.websiteUrl) ? 0.5 : 1,
                          whiteSpace: "nowrap",
                        }}
                      >אשר</button>
                    </div>
                  </div>
                )}

                {data.websiteUrl && !addingWebsite && (
                  <button onClick={() => setAddingWebsite(true)} style={{
                    marginTop: 16, fontSize: 13, color: C.primary,
                    background: "none", border: "none", cursor: "pointer",
                  }}>+ הוסף אתר אחר</button>
                )}
              </div>
            )}

            {/* ═══ STEP 3: GOALS ═══ */}
            {step === 3 && (
              <div>
                <h1 style={{ fontSize: 28, fontWeight: 800, color: C.text, margin: 0 }}>הגדרת יעדים</h1>
                <p style={{ fontSize: 15, color: C.textSecondary, marginTop: 8, marginBottom: 32 }}>
                  בחר את היעדים לתוכנית ה-SEO/GEO — ניתן לבחור כמה שרוצים
                </p>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16, marginBottom: 32 }}>
                  {data.goals.map((g, i) => (
                    <button
                      key={g.id}
                      onClick={() => {
                        const updated = [...data.goals];
                        updated[i] = { ...g, selected: !g.selected };
                        updateData({ goals: updated });
                      }}
                      style={{
                        padding: 24,
                        background: g.selected ? `${C.primary}08` : C.card,
                        border: `2px solid ${g.selected ? C.primary : C.border}`,
                        borderRadius: 16, cursor: "pointer",
                        textAlign: "right",
                        transition: "all 0.2s",
                        boxShadow: g.selected ? `0 0 0 3px ${C.primary}15` : "0 2px 8px rgba(0,0,0,0.03)",
                        position: "relative",
                      }}
                    >
                      {g.selected && (
                        <div style={{
                          position: "absolute", top: 12, left: 12,
                          width: 24, height: 24, borderRadius: 7,
                          background: C.primary, color: "#fff",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 14,
                        }}>✓</div>
                      )}
                      <div style={{ fontSize: 32, marginBottom: 12 }}>{g.icon}</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{g.label}</div>
                      <div style={{ fontSize: 12, color: C.textMuted, marginTop: 6 }}>{g.desc}</div>
                    </button>
                  ))}
                </div>

                {/* Target values for selected goals */}
                {data.goals.some(g => g.selected) && (
                  <div style={{
                    background: C.card, borderRadius: 20,
                    border: `1px solid ${C.border}`,
                    padding: 28, boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
                  }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: C.text, margin: "0 0 20px 0" }}>יעדים מספריים</h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      {data.goals.filter(g => g.selected).map((g, i) => (
                        <div key={g.id} style={{
                          display: "grid", gridTemplateColumns: "1fr 120px 120px 100px", gap: 12,
                          alignItems: "center",
                          padding: "12px 0",
                          borderBottom: i < data.goals.filter(x => x.selected).length - 1 ? `1px solid ${C.borderLight}` : "none",
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span style={{ fontSize: 20 }}>{g.icon}</span>
                            <div>
                              <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{g.label}</div>
                              <div style={{ fontSize: 11, color: C.textMuted }}>{g.targetMetric}</div>
                            </div>
                          </div>
                          <div>
                            <label style={{ fontSize: 10, color: C.textMuted, display: "block", marginBottom: 4 }}>ערך נוכחי</label>
                            <input
                              type="number"
                              value={g.currentValue || ""}
                              onChange={e => {
                                const updated = [...data.goals];
                                const idx = updated.findIndex(x => x.id === g.id);
                                updated[idx] = { ...g, currentValue: Number(e.target.value) };
                                updateData({ goals: updated });
                              }}
                              style={{
                                width: "100%", padding: "8px 10px",
                                border: `1px solid ${C.border}`, borderRadius: 8,
                                fontSize: 13, outline: "none", background: C.bg,
                              }}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: 10, color: C.textMuted, display: "block", marginBottom: 4 }}>יעד</label>
                            <input
                              type="number"
                              value={g.targetValue || ""}
                              onChange={e => {
                                const updated = [...data.goals];
                                const idx = updated.findIndex(x => x.id === g.id);
                                updated[idx] = { ...g, targetValue: Number(e.target.value) };
                                updateData({ goals: updated });
                              }}
                              style={{
                                width: "100%", padding: "8px 10px",
                                border: `1px solid ${C.border}`, borderRadius: 8,
                                fontSize: 13, outline: "none", background: C.bg,
                              }}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: 10, color: C.textMuted, display: "block", marginBottom: 4 }}>עדיפות</label>
                            <select
                              value={g.priority}
                              onChange={e => {
                                const updated = [...data.goals];
                                const idx = updated.findIndex(x => x.id === g.id);
                                updated[idx] = { ...g, priority: e.target.value as any };
                                updateData({ goals: updated });
                              }}
                              style={{
                                width: "100%", padding: "8px 10px",
                                border: `1px solid ${C.border}`, borderRadius: 8,
                                fontSize: 13, outline: "none", background: C.bg,
                                cursor: "pointer",
                              }}
                            >
                              <option value="high">גבוהה</option>
                              <option value="medium">בינונית</option>
                              <option value="low">נמוכה</option>
                            </select>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ═══ STEP 4: WEBSITE SCAN ═══ */}
            {step === 4 && (
              <div>
                <h1 style={{ fontSize: 28, fontWeight: 800, color: C.text, margin: 0 }}>סריקת אתר</h1>
                <p style={{ fontSize: 15, color: C.textSecondary, marginTop: 8, marginBottom: 32 }}>
                  סריקה טכנית מלאה של {data.websiteUrl || "האתר"}
                </p>

                {/* Scan button / progress */}
                {!data.scanResult && !scanning && (
                  <div style={{
                    background: C.card, borderRadius: 20, border: `1px solid ${C.border}`,
                    padding: 48, textAlign: "center", boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
                  }}>
                    <div style={{ fontSize: 64, marginBottom: 20 }}>🔍</div>
                    <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, margin: "0 0 12px 0" }}>מוכן לסריקה</h2>
                    <p style={{ fontSize: 14, color: C.textSecondary, marginBottom: 28, maxWidth: 400, margin: "0 auto 28px" }}>
                      הסריקה תבדוק SSL, מהירות טעינה, אופטימיזציה למובייל, מטא תגיות, קישורים, ועוד
                    </p>
                    <button
                      onClick={runScan}
                      style={{
                        padding: "14px 48px", background: C.primary, color: "#fff",
                        border: "none", borderRadius: 12, fontSize: 16, fontWeight: 700,
                        cursor: "pointer", transition: "all 0.2s",
                        boxShadow: `0 4px 16px ${C.primary}40`,
                      }}
                    >
                      התחל סריקה
                    </button>
                  </div>
                )}

                {/* Scanning animation */}
                {scanning && (
                  <div style={{
                    background: C.card, borderRadius: 20, border: `1px solid ${C.border}`,
                    padding: 48, textAlign: "center", boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
                  }}>
                    <div style={{ fontSize: 48, marginBottom: 20, animation: "pulse 1.5s ease-in-out infinite" }}>🔍</div>
                    <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, margin: "0 0 20px 0" }}>סורק את {data.websiteUrl}...</h2>
                    <div style={{
                      width: "100%", maxWidth: 400, margin: "0 auto", height: 8,
                      background: C.borderLight, borderRadius: 4, overflow: "hidden",
                    }}>
                      <div style={{
                        height: "100%", width: `${scanProgress}%`,
                        background: `linear-gradient(90deg, ${C.primary}, ${C.accent})`,
                        borderRadius: 4, transition: "width 0.3s ease",
                      }} />
                    </div>
                    <p style={{ fontSize: 13, color: C.textMuted, marginTop: 12 }}>
                      {scanProgress < 30 ? "בודק חיבור ו-SSL..." :
                       scanProgress < 60 ? "בודק מהירות ומטא תגיות..." :
                       scanProgress < 90 ? "סורק דפים ובודק קישורים..." : "מסיים..."}
                    </p>
                  </div>
                )}

                {/* Scan results */}
                {data.scanResult && !scanning && (
                  <div>
                    {/* Score overview */}
                    <div style={{
                      display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24,
                    }}>
                      {[
                        {
                          label: "ציון כללי",
                          value: Math.round((
                            (data.scanResult.hasSSL ? 25 : 0) +
                            (data.scanResult.loadTimeMs < 3000 ? 25 : 10) +
                            (data.scanResult.hasSitemap ? 25 : 0) +
                            (data.scanResult.hasRobotsTxt ? 25 : 0)
                          )),
                          suffix: "/100",
                          color: C.primary,
                        },
                        {
                          label: "Domain Authority",
                          value: data.scanResult.domainAuthority,
                          suffix: "/100",
                          color: data.scanResult.domainAuthority > 30 ? C.success : C.warning,
                        },
                        {
                          label: "בעיות שנמצאו",
                          value: data.scanResult.issues.length,
                          suffix: "",
                          color: data.scanResult.issues.length > 5 ? C.danger : C.warning,
                        },
                      ].map((kpi, i) => (
                        <div key={i} style={{
                          background: C.card, borderRadius: 16, border: `1px solid ${C.border}`,
                          padding: 24, textAlign: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
                        }}>
                          <div style={{ fontSize: 32, fontWeight: 800, color: kpi.color }}>{kpi.value}{kpi.suffix}</div>
                          <div style={{ fontSize: 13, color: C.textMuted, marginTop: 6 }}>{kpi.label}</div>
                        </div>
                      ))}
                    </div>

                    {/* Detail cards grid */}
                    <div style={{
                      display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12, marginBottom: 24,
                    }}>
                      {[
                        { icon: data.scanResult.hasSSL ? "🔒" : "🔓", label: "SSL", value: data.scanResult.hasSSL ? "מאובטח" : "לא מאובטח", ok: data.scanResult.hasSSL },
                        { icon: "⚡", label: "מהירות טעינה", value: `${(data.scanResult.loadTimeMs/1000).toFixed(1)}s`, ok: data.scanResult.loadTimeMs < 3000 },
                        { icon: "📱", label: "מובייל", value: data.scanResult.mobileOptimized ? "מותאם" : "לא מותאם", ok: data.scanResult.mobileOptimized },
                        { icon: "🏷️", label: "Meta Title", value: data.scanResult.metaTitle ? "קיים" : "חסר", ok: !!data.scanResult.metaTitle },
                        { icon: "📝", label: "Meta Description", value: data.scanResult.metaDescription ? "קיים" : "חסר", ok: !!data.scanResult.metaDescription },
                        { icon: "📄", label: "דפים", value: `${data.scanResult.totalPages} סה"כ`, ok: true },
                        { icon: "🗺️", label: "Sitemap", value: data.scanResult.hasSitemap ? "נמצא" : "חסר", ok: data.scanResult.hasSitemap },
                        { icon: "🤖", label: "Robots.txt", value: data.scanResult.hasRobotsTxt ? "נמצא" : "חסר", ok: data.scanResult.hasRobotsTxt },
                        { icon: "🔗", label: "קישורים שבורים", value: `${data.scanResult.brokenLinks}`, ok: data.scanResult.brokenLinks === 0 },
                        { icon: "📊", label: "Structured Data", value: data.scanResult.structuredData ? "קיים" : "חסר", ok: data.scanResult.structuredData },
                        { icon: "🌐", label: "Open Graph", value: data.scanResult.openGraph ? "קיים" : "חסר", ok: data.scanResult.openGraph },
                        { icon: "🔖", label: "Canonical Tags", value: data.scanResult.canonicalTags ? "קיים" : "חסר", ok: data.scanResult.canonicalTags },
                      ].map((item, i) => (
                        <div key={i} style={{
                          background: C.card, borderRadius: 12,
                          border: `1px solid ${item.ok ? `${C.success}30` : `${C.danger}30`}`,
                          padding: "14px 16px",
                          display: "flex", alignItems: "center", gap: 10,
                        }}>
                          <span style={{ fontSize: 20 }}>{item.icon}</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 11, color: C.textMuted }}>{item.label}</div>
                            <div style={{
                              fontSize: 13, fontWeight: 600,
                              color: item.ok ? C.success : C.danger,
                            }}>{item.value}</div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Issues list */}
                    {data.scanResult.issues.length > 0 && (
                      <div style={{
                        background: C.card, borderRadius: 16, border: `1px solid ${C.border}`,
                        padding: 24, boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
                      }}>
                        <h3 style={{ fontSize: 16, fontWeight: 700, color: C.text, margin: "0 0 16px 0" }}>
                          בעיות שנמצאו ({data.scanResult.issues.length})
                        </h3>
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          {data.scanResult.issues.map((issue, i) => (
                            <div key={i} style={{
                              display: "flex", alignItems: "flex-start", gap: 12,
                              padding: "12px 14px", borderRadius: 10,
                              background: issue.type === "critical" ? `${C.danger}08` :
                                         issue.type === "warning" ? `${C.warning}08` : `${C.info}08`,
                              border: `1px solid ${
                                issue.type === "critical" ? `${C.danger}20` :
                                issue.type === "warning" ? `${C.warning}20` : `${C.info}20`
                              }`,
                            }}>
                              <div style={{
                                width: 8, height: 8, borderRadius: 4, marginTop: 5, flexShrink: 0,
                                background: issue.type === "critical" ? C.danger :
                                           issue.type === "warning" ? C.warning : C.info,
                              }} />
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{issue.title}</div>
                                <div style={{ fontSize: 12, color: C.textSecondary, marginTop: 2 }}>{issue.description}</div>
                              </div>
                              <div style={{
                                fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 6,
                                color: issue.type === "critical" ? C.danger :
                                       issue.type === "warning" ? C.warning : C.info,
                                background: issue.type === "critical" ? `${C.danger}15` :
                                           issue.type === "warning" ? `${C.warning}15` : `${C.info}15`,
                              }}>
                                {issue.type === "critical" ? "קריטי" : issue.type === "warning" ? "אזהרה" : "מידע"}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Rescan button */}
                    <div style={{ marginTop: 20, textAlign: "center" }}>
                      <button
                        onClick={() => { setData(prev => ({ ...prev, scanResult: null })); }}
                        style={{
                          padding: "10px 24px", background: "transparent",
                          border: `1px solid ${C.border}`, borderRadius: 10,
                          fontSize: 13, color: C.textSecondary, cursor: "pointer",
                        }}
                      >
                        סרוק מחדש
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ═══ STEP 5: AI VISIBILITY SCAN ═══ */}
            {step === 5 && (
              <div>
                <h1 style={{ fontSize: 28, fontWeight: 800, color: C.text, margin: 0 }}>נראות במנועי AI</h1>
                <p style={{ fontSize: 15, color: C.textSecondary, marginTop: 8, marginBottom: 32 }}>
                  בדיקת הנוכחות של {data.clientName || "העסק"} ב-ChatGPT, Gemini, Perplexity, Claude ו-Copilot
                </p>

                {/* Auto-generate queries if empty */}
                {data.visibilityQueries.length === 0 && (() => {
                  const queries = generateDefaultQueries();
                  setTimeout(() => updateData({ visibilityQueries: queries }), 0);
                  return null;
                })()}

                {/* Queries editor */}
                {data.visibilityQueries.length > 0 && !scanningVisibility && data.visibilityResults.length === 0 && (
                  <div style={{
                    background: C.card, borderRadius: 20, border: `1px solid ${C.border}`,
                    padding: 28, marginBottom: 24, boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                      <h3 style={{ fontSize: 16, fontWeight: 700, color: C.text, margin: 0 }}>
                        שאילתות לבדיקה ({data.visibilityQueries.length})
                      </h3>
                      <button
                        onClick={() => setEditingQueries(!editingQueries)}
                        style={{
                          padding: "6px 16px", background: "transparent",
                          border: `1px solid ${C.border}`, borderRadius: 8,
                          fontSize: 12, color: C.textSecondary, cursor: "pointer",
                        }}
                      >
                        {editingQueries ? "סיום עריכה" : "ערוך שאילתות"}
                      </button>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {data.visibilityQueries.map((q, i) => (
                        <div key={q.id} style={{
                          display: "flex", alignItems: "center", gap: 12,
                          padding: "10px 14px", borderRadius: 10,
                          background: C.bg,
                          border: `1px solid ${C.borderLight}`,
                        }}>
                          <div style={{
                            width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                            background: q.importance === "high" ? `${C.primary}15` : q.importance === "medium" ? `${C.warning}15` : `${C.info}15`,
                            color: q.importance === "high" ? C.primary : q.importance === "medium" ? C.warning : C.info,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 12, fontWeight: 700,
                          }}>{i + 1}</div>
                          {editingQueries ? (
                            <input
                              value={q.query}
                              onChange={e => {
                                const updated = [...data.visibilityQueries];
                                updated[i] = { ...q, query: e.target.value };
                                updateData({ visibilityQueries: updated });
                              }}
                              style={{
                                flex: 1, padding: "6px 10px",
                                border: `1px solid ${C.border}`, borderRadius: 8,
                                fontSize: 13, outline: "none", background: C.card,
                              }}
                            />
                          ) : (
                            <div style={{ flex: 1, fontSize: 13, color: C.text }}>{q.query}</div>
                          )}
                          <div style={{
                            fontSize: 10, padding: "3px 8px", borderRadius: 6,
                            background: `${C.primary}10`, color: C.primary, fontWeight: 500,
                          }}>{q.category}</div>
                          {editingQueries && (
                            <button
                              onClick={() => {
                                const updated = data.visibilityQueries.filter((_, j) => j !== i);
                                updateData({ visibilityQueries: updated });
                              }}
                              style={{
                                width: 24, height: 24, borderRadius: 6,
                                background: `${C.danger}10`, border: "none",
                                color: C.danger, cursor: "pointer", fontSize: 14,
                                display: "flex", alignItems: "center", justifyContent: "center",
                              }}
                            >×</button>
                          )}
                        </div>
                      ))}
                    </div>

                    <div style={{ marginTop: 24, textAlign: "center" }}>
                      <button
                        onClick={runVisibilityScan}
                        style={{
                          padding: "14px 48px", background: C.primary, color: "#fff",
                          border: "none", borderRadius: 12, fontSize: 16, fontWeight: 700,
                          cursor: "pointer", transition: "all 0.2s",
                          boxShadow: `0 4px 16px ${C.primary}40`,
                        }}
                      >
                        התחל סריקת AI
                      </button>
                    </div>
                  </div>
                )}

                {/* Scanning animation */}
                {scanningVisibility && (
                  <div style={{
                    background: C.card, borderRadius: 20, border: `1px solid ${C.border}`,
                    padding: 48, textAlign: "center", boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
                  }}>
                    <div style={{ fontSize: 48, marginBottom: 20 }}>🤖</div>
                    <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, margin: "0 0 20px 0" }}>סורק מנועי AI...</h2>
                    <div style={{
                      display: "flex", justifyContent: "center", gap: 16, marginBottom: 24,
                    }}>
                      {AI_ENGINES.map((eng, i) => (
                        <div key={eng} style={{
                          padding: "8px 14px", borderRadius: 8,
                          background: visibilityProgress > (i + 1) * 18 ? `${C.success}15` : C.bg,
                          border: `1px solid ${visibilityProgress > (i + 1) * 18 ? `${C.success}30` : C.borderLight}`,
                          fontSize: 12, fontWeight: 600,
                          color: visibilityProgress > (i + 1) * 18 ? C.success : C.textMuted,
                          transition: "all 0.3s",
                        }}>{eng} {visibilityProgress > (i + 1) * 18 ? "✓" : ""}</div>
                      ))}
                    </div>
                    <div style={{
                      width: "100%", maxWidth: 400, margin: "0 auto", height: 8,
                      background: C.borderLight, borderRadius: 4, overflow: "hidden",
                    }}>
                      <div style={{
                        height: "100%", width: `${visibilityProgress}%`,
                        background: `linear-gradient(90deg, ${C.primary}, ${C.accent})`,
                        borderRadius: 4, transition: "width 0.3s ease",
                      }} />
                    </div>
                    <p style={{ fontSize: 13, color: C.textMuted, marginTop: 12 }}>
                      שולח {data.visibilityQueries.length} שאילתות ל-{AI_ENGINES.length} מנועי AI...
                    </p>
                  </div>
                )}

                {/* Results */}
                {data.visibilityResults.length > 0 && !scanningVisibility && (
                  <div>
                    {/* Visibility score hero */}
                    <div style={{
                      background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`,
                      borderRadius: 20, padding: 32, textAlign: "center", marginBottom: 24,
                      color: "#fff",
                    }}>
                      <div style={{ fontSize: 56, fontWeight: 800 }}>{data.visibilityScore}%</div>
                      <div style={{ fontSize: 16, fontWeight: 600, marginTop: 4 }}>ציון נראות AI</div>
                      <div style={{ fontSize: 13, opacity: 0.8, marginTop: 6 }}>
                        {data.visibilityScore >= 60 ? "נראות מצוינת — המשיכו כך!" :
                         data.visibilityScore >= 30 ? "נראות בינונית — יש פוטנציאל שיפור משמעותי" :
                         "נראות נמוכה — נדרשת אסטרטגיית GEO מיידית"}
                      </div>
                    </div>

                    {/* Results matrix */}
                    <div style={{
                      background: C.card, borderRadius: 20, border: `1px solid ${C.border}`,
                      padding: 24, overflow: "auto", boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
                    }}>
                      <h3 style={{ fontSize: 16, fontWeight: 700, color: C.text, margin: "0 0 16px 0" }}>מטריצת תוצאות</h3>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                        <thead>
                          <tr>
                            <th style={{ padding: "10px 12px", textAlign: "right", borderBottom: `2px solid ${C.border}`, color: C.textMuted, fontWeight: 600 }}>שאילתה</th>
                            {AI_ENGINES.map(eng => (
                              <th key={eng} style={{ padding: "10px 8px", textAlign: "center", borderBottom: `2px solid ${C.border}`, color: C.textMuted, fontWeight: 600, minWidth: 80 }}>{eng}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {data.visibilityResults.map((vr, i) => (
                            <tr key={vr.queryId} style={{ borderBottom: `1px solid ${C.borderLight}` }}>
                              <td style={{ padding: "10px 12px", color: C.text, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{vr.query}</td>
                              {AI_ENGINES.map(eng => {
                                const res = vr.results.find(r => r.engine === eng);
                                const mentioned = res?.mentioned;
                                return (
                                  <td key={eng} style={{ padding: "8px", textAlign: "center" }}>
                                    <div style={{
                                      width: 28, height: 28, borderRadius: 7, margin: "0 auto",
                                      display: "flex", alignItems: "center", justifyContent: "center",
                                      fontSize: 14,
                                      background: mentioned ? `${C.success}15` : `${C.danger}10`,
                                      color: mentioned ? C.success : C.danger,
                                    }}>
                                      {mentioned ? "✓" : "✗"}
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Rescan */}
                    <div style={{ marginTop: 20, textAlign: "center" }}>
                      <button
                        onClick={() => {
                          setData(prev => ({ ...prev, visibilityResults: [], visibilityScore: 0, insights: [] }));
                        }}
                        style={{
                          padding: "10px 24px", background: "transparent",
                          border: `1px solid ${C.border}`, borderRadius: 10,
                          fontSize: 13, color: C.textSecondary, cursor: "pointer",
                        }}
                      >
                        סרוק מחדש
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ═══ STEP 6: INSIGHTS ═══ */}
            {step === 6 && (
              <div>
                <h1 style={{ fontSize: 28, fontWeight: 800, color: C.text, margin: 0 }}>תובנות וניתוח</h1>
                <p style={{ fontSize: 15, color: C.textSecondary, marginTop: 8, marginBottom: 32 }}>
                  ניתוח SWOT מבוסס על הסריקה ובדיקת נראות ה-AI
                </p>

                {data.insights.length === 0 ? (
                  <div style={{
                    background: C.card, borderRadius: 20, border: `1px solid ${C.border}`,
                    padding: 48, textAlign: "center", boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
                  }}>
                    <div style={{ fontSize: 48, marginBottom: 16 }}>💡</div>
                    <p style={{ fontSize: 15, color: C.textSecondary }}>
                      לא נמצאו תובנות. חזור לשלבים הקודמים כדי להשלים את הסריקות.
                    </p>
                  </div>
                ) : (
                  <div>
                    {/* SWOT categories */}
                    {(["strength", "opportunity", "weakness", "threat"] as const).map(cat => {
                      const items = data.insights.filter(ins => ins.category === cat);
                      if (items.length === 0) return null;
                      const config = {
                        strength: { icon: "💪", title: "חוזקות", color: C.success, bg: `${C.success}08`, border: `${C.success}20` },
                        opportunity: { icon: "🚀", title: "הזדמנויות", color: C.primary, bg: `${C.primary}08`, border: `${C.primary}20` },
                        weakness: { icon: "⚠️", title: "חולשות", color: C.warning, bg: `${C.warning}08`, border: `${C.warning}20` },
                        threat: { icon: "🛡️", title: "איומים", color: C.danger, bg: `${C.danger}08`, border: `${C.danger}20` },
                      }[cat];
                      return (
                        <div key={cat} style={{
                          background: C.card, borderRadius: 20,
                          border: `1px solid ${config.border}`,
                          padding: 24, marginBottom: 20,
                          boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                            <span style={{ fontSize: 24 }}>{config.icon}</span>
                            <h3 style={{ fontSize: 18, fontWeight: 700, color: config.color, margin: 0 }}>{config.title}</h3>
                            <div style={{
                              fontSize: 11, fontWeight: 600, padding: "2px 10px", borderRadius: 10,
                              background: config.bg, color: config.color,
                            }}>{items.length}</div>
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            {items.map(ins => (
                              <div key={ins.id} style={{
                                padding: "14px 16px", borderRadius: 12,
                                background: config.bg,
                                border: `1px solid ${config.border}`,
                              }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                                  <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{ins.title}</div>
                                    <div style={{ fontSize: 12, color: C.textSecondary, marginTop: 4 }}>{ins.description}</div>
                                  </div>
                                  <div style={{
                                    fontSize: 10, fontWeight: 600, padding: "3px 10px", borderRadius: 6, flexShrink: 0,
                                    background: ins.impact === "high" ? `${C.danger}15` : ins.impact === "medium" ? `${C.warning}15` : `${C.info}15`,
                                    color: ins.impact === "high" ? C.danger : ins.impact === "medium" ? C.warning : C.info,
                                  }}>
                                    {ins.impact === "high" ? "השפעה גבוהה" : ins.impact === "medium" ? "השפעה בינונית" : "השפעה נמוכה"}
                                  </div>
                                </div>
                                <div style={{
                                  display: "flex", alignItems: "center", gap: 6, marginTop: 10,
                                  padding: "8px 12px", borderRadius: 8,
                                  background: C.card,
                                  border: `1px solid ${C.borderLight}`,
                                }}>
                                  <span style={{ fontSize: 12 }}>📌</span>
                                  <div style={{ fontSize: 12, fontWeight: 500, color: C.primary }}>{ins.action}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ═══ STEP 7: 60-DAY PLAN ═══ */}
            {step === 7 && (
              <div>
                <h1 style={{ fontSize: 28, fontWeight: 800, color: C.text, margin: 0 }}>תוכנית 60 יום</h1>
                <p style={{ fontSize: 15, color: C.textSecondary, marginTop: 8, marginBottom: 32 }}>
                  תוכנית פעולה מפורטת לצמיחה ב-SEO ו-GEO
                </p>

                {/* Generate button if no plan yet */}
                {data.days.length === 0 && !generatingPlan && (
                  <div style={{
                    background: C.card, borderRadius: 20, border: `1px solid ${C.border}`,
                    padding: 48, textAlign: "center", boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
                  }}>
                    <div style={{ fontSize: 64, marginBottom: 20 }}>📋</div>
                    <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, margin: "0 0 12px 0" }}>יצירת תוכנית פעולה</h2>
                    <p style={{ fontSize: 14, color: C.textSecondary, marginBottom: 28, maxWidth: 480, margin: "0 auto 28px" }}>
                      על בסיס הסריקה, נראות ה-AI והתובנות — ניצור תוכנית 60 יום מפורטת עם משימות יומיות
                    </p>
                    <button
                      onClick={generatePlan}
                      style={{
                        padding: "14px 48px", background: C.primary, color: "#fff",
                        border: "none", borderRadius: 12, fontSize: 16, fontWeight: 700,
                        cursor: "pointer", transition: "all 0.2s",
                        boxShadow: `0 4px 16px ${C.primary}40`,
                      }}
                    >
                      צור תוכנית
                    </button>
                  </div>
                )}

                {/* Generating animation */}
                {generatingPlan && (
                  <div style={{
                    background: C.card, borderRadius: 20, border: `1px solid ${C.border}`,
                    padding: 48, textAlign: "center", boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
                  }}>
                    <div style={{ fontSize: 48, marginBottom: 20 }}>⚙️</div>
                    <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, margin: 0 }}>מייצר תוכנית...</h2>
                    <p style={{ fontSize: 13, color: C.textMuted, marginTop: 12 }}>
                      ממפה משימות, קובע לוח זמנים ומתעדף פעולות...
                    </p>
                  </div>
                )}

                {/* Plan display — new 60-day phases/days format */}
                {data.days.length > 0 && !generatingPlan && (
                  <div>
                    {/* Summary KPIs */}
                    <div style={{
                      display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 28,
                    }}>
                      <div style={{
                        background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`,
                        borderRadius: 16, padding: 20, color: "#fff", textAlign: "center",
                      }}>
                        <div style={{ fontSize: 28, fontWeight: 800 }}>60</div>
                        <div style={{ fontSize: 12, marginTop: 4, opacity: 0.9 }}>ימים</div>
                      </div>
                      <div style={{
                        background: C.card, borderRadius: 16, border: `1px solid ${C.border}`,
                        padding: 20, textAlign: "center",
                      }}>
                        <div style={{ fontSize: 28, fontWeight: 800, color: C.primary }}>{data.phases.length}</div>
                        <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>שלבים</div>
                      </div>
                      <div style={{
                        background: C.card, borderRadius: 16, border: `1px solid ${C.border}`,
                        padding: 20, textAlign: "center",
                      }}>
                        <div style={{ fontSize: 28, fontWeight: 800, color: C.primary }}>{data.totalTasks}</div>
                        <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>משימות</div>
                      </div>
                      <div style={{
                        background: C.card, borderRadius: 16, border: `1px solid ${C.border}`,
                        padding: 20, textAlign: "center",
                      }}>
                        <div style={{ fontSize: 28, fontWeight: 800, color: C.primaryDark }}>{data.totalHours}</div>
                        <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>שעות עבודה</div>
                      </div>
                    </div>

                    {/* Phases timeline */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      {data.phases.map((phase) => {
                        const isPhaseExpanded = expandedPhases.has(phase.number);
                        const phaseDays = data.days.filter(d => d.phaseNumber === phase.number);
                        const phaseColors = ["#3B82F6", "#10B981", "#8B5CF6", "#F59E0B", "#EF4444"];
                        const phaseColor = phaseColors[(phase.number - 1) % phaseColors.length];

                        return (
                          <div key={phase.number} style={{
                            background: C.card, borderRadius: 16,
                            border: `1px solid ${isPhaseExpanded ? phaseColor + "40" : C.border}`,
                            overflow: "hidden", transition: "border-color 0.2s",
                            boxShadow: isPhaseExpanded ? `0 4px 16px ${phaseColor}10` : "0 2px 8px rgba(0,0,0,0.03)",
                          }}>
                            {/* Phase header */}
                            <button
                              onClick={() => {
                                const next = new Set(expandedPhases);
                                if (next.has(phase.number)) next.delete(phase.number);
                                else next.add(phase.number);
                                setExpandedPhases(next);
                              }}
                              style={{
                                width: "100%", padding: "18px 24px",
                                display: "flex", alignItems: "center", gap: 16,
                                background: "transparent", border: "none",
                                cursor: "pointer", textAlign: "right",
                              }}
                            >
                              <div style={{
                                width: 48, height: 48, borderRadius: 14, flexShrink: 0,
                                background: `linear-gradient(135deg, ${phaseColor}20, ${phaseColor}08)`,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 18, fontWeight: 800, color: phaseColor,
                              }}>
                                {phase.number}
                              </div>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>
                                  {phase.name}
                                </div>
                                <div style={{ fontSize: 12, color: C.textMuted, marginTop: 3 }}>
                                  ימים {phase.dayRange} · {phase.taskCount} משימות · {phase.hours} שעות
                                </div>
                                <div style={{ fontSize: 11, color: C.textSecondary, marginTop: 2 }}>
                                  {phase.focus}
                                </div>
                              </div>
                              <div style={{
                                fontSize: 18, color: C.textMuted,
                                transition: "transform 0.2s",
                                transform: isPhaseExpanded ? "rotate(180deg)" : "rotate(0deg)",
                              }}>▾</div>
                            </button>

                            {/* Expanded days */}
                            {isPhaseExpanded && (
                              <div style={{
                                padding: "0 24px 20px 24px",
                                borderTop: `1px solid ${C.borderLight}`,
                              }}>
                                <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 16 }}>
                                  {phaseDays.map((day) => {
                                    const isDayExpanded = expandedDays.has(day.day);
                                    return (
                                      <div key={day.day} style={{
                                        borderRadius: 12, overflow: "hidden",
                                        background: isDayExpanded ? `${phaseColor}04` : C.bg,
                                        border: `1px solid ${isDayExpanded ? phaseColor + "20" : C.borderLight}`,
                                      }}>
                                        {/* Day header */}
                                        <button
                                          onClick={() => {
                                            const next = new Set(expandedDays);
                                            if (next.has(day.day)) next.delete(day.day);
                                            else next.add(day.day);
                                            setExpandedDays(next);
                                          }}
                                          style={{
                                            width: "100%", padding: "12px 16px",
                                            display: "flex", alignItems: "center", gap: 12,
                                            background: "transparent", border: "none",
                                            cursor: "pointer", textAlign: "right",
                                          }}
                                        >
                                          <div style={{
                                            width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                                            background: phaseColor + "12",
                                            display: "flex", alignItems: "center", justifyContent: "center",
                                            fontSize: 13, fontWeight: 700, color: phaseColor,
                                          }}>
                                            {day.day}
                                          </div>
                                          <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
                                              יום {day.day}: {day.focusTitle}
                                            </div>
                                            <div style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>
                                              {day.tasks.length} משימות · {day.tasks.reduce((s, t) => s + t.effortHours, 0)} שעות
                                            </div>
                                          </div>
                                          <div style={{
                                            fontSize: 14, color: C.textMuted,
                                            transition: "transform 0.2s",
                                            transform: isDayExpanded ? "rotate(180deg)" : "rotate(0deg)",
                                          }}>▾</div>
                                        </button>

                                        {/* Expanded day tasks */}
                                        {isDayExpanded && (
                                          <div style={{ padding: "0 16px 14px 16px" }}>
                                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                              {day.tasks.map((task) => {
                                                const impactColor = task.impactLevel === "critical" ? C.danger :
                                                  task.impactLevel === "high" ? "#F97316" :
                                                  task.impactLevel === "medium" ? C.warning : C.info;
                                                const impactLabel = task.impactLevel === "critical" ? "קריטי" :
                                                  task.impactLevel === "high" ? "גבוה" :
                                                  task.impactLevel === "medium" ? "בינוני" : "נמוך";

                                                return (
                                                  <div key={task.id} style={{
                                                    padding: "14px 16px", borderRadius: 10,
                                                    background: C.card,
                                                    border: `1px solid ${C.borderLight}`,
                                                  }}>
                                                    <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                                                      <div style={{
                                                        width: 8, height: 8, borderRadius: 4, marginTop: 6, flexShrink: 0,
                                                        background: impactColor,
                                                      }} />
                                                      <div style={{ flex: 1 }}>
                                                        <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{task.title}</div>
                                                        <div style={{ fontSize: 12, color: C.textSecondary, marginTop: 6, lineHeight: 1.5 }}>
                                                          {task.description}
                                                        </div>
                                                        {task.expectedOutcome && (
                                                          <div style={{ fontSize: 11, color: C.success, marginTop: 6 }}>
                                                            תוצאה צפויה: {task.expectedOutcome}
                                                          </div>
                                                        )}
                                                        {task.relatedPageUrl && (
                                                          <div style={{ fontSize: 11, color: C.primary, marginTop: 4 }}>
                                                            דף קשור: {task.relatedPageUrl}
                                                          </div>
                                                        )}
                                                        <div style={{
                                                          display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap",
                                                        }}>
                                                          <span style={{
                                                            fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 5,
                                                            background: impactColor + "15", color: impactColor,
                                                          }}>
                                                            {impactLabel}
                                                          </span>
                                                          <span style={{ fontSize: 10, color: C.textMuted }}>
                                                            {task.type}
                                                          </span>
                                                          <span style={{ fontSize: 10, color: C.textMuted }}>
                                                            {task.effortHours}h
                                                          </span>
                                                        </div>
                                                      </div>
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
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Regenerate */}
                    <div style={{ marginTop: 24, textAlign: "center" }}>
                      <button
                        onClick={() => { setData(prev => ({ ...prev, days: [], phases: [], weeks: [], totalTasks: 0, totalHours: 0 })); }}
                        style={{
                          padding: "10px 24px", background: "transparent",
                          border: `1px solid ${C.border}`, borderRadius: 10,
                          fontSize: 13, color: C.textSecondary, cursor: "pointer",
                        }}
                      >
                        צור תוכנית מחדש
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>

          {/* ── BOTTOM NAVIGATION ── */}
          <div style={{
            borderTop: `1px solid ${C.border}`,
            padding: "16px 48px",
            display: "flex", justifyContent: "space-between", alignItems: "center",
            background: C.card, flexShrink: 0,
          }}>
            <button
              onClick={handleBack}
              disabled={step === 1 && data.entryMode !== "from_client"}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "12px 24px",
                background: "transparent",
                border: `1px solid ${C.border}`,
                borderRadius: 10,
                fontSize: 14, color: C.textSecondary,
                cursor: step === 1 && data.entryMode !== "from_client" ? "default" : "pointer",
                opacity: step === 1 && data.entryMode !== "from_client" ? 0.3 : 1,
              }}
            >
              הקודם
            </button>

            <div style={{ fontSize: 13, color: C.textMuted }}>
              שלב {step} מתוך {STEPS.length}
            </div>

            {step < 7 ? (
              <button
                onClick={handleNext}
                disabled={!canContinue()}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "12px 32px",
                  background: canContinue() ? C.primary : C.border,
                  color: canContinue() ? "#fff" : C.textMuted,
                  border: "none", borderRadius: 10,
                  fontSize: 14, fontWeight: 600,
                  cursor: canContinue() ? "pointer" : "default",
                  transition: "all 0.2s",
                }}
              >
                המשך ←
              </button>
            ) : (
              <button
                onClick={savePlan}
                disabled={saving || !!data.savedPlanId}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "12px 32px",
                  background: data.savedPlanId ? C.success : C.primary,
                  color: "#fff", border: "none", borderRadius: 10,
                  fontSize: 14, fontWeight: 600,
                  cursor: "pointer", transition: "all 0.2s",
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {data.savedPlanId ? "✓ נשמר" : saving ? "שומר..." : "שמור תוכנית"}
              </button>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
