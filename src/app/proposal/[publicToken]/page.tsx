'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';

/* ══════════════════════════════════════════════════════════════
   TYPES (inline to avoid importing auth-dependent modules)
   ══════════════════════════════════════════════════════════════ */

interface ProposalItem {
  id: string;
  text: string;
  included: boolean;
  order: number;
}

interface ProposalSection {
  id: string;
  title: string;
  items: ProposalItem[];
  order: number;
}

interface ProposalApprovalData {
  approvedAt: string;
  signatureDataUrl: string;
  fullName: string;
  businessName: string;
  businessId: string;
  date: string;
}

interface Proposal {
  id: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  clientContactPerson: string;
  clientBusinessName: string;
  title: string;
  status: string;
  publicToken: string;
  intro: string;
  sections: ProposalSection[];
  pricingType: string;
  price: number;
  discount: number;
  discountType: string;
  vatRate: number;
  includeVat: boolean;
  paymentTerms: string;
  customPaymentTerms: string;
  contractPeriod: string;
  generalTerms: string[];
  publishedAt: string | null;
  firstViewedAt: string | null;
  lastViewedAt: string | null;
  viewCount: number;
  approval: ProposalApprovalData | null;
  approvedSnapshot: Record<string, unknown> | null;
  notes: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/* ══════════════════════════════════════════════════════════════
   DESIGN TOKENS
   ══════════════════════════════════════════════════════════════ */

const C = {
  accent: '#00B5FE',
  accentDark: '#0095D0',
  neonYellow: '#F0FF02',
  bg: '#ffffff',
  cardBg: '#ffffff',
  text: '#1A1A2E',
  textSecondary: '#5A5A7A',
  textMuted: '#9A9AB0',
  border: '#E8EAF0',
  borderLight: '#F0F2F5',
  success: '#22c55e',
  successBg: '#dcfce7',
  successDark: '#15803d',
  overlay: 'rgba(0,0,0,0.5)',
};

/* ══════════════════════════════════════════════════════════════
   HELPERS
   ══════════════════════════════════════════════════════════════ */

function formatDate(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('he-IL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

function calcPricing(p: Proposal) {
  const basePrice = p.price || 0;
  let discountAmount = 0;
  if (p.discount) {
    discountAmount =
      p.discountType === 'percent'
        ? basePrice * (p.discount / 100)
        : p.discount;
  }
  const afterDiscount = basePrice - discountAmount;
  const vatAmount = p.includeVat ? afterDiscount * (p.vatRate / 100) : 0;
  const total = afterDiscount + vatAmount;
  return { basePrice, discountAmount, afterDiscount, vatAmount, total };
}

function formatCurrency(n: number): string {
  return n.toLocaleString('he-IL', {
    style: 'currency',
    currency: 'ILS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function todayString(): string {
  return new Date().toLocaleDateString('he-IL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/* ══════════════════════════════════════════════════════════════
   SIGNATURE CANVAS COMPONENT
   ══════════════════════════════════════════════════════════════ */

function SignatureCanvas({
  onSignatureChange,
}: {
  onSignatureChange: (dataUrl: string | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  const getPos = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>,
  ): { x: number; y: number } => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e) {
      const touch = e.touches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDraw = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>,
  ) => {
    e.preventDefault();
    isDrawing.current = true;
    lastPos.current = getPos(e);
  };

  const draw = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>,
  ) => {
    if (!isDrawing.current || !lastPos.current) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = C.text;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    lastPos.current = pos;
  };

  const endDraw = () => {
    if (isDrawing.current) {
      isDrawing.current = false;
      lastPos.current = null;
      const dataUrl = canvasRef.current?.toDataURL('image/png') || null;
      onSignatureChange(dataUrl);
    }
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    onSignatureChange(null);
  };

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
        }}
      >
        <label style={{ fontWeight: 600, color: C.text, fontSize: 14 }}>
          חתימה
        </label>
        <button
          type="button"
          onClick={clear}
          style={{
            background: 'none',
            border: 'none',
            color: C.accent,
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          נקה חתימה
        </button>
      </div>
      <canvas
        ref={canvasRef}
        width={560}
        height={160}
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={endDraw}
        onMouseLeave={endDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={endDraw}
        style={{
          width: '100%',
          height: 160,
          border: `1.5px solid ${C.border}`,
          borderRadius: 10,
          cursor: 'crosshair',
          touchAction: 'none',
          background: '#FAFAFA',
        }}
      />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   APPROVAL MODAL COMPONENT
   ══════════════════════════════════════════════════════════════ */

function ApprovalModal({
  publicToken,
  onClose,
  onApproved,
}: {
  publicToken: string;
  onClose: () => void;
  onApproved: () => void;
}) {
  const [fullName, setFullName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [businessId, setBusinessId] = useState('');
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const canSubmit =
    fullName.trim() &&
    businessName.trim() &&
    businessId.trim() &&
    signatureDataUrl &&
    confirmed &&
    !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError('');
    try {
      const now = new Date().toISOString();
      const res = await fetch('/api/proposals/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publicToken,
          approval: {
            signatureDataUrl,
            fullName: fullName.trim(),
            businessName: businessName.trim(),
            businessId: businessId.trim(),
            date: todayString(),
            approvedAt: now,
          },
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'שגיאה באישור ההצעה');
      }
      onApproved();
    } catch (err: any) {
      setError(err.message || 'שגיאה באישור ההצעה');
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    border: `1.5px solid ${C.border}`,
    borderRadius: 10,
    fontSize: 14,
    color: C.text,
    background: '#FAFAFA',
    outline: 'none',
    direction: 'rtl',
    boxSizing: 'border-box',
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: C.overlay,
        padding: 16,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 16,
          padding: 32,
          maxWidth: 520,
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          direction: 'rtl',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 24,
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 700,
              color: C.text,
            }}
          >
            אישור ההצעה
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 22,
              cursor: 'pointer',
              color: C.textMuted,
              padding: 4,
            }}
          >
            &times;
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Business name */}
          <div>
            <label
              style={{
                display: 'block',
                fontWeight: 600,
                marginBottom: 6,
                fontSize: 14,
                color: C.text,
              }}
            >
              שם העסק
            </label>
            <input
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="שם העסק"
              style={inputStyle}
            />
          </div>

          {/* Full name */}
          <div>
            <label
              style={{
                display: 'block',
                fontWeight: 600,
                marginBottom: 6,
                fontSize: 14,
                color: C.text,
              }}
            >
              שם מלא
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="שם מלא"
              style={inputStyle}
            />
          </div>

          {/* Business ID */}
          <div>
            <label
              style={{
                display: 'block',
                fontWeight: 600,
                marginBottom: 6,
                fontSize: 14,
                color: C.text,
              }}
            >
              ע.מ / ח.פ
            </label>
            <input
              type="text"
              value={businessId}
              onChange={(e) => setBusinessId(e.target.value)}
              placeholder="מספר עוסק מורשה / חברה פרטית"
              style={inputStyle}
            />
          </div>

          {/* Date (auto) */}
          <div>
            <label
              style={{
                display: 'block',
                fontWeight: 600,
                marginBottom: 6,
                fontSize: 14,
                color: C.text,
              }}
            >
              תאריך
            </label>
            <input
              type="text"
              value={todayString()}
              readOnly
              style={{ ...inputStyle, background: '#F0F2F5', color: C.textSecondary }}
            />
          </div>

          {/* Signature */}
          <SignatureCanvas onSignatureChange={setSignatureDataUrl} />

          {/* Confirmation checkbox */}
          <label
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              cursor: 'pointer',
              fontSize: 14,
              color: C.text,
              lineHeight: 1.5,
            }}
          >
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              style={{
                width: 18,
                height: 18,
                marginTop: 2,
                accentColor: C.accent,
                flexShrink: 0,
              }}
            />
            <span>אני מאשר/ת את תנאי ההצעה</span>
          </label>

          {error && (
            <p style={{ color: '#ef4444', fontSize: 14, margin: 0 }}>{error}</p>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            style={{
              width: '100%',
              padding: '14px 0',
              borderRadius: 12,
              border: 'none',
              background: canSubmit ? C.accent : C.border,
              color: canSubmit ? '#fff' : C.textMuted,
              fontSize: 16,
              fontWeight: 700,
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              transition: 'background 0.2s',
            }}
          >
            {submitting ? 'שולח...' : 'אשר הצעה'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   SUCCESS CONFETTI OVERLAY
   ══════════════════════════════════════════════════════════════ */

function SuccessOverlay() {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10001,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(255,255,255,0.95)',
        animation: 'fadeIn 0.5s ease',
      }}
    >
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes popIn {
          0% { transform: scale(0); opacity: 0; }
          50% { transform: scale(1.2); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes confettiFall {
          0% { transform: translateY(-100vh) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
      `}</style>

      {/* Confetti particles */}
      {Array.from({ length: 40 }).map((_, i) => (
        <div
          key={i}
          style={{
            position: 'fixed',
            top: -20,
            left: `${Math.random() * 100}%`,
            width: 10,
            height: 10,
            borderRadius: i % 3 === 0 ? '50%' : 2,
            background: [
              C.accent,
              C.neonYellow,
              C.success,
              '#FF6B6B',
              '#845EC2',
              '#FFC75F',
            ][i % 6],
            animation: `confettiFall ${2 + Math.random() * 2}s ease-in ${
              Math.random() * 1.5
            }s forwards`,
            zIndex: 10002,
          }}
        />
      ))}

      <div
        style={{
          animation: 'popIn 0.6s ease 0.3s both',
          textAlign: 'center',
          direction: 'rtl',
        }}
      >
        <div style={{ fontSize: 72, marginBottom: 16 }}>&#10003;</div>
        <h2
          style={{
            fontSize: 28,
            fontWeight: 700,
            color: C.success,
            marginBottom: 8,
          }}
        >
          ההצעה אושרה בהצלחה!
        </h2>
        <p style={{ fontSize: 16, color: C.textSecondary }}>
          תודה רבה! נעדכן אותך בהמשך.
        </p>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN PAGE COMPONENT
   ══════════════════════════════════════════════════════════════ */

export default function PublicProposalPage() {
  const params = useParams();
  const publicToken = params?.publicToken as string;

  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);

  /* ── Fetch proposal ─────────────────────────────────────────── */
  const fetchProposal = useCallback(async () => {
    try {
      const res = await fetch('/api/data/proposals');
      const all: Proposal[] = await res.json();
      const found = all.find((p) => p.publicToken === publicToken);
      if (!found) {
        setNotFound(true);
      } else {
        setProposal(found);
      }
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [publicToken]);

  /* ── Track view ─────────────────────────────────────────────── */
  useEffect(() => {
    if (!publicToken) return;
    fetch('/api/proposals/track-view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ publicToken }),
    }).catch(() => {});
  }, [publicToken]);

  useEffect(() => {
    fetchProposal();
  }, [fetchProposal]);

  /* ── Approval callback ──────────────────────────────────────── */
  const handleApproved = () => {
    setShowModal(false);
    setShowSuccess(true);
    setTimeout(() => {
      setShowSuccess(false);
      fetchProposal();
    }, 3500);
  };

  /* ── Loading state ──────────────────────────────────────────── */
  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#F7F9FC',
          direction: 'rtl',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: 40,
              height: 40,
              border: `3px solid ${C.border}`,
              borderTopColor: C.accent,
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
              margin: '0 auto 16px',
            }}
          />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <p style={{ color: C.textSecondary, fontSize: 16 }}>טוען הצעה...</p>
        </div>
      </div>
    );
  }

  /* ── Not found state ────────────────────────────────────────── */
  if (notFound || !proposal) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#F7F9FC',
          direction: 'rtl',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>&#128269;</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: C.text, marginBottom: 8 }}>
            ההצעה לא נמצאה
          </h2>
          <p style={{ color: C.textSecondary, fontSize: 15 }}>
            הקישור אינו תקין או שההצעה הוסרה.
          </p>
        </div>
      </div>
    );
  }

  /* ── Pricing calculation ────────────────────────────────────── */
  const pricing = calcPricing(proposal);
  const isApproved = proposal.status === 'approved';
  const sortedSections = [...(proposal.sections || [])].sort(
    (a, b) => a.order - b.order,
  );

  const paymentTermsLabel =
    proposal.paymentTerms === 'custom'
      ? proposal.customPaymentTerms
      : proposal.paymentTerms === 'net0'
      ? 'תשלום מיידי'
      : proposal.paymentTerms === 'net15'
      ? 'שוטף + 15'
      : proposal.paymentTerms === 'net30'
      ? 'שוטף + 30'
      : proposal.paymentTerms === 'net45'
      ? 'שוטף + 45'
      : proposal.paymentTerms === 'net60'
      ? 'שוטף + 60'
      : proposal.paymentTerms === 'end_of_month'
      ? 'סוף חודש'
      : proposal.paymentTerms || '';

  /* ── Card wrapper ───────────────────────────────────────────── */
  const cardStyle: React.CSSProperties = {
    background: C.cardBg,
    borderRadius: 14,
    padding: 28,
    marginBottom: 20,
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    border: `1px solid ${C.borderLight}`,
  };

  /* ══════════════════════════════════════════════════════════════
     RENDER
     ══════════════════════════════════════════════════════════════ */
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#F7F9FC',
        direction: 'rtl',
        fontFamily:
          'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      }}
    >
      {showModal && (
        <ApprovalModal
          publicToken={publicToken}
          onClose={() => setShowModal(false)}
          onApproved={handleApproved}
        />
      )}
      {showSuccess && <SuccessOverlay />}

      {/* ── HEADER ─────────────────────────────────────────────── */}
      <header
        style={{
          background: C.text,
          padding: '20px 24px',
          borderBottom: `3px solid ${C.accent}`,
        }}
      >
        <div
          style={{
            maxWidth: 800,
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <div
              style={{
                fontWeight: 800,
                fontSize: 20,
                color: '#fff',
                letterSpacing: 2,
              }}
            >
              STUDIO{' '}
              <span style={{ color: C.accent }}>PIXEL</span>
            </div>
          </div>
          {isApproved && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: 'rgba(34,197,94,0.15)',
                color: C.success,
                padding: '6px 14px',
                borderRadius: 20,
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              <span>&#10003;</span>
              <span>ההצעה אושרה</span>
            </div>
          )}
        </div>
      </header>

      {/* ── CONTENT ────────────────────────────────────────────── */}
      <main
        style={{
          maxWidth: 800,
          margin: '0 auto',
          padding: '32px 20px 64px',
        }}
      >
        {/* Title */}
        <h1
          style={{
            fontSize: 28,
            fontWeight: 800,
            color: C.text,
            marginBottom: 4,
            lineHeight: 1.3,
          }}
        >
          {proposal.title}
        </h1>

        {/* ── HERO META ────────────────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 16,
            marginBottom: 28,
            fontSize: 14,
            color: C.textSecondary,
          }}
        >
          <span>
            <strong>עבור:</strong> {proposal.clientBusinessName || proposal.clientContactPerson || proposal.clientName}
          </span>
          <span>
            <strong>תאריך:</strong> {formatDate(proposal.createdAt)}
          </span>
        </div>

        {/* ── INTRO ────────────────────────────────────────────── */}
        {proposal.intro && (
          <div style={cardStyle}>
            <p
              style={{
                margin: 0,
                fontSize: 15,
                lineHeight: 1.8,
                color: C.text,
                whiteSpace: 'pre-wrap',
              }}
            >
              {proposal.intro}
            </p>
          </div>
        )}

        {/* ── SERVICE SECTIONS ─────────────────────────────────── */}
        {sortedSections.map((section) => {
          const includedItems = section.items
            .filter((it) => it.included)
            .sort((a, b) => a.order - b.order);
          if (includedItems.length === 0) return null;
          return (
            <div key={section.id} style={cardStyle}>
              <h3
                style={{
                  margin: '0 0 16px',
                  fontSize: 18,
                  fontWeight: 700,
                  color: C.text,
                  paddingBottom: 12,
                  borderBottom: `2px solid ${C.borderLight}`,
                }}
              >
                {section.title}
              </h3>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                {includedItems.map((item) => (
                  <li
                    key={item.id}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                      padding: '8px 0',
                      borderBottom: `1px solid ${C.borderLight}`,
                      fontSize: 14,
                      lineHeight: 1.6,
                      color: C.text,
                    }}
                  >
                    <span
                      style={{
                        color: C.accent,
                        fontWeight: 700,
                        fontSize: 16,
                        flexShrink: 0,
                        marginTop: 1,
                      }}
                    >
                      &#10003;
                    </span>
                    <span>{item.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}

        {/* ── PRICING SECTION ──────────────────────────────────── */}
        <div
          style={{
            ...cardStyle,
            border: `2px solid ${C.accent}`,
            background: '#FAFEFF',
          }}
        >
          <h3
            style={{
              margin: '0 0 20px',
              fontSize: 18,
              fontWeight: 700,
              color: C.text,
            }}
          >
            סיכום מחירים
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Base price */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 15,
                color: C.text,
              }}
            >
              <span>
                מחיר בסיס{' '}
                {proposal.pricingType === 'retainer' ? '(ריטיינר חודשי)' : '(פרויקט)'}
              </span>
              <span>{formatCurrency(pricing.basePrice)}</span>
            </div>

            {/* Discount */}
            {pricing.discountAmount > 0 && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 15,
                  color: C.success,
                }}
              >
                <span>
                  הנחה
                  {proposal.discountType === 'percent'
                    ? ` (${proposal.discount}%)`
                    : ''}
                </span>
                <span>- {formatCurrency(pricing.discountAmount)}</span>
              </div>
            )}

            {/* After discount */}
            {pricing.discountAmount > 0 && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 15,
                  color: C.text,
                  paddingTop: 8,
                  borderTop: `1px solid ${C.borderLight}`,
                }}
              >
                <span>מחיר לאחר הנחה</span>
                <span>{formatCurrency(pricing.afterDiscount)}</span>
              </div>
            )}

            {/* VAT */}
            {proposal.includeVat && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 15,
                  color: C.textSecondary,
                }}
              >
                <span>
                  מע&quot;מ ({proposal.vatRate}%)
                </span>
                <span>{formatCurrency(pricing.vatAmount)}</span>
              </div>
            )}

            {/* Total */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 22,
                fontWeight: 800,
                color: C.text,
                paddingTop: 14,
                borderTop: `2px solid ${C.accent}`,
                marginTop: 4,
              }}
            >
              <span>סה&quot;כ</span>
              <span style={{ color: C.accent }}>{formatCurrency(pricing.total)}</span>
            </div>

            {/* Payment terms & contract */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                marginTop: 12,
                paddingTop: 12,
                borderTop: `1px solid ${C.borderLight}`,
                fontSize: 14,
                color: C.textSecondary,
              }}
            >
              {paymentTermsLabel && (
                <div>
                  <strong style={{ color: C.text }}>תנאי תשלום:</strong>{' '}
                  {paymentTermsLabel}
                </div>
              )}
              {proposal.contractPeriod && (
                <div>
                  <strong style={{ color: C.text }}>תקופת התקשרות:</strong>{' '}
                  {proposal.contractPeriod}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── GENERAL TERMS (collapsible) ──────────────────────── */}
        {proposal.generalTerms && proposal.generalTerms.length > 0 && (
          <div style={cardStyle}>
            <button
              onClick={() => setTermsOpen(!termsOpen)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                fontSize: 18,
                fontWeight: 700,
                color: C.text,
              }}
            >
              <span>תנאים כלליים</span>
              <span
                style={{
                  transition: 'transform 0.2s',
                  transform: termsOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  fontSize: 14,
                  color: C.textMuted,
                }}
              >
                &#9660;
              </span>
            </button>
            {termsOpen && (
              <ul
                style={{
                  margin: '16px 0 0',
                  padding: '0 18px 0 0',
                  listStyle: 'none',
                }}
              >
                {proposal.generalTerms.map((term, i) => (
                  <li
                    key={i}
                    style={{
                      padding: '8px 0',
                      fontSize: 14,
                      lineHeight: 1.7,
                      color: C.textSecondary,
                      borderBottom:
                        i < proposal.generalTerms.length - 1
                          ? `1px solid ${C.borderLight}`
                          : 'none',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 8,
                    }}
                  >
                    <span
                      style={{
                        color: C.textMuted,
                        fontSize: 12,
                        flexShrink: 0,
                        marginTop: 3,
                      }}
                    >
                      {i + 1}.
                    </span>
                    <span>{term}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* ── APPROVAL SECTION ─────────────────────────────────── */}
        {isApproved ? (
          <div
            style={{
              ...cardStyle,
              background: C.successBg,
              border: `2px solid ${C.success}`,
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontSize: 48,
                marginBottom: 12,
                color: C.success,
              }}
            >
              &#10003;
            </div>
            <h3
              style={{
                margin: '0 0 8px',
                fontSize: 22,
                fontWeight: 700,
                color: C.successDark,
              }}
            >
              ההצעה אושרה
            </h3>
            {proposal.approval && (
              <div
                style={{
                  fontSize: 14,
                  color: C.textSecondary,
                  lineHeight: 1.8,
                }}
              >
                <p style={{ margin: '4px 0' }}>
                  <strong>אושר על ידי:</strong> {proposal.approval.fullName}
                </p>
                <p style={{ margin: '4px 0' }}>
                  <strong>עסק:</strong> {proposal.approval.businessName}
                </p>
                <p style={{ margin: '4px 0' }}>
                  <strong>תאריך אישור:</strong> {proposal.approval.date}
                </p>

                {/* Display signature */}
                {proposal.approval.signatureDataUrl && (
                  <div style={{ marginTop: 16 }}>
                    <p
                      style={{
                        margin: '0 0 8px',
                        fontWeight: 600,
                        color: C.text,
                      }}
                    >
                      חתימה:
                    </p>
                    <img
                      src={proposal.approval.signatureDataUrl}
                      alt="חתימה"
                      style={{
                        maxWidth: 280,
                        height: 'auto',
                        border: `1px solid ${C.border}`,
                        borderRadius: 8,
                        background: '#fff',
                        padding: 8,
                      }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div
            style={{
              ...cardStyle,
              textAlign: 'center',
              background: 'linear-gradient(135deg, #FAFEFF, #F0F8FF)',
              border: `2px solid ${C.accent}`,
            }}
          >
            <h3
              style={{
                margin: '0 0 8px',
                fontSize: 20,
                fontWeight: 700,
                color: C.text,
              }}
            >
              אישור ההצעה
            </h3>
            <p
              style={{
                margin: '0 0 20px',
                fontSize: 14,
                color: C.textSecondary,
              }}
            >
              קראת את ההצעה ואת התנאים? ניתן לאשר את ההצעה בלחיצה על הכפתור.
            </p>
            <button
              onClick={() => setShowModal(true)}
              style={{
                padding: '14px 48px',
                borderRadius: 12,
                border: 'none',
                background: C.accent,
                color: '#fff',
                fontSize: 17,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'background 0.2s, transform 0.1s',
                boxShadow: `0 4px 14px rgba(0,181,254,0.3)`,
              }}
              onMouseOver={(e) => {
                (e.currentTarget.style.background = C.accentDark);
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseOut={(e) => {
                (e.currentTarget.style.background = C.accent);
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              אשר הצעה
            </button>
          </div>
        )}
      </main>

      {/* ── FOOTER ─────────────────────────────────────────────── */}
      <footer
        style={{
          textAlign: 'center',
          padding: '24px 20px',
          borderTop: `1px solid ${C.border}`,
          fontSize: 13,
          color: C.textMuted,
          background: '#fff',
        }}
      >
        <span style={{ fontWeight: 600 }}>STUDIO PIXEL</span> &mdash; הצעת מחיר
        מערכת PixelManageAI
      </footer>
    </div>
  );
}
