"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// ── Types ──────────────────────────────────────────────────────────────────────

type ScanType = 'quick' | 'deep';
type StageStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

interface StageProgress {
  stage: string;
  index: number;
  label: string;
  labelHe: string;
  status: StageStatus;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  itemsProcessed?: number;
  itemsTotal?: number;
}

interface LogEntry {
  timestamp: string;
  stage: string;
  action: string;
  result?: 'success' | 'warning' | 'error' | 'skipped' | 'info';
  detail?: string;
}

interface PlatformStatus {
  id: string;
  name: string;
  icon: string;
  status: 'waiting' | 'running' | 'completed' | 'skipped' | 'api_missing';
  queriesScanned: number;
  mentionsFound: number;
  scanMode: 'real' | 'simulated' | 'unavailable';
}

interface Metrics {
  pagesScanned: number;
  evidenceCount: number;
  confidenceScore: number;
  scanDurationMs: number;
  platformsChecked: number;
  unavailableResults: number;
}

interface ValidationCheck {
  id: string;
  label: string;
  passed: boolean;
  actual: string;
  required: string;
}

interface Validation {
  passed: boolean;
  checks: ValidationCheck[];
  invalidReason?: string;
}

interface ScanJob {
  id: string;
  url: string;
  scanType: ScanType;
  status: string;
  progress: number;
  stages: StageProgress[];
  logs: LogEntry[];
  metrics: Metrics;
  platformStatuses: PlatformStatus[];
  startedAt: string;
  completedAt?: string;
  totalDurationMs?: number;
  validation?: Validation;
  result?: any;
  error?: string;
}

// ── Runtime validation — canonical ScanJob shape ───────────────────────────────

const EMPTY_METRICS: Metrics = {
  pagesScanned: 0, evidenceCount: 0, confidenceScore: 0,
  scanDurationMs: 0, platformsChecked: 0, unavailableResults: 0,
};

/** Ensures a ScanJob always has safe defaults for all arrays/objects. */
function safeScanJob(raw: Partial<ScanJob> | null): ScanJob | null {
  if (!raw) return null;
  return {
    id: raw.id || 'unknown',
    url: raw.url || '',
    scanType: raw.scanType || 'quick',
    status: raw.status || 'init',
    progress: raw.progress ?? 0,
    stages: Array.isArray(raw.stages) ? raw.stages : [],
    logs: Array.isArray(raw.logs) ? raw.logs : [],
    metrics: raw.metrics ? { ...EMPTY_METRICS, ...raw.metrics } : { ...EMPTY_METRICS },
    platformStatuses: Array.isArray(raw.platformStatuses) ? raw.platformStatuses : [],
    startedAt: raw.startedAt || new Date().toISOString(),
    completedAt: raw.completedAt,
    totalDurationMs: raw.totalDurationMs,
    validation: raw.validation,
    result: raw.result,
    error: raw.error,
  };
}

// ── Colors ─────────────────────────────────────────────────────────────────────

const C = {
  bg: '#f8f9fc',
  card: '#ffffff',
  cardGlass: 'rgba(255,255,255,0.85)',
  border: '#e5e7eb',
  borderLight: '#f0f1f5',
  primary: '#2563eb',
  primaryLight: '#dbeafe',
  accent: '#e9fe00',
  accentEnd: '#d3e200',
  success: '#22c55e',
  successLight: '#dcfce7',
  warning: '#f59e0b',
  warningLight: '#fef3c7',
  danger: '#ef4444',
  dangerLight: '#fee2e2',
  text: '#111827',
  textSecondary: '#6b7280',
  textMuted: '#9ca3af',
  logBg: '#0f1117',
  logText: '#9ca3af',
};

// ── Main Page Component ────────────────────────────────────────────────────────

export default function PixelSeoScanPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', direction: 'rtl' }}>טוען...</div>}>
      <ScanPageInner />
    </Suspense>
  );
}

function ScanPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlParam = searchParams.get("url") || "";
  const clientName = searchParams.get("client") || "";
  const planId = searchParams.get("planId") || "";

  // State
  const [scanUrl, setScanUrl] = useState(urlParam);
  const [scanType, setScanType] = useState<ScanType>('quick');
  const [phase, setPhaseRaw] = useState<'select' | 'scanning' | 'done'>('select');
  const [job, setJobRaw] = useState<ScanJob | null>(null);
  const [savedPlanId, setSavedPlanId] = useState<string>(planId);

  // ── GUARD: Never allow phase to regress from 'scanning' back to 'select' ──
  // Only an explicit user action (rescan button) should reset to 'select'.
  const scanActiveRef = useRef(false);
  const setPhase = useCallback((next: 'select' | 'scanning' | 'done') => {
    if (next === 'select' && scanActiveRef.current) {
      console.warn('[SEO-GEO 77 DEBUG] BLOCKED setPhase("select") during active scan — refusing to reset');
      return; // Block the reset
    }
    if (next === 'scanning') scanActiveRef.current = true;
    if (next === 'select') scanActiveRef.current = false;
    console.log(`[SEO-GEO 77 DEBUG] setPhase: ${next}`);
    setPhaseRaw(next);
  }, []);

  // Wrap setJob to always validate the shape
  const setJob = useCallback((val: ScanJob | null | ((prev: ScanJob | null) => ScanJob | null)) => {
    if (typeof val === 'function') {
      setJobRaw(prev => safeScanJob(val(prev)));
    } else {
      setJobRaw(safeScanJob(val));
    }
  }, []);
  const [elapsed, setElapsed] = useState(0);
  const [showEvidence, setShowEvidence] = useState<any>(null);

  // Platform API availability (fetched from server)
  const [platformApiStatus, setPlatformApiStatus] = useState<Record<string, boolean>>({});

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(0);

  // Fetch platform API status from server on mount
  useEffect(() => {
    fetch('/api/pixel-seo-geo/platform-status')
      .then(r => r.json())
      .then(data => setPlatformApiStatus(data))
      .catch(() => {});
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Simulated stage progression while waiting for sync response
  const STAGE_DEFS: Array<{ stage: string; labelHe: string; durationRange: [number, number] }> = [
    { stage: 'init', labelHe: 'התחלת סריקה', durationRange: [300, 600] },
    { stage: 'fetch_homepage', labelHe: 'שליפת עמוד הבית', durationRange: [1000, 2500] },
    { stage: 'discover_pages', labelHe: 'גילוי עמודים פנימיים', durationRange: [800, 1500] },
    { stage: 'extract_content', labelHe: 'חילוץ כותרות ותוכן', durationRange: [2000, 5000] },
    { stage: 'detect_business', labelHe: 'זיהוי תחום העסק', durationRange: [500, 1200] },
    { stage: 'build_keywords', labelHe: 'בניית מילות מפתח', durationRange: [400, 1000] },
    { stage: 'generate_queries', labelHe: 'יצירת שאלות AI', durationRange: [600, 1500] },
    { stage: 'check_visibility', labelHe: 'בדיקת נראות במנועים', durationRange: [2000, 4000] },
    { stage: 'validate_evidence', labelHe: 'אימות ראיות', durationRange: [500, 1200] },
    { stage: 'finalize', labelHe: 'סיום סריקה', durationRange: [300, 800] },
  ];

  const simulateProgress = useCallback(() => {
    const stages: StageProgress[] = STAGE_DEFS.map((d, i) => ({
      stage: d.stage, index: i + 1, label: d.stage, labelHe: d.labelHe,
      status: 'pending' as StageStatus,
    }));
    const logs: LogEntry[] = [];

    let stageIdx = 0;
    const advanceStage = () => {
      if (stageIdx >= stages.length) return;

      // Complete previous stage
      if (stageIdx > 0) {
        stages[stageIdx - 1].status = 'completed';
        stages[stageIdx - 1].completedAt = new Date().toISOString();
      }

      // Start current stage
      stages[stageIdx].status = 'running';
      stages[stageIdx].startedAt = new Date().toISOString();
      logs.push({
        timestamp: new Date().toISOString(),
        stage: stages[stageIdx].stage,
        action: `שלב ${stageIdx + 1}: ${stages[stageIdx].labelHe}`,
        result: 'info',
      });

      const progress = Math.round(((stageIdx + 0.5) / stages.length) * 90);

      // Debug logging at critical 77% point (stage 8 = validate_evidence)
      if (stageIdx >= 7) {
        console.log(`[SEO-GEO 77 DEBUG] entering stage ${stageIdx} (${stages[stageIdx].stage}) progress=${progress}%`);
      }

      // CRITICAL: Capture stageIdx in a const so the React state updater always reads
      // the correct value — `stageIdx` is a mutable `let` and may be incremented
      // before React 19's concurrent renderer calls the updater function.
      const idx = stageIdx;
      const stageName = stages[idx].stage;
      const stagesCopy = [...stages];
      const logsCopy = [...logs];

      setJob(prev => ({
        ...(prev || {
          id: 'sim', url: '', scanType, status: 'init' as any, progress: 0,
          stages: [], logs: [], metrics: { pagesScanned: 0, evidenceCount: 0, confidenceScore: 0, scanDurationMs: 0, platformsChecked: 0, unavailableResults: 0 },
          platformStatuses: [], startedAt: new Date().toISOString(),
        }),
        status: stageName as any,
        progress,
        stages: stagesCopy,
        logs: logsCopy,
        metrics: {
          pagesScanned: Math.min(idx * 2, scanType === 'deep' ? 30 : 8),
          evidenceCount: Math.min(idx, 10),
          confidenceScore: Math.min(idx * 10, 80),
          scanDurationMs: Date.now() - startTimeRef.current,
          platformsChecked: idx >= 7 ? 1 : 0,
          unavailableResults: idx >= 7 ? 5 : 0,
        },
        platformStatuses: [
          { id: 'google_seo', name: 'Google SEO', icon: '🔍', status: platformApiStatus.google_seo ? (idx >= 8 ? 'completed' : idx >= 7 ? 'running' : 'waiting') : 'api_missing', queriesScanned: 0, mentionsFound: 0, scanMode: platformApiStatus.google_seo ? 'real' as const : 'unavailable' as const },
          { id: 'google_ai_overview', name: 'Google AI Overview', icon: '✨', status: platformApiStatus.google_ai_overview ? (idx >= 8 ? 'completed' : idx >= 7 ? 'running' : 'waiting') : 'api_missing', queriesScanned: 0, mentionsFound: 0, scanMode: platformApiStatus.google_ai_overview ? 'real' as const : 'unavailable' as const },
          { id: 'gemini', name: 'Gemini', icon: '💎', status: platformApiStatus.gemini ? (idx >= 8 ? 'completed' : idx >= 7 ? 'running' : 'waiting') : 'api_missing', queriesScanned: 0, mentionsFound: 0, scanMode: platformApiStatus.gemini ? 'real' as const : 'unavailable' as const },
          { id: 'chatgpt', name: 'ChatGPT', icon: '🤖', status: platformApiStatus.chatgpt ? (idx >= 8 ? 'completed' : idx >= 7 ? 'running' : 'waiting') : 'api_missing', queriesScanned: 0, mentionsFound: 0, scanMode: platformApiStatus.chatgpt ? 'real' as const : 'unavailable' as const },
          { id: 'claude', name: 'Claude', icon: '🧠', status: platformApiStatus.claude ? (idx >= 8 ? 'completed' : idx >= 7 ? 'running' : 'waiting') : 'api_missing', queriesScanned: 0, mentionsFound: 0, scanMode: platformApiStatus.claude ? 'real' as const : 'unavailable' as const },
          { id: 'perplexity', name: 'Perplexity', icon: '🔮', status: platformApiStatus.perplexity ? (idx >= 8 ? 'completed' : idx >= 7 ? 'running' : 'waiting') : 'api_missing', queriesScanned: 0, mentionsFound: 0, scanMode: platformApiStatus.perplexity ? 'real' as const : 'unavailable' as const },
        ],
      }));

      stageIdx++;
      if (stageIdx < stages.length) {
        const [min, max] = STAGE_DEFS[stageIdx - 1].durationRange;
        const delay = min + Math.random() * (max - min);
        pollRef.current = setTimeout(advanceStage, delay) as any;
      }
    };

    advanceStage();
  }, [scanType, platformApiStatus]);

  // Start scan — uses sync endpoint, simulates progress on client
  const startScan = useCallback(async () => {
    if (!scanUrl) return;
    console.log(`[PIXEL-SEO-SCAN-UI] INIT url=${scanUrl} type=${scanType}`);
    setPhase('scanning');
    startTimeRef.current = Date.now();
    setElapsed(0);

    // Elapsed timer
    timerRef.current = setInterval(() => {
      setElapsed(Date.now() - startTimeRef.current);
    }, 200);

    // Start simulated stage progression
    simulateProgress();

    try {
      // Single sync request — pipeline runs server-side, returns full result
      console.log(`[PIXEL-SEO-SCAN-UI] FETCH_START POST /api/seo/scan`);
      const res = await fetch("/api/seo/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: scanUrl, scanType }),
      });

      // Stop simulation
      if (pollRef.current) clearTimeout(pollRef.current as any);
      if (timerRef.current) clearInterval(timerRef.current);
      pollRef.current = null;
      timerRef.current = null;

      const totalElapsed = Date.now() - startTimeRef.current;
      setElapsed(totalElapsed);
      console.log(`[SEO-GEO 77 DEBUG] API response received: status=${res.status} elapsed=${totalElapsed}ms`);
      console.log(`[SEO-GEO 77 DEBUG] scan state before update: phase=scanning, jobProgress=${job?.progress}, currentStage=${job?.stages?.find(s => s.status === 'running')?.stage}`);

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'שגיאה' }));
        console.error(`[PIXEL-SEO-SCAN-UI] FETCH_FAILED status=${res.status} error=${err.error}`);
        setJob(prev => prev ? {
          ...prev, status: 'failed' as any, progress: 100, error: err.error || 'שגיאה בסריקה',
          stages: (prev.stages || []).map(s => s.status === 'running' ? { ...s, status: 'failed' as StageStatus } : s.status === 'pending' ? { ...s, status: 'skipped' as StageStatus } : s),
        } : null);
        setPhase('done');
        return;
      }

      const data = await res.json();
      const pipeline = data._pipeline || {};
      console.log(`[PIXEL-SEO-SCAN-UI] RESPONSE_PARSED jobId=${pipeline.jobId} stagesCount=${pipeline.stages?.length ?? 0} logsCount=${pipeline.logs?.length ?? 0} hasResult=${!!data.websiteFacts}`);

      // Build final job from real response
      setJob({
        id: pipeline.jobId || 'scan',
        url: scanUrl,
        scanType,
        status: 'completed',
        progress: 100,
        stages: (pipeline.stages || []).length > 0 ? pipeline.stages : STAGE_DEFS.map((d, i) => ({
          stage: d.stage, index: i + 1, label: d.stage, labelHe: d.labelHe, status: 'completed' as StageStatus,
        })),
        logs: (pipeline.logs || []).length > 0 ? pipeline.logs : [],
        metrics: data.metrics || {
          pagesScanned: data.totalPages || data.scannedPages?.length || 0,
          evidenceCount: 0, confidenceScore: data.websiteFacts?.confidence_score || 0,
          scanDurationMs: totalElapsed, platformsChecked: 1, unavailableResults: 5,
        },
        platformStatuses: data.platformStatuses || [],
        startedAt: new Date(startTimeRef.current).toISOString(),
        completedAt: new Date().toISOString(),
        totalDurationMs: pipeline.totalDurationMs || totalElapsed,
        validation: pipeline.validation || null,
        result: data,
      });
      setPhase('done');
      console.log(`[PIXEL-SEO-SCAN-UI] COMPLETED totalElapsed=${totalElapsed}ms`);

      // ── PERSIST: Save scan results to seo-plans DB ──────────────
      try {
        const clientId = searchParams.get("clientId") || '';
        const planPayload = {
          clientId,
          clientName: clientName || data.websiteFacts?.business_name?.value || '',
          websiteUrl: scanUrl,
          status: 'scanned',
          websiteScan: {
            url: data.url || scanUrl,
            scannedAt: data.scannedAt || new Date().toISOString(),
            hasSSL: data.hasSSL ?? false,
            loadTimeMs: data.loadTimeMs ?? 0,
            mobileOptimized: data.mobileOptimized ?? false,
            metaTitle: data.metaTitle || '',
            metaDescription: data.metaDescription || '',
            h1Tags: data.h1Tags || [],
            totalPages: data.totalPages || 0,
            indexedPages: data.indexedPages || 0,
            brokenLinks: data.brokenLinks || 0,
            hasRobotsTxt: data.hasRobotsTxt ?? false,
            hasSitemap: data.hasSitemap ?? false,
            domainAuthority: data.domainAuthority || 0,
            structuredData: data.structuredData ?? false,
            openGraph: data.openGraph ?? false,
            canonicalTags: data.canonicalTags ?? false,
            issues: data.issues || [],
            websiteFacts: data.websiteFacts || null,
            scannedPages: data.scannedPages || [],
            aiQueries: data.aiQueries || [],
            platformStatuses: data.platformStatuses || [],
            metrics: data.metrics || {},
            scanDuration: data.scanDuration || {},
            scanType,
          },
        };

        // Helper: attempt to save plan
        const attemptSave = async (): Promise<string | null> => {
          if (savedPlanId) {
            await fetch(`/api/data/seo-plans/${savedPlanId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(planPayload),
            });
            return savedPlanId;
          } else {
            const saveRes = await fetch('/api/data/seo-plans', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(planPayload),
            });
            if (saveRes.ok) {
              const saved = await saveRes.json();
              const newId = saved.id || saved.planId;
              // Check if it's a real ID (not temp-xxx which means table is missing)
              if (newId && !String(newId).startsWith('temp-')) return newId;
            }
            return null;
          }
        };

        // First attempt
        let resultId = await attemptSave();

        // If save failed or returned temp ID, auto-migrate and retry
        if (!resultId) {
          console.log('[PIXEL-SEO-SCAN-UI] Save failed — running auto-migration...');
          try {
            const migRes = await fetch('/api/seo/migrate');
            const migData = await migRes.json();
            console.log('[PIXEL-SEO-SCAN-UI] Migration result:', migData.summary);
          } catch (migErr) {
            console.warn('[PIXEL-SEO-SCAN-UI] Migration failed:', migErr);
          }
          // Wait a moment for table to be ready, then retry
          await new Promise(r => setTimeout(r, 1500));
          resultId = await attemptSave();
        }

        if (resultId) {
          setSavedPlanId(resultId);
          console.log(`[PIXEL-SEO-SCAN-UI] PERSISTED planId=${resultId}`);
        } else {
          console.warn('[PIXEL-SEO-SCAN-UI] PERSIST_FAILED after migration retry');
          console.warn('[PIXEL-SEO-SCAN-UI] ⚠️ To fix: go to Supabase SQL Editor and run:\n' +
            'CREATE TABLE IF NOT EXISTS public.app_seo_plans (\n' +
            '  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n' +
            '  data JSONB NOT NULL DEFAULT \'{}\',\n' +
            '  created_at TIMESTAMPTZ DEFAULT NOW(),\n' +
            '  updated_at TIMESTAMPTZ DEFAULT NOW()\n' +
            ');\n' +
            'NOTIFY pgrst, \'reload schema\';');
        }
      } catch (persistErr) {
        console.warn('[PIXEL-SEO-SCAN-UI] PERSIST_ERROR', persistErr);
        // Non-blocking — scan still shows results even if save fails
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`[SEO-GEO 77 DEBUG] EXCEPTION in startScan: ${errMsg}`, err);
      console.error(`[SEO-GEO 77 DEBUG] scan state at crash: phase=scanning, url=${scanUrl}, scanType=${scanType}, jobId=${job?.id}, progress=${job?.progress}`);

      if (pollRef.current) clearTimeout(pollRef.current as any);
      if (timerRef.current) clearInterval(timerRef.current);
      pollRef.current = null;
      timerRef.current = null;

      // ── CRITICAL FIX: NEVER reset to 'select' on error ──
      // Show error state in 'done' phase so user sees what failed and can retry.
      const totalElapsed = Date.now() - startTimeRef.current;
      setElapsed(totalElapsed);
      setJob(prev => prev ? {
        ...prev,
        status: 'failed' as any,
        progress: prev.progress || 0,
        error: `שגיאת רשת: ${errMsg}`,
        stages: (prev.stages || []).map(s =>
          s.status === 'running' ? { ...s, status: 'failed' as StageStatus } :
          s.status === 'pending' ? { ...s, status: 'skipped' as StageStatus } : s
        ),
      } : {
        id: 'error', url: scanUrl, scanType, status: 'failed', progress: 0,
        stages: [], logs: [], metrics: { ...EMPTY_METRICS, scanDurationMs: totalElapsed },
        platformStatuses: [], startedAt: new Date(startTimeRef.current).toISOString(),
        error: `שגיאת רשת: ${errMsg}`,
      });
      setPhaseRaw('done'); // bypass guard — intentional move to done
      scanActiveRef.current = false;
    }
  }, [scanUrl, scanType, simulateProgress, job]);

  const rescan = useCallback(() => {
    console.log('[SEO-GEO 77 DEBUG] User-initiated rescan — clearing state');
    // Explicitly deactivate scan guard before resetting
    scanActiveRef.current = false;
    setJob(null);
    setPhase('select');
  }, [setJob, setPhase]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{
      minHeight: '100vh', background: `linear-gradient(135deg, ${C.bg} 0%, #eef2ff 50%, ${C.bg} 100%)`,
      direction: 'rtl', fontFamily: 'system-ui, -apple-system, sans-serif',
      padding: '24px 32px',
    }}>
      {/* ── Header ─────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 28, flexWrap: 'wrap', gap: 12,
      }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: C.text, margin: 0 }}>
            PIXEL SEO/GEO
          </h1>
          <div style={{ fontSize: 14, color: C.textSecondary, marginTop: 4 }}>
            {clientName && <span>{clientName} • </span>}
            {scanUrl && <span style={{ direction: 'ltr', display: 'inline-block' }}>{scanUrl}</span>}
            {!scanUrl && 'סריקת אתר'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Scan type badge */}
          {phase !== 'select' && (
            <span style={{
              padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
              background: scanType === 'deep' ? C.primaryLight : C.borderLight,
              color: scanType === 'deep' ? C.primary : C.textSecondary,
            }}>
              {scanType === 'deep' ? 'סריקה עמוקה' : 'סריקה מהירה'}
            </span>
          )}
          {/* Status badge */}
          <span style={{
            padding: '4px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700,
            background: phase === 'scanning' ? C.primaryLight :
                       job?.validation?.passed ? C.successLight :
                       phase === 'done' && !job?.validation?.passed ? C.warningLight : C.borderLight,
            color: phase === 'scanning' ? C.primary :
                  job?.validation?.passed ? C.success :
                  phase === 'done' && !job?.validation?.passed ? C.warning : C.textMuted,
          }}>
            {phase === 'select' ? 'ממתין' :
             phase === 'scanning' ? 'סורק...' :
             job?.status === 'failed' ? 'נכשל' :
             job?.validation?.passed ? 'הושלם' : 'לא תקין'}
          </span>
        </div>
      </div>

      {/* ── Phase: Select Scan Type ───────────────────────────── */}
      {phase === 'select' && (
        <div>
          {/* URL input */}
          {!urlParam && (
            <div style={{
              background: C.card, borderRadius: 16, border: `1px solid ${C.border}`,
              padding: 24, marginBottom: 24,
              backdropFilter: 'blur(12px)',
            }}>
              <label style={{ fontSize: 14, fontWeight: 600, color: C.text, display: 'block', marginBottom: 8 }}>
                כתובת האתר
              </label>
              <input
                value={scanUrl}
                onChange={e => setScanUrl(e.target.value)}
                placeholder="https://example.com"
                style={{
                  width: '100%', padding: '12px 16px', borderRadius: 10,
                  border: `1px solid ${C.border}`, fontSize: 15,
                  direction: 'ltr', background: C.bg, outline: 'none',
                }}
              />
            </div>
          )}

          {/* Scan type cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 28 }}>
            {[
              {
                type: 'quick' as ScanType,
                title: 'סריקה מהירה',
                subtitle: 'Quick Scan',
                icon: '⚡',
                desc: '3–10 דפים | תוצאות מהירות | עובדות בסיסיות | מילות מפתח ראשוניות',
                time: '10–30 שניות',
              },
              {
                type: 'deep' as ScanType,
                title: 'סריקה עמוקה',
                subtitle: 'Deep Scan',
                icon: '🔬',
                desc: 'עד 50 דפים | אמינות גבוהה | ראיות מורחבות | תוכנית 60 יום חזקה יותר',
                time: '1–3 דקות',
              },
            ].map(opt => (
              <button
                key={opt.type}
                onClick={() => setScanType(opt.type)}
                style={{
                  background: scanType === opt.type
                    ? `linear-gradient(135deg, ${C.card}, ${C.primaryLight})`
                    : C.card,
                  border: scanType === opt.type ? `2px solid ${C.primary}` : `1px solid ${C.border}`,
                  borderRadius: 20, padding: '28px 24px', textAlign: 'right',
                  cursor: 'pointer', transition: 'all 0.2s',
                  boxShadow: scanType === opt.type ? `0 4px 20px ${C.primary}15` : '0 1px 4px rgba(0,0,0,0.04)',
                }}
              >
                <div style={{ fontSize: 36, marginBottom: 12 }}>{opt.icon}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: C.text }}>{opt.title}</div>
                <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 8 }}>{opt.subtitle}</div>
                <div style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.6 }}>{opt.desc}</div>
                <div style={{
                  marginTop: 12, fontSize: 12, color: C.primary, fontWeight: 600,
                  background: C.primaryLight, padding: '4px 10px', borderRadius: 8, display: 'inline-block',
                }}>
                  {opt.time}
                </div>
              </button>
            ))}
          </div>

          {/* Platform API Status */}
          {Object.keys(platformApiStatus).length > 0 && (
            <div style={{
              background: C.card, borderRadius: 16, border: `1px solid ${C.border}`,
              padding: 20, marginBottom: 24,
            }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: '0 0 14px 0' }}>
                פלטפורמות AI
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                {[
                  { id: 'google_seo', name: 'Google SEO', icon: '🔍' },
                  { id: 'google_ai_overview', name: 'Google AI Overview', icon: '✨' },
                  { id: 'gemini', name: 'Gemini', icon: '💎' },
                  { id: 'chatgpt', name: 'ChatGPT', icon: '🤖' },
                  { id: 'claude', name: 'Claude', icon: '🧠' },
                  { id: 'perplexity', name: 'Perplexity', icon: '🔮' },
                ].map(p => {
                  const connected = platformApiStatus[p.id];
                  return (
                    <div key={p.id} style={{
                      background: C.bg, borderRadius: 12, padding: '12px 14px', textAlign: 'center',
                      border: `1px solid ${connected ? C.success + '30' : C.warning + '30'}`,
                    }}>
                      <div style={{ fontSize: 24, marginBottom: 6 }}>{p.icon}</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{p.name}</div>
                      <div style={{
                        fontSize: 11, fontWeight: 600, marginTop: 4,
                        color: connected ? C.success : C.warning,
                      }}>
                        {connected ? 'מחובר ✓' : 'API לא מחובר'}
                      </div>
                      {!connected && (
                        <div style={{ fontSize: 9, color: C.textMuted, marginTop: 2 }}>דרוש מפתח API</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Start button */}
          <div style={{ textAlign: 'center' }}>
            <button
              onClick={startScan}
              disabled={!scanUrl}
              style={{
                padding: '16px 64px', fontSize: 17, fontWeight: 700,
                background: scanUrl ? `linear-gradient(135deg, ${C.accent}, ${C.accentEnd})` : C.borderLight,
                color: scanUrl ? '#1A1A2E' : C.textMuted,
                border: 'none', borderRadius: 14, cursor: scanUrl ? 'pointer' : 'default',
                boxShadow: scanUrl ? `0 6px 24px ${C.accent}30` : 'none',
                transition: 'all 0.2s',
              }}
            >
              התחל סריקה
            </button>
          </div>
        </div>
      )}

      {/* ── Phase: Scanning / Done ────────────────────────────── */}
      {(phase === 'scanning' || phase === 'done') && job && (
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr 340px', gap: 20 }}>

          {/* ─── Left: Stage Stepper ──────────────────────────── */}
          <div style={{
            background: C.cardGlass, borderRadius: 20, border: `1px solid ${C.border}`,
            padding: '20px 16px', backdropFilter: 'blur(12px)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
          }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: '0 0 16px 0' }}>
              שלבי סריקה
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {(job.stages || []).map((stage, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 10px', borderRadius: 10,
                  background: stage.status === 'running' ? `${C.primary}08` : 'transparent',
                  transition: 'background 0.3s',
                }}>
                  {/* Icon */}
                  <div style={{
                    width: 26, height: 26, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, flexShrink: 0, transition: 'all 0.3s',
                    background: stage.status === 'completed' ? C.success :
                               stage.status === 'running' ? C.primary :
                               stage.status === 'failed' ? C.danger :
                               stage.status === 'skipped' ? C.textMuted : C.borderLight,
                    color: stage.status === 'pending' ? C.textMuted : '#fff',
                    ...(stage.status === 'running' ? { animation: 'pulse 1.5s ease-in-out infinite' } : {}),
                  }}>
                    {stage.status === 'completed' ? '✓' :
                     stage.status === 'running' ? '⟳' :
                     stage.status === 'failed' ? '!' :
                     stage.status === 'skipped' ? '−' :
                     stage.index}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 12.5, fontWeight: stage.status === 'running' ? 700 : 500,
                      color: stage.status === 'pending' ? C.textMuted : C.text,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {stage.labelHe}
                    </div>
                    {stage.status === 'completed' && stage.durationMs !== undefined && (
                      <div style={{ fontSize: 10, color: C.textMuted }}>
                        {(stage.durationMs / 1000).toFixed(1)}s
                        {stage.itemsProcessed ? ` · ${stage.itemsProcessed} פריטים` : ''}
                      </div>
                    )}
                    {stage.status === 'running' && stage.itemsProcessed !== undefined && stage.itemsTotal && (
                      <div style={{ fontSize: 10, color: C.primary }}>
                        {stage.itemsProcessed}/{stage.itemsTotal}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ─── Center: Progress + Metrics + Platforms ────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Progress Ring */}
            <div style={{
              background: C.cardGlass, borderRadius: 20, border: `1px solid ${C.border}`,
              padding: 32, textAlign: 'center', backdropFilter: 'blur(12px)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
            }}>
              <svg width="180" height="180" viewBox="0 0 180 180" style={{ margin: '0 auto', display: 'block' }}>
                {/* Background circle */}
                <circle cx="90" cy="90" r="78" fill="none" stroke={C.borderLight} strokeWidth="8" />
                {/* Progress arc */}
                <circle
                  cx="90" cy="90" r="78" fill="none"
                  stroke={`url(#grad-${job.id})`} strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${(job.progress / 100) * 490} 490`}
                  transform="rotate(-90 90 90)"
                  style={{ transition: 'stroke-dasharray 0.5s ease' }}
                />
                <defs>
                  <linearGradient id={`grad-${job.id}`} x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor={C.accent} />
                    <stop offset="100%" stopColor={C.accentEnd} />
                  </linearGradient>
                </defs>
                {/* Center text */}
                <text x="90" y="82" textAnchor="middle" fontSize="32" fontWeight="800" fill={C.text}>
                  {job.progress}%
                </text>
                <text x="90" y="104" textAnchor="middle" fontSize="12" fill={C.textSecondary}>
                  {phase === 'done' ? 'הושלם' :
                   job.status === 'extract_content' ? 'מחלץ תוכן...' :
                   job.status === 'check_visibility' ? 'בודק נראות...' :
                   'סורק אתר...'}
                </text>
              </svg>
              <div style={{ fontSize: 13, color: C.textMuted, marginTop: 12 }}>
                {(elapsed / 1000).toFixed(1)} שניות
              </div>
              {/* Current stage label */}
              {phase === 'scanning' && (
                <div style={{
                  marginTop: 8, fontSize: 13, fontWeight: 600, color: C.primary,
                }}>
                  {(job.stages || []).find(s => s.status === 'running')?.labelHe || ''}
                </div>
              )}
            </div>

            {/* Metrics Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {[
                { label: 'עמודים שנסרקו', value: job.metrics.pagesScanned, icon: '📄' },
                { label: 'ראיות שנמצאו', value: job.metrics.evidenceCount, icon: '🔗' },
                { label: 'ציון אמינות', value: `${job.metrics.confidenceScore}%`, icon: '🎯' },
                { label: 'זמן סריקה', value: `${(elapsed / 1000).toFixed(0)}s`, icon: '⏱' },
                { label: 'מנועים שנבדקו', value: job.metrics.platformsChecked, icon: '🔍' },
                { label: 'תוצאות לא זמינות', value: job.metrics.unavailableResults, icon: '⚠' },
              ].map((m, i) => (
                <div key={i} style={{
                  background: C.card, borderRadius: 14, border: `1px solid ${C.border}`,
                  padding: '12px 14px', textAlign: 'center',
                }}>
                  <div style={{ fontSize: 18, marginBottom: 4 }}>{m.icon}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: C.text }}>{m.value}</div>
                  <div style={{ fontSize: 10.5, color: C.textMuted }}>{m.label}</div>
                </div>
              ))}
            </div>

            {/* Platform Cards */}
            <div style={{
              background: C.cardGlass, borderRadius: 16, border: `1px solid ${C.border}`,
              padding: 16, backdropFilter: 'blur(12px)',
            }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: C.text, margin: '0 0 12px 0' }}>
                פלטפורמות AI
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {(job.platformStatuses || []).map((p, i) => (
                  <div key={i} style={{
                    background: C.bg, borderRadius: 12, padding: '10px 12px',
                    border: `1px solid ${p.status === 'completed' ? C.success + '30' :
                            p.status === 'running' ? C.primary + '30' :
                            p.status === 'api_missing' ? C.warning + '30' : C.borderLight}`,
                    textAlign: 'center', transition: 'border-color 0.3s',
                  }}>
                    <div style={{ fontSize: 20, marginBottom: 4 }}>{p.icon}</div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: C.text }}>{p.name}</div>
                    <div style={{
                      fontSize: 10, marginTop: 4, fontWeight: 600,
                      color: p.status === 'completed' ? C.success :
                            p.status === 'running' ? C.primary :
                            p.status === 'api_missing' ? C.warning :
                            p.status === 'skipped' ? C.textMuted : C.textMuted,
                    }}>
                      {p.status === 'waiting' ? 'ממתין' :
                       p.status === 'running' ? 'סורק...' :
                       p.status === 'completed' ? 'הושלם' :
                       p.status === 'api_missing' ? 'API לא מחובר' :
                       'דולג'}
                    </div>
                    {p.status === 'completed' && (
                      <div style={{ fontSize: 9, color: C.textMuted, marginTop: 2 }}>
                        {p.queriesScanned} שאילתות · {p.scanMode === 'real' ? 'אמיתי' : 'סימולציה'}
                      </div>
                    )}
                    {p.status === 'api_missing' && (
                      <div style={{ fontSize: 9, color: C.warning, marginTop: 2 }}>
                        דרוש מפתח API
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* ── Validation Panel (done phase) ──────────────── */}
            {phase === 'done' && job.validation && (
              <div style={{
                background: C.card, borderRadius: 16, border: `1px solid ${job.validation.passed ? C.success + '40' : C.warning + '40'}`,
                padding: 20,
              }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: '0 0 12px 0' }}>
                  אימות איכות הסריקה
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                  {job.validation.checks.map((check, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
                      <span style={{
                        width: 20, height: 20, borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, flexShrink: 0,
                        background: check.passed ? C.successLight : C.dangerLight,
                        color: check.passed ? C.success : C.danger,
                      }}>
                        {check.passed ? '✓' : '✗'}
                      </span>
                      <span style={{ color: C.text, fontWeight: 500 }}>{check.label}</span>
                      <span style={{ color: C.textMuted, marginRight: 'auto' }}>
                        ({check.actual})
                      </span>
                    </div>
                  ))}
                </div>

                {/* Status message */}
                <div style={{
                  padding: '12px 16px', borderRadius: 12, fontSize: 13, fontWeight: 600,
                  background: job.validation.passed ? C.successLight : C.warningLight,
                  color: job.validation.passed ? C.success : C.warning,
                }}>
                  {job.validation.passed
                    ? 'הסריקה אמינה ומוכנה להמשך'
                    : job.validation.invalidReason || 'הסריקה אינה אמינה מספיק להמשך'}
                </div>

                {/* Actions */}
                {!job.validation.passed && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                    <button onClick={rescan} style={btnStyle(C.primary)}>סרוק שוב</button>
                    <button onClick={() => { setScanType('deep'); rescan(); }} style={btnStyle(C.accent)}>
                      הרץ סריקה עמוקה
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ── Post-Scan Summary (valid only) ─────────────── */}
            {phase === 'done' && job.validation?.passed && job.result?.websiteFacts && (
              <div style={{
                background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, padding: 20,
              }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: '0 0 14px 0' }}>
                  סיכום סריקה
                </h3>
                {[
                  { label: 'סוג עסק', value: job.result.websiteFacts.business_type?.value, conf: job.result.websiteFacts.business_type?.confidence },
                  { label: 'תעשייה', value: job.result.websiteFacts.detected_industry?.value, conf: job.result.websiteFacts.detected_industry?.confidence },
                  { label: 'מיקום', value: job.result.websiteFacts.detected_location?.value, conf: job.result.websiteFacts.detected_location?.confidence },
                  { label: 'מוצרים/שירותים', value: (job.result.websiteFacts.main_products_or_services?.value || []).join(', '), conf: job.result.websiteFacts.main_products_or_services?.confidence },
                  { label: 'דפים שנותחו', value: String(job.metrics.pagesScanned), conf: 100 },
                  { label: 'ראיות', value: String(job.metrics.evidenceCount), conf: 100 },
                  { label: 'ציון אמינות', value: `${job.metrics.confidenceScore}%`, conf: job.metrics.confidenceScore },
                ].filter(r => r.value).map((row, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 0', borderBottom: `1px solid ${C.borderLight}`,
                    fontSize: 13,
                  }}>
                    <span style={{ color: C.textSecondary, fontWeight: 500 }}>{row.label}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: C.text, fontWeight: 600 }}>{row.value}</span>
                      {row.conf !== undefined && row.conf < 100 && (
                        <button
                          onClick={() => setShowEvidence(row)}
                          style={{
                            padding: '2px 8px', fontSize: 10, fontWeight: 600,
                            background: C.primaryLight, color: C.primary,
                            border: 'none', borderRadius: 6, cursor: 'pointer',
                          }}
                        >
                          ראיות
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ���─ CTAs (valid scan only) ─────────────────────── */}
            {phase === 'done' && job.validation?.passed && savedPlanId && !savedPlanId.startsWith('temp-') && (
              <div style={{
                padding: '10px 16px', borderRadius: 10,
                background: C.successLight, color: C.success,
                fontSize: 12.5, fontWeight: 600, textAlign: 'center',
              }}>
                תוצאות הסריקה נשמרו בהצלחה
              </div>
            )}
            {phase === 'done' && job.validation?.passed && (!savedPlanId || savedPlanId.startsWith('temp-')) && (
              <div style={{
                padding: '10px 16px', borderRadius: 10,
                background: C.warningLight, color: C.warning,
                fontSize: 12.5, fontWeight: 600, textAlign: 'center',
              }}>
                שמירת התוצאות נכשלה — יש להריץ את המיגרציה ואז לסרוק מחדש
              </div>
            )}

            {phase === 'done' && job.validation?.passed && (() => {
              // Determine planId for navigation — use savedPlanId if real, else fallback to 'latest'
              const navId = (savedPlanId && !savedPlanId.startsWith('temp-')) ? savedPlanId : null;
              return (
                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10,
                }}>
                  {[
                    { label: 'צפה בתוצאות הסריקה', icon: '📊', action: () => navId ? router.push(`/seo-geo/${navId}/results`) : alert('התוצאות לא נשמרו — יש ליצור טבלה ב-Supabase. ראה קונסול.'), disabled: !navId },
                    { label: 'צור תוכנית 60 ימים', icon: '📋', action: () => navId ? router.push(`/seo-geo/${navId}`) : alert('התוצאות לא נשמרו — יש ליצור טבלה ב-Supabase. ראה קונסול.'), disabled: !navId },
                    { label: 'הפק דוח מקצועי', icon: '📄', action: () => navId ? router.push(`/seo-geo/${navId}/report`) : alert('התוצאות לא נשמרו — יש ליצור טבלה ב-Supabase. ראה קונסול.'), disabled: !navId },
                    { label: 'חזרה לדשבורד SEO/GEO', icon: '🏠', action: () => router.push('/seo-geo/dashboard') },
                    { label: 'סרוק אתר נוסף', icon: '🔄', action: rescan },
                  ].map((cta, i) => (
                    <button key={i} onClick={cta.action} style={{
                      padding: '14px 16px', background: C.card, border: `1px solid ${C.border}`,
                      borderRadius: 12, cursor: 'pointer', display: 'flex', alignItems: 'center',
                      gap: 10, textAlign: 'right', transition: 'all 0.2s',
                      opacity: (cta as any).disabled ? 0.5 : 1,
                    }}>
                      <span style={{ fontSize: 22 }}>{cta.icon}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{cta.label}</span>
                    </button>
                  ))}
                </div>
              );
            })()}
          </div>

          {/* ─── Right: Live Log ──────────────────────────────── */}
          <div style={{
            background: C.logBg, borderRadius: 20, padding: '16px 14px',
            maxHeight: 'calc(100vh - 120px)', overflowY: 'auto',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          }}>
            <h3 style={{
              fontSize: 13, fontWeight: 700, color: '#e5e7eb', margin: '0 0 12px 0',
              fontFamily: 'monospace', direction: 'rtl',
            }}>
              יומן סריקה חי
              <span style={{ color: '#4b5563', fontWeight: 400, fontSize: 11, marginRight: 8 }}>
                {(job.logs || []).length} רשומות
              </span>
            </h3>
            <div style={{ direction: 'ltr', fontFamily: 'monospace' }}>
              {(job.logs || []).map((entry, i) => (
                <div key={i} style={{
                  fontSize: 11, lineHeight: 1.7,
                  color: entry.result === 'error' ? '#ef4444' :
                        entry.result === 'success' ? '#22c55e' :
                        entry.result === 'warning' ? '#f59e0b' :
                        entry.result === 'skipped' ? '#6b7280' : '#9ca3af',
                }}>
                  <span style={{ color: '#4b5563' }}>
                    [{new Date(entry.timestamp).toLocaleTimeString('he-IL')}]
                  </span>
                  {' '}{entry.action}
                  {entry.result && entry.result !== 'info' && (
                    <span style={{
                      marginLeft: 6, padding: '0 4px', borderRadius: 3, fontSize: 9, fontWeight: 600,
                      background: entry.result === 'success' ? '#22c55e20' :
                                 entry.result === 'error' ? '#ef444420' :
                                 entry.result === 'warning' ? '#f59e0b20' :
                                 entry.result === 'skipped' ? '#6b728020' : 'transparent',
                    }}>
                      {entry.result}
                    </span>
                  )}
                  {entry.detail && (
                    <span style={{ color: '#4b5563' }}> {entry.detail}</span>
                  )}
                </div>
              ))}
              {phase === 'scanning' && (
                <div style={{ color: C.primary, marginTop: 4, animation: 'pulse 1.5s ease-in-out infinite' }}>
                  ▌
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Evidence Drawer ───────────────────────────────────── */}
      {showEvidence && (
        <div
          onClick={() => setShowEvidence(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
            display: 'flex', justifyContent: 'flex-start', alignItems: 'stretch',
            zIndex: 1000,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: 420, background: C.card, padding: 28,
              boxShadow: '-4px 0 24px rgba(0,0,0,0.1)',
              overflowY: 'auto', direction: 'rtl',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text, margin: 0 }}>ראיות</h2>
              <button onClick={() => setShowEvidence(null)} style={{
                background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: C.textMuted,
              }}>✕</button>
            </div>

            <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 8 }}>
              {showEvidence.label}
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.primary, marginBottom: 16 }}>
              {showEvidence.value}
            </div>

            {showEvidence.conf !== undefined && (
              <div style={{
                padding: '12px 16px', background: C.bg, borderRadius: 12, marginBottom: 12,
              }}>
                <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 4 }}>ציון אמינות</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    flex: 1, height: 6, background: C.borderLight, borderRadius: 3, overflow: 'hidden',
                  }}>
                    <div style={{
                      width: `${showEvidence.conf}%`, height: '100%',
                      background: showEvidence.conf >= 70 ? C.success : showEvidence.conf >= 40 ? C.warning : C.danger,
                      borderRadius: 3,
                    }} />
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{showEvidence.conf}%</span>
                </div>
              </div>
            )}

            {job?.result?.websiteFacts && (
              <div style={{ padding: '12px 16px', background: C.bg, borderRadius: 12 }}>
                <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 4 }}>מקור</div>
                <div style={{ fontSize: 12, color: C.text, direction: 'ltr' }}>
                  {job.result.url}
                </div>
                <div style={{ fontSize: 12, color: C.textMuted, marginTop: 8 }}>מצב סריקה</div>
                <div style={{ fontSize: 12, color: C.text }}>
                  {job.result.scan_mode === 'real' ? 'סריקה אמיתית' : 'סימולציה'}
                </div>
                <div style={{ fontSize: 12, color: C.textMuted, marginTop: 8 }}>חותמת זמן</div>
                <div style={{ fontSize: 12, color: C.text }}>
                  {new Date(job.result.scannedAt).toLocaleString('he-IL')}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pulse animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function btnStyle(color: string): React.CSSProperties {
  // Use dark text for bright/neon backgrounds
  const isBright = color === '#e9fe00' || color === '#d3e200' || color === '#E8F401' || color === '#c8d800';
  return {
    padding: '8px 20px', fontSize: 13, fontWeight: 600,
    background: color, color: isBright ? '#1A1A2E' : '#fff', border: 'none',
    borderRadius: 10, cursor: 'pointer',
  };
}
