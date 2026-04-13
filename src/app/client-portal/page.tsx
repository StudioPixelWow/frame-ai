'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useClients } from '@/lib/api/use-entity';
import { useToast } from '@/components/ui/toast';

export default function ClientPortalLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { data: clients } = useClients();
  const toast = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Demo: Find first portal-enabled client
      const portalClient = clients.find(c => c.portalEnabled);
      if (!portalClient) {
        toast('אין לקוח פעיל בפורטל', 'error');
        setIsLoading(false);
        return;
      }

      // In production, this would verify credentials
      // For demo, just redirect with the first portal-enabled client
      router.push(`/client-portal/dashboard?clientId=${portalClient.id}`);
    } catch (error) {
      toast('שגיאה בכניסה', 'error');
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--background)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        direction: 'rtl',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          backgroundColor: 'var(--surface)',
          border: `1px solid var(--border)`,
          borderRadius: '0.75rem',
          padding: '2rem',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
        }}
      >
        {/* Logo & Branding */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <img
            src="https://s-pixel.co.il/wp-content/uploads/2026/04/Asset-1.png"
            alt="Studio Pixel"
            style={{
              height: '3rem',
              marginBottom: '1rem',
              filter: 'brightness(0) invert(1)',
            }}
          />
          <h1
            style={{
              fontSize: '1.875rem',
              fontWeight: 700,
              color: 'var(--foreground)',
              margin: '0 0 0.5rem 0',
            }}
          >
            Studio Pixel
          </h1>
          <p
            style={{
              fontSize: '0.95rem',
              color: 'var(--foreground-muted)',
              margin: 0,
            }}
          >
            פורטל הלקוח
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Email Input */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label
              htmlFor="email"
              style={{
                fontSize: '0.875rem',
                fontWeight: 600,
                color: 'var(--foreground)',
              }}
            >
              דואר אלקטרוני
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
              style={{
                padding: '0.75rem 1rem',
                border: `1px solid var(--border)`,
                borderRadius: '0.5rem',
                backgroundColor: 'var(--background)',
                color: 'var(--foreground)',
                fontSize: '0.95rem',
                outline: 'none',
                transition: 'border-color 250ms ease',
              }}
              onFocus={e => {
                e.currentTarget.style.borderColor = 'var(--accent)';
              }}
              onBlur={e => {
                e.currentTarget.style.borderColor = 'var(--border)';
              }}
            />
          </div>

          {/* Password Input */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label
              htmlFor="password"
              style={{
                fontSize: '0.875rem',
                fontWeight: 600,
                color: 'var(--foreground)',
              }}
            >
              סיסמה
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{
                padding: '0.75rem 1rem',
                border: `1px solid var(--border)`,
                borderRadius: '0.5rem',
                backgroundColor: 'var(--background)',
                color: 'var(--foreground)',
                fontSize: '0.95rem',
                outline: 'none',
                transition: 'border-color 250ms ease',
              }}
              onFocus={e => {
                e.currentTarget.style.borderColor = 'var(--accent)';
              }}
              onBlur={e => {
                e.currentTarget.style.borderColor = 'var(--border)';
              }}
            />
          </div>

          {/* Login Button */}
          <button
            type="submit"
            disabled={isLoading}
            style={{
              padding: '0.875rem 1.5rem',
              backgroundColor: 'var(--accent)',
              color: '#000',
              border: 'none',
              borderRadius: '0.5rem',
              fontSize: '0.95rem',
              fontWeight: 600,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.6 : 1,
              transition: 'opacity 250ms ease, background-color 250ms ease',
              marginTop: '0.5rem',
            }}
            onMouseEnter={e => {
              if (!isLoading) {
                (e.target as HTMLElement).style.backgroundColor = 'var(--accent-hover)';
              }
            }}
            onMouseLeave={e => {
              (e.target as HTMLElement).style.backgroundColor = 'var(--accent)';
            }}
          >
            {isLoading ? 'כניסה...' : 'כניסה'}
          </button>
        </form>

        {/* Magic Link Option */}
        <div
          style={{
            marginTop: '1.5rem',
            paddingTop: '1.5rem',
            borderTop: `1px solid var(--border)`,
            textAlign: 'center',
          }}
        >
          <button
            type="button"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--accent)',
              fontSize: '0.875rem',
              cursor: 'pointer',
              textDecoration: 'underline',
              fontWeight: 500,
            }}
            onMouseEnter={e => {
              (e.target as HTMLElement).style.color = 'var(--accent-hover)';
            }}
            onMouseLeave={e => {
              (e.target as HTMLElement).style.color = 'var(--accent)';
            }}
          >
            שלח קישור כניסה
          </button>
        </div>
      </div>
    </div>
  );
}
