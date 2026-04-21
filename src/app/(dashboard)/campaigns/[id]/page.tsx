'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useCampaigns } from '@/lib/api/use-entity';
import { useToast } from '@/components/ui/toast';
import { Modal } from '@/components/ui/modal';
import { SmartVariationsPanel, type CampaignVariation } from '@/components/ui/smart-variations';
import type { Campaign, CampaignStatus } from '@/lib/db/schema';

const STATUS_COLORS: Record<CampaignStatus, string> = {
  draft: '#6b7280',
  in_progress: '#3b82f6',
  waiting_approval: '#f59e0b',
  approved: '#10b981',
  scheduled: '#8b5cf6',
  active: '#22c55e',
  completed: '#00B5FE',
};

const STATUS_LABELS: Record<CampaignStatus, string> = {
  draft: 'טיוטה',
  in_progress: 'בתהליך',
  waiting_approval: 'ממתין לאישור',
  approved: 'מאושר',
  scheduled: 'מתוזמן',
  active: 'פעיל',
  completed: 'הושלם',
};

const TYPE_LABELS: Record<string, string> = {
  paid_social: 'ממומן',
  organic_social: 'אורגני',
  lead_gen: 'לידים',
  awareness: 'מודעות',
  remarketing: 'רימרקטינג',
  podcast_promo: 'קידום פודקאסט',
  custom: 'מותאם',
};

const PLATFORM_LABELS: Record<string, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  multi_platform: 'מולטי-פלטפורמה',
};

const MEDIA_TYPE_LABELS: Record<string, string> = {
  image: 'תמונה',
  video: 'וידאו',
};

const STATUS_OPTIONS: Array<{ value: CampaignStatus; label: string }> = [
  { value: 'draft', label: 'טיוטה' },
  { value: 'in_progress', label: 'בתהליך' },
  { value: 'waiting_approval', label: 'ממתין לאישור' },
  { value: 'approved', label: 'מאושר' },
  { value: 'scheduled', label: 'מתוזמן' },
  { value: 'active', label: 'פעיל' },
  { value: 'completed', label: 'הושלם' },
];

export default function CampaignDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: campaigns, loading, update, remove } = useCampaigns();
  const toast = useToast();

  const campaign = campaigns.find((c) => c.id === id);

  const [isEditingCaption, setIsEditingCaption] = useState(false);
  const [editCaption, setEditCaption] = useState(campaign?.caption || '');

  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [editNotes, setEditNotes] = useState(campaign?.notes || '');

  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<CampaignStatus>(campaign?.status || 'draft');

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isVariationsOpen, setIsVariationsOpen] = useState(false);

  if (loading) {
    return (
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem 0' }}>
          <p style={{ color: 'var(--foreground-muted)' }}>טוען...</p>
        </div>
      </main>
    );
  }

  if (!campaign) {
    return (
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem 0' }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: 'var(--foreground-muted)', marginBottom: '1rem' }}>קמפיין לא נמצא</p>
            <Link
              href="/campaigns"
              style={{
                color: 'var(--accent)',
                textDecoration: 'none',
                fontSize: '0.95rem',
                fontWeight: '500',
              }}
            >
              חזור לקמפיינים
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const handleCaptionSave = async () => {
    try {
      await update(campaign.id, {
        ...campaign,
        caption: editCaption,
      });
      toast('כותרת עודכנה בהצלחה', 'success');
      setIsEditingCaption(false);
    } catch (error) {
      toast('שגיאה בעדכון כותרת', 'error');
    }
  };

  const handleNotesSave = async () => {
    try {
      await update(campaign.id, {
        ...campaign,
        notes: editNotes,
      });
      toast('הערות עודכנו בהצלחה', 'success');
      setIsEditingNotes(false);
    } catch (error) {
      toast('שגיאה בעדכון הערות', 'error');
    }
  };

  const handleStatusChange = async () => {
    try {
      await update(campaign.id, {
        ...campaign,
        status: newStatus,
      });
      toast('סטטוס עודכן בהצלחה', 'success');
      setIsStatusModalOpen(false);
    } catch (error) {
      toast('שגיאה בעדכון סטטוס', 'error');
    }
  };

  const handleDelete = async () => {
    try {
      await remove(campaign.id);
      toast('קמפיין נמחק בהצלחה', 'success');
      setTimeout(() => {
        window.location.href = '/campaigns';
      }, 500);
    } catch (error) {
      toast('שגיאה במחיקת קמפיין', 'error');
    }
  };

  const handleApplyVariation = async (variation: CampaignVariation) => {
    try {
      await update(campaign.id, {
        ...campaign,
        caption: variation.primaryText,
        notes: campaign.notes
          ? `${campaign.notes}\n\n— וריאציה ${variation.angleLabel} הוחלה —\nכותרת: ${variation.headline}\nCTA: ${variation.cta}`
          : `— וריאציה ${variation.angleLabel} —\nכותרת: ${variation.headline}\nCTA: ${variation.cta}`,
      });
      toast('הווריאציה הוחלה בהצלחה על הקמפיין', 'ai' as any);
      setIsVariationsOpen(false);
    } catch {
      toast('שגיאה בהחלת הווריאציה', 'error');
    }
  };

  const handleCreateFromVariation = async (variation: CampaignVariation) => {
    try {
      // Navigate to campaign builder with variation data as query params
      const params = new URLSearchParams({
        fromVariation: '1',
        clientId: campaign.clientId,
        clientName: campaign.clientName,
        campaignType: campaign.campaignType,
        platform: campaign.platform,
        mediaType: campaign.mediaType,
        caption: variation.primaryText,
        headline: variation.headline,
        objective: campaign.objective || '',
        budget: String(campaign.budget || 0),
        notes: `וריאציה (${variation.angleLabel}) מקמפיין: ${campaign.campaignName}\nCTA: ${variation.cta}\n${variation.explanation}`,
      });
      window.location.href = `/campaign-builder?${params.toString()}`;
    } catch {
      toast('שגיאה ביצירת קמפיין חדש', 'error');
    }
  };

  return (
    <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <Link
              href="/campaigns"
              style={{
                color: 'var(--foreground-muted)',
                textDecoration: 'none',
                fontSize: '0.95rem',
                marginBottom: '1rem',
                display: 'inline-block',
              }}
            >
              ← חזור לקמפיינים
            </Link>
            <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--foreground)', margin: '0.5rem 0 0 0' }}>
              {campaign.campaignName}
            </h1>
            <p style={{ color: 'var(--foreground-muted)', fontSize: '0.95rem', marginTop: '0.5rem' }}>
              {campaign.clientName}
            </p>
          </div>
          <div
            style={{
              backgroundColor: STATUS_COLORS[campaign.status],
              color: 'white',
              padding: '0.75rem 1.5rem',
              borderRadius: '0.5rem',
              fontSize: '0.95rem',
              fontWeight: '600',
            }}
          >
            {STATUS_LABELS[campaign.status]}
          </div>
        </div>

        {/* Main Info */}
        <div
          style={{
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '0.75rem',
            padding: '2rem',
          }}
        >
          <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: 'var(--foreground)', marginTop: 0 }}>
            פרטי הקמפיין
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '2rem',
              marginTop: '1.5rem',
            }}
          >
            <div>
              <p style={{ color: 'var(--foreground-muted)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                סוג קמפיין
              </p>
              <p style={{ color: 'var(--foreground)', fontSize: '1rem', fontWeight: '600', margin: 0 }}>
                {TYPE_LABELS[campaign.campaignType]}
              </p>
            </div>
            <div>
              <p style={{ color: 'var(--foreground-muted)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                פלטפורמה
              </p>
              <p style={{ color: 'var(--foreground)', fontSize: '1rem', fontWeight: '600', margin: 0 }}>
                {PLATFORM_LABELS[campaign.platform]}
              </p>
            </div>
            <div>
              <p style={{ color: 'var(--foreground-muted)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                סוג תוכן
              </p>
              <p style={{ color: 'var(--foreground)', fontSize: '1rem', fontWeight: '600', margin: 0 }}>
                {MEDIA_TYPE_LABELS[campaign.mediaType]}
              </p>
            </div>
            <div>
              <p style={{ color: 'var(--foreground-muted)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                תקציב
              </p>
              <p style={{ color: 'var(--foreground)', fontSize: '1rem', fontWeight: '600', margin: 0 }}>
                ₪{campaign.budget.toLocaleString('he-IL')}
              </p>
            </div>
            <div>
              <p style={{ color: 'var(--foreground-muted)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                תאריך התחלה
              </p>
              <p style={{ color: 'var(--foreground)', fontSize: '1rem', fontWeight: '600', margin: 0 }}>
                {campaign.startDate
                  ? new Date(campaign.startDate).toLocaleDateString('he-IL')
                  : '—'}
              </p>
            </div>
            <div>
              <p style={{ color: 'var(--foreground-muted)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                תאריך סיום
              </p>
              <p style={{ color: 'var(--foreground)', fontSize: '1rem', fontWeight: '600', margin: 0 }}>
                {campaign.endDate
                  ? new Date(campaign.endDate).toLocaleDateString('he-IL')
                  : '—'}
              </p>
            </div>
          </div>
        </div>

        {/* Objective */}
        <div
          style={{
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '0.75rem',
            padding: '2rem',
          }}
        >
          <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: 'var(--foreground)', marginTop: 0 }}>
            מטרת הקמפיין
          </h2>
          <p style={{ color: 'var(--foreground)', fontSize: '0.95rem', lineHeight: '1.6', margin: '1rem 0 0 0' }}>
            {campaign.objective}
          </p>
        </div>

        {/* Caption */}
        <div
          style={{
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '0.75rem',
            padding: '2rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: 'var(--foreground)', margin: 0 }}>
              כותרת/תיאור
            </h2>
            {!isEditingCaption && (
              <button
                onClick={() => {
                  setEditCaption(campaign.caption);
                  setIsEditingCaption(true);
                }}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: 'transparent',
                  color: 'var(--foreground-muted)',
                  border: '1px solid var(--border)',
                  borderRadius: '0.4rem',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--surface-raised)';
                  (e.currentTarget as HTMLElement).style.color = 'var(--foreground)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                  (e.currentTarget as HTMLElement).style.color = 'var(--foreground-muted)';
                }}
              >
                ערוך
              </button>
            )}
          </div>

          {isEditingCaption ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <textarea
                value={editCaption}
                onChange={(e) => setEditCaption(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: 'var(--surface-raised)',
                  border: '1px solid var(--border)',
                  borderRadius: '0.5rem',
                  color: 'var(--foreground)',
                  fontSize: '0.95rem',
                  minHeight: '100px',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  onClick={handleCaptionSave}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: 'var(--accent)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.4rem',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    transition: 'opacity 0.2s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.8')}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                >
                  שמור
                </button>
                <button
                  onClick={() => setIsEditingCaption(false)}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: 'transparent',
                    color: 'var(--foreground-muted)',
                    border: '1px solid var(--border)',
                    borderRadius: '0.4rem',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--surface-raised)';
                    (e.currentTarget as HTMLElement).style.color = 'var(--foreground)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                    (e.currentTarget as HTMLElement).style.color = 'var(--foreground-muted)';
                  }}
                >
                  ביטול
                </button>
              </div>
            </div>
          ) : (
            <p style={{ color: 'var(--foreground)', fontSize: '0.95rem', lineHeight: '1.6', margin: 0 }}>
              {campaign.caption || '—'}
            </p>
          )}
        </div>

        {/* Media Section */}
        <div
          style={{
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '0.75rem',
            padding: '2rem',
          }}
        >
          <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: 'var(--foreground)', marginTop: 0 }}>
            תוכן ומדיה
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1.5rem',
              marginTop: '1.5rem',
            }}
          >
            {campaign.linkedVideoProjectId && (
              <div style={{ backgroundColor: 'var(--surface-raised)', padding: '1rem', borderRadius: '0.5rem' }}>
                <p style={{ color: 'var(--foreground-muted)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                  פרויקט וידאו מקושר
                </p>
                <p style={{ color: 'var(--foreground)', fontSize: '0.95rem', fontWeight: '600', margin: 0 }}>
                  {campaign.linkedVideoProjectId}
                </p>
              </div>
            )}
            {campaign.linkedClientFileId && (
              <div style={{ backgroundColor: 'var(--surface-raised)', padding: '1rem', borderRadius: '0.5rem' }}>
                <p style={{ color: 'var(--foreground-muted)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                  קובץ לקוח מקושר
                </p>
                <p style={{ color: 'var(--foreground)', fontSize: '0.95rem', fontWeight: '600', margin: 0 }}>
                  {campaign.linkedClientFileId}
                </p>
              </div>
            )}
            {campaign.externalMediaUrl && (
              <div style={{ backgroundColor: 'var(--surface-raised)', padding: '1rem', borderRadius: '0.5rem' }}>
                <p style={{ color: 'var(--foreground-muted)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                  קישור חיצוני
                </p>
                <a
                  href={campaign.externalMediaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: 'var(--accent)',
                    textDecoration: 'none',
                    fontSize: '0.9rem',
                    wordBreak: 'break-all',
                  }}
                >
                  {campaign.externalMediaUrl}
                </a>
              </div>
            )}
            {!campaign.linkedVideoProjectId && !campaign.linkedClientFileId && !campaign.externalMediaUrl && (
              <p style={{ color: 'var(--foreground-muted)', fontSize: '0.9rem', gridColumn: '1 / -1' }}>
                לא מקושרים מדיה או קבצים
              </p>
            )}
          </div>
        </div>

        {/* Notes */}
        <div
          style={{
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '0.75rem',
            padding: '2rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: 'var(--foreground)', margin: 0 }}>
              הערות
            </h2>
            {!isEditingNotes && (
              <button
                onClick={() => {
                  setEditNotes(campaign.notes);
                  setIsEditingNotes(true);
                }}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: 'transparent',
                  color: 'var(--foreground-muted)',
                  border: '1px solid var(--border)',
                  borderRadius: '0.4rem',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--surface-raised)';
                  (e.currentTarget as HTMLElement).style.color = 'var(--foreground)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                  (e.currentTarget as HTMLElement).style.color = 'var(--foreground-muted)';
                }}
              >
                ערוך
              </button>
            )}
          </div>

          {isEditingNotes ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: 'var(--surface-raised)',
                  border: '1px solid var(--border)',
                  borderRadius: '0.5rem',
                  color: 'var(--foreground)',
                  fontSize: '0.95rem',
                  minHeight: '100px',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  onClick={handleNotesSave}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: 'var(--accent)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.4rem',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    transition: 'opacity 0.2s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.8')}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                >
                  שמור
                </button>
                <button
                  onClick={() => setIsEditingNotes(false)}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: 'transparent',
                    color: 'var(--foreground-muted)',
                    border: '1px solid var(--border)',
                    borderRadius: '0.4rem',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--surface-raised)';
                    (e.currentTarget as HTMLElement).style.color = 'var(--foreground)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                    (e.currentTarget as HTMLElement).style.color = 'var(--foreground-muted)';
                  }}
                >
                  ביטול
                </button>
              </div>
            </div>
          ) : (
            <p style={{ color: 'var(--foreground)', fontSize: '0.95rem', lineHeight: '1.6', margin: 0 }}>
              {campaign.notes || '—'}
            </p>
          )}
        </div>

        {/* Activity Log Placeholder */}
        <div
          style={{
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '0.75rem',
            padding: '2rem',
          }}
        >
          <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: 'var(--foreground)', marginTop: 0 }}>
            יומן פעילות
          </h2>
          <p style={{ color: 'var(--foreground-muted)', fontSize: '0.95rem', margin: '1rem 0 0 0' }}>
            יומן הפעילות יוצג כאן בעתיד
          </p>
        </div>

        {/* Actions */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '0.75rem',
            paddingBottom: '1rem',
          }}
        >
          <button
            onClick={() => setIsVariationsOpen(true)}
            className="ux-btn ux-btn-glow"
            style={{
              padding: '0.75rem 1rem',
              background: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(59,130,246,0.15))',
              color: '#a78bfa',
              border: '1px solid rgba(139,92,246,0.3)',
              borderRadius: '0.5rem',
              fontSize: '0.95rem',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'linear-gradient(135deg, rgba(139,92,246,0.25), rgba(59,130,246,0.25))';
              (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
              (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px rgba(139,92,246,0.2)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(59,130,246,0.15))';
              (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
              (e.currentTarget as HTMLElement).style.boxShadow = 'none';
            }}
          >
            <span>🧬</span>
            צור וריאציות חכמות
          </button>
          <button
            onClick={() => setIsStatusModalOpen(true)}
            style={{
              padding: '0.75rem 1rem',
              backgroundColor: 'var(--accent)',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              fontSize: '0.95rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'opacity 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.8')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          >
            שינוי סטטוס
          </button>
          <button
            onClick={() => setIsDeleteModalOpen(true)}
            style={{
              padding: '0.75rem 1rem',
              backgroundColor: 'transparent',
              color: '#ef4444',
              border: '1px solid #ef4444',
              borderRadius: '0.5rem',
              fontSize: '0.95rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
            }}
          >
            מחק קמפיין
          </button>
        </div>
      </div>

      {/* Status Change Modal */}
      <Modal open={isStatusModalOpen} onClose={() => setIsStatusModalOpen(false)} title="שינוי סטטוס">
        <div style={{ padding: '1.5rem', maxWidth: '400px' }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '500', marginBottom: '0.75rem' }}>
              בחר סטטוס חדש
            </label>
            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value as CampaignStatus)}
              style={{
                width: '100%',
                padding: '0.75rem',
                backgroundColor: 'var(--surface-raised)',
                border: '1px solid var(--border)',
                borderRadius: '0.5rem',
                color: 'var(--foreground)',
                fontSize: '0.95rem',
                cursor: 'pointer',
                boxSizing: 'border-box',
              }}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={handleStatusChange}
              style={{
                flex: 1,
                padding: '0.75rem',
                backgroundColor: 'var(--accent)',
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                fontSize: '0.95rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'opacity 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.8')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
            >
              עדכן
            </button>
            <button
              onClick={() => setIsStatusModalOpen(false)}
              style={{
                flex: 1,
                padding: '0.75rem',
                backgroundColor: 'transparent',
                color: 'var(--foreground-muted)',
                border: '1px solid var(--border)',
                borderRadius: '0.5rem',
                fontSize: '0.95rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--surface-raised)';
                (e.currentTarget as HTMLElement).style.color = 'var(--foreground)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                (e.currentTarget as HTMLElement).style.color = 'var(--foreground-muted)';
              }}
            >
              ביטול
            </button>
          </div>
        </div>
      </Modal>

      {/* Smart Variations Modal */}
      <Modal
        open={isVariationsOpen}
        onClose={() => setIsVariationsOpen(false)}
        title="וריאציות חכמות"
      >
        <div style={{ padding: '1.5rem', maxWidth: '900px', minWidth: '360px' }}>
          <SmartVariationsPanel
            campaignId={campaign.id}
            primaryText={campaign.caption || ''}
            headline={''}
            objective={campaign.objective || ''}
            campaignType={campaign.campaignType}
            platform={campaign.platform}
            clientName={campaign.clientName}
            clientId={campaign.clientId}
            onApply={handleApplyVariation}
            onCreateNew={handleCreateFromVariation}
            onClose={() => setIsVariationsOpen(false)}
          />
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal open={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="אישור מחיקה">
        <div style={{ padding: '1.5rem', maxWidth: '400px' }}>
          <p style={{ color: 'var(--foreground-muted)', marginBottom: '1.5rem' }}>
            האם אתה בטוח שברצונך למחוק קמפיין זה? לא ניתן לשחזר פעולה זו.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={handleDelete}
              style={{
                flex: 1,
                padding: '0.75rem',
                backgroundColor: '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                fontSize: '0.95rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'opacity 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.8')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
            >
              מחק
            </button>
            <button
              onClick={() => setIsDeleteModalOpen(false)}
              style={{
                flex: 1,
                padding: '0.75rem',
                backgroundColor: 'transparent',
                color: 'var(--foreground-muted)',
                border: '1px solid var(--border)',
                borderRadius: '0.5rem',
                fontSize: '0.95rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--surface-raised)';
                (e.currentTarget as HTMLElement).style.color = 'var(--foreground)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                (e.currentTarget as HTMLElement).style.color = 'var(--foreground-muted)';
              }}
            >
              ביטול
            </button>
          </div>
        </div>
      </Modal>
    </main>
  );
}
