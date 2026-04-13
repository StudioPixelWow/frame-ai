'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useState, useEffect } from 'react';

function CallbackContent() {
  const searchParams = useSearchParams();
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    // If there's an error from Google, show it immediately
    if (error) {
      setStatus('error');
      setMessage(`Google OAuth Error: ${error}`);
      return;
    }

    // If there's no code, show error
    if (!code) {
      setStatus('error');
      setMessage('No authorization code received');
      return;
    }

    // Exchange code for tokens
    const exchangeCode = async () => {
      try {
        setStatus('loading');
        const response = await fetch('/api/auth/gmail/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to complete OAuth flow');
        }

        const data = await response.json();
        setStatus('success');
        setMessage(`Gmail connected: ${data.email}`);

        // Notify opener window and close after 1.5s
        window.opener?.postMessage(
          { type: 'gmail-oauth-success', email: data.email },
          '*'
        );

        setTimeout(() => window.close(), 1500);
      } catch (err: any) {
        setStatus('error');
        setMessage(err.message || 'Failed to complete OAuth flow');
      }
    };

    exchangeCode();
  }, [code, error]);

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {status === 'loading' && (
          <>
            <div style={styles.spinner}></div>
            <p style={styles.text}>מחבר את Gmail...</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div style={styles.successIcon}>✓</div>
            <p style={styles.text}>Gmail חובר בהצלחה</p>
            <p style={styles.subtext}>החלון ייסגר אוטומטית...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={styles.errorIcon}>✕</div>
            <p style={styles.text}>{message}</p>
            <button style={styles.button} onClick={() => window.close()}>
              סגור חלון
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function GmailCallbackPage() {
  return (
    <Suspense fallback={<div style={styles.container}><div style={styles.card}><p>Loading...</p></div></div>}>
      <CallbackContent />
    </Suspense>
  );
}

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    backgroundColor: 'var(--surface, #ffffff)',
    padding: '1rem',
  },
  card: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '1.5rem',
    padding: '2rem',
    borderRadius: '0.5rem',
    backgroundColor: 'var(--surface, #ffffff)',
    border: '1px solid var(--border, #e0e0e0)',
    textAlign: 'center' as const,
    direction: 'rtl' as const,
  },
  spinner: {
    width: '2rem',
    height: '2rem',
    border: '3px solid var(--border, #e0e0e0)',
    borderTop: '3px solid var(--accent, #4f46e5)',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  successIcon: {
    width: '3rem',
    height: '3rem',
    borderRadius: '50%',
    backgroundColor: 'var(--accent, #4f46e5)',
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.5rem',
    fontWeight: 'bold',
  },
  errorIcon: {
    width: '3rem',
    height: '3rem',
    borderRadius: '50%',
    backgroundColor: '#ef4444',
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.5rem',
    fontWeight: 'bold',
  },
  text: {
    fontSize: '1rem',
    color: 'var(--foreground, #1f2937)',
    margin: 0,
  },
  subtext: {
    fontSize: '0.875rem',
    color: 'var(--muted-foreground, #6b7280)',
    margin: 0,
  },
  button: {
    padding: '0.5rem 1.5rem',
    borderRadius: '0.375rem',
    backgroundColor: 'var(--accent, #4f46e5)',
    color: '#ffffff',
    border: 'none',
    cursor: 'pointer',
    fontSize: '0.875rem',
    fontWeight: '500',
    transition: 'background-color 0.2s',
  },
};

// Add spinner animation
const styles_global = `
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;

if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = styles_global;
  document.head.appendChild(style);
}
