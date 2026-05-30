'use client';

interface PostPreviewProps {
  network: 'facebook' | 'instagram';
  kind: 'post' | 'story';
  pageName: string;
  igUsername?: string;
  message?: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
}

/**
 * Live preview of a social post/story as it will roughly appear on the network.
 * Read-only, updates as the user types.
 */
export default function PostPreview({ network, kind, pageName, igUsername, message, mediaUrl, mediaType }: PostPreviewProps) {
  const isIg = network === 'instagram';
  const handle = isIg ? (igUsername ? `@${igUsername}` : 'instagram') : pageName || 'העמוד שלך';
  const avatarBg = isIg ? 'linear-gradient(45deg,#f09433,#dc2743,#bc1888)' : '#1877f2';

  const media = mediaUrl ? (
    mediaType === 'video'
      ? <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', background: '#000' }}>🎬 וידאו</div>
      // eslint-disable-next-line @next/next/no-img-element
      : <img src={mediaUrl} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = '0.2'; }} />
  ) : (
    <div style={{ color: '#9ca3af', fontSize: 12, textAlign: 'center', padding: 12 }}>אין מדיה</div>
  );

  // ── Story layout (full-bleed vertical) ──
  if (kind === 'story') {
    return (
      <div dir="rtl" style={{ width: 200, borderRadius: 14, overflow: 'hidden', position: 'relative', aspectRatio: '9/16', background: '#111', boxShadow: '0 2px 10px rgba(0,0,0,0.18)' }}>
        <div style={{ position: 'absolute', inset: 0 }}>{media}</div>
        <div style={{ position: 'absolute', top: 8, right: 8, left: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 26, height: 26, borderRadius: '50%', background: avatarBg, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, border: '2px solid #fff' }}>{handle.charAt(handle.startsWith('@') ? 1 : 0)}</div>
          <span style={{ color: '#fff', fontSize: 12, fontWeight: 700, textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>{handle}</span>
        </div>
        {message && (
          <div style={{ position: 'absolute', bottom: 16, right: 10, left: 10, color: '#fff', fontSize: 13, textAlign: 'center', textShadow: '0 1px 4px rgba(0,0,0,0.7)' }}>{message}</div>
        )}
        <div style={{ position: 'absolute', bottom: 4, left: 0, right: 0, textAlign: 'center', color: 'rgba(255,255,255,0.7)', fontSize: 10 }}>סטורי · {isIg ? 'אינסטגרם' : 'פייסבוק'}</div>
      </div>
    );
  }

  // ── Feed post layout ──
  return (
    <div dir="rtl" style={{ width: 300, border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden', background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px' }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: avatarBg, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13 }}>{handle.charAt(handle.startsWith('@') ? 1 : 0)}</div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>{handle}</div>
          <div style={{ fontSize: 10.5, color: '#9ca3af' }}>{isIg ? 'אינסטגרם' : 'ממומן · פייסבוק'}</div>
        </div>
      </div>
      {!isIg && message && (
        <div style={{ padding: '0 12px 10px', fontSize: 13, lineHeight: 1.5, color: '#1c1e21', whiteSpace: 'pre-wrap' }}>{message}</div>
      )}
      <div style={{ width: '100%', aspectRatio: isIg ? '1/1' : '1.91/1', background: '#f0f2f5', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>{media}</div>
      {isIg && message && (
        <div style={{ padding: '8px 12px', fontSize: 12.5, lineHeight: 1.5, color: '#1c1e21', whiteSpace: 'pre-wrap' }}>
          <span style={{ fontWeight: 700 }}>{handle} </span>{message}
        </div>
      )}
    </div>
  );
}
