export default function NotFound() {
  return (
    <div style={{
      fontFamily: 'system-ui, -apple-system, sans-serif',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', margin: 0,
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      color: '#e2e8f0', direction: 'rtl',
    }}>
      <div style={{ textAlign: 'center', maxWidth: 480, padding: 40 }}>
        <div style={{ fontSize: 80, fontWeight: 800, color: '#3b82f6', marginBottom: 8 }}>404</div>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>הדף לא נמצא</h1>
        <p style={{ color: '#94a3b8', marginBottom: 24 }}>
          הדף שחיפשת לא קיים או הוסר.
        </p>
        <a
          href="/"
          style={{
            display: 'inline-block',
            background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
            color: 'white', textDecoration: 'none', borderRadius: 8,
            padding: '12px 32px', fontSize: 16, fontWeight: 600,
          }}
        >
          חזרה לדף הראשי
        </a>
      </div>
    </div>
  );
}
