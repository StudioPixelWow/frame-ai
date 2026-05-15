/**
 * Email Sequence Engine — Israeli-compliant automated email sequences
 * Supports תיקון 40 (Israeli anti-spam law) compliance
 */

import type { EmailSequence, EmailSequenceStep } from '@/lib/db/schema';

// ===== Israeli Compliance =====

/** תיקון 40 requirements for commercial emails in Israel */
export const TIKUN_40_REQUIREMENTS = {
  requireUnsubscribeLink: true,
  requireSenderIdentification: true,
  requirePhysicalAddress: false, // Recommended but not strictly required
  maxEmailsPerDay: 100, // Self-imposed limit
  cooldownHoursAfterUnsubscribe: 0, // Immediate
  mustHonorUnsubscribeWithin: 5, // Business days
};

export function validateTikun40Compliance(sequence: Partial<EmailSequence>): string[] {
  const errors: string[] = [];
  if (!sequence.unsubscribeUrl) errors.push('חסר קישור הסרה מרשימת תפוצה (חובה לפי תיקון 40)');
  if (!sequence.senderName) errors.push('חסר שם השולח');
  if (!sequence.senderEmail) errors.push('חסר כתובת מייל של השולח');
  return errors;
}

export function addUnsubscribeFooter(html: string, unsubscribeUrl: string): string {
  const footer = `
    <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; text-align: center; direction: rtl;">
      <p style="font-size: 12px; color: #9ca3af;">
        קיבלת מייל זה כי נרשמת לעדכונים שלנו.
        <br/>
        <a href="${unsubscribeUrl}" style="color: #3b82f6; text-decoration: underline;">
          להסרה מרשימת התפוצה לחץ כאן
        </a>
      </p>
    </div>`;
  return html + footer;
}

// ===== Hebrew Email Templates =====

export const HEBREW_TEMPLATES: Record<string, { subject: string; body: string }> = {
  welcome: {
    subject: 'ברוכים הבאים! 🎉',
    body: `<div dir="rtl" style="font-family: Arial, sans-serif;">
      <h2>שלום {{name}},</h2>
      <p>שמחים שהצטרפת אלינו! אנחנו כאן כדי לעזור לך להצליח.</p>
      <p>בימים הקרובים נשלח לך כמה טיפים שיעזרו לך להתחיל.</p>
      <p>בברכה,<br/>{{sender_name}}</p>
    </div>`,
  },
  followup: {
    subject: 'עדכון מ{{sender_name}}',
    body: `<div dir="rtl" style="font-family: Arial, sans-serif;">
      <h2>היי {{name}},</h2>
      <p>רצינו לבדוק שהכל בסדר ושאתה מרוצה מהשירות שלנו.</p>
      <p>יש לך שאלות? פשוט השב למייל הזה.</p>
      <p>בברכה,<br/>{{sender_name}}</p>
    </div>`,
  },
  invoice_reminder: {
    subject: 'תזכורת תשלום — {{invoice_description}}',
    body: `<div dir="rtl" style="font-family: Arial, sans-serif;">
      <h2>שלום {{name}},</h2>
      <p>זוהי תזכורת ידידותית לגבי חשבונית שטרם שולמה:</p>
      <p><strong>סכום:</strong> ₪{{amount}}<br/>
      <strong>תאריך פירעון:</strong> {{due_date}}</p>
      <p>אם כבר שילמת, אנא התעלם ממייל זה.</p>
      <p>בברכה,<br/>{{sender_name}}</p>
    </div>`,
  },
  monthly_report: {
    subject: 'דוח חודשי — {{month}} {{year}}',
    body: `<div dir="rtl" style="font-family: Arial, sans-serif;">
      <h2>שלום {{name}},</h2>
      <p>מצורף הדוח החודשי שלך לחודש {{month}} {{year}}.</p>
      <p>נשמח לקבוע שיחה לדון בתוצאות.</p>
      <p>בברכה,<br/>{{sender_name}}</p>
    </div>`,
  },
};

// ===== Sequence Processing =====

export function getNextStepForSubscriber(
  sequence: EmailSequence,
  currentStep: number,
  subscribedAt: string,
  lastEmailAt: string | null
): EmailSequenceStep | null {
  if (!sequence.steps || currentStep >= sequence.steps.length) return null;

  const step = sequence.steps[currentStep];
  if (!step) return null;

  // Check wait time
  if (step.type === 'wait' && lastEmailAt) {
    const waitMs = ((step.waitDays || 0) * 86400000) + ((step.waitHours || 0) * 3600000);
    const lastSent = new Date(lastEmailAt).getTime();
    if (Date.now() - lastSent < waitMs) return null; // Still waiting
  }

  // Find next email step
  if (step.type === 'email') return step;

  // Skip wait/condition, advance to next
  return getNextStepForSubscriber(sequence, currentStep + 1, subscribedAt, lastEmailAt);
}

export function interpolateTemplate(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }
  return result;
}

// ===== Trigger Types =====

export const TRIGGER_LABELS: Record<string, string> = {
  new_lead: 'ליד חדש',
  new_client: 'לקוח חדש',
  payment_received: 'תשלום התקבל',
  invoice_sent: 'חשבונית נשלחה',
  manual: 'ידני',
  form_submit: 'מילוי טופס',
};
