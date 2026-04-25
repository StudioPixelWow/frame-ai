'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
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

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'שגיאה בהתחברות');
        setLoading(false);
        return;
      }

      // Store role info in localStorage for AuthProvider
      localStorage.setItem('frameai_role', data.user.role || '');
      localStorage.setItem('frameai_client_id', data.user.linkedClientId || '');
      localStorage.setItem('frameai_employee_id', data.user.linkedEmployeeId || '');

      // Redirect based on role
      if (data.user.role === 'admin' || data.user.role === 'employee') {
        router.push('/');
      } else if (data.user.role === 'client') {
        const clientId = data.user.linkedClientId || '';
        router.push(`/client-portal/dashboard?clientId=${clientId}`);
      } else {
        router.push('/');
      }
    } catch (err) {
      setError('שגיאה ברשת. אנא נסה שוב.');
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeInLeft {
          from { opacity: 0; transform: translateX(-30px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-12px); }
        }
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes pulse-ring {
          0% { transform: scale(0.9); opacity: 0.5; }
          50% { transform: scale(1.05); opacity: 0.3; }
          100% { transform: scale(0.9); opacity: 0.5; }
        }
        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .login-input {
          width: 100%;
          padding: 14px 16px;
          font-size: 14px;
          background: rgba(255,255,255,0.06);
          color: var(--foreground, #fff);
          border: 1.5px solid rgba(255,255,255,0.12);
          border-radius: 10px;
          box-sizing: border-box;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          outline: none;
          font-family: inherit;
        }
        .login-input::placeholder {
          color: rgba(255,255,255,0.3);
        }
        .login-input:focus {
          border-color: #F0FF02;
          background: rgba(255,255,255,0.08);
          box-shadow: 0 0 0 3px rgba(240, 255, 2, 0.12);
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
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          font-family: inherit;
          letter-spacing: 0.02em;
          position: relative;
          overflow: hidden;
        }
        .login-cta:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 8px 24px rgba(240, 255, 2, 0.35);
          animation: gradientShift 2s ease infinite;
        }
        .login-cta:active:not(:disabled) {
          transform: translateY(0px);
        }
        .login-cta:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        @media (max-width: 900px) {
          .login-split { flex-direction: column !important; }
          .login-brand-panel { display: none !important; }
          .login-form-panel { width: 100% !important; }
        }
      `}</style>

      <div
        className="login-split"
        style={{
          display: 'flex',
          minHeight: '100vh',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        }}
      >
        {/* LEFT PANEL — Branding */}
        <div
          className="login-brand-panel"
          style={{
            flex: '1 1 50%',
            background: 'linear-gradient(160deg, #e8f4fd 0%, #d0eaf8 30%, #b8dff3 60%, #a0d4ee 100%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '3rem',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Decorative circles */}
          <div style={{
            position: 'absolute', top: '-60px', left: '-60px',
            width: '220px', height: '220px', borderRadius: '50%',
            background: 'rgba(255,255,255,0.25)',
            animation: 'pulse-ring 6s ease-in-out infinite',
          }} />
          <div style={{
            position: 'absolute', bottom: '-40px', right: '-40px',
            width: '180px', height: '180px', borderRadius: '50%',
            background: 'rgba(255,255,255,0.2)',
            animation: 'pulse-ring 8s ease-in-out infinite 1s',
          }} />
          <div style={{
            position: 'absolute', top: '40%', right: '15%',
            width: '100px', height: '100px', borderRadius: '50%',
            background: 'rgba(255,255,255,0.15)',
            animation: 'pulse-ring 7s ease-in-out infinite 2s',
          }} />

          {/* Content */}
          <div style={{
            textAlign: 'center',
            zIndex: 1,
            animation: mounted ? 'fadeInLeft 0.8s cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
          }}>
            {/* Logo */}
            <div style={{
              marginBottom: '2rem',
              animation: mounted ? 'float 6s ease-in-out infinite' : 'none',
            }}>
              <img
                src="https://s-pixel.co.il/wp-content/uploads/2026/04/Asset-1.png"
                alt="Studio Pixel"
                style={{ height: '52px', width: 'auto', filter: 'brightness(0) saturate(100%)' }}
              />
            </div>

            {/* Tagline */}
            <h2 style={{
              fontSize: '2rem',
              fontWeight: 800,
              color: '#1a3a5c',
              margin: '0 0 0.75rem 0',
              lineHeight: 1.2,
              letterSpacing: '-0.02em',
            }}>
              ניהול חכם.
              <br />
              תוצאות מדויקות.
            </h2>

            <p style={{
              fontSize: '1rem',
              color: '#4a7a9b',
              margin: '0 0 2.5rem 0',
              lineHeight: 1.7,
              maxWidth: '320px',
            }}>
              מערכת הניהול המתקדמת שלך — לקוחות, פרויקטים,
              <br />
              משימות וחשבונות במקום אחד.
            </p>

            {/* Feature pills */}
            <div style={{
              display: 'flex',
              gap: '0.6rem',
              justifyContent: 'center',
              flexWrap: 'wrap',
            }}>
              {['ניהול לקוחות', 'מעקב משימות', 'דוחות חכמים', 'אוטומציה'].map((feature, i) => (
                <span
                  key={feature}
                  style={{
                    padding: '0.45rem 1rem',
                    borderRadius: '999px',
                    background: 'rgba(255,255,255,0.55)',
                    backdropFilter: 'blur(8px)',
                    color: '#1a3a5c',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    border: '1px solid rgba(255,255,255,0.6)',
                    animation: mounted ? `fadeInUp 0.5s cubic-bezier(0.4, 0, 0.2, 1) ${0.3 + i * 0.1}s backwards` : 'none',
                  }}
                >
                  {feature}
                </span>
              ))}
            </div>
          </div>

          {/* Bottom attribution */}
          <p style={{
            position: 'absolute',
            bottom: '1.5rem',
            fontSize: '0.75rem',
            color: '#6a9ab8',
            margin: 0,
          }}>
            Powered by Studio Pixel
          </p>
        </div>

        {/* RIGHT PANEL — Login Form */}
        <div
          className="login-form-panel"
          style={{
            flex: '1 1 50%',
            background: '#0c0c0f',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '3rem 2rem',
            direction: 'rtl',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '380px',
              animation: mounted ? 'fadeInUp 0.6s cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
            }}
          >
            {/* Header */}
            <div style={{ marginBottom: '2.5rem' }}>
              <h1 style={{
                fontSize: '1.75rem',
                fontWeight: 800,
                color: '#ffffff',
                margin: '0 0 0.5rem 0',
                letterSpacing: '-0.02em',
              }}>
                PixelManageAI
              </h1>
              <p style={{
                fontSize: '0.9rem',
                color: 'rgba(255,255,255,0.45)',
                margin: 0,
              }}>
                כניסה למערכת הניהול
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit}>
              {/* Email */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label
                  htmlFor="email"
                  style={{
                    display: 'block',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: 'rgba(255,255,255,0.6)',
                    marginBottom: '0.5rem',
                    letterSpacing: '0.03em',
                  }}
                >
                  דואר אלקטרוני
                </label>
                <input
                  id="email"
                  type="email"
                  className="login-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="name@company.com"
                  required
                  autoComplete="email"
                />
              </div>

              {/* Password */}
              <div style={{ marginBottom: '1.75rem' }}>
                <label
                  htmlFor="password"
                  style={{
                    display: 'block',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: 'rgba(255,255,255,0.6)',
                    marginBottom: '0.5rem',
                    letterSpacing: '0.03em',
                  }}
                >
                  סיסמה
                </label>
                <input
                  id="password"
                  type="password"
                  className="login-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
              </div>

              {/* Error */}
              {error && (
                <div
                  style={{
                    padding: '12px 14px',
                    marginBottom: '1.25rem',
                    background: 'rgba(239, 68, 68, 0.1)',
                    color: '#f87171',
                    borderRadius: '10px',
                    fontSize: '0.82rem',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    animation: 'fadeInUp 0.3s ease',
                  }}
                >
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="login-cta"
              >
                {loading ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{
                      width: '16px', height: '16px', border: '2px solid rgba(0,0,0,0.2)',
                      borderTopColor: '#0a0a0a', borderRadius: '50%',
                      display: 'inline-block',
                      animation: 'spin 0.6s linear infinite',
                    }} />
                    מתחבר...
                  </span>
                ) : 'כניסה'}
              </button>
            </form>

            {/* Footer */}
            <p style={{
              fontSize: '0.72rem',
              color: 'rgba(255,255,255,0.2)',
              margin: '2.5rem 0 0 0',
              textAlign: 'center',
            }}>
              סטודיו פיקסל © 2026 &middot; כל הזכויות שמורות
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}
