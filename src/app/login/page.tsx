'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const STATUE_URL = 'https://s-pixel.co.il/wp-content/uploads/2025/12/Layer-47.png';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Ensure admin user exists (fire-and-forget, never blocks)
    fetch('/api/auth/seed', { method: 'POST' }).catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      let data: any;
      try {
        data = await response.json();
      } catch {
        setError('שגיאה בהתחברות, נסה שוב');
        setLoading(false);
        return;
      }

      if (!response.ok || !data.success) {
        setError(data.error || 'שגיאה בהתחברות, נסה שוב');
        setLoading(false);
        return;
      }

      // Store role info in localStorage for AuthProvider
      localStorage.setItem('frameai_role', data.user.role || '');
      localStorage.setItem('frameai_client_id', data.user.linkedClientId || '');
      localStorage.setItem('frameai_employee_id', data.user.linkedEmployeeId || '');

      // Redirect based on role
      if (data.user.role === 'admin') {
        router.push('/dashboard');
      } else if (data.user.role === 'employee') {
        router.push('/');
      } else if (data.user.role === 'client') {
        const clientId = data.user.linkedClientId || '';
        router.push(`/client-portal/dashboard?clientId=${clientId}`);
      } else {
        router.push('/');
      }
    } catch (err) {
      setError('שגיאה בהתחברות, נסה שוב');
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(28px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-12px); }
        }
        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes pulse-ring {
          0%, 100% { transform: scale(1); opacity: 0.18; }
          50% { transform: scale(1.06); opacity: 0.08; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes statue-float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        .login-input {
          width: 100%;
          padding: 14px 16px;
          font-size: 14px;
          background: rgba(255,255,255,0.15);
          color: #0d3b5e;
          border: 1.5px solid rgba(255,255,255,0.4);
          border-radius: 12px;
          box-sizing: border-box;
          transition: all 0.25s ease;
          outline: none;
          font-family: inherit;
          backdrop-filter: blur(4px);
        }
        .login-input::placeholder {
          color: rgba(13,59,94,0.35);
        }
        .login-input:focus {
          border-color: rgba(255,255,255,0.75);
          background: rgba(255,255,255,0.25);
          box-shadow: 0 0 0 3px rgba(255,255,255,0.15);
        }
        .login-cta {
          width: 100%;
          padding: 14px 20px;
          font-size: 15px;
          font-weight: 700;
          color: #0a0a0a;
          background: linear-gradient(135deg, #F0FF02, #d4e000, #F0FF02);
          background-size: 200% 200%;
          border: none;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.3s ease;
          font-family: inherit;
          letter-spacing: 0.02em;
        }
        .login-cta:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 10px 30px rgba(240, 255, 2, 0.4);
          animation: gradientShift 2s ease infinite;
        }
        .login-cta:active:not(:disabled) { transform: translateY(0px); }
        .login-cta:disabled { opacity: 0.6; cursor: not-allowed; }
      `}</style>

      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        background: 'linear-gradient(135deg, #02AFFE, #05E2FF)',
      }}>
        {/* Soft decorative orbs */}
        <div style={{
          position: 'absolute', top: '-100px', right: '-60px',
          width: '380px', height: '380px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,255,255,0.22), transparent 70%)',
          animation: 'pulse-ring 8s ease-in-out infinite',
        }} />
        <div style={{
          position: 'absolute', bottom: '-80px', left: '-80px',
          width: '320px', height: '320px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,255,255,0.18), transparent 70%)',
          animation: 'pulse-ring 10s ease-in-out infinite 2s',
        }} />
        <div style={{
          position: 'absolute', top: '25%', left: '8%',
          width: '180px', height: '180px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,255,255,0.12), transparent 70%)',
          animation: 'pulse-ring 7s ease-in-out infinite 1s',
        }} />

        {/* ── Greek statue image ── */}
        {!imgError && (
          <div style={{
            position: 'absolute',
            bottom: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            width: '460px',
            maxWidth: '55vw',
            pointerEvents: 'none',
            animation: mounted ? 'statue-float 6s ease-in-out infinite' : 'none',
            opacity: imgLoaded ? 0.2 : 0,
            transition: 'opacity 0.8s ease',
            filter: 'drop-shadow(0 10px 40px rgba(0,40,80,0.15))',
          }}>
            <img
              src={STATUE_URL}
              alt=""
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgError(true)}
              style={{
                width: '100%',
                height: 'auto',
                display: 'block',
              }}
            />
          </div>
        )}

        {/* ── Centered login card ── */}
        <div style={{
          position: 'relative',
          zIndex: 2,
          width: '100%',
          maxWidth: '400px',
          margin: '0 1.5rem',
          padding: '2.5rem 2rem',
          borderRadius: '20px',
          background: 'rgba(255,255,255,0.2)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.35)',
          boxShadow: '0 24px 64px rgba(0,40,80,0.12), 0 0 0 1px rgba(255,255,255,0.1) inset',
          direction: 'rtl',
          animation: mounted ? 'fadeInUp 0.7s cubic-bezier(0.22,1,0.36,1)' : 'none',
        }}>
          {/* Logo */}
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <div style={{
              animation: mounted ? 'float 6s ease-in-out infinite' : 'none',
              marginBottom: '0.75rem',
            }}>
              <img
                src="https://s-pixel.co.il/wp-content/uploads/2026/04/Asset-1.png"
                alt="Studio Pixel"
                style={{ height: '44px', width: 'auto', filter: 'brightness(0) saturate(100%)' }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
            <h1 style={{
              fontSize: '1.55rem', fontWeight: 800, color: '#0d3b5e',
              margin: '0 0 0.3rem 0', letterSpacing: '-0.02em',
            }}>
              PixelManageAI
            </h1>
            <p style={{ fontSize: '0.85rem', color: '#1a6a9a', margin: 0 }}>
              כניסה למערכת הניהול
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '1.1rem' }}>
              <label htmlFor="email" style={{
                display: 'block', fontSize: '0.78rem', fontWeight: 600,
                color: '#0d3b5e', marginBottom: '0.45rem',
              }}>
                דואר אלקטרוני
              </label>
              <input
                id="email" type="email" className="login-input"
                value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com" required autoComplete="email"
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label htmlFor="password" style={{
                display: 'block', fontSize: '0.78rem', fontWeight: 600,
                color: '#0d3b5e', marginBottom: '0.45rem',
              }}>
                סיסמה
              </label>
              <input
                id="password" type="password" className="login-input"
                value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••" required autoComplete="current-password"
              />
            </div>

            {error && (
              <div style={{
                padding: '12px 14px', marginBottom: '1.1rem',
                background: 'rgba(239, 68, 68, 0.12)', color: '#dc2626',
                borderRadius: '10px', fontSize: '0.82rem',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                animation: 'fadeInUp 0.3s ease',
              }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="login-cta">
              {loading ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{
                    width: '16px', height: '16px',
                    border: '2px solid rgba(0,0,0,0.2)', borderTopColor: '#0a0a0a',
                    borderRadius: '50%', display: 'inline-block',
                    animation: 'spin 0.6s linear infinite',
                  }} />
                  מתחבר...
                </span>
              ) : 'כניסה'}
            </button>
          </form>

          {/* Feature pills */}
          <div style={{
            display: 'flex', gap: '0.45rem', justifyContent: 'center',
            flexWrap: 'wrap', marginTop: '1.5rem',
          }}>
            {['ניהול לקוחות', 'מעקב משימות', 'דוחות חכמים', 'אוטומציה'].map((f, i) => (
              <span key={f} style={{
                padding: '0.3rem 0.7rem', borderRadius: '999px',
                background: 'rgba(255,255,255,0.3)', color: '#0d3b5e',
                fontSize: '0.68rem', fontWeight: 600,
                border: '1px solid rgba(255,255,255,0.4)',
                animation: mounted ? `fadeInUp 0.5s ease ${0.5 + i * 0.1}s backwards` : 'none',
              }}>
                {f}
              </span>
            ))}
          </div>

          <p style={{
            fontSize: '0.68rem', color: '#1a6a9a', margin: '1.5rem 0 0 0',
            textAlign: 'center', opacity: 0.7,
          }}>
            ניהול חכם. תוצאות מדויקות.
          </p>
        </div>

        {/* Bottom */}
        <p style={{
          position: 'absolute', bottom: '1rem', fontSize: '0.7rem',
          color: 'rgba(255,255,255,0.5)', margin: 0, textAlign: 'center', width: '100%',
        }}>
          Powered by Studio Pixel &middot; סטודיו פיקסל © 2026
        </p>
      </div>
    </>
  );
}
