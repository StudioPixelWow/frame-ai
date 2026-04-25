'use client';

import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/lib/auth/auth-context';

interface UserAccessSectionProps {
  entityType: 'client' | 'employee';
  entityId: string;
  entityEmail?: string;
  entityName?: string;
}

interface LinkedUser {
  id: string;
  email: string;
  role: string;
  displayName: string | null;
  createdAt: string;
}

export default function UserAccessSection({
  entityType,
  entityId,
  entityEmail,
  entityName,
}: UserAccessSectionProps) {
  const { isAdmin } = useAuth();
  const [linkedUser, setLinkedUser] = useState<LinkedUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Create form state
  const [createEmail, setCreateEmail] = useState(entityEmail || '');
  const [createPassword, setCreatePassword] = useState('');
  const [autoGenerate, setAutoGenerate] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // Credentials shown after creation / reset
  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(null);

  // Reset state
  const [resetting, setResetting] = useState(false);

  // Fetch linked user
  const fetchUser = useCallback(async () => {
    setLoading(true);
    try {
      const param = entityType === 'client' ? 'linkedClientId' : 'linkedEmployeeId';
      const res = await fetch(`/api/auth/find-user?${param}=${entityId}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setLinkedUser(data.user || null);
      } else {
        setLinkedUser(null);
      }
    } catch {
      setLinkedUser(null);
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const copyToClipboard = useCallback(async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {}
  }, []);

  const loginUrl = typeof window !== 'undefined' ? `${window.location.origin}/login` : '/login';

  // Create user
  const handleCreate = async () => {
    setCreateError('');
    if (!createEmail) {
      setCreateError('נא להזין כתובת דוא"ל');
      return;
    }
    if (!autoGenerate && !createPassword) {
      setCreateError('נא להזין סיסמה או לבחור יצירה אוטומטית');
      return;
    }

    setCreating(true);
    try {
      const body: any = {
        email: createEmail,
        role: entityType,
        displayName: entityName || createEmail,
      };
      if (entityType === 'client') body.linkedClientId = entityId;
      else body.linkedEmployeeId = entityId;
      if (!autoGenerate) body.password = createPassword;

      const res = await fetch('/api/auth/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.error || 'שגיאה ביצירת משתמש');
        return;
      }

      setCredentials({ email: createEmail, password: data.generatedPassword || createPassword });
      setShowCreateModal(false);
      setShowCredentialsModal(true);
      fetchUser();
    } catch {
      setCreateError('שגיאה ברשת');
    } finally {
      setCreating(false);
    }
  };

  // Reset password
  const handleResetPassword = async () => {
    if (!linkedUser) return;
    setResetting(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId: linkedUser.id }),
      });
      const data = await res.json();
      if (res.ok) {
        setCredentials({ email: linkedUser.email, password: data.generatedPassword });
        setShowResetModal(false);
        setShowCredentialsModal(true);
      }
    } catch {}
    finally { setResetting(false); }
  };

  if (!isAdmin) return null;

  // ---------- STYLES ----------
  const sectionStyle: React.CSSProperties = {
    background: 'var(--surface-raised)',
    border: '1px solid var(--border)',
    borderRadius: '0.75rem',
    padding: '1.5rem',
    direction: 'rtl',
  };

  const headingStyle: React.CSSProperties = {
    fontSize: '0.95rem',
    fontWeight: 700,
    margin: '0 0 0.25rem 0',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  };

  const subtitleStyle: React.CSSProperties = {
    fontSize: '0.78rem',
    color: 'var(--foreground-muted)',
    margin: '0 0 1.25rem 0',
  };

  const btnPrimary: React.CSSProperties = {
    padding: '0.6rem 1.25rem',
    fontSize: '0.82rem',
    fontWeight: 600,
    color: '#0a0a0a',
    background: 'linear-gradient(135deg, #F0FF02, #d4e000)',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    fontFamily: 'inherit',
  };

  const btnSecondary: React.CSSProperties = {
    padding: '0.5rem 1rem',
    fontSize: '0.8rem',
    fontWeight: 500,
    color: 'var(--foreground)',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    fontFamily: 'inherit',
  };

  const modalOverlay: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    direction: 'rtl',
  };

  const modalBox: React.CSSProperties = {
    background: 'var(--surface-raised, #1a1a1e)',
    border: '1px solid var(--border)',
    borderRadius: '16px',
    padding: '2rem',
    width: '100%',
    maxWidth: '440px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    fontSize: '0.85rem',
    background: 'rgba(255,255,255,0.06)',
    color: 'var(--foreground)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    outline: 'none',
  };

  // ---------- LOADING STATE ----------
  if (loading) {
    return (
      <div style={sectionStyle}>
        <h3 style={headingStyle}>🔐 גישה למערכת</h3>
        <p style={{ ...subtitleStyle, marginBottom: 0 }}>טוען...</p>
      </div>
    );
  }

  // ---------- NO USER — CTA ----------
  if (!linkedUser) {
    return (
      <div style={sectionStyle}>
        <h3 style={headingStyle}>🔐 גישה למערכת</h3>
        <p style={subtitleStyle}>
          {entityType === 'client'
            ? 'ללקוח זה אין עדיין חשבון כניסה למערכת.'
            : 'לעובד זה אין עדיין חשבון כניסה למערכת.'}
        </p>

        <button
          onClick={() => {
            setCreateEmail(entityEmail || '');
            setAutoGenerate(true);
            setCreatePassword('');
            setCreateError('');
            setShowCreateModal(true);
          }}
          style={btnPrimary}
          onMouseEnter={(e) => { (e.target as HTMLElement).style.boxShadow = '0 4px 16px rgba(240,255,2,0.3)'; }}
          onMouseLeave={(e) => { (e.target as HTMLElement).style.boxShadow = 'none'; }}
        >
          + צור גישה למערכת
        </button>

        {/* CREATE MODAL */}
        {showCreateModal && (
          <div style={modalOverlay} onClick={() => setShowCreateModal(false)}>
            <div style={modalBox} onClick={(e) => e.stopPropagation()}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 0.5rem 0' }}>
                יצירת חשבון גישה
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--foreground-muted)', margin: '0 0 1.5rem 0' }}>
                {entityName || entityEmail || entityId}
              </p>

              {/* Email */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--foreground-muted)', marginBottom: '0.4rem' }}>
                  דואר אלקטרוני
                </label>
                <input
                  type="email"
                  value={createEmail}
                  onChange={(e) => setCreateEmail(e.target.value)}
                  style={inputStyle}
                  placeholder="email@example.com"
                />
              </div>

              {/* Password method */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--foreground-muted)', marginBottom: '0.5rem' }}>
                  סיסמה
                </label>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <button
                    type="button"
                    onClick={() => setAutoGenerate(true)}
                    style={{
                      ...btnSecondary,
                      background: autoGenerate ? 'rgba(240,255,2,0.12)' : 'rgba(255,255,255,0.06)',
                      borderColor: autoGenerate ? 'rgba(240,255,2,0.3)' : 'var(--border)',
                      color: autoGenerate ? '#F0FF02' : 'var(--foreground-muted)',
                    }}
                  >
                    יצירה אוטומטית
                  </button>
                  <button
                    type="button"
                    onClick={() => setAutoGenerate(false)}
                    style={{
                      ...btnSecondary,
                      background: !autoGenerate ? 'rgba(240,255,2,0.12)' : 'rgba(255,255,255,0.06)',
                      borderColor: !autoGenerate ? 'rgba(240,255,2,0.3)' : 'var(--border)',
                      color: !autoGenerate ? '#F0FF02' : 'var(--foreground-muted)',
                    }}
                  >
                    הזנה ידנית
                  </button>
                </div>
                {!autoGenerate && (
                  <input
                    type="text"
                    value={createPassword}
                    onChange={(e) => setCreatePassword(e.target.value)}
                    style={inputStyle}
                    placeholder="הזן סיסמה"
                  />
                )}
              </div>

              {/* Role display */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--foreground-muted)', marginBottom: '0.4rem' }}>
                  תפקיד
                </label>
                <span style={{
                  display: 'inline-block',
                  padding: '0.4rem 0.8rem',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  background: entityType === 'client' ? 'rgba(34,197,94,0.12)' : 'rgba(59,130,246,0.12)',
                  color: entityType === 'client' ? '#22c55e' : '#3b82f6',
                }}>
                  {entityType === 'client' ? 'לקוח' : 'עובד'}
                </span>
              </div>

              {/* Error */}
              {createError && (
                <div style={{
                  padding: '10px 12px',
                  marginBottom: '1rem',
                  background: 'rgba(239,68,68,0.1)',
                  color: '#f87171',
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                  border: '1px solid rgba(239,68,68,0.25)',
                }}>
                  {createError}
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-start' }}>
                <button
                  onClick={handleCreate}
                  disabled={creating}
                  style={{ ...btnPrimary, opacity: creating ? 0.6 : 1 }}
                >
                  {creating ? 'יוצר...' : 'צור חשבון'}
                </button>
                <button onClick={() => setShowCreateModal(false)} style={btnSecondary}>
                  ביטול
                </button>
              </div>
            </div>
          </div>
        )}

        {/* CREDENTIALS MODAL */}
        {showCredentialsModal && credentials && (
          <CredentialsModal
            credentials={credentials}
            loginUrl={loginUrl}
            entityName={entityName}
            copiedField={copiedField}
            onCopy={copyToClipboard}
            onClose={() => { setShowCredentialsModal(false); setCredentials(null); }}
          />
        )}
      </div>
    );
  }

  // ---------- USER EXISTS ----------
  return (
    <div style={sectionStyle}>
      <h3 style={headingStyle}>🔐 גישה למערכת</h3>
      <p style={subtitleStyle}>החשבון פעיל ומוכן לכניסה.</p>

      {/* User info card */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        padding: '1rem',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid var(--border)',
        borderRadius: '10px',
        marginBottom: '1rem',
      }}>
        <div style={{
          width: '42px', height: '42px', borderRadius: '50%',
          background: 'linear-gradient(135deg, #F0FF02, #d4e000)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#0a0a0a', fontWeight: 700, fontSize: '1rem', flexShrink: 0,
        }}>
          {linkedUser.email[0]?.toUpperCase() || '?'}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.88rem', fontWeight: 600, marginBottom: '0.15rem' }}>
            {linkedUser.displayName || linkedUser.email}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--foreground-muted)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>{linkedUser.email}</span>
            <span style={{
              padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 600,
              background: linkedUser.role === 'admin' ? 'rgba(239,68,68,0.12)' : linkedUser.role === 'employee' ? 'rgba(59,130,246,0.12)' : 'rgba(34,197,94,0.12)',
              color: linkedUser.role === 'admin' ? '#ef4444' : linkedUser.role === 'employee' ? '#3b82f6' : '#22c55e',
            }}>
              {linkedUser.role === 'admin' ? 'מנהל' : linkedUser.role === 'employee' ? 'עובד' : 'לקוח'}
            </span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button
          onClick={() => copyToClipboard(loginUrl, 'link')}
          style={btnSecondary}
          onMouseEnter={(e) => { (e.target as HTMLElement).style.borderColor = 'var(--accent)'; }}
          onMouseLeave={(e) => { (e.target as HTMLElement).style.borderColor = 'var(--border)'; }}
        >
          {copiedField === 'link' ? '✓ הועתק!' : '🔗 העתק קישור כניסה'}
        </button>
        <button
          onClick={() => setShowResetModal(true)}
          style={btnSecondary}
          onMouseEnter={(e) => { (e.target as HTMLElement).style.borderColor = '#f59e0b'; }}
          onMouseLeave={(e) => { (e.target as HTMLElement).style.borderColor = 'var(--border)'; }}
        >
          🔑 איפוס סיסמה
        </button>
        <button
          onClick={() => {
            setCredentials({ email: linkedUser.email, password: '••••••••' });
            setShowCredentialsModal(true);
          }}
          style={btnSecondary}
          onMouseEnter={(e) => { (e.target as HTMLElement).style.borderColor = 'var(--accent)'; }}
          onMouseLeave={(e) => { (e.target as HTMLElement).style.borderColor = 'var(--border)'; }}
        >
          📧 שלח פרטי כניסה
        </button>
      </div>

      {/* RESET PASSWORD MODAL */}
      {showResetModal && (
        <div style={modalOverlay} onClick={() => setShowResetModal(false)}>
          <div style={modalBox} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 0.5rem 0' }}>
              🔑 איפוס סיסמה
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--foreground-muted)', margin: '0 0 1.5rem 0' }}>
              האם לייצר סיסמה חדשה עבור <strong>{linkedUser.email}</strong>?
              <br />
              <span style={{ fontSize: '0.78rem', color: 'rgba(239,68,68,0.8)' }}>
                הסיסמה הנוכחית תפסיק לעבוד מיד.
              </span>
            </p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={handleResetPassword}
                disabled={resetting}
                style={{
                  ...btnPrimary,
                  background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                  color: '#fff',
                  opacity: resetting ? 0.6 : 1,
                }}
              >
                {resetting ? 'מאפס...' : 'אפס סיסמה'}
              </button>
              <button onClick={() => setShowResetModal(false)} style={btnSecondary}>
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREDENTIALS MODAL */}
      {showCredentialsModal && credentials && (
        <CredentialsModal
          credentials={credentials}
          loginUrl={loginUrl}
          entityName={entityName}
          copiedField={copiedField}
          onCopy={copyToClipboard}
          onClose={() => { setShowCredentialsModal(false); setCredentials(null); }}
        />
      )}
    </div>
  );
}

// ─── Credentials / Send Email Preview Modal ───────────────────────────────

interface CredentialsModalProps {
  credentials: { email: string; password: string };
  loginUrl: string;
  entityName?: string;
  copiedField: string | null;
  onCopy: (text: string, field: string) => void;
  onClose: () => void;
}

function CredentialsModal({ credentials, loginUrl, entityName, copiedField, onCopy, onClose }: CredentialsModalProps) {
  const isHidden = credentials.password === '••••••••';

  const modalOverlay: React.CSSProperties = {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 9999, direction: 'rtl',
  };

  const modalBox: React.CSSProperties = {
    background: 'var(--surface-raised, #1a1a1e)',
    border: '1px solid var(--border)',
    borderRadius: '16px',
    padding: '2rem',
    width: '100%', maxWidth: '500px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
  };

  const credRow: React.CSSProperties = {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '0.75rem 1rem',
    background: 'rgba(255,255,255,0.04)',
    borderRadius: '8px',
    marginBottom: '0.5rem',
  };

  const copyBtn: React.CSSProperties = {
    padding: '0.3rem 0.65rem',
    fontSize: '0.72rem',
    fontWeight: 600,
    background: 'rgba(255,255,255,0.08)',
    color: 'var(--foreground-muted)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    cursor: 'pointer',
    fontFamily: 'inherit',
  };

  return (
    <div style={modalOverlay} onClick={onClose}>
      <div style={modalBox} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 0.35rem 0' }}>
          {isHidden ? '📧 שליחת פרטי כניסה' : '✅ החשבון נוצר בהצלחה!'}
        </h3>
        <p style={{ fontSize: '0.8rem', color: 'var(--foreground-muted)', margin: '0 0 1.5rem 0' }}>
          {isHidden
            ? 'תצוגה מקדימה של פרטי הכניסה לשליחה'
            : 'שמור את הפרטים — הסיסמה לא תוצג שוב.'}
        </p>

        {/* Email preview card */}
        <div style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '1.5rem',
          marginBottom: '1.5rem',
        }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--foreground-muted)' }}>
            שלום {entityName || 'לך'},
          </div>
          <div style={{ fontSize: '0.82rem', color: 'var(--foreground-muted)', lineHeight: 1.8, marginBottom: '1rem' }}>
            נוצר עבורך חשבון גישה למערכת PixelManageAI.
            <br />
            להלן פרטי הכניסה:
          </div>

          <div style={credRow}>
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--foreground-muted)', marginBottom: '0.2rem' }}>קישור כניסה</div>
              <div style={{ fontSize: '0.82rem', fontWeight: 500, direction: 'ltr', textAlign: 'right' }}>{loginUrl}</div>
            </div>
            <button style={copyBtn} onClick={() => onCopy(loginUrl, 'url')}>
              {copiedField === 'url' ? '✓' : 'העתק'}
            </button>
          </div>

          <div style={credRow}>
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--foreground-muted)', marginBottom: '0.2rem' }}>דוא"ל</div>
              <div style={{ fontSize: '0.82rem', fontWeight: 500, direction: 'ltr', textAlign: 'right' }}>{credentials.email}</div>
            </div>
            <button style={copyBtn} onClick={() => onCopy(credentials.email, 'email')}>
              {copiedField === 'email' ? '✓' : 'העתק'}
            </button>
          </div>

          {!isHidden && (
            <div style={credRow}>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--foreground-muted)', marginBottom: '0.2rem' }}>סיסמה</div>
                <div style={{
                  fontSize: '0.82rem', fontWeight: 600,
                  fontFamily: 'monospace', direction: 'ltr', textAlign: 'right',
                  color: '#F0FF02',
                }}>
                  {credentials.password}
                </div>
              </div>
              <button style={copyBtn} onClick={() => onCopy(credentials.password, 'password')}>
                {copiedField === 'password' ? '✓' : 'העתק'}
              </button>
            </div>
          )}

          {isHidden && (
            <div style={{
              padding: '0.6rem 1rem',
              background: 'rgba(245,158,11,0.08)',
              borderRadius: '8px',
              fontSize: '0.75rem',
              color: '#f59e0b',
              marginTop: '0.5rem',
            }}>
              💡 לשליחת סיסמה חדשה — לחץ "איפוס סיסמה" תחילה.
            </div>
          )}
        </div>

        {/* Copy all */}
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-start' }}>
          <button
            onClick={() => {
              const text = [
                `קישור כניסה: ${loginUrl}`,
                `דוא"ל: ${credentials.email}`,
                ...(isHidden ? [] : [`סיסמה: ${credentials.password}`]),
              ].join('\n');
              onCopy(text, 'all');
            }}
            style={{
              padding: '0.6rem 1.25rem',
              fontSize: '0.82rem',
              fontWeight: 600,
              color: '#0a0a0a',
              background: 'linear-gradient(135deg, #F0FF02, #d4e000)',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {copiedField === 'all' ? '✓ הועתק!' : '📋 העתק הכל'}
          </button>
          <button
            onClick={onClose}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.8rem',
              fontWeight: 500,
              color: 'var(--foreground)',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            סגור
          </button>
        </div>
      </div>
    </div>
  );
}
