'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useToast } from '@/components/ui/toast';

// ── Types ──────────────────────────────────────────────────────────
interface JobRun {
  id: string;
  status: 'completed' | 'failed' | 'timeout' | 'skipped' | 'running';
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  error?: string;
}

interface Job {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  category: string;
  cronExpression: string;
  status: 'active' | 'paused' | 'disabled';
  latestRun?: JobRun;
  nextRunAt?: string;
  lastRunAt?: string;
  lastRunStatus?: string;
  lastRunDurationMs?: number;
  lastRunError?: string;
  totalRuns: number;
  totalFailures: number;
  envVarsRequired?: string[];
  dbTablesUsed?: string[];
  recentRuns?: JobRun[];
  maxDurationSec?: number;
  retryCount?: number;
  retryDelaySec?: number;
  endpoint?: string;
}

// ── Category Config ────────────────────────────────────────────────
const CATEGORIES = [
  { key: 'all', label: 'הכל' },
  { key: 'seo', label: 'SEO' },
  { key: 'meta', label: 'Meta' },
  { key: 'social', label: 'Social' },
  { key: 'email', label: 'Email' },
  { key: 'reports', label: 'Reports' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'google-ads', label: 'Google Ads' },
  { key: 'geo', label: 'GEO' },
  { key: 'system', label: 'System' },
] as const;

const CATEGORY_COLORS: Record<string, string> = {
  seo: '#22c55e',
  meta: '#3b82f6',
  social: '#a855f7',
  email: '#f59e0b',
  reports: '#06b6d4',
  whatsapp: '#25d366',
  'google-ads': '#ea4335',
  geo: '#ec4899',
  system: '#6b7280',
};

// ── Status Colors ──────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  active: '#22c55e',
  paused: '#f59e0b',
  disabled: '#ef4444',
  running: '#00B5FE',
  completed: '#22c55e',
  failed: '#ef4444',
  timeout: '#f59e0b',
  skipped: '#6b7280',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'פעיל',
  paused: 'מושהה',
  disabled: 'מושבת',
  running: 'רץ כעת',
  completed: 'הצליח',
  failed: 'נכשל',
  timeout: 'חריגת זמן',
  skipped: 'דולג',
};

// ── Cron to Hebrew ─────────────────────────────────────────────────
const DAYS_HE: Record<number, string> = {
  0: 'ראשון',
  1: 'שני',
  2: 'שלישי',
  3: 'רביעי',
  4: 'חמישי',
  5: 'שישי',
  6: 'שבת',
};

function cronToHebrew(cron: string): string {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return cron;

  const [minute, hour, dayOfMonth, , dayOfWeek] = parts;

  // Every N minutes
  if (minute.startsWith('*/') && hour === '*') {
    const n = parseInt(minute.slice(2));
    return `כל ${n} דקות`;
  }

  // Every hour
  if (minute === '0' && hour === '*') {
    return 'כל שעה';
  }

  // Specific day of month
  if (minute === '0' && dayOfMonth !== '*' && dayOfWeek === '*') {
    const h = parseInt(hour);
    const israelHour = ((h + 3) % 24).toString().padStart(2, '0');
    return `${dayOfMonth} לכל חודש ב-${israelHour}:00`;
  }

  // Specific day of week
  if (minute === '0' && dayOfMonth === '*' && dayOfWeek !== '*') {
    const h = parseInt(hour);
    const israelHour = ((h + 3) % 24).toString().padStart(2, '0');
    const day = DAYS_HE[parseInt(dayOfWeek)] || dayOfWeek;
    return `${day} ב-${israelHour}:00`;
  }

  // Multiple hours per day
  if (minute === '0' && hour.includes(',') && dayOfMonth === '*' && dayOfWeek === '*') {
    const hours = hour.split(',').map(h => {
      const israelHour = ((parseInt(h) + 3) % 24).toString().padStart(2, '0');
      return `${israelHour}:00`;
    });
    return `כל יום ב-${hours.join(' ו-')}`;
  }

  // Daily at specific hour
  if (minute === '0' && !hour.includes('*') && !hour.includes('/') && dayOfMonth === '*' && dayOfWeek === '*') {
    const h = parseInt(hour);
    const israelHour = ((h + 3) % 24).toString().padStart(2, '0');
    return `כל יום ב-${israelHour}:00 (ישראל)`;
  }

  return cron;
}

// ── Time Ago ───────────────────────────────────────────────────────
function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'הרגע';
  if (minutes < 60) return `לפני ${minutes} דק׳`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `לפני ${hours} שע׳`;
  const days = Math.floor(hours / 24);
  return `לפני ${days} ימים`;
}

function formatDuration(ms?: number): string {
  if (!ms) return '-';
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

function formatIsraelDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
  } catch {
    return dateStr;
  }
}

// ── Pulse Keyframes (injected once) ────────────────────────────────
function injectKeyframes() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('jobs-pulse-keyframes')) return;
  const style = document.createElement('style');
  style.id = 'jobs-pulse-keyframes';
  style.textContent = `
    @keyframes jobsPulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }
    @keyframes jobsSpin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
}

// ════════════════════════════════════════════════════════════════════
// Page Component
// ════════════════════════════════════════════════════════════════════
export default function AdminJobsPage() {
  const toast = useToast();

  // ── State ──────────────────────────────────────────────────────
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [activeCategory, setActiveCategory] = useState('all');
  const [runningJobs, setRunningJobs] = useState<Set<string>>(new Set());
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [togglingJobs, setTogglingJobs] = useState<Set<string>>(new Set());

  // ── Inject animations ──────────────────────────────────────────
  useEffect(() => { injectKeyframes(); }, []);

  // ── Data fetching ──────────────────────────────────────────────
  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/jobs', {
        headers: { 'x-app-role': 'admin' },
      });
      const data = await res.json();
      setJobs(data.jobs || []);
    } catch (err) {
      toast('שגיאה בטעינת ג׳ובים', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  // ── Actions ────────────────────────────────────────────────────
  const runNow = async (jobId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRunningJobs(prev => new Set([...prev, jobId]));
    try {
      const res = await fetch(`/api/admin/jobs/${jobId}/run`, {
        method: 'POST',
        headers: { 'x-app-role': 'admin' },
      });
      const data = await res.json();
      if (data.success) {
        toast(`ג׳וב ${jobId} הופעל בהצלחה`, 'success');
      } else {
        toast(data.error || 'שגיאה בהפעלת ג׳וב', 'error');
      }
    } catch {
      toast('שגיאת רשת בהפעלת ג׳וב', 'error');
    } finally {
      setRunningJobs(prev => {
        const next = new Set(prev);
        next.delete(jobId);
        return next;
      });
      fetchJobs();
    }
  };

  const toggleJobStatus = async (jobId: string, currentStatus: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newStatus = currentStatus === 'active' ? 'paused' : 'active';
    setTogglingJobs(prev => new Set([...prev, jobId]));
    try {
      const res = await fetch(`/api/admin/jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-app-role': 'admin' },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        toast(`ג׳וב ${newStatus === 'active' ? 'הופעל' : 'הושהה'}`, 'success');
        fetchJobs();
      } else {
        toast(data.error || 'שגיאה', 'error');
      }
    } catch {
      toast('שגיאת רשת', 'error');
    } finally {
      setTogglingJobs(prev => {
        const next = new Set(prev);
        next.delete(jobId);
        return next;
      });
    }
  };

  const syncRegistry = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/admin/jobs/sync', {
        method: 'POST',
        headers: { 'x-app-role': 'admin' },
      });
      const data = await res.json();
      if (data.success) {
        toast('רגיסטרי סונכרן בהצלחה', 'success');
        fetchJobs();
      } else {
        toast(data.error || 'שגיאה בסנכרון', 'error');
      }
    } catch {
      toast('שגיאת רשת בסנכרון', 'error');
    } finally {
      setSyncing(false);
    }
  };

  // ── Computed ───────────────────────────────────────────────────
  const filteredJobs = useMemo(() => {
    if (activeCategory === 'all') return jobs;
    return jobs.filter(j => j.category === activeCategory);
  }, [jobs, activeCategory]);

  const stats = useMemo(() => {
    const total = jobs.length;
    const active = jobs.filter(j => j.status === 'active').length;
    const running = jobs.filter(j => j.latestRun?.status === 'running').length + runningJobs.size;
    const failedLast24h = jobs.filter(j => {
      if (!j.latestRun || j.latestRun.status !== 'failed') return false;
      const diff = Date.now() - new Date(j.latestRun.startedAt).getTime();
      return diff < 24 * 60 * 60 * 1000;
    }).length;
    return { total, active, running, failedLast24h };
  }, [jobs, runningJobs]);

  // ── Styles ────────────────────────────────────────────────────
  const containerStyle: React.CSSProperties = {
    direction: 'rtl',
    textAlign: 'right',
    padding: '2rem',
    minHeight: '100vh',
    backgroundColor: 'var(--surface)',
    color: 'var(--foreground)',
    fontFamily: 'inherit',
  };

  const headerStyle: React.CSSProperties = {
    marginBottom: '2rem',
  };

  const titleStyle: React.CSSProperties = {
    fontSize: '1.75rem',
    fontWeight: 800,
    color: 'var(--foreground)',
    margin: 0,
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  };

  const subtitleStyle: React.CSSProperties = {
    fontSize: '0.875rem',
    color: 'var(--foreground-muted)',
    marginTop: '0.5rem',
  };

  const cardStyle: React.CSSProperties = {
    backgroundColor: 'var(--surface-raised)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    padding: '1.25rem',
  };

  const statCardStyle: React.CSSProperties = {
    ...cardStyle,
    textAlign: 'center',
    flex: 1,
    minWidth: 0,
  };

  const statValueStyle: React.CSSProperties = {
    fontSize: '2rem',
    fontWeight: 800,
    lineHeight: 1.2,
  };

  const statLabelStyle: React.CSSProperties = {
    fontSize: '0.8rem',
    color: 'var(--foreground-muted)',
    marginTop: '0.25rem',
  };

  const tabsRowStyle: React.CSSProperties = {
    display: 'flex',
    gap: '0.5rem',
    flexWrap: 'wrap',
    marginBottom: '1.5rem',
  };

  const tabStyle = (isActive: boolean): React.CSSProperties => ({
    padding: '0.5rem 1rem',
    borderRadius: '8px',
    border: isActive ? '1px solid var(--accent)' : '1px solid var(--border)',
    backgroundColor: isActive ? 'rgba(0, 181, 254, 0.15)' : 'transparent',
    color: isActive ? 'var(--accent)' : 'var(--foreground-muted)',
    fontSize: '0.8rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 150ms ease',
  });

  const tableContainerStyle: React.CSSProperties = {
    ...cardStyle,
    padding: 0,
    overflow: 'hidden',
  };

  const thStyle: React.CSSProperties = {
    padding: '0.75rem 1rem',
    fontSize: '0.75rem',
    fontWeight: 700,
    color: 'var(--foreground-muted)',
    textAlign: 'right',
    borderBottom: '1px solid var(--border)',
    backgroundColor: 'var(--surface)',
    whiteSpace: 'nowrap',
  };

  const tdStyle: React.CSSProperties = {
    padding: '0.75rem 1rem',
    fontSize: '0.825rem',
    color: 'var(--foreground)',
    borderBottom: '1px solid var(--border)',
    whiteSpace: 'nowrap',
    verticalAlign: 'middle',
  };

  const rowStyle = (index: number): React.CSSProperties => ({
    cursor: 'pointer',
    transition: 'background-color 150ms ease',
    backgroundColor: index % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
  });

  const btnBaseStyle: React.CSSProperties = {
    padding: '0.4rem 0.85rem',
    borderRadius: '6px',
    fontSize: '0.75rem',
    fontWeight: 600,
    cursor: 'pointer',
    border: 'none',
    transition: 'all 150ms ease',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
  };

  const btnAccentStyle: React.CSSProperties = {
    ...btnBaseStyle,
    backgroundColor: 'var(--accent)',
    color: '#fff',
  };

  const btnGhostStyle: React.CSSProperties = {
    ...btnBaseStyle,
    backgroundColor: 'transparent',
    color: 'var(--foreground-muted)',
    border: '1px solid var(--border)',
  };

  const btnYellowStyle: React.CSSProperties = {
    ...btnBaseStyle,
    backgroundColor: 'var(--neon-yellow, #F0FF02)',
    color: '#000',
  };

  const badgeStyle = (color: string): React.CSSProperties => ({
    display: 'inline-block',
    padding: '0.15rem 0.5rem',
    borderRadius: '6px',
    fontSize: '0.7rem',
    fontWeight: 600,
    backgroundColor: `${color}18`,
    color: color,
    border: `1px solid ${color}30`,
  });

  const dotStyle = (color: string, pulse?: boolean): React.CSSProperties => ({
    display: 'inline-block',
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: color,
    marginLeft: '0.5rem',
    flexShrink: 0,
    ...(pulse ? { animation: 'jobsPulse 1.5s ease-in-out infinite' } : {}),
  });

  // ── Modal overlay style ────────────────────────────────────────
  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    direction: 'rtl',
  };

  const modalStyle: React.CSSProperties = {
    backgroundColor: 'var(--surface-raised)',
    border: '1px solid var(--border)',
    borderRadius: '16px',
    padding: '2rem',
    width: '90%',
    maxWidth: '720px',
    maxHeight: '85vh',
    overflowY: 'auto',
    color: 'var(--foreground)',
    textAlign: 'right',
  };

  // ── Loading State ──────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ ...containerStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem', animation: 'jobsSpin 1s linear infinite', display: 'inline-block' }}>&#9881;</div>
          <div style={{ fontSize: '1rem', color: 'var(--foreground-muted)' }}>טוען ג׳ובים...</div>
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={{ ...headerStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={titleStyle}>
            <span style={{ fontSize: '1.5rem' }}>&#x1F916;</span>
            מרכז אוטומציות — Pixel Prime
          </h1>
          <p style={subtitleStyle}>ניהול, מעקב והפעלה ידנית של כל הג׳ובים האוטומטיים במערכת</p>
        </div>
        <button
          style={{ ...btnYellowStyle, padding: '0.6rem 1.2rem', fontSize: '0.85rem' }}
          onClick={syncRegistry}
          disabled={syncing}
        >
          {syncing ? '⏳ מסנכרן...' : '🔄 Sync Registry'}
        </button>
      </div>

      {/* Stats Row */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div style={statCardStyle}>
          <div style={{ ...statValueStyle, color: 'var(--foreground)' }}>{stats.total}</div>
          <div style={statLabelStyle}>סה״כ ג׳ובים</div>
        </div>
        <div style={statCardStyle}>
          <div style={{ ...statValueStyle, color: '#22c55e' }}>{stats.active}</div>
          <div style={statLabelStyle}>פעילים</div>
        </div>
        <div style={statCardStyle}>
          <div style={{ ...statValueStyle, color: 'var(--accent)' }}>{stats.running}</div>
          <div style={statLabelStyle}>רצים כעת</div>
        </div>
        <div style={statCardStyle}>
          <div style={{ ...statValueStyle, color: stats.failedLast24h > 0 ? '#ef4444' : 'var(--foreground-muted)' }}>{stats.failedLast24h}</div>
          <div style={statLabelStyle}>נכשלו 24 שע׳</div>
        </div>
      </div>

      {/* Category Filter Tabs */}
      <div style={tabsRowStyle}>
        {CATEGORIES.map(cat => (
          <button
            key={cat.key}
            style={tabStyle(activeCategory === cat.key)}
            onClick={() => setActiveCategory(cat.key)}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Jobs Table */}
      <div style={tableContainerStyle}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>סטטוס</th>
                <th style={thStyle}>שם</th>
                <th style={thStyle}>קטגוריה</th>
                <th style={thStyle}>תזמון</th>
                <th style={thStyle}>ריצה אחרונה</th>
                <th style={thStyle}>משך</th>
                <th style={thStyle}>ריצה הבאה</th>
                <th style={thStyle}>סה״כ / כשלונות</th>
                <th style={thStyle}>פעולות</th>
              </tr>
            </thead>
            <tbody>
              {filteredJobs.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ ...tdStyle, textAlign: 'center', padding: '3rem', color: 'var(--foreground-muted)' }}>
                    {activeCategory === 'all' ? 'לא נמצאו ג׳ובים' : `אין ג׳ובים בקטגוריה "${CATEGORIES.find(c => c.key === activeCategory)?.label}"`}
                  </td>
                </tr>
              ) : (
                filteredJobs.map((job, idx) => {
                  const isRunning = runningJobs.has(job.id) || job.latestRun?.status === 'running';
                  const statusColor = isRunning ? STATUS_COLORS.running : STATUS_COLORS[job.status] || '#6b7280';
                  const catColor = CATEGORY_COLORS[job.category] || '#6b7280';
                  const lastRunStatus = job.latestRun?.status;
                  const lastRunIcon = lastRunStatus === 'completed' ? '✅' : lastRunStatus === 'failed' ? '❌' : lastRunStatus === 'running' ? '⏳' : '-';

                  return (
                    <tr
                      key={job.id}
                      style={rowStyle(idx)}
                      onClick={() => setSelectedJob(job)}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(0, 181, 254, 0.06)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)'; }}
                    >
                      {/* Status */}
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span style={dotStyle(statusColor, isRunning)} />
                          <span style={{ fontSize: '0.75rem', color: statusColor, fontWeight: 600 }}>
                            {isRunning ? STATUS_LABELS.running : STATUS_LABELS[job.status] || job.status}
                          </span>
                        </div>
                      </td>

                      {/* Name */}
                      <td style={{ ...tdStyle, fontWeight: 600, whiteSpace: 'normal', minWidth: '160px' }}>
                        {job.displayName || job.name}
                      </td>

                      {/* Category */}
                      <td style={tdStyle}>
                        <span style={badgeStyle(catColor)}>{job.category}</span>
                      </td>

                      {/* Schedule */}
                      <td style={tdStyle}>
                        <div>
                          <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>{cronToHebrew(job.cronExpression)}</div>
                          <div style={{ fontSize: '0.65rem', color: 'var(--foreground-muted)', fontFamily: 'monospace', direction: 'ltr', textAlign: 'right' }}>{job.cronExpression}</div>
                        </div>
                      </td>

                      {/* Last Run */}
                      <td style={tdStyle}>
                        {job.latestRun ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <span>{lastRunIcon}</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--foreground-muted)' }}>{timeAgo(job.latestRun.startedAt)}</span>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--foreground-muted)', fontSize: '0.75rem' }}>טרם רץ</span>
                        )}
                      </td>

                      {/* Duration */}
                      <td style={tdStyle}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--foreground-muted)', fontFamily: 'monospace' }}>
                          {formatDuration(job.latestRun?.durationMs)}
                        </span>
                      </td>

                      {/* Next Run */}
                      <td style={tdStyle}>
                        {job.nextRunAt ? (
                          <span style={{ fontSize: '0.75rem', color: 'var(--foreground-muted)' }}>{formatIsraelDate(job.nextRunAt)}</span>
                        ) : (
                          <span style={{ color: 'var(--foreground-muted)', fontSize: '0.75rem' }}>-</span>
                        )}
                      </td>

                      {/* Total / Failures */}
                      <td style={tdStyle}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{job.totalRuns}</span>
                        {job.totalFailures > 0 && (
                          <span style={{ fontSize: '0.75rem', color: '#ef4444', marginRight: '0.3rem' }}>/ {job.totalFailures}</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ ...tdStyle, borderBottom: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                          <button
                            style={{
                              ...btnAccentStyle,
                              opacity: isRunning ? 0.5 : 1,
                              cursor: isRunning ? 'not-allowed' : 'pointer',
                            }}
                            onClick={(e) => runNow(job.id, e)}
                            disabled={isRunning}
                          >
                            {isRunning ? '⏳' : '▶'} הרץ עכשיו
                          </button>
                          <button
                            style={{
                              ...btnGhostStyle,
                              opacity: togglingJobs.has(job.id) ? 0.5 : 1,
                            }}
                            onClick={(e) => toggleJobStatus(job.id, job.status, e)}
                            disabled={togglingJobs.has(job.id)}
                          >
                            {job.status === 'active' ? '⏸ השהה' : '▶ הפעל'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Job Detail Modal */}
      {selectedJob && (
        <div
          style={overlayStyle}
          onClick={() => setSelectedJob(null)}
        >
          <div
            style={modalStyle}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, color: 'var(--foreground)' }}>
                  {selectedJob.displayName || selectedJob.name}
                </h2>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', alignItems: 'center' }}>
                  <span style={badgeStyle(STATUS_COLORS[selectedJob.status] || '#6b7280')}>
                    {STATUS_LABELS[selectedJob.status] || selectedJob.status}
                  </span>
                  <span style={badgeStyle(CATEGORY_COLORS[selectedJob.category] || '#6b7280')}>
                    {selectedJob.category}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--foreground-muted)', fontFamily: 'monospace' }}>
                    {selectedJob.cronExpression}
                  </span>
                </div>
              </div>
              <button
                style={{ ...btnGhostStyle, padding: '0.3rem 0.6rem', fontSize: '1rem' }}
                onClick={() => setSelectedJob(null)}
              >
                ✕
              </button>
            </div>

            {/* Description */}
            {selectedJob.description && (
              <div style={{ ...cardStyle, marginBottom: '1rem', fontSize: '0.875rem', lineHeight: 1.7, color: 'var(--foreground-muted)' }}>
                {selectedJob.description}
              </div>
            )}

            {/* Schedule Info */}
            <div style={{ ...cardStyle, marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--foreground)', marginBottom: '0.5rem' }}>תזמון</div>
              <div style={{ fontSize: '0.9rem', color: 'var(--accent)', fontWeight: 600 }}>
                {cronToHebrew(selectedJob.cronExpression)}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--foreground-muted)', fontFamily: 'monospace', marginTop: '0.25rem', direction: 'ltr', textAlign: 'right' }}>
                {selectedJob.cronExpression}
              </div>
            </div>

            {/* Env Vars */}
            {selectedJob.envVarsRequired && selectedJob.envVarsRequired.length > 0 && (
              <div style={{ ...cardStyle, marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--foreground)', marginBottom: '0.75rem' }}>משתני סביבה נדרשים</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {selectedJob.envVarsRequired.map((envName: string) => (
                    <div key={envName} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
                      <span style={{ fontFamily: 'monospace', color: 'var(--foreground)', direction: 'ltr' }}>
                        {envName}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* DB Tables */}
            {selectedJob.dbTablesUsed && selectedJob.dbTablesUsed.length > 0 && (
              <div style={{ ...cardStyle, marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--foreground)', marginBottom: '0.75rem' }}>טבלאות DB</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {selectedJob.dbTablesUsed.map((table: string) => (
                    <span key={table} style={{
                      fontSize: '0.7rem',
                      padding: '0.2rem 0.5rem',
                      borderRadius: '4px',
                      backgroundColor: 'var(--surface)',
                      border: '1px solid var(--border)',
                      fontFamily: 'monospace',
                      color: 'var(--foreground-muted)',
                      direction: 'ltr',
                    }}>
                      {table}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Stats Summary */}
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
              <div style={{ ...cardStyle, flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--foreground)' }}>{selectedJob.totalRuns}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--foreground-muted)' }}>סה״כ ריצות</div>
              </div>
              <div style={{ ...cardStyle, flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: selectedJob.totalFailures > 0 ? '#ef4444' : '#22c55e' }}>
                  {selectedJob.totalFailures}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--foreground-muted)' }}>כשלונות</div>
              </div>
              <div style={{ ...cardStyle, flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent)' }}>
                  {selectedJob.totalRuns > 0 ? Math.round(((selectedJob.totalRuns - selectedJob.totalFailures) / selectedJob.totalRuns) * 100) : 0}%
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--foreground-muted)' }}>הצלחה</div>
              </div>
            </div>

            {/* Recent Runs */}
            <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '1rem', borderBottom: '1px solid var(--border)', fontSize: '0.8rem', fontWeight: 700, color: 'var(--foreground)' }}>
                10 ריצות אחרונות
              </div>
              {(!selectedJob.recentRuns || selectedJob.recentRuns.length === 0) ? (
                <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--foreground-muted)', fontSize: '0.85rem' }}>
                  אין ריצות מתועדות
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ ...thStyle, fontSize: '0.7rem' }}>סטטוס</th>
                      <th style={{ ...thStyle, fontSize: '0.7rem' }}>זמן התחלה</th>
                      <th style={{ ...thStyle, fontSize: '0.7rem' }}>משך</th>
                      <th style={{ ...thStyle, fontSize: '0.7rem' }}>שגיאה</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedJob.recentRuns.map((run) => (
                      <tr key={run.id}>
                        <td style={{ ...tdStyle, fontSize: '0.78rem' }}>
                          <span style={badgeStyle(STATUS_COLORS[run.status] || '#6b7280')}>
                            {STATUS_LABELS[run.status] || run.status}
                          </span>
                        </td>
                        <td style={{ ...tdStyle, fontSize: '0.78rem', color: 'var(--foreground-muted)' }}>
                          {formatIsraelDate(run.startedAt)}
                        </td>
                        <td style={{ ...tdStyle, fontSize: '0.78rem', fontFamily: 'monospace', color: 'var(--foreground-muted)' }}>
                          {formatDuration(run.durationMs)}
                        </td>
                        <td style={{ ...tdStyle, fontSize: '0.75rem', color: '#ef4444', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {run.error || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', justifyContent: 'flex-start' }}>
              <button
                style={btnAccentStyle}
                onClick={(e) => {
                  runNow(selectedJob.id, e);
                  setSelectedJob(null);
                }}
              >
                ▶ הרץ עכשיו
              </button>
              <button
                style={btnGhostStyle}
                onClick={(e) => {
                  toggleJobStatus(selectedJob.id, selectedJob.status, e);
                  setSelectedJob(null);
                }}
              >
                {selectedJob.status === 'active' ? '⏸ השהה' : '▶ הפעל'}
              </button>
              <button
                style={btnGhostStyle}
                onClick={() => setSelectedJob(null)}
              >
                סגור
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
