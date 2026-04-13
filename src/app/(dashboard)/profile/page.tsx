'use client';

import React, { useState } from 'react';

export default function ProfilePage() {
  const [displayName, setDisplayName] = useState('טל זטלמן');
  const [edited, setEdited] = useState(false);

  const handleSave = () => {
    setEdited(false);
    // Save logic would go here
  };

  return (
    <div dir="rtl" className="prf-wrap">
      <div className="prf-hero">
        <div className="prf-avatar-wrap">
          <div
            className="prf-avatar"
            style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              backgroundColor: '#4f46e5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '2rem',
              color: 'white',
              fontWeight: '700',
            }}
          >
            ט
          </div>
          <button
            className="prf-avatar-edit"
            style={{
              position: 'absolute',
              bottom: '0',
              left: '0',
              padding: '0.5rem',
              borderRadius: '50%',
              backgroundColor: 'white',
              border: '2px solid #e5e7eb',
              cursor: 'pointer',
            }}
          >
            📷
          </button>
        </div>
        <div>
          <h1 className="prf-name">טל זטלמן</h1>
          <p className="prf-email">tal.pixeld@gmail.com</p>
          <span
            className="prf-role-badge"
            style={{
              display: 'inline-block',
              marginTop: '0.5rem',
              padding: '0.25rem 0.75rem',
              borderRadius: '4px',
              backgroundColor: '#4f46e5',
              color: 'white',
              fontSize: '0.75rem',
              fontWeight: '600',
            }}
          >
            מנהל מערכת
          </span>
        </div>
      </div>

      <div className="prf-section">
        <h2 className="prf-section-hd">עריכת פרטים</h2>
        <div className="prf-section-body">
          <div style={{ marginBottom: '1.5rem' }}>
            <label className="prf-label">שם תצוגה</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => {
                setDisplayName(e.target.value);
                setEdited(true);
              }}
              className="prf-input"
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                fontFamily: 'inherit',
              }}
            />
            <p className="prf-input-hint">זה איך השם שלך מופיע בדשבורד</p>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label className="prf-label">אימייל</label>
            <input
              type="email"
              value="tal.pixeld@gmail.com"
              disabled
              className="prf-input"
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                backgroundColor: '#f9fafb',
                fontFamily: 'inherit',
              }}
            />
            <p className="prf-input-hint">אימייל לא ניתן לשינוי</p>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label className="prf-label">תפקיד</label>
            <div
              style={{
                padding: '0.75rem',
                borderRadius: '6px',
                backgroundColor: '#f9fafb',
              }}
            >
              מנהל מערכת
            </div>
          </div>

          {edited && (
            <button
              onClick={handleSave}
              className="prf-save-btn"
              style={{
                padding: '0.75rem 1.5rem',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: '#4f46e5',
                color: 'white',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              שמור שינויים
            </button>
          )}
        </div>
      </div>

      <div className="prf-section">
        <h2 className="prf-section-hd">אבטחה</h2>
        <div className="prf-section-body">
          <div
            style={{
              padding: '1.5rem',
              borderRadius: '6px',
              backgroundColor: '#f3f4f6',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <span className="prf-pw-icon" style={{ fontSize: '1.5rem' }}>
                🔐
              </span>
              <div>
                <p className="prf-pw-text" style={{ fontWeight: '600' }}>
                  שינוי סיסמה
                </p>
                <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                  עדכון סיסמתך באופן מאובטח
                </p>
              </div>
            </div>
            <span
              className="prf-pw-badge"
              style={{
                padding: '0.25rem 0.75rem',
                borderRadius: '4px',
                backgroundColor: '#fef3c7',
                color: '#92400e',
                fontSize: '0.75rem',
                fontWeight: '600',
              }}
            >
              בקרוב
            </span>
          </div>
        </div>
      </div>

      <div className="prf-section">
        <h2 className="prf-section-hd">פרטי חשבון</h2>
        <div className="prf-section-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
            <div>
              <p className="prf-label">מזהה משתמש</p>
              <p style={{ fontWeight: '500' }}>user_9847362</p>
            </div>
            <div>
              <p className="prf-label">חברתי מאז</p>
              <p style={{ fontWeight: '500' }}>
                <span className="prf-since">ינואר 15, 2024</span>
              </p>
            </div>
            <div>
              <p className="prf-label">נראה לאחרונה</p>
              <p style={{ fontWeight: '500' }}>היום בשעה 10:32</p>
            </div>
            <div>
              <p className="prf-label">סטטוס</p>
              <p style={{ fontWeight: '500', color: '#10b981' }}>פעיל 🟢</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
