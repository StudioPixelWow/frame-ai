'use client';

import React, { useState, useMemo } from 'react';
import { useProjects } from '@/lib/api/use-entity';
import { useToast } from '@/components/ui/toast';
import type { Client, Employee, Project } from '@/lib/db/schema';

interface TabVideosProps {
  client: Client;
  employees: Employee[];
}

// Status config for display
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  draft:          { label: 'טיוטה',        color: '#6b7280', bg: 'rgba(107, 114, 128, 0.12)' },
  analysing:      { label: 'בעיבוד',       color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)' },
  approved:       { label: 'אושר',         color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)' },
  rendering:      { label: 'ברנדור',       color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.12)' },
  complete:       { label: 'מוכן',         color: '#22c55e', bg: 'rgba(34, 197, 94, 0.12)' },
  failed:         { label: 'נכשל',         color: '#dc2626', bg: 'rgba(220, 38, 38, 0.12)' },
  sent_to_client: { label: 'נשלח ללקוח',  color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.12)' },
};

const FORMAT_LABELS: Record<string, string> = {
  '9:16': 'סטורי (9:16)',
  '16:9': 'רוחבי (16:9)',
  '1:1': 'ריבועי (1:1)',
  '4:5': 'פיד (4:5)',
};

function formatDuration(sec: number): string {
  if (!sec || sec <= 0) return '—';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, '0')} דק׳` : `${s} שנ׳`;
}

function formatDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function TabVideos({ client, employees }: TabVideosProps) {
  const toast = useToast();
  const { data: allProjects = [], loading, update: updateProject } = useProjects();

  // Filter projects for this client
  const clientVideos = useMemo(() =>
    allProjects
      .filter((p) => p.clientId === client.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [allProjects, client.id]
  );

  // UI state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailTargetIds, setEmailTargetIds] = useState<string[]>([]);
  const [emailRecipient, setEmailRecipient] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [sending, setSending] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Filtered videos
  const filteredVideos = useMemo(() =>
    filterStatus === 'all'
      ? clientVideos
      : clientVideos.filter(v => v.status === filterStatus),
    [clientVideos, filterStatus]
  );

  // Selection helpers
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === filteredVideos.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredVideos.map(v => v.id)));
    }
  };

  // Open email modal for one or multiple videos
  const openEmailModal = (projectIds: string[]) => {
    const names = projectIds.map(id => {
      const p = clientVideos.find(v => v.id === id);
      return p?.name || '';
    }).filter(Boolean);

    setEmailTargetIds(projectIds);
    setEmailRecipient(client.email || '');
    setEmailSubject(
      projectIds.length === 1
        ? `סרטון חדש עבורך: ${names[0]}`
        : `${projectIds.length} סרטונים חדשים עבורך`
    );
    setEmailBody(
      projectIds.length === 1
        ? `שלום ${client.contactPerson || client.name},\n\nמצורף הסרטון "${names[0]}" שהכנו עבורכם.\nנשמח לשמוע מה דעתכם!\n\nבברכה,\nצוות ${client.name}`
        : `שלום ${client.contactPerson || client.name},\n\nמצורפים ${projectIds.length} סרטונים שהכנו עבורכם:\n${names.map((n, i) => `${i + 1}. ${n}`).join('\n')}\n\nנשמח לשמוע מה דעתכם!\n\nבברכה,\nצוות ${client.name}`
    );
    setShowEmailModal(true);
  };

  // Send email
  const handleSendEmail = async () => {
    if (!emailRecipient || !emailSubject) {
      toast('אנא מלא את כל השדות', 'error');
      return;
    }
    try {
      setSending(true);
      const res = await fetch(`/api/clients/${client.id}/send-video-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectIds: emailTargetIds,
          recipientEmail: emailRecipient,
          subject: emailSubject,
          bodyText: emailBody,
        }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.error || 'Failed to send');
      }

      // Update local project state for immediate UI feedback
      for (const pid of emailTargetIds) {
        const project = clientVideos.find(v => v.id === pid);
        if (project) {
          try {
            await updateProject(pid, {
              ...project,
              status: 'sent_to_client',
              sentToClientAt: new Date().toISOString(),
              sentToClientEmail: emailRecipient,
              updatedAt: new Date().toISOString(),
            } as any);
          } catch {}
        }
      }

      setShowEmailModal(false);
      setSelectedIds(new Set());
      toast(
        result.sent === 1
          ? '✅ הסרטון נשלח בהצלחה!'
          : `✅ ${result.sent} סרטונים נשלחו בהצלחה!`,
        'success'
      );
    } catch (err) {
      console.error('[TabVideos] Send error:', err);
      toast('שגיאה בשליחת המייל', 'error');
    } finally {
      setSending(false);
    }
  };

  // Styles
  const cardStyle: React.CSSProperties = {
    backgroundColor: 'var(--surface-raised)',
    border: '1px solid var(--border)',
    borderRadius: '0.75rem',
    overflow: 'hidden',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
    cursor: 'pointer',
    position: 'relative',
  };

  const hoverHandlers = {
    onMouseEnter: (e: React.MouseEvent<HTMLDivElement>) => {
      e.currentTarget.style.transform = 'translateY(-2px)';
      e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.12)';
    },
    onMouseLeave: (e: React.MouseEvent<HTMLDivElement>) => {
      e.currentTarget.style.transform = 'translateY(0)';
      e.currentTarget.style.boxShadow = 'none';
    },
  };

  // --- LOADING ---
  if (loading) {
    return (
      <div style={{ direction: 'rtl', padding: '1.5rem' }}>
        <style>{`@keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.8; } }`}</style>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} style={{ ...cardStyle, height: '240px', animation: 'pulse 1.5s ease-in-out infinite' }} />
          ))}
        </div>
      </div>
    );
  }

  // --- EMPTY STATE ---
  if (clientVideos.length === 0) {
    return (
      <div style={{ direction: 'rtl', padding: '1.5rem' }}>
        <div style={{
          textAlign: 'center',
          backgroundColor: 'var(--surface-raised)',
          border: '1px solid var(--border)',
          borderRadius: '0.75rem',
          padding: '4rem 2rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1rem',
        }}>
          <div style={{ fontSize: '3.5rem' }}>🎬</div>
          <h2 style={{ fontSize: '1.375rem', fontWeight: 700, color: 'var(--foreground)' }}>
            עדיין לא נוצרו סרטונים ללקוח זה
          </h2>
          <p style={{ fontSize: '0.9375rem', color: 'var(--foreground-muted)', maxWidth: '400px' }}>
            סרטונים שיווצרו עבור {client.name} יופיעו כאן — כולל תצוגה מקדימה, סטטוס, ואפשרות שליחה ישירה ללקוח
          </p>
        </div>
      </div>
    );
  }

  // --- STATUS COUNTS ---
  const statusCounts = clientVideos.reduce<Record<string, number>>((acc, v) => {
    acc[v.status] = (acc[v.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div style={{ direction: 'rtl', padding: '1.5rem' }}>
      {/* TOOLBAR */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1.5rem',
        flexWrap: 'wrap',
        gap: '0.75rem',
      }}>
        {/* Left: filters + view */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Status filter chips */}
          <button
            onClick={() => setFilterStatus('all')}
            style={{
              padding: '0.375rem 0.75rem',
              borderRadius: '9999px',
              fontSize: '0.8125rem',
              fontWeight: 500,
              border: '1px solid var(--border)',
              backgroundColor: filterStatus === 'all' ? 'var(--accent)' : 'var(--surface)',
              color: filterStatus === 'all' ? 'white' : 'var(--foreground-muted)',
              cursor: 'pointer',
            }}
          >
            הכל ({clientVideos.length})
          </button>
          {Object.entries(statusCounts).map(([status, count]) => {
            const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
            return (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                style={{
                  padding: '0.375rem 0.75rem',
                  borderRadius: '9999px',
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  border: `1px solid ${filterStatus === status ? cfg.color : 'var(--border)'}`,
                  backgroundColor: filterStatus === status ? cfg.bg : 'var(--surface)',
                  color: filterStatus === status ? cfg.color : 'var(--foreground-muted)',
                  cursor: 'pointer',
                }}
              >
                {cfg.label} ({count})
              </button>
            );
          })}

          {/* View toggle */}
          <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: '0.375rem', overflow: 'hidden', marginRight: '0.5rem' }}>
            <button
              onClick={() => setViewMode('grid')}
              style={{
                padding: '0.375rem 0.5rem',
                fontSize: '0.8125rem',
                backgroundColor: viewMode === 'grid' ? 'var(--surface-raised)' : 'var(--surface)',
                color: 'var(--foreground)',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              ▦
            </button>
            <button
              onClick={() => setViewMode('list')}
              style={{
                padding: '0.375rem 0.5rem',
                fontSize: '0.8125rem',
                backgroundColor: viewMode === 'list' ? 'var(--surface-raised)' : 'var(--surface)',
                color: 'var(--foreground)',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              ☰
            </button>
          </div>
        </div>

        {/* Right: bulk actions */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            onClick={selectAll}
            style={{
              padding: '0.375rem 0.75rem',
              borderRadius: '0.375rem',
              fontSize: '0.8125rem',
              fontWeight: 500,
              border: '1px solid var(--border)',
              backgroundColor: 'var(--surface)',
              color: 'var(--foreground-muted)',
              cursor: 'pointer',
            }}
          >
            {selectedIds.size === filteredVideos.length && filteredVideos.length > 0 ? 'בטל בחירה' : 'בחר הכל'}
          </button>
          {selectedIds.size > 0 && (
            <button
              onClick={() => openEmailModal(Array.from(selectedIds))}
              style={{
                padding: '0.375rem 0.75rem',
                borderRadius: '0.375rem',
                fontSize: '0.8125rem',
                fontWeight: 600,
                border: 'none',
                background: 'linear-gradient(135deg, #00B5FE 0%, #0090cc 100%)',
                color: 'white',
                cursor: 'pointer',
              }}
            >
              📧 שלח {selectedIds.size} סרטונים במייל
            </button>
          )}
        </div>
      </div>

      {/* VIDEO GRID / LIST */}
      {viewMode === 'grid' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
          {filteredVideos.map((video) => (
            <VideoCardGrid
              key={video.id}
              video={video}
              selected={selectedIds.has(video.id)}
              onToggleSelect={() => toggleSelect(video.id)}
              onSendEmail={() => openEmailModal([video.id])}
              cardStyle={cardStyle}
              hoverHandlers={hoverHandlers}
            />
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {filteredVideos.map((video) => (
            <VideoCardList
              key={video.id}
              video={video}
              selected={selectedIds.has(video.id)}
              onToggleSelect={() => toggleSelect(video.id)}
              onSendEmail={() => openEmailModal([video.id])}
              hoverHandlers={hoverHandlers}
            />
          ))}
        </div>
      )}

      {/* EMAIL MODAL */}
      {showEmailModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowEmailModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'var(--surface-raised)',
              border: '1px solid var(--border)',
              borderRadius: '1rem',
              padding: '2rem',
              width: '100%',
              maxWidth: '520px',
              direction: 'rtl',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
            }}
          >
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--foreground)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              📧 שליחת {emailTargetIds.length === 1 ? 'סרטון' : `${emailTargetIds.length} סרטונים`} ללקוח
            </h3>

            {/* Recipient */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--foreground-muted)', display: 'block', marginBottom: '0.375rem' }}>
                אימייל נמען
              </label>
              <input
                type="email"
                value={emailRecipient}
                onChange={(e) => setEmailRecipient(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.625rem 0.75rem',
                  borderRadius: '0.5rem',
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--surface)',
                  color: 'var(--foreground)',
                  fontSize: '0.875rem',
                  direction: 'ltr',
                }}
              />
            </div>

            {/* Subject */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--foreground-muted)', display: 'block', marginBottom: '0.375rem' }}>
                נושא
              </label>
              <input
                type="text"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.625rem 0.75rem',
                  borderRadius: '0.5rem',
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--surface)',
                  color: 'var(--foreground)',
                  fontSize: '0.875rem',
                  direction: 'rtl',
                }}
              />
            </div>

            {/* Body */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--foreground-muted)', display: 'block', marginBottom: '0.375rem' }}>
                תוכן ההודעה
              </label>
              <textarea
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                rows={6}
                style={{
                  width: '100%',
                  padding: '0.625rem 0.75rem',
                  borderRadius: '0.5rem',
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--surface)',
                  color: 'var(--foreground)',
                  fontSize: '0.875rem',
                  lineHeight: 1.6,
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  direction: 'rtl',
                }}
              />
            </div>

            {/* Attached videos summary */}
            <div style={{
              padding: '0.75rem',
              backgroundColor: 'rgba(0, 181, 254, 0.06)',
              border: '1px solid rgba(0, 181, 254, 0.15)',
              borderRadius: '0.5rem',
              marginBottom: '1.5rem',
            }}>
              <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent)', marginBottom: '0.375rem' }}>
                🎬 סרטונים מצורפים:
              </p>
              {emailTargetIds.map(id => {
                const v = clientVideos.find(p => p.id === id);
                return v ? (
                  <p key={id} style={{ fontSize: '0.8125rem', color: 'var(--foreground-muted)', paddingRight: '0.5rem' }}>
                    • {v.name} ({FORMAT_LABELS[v.format] || v.format}, {formatDuration(v.durationSec)})
                  </p>
                ) : null;
              })}
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-start' }}>
              <button
                onClick={handleSendEmail}
                disabled={sending || !emailRecipient || !emailSubject}
                style={{
                  padding: '0.625rem 1.25rem',
                  borderRadius: '0.5rem',
                  fontSize: '0.9375rem',
                  fontWeight: 600,
                  border: 'none',
                  background: sending ? '#6b7280' : 'linear-gradient(135deg, #00B5FE 0%, #0090cc 100%)',
                  color: 'white',
                  cursor: sending ? 'not-allowed' : 'pointer',
                  opacity: (!emailRecipient || !emailSubject) ? 0.5 : 1,
                }}
              >
                {sending ? '...שולח' : '📧 שלח עכשיו'}
              </button>
              <button
                onClick={() => setShowEmailModal(false)}
                style={{
                  padding: '0.625rem 1.25rem',
                  borderRadius: '0.5rem',
                  fontSize: '0.9375rem',
                  fontWeight: 500,
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--surface)',
                  color: 'var(--foreground-muted)',
                  cursor: 'pointer',
                }}
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- GRID CARD COMPONENT ---
function VideoCardGrid({
  video,
  selected,
  onToggleSelect,
  onSendEmail,
  cardStyle,
  hoverHandlers,
}: {
  video: Project;
  selected: boolean;
  onToggleSelect: () => void;
  onSendEmail: () => void;
  cardStyle: React.CSSProperties;
  hoverHandlers: { onMouseEnter: (e: React.MouseEvent<HTMLDivElement>) => void; onMouseLeave: (e: React.MouseEvent<HTMLDivElement>) => void };
}) {
  const status = STATUS_CONFIG[video.status] || STATUS_CONFIG.draft;

  return (
    <div
      style={{
        ...cardStyle,
        border: selected ? '2px solid var(--accent)' : '1px solid var(--border)',
      }}
      {...hoverHandlers}
    >
      {/* Selection checkbox */}
      <div
        onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}
        style={{
          position: 'absolute',
          top: '0.625rem',
          right: '0.625rem',
          width: '22px',
          height: '22px',
          borderRadius: '4px',
          border: selected ? '2px solid var(--accent)' : '2px solid rgba(255,255,255,0.5)',
          backgroundColor: selected ? 'var(--accent)' : 'rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          zIndex: 2,
          fontSize: '0.75rem',
          color: 'white',
          fontWeight: 700,
        }}
      >
        {selected ? '✓' : ''}
      </div>

      {/* Thumbnail */}
      <div style={{
        height: '160px',
        backgroundColor: 'rgba(0, 0, 0, 0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {video.thumbnailKey ? (
          <img
            src={video.thumbnailKey}
            alt={video.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '2.5rem', opacity: 0.5 }}>🎬</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--foreground-muted)', opacity: 0.6 }}>
              {FORMAT_LABELS[video.format] || video.format}
            </span>
          </div>
        )}
        {/* Duration badge */}
        {video.durationSec > 0 && (
          <span style={{
            position: 'absolute',
            bottom: '0.5rem',
            left: '0.5rem',
            backgroundColor: 'rgba(0,0,0,0.7)',
            color: 'white',
            fontSize: '0.6875rem',
            fontWeight: 600,
            padding: '0.125rem 0.5rem',
            borderRadius: '4px',
          }}>
            {formatDuration(video.durationSec)}
          </span>
        )}
        {/* Format badge */}
        <span style={{
          position: 'absolute',
          bottom: '0.5rem',
          right: '0.5rem',
          backgroundColor: 'rgba(0,0,0,0.7)',
          color: 'white',
          fontSize: '0.6875rem',
          fontWeight: 600,
          padding: '0.125rem 0.5rem',
          borderRadius: '4px',
        }}>
          {video.format}
        </span>
      </div>

      {/* Content */}
      <div style={{ padding: '0.875rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <h4 style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--foreground)', lineHeight: 1.3, flex: 1 }}>
            {video.name || 'סרטון ללא שם'}
          </h4>
          <span style={{
            padding: '0.125rem 0.5rem',
            borderRadius: '9999px',
            fontSize: '0.6875rem',
            fontWeight: 600,
            backgroundColor: status.bg,
            color: status.color,
            whiteSpace: 'nowrap',
          }}>
            {status.label}
          </span>
        </div>

        <p style={{ fontSize: '0.75rem', color: 'var(--foreground-muted)', marginBottom: '0.75rem' }}>
          {formatDate(video.createdAt)}
          {video.sentToClientAt && (
            <span style={{ marginRight: '0.5rem', color: '#06b6d4' }}>
              • נשלח {formatDate(video.sentToClientAt)}
            </span>
          )}
        </p>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '0.375rem' }}>
          {video.renderOutputKey && (
            <>
              <a
                href={video.renderOutputKey}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  padding: '0.3rem 0.625rem',
                  borderRadius: '0.375rem',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--surface)',
                  color: 'var(--foreground)',
                  textDecoration: 'none',
                  cursor: 'pointer',
                }}
              >
                ▶ תצוגה
              </a>
              <a
                href={video.renderOutputKey}
                download
                style={{
                  padding: '0.3rem 0.625rem',
                  borderRadius: '0.375rem',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--surface)',
                  color: 'var(--foreground)',
                  textDecoration: 'none',
                  cursor: 'pointer',
                }}
              >
                ⬇ הורדה
              </a>
            </>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onSendEmail(); }}
            style={{
              padding: '0.3rem 0.625rem',
              borderRadius: '0.375rem',
              fontSize: '0.75rem',
              fontWeight: 600,
              border: 'none',
              background: 'linear-gradient(135deg, #00B5FE 0%, #0090cc 100%)',
              color: 'white',
              cursor: 'pointer',
            }}
          >
            📧 שלח ללקוח
          </button>
        </div>
      </div>
    </div>
  );
}

// --- LIST CARD COMPONENT ---
function VideoCardList({
  video,
  selected,
  onToggleSelect,
  onSendEmail,
  hoverHandlers,
}: {
  video: Project;
  selected: boolean;
  onToggleSelect: () => void;
  onSendEmail: () => void;
  hoverHandlers: { onMouseEnter: (e: React.MouseEvent<HTMLDivElement>) => void; onMouseLeave: (e: React.MouseEvent<HTMLDivElement>) => void };
}) {
  const status = STATUS_CONFIG[video.status] || STATUS_CONFIG.draft;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        padding: '0.75rem 1rem',
        borderRadius: '0.625rem',
        backgroundColor: 'var(--surface-raised)',
        border: selected ? '2px solid var(--accent)' : '1px solid var(--border)',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
      }}
      {...hoverHandlers}
    >
      {/* Checkbox */}
      <div
        onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}
        style={{
          width: '20px',
          height: '20px',
          borderRadius: '4px',
          border: selected ? '2px solid var(--accent)' : '2px solid var(--border)',
          backgroundColor: selected ? 'var(--accent)' : 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          fontSize: '0.6875rem',
          color: 'white',
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        {selected ? '✓' : ''}
      </div>

      {/* Mini thumbnail */}
      <div style={{
        width: '64px',
        height: '48px',
        borderRadius: '0.375rem',
        backgroundColor: 'rgba(0, 0, 0, 0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        flexShrink: 0,
      }}>
        {video.thumbnailKey ? (
          <img src={video.thumbnailKey} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span style={{ fontSize: '1.25rem', opacity: 0.4 }}>🎬</span>
        )}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {video.name || 'סרטון ללא שם'}
        </p>
        <p style={{ fontSize: '0.75rem', color: 'var(--foreground-muted)' }}>
          {formatDate(video.createdAt)} • {FORMAT_LABELS[video.format] || video.format} • {formatDuration(video.durationSec)}
        </p>
      </div>

      {/* Status badge */}
      <span style={{
        padding: '0.125rem 0.625rem',
        borderRadius: '9999px',
        fontSize: '0.6875rem',
        fontWeight: 600,
        backgroundColor: status.bg,
        color: status.color,
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}>
        {status.label}
      </span>

      {/* Sent date */}
      {video.sentToClientAt && (
        <span style={{ fontSize: '0.6875rem', color: '#06b6d4', whiteSpace: 'nowrap', flexShrink: 0 }}>
          נשלח {formatDate(video.sentToClientAt)}
        </span>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: '0.375rem', flexShrink: 0 }}>
        {video.renderOutputKey && (
          <a
            href={video.renderOutputKey}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: '0.25rem 0.5rem',
              borderRadius: '0.375rem',
              fontSize: '0.6875rem',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--surface)',
              color: 'var(--foreground)',
              textDecoration: 'none',
            }}
          >
            ▶
          </a>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onSendEmail(); }}
          style={{
            padding: '0.25rem 0.5rem',
            borderRadius: '0.375rem',
            fontSize: '0.6875rem',
            fontWeight: 600,
            border: 'none',
            background: 'linear-gradient(135deg, #00B5FE 0%, #0090cc 100%)',
            color: 'white',
            cursor: 'pointer',
          }}
        >
          📧 שלח
        </button>
      </div>
    </div>
  );
}
