'use client';

import Link from 'next/link';

interface Props {
  clientId: string;
  clientName: string;
}

export function TabAutomations({ clientId, clientName }: Props) {
  const automations = [
    {
      id: 1,
      name: 'מעקב אחרי ליד חדש',
      trigger: 'ליד נוצר',
      action: 'שלח מייל מעקב',
      status: 'פעיל',
      lastRun: 'לפני 3 שעות',
    },
    {
      id: 2,
      name: `הזמנה לפגישה - ${clientName}`,
      trigger: 'הלקוח ביטל פגישה',
      action: 'שלח הודעה ב-SMS',
      status: 'פעיל',
      lastRun: 'לפני 5 שעות',
    },
    {
      id: 3,
      name: `קבלת תשלום - ${clientName}`,
      trigger: 'התשלום בביצוע',
      action: 'שלח אישור וחשבונית',
      status: 'לא פעיל',
      lastRun: 'לפני יום',
    },
    {
      id: 4,
      name: 'התראה על תוכן חדש',
      trigger: 'תוכן בוצע',
      action: 'שלח הודעה לטל זטלמן',
      status: 'פעיל',
      lastRun: 'לפני 2 שעות',
    },
  ];

  const recentActivities = [
    {
      id: 1,
      action: `שלח מייל מעקב ללקוח ${clientName}`,
      timestamp: 'לפני 2 שעות',
      status: 'הצלחה',
    },
    {
      id: 2,
      action: 'אוטומציה: קבלת תשלום הופעלה',
      timestamp: 'לפני 4 שעות',
      status: 'הצלחה',
    },
    {
      id: 3,
      action: `עדכון נתונים ללקוח ${clientName}`,
      timestamp: 'לפני 6 שעות',
      status: 'הצלחה',
    },
    {
      id: 4,
      action: 'אוטומציה: התראת תשלום להוגשה',
      timestamp: 'לפני יום',
      status: 'כשל',
    },
    {
      id: 5,
      action: `עדכון סטטוס עבור ${clientName}`,
      timestamp: 'לפני יומיים',
      status: 'הצלחה',
    },
  ];

  const suggestions = [
    {
      id: 1,
      title: `ללקוח ${clientName} כדאי ליצור אוטומציית מעקב לידים`,
      description: 'מעקב אוטומטי אחרי לידים חדשים עם הנעה מותאמת',
      icon: '🎯',
    },
    {
      id: 2,
      title: 'יש קמפיינים פעילים ללא התראה על ירידה בביצועים',
      description: 'הגדר התראות אוטומטיות כאשר ביצועים צונחים מתחת לסף',
      icon: '📉',
    },
    {
      id: 3,
      title: 'לא הוגדרה התראה על תשלום באיחור',
      description: `שלח התראות אוטומטיות ל-${clientName} בעת איחור בתשלום`,
      icon: '⏰',
    },
  ];

  const templates = [
    {
      id: 1,
      name: 'מעקב ליד חדש',
      description: 'שלח מייל מעקב בעת יצירת ליד חדש',
    },
    {
      id: 2,
      name: 'התראת תשלום באיחור',
      description: 'שלח הזכרון כאשר תשלום באיחור',
    },
  ];

  const statusColors: Record<string, string> = {
    'הצלחה': '#22c55e',
    'כשל': '#ef4444',
    'התראה': '#f59e0b',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Active Automations Section */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--foreground)', margin: 0 }}>
          אוטומציות פעילות
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
          {automations.map((auto) => (
            <div
              key={auto.id}
              className="auto-card"
              style={{
                background: 'var(--surface-raised)',
                border: '1px solid var(--border)',
                borderRadius: '0.75rem',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                transition: 'all 150ms',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--foreground)', margin: 0 }}>
                  {auto.name}
                </h3>
                <span
                  className={`auto-badge-${auto.status === 'פעיל' ? 'active' : 'inactive'}`}
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    padding: '0.35rem 0.6rem',
                    borderRadius: '0.375rem',
                    background: auto.status === 'פעיל' ? '#22c55e20' : '#9ca3af20',
                    color: auto.status === 'פעיל' ? '#22c55e' : '#9ca3af',
                    border: auto.status === 'פעיל' ? '1px solid #22c55e30' : '1px solid #9ca3af30',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {auto.status}
                </span>
              </div>

              <div style={{ fontSize: '0.85rem', color: 'var(--foreground-muted)', margin: '0.25rem 0' }}>
                <span style={{ display: 'inline-block' }}>📤 {auto.trigger}</span>
                <span style={{ display: 'block', margin: '0.25rem 0' }}>→</span>
                <span style={{ display: 'inline-block' }}>📥 {auto.action}</span>
              </div>

              <div style={{ fontSize: '0.8rem', color: 'var(--foreground-muted)', marginTop: '0.5rem' }}>
                הריצה האחרונה: {auto.lastRun}
              </div>
            </div>
          ))}
        </div>

        <Link
          href="/automations/new"
          style={{
            alignSelf: 'flex-start',
            fontSize: '0.9rem',
            color: 'var(--accent)',
            textDecoration: 'none',
            fontWeight: 500,
            padding: '0.5rem 0.75rem',
            marginTop: '0.5rem',
            transition: 'color 150ms',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--accent)')}
        >
          + צור אוטומציה ללקוח
        </Link>
      </section>

      {/* Recent Activity Timeline */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--foreground)', margin: 0 }}>
          פעילות אחרונה
        </h2>
        <div className="auto-timeline" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {recentActivities.map((activity, idx) => (
            <div
              key={activity.id}
              style={{
                display: 'flex',
                gap: '1rem',
                padding: '0.75rem',
                background: idx % 2 === 0 ? 'var(--surface-raised)' : 'transparent',
                borderRadius: '0.5rem',
                alignItems: 'flex-start',
              }}
            >
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: statusColors[activity.status] || '#9ca3af',
                  marginTop: '0.375rem',
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.9rem', color: 'var(--foreground)', marginBottom: '0.25rem' }}>
                  {activity.action}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--foreground-muted)' }}>
                  {activity.timestamp} — <span style={{ color: statusColors[activity.status] }}>
                    {activity.status}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* AI Suggestions */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--foreground)', margin: 0 }}>
          הצעות AI
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
          {suggestions.map((suggestion) => (
            <div
              key={suggestion.id}
              style={{
                background: 'var(--surface-raised)',
                border: '1px solid var(--border)',
                borderLeft: '3px solid var(--accent)',
                borderRadius: '0.75rem',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <span style={{ fontSize: '1.5rem' }}>{suggestion.icon}</span>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--foreground)', margin: 0 }}>
                  {suggestion.title}
                </h3>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--foreground-muted)', margin: '0.5rem 0 0 0' }}>
                {suggestion.description}
              </p>
              <Link
                href="/automations/new"
                style={{
                  alignSelf: 'flex-start',
                  fontSize: '0.85rem',
                  color: 'var(--accent)',
                  textDecoration: 'none',
                  fontWeight: 500,
                  padding: '0.4rem 0.6rem',
                  marginTop: '0.25rem',
                  transition: 'color 150ms',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--accent)')}
              >
                הגדר עכשיו →
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Suggested Templates */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--foreground)', margin: 0 }}>
          תבניות מוצעות
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
          {templates.map((template) => (
            <div
              key={template.id}
              className="auto-template-card"
              style={{
                background: 'var(--surface-raised)',
                border: '1px solid var(--border)',
                borderRadius: '0.75rem',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
              }}
            >
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--foreground)', margin: 0 }}>
                {template.name}
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--foreground-muted)', margin: '0.5rem 0 0 0' }}>
                {template.description}
              </p>
              <button
                style={{
                  alignSelf: 'flex-start',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  padding: '0.5rem 1rem',
                  borderRadius: '0.375rem',
                  border: '1px solid var(--accent)',
                  background: 'var(--accent)',
                  color: 'white',
                  cursor: 'pointer',
                  transition: 'all 150ms',
                  marginTop: '0.5rem',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--accent-hover)';
                  e.currentTarget.style.borderColor = 'var(--accent-hover)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--accent)';
                  e.currentTarget.style.borderColor = 'var(--accent)';
                }}
                onClick={() => {
                  window.location.href = `/automations/new?template=${template.name}`;
                }}
              >
                השתמש בתבנית
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
