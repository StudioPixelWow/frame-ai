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
} from '@/lib/api/use-entity';
import { useMemo, Suspense } from 'react';

function DashboardContentInner() {
  const searchParams = useSearchParams();
  const clientId = searchParams.get('clientId');

  const { data: clients, loading: clientsLoading } = useClients();
  const { data: ganttItems } = useClientGanttItems();
  const { data: approvals } = useApprovals();
  const { data: files } = useClientFiles();
  const { data: projects } = useBusinessProjects();
  const { data: activities } = useActivities();
  const { data: timeline } = useProjectTimeline();

  const client = useMemo(() => clients.find(c => c.id === clientId), [clients, clientId]);

  const clientGanttItems = useMemo(() => ganttItems.filter(g => g.clientId === clientId), [ganttItems, clientId]);
  const clientApprovals = useMemo(() => approvals.filter(a => a.clientName === client?.name), [approvals, client]);
  const clientFiles = useMemo(() => files.filter(f => f.clientId === clientId), [files, clientId]);
  const clientProjects = useMemo(() => projects.filter(p => p.clientId === clientId), [projects, clientId]);
  const recentActivities = useMemo(
    () => activities.filter(a => a.entityId === clientId).slice(0, 5),
    [activities, clientId]
  );

  const clientProjectIds = useMemo(() => clientProjects.map(p => p.id), [clientProjects]);
  const projectTimeline = useMemo(
    () => (timeline || [])
      .filter((e: any) => clientProjectIds.includes(e.projectId))
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [timeline, clientProjectIds]
  );

  if (clientsLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
        <p style={{ color: 'var(--foreground-muted)' }}>טוען...</p>
      </div>
    );
  }

  if (!client) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
        <p style={{ color: 'var(--foreground-muted)' }}>לא נמצא לקוח</p>
      </div>
    );
  }

  const pendingApprovals = clientApprovals.filter(a => a.status === 'pending_approval').length;
  const publishedGantt = clientGanttItems.filter(g => g.status === 'published').length;
  const totalGantt = clientGanttItems.length;

  return (
    <div style={{ direction: 'rtl' }}>
      {/* Header Section */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1.5rem', marginBottom: '1.5rem' }}>
          {client.logoUrl && (
            <img
              src={client.logoUrl}
              alt={client.name}
              style={{
                height: '4rem',
                borderRadius: '0.5rem',
                border: `1px solid var(--border)`,
              }}
            />
          )}
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: 700, margin: '0 0 0.25rem 0' }}>
              ברוכים הבאים, {client.name}
            </h1>
            <p style={{ fontSize: '0.95rem', color: 'var(--foreground-muted)', margin: 0 }}>
              {client.company} • {client.businessField}
            </p>
          </div>
        </div>

        {/* Status Summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div
            style={{
              backgroundColor: 'var(--surface)',
              border: `1px solid var(--border)`,
              borderRadius: '0.75rem',
              padding: '1.25rem',
            }}
          >
            <p style={{ fontSize: '0.875rem', color: 'var(--foreground-muted)', margin: '0 0 0.5rem 0' }}>
              סטטוס תוכן
            </p>
            <p style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: 'var(--accent)' }}>
              {publishedGantt} / {totalGantt}
            </p>
            <p style={{ fontSize: '0.75rem', color: 'var(--foreground-muted)', margin: '0.5rem 0 0 0' }}>
              פרסומים מתוך סה"כ
            </p>
          </div>

          <div
            style={{
              backgroundColor: 'var(--surface)',
              border: `1px solid var(--border)`,
              borderRadius: '0.75rem',
              padding: '1.25rem',
            }}
          >
            <p style={{ fontSize: '0.875rem', color: 'var(--foreground-muted)', margin: '0 0 0.5rem 0' }}>
              ממתין לאישור
            </p>
            <p
              style={{
                fontSize: '1.5rem',
                fontWeight: 700,
                margin: 0,
                color: pendingApprovals > 0 ? 'var(--warning)' : 'var(--success)',
              }}
            >
              {pendingApprovals}
            </p>
            <p style={{ fontSize: '0.75rem', color: 'var(--foreground-muted)', margin: '0.5rem 0 0 0' }}>
              פריטים
            </p>
          </div>

          <div
            style={{
              backgroundColor: 'var(--surface)',
              border: `1px solid var(--border)`,
              borderRadius: '0.75rem',
              padding: '1.25rem',
            }}
          >
            <p style={{ fontSize: '0.875rem', color: 'var(--foreground-muted)', margin: '0 0 0.5rem 0' }}>
              קבצים
            </p>
            <p style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: 'var(--accent2)' }}>
              {clientFiles.length}
            </p>
            <p style={{ fontSize: '0.75rem', color: 'var(--foreground-muted)', margin: '0.5rem 0 0 0' }}>
              קבצים זמינים
            </p>
          </div>

          <div
            style={{
              backgroundColor: 'var(--surface)',
              border: `1px solid var(--border)`,
              borderRadius: '0.75rem',
              padding: '1.25rem',
            }}
          >
            <p style={{ fontSize: '0.875rem', color: 'var(--foreground-muted)', margin: '0 0 0.5rem 0' }}>
              פרויקטים פעילים
            </p>
            <p style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>
              {clientProjects.filter(p => p.projectStatus !== 'completed').length}
            </p>
            <p style={{ fontSize: '0.75rem', color: 'var(--foreground-muted)', margin: '0.5rem 0 0 0' }}>
              בתהליך
            </p>
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: '0 0 1rem 0' }}>קישורים מהירים</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
          {[
            { label: 'צפה בגאנט', href: 'gantt', icon: '📅' },
            { label: 'פריטים לאישור', href: 'approvals', icon: '✓' },
            { label: 'הורד קבצים', href: 'files', icon: '📥' },
            { label: 'סטטוס פרויקטים', href: 'projects', icon: '📊' },
          ].map(link => (
            <a
              key={link.href}
              href={`/client-portal/${link.href}?clientId=${clientId}`}
              style={{
                display: 'block',
                padding: '1.25rem',
                backgroundColor: 'var(--surface)',
                border: `1px solid var(--border)`,
                borderRadius: '0.75rem',
                textDecoration: 'none',
                color: 'var(--foreground)',
                transition: 'all 250ms ease',
                textAlign: 'center',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)';
                (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--surface-raised)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
                (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--surface)';
              }}
            >
              <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{link.icon}</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>{link.label}</div>
            </a>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: '0 0 1rem 0' }}>פעילות אחרונה</h2>
        <div
          style={{
            backgroundColor: 'var(--surface)',
            border: `1px solid var(--border)`,
            borderRadius: '0.75rem',
            padding: '1.5rem',
          }}
        >
          {recentActivities.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {recentActivities.map(activity => (
                <div
                  key={activity.id}
                  style={{
                    display: 'flex',
                    gap: '1rem',
                    paddingBottom: '1rem',
                    borderBottom: `1px solid var(--border)`,
                  }}
                >
                  <div
                    style={{
                      fontSize: '1.25rem',
                      flexShrink: 0,
                      width: '2.5rem',
                      height: '2.5rem',
                      borderRadius: '50%',
                      backgroundColor: 'var(--accent-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {activity.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '0.95rem', fontWeight: 600, margin: '0 0 0.25rem 0' }}>
                      {activity.title}
                    </p>
                    <p style={{ fontSize: '0.875rem', color: 'var(--foreground-muted)', margin: 0 }}>
                      {activity.description}
                    </p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--foreground-subtle)', margin: '0.5rem 0 0 0' }}>
                      {new Date(activity.createdAt).toLocaleDateString('he-IL')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: 'var(--foreground-muted)', textAlign: 'center', margin: 0 }}>
              אין פעילות עדיין
            </p>
          )}
        </div>
      </div>

      {/* Project Timeline */}
      {clientProjects.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: '0 0 1rem 0' }}>ציר זמן פרויקטים</h2>
          <div
            style={{
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '0.75rem',
              padding: '1.5rem',
            }}
          >
            {projectTimeline.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {projectTimeline.slice(0, 10).map((event: any) => {
                  const project = clientProjects.find(p => p.id === event.projectId);
                  return (
                    <div
                      key={event.id}
                      style={{
                        display: 'flex',
                        gap: '12px',
                        alignItems: 'flex-start',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        background: 'var(--background)',
                        border: '1px solid var(--border)',
                      }}
                    >
                      <div style={{
                        width: '8px', height: '8px', borderRadius: '50%',
                        background: 'var(--accent)', marginTop: '6px', flexShrink: 0,
                      }} />
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: '0.875rem', fontWeight: 500, margin: '0 0 2px 0' }}>
                          {event.description || event.actionType}
                        </p>
                        <p style={{ fontSize: '0.75rem', color: 'var(--foreground-muted)', margin: 0 }}>
                          {project?.projectName || ''} • {new Date(event.createdAt).toLocaleDateString('he-IL')}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p style={{ color: 'var(--foreground-muted)', textAlign: 'center', margin: 0 }}>
                אין אירועים בציר הזמן
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function DashboardContent() {
  return (
    <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center' }}>...טוען</div>}>
      <DashboardContentInner />
    </Suspense>
  );
}
