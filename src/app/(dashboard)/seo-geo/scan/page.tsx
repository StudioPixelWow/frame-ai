"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, useRef, useCallback } from "react";
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

// ── Colors ─────────────────────────────────────────────────────────────────────

const C = {
  bg: '#f8f9fc',
  card: '#ffffff',
  cardGlass: 'rgba(255,255,255,0.85)',
  border: '#e5e7eb',
  borderLight: '#f0f1f5',
  primary: '#2563eb',
  primaryLight: '#dbeafe',
  accent: '#7c3aed',
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlParam = searchParams.get("url") || "";
  const clientName = searchParams.get("client") || "";
  const planId = searchParams.get("planId") || "";

  // State
  const [scanUrl, setScanUrl] = useState(urlParam);
  const [scanType, setScanType] = useState<ScanType>('quick');
  const [phase, setPhase] = useState<'select' | 'scanning' | 'done'>('select');
  const [job, setJob] = useState<ScanJob | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [showEvidence, setShowEvidence] = useState<any>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(0);

  // Cleanup
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Start scan
  const startScan = useCallback(async () => {
    if (!scanUrl) return;
    setPhase('scanning');
    startTimeRef.current = Date.now();
    setElapsed(0);

    // Timer
    timerRef.current = setInterval(() => {
      setElapsed(Date.now() - startTimeRef.current);
    }, 200);

    try {
      const res = await fetch("/api/seo/scan/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: scanUrl, scanType }),
      });
      if (!res.ok) { setPhase('select'); return; }
      const { jobId } = await res.json();

      // Poll
      pollRef.current = setInterval(async () => {
        try {
          const r = await fetch(`/api/seo/scan/status?jobId=${jobId}`);
          if (!r.ok) return;
          const data: ScanJob = await r.json();
          setJob(data);

          if (data.status === 'completed' || data.status === 'failed') {
            if (pollRef.current) clearInterval(pollRef.current);
            if (timerRef.current) clearInterval(timerRef.current);
            pollRef.current = null;
            timerRef.current = null;
            setElapsed(data.totalDurationMs || (Date.now() - startTimeRef.current));
            setPhase('done');
          }
        } catch { /* retry */ }
      }, 700);
    } catch {
      setPhase('select');
    }
  }, [scanUrl, scanType]);

  const rescan = useCallback(() => {
    setJob(null);
    setPhase('select');
  }, []);

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

          {/* Start button */}
          <div style={{ textAlign: 'center' }}>
            <button
              onClick={startScan}
              disabled={!scanUrl}
              style={{
                padding: '16px 64px', fontSize: 17, fontWeight: 700,
                background: scanUrl ? `linear-gradient(135deg, ${C.primary}, ${C.accent})` : C.borderLight,
                color: scanUrl ? '#fff' : C.textMuted,
                border: 'none', borderRadius: 14, cursor: scanUrl ? 'pointer' : 'default',
                boxShadow: scanUrl ? `0 6px 24px ${C.primary}30` : 'none',
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
                    <stop offset="0%" stopColor={C.primary} />
                    <stop offset="100%" stopColor={C.accent} />
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
                  {job.stages.find(s => s.status === 'running')?.labelHe || ''}
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
            {phase === 'done' && job.validation?.passed && (
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10,
              }}>
                {[
                  { label: 'המשך ליצירת שאלות AI', icon: '🤖', action: () => router.push(`/seo-geo${planId ? `?planId=${planId}` : ''}`) },
                  { label: 'יצירת תוכנית 60 יום', icon: '📋', action: () => router.push(`/seo-geo${planId ? `?planId=${planId}` : ''}`) },
                  { label: 'הפקת דוח PIXEL SEO/GEO', icon: '📊', action: () => {} },
                  { label: 'צפייה בתוצאות נראות', icon: '👁', action: () => {} },
                ].map((cta, i) => (
                  <button key={i} onClick={cta.action} style={{
                    padding: '14px 16px', background: C.card, border: `1px solid ${C.border}`,
                    borderRadius: 12, cursor: 'pointer', display: 'flex', alignItems: 'center',
                    gap: 10, textAlign: 'right', transition: 'all 0.2s',
                  }}>
                    <span style={{ fontSize: 22 }}>{cta.icon}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{cta.label}</span>
                  </button>
                ))}
              </div>
            )}
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
  return {
    padding: '8px 20px', fontSize: 13, fontWeight: 600,
    background: color, color: '#fff', border: 'none',
    borderRadius: 10, cursor: 'pointer',
  };
}
