'use client';

import { useState, useMemo } from 'react';
import { useClients } from '@/lib/api/use-entity';
import { useToast } from '@/components/ui/toast';
import type { WhatsAppMessage } from '@/lib/db/schema';

/* ── Status badge colors and labels ─────────────────────────────────────── */

const STATUS_LABELS: Record<string, string> = {
  pending: 'ממתין',
  sent: 'נשלח',
  delivered: 'הועבר',
  read: 'נקרא',
  failed: 'נכשל',
};

const STATUS_COLORS: Record<string, string> = {
  pending: '#9ca3af',
  sent: '#00B5FE',
  delivered: '#22c55e',
  read: '#22c55e',
  failed: '#ef4444',
};

/* ── Quick template buttons ─────────────────────────────────────────────── */

const TEMPLATES = [
  { id: 'payment_reminder', label: 'תזכורת תשלום' },
  { id: 'gantt_ready', label: 'גאנט מוכן לצפייה' },
  { id: 'materials_ready', label: 'חומרים סופיים מוכנים' },
  { id: 'approval_needed', label: 'אישור נדרש' },
  { id: 'meeting_reminder', label: 'תזכורת פגישה' },
  { id: 'proposal_sent', label: 'הצעת מחיר נשלחה' },
];

const TEMPLATE_MESSAGES: Record<string, string> = {
  payment_reminder: 'שלום! רצינו לשאול אם יש לך זמן לדבר על התשלום עבור הפרויקט. בחזרה לעומק!',
  gantt_ready: 'שלום! הגאנט החודשי שלך מוכן לצפייה. אנא בדוק ותן לנו משוב.',
  materials_ready: 'שלום! החומרים הסופיים שלך מוכנים להורדה. בדוק ותן לנו דעתך!',
  approval_needed: 'שלום! אנחנו צריכים את אישורך על הפרויקט הזה. האם אתה יכול לבדוק ולתת לנו משוב?',
  meeting_reminder: 'שלום! זה תזכורת לפגישה שלנו היום. נתראה בקרוב!',
  proposal_sent: 'שלום! שלחנו לך הצעת מחיר. בואו נדברים עליה במוקד הראשון שלך!',
};

/* ── Sample message history for local state ────────────────────────────── */

const SAMPLE_MESSAGES: WhatsAppMessage[] = [
  {
    id: '1',
    clientId: 'c1',
    clientName: 'לקוח A - תכנות ויב',
    phone: '+972501234567',
    templateName: 'payment_reminder',
    message: 'שלום! רצינו לשאול אם יש לך זמן לדבר על התשלום עבור הפרויקט.',
    status: 'read',
    direction: 'outgoing',
    relatedEntityType: 'payment',
    relatedEntityId: 'pay1',
    sentAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '2',
    clientId: 'c2',
    clientName: 'עסק B - שיווק דיגיטלי',
    phone: '+972509876543',
    templateName: 'gantt_ready',
    message: 'שלום! הגאנט החודשי שלך מוכן לצפייה. אנא בדוק ותן לנו משוב.',
    status: 'delivered',
    direction: 'outgoing',
    relatedEntityType: 'gantt',
    relatedEntityId: 'g1',
    sentAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '3',
    clientId: 'c3',
    clientName: 'חברה C - ייצור וידאו',
    phone: '+972505551111',
    templateName: 'materials_ready',
    message: 'שלום! החומרים הסופיים שלך מוכנים להורדה. בדוק ותן לנו דעתך!',
    status: 'sent',
    direction: 'outgoing',
    relatedEntityType: 'project',
    relatedEntityId: 'p1',
    sentAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '4',
    clientId: 'c1',
    clientName: 'לקוח A - תכנות ויב',
    phone: '+972501234567',
    templateName: 'approval_needed',
    message: 'שלום! אנחנו צריכים את אישורך על הפרויקט הזה. האם אתה יכול לבדוק ולתת לנו משוב?',
    status: 'pending',
    direction: 'outgoing',
    relatedEntityType: 'approval',
    relatedEntityId: 'a1',
    sentAt: null,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '5',
    clientId: 'c4',
    clientName: 'לקוח D - בנייה אתר',
    phone: '+972503332222',
    templateName: 'proposal_sent',
    message: 'שלום! שלחנו לך הצעת מחיר. בואו נדברים עליה במוקד הראשון שלך!',
    status: 'failed',
    direction: 'outgoing',
    relatedEntityType: 'proposal',
    relatedEntityId: 'prop1',
    sentAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '6',
    clientId: 'c2',
    clientName: 'עסק B - שיווק דיגיטלי',
    phone: '+972509876543',
    templateName: 'meeting_reminder',
    message: 'שלום! זה תזכורת לפגישה שלנו היום. נתראה בקרוב!',
    status: 'read',
    direction: 'outgoing',
    relatedEntityType: 'task',
    relatedEntityId: 't1',
    sentAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '7',
    clientId: 'c5',
    clientName: 'לקוח E - ייעוץ דיגיטלי',
    phone: '+972504444444',
    templateName: 'gantt_ready',
    message: 'שלום! הגאנט החודשי שלך מוכן לצפייה. אנא בדוק ותן לנו משוב.',
    status: 'delivered',
    direction: 'outgoing',
    relatedEntityType: 'gantt',
    relatedEntityId: 'g2',
    sentAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '8',
    clientId: 'c3',
    clientName: 'חברה C - ייצור וידאו',
    phone: '+972505551111',
    templateName: 'payment_reminder',
    message: 'שלום! רצינו לשאול אם יש לך זמן לדבר על התשלום עבור הפרויקט.',
    status: 'sent',
    direction: 'outgoing',
    relatedEntityType: 'payment',
    relatedEntityId: 'pay2',
    sentAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
  },
];

export default function WhatsAppPage() {
  const { data: clients } = useClients();
  const toast = useToast();

  /* ── Local state management ──────────────────────────────────────────── */

  const [messages, setMessages] = useState<WhatsAppMessage[]>(SAMPLE_MESSAGES);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [messageText, setMessageText] = useState<string>('');

  /* ── Compute statistics ──────────────────────────────────────────────── */

  const stats = useMemo(() => {
    return {
      total: messages.length,
      delivered: messages.filter(m => m.status === 'delivered').length,
      read: messages.filter(m => m.status === 'read').length,
      failed: messages.filter(m => m.status === 'failed').length,
    };
  }, [messages]);

  /* ── Handle client selection and auto-fill phone ───────────────────────── */

  const handleClientChange = (clientId: string) => {
    setSelectedClientId(clientId);
    const selected = clients.find(c => c.id === clientId);
    if (selected) {
      setPhone(selected.phone);
    } else {
      setPhone('');
    }
  };

  /* ── Handle template button click ─────────────────────────────────────── */

  const handleTemplateClick = (templateId: string) => {
    const templateMessage = TEMPLATE_MESSAGES[templateId] || '';
    setMessageText(templateMessage);
  };

  /* ── Handle send message ─────────────────────────────────────────────── */

  const handleSendMessage = () => {
    if (!selectedClientId || !phone || !messageText.trim()) {
      toast('אנא מלא את כל השדות', 'error');
      return;
    }

    const selectedClient = clients.find(c => c.id === selectedClientId);
    if (!selectedClient) {
      toast('לקוח לא נמצא', 'error');
      return;
    }

    // Create new message
    const newMessage: WhatsAppMessage = {
      id: Math.random().toString(36).slice(2),
      clientId: selectedClientId,
      clientName: selectedClient.name,
      phone,
      templateName: 'custom',
      message: messageText,
      status: 'sent',
      direction: 'outgoing',
      relatedEntityType: '',
      relatedEntityId: '',
      sentAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Add to messages
    setMessages([newMessage, ...messages]);

    // Reset form
    setSelectedClientId('');
    setPhone('');
    setMessageText('');

    // Show success toast
    toast('ההודעה נשלחה בהצלחה', 'success');
  };

  /* ── Render status badge ─────────────────────────────────────────────── */

  const renderStatusBadge = (status: string) => {
    const bgColor = STATUS_COLORS[status] || '#9ca3af';
    const label = STATUS_LABELS[status] || status;

    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.375rem',
          padding: '0.25rem 0.75rem',
          backgroundColor: `${bgColor}20`,
          color: bgColor,
          borderRadius: '0.375rem',
          fontSize: '0.75rem',
          fontWeight: '600',
          border: `1px solid ${bgColor}40`,
        }}
      >
        {status === 'read' && <span style={{ fontSize: '0.875rem' }}>✓✓</span>}
        {status === 'delivered' && <span style={{ fontSize: '0.875rem' }}>✓</span>}
        {label}
      </span>
    );
  };

  /* ── Truncate message for preview ─────────────────────────────────────── */

  const truncateMessage = (message: string, maxLength: number = 60) => {
    return message.length > maxLength ? message.slice(0, maxLength) + '...' : message;
  };

  /* ── Format date ──────────────────────────────────────────────────────── */

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'אתמול';
    } else {
      return date.toLocaleDateString('he-IL', { month: 'short', day: 'numeric' });
    }
  };

  return (
    <div dir="rtl" style={{ padding: '2rem' }}>
      {/* ── Page Header ──────────────────────────────────────────────────────── */}

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '2rem',
        }}
      >
        <h1
          style={{
            fontSize: '1.875rem',
            fontWeight: '700',
            color: 'var(--foreground)',
            margin: 0,
          }}
        >
          ניהול וואטסאפ
        </h1>
        <button
          style={{
            padding: '0.625rem 1.25rem',
            backgroundColor: 'var(--accent)',
            color: 'white',
            border: 'none',
            borderRadius: '0.5rem',
            fontSize: '0.875rem',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'background-color 150ms ease',
          }}
          onMouseEnter={(e) => {
            (e.target as HTMLElement).style.backgroundColor = 'var(--accent)';
            (e.target as HTMLElement).style.opacity = '0.9';
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLElement).style.opacity = '1';
          }}
        >
          + הודעה חדשה
        </button>
      </div>

      {/* ── Stats Row ─────────────────────────────────────────────────────────── */}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '1rem',
          marginBottom: '2rem',
        }}
      >
        {[
          { label: 'סה"כ הודעות', value: stats.total },
          { label: 'הועבר', value: stats.delivered },
          { label: 'נקרא', value: stats.read },
          { label: 'נכשל', value: stats.failed },
        ].map((stat) => (
          <div
            key={stat.label}
            style={{
              padding: '1.5rem',
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '0.5rem',
              textAlign: 'center',
              transition: 'all 150ms ease',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)';
              (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
              (e.currentTarget as HTMLElement).style.boxShadow = 'none';
            }}
          >
            <div
              style={{
                fontSize: '2rem',
                fontWeight: '700',
                color: 'var(--accent)',
                marginBottom: '0.5rem',
              }}
            >
              {stat.value}
            </div>
            <div
              style={{
                fontSize: '0.875rem',
                color: 'var(--foreground-muted)',
              }}
            >
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {/* ── Quick Templates Section ────────────────────────────────────────────── */}

      <div
        style={{
          padding: '1.5rem',
          backgroundColor: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '0.5rem',
          marginBottom: '2rem',
        }}
      >
        <h2
          style={{
            fontSize: '1rem',
            fontWeight: '600',
            color: 'var(--foreground)',
            marginTop: 0,
            marginBottom: '1rem',
          }}
        >
          תבניות מהירות
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            gap: '0.75rem',
          }}
        >
          {TEMPLATES.map((template) => (
            <button
              key={template.id}
              onClick={() => handleTemplateClick(template.id)}
              style={{
                padding: '0.75rem',
                backgroundColor: 'var(--surface-raised)',
                border: '1px solid var(--border)',
                borderRadius: '0.375rem',
                fontSize: '0.875rem',
                fontWeight: '500',
                color: 'var(--foreground)',
                cursor: 'pointer',
                transition: 'all 150ms ease',
                textAlign: 'center',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--accent)';
                (e.currentTarget as HTMLElement).style.color = 'white';
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--surface-raised)';
                (e.currentTarget as HTMLElement).style.color = 'var(--foreground)';
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
              }}
            >
              {template.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Message Compose Area ──────────────────────────────────────────────── */}

      <div
        style={{
          padding: '1.5rem',
          backgroundColor: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '0.5rem',
          marginBottom: '2rem',
        }}
      >
        <h2
          style={{
            fontSize: '1rem',
            fontWeight: '600',
            color: 'var(--foreground)',
            marginTop: 0,
            marginBottom: '1rem',
          }}
        >
          יצירת הודעה חדשה
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Client selector */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: '600',
                color: 'var(--foreground)',
                marginBottom: '0.5rem',
              }}
            >
              בחר לקוח
            </label>
            <select
              value={selectedClientId}
              onChange={(e) => handleClientChange(e.target.value)}
              style={{
                width: '100%',
                padding: '0.625rem',
                backgroundColor: 'var(--surface-raised)',
                border: '1px solid var(--border)',
                borderRadius: '0.375rem',
                fontSize: '0.875rem',
                color: 'var(--foreground)',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              <option value="">בחר לקוח...</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name} - {client.company}
                </option>
              ))}
            </select>
          </div>

          {/* Phone number (auto-fill) */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: '600',
                color: 'var(--foreground)',
                marginBottom: '0.5rem',
              }}
            >
              מספר טלפון
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+972501234567"
              style={{
                width: '100%',
                padding: '0.625rem',
                backgroundColor: 'var(--surface-raised)',
                border: '1px solid var(--border)',
                borderRadius: '0.375rem',
                fontSize: '0.875rem',
                color: 'var(--foreground)',
                fontFamily: 'inherit',
              }}
            />
          </div>

          {/* Message textarea */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: '600',
                color: 'var(--foreground)',
                marginBottom: '0.5rem',
              }}
            >
              ההודעה
            </label>
            <textarea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="הזן את הודעתך כאן..."
              style={{
                width: '100%',
                minHeight: '100px',
                padding: '0.625rem',
                backgroundColor: 'var(--surface-raised)',
                border: '1px solid var(--border)',
                borderRadius: '0.375rem',
                fontSize: '0.875rem',
                color: 'var(--foreground)',
                fontFamily: 'inherit',
                resize: 'vertical',
              }}
            />
          </div>

          {/* Send button */}
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-start' }}>
            <button
              onClick={handleSendMessage}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: 'var(--accent)',
                color: 'white',
                border: 'none',
                borderRadius: '0.375rem',
                fontSize: '0.875rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 150ms ease',
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLElement).style.opacity = '0.9';
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLElement).style.opacity = '1';
              }}
            >
              שלח הודעה
            </button>
            <button
              onClick={() => {
                setSelectedClientId('');
                setPhone('');
                setMessageText('');
              }}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: 'var(--surface-raised)',
                color: 'var(--foreground)',
                border: '1px solid var(--border)',
                borderRadius: '0.375rem',
                fontSize: '0.875rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 150ms ease',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--border)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--surface-raised)';
              }}
            >
              נקה
            </button>
          </div>
        </div>
      </div>

      {/* ── Message History ──────────────────────────────────────────────────── */}

      <div
        style={{
          padding: '1.5rem',
          backgroundColor: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '0.5rem',
        }}
      >
        <h2
          style={{
            fontSize: '1rem',
            fontWeight: '600',
            color: 'var(--foreground)',
            marginTop: 0,
            marginBottom: '1rem',
          }}
        >
          היסטוריית הודעות ({messages.length})
        </h2>

        {messages.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '2rem',
              color: 'var(--foreground-muted)',
            }}
          >
            אין הודעות להצגה
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '0.875rem',
              }}
            >
              <thead>
                <tr
                  style={{
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  <th
                    style={{
                      textAlign: 'right',
                      padding: '0.75rem',
                      fontWeight: '600',
                      color: 'var(--foreground-muted)',
                    }}
                  >
                    לקוח
                  </th>
                  <th
                    style={{
                      textAlign: 'right',
                      padding: '0.75rem',
                      fontWeight: '600',
                      color: 'var(--foreground-muted)',
                    }}
                  >
                    טלפון
                  </th>
                  <th
                    style={{
                      textAlign: 'right',
                      padding: '0.75rem',
                      fontWeight: '600',
                      color: 'var(--foreground-muted)',
                    }}
                  >
                    הודעה
                  </th>
                  <th
                    style={{
                      textAlign: 'center',
                      padding: '0.75rem',
                      fontWeight: '600',
                      color: 'var(--foreground-muted)',
                    }}
                  >
                    סטטוס
                  </th>
                  <th
                    style={{
                      textAlign: 'center',
                      padding: '0.75rem',
                      fontWeight: '600',
                      color: 'var(--foreground-muted)',
                    }}
                  >
                    תאריך
                  </th>
                </tr>
              </thead>
              <tbody>
                {messages.map((message) => (
                  <tr
                    key={message.id}
                    style={{
                      borderBottom: '1px solid var(--border)',
                      transition: 'background-color 150ms ease',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--surface-raised)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                    }}
                  >
                    <td
                      style={{
                        padding: '0.75rem',
                        color: 'var(--foreground)',
                      }}
                    >
                      <div style={{ fontWeight: '500' }}>{message.clientName}</div>
                    </td>
                    <td
                      style={{
                        padding: '0.75rem',
                        color: 'var(--foreground-muted)',
                      }}
                    >
                      <span
                        style={{
                          fontFamily: 'monospace',
                          fontSize: '0.8125rem',
                        }}
                      >
                        {message.phone}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: '0.75rem',
                        color: 'var(--foreground)',
                        maxWidth: '200px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={message.message}
                    >
                      {truncateMessage(message.message, 45)}
                    </td>
                    <td
                      style={{
                        padding: '0.75rem',
                        textAlign: 'center',
                      }}
                    >
                      {renderStatusBadge(message.status)}
                    </td>
                    <td
                      style={{
                        padding: '0.75rem',
                        textAlign: 'center',
                        color: 'var(--foreground-muted)',
                      }}
                    >
                      {formatDate(message.sentAt || message.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
