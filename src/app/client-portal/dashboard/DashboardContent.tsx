'use client';

import { useSearchParams } from 'next/navigation';
import {
  useClients,
  useClientGanttItems,
  useApprovals,
  useClientFiles,
  useBusinessProjects,
  useActivities,
  useProjectTimeline,
  useProjectMilestones,
  useLeads,
  useCampaigns,
} from '@/lib/api/use-entity';
import { useMemo, Suspense } from 'react';

/* ── Status card ── */
function StatusCard({ icon, value, label, sublabel, color, accent }: {
  icon: string; value: string | number; label: string; sublabel?: string; color: string; accent?: string;
}) {
  return (
    <div style={{
      backgroundColor: 'var(--surface)',
      border: `1px solid var(--border)`,
      borderRight: `4px solid ${color}`,
      borderRadius: '0.75rem',
      padding: '1.25rem',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: '-8px', left: '-8px', fontSize: '3rem', opacity: 0.06,
        transform: 'rotate(-15deg)', pointerEvents: 'none',
      }}>{icon}</div>
      <p style={{ fontSize: '0.8rem', color: 'var(--foreground-muted)', margin: '0 0 0.5rem 0', fontWeight: 500 }}>
        {label}
      </p>
      <p style={{ fontSize: '2rem', fontWeight: 800, margin: 0, color: accent || color, letterSpacing: '-0.02em' }}>
        {value}
      </p>
      {sublabel && (
        <p style={{ fontSize: '0.72rem', color: 'var(--foreground-muted)', margin: '0.35rem 0 0 0' }}>
          {sublabel}
        </p>
      )}
    </div>
  );
}

function DashboardContentInner() {
  const searchParams = useSearchParams();
  const clientId = searchParams.get('clientId');

  const { data: clients, loading: clientsLoading } = useClients();
  const { data: ganttItems } = useClientGanttItems();
  const { data: approvals } = useApprovals();
  const { data: files } = useClientFiles();
  const { data: projects } = useBusinessProjects();
  const { data: milestones } = useProjectMilestones();
  const { data: activities } = useActivities();
  const { data: timeline } = useProjectTimeline();
  const { data: leads } = useLeads();
  const { data: campaigns } = useCampaigns();

  const client = useMemo(() => clients.find(c => c.id === clientId), [clients, clientId]);

  const clientGanttItems = useMemo(() => ganttItems.filter(g => g.clientId === clientId), [ganttItems, clientId]);
  // Server-side scoping ensures approvals are already filtered for this client
  const clientApprovals = approvals;
  const clientFiles = useMemo(() => files.filter(f => f.clientId === clientId && f.category !== 'accountant'), [files, clientId]);
  const clientProjects = useMemo(() => projects.filter(p => p.clientId === clientId), [projects, clientId]);
  const clientLeads = useMemo(() => leads.filter(l => l.convertedClientId === clientId || l.clientId === clientId), [leads, clientId]);
  const clientCampaigns = useMemo(() => campaigns.filter((c: any) => c.clientId === clientId), [campaigns, clientId]);

  // Server-side scoping ensures activities are already filtered for this client
  const recentActivities = useMemo(
    () => [...activities].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 6),
    [activities]
  );

  const clientProjectIds = useMemo(() => clientProjects.map(p => p.id), [clientProjects]);
  const projectTimeline = useMemo(
    () => (timeline || [])
      .filter((e: any) => clientProjectIds.includes(e.projectId))
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [timeline, clientProjectIds]
  );

  // Project milestones for progress
  const projectMilestones = useMemo(() =>
    milestones.filter(m => clientProjectIds.includes(m.projectId || '')),
    [milestones, clientProjectIds]
  );
  const completedMilestones = projectMilestones.filter(m => m.status === 'completed').length;
  const totalMilestones = projectMilestones.length;

  if (clientsLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
        <div style={{ fontSize: '2rem', marginBottom: '1rem', animation: 'pulse 1.5s infinite' }}>✨</div>
        <p style={{ color: 'var(--foreground-muted)', fontSize: '0.9rem' }}>טוען את הפורטל שלך...</p>
      </div>
    );
  }

  if (!client) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔍</div>
        <p style={{ color: 'var(--foreground-muted)' }}>לא נמצא לקוח</p>
      </div>
    );
  }

  const pendingApprovals = clientApprovals.filter(a => a.status === 'pending_approval').length;
  const approvedItems = clientApprovals.filter(a => a.status === 'approved').length;
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  // Current month gantt stats
  const currentMonthGantt = clientGanttItems.filter(g => {
    if (g.ganttType === "monthly" && g.date) {
      const d = new Date(g.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    }
    if (g.ganttType === "annual") return g.month === currentMonth + 1 && g.year === currentYear;
    return false;
  });
  const publishedThisMonth = currentMonthGantt.filter(g => g.status === 'published' || g.status === 'approved').length;

  // Upcoming gantt items (next 14 days)
  const upcomingContent = clientGanttItems
    .filter(g => {
      if (!g.date) return false;
      const d = new Date(g.date);
      const diff = (d.getTime() - now.getTime()) / 86400000;
      return diff >= 0 && diff <= 14 && g.status !== 'published';
    })
    .sort((a, b) => new Date(a.date || '').getTime() - new Date(b.date || '').getTime())
    .slice(0, 5);

  const color = client.color || '#00B5FE';
  const initials = client.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2);

  const activeProjects = clientProjects.filter(p => p.projectStatus !== 'completed');

  return (
    <div style={{ direction: 'rtl' }}>

      {/* ═══ PREMIUM HEADER ═══ */}
      <div style={{
        background: `linear-gradient(135deg, ${color}08, ${color}15)`,
        border: `1px solid ${color}25`,
        borderRadius: '1rem',
        padding: '2rem',
        marginBottom: '2rem',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: '-20px', left: '-20px', width: '120px', height: '120px',
          borderRadius: '50%', background: `${color}08`, pointerEvents: 'none',
        }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', position: 'relative', zIndex: 1 }}>
          {client.logoUrl ? (
            <img src={client.logoUrl} alt={client.company || client.name} style={{
              height: '4.5rem', width: '4.5rem', borderRadius: '0.75rem', objectFit: 'cover',
              border: `2px solid ${color}30`, boxShadow: `0 4px 12px ${color}15`,
            }} onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />
          ) : (
            <div style={{
              width: '4.5rem', height: '4.5rem', borderRadius: '0.75rem',
              background: `${color}20`, border: `2px solid ${color}35`, color,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: '1.25rem', boxShadow: `0 4px 12px ${color}15`,
            }}>
              {initials}
            </div>
          )}
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: '0 0 0.25rem 0', letterSpacing: '-0.01em' }}>
              שלום, {client.contactPerson || client.name}
            </h1>
            <p style={{ fontSize: '0.9rem', color: 'var(--foreground-muted)', margin: 0 }}>
              {[client.company || client.name, client.businessField].filter(Boolean).join(' • ')}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
              <span style={{
                width: '7px', height: '7px', borderRadius: '50%', background: '#22c55e',
                boxShadow: '0 0 6px #22c55e',
              }} />
              <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#22c55e' }}>
                חשבון פעיל
              </span>
              <span style={{ fontSize: '0.72rem', color: 'var(--foreground-muted)', marginRight: '0.5rem' }}>
                {now.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ PENDING APPROVAL BANNER ═══ */}
      {pendingApprovals > 0 && (
        <a href={`/client-portal/approvals?clientId=${clientId}`} style={{
          display: 'flex', alignItems: 'center', gap: '0.75rem', textDecoration: 'none',
          background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)',
          borderRadius: '0.75rem', padding: '1rem 1.25rem', marginBottom: '1.5rem',
          color: 'var(--foreground)',
        }}>
          <span style={{ fontSize: '1.25rem' }}>✋</span>
          <div style={{ flex: 1 }}>
            <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>
              {pendingApprovals} פריטים ממתינים לאישורך
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--foreground-muted)', marginRight: '0.5rem' }}>
              — לחץ כדי לצפות ולאשר
            </span>
          </div>
          <span style={{ fontSize: '0.8rem', color: '#f59e0b', fontWeight: 600 }}>צפה &larr;</span>
        </a>
      )}

      {/* ═══ STATUS CARDS ═══ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <StatusCard icon="📅" value={`${publishedThisMonth}/${currentMonthGantt.length}`} label="תוכן החודש" sublabel="פורסמו מתוך מתוכננים" color="#22c55e" />
        <StatusCard icon="✅" value={approvedItems} label="אישורים שהתקבלו" sublabel="סה״כ אושרו" color="#38bdf8" />
        <StatusCard icon="📂" value={clientFiles.length} label="קבצים זמינים" sublabel="להורדה ולצפייה" color="#a78bfa" />
        <StatusCard icon="🚀" value={activeProjects.length} label="פרויקטים פעילים" sublabel={totalMilestones > 0 ? `${completedMilestones}/${totalMilestones} אבני דרך` : "בתהליך"} color="#f97316" />
      </div>

      {/* ═══ RESULTS & HIGHLIGHTS (Part 5) ═══ */}
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 1rem 0' }}>📊 תוצאות וסיכום</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div style={{
            backgroundColor: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: '0.75rem', padding: '1.25rem', textAlign: 'center',
          }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>🎯</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#34d399', marginBottom: '0.25rem' }}>
              {clientLeads.length}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--foreground-muted)', fontWeight: 500 }}>
              לידים שהתקבלו
            </div>
            {clientLeads.filter(l => l.status === 'new').length > 0 && (
              <div style={{ fontSize: '0.7rem', color: '#22c55e', marginTop: '0.35rem', fontWeight: 600 }}>
                +{clientLeads.filter(l => l.status === 'new').length} חדשים
              </div>
            )}
          </div>

          <div style={{
            backgroundColor: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: '0.75rem', padding: '1.25rem', textAlign: 'center',
          }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>📣</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#a78bfa', marginBottom: '0.25rem' }}>
              {clientCampaigns.length}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--foreground-muted)', fontWeight: 500 }}>
              קמפיינים
            </div>
            {clientCampaigns.filter((c: any) => c.status === 'active').length > 0 && (
              <div style={{ fontSize: '0.7rem', color: '#a78bfa', marginTop: '0.35rem', fontWeight: 600 }}>
                {clientCampaigns.filter((c: any) => c.status === 'active').length} פעילים
              </div>
            )}
          </div>

          <div style={{
            backgroundColor: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: '0.75rem', padding: '1.25rem', textAlign: 'center',
          }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>📝</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#38bdf8', marginBottom: '0.25rem' }}>
              {clientGanttItems.length}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--foreground-muted)', fontWeight: 500 }}>
              פריטי תוכן סה״כ
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--foreground-muted)', marginTop: '0.35rem' }}>
              {clientGanttItems.filter(g => g.status === 'published' || g.status === 'approved').length} פורסמו
            </div>
          </div>
        </div>
      </div>

      {/* ═══ UPCOMING CONTENT ═══ */}
      {upcomingContent.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 1rem 0' }}>📆 תוכן מתוכנן בקרוב</h2>
          <div style={{
            backgroundColor: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: '0.75rem', overflow: 'hidden',
          }}>
            {upcomingContent.map((item, idx) => (
              <div key={item.id} style={{
                display: 'flex', alignItems: 'center', gap: '1rem',
                padding: '1rem 1.25rem',
                borderBottom: idx < upcomingContent.length - 1 ? '1px solid var(--border)' : 'none',
              }}>
                <div style={{
                  width: '2.5rem', height: '2.5rem', borderRadius: '0.5rem',
                  background: 'rgba(56,189,248,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1rem', flexShrink: 0,
                }}>
                  {item.platform === 'instagram' ? '📸' : item.platform === 'tiktok' ? '🎵' : item.platform === 'facebook' ? '📘' : '📝'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.title || item.ideaSummary || 'פוסט מתוכנן'}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--foreground-muted)', display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.15rem' }}>
                    {item.platform && <span>{item.platform}</span>}
                    {item.format && <span>• {item.format}</span>}
                  </div>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--foreground-muted)', whiteSpace: 'nowrap', fontWeight: 500 }}>
                  {item.date ? new Date(item.date).toLocaleDateString('he-IL', { day: 'numeric', month: 'short' }) : ''}
                </div>
                <span style={{
                  fontSize: '0.6rem', fontWeight: 600, padding: '0.2rem 0.5rem', borderRadius: '999px',
                  background: item.status === 'approved' ? 'rgba(34,197,94,0.1)' : item.status === 'draft' ? 'rgba(107,114,128,0.1)' : 'rgba(251,191,36,0.1)',
                  color: item.status === 'approved' ? '#22c55e' : item.status === 'draft' ? '#6b7280' : '#f59e0b',
                }}>
                  {item.status === 'approved' ? 'מאושר' : item.status === 'draft' ? 'טיוטה' : 'ממתין'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ QUICK LINKS ═══ */}
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 1rem 0' }}>ניווט מהיר</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
          {[
            { label: 'לוח תוכן', href: 'gantt', icon: '📅', color: '#38bdf8', desc: 'צפה בתוכנית' },
            { label: 'אישורים', href: 'approvals', icon: '✅', color: '#22c55e', desc: `${pendingApprovals} ממתינים` },
            { label: 'קבצים', href: 'files', icon: '📂', color: '#a78bfa', desc: `${clientFiles.length} קבצים` },
            { label: 'פרויקטים', href: 'projects', icon: '🚀', color: '#f97316', desc: `${activeProjects.length} פעילים` },
            { label: 'לידים', href: 'leads', icon: '🎯', color: '#34d399', desc: `${clientLeads.length} סה״כ` },
            { label: 'פעילות', href: 'activity', icon: '📋', color: '#f472b6', desc: 'ציר זמן' },
          ].map(link => (
            <a
              key={link.href}
              href={`/client-portal/${link.href}?clientId=${clientId}`}
              style={{
                display: 'block', padding: '1rem', backgroundColor: 'var(--surface)',
                border: `1px solid var(--border)`, borderRadius: '0.75rem',
                textDecoration: 'none', color: 'var(--foreground)',
                transition: 'all 200ms ease',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.borderColor = link.color;
                (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
                (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 12px ${link.color}15`;
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
                (e.currentTarget as HTMLElement).style.transform = 'none';
                (e.currentTarget as HTMLElement).style.boxShadow = 'none';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  width: '2.5rem', height: '2.5rem', borderRadius: '0.5rem',
                  background: `${link.color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.25rem',
                }}>{link.icon}</div>
                <div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 700 }}>{link.label}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--foreground-muted)' }}>{link.desc}</div>
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>

      {/* ═══ RECENT ACTIVITY ═══ */}
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 1rem 0' }}>🕐 עבודה אחרונה</h2>
        <div style={{
          backgroundColor: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: '0.75rem', padding: '1.5rem',
        }}>
          {recentActivities.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {recentActivities.map((activity, idx) => (
                <div key={activity.id} style={{
                  display: 'flex', gap: '1rem',
                  paddingBottom: idx < recentActivities.length - 1 ? '1rem' : 0,
                  borderBottom: idx < recentActivities.length - 1 ? '1px solid var(--border)' : 'none',
                }}>
                  <div style={{
                    fontSize: '1rem', flexShrink: 0, width: '2.25rem', height: '2.25rem',
                    borderRadius: '50%', backgroundColor: 'rgba(56,189,248,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {activity.icon || '📌'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '0.875rem', fontWeight: 600, margin: '0 0 0.15rem 0' }}>
                      {activity.title}
                    </p>
                    {activity.description && (
                      <p style={{ fontSize: '0.8rem', color: 'var(--foreground-muted)', margin: 0 }}>
                        {activity.description}
                      </p>
                    )}
                  </div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--foreground-subtle)', whiteSpace: 'nowrap', marginTop: '0.15rem' }}>
                    {formatRelativeDate(activity.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: 'var(--foreground-muted)', textAlign: 'center', margin: 0, fontSize: '0.875rem' }}>
              אין פעילות עדיין
            </p>
          )}
        </div>
      </div>

      {/* ═══ PROJECT TIMELINE ═══ */}
      {clientProjects.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 1rem 0' }}>🏗️ פרויקטים</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {clientProjects.map(project => {
              const pm = projectMilestones.filter(m => m.projectId === project.id);
              const done = pm.filter(m => m.status === 'completed').length;
              const pct = pm.length > 0 ? Math.round((done / pm.length) * 100) : 0;
              const statusLabel: Record<string, string> = {
                not_started: 'טרם התחיל', in_progress: 'בביצוע',
                waiting_for_client: 'ממתין ללקוח', completed: 'הושלם',
              };
              const statusColor: Record<string, string> = {
                not_started: '#6b7280', in_progress: '#38bdf8',
                waiting_for_client: '#f59e0b', completed: '#22c55e',
              };
              return (
                <div key={project.id} style={{
                  backgroundColor: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: '0.75rem', padding: '1.25rem',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{project.projectName}</div>
                      {project.description && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--foreground-muted)', marginTop: '0.2rem' }}>
                          {project.description.slice(0, 80)}{project.description.length > 80 ? '...' : ''}
                        </div>
                      )}
                    </div>
                    <span style={{
                      fontSize: '0.65rem', fontWeight: 600, padding: '0.2rem 0.6rem', borderRadius: '999px',
                      background: `${statusColor[project.projectStatus] || '#6b7280'}15`,
                      color: statusColor[project.projectStatus] || '#6b7280',
                    }}>
                      {statusLabel[project.projectStatus] || project.projectStatus}
                    </span>
                  </div>
                  {pm.length > 0 && (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--foreground-muted)', marginBottom: '0.35rem' }}>
                        <span>התקדמות</span>
                        <span>{done}/{pm.length} ({pct}%)</span>
                      </div>
                      <div style={{ height: '6px', borderRadius: '3px', background: 'var(--border)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, borderRadius: '3px', background: '#22c55e', transition: 'width 0.5s ease' }} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ FOOTER ═══ */}
      <div style={{
        textAlign: 'center', padding: '2rem 1rem', marginTop: '1rem',
        borderTop: '1px solid var(--border)',
        color: 'var(--foreground-muted)', fontSize: '0.75rem',
      }}>
        <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Studio Pixel — פורטל לקוח</div>
        <div>כל הזכויות שמורות &copy; {new Date().getFullYear()}</div>
      </div>
    </div>
  );
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) {
    const hours = Math.floor(diff / 3600000);
    if (hours === 0) return 'ממש עכשיו';
    return `לפני ${hours} שעות`;
  }
  if (days === 1) return 'אתמול';
  if (days < 7) return `לפני ${days} ימים`;
  return date.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' });
}

export default function DashboardContent() {
  return (
    <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center' }}>...טוען</div>}>
      <DashboardContentInner />
    </Suspense>
  );
}
