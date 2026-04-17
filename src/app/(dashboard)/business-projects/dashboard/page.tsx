'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import {
  useBusinessProjects,
  useProjectMilestones,
  useClients,
  useEmployees,
  useTasks,
  useProjectTimeline,
} from '@/lib/api/use-entity';
import type {
  BusinessProject,
  ProjectMilestone,
  Client,
  Employee,
  Task,
  ProjectTimelineEvent,
} from '@/lib/db/schema';

/* ────────────────────────────── helpers ────────────────────────────── */

const projectStatusLabels: Record<string, string> = {
  not_started: 'לא התחיל',
  in_progress: 'בתהליך',
  awaiting_approval: 'ממתין לאישור',
  waiting_for_client: 'בהמתנה ללקוח',
  completed: 'הושלם',
};

const projectTypeLabels: Record<string, string> = {
  website: 'אתר', branding: 'מיתוג', social: 'סושיאל', campaign: 'קמפיין',
  seo: 'SEO', landing_page: 'דף נחיתה', automation: 'אוטומציה',
  crm: 'CRM', design: 'עיצוב', consulting: 'ייעוץ',
};

function formatDate(d: string | null): string {
  try {
    if (!d) return '—';
    const date = new Date(d);
    if (isNaN(date.getTime())) return d;
    return date.toLocaleDateString('he-IL');
  } catch { return d || '—'; }
}

function formatDateFull(d: string): string {
  try {
    return new Date(d).toLocaleDateString('he-IL', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return d; }
}

function progressColor(p: number): string {
  if (p <= 30) return '#ef4444';
  if (p <= 70) return '#f59e0b';
  return '#22c55e';
}

/* ─────────────────────────── component ─────────────────────────── */

export default function BusinessProjectsDashboard() {
  const { data: projects = [], loading: loadingProjects } = useBusinessProjects();
  const { data: milestones = [] } = useProjectMilestones();
  const { data: clients = [] } = useClients();
  const { data: employees = [] } = useEmployees();
  const { data: tasks = [] } = useTasks();
  const { data: timeline = [] } = useProjectTimeline();

  /* ── lookup maps ── */
  const clientMap = useMemo(
    () => Object.fromEntries(clients.map((c: Client) => [c.id, c])),
    [clients],
  );
  const empMap = useMemo(
    () => Object.fromEntries(employees.map((e: Employee) => [e.id, e])),
    [employees],
  );

  /* ── per-project milestone stats ── */
  const projectStats = useMemo(() => {
    const map: Record<string, { total: number; approved: number; progress: number }> = {};
    const grouped: Record<string, ProjectMilestone[]> = {};
    for (const m of milestones) {
      if (!grouped[m.projectId]) grouped[m.projectId] = [];
      grouped[m.projectId].push(m);
    }
    for (const [pid, ms] of Object.entries(grouped)) {
      const total = ms.length;
      const approved = ms.filter((m) => m.status === 'approved').length;
      map[pid] = { total, approved, progress: total > 0 ? Math.round((approved / total) * 100) : 0 };
    }
    return map;
  }, [milestones]);

  /* ── top KPIs ── */
  const kpis = useMemo(() => {
    const total = projects.length;
    const inProgress = projects.filter((p: BusinessProject) =>
      ['in_progress', 'awaiting_approval', 'waiting_for_client'].includes(p.projectStatus || ''),
    ).length;
    const completed = projects.filter((p: BusinessProject) => p.projectStatus === 'completed').length;

    // Delayed = has end date in the past AND is not completed
    const now = new Date();
    const delayed = projects.filter((p: BusinessProject) => {
      if (p.projectStatus === 'completed') return false;
      if (!p.endDate) return false;
      return new Date(p.endDate) < now;
    }).length;

    return { total, inProgress, completed, delayed };
  }, [projects]);

  /* ── sorted project list (delayed first, then by progress ascending) ── */
  const sortedProjects = useMemo(() => {
    const now = new Date();
    return [...projects].sort((a: BusinessProject, b: BusinessProject) => {
      const aDelayed = a.projectStatus !== 'completed' && a.endDate && new Date(a.endDate) < now;
      const bDelayed = b.projectStatus !== 'completed' && b.endDate && new Date(b.endDate) < now;
      if (aDelayed && !bDelayed) return -1;
      if (!aDelayed && bDelayed) return 1;
      const aProg = projectStats[a.id]?.progress ?? 0;
      const bProg = projectStats[b.id]?.progress ?? 0;
      return aProg - bProg;
    });
  }, [projects, projectStats]);

  /* ── employee workload ── */
  const employeeWorkload = useMemo(() => {
    const countMap: Record<string, number> = {};
    // Count tasks per assignee
    for (const t of tasks) {
      const ids: string[] = Array.isArray((t as any).assigneeIds)
        ? (t as any).assigneeIds
        : (t as any).assigneeId
          ? [(t as any).assigneeId]
          : [];
      for (const eid of ids) {
        if (eid) countMap[eid] = (countMap[eid] || 0) + 1;
      }
    }
    // Count milestone assignments
    for (const m of milestones) {
      if (m.assignedEmployeeId) {
        countMap[m.assignedEmployeeId] = (countMap[m.assignedEmployeeId] || 0) + 1;
      }
    }
    return Object.entries(countMap)
      .map(([empId, count]) => ({ empId, count, name: empMap[empId]?.name || empId }))
      .sort((a, b) => b.count - a.count);
  }, [tasks, milestones, empMap]);

  /* ── global timeline (newest first, last 20) ── */
  const recentTimeline = useMemo(
    () =>
      [...timeline]
        .sort((a: ProjectTimelineEvent, b: ProjectTimelineEvent) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        )
        .slice(0, 20),
    [timeline],
  );

  // Loading state
  if (loadingProjects) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', direction: 'rtl', color: '#64748b' }}>
        טוען דשבורד...
      </div>
    );
  }

  return (
    <div style={{ direction: 'rtl', padding: '32px', maxWidth: '1440px', margin: '0 auto', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <style>{`
        @keyframes dash-fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .dash-card {
          background: #1a1a2e;
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 14px;
          padding: 22px;
          transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
          animation: dash-fade-in 0.35s ease both;
        }
        .dash-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 28px rgba(0,0,0,0.35);
          border-color: rgba(255,255,255,0.12);
        }
        .dash-kpi {
          background: #1a1a2e;
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 14px;
          padding: 24px;
          display: flex; flex-direction: column; gap: 8px;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
          animation: dash-fade-in 0.3s ease both;
        }
        .dash-kpi:hover { transform: translateY(-3px); box-shadow: 0 10px 30px rgba(0,0,0,0.35); }
        .dash-kpi-value { font-size: 36px; font-weight: 800; letter-spacing: -1px; }
        .dash-kpi-label { font-size: 13px; color: #64748b; font-weight: 500; }
        .dash-project-row {
          display: grid; grid-template-columns: 2fr 1fr 120px 1fr 80px;
          align-items: center; gap: 16px;
          padding: 14px 18px;
          border-radius: 10px;
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.04);
          transition: all 0.2s ease;
          text-decoration: none; color: inherit;
        }
        .dash-project-row:hover {
          background: rgba(99,102,241,0.06);
          border-color: rgba(99,102,241,0.15);
          transform: translateX(-4px);
        }
        .dash-project-row.delayed {
          border-right: 3px solid #ef4444;
          background: rgba(239,68,68,0.04);
        }
        .dash-project-row.delayed:hover {
          background: rgba(239,68,68,0.08);
          border-color: rgba(239,68,68,0.2);
        }
        .dash-badge {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 4px 12px; border-radius: 20px;
          font-size: 11px; font-weight: 600; letter-spacing: 0.2px;
        }
        .dash-emp-bar {
          height: 8px; border-radius: 4px;
          transition: width 0.6s cubic-bezier(0.4,0,0.2,1);
        }
        .dash-timeline-item {
          display: flex; gap: 14px; align-items: flex-start;
          padding: 12px 16px; border-radius: 10px;
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.03);
          transition: all 0.15s ease;
          animation: dash-fade-in 0.3s ease both;
        }
        .dash-timeline-item:hover {
          background: rgba(255,255,255,0.04);
          border-color: rgba(255,255,255,0.08);
        }
        .dash-section-title {
          font-size: 15px; font-weight: 600; color: #94a3b8;
          text-transform: uppercase; letter-spacing: 0.6px;
          margin: 0 0 16px 0;
        }
      `}</style>

      {/* ══════════ HEADER ══════════ */}
      <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: '700', color: '#f1f5f9', margin: '0 0 4px 0', letterSpacing: '-0.3px' }}>
            דשבורד פרויקטים עסקיים
          </h1>
          <p style={{ fontSize: '14px', color: '#475569', margin: 0 }}>
            סקירה כללית של כל הפרויקטים, צוות ופעילות
          </p>
        </div>
        <Link href="/business-projects" style={{
          padding: '10px 20px', borderRadius: '10px', fontSize: '13px', fontWeight: '600',
          background: '#6366f1', color: '#fff', textDecoration: 'none',
          transition: 'all 0.2s ease',
        }}>
          כל הפרויקטים
        </Link>
      </div>

      {/* ══════════ KPI CARDS ══════════ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '32px' }}>
        <div className="dash-kpi" style={{ animationDelay: '0s' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(99,102,241,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
            📊
          </div>
          <div className="dash-kpi-value" style={{ color: '#e2e8f0' }}>{kpis.total}</div>
          <div className="dash-kpi-label">סה&quot;כ פרויקטים</div>
        </div>
        <div className="dash-kpi" style={{ animationDelay: '0.05s' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(245,158,11,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
            🔄
          </div>
          <div className="dash-kpi-value" style={{ color: '#fbbf24' }}>{kpis.inProgress}</div>
          <div className="dash-kpi-label">בתהליך</div>
        </div>
        <div className="dash-kpi" style={{ animationDelay: '0.1s' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
            ⚠️
          </div>
          <div className="dash-kpi-value" style={{ color: '#f87171' }}>{kpis.delayed}</div>
          <div className="dash-kpi-label">באיחור</div>
        </div>
        <div className="dash-kpi" style={{ animationDelay: '0.15s' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(34,197,94,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
            ✅
          </div>
          <div className="dash-kpi-value" style={{ color: '#4ade80' }}>{kpis.completed}</div>
          <div className="dash-kpi-label">הושלמו</div>
        </div>
      </div>

      {/* ══════════ MAIN GRID: Projects List + Right Sidebar ══════════ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '24px' }}>

        {/* ── LEFT: Projects List ── */}
        <div className="dash-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '20px 22px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <h2 className="dash-section-title" style={{ margin: 0 }}>רשימת פרויקטים</h2>
          </div>

          {/* Column headers */}
          <div style={{
            display: 'grid', gridTemplateColumns: '2fr 1fr 120px 1fr 80px',
            gap: '16px', padding: '10px 18px',
            fontSize: '11px', color: '#475569', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px',
            borderBottom: '1px solid rgba(255,255,255,0.04)',
          }}>
            <span>פרויקט</span>
            <span>לקוח</span>
            <span>התקדמות</span>
            <span>סטטוס</span>
            <span></span>
          </div>

          {/* Project rows */}
          <div style={{ maxHeight: '520px', overflowY: 'auto', padding: '8px 10px' }}>
            {sortedProjects.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#475569' }}>
                <div style={{ fontSize: '28px', marginBottom: '8px', opacity: 0.3 }}>📋</div>
                אין פרויקטים
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {sortedProjects.map((project: BusinessProject, idx: number) => {
                  const client = clientMap[project.clientId];
                  const stats = projectStats[project.id] || { total: 0, approved: 0, progress: 0 };
                  const now = new Date();
                  const isDelayed = project.projectStatus !== 'completed' && project.endDate && new Date(project.endDate) < now;
                  const pColor = progressColor(stats.progress);

                  const statusConfig: Record<string, { bg: string; color: string }> = {
                    not_started: { bg: 'rgba(100,116,139,0.12)', color: '#94a3b8' },
                    in_progress: { bg: 'rgba(245,158,11,0.12)', color: '#fbbf24' },
                    awaiting_approval: { bg: 'rgba(139,92,246,0.12)', color: '#a78bfa' },
                    waiting_for_client: { bg: 'rgba(249,115,22,0.12)', color: '#fb923c' },
                    completed: { bg: 'rgba(34,197,94,0.12)', color: '#4ade80' },
                  };
                  const sc = statusConfig[project.projectStatus || 'not_started'] || statusConfig.not_started;

                  return (
                    <Link
                      key={project.id}
                      href={`/business-projects/${project.id}`}
                      className={`dash-project-row ${isDelayed ? 'delayed' : ''}`}
                      style={{ animationDelay: `${idx * 0.03}s` }}
                    >
                      {/* Name + type */}
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: '600', color: '#e2e8f0', marginBottom: '2px' }}>
                          {project.projectName}
                        </div>
                        <div style={{ fontSize: '11px', color: '#475569' }}>
                          {projectTypeLabels[project.projectType] || project.projectType}
                          {isDelayed && (
                            <span style={{ color: '#f87171', marginRight: '8px', fontWeight: '600' }}>
                              • באיחור
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Client */}
                      <div style={{ fontSize: '13px', color: '#94a3b8' }}>
                        {client?.name || '—'}
                      </div>

                      {/* Progress bar */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ flex: 1, height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{
                            height: '100%', width: `${stats.progress}%`,
                            background: pColor, borderRadius: '3px',
                            transition: 'width 0.6s cubic-bezier(0.4,0,0.2,1)',
                          }} />
                        </div>
                        <span style={{ fontSize: '12px', fontWeight: '700', color: pColor, minWidth: '32px', textAlign: 'left' }}>
                          {stats.progress}%
                        </span>
                      </div>

                      {/* Status badge */}
                      <div>
                        <span className="dash-badge" style={{ background: sc.bg, color: sc.color }}>
                          <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: sc.color }} />
                          {projectStatusLabels[project.projectStatus || 'not_started']}
                        </span>
                      </div>

                      {/* Arrow */}
                      <div style={{ textAlign: 'center', color: '#334155', fontSize: '16px' }}>
                        ←
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT SIDEBAR ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Employee Workload */}
          <div className="dash-card" style={{ animationDelay: '0.1s' }}>
            <h2 className="dash-section-title">עומס עבודה לפי עובד</h2>
            {employeeWorkload.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: '#475569', fontSize: '13px' }}>
                אין נתוני עומס
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {employeeWorkload.slice(0, 8).map((ew, idx) => {
                  const maxCount = employeeWorkload[0]?.count || 1;
                  const pct = Math.round((ew.count / maxCount) * 100);
                  const barColor = pct > 80 ? '#f87171' : pct > 50 ? '#fbbf24' : '#6366f1';
                  return (
                    <div key={ew.empId}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ fontSize: '13px', color: '#cbd5e1', fontWeight: '500' }}>{ew.name}</span>
                        <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>
                          {ew.count} משימות
                        </span>
                      </div>
                      <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.04)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div className="dash-emp-bar" style={{ width: `${pct}%`, background: barColor }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Global Activity Timeline */}
          <div className="dash-card" style={{ animationDelay: '0.15s', flex: 1, display: 'flex', flexDirection: 'column' }}>
            <h2 className="dash-section-title">פעילות אחרונה</h2>
            <div style={{ flex: 1, maxHeight: '400px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {recentTimeline.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px', color: '#475569', fontSize: '13px' }}>
                  אין פעילות אחרונה
                </div>
              ) : (
                recentTimeline.map((event: ProjectTimelineEvent, idx: number) => {
                  const iconMap: Record<string, { icon: string; bg: string }> = {
                    milestone_created: { icon: '📌', bg: 'rgba(99,102,241,0.12)' },
                    milestone_status_changed: { icon: '🔄', bg: 'rgba(245,158,11,0.12)' },
                    milestone_assigned: { icon: '👤', bg: 'rgba(139,92,246,0.12)' },
                    milestone_completed: { icon: '✅', bg: 'rgba(34,197,94,0.12)' },
                    file_uploaded: { icon: '📎', bg: 'rgba(59,130,246,0.12)' },
                    payment_created: { icon: '💰', bg: 'rgba(245,158,11,0.12)' },
                  };
                  const { icon, bg } = iconMap[event.actionType] || { icon: '📋', bg: 'rgba(100,116,139,0.12)' };

                  // Find the project name for context
                  const proj = projects.find((p: BusinessProject) => p.id === event.projectId);

                  return (
                    <Link
                      key={event.id}
                      href={`/business-projects/${event.projectId}`}
                      className="dash-timeline-item"
                      style={{ animationDelay: `${idx * 0.03}s`, textDecoration: 'none', color: 'inherit' }}
                    >
                      <div style={{
                        width: '32px', height: '32px', borderRadius: '8px', flexShrink: 0,
                        background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '14px',
                      }}>
                        {icon}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: '13px', color: '#cbd5e1', fontWeight: '500',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {event.description}
                        </div>
                        <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px', display: 'flex', gap: '8px' }}>
                          <span>{formatDateFull(event.createdAt)}</span>
                          {proj && (
                            <>
                              <span style={{ color: 'rgba(255,255,255,0.1)' }}>|</span>
                              <span style={{ color: '#818cf8' }}>{proj.projectName}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
