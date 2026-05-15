/**
 * Green Invoice (חשבונית ירוקה) API Client
 * Israeli invoicing integration — supports all 9 document types
 */

// ===== Constants =====
export const ISRAEL_VAT_RATE = 0.18;
const TOKEN_REFRESH_BUFFER_SECS = 60;

// ===== Types =====

export type GreenInvoiceDocType =
  | 10    // הצעת מחיר — Quote
  | 20    // הזמנה — Purchase Order
  | 30    // תעודת משלוח — Delivery Note
  | 100   // חשבונית עסקה — Invoice (non-VAT / osek patur)
  | 200   // חשבונית מס — Tax Invoice
  | 210   // חשבונית מס/קבלה — Tax Invoice + Receipt
  | 300   // קבלה — Receipt
  | 400   // חשבון עסקה — Pro-forma
  | 405;  // חשבונית ביטול — Cancellation

export const DOC_TYPE_LABELS: Record<GreenInvoiceDocType, string> = {
  10: 'הצעת מחיר',
  20: 'הזמנה',
  30: 'תעודת משלוח',
  100: 'חשבונית עסקה',
  200: 'חשבונית מס',
  210: 'חשבונית מס/קבלה',
  300: 'קבלה',
  400: 'חשבון עסקה',
  405: 'חשבונית ביטול',
};

export enum PaymentType {
  CASH = 1,
  CHEQUE = 2,
  BANK_TRANSFER = 3,
  CREDIT_CARD = 4,
  BIT = 10,
  PAYBOX = 11,
  OTHER = 99,
}

export const PAYMENT_TYPE_LABELS: Record<number, string> = {
  1: 'מזומן',
  2: 'צ\'ק',
  3: 'העברה בנקאית',
  4: 'כרטיס אשראי',
  10: 'ביט',
  11: 'פייבוקס',
  99: 'אחר',
};

export interface GreenInvoiceLineItem {
  description: string;
  quantity: number;
  price: number;        // Price before VAT in ILS
  vatType: 0 | 1;       // 0 = no VAT, 1 = include VAT
  catalogNum?: string;
}

export interface GreenInvoicePayment {
  type: PaymentType;
  date: string;          // DD/MM/YYYY
  price: number;         // Amount paid (with VAT)
  bankName?: string;
  bankBranch?: string;
  bankAccount?: string;
  chequeNum?: string;
}

export interface GreenInvoiceClientData {
  id?: string;           // Green Invoice client ID (if existing)
  name: string;
  emails?: string[];
  taxId?: string;        // ח.פ. / ע.מ.
  address?: string;
  city?: string;
  phone?: string;
}

export interface CreateDocumentParams {
  type: GreenInvoiceDocType;
  client: GreenInvoiceClientData;
  items: GreenInvoiceLineItem[];
  description?: string;
  remarks?: string;
  currency?: 'ILS' | 'USD' | 'EUR';
  documentDate?: Date;
  dueDate?: Date;
  payment?: GreenInvoicePayment[];
  signed?: boolean;
  lang?: 'he' | 'en';
}

export interface GreenInvoiceDocument {
  id: string;
  number: number;       // Document sequential number
  type: GreenInvoiceDocType;
  status: number;
  amount: number;
  vat: number;
  total: number;
  url: string;           // PDF download URL
  client: { id: string; name: string };
  createdAt: string;
}

export interface GreenInvoiceSettings {
  apiId: string;
  apiSecret: string;
  sandbox: boolean;
}

// ===== VAT Helpers =====

export function calculateWithVAT(priceBeforeVAT: number) {
  const vatAmount = priceBeforeVAT * ISRAEL_VAT_RATE;
  return {
    priceBeforeVAT,
    vatAmount: Math.round(vatAmount * 100) / 100,
    totalWithVAT: Math.round((priceBeforeVAT + vatAmount) * 100) / 100,
  };
}

export function extractBeforeVAT(totalWithVAT: number) {
  const priceBeforeVAT = totalWithVAT / (1 + ISRAEL_VAT_RATE);
  return {
    priceBeforeVAT: Math.round(priceBeforeVAT * 100) / 100,
    vatAmount: Math.round((totalWithVAT - priceBeforeVAT) * 100) / 100,
    totalWithVAT,
  };
}

// ===== Date Formatting =====

function formatDateGI(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${date.getFullYear()}`;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// ===== API Client =====

let cachedToken: { token: string; expires: number } | null = null;

function getBaseUrl(sandbox: boolean): string {
  return sandbox
    ? 'https://sandbox.greeninvoice.co.il/api/v1'
    : 'https://api.greeninvoice.co.il/api/v1';
}

function getSettings(): GreenInvoiceSettings {
  return {
    apiId: process.env.GREEN_INVOICE_API_ID || '',
    apiSecret: process.env.GREEN_INVOICE_API_SECRET || '',
    sandbox: process.env.GREEN_INVOICE_SANDBOX === 'true',
  };
}

async function getAuthToken(): Promise<string> {
  const settings = getSettings();
  if (!settings.apiId || !settings.apiSecret) {
    throw new Error('Green Invoice API credentials not configured. Set GREEN_INVOICE_API_ID and GREEN_INVOICE_API_SECRET.');
  }

  if (cachedToken && cachedToken.expires > Date.now() / 1000 + TOKEN_REFRESH_BUFFER_SECS) {
    return cachedToken.token;
  }

  const baseUrl = getBaseUrl(settings.sandbox);
  const res = await fetch(`${baseUrl}/account/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: settings.apiId, secret: settings.apiSecret }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Green Invoice auth failed (${res.status}): ${err}`);
  }

  const data = await res.json();
  cachedToken = { token: data.token, expires: data.expires };
  return cachedToken.token;
}

async function apiRequest<T = any>(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  body?: object
): Promise<T> {
  const settings = getSettings();
  const token = await getAuthToken();
  const baseUrl = getBaseUrl(settings.sandbox);

  const res = await fetch(`${baseUrl}${endpoint}`, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Green Invoice API error (${res.status}): ${errText}`);
  }

  return res.json();
}

// ===== Document Operations =====

export async function createDocument(params: CreateDocumentParams): Promise<GreenInvoiceDocument> {
  const docDate = params.documentDate || new Date();
  const dueDate = params.dueDate || addDays(docDate, 30);

  const payload: any = {
    description: params.description || '',
    type: params.type,
    date: formatDateGI(docDate),
    dueDate: formatDateGI(dueDate),
    lang: params.lang || 'he',
    currency: params.currency || 'ILS',
    vatType: 1,
    signed: params.signed !== false ? 1 : 0,
    remarks: params.remarks || '',
    income: params.items.map(item => ({
      catalogNum: item.catalogNum || '',
      description: item.description,
      quantity: item.quantity,
      price: item.price,
      vatType: item.vatType ?? 1,
      currency: params.currency || 'ILS',
    })),
  };

  // Client — use ID if known, else create inline
  if (params.client.id) {
    payload.client = { id: params.client.id };
  } else {
    payload.client = {
      name: params.client.name,
      emails: params.client.emails || [],
      taxId: params.client.taxId || '',
      address: params.client.address || '',
      city: params.client.city || '',
      phone: params.client.phone || '',
      add: true, // Auto-create client in Green Invoice
    };
  }

  // Payment (for types 210, 300)
  if (params.payment && params.payment.length > 0) {
    payload.payment = params.payment;
  }

  return apiRequest<GreenInvoiceDocument>('/documents', 'POST', payload);
}

// Convenience wrappers for common document types

export async function createTaxInvoice(
  client: GreenInvoiceClientData,
  items: GreenInvoiceLineItem[],
  opts?: { description?: string; remarks?: string; dueDate?: Date }
): Promise<GreenInvoiceDocument> {
  return createDocument({
    type: 200,
    client,
    items,
    ...opts,
  });
}

export async function createTaxInvoiceReceipt(
  client: GreenInvoiceClientData,
  items: GreenInvoiceLineItem[],
  payment: GreenInvoicePayment[],
  opts?: { description?: string; remarks?: string }
): Promise<GreenInvoiceDocument> {
  return createDocument({
    type: 210,
    client,
    items,
    payment,
    ...opts,
  });
}

export async function createReceipt(
  client: GreenInvoiceClientData,
  items: GreenInvoiceLineItem[],
  payment: GreenInvoicePayment[],
  opts?: { description?: string; remarks?: string }
): Promise<GreenInvoiceDocument> {
  return createDocument({
    type: 300,
    client,
    items,
    payment,
    ...opts,
  });
}

export async function createQuote(
  client: GreenInvoiceClientData,
  items: GreenInvoiceLineItem[],
  opts?: { description?: string; remarks?: string; dueDate?: Date }
): Promise<GreenInvoiceDocument> {
  return createDocument({
    type: 10,
    client,
    items,
    ...opts,
  });
}

export async function cancelDocument(
  originalDocId: string,
  reason?: string
): Promise<GreenInvoiceDocument> {
  return apiRequest<GreenInvoiceDocument>(`/documents/${originalDocId}/cancel`, 'POST', {
    description: reason || 'ביטול מסמך',
  });
}

// ===== Client Operations =====

export async function searchClients(query: string): Promise<any[]> {
  const result = await apiRequest<any>('/clients/search', 'POST', {
    name: query,
    page: 1,
    pageSize: 20,
  });
  return result.items || [];
}

export async function getClient(clientId: string): Promise<any> {
  return apiRequest(`/clients/${clientId}`, 'GET');
}

export async function createGreenInvoiceClient(
  data: GreenInvoiceClientData
): Promise<any> {
  return apiRequest('/clients', 'POST', {
    name: data.name,
    emails: data.emails || [],
    taxId: data.taxId || '',
    address: data.address || '',
    city: data.city || '',
    phone: data.phone || '',
  });
}

// ===== Document Listing =====

export async function listDocuments(opts?: {
  type?: GreenInvoiceDocType;
  fromDate?: Date;
  toDate?: Date;
  page?: number;
  pageSize?: number;
}): Promise<{ items: GreenInvoiceDocument[]; total: number }> {
  const body: any = {
    page: opts?.page || 1,
    pageSize: opts?.pageSize || 25,
    sort: 'documentDate',
    direction: 'desc',
  };

  if (opts?.type) body.type = [opts.type];
  if (opts?.fromDate) body.fromDate = formatDateGI(opts.fromDate);
  if (opts?.toDate) body.toDate = formatDateGI(opts.toDate);

  return apiRequest('/documents/search', 'POST', body);
}

export async function getDocumentPdfUrl(docId: string): Promise<string> {
  const doc = await apiRequest<any>(`/documents/${docId}`, 'GET');
  return doc.url || '';
}

// ===== Health Check =====

export async function checkConnection(): Promise<{ connected: boolean; error?: string; businessName?: string }> {
  try {
    const settings = getSettings();
    if (!settings.apiId || !settings.apiSecret) {
      return { connected: false, error: 'API credentials not configured' };
    }
    await getAuthToken();
    // Try fetching account info
    const account = await apiRequest<any>('/account', 'GET');
    return { connected: true, businessName: account?.name || 'Connected' };
  } catch (error) {
    return { connected: false, error: error instanceof Error ? error.message : 'Connection failed' };
  }
}
