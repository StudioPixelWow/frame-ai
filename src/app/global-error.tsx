'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="he" dir="rtl">
      <body style={{
        fontFamily: 'system-ui, -apple-system, sans-serif',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', margin: 0,
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        color: '#e2e8f0',
      }}>
        <div style={{ textAlign: 'center', maxWidth: 480, padding: 40 }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>⚠️</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>שגיאה במערכת</h1>
          <p style={{ color: '#94a3b8', marginBottom: 24, lineHeight: 1.6 }}>
            אירעה שגיאה בלתי צפויה. הצוות הטכני קיבל התראה.
          </p>
          {process.env.NODE_ENV === 'development' && error?.message && (
            <pre style={{
              background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 8, padding: 16, fontSize: 13, textAlign: 'left', direction: 'ltr',
              overflow: 'auto', maxHeight: 200, marginBottom: 24,
            }}>
              {error.message}
            </pre>
          )}
          <button
            onClick={reset}
            style={{
              background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
              color: 'white', border: 'none', borderRadius: 8,
              padding: '12px 32px', fontSize: 16, fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            נסה שוב
          </button>
        </div>
      </body>
    </html>
  );
}
