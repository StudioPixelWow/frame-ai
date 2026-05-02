'use client';

import { useState, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useApprovals, usePortalComments } from '@/lib/api/use-entity';
import { useToast } from '@/components/ui/toast';

const TYPE_META: Record<string, { icon: string; label: string; color: string }> = {
  video: { icon: '🎬', label: 'וידאו', color: '#a78bfa' },
  post: { icon: '📱', label: 'פוסט', color: '#38bdf8' },
  gantt: { icon: '📅', label: 'תוכן', color: '#22c55e' },
  design: { icon: '🎨', label: 'עיצוב', color: '#f472b6' },
  milestone: { icon: '🎯', label: 'יעד', color: '#f97316' },
  content: { icon: '📝', label: 'תוכן', color: '#2dd4bf' },
  ad: { icon: '📣', label: 'מודעה', color: '#3b82f6' },
  campaign_action: { icon: '⚡', label: 'שינוי קמפיין', color: '#6366f1' },
};

function ApprovalsContentInner() {
  const searchParams = useSearchParams();
  const clientId = searchParams.get('clientId');

  const { data: approvals, update: updateApproval } = useApprovals();
  const { create: createComment } = usePortalComments();
  const toast = useToast();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');

  const pendingApprovals = useMemo(() => approvals.filter(a => a.status === 'pending_approval' || a.status === 'needs_changes'), [approvals]);
  const historyApprovals = useMemo(() => approvals.filter(a => a.status === 'approved' || a.status === 'rejected'), [approvals]);
  const displayApprovals = activeTab === 'pending' ? pendingApprovals : historyApprovals;

  const handleApprove = async (approvalId: string) => {
    setIsSubmitting(true);
    try {
      await updateApproval(approvalId, { status: 'approved' });
      await createComment({
        clientId: clientId || '', portalUserId: 'portal_user',
        entityType: 'approval', entityId: approvalId,
        action: 'approve', comment: commentText || 'אושר', isInternal: false,
      });
      toast('מאושר בהצלחה!', 'success');
      setExpandedId(null);
      setCommentText('');
    } catch { toast('שגיאה באישור', 'error'); }
    finally { setIsSubmitting(false); }
  };

  const handleReject = async (approvalId: string) => {
    if (!commentText.trim()) { toast('יש לכתוב הערה כדי לבקש שינויים', 'error'); return; }
    setIsSubmitting(true);
    try {
      await updateApproval(approvalId, { status: 'needs_changes' });
      await createComment({
        clientId: clientId || '', portalUserId: 'portal_user',
        entityType: 'approval', entityId: approvalId,
        action: 'request_changes', comment: commentText, isInternal: false,
      });
      toast('ההערות נשלחו בהצלחה', 'success');
      setExpandedId(null);
      setCommentText('');
    } catch { toast('שגיאה בשליחה', 'error'); }
    finally { setIsSubmitting(false); }
  };

  return (
    <div style={{ direction: 'rtl', maxWidth: '700px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <a href={`/client-portal/dashboard?clientId=${clientId}`} style={{
          fontSize: '0.8rem', color: 'var(--foreground-muted)', textDecoration: 'none',
          display: 'inline-flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.75rem',
        }}>
          ← חזרה לדשבורד
        </a>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 0.25rem 0' }}>מרכז אישורים</h1>
        <p style={{ fontSize: '0.85rem', color: 'var(--foreground-muted)', margin: 0 }}>
          צפה באישורים ממתינים ואשר או בקש שינויים
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        {[
          { key: 'pending' as const, label: 'ממתינים', count: pendingApprovals.length, color: '#f59e0b' },
          { key: 'history' as const, label: 'היסטוריה', count: historyApprovals.length, color: '#22c55e' },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
            padding: '0.5rem 1rem', border: 'none', borderRadius: '0.5rem',
            background: activeTab === tab.key ? `${tab.color}12` : 'transparent',
            color: activeTab === tab.key ? tab.color : 'var(--foreground-muted)',
            fontWeight: activeTab === tab.key ? 700 : 500, fontSize: '0.85rem',
            cursor: 'pointer', transition: 'all 200ms',
          }}>
            {tab.label}
            <span style={{
              marginRight: '0.4rem', fontSize: '0.7rem', fontWeight: 700,
              padding: '0.1rem 0.4rem', borderRadius: '999px',
              background: activeTab === tab.key ? `${tab.color}20` : 'var(--border)',
              color: activeTab === tab.key ? tab.color : 'var(--foreground-muted)',
            }}>{tab.count}</span>
          </button>
        ))}
      </div>

      {/* Cards */}
      {displayApprovals.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {displayApprovals.map(approval => {
            const isExpanded = expandedId === approval.id;
            const meta = TYPE_META[approval.type] || { icon: '📋', label: approval.type, color: '#6b7280' };
            const isPending = approval.status === 'pending_approval' || approval.status === 'needs_changes';
            const description = (approval as any).description || '';

            return (
              <div key={approval.id} style={{
                background: 'var(--surface)', border: `1px solid ${isExpanded ? meta.color + '40' : 'var(--border)'}`,
                borderRadius: '1rem', overflow: 'hidden', transition: 'all 200ms',
              }}>
                {/* Preview Image (if available) */}
                {(approval as any).imageUrl && (
                  <div style={{ height: '200px', overflow: 'hidden', background: '#f5f5f5' }}>
                    <img src={(approval as any).imageUrl} alt="" style={{
                      width: '100%', height: '100%', objectFit: 'cover',
                    }} onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />
                  </div>
                )}

                <div style={{ padding: '1.25rem' }}>
                  {/* Type + Status */}
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <span style={{
                      fontSize: '0.7rem', fontWeight: 600, padding: '0.2rem 0.6rem', borderRadius: '999px',
                      background: `${meta.color}12`, color: meta.color,
                    }}>{meta.icon} {meta.label}</span>
                    {approval.status === 'approved' && (
                      <span style={{ fontSize: '0.7rem', fontWeight: 600, padding: '0.2rem 0.6rem', borderRadius: '999px', background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>
                        ✓ אושר
                      </span>
                    )}
                    {approval.status === 'needs_changes' && (
                      <span style={{ fontSize: '0.7rem', fontWeight: 600, padding: '0.2rem 0.6rem', borderRadius: '999px', background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
                        ⟲ דורש שינויים
                      </span>
                    )}
                  </div>

                  {/* Title */}
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 0.35rem 0' }}>{approval.title}</h3>

                  {/* Description */}
                  {description && (
                    <p style={{ fontSize: '0.85rem', color: 'var(--foreground-muted)', margin: '0 0 0.5rem 0', lineHeight: 1.6 }}>
                      {description.slice(0, 200)}{description.length > 200 ? '...' : ''}
                    </p>
                  )}

                  <div style={{ fontSize: '0.72rem', color: 'var(--foreground-subtle)', marginBottom: isPending ? '1rem' : 0 }}>
                    {new Date(approval.createdAt).toLocaleDateString('he-IL', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>

                  {/* Action Buttons — Social-style */}
                  {isPending && !isExpanded && (
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                      <button onClick={() => handleApprove(approval.id)} style={{
                        flex: 1, padding: '0.85rem', backgroundColor: '#22c55e', color: '#fff',
                        border: 'none', borderRadius: '0.75rem', fontSize: '1rem', fontWeight: 800,
                        cursor: 'pointer', transition: 'opacity 200ms', letterSpacing: '-0.01em',
                      }}
                      onMouseEnter={e => { (e.target as HTMLElement).style.opacity = '0.9'; }}
                      onMouseLeave={e => { (e.target as HTMLElement).style.opacity = '1'; }}
                      >
                        מאשר ✓
                      </button>
                      <button onClick={() => setExpandedId(approval.id)} style={{
                        flex: 1, padding: '0.85rem', backgroundColor: 'transparent', color: 'var(--foreground)',
                        border: '1px solid var(--border)', borderRadius: '0.75rem', fontSize: '1rem', fontWeight: 700,
                        cursor: 'pointer', transition: 'all 200ms',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#ef4444'; (e.currentTarget as HTMLElement).style.color = '#ef4444'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.color = 'var(--foreground)'; }}
                      >
                        לא מאשר
                      </button>
                    </div>
                  )}

                  {/* Expanded — Comment Area */}
                  {isExpanded && (
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                      <p style={{ fontSize: '0.85rem', fontWeight: 600, margin: '0 0 0.5rem 0' }}>
                        מה צריך לשנות?
                      </p>
                      <textarea
                        value={commentText}
                        onChange={e => setCommentText(e.target.value)}
                        placeholder="כתוב כאן את ההערות שלך..."
                        style={{
                          width: '100%', padding: '0.85rem', backgroundColor: 'var(--background)',
                          border: '1px solid var(--border)', borderRadius: '0.75rem', color: 'var(--foreground)',
                          fontSize: '0.9rem', fontFamily: 'inherit', resize: 'vertical', minHeight: '80px',
                          boxSizing: 'border-box',
                        }}
                      />
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                        <button onClick={() => handleApprove(approval.id)} disabled={isSubmitting} style={{
                          flex: 1, padding: '0.7rem', backgroundColor: '#22c55e', color: '#fff',
                          border: 'none', borderRadius: '0.75rem', fontSize: '0.9rem', fontWeight: 700,
                          cursor: isSubmitting ? 'not-allowed' : 'pointer', opacity: isSubmitting ? 0.6 : 1,
                        }}>
                          בעצם מאשר ✓
                        </button>
                        <button
                          onClick={() => handleReject(approval.id)}
                          disabled={isSubmitting || !commentText.trim()}
                          style={{
                            flex: 1, padding: '0.7rem', backgroundColor: '#ef4444', color: '#fff',
                            border: 'none', borderRadius: '0.75rem', fontSize: '0.9rem', fontWeight: 700,
                            cursor: (isSubmitting || !commentText.trim()) ? 'not-allowed' : 'pointer',
                            opacity: (isSubmitting || !commentText.trim()) ? 0.6 : 1,
                          }}
                        >
                          שלח הערות
                        </button>
                        <button onClick={() => { setExpandedId(null); setCommentText(''); }} style={{
                          padding: '0.7rem 1rem', backgroundColor: 'transparent', color: 'var(--foreground-muted)',
                          border: '1px solid var(--border)', borderRadius: '0.75rem', fontSize: '0.85rem',
                          fontWeight: 600, cursor: 'pointer',
                        }}>
                          ביטול
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: '1rem', padding: '3.5rem', textAlign: 'center',
        }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>
            {activeTab === 'pending' ? '✅' : '📋'}
          </div>
          <p style={{ fontSize: '1.05rem', fontWeight: 600, color: activeTab === 'pending' ? '#22c55e' : 'var(--foreground-muted)', margin: '0 0 0.25rem 0' }}>
            {activeTab === 'pending' ? 'אין כרגע דברים שמחכים לאישור' : 'אין היסטוריה'}
          </p>
          <p style={{ color: 'var(--foreground-muted)', fontSize: '0.85rem', margin: 0 }}>
            {activeTab === 'pending' ? 'כשנכין משהו חדש עבורך, תראה אותו כאן' : 'ברגע שתאשר פריטים, הם יופיעו כאן'}
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
