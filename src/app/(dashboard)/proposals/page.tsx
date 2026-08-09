'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/toast';
import { PageHeader, KpiRow, KpiCard, EmptyState, LoadingState } from '@/components/ui/saas-kit';
import type { Proposal, ProposalStatus } from '@/lib/db/schema';

/* ── Status config ────────────────────────────────────────────── */
const STATUS_MAP: Record<ProposalStatus, { label: string; color: string }> = {
  draft:     { label: 'טיוטה',   color: 'var(--foreground-muted)' },
  published: { label: 'פורסמה',  color: 'var(--accent)' },
  viewed:    { label: 'נצפתה',   color: '#f59e0b' },
  approved:  { label: 'אושרה',   color: '#22c55e' },
  rejected:  { label: 'נדחתה',   color: '#ef4444' },
};

const FILTER_OPTIONS: { value: ProposalStatus | 'all'; label: string }[] = [
  { value: 'all',       label: 'הכל' },
  { value: 'draft',     label: 'טיוטה' },
  { value: 'published', label: 'פורסמה' },
  { value: 'viewed',    label: 'נצפתה' },
  { value: 'approved',  label: 'אושרה' },
  { value: 'rejected',  label: 'נדחתה' },
];

/* ── Component ────────────────────────────────────────────────── */
export default function ProposalsPage() {
  const router = useRouter();
  const toast = useToast();

  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<ProposalStatus | 'all'>('all');
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchProposals = useCallback(async () => {
    try {
      const r = await fetch('/api/data/proposals');
      const data = await r.json();
      setProposals(data ?? []);
    } catch {
      setProposals([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProposals(); }, [fetchProposals]);

  /* ── Derived data ───────────────────────────────────────────── */
  const counts = {
    total:     proposals.length,
    draft:     proposals.filter((p) => p.status === 'draft').length,
    published: proposals.filter((p) => p.status === 'published').length,
    approved:  proposals.filter((p) => p.status === 'approved').length,
  };

  const filtered = proposals
    .filter((p) => statusFilter === 'all' || p.status === statusFilter)
    .filter((p) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.trim().toLowerCase();
      return (
        p.title.toLowerCase().includes(q) ||
        p.clientName.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  /* ── Actions ────────────────────────────────────────────────── */
  const handleDuplicate = async (proposalId: string) => {
    try {
      const r = await fetch('/api/proposals/duplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId }),
      });
      if (!r.ok) throw new Error();
      await fetchProposals();
      toast('ההצעה שוכפלה בהצלחה', 'success');
    } catch {
      toast('שגיאה בשכפול ההצעה', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('למחוק את ההצעה? לא ניתן לשחזר פעולה זו.')) return;
    try {
      const r = await fetch(`/api/data/proposals?id=${id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error();
      await fetchProposals();
      toast('ההצעה נמחקה', 'success');
    } catch {
      toast('שגיאה במחיקת ההצעה', 'error');
    }
  };

  const handleView = (p: Proposal) => {
    if (p.status === 'draft') return;
    window.open(`/proposal/${p.publicToken}`, '_blank');
  };

  /* ── Styles ─────────────────────────────────────────────────── */
  const selectStyle: React.CSSProperties = {
    padding: '0.55rem 0.9rem',
    borderRadius: 10,
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--foreground)',
    fontSize: '0.85rem',
    fontFamily: 'inherit',
    cursor: 'pointer',
    minWidth: 140,
  };

  const actionBtnStyle: React.CSSProperties = {
    background: 'transparent',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '0.35rem 0.65rem',
    fontSize: '0.78rem',
    fontWeight: 600,
    cursor: 'pointer',
    color: 'var(--foreground-muted)',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
  };

  const thStyle: React.CSSProperties = {
    padding: '0.75rem 1rem',
    fontSize: '0.8rem',
    fontWeight: 700,
    color: 'var(--foreground-muted)',
    textAlign: 'right',
    whiteSpace: 'nowrap',
  };

  const tdStyle: React.CSSProperties = {
    padding: '0.75rem 1rem',
    fontSize: '0.87rem',
    color: 'var(--foreground)',
    textAlign: 'right',
    verticalAlign: 'middle',
  };

  /* ── Render ─────────────────────────────────────────────────── */
  return (
    <div dir="rtl" style={{ maxWidth: 1200, margin: '0 auto', padding: '1.5rem 1.25rem 4rem', minHeight: '100vh' }}>

      {/* Header */}
      <PageHeader
        title="הצעות מחיר"
        primaryAction={{
          label: 'הצעה חדשה +',
          href: '/proposals/new',
          variant: 'primary',
        }}
        search={{
          value: searchQuery,
          onChange: setSearchQuery,
          placeholder: 'חיפוש לפי כותרת או לקוח...',
        }}
      />

      {/* KPI Cards */}
      <KpiRow>
        <KpiCard
          label="סה״כ הצעות"
          value={counts.total}
          icon="📋"
          color="var(--accent)"
        />
        <KpiCard
          label="טיוטות"
          value={counts.draft}
          icon="📝"
          color="var(--foreground-muted)"
        />
        <KpiCard
          label="פורסמו"
          value={counts.published}
          icon="📤"
          color="var(--accent)"
        />
        <KpiCard
          label="אושרו"
          value={counts.approved}
          icon="✅"
          color="#22c55e"
        />
      </KpiRow>

      {/* Filter Bar */}
      <div style={{
        background: 'var(--surface-raised)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        padding: '0.85rem 1.25rem',
        marginBottom: '1.5rem',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--foreground-muted)' }}>סטטוס:</span>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as ProposalStatus | 'all')}
          style={selectStyle}
        >
          {FILTER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <span style={{ fontSize: '0.8rem', color: 'var(--foreground-muted)', marginRight: 'auto' }}>
          {filtered.length} תוצאות
        </span>
      </div>

      {/* Content */}
      {loading ? (
        <LoadingState label="טוען הצעות..." />
      ) : proposals.length === 0 ? (
        <EmptyState
          icon="📄"
          title="אין הצעות מחיר עדיין"
          hint="צרו את ההצעה הראשונה שלכם כדי להתחיל"
          action={{ label: 'צור הצעה חדשה', href: '/proposals/new' }}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="🔍"
          title="לא נמצאו הצעות"
          hint="נסו לשנות את הפילטר או את מילת החיפוש"
        />
      ) : (
        /* Proposals Table */
        <div style={{
          background: 'var(--surface-raised)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          overflow: 'hidden',
          boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                <th style={thStyle}>כותרת</th>
                <th style={thStyle}>לקוח</th>
                <th style={thStyle}>סטטוס</th>
                <th style={thStyle}>מחיר</th>
                <th style={thStyle}>תאריך יצירה</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>פעולות</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const status = STATUS_MAP[p.status];
                const isHovered = hoveredRow === p.id;
                return (
                  <tr
                    key={p.id}
                    onMouseEnter={() => setHoveredRow(p.id)}
                    onMouseLeave={() => setHoveredRow(null)}
                    style={{
                      borderBottom: '1px solid var(--border)',
                      background: isHovered ? 'var(--surface)' : 'transparent',
                      transition: 'background 0.15s ease',
                    }}
                  >
                    {/* Title */}
                    <td style={{ ...tdStyle, fontWeight: 600, maxWidth: 240 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.title || 'ללא כותרת'}
                      </div>
                    </td>

                    {/* Client */}
                    <td style={{ ...tdStyle, color: 'var(--foreground-muted)' }}>
                      {p.clientName || '—'}
                    </td>

                    {/* Status Badge */}
                    <td style={tdStyle}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: status.color,
                        background: p.status === 'draft'
                          ? 'var(--surface)'
                          : `${status.color}1a`,
                        border: p.status === 'draft'
                          ? '1px solid var(--border)'
                          : `1px solid ${status.color}30`,
                        borderRadius: 8,
                        padding: '4px 12px',
                        whiteSpace: 'nowrap',
                      }}>
                        {status.label}
                      </span>
                    </td>

                    {/* Price */}
                    <td style={{ ...tdStyle, fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {p.price != null ? (
                        <>
                          {`₪${p.price.toLocaleString()}`}
                          {p.includeVat && (
                            <span style={{ fontSize: '0.72rem', color: 'var(--foreground-muted)', marginRight: 4 }}>
                              + מע״מ
                            </span>
                          )}
                        </>
                      ) : '—'}
                    </td>

                    {/* Date */}
                    <td style={{ ...tdStyle, color: 'var(--foreground-muted)', whiteSpace: 'nowrap' }}>
                      {new Date(p.createdAt).toLocaleDateString('he-IL')}
                    </td>

                    {/* Actions */}
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
                        {/* View published */}
                        {p.status !== 'draft' && (
                          <button
                            onClick={() => handleView(p)}
                            style={{ ...actionBtnStyle, color: 'var(--accent)', borderColor: 'var(--accent)' }}
                          >
                            צפייה
                          </button>
                        )}

                        {/* Edit */}
                        <button
                          onClick={() => router.push(`/proposals/edit/${p.id}`)}
                          style={actionBtnStyle}
                        >
                          עריכה
                        </button>

                        {/* Duplicate */}
                        <button
                          onClick={() => handleDuplicate(p.id)}
                          style={actionBtnStyle}
                        >
                          שכפול
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => handleDelete(p.id)}
                          style={{ ...actionBtnStyle, color: '#ef4444', borderColor: '#fecaca' }}
                        >
                          מחיקה
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
