'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useApprovals, usePortalComments } from '@/lib/api/use-entity';
import { useToast } from '@/components/ui/toast';

const TYPE_META: Record<string, { icon: string; label: string; color: string }> = {
  video: { icon: '🎬', label: 'וידאו', color: '#a78bfa' },
  post: { icon: '📱', label: 'פוסט', color: '#38bdf8' },
  gantt: { icon: '📅', label: 'לוח תוכן', color: '#22c55e' },
  design: { icon: '🎨', label: 'עיצוב', color: '#f472b6' },
  milestone: { icon: '🎯', label: 'יעד', color: '#f97316' },
  content: { icon: '📝', label: 'תוכן', color: '#2dd4bf' },
};

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  pending_approval: { label: 'ממתין לאישור', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)' },
  needs_changes: { label: 'דורש שינויים', color: '#ef4444', bg: 'rgba(239,68,68,0.06)' },
  approved: { label: 'אושר', color: '#22c55e', bg: 'rgba(34,197,94,0.06)' },
  rejected: { label: 'נדחה', color: '#ef4444', bg: 'rgba(239,68,68,0.06)' },
  draft: { label: 'טיוטה', color: '#6b7280', bg: 'rgba(107,114,128,0.06)' },
};

function ApprovalsContentInner() {
  const searchParams = useSearchParams();
  const clientId = searchParams.get('clientId');

  const { data: approvals, update: updateApproval } = useApprovals();
  const { create: createComment } = usePortalComments();
  const toast = useToast();

  const [selectedApprovalId, setSelectedApprovalId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');

  // Server-side scoping ensures we only receive approvals for this client.
  // No additional client filtering needed on the frontend.
  const clientApprovals = approvals;

  const pendingApprovals = clientApprovals.filter(a => a.status === 'pending_approval' || a.status === 'needs_changes');
  const historyApprovals = clientApprovals.filter(a => a.status === 'approved' || a.status === 'rejected');

  const handleApprove = async (approvalId: string) => {
    setIsSubmitting(true);
    try {
      await updateApproval(approvalId, { status: 'approved' });
      await createComment({
        clientId: clientId || '', portalUserId: 'portal_user',
        entityType: 'approval', entityId: approvalId,
        action: 'approve', comment: commentText || 'אושר על ידי הלקוח', isInternal: false,
      });
      toast('הפריט אושר בהצלחה', 'success');
      setSelectedApprovalId(null);
      setCommentText('');
    } catch { toast('שגיאה באישור הפריט', 'error'); }
    finally { setIsSubmitting(false); }
  };

  const handleRequestChanges = async (approvalId: string) => {
    if (!commentText.trim()) { toast('יש להוסיף הערה לבקשת שינויים', 'error'); return; }
    setIsSubmitting(true);
    try {
      await updateApproval(approvalId, { status: 'needs_changes' });
      await createComment({
        clientId: clientId || '', portalUserId: 'portal_user',
        entityType: 'approval', entityId: approvalId,
        action: 'request_changes', comment: commentText, isInternal: false,
      });
      toast('הבקשה לשינויים נשלחה', 'success');
      setSelectedApprovalId(null);
      setCommentText('');
    } catch { toast('שגיאה בשליחת הבקשה', 'error'); }
    finally { setIsSubmitting(false); }
  };

  const displayApprovals = activeTab === 'pending' ? pendingApprovals : historyApprovals;

  return (
    <div style={{ direction: 'rtl' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 0.25rem 0' }}>מרכז אישורים</h1>
        <p style={{ fontSize: '0.85rem', color: 'var(--foreground-muted)', margin: 0 }}>
          צפה, אשר או בקש שינויים על פריטים שנשלחו לך
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
        {[
          { key: 'pending' as const, label: 'ממתינים', count: pendingApprovals.length, color: '#f59e0b' },
          { key: 'history' as const, label: 'היסטוריה', count: historyApprovals.length, color: '#22c55e' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '0.5rem 1rem', border: 'none', borderRadius: '0.5rem',
              background: activeTab === tab.key ? `${tab.color}15` : 'transparent',
              color: activeTab === tab.key ? tab.color : 'var(--foreground-muted)',
              fontWeight: activeTab === tab.key ? 700 : 500,
              fontSize: '0.85rem', cursor: 'pointer',
              transition: 'all 200ms ease',
            }}
          >
            {tab.label}
            <span style={{
              marginRight: '0.4rem', fontSize: '0.7rem', fontWeight: 700,
              padding: '0.1rem 0.4rem', borderRadius: '999px',
              background: activeTab === tab.key ? `${tab.color}20` : 'var(--border)',
              color: activeTab === tab.key ? tab.color : 'var(--foreground-muted)',
            }}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Approval Cards */}
      {displayApprovals.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {displayApprovals.map(approval => {
            const isSelected = selectedApprovalId === approval.id;
            const typeMeta = TYPE_META[approval.type] || { icon: '📋', label: approval.type, color: '#6b7280' };
            const statusMeta = STATUS_META[approval.status] || STATUS_META.draft;

            return (
              <div key={approval.id} style={{
                backgroundColor: isSelected ? 'var(--surface-raised)' : 'var(--surface)',
                border: `1px solid ${isSelected ? typeMeta.color + '40' : 'var(--border)'}`,
                borderRight: `4px solid ${typeMeta.color}`,
                borderRadius: '0.75rem', padding: '1.25rem',
                transition: 'all 200ms ease',
              }}>
                {/* Card Header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', marginBottom: '0.75rem' }}>
                  <div style={{
                    width: '2.75rem', height: '2.75rem', borderRadius: '0.5rem',
                    background: `${typeMeta.color}12`, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0,
                  }}>
                    {typeMeta.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.2rem' }}>{approval.title}</div>
                    {(approval as any).description && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--foreground-muted)', marginBottom: '0.4rem', lineHeight: 1.5 }}>
                        {(approval as any).description.slice(0, 120)}{(approval as any).description.length > 120 ? '...' : ''}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: '0.65rem', fontWeight: 600, padding: '0.15rem 0.5rem', borderRadius: '999px',
                        background: `${typeMeta.color}15`, color: typeMeta.color,
                      }}>{typeMeta.label}</span>
                      <span style={{
                        fontSize: '0.65rem', fontWeight: 600, padding: '0.15rem 0.5rem', borderRadius: '999px',
                        background: `${statusMeta.color}15`, color: statusMeta.color,
                      }}>{statusMeta.label}</span>
                      <span style={{ fontSize: '0.65rem', color: 'var(--foreground-muted)' }}>
                        {new Date(approval.createdAt).toLocaleDateString('he-IL', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Action Area (only for pending) */}
                {activeTab === 'pending' && !isSelected && (
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                    <button
                      onClick={() => handleApprove(approval.id)}
                      style={{
                        flex: 1, padding: '0.6rem', backgroundColor: '#22c55e', color: '#fff',
                        border: 'none', borderRadius: '0.5rem', fontSize: '0.85rem', fontWeight: 700,
                        cursor: 'pointer', transition: 'opacity 200ms',
                      }}
                      onMouseEnter={e => { (e.target as HTMLElement).style.opacity = '0.85'; }}
                      onMouseLeave={e => { (e.target as HTMLElement).style.opacity = '1'; }}
                    >
                      ✓ אשר
                    </button>
                    <button
                      onClick={() => setSelectedApprovalId(approval.id)}
                      style={{
                        flex: 1, padding: '0.6rem', backgroundColor: 'transparent', color: 'var(--foreground)',
                        border: '1px solid var(--border)', borderRadius: '0.5rem', fontSize: '0.85rem', fontWeight: 600,
                        cursor: 'pointer', transition: 'all 200ms',
                      }}
                      onMouseEnter={e => { (e.target as HTMLElement).style.borderColor = '#ef4444'; (e.target as HTMLElement).style.color = '#ef4444'; }}
                      onMouseLeave={e => { (e.target as HTMLElement).style.borderColor = 'var(--border)'; (e.target as HTMLElement).style.color = 'var(--foreground)'; }}
                    >
                      בקש שינויים
                    </button>
                  </div>
                )}

                {/* Expanded Comment Area */}
                {isSelected && (
                  <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
                    <textarea
                      value={commentText}
                      onChange={e => setCommentText(e.target.value)}
                      placeholder="כתוב הערה או פרט מה צריך לשנות..."
                      style={{
                        width: '100%', padding: '0.75rem', backgroundColor: 'var(--background)',
                        border: '1px solid var(--border)', borderRadius: '0.5rem', color: 'var(--foreground)',
                        fontSize: '0.85rem', fontFamily: 'inherit', resize: 'vertical', minHeight: '70px',
                        boxSizing: 'border-box',
                      }}
                      onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
                      onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                    />
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                      <button
                        onClick={() => handleApprove(approval.id)}
                        disabled={isSubmitting}
                        style={{
                          flex: 1, padding: '0.6rem', backgroundColor: '#22c55e', color: '#fff',
                          border: 'none', borderRadius: '0.5rem', fontSize: '0.85rem', fontWeight: 700,
                          cursor: isSubmitting ? 'not-allowed' : 'pointer', opacity: isSubmitting ? 0.6 : 1,
                        }}
                      >
                        ✓ אשר
                      </button>
                      <button
                        onClick={() => handleRequestChanges(approval.id)}
                        disabled={isSubmitting || !commentText.trim()}
                        style={{
                          flex: 1, padding: '0.6rem', backgroundColor: '#ef4444', color: '#fff',
                          border: 'none', borderRadius: '0.5rem', fontSize: '0.85rem', fontWeight: 700,
                          cursor: (isSubmitting || !commentText.trim()) ? 'not-allowed' : 'pointer',
                          opacity: (isSubmitting || !commentText.trim()) ? 0.6 : 1,
                        }}
                      >
                        בקש שינויים
                      </button>
                      <button
                        onClick={() => { setSelectedApprovalId(null); setCommentText(''); }}
                        style={{
                          padding: '0.6rem 1rem', backgroundColor: 'transparent', color: 'var(--foreground-muted)',
                          border: '1px solid var(--border)', borderRadius: '0.5rem', fontSize: '0.85rem',
                          fontWeight: 600, cursor: 'pointer',
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
        <div style={{
          backgroundColor: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: '0.75rem', padding: '3rem', textAlign: 'center',
        }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>
            {activeTab === 'pending' ? '✅' : '📋'}
          </div>
          <p style={{ fontSize: '1rem', fontWeight: 600, color: activeTab === 'pending' ? '#22c55e' : 'var(--foreground-muted)', margin: '0 0 0.25rem 0' }}>
            {activeTab === 'pending' ? 'אין פריטים ממתינים' : 'אין היסטוריה'}
          </p>
          <p style={{ color: 'var(--foreground-muted)', fontSize: '0.85rem', margin: 0 }}>
            {activeTab === 'pending' ? 'כל הפריטים שלך אושרו — עבודה מצוינת!' : 'ברגע שתאשר או תבקש שינויים, הם יופיעו כאן'}
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
