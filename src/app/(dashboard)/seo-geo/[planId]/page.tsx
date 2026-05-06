"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { getGuideForTask, TaskGuide } from '@/lib/seo/task-guides';

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

const AI_ENGINES = ["ChatGPT", "Gemini", "Perplexity", "Claude"];

// ── Platform SVG Icons ──
function GoogleIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function ChatGPTIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M22.28 9.37a6.07 6.07 0 0 0-.52-4.98 6.15 6.15 0 0 0-6.64-2.96A6.07 6.07 0 0 0 10.54 0a6.15 6.15 0 0 0-5.86 4.25 6.07 6.07 0 0 0-4.06 2.93 6.15 6.15 0 0 0 .76 7.2 6.07 6.07 0 0 0 .52 4.97 6.15 6.15 0 0 0 6.64 2.97A6.07 6.07 0 0 0 13.12 24a6.15 6.15 0 0 0 5.86-4.25 6.07 6.07 0 0 0 4.06-2.93 6.15 6.15 0 0 0-.76-7.2v-.25zm-9.16 13.06a4.6 4.6 0 0 1-2.96-1.08l.15-.08 4.92-2.84a.8.8 0 0 0 .4-.7v-6.93l2.08 1.2a.07.07 0 0 1 .04.06v5.75a4.62 4.62 0 0 1-4.63 4.62zM3.6 18.28a4.58 4.58 0 0 1-.55-3.09l.15.09 4.92 2.84a.8.8 0 0 0 .8 0l6.01-3.47v2.4a.08.08 0 0 1-.03.06l-4.97 2.87a4.62 4.62 0 0 1-6.33-1.7zM2.34 7.89A4.58 4.58 0 0 1 4.74 5.8v5.85a.8.8 0 0 0 .4.7l6.01 3.47-2.08 1.2a.08.08 0 0 1-.07 0L4.03 14.15a4.62 4.62 0 0 1-1.7-6.26zm16.58 3.86-6.01-3.47 2.08-1.2a.08.08 0 0 1 .07 0l4.97 2.87a4.62 4.62 0 0 1-.71 8.34v-5.85a.8.8 0 0 0-.4-.7zm2.07-3.1-.15-.09-4.92-2.84a.8.8 0 0 0-.8 0L9.11 9.19v-2.4a.08.08 0 0 1 .03-.06l4.97-2.87a4.62 4.62 0 0 1 6.88 4.78zM8.02 13.28l-2.08-1.2a.07.07 0 0 1-.04-.06V6.27a4.62 4.62 0 0 1 7.58-3.54l-.15.08-4.92 2.84a.8.8 0 0 0-.4.7v6.93zm1.13-2.43L12 9.13l2.85 1.64v3.29L12 15.7l-2.85-1.64v-3.22z" fill="#10A37F"/>
    </svg>
  );
}

function GeminiIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 24A14.3 14.3 0 0 0 0 12 14.3 14.3 0 0 0 12 0a14.3 14.3 0 0 0 0 12 14.3 14.3 0 0 0 0 12z" fill="url(#gemini_g)"/>
      <defs>
        <linearGradient id="gemini_g" x1="0" y1="0" x2="24" y2="24">
          <stop stopColor="#1C7CEF"/><stop offset="1" stopColor="#A040CF"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

function ClaudeIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M16.98 3.41L14.2 12.78l6.18-5.89a.55.55 0 0 0-.16-.88l-2.62-1.33a.55.55 0 0 0-.62.73zM13.46 2.04L10.87 12.74l-3.3-9.36a.55.55 0 0 0-.72-.33L4.48 4.16a.55.55 0 0 0-.28.77L10.63 17.8a.55.55 0 0 0 .96.04l7.26-13.25a.55.55 0 0 0-.22-.76l-4.5-2a.55.55 0 0 0-.67.21z" fill="#D97757"/>
    </svg>
  );
}

function PerplexityIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 1L4 5v6.5L12 16l8-4.5V5L12 1z" stroke="#20808D" strokeWidth="1.8" fill="none"/>
      <path d="M12 16v7M4 11.5L12 16l8-4.5" stroke="#20808D" strokeWidth="1.8" fill="none"/>
      <path d="M12 1v15" stroke="#20808D" strokeWidth="1.8"/>
      <circle cx="12" cy="8" r="2.5" fill="#20808D"/>
    </svg>
  );
}

function AIOverviewIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" opacity="0.5"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" opacity="0.5"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" opacity="0.5"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" opacity="0.5"/>
      <path d="M8 10h8M8 12.5h6M8 15h4" stroke="#4285F4" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function PlatformIconComponent({ platform, size = 20 }: { platform: string; size?: number }) {
  switch (platform) {
    case 'google_seo': return <GoogleIcon size={size} />;
    case 'google_ai_overview': return <AIOverviewIcon size={size} />;
    case 'gemini': return <GeminiIcon size={size} />;
    case 'chatgpt': return <ChatGPTIcon size={size} />;
    case 'claude': return <ClaudeIcon size={size} />;
    case 'perplexity': return <PerplexityIcon size={size} />;
    default: return <GoogleIcon size={size} />;
  }
}

const PLATFORM_DISPLAY: Record<string, { name: string; nameHe: string; color: string }> = {
  google_seo: { name: "Google SEO", nameHe: "גוגל אורגני", color: "#4285F4" },
  google_ai_overview: { name: "AI Overview", nameHe: "סקירת AI", color: "#34A853" },
  gemini: { name: "Gemini", nameHe: "ג׳מיני", color: "#886FBF" },
  chatgpt: { name: "ChatGPT", nameHe: "צ׳אט GPT", color: "#10A37F" },
  claude: { name: "Claude", nameHe: "קלוד", color: "#D97757" },
  perplexity: { name: "Perplexity", nameHe: "פרפלקסיטי", color: "#20808D" },
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

type TabId = "overview" | "plan" | "calendar" | "tasks" | "articles" | "ai" | "results" | "competitors" | "gaps" | "keywords" | "reports";

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: "overview", label: "סקירה", icon: "📊" },
  { id: "plan", label: "תוכנית 60 יום", icon: "📅" },
  { id: "calendar", label: "לוח שנה", icon: "🗓️" },
  { id: "tasks", label: "משימות", icon: "✅" },
  { id: "articles", label: "מאמרים", icon: "📝" },
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
  const [editingRanks, setEditingRanks] = useState<Record<number, string>>({});
  const [savingRanks, setSavingRanks] = useState(false);
  const [enrichingAI, setEnrichingAI] = useState(false);
  const [generatingArticle, setGeneratingArticle] = useState<string | null>(null); // task.id of article being generated
  const [generatedArticles, setGeneratedArticles] = useState<Record<string, string>>({}); // taskId -> full article HTML
  const [articleError, setArticleError] = useState<string | null>(null);
  const [aiSubTab, setAiSubTab] = useState<"results" | "ai_overview" | "queries">("results");
  const [aiPlatformFilter, setAiPlatformFilter] = useState<string>("all");
  const [aiStatusFilter, setAiStatusFilter] = useState<"all" | "found" | "not_found">("all");
  const [aiSearchQuery, setAiSearchQuery] = useState("");
  const [aiQueryDetail, setAiQueryDetail] = useState<{query: string; platform: string; found: boolean; confidence: number; snippet?: string; position?: number; scanMode?: string; checkedAt?: string; responseText?: string; sources?: {url: string; domain: string; title?: string}[]; mentionType?: string; sourcesCount?: number} | null>(null);
  const [executingTask, setExecutingTask] = useState<string | null>(null);
  const [executionResults, setExecutionResults] = useState<Record<string, any>>({});
  const [wpConnecting, setWpConnecting] = useState(false);
  const [wpForm, setWpForm] = useState({ siteUrl: '', username: '', applicationPassword: '' });
  const [showWpPanel, setShowWpPanel] = useState(false);
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<any | null>(null);

  // Load previously generated articles from plan's aiArticles on plan load
  useEffect(() => {
    if (!plan) return;
    const aiArticles = Array.isArray((plan as any).aiArticles) ? (plan as any).aiArticles : [];
    const days = Array.isArray((plan as any).days) ? (plan as any).days : [];
    const preloaded: Record<string, string> = {};
    // Match articles that have fullArticle content to their corresponding tasks
    for (const day of days) {
      if (!Array.isArray(day?.tasks)) continue;
      for (const task of day.tasks) {
        if (task.category !== 'content' && (task as any).type !== 'content') continue;
        // Find matching article by title
        const matchIdx = aiArticles.findIndex((a: any) =>
          a?.fullArticle && a.status === 'written' &&
          (task.title?.includes(a.title?.slice(0, 20)) || a.title?.includes(task.title?.slice(0, 20)))
        );
        if (matchIdx >= 0 && aiArticles[matchIdx]?.fullArticle) {
          preloaded[task.id] = aiArticles[matchIdx].fullArticle;
        }
      }
    }
    if (Object.keys(preloaded).length > 0) {
      setGeneratedArticles(prev => ({ ...prev, ...preloaded }));
    }
  }, [plan]);

  // Generate full article via AI
  const handleGenerateArticle = useCallback(async (taskTitle: string, taskId: string, articleIndex: number) => {
    if (!plan) return;
    setGeneratingArticle(taskId);
    setArticleError(null);
    try {
      const aiArticles = Array.isArray((plan as any).aiArticles) ? (plan as any).aiArticles : [];
      const matchingArticle = aiArticles[articleIndex] || {};

      const res = await fetch(`/api/seo-geo-plans/${plan.id}/generate-article`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          articleIndex,
          title: matchingArticle.title || taskTitle,
          targetKeyword: matchingArticle.targetKeyword || taskTitle,
          outline: matchingArticle.outline || [],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.data?.article) {
          setGeneratedArticles(prev => ({ ...prev, [taskId]: data.data.article }));
          // Switch to articles tab and scroll to the generated article
          setActiveTab("articles");
          setTimeout(() => {
            const el = document.getElementById(`article-${taskId}`);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 200);
        } else {
          setArticleError(`המאמר נוצר אבל ללא תוכן — נסה שוב`);
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        setArticleError(`שגיאה ביצירת המאמר: ${errData.error || res.status}`);
      }
    } catch (e) {
      console.error("Failed to generate article:", e);
      setArticleError("שגיאת רשת — ודא שהאתר מחובר ונסה שוב");
    }
    setGeneratingArticle(null);
  }, [plan]);

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

          // Auto-fill WP form from client data if plan has no wpConnection
          if (!(sanitized as any).wpConnection && sanitized.clientId) {
            try {
              const clientRes = await fetch(`/api/data/clients/${sanitized.clientId}`);
              if (clientRes.ok) {
                const clientData = await clientRes.json();
                const wpSite = clientData.wpSiteUrl || clientData.wp_site_url || '';
                const wpUser = clientData.wpUsername || clientData.wp_username || '';
                const wpPass = clientData.wpApplicationPassword || clientData.wp_application_password || '';
                if (wpSite && wpUser && wpPass) {
                  setWpForm({ siteUrl: wpSite, username: wpUser, applicationPassword: wpPass });
                }
              }
            } catch { /* ignore */ }
          } else if ((sanitized as any).wpConnection) {
            const conn = (sanitized as any).wpConnection;
            if (conn.siteUrl) setWpForm({ siteUrl: conn.siteUrl, username: conn.username || '', applicationPassword: conn.applicationPassword || '' });
          }
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

  // AI Enrich — generate smart keywords, competitors, articles via GPT
  const handleAIEnrich = useCallback(async () => {
    if (!plan) return;
    setEnrichingAI(true);
    try {
      const res = await fetch(`/api/seo-geo-plans/${plan.id}/ai-enrich`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        // Refresh plan data
        const refreshRes = await fetch(`/api/data/seo-plans/${plan.id}`);
        if (refreshRes.ok) {
          const refreshed = await refreshRes.json();
          setPlan(refreshed);
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        console.error("AI enrich failed:", errData);
      }
    } catch (e) {
      console.error("AI enrich error:", e);
    }
    setEnrichingAI(false);
  }, [plan]);

  // בצע משימה אוטומטית
  const handleAutoExecute = useCallback(async (taskId: string, taskTitle: string) => {
    if (!plan?.id) return;
    setExecutingTask(taskId);
    try {
      const res = await fetch(`/api/seo-geo-plans/${plan.id}/execute-task`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, taskTitle }),
      });
      const data = await res.json();
      if (res.ok && data.success !== false) {
        setExecutionResults(prev => ({ ...prev, [taskId]: data }));
        // Update task status locally
        updateTaskStatus(taskId, 'done');
      } else {
        setExecutionResults(prev => ({ ...prev, [taskId]: { error: data.error || 'שגיאה בביצוע' } }));
      }
    } catch (e) {
      setExecutionResults(prev => ({ ...prev, [taskId]: { error: 'שגיאת רשת' } }));
    } finally {
      setExecutingTask(null);
    }
  }, [plan?.id]);

  // חבר WordPress
  const handleConnectWP = useCallback(async () => {
    if (!plan?.id) return;
    setWpConnecting(true);
    try {
      const res = await fetch(`/api/seo-geo-plans/${plan.id}/connect-wordpress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(wpForm),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPlan((prev: any) => prev ? { ...prev, wpConnection: data.connection || wpForm } : prev);
        setShowWpPanel(false);
      } else {
        alert(data.error || 'חיבור נכשל');
      }
    } catch (e) {
      alert('שגיאת רשת');
    } finally {
      setWpConnecting(false);
    }
  }, [plan?.id, wpForm]);

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

    // Technical score: start at 0, earn points for each real signal (same as report-engine)
    let tech = 0;
    if (scan.hasSSL === true) tech += 15;
    if (scan.mobileOptimized === true) tech += 15;
    if (scan.hasRobotsTxt === true) tech += 10;
    if (scan.hasSitemap === true) tech += 10;
    if (scan.structuredData === true) tech += 10;
    if (typeof scan.metaTitle === 'string' && scan.metaTitle) tech += 10;
    if (typeof scan.metaDescription === 'string' && scan.metaDescription) tech += 10;
    if (typeof scan.loadTimeMs === 'number' && scan.loadTimeMs < 3000) tech += 10;
    if (scan.openGraph === true) tech += 5;
    if (scan.canonicalTags === true) tech += 5;
    const issueCount = Array.isArray(scan.issues) ? scan.issues.length : 0;
    tech = Math.max(0, Math.min(100, tech - issueCount * 5));

    // Visibility score: based on AI queries — ONLY count real API results (skip unavailable/simulated)
    const aiQueries = Array.isArray(scan.aiQueries) ? scan.aiQueries.filter((q: any) => q.scanMode === 'real') : [];
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

  // ── Auto-generate SMART SEO keywords from business data ──
  const autoKeywords = useMemo(() => {
    if (!safePlan) return [];

    // ── PRIORITY 1: Use AI-generated keywords if available ──
    const p = safePlan as any;
    const aiKw = p.aiKeywords;
    if (Array.isArray(aiKw) && aiKw.length > 0) {
      // Normalize category keys from AI (CORE→core, שירותים→services, etc.)
      const catMap: Record<string, string> = {
        'CORE': 'core', 'core': 'core',
        'שירותים': 'services', 'services': 'services',
        'בידול': 'differentiation', 'differentiation': 'differentiation',
        'LONG TAIL': 'long_tail', 'long_tail': 'long_tail', 'longTail': 'long_tail',
      };
      return aiKw.map((k: any, idx: number) => ({
        id: `kw-ai-${idx}`,
        keyword: k.keyword || '',
        category: catMap[k.category] || 'core',
        searchVolume: k.searchVolume || 'בינוני',
        difficulty: k.difficulty || 'בינוני',
        intent: k.intent || 'מידעי',
        googlePosition: null,
        aiMentioned: false,
        actionPlan: `ביטוי שנבחר ע״י AI. קדם עם תוכן ייעודי, Meta Tags ו-Schema.`,
        source: 'ai' as const,
      }));
    }

    // ── FALLBACK: deterministic generation from scan data ──
    const scan = safePlan.websiteScan;
    if (!scan) return [];

    // Helper to clean HTML entities and raw text
    const cleanText = (text: string) => {
      if (!text) return '';
      return text
        .replace(/&#8211;/g, "-")
        .replace(/&#34;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#x27;/g, "'")
        .replace(/&nbsp;/g, " ")
        .replace(/\["([^"]+)"\]|\[([^\]]+)\]/g, "$1$2")
        .replace(/^\s*["']+|["']+\s*$/g, "")
        .trim();
    };

    // Intelligently extract business type
    const extractBusinessType = () => {
      let btype = s(scan.websiteFacts?.business_type || "") || "";
      if (btype) return cleanText(btype);

      // Try to extract from h1Tags
      const h1s = (scan.h1Tags || []).map((h: string) => cleanText(s(h)));
      for (const h1 of h1s) {
        if (h1 && h1.length < 60 && !h1.includes("אלרם") && h1.length > 5) {
          return h1;
        }
      }
      return "";
    };

    // Intelligently extract products/services
    const extractProducts = () => {
      const products: string[] = [];
      const mainProd = scan.websiteFacts?.main_products_or_services;

      if (Array.isArray(mainProd)) {
        mainProd.forEach((p: any) => {
          const cleaned = cleanText(s(p));
          if (cleaned && cleaned.length > 2 && cleaned.length < 40) {
            if (!cleaned.includes("http") && !cleaned.includes(".") && !cleaned.includes("/")) {
              products.push(cleaned);
            }
          }
        });
      } else if (typeof mainProd === 'string') {
        const prodStr = cleanText(mainProd);
        if (prodStr && !prodStr.includes("http") && prodStr.length < 50) {
          prodStr.split(/[,;/]+/).forEach(p => {
            const cleaned = p.trim();
            if (cleaned && cleaned.length > 2 && cleaned.length < 40) {
              products.push(cleaned);
            }
          });
        }
      }

      return products.slice(0, 5);
    };

    const businessName = s(safePlan.clientName) || "העסק";
    const businessType = extractBusinessType();
    const products = extractProducts();

    // Guard: if business type is garbage (English-only, too generic, or just "Website"), skip deterministic
    const isGarbageType = (t: string) => {
      if (!t) return true;
      if (t.length < 3) return true;
      // If it's entirely English/ASCII with no Hebrew, it's probably garbage like "Website"
      if (/^[a-zA-Z0-9\s\-_.]+$/.test(t)) return true;
      return false;
    };
    if (isGarbageType(businessType) && products.length === 0) {
      // No meaningful data — return empty so user sees the AI Enrich button
      return [];
    }

    // Extract location if available
    const websiteUrl = s(safePlan.websiteUrl || "");
    const locationMatch = websiteUrl.match(/\.([a-z]{2})($|\/)/i);
    const location = locationMatch ? (locationMatch[1] === "il" ? "ישראל" : locationMatch[1]) : "ישראל";

    // SMART keyword generation based on business data
    const keywordsList: any[] = [];

    // CORE - Most important generic + location keywords (5 keywords)
    const coreKeywords = [];
    if (businessType) {
      coreKeywords.push({
        keyword: `${businessType}`,
        category: "core",
        categoryLabel: "CORE — הכי חשובים",
      });
      coreKeywords.push({
        keyword: `${businessType} ${location}`,
        category: "core",
        categoryLabel: "CORE — הכי חשובים",
      });
    }
    if (products.length > 0) {
      coreKeywords.push({
        keyword: products[0],
        category: "core",
        categoryLabel: "CORE — הכי חשובים",
      });
      coreKeywords.push({
        keyword: `${products[0]} ${location}`,
        category: "core",
        categoryLabel: "CORE — הכי חשובים",
      });
    }
    if (businessType && products.length > 0) {
      coreKeywords.push({
        keyword: `${businessType} ${products[0]}`,
        category: "core",
        categoryLabel: "CORE — הכי חשובים",
      });
    }
    keywordsList.push(...coreKeywords.slice(0, 5));

    // SERVICES - High purchase intent keywords (5 keywords)
    const serviceKeywords = [];
    if (products.length > 0) {
      products.forEach((prod: string, idx: number) => {
        if (idx < 2) {
          serviceKeywords.push({
            keyword: `ניהול ${prod}`,
            category: "services",
            categoryLabel: "שירותים — כוונת רכישה גבוהה",
          });
          serviceKeywords.push({
            keyword: `${prod} לעסקים`,
            category: "services",
            categoryLabel: "שירותים — כוונת רכישה גבוהה",
          });
          serviceKeywords.push({
            keyword: `שירותי ${prod}`,
            category: "services",
            categoryLabel: "שירותים — כוונת רכישה גבוהה",
          });
        }
      });
    }
    if (businessType) {
      serviceKeywords.push({
        keyword: `שירותי ${businessType}`,
        category: "services",
        categoryLabel: "שירותים — כוונת רכישה גבוהה",
      });
    }
    keywordsList.push(...serviceKeywords.slice(0, 5));

    // DIFFERENTIATION - Brand differentiating keywords (5 keywords)
    const diffKeywords = [];
    if (products.length > 0) {
      diffKeywords.push({
        keyword: `${products[0]} פרימיום`,
        category: "differentiation",
        categoryLabel: "בידול — פה אתה מנצח",
      });
      diffKeywords.push({
        keyword: `${products[0]} מקצועי`,
        category: "differentiation",
        categoryLabel: "בידול — פה אתה מנצח",
      });
    }
    if (businessType) {
      diffKeywords.push({
        keyword: `אסטרטגיית ${businessType}`,
        category: "differentiation",
        categoryLabel: "בידול — פה אתה מנצח",
      });
      diffKeywords.push({
        keyword: `${businessType} מותאם אישית`,
        category: "differentiation",
        categoryLabel: "בידול — פה אתה מנצח",
      });
    }
    if (products.length > 0) {
      diffKeywords.push({
        keyword: `מיתוג ${products[0]}`,
        category: "differentiation",
        categoryLabel: "בידול — פה אתה מנצח",
      });
    }
    keywordsList.push(...diffKeywords.slice(0, 5));

    // LONG TAIL - Question/how-to format keywords (5 keywords)
    const longTailKeywords = [];
    if (products.length > 0) {
      longTailKeywords.push({
        keyword: `איך לבחור ${products[0]}`,
        category: "long_tail",
        categoryLabel: "LONG TAIL — הזהב האמיתי",
      });
      longTailKeywords.push({
        keyword: `כמה עולה ${products[0]}`,
        category: "long_tail",
        categoryLabel: "LONG TAIL — הזהב האמיתי",
      });
      longTailKeywords.push({
        keyword: `${products[0]} לעסקים קטנים ובינוניים`,
        category: "long_tail",
        categoryLabel: "LONG TAIL — הזהב האמיתי",
      });
      longTailKeywords.push({
        keyword: `שיווק ${products[0]} דיגיטלי`,
        category: "long_tail",
        categoryLabel: "LONG TAIL — הזהב האמיתי",
      });
    }
    if (businessType) {
      longTailKeywords.push({
        keyword: `${businessType} לעסקים`,
        category: "long_tail",
        categoryLabel: "LONG TAIL — הזהב האמיתי",
      });
    }
    keywordsList.push(...longTailKeywords.slice(0, 5));

    // Limit to total keywords
    const limitedKeywords = keywordsList.slice(0, 25);

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
                  {computedScores.visibility}%
                </div>
                <div style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>ציון נראות כולל</div>
              </div>
              <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
                {AI_ENGINES.map(eng => {
                  // Use real scan pipeline data (aiQueries) instead of legacy visibilityResults
                  const aiQ = Array.isArray(scan?.aiQueries) ? (scan.aiQueries as any[]) : [];
                  const engToPlat: Record<string, string> = {
                    'ChatGPT': 'chatgpt', 'Gemini': 'gemini', 'Perplexity': 'perplexity', 'Claude': 'claude',
                  };
                  const platId = engToPlat[eng] || '';
                  const platQueries = aiQ.filter(q => q.platform === platId && q.scanMode === 'real');
                  const mentioned = platQueries.filter(q => q.found).length;
                  const total = platQueries.length;
                  const pct = total > 0 ? Math.round((mentioned / total) * 100) : 0;
                  return (
                    <div key={eng} style={{
                      padding: "8px 14px", borderRadius: 10, background: C.bg,
                      border: `1px solid ${C.borderLight}`, textAlign: "center", minWidth: 80,
                      display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                    }}>
                      <PlatformIconComponent platform={platId} size={18} />
                      <div style={{ fontSize: 16, fontWeight: 800, color: total === 0 ? C.textMuted : pct > 50 ? C.success : C.danger }}>{total === 0 ? "—" : `${s(pct)}%`}</div>
                      <div style={{ fontSize: 10, color: C.textMuted }}>{s(eng)}{total === 0 ? " (לא נסרק)" : ""}</div>
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

            {/* Regenerate button when plan exists */}
            {Array.isArray(p.days) && p.days.length > 0 && (
              <div style={{
                display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 12,
                marginBottom: 16, padding: "0 4px",
              }}>
                <span style={{ fontSize: 12, color: C.textMuted }}>
                    {p?.generatedAt ? `נוצר: ${new Date(p.generatedAt).toLocaleDateString("he-IL")}` : ""}
                </span>
                <button
                  onClick={handleGenerate60DayPlan}
                  disabled={generatingPlan}
                  style={{
                    padding: "8px 20px", borderRadius: 10, border: `1px solid ${C.border}`,
                    background: C.card, color: C.text, fontWeight: 600, fontSize: 13,
                    cursor: generatingPlan ? "wait" : "pointer",
                    opacity: generatingPlan ? 0.6 : 1, transition: "all 0.2s",
                    display: "flex", alignItems: "center", gap: 6,
                  }}
                >
                  {generatingPlan ? "⏳ מייצר מחדש..." : "🔄 בנה תוכנית מחדש עם AI"}
                </button>
              </div>
            )}

            {/* WordPress Connection Panel */}
            {Array.isArray(p.days) && p.days.length > 0 && (
              <div style={{
                marginBottom: 16, padding: "12px 16px", borderRadius: 12,
                background: (p as any)?.wpConnection ? "#10b98115" : "#f59e0b15",
                border: (p as any)?.wpConnection ? "1px solid #10b98130" : "1px solid #f59e0b30",
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
                  {(p as any)?.wpConnection ? (
                    <>
                      <span style={{ fontSize: 16 }}>✅</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#10b981" }}>
                        WordPress מחובר: {((p as any).wpConnection?.siteUrl || (p as any).wpConnection?.siteName || 'אתר')}
                      </span>
                    </>
                  ) : (
                    <>
                      <span style={{ fontSize: 16 }}>⚠️</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#f59e0b" }}>WordPress לא מחובר</span>
                    </>
                  )}
                </div>
                {!(p as any)?.wpConnection && (
                  <button onClick={() => setShowWpPanel(true)} style={{
                    padding: "6px 14px", borderRadius: 8, border: "none",
                    background: "#f59e0b", color: "#fff", fontWeight: 600, fontSize: 12,
                    cursor: "pointer", whiteSpace: "nowrap",
                  }}>
                    חבר עכשיו
                  </button>
                )}
              </div>
            )}

            {/* WordPress Connection Form */}
            {showWpPanel && (
              <div style={{
                marginBottom: 16, padding: "16px", borderRadius: 12,
                background: C.card, border: `1px solid ${C.border}`,
                boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>חיבור WordPress</div>
                  <button onClick={() => setShowWpPanel(false)} style={{
                    background: "none", border: "none", fontSize: 18, cursor: "pointer", color: C.textMuted,
                  }}>
                    ✕
                  </button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <input
                    type="text"
                    placeholder="כתובת אתר (https://example.com)"
                    value={wpForm.siteUrl}
                    onChange={e => setWpForm(prev => ({ ...prev, siteUrl: e.target.value }))}
                    style={{
                      padding: "10px 12px", borderRadius: 8, border: `1px solid ${C.border}`,
                      fontSize: 12, fontFamily: "inherit", direction: "ltr",
                    }}
                  />
                  <input
                    type="text"
                    placeholder="שם משתמש"
                    value={wpForm.username}
                    onChange={e => setWpForm(prev => ({ ...prev, username: e.target.value }))}
                    style={{
                      padding: "10px 12px", borderRadius: 8, border: `1px solid ${C.border}`,
                      fontSize: 12, fontFamily: "inherit",
                    }}
                  />
                  <input
                    type="password"
                    placeholder="סיסמת יישום"
                    value={wpForm.applicationPassword}
                    onChange={e => setWpForm(prev => ({ ...prev, applicationPassword: e.target.value }))}
                    style={{
                      padding: "10px 12px", borderRadius: 8, border: `1px solid ${C.border}`,
                      fontSize: 12, fontFamily: "inherit",
                    }}
                  />
                  <button
                    onClick={handleConnectWP}
                    disabled={wpConnecting || !wpForm.siteUrl || !wpForm.username || !wpForm.applicationPassword}
                    style={{
                      padding: "10px 14px", borderRadius: 8, border: "none",
                      background: wpConnecting ? `${C.primary}40` : C.primary,
                      color: "#fff", fontWeight: 600, fontSize: 12,
                      cursor: wpConnecting ? "wait" : "pointer",
                      opacity: wpConnecting ? 0.6 : 1,
                    }}
                  >
                    {wpConnecting ? "⏳ מתחבר..." : "✅ חבר"}
                  </button>
                </div>
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
                                                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                                                    <button onClick={() => {
                                                      navigator.clipboard.writeText(String(taskBrief)).catch(() => {});
                                                    }} style={{
                                                      ...smallBtnStyle,
                                                      flex: 1,
                                                      background: `${C.primary}10`, color: C.primary, border: `1px solid ${C.primary}30`,
                                                    }}>
                                                      📋 העתק תקציר
                                                    </button>
                                                    {(task.category === "content" || (task as any).type === "content") && (
                                                      <button
                                                        onClick={() => {
                                                          // Find article index from task title match
                                                          const aiArticles = Array.isArray((plan as any)?.aiArticles) ? (plan as any).aiArticles : [];
                                                          const artIdx = aiArticles.findIndex((a: any) => task.title.includes(a.title) || a.title?.includes(task.title?.slice(0, 20)));
                                                          handleGenerateArticle(task.title, task.id, artIdx >= 0 ? artIdx : 0);
                                                        }}
                                                        disabled={generatingArticle === task.id}
                                                        style={{
                                                          ...smallBtnStyle,
                                                          flex: 1,
                                                          background: generatingArticle === task.id ? `${C.primary}20` : generatedArticles[task.id] ? `#10b98115` : `linear-gradient(135deg, ${C.primary}, ${C.primaryDark || C.primary})`,
                                                          color: generatingArticle === task.id ? C.primary : generatedArticles[task.id] ? "#10b981" : "#fff",
                                                          border: generatedArticles[task.id] ? `1px solid #10b98130` : "none",
                                                          cursor: generatingArticle === task.id ? "wait" : "pointer",
                                                          opacity: generatingArticle === task.id ? 0.7 : 1,
                                                        }}
                                                      >
                                                        {generatingArticle === task.id ? "⏳ כותב מאמר... (עד 30 שניות)" : generatedArticles[task.id] ? "🔄 כתוב מאמר מחדש" : "✨ כתוב מאמר מלא עם AI"}
                                                      </button>
                                                    )}
                                                  </div>

                                                  {/* Article generation error */}
                                                  {articleError && generatingArticle === null && expandedTaskId === task.id && (
                                                    <div style={{ marginTop: 8, padding: "8px 12px", borderRadius: 6, background: "#ef444415", border: "1px solid #ef444430", fontSize: 11, color: "#ef4444" }}>
                                                      {articleError}
                                                    </div>
                                                  )}

                                                  {/* Loading indicator for article generation */}
                                                  {generatingArticle === task.id && (
                                                    <div style={{
                                                      marginTop: 12, padding: "16px", borderRadius: 8,
                                                      background: `${C.primary}08`, border: `1px dashed ${C.primary}40`,
                                                      textAlign: "center",
                                                    }}>
                                                      <div style={{ fontSize: 24, marginBottom: 8, animation: "pulse 1.5s ease-in-out infinite" }}>🤖</div>
                                                      <div style={{ fontSize: 12, fontWeight: 600, color: C.primary, marginBottom: 4 }}>יוצר מאמר מלא עם AI...</div>
                                                      <div style={{ fontSize: 11, color: C.textMuted }}>1,500+ מילים, כותרות, FAQ ו-CTA — אנא המתן</div>
                                                    </div>
                                                  )}

                                                  {/* Show generated full article */}
                                                  {generatedArticles[task.id] && !generatingArticle && (
                                                    <div id={`article-${task.id}`} style={{ marginTop: 12 }}>
                                                      <div style={{ fontSize: 13, fontWeight: 700, color: "#10b981", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                                                        <span style={{ fontSize: 16 }}>✅</span> מאמר מלא נוצר בהצלחה
                                                      </div>
                                                      <div style={{
                                                        background: C.card, border: `1px solid #10b98130`,
                                                        borderRadius: 8, padding: "16px 18px",
                                                        fontSize: 13, color: C.text, maxHeight: 500, overflow: "auto",
                                                        lineHeight: 1.8, direction: "rtl",
                                                      }} dangerouslySetInnerHTML={{ __html: generatedArticles[task.id] }} />
                                                      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                                                        <button onClick={() => {
                                                          navigator.clipboard.writeText(generatedArticles[task.id] || '').catch(() => {});
                                                        }} style={{
                                                          ...smallBtnStyle,
                                                          flex: 1,
                                                          background: "#10b98115", color: "#10b981", border: `1px solid #10b98130`,
                                                        }}>
                                                          📋 העתק HTML
                                                        </button>
                                                        <button onClick={() => {
                                                          const tmp = document.createElement("div");
                                                          tmp.innerHTML = generatedArticles[task.id];
                                                          navigator.clipboard.writeText(tmp.textContent || tmp.innerText || '').catch(() => {});
                                                        }} style={{
                                                          ...smallBtnStyle,
                                                          flex: 1,
                                                          background: "#10b98115", color: "#10b981", border: `1px solid #10b98130`,
                                                        }}>
                                                          📋 העתק טקסט בלבד
                                                        </button>
                                                      </div>
                                                    </div>
                                                  )}
                                                </div>
                                              )}

                                              {/* Task Guide Section */}
                                              {(() => {
                                                const guide = getGuideForTask(task.title);
                                                if (!guide) return null;
                                                return (
                                                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.borderLight}` }}>
                                                    <div style={{ fontSize: 11, fontWeight: 600, color: C.textSecondary, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                                                      📖 מדריך שלב אחר שלב
                                                    </div>

                                                    {/* Steps */}
                                                    {Array.isArray(guide.steps) && guide.steps.length > 0 && (
                                                      <div style={{ marginBottom: 12 }}>
                                                        {guide.steps.map((step: string, idx: number) => (
                                                          <div key={idx} style={{ display: "flex", gap: 8, marginBottom: 8, fontSize: 12, color: C.text }}>
                                                            <span style={{ fontWeight: 600, color: C.primary, minWidth: 20 }}>{idx + 1}.</span>
                                                            <span style={{ lineHeight: 1.5 }}>{step}</span>
                                                          </div>
                                                        ))}
                                                      </div>
                                                    )}

                                                    {/* Code Snippet */}
                                                    {guide.codeSnippet && (
                                                      <div style={{ marginBottom: 12 }}>
                                                        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, overflow: "hidden" }}>
                                                          <div style={{ padding: "10px 12px", background: "#f5f5f5", borderBottom: `1px solid ${C.border}`, fontSize: 11, fontWeight: 600, color: C.textSecondary }}>
                                                            💻 קוד / דוגמה
                                                          </div>
                                                          <div style={{ padding: "12px", fontFamily: "monospace", fontSize: 11, color: C.text, maxHeight: 200, overflow: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                                                            {guide.codeSnippet}
                                                          </div>
                                                        </div>
                                                        <button onClick={() => {
                                                          navigator.clipboard.writeText(guide.codeSnippet || '').catch(() => {});
                                                        }} style={{
                                                          ...smallBtnStyle,
                                                          width: "100%",
                                                          marginTop: 6,
                                                          background: `${C.primary}10`,
                                                          color: C.primary,
                                                          border: `1px solid ${C.primary}30`,
                                                        }}>
                                                          📋 העתק קוד
                                                        </button>
                                                      </div>
                                                    )}

                                                    {/* Auto-Execute Button */}
                                                    {guide.autoExecutable && (
                                                      <div style={{ marginBottom: 12 }}>
                                                        <button onClick={() => handleAutoExecute(task.id, task.title)} disabled={executingTask === task.id} style={{
                                                          ...smallBtnStyle,
                                                          width: "100%",
                                                          background: executingTask === task.id ? `${C.primary}20` : `linear-gradient(135deg, ${C.primary}, ${C.primaryDark || C.primary})`,
                                                          color: executingTask === task.id ? C.primary : "#fff",
                                                          border: executingTask === task.id ? `1px solid ${C.primary}30` : "none",
                                                          cursor: executingTask === task.id ? "wait" : "pointer",
                                                          opacity: executingTask === task.id ? 0.7 : 1,
                                                        }}>
                                                          {executingTask === task.id ? "⏳ מבצע..." : "⚡ בצע אוטומטית"}
                                                        </button>
                                                      </div>
                                                    )}

                                                    {/* Time Saved Indicator */}
                                                    {guide.manualMinutes && guide.autoMinutes && (
                                                      <div style={{ marginBottom: 12, padding: "10px 12px", background: "#fef08a15", border: "1px solid #fef08a30", borderRadius: 6, fontSize: 12, color: "#b45309" }}>
                                                        ⏱️ ידני: {guide.manualMinutes} דקות → אוטומטי: {guide.autoMinutes} דקות
                                                        <div style={{ fontSize: 11, marginTop: 4, fontWeight: 600 }}>חסכון: {guide.manualMinutes - guide.autoMinutes} דקות ({Math.round(((guide.manualMinutes - guide.autoMinutes) / guide.manualMinutes) * 100)}%)</div>
                                                      </div>
                                                    )}

                                                    {/* Tips */}
                                                    {Array.isArray(guide.tips) && guide.tips.length > 0 && (
                                                      <div style={{ padding: "10px 12px", background: "#fef08a15", border: "1px solid #fef08a30", borderRadius: 6 }}>
                                                        <div style={{ fontSize: 11, fontWeight: 600, color: "#b45309", marginBottom: 6 }}>💡 טיפים</div>
                                                        {guide.tips.map((tip: string, idx: number) => (
                                                          <div key={idx} style={{ fontSize: 11, color: "#b45309", marginBottom: idx < guide.tips.length - 1 ? 4 : 0, lineHeight: 1.4 }}>
                                                            • {tip}
                                                          </div>
                                                        ))}
                                                      </div>
                                                    )}

                                                    {/* Execution Result */}
                                                    {executionResults[task.id] && (
                                                      <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 6, background: executionResults[task.id]?.error ? "#ef444415" : "#10b98115", border: executionResults[task.id]?.error ? "1px solid #ef444430" : "1px solid #10b98130", fontSize: 11, color: executionResults[task.id]?.error ? "#ef4444" : "#10b981" }}>
                                                        {executionResults[task.id]?.error ? `❌ ${executionResults[task.id].error}` : `✅ ${executionResults[task.id]?.message || 'בוצע בהצלחה'}`}
                                                      </div>
                                                    )}
                                                  </div>
                                                );
                                              })()}

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

        {/* ── CALENDAR VIEW ── */}
        {activeTab === "calendar" && (() => {
          const days = plan?.days || [];
          const generatedAt = plan?.generatedAt ? new Date(plan.generatedAt) : null;
          const automationLog = (plan as any)?.automationLog || [];

          if (days.length === 0) {
            return <EmptyTab icon="🗓️" text="אין תוכנית עדיין. צור תוכנית 60 יום כדי לראות לוח שנה." />;
          }

          // חשב תאריכים לכל יום
          const dayDates = days.map((d: any) => {
            if (!generatedAt) return { ...d, date: null };
            const date = new Date(generatedAt);
            date.setDate(date.getDate() + (d.day - 1));
            return { ...d, dateObj: date };
          });

          // חלק לחודשים
          const months: Record<string, any[]> = {};
          for (const d of dayDates) {
            if (!d.dateObj) continue;
            const key = `${d.dateObj.getFullYear()}-${String(d.dateObj.getMonth() + 1).padStart(2, "0")}`;
            if (!months[key]) months[key] = [];
            months[key].push(d);
          }

          const HEB_MONTHS = ["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];
          const HEB_DAYS = ["א׳","ב׳","ג׳","ד׳","ה׳","ו׳","ש׳"];

          const getStatusColor = (tasks: any[]) => {
            if (!tasks || tasks.length === 0) return "#e2e8f0"; // אפור - אין משימות
            const allDone = tasks.every((t: any) => t.status === "done");
            const someInProgress = tasks.some((t: any) => t.status === "in_progress");
            const someDone = tasks.some((t: any) => t.status === "done");
            if (allDone) return "#22c55e"; // ירוק — בוצע
            if (someInProgress) return "#f59e0b"; // כתום — בתהליך
            if (someDone) return "#60a5fa"; // כחול — חלקי
            // בדוק אם היום כבר עבר
            const dayData = dayDates.find((dd: any) => dd.tasks === tasks);
            if (dayData?.dateObj && dayData.dateObj < new Date()) return "#ef4444"; // אדום — לא בוצע
            return "#94a3b8"; // אפור — עתידי
          };

          const getStatusLabel = (tasks: any[]) => {
            if (!tasks || tasks.length === 0) return "אין משימות";
            const done = tasks.filter((t: any) => t.status === "done").length;
            if (done === tasks.length) return "הושלם";
            if (done > 0) return `${done}/${tasks.length} בוצעו`;
            return "ממתין";
          };

          // התקדמות כללית
          const totalTasks = days.reduce((s: number, d: any) => s + (d.tasks?.length || 0), 0);
          const doneTasks = days.reduce((s: number, d: any) => s + (d.tasks?.filter((t: any) => t.status === "done").length || 0), 0);
          const progressPercent = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

          // יום נוכחי
          const currentDayNum = generatedAt
            ? Math.floor((new Date().getTime() - generatedAt.getTime()) / (1000 * 60 * 60 * 24)) + 1
            : 0;

          return (
            <div>
              {/* Progress Summary */}
              <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
                <div style={{ flex: 1, background: C.bg, borderRadius: 16, border: `1px solid ${C.border}`, padding: 20 }}>
                  <div style={{ fontSize: 13, color: C.textMuted }}>התקדמות כללית</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: C.primary, marginTop: 4 }}>{progressPercent}%</div>
                  <div style={{ background: "#e2e8f0", borderRadius: 99, height: 8, marginTop: 8, overflow: "hidden" }}>
                    <div style={{ background: `linear-gradient(90deg, ${C.primary}, #7c3aed)`, height: "100%", width: `${progressPercent}%`, borderRadius: 99, transition: "width 0.5s" }} />
                  </div>
                  <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>{doneTasks} מתוך {totalTasks} משימות</div>
                </div>
                <div style={{ flex: 1, background: C.bg, borderRadius: 16, border: `1px solid ${C.border}`, padding: 20 }}>
                  <div style={{ fontSize: 13, color: C.textMuted }}>יום נוכחי</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: currentDayNum > 60 ? C.success : C.primary, marginTop: 4 }}>
                    {currentDayNum > 60 ? "הושלם!" : `יום ${currentDayNum}`}
                  </div>
                  <div style={{ fontSize: 12, color: C.textMuted, marginTop: 8 }}>{60 - Math.min(currentDayNum, 60)} ימים נותרו</div>
                </div>
                <div style={{ flex: 1, background: C.bg, borderRadius: 16, border: `1px solid ${C.border}`, padding: 20 }}>
                  <div style={{ fontSize: 13, color: C.textMuted }}>ריצות אוטומטיות</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: "#7c3aed", marginTop: 4 }}>{automationLog.length}</div>
                  <div style={{ fontSize: 12, color: C.textMuted, marginTop: 8 }}>
                    {automationLog.length > 0
                      ? `אחרון: ${new Date(automationLog[automationLog.length - 1].date).toLocaleDateString("he-IL")}`
                      : "טרם הורצה"
                    }
                  </div>
                </div>
              </div>

              {/* Legend */}
              <div style={{ display: "flex", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
                {[
                  { color: "#22c55e", label: "הושלם" },
                  { color: "#60a5fa", label: "חלקי" },
                  { color: "#f59e0b", label: "בתהליך" },
                  { color: "#ef4444", label: "לא בוצע" },
                  { color: "#94a3b8", label: "עתידי" },
                ].map(item => (
                  <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 12, height: 12, borderRadius: 3, background: item.color }} />
                    <span style={{ fontSize: 12, color: C.textSecondary }}>{item.label}</span>
                  </div>
                ))}
              </div>

              {/* Calendar Months */}
              {Object.entries(months).map(([monthKey, monthDays]) => {
                const [year, month] = monthKey.split("-").map(Number);
                const monthName = HEB_MONTHS[month - 1];
                const firstDayOfMonth = new Date(year, month - 1, 1);
                const startDow = firstDayOfMonth.getDay(); // 0=Sun
                const daysInMonth = new Date(year, month, 0).getDate();

                // בנה grid עם ימים ריקים בהתחלה
                const calendarCells: (any | null)[] = [];
                for (let i = 0; i < startDow; i++) calendarCells.push(null);
                for (let d = 1; d <= daysInMonth; d++) {
                  const matchDay = monthDays.find((md: any) => md.dateObj?.getDate() === d);
                  calendarCells.push(matchDay || { dayOfMonth: d, empty: true });
                }

                return (
                  <div key={monthKey} style={{ marginBottom: 32 }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 12 }}>
                      {monthName} {year}
                    </div>

                    {/* Day Headers */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 4 }}>
                      {HEB_DAYS.map(d => (
                        <div key={d} style={{ textAlign: "center", fontSize: 11, fontWeight: 600, color: C.textMuted, padding: "4px 0" }}>{d}</div>
                      ))}
                    </div>

                    {/* Calendar Grid */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
                      {calendarCells.map((cell, idx) => {
                        if (!cell) return <div key={`empty-${idx}`} />;
                        if (cell.empty) {
                          return (
                            <div key={`month-${cell.dayOfMonth}`} style={{
                              aspectRatio: "1", borderRadius: 10, background: "#f8fafc",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: 12, color: "#cbd5e1",
                            }}>
                              {cell.dayOfMonth}
                            </div>
                          );
                        }

                        const tasks = cell.tasks || [];
                        const statusColor = getStatusColor(tasks);
                        const isToday = cell.day === currentDayNum;
                        const statusLabel = getStatusLabel(tasks);

                        // Get task status color helper
                        const getTaskStatusColor = (status: string) => {
                          switch (status) {
                            case "done": return "#22c55e";
                            case "in_progress": return "#f59e0b";
                            case "waiting": return "#60a5fa";
                            case "todo": {
                              const dayData = dayDates.find((dd: any) => dd.tasks === tasks);
                              return dayData?.dateObj && dayData.dateObj < new Date() ? "#ef4444" : "#94a3b8";
                            }
                            default: return "#94a3b8";
                          }
                        };

                        return (
                          <div
                            key={`day-${cell.day}`}
                            title={`יום ${cell.day}: ${tasks.map((t: any) => t.title).join(", ")} — ${statusLabel}`}
                            style={{
                              minHeight: 120, borderRadius: 10, background: statusColor + "18",
                              border: isToday ? `2px solid ${C.primary}` : `1px solid ${statusColor}40`,
                              display: "flex", flexDirection: "column", alignItems: "flex-end", justifyContent: "flex-start",
                              cursor: "pointer", position: "relative", overflow: "hidden",
                              boxShadow: isToday ? `0 0 0 3px ${C.primary}30` : "none",
                              transition: "transform 0.15s, box-shadow 0.15s, background-color 0.15s",
                              padding: 8,
                              gap: 4,
                            }}
                            onMouseEnter={(e) => {
                              (e.currentTarget as HTMLElement).style.backgroundColor = statusColor + "28";
                            }}
                            onMouseLeave={(e) => {
                              (e.currentTarget as HTMLElement).style.backgroundColor = statusColor + "18";
                            }}
                            onClick={() => setSelectedCalendarDay(cell)}
                          >
                            {/* Day Number */}
                            <div style={{ fontSize: 15, fontWeight: 700, color: statusColor === "#22c55e" ? "#166534" : statusColor === "#ef4444" ? "#991b1b" : C.text }}>
                              {cell.day}
                            </div>

                            {/* Focus Title */}
                            {cell.focusTitle && (
                              <div style={{ fontSize: 10, fontWeight: 600, color: C.textSecondary, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "100%" }}>
                                {cell.focusTitle}
                              </div>
                            )}

                            {/* Task Details - show up to 2 with status dots */}
                            <div style={{ display: "flex", flexDirection: "column", gap: 3, width: "100%", flex: 1, justifyContent: "flex-start" }}>
                              {tasks.slice(0, 2).map((task: any, idx: number) => (
                                <div key={idx} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 9, color: C.text, width: "100%", overflow: "hidden" }}>
                                  <div style={{ width: 4, height: 4, borderRadius: "50%", background: getTaskStatusColor(task.status), flexShrink: 0 }} />
                                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {task.title.substring(0, 25)}
                                  </span>
                                </div>
                              ))}
                              {tasks.length > 2 && (
                                <div style={{ fontSize: 8, color: C.textMuted, marginTop: 2, fontWeight: 600 }}>
                                  +{tasks.length - 2} עוד
                                </div>
                              )}
                            </div>

                            {/* Status Dot */}
                            <div style={{
                              position: "absolute", top: 4, right: 4, width: 6, height: 6,
                              borderRadius: "50%", background: statusColor,
                            }} />
                            {/* Today Indicator */}
                            {isToday && (
                              <div style={{
                                position: "absolute", bottom: 4, left: 4, fontSize: 7, fontWeight: 700,
                                color: C.primary, letterSpacing: 0.5,
                              }}>
                                היום
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Calendar Day Modal */}
              {selectedCalendarDay && (
                <div
                  style={{
                    position: "fixed", inset: 0, background: "rgba(0, 0, 0, 0.5)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    zIndex: 1000, backdropFilter: "blur(4px)", direction: "rtl",
                  }}
                  onClick={() => setSelectedCalendarDay(null)}
                >
                  <div
                    style={{
                      background: C.bg, borderRadius: 20, maxWidth: 500, width: "90%",
                      maxHeight: "80vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
                      border: `1px solid ${C.border}`,
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Header */}
                    <div style={{
                      padding: "20px 20px", borderBottom: `1px solid ${C.border}`,
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      gap: 12,
                    }}>
                      <div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>
                          יום {selectedCalendarDay.day} — {selectedCalendarDay.focusTitle || "תוכנית יום"}
                        </div>
                        {selectedCalendarDay.dateObj && (
                          <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>
                            {selectedCalendarDay.dateObj.toLocaleDateString("he-IL", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => setSelectedCalendarDay(null)}
                        style={{
                          background: "transparent", border: "none", fontSize: 24, cursor: "pointer",
                          color: C.textMuted, padding: "0 8px", display: "flex", alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        ✕
                      </button>
                    </div>

                    {/* Tasks List */}
                    <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
                      {selectedCalendarDay.tasks && selectedCalendarDay.tasks.length > 0 ? (
                        selectedCalendarDay.tasks.map((task: any, idx: number) => {
                          let taskStatusColor = "#94a3b8";
                          let taskStatusLabel = "טרם התחיל";
                          if (task.status === "done") {
                            taskStatusColor = "#22c55e";
                            taskStatusLabel = "הושלם";
                          } else if (task.status === "in_progress") {
                            taskStatusColor = "#f59e0b";
                            taskStatusLabel = "בתהליך";
                          } else if (task.status === "waiting") {
                            taskStatusColor = "#60a5fa";
                            taskStatusLabel = "ממתין";
                          } else if (task.status === "todo") {
                            const dayData = dayDates.find((dd: any) => dd.tasks === selectedCalendarDay.tasks);
                            if (dayData?.dateObj && dayData.dateObj < new Date()) {
                              taskStatusColor = "#ef4444";
                              taskStatusLabel = "לא בוצע";
                            }
                          }

                          return (
                            <div
                              key={idx}
                              style={{
                                display: "flex", gap: 12, padding: 12, borderRadius: 12,
                                background: taskStatusColor + "12", border: `1px solid ${taskStatusColor}30`,
                                alignItems: "flex-start",
                              }}
                            >
                              <div
                                style={{
                                  width: 8, height: 8, borderRadius: "50%", background: taskStatusColor,
                                  marginTop: 4, flexShrink: 0,
                                }}
                              />
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>
                                  {task.title}
                                </div>
                                {task.description && (
                                  <div style={{ fontSize: 12, color: C.textSecondary, marginTop: 4 }}>
                                    {task.description}
                                  </div>
                                )}
                                <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                                  <span
                                    style={{
                                      fontSize: 11, fontWeight: 600, color: taskStatusColor,
                                      background: taskStatusColor + "20", padding: "2px 8px",
                                      borderRadius: 4,
                                    }}
                                  >
                                    {taskStatusLabel}
                                  </span>
                                  {task.category && (
                                    <span
                                      style={{
                                        fontSize: 11, fontWeight: 600, color: C.textSecondary,
                                        background: C.border, padding: "2px 8px",
                                        borderRadius: 4,
                                      }}
                                    >
                                      {task.category}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div style={{ textAlign: "center", color: C.textMuted, padding: "20px" }}>
                          אין משימות ביום זה
                        </div>
                      )}
                    </div>

                    {/* Footer */}
                    <div style={{
                      padding: "16px 20px", borderTop: `1px solid ${C.border}`,
                      display: "flex", justifyContent: "flex-start",
                    }}>
                      <button
                        onClick={() => setSelectedCalendarDay(null)}
                        style={{
                          background: C.border, color: C.text, border: "none", borderRadius: 8,
                          padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer",
                          transition: "background-color 0.15s",
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLElement).style.backgroundColor = C.border + "cc";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLElement).style.backgroundColor = C.border;
                        }}
                      >
                        סגור
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Automation Log */}
              {automationLog.length > 0 && (
                <div style={{ marginTop: 32 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 12 }}>היסטוריית ריצות אוטומטיות</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {automationLog.slice(-10).reverse().map((log: any, idx: number) => (
                      <div key={idx} style={{
                        background: C.bg, borderRadius: 12, border: `1px solid ${C.border}`, padding: "12px 16px",
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                      }}>
                        <div>
                          <span style={{ fontWeight: 600, fontSize: 14, color: C.text }}>יום {log.dayNumber}</span>
                          <span style={{ fontSize: 12, color: C.textMuted, marginRight: 12 }}>
                            {new Date(log.date).toLocaleDateString("he-IL")} {new Date(log.date).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <span style={{ fontSize: 12, color: "#16a34a", fontWeight: 600 }}>
                            {log.successfulTasks || 0} הצליחו
                          </span>
                          <span style={{ fontSize: 12, color: C.textMuted }}>
                            מתוך {log.totalTasks || 0}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

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

        {/* ── ARTICLES ── */}
        {activeTab === "articles" && (() => {
          const aiArticles: any[] = Array.isArray((plan as any)?.aiArticles) ? (plan as any).aiArticles : [];
          const writtenArticles = aiArticles.filter((a: any) => a?.fullArticle && a.status === 'written');
          const plannedArticles = aiArticles.filter((a: any) => !a?.fullArticle || a.status !== 'written');

          return (
            <div style={{ direction: "rtl" }}>
              {/* Summary header */}
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                marginBottom: 16, padding: "12px 16px", borderRadius: 10,
                background: `${C.primary}08`, border: `1px solid ${C.primary}15`,
              }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>
                    {writtenArticles.length > 0 ? `${writtenArticles.length} מאמרים נכתבו` : "טרם נכתבו מאמרים"}
                  </div>
                  <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
                    {plannedArticles.length > 0 ? `${plannedArticles.length} מאמרים מתוכננים` : ""}
                    {aiArticles.length === 0 ? "לחצו על ״כתוב מאמר מלא עם AI״ בתוך המשימות בתוכנית 60 יום" : ""}
                  </div>
                </div>
                {plannedArticles.length > 0 && (
                  <button
                    onClick={async () => {
                      // Generate all planned articles sequentially
                      for (let i = 0; i < aiArticles.length; i++) {
                        const a = aiArticles[i];
                        if (a?.fullArticle && a.status === 'written') continue;
                        setGeneratingArticle(`batch-${i}`);
                        try {
                          const res = await fetch(`/api/seo-geo-plans/${plan!.id}/generate-article`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              articleIndex: i,
                              title: a.title || '',
                              targetKeyword: a.targetKeyword || a.title || '',
                              outline: a.outline || [],
                            }),
                          });
                          if (res.ok) {
                            const data = await res.json();
                            if (data.data?.article) {
                              setGeneratedArticles(prev => ({ ...prev, [`article-tab-${i}`]: data.data.article }));
                            }
                          }
                        } catch (e) {
                          console.error("Failed to generate article", i, e);
                        }
                      }
                      setGeneratingArticle(null);
                      // Refresh plan data
                      const res = await fetch(`/api/data/seo-plans/${planId}`);
                      if (res.ok) {
                        const data = await res.json();
                        setPlan(data);
                      }
                    }}
                    disabled={!!generatingArticle}
                    style={{
                      padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer",
                      background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark || C.primary})`,
                      color: "#fff", fontSize: 12, fontWeight: 600,
                      opacity: generatingArticle ? 0.6 : 1,
                    }}
                  >
                    {generatingArticle ? "⏳ כותב מאמרים..." : "✨ כתוב את כל המאמרים"}
                  </button>
                )}
              </div>

              {/* Written articles */}
              {writtenArticles.map((article: any, idx: number) => (
                <div key={idx} style={{
                  marginBottom: 16, borderRadius: 10, border: `1px solid #10b98130`,
                  overflow: "hidden", background: C.card,
                }}>
                  <div style={{
                    padding: "12px 16px", borderBottom: `1px solid ${C.borderLight}`,
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                  }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{s(article.title)}</div>
                      <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
                        ביטוי: {s(article.targetKeyword)} | {s(article.wordCount || 1500)} מילים
                        {article.generatedAt ? ` | נוצר: ${new Date(article.generatedAt).toLocaleDateString("he-IL")}` : ""}
                      </div>
                    </div>
                    <span style={{
                      fontSize: 10, fontWeight: 600, padding: "3px 10px", borderRadius: 6,
                      background: "#10b98115", color: "#10b981",
                    }}>✅ נכתב</span>
                  </div>
                  <div style={{
                    padding: "16px 18px", fontSize: 13, color: C.text,
                    maxHeight: 400, overflow: "auto", lineHeight: 1.8, direction: "rtl",
                  }} dangerouslySetInnerHTML={{ __html: article.fullArticle }} />
                  <div style={{ padding: "8px 16px", borderTop: `1px solid ${C.borderLight}`, display: "flex", gap: 8 }}>
                    <button onClick={() => {
                      navigator.clipboard.writeText(article.fullArticle || '').catch(() => {});
                    }} style={{
                      ...smallBtnStyle, flex: 1,
                      background: "#10b98115", color: "#10b981", border: `1px solid #10b98130`,
                    }}>
                      📋 העתק HTML
                    </button>
                    <button onClick={() => {
                      const tmp = document.createElement("div");
                      tmp.innerHTML = article.fullArticle;
                      navigator.clipboard.writeText(tmp.textContent || tmp.innerText || '').catch(() => {});
                    }} style={{
                      ...smallBtnStyle, flex: 1,
                      background: "#10b98115", color: "#10b981", border: `1px solid #10b98130`,
                    }}>
                      📋 העתק טקסט
                    </button>
                  </div>
                </div>
              ))}

              {/* Planned articles */}
              {plannedArticles.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, marginBottom: 8 }}>מאמרים מתוכננים</div>
                  {plannedArticles.map((article: any, idx: number) => (
                    <div key={idx} style={{
                      padding: "12px 16px", borderRadius: 8, marginBottom: 8,
                      border: `1px solid ${C.borderLight}`, background: C.card,
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                    }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{s(article.title)}</div>
                        <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
                          ביטוי: {s(article.targetKeyword)} | {s(article.wordCount || 1500)} מילים
                        </div>
                        {article.whyThisArticle && (
                          <div style={{ fontSize: 11, color: C.textSecondary, marginTop: 4 }}>💡 {s(article.whyThisArticle)}</div>
                        )}
                      </div>
                      <span style={{
                        fontSize: 10, fontWeight: 600, padding: "3px 10px", borderRadius: 6,
                        background: `${C.warning}15`, color: C.warning,
                      }}>⏳ מתוכנן</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Empty state */}
              {aiArticles.length === 0 && (
                <EmptyTab icon="📝" text="טרם נוצרו מאמרים. הרצו את תוכנית 60 היום כדי ליצור נושאי מאמרים, ואז לחצו ״כתוב מאמר מלא עם AI״." />
              )}
            </div>
          );
        })()}

        {/* ── AI RESULTS ── */}
        {activeTab === "ai" && (() => {
          const aiQueries: Array<{platform: string; query: string; found: boolean; confidence: number; snippet?: string; scanMode?: string; position?: number; checkedAt?: string}> =
            (scan?.aiQueries as any[] || []).length > 0
              ? (scan?.aiQueries as any[])
              : (Array.isArray(p.visibilityResults) ? p.visibilityResults : []).map((vr: any) => ({
                  platform: vr.engine || '', query: vr.query || '', found: !!vr.mentioned,
                  confidence: vr.found ? 80 : 0, snippet: vr.context || '', scanMode: 'real',
                }));

          const realQueries = aiQueries.filter(q => q.scanMode === 'real');
          const allPlatforms = Array.from(new Set(realQueries.map(q => q.platform)));
          const totalFound = realQueries.filter(q => q.found).length;
          const totalResults = realQueries.length;
          const score = totalResults > 0 ? Math.round((totalFound / totalResults) * 100) : 0;

          // Time ago helper
          const timeAgo = (dateStr?: string) => {
            if (!dateStr) return "";
            const diff = Date.now() - new Date(dateStr).getTime();
            const mins = Math.floor(diff / 60000);
            if (mins < 60) return `לפני ${mins} דק׳`;
            const hours = Math.floor(mins / 60);
            if (hours < 24) return `לפני כ-${hours} שעות`;
            const days = Math.floor(hours / 24);
            return `לפני ${days} ימים`;
          };

          // Extract URLs/domains from snippet
          const extractSources = (snippet?: string, targetUrl?: string, backendSources?: {url: string; domain: string; title?: string}[]) => {
            const tDomain = targetUrl ? targetUrl.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0] : '';
            // Prefer backend-extracted sources if available
            if (backendSources && backendSources.length > 0) {
              return backendSources.map(s => ({
                domain: s.domain, url: s.url, title: s.title,
                isOwn: tDomain ? s.domain.includes(tDomain) || tDomain.includes(s.domain) : false,
              }));
            }
            if (!snippet) return [];
            const urlRegex = /https?:\/\/[^\s),\]]+/g;
            const domainRegex = /\b([a-z0-9][-a-z0-9]*\.(?:com|co\.il|org\.il|net|io|org|info|biz|me|ai|dev|app|co|il)(?:\.[a-z]{2})?)\b/gi;
            const urls = snippet.match(urlRegex) || [];
            const domains = snippet.match(domainRegex) || [];
            const sourceMap = new Map<string, string>();
            urls.forEach(u => { try { const d = new URL(u).hostname.replace(/^www\./, ''); sourceMap.set(d, u); } catch {} });
            domains.forEach(d => { const clean = d.replace(/^www\./, ''); if (!sourceMap.has(clean)) sourceMap.set(clean, `https://${clean}`); });
            return Array.from(sourceMap.entries()).map(([domain, url]) => ({
              domain, url, isOwn: tDomain ? domain.includes(tDomain) || tDomain.includes(domain) : false,
            }));
          };

          // Apply filters
          let filteredResults = realQueries;
          if (aiPlatformFilter !== "all") filteredResults = filteredResults.filter(q => q.platform === aiPlatformFilter);
          if (aiStatusFilter === "found") filteredResults = filteredResults.filter(q => q.found);
          if (aiStatusFilter === "not_found") filteredResults = filteredResults.filter(q => !q.found);
          if (aiSearchQuery.trim()) {
            const sq = aiSearchQuery.trim().toLowerCase();
            filteredResults = filteredResults.filter(q => q.query.toLowerCase().includes(sq));
          }

          // Group queries by unique query text for queries tab
          const uniqueQueryMap = new Map<string, {query: string; platforms: string[]; found: boolean}>();
          for (const q of realQueries) {
            const key = q.query.toLowerCase();
            if (!uniqueQueryMap.has(key)) uniqueQueryMap.set(key, { query: q.query, platforms: [], found: false });
            const entry = uniqueQueryMap.get(key)!;
            if (!entry.platforms.includes(q.platform)) entry.platforms.push(q.platform);
            if (q.found) entry.found = true;
          }
          const uniqueQueries = Array.from(uniqueQueryMap.values());

          // AI Overview cross-reference: for each unique query, get organic + AIO + AI mention data
          const keywordCrossRef = (() => {
            const qMap = new Map<string, { query: string; organic: number | null; aioFound: boolean; aiFound: boolean; aiVisibility: number; status?: string }>();

            // First: add client keywords from plan (highest priority — always shown)
            const planClientKws: any[] = Array.isArray((safePlan as any)?.clientKeywords) ? (safePlan as any).clientKeywords : [];
            for (const ck of planClientKws) {
              const keyword = typeof ck === 'string' ? ck : ck?.keyword;
              if (!keyword) continue;
              const key = keyword.toLowerCase();
              if (!qMap.has(key)) qMap.set(key, { query: keyword, organic: null, aioFound: false, aiFound: false, aiVisibility: 0, status: 'טרם נבדק' });
            }

            // Then: overlay with real scan data
            for (const q of realQueries) {
              const key = q.query.toLowerCase();
              if (!qMap.has(key)) qMap.set(key, { query: q.query, organic: null, aioFound: false, aiFound: false, aiVisibility: 0 });
              const entry = qMap.get(key)!;
              // Clear "not yet checked" status once we have real data
              if (entry.status === 'טרם נבדק') delete entry.status;
              if (q.platform === 'google_seo' && q.found && q.position) entry.organic = q.position;
              if (q.platform === 'google_ai_overview' && q.found) entry.aioFound = true;
              if (!['google_seo', 'google_ai_overview'].includes(q.platform) && q.found) entry.aiFound = true;
            }
            // Compute AI visibility per keyword
            for (const [key, entry] of qMap) {
              const aiQ = realQueries.filter(q => q.query.toLowerCase() === key && !['google_seo'].includes(q.platform));
              const found = aiQ.filter(q => q.found).length;
              entry.aiVisibility = aiQ.length > 0 ? Math.round((found / aiQ.length) * 100) : 0;
            }
            return Array.from(qMap.values()).sort((a, b) => b.aiVisibility - a.aiVisibility);
          })();

          // Sub-tabs matching competitor
          const subTabs = [
            { id: "results" as const, label: "תוצאות", icon: "📊" },
            { id: "ai_overview" as const, label: "AI Overview", icon: "✨" },
            { id: "queries" as const, label: "השאילתות", icon: "💬" },
          ];

          // Platform tag colors for query cards
          const platTagColors: Record<string, string> = {
            chatgpt: "#10A37F", gemini: "#886FBF", perplexity: "#20808D",
            claude: "#D97757", google_ai_overview: "#34A853", google_seo: "#4285F4",
          };

          return (
          <div>
            {aiQueries.length === 0 ? (
              <EmptyTab icon="🤖" text="אין תוצאות AI. חזור לאשף והרץ סריקת נראות." />
            ) : (
              <>
                {/* ── Hero: Total mentions + percentage ── */}
                <div style={{
                  background: `linear-gradient(135deg, #F3E8FF, #EDE9FE, #F5F3FF)`,
                  borderRadius: 20, padding: "28px 32px", marginBottom: 20,
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                }}>
                  <div>
                    <div style={{ fontSize: 13, color: C.textSecondary, marginBottom: 4 }}>מתוך {totalResults} תוצאות</div>
                    <div style={{ fontSize: 42, fontWeight: 800, color: C.text }}>{score}%</div>
                  </div>
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontSize: 13, color: C.textSecondary, marginBottom: 4 }}>סה״כ אזכורים</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontSize: 42, fontWeight: 800, color: "#7C3AED" }}>{totalFound}</span>
                      <div style={{
                        width: 44, height: 44, borderRadius: "50%", background: "#7C3AED",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Platform cards row ── */}
                <div style={{ fontSize: 13, color: C.textSecondary, marginBottom: 10, textAlign: "right" }}>אזכורים לפי מנוע AI</div>
                <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
                  {allPlatforms.filter(p => p !== 'google_seo').map(pid => {
                    const pd = PLATFORM_DISPLAY[pid] || { name: pid, nameHe: pid, color: C.text };
                    const platQ = realQueries.filter(q => q.platform === pid);
                    const platFound = platQ.filter(q => q.found).length;
                    const platPct = platQ.length > 0 ? Math.round((platFound / platQ.length) * 100) : 0;
                    const isActive = aiPlatformFilter === pid;
                    return (
                      <button key={pid} onClick={() => { setAiSubTab("results"); setAiPlatformFilter(isActive ? "all" : pid); }} style={{
                        flex: "1 1 140px", maxWidth: 200, background: C.card, borderRadius: 16,
                        border: isActive ? `2px solid ${pd.color}` : `1px solid ${C.border}`,
                        padding: "16px 12px", textAlign: "center", cursor: "pointer",
                        boxShadow: isActive ? `0 4px 16px ${pd.color}20` : "0 2px 8px rgba(0,0,0,0.04)",
                        transition: "all 0.2s",
                      }}>
                        <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
                          <PlatformIconComponent platform={pid} size={28} />
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 6 }}>{pd.name}</div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: pd.color }}>{platFound}</div>
                        <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>({platPct}%) מתוך {platQ.length}</div>
                      </button>
                    );
                  })}
                </div>

                {/* ── Sub-tab navigation (competitor style) ── */}
                <div style={{
                  display: "flex", gap: 0, borderBottom: `2px solid ${C.border}`, marginBottom: 20,
                }}>
                  {subTabs.map(tab => (
                    <button key={tab.id} onClick={() => { setAiSubTab(tab.id); }}
                      style={{
                        padding: "12px 20px", border: "none", cursor: "pointer",
                        background: "transparent",
                        color: aiSubTab === tab.id ? C.text : C.textMuted,
                        fontWeight: aiSubTab === tab.id ? 700 : 500,
                        fontSize: 14, transition: "all 0.2s",
                        borderBottom: aiSubTab === tab.id ? `3px solid #7C3AED` : "3px solid transparent",
                        marginBottom: -2,
                        display: "flex", alignItems: "center", gap: 6,
                      }}>
                      <span style={{ fontSize: 14 }}>{tab.icon}</span>
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* ══ SUB-TAB: Results (תוצאות) ══ */}
                {aiSubTab === "results" && (
                  <>
                    {/* Search + filters bar */}
                    <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
                      <div style={{
                        flex: "1 1 240px", position: "relative",
                      }}>
                        <input
                          type="text" value={aiSearchQuery} onChange={e => setAiSearchQuery(e.target.value)}
                          placeholder="חיפוש תוצאות..."
                          style={{
                            width: "100%", padding: "10px 14px 10px 36px", borderRadius: 10,
                            border: `1px solid ${C.border}`, fontSize: 13, background: C.card,
                            color: C.text, outline: "none",
                          }}
                        />
                        <svg style={{ position: "absolute", left: 12, top: 11, opacity: 0.4 }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                      </div>
                      <select value={aiPlatformFilter} onChange={e => setAiPlatformFilter(e.target.value)}
                        style={{
                          padding: "10px 14px", borderRadius: 10, border: `1px solid ${C.border}`,
                          fontSize: 13, background: C.card, color: C.text, cursor: "pointer",
                          minWidth: 140,
                        }}>
                        <option value="all">כל המנועים</option>
                        {allPlatforms.map(pid => {
                          const pd = PLATFORM_DISPLAY[pid] || { name: pid };
                          return <option key={pid} value={pid}>{pd.name}</option>;
                        })}
                      </select>
                      <select value={aiStatusFilter} onChange={e => setAiStatusFilter(e.target.value as any)}
                        style={{
                          padding: "10px 14px", borderRadius: 10, border: `1px solid ${C.border}`,
                          fontSize: 13, background: C.card, color: C.text, cursor: "pointer",
                          minWidth: 120,
                        }}>
                        <option value="all">הכל</option>
                        <option value="found">אוזכר</option>
                        <option value="not_found">לא אוזכר</option>
                      </select>
                    </div>

                    {/* Results count */}
                    <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 12, textAlign: "right" }}>
                      מציג {filteredResults.length} תוצאות
                    </div>

                    {/* Results list - competitor style */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                      {filteredResults.map((q, i) => {
                        const pd = PLATFORM_DISPLAY[q.platform] || { name: q.platform, nameHe: q.platform, color: C.text };
                        const decoded = (q.query || '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#39;/g, "'");
                        const sources = extractSources(q.snippet, p.targetUrl, (q as any).sources);
                        const ownSource = sources.find(s => s.isOwn);
                        return (
                          <div key={i} onClick={() => setAiQueryDetail(q)} style={{
                            padding: "18px 20px", cursor: "pointer", transition: "background 0.15s",
                            borderBottom: `1px solid ${C.borderLight}`, display: "flex", alignItems: "flex-start", gap: 14,
                          }}
                            onMouseEnter={e => (e.currentTarget.style.background = C.bg)}
                            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                          >
                            {/* Eye icon */}
                            <div style={{ marginTop: 2, opacity: 0.3, flexShrink: 0 }}>
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                              </svg>
                            </div>
                            {/* Content */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 8, lineHeight: 1.4 }}>{decoded}</div>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                  <PlatformIconComponent platform={q.platform} size={16} />
                                  <span style={{ fontSize: 12, color: C.textSecondary }}>{pd.name}</span>
                                </div>
                                <span style={{ fontSize: 11, color: C.textMuted }}>{timeAgo(q.checkedAt)}</span>
                                {q.found && (() => {
                                  const mt = (q as any).mentionType;
                                  const sc = (q as any).sourcesCount || sources.length;
                                  const conf = q.confidence;
                                  return (
                                  <>
                                    <span style={{
                                      ...tagStyle, background: `${C.success}12`, color: C.success,
                                    }}>אוזכר</span>
                                    {(mt === 'in_text' || mt === 'both' || (!mt && q.snippet)) && <span style={{ ...tagStyle, background: `${C.info}10`, color: C.info }}>בטקסט</span>}
                                    {(mt === 'in_sources' || mt === 'both' || (!mt && sources.length > 0)) && <span style={{ ...tagStyle, background: `${C.primary}10`, color: C.primary }}>במקורות</span>}
                                    {sc > 0 && <span style={{ ...tagStyle, background: `${C.textMuted}10`, color: C.textMuted }}>{sc} מקורות</span>}
                                    <span style={{
                                      ...tagStyle,
                                      background: conf >= 70 ? `${C.success}10` : conf >= 40 ? '#f59e0b10' : `${C.textMuted}10`,
                                      color: conf >= 70 ? C.success : conf >= 40 ? '#f59e0b' : C.textMuted,
                                    }}>{conf >= 70 ? 'גבוהה' : conf >= 40 ? 'בינונית' : 'נמוכה'}</span>
                                  </>
                                  );
                                })()}
                                {!q.found && <span style={{ ...tagStyle, background: `${C.danger}10`, color: C.danger }}>לא אוזכר</span>}
                              </div>
                              {/* Show own source highlight */}
                              {ownSource && (
                                <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
                                  <span style={{
                                    ...tagStyle, background: `${C.success}12`, color: C.success, fontSize: 11,
                                  }}>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ marginLeft: 4 }}><path d="M20 6L9 17l-5-5"/></svg>
                                    {ownSource.domain}
                                  </span>
                                  {sources.filter(s => !s.isOwn).slice(0, 2).map((s, j) => (
                                    <span key={j} style={{ fontSize: 11, color: C.textMuted }}>{s.domain}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {filteredResults.length === 0 && (
                      <div style={{ padding: 48, textAlign: "center", color: C.textMuted, fontSize: 13 }}>
                        אין תוצאות התואמות לחיפוש
                      </div>
                    )}
                  </>
                )}

                {/* ══ SUB-TAB: AI Overview (מילות מפתח) ══ */}
                {aiSubTab === "ai_overview" && (
                  <div>
                    {/* Header */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                      <div>
                        <h3 style={{ fontSize: 18, fontWeight: 800, color: C.text, margin: 0 }}>מילות מפתח ו-AI Overview</h3>
                        {scan?.scannedAt && (
                          <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>עדכון אחרון {timeAgo(scan.scannedAt as string)}</div>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <span style={{ ...tagStyle, background: `${C.success}12`, color: C.success }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" style={{ marginLeft: 4 }}><path d="M20 6L9 17l-5-5"/></svg>
                          מופיע
                        </span>
                        <span style={{ ...tagStyle, background: `${C.danger}10`, color: C.danger }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" style={{ marginLeft: 4 }}><path d="M18 6L6 18M6 6l12 12"/></svg>
                          לא מופיע
                        </span>
                      </div>
                    </div>
                    {/* Table */}
                    <div style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                        <thead>
                          <tr style={{ background: C.bg }}>
                            <th style={thStyle}>מילת מפתח</th>
                            <th style={{ ...thStyle, textAlign: "center", width: 120 }}>תוצאה אורגנית</th>
                            <th style={{ ...thStyle, textAlign: "center", width: 100 }}>AI Overview</th>
                            <th style={{ ...thStyle, textAlign: "center", width: 100 }}>אתה ב-AI</th>
                            <th style={{ ...thStyle, textAlign: "center", width: 90 }}>נראות AI</th>
                          </tr>
                        </thead>
                        <tbody>
                          {keywordCrossRef.map((kw, i) => {
                            const decoded = (kw.query || '').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
                            return (
                              <tr key={i} style={{ borderBottom: `1px solid ${C.borderLight}` }}>
                                <td style={{ ...tdStyle, fontWeight: 500, fontSize: 13 }}>{decoded}</td>
                                <td style={{ ...tdStyle, textAlign: "center" }}>
                                  {kw.organic ? (
                                    <span style={{
                                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                                      width: 28, height: 28, borderRadius: "50%", background: "#7C3AED",
                                      color: "#fff", fontSize: 12, fontWeight: 700,
                                    }}>{kw.organic}</span>
                                  ) : <span style={{ color: C.textMuted, fontSize: 12 }}>—</span>}
                                </td>
                                <td style={{ ...tdStyle, textAlign: "center" }}>
                                  {(kw as any).status === 'טרם נבדק' ? (
                                    <span style={{ fontSize: 11, color: C.warning }}>טרם נבדק</span>
                                  ) : (
                                    <span style={{ fontSize: 12, color: kw.aioFound ? C.text : C.textMuted }}>
                                      {kw.aioFound ? "יש" : "אין"}
                                    </span>
                                  )}
                                </td>
                                <td style={{ ...tdStyle, textAlign: "center" }}>
                                  {(kw as any).status === 'טרם נבדק' ? (
                                    <span style={{ fontSize: 11, color: C.warning }}>טרם נבדק</span>
                                  ) : kw.aiFound ? (
                                    <span style={{
                                      ...tagStyle, background: `${C.success}12`, color: C.success,
                                    }}>
                                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" style={{ marginLeft: 3 }}><path d="M20 6L9 17l-5-5"/></svg>
                                      מופיע
                                    </span>
                                  ) : (
                                    <span style={{ fontSize: 11, color: C.textMuted }}>—</span>
                                  )}
                                </td>
                                <td style={{ ...tdStyle, textAlign: "center" }}>
                                  {(kw as any).status === 'טרם נבדק' ? (
                                    <span style={{ fontSize: 11, color: C.warning }}>טרם נבדק</span>
                                  ) : (
                                    <span style={{
                                      fontSize: 13, fontWeight: 700,
                                      color: kw.aiVisibility > 40 ? C.success : kw.aiVisibility > 0 ? C.warning : C.textMuted,
                                    }}>{kw.aiVisibility > 0 ? `${kw.aiVisibility}%` : "—"}</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      {keywordCrossRef.length === 0 && (
                        <div style={{ padding: 48, textAlign: "center", color: C.textMuted }}>אין נתונים</div>
                      )}
                    </div>
                  </div>
                )}

                {/* ══ SUB-TAB: Queries (השאילתות) ══ */}
                {aiSubTab === "queries" && (
                  <div>
                    <div style={{ textAlign: "center", marginBottom: 24 }}>
                      <h3 style={{ fontSize: 18, fontWeight: 800, color: C.text, margin: "0 0 8px" }}>השאילתות שלנו בודקות</h3>
                      <p style={{ fontSize: 13, color: C.textMuted, maxWidth: 500, margin: "0 auto" }}>
                        הנה רשימת השאלות והביטויים שאנחנו בודקים עבורך במנועי ה-AI השונים, כדי לוודא שהמותג שלך מופיע בתשובות
                      </p>
                    </div>
                    {/* Cards grid */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
                      {uniqueQueries.map((uq, i) => {
                        const decoded = (uq.query || '').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
                        return (
                          <div key={i} style={{
                            background: C.card, borderRadius: 14, border: `1px solid ${C.border}`,
                            padding: "16px 18px", cursor: "pointer", transition: "all 0.15s",
                            boxShadow: "0 1px 4px rgba(0,0,0,0.03)",
                          }}
                            onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.08)"; e.currentTarget.style.borderColor = "#7C3AED40"; }}
                            onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.03)"; e.currentTarget.style.borderColor = C.border; }}
                          >
                            <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 12 }}>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.textMuted} strokeWidth="1.5" style={{ marginTop: 2, flexShrink: 0 }}>
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                              </svg>
                              <div style={{ fontSize: 13, fontWeight: 500, color: C.text, lineHeight: 1.5 }}>{decoded}</div>
                            </div>
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                              {uq.platforms.map(pid => (
                                <span key={pid} style={{
                                  fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 6,
                                  background: `${platTagColors[pid] || C.textMuted}15`,
                                  color: platTagColors[pid] || C.textMuted,
                                }}>
                                  {(PLATFORM_DISPLAY[pid] || { name: pid }).name}
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ── Query Detail Popup Modal (upgraded) ── */}
                {aiQueryDetail && (() => {
                  const detailPd = PLATFORM_DISPLAY[aiQueryDetail.platform] || { name: aiQueryDetail.platform, nameHe: aiQueryDetail.platform, color: C.text };
                  const detailSources = extractSources(aiQueryDetail.snippet, p.targetUrl, aiQueryDetail.sources);
                  return (
                  <div onClick={() => setAiQueryDetail(null)} style={{
                    position: "fixed", inset: 0, zIndex: 9999,
                    background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <div onClick={e => e.stopPropagation()} style={{
                      background: C.card, borderRadius: 20, width: "90%", maxWidth: 680,
                      maxHeight: "85vh", overflow: "auto", boxShadow: "0 24px 80px rgba(0,0,0,0.25)",
                    }}>
                      {/* Popup header */}
                      <div style={{
                        padding: "20px 24px", borderBottom: `1px solid ${C.border}`,
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                      }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>פרטי תוצאה</div>
                        <button onClick={() => setAiQueryDetail(null)} style={{
                          width: 32, height: 32, borderRadius: 8, border: `1px solid ${C.border}`,
                          background: "transparent", cursor: "pointer", fontSize: 16, color: C.textMuted,
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>✕</button>
                      </div>
                      {/* Query text */}
                      <div style={{ padding: "16px 24px", borderBottom: `1px solid ${C.borderLight}` }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: C.text, lineHeight: 1.5 }}>
                          {(aiQueryDetail.query || '').replace(/&quot;/g, '"').replace(/&amp;/g, '&')}
                        </div>
                      </div>
                      {/* Platform + Status row */}
                      <div style={{
                        padding: "16px 24px", display: "flex", gap: 16, borderBottom: `1px solid ${C.borderLight}`,
                      }}>
                        <div style={{
                          flex: 1, background: C.bg, borderRadius: 14, padding: "14px 16px",
                          border: `1px solid ${C.border}`,
                        }}>
                          <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 6 }}>מנוע</div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <PlatformIconComponent platform={aiQueryDetail.platform} size={22} />
                            <span style={{ fontSize: 14, fontWeight: 600 }}>{detailPd.name}</span>
                          </div>
                        </div>
                        <div style={{
                          flex: 1, background: aiQueryDetail.found ? `${C.success}06` : `${C.danger}06`,
                          borderRadius: 14, padding: "14px 16px",
                          border: `1px solid ${aiQueryDetail.found ? C.success : C.danger}15`,
                        }}>
                          <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 6 }}>סטטוס</div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={aiQueryDetail.found ? C.success : C.danger} strokeWidth="2.5" strokeLinecap="round">
                              {aiQueryDetail.found ? <path d="M20 6L9 17l-5-5"/> : <><path d="M18 6L6 18"/><path d="M6 6l12 12"/></>}
                            </svg>
                            <span style={{ fontSize: 14, fontWeight: 700, color: aiQueryDetail.found ? C.success : C.danger }}>
                              {aiQueryDetail.found ? "אוזכר" : "לא אוזכר"}
                            </span>
                          </div>
                        </div>
                      </div>
                      {/* Mention type + Sources count */}
                      <div style={{
                        padding: "12px 24px", display: "flex", gap: 12, borderBottom: `1px solid ${C.borderLight}`,
                        flexWrap: "wrap",
                      }}>
                        {aiQueryDetail.mentionType && aiQueryDetail.mentionType !== 'none' && (
                          <span style={{
                            ...tagStyle,
                            background: aiQueryDetail.mentionType === 'both' ? `${C.success}12` : `${C.info}10`,
                            color: aiQueryDetail.mentionType === 'both' ? C.success : C.info,
                          }}>
                            {aiQueryDetail.mentionType === 'both' ? 'בטקסט + במקורות' : aiQueryDetail.mentionType === 'in_text' ? 'בטקסט' : 'במקורות'}
                          </span>
                        )}
                        {detailSources.length > 0 && (
                          <span style={{ ...tagStyle, background: `${C.primary}10`, color: C.primary }}>
                            {detailSources.length} מקורות
                          </span>
                        )}
                        {aiQueryDetail.confidence > 0 && (
                          <span style={{
                            ...tagStyle,
                            background: aiQueryDetail.confidence >= 70 ? `${C.success}10` : aiQueryDetail.confidence >= 40 ? '#f59e0b10' : `${C.textMuted}10`,
                            color: aiQueryDetail.confidence >= 70 ? C.success : aiQueryDetail.confidence >= 40 ? '#f59e0b' : C.textMuted,
                          }}>
                            אמינות: {aiQueryDetail.confidence >= 70 ? 'גבוהה' : aiQueryDetail.confidence >= 40 ? 'בינונית' : 'נמוכה'}
                          </span>
                        )}
                      </div>
                      {/* Response content */}
                      {(aiQueryDetail.responseText || aiQueryDetail.snippet) && (
                        <div style={{ padding: "16px 24px", borderBottom: `1px solid ${C.borderLight}` }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 10 }}>תשובה:</div>
                          <div style={{
                            fontSize: 13, color: C.textSecondary, lineHeight: 1.9,
                            direction: "rtl", textAlign: "right", maxHeight: 400, overflow: "auto",
                            whiteSpace: "pre-wrap",
                          }}>
                            {aiQueryDetail.responseText || aiQueryDetail.snippet}
                          </div>
                        </div>
                      )}
                      {/* Sources list */}
                      {detailSources.length > 0 && (
                        <div style={{ padding: "16px 24px" }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 12 }}>
                            מקורות שהוזכרו ({detailSources.length})
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {detailSources.map((src, j) => (
                              <div key={j} style={{
                                padding: "12px 14px", borderRadius: 12,
                                border: src.isOwn ? `2px solid ${C.success}` : `1px solid ${C.border}`,
                                background: src.isOwn ? `${C.success}05` : "transparent",
                                display: "flex", alignItems: "center", justifyContent: "space-between",
                              }}>
                                <div>
                                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{src.domain}</span>
                                    {src.isOwn && (
                                      <span style={{
                                        ...tagStyle, background: `${C.success}15`, color: C.success, fontSize: 10,
                                      }}>האתר שלך</span>
                                    )}
                                  </div>
                                  <div style={{ fontSize: 11, color: C.primary, marginTop: 4, direction: "ltr", textAlign: "left" }}>
                                    {src.url.length > 50 ? src.url.slice(0, 50) + "..." : src.url}
                                  </div>
                                </div>
                                <a href={src.url} target="_blank" rel="noopener noreferrer"
                                  onClick={e => e.stopPropagation()}
                                  style={{ color: C.textMuted, flexShrink: 0 }}>
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                                    <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                                  </svg>
                                </a>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  );
                })()}
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
          // ── PRIORITY 1: AI-generated competitors ──
          const aiCompetitors: any[] = Array.isArray((p as any).aiCompetitors) ? (p as any).aiCompetitors : [];

          // Extract competitor data from scan pipeline aiQueries + plan.competitors
          const aiQueriesRaw: any[] = scan?.aiQueries as any[] || [];
          const planCompetitors: any[] = Array.isArray((p as any).competitors) ? (p as any).competitors : [];
          const scanCompetitors: any[] = Array.isArray((scan as any)?.competitors) ? (scan as any).competitors : [];
          const allCompetitors = [...planCompetitors, ...scanCompetitors];
          const businessProfile = (p as any).businessProfile || (scan as any)?.websiteFacts?.businessProfile;
          const knownCompetitors: string[] = aiCompetitors.length > 0
            ? aiCompetitors.map((c: any) => c.name || c.domain || '').filter(Boolean)
            : businessProfile?.known_competitors || allCompetitors.map((c: any) => c.domain || c.name || '').filter(Boolean) || [];

          // Use AI-generated competitors if available, otherwise suggest generics
          const generateSuggestedCompetitors = () => {
            // AI competitors are already in the main list via knownCompetitors
            if (aiCompetitors.length > 0) return aiCompetitors.map((c: any) => ({
              name: c.name || '',
              domain: c.domain || '',
              strengths: c.strengths || [],
              weaknesses: c.weaknesses || [],
              estimatedTraffic: c.estimatedTraffic || 'בינוני',
              mainKeywords: c.mainKeywords || [],
              suggested: false,
              source: 'ai',
            }));
            // No fake competitors — if no AI data, show empty + enrich button
            return [];
          };
          const suggestedCompetitors = generateSuggestedCompetitors();

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

          const hasCompData = knownCompetitors.length > 0 || mentionedInAI.size > 0 || planCompetitors.length > 0 || suggestedCompetitors.length > 0;

          return (
          <div>
            {!hasCompData ? (
              <div style={{ textAlign: "center", padding: "40px 20px" }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>🏆</div>
                <p style={{ color: C.textMuted, fontSize: 15, marginBottom: 20 }}>
                  אין נתוני מתחרים. לחץ להפעלת AI לזיהוי מתחרים אמיתיים בתחום.
                </p>
                <button
                  onClick={handleAIEnrich}
                  disabled={enrichingAI}
                  style={{
                    background: enrichingAI ? C.border : `linear-gradient(135deg, ${C.primary}, ${C.info})`,
                    color: "#fff",
                    border: "none",
                    borderRadius: 12,
                    padding: "12px 28px",
                    fontSize: 15,
                    fontWeight: 700,
                    cursor: enrichingAI ? "not-allowed" : "pointer",
                    opacity: enrichingAI ? 0.7 : 1,
                  }}
                >
                  {enrichingAI ? "⏳ מחפש מתחרים..." : "🤖 חפש מתחרים עם AI"}
                </button>
              </div>
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
                                  return pd ? <span key={pid} title={pd.name} style={{ display: "inline-flex" }}><PlatformIconComponent platform={pid} size={18} /></span> : null;
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* AI-generated competitors with details */}
                {suggestedCompetitors.length > 0 && suggestedCompetitors[0]?.source === 'ai' && (
                  <div style={{ ...cardStyle, marginTop: 20 }}>
                    <h3 style={{ ...sectionTitle }}>🤖 מתחרים שזוהו ע״י AI</h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {suggestedCompetitors.map((comp: any, i: number) => (
                        <div key={i} style={{
                          padding: "16px", borderRadius: 14, background: C.bg,
                          border: `1px solid ${C.borderLight}`,
                        }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                            <div>
                              <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{comp.name}</div>
                              {comp.domain && <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>🌐 {comp.domain}</div>}
                            </div>
                            {comp.estimatedTraffic && (
                              <span style={{ ...tagStyle, background: `${C.primary}12`, color: C.primary }}>
                                תנועה: {comp.estimatedTraffic}
                              </span>
                            )}
                          </div>
                          {comp.strengths?.length > 0 && (
                            <div style={{ fontSize: 12, color: C.success, marginBottom: 4 }}>
                              💪 חוזקות: {comp.strengths.join(', ')}
                            </div>
                          )}
                          {comp.weaknesses?.length > 0 && (
                            <div style={{ fontSize: 12, color: C.warning, marginBottom: 4 }}>
                              ⚠️ חולשות: {comp.weaknesses.join(', ')}
                            </div>
                          )}
                          {comp.mainKeywords?.length > 0 && (
                            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 6 }}>
                              {comp.mainKeywords.map((kw: string, ki: number) => (
                                <span key={ki} style={{ ...tagStyle, background: `${C.info}10`, color: C.info, fontSize: 10 }}>
                                  {kw}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Plan competitors if available */}
                {planCompetitors.length > 0 && (
                  <div style={{ ...cardStyle, marginTop: suggestedCompetitors.length > 0 ? 20 : 0 }}>
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
          // Helper to clean HTML entities
          const cleanGapQuery = (text: string) => {
            if (!text) return '';
            return text
              .replace(/&#8211;/g, "-")
              .replace(/&#34;/g, '"')
              .replace(/&#39;/g, "'")
              .replace(/&amp;/g, "&")
              .replace(/&lt;/g, "<")
              .replace(/&gt;/g, ">")
              .replace(/&quot;/g, '"')
              .replace(/&#x27;/g, "'")
              .replace(/&nbsp;/g, " ")
              .trim();
          };

          // Helper to check if query is garbage
          const isGarbageQuery = (query: string) => {
            if (!query) return true;
            const cleaned = cleanGapQuery(query);
            if (cleaned.length < 3 || cleaned.length > 100) return true;
            if (cleaned.includes("http") || cleaned.includes(".css") || cleaned.includes(".js") || cleaned.includes("/wp-content/")) return true;
            if (cleaned.includes("&#")) return true;
            const hebrewChars = (cleaned.match(/[֐-׿]/g) || []).length;
            if (hebrewChars < 2 && cleaned !== cleaned.toLowerCase()) return true;
            if (/^[a-z]{3,}$/i.test(cleaned) && !/[א-ת]/i.test(cleaned)) {
              if (cleaned === "kjjk" || cleaned === "abc" || cleaned.match(/^[a-z]{2,}$/)) return true;
            }
            return false;
          };

          // Build content gaps from AI queries where business was NOT found
          const aiQueriesRaw: any[] = scan?.aiQueries as any[] || [];
          const planGaps: any[] = Array.isArray((p as any).contentGaps) ? (p as any).contentGaps : [];

          // Find queries where business is missing per platform
          const missedByQuery = new Map<string, {platforms: string[]; totalPlatforms: number}>();
          const uniqueQueries = Array.from(new Set(
            aiQueriesRaw
              .map(q => cleanGapQuery(s(q.query || "")))
              .filter(q => !isGarbageQuery(q))
          ));

          for (const query of uniqueQueries) {
            const queryResults = aiQueriesRaw.filter(q => cleanGapQuery(s(q.query || "")) === query);
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
                                {query}
                              </div>
                              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                                {data.platforms.map(pid => {
                                  const pd = PLATFORM_DISPLAY[pid] || { name: pid, nameHe: pid, color: C.text };
                                  return (
                                    <span key={pid} style={{
                                      ...tagStyle,
                                      background: `${C.danger}10`,
                                      color: C.danger,
                                      display: "inline-flex", alignItems: "center", gap: 4,
                                    }}>
                                      <PlatformIconComponent platform={pid} size={14} /> לא מופיע ב-{pd.name}
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

                {/* AI-generated article suggestions */}
                {(() => {
                  const aiArts: any[] = Array.isArray((p as any).aiArticles) ? (p as any).aiArticles : [];
                  if (aiArts.length === 0) return null;
                  return (
                    <div style={{ ...cardStyle, marginTop: 20 }}>
                      <h3 style={{ ...sectionTitle }}>🤖 מאמרים מומלצים ע״י AI</h3>
                      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        {aiArts.map((art: any, i: number) => (
                          <div key={art.id || i} style={{
                            padding: "16px", borderRadius: 14, background: C.bg,
                            border: `1px solid ${C.borderLight}`,
                          }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 6 }}>
                              {art.title}
                            </div>
                            {art.targetKeyword && (
                              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                                <span style={{ ...tagStyle, background: `${C.primary}12`, color: C.primary }}>
                                  🎯 {art.targetKeyword}
                                </span>
                                {art.wordCount && (
                                  <span style={{ ...tagStyle, background: `${C.info}12`, color: C.info }}>
                                    {art.wordCount}+ מילים
                                  </span>
                                )}
                                {art.status && (
                                  <span style={{ ...tagStyle, background: `${C.success}12`, color: C.success }}>
                                    {art.status === 'planned' ? 'מתוכנן' : art.status}
                                  </span>
                                )}
                              </div>
                            )}
                            {art.outline && art.outline.length > 0 && (
                              <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 6 }}>
                                <strong>מבנה:</strong> {art.outline.join(' → ')}
                              </div>
                            )}
                            {art.whyThisArticle && (
                              <div style={{ fontSize: 12, color: C.textSecondary, fontStyle: "italic" }}>
                                💡 {art.whyThisArticle}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
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
            core: { label: "CORE — הכי חשובים", color: C.danger, icon: "🎯" },
            services: { label: "שירותים — כוונת רכישה גבוהה", color: C.primary, icon: "💼" },
            differentiation: { label: "בידול — פה אתה מנצח", color: C.success, icon: "⚡" },
            long_tail: { label: "LONG TAIL — הזהב האמיתי", color: C.info, icon: "🔍" },
          };

          // Calculate stats
          const totalKeywords = autoKeywords.length;
          const foundInGoogle = autoKeywords.filter(kw => kw.googlePosition !== null && kw.googlePosition <= 10).length;
          const foundInAI = autoKeywords.filter(kw => kw.aiMentioned).length;
          const avgPosition = autoKeywords
            .filter(kw => kw.googlePosition !== null)
            .reduce((sum, kw) => sum + (kw.googlePosition || 0), 0) / Math.max(1, autoKeywords.filter(kw => kw.googlePosition !== null).length);

          // Client keywords from plan
          const clientKws: any[] = Array.isArray((safePlan as any)?.clientKeywords) ? (safePlan as any).clientKeywords : [];

          return (
            <div>
              {/* ── Client Keywords Tracking ── */}
              {clientKws.length > 0 && (
                <div style={{
                  ...cardStyle,
                  marginBottom: 24,
                  border: `2px solid ${C.primary}30`,
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 20 }}>🎯</span>
                      <h3 style={{ ...sectionTitle, margin: 0 }}>ביטויים של הלקוח — מעקב דירוג</h3>
                    </div>
                    <span style={{
                      ...tagStyle,
                      background: `${C.primary}15`,
                      color: C.primary,
                    }}>
                      {clientKws.length} ביטויים
                    </span>
                  </div>

                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "2fr 90px 90px 80px 1fr",
                    gap: 8,
                    fontSize: 11,
                    color: C.textMuted,
                    fontWeight: 600,
                    marginBottom: 8,
                    padding: "0 12px",
                  }}>
                    <div>ביטוי</div>
                    <div style={{ textAlign: "center" }}>דירוג התחלתי</div>
                    <div style={{ textAlign: "center" }}>דירוג נוכחי</div>
                    <div style={{ textAlign: "center" }}>מגמה</div>
                    <div>עדכון דירוג</div>
                  </div>

                  {clientKws.map((kw: any, idx: number) => {
                    const trendIcon = kw.trend === 'up' ? '📈' : kw.trend === 'down' ? '📉' : kw.trend === 'stable' ? '➡️' : '🆕';
                    const trendColor = kw.trend === 'up' ? C.success : kw.trend === 'down' ? C.danger : kw.trend === 'stable' ? C.info : C.textMuted;
                    const trendLabel = kw.trend === 'up' ? 'עולה' : kw.trend === 'down' ? 'יורד' : kw.trend === 'stable' ? 'יציב' : 'חדש';
                    return (
                      <div key={idx} style={{
                        display: "grid",
                        gridTemplateColumns: "2fr 90px 90px 80px 1fr",
                        gap: 8,
                        alignItems: "center",
                        padding: "10px 12px",
                        borderRadius: 10,
                        background: idx % 2 === 0 ? C.bg : "transparent",
                        border: `1px solid ${C.borderLight}`,
                      }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{s(kw.keyword)}</div>
                        <div style={{ textAlign: "center", fontSize: 13, color: C.textSecondary }}>
                          {kw.initialRank !== null ? `#${kw.initialRank}` : '—'}
                        </div>
                        <div style={{ textAlign: "center", fontSize: 14, fontWeight: 700, color: kw.currentRank !== null ? trendColor : C.textMuted }}>
                          {kw.currentRank !== null ? `#${kw.currentRank}` : '—'}
                        </div>
                        <div style={{ textAlign: "center" }}>
                          <span style={{
                            ...tagStyle,
                            background: `${trendColor}15`,
                            color: trendColor,
                            fontSize: 11,
                          }}>
                            {trendIcon} {trendLabel}
                          </span>
                        </div>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <input
                            type="number"
                            min={1}
                            max={100}
                            placeholder="#"
                            value={editingRanks[idx] ?? ''}
                            onChange={e => setEditingRanks(prev => ({ ...prev, [idx]: e.target.value }))}
                            style={{
                              width: 60, padding: "6px 8px",
                              border: `1px solid ${C.border}`, borderRadius: 8,
                              fontSize: 13, outline: "none", background: C.card,
                              textAlign: "center",
                            }}
                          />
                          <button
                            onClick={async () => {
                              const rank = Number(editingRanks[idx]);
                              if (!rank || rank < 1 || rank > 100) return;
                              setSavingRanks(true);
                              try {
                                const res = await fetch(`/api/seo-geo-plans/${safePlan?.id}/keywords`, {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ keywordIndex: idx, newRank: rank }),
                                });
                                if (res.ok) {
                                  const updated = await res.json();
                                  if (updated.clientKeywords) {
                                    setPlan((prev: any) => prev ? { ...prev, clientKeywords: updated.clientKeywords } : prev);
                                  }
                                  setEditingRanks(prev => { const copy = { ...prev }; delete copy[idx]; return copy; });
                                }
                              } catch (e) {
                                console.error('Failed to update rank:', e);
                              }
                              setSavingRanks(false);
                            }}
                            disabled={savingRanks || !editingRanks[idx]}
                            style={{
                              padding: "6px 12px", borderRadius: 8, border: "none",
                              background: editingRanks[idx] ? C.primary : C.border,
                              color: editingRanks[idx] ? "#fff" : C.textMuted,
                              fontSize: 12, fontWeight: 600, cursor: "pointer",
                              whiteSpace: "nowrap",
                            }}
                          >
                            עדכן
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {/* Last checked info */}
                  {clientKws.some((kw: any) => kw.lastChecked) && (
                    <div style={{ fontSize: 11, color: C.textMuted, marginTop: 12, textAlign: "left" }}>
                      עדכון אחרון: {new Date(clientKws.find((kw: any) => kw.lastChecked)?.lastChecked).toLocaleDateString('he-IL')}
                    </div>
                  )}
                </div>
              )}

              {totalKeywords === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 20px" }}>
                  <div style={{ fontSize: 48, marginBottom: 16 }}>🔑</div>
                  <p style={{ color: C.textMuted, fontSize: 15, marginBottom: 20 }}>
                    אין ביטויי SEO זמינים. ניתן להפעיל העשרת AI לגילוי ביטויים חכמים.
                  </p>
                  <button
                    onClick={handleAIEnrich}
                    disabled={enrichingAI}
                    style={{
                      background: enrichingAI ? C.border : `linear-gradient(135deg, ${C.primary}, ${C.info})`,
                      color: "#fff",
                      border: "none",
                      borderRadius: 12,
                      padding: "12px 28px",
                      fontSize: 15,
                      fontWeight: 700,
                      cursor: enrichingAI ? "not-allowed" : "pointer",
                      opacity: enrichingAI ? 0.7 : 1,
                    }}
                  >
                    {enrichingAI ? "⏳ מעשיר עם AI..." : "🤖 העשרת AI — ביטויים, מתחרים ומאמרים"}
                  </button>
                </div>
              ) : (
                <>
                  {/* AI re-enrich button */}
                  <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
                    <button
                      onClick={handleAIEnrich}
                      disabled={enrichingAI}
                      style={{
                        background: enrichingAI ? C.border : `${C.primary}15`,
                        color: enrichingAI ? C.textMuted : C.primary,
                        border: `1px solid ${enrichingAI ? C.border : C.primary}30`,
                        borderRadius: 8,
                        padding: "6px 16px",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: enrichingAI ? "not-allowed" : "pointer",
                      }}
                    >
                      {enrichingAI ? "⏳ מעשיר..." : "🤖 רענן עם AI"}
                    </button>
                  </div>

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
