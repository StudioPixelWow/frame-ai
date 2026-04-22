'use client';
export const dynamic = "force-dynamic";

import React, { useMemo, useState } from 'react';
import { useSystemEvents } from '@/lib/api/use-entity';

// Mock data generator
const generateMockEvents = () => {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 86400000);

  return [
    {
      id: '1',
      automationName: 'שליחת מייל ליד חדש',
      automationId: 'auto_1',
      actionType: 'email',
      actionDesc: 'שלח מייל ל-david@company.com',
      result: 'success' as const,
      entityType: 'lead',
      entityName: 'דוד כהן',
      details: 'מייל נשלח בהצלחה',
      createdAt: new Date(now.getTime() - 300000).toISOString(),
    },
    {
      id: '2',
      automationName: 'יצירת משימה אוטומטית',
      automationId: 'auto_2',
      actionType: 'task',
      actionDesc: 'יצור משימה "עקוב אחרי חברת ABC"',
      result: 'success' as const,
      entityType: 'company',
      entityName: 'חברת ABC',
      details: 'משימה נוצרה בהצלחה',
      createdAt: new Date(now.getTime() - 900000).toISOString(),
    },
    {
      id: '3',
      automationName: 'שליחת הודעת WhatsApp',
      automationId: 'auto_3',
      actionType: 'whatsapp',
      actionDesc: 'שלח הודעה ל-+972-50-123-4567',
      result: 'failed' as const,
      entityType: 'contact',
      entityName: 'נועם בוברין',
      details: 'שליחה נכשלה',
      errorMessage: 'המספר לא זמין',
      createdAt: new Date(now.getTime() - 1800000).toISOString(),
    },
    {
      id: '4',
      automationName: 'עדכון נתונים בממשק',
      automationId: 'auto_4',
      actionType: 'update',
      actionDesc: 'עדכן שדה "מצב" ל"בטיפול"',
      result: 'success' as const,
      entityType: 'lead',
      entityName: 'שרה לוי',
      details: 'הנתונים עודכנו בהצלחה',
      createdAt: new Date(now.getTime() - 3600000).toISOString(),
    },
    {
      id: '5',
      automationName: 'הוצאת התראה מערכתית',
      automationId: 'auto_5',
      actionType: 'notification',
      actionDesc: 'הוצא התראה לנציגות המכירות',
      result: 'success' as const,
      entityType: 'team',
      entityName: 'נציגות המכירות',
      details: 'התראה נשלחה ל-8 משתמשים',
      createdAt: new Date(now.getTime() - 5400000).toISOString(),
    },
    {
      id: '6',
      automationName: 'שיוך ליד לנציג',
      automationId: 'auto_6',
      actionType: 'assign',
      actionDesc: 'שייך ליד לנועם בוברין',
      result: 'waiting' as const,
      entityType: 'lead',
      entityName: 'מיכאל כהן',
      details: 'ממתין לאישור מנהל',
      createdAt: new Date(now.getTime() - 7200000).toISOString(),
    },
    {
      id: '7',
      automationName: 'המלצה של AI',
      automationId: 'auto_7',
      actionType: 'ai',
      actionDesc: 'המלצת AI להשגת יעדים',
      result: 'ai_recommendation' as const,
      entityType: 'lead',
      entityName: 'דני רוזנברג',
      details: 'AI מחסנת מחנה על הליד הזה',
      aiSuggestion: 'בהתאם לדפוסי התנהגות, מומלץ לשלוח הודעה עם אפשרויות תמחור בעוד 2 שעות',
      createdAt: new Date(now.getTime() - 10800000).toISOString(),
    },
    {
      id: '8',
      automationName: 'סיווג לידים אוטומטי',
      automationId: 'auto_8',
      actionType: 'classify',
      actionDesc: 'סווג ליד ככללי עם ערך גבוה',
      result: 'success' as const,
      entityType: 'lead',
      entityName: 'רונית שנידר',
      details: 'הליד סווג בהצלחה',
      createdAt: new Date(now.getTime() - 14400000).toISOString(),
    },
    {
      id: '9',
      automationName: 'שליחת מייל ליד חדש',
      automationId: 'auto_1',
      actionType: 'email',
      actionDesc: 'שלח מייל ל-yossi@techstartup.com',
      result: 'success' as const,
      entityType: 'lead',
      entityName: 'יוסי אברהם',
      details: 'מייל נשלח בהצלחה',
      createdAt: new Date(yesterday.getTime() - 3600000).toISOString(),
    },
    {
      id: '10',
      automationName: 'יצירת משימת בדיקה',
      automationId: 'auto_2',
      actionType: 'task',
      actionDesc: 'יצור משימה "בדוק תוכן הצעה"',
      result: 'success' as const,
      entityType: 'company',
      entityName: 'סטארטפ טק בע"מ',
      details: 'משימה נוצרה בהצלחה',
      createdAt: new Date(yesterday.getTime() - 7200000).toISOString(),
    },
    {
      id: '11',
      automationName: 'המלצה של AI',
      automationId: 'auto_9',
      actionType: 'ai',
      actionDesc: 'המלצת AI לעיתוד פעולה',
      result: 'ai_recommendation' as const,
      entityType: 'deal',
      entityName: 'עסקה: עידכון חברה X',
      details: 'AI מחסנת על קידום העסקה',
      aiSuggestion: 'על בסיס ניתוח, מומלץ לשלוח הצעה מתוא בעוד 3 ימים',
      createdAt: new Date(yesterday.getTime() - 10800000).toISOString(),
    },
    {
      id: '12',
      automationName: 'הודעת עדכון ישיר',
      automationId: 'auto_10',
      actionType: 'notification',
      actionDesc: 'הוצא הודעה ישירה למשתמש',
      result: 'success' as const,
      entityType: 'user',
      entityName: 'מנהל המערכת',
      details: 'ההודעה נעלמה בהצלחה',
      createdAt: new Date(yesterday.getTime() - 14400000).toISOString(),
    },
  ];
};

type TimelineEvent = ReturnType<typeof generateMockEvents>[0];

function ActivityPage() {
  const { data: events = [] } = useSystemEvents();
  const mockEvents = generateMockEvents();
  const timelineEvents = (events && events.length > 0 ? events : mockEvents) as TimelineEvent[];

  const [resultFilter, setResultFilter] = useState<'all' | 'success' | 'failed' | 'waiting'>('all');
  const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month' | 'all'>('all');

  // Filter logic
  const filteredEvents = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now.getTime() - 7 * 86400000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    return timelineEvents.filter(event => {
      const eventDate = new Date(event.createdAt);

      // Result filter
      if (resultFilter !== 'all' && event.result !== resultFilter) return false;

      // Date filter
      if (dateFilter === 'today' && eventDate < todayStart) return false;
      if (dateFilter === 'week' && eventDate < weekStart) return false;
      if (dateFilter === 'month' && eventDate < monthStart) return false;

      return true;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [resultFilter, dateFilter, timelineEvents]);

  // Group by date
  const groupedEvents = useMemo(() => {
    const groups: { [key: string]: TimelineEvent[] } = {};
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart.getTime() - 86400000);

    filteredEvents.forEach(event => {
      const eventDate = new Date(event.createdAt);
      let groupKey: string;

      if (eventDate >= todayStart) {
        groupKey = 'היום';
      } else if (eventDate >= yesterdayStart) {
        groupKey = 'אתמול';
      } else {
        groupKey = eventDate.toLocaleDateString('he-IL');
      }

      if (!groups[groupKey]) groups[groupKey] = [];
      groups[groupKey].push(event);
    });

    return groups;
  }, [filteredEvents]);

  const stats = useMemo(() => {
    const success = timelineEvents.filter(e => e.result === 'success').length;
    const failed = timelineEvents.filter(e => e.result === 'failed').length;
    const waiting = timelineEvents.filter(e => e.result === 'waiting').length;
    return { success, failed, waiting };
  }, [timelineEvents]);

  const getResultBadgeColor = (result: string) => {
    switch (result) {
      case 'success': return 'var(--accent)';
      case 'failed': return 'rgb(239, 68, 68)';
      case 'waiting': return 'rgb(217, 119, 6)';
      case 'ai_recommendation': return 'rgb(59, 130, 246)';
      default: return 'var(--foreground-muted)';
    }
  };

  const getResultLabel = (result: string) => {
    switch (result) {
      case 'success': return 'הצליח';
      case 'failed': return 'נכשל';
      case 'waiting': return 'ממתין';
      case 'ai_recommendation': return 'המלצה';
      default: return 'לא ידוע';
    }
  };

  const getTimeString = (createdAt: string) => {
    const eventDate = new Date(createdAt);
    const now = new Date();
    const diffMs = now.getTime() - eventDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 1) return 'עכשיו';
    if (diffMins < 60) return `לפני ${diffMins} דקות`;
    if (diffHours < 24) return `היום ${eventDate.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`;
    return eventDate.toLocaleDateString('he-IL');
  };

  const groupOrder = ['היום', 'אתמול'];

  return (
    <div style={{ direction: 'rtl', padding: '32px 24px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '700', color: 'var(--foreground)', margin: '0 0 8px 0' }}>
          פעילות אוטומציות
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--foreground-muted)', margin: 0 }}>
          מעקב בזמן אמת אחר פעולות אוטומטיות
        </p>
      </div>

      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        <div className="premium-card" style={{ padding: '20px', borderRight: '3px solid var(--accent)' }}>
          <div style={{ fontSize: '12px', color: 'var(--foreground-muted)', marginBottom: '8px' }}>הצלחות</div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: 'var(--accent)' }}>{stats.success}</div>
        </div>
        <div className="premium-card" style={{ padding: '20px', borderRight: '3px solid rgb(239, 68, 68)' }}>
          <div style={{ fontSize: '12px', color: 'var(--foreground-muted)', marginBottom: '8px' }}>נכשלו</div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: 'rgb(239, 68, 68)' }}>{stats.failed}</div>
        </div>
        <div className="premium-card" style={{ padding: '20px', borderRight: '3px solid rgb(217, 119, 6)' }}>
          <div style={{ fontSize: '12px', color: 'var(--foreground-muted)', marginBottom: '8px' }}>ממתין לאישור</div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: 'rgb(217, 119, 6)' }}>{stats.waiting}</div>
        </div>
      </div>

      {/* Filter Bar */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '32px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '12px', color: 'var(--foreground-muted)', marginBottom: '8px' }}>תוצאה</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {(['all', 'success', 'failed', 'waiting'] as const).map(filter => (
              <button
                key={filter}
                onClick={() => setResultFilter(filter)}
                style={{
                  padding: '6px 12px',
                  border: `1px solid ${resultFilter === filter ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: '6px',
                  background: resultFilter === filter ? 'var(--accent)' : 'var(--surface)',
                  color: resultFilter === filter ? '#fff' : 'var(--foreground)',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: '500',
                }}
              >
                {filter === 'all' ? 'הכל' : filter === 'success' ? 'הצלחה' : filter === 'failed' ? 'נכשל' : 'ממתין'}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontSize: '12px', color: 'var(--foreground-muted)', marginBottom: '8px' }}>תאריך</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {(['today', 'week', 'month', 'all'] as const).map(filter => (
              <button
                key={filter}
                onClick={() => setDateFilter(filter)}
                style={{
                  padding: '6px 12px',
                  border: `1px solid ${dateFilter === filter ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: '6px',
                  background: dateFilter === filter ? 'var(--accent)' : 'var(--surface)',
                  color: dateFilter === filter ? '#fff' : 'var(--foreground)',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: '500',
                }}
              >
                {filter === 'today' ? 'היום' : filter === 'week' ? 'השבוע' : filter === 'month' ? 'החודש' : 'הכל'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Timeline */}
      {filteredEvents.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--foreground-muted)' }}>
          <div style={{ fontSize: '16px', marginBottom: '8px' }}>אין פעילות אוטומציה</div>
          <div style={{ fontSize: '12px' }}>בחר מסננים שונים כדי לראות פעילות</div>
        </div>
      ) : (
        <div className="auto-timeline">
          {Object.entries(groupedEvents).sort((a, b) => {
            const aIndex = groupOrder.indexOf(a[0]);
            const bIndex = groupOrder.indexOf(b[0]);
            if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
            if (aIndex !== -1) return -1;
            if (bIndex !== -1) return 1;
            return 0;
          }).map(([dateGroup, events]) => (
            <div key={dateGroup}>
              <div style={{ padding: '16px 0', borderTop: '1px solid var(--border)', marginTop: '16px' }}>
                <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--foreground-muted)', textTransform: 'uppercase' }}>
                  {dateGroup}
                </div>
              </div>
              {events.map((event, idx) => (
                <div key={event.id} className="auto-timeline-item ux-stagger">
                  <div className="auto-timeline-dot" style={{ background: getResultBadgeColor(event.result) }} />
                  {idx < events.length - 1 && <div className="auto-timeline-line" />}

                  <div style={{ marginRight: '20px', flex: 1 }}>
                    <div className="premium-card" style={{ padding: '16px', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
                        <div>
                          <div style={{ fontSize: '12px', color: 'var(--foreground-muted)' }}>
                            {getTimeString(event.createdAt)}
                          </div>
                          <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--foreground)', marginTop: '4px' }}>
                            {event.automationName}
                          </div>
                        </div>
                        <div
                          style={{
                            padding: '4px 10px',
                            borderRadius: '4px',
                            background: `${getResultBadgeColor(event.result)}20`,
                            color: getResultBadgeColor(event.result),
                            fontSize: '11px',
                            fontWeight: '600',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {getResultLabel(event.result)}
                        </div>
                      </div>

                      <div style={{ fontSize: '13px', color: 'var(--foreground)', lineHeight: '1.4', marginBottom: '8px' }}>
                        {event.actionDesc}
                      </div>

                      <div style={{ fontSize: '12px', color: 'var(--foreground-muted)' }}>
                        {event.entityType === 'lead' && `ליד: ${event.entityName}`}
                        {event.entityType === 'company' && `חברה: ${event.entityName}`}
                        {event.entityType === 'contact' && `איש קשר: ${event.entityName}`}
                        {event.entityType === 'team' && `צוות: ${event.entityName}`}
                        {event.entityType === 'user' && `משתמש: ${event.entityName}`}
                        {event.entityType === 'deal' && `עסקה: ${event.entityName}`}
                      </div>

                      {event.errorMessage && (
                        <div style={{ marginTop: '10px', padding: '8px 10px', borderRadius: '4px', background: 'rgb(254, 226, 226)', color: 'rgb(220, 38, 38)', fontSize: '12px' }}>
                          ⚠️ {event.errorMessage}
                        </div>
                      )}
                    </div>

                    {event.aiSuggestion && (
                      <div style={{ marginRight: '0px', padding: '12px', borderRight: '3px solid rgb(59, 130, 246)', background: 'rgb(239, 245, 255)', borderRadius: '4px', fontSize: '12px', color: 'var(--foreground)', lineHeight: '1.5' }}>
                        💡 {event.aiSuggestion}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ActivityPage;
