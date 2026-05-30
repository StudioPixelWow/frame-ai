'use client';

const BRAND = '#00B5FE';

// Hebrew labels for common Meta CTA types
const CTA_LABELS: Record<string, string> = {
  LEARN_MORE: 'מידע נוסף', SIGN_UP: 'הרשמה', SHOP_NOW: 'לרכישה', BOOK_TRAVEL: 'להזמנה',
  CONTACT_US: 'צרו קשר', GET_OFFER: 'קבלת הצעה', GET_QUOTE: 'קבלת הצעת מחיר',
  SUBSCRIBE: 'הרשמה', APPLY_NOW: 'הגשת מועמדות', DOWNLOAD: 'הורדה', MESSAGE_PAGE: 'שליחת הודעה',
  WHATSAPP_MESSAGE: 'הודעת וואטסאפ', CALL_NOW: 'התקשרו עכשיו', GET_DIRECTIONS: 'ניווט',
  SEND_MESSAGE: 'שליחת הודעה', DONATE_NOW: 'לתרומה', NO_BUTTON: '',
};

interface AdPreviewProps {
  ad: {
    name?: string;
    mediaUrl?: string;
    thumbnailUrl?: string;
    primaryText?: string;
    headline?: string;
    description?: string;
    ctaType?: string;
    ctaLink?: string;
    creativeType?: string;
  };
  pageName?: string;
}

function hostOf(url?: string): string {
  if (!url) return '';
  try { return new URL(url).hostname.replace(/^www\./, '').toUpperCase(); } catch { return url; }
}

/**
 * Facebook-style visual preview of an ad: page header, primary text, media,
 * a link card (headline + description + domain + CTA button). Read-only.
 */
export default function AdPreview({ ad, pageName }: AdPreviewProps) {
  const media = ad.mediaUrl || ad.thumbnailUrl || '';
  const cta = ad.ctaType ? (CTA_LABELS[ad.ctaType] ?? ad.ctaType) : '';

  return (
    <div style={{ maxWidth: 340, border: '1px solid var(--border, #e5e7eb)', borderRadius: 10, overflow: 'hidden', background: '#fff', direction: 'rtl', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px' }}>
        <div style={{ width: 34, height: 34, borderRadius: '50%', background: BRAND, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14 }}>
          {(pageName || 'F').charAt(0)}
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>{pageName || 'העמוד שלך'}</div>
          <div style={{ fontSize: 11, color: '#9ca3af' }}>ממומן · Meta</div>
        </div>
      </div>

      {/* Primary text */}
      {ad.primaryText && (
        <div style={{ padding: '0 12px 10px', fontSize: 13.5, lineHeight: 1.55, color: '#1c1e21', whiteSpace: 'pre-wrap' }}>
          {ad.primaryText}
        </div>
      )}

      {/* Media */}
      <div style={{ width: '100%', aspectRatio: '1.91 / 1', background: '#f0f2f5', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {media ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={media} alt={ad.name || 'ad'} style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
        ) : (
          <div style={{ color: '#9ca3af', fontSize: 12, textAlign: 'center', padding: 16 }}>
            {ad.creativeType === 'video' ? '🎬 וידאו (אין תצוגה מקדימה)' : 'אין תמונה זמינה'}
          </div>
        )}
      </div>

      {/* Link card */}
      {(ad.headline || ad.description || ad.ctaLink || cta) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: '#f7f8fa', borderTop: '1px solid #e5e7eb' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {ad.ctaLink && <div style={{ fontSize: 10.5, color: '#65676b', letterSpacing: 0.3 }}>{hostOf(ad.ctaLink)}</div>}
            {ad.headline && <div style={{ fontSize: 13, fontWeight: 700, color: '#1c1e21', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ad.headline}</div>}
            {ad.description && <div style={{ fontSize: 11.5, color: '#65676b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ad.description}</div>}
          </div>
          {cta && (
            <div style={{ flexShrink: 0, background: '#e4e6eb', color: '#050505', fontSize: 12, fontWeight: 700, padding: '7px 12px', borderRadius: 6 }}>
              {cta}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
