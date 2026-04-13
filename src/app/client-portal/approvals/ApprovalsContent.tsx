'use client';

import { useState, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useApprovals, usePortalComments } from '@/lib/api/use-entity';
import { useToast } from '@/components/ui/toast';

function ApprovalsContentInner() {
  const searchParams = useSearchParams();
  const clientId = searchParams.get('clientId');

  const { data: approvals, update: updateApproval } = useApprovals();
  const { create: createComment } = usePortalComments();
  const toast = useToast();

  const [selectedApprovalId, setSelectedApprovalId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  // Filter approvals by status and client
  const pendingApprovals = useMemo(() => {
    return approvals.filter(a => a.status === 'pending_approval');
  }, [approvals]);

  const handleApprove = async (approvalId: string) => {
    try {
      await updateApproval(approvalId, { status: 'approved' });
      await createComment({
        clientId: clientId || '',
        portalUserId: 'portal_user',
        entityType: 'approval',
        entityId: approvalId,
        action: 'approve',
        comment: 'אושר על ידי הלקוח',
        isInternal: false,
      });
      toast('הפריט אושר בהצלחה', 'success');
      setSelectedApprovalId(null);
    } catch (error) {
      toast('שגיאה באישור הפריט', 'error');
    }
  };

  const handleRequestChanges = async (approvalId: string) => {
    if (!commentText.trim()) {
      toast('אנא הוסף הערה', 'error');
      return;
    }

    setIsSubmittingComment(true);
    try {
      await updateApproval(approvalId, { status: 'needs_changes' });
      await createComment({
        clientId: clientId || '',
        portalUserId: 'portal_user',
        entityType: 'approval',
        entityId: approvalId,
        action: 'request_changes',
        comment: commentText,
        isInternal: false,
      });
      toast('הבקשה לשינויים נשלחה', 'success');
      setSelectedApprovalId(null);
      setCommentText('');
    } catch (error) {
      toast('שגיאה בשליחת הבקשה', 'error');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleAddComment = async (approvalId: string) => {
    if (!commentText.trim()) {
      toast('אנא הוסף הערה', 'error');
      return;
    }

    setIsSubmittingComment(true);
    try {
      await createComment({
        clientId: clientId || '',
        portalUserId: 'portal_user',
        entityType: 'approval',
        entityId: approvalId,
        action: 'comment',
        comment: commentText,
        isInternal: false,
      });
      toast('ההערה נוספה בהצלחה', 'success');
      setSelectedApprovalId(null);
      setCommentText('');
    } catch (error) {
      toast('שגיאה בהוספת ההערה', 'error');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const getTypeIcon = (type: string) => {
    const iconMap: Record<string, string> = {
      video: '🎬',
      post: '📱',
      gantt: '📅',
      design: '🎨',
      milestone: '🎯',
    };
    return iconMap[type] || '📋';
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; color: string }> = {
      draft: { label: 'טיוטה', color: '#a1a1aa' },
      pending_approval: { label: 'ממתין לאישור', color: '#f59e0b' },
      approved: { label: 'אושר', color: '#22c55e' },
      rejected: { label: 'דחוי', color: '#ef4444' },
      needs_changes: { label: 'צריך שינויים', color: '#ef4444' },
    };
    const s = statusMap[status] || { label: status, color: '#a1a1aa' };
    return s;
  };

  return (
    <div style={{ direction: 'rtl' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, margin: '0 0 0.5rem 0' }}>מרכז אישורים</h1>
        <p style={{ fontSize: '1rem', color: 'var(--foreground-muted)', margin: 0 }}>
          {pendingApprovals.length} פריטים ממתינים לאישור
        </p>
      </div>

      {/* Approvals List */}
      {pendingApprovals.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {pendingApprovals.map(approval => {
            const isSelected = selectedApprovalId === approval.id;
            const statusInfo = getStatusBadge(approval.status);
            const typeIcon = getTypeIcon(approval.type);

            return (
              <div
                key={approval.id}
                style={{
                  backgroundColor: 'var(--surface)',
                  border: `1px solid var(--border)`,
                  borderRadius: '0.75rem',
                  padding: '1.5rem',
                  transition: 'all 250ms ease',
                }}
                onMouseEnter={e => {
                  if (!isSelected) {
                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)';
                    (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--surface-raised)';
                  }
                }}
                onMouseLeave={e => {
                  if (!isSelected) {
                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
                    (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--surface)';
                  }
                }}
              >
                {/* Header Row */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', marginBottom: '1rem' }}>
                  <div
                    style={{
                      fontSize: '2rem',
                      flexShrink: 0,
                      width: '3rem',
                      height: '3rem',
                      borderRadius: '0.5rem',
                      backgroundColor: 'var(--accent-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {typeIcon}
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                      <div>
                        <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 0.25rem 0' }}>
                          {approval.title}
                        </h3>
                        <p style={{ fontSize: '0.9rem', color: 'var(--foreground-muted)', margin: 0 }}>
                          {approval.clientName}
                        </p>
                      </div>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '0.375rem 1rem',
                          backgroundColor: `${statusInfo.color}20`,
                          color: statusInfo.color,
                          borderRadius: '0.5rem',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {statusInfo.label}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Meta Info */}
                <div style={{ display: 'flex', gap: '2rem', marginBottom: '1rem', paddingBottom: '1rem', borderBottom: `1px solid var(--border)` }}>
                  <div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--foreground-muted)', margin: '0 0 0.25rem 0' }}>
                      סוג
                    </p>
                    <p style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0 }}>
                      {approval.type === 'video'
                        ? 'וידאו'
                        : approval.type === 'post'
                        ? 'פוסט'
                        : approval.type === 'gantt'
                        ? 'לוח תוכן'
                        : approval.type === 'design'
                        ? 'עיצוב'
                        : 'יעד'}
                    </p>
                  </div>
                  <div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--foreground-muted)', margin: '0 0 0.25rem 0' }}>
                      תאריך בקשה
                    </p>
                    <p style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0 }}>
                      {new Date(approval.createdAt).toLocaleDateString('he-IL')}
                    </p>
                  </div>
                </div>

                {/* Action Buttons */}
                {!isSelected && (
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button
                      onClick={() => setSelectedApprovalId(approval.id)}
                      style={{
                        flex: 1,
                        padding: '0.75rem 1.5rem',
                        backgroundColor: 'var(--accent)',
                        color: '#000',
                        border: 'none',
                        borderRadius: '0.5rem',
                        fontSize: '0.95rem',
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
                      בחן פריט
                    </button>
                  </div>
                )}

                {/* Action Menu */}
                {isSelected && (
                  <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: `1px solid var(--border)` }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {/* Comment Input */}
                      <div>
                        <label
                          style={{
                            display: 'block',
                            fontSize: '0.875rem',
                            fontWeight: 600,
                            marginBottom: '0.5rem',
                            color: 'var(--foreground)',
                          }}
                        >
                          הוסף הערה (אופציונלי)
                        </label>
                        <textarea
                          value={commentText}
                          onChange={e => setCommentText(e.target.value)}
                          placeholder="כתוב את ההערה שלך כאן..."
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            backgroundColor: 'var(--background)',
                            border: `1px solid var(--border)`,
                            borderRadius: '0.5rem',
                            color: 'var(--foreground)',
                            fontSize: '0.9rem',
                            fontFamily: 'inherit',
                            resize: 'vertical',
                            minHeight: '80px',
                            boxSizing: 'border-box',
                          }}
                          onFocus={e => {
                            e.currentTarget.style.borderColor = 'var(--accent)';
                          }}
                          onBlur={e => {
                            e.currentTarget.style.borderColor = 'var(--border)';
                          }}
                        />
                      </div>

                      {/* Action Buttons */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                        <button
                          onClick={() => handleApprove(approval.id)}
                          disabled={isSubmittingComment}
                          style={{
                            padding: '0.75rem 1.5rem',
                            backgroundColor: '#22c55e',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '0.5rem',
                            fontSize: '0.95rem',
                            fontWeight: 600,
                            cursor: isSubmittingComment ? 'not-allowed' : 'pointer',
                            opacity: isSubmittingComment ? 0.6 : 1,
                            transition: 'opacity 250ms ease',
                          }}
                          onMouseEnter={e => {
                            if (!isSubmittingComment) {
                              (e.target as HTMLElement).style.opacity = '0.9';
                            }
                          }}
                          onMouseLeave={e => {
                            (e.target as HTMLElement).style.opacity = '1';
                          }}
                        >
                          ✓ אשר
                        </button>

                        <button
                          onClick={() => handleRequestChanges(approval.id)}
                          disabled={isSubmittingComment || !commentText.trim()}
                          style={{
                            padding: '0.75rem 1.5rem',
                            backgroundColor: '#ef4444',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '0.5rem',
                            fontSize: '0.95rem',
                            fontWeight: 600,
                            cursor: isSubmittingComment || !commentText.trim() ? 'not-allowed' : 'pointer',
                            opacity: isSubmittingComment || !commentText.trim() ? 0.6 : 1,
                            transition: 'opacity 250ms ease',
                          }}
                          onMouseEnter={e => {
                            if (!isSubmittingComment && commentText.trim()) {
                              (e.target as HTMLElement).style.opacity = '0.9';
                            }
                          }}
                          onMouseLeave={e => {
                            (e.target as HTMLElement).style.opacity = '1';
                          }}
                        >
                          בקש שינויים
                        </button>
                      </div>

                      {/* Add Comment Only Button */}
                      {commentText.trim() && (
                        <button
                          onClick={() => handleAddComment(approval.id)}
                          disabled={isSubmittingComment}
                          style={{
                            padding: '0.75rem 1.5rem',
                            backgroundColor: 'var(--accent)',
                            color: '#000',
                            border: 'none',
                            borderRadius: '0.5rem',
                            fontSize: '0.95rem',
                            fontWeight: 600,
                            cursor: isSubmittingComment ? 'not-allowed' : 'pointer',
                            opacity: isSubmittingComment ? 0.6 : 1,
                          }}
                        >
                          שלח הערה בלבד
                        </button>
                      )}

                      {/* Cancel Button */}
                      <button
                        onClick={() => {
                          setSelectedApprovalId(null);
                          setCommentText('');
                        }}
                        style={{
                          padding: '0.75rem 1.5rem',
                          backgroundColor: 'transparent',
                          color: 'var(--foreground-muted)',
                          border: `1px solid var(--border)`,
                          borderRadius: '0.5rem',
                          fontSize: '0.95rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'all 250ms ease',
                        }}
                        onMouseEnter={e => {
                          (e.target as HTMLElement).style.backgroundColor = 'var(--surface-raised)';
                        }}
                        onMouseLeave={e => {
                          (e.target as HTMLElement).style.backgroundColor = 'transparent';
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
          <p style={{ fontSize: '1.1rem', fontWeight: 600, color: '#22c55e', margin: '0 0 0.5rem 0' }}>
            ✓ אין פריטים ממתינים
          </p>
          <p style={{ color: 'var(--foreground-muted)', fontSize: '1rem', margin: 0 }}>
            כל הפריטים אושרו או נמחקו
          </p>
        </div>
      )}
    </div>
  );
}

export default function ApprovalsContent() {
  return (
    <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center' }}>...טוען</div>}>
      <ApprovalsContentInner />
    </Suspense>
  );
}
