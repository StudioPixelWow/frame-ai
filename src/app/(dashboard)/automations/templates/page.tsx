'use client';
export const dynamic = "force-dynamic";

import Link from 'next/link';
import { useState } from 'react';

const TEMPLATES = [
  {
    id: 'follow-up',
    category: 'leads',
    icon: '📩',
    title: 'מעקב ליד חדש',
    description: 'שלח מייל מעקב אוטומטי 24 שעות אחרי יצירת ליד חדש',
    trigger: 'ליד חדש',
    action: 'שלח מייל',
    popular: true,
    usageCount: 234,
  },
  {
    id: 'no-response',
    category: 'leads',
    icon: '⏰',
    title: 'תזכורת אין תגובה',
    description: 'התראה כשליד לא קיבל תגובה תוך 48 שעות',
    trigger: 'אין תגובה',
    action: 'צור התראה',
    popular: true,
    usageCount: 189,
  },
  {
    id: 'campaign-alert',
    category: 'campaigns',
    icon: '📉',
    title: 'התראת ירידה בקמפיין',
    description: 'הודע כשביצועי קמפיין יורדים מתחת לסף',
    trigger: 'ירידה בביצועים',
    action: 'שלח התראה',
    popular: false,
    usageCount: 156,
  },
  {
    id: 'lead-assignment',
    category: 'leads',
    icon: '👤',
    title: 'שיוך ליד אוטומטי',
    description: 'שייך לידים חדשים לאיש המכירות המתאים ביותר לפי AI',
    trigger: 'ליד חדש',
    action: 'שייך עובד',
    popular: true,
    usageCount: 312,
  },
  {
    id: 'client-inactivity',
    category: 'clients',
    icon: '😴',
    title: 'התראת לקוח לא פעיל',
    description: 'הודע כשלקוח לא היתה לו פעילות 14 יום',
    trigger: 'חוסר פעילות',
    action: 'צור התראה',
    popular: false,
    usageCount: 98,
  },
  {
    id: 'task-overdue',
    category: 'tasks',
    icon: '🔴',
    title: 'משימה באיחור',
    description: 'צור התראה דחופה כשמשימה עוברת את תאריך היעד',
    trigger: 'משימה באיחור',
    action: 'שלח התראה',
    popular: false,
    usageCount: 145,
  },
  {
    id: 'gantt-reminder',
    category: 'clients',
    icon: '📋',
    title: 'תזכורת גאנט חודשי',
    description: 'הודע כשלקוח חסר גאנט לחודש הנוכחי',
    trigger: 'חסר גאנט',
    action: 'צור משימה',
    popular: false,
    usageCount: 87,
  },
  {
    id: 'payment-overdue',
    category: 'operations',
    icon: '💰',
    title: 'תשלום באיחור',
    description: 'שלח התראה ומשימה כשתשלום לא בוצע בזמן',
    trigger: 'תשלום באיחור',
    action: 'שלח מייל + צור משימה',
    popular: true,
    usageCount: 201,
  },
  {
    id: 'whatsapp-welcome',
    category: 'leads',
    icon: '💬',
    title: 'הודעת ברוכים הבאים',
    description: 'שלח הודעת וואטסאפ אוטומטית לליד חדש',
    trigger: 'ליד חדש',
    action: 'שלח וואטסאפ',
    popular: false,
    usageCount: 76,
  },
  {
    id: 'daily-digest',
    category: 'operations',
    icon: '📊',
    title: 'סיכום יומי',
    description: 'שלח סיכום פעילות יומי עם מדדים מרכזיים',
    trigger: 'כל יום ב-08:00',
    action: 'שלח מייל',
    popular: false,
    usageCount: 167,
  },
];

const CATEGORIES = [
  { id: 'all', label: 'הכל' },
  { id: 'leads', label: 'לידים' },
  { id: 'campaigns', label: 'קמפיינים' },
  { id: 'clients', label: 'לקוחות' },
  { id: 'tasks', label: 'משימות' },
  { id: 'operations', label: 'תפעול' },
];

export default function TemplatesPage() {
  const [activeCategory, setActiveCategory] = useState('all');

  const filtered = activeCategory === 'all'
    ? TEMPLATES
    : TEMPLATES.filter(t => t.category === activeCategory);

  return (
    <div style={{ padding: 'var(--spacing-6)', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 'var(--spacing-8)' }}>
        <h1 style={{
          fontSize: '2.5rem',
          fontWeight: 'bold',
          color: 'var(--foreground)',
          marginBottom: 'var(--spacing-2)',
          direction: 'rtl',
          textAlign: 'right',
        }}>
          תבניות אוטומציה
        </h1>
        <p style={{
          fontSize: '1.125rem',
          color: 'var(--foreground-muted)',
          direction: 'rtl',
          textAlign: 'right',
        }}>
          בחר תבנית מוכנה והתאם לצרכים שלך
        </p>
      </div>

      {/* Category Tabs */}
      <div style={{
        display: 'flex',
        gap: 'var(--spacing-2)',
        marginBottom: 'var(--spacing-8)',
        flexWrap: 'wrap',
        direction: 'rtl',
        justifyContent: 'flex-end',
      }}>
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            style={{
              padding: 'var(--spacing-2) var(--spacing-4)',
              borderRadius: '0.5rem',
              border: activeCategory === cat.id ? `2px solid var(--accent)` : `1px solid var(--border)`,
              background: activeCategory === cat.id ? 'var(--surface-variant)' : 'transparent',
              color: activeCategory === cat.id ? 'var(--accent)' : 'var(--foreground)',
              cursor: 'pointer',
              fontSize: '0.95rem',
              fontWeight: activeCategory === cat.id ? '600' : '500',
              transition: 'all 0.2s ease',
            }}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Template Grid */}
      {filtered.length > 0 ? (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
          gap: 'var(--spacing-6)',
          marginBottom: 'var(--spacing-8)',
        }}>
          {filtered.map((template, idx) => (
            <div
              key={template.id}
              className="auto-template-card"
              style={{
                position: 'relative',
                padding: 'var(--spacing-5)',
                borderRadius: '0.75rem',
                border: `1px solid var(--border)`,
                background: 'var(--surface)',
                transition: 'all 0.3s ease',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--spacing-3)',
                animation: `ux-stagger 0.4s ease forwards`,
                animationDelay: `${idx * 0.05}s`,
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent)';
                e.currentTarget.style.boxShadow = '0 0 0 2px rgba(var(--accent-rgb), 0.1)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              {/* Popular Badge */}
              {template.popular && (
                <div style={{
                  position: 'absolute',
                  top: 'var(--spacing-3)',
                  right: 'var(--spacing-3)',
                  background: 'var(--accent)',
                  color: 'white',
                  padding: '0.25rem 0.75rem',
                  borderRadius: '2rem',
                  fontSize: '0.75rem',
                  fontWeight: '600',
                }}>
                  פופולרי
                </div>
              )}

              {/* Icon */}
              <div style={{ fontSize: '2.5rem', lineHeight: '1' }}>
                {template.icon}
              </div>

              {/* Title */}
              <h3 style={{
                fontSize: '1.125rem',
                fontWeight: '700',
                color: 'var(--foreground)',
                margin: 0,
                direction: 'rtl',
                textAlign: 'right',
              }}>
                {template.title}
              </h3>

              {/* Description */}
              <p style={{
                fontSize: '0.95rem',
                color: 'var(--foreground-muted)',
                margin: 0,
                lineHeight: '1.5',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                direction: 'rtl',
                textAlign: 'right',
              }}>
                {template.description}
              </p>

              {/* Trigger → Action */}
              <div style={{
                display: 'flex',
                gap: 'var(--spacing-2)',
                alignItems: 'center',
                direction: 'rtl',
                justifyContent: 'flex-end',
                flexWrap: 'wrap',
              }}>
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.375rem 0.75rem',
                  borderRadius: '0.375rem',
                  background: 'var(--surface-variant)',
                  fontSize: '0.85rem',
                  color: 'var(--foreground-muted)',
                }}>
                  {template.trigger}
                </div>
                <span style={{ color: 'var(--border)', fontSize: '0.75rem' }}>←</span>
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.375rem 0.75rem',
                  borderRadius: '0.375rem',
                  background: 'var(--surface-variant)',
                  fontSize: '0.85rem',
                  color: 'var(--foreground-muted)',
                }}>
                  {template.action}
                </div>
              </div>

              {/* Usage Count */}
              <p style={{
                fontSize: '0.8rem',
                color: 'var(--foreground-muted)',
                margin: 0,
                direction: 'rtl',
                textAlign: 'right',
              }}>
                {template.usageCount} משתמשים
              </p>

              {/* CTA Button */}
              <Link
                href={`/automations/new?template=${template.id}`}
                style={{
                  marginTop: 'auto',
                  padding: 'var(--spacing-3) var(--spacing-4)',
                  borderRadius: '0.5rem',
                  background: 'var(--accent)',
                  color: 'white',
                  textDecoration: 'none',
                  fontWeight: '600',
                  fontSize: '0.95rem',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  textAlign: 'center',
                }}
              >
                השתמש בתבנית
              </Link>
            </div>
          ))}
        </div>
      ) : (
        <div style={{
          textAlign: 'center',
          padding: 'var(--spacing-8)',
          borderRadius: '0.75rem',
          background: 'var(--surface)',
          border: `1px solid var(--border)`,
          marginBottom: 'var(--spacing-8)',
          direction: 'rtl',
        }}>
          <p style={{
            fontSize: '1.125rem',
            color: 'var(--foreground-muted)',
            margin: 0,
          }}>
            אין תבניות בקטגוריה זו
          </p>
        </div>
      )}

      {/* AI Suggestion Section */}
      <div
        className="premium-card"
        style={{
          padding: 'var(--spacing-5)',
          borderRadius: '0.75rem',
          background: 'var(--surface)',
          border: `1px solid var(--border)`,
          borderLeft: `4px solid var(--accent)`,
          direction: 'rtl',
        }}
      >
        <div style={{
          display: 'flex',
          gap: 'var(--spacing-4)',
          alignItems: 'flex-start',
        }}>
          <span style={{ fontSize: '2rem' }}>🤖</span>
          <div>
            <h3 style={{
              fontSize: '1.125rem',
              fontWeight: '700',
              color: 'var(--foreground)',
              margin: '0 0 var(--spacing-2) 0',
              textAlign: 'right',
            }}>
              תבניות מומלצות עבורך
            </h3>
            <p style={{
              fontSize: '0.95rem',
              color: 'var(--foreground-muted)',
              margin: 0,
              lineHeight: '1.6',
              textAlign: 'right',
            }}>
              בהתבסס על הפעילות שלך, אנחנו ממליצים על: מעקב ליד חדש, שיוך ליד אוטומטי
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
