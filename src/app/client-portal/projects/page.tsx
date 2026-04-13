'use client';

import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  useBusinessProjects,
  useProjectMilestones,
  usePodcastSessions,
} from '@/lib/api/use-entity';

const getStatusLabel = (status: string): string => {
  const statusMap: Record<string, string> = {
    not_started: 'טרם התחיל',
    in_progress: 'בתהליך',
    waiting_for_client: 'ממתין לכם',
    completed: 'הושלם',
  };
  return statusMap[status] || status;
};

const getStatusColor = (status: string): string => {
  const colorMap: Record<string, string> = {
    not_started: '#a1a1aa',
    in_progress: '#3b82f6',
    waiting_for_client: '#f59e0b',
    completed: '#22c55e',
  };
  return colorMap[status] || '#a1a1aa';
};

const getProjectTypeLabel = (type: string): string => {
  const typeMap: Record<string, string> = {
    branding: 'מיתוג',
    website: 'אתר',
    campaign: 'קמפיין',
    general: 'כללי',
  };
  return typeMap[type] || type;
};

const getPodcastPackageLabel = (packageType: string): string => {
  const map: Record<string, string> = {
    recording_only: 'הקלטה בלבד',
    recording_3_videos: '3 וידאו',
    recording_5_videos: '5 וידאו',
    recording_10_videos: '10 וידאו',
  };
  return map[packageType] || packageType;
};

const getPodcastContentStatusLabel = (status: string): string => {
  const map: Record<string, string> = {
    pending_upload: 'בהמתנה להעלאה',
    drafts_uploaded: 'טיוטות הועלו',
    client_review: 'בבדיקת הלקוח',
    revisions: 'בתיקונים',
    approved: 'אושר',
    completed: 'הושלם',
  };
  return map[status] || status;
};

const getPodcastSessionStatusLabel = (status: string): string => {
  const map: Record<string, string> = {
    booked: 'מאושר',
    completed: 'הושלם',
    cancelled: 'בוטל',
    no_show: 'לא הופיע',
  };
  return map[status] || status;
};

const formatDate = (dateString: string | null): string => {
  if (!dateString) return 'לא קבוע';
  const date = new Date(dateString);
  return date.toLocaleDateString('he-IL', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export default function ClientPortalProjectsPage() {
  const searchParams = useSearchParams();
  const clientId = searchParams.get('clientId');

  const { data: projects } = useBusinessProjects();
  const { data: milestones } = useProjectMilestones();
  const { data: podcastSessions } = usePodcastSessions();

  // Filter projects by clientId
  const clientProjects = useMemo(() => {
    return projects.filter(p => p.clientId === clientId);
  }, [projects, clientId]);

  // Filter podcast sessions by clientId
  const clientPodcastSessions = useMemo(() => {
    return podcastSessions.filter(s => s.clientId === clientId);
  }, [podcastSessions, clientId]);

  // Get milestones for each project
  const getProjectMilestones = (projectId: string) => {
    return milestones.filter(m => m.projectId === projectId);
  };

  const getMilestoneProgress = (projectId: string) => {
    const projectMilestones = getProjectMilestones(projectId);
    if (projectMilestones.length === 0) return { completed: 0, total: 0 };

    const completed = projectMilestones.filter(
      m => m.status === 'approved'
    ).length;

    return {
      completed,
      total: projectMilestones.length,
    };
  };

  return (
    <div style={{ direction: 'rtl' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, margin: '0 0 0.5rem 0' }}>
          פרויקטים וסטטוס
        </h1>
        <p style={{ fontSize: '1rem', color: 'var(--foreground-muted)', margin: 0 }}>
          {clientProjects.length} פרויקטים בתהליך וביצוע
        </p>
      </div>

      {/* Business Projects Section */}
      {clientProjects.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: '0 0 1.5rem 0' }}>
            פרויקטים
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {clientProjects.map(project => {
              const progress = getMilestoneProgress(project.id);
              const statusColor = getStatusColor(project.projectStatus);

              return (
                <div
                  key={project.id}
                  style={{
                    backgroundColor: 'var(--surface)',
                    border: `1px solid var(--border)`,
                    borderRadius: '0.75rem',
                    padding: '1.5rem',
                    transition: 'all 250ms ease',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)';
                    (e.currentTarget as HTMLElement).style.backgroundColor =
                      'var(--surface-raised)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
                    (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--surface)';
                  }}
                >
                  {/* Header Row */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: '1rem',
                      gap: '1rem',
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 0.5rem 0' }}>
                        {project.projectName}
                      </h3>
                      <p
                        style={{
                          fontSize: '0.9rem',
                          color: 'var(--foreground-muted)',
                          margin: 0,
                        }}
                      >
                        {project.description}
                      </p>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        gap: '0.75rem',
                        flexWrap: 'wrap',
                        justifyContent: 'flex-end',
                      }}
                    >
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '0.375rem 0.875rem',
                          backgroundColor: `${getStatusColor(project.projectType)}20`,
                          color: getStatusColor(project.projectType),
                          borderRadius: '0.375rem',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                        }}
                      >
                        {getProjectTypeLabel(project.projectType)}
                      </span>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '0.375rem 0.875rem',
                          backgroundColor: `${statusColor}20`,
                          color: statusColor,
                          borderRadius: '0.375rem',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                        }}
                      >
                        {getStatusLabel(project.projectStatus)}
                      </span>
                    </div>
                  </div>

                  {/* Meta Info */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                      gap: '1rem',
                      marginBottom: '1.5rem',
                      paddingBottom: '1.5rem',
                      borderBottom: `1px solid var(--border)`,
                    }}
                  >
                    <div>
                      <p
                        style={{
                          fontSize: '0.75rem',
                          color: 'var(--foreground-muted)',
                          margin: '0 0 0.5rem 0',
                        }}
                      >
                        תאריך התחלה
                      </p>
                      <p style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0 }}>
                        {formatDate(project.startDate)}
                      </p>
                    </div>
                    <div>
                      <p
                        style={{
                          fontSize: '0.75rem',
                          color: 'var(--foreground-muted)',
                          margin: '0 0 0.5rem 0',
                        }}
                      >
                        תאריך סיום צפוי
                      </p>
                      <p style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0 }}>
                        {formatDate(project.endDate)}
                      </p>
                    </div>
                    <div>
                      <p
                        style={{
                          fontSize: '0.75rem',
                          color: 'var(--foreground-muted)',
                          margin: '0 0 0.5rem 0',
                        }}
                      >
                        הסכם חתום
                      </p>
                      <p style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0 }}>
                        {project.agreementSigned ? '✓ כן' : 'בהמתנה'}
                      </p>
                    </div>
                  </div>

                  {/* Milestones Progress */}
                  <div>
                    <p
                      style={{
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        margin: '0 0 0.75rem 0',
                        color: 'var(--foreground)',
                      }}
                    >
                      שלבים: {progress.completed} מתוך {progress.total} הושלמו
                    </p>
                    <div
                      style={{
                        width: '100%',
                        height: '0.5rem',
                        backgroundColor: 'var(--border)',
                        borderRadius: '0.25rem',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${progress.total > 0 ? (progress.completed / progress.total) * 100 : 0}%`,
                          backgroundColor: 'var(--accent)',
                          transition: 'width 300ms ease',
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Podcast Sessions Section */}
      {clientPodcastSessions.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: '0 0 1.5rem 0' }}>
            🎙️ פוקאסט
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {clientPodcastSessions.map(session => {
              const contentStatusColor = getStatusColor(session.contentStatus);
              const sessionStatusColor = getStatusColor(session.sessionStatus);

              return (
                <div
                  key={session.id}
                  style={{
                    backgroundColor: 'var(--surface)',
                    border: `1px solid var(--border)`,
                    borderRadius: '0.75rem',
                    padding: '1.5rem',
                    transition: 'all 250ms ease',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)';
                    (e.currentTarget as HTMLElement).style.backgroundColor =
                      'var(--surface-raised)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
                    (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--surface)';
                  }}
                >
                  {/* Header Row */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: '1rem',
                      gap: '1rem',
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 0.5rem 0' }}>
                        הקלטת פוקאסט
                      </h3>
                      <p
                        style={{
                          fontSize: '0.9rem',
                          color: 'var(--foreground-muted)',
                          margin: 0,
                        }}
                      >
                        {formatDate(session.sessionDate)}
                      </p>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        gap: '0.75rem',
                        flexWrap: 'wrap',
                        justifyContent: 'flex-end',
                      }}
                    >
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '0.375rem 0.875rem',
                          backgroundColor: `${getStatusColor('campaign')}20`,
                          color: getStatusColor('campaign'),
                          borderRadius: '0.375rem',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                        }}
                      >
                        {getPodcastPackageLabel(session.packageType)}
                      </span>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '0.375rem 0.875rem',
                          backgroundColor: `${contentStatusColor}20`,
                          color: contentStatusColor,
                          borderRadius: '0.375rem',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                        }}
                      >
                        {getPodcastContentStatusLabel(session.contentStatus)}
                      </span>
                    </div>
                  </div>

                  {/* Meta Info */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                      gap: '1rem',
                      marginBottom: '1.5rem',
                      paddingBottom: '1.5rem',
                      borderBottom: `1px solid var(--border)`,
                    }}
                  >
                    <div>
                      <p
                        style={{
                          fontSize: '0.75rem',
                          color: 'var(--foreground-muted)',
                          margin: '0 0 0.5rem 0',
                        }}
                      >
                        שעה
                      </p>
                      <p style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0 }}>
                        {session.startTime} - {session.endTime}
                      </p>
                    </div>
                    <div>
                      <p
                        style={{
                          fontSize: '0.75rem',
                          color: 'var(--foreground-muted)',
                          margin: '0 0 0.5rem 0',
                        }}
                      >
                        סטטוס הקלטה
                      </p>
                      <p
                        style={{
                          fontSize: '0.95rem',
                          fontWeight: 600,
                          margin: 0,
                          color: sessionStatusColor,
                        }}
                      >
                        {getPodcastSessionStatusLabel(session.sessionStatus)}
                      </p>
                    </div>
                    <div>
                      <p
                        style={{
                          fontSize: '0.75rem',
                          color: 'var(--foreground-muted)',
                          margin: '0 0 0.5rem 0',
                        }}
                      >
                        וידאו {session.videosCount}/{parseInt(session.packageType.split('_')[1] || '1')}
                      </p>
                      <p style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0 }}>
                        {session.finalUrls.length} מחוברים
                      </p>
                    </div>
                  </div>

                  {/* Content Progress */}
                  {session.finalUrls.length > 0 && (
                    <div>
                      <p
                        style={{
                          fontSize: '0.875rem',
                          fontWeight: 600,
                          margin: '0 0 0.75rem 0',
                          color: 'var(--foreground)',
                        }}
                      >
                        וידאו סופיים: {session.finalUrls.length}
                      </p>
                      <div
                        style={{
                          display: 'flex',
                          gap: '0.5rem',
                          flexWrap: 'wrap',
                        }}
                      >
                        {session.finalUrls.map((url, idx) => (
                          <a
                            key={idx}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              padding: '0.5rem 0.875rem',
                              backgroundColor: 'var(--accent-muted)',
                              color: 'var(--accent)',
                              borderRadius: '0.375rem',
                              fontSize: '0.85rem',
                              fontWeight: 600,
                              textDecoration: 'none',
                              transition: 'all 250ms ease',
                            }}
                            onMouseEnter={e => {
                              (e.currentTarget as HTMLElement).style.backgroundColor =
                                'var(--accent)';
                              (e.currentTarget as HTMLElement).style.color = '#000';
                            }}
                            onMouseLeave={e => {
                              (e.currentTarget as HTMLElement).style.backgroundColor =
                                'var(--accent-muted)';
                              (e.currentTarget as HTMLElement).style.color = 'var(--accent)';
                            }}
                          >
                            <span>🎬</span>
                            <span>וידאו {idx + 1}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty State */}
      {clientProjects.length === 0 && clientPodcastSessions.length === 0 && (
        <div
          style={{
            backgroundColor: 'var(--surface)',
            border: `1px solid var(--border)`,
            borderRadius: '0.75rem',
            padding: '3rem 1.5rem',
            textAlign: 'center',
          }}
        >
          <p
            style={{
              fontSize: '1.1rem',
              fontWeight: 600,
              color: 'var(--foreground)',
              margin: '0 0 0.5rem 0',
            }}
          >
            אין פרויקטים כרגע
          </p>
          <p style={{ color: 'var(--foreground-muted)', fontSize: '1rem', margin: 0 }}>
            כאשר יהיו פרויקטים חדשים, יופיעו כאן
          </p>
        </div>
      )}
    </div>
  );
}
