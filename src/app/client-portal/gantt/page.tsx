'use client';

import { useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useClientGanttItems, usePortalComments } from '@/lib/api/use-entity';
import { useToast } from '@/components/ui/toast';

export default function ClientPortalGanttPage() {
  const searchParams = useSearchParams();
  const clientId = searchParams.get('clientId');

  const { data: ganttItems, update: updateGanttItem } = useClientGanttItems();
  const { create: createComment } = usePortalComments();
  const toast = useToast();

  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  // Filter gantt items for current client, month, and exclude drafts
  const filteredItems = useMemo(() => {
    return ganttItems.filter(
      item =>
        item.clientId === clientId &&
        item.month === currentMonth &&
        item.year === currentYear &&
        item.status !== 'draft'
    );
  }, [ganttItems, clientId, currentMonth, currentYear]);

  const handleMonthChange = (direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      if (currentMonth === 1) {
        setCurrentMonth(12);
        setCurrentYear(currentYear - 1);
      } else {
        setCurrentMonth(currentMonth - 1);
      }
    } else {
      if (currentMonth === 12) {
        setCurrentMonth(1);
        setCurrentYear(currentYear + 1);
      } else {
        setCurrentMonth(currentMonth + 1);
      }
    }
  };

  const handleApprove = async (itemId: string) => {
    try {
      await updateGanttItem(itemId, { status: 'approved' });
      await createComment({
        clientId: clientId || '',
        portalUserId: 'portal_user',
        entityType: 'gantt_item',
        entityId: itemId,
        action: 'approve',
        comment: 'אושר על ידי הלקוח',
        isInternal: false,
      });
      toast('הפריט אושר בהצלחה', 'success');
      setSelectedItemId(null);
    } catch (error) {
      toast('שגיאה באישור הפריט', 'error');
    }
  };

  const handleRequestChanges = async (itemId: string) => {
    if (!commentText.trim()) {
      toast('אנא הוסף הערה', 'error');
      return;
    }

    setIsSubmittingComment(true);
    try {
      await updateGanttItem(itemId, { status: 'returned_for_changes' });
      await createComment({
        clientId: clientId || '',
        portalUserId: 'portal_user',
        entityType: 'gantt_item',
        entityId: itemId,
        action: 'request_changes',
        comment: commentText,
        isInternal: false,
      });
      toast('הבקשה לשינויים נשלחה', 'success');
      setSelectedItemId(null);
      setCommentText('');
    } catch (error) {
      toast('שגיאה בשליחת הבקשה', 'error');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleAddComment = async (itemId: string) => {
    if (!commentText.trim()) {
      toast('אנא הוסף הערה', 'error');
      return;
    }

    setIsSubmittingComment(true);
    try {
      await createComment({
        clientId: clientId || '',
        portalUserId: 'portal_user',
        entityType: 'gantt_item',
        entityId: itemId,
        action: 'comment',
        comment: commentText,
        isInternal: false,
      });
      toast('ההערה נוספה בהצלחה', 'success');
      setSelectedItemId(null);
      setCommentText('');
    } catch (error) {
      toast('שגיאה בהוספת ההערה', 'error');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const monthNames = [
    'ינואר',
    'פברואר',
    'מרץ',
    'אפריל',
    'מאי',
    'יוני',
    'יולי',
    'אוגוסט',
    'ספטמבר',
    'אוקטובר',
    'נובמבר',
    'דצמבר',
  ];

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; color: string }> = {
      planned: { label: 'מתוכנן', color: '#f59e0b' },
      in_progress: { label: 'בתהליך', color: '#00B5FE' },
      submitted_for_approval: { label: 'ממתין לאישור', color: '#f59e0b' },
      returned_for_changes: { label: 'הוחזר לתיקון', color: '#ef4444' },
      approved: { label: 'אושר', color: '#22c55e' },
      scheduled: { label: 'מתוכנן', color: '#00B5FE' },
      published: { label: 'פורסם', color: '#22c55e' },
    };
    const s = statusMap[status] || { label: status, color: '#a1a1aa' };
    return s;
  };

  return (
    <div style={{ direction: 'rtl' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 700, margin: 0 }}>לוח התוכן</h1>

          {/* Month Navigation */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button
              onClick={() => handleMonthChange('prev')}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: 'var(--surface)',
                border: `1px solid var(--border)`,
                borderRadius: '0.5rem',
                color: 'var(--foreground)',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: 500,
              }}
              onMouseEnter={e => {
                (e.target as HTMLElement).style.backgroundColor = 'var(--surface-raised)';
              }}
              onMouseLeave={e => {
                (e.target as HTMLElement).style.backgroundColor = 'var(--surface)';
              }}
            >
              ← הקודם
            </button>
            <span style={{ fontSize: '1.1rem', fontWeight: 600, minWidth: '150px', textAlign: 'center' }}>
              {monthNames[currentMonth - 1]} {currentYear}
            </span>
            <button
              onClick={() => handleMonthChange('next')}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: 'var(--surface)',
                border: `1px solid var(--border)`,
                borderRadius: '0.5rem',
                color: 'var(--foreground)',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: 500,
              }}
              onMouseEnter={e => {
                (e.target as HTMLElement).style.backgroundColor = 'var(--surface-raised)';
              }}
              onMouseLeave={e => {
                (e.target as HTMLElement).style.backgroundColor = 'var(--surface)';
              }}
            >
              הבא →
            </button>
          </div>
        </div>
      </div>

      {/* Gantt Items Grid */}
      {filteredItems.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.25rem' }}>
          {filteredItems.map(item => {
            const statusInfo = getStatusBadge(item.status);
            const isSelected = selectedItemId === item.id;

            return (
              <div
                key={item.id}
                style={{
                  backgroundColor: 'var(--surface)',
                  border: `1px solid var(--border)`,
                  borderRadius: '0.75rem',
                  padding: '1.5rem',
                  transition: 'all 250ms ease',
                  overflow: 'hidden',
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
                {/* Date */}
                <div style={{ fontSize: '0.75rem', color: 'var(--foreground-muted)', marginBottom: '0.5rem' }}>
                  {new Date(item.date).toLocaleDateString('he-IL')}
                </div>

                {/* Title */}
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 0.75rem 0' }}>{item.title}</h3>

                {/* Idea Summary */}
                {item.ideaSummary && (
                  <p style={{ fontSize: '0.9rem', color: 'var(--foreground-muted)', margin: '0 0 0.75rem 0' }}>
                    {item.ideaSummary}
                  </p>
                )}

                {/* Graphic Text */}
                {item.graphicText && (
                  <div
                    style={{
                      backgroundColor: 'var(--background)',
                      border: `1px solid var(--border)`,
                      borderRadius: '0.5rem',
                      padding: '0.75rem',
                      margin: '0.75rem 0',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      color: 'var(--foreground)',
                    }}
                  >
                    {item.graphicText}
                  </div>
                )}

                {/* Badges */}
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                  {/* Platform Badge */}
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '0.25rem 0.75rem',
                      backgroundColor: 'var(--accent-muted)',
                      color: 'var(--accent)',
                      borderRadius: '0.25rem',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                    }}
                  >
                    {item.platform === 'all' ? 'כל הפלטפורמות' : item.platform}
                  </span>

                  {/* Format Badge */}
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '0.25rem 0.75rem',
                      backgroundColor: 'rgba(0, 227, 255, 0.1)',
                      color: 'var(--accent2)',
                      borderRadius: '0.25rem',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                    }}
                  >
                    {item.format}
                  </span>

                  {/* Status Badge */}
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '0.25rem 0.75rem',
                      backgroundColor: `${statusInfo.color}20`,
                      color: statusInfo.color,
                      borderRadius: '0.25rem',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                    }}
                  >
                    {statusInfo.label}
                  </span>
                </div>

                {/* Caption (if approved) */}
                {item.status !== 'planned' && item.caption && (
                  <div
                    style={{
                      backgroundColor: 'var(--background)',
                      borderRadius: '0.5rem',
                      padding: '0.75rem',
                      marginBottom: '1rem',
                      fontSize: '0.85rem',
                      borderRight: `3px solid var(--accent)`,
                      paddingRight: 'calc(0.75rem - 3px)',
                    }}
                  >
                    <p style={{ margin: '0 0 0.5rem 0', fontWeight: 600, color: 'var(--foreground-muted)' }}>
                      כיתוב:
                    </p>
                    <p style={{ margin: 0 }}>{item.caption}</p>
                  </div>
                )}

                {/* Action Buttons */}
                {!isSelected && (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={() => setSelectedItemId(item.id)}
                      style={{
                        flex: 1,
                        padding: '0.625rem 1rem',
                        backgroundColor: 'var(--accent)',
                        color: '#000',
                        border: 'none',
                        borderRadius: '0.5rem',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'background-color 250ms ease',
                      }}
                      onMouseEnter={e => {
                        (e.target as HTMLElement).style.backgroundColor = 'var(--accent-hover)';
                      }}
                      onMouseLeave={e => {
                        (e.target as HTMLElement).style.backgroundColor = 'var(--accent)';
                      }}
                    >
                      אפשרויות
                    </button>
                  </div>
                )}

                {/* Action Menu */}
                {isSelected && (
                  <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: `1px solid var(--border)` }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <button
                        onClick={() => handleApprove(item.id)}
                        style={{
                          padding: '0.625rem 1rem',
                          backgroundColor: '#22c55e',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '0.5rem',
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          width: '100%',
                        }}
                        onMouseEnter={e => {
                          (e.target as HTMLElement).style.opacity = '0.9';
                        }}
                        onMouseLeave={e => {
                          (e.target as HTMLElement).style.opacity = '1';
                        }}
                      >
                        ✓ אשר
                      </button>
                      <button
                        onClick={() => {
                          // Show comment input
                        }}
                        style={{
                          padding: '0.625rem 1rem',
                          backgroundColor: 'var(--surface)',
                          color: 'var(--foreground)',
                          border: `1px solid var(--border)`,
                          borderRadius: '0.5rem',
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          width: '100%',
                        }}
                        onMouseEnter={e => {
                          (e.target as HTMLElement).style.borderColor = 'var(--accent)';
                        }}
                        onMouseLeave={e => {
                          (e.target as HTMLElement).style.borderColor = 'var(--border)';
                        }}
                      >
                        💬 הוסף הערה
                      </button>

                      {/* Comment textarea */}
                      <textarea
                        value={commentText}
                        onChange={e => setCommentText(e.target.value)}
                        placeholder="הוסף הערה..."
                        style={{
                          padding: '0.75rem',
                          backgroundColor: 'var(--background)',
                          border: `1px solid var(--border)`,
                          borderRadius: '0.5rem',
                          color: 'var(--foreground)',
                          fontSize: '0.85rem',
                          fontFamily: 'inherit',
                          resize: 'vertical',
                          minHeight: '60px',
                        }}
                      />

                      {/* Submit Comment Button */}
                      <button
                        onClick={() => handleAddComment(item.id)}
                        disabled={isSubmittingComment}
                        style={{
                          padding: '0.625rem 1rem',
                          backgroundColor: 'var(--accent)',
                          color: '#000',
                          border: 'none',
                          borderRadius: '0.5rem',
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          cursor: isSubmittingComment ? 'not-allowed' : 'pointer',
                          opacity: isSubmittingComment ? 0.6 : 1,
                          width: '100%',
                        }}
                      >
                        שלח הערה
                      </button>

                      {/* Request Changes Button */}
                      <button
                        onClick={() => handleRequestChanges(item.id)}
                        disabled={isSubmittingComment}
                        style={{
                          padding: '0.625rem 1rem',
                          backgroundColor: '#ef4444',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '0.5rem',
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          cursor: isSubmittingComment ? 'not-allowed' : 'pointer',
                          opacity: isSubmittingComment ? 0.6 : 1,
                          width: '100%',
                        }}
                      >
                        בקש שינויים
                      </button>

                      <button
                        onClick={() => {
                          setSelectedItemId(null);
                          setCommentText('');
                        }}
                        style={{
                          padding: '0.625rem 1rem',
                          backgroundColor: 'transparent',
                          color: 'var(--foreground-muted)',
                          border: 'none',
                          borderRadius: '0.5rem',
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          width: '100%',
                        }}
                      >
                        ביטול
                      </button>
                    </div>
                  </div>
                )}
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
          <p style={{ color: 'var(--foreground-muted)', fontSize: '1rem', margin: 0 }}>
            אין פריטים לחודש זה
          </p>
        </div>
      )}
    </div>
  );
}
