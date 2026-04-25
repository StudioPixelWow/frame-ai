/**
 * Business Order Report — Data aggregation + PDF generation
 * Analyzes clients, tasks, leads, campaigns, and payments
 * to produce a structured management report.
 */

import { generateBusinessOrderPDF, type PDFReportConfig, type PDFSection } from './pdf-builder';
import type { Client, Task, Lead, Campaign } from '@/lib/db/schema';

/* ── Interfaces ── */

export interface BusinessOrderData {
  clients: Client[];
  tasks: Task[];
  leads: Lead[];
  campaigns: Campaign[];
  payments?: any[];
}

export interface ReportStats {
  inactiveClients: number;
  openTasks: number;
  unhandledLeads: number;
  inactiveCampaigns: number;
  accountingIssues: number;
  totalIssues: number;
}

/* ── Analysis functions ── */

function getInactiveClients(clients: Client[]): { items: string[]; count: number } {
  const inactive = clients.filter(c => c.status === 'inactive');
  const prospect = clients.filter(c => c.status === 'prospect');

  const items: string[] = [];

  for (const c of inactive) {
    const name = c.company || c.name || c.contactPerson || 'ללא שם';
    const contact = c.contactPerson ? ` (${c.contactPerson})` : '';
    items.push(`${name}${contact} — סטטוס: לא פעיל`);
  }

  for (const c of prospect) {
    const name = c.company || c.name || c.contactPerson || 'ללא שם';
    const contact = c.contactPerson ? ` (${c.contactPerson})` : '';
    items.push(`${name}${contact} — סטטוס: פרוספקט (טרם הומר ללקוח)`);
  }

  // Also flag active clients with missing critical data
  const activeWithIssues = clients.filter(c =>
    c.status === 'active' && (!c.email || !c.phone)
  );
  for (const c of activeWithIssues) {
    const name = c.company || c.name || 'ללא שם';
    const missing: string[] = [];
    if (!c.email) missing.push('אימייל');
    if (!c.phone) missing.push('טלפון');
    items.push(`${name} — פעיל, חסר: ${missing.join(', ')}`);
  }

  return { items, count: inactive.length + prospect.length };
}

function getOpenTasks(tasks: Task[]): { items: string[]; count: number } {
  const open = tasks.filter(t =>
    t.status === 'new' || t.status === 'in_progress' || t.status === 'under_review' || t.status === 'returned'
  );

  // Sort by priority: urgent first, then high, medium, low
  const priorityOrder: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
  open.sort((a, b) => (priorityOrder[a.priority || 'low'] || 3) - (priorityOrder[b.priority || 'low'] || 3));

  const items: string[] = [];
  const statusLabels: Record<string, string> = {
    new: 'חדש',
    in_progress: 'בביצוע',
    under_review: 'ממתין לבדיקה',
    returned: 'הוחזר לתיקון',
  };
  const priorityLabels: Record<string, string> = {
    urgent: 'דחוף',
    high: 'גבוה',
    medium: 'בינוני',
    low: 'נמוך',
  };

  for (const t of open) {
    const title = t.title || 'ללא כותרת';
    const client = t.clientName || '';
    const status = statusLabels[t.status] || t.status;
    const priority = priorityLabels[t.priority || 'low'] || '';
    const due = t.dueDate ? ` | דדליין: ${new Date(t.dueDate).toLocaleDateString('he-IL')}` : '';
    const overdue = t.dueDate && new Date(t.dueDate) < new Date() ? ' [באיחור!]' : '';

    items.push(`${title}${client ? ` (${client})` : ''} — ${status} | ${priority}${due}${overdue}`);
  }

  return { items, count: open.length };
}

function getUnhandledLeads(leads: Lead[]): { items: string[]; count: number } {
  const unhandled = leads.filter(l =>
    l.status === 'new' || l.status === 'assigned' || l.status === 'no_answer'
  );

  // Sort newest first
  unhandled.sort((a, b) => {
    const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return db - da;
  });

  const items: string[] = [];
  const statusLabels: Record<string, string> = {
    new: 'חדש',
    assigned: 'שויך',
    no_answer: 'לא ענה',
  };

  for (const l of unhandled) {
    const name = l.fullName || l.email || 'ללא שם';
    const status = statusLabels[l.status] || l.status;
    const source = l.source ? ` | מקור: ${l.source}` : '';
    const phone = l.phone ? ` | ${l.phone}` : '';
    const daysSince = l.createdAt
      ? Math.floor((Date.now() - new Date(l.createdAt).getTime()) / (1000 * 60 * 60 * 24))
      : null;
    const age = daysSince !== null ? ` | לפני ${daysSince} ימים` : '';

    items.push(`${name} — ${status}${source}${phone}${age}`);
  }

  return { items, count: unhandled.length };
}

function getInactiveCampaigns(campaigns: Campaign[]): { items: string[]; count: number } {
  const problematic = campaigns.filter(c =>
    c.status === 'draft' || c.status === 'waiting_approval'
  );

  const items: string[] = [];
  const statusLabels: Record<string, string> = {
    draft: 'טיוטה',
    waiting_approval: 'ממתין לאישור',
  };

  for (const c of problematic) {
    const name = c.campaignName || 'ללא שם';
    const client = c.clientName || '';
    const status = statusLabels[c.status] || c.status;
    const budget = c.budget ? ` | תקציב: ${c.budget} ₪` : '';

    items.push(`${name}${client ? ` (${client})` : ''} — ${status}${budget}`);
  }

  // Also find completed campaigns with no leads generated
  const completedNoLeads = campaigns.filter(c => c.status === 'completed');
  // We can't check leads per campaign here without cross-referencing, so skip this

  return { items, count: problematic.length };
}

function getAccountingIssues(clients: Client[], payments?: any[]): { items: string[]; count: number } {
  const items: string[] = [];

  // Clients with retainer but missing retainer day
  const missingRetainerDay = clients.filter(c =>
    c.status === 'active' && c.retainerAmount && c.retainerAmount > 0 && !c.retainerDay
  );
  for (const c of missingRetainerDay) {
    const name = c.company || c.name || 'ללא שם';
    items.push(`${name} — ריטיינר ${c.retainerAmount} ₪ ללא יום חיוב מוגדר`);
  }

  // Active clients without retainer
  const noRetainer = clients.filter(c =>
    c.status === 'active' && (!c.retainerAmount || c.retainerAmount === 0)
  );
  for (const c of noRetainer) {
    const name = c.company || c.name || 'ללא שם';
    items.push(`${name} — לקוח פעיל ללא ריטיינר מוגדר`);
  }

  // Overdue payments from payments array if provided
  if (payments && Array.isArray(payments)) {
    const overdue = payments.filter((p: any) =>
      p.status === 'overdue' || p.paymentStatus === 'overdue'
    );
    for (const p of overdue) {
      const name = p.clientName || p.client || 'ללא שם';
      const amount = p.amount ? ` | ${p.amount} ₪` : '';
      items.push(`${name} — תשלום באיחור${amount}`);
    }
  }

  return { items, count: items.length };
}

/* ── Main generator ── */

export function buildReportConfig(data: BusinessOrderData): PDFReportConfig {
  const now = new Date();
  const dateStr = now.toLocaleDateString('he-IL', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const inactive = getInactiveClients(data.clients);
  const tasks = getOpenTasks(data.tasks);
  const leads = getUnhandledLeads(data.leads);
  const campaigns = getInactiveCampaigns(data.campaigns);
  const accounting = getAccountingIssues(data.clients, data.payments);

  const totalIssues = inactive.count + tasks.count + leads.count + campaigns.count + accounting.count;

  const sections: PDFSection[] = [
    {
      title: 'לקוחות לא פעילים',
      subtitle: `${inactive.count} לקוחות דורשים טיפול`,
      items: inactive.items,
      emptyMessage: 'כל הלקוחות פעילים — מצוין!',
    },
    {
      title: 'משימות פתוחות',
      subtitle: `${tasks.count} משימות ממתינות לטיפול`,
      items: tasks.items,
      emptyMessage: 'אין משימות פתוחות — הכל בשליטה!',
    },
    {
      title: 'לידים ללא טיפול',
      subtitle: `${leads.count} לידים חדשים/ללא מענה`,
      items: leads.items,
      emptyMessage: 'כל הלידים טופלו — עבודה מעולה!',
    },
    {
      title: 'קמפיינים לא פעילים',
      subtitle: `${campaigns.count} קמפיינים בהמתנה`,
      items: campaigns.items,
      emptyMessage: 'כל הקמפיינים פעילים!',
    },
    {
      title: 'נושאי חשבונאות',
      subtitle: `${accounting.count} פריטים לבדיקה`,
      items: accounting.items,
      emptyMessage: 'אין בעיות חשבונאיות — תקין!',
    },
  ];

  return {
    title: 'דוח סדר עסקי',
    subtitle: 'Studio Pixel — סיכום ניהולי',
    date: dateStr,
    generatedBy: 'Frame AI — מערכת ניהול',
    sections,
    summaryLine: `סה"כ ${totalIssues} פריטים דורשים תשומת לב | ${data.clients.length} לקוחות | ${data.campaigns.length} קמפיינים | ${data.leads.length} לידים | ${data.tasks.length} משימות`,
  };
}

/**
 * Generate the full PDF report from raw data
 * Returns a Uint8Array of PDF bytes
 */
export function generateBusinessOrderReport(data: BusinessOrderData): Uint8Array {
  const config = buildReportConfig(data);
  return generateBusinessOrderPDF(config);
}

/**
 * Get report statistics without generating PDF
 */
export function getReportStats(data: BusinessOrderData): ReportStats {
  const inactive = getInactiveClients(data.clients);
  const tasks = getOpenTasks(data.tasks);
  const leads = getUnhandledLeads(data.leads);
  const campaigns = getInactiveCampaigns(data.campaigns);
  const accounting = getAccountingIssues(data.clients, data.payments);

  return {
    inactiveClients: inactive.count,
    openTasks: tasks.count,
    unhandledLeads: leads.count,
    inactiveCampaigns: campaigns.count,
    accountingIssues: accounting.count,
    totalIssues: inactive.count + tasks.count + leads.count + campaigns.count + accounting.count,
  };
}
