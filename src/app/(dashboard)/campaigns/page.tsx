'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useCampaigns, useClients } from '@/lib/api/use-entity';
import { useToast } from '@/components/ui/toast';
import { Modal } from '@/components/ui/modal';
import type { Campaign, CampaignType, CampaignStatus, CampaignPlatform, CampaignMediaType } from '@/lib/db/schema';

const STATUS_OPTIONS: Array<{ value: CampaignStatus; label: string }> = [
  { value: 'draft', label: 'טיוטה' },
  { value: 'in_progress', label: 'בתהליך' },
  { value: 'waiting_approval', label: 'ממתין לאישור' },
  { value: 'approved', label: 'מאושר' },
  { value: 'scheduled', label: 'מתוזמן' },
  { value: 'active', label: 'פעיל' },
  { value: 'completed', label: 'הושלם' },
];

const TYPE_OPTIONS: Array<{ value: CampaignType; label: string }> = [
  { value: 'paid_social', label: 'ממומן' },
  { value: 'organic_social', label: 'אורגני' },
  { value: 'lead_gen', label: 'לידים' },
  { value: 'awareness', label: 'מודעות' },
  { value: 'remarketing', label: 'רימרקטינג' },
  { value: 'podcast_promo', label: 'קידום פודקאסט' },
  { value: 'custom', label: 'מותאם' },
];

const PLATFORM_OPTIONS: Array<{ value: CampaignPlatform; label: string }> = [
  { value: 'facebook', label: 'Facebook' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'multi_platform', label: 'מולטי-פלטפורמה' },
];

const MEDIA_TYPE_OPTIONS: Array<{ value: CampaignMediaType; label: string }> = [
  { value: 'image', label: 'תמונה' },
  { value: 'video', label: 'וידאו' },
];

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

const TYPE_LABELS: Record<CampaignType, string> = {
  paid_social: 'ממומן',
  organic_social: 'אורגני',
  lead_gen: 'לידים',
  awareness: 'מודעות',
  remarketing: 'רימרקטינג',
  podcast_promo: 'קידום פודקאסט',
  custom: 'מותאם',
};

const PLATFORM_LABELS: Record<CampaignPlatform, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  multi_platform: 'מולטי-פלטפורמה',
};

const MEDIA_TYPE_LABELS: Record<CampaignMediaType, string> = {
  image: 'תמונה',
  video: 'וידאו',
};

interface FormData {
  campaignName: string;
  clientId: string;
  campaignType: CampaignType;
  objective: string;
  platform: CampaignPlatform;
  status: CampaignStatus;
  mediaType: CampaignMediaType;
  budget: number | '';
  caption: string;
  notes: string;
  startDate: string;
  endDate: string;
  linkedVideoProjectId: string | null;
  linkedClientFileId: string | null;
  externalMediaUrl: string;
  adAccountId: string;
  leadFormIds: string;
}

export default function CampaignsPage() {
  const { data: campaigns, loading, create, update, remove } = useCampaigns();
  const { data: clients } = useClients();
  const toast = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterClient, setFilterClient] = useState('');
  const [filterStatus, setFilterStatus] = useState<CampaignStatus | ''>('');
  const [filterPlatform, setFilterPlatform] = useState<CampaignPlatform | ''>('');
  const [filterType, setFilterType] = useState<CampaignType | ''>('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingCampaignId, setDeletingCampaignId] = useState<string | null>(null);

  const [formData, setFormData] = useState<FormData>({
    campaignName: '',
    clientId: '',
    campaignType: 'paid_social',
    objective: '',
    platform: 'facebook',
    status: 'draft',
    mediaType: 'image',
    budget: '',
    caption: '',
    notes: '',
    startDate: '',
    endDate: '',
    linkedVideoProjectId: null,
    linkedClientFileId: null,
    externalMediaUrl: '',
    adAccountId: '',
    leadFormIds: '',
  });

  const filteredCampaigns = useMemo(() => {
    return (campaigns || []).filter((campaign) => {
      const matchesSearch =
        (campaign.campaignName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (campaign.clientName || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesClient = !filterClient || campaign.clientId === filterClient;
      const matchesStatus = !filterStatus || (campaign.status || 'draft') === filterStatus;
      const matchesPlatform = !filterPlatform || (campaign.platform || 'facebook') === filterPlatform;
      const matchesType = !filterType || (campaign.campaignType || 'custom') === filterType;

      return matchesSearch && matchesClient && matchesStatus && matchesPlatform && matchesType;
    });
  }, [campaigns, searchQuery, filterClient, filterStatus, filterPlatform, filterType]);

  const kpiStats = useMemo(() => {
    const totalCampaigns = (campaigns || []).length;
    const activeCampaigns = (campaigns || []).filter((c) => c.status === 'active').length;
    const totalBudget = (campaigns || []).reduce((sum, c) => sum + (c.budget || 0), 0);
    const pendingApproval = (campaigns || []).filter((c) => c.status === 'waiting_approval').length;

    return {
      totalCampaigns,
      activeCampaigns,
      totalBudget,
      pendingApproval,
    };
  }, [campaigns]);

  const handleOpenModal = (campaign?: Campaign) => {
    if (campaign) {
      setEditingCampaign(campaign);
      setFormData({
        campaignName: campaign.campaignName,
        clientId: campaign.clientId,
        campaignType: campaign.campaignType,
        objective: campaign.objective,
        platform: campaign.platform,
        status: campaign.status,
        mediaType: campaign.mediaType,
        budget: campaign.budget,
        caption: campaign.caption,
        notes: campaign.notes,
        startDate: campaign.startDate || '',
        endDate: campaign.endDate || '',
        linkedVideoProjectId: campaign.linkedVideoProjectId,
        linkedClientFileId: campaign.linkedClientFileId,
        externalMediaUrl: campaign.externalMediaUrl,
        adAccountId: campaign.adAccountId || '',
        leadFormIds: campaign.leadFormIds?.join(', ') || '',
      });
    } else {
      setEditingCampaign(null);
      setFormData({
        campaignName: '',
        clientId: '',
        campaignType: 'paid_social',
        objective: '',
        platform: 'facebook',
        status: 'draft',
        mediaType: 'image',
        budget: '',
        caption: '',
        notes: '',
        startDate: '',
        endDate: '',
        linkedVideoProjectId: null,
        linkedClientFileId: null,
        externalMediaUrl: '',
        adAccountId: '',
        leadFormIds: '',
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingCampaign(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.campaignName.trim()) {
      toast('נא להכניס שם קמפיין', 'error');
      return;
    }

    if (!formData.clientId) {
      toast('נא לבחור לקוח', 'error');
      return;
    }

    if (!formData.objective.trim()) {
      toast('נא להכניס מטרה קמפיין', 'error');
      return;
    }

    if (formData.budget === '') {
      toast('נא להכניס תקציב', 'error');
      return;
    }

    const budgetNum = typeof formData.budget === 'string' ? parseFloat(formData.budget) : formData.budget;
    if (isNaN(budgetNum) || budgetNum < 0) {
      toast('תקציב לא תקין', 'error');
      return;
    }

    try {
      const selectedClient = (clients || []).find((c) => c.id === formData.clientId);
      const clientName = selectedClient?.name || '';

      if (editingCampaign) {
        await update(editingCampaign.id, {
          campaignName: formData.campaignName,
          clientId: formData.clientId,
          clientName,
          campaignType: formData.campaignType,
          objective: formData.objective,
          platform: formData.platform,
          status: formData.status,
          mediaType: formData.mediaType,
          budget: budgetNum,
          caption: formData.caption,
          notes: formData.notes,
          startDate: formData.startDate || null,
          endDate: formData.endDate || null,
          linkedVideoProjectId: formData.linkedVideoProjectId,
          linkedClientFileId: formData.linkedClientFileId,
          externalMediaUrl: formData.externalMediaUrl,
          adAccountId: formData.adAccountId,
          leadFormIds: (formData.leadFormIds || '').split(',').map(s => s.trim()).filter(Boolean),
        });
        toast('קמפיין עודכן בהצלחה', 'success');
      } else {
        await create({
          campaignName: formData.campaignName,
          clientId: formData.clientId,
          clientName,
          campaignType: formData.campaignType,
          objective: formData.objective,
          platform: formData.platform,
          status: formData.status,
          mediaType: formData.mediaType,
          budget: budgetNum,
          caption: formData.caption,
          notes: formData.notes,
          startDate: formData.startDate || null,
          endDate: formData.endDate || null,
          linkedVideoProjectId: formData.linkedVideoProjectId,
          linkedClientFileId: formData.linkedClientFileId,
          externalMediaUrl: formData.externalMediaUrl,
          adAccountId: formData.adAccountId,
          leadFormIds: (formData.leadFormIds || '').split(',').map(s => s.trim()).filter(Boolean),
        });
        toast('קמפיין נוצר בהצלחה', 'success');
      }
      handleCloseModal();
    } catch (error) {
      toast(editingCampaign ? 'שגיאה בעדכון קמפיין' : 'שגיאה ביצירת קמפיין', 'error');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingCampaignId) return;

    try {
      await remove(deletingCampaignId);
      toast('קמפיין נמחק בהצלחה', 'success');
      setIsDeleteModalOpen(false);
      setDeletingCampaignId(null);
    } catch (error) {
      toast('שגיאה במחיקת קמפיין', 'error');
    }
  };

  const openDeleteModal = (campaignId: string) => {
    setDeletingCampaignId(campaignId);
    setIsDeleteModalOpen(true);
  };

  if (loading) {
    return (
      <main style={{ maxWidth: '1400px', margin: '0 auto', padding: '2rem 1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem 0' }}>
          <p style={{ color: 'var(--foreground-muted)' }}>טוען...</p>
        </div>
      </main>
    );
  }

  if (!campaigns && !loading) {
    return (
      <main style={{ maxWidth: '1400px', margin: '0 auto', padding: '2rem 1.5rem' }}>
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⚠️</div>
          <div style={{ color: 'var(--foreground-muted)' }}>שגיאה בטעינת קמפיינים. נסה לרענן את הדף.</div>
        </div>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: '1400px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--foreground)', margin: 0 }}>
              קמפיינים
            </h1>
            <p style={{ color: 'var(--foreground-muted)', fontSize: '0.92rem', marginTop: '0.25rem' }}>
              נהל קמפיינים ופרסום ברשתות חברתיות
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <Link
              href="/campaign-builder"
              style={{
                background: 'linear-gradient(135deg, var(--accent), #0090cc)',
                color: 'white',
                padding: '0.75rem 1.5rem',
                borderRadius: '0.5rem',
                border: 'none',
                fontSize: '0.95rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'opacity 0.2s',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              🚀 בנה קמפיין חכם
            </Link>
            <button
              onClick={() => handleOpenModal()}
              style={{
                backgroundColor: 'var(--surface-raised)',
                color: 'var(--foreground)',
                padding: '0.75rem 1.5rem',
                borderRadius: '0.5rem',
                border: '1px solid var(--border)',
                fontSize: '0.95rem',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'opacity 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.8')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
            >
              + קמפיין מהיר
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '0.75rem',
              padding: '1.5rem',
            }}
          >
            <p style={{ color: 'var(--foreground-muted)', fontSize: '0.85rem', margin: 0, marginBottom: '0.5rem' }}>
              סה״כ קמפיינים
            </p>
            <p style={{ fontSize: '1.75rem', fontWeight: 'bold', color: 'var(--foreground)', margin: 0 }}>
              {kpiStats.totalCampaigns}
            </p>
          </div>
          <div
            style={{
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '0.75rem',
              padding: '1.5rem',
            }}
          >
            <p style={{ color: 'var(--foreground-muted)', fontSize: '0.85rem', margin: 0, marginBottom: '0.5rem' }}>
              קמפיינים פעילים
            </p>
            <p style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#22c55e', margin: 0 }}>
              {kpiStats.activeCampaigns}
            </p>
          </div>
          <div
            style={{
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '0.75rem',
              padding: '1.5rem',
            }}
          >
            <p style={{ color: 'var(--foreground-muted)', fontSize: '0.85rem', margin: 0, marginBottom: '0.5rem' }}>
              סה״כ תקציב
            </p>
            <p style={{ fontSize: '1.75rem', fontWeight: 'bold', color: 'var(--foreground)', margin: 0 }}>
              ₪{(kpiStats.totalBudget / 1000).toFixed(0)}K
            </p>
          </div>
          <div
            style={{
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '0.75rem',
              padding: '1.5rem',
            }}
          >
            <p style={{ color: 'var(--foreground-muted)', fontSize: '0.85rem', margin: 0, marginBottom: '0.5rem' }}>
              ממתינים לאישור
            </p>
            <p style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#f59e0b', margin: 0 }}>
              {kpiStats.pendingApproval}
            </p>
          </div>
        </div>

        {/* Filter Bar */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '0.75rem',
            backgroundColor: 'var(--surface)',
            padding: '1rem',
            borderRadius: '0.75rem',
            border: '1px solid var(--border)',
          }}
        >
          <input
            type="text"
            placeholder="חפש קמפיין או לקוח..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              gridColumn: '1 / -1',
              padding: '0.75rem',
              backgroundColor: 'var(--surface-raised)',
              border: '1px solid var(--border)',
              borderRadius: '0.5rem',
              color: 'var(--foreground)',
              fontSize: '0.9rem',
            }}
          />
          <select
            value={filterClient}
            onChange={(e) => setFilterClient(e.target.value)}
            style={{
              padding: '0.75rem',
              backgroundColor: 'var(--surface-raised)',
              border: '1px solid var(--border)',
              borderRadius: '0.5rem',
              color: 'var(--foreground)',
              fontSize: '0.9rem',
              cursor: 'pointer',
            }}
          >
            <option value="">כל הלקוחות</option>
            {(clients || []).map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as CampaignStatus | '')}
            style={{
              padding: '0.75rem',
              backgroundColor: 'var(--surface-raised)',
              border: '1px solid var(--border)',
              borderRadius: '0.5rem',
              color: 'var(--foreground)',
              fontSize: '0.9rem',
              cursor: 'pointer',
            }}
          >
            <option value="">כל הסטטוסים</option>
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            value={filterPlatform}
            onChange={(e) => setFilterPlatform(e.target.value as CampaignPlatform | '')}
            style={{
              padding: '0.75rem',
              backgroundColor: 'var(--surface-raised)',
              border: '1px solid var(--border)',
              borderRadius: '0.5rem',
              color: 'var(--foreground)',
              fontSize: '0.9rem',
              cursor: 'pointer',
            }}
          >
            <option value="">כל הפלטפורמות</option>
            {PLATFORM_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as CampaignType | '')}
            style={{
              padding: '0.75rem',
              backgroundColor: 'var(--surface-raised)',
              border: '1px solid var(--border)',
              borderRadius: '0.5rem',
              color: 'var(--foreground)',
              fontSize: '0.9rem',
              cursor: 'pointer',
            }}
          >
            <option value="">כל הסוגים</option>
            {TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Campaign Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
            gap: '1.5rem',
          }}
        >
          {filteredCampaigns.length === 0 ? (
            <div
              style={{
                gridColumn: '1 / -1',
                textAlign: 'center',
                padding: '3rem',
                color: 'var(--foreground-muted)',
              }}
            >
              {(campaigns || []).length === 0
                ? (<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ fontSize: '2rem' }}>📋</div>
                    <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--foreground)' }}>אין קמפיינים עדיין</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--foreground-muted)' }}>צור את הקמפיין הראשון שלך</div>
                    <Link
                      href="/campaign-builder"
                      style={{
                        background: 'linear-gradient(135deg, var(--accent), #0090cc)',
                        color: 'white',
                        padding: '0.6rem 1.25rem',
                        borderRadius: '0.5rem',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        textDecoration: 'none',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                      }}
                    >
                      🚀 בנה קמפיין חכם
                    </Link>
                  </div>)
                : 'לא נמצאו קמפיינים התואמים לחיפוש'}
            </div>
          ) : (
            filteredCampaigns.map((campaign) => (
              <Link key={campaign.id} href={`/campaigns/${campaign.id}`} style={{ textDecoration: 'none' }}>
                <div
                  style={{
                    backgroundColor: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: '0.75rem',
                    padding: '1.5rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--surface-raised)';
                    e.currentTarget.style.borderColor = 'var(--accent)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--surface)';
                    e.currentTarget.style.borderColor = 'var(--border)';
                  }}
                >
                  {/* Card Header */}
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--foreground)', margin: 0, flex: 1 }}>
                        {campaign.campaignName || 'ללא שם'}
                      </h3>
                      <div
                        style={{
                          backgroundColor: STATUS_COLORS[campaign.status || 'draft'],
                          color: 'white',
                          padding: '0.25rem 0.75rem',
                          borderRadius: '0.25rem',
                          fontSize: '0.75rem',
                          fontWeight: '600',
                          whiteSpace: 'nowrap',
                          marginLeft: '0.5rem',
                        }}
                      >
                        {STATUS_LABELS[campaign.status || 'draft'] || campaign.status || 'לא ידוע'}
                      </div>
                    </div>
                    <p style={{ color: 'var(--foreground-muted)', fontSize: '0.9rem', margin: 0 }}>
                      {campaign.clientName || 'ללא לקוח'}
                    </p>
                  </div>

                  {/* Badges */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
                    <div
                      style={{
                        backgroundColor: 'var(--surface-raised)',
                        border: '1px solid var(--border)',
                        padding: '0.35rem 0.75rem',
                        borderRadius: '0.35rem',
                        fontSize: '0.75rem',
                        fontWeight: '500',
                        color: 'var(--foreground)',
                      }}
                    >
                      {TYPE_LABELS[campaign.campaignType || 'custom'] || campaign.campaignType || 'לא ידוע'}
                    </div>
                    <div
                      style={{
                        backgroundColor: 'var(--surface-raised)',
                        border: '1px solid var(--border)',
                        padding: '0.35rem 0.75rem',
                        borderRadius: '0.35rem',
                        fontSize: '0.75rem',
                        fontWeight: '500',
                        color: 'var(--foreground)',
                      }}
                    >
                      {PLATFORM_LABELS[campaign.platform || 'facebook'] || campaign.platform || 'לא ידוע'}
                    </div>
                    <div
                      style={{
                        backgroundColor: 'var(--surface-raised)',
                        border: '1px solid var(--border)',
                        padding: '0.35rem 0.75rem',
                        borderRadius: '0.35rem',
                        fontSize: '0.75rem',
                        fontWeight: '500',
                        color: 'var(--foreground)',
                      }}
                    >
                      {MEDIA_TYPE_LABELS[campaign.mediaType || 'image'] || campaign.mediaType || 'לא ידוע'}
                    </div>
                  </div>

                  {/* Objective */}
                  <p
                    style={{
                      color: 'var(--foreground-muted)',
                      fontSize: '0.85rem',
                      margin: '0 0 0.75rem 0',
                      lineHeight: '1.4',
                      flex: 1,
                    }}
                  >
                    {campaign.objective || 'אין תיאור'}
                  </p>

                  {/* Stats */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, 1fr)',
                      gap: '0.75rem',
                      marginBottom: '1rem',
                      paddingTop: '1rem',
                      borderTop: '1px solid var(--border)',
                    }}
                  >
                    <div>
                      <p style={{ color: 'var(--foreground-muted)', fontSize: '0.8rem', margin: 0 }}>
                        תקציב
                      </p>
                      <p style={{ color: 'var(--foreground)', fontWeight: '600', fontSize: '1rem', margin: '0.25rem 0 0 0' }}>
                        ₪{(campaign.budget || 0).toLocaleString('he-IL')}
                      </p>
                    </div>
                    <div>
                      <p style={{ color: 'var(--foreground-muted)', fontSize: '0.8rem', margin: 0 }}>
                        תאריכים
                      </p>
                      <p style={{ color: 'var(--foreground)', fontWeight: '600', fontSize: '0.85rem', margin: '0.25rem 0 0 0' }}>
                        {campaign.startDate
                          ? new Date(campaign.startDate).toLocaleDateString('he-IL', {
                              month: 'short',
                              day: 'numeric',
                            })
                          : '—'}
                        {campaign.endDate
                          ? ` – ${new Date(campaign.endDate).toLocaleDateString('he-IL', {
                              month: 'short',
                              day: 'numeric',
                            })}`
                          : ''}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div
                    style={{
                      display: 'flex',
                      gap: '0.5rem',
                      marginTop: 'auto',
                      paddingTop: '1rem',
                      borderTop: '1px solid var(--border)',
                    }}
                    onClick={(e) => e.preventDefault()}
                  >
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleOpenModal(campaign);
                      }}
                      style={{
                        flex: 1,
                        padding: '0.5rem',
                        backgroundColor: 'transparent',
                        color: 'var(--foreground-muted)',
                        border: '1px solid var(--border)',
                        borderRadius: '0.4rem',
                        fontSize: '0.8rem',
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
                      עריכה
                    </button>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        openDeleteModal(campaign.id);
                      }}
                      style={{
                        flex: 1,
                        padding: '0.5rem',
                        backgroundColor: 'transparent',
                        color: '#ef4444',
                        border: '1px solid #ef4444',
                        borderRadius: '0.4rem',
                        fontSize: '0.8rem',
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
                      מחק
                    </button>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>

      {/* Create/Edit Modal */}
      <Modal open={isModalOpen} onClose={handleCloseModal} title={editingCampaign ? 'עריכת קמפיין' : 'קמפיין חדש'}>
        <div style={{ padding: '1.5rem', maxWidth: '600px' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Campaign Name */}
            <div>
              <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '500', marginBottom: '0.5rem' }}>
                שם קמפיין *
              </label>
              <input
                type="text"
                value={formData.campaignName}
                onChange={(e) => setFormData({ ...formData, campaignName: e.target.value })}
                placeholder="הכנס שם קמפיין"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: 'var(--surface-raised)',
                  border: '1px solid var(--border)',
                  borderRadius: '0.5rem',
                  color: 'var(--foreground)',
                  fontSize: '0.9rem',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Client Select */}
            <div>
              <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '500', marginBottom: '0.5rem' }}>
                לקוח *
              </label>
              <select
                value={formData.clientId}
                onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: 'var(--surface-raised)',
                  border: '1px solid var(--border)',
                  borderRadius: '0.5rem',
                  color: 'var(--foreground)',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  boxSizing: 'border-box',
                }}
              >
                <option value="">בחר לקוח</option>
                {(clients || []).map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Campaign Type */}
            <div>
              <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '500', marginBottom: '0.5rem' }}>
                סוג קמפיין *
              </label>
              <select
                value={formData.campaignType}
                onChange={(e) => setFormData({ ...formData, campaignType: e.target.value as CampaignType })}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: 'var(--surface-raised)',
                  border: '1px solid var(--border)',
                  borderRadius: '0.5rem',
                  color: 'var(--foreground)',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  boxSizing: 'border-box',
                }}
              >
                {TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Objective */}
            <div>
              <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '500', marginBottom: '0.5rem' }}>
                מטרת הקמפיין *
              </label>
              <textarea
                value={formData.objective}
                onChange={(e) => setFormData({ ...formData, objective: e.target.value })}
                placeholder="מה המטרה של קמפיין זה?"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: 'var(--surface-raised)',
                  border: '1px solid var(--border)',
                  borderRadius: '0.5rem',
                  color: 'var(--foreground)',
                  fontSize: '0.9rem',
                  minHeight: '80px',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
            </div>

            {/* Platform */}
            <div>
              <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '500', marginBottom: '0.5rem' }}>
                פלטפורמה *
              </label>
              <select
                value={formData.platform}
                onChange={(e) => setFormData({ ...formData, platform: e.target.value as CampaignPlatform })}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: 'var(--surface-raised)',
                  border: '1px solid var(--border)',
                  borderRadius: '0.5rem',
                  color: 'var(--foreground)',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  boxSizing: 'border-box',
                }}
              >
                {PLATFORM_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div>
              <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '500', marginBottom: '0.5rem' }}>
                סטטוס *
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as CampaignStatus })}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: 'var(--surface-raised)',
                  border: '1px solid var(--border)',
                  borderRadius: '0.5rem',
                  color: 'var(--foreground)',
                  fontSize: '0.9rem',
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

            {/* Media Type */}
            <div>
              <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '500', marginBottom: '0.5rem' }}>
                סוג תוכן *
              </label>
              <select
                value={formData.mediaType}
                onChange={(e) => setFormData({ ...formData, mediaType: e.target.value as CampaignMediaType })}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: 'var(--surface-raised)',
                  border: '1px solid var(--border)',
                  borderRadius: '0.5rem',
                  color: 'var(--foreground)',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  boxSizing: 'border-box',
                }}
              >
                {MEDIA_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Budget */}
            <div>
              <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '500', marginBottom: '0.5rem' }}>
                תקציב (₪) *
              </label>
              <input
                type="number"
                value={formData.budget}
                onChange={(e) => setFormData({ ...formData, budget: e.target.value === '' ? '' : Number(e.target.value) })}
                placeholder="הכנס תקציב"
                min="0"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: 'var(--surface-raised)',
                  border: '1px solid var(--border)',
                  borderRadius: '0.5rem',
                  color: 'var(--foreground)',
                  fontSize: '0.9rem',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Caption */}
            <div>
              <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '500', marginBottom: '0.5rem' }}>
                כותרת/תיאור
              </label>
              <textarea
                value={formData.caption}
                onChange={(e) => setFormData({ ...formData, caption: e.target.value })}
                placeholder="כותרת או תיאור קצר לקמפיין"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: 'var(--surface-raised)',
                  border: '1px solid var(--border)',
                  borderRadius: '0.5rem',
                  color: 'var(--foreground)',
                  fontSize: '0.9rem',
                  minHeight: '60px',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
            </div>

            {/* Dates */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '500', marginBottom: '0.5rem' }}>
                  תאריך התחלה
                </label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    backgroundColor: 'var(--surface-raised)',
                    border: '1px solid var(--border)',
                    borderRadius: '0.5rem',
                    color: 'var(--foreground)',
                    fontSize: '0.9rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '500', marginBottom: '0.5rem' }}>
                  תאריך סיום
                </label>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    backgroundColor: 'var(--surface-raised)',
                    border: '1px solid var(--border)',
                    borderRadius: '0.5rem',
                    color: 'var(--foreground)',
                    fontSize: '0.9rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            {/* Lead Settings Section */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', marginTop: '0.5rem' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: '600', color: 'var(--foreground)', margin: '0 0 1rem 0' }}>
                הגדרות לידים
              </h3>

              {/* Ad Account ID */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '500', marginBottom: '0.5rem' }}>
                  חשבון פרסום
                </label>
                <input
                  type="text"
                  value={formData.adAccountId}
                  onChange={(e) => setFormData({ ...formData, adAccountId: e.target.value })}
                  placeholder="הכנס מזהה חשבון פרסום"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    backgroundColor: 'var(--surface-raised)',
                    border: '1px solid var(--border)',
                    borderRadius: '0.5rem',
                    color: 'var(--foreground)',
                    fontSize: '0.9rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Lead Form IDs */}
              <div>
                <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '500', marginBottom: '0.5rem' }}>
                  טפסי לידים לניטור
                </label>
                <input
                  type="text"
                  value={formData.leadFormIds}
                  onChange={(e) => setFormData({ ...formData, leadFormIds: e.target.value })}
                  placeholder="הכנס מזהים מופרדים בפסיקים (ID1, ID2, ID3)"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    backgroundColor: 'var(--surface-raised)',
                    border: '1px solid var(--border)',
                    borderRadius: '0.5rem',
                    color: 'var(--foreground)',
                    fontSize: '0.9rem',
                    boxSizing: 'border-box',
                  }}
                />
                <p style={{ fontSize: '0.8rem', color: 'var(--foreground-muted)', margin: '0.5rem 0 0 0' }}>
                  הפרד מזהים בפסיקים (,)
                </p>
              </div>
            </div>

            {/* External Media URL */}
            <div>
              <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '500', marginBottom: '0.5rem' }}>
                קישור לתוכן חיצוני
              </label>
              <input
                type="url"
                value={formData.externalMediaUrl}
                onChange={(e) => setFormData({ ...formData, externalMediaUrl: e.target.value })}
                placeholder="https://example.com/media.mp4"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: 'var(--surface-raised)',
                  border: '1px solid var(--border)',
                  borderRadius: '0.5rem',
                  color: 'var(--foreground)',
                  fontSize: '0.9rem',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Notes */}
            <div>
              <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '500', marginBottom: '0.5rem' }}>
                הערות
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="הערות פנימיות על הקמפיין"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: 'var(--surface-raised)',
                  border: '1px solid var(--border)',
                  borderRadius: '0.5rem',
                  color: 'var(--foreground)',
                  fontSize: '0.9rem',
                  minHeight: '80px',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: '0.75rem', paddingTop: '1rem' }}>
              <button
                type="submit"
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
                {editingCampaign ? 'עדכן' : 'צור'}
              </button>
              <button
                type="button"
                onClick={handleCloseModal}
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
          </form>
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
              onClick={handleDeleteConfirm}
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
