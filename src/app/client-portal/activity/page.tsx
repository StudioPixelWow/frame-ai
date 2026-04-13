'use client';

import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useActivities } from '@/lib/api/use-entity';

const getActivityIcon = (type: string): string => {
  const iconMap: Record<string, string> = {
    client: '👤',
    project: '📋',
    payment: '💳',
    render: '🎬',
    ai: '🤖',
    task: '✓',
    lead: '🔗',
  };
  return iconMap[type] || '📌';
};

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();

  // Check if today
  if (
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()
  ) {
    return date.toLocaleTimeString('he-IL', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  // Check if yesterday
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear()
  ) {
    return 'אתמול';
  }

  // Otherwise show full date
  return date.toLocaleDateString('he-IL', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const getActivityTypeBadgeColor = (type: string): string => {
  const colorMap: Record<string, string> = {
    client: '#3b82f6',
    project: '#8b5cf6',
    payment: '#f59e0b',
    render: '#ec4899',
    ai: '#06b6d4',
    task: '#22c55e',
    lead: '#f97316',
  };
  return colorMap[type] || '#a1a1aa';
};

export default function ClientPortalActivityPage() {
  const searchParams = useSearchParams();
  const clientId = searchParams.get('clientId');

  const { data: activities } = useActivities();

  // Filter activities by type and entityId
  const filteredActivities = useMemo(() => {
    return activities
      .filter(a => {
        // Only show specific types
        if (!['client', 'project', 'payment', 'render'].includes(a.type)) {
          return false;
        }

        // Filter by entityId matching clientId where applicable
        // For client activities, entityId should match clientId
        if (a.type === 'client' && a.entityId !== clientId) {
          return false;
        }

        // For other activities, we can be more lenient (they might reference the client indirectly)
        // or we could filter strictly. For now, we'll include them if they exist
        return true;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [activities, clientId]);

  return (
    <div style={{ direction: 'rtl' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, margin: '0 0 0.5rem 0' }}>
          היסטוריית פעילות
        </h1>
        <p style={{ fontSize: '1rem', color: 'var(--foreground-muted)', margin: 0 }}>
          {filteredActivities.length} פעילויות אחרונות
        </p>
      </div>

      {/* Activity Timeline */}
      {filteredActivities.length > 0 ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0rem',
            position: 'relative',
            paddingRight: '2rem',
          }}
        >
          {/* Timeline line */}
          <div
            style={{
              position: 'absolute',
              right: '1.25rem',
              top: '2rem',
              bottom: '0rem',
              width: '2px',
              backgroundColor: 'var(--border)',
            }}
          />

          {filteredActivities.map((activity, index) => {
            const iconForType = getActivityIcon(activity.type);
            const badgeColor = getActivityTypeBadgeColor(activity.type);

            return (
              <div
                key={activity.id}
                style={{
                  display: 'flex',
                  gap: '1.5rem',
                  alignItems: 'flex-start',
                  marginBottom: '2rem',
                  position: 'relative',
                }}
              >
                {/* Timeline Dot */}
                <div
                  style={{
                    position: 'absolute',
                    right: '-1.625rem',
                    top: '0.5rem',
                    width: '1.5rem',
                    height: '1.5rem',
                    borderRadius: '50%',
                    backgroundColor: badgeColor,
                    border: `3px solid var(--background)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    zIndex: 1,
                    flexShrink: 0,
                  }}
                >
                  {activity.icon || iconForType}
                </div>

                {/* Content Card */}
                <div
                  style={{
                    flex: 1,
                    backgroundColor: 'var(--surface)',
                    border: `1px solid var(--border)`,
                    borderRadius: '0.75rem',
                    padding: '1.25rem',
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
                  {/* Header with Type Badge */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: '1rem',
                      marginBottom: '0.75rem',
                    }}
                  >
                    <h3
                      style={{
                        fontSize: '1rem',
                        fontWeight: 700,
                        margin: 0,
                        color: 'var(--foreground)',
                        flex: 1,
                      }}
                    >
                      {activity.title}
                    </h3>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '0.375rem 0.875rem',
                        backgroundColor: `${badgeColor}20`,
                        color: badgeColor,
                        borderRadius: '0.375rem',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                      }}
                    >
                      {activity.type === 'client'
                        ? 'לקוח'
                        : activity.type === 'project'
                        ? 'פרויקט'
                        : activity.type === 'payment'
                        ? 'תשלום'
                        : activity.type === 'render'
                        ? 'רינדור'
                        : activity.type}
                    </span>
                  </div>

                  {/* Description */}
                  <p
                    style={{
                      fontSize: '0.95rem',
                      color: 'var(--foreground)',
                      margin: '0 0 0.75rem 0',
                      lineHeight: 1.5,
                    }}
                  >
                    {activity.description}
                  </p>

                  {/* Date */}
                  <p
                    style={{
                      fontSize: '0.85rem',
                      color: 'var(--foreground-muted)',
                      margin: 0,
                    }}
                  >
                    {formatDate(activity.createdAt)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
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
            אין פעילות אחרונה
          </p>
          <p style={{ color: 'var(--foreground-muted)', fontSize: '1rem', margin: 0 }}>
            כאשר תהיה פעילות, היא תופיע כאן
          </p>
        </div>
      )}
    </div>
  );
}
