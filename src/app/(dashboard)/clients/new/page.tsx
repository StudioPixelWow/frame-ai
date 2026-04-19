'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useToast } from '@/components/ui/toast';
import { useEmployees, useClients } from '@/lib/api/use-entity';

const PRESET_COLORS = ['#00B5FE', '#8b5cf6', '#22c55e', '#f59e0b', '#ec4899', '#ef4444', '#14b8a6', '#6366f1', '#f97316', '#84cc16'];

const CLIENT_TYPES = [
  { id: 'marketing', label: 'שיווק', emoji: '📢' },
  { id: 'branding', label: 'מיתוג', emoji: '🎨' },
  { id: 'websites', label: 'אתרים', emoji: '🌐' },
  { id: 'hosting', label: 'אחסון', emoji: '🖥️' },
  { id: 'podcast', label: 'פודקאסט', emoji: '🎙️' },
  { id: 'lead', label: 'ליד', emoji: '🔗' },
];

interface FormData {
  name: string;
  company: string;
  contactPerson: string;
  email: string;
  phone: string;
  color: string;
  clientType: 'marketing' | 'branding' | 'websites' | 'hosting' | 'podcast' | 'lead';
  businessField: string;
  marketingGoals: string;
  keyMarketingMessages: string;
  retainerAmount: number;
  retainerDay: number;
  assignedManagerId: string | null;
  portalEnabled: boolean;
  logoUrl: string;
  websiteUrl: string;
  facebookPageUrl: string;
  instagramProfileUrl: string;
  tiktokProfileUrl: string;
  linkedinUrl: string;
  youtubeUrl: string;
}

export default function NewClientPage() {
  const router = useRouter();
  const toast = useToast();
  const { data: employees } = useEmployees();
  const { create } = useClients();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<FormData>({
    name: '',
    company: '',
    contactPerson: '',
    email: '',
    phone: '',
    color: '#00B5FE',
    clientType: 'marketing',
    businessField: '',
    marketingGoals: '',
    keyMarketingMessages: '',
    retainerAmount: 0,
    retainerDay: 1,
    assignedManagerId: null,
    portalEnabled: false,
    logoUrl: '',
    websiteUrl: '',
    facebookPageUrl: '',
    instagramProfileUrl: '',
    tiktokProfileUrl: '',
    linkedinUrl: '',
    youtubeUrl: '',
  });

  const [uploading, setUploading] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleLogoUpload = async (file: File) => {
    setUploading(true);
    try {
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => setLogoPreview(e.target?.result as string);
      reader.readAsDataURL(file);

      // Upload directly to Supabase via signed URL (bypasses Vercel body limit)
      // Step 1: Get signed URL (tiny JSON, no file body)
      const initRes = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, contentType: file.type, fileSize: file.size }),
      });
      if (!initRes.ok) {
        let errMsg = 'שגיאה בהכנת העלאה';
        try { const b = await initRes.json(); if (b.error) errMsg = b.error; } catch {}
        throw new Error(errMsg);
      }
      const { uploadUrl, publicUrl } = await initRes.json();
      if (!uploadUrl) throw new Error('שרת לא החזיר כתובת העלאה');

      // Step 2: PUT file directly to Supabase CDN
      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      });
      if (!putRes.ok) throw new Error('העלאה לאחסון נכשלה');

      setForm(prev => ({ ...prev, logoUrl: publicUrl }));
      toast('הלוגו הועלה בהצלחה', 'success');
    } catch (error) {
      console.error('Upload error:', error);
      toast('שגיאה בהעלאת הלוגו', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.style.borderColor = 'var(--accent)';
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.currentTarget.style.borderColor = 'var(--border)';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.style.borderColor = 'var(--border)';
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      handleLogoUpload(file);
    } else {
      toast('אנא העלה קובץ תמונה', 'error');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    if (file) {
      handleLogoUpload(file);
    }
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast('שם לקוח הוא שדה חובה', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const now = new Date().toISOString();
      const created = await create({
        name: form.name,
        company: form.company,
        contactPerson: form.contactPerson,
        email: form.email,
        phone: form.phone,
        color: form.color,
        clientType: form.clientType,
        businessField: form.businessField,
        marketingGoals: form.marketingGoals,
        keyMarketingMessages: form.keyMarketingMessages,
        retainerAmount: form.retainerAmount,
        retainerDay: form.retainerDay,
        assignedManagerId: form.assignedManagerId,
        logoUrl: form.logoUrl,
        websiteUrl: form.websiteUrl,
        facebookPageUrl: form.facebookPageUrl,
        instagramProfileUrl: form.instagramProfileUrl,
        tiktokProfileUrl: form.tiktokProfileUrl,
        linkedinUrl: form.linkedinUrl,
        youtubeUrl: form.youtubeUrl,
        status: 'active',
        notes: '',
        convertedFromLead: null,
        createdAt: now,
        updatedAt: now,
      } as any);
      toast('הלקוח נוצר בהצלחה!', 'success');
      router.push(`/clients/${created.id}`);
    } catch (error) {
      console.error('Error:', error);
      toast('שגיאה ביצירת הלקוח', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div dir="rtl" style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: '700', margin: '0' }}>לקוח חדש</h1>
        <Link
          href="/clients"
          style={{
            color: 'var(--foreground-muted)',
            textDecoration: 'none',
            fontSize: '0.9rem',
            transition: 'color 150ms',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--foreground-muted)')}
        >
          ← חזור ללקוחות
        </Link>
      </div>

      {/* Section 1: Identity */}
      <div
        style={{
          background: 'var(--surface-raised)',
          border: '1px solid var(--border)',
          borderRadius: '0.75rem',
          padding: '1.5rem',
          marginBottom: '1.25rem',
        }}
      >
        <h2 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          👤 זהות
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: '600', marginBottom: '0.5rem', color: 'var(--foreground)' }}>
              שם לקוח *
            </label>
            <input
              type="text"
              className="form-input"
              value={form.name}
              onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
              placeholder="שם הלקוח"
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: '600', marginBottom: '0.5rem', color: 'var(--foreground)' }}>
              שם חברה
            </label>
            <input
              type="text"
              className="form-input"
              value={form.company}
              onChange={(e) => setForm(prev => ({ ...prev, company: e.target.value }))}
              placeholder="שם החברה"
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: '600', marginBottom: '0.5rem', color: 'var(--foreground)' }}>
              איש קשר
            </label>
            <input
              type="text"
              className="form-input"
              value={form.contactPerson}
              onChange={(e) => setForm(prev => ({ ...prev, contactPerson: e.target.value }))}
              placeholder="שם איש הקשר"
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: '600', marginBottom: '0.5rem', color: 'var(--foreground)' }}>
              אימייל
            </label>
            <input
              type="email"
              dir="ltr"
              className="form-input"
              value={form.email}
              onChange={(e) => setForm(prev => ({ ...prev, email: e.target.value }))}
              placeholder="email@example.com"
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: '600', marginBottom: '0.5rem', color: 'var(--foreground)' }}>
              טלפון
            </label>
            <input
              type="tel"
              dir="ltr"
              className="form-input"
              value={form.phone}
              onChange={(e) => setForm(prev => ({ ...prev, phone: e.target.value }))}
              placeholder="+972 50 123 4567"
            />
          </div>
        </div>
      </div>

      {/* Section 2: Branding */}
      <div
        style={{
          background: 'var(--surface-raised)',
          border: '1px solid var(--border)',
          borderRadius: '0.75rem',
          padding: '1.5rem',
          marginBottom: '1.25rem',
        }}
      >
        <h2 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          🎨 מיתוג
        </h2>

        {/* Logo Upload */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: '600', marginBottom: '0.75rem', color: 'var(--foreground)' }}>
            לוגו
          </label>
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: '2px dashed var(--border)',
              borderRadius: '0.75rem',
              padding: '2rem',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 150ms',
              backgroundColor: 'rgba(0, 181, 254, 0.02)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--accent)';
              e.currentTarget.style.backgroundColor = 'rgba(0, 181, 254, 0.06)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.backgroundColor = 'rgba(0, 181, 254, 0.02)';
            }}
          >
            {logoPreview ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                <img src={logoPreview} alt="Preview" style={{ maxWidth: '120px', maxHeight: '80px', objectFit: 'contain' }} />
                <p style={{ margin: '0', fontSize: '0.8rem', color: 'var(--foreground-muted)' }}>
                  {uploading ? 'מעלה...' : 'לוגו הועלה בהצלחה. לחץ להחלפה'}
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.5rem' }}>📤</span>
                <p style={{ margin: '0', fontSize: '0.8125rem', fontWeight: '600', color: 'var(--foreground)' }}>
                  גרור לוגו או לחץ להעלאה
                </p>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: 'var(--foreground-muted)' }}>
                  PNG, JPG או SVG
                </p>
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
        </div>

        {/* Color Picker */}
        <div>
          <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: '600', marginBottom: '0.75rem', color: 'var(--foreground)' }}>
            צבע הלקוח
          </label>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            {PRESET_COLORS.map((color) => (
              <button
                key={color}
                onClick={() => setForm(prev => ({ ...prev, color }))}
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  backgroundColor: color,
                  border: form.color === color ? `3px solid var(--accent)` : '2px solid var(--border)',
                  cursor: 'pointer',
                  transition: 'all 150ms',
                  position: 'relative',
                }}
                title={color}
              >
                {form.color === color && (
                  <span style={{ position: 'absolute', inset: '0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>
                    ✓
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Section 3: Classification */}
      <div
        style={{
          background: 'var(--surface-raised)',
          border: '1px solid var(--border)',
          borderRadius: '0.75rem',
          padding: '1.5rem',
          marginBottom: '1.25rem',
        }}
      >
        <h2 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          🏷️ סיווג
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
          {CLIENT_TYPES.map((type) => (
            <button
              key={type.id}
              onClick={() => setForm(prev => ({ ...prev, clientType: type.id as any }))}
              style={{
                padding: '1rem',
                borderRadius: '0.75rem',
                border: form.clientType === type.id ? `2px solid var(--accent)` : `1px solid var(--border)`,
                background: form.clientType === type.id ? 'rgba(0, 181, 254, 0.08)' : 'var(--surface)',
                cursor: 'pointer',
                transition: 'all 150ms',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.5rem',
              }}
              onMouseEnter={(e) => {
                if (form.clientType !== type.id) {
                  e.currentTarget.style.borderColor = 'var(--border-muted)';
                }
              }}
              onMouseLeave={(e) => {
                if (form.clientType !== type.id) {
                  e.currentTarget.style.borderColor = 'var(--border)';
                }
              }}
            >
              <span style={{ fontSize: '1.5rem' }}>{type.emoji}</span>
              <span style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--foreground)' }}>
                {type.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Section 4: Business Context */}
      <div
        style={{
          background: 'var(--surface-raised)',
          border: '1px solid var(--border)',
          borderRadius: '0.75rem',
          padding: '1.5rem',
          marginBottom: '1.25rem',
        }}
      >
        <h2 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          💼 הקשר עסקי
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: '600', marginBottom: '0.5rem', color: 'var(--foreground)' }}>
              תחום עסקי
            </label>
            <input
              type="text"
              className="form-input"
              value={form.businessField}
              onChange={(e) => setForm(prev => ({ ...prev, businessField: e.target.value }))}
              placeholder="תחום הפעילות"
            />
          </div>
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: '600', marginBottom: '0.5rem', color: 'var(--foreground)' }}>
            יעדי שיווק
          </label>
          <textarea
            className="form-input"
            value={form.marketingGoals}
            onChange={(e) => setForm(prev => ({ ...prev, marketingGoals: e.target.value }))}
            placeholder="יעדי השיווק של הלקוח"
            rows={3}
            style={{ height: 'auto', padding: '0.75rem', fontFamily: 'inherit', resize: 'vertical' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: '600', marginBottom: '0.5rem', color: 'var(--foreground)' }}>
            הודעות שיווק עיקריות
          </label>
          <textarea
            className="form-input"
            value={form.keyMarketingMessages}
            onChange={(e) => setForm(prev => ({ ...prev, keyMarketingMessages: e.target.value }))}
            placeholder="הודעות חיוניות לשיווק"
            rows={3}
            style={{ height: 'auto', padding: '0.75rem', fontFamily: 'inherit', resize: 'vertical' }}
          />
        </div>
      </div>

      {/* Section 5: Web & Social URLs */}
      <div
        style={{
          background: 'var(--surface-raised)',
          border: '1px solid var(--border)',
          borderRadius: '0.75rem',
          padding: '1.5rem',
          marginBottom: '1.25rem',
        }}
      >
        <h2 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          🔗 אתר וכתובות חברתיות
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: '600', marginBottom: '0.5rem', color: 'var(--foreground)' }}>
              כתובת אתר
            </label>
            <input type="text" className="form-input" value={form.websiteUrl} onChange={(e) => setForm(prev => ({ ...prev, websiteUrl: e.target.value }))} placeholder="https://example.com" />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: '600', marginBottom: '0.5rem', color: 'var(--foreground)' }}>
              עמוד פייסבוק
            </label>
            <input type="text" className="form-input" value={form.facebookPageUrl} onChange={(e) => setForm(prev => ({ ...prev, facebookPageUrl: e.target.value }))} placeholder="https://facebook.com/..." />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: '600', marginBottom: '0.5rem', color: 'var(--foreground)' }}>
              פרופיל אינסטגרם
            </label>
            <input type="text" className="form-input" value={form.instagramProfileUrl} onChange={(e) => setForm(prev => ({ ...prev, instagramProfileUrl: e.target.value }))} placeholder="https://instagram.com/..." />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: '600', marginBottom: '0.5rem', color: 'var(--foreground)' }}>
              טיקטוק
            </label>
            <input type="text" className="form-input" value={form.tiktokProfileUrl} onChange={(e) => setForm(prev => ({ ...prev, tiktokProfileUrl: e.target.value }))} placeholder="https://tiktok.com/@..." />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: '600', marginBottom: '0.5rem', color: 'var(--foreground)' }}>
              לינקדאין
            </label>
            <input type="text" className="form-input" value={form.linkedinUrl} onChange={(e) => setForm(prev => ({ ...prev, linkedinUrl: e.target.value }))} placeholder="https://linkedin.com/company/..." />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: '600', marginBottom: '0.5rem', color: 'var(--foreground)' }}>
              יוטיוב
            </label>
            <input type="text" className="form-input" value={form.youtubeUrl} onChange={(e) => setForm(prev => ({ ...prev, youtubeUrl: e.target.value }))} placeholder="https://youtube.com/..." />
          </div>
        </div>
      </div>

      {/* Section 6: Financial */}
      <div
        style={{
          background: 'var(--surface-raised)',
          border: '1px solid var(--border)',
          borderRadius: '0.75rem',
          padding: '1.5rem',
          marginBottom: '1.25rem',
        }}
      >
        <h2 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          💰 פיננסי
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: '600', marginBottom: '0.5rem', color: 'var(--foreground)' }}>
              סכום ריטיינר חודשי
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <span style={{ position: 'absolute', insetInlineStart: '0.75rem', color: 'var(--foreground-muted)', fontSize: '0.9rem' }}>
                ₪
              </span>
              <input
                type="number"
                className="form-input"
                value={form.retainerAmount}
                onChange={(e) => setForm(prev => ({ ...prev, retainerAmount: parseInt(e.target.value) || 0 }))}
                placeholder="0"
                dir="ltr"
                style={{ paddingInlineStart: '2rem' }}
              />
            </div>
            <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', color: 'var(--foreground-muted)' }}>
              השאר ריק ללקוח ללא ריטיינר
            </p>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: '600', marginBottom: '0.5rem', color: 'var(--foreground)' }}>
              יום תשלום בחודש
            </label>
            <input
              type="number"
              className="form-input"
              value={form.retainerDay}
              onChange={(e) => {
                const val = parseInt(e.target.value) || 1;
                setForm(prev => ({ ...prev, retainerDay: Math.min(Math.max(val, 1), 28) }));
              }}
              placeholder="1"
              min="1"
              max="28"
              dir="ltr"
            />
          </div>
        </div>
      </div>

      {/* Section 7: Assignment */}
      <div
        style={{
          background: 'var(--surface-raised)',
          border: '1px solid var(--border)',
          borderRadius: '0.75rem',
          padding: '1.5rem',
          marginBottom: '1.25rem',
        }}
      >
        <h2 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          👥 הקצאה
        </h2>
        <div style={{ maxWidth: '300px' }}>
          <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: '600', marginBottom: '0.5rem', color: 'var(--foreground)' }}>
            מנהל מוקצה
          </label>
          <select
            className="form-select"
            value={form.assignedManagerId || ''}
            onChange={(e) => setForm(prev => ({ ...prev, assignedManagerId: e.target.value || null }))}
          >
            <option value="">בחר מנהל</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.name || emp.email}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Section 8: Portal */}
      <div
        style={{
          background: 'var(--surface-raised)',
          border: '1px solid var(--border)',
          borderRadius: '0.75rem',
          padding: '1.5rem',
          marginBottom: '1.25rem',
        }}
      >
        <h2 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          🔐 פורטל לקוח
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={form.portalEnabled}
              onChange={(e) => setForm(prev => ({ ...prev, portalEnabled: e.target.checked }))}
              style={{ cursor: 'pointer', width: '18px', height: '18px' }}
            />
            <span style={{ fontSize: '0.8125rem', fontWeight: '600', color: 'var(--foreground)' }}>
              הפעל פורטל לקוח
            </span>
          </label>
        </div>
        <p style={{ margin: '0', fontSize: '0.75rem', color: 'var(--foreground-muted)' }}>
          אם הפורטל מופעל, ניתן ליצור גישה ללקוח בשלב מאוחר יותר
        </p>
      </div>

      {/* Bottom Action Bar */}
      <div
        style={{
          display: 'flex',
          gap: '0.75rem',
          justifyContent: 'flex-end',
          paddingTop: '1.5rem',
          borderTop: '1px solid var(--border)',
        }}
      >
        <Link
          href="/clients"
          style={{
            padding: '0.45rem 1rem',
            borderRadius: '0.5rem',
            border: '1px solid var(--border)',
            background: 'none',
            color: 'var(--foreground-muted)',
            fontSize: '0.8125rem',
            fontWeight: '600',
            cursor: 'pointer',
            textDecoration: 'none',
            transition: 'all 150ms',
            display: 'inline-flex',
            alignItems: 'center',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-muted)';
            e.currentTarget.style.color = 'var(--foreground)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border)';
            e.currentTarget.style.color = 'var(--foreground-muted)';
          }}
        >
          ביטול
        </Link>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="mod-btn-primary"
          style={{
            opacity: submitting ? 0.7 : 1,
            cursor: submitting ? 'not-allowed' : 'pointer',
          }}
        >
          {submitting ? 'יוצר...' : 'צור לקוח'}
        </button>
      </div>
    </div>
  );
}
