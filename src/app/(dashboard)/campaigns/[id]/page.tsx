'use client';

export const dynamic = 'force-dynamic';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCampaigns, useAdSets, useAds, useClients, useLeads } from '@/lib/api/use-entity';
import { useToast } from '@/components/ui/toast';
import { Modal } from '@/components/ui/modal';
import { SkeletonKPIRow } from '@/components/ui/skeleton';
import type {
  Campaign, AdSet, Ad, AdCreativeType, AdSetStatus, AdStatus,
} from '@/lib/db/schema';
import { computeHealth } from '@/lib/campaigns/health-engine';
import { buildCampaignLeadInsights } from '@/lib/leads/lead-quality';

// ── Labels ─────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  draft: 'טיוטה', in_progress: 'בתהליך', waiting_approval: 'ממתין לאישור',
  approved: 'מאושר', scheduled: 'מתוזמן', active: 'פעיל', completed: 'הושלם',
  paused: 'מושהה', rejected: 'נדחה', archived: 'ארכיון',
};

const STATUS_COLORS: Record<string, string> = {
  draft: '#6b7280', in_progress: '#3b82f6', waiting_approval: '#f59e0b',
  approved: '#22c55e', scheduled: '#8b5cf6', active: '#22c55e', completed: '#0ea5e9',
  paused: '#f59e0b', rejected: '#ef4444', archived: '#6b7280',
};

const CREATIVE_TYPE_LABELS: Record<AdCreativeType, string> = {
  image: 'תמונה', video: 'וידאו', carousel: 'קרוסלה', slideshow: 'מצגת',
};

const CREATIVE_TYPE_ICONS: Record<AdCreativeType, string> = {
  image: '🖼️', video: '🎬', carousel: '🎠', slideshow: '📊',
};

const PLATFORM_LABELS: Record<string, string> = {
  facebook: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok', multi_platform: 'רב פלטפורמה',
};

const CTA_LABELS: Record<string, string> = {
  LEARN_MORE: 'למידע נוסף', SIGN_UP: 'הרשמה', SHOP_NOW: 'קנה עכשיו',
  CONTACT_US: 'צור קשר', BOOK_NOW: 'הזמן עכשיו', DOWNLOAD: 'הורד',
  GET_OFFER: 'קבל הצעה', SUBSCRIBE: 'הירשם', APPLY_NOW: 'הגש מועמדות',
};

// ── Styles ──────────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  background: 'var(--surface-raised)',
  border: '1px solid var(--border)',
  borderRadius: '0.75rem',
  padding: '1.25rem',
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: '1.1rem', fontWeight: 700, color: 'var(--foreground)', margin: '0 0 1rem 0',
};

const badgeStyle = (bg: string, color: string): React.CSSProperties => ({
  fontSize: '0.65rem', fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: '0.25rem',
  background: `${bg}18`, color, border: `1px solid ${bg}30`, whiteSpace: 'nowrap' as const,
});

const metricStyle: React.CSSProperties = {
  textAlign: 'center' as const,
};

const metricValueStyle: React.CSSProperties = {
  fontSize: '1rem', fontWeight: 800, color: 'var(--foreground)',
};

const metricLabelStyle: React.CSSProperties = {
  fontSize: '0.6rem', color: 'var(--foreground-muted)', fontWeight: 600, marginTop: '0.1rem',
};

// ── Ad Card Component ──────────────────────────────────────────────────

function AdCard({ ad, onEdit }: { ad: Ad; onEdit: (ad: Ad) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isHovering, setIsHovering] = useState(false);

  const isVideo = ad.creativeType === 'video';
  const hasMedia = ad.mediaUrl && ad.mediaUrl.length > 5;
  const statusColor = STATUS_COLORS[ad.status] || '#6b7280';

  useEffect(() => {
    if (\!videoRef.current || \!isVideo) return;
    if (isHovering) {
      videoRef.current.play().catch(() => {});
    } else {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }, [isHovering, isVideo]);

  return (
    <div
      className="premium-card"
      style={{
        position: 'relative',
        borderRadius: '0.75rem',
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'transform 200ms, box-shadow 200ms',
      }}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      onClick={() => onEdit(ad)}
    >
      {/* Media area */}
      <div style={{
        position: 'relative',
        width: '100%',
        paddingBottom: '100%',
        background: 'var(--surface-sunken, #1a1a2e)',
        overflow: 'hidden',
      }}>
        {hasMedia ? (
          isVideo ? (
            <video
              ref={videoRef}
              src={ad.mediaUrl}
              poster={ad.thumbnailUrl || undefined}
              muted
              loop
              playsInline
              style={{
                position: 'absolute', top: 0, left: 0,
                width: '100%', height: '100%', objectFit: 'cover',
              }}
            />
          ) : (
            <img
              src={ad.mediaUrl}
              alt={ad.name}
              style={{
                position: 'absolute', top: 0, left: 0,
                width: '100%', height: '100%', objectFit: 'cover',
                transition: 'transform 300ms',
                transform: isHovering ? 'scale(1.05)' : 'scale(1)',
              }}
            />
          )
        ) : (
          <div style={{
            position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            color: 'var(--foreground-muted)', fontSize: '0.8rem',
          }}>
            <span style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>
              {CREATIVE_TYPE_ICONS[ad.creativeType]}
            </span>
            <span>אין מדיה</span>
          </div>
        )}

        {/* Performance overlay */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: 'linear-gradient(transparent, rgba(0,0,0,0.85))',
          padding: '1.5rem 0.75rem 0.6rem',
          display: 'flex', justifyContent: 'space-around',
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#fff' }}>
              {ad.ctr > 0 ? `${ad.ctr.toFixed(1)}%` : '—'}
            </div>
            <div style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>CTR</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#fff' }}>
              {ad.cpl > 0 ? `₪${ad.cpl.toFixed(0)}` : '—'}
            </div>
            <div style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>CPL</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#fff' }}>
              {ad.leads > 0 ? ad.leads : '—'}
            </div>
            <div style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>לידים</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#fff' }}>
              {ad.spend > 0 ? `₪${ad.spend.toFixed(0)}` : '—'}
            </div>
            <div style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>הוצאה</div>
          </div>
        </div>

        {/* Status badge */}
        <div style={{
          position: 'absolute', top: '0.5rem', right: '0.5rem',
          fontSize: '0.6rem', fontWeight: 700, padding: '0.2rem 0.5rem',
          borderRadius: '0.25rem', background: statusColor, color: '#fff',
        }}>
          {STATUS_LABELS[ad.status] || ad.status}
        </div>

        {/* Creative type badge */}
        <div style={{
          position: 'absolute', top: '0.5rem', left: '0.5rem',
          fontSize: '0.6rem', fontWeight: 700, padding: '0.2rem 0.45rem',
          borderRadius: '0.25rem', background: 'rgba(0,0,0,0.6)', color: '#fff',
        }}>
          {CREATIVE_TYPE_ICONS[ad.creativeType]} {CREATIVE_TYPE_LABELS[ad.creativeType]}
        </div>
      </div>

      {/* Ad info */}
      <div style={{ padding: '0.75rem' }}>
        <h4 style={{
          fontSize: '0.82rem', fontWeight: 700, color: 'var(--foreground)', margin: 0,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {ad.name}
        </h4>
        {ad.headline && (
          <p style={{
            fontSize: '0.72rem', color: 'var(--foreground-muted)', margin: '0.25rem 0 0',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {ad.headline}
          </p>
        )}
        {ad.primaryText && (
          <p style={{
            fontSize: '0.68rem', color: 'var(--foreground-muted)', margin: '0.2rem 0 0',
            overflow: 'hidden', textOverflow: 'ellipsis',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const,
            lineHeight: 1.4,
          }}>
            {ad.primaryText}
          </p>
        )}
        {ad.ctaType && (
          <div style={{ marginTop: '0.4rem' }}>
            <span style={{
              fontSize: '0.6rem', fontWeight: 700, padding: '0.15rem 0.4rem',
              borderRadius: '0.2rem', background: 'var(--accent)', color: '#fff',
            }}>
              {CTA_LABELS[ad.ctaType] || ad.ctaType}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Ad Set Section Component ───────────────────────────────────────────

function AdSetSection({
  adSet,
  adsForSet,
  onEditAd,
  onEditAdSet,
  onAddAd,
}: {
  adSet: AdSet;
  adsForSet: Ad[];
  onEditAd: (ad: Ad) => void;
  onEditAdSet: (adSet: AdSet) => void;
  onAddAd: (adSetId: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const statusColor = STATUS_COLORS[adSet.status] || '#6b7280';

  const totals = useMemo(() => {
    return adsForSet.reduce((acc, ad) => ({
      impressions: acc.impressions + (ad.impressions || 0),
      clicks: acc.clicks + (ad.clicks || 0),
      spend: acc.spend + (ad.spend || 0),
      leads: acc.leads + (ad.leads || 0),
      conversions: acc.conversions + (ad.conversions || 0),
    }), { impressions: 0, clicks: 0, spend: 0, leads: 0, conversions: 0 });
  }, [adsForSet]);

  const avgCtr = totals.impressions > 0 ? (totals.clicks / totals.impressions * 100) : 0;
  const avgCpl = totals.leads > 0 ? (totals.spend / totals.leads) : 0;

  return (
    <div style={{ ...cardStyle, borderRight: `3px solid ${statusColor}` }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: '0.75rem', marginBottom: collapsed ? 0 : '1rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
          <button
            type="button"
            onClick={() => setCollapsed(\!collapsed)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem',
              color: 'var(--foreground-muted)', padding: '0.25rem', transition: 'transform 150ms',
              transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
            }}
          >
            ▼
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <h3 style={{
                fontSize: '0.95rem', fontWeight: 700, color: 'var(--foreground)', margin: 0,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {adSet.name}
              </h3>
              <span style={badgeStyle(statusColor, statusColor)}>
                {STATUS_LABELS[adSet.status] || adSet.status}
              </span>
              <span style={{
                fontSize: '0.65rem', fontWeight: 600, color: 'var(--foreground-muted)',
                background: 'var(--surface-raised)', padding: '0.15rem 0.4rem',
                borderRadius: '0.2rem', border: '1px solid var(--border)',
              }}>
                {adsForSet.length} מודעות
              </span>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.35rem' }}>
              {adSet.geoLocations.length > 0 && (
                <span style={{ fontSize: '0.65rem', color: 'var(--foreground-muted)' }}>
                  📍 {adSet.geoLocations.slice(0, 3).join(', ')}
                  {adSet.geoLocations.length > 3 && ` +${adSet.geoLocations.length - 3}`}
                </span>
              )}
              {adSet.interests.length > 0 && (
                <span style={{ fontSize: '0.65rem', color: 'var(--foreground-muted)' }}>
                  🎯 {adSet.interests.slice(0, 2).join(', ')}
                  {adSet.interests.length > 2 && ` +${adSet.interests.length - 2}`}
                </span>
              )}
              {adSet.dailyBudget && (
                <span style={{ fontSize: '0.65rem', color: 'var(--foreground-muted)' }}>
                  💰 ₪{adSet.dailyBudget}/יום
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Metrics */}
        <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center', flexShrink: 0 }}>
          <div style={metricStyle}>
            <div style={metricValueStyle}>{totals.impressions > 0 ? `${(totals.impressions / 1000).toFixed(1)}K` : '—'}</div>
            <div style={metricLabelStyle}>חשיפות</div>
          </div>
          <div style={metricStyle}>
            <div style={metricValueStyle}>{avgCtr > 0 ? `${avgCtr.toFixed(1)}%` : '—'}</div>
            <div style={metricLabelStyle}>CTR</div>
          </div>
          <div style={metricStyle}>
            <div style={metricValueStyle}>{avgCpl > 0 ? `₪${avgCpl.toFixed(0)}` : '—'}</div>
            <div style={metricLabelStyle}>CPL</div>
          </div>
          <div style={metricStyle}>
            <div style={metricValueStyle}>{totals.leads > 0 ? totals.leads : '—'}</div>
            <div style={metricLabelStyle}>לידים</div>
          </div>
          <div style={metricStyle}>
            <div style={metricValueStyle}>{totals.spend > 0 ? `₪${totals.spend.toFixed(0)}` : '—'}</div>
            <div style={metricLabelStyle}>הוצאה</div>
          </div>
          <button
            type="button"
            onClick={() => onEditAdSet(adSet)}
            style={{
              padding: '0.3rem 0.5rem', fontSize: '0.68rem', fontWeight: 600,
              borderRadius: '0.3rem', cursor: 'pointer', background: 'transparent',
              border: '1px solid var(--border)', color: 'var(--foreground-muted)',
            }}
          >
            ✎
          </button>
        </div>
      </div>

      {/* Ads Grid */}
      {\!collapsed && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: '1rem',
        }}>
          {adsForSet.map((ad) => (
            <AdCard key={ad.id} ad={ad} onEdit={onEditAd} />
          ))}
          <button
            type="button"
            onClick={() => onAddAd(adSet.id)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              minHeight: '260px', borderRadius: '0.75rem', cursor: 'pointer',
              border: '2px dashed var(--border)', background: 'transparent',
              color: 'var(--foreground-muted)', transition: 'all 200ms', gap: '0.5rem',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--accent)';
              e.currentTarget.style.color = 'var(--accent)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.color = 'var(--foreground-muted)';
            }}
          >
            <span style={{ fontSize: '1.5rem' }}>+</span>
            <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>הוסף מודעה</span>
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────

export default function CampaignDetailPage() {
  const params = useParams();
  const campaignId = params.id as string;

  const { data: campaigns } = useCampaigns();
  const { data: allAdSets, create: createAdSet, update: updateAdSet } = useAdSets();
  const { data: allAds, create: createAd, update: updateAd } = useAds();
  const { data: clients } = useClients();
  const { data: allLeads } = useLeads();
  const { toast } = useToast();

  const campaign = useMemo(() => {
    return (campaigns || []).find((c) => c.id === campaignId) || null;
  }, [campaigns, campaignId]);

  const campaignAdSets = useMemo(() => {
    return (allAdSets || [])
      .filter((s) => s.campaignId === campaignId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [allAdSets, campaignId]);

  const campaignAds = useMemo(() => {
    return (allAds || []).filter((a) => a.campaignId === campaignId);
  }, [allAds, campaignId]);

  const adsByAdSet = useMemo(() => {
    const map: Record<string, Ad[]> = {};
    for (const adSet of campaignAdSets) {
      map[adSet.id] = campaignAds.filter((a) => a.adSetId === adSet.id);
    }
    return map;
  }, [campaignAdSets, campaignAds]);

  const totalMetrics = useMemo(() => {
    return campaignAds.reduce((acc, ad) => ({
      impressions: acc.impressions + (ad.impressions || 0),
      clicks: acc.clicks + (ad.clicks || 0),
      spend: acc.spend + (ad.spend || 0),
      leads: acc.leads + (ad.leads || 0),
      conversions: acc.conversions + (ad.conversions || 0),
    }), { impressions: 0, clicks: 0, spend: 0, leads: 0, conversions: 0 });
  }, [campaignAds]);

  const leadInsights = useMemo(() => {
    if (\!campaign || \!allLeads) return null;
    const map = buildCampaignLeadInsights([campaign], allLeads || []);
    return map[campaign.id] || null;
  }, [campaign, allLeads]);

  // ── Modals ──────────────────────────────────────────────────────────

  const [adSetModalOpen, setAdSetModalOpen] = useState(false);
  const [editingAdSet, setEditingAdSet] = useState<AdSet | null>(null);
  const [adSetForm, setAdSetForm] = useState({
    name: '', status: 'draft' as AdSetStatus,
    geoLocations: '', interests: '', dailyBudget: '',
    placements: 'feed',
  });

  const [adModalOpen, setAdModalOpen] = useState(false);
  const [editingAd, setEditingAd] = useState<Ad | null>(null);
  const [adModalAdSetId, setAdModalAdSetId] = useState<string>('');
  const [adForm, setAdForm] = useState({
    name: '', creativeType: 'image' as AdCreativeType, status: 'draft' as AdStatus,
    mediaUrl: '', primaryText: '', headline: '', description: '',
    ctaType: 'LEARN_MORE', ctaLink: '',
  });

  const handleOpenAdSetModal = useCallback((adSet?: AdSet) => {
    if (adSet) {
      setEditingAdSet(adSet);
      setAdSetForm({
        name: adSet.name, status: adSet.status,
        geoLocations: adSet.geoLocations.join(', '),
        interests: adSet.interests.join(', '),
        dailyBudget: adSet.dailyBudget ? String(adSet.dailyBudget) : '',
        placements: adSet.placements.join(', ') || 'feed',
      });
    } else {
      setEditingAdSet(null);
      setAdSetForm({ name: '', status: 'draft', geoLocations: '', interests: '', dailyBudget: '', placements: 'feed' });
    }
    setAdSetModalOpen(true);
  }, []);

  const handleSubmitAdSet = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (\!adSetForm.name.trim()) { toast('נא להכניס שם לקבוצת מודעות', 'error'); return; }
    try {
      const payload = {
        campaignId,
        name: adSetForm.name,
        status: adSetForm.status,
        ageMin: null, ageMax: null,
        genders: ['all' as const],
        geoLocations: adSetForm.geoLocations.split(',').map((s) => s.trim()).filter(Boolean),
        interests: adSetForm.interests.split(',').map((s) => s.trim()).filter(Boolean),
        customAudiences: [] as string[], excludedAudiences: [] as string[],
        placements: adSetForm.placements.split(',').map((s) => s.trim()).filter(Boolean),
        dailyBudget: adSetForm.dailyBudget ? parseFloat(adSetForm.dailyBudget) : null,
        lifetimeBudget: null,
        startDate: campaign?.startDate || null,
        endDate: campaign?.endDate || null,
        bidStrategy: null, bidAmount: null,
        notes: '',
      };
      if (editingAdSet) {
        await updateAdSet(editingAdSet.id, payload);
        toast('קבוצת מודעות עודכנה', 'success');
      } else {
        await createAdSet(payload);
        toast('קבוצת מודעות נוצרה', 'success');
      }
      setAdSetModalOpen(false);
    } catch { toast('שגיאה בשמירת קבוצת מודעות', 'error'); }
  }, [adSetForm, campaignId, campaign, editingAdSet, createAdSet, updateAdSet, toast]);

  const handleOpenAdModal = useCallback((adSetId: string, ad?: Ad) => {
    setAdModalAdSetId(adSetId);
    if (ad) {
      setEditingAd(ad);
      setAdForm({
        name: ad.name, creativeType: ad.creativeType, status: ad.status,
        mediaUrl: ad.mediaUrl, primaryText: ad.primaryText, headline: ad.headline,
        description: ad.description, ctaType: ad.ctaType, ctaLink: ad.ctaLink,
      });
    } else {
      setEditingAd(null);
      setAdForm({
        name: '', creativeType: 'image', status: 'draft',
        mediaUrl: '', primaryText: '', headline: '', description: '',
        ctaType: 'LEARN_MORE', ctaLink: '',
      });
    }
    setAdModalOpen(true);
  }, []);

  const handleSubmitAd = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (\!adForm.name.trim()) { toast('נא להכניס שם למודעה', 'error'); return; }
    try {
      const payload = {
        adSetId: adModalAdSetId,
        campaignId,
        name: adForm.name,
        status: adForm.status,
        creativeType: adForm.creativeType,
        mediaUrl: adForm.mediaUrl,
        thumbnailUrl: null,
        primaryText: adForm.primaryText,
        headline: adForm.headline,
        description: adForm.description,
        ctaType: adForm.ctaType,
        ctaLink: adForm.ctaLink,
        linkedVideoProjectId: null,
        linkedClientFileId: null,
        impressions: 0, clicks: 0, spend: 0, leads: 0, conversions: 0,
        ctr: 0, cpl: 0, cpc: 0, roas: 0,
        notes: '',
      };
      if (editingAd) {
        await updateAd(editingAd.id, payload);
        toast('מודעה עודכנה', 'success');
      } else {
        await createAd(payload);
        toast('מודעה נוצרה', 'success');
      }
      setAdModalOpen(false);
    } catch { toast('שגיאה בשמירת מודעה', 'error'); }
  }, [adForm, adModalAdSetId, campaignId, editingAd, createAd, updateAd, toast]);

  // ── Loading ─────────────────────────────────────────────────────────

  if (\!campaign) {
    return (
      <main style={{ maxWidth: '1400px', margin: '0 auto', padding: '2rem 1.5rem', direction: 'rtl' }}>
        <SkeletonKPIRow count={5} />
      </main>
    );
  }

  const health = computeHealth(campaign);
  const avgCtr = totalMetrics.impressions > 0 ? (totalMetrics.clicks / totalMetrics.impressions * 100) : 0;
  const avgCpl = totalMetrics.leads > 0 ? (totalMetrics.spend / totalMetrics.leads) : 0;

  const fieldStyle: React.CSSProperties = {
    width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.82rem',
    borderRadius: '0.375rem', border: '1px solid var(--border)',
    background: 'var(--surface-sunken, var(--background))', color: 'var(--foreground)',
    fontFamily: 'inherit',
  };

  return (
    <main style={{ maxWidth: '1400px', margin: '0 auto', padding: '2rem 1.5rem', direction: 'rtl' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

        {/* Breadcrumb + Title */}
        <div className="ux-hero-enter">
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.75rem', color: 'var(--foreground-muted)', marginBottom: '0.5rem' }}>
            <Link href="/campaigns" style={{ color: 'var(--accent)', textDecoration: 'none' }}>קמפיינים</Link>
            <span>›</span>
            <span>{campaign.campaignName}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--foreground)', margin: 0, letterSpacing: '-0.02em' }}>
                {campaign.campaignName}
              </h1>
              <p style={{ color: 'var(--foreground-muted)', fontSize: '0.8rem', marginTop: '0.15rem' }}>
                {campaign.clientName || 'ללא לקוח'} · {PLATFORM_LABELS[campaign.platform] || campaign.platform}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span style={{
                ...badgeStyle(STATUS_COLORS[campaign.status] || '#6b7280', STATUS_COLORS[campaign.status] || '#6b7280'),
                fontSize: '0.72rem', padding: '0.3rem 0.6rem',
              }}>
                {STATUS_LABELS[campaign.status] || campaign.status}
              </span>
              <span style={{
                fontSize: '0.72rem', fontWeight: 700, padding: '0.3rem 0.6rem',
                borderRadius: '0.375rem', background: `${health.color}18`, color: health.color,
                border: `1px solid ${health.color}30`,
              }}>
                ❤ {health.score}
              </span>
            </div>
          </div>
        </div>

        {/* KPI Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem' }}>
          {[
            { label: 'קבוצות מודעות', value: campaignAdSets.length, color: 'var(--foreground)' },
            { label: 'מודעות', value: campaignAds.length, color: 'var(--accent)' },
            { label: 'תקציב', value: `₪${(campaign.budget || 0).toLocaleString('he-IL')}`, color: 'var(--foreground)' },
            { label: 'חשיפות', value: totalMetrics.impressions > 0 ? `${(totalMetrics.impressions / 1000).toFixed(1)}K` : '—', color: '#3b82f6' },
            { label: 'CTR', value: avgCtr > 0 ? `${avgCtr.toFixed(1)}%` : '—', color: avgCtr >= 2 ? '#22c55e' : avgCtr > 0 ? '#f59e0b' : 'var(--foreground-muted)' },
            { label: 'CPL', value: avgCpl > 0 ? `₪${avgCpl.toFixed(0)}` : '—', color: 'var(--foreground)' },
            { label: 'לידים', value: totalMetrics.leads || (leadInsights?.leadCount || 0), color: '#0092cc' },
            { label: 'הוצאה', value: totalMetrics.spend > 0 ? `₪${totalMetrics.spend.toFixed(0)}` : '—', color: totalMetrics.spend > 0 ? '#ef4444' : 'var(--foreground-muted)' },
          ].map((kpi) => (
            <div key={kpi.label} className="premium-card" style={{ padding: '0.85rem', textAlign: 'center' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: kpi.color }}>{kpi.value}</div>
              <div style={{ fontSize: '0.62rem', color: 'var(--foreground-muted)', fontWeight: 600, marginTop: '0.1rem' }}>{kpi.label}</div>
            </div>
          ))}
        </div>

        {/* Ad Sets Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.5rem' }}>
          <h2 style={sectionTitleStyle}>קבוצות מודעות ({campaignAdSets.length})</h2>
          <button
            type="button"
            onClick={() => handleOpenAdSetModal()}
            className="mod-btn-primary"
            style={{ padding: '0.45rem 1rem', fontSize: '0.78rem', fontWeight: 700, borderRadius: '0.5rem', cursor: 'pointer' }}
          >
            + קבוצת מודעות חדשה
          </button>
        </div>

        {campaignAdSets.length === 0 ? (
          <div style={{ ...cardStyle, textAlign: 'center', padding: '3rem' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📦</div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--foreground)', margin: '0 0 0.5rem' }}>
              עדיין אין קבוצות מודעות
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--foreground-muted)', margin: '0 0 1rem' }}>
              הוסף קבוצת מודעות כדי להתחיל לארגן את המודעות שלך
            </p>
            <button
              type="button"
              onClick={() => handleOpenAdSetModal()}
              className="mod-btn-primary"
              style={{ padding: '0.5rem 1.25rem', fontSize: '0.82rem', fontWeight: 700, borderRadius: '0.5rem', cursor: 'pointer' }}
            >
              + צור קבוצת מודעות ראשונה
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {campaignAdSets.map((adSet) => (
              <AdSetSection
                key={adSet.id}
                adSet={adSet}
                adsForSet={adsByAdSet[adSet.id] || []}
                onEditAd={(ad) => handleOpenAdModal(adSet.id, ad)}
                onEditAdSet={(s) => handleOpenAdSetModal(s)}
                onAddAd={(adSetId) => handleOpenAdModal(adSetId)}
              />
            ))}
          </div>
        )}

        {/* Migration hint */}
        {campaignAdSets.length === 0 && (campaign.caption || campaign.externalMediaUrl) && (
          <div style={{
            ...cardStyle, borderRight: '3px solid var(--accent)',
            display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.25rem',
          }}>
            <span style={{ fontSize: '1.2rem' }}>💡</span>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--foreground)', margin: 0 }}>
                לקמפיין זה יש נתוני קריאייטיב ישנים
              </p>
              <p style={{ fontSize: '0.72rem', color: 'var(--foreground-muted)', margin: '0.2rem 0 0' }}>
                הפעל את כלי ההגירה כדי להמיר אותם אוטומטית לקבוצת מודעות + מודעה
              </p>
            </div>
            <button
              type="button"
              onClick={async () => {
                try {
                  const res = await fetch('/api/data/migrate-campaign-structure', { method: 'POST' });
                  const json = await res.json();
                  if (res.ok) {
                    toast(`הגירה הושלמה: ${json.migrated} קמפיינים הומרו`, 'success');
                    window.location.reload();
                  } else {
                    toast(json.error || 'שגיאה בהגירה', 'error');
                  }
                } catch { toast('שגיאת רשת', 'error'); }
              }}
              className="mod-btn-primary"
              style={{ padding: '0.45rem 1rem', fontSize: '0.75rem', fontWeight: 700, borderRadius: '0.5rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              🔄 המר עכשיו
            </button>
          </div>
        )}
      </div>

      {/* Ad Set Modal */}
      <Modal open={adSetModalOpen} onClose={() => setAdSetModalOpen(false)} title={editingAdSet ? 'עריכת קבוצת מודעות' : 'קבוצת מודעות חדשה'}>
        <div style={{ padding: '1.5rem', maxWidth: '500px' }}>
          <form onSubmit={handleSubmitAdSet} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>שם *</label>
              <input type="text" value={adSetForm.name} onChange={(e) => setAdSetForm({ ...adSetForm, name: e.target.value })} placeholder="שם קבוצת המודעות" style={fieldStyle} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>סטטוס</label>
              <select value={adSetForm.status} onChange={(e) => setAdSetForm({ ...adSetForm, status: e.target.value as AdSetStatus })} style={{ ...fieldStyle, cursor: 'pointer' }}>
                <option value="draft">טיוטה</option>
                <option value="active">פעיל</option>
                <option value="paused">מושהה</option>
                <option value="archived">ארכיון</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>מיקומים (מופרדים בפסיק)</label>
              <input type="text" value={adSetForm.geoLocations} onChange={(e) => setAdSetForm({ ...adSetForm, geoLocations: e.target.value })} placeholder="תל אביב, ירושלים, חיפה" style={fieldStyle} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>תחומי עניין (מופרדים בפסיק)</label>
              <input type="text" value={adSetForm.interests} onChange={(e) => setAdSetForm({ ...adSetForm, interests: e.target.value })} placeholder="שיווק דיגיטלי, עסקים קטנים" style={fieldStyle} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>תקציב יומי ₪</label>
              <input type="number" value={adSetForm.dailyBudget} onChange={(e) => setAdSetForm({ ...adSetForm, dailyBudget: e.target.value })} min="0" style={fieldStyle} />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', paddingTop: '0.5rem' }}>
              <button type="submit" className="mod-btn-primary" style={{ flex: 1, padding: '0.6rem', fontSize: '0.85rem', fontWeight: 700, borderRadius: '0.5rem', cursor: 'pointer' }}>
                {editingAdSet ? 'עדכן' : 'צור'}
              </button>
              <button type="button" onClick={() => setAdSetModalOpen(false)} className="mod-btn-ghost" style={{ flex: 1, padding: '0.6rem', fontSize: '0.85rem', fontWeight: 600, borderRadius: '0.5rem', cursor: 'pointer' }}>
                ביטול
              </button>
            </div>
          </form>
        </div>
      </Modal>

      {/* Ad Modal */}
      <Modal open={adModalOpen} onClose={() => setAdModalOpen(false)} title={editingAd ? 'עריכת מודעה' : 'מודעה חדשה'}>
        <div style={{ padding: '1.5rem', maxWidth: '550px' }}>
          <form onSubmit={handleSubmitAd} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>שם מודעה *</label>
              <input type="text" value={adForm.name} onChange={(e) => setAdForm({ ...adForm, name: e.target.value })} placeholder="שם המודעה" style={fieldStyle} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>סוג קריאייטיב</label>
                <select value={adForm.creativeType} onChange={(e) => setAdForm({ ...adForm, creativeType: e.target.value as AdCreativeType })} style={{ ...fieldStyle, cursor: 'pointer' }}>
                  <option value="image">תמונה</option>
                  <option value="video">וידאו</option>
                  <option value="carousel">קרוסלה</option>
                  <option value="slideshow">מצגת</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>סטטוס</label>
                <select value={adForm.status} onChange={(e) => setAdForm({ ...adForm, status: e.target.value as AdStatus })} style={{ ...fieldStyle, cursor: 'pointer' }}>
                  <option value="draft">טיוטה</option>
                  <option value="active">פעיל</option>
                  <option value="paused">מושהה</option>
                  <option value="archived">ארכיון</option>
                </select>
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>כתובת מדיה (URL)</label>
              <input type="url" value={adForm.mediaUrl} onChange={(e) => setAdForm({ ...adForm, mediaUrl: e.target.value })} placeholder="https://..." style={fieldStyle} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>כותרת</label>
              <input type="text" value={adForm.headline} onChange={(e) => setAdForm({ ...adForm, headline: e.target.value })} placeholder="כותרת מודעה" style={fieldStyle} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>טקסט ראשי</label>
              <textarea value={adForm.primaryText} onChange={(e) => setAdForm({ ...adForm, primaryText: e.target.value })} placeholder="הטקסט הראשי של המודעה" style={{ ...fieldStyle, minHeight: '70px', resize: 'vertical' as const }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>תיאור</label>
              <input type="text" value={adForm.description} onChange={(e) => setAdForm({ ...adForm, description: e.target.value })} placeholder="שורת תיאור (אופציונלי)" style={fieldStyle} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>CTA</label>
                <select value={adForm.ctaType} onChange={(e) => setAdForm({ ...adForm, ctaType: e.target.value })} style={{ ...fieldStyle, cursor: 'pointer' }}>
                  {Object.entries(CTA_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>קישור יעד</label>
                <input type="url" value={adForm.ctaLink} onChange={(e) => setAdForm({ ...adForm, ctaLink: e.target.value })} placeholder="https://..." style={fieldStyle} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', paddingTop: '0.5rem' }}>
              <button type="submit" className="mod-btn-primary" style={{ flex: 1, padding: '0.6rem', fontSize: '0.85rem', fontWeight: 700, borderRadius: '0.5rem', cursor: 'pointer' }}>
                {editingAd ? 'עדכן' : 'צור'}
              </button>
              <button type="button" onClick={() => setAdModalOpen(false)} className="mod-btn-ghost" style={{ flex: 1, padding: '0.6rem', fontSize: '0.85rem', fontWeight: 600, borderRadius: '0.5rem', cursor: 'pointer' }}>
                ביטול
              </button>
            </div>
          </form>
        </div>
      </Modal>
    </main>
  );
}
