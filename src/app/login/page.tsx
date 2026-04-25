'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: 'var(--background)',
        direction: 'rtl',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          padding: '24px',
          backgroundColor: 'var(--surface-raised)',
          borderRadius: '12px',
          border: '1px solid var(--border)',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        }}
      >
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <img
            src="https://s-pixel.co.il/wp-content/uploads/2026/04/Asset-1.png"
            alt="Studio Pixel"
            style={{ height: '40px', width: 'auto' }}
          />
        </div>

        {/* Title */}
        <h1
          style={{
            fontSize: '24px',
            fontWeight: '700',
            color: 'var(--foreground)',
            margin: '0 0 8px 0',
            textAlign: 'center',
          }}
        >
          PixelManageAI
        </h1>

        {/* Subtitle */}
        <p
          style={{
            fontSize: '14px',
            color: 'var(--foreground-muted)',
            margin: '0 0 32px 0',
            textAlign: 'center',
          }}
        >
          כניסה למערכת
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          {/* Email Field */}
          <div style={{ marginBottom: '20px' }}>
            <label
              htmlFor="email"
              style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: '500',
                color: 'var(--foreground)',
                marginBottom: '8px',
              }}
            >
              דואר אלקטרוני
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              required
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: '14px',
                backgroundColor: 'var(--background)',
                color: 'var(--foreground)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                boxSizing: 'border-box',
                transition: 'border-color 0.2s',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)';
              }}
            />
          </div>

          {/* Password Field */}
          <div style={{ marginBottom: '24px' }}>
            <label
              htmlFor="password"
              style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: '500',
                color: 'var(--foreground)',
                marginBottom: '8px',
              }}
            >
              סיסמה
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: '14px',
                backgroundColor: 'var(--background)',
                color: 'var(--foreground)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                boxSizing: 'border-box',
                transition: 'border-color 0.2s',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)';
              }}
            />
          </div>

          {/* Error Message */}
          {error && (
            <div
              style={{
                padding: '10px 12px',
                marginBottom: '16px',
                backgroundColor: 'rgba(220, 38, 38, 0.1)',
                color: '#dc2626',
                borderRadius: '6px',
                fontSize: '13px',
                border: '1px solid rgba(220, 38, 38, 0.3)',
              }}
            >
              {error}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '11px 16px',
              fontSize: '14px',
              fontWeight: '600',
              color: '#ffffff',
              backgroundColor: loading ? 'var(--foreground-muted)' : 'var(--accent)',
              border: 'none',
              borderRadius: '6px',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s',
              opacity: loading ? 0.7 : 1,
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.backgroundColor = 'var(--accent)';
                e.currentTarget.style.opacity = '0.9';
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                e.currentTarget.style.backgroundColor = 'var(--accent)';
                e.currentTarget.style.opacity = '1';
              }
            }}
          >
            {loading ? 'מתחבר...' : 'כניסה'}
          </button>
        </form>

        {/* Footer */}
        <p
          style={{
            fontSize: '12px',
            color: 'var(--foreground-muted)',
            margin: '24px 0 0 0',
            textAlign: 'center',
          }}
        >
          סטודיו פיקסל © 2026
        </p>
      </div>
    </div>
  );
}
