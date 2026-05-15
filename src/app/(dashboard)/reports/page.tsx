'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { useClients, useCampaigns } from '@/lib/api/use-entity';
import { useToast } from '@/components/ui/toast';
import type { Report, ReportType, ReportMode } from '@/lib/db/schema';

const REPORT_TYPE_META: Record<ReportType, { label: string; icon: string; description: string }> = {
  campaign: { label: 'דוח קמפיין', icon: '📊', description: 'ביצועים, מודעות, לידים ופעולות של קמפיין בודד' },
  client_monthly: { label: 'דוח חודשי ללקוח', icon: '📋', description: 'סיכום חודשי — קמפיינים, תוצאות, המלצות' },
  internal_manager: { label: 'דוח מנהל פנימי', icon: '🔒', description: 'בריאות לקוח, סיכונים, פעולות אוטומציה' },
};

const STATUS_META: Record<string, { label: string; color: string }> = {
  generating: { label: 'מפיק...', color: '#f59e0b' },
  ready: { label: 'מוכן', color: '#22c55e' },
  failed: { label: 'נכשל', color: '#ef4444' },
  sent: { label: 'נשלח', color: '#3b82f6' },
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const months = ['ינו', 'פבר', 'מרץ', 'אפר', 'מאי', 'יונ', 'יול', 'אוג', 'ספט', 'אוק', 'נוב', 'דצמ'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

export default function ReportsPage() {
  const { data: clients } = useClients();
  const { data: campaigns } = useCampaigns();
  const toast = useToast();

  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  // Generate form state
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState<ReportType>('client_monthly');
  const [formMode, setFormMode] = useState<ReportMode>('client_facing');
  const [formClientId, setFormClientId] = useState('');
  const [formCampaignId, setFormCampaignId] = useState('');
  const [sendEmail, setSendEmail] = useState('');
  const [sendingId, setSendingId] = useState<string | null>(null);

  // Load reports
  const loadReports = useCallback(async () => {
    try {
      const res = await fetch('/api/data/reports?limit=100');
      if (res.ok) {
        const data = await res.json();
        setReports(data.reports || []);
      }
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadReports(); }, [loadReports]);

  // Generate report
  const handleGenerate = useCallback(async () => {
    if (!formClientId || generating) return;
    const client = (clients || []).find(c => c.id === formClientId);
    if (!client) { toast('יש לבחור לקוח', 'error'); return; }

    if (formType === 'campaign' && !formCampaignId) {
      toast('יש לבחור קמפיין', 'error');
      return;
    }

    const campaign = formCampaignId ? (campaigns || []).find(c => c.id === formCampaignId) : null;
    const now = new Date();
    const periodEnd = now.toISOString().split('T')[0];
    const periodStart = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()).toISOString().split('T')[0];

    setGenerating(true);
    try {
      const res = await fetch('/api/data/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: formType,
          mode: formType === 'internal_manager' ? 'internal' : formMode,
          clientId: client.id,
          clientName: client.name,
          campaignId: campaign?.id || null,
          campaignName: campaign?.campaignName || null,
          periodStart,
          periodEnd,
        }),
      });
      const data = await res.json();
      if (res.ok && data.report) {
        toast('הדוח הופק בהצלחה!', 'success');
        setShowForm(false);
        loadReports();
      } else {
        toast(data.error || 'שגיאה בהפקת דוח', 'error');
      }
    } catch {
      toast('שגיאה בחיבור לשרת', 'error');
    }
    setGenerating(false);
  }, [formClientId, formCampaignId, formType, formMode, clients, campaigns, generating, toast, loadReports]);

  // Send report
  const handleSend = useCallback(async (reportId: string) => {
    if (!sendEmail || sendingId) return;
    setSendingId(reportId);
    try {
      const res = await fetch(`/api/data/reports/${reportId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: sendEmail }),
      });
      const data = await res.json();
      if (res.ok) {
        toast(data.message || 'הדוח נשלח', 'success');
        setSendEmail('');
        loadReports();
      } else {
        toast(data.error || 'שגיאה בשליחה', 'error');
      }
    } catch {
      toast('שגיאה בחיבור לשרת', 'error');
    }
    setSendingId(null);
  }, [sendEmail, sendingId, toast, loadReports]);

  // Client campaigns for form
  const clientCampaigns = formClientId
    ? (campaigns || []).filter(c => c.clientId === formClientId)
    : [];

  const selectStyle: React.CSSProperties = {
    background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: '0.5rem',
    padding: '0.5rem 0.75rem', fontSize: '0.85rem', color: 'var(--foreground)', direction: 'rtl',
    outline: 'none', width: '100%',
  };

  return (
    <div style={{ padding: '2rem', direction: 'rtl', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>
            📊 דוחות
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--foreground-muted)', marginTop: '0.25rem' }}>
            הפקת דוחות ביצועים, דוחות ללקוח ודוחות פנימיים
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '0.5rem',
            padding: '0.6rem 1.25rem', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer',
          }}
        >
          + הפק דוח חדש
        </button>
      </div>

      {/* Generate Form */}
      {showForm && (
        <div style={{
          background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: '0.75rem',
          padding: '1.25rem', marginBottom: '1.5rem',
        }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--foreground)' }}>
            הפקת דוח חדש
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--foreground-muted)', display: 'block', marginBottom: '0.25rem' }}>סוג דוח</label>
              <select value={formType} onChange={e => setFormType(e.target.value as ReportType)} style={selectStyle}>
                {Object.entries(REPORT_TYPE_META).map(([key, meta]) => (
                  <option key={key} value={key}>{meta.icon} {meta.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--foreground-muted)', display: 'block', marginBottom: '0.25rem' }}>לקוח</label>
              <select value={formClientId} onChange={e => { setFormClientId(e.target.value); setFormCampaignId(''); }} style={selectStyle}>
                <option value="">בחר לקוח...</option>
                {(clients || []).map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            {formType === 'campaign' && (
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--foreground-muted)', display: 'block', marginBottom: '0.25rem' }}>קמפיין</label>
                <select value={formCampaignId} onChange={e => setFormCampaignId(e.target.value)} style={selectStyle}>
                  <option value="">בחר קמפיין...</option>
                  {clientCampaigns.map(c => (
                    <option key={c.id} value={c.id}>{c.campaignName}</option>
                  ))}
                </select>
              </div>
            )}
            {formType !== 'internal_manager' && (
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--foreground-muted)', display: 'block', marginBottom: '0.25rem' }}>מצב</label>
                <select value={formMode} onChange={e => setFormMode(e.target.value as ReportMode)} style={selectStyle}>
                  <option value="client_facing">ללקוח</option>
                  <option value="internal">פנימי</option>
                </select>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={handleGenerate}
              disabled={generating || !formClientId}
              style={{
                background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '0.5rem',
                padding: '0.5rem 1rem', fontWeight: 600, cursor: generating ? 'wait' : 'pointer',
                opacity: generating || !formClientId ? 0.6 : 1,
              }}
            >
              {generating ? '⏳ מפיק...' : '📊 הפק דוח'}
            </button>
            <button
              onClick={() => setShowForm(false)}
              style={{
                background: 'var(--surface)', color: 'var(--foreground)', border: '1px solid var(--border)',
                borderRadius: '0.5rem', padding: '0.5rem 1rem', cursor: 'pointer',
              }}
            >
              ביטול
            </button>
          </div>
        </div>
      )}

      {/* Report Type Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
        {Object.entries(REPORT_TYPE_META).map(([key, meta]) => {
          const count = reports.filter(r => r.type === key).length;
          return (
            <div key={key} style={{
              background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: '0.75rem',
              padding: '1rem', textAlign: 'center',
            }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>{meta.icon}</div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--foreground)' }}>{meta.label}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--foreground-muted)', marginTop: '0.25rem' }}>{meta.description}</div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent)', marginTop: '0.5rem' }}>{count} דוחות</div>
            </div>
          );
        })}
      </div>

      {/* Reports List */}
      <div style={{
        background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: '0.75rem',
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>
            היסטוריית דוחות ({reports.length})
          </h3>
        </div>

        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--foreground-muted)' }}>טוען דוחות...</div>
        ) : reports.length === 0 ? (
          <div style={{ padding: '2.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📊</div>
            <div style={{ fontWeight: 600, color: 'var(--foreground)' }}>אין דוחות עדיין</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--foreground-muted)', marginTop: '0.25rem' }}>
              לחצו "הפק דוח חדש" להתחיל
            </div>
          </div>
        ) : (
          <div>
            {reports.map((report) => {
              const typeMeta = REPORT_TYPE_META[report.type] || { icon: '📄', label: report.type };
              const statusMeta = STATUS_META[report.status] || { label: report.status, color: '#6b7280' };
              return (
                <div key={report.id} style={{
                  padding: '0.875rem 1.25rem', borderBottom: '1px solid var(--border)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
                    <span style={{ fontSize: '1.25rem' }}>{typeMeta.icon}</span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--foreground)' }}>
                        {report.title}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--foreground-muted)', display: 'flex', gap: '0.75rem', marginTop: '0.15rem' }}>
                        <span>{report.clientName}</span>
                        <span>{formatDate(report.periodStart)} — {formatDate(report.periodEnd)}</span>
                        <span>{report.mode === 'internal' ? '🔒 פנימי' : '👤 ללקוח'}</span>
                        {report.sentTo && <span>📧 נשלח ל-{report.sentTo}</span>}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{
                      fontSize: '0.7rem', padding: '0.15rem 0.5rem', borderRadius: '999px',
                      background: `${statusMeta.color}18`, color: statusMeta.color, fontWeight: 600,
                    }}>
                      {statusMeta.label}
                    </span>
                    <button
                      onClick={() => window.open(`/api/data/reports/${report.id}?format=html`, '_blank')}
                      style={{
                        background: 'none', border: '1px solid var(--border)', borderRadius: '0.375rem',
                        padding: '0.2rem 0.5rem', fontSize: '0.75rem', cursor: 'pointer', color: 'var(--foreground)',
                      }}
                    >
                      👁 תצוגה מקדימה
                    </button>
                    {report.status !== 'sent' && report.mode === 'client_facing' && (
                      <div style={{ display: 'flex', gap: '0.25rem' }}>
                        <input
                          type="email"
                          placeholder="אימייל..."
                          value={sendingId === report.id ? sendEmail : ''}
                          onFocus={() => setSendingId(report.id)}
                          onChange={e => setSendEmail(e.target.value)}
                          style={{
                            ...selectStyle, width: '140px', padding: '0.2rem 0.4rem', fontSize: '0.7rem',
                          }}
                        />
                        <button
                          onClick={() => handleSend(report.id)}
                          disabled={sendingId === report.id && !sendEmail}
                          style={{
                            background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '0.375rem',
                            padding: '0.2rem 0.5rem', fontSize: '0.7rem', cursor: 'pointer', fontWeight: 600,
                          }}
                        >
                          📧 שלח
                        </button>
                      </div>
                    )}
                    <span style={{ fontSize: '0.7rem', color: 'var(--foreground-muted)' }}>
                      {formatDate(report.createdAt)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
