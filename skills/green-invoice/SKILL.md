---
name: green-invoice
description: >
  Green Invoice (חשבונית ירוקה) API integration for Israeli businesses. Covers all Israeli
  tax document types, VAT calculation (18%), automated invoice generation, recurring billing,
  payment tracking, client ledger integration, and reporting for Israeli accountants.
  Use when integrating Israeli invoicing, billing, or document generation into PixelManageAI
  or any SaaS platform serving Israeli businesses.
---

# Green Invoice (חשבונית ירוקה) Integration

## Use When...

- Integrating automated invoicing for Israeli clients after a payment event
- Generating חשבוניות מס (tax invoices), קבלות (receipts), or combined documents
- Setting up recurring billing with automatic Israeli document generation
- Building a client ledger or payment tracking feature for Israeli businesses
- Connecting payment processors (credit card, bank transfer, Bit) to document issuance
- Generating reports for Israeli accountants (רואי חשבון)

---

## 1. Green Invoice Overview

Green Invoice (חשבונית ירוקה) is Israel's leading cloud invoicing platform, serving over 200,000 Israeli businesses. It is authorized by the Israeli Tax Authority (רשות המיסים) for electronic document issuance.

```
API Documentation: https://app.greeninvoice.co.il/api/docs
API Base URL: https://api.greeninvoice.co.il/api/v1
Authentication: JWT Bearer token (obtained via /account/token)
Rate limits: 60 requests/minute per account
Sandbox: https://sandbox.greeninvoice.co.il/api/v1
```

---

## 2. Israeli Tax Document Types

### 2.1 Document Type Reference Table

| Type Code | Hebrew Name | English | When to Use |
|---|---|---|---|
| `10` | הצעת מחיר | Quote / Proposal | Client proposals, pre-sale |
| `20` | הזמנה | Purchase Order | Order confirmation |
| `30` | תעודת משלוח | Delivery Note | Physical goods shipment |
| `100` | חשבונית עסקה | Invoice (non-VAT) | Osek patur (exempt businesses) |
| `200` | חשבונית מס | Tax Invoice | Standard billable invoice |
| `210` | חשבונית מס / קבלה | Tax Invoice + Receipt | Payment already received |
| `300` | קבלה | Receipt | Acknowledge payment only |
| `400` | חשבון עסקה | Pro-forma Invoice | Pre-payment request |
| `405` | חשבונית ביטול | Cancellation Invoice | Cancel a previous document |

**Key rule for PixelManageAI use cases:**
- Client signs up and pays immediately → Issue `210` (חשבונית מס/קבלה)
- Client receives service, pay later → Issue `200` (חשבונית מס), then `300` (קבלה) on payment
- Subscription renewal auto-charge → Issue `210` automatically

### 2.2 VAT Configuration

```typescript
// Israeli VAT (מע"מ) — 18% as of 2025
const ISRAEL_VAT_RATE = 0.18;

// Calculate amounts with VAT
function calculateWithVAT(priceBeforeVAT: number): {
  priceBeforeVAT: number;
  vatAmount: number;
  totalWithVAT: number;
} {
  const vatAmount = priceBeforeVAT * ISRAEL_VAT_RATE;
  return {
    priceBeforeVAT,
    vatAmount: Math.round(vatAmount * 100) / 100,
    totalWithVAT: Math.round((priceBeforeVAT + vatAmount) * 100) / 100,
  };
}

// VAT exemption cases:
// - Osek patur (עוסק פטור): annual revenue < ₪120,000 — no VAT collected
// - Exports / international services: 0% VAT (zero-rated, not exempt)
// - Some agricultural goods: reduced rate
// Always verify client's VAT status during onboarding
```

---

## 3. Authentication & Setup

### 3.1 JWT Authentication

```typescript
// lib/green-invoice/auth.ts
interface GreenInvoiceCredentials {
  id: string;       // API key ID from Green Invoice dashboard
  secret: string;   // API key secret
}

interface GreenInvoiceToken {
  token: string;
  expires: number;  // Unix timestamp
}

let cachedToken: GreenInvoiceToken | null = null;

async function getAuthToken(
  credentials: GreenInvoiceCredentials
): Promise<string> {
  // Check if cached token is still valid (expires in 30 min)
  if (cachedToken && cachedToken.expires > Date.now() / 1000 + 60) {
    return cachedToken.token;
  }
  
  const response = await fetch(`${process.env.GREEN_INVOICE_BASE_URL}/account/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: credentials.id,
      secret: credentials.secret,
    }),
  });
  
  if (!response.ok) {
    throw new Error(`Green Invoice auth failed: ${response.status}`);
  }
  
  const data = await response.json();
  cachedToken = {
    token: data.token,
    expires: data.expires,
  };
  
  return cachedToken.token;
}

// Create authenticated client
async function greenInvoiceRequest(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  body?: object
): Promise<unknown> {
  const token = await getAuthToken({
    id: process.env.GREEN_INVOICE_API_ID!,
    secret: process.env.GREEN_INVOICE_API_SECRET!,
  });
  
  const response = await fetch(
    `${process.env.GREEN_INVOICE_BASE_URL}${endpoint}`,
    {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    }
  );
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Green Invoice API error: ${JSON.stringify(error)}`);
  }
  
  return response.json();
}
```

---

## 4. Document Generation

### 4.1 Create Tax Invoice (חשבונית מס — Type 200)

```typescript
interface InvoiceLineItem {
  description: string;       // Hebrew description of service
  quantity: number;
  price: number;             // Price before VAT, in ILS
  vatType: 0 | 1;           // 0 = no VAT, 1 = include VAT (18%)
  currency?: string;         // 'ILS' default
}

interface CreateInvoiceParams {
  clientId: string;          // Green Invoice client ID
  description?: string;      // Invoice notes/general description
  items: InvoiceLineItem[];
  paymentTermDays?: number;  // Net 30, Net 15, etc. Default: 30
  documentDate?: Date;       // Defaults to today
  dueDate?: Date;            // Payment due date
  remarks?: string;          // Additional Hebrew remarks
  currency?: 'ILS' | 'USD' | 'EUR';
}

async function createTaxInvoice(
  params: CreateInvoiceParams
): Promise<GreenInvoiceDocument> {
  const documentDate = params.documentDate || new Date();
  const dueDate = params.dueDate || addDays(documentDate, params.paymentTermDays || 30);
  
  const payload = {
    description: params.description || '',
    type: 200,  // חשבונית מס
    date: formatDateForGI(documentDate),   // DD/MM/YYYY
    dueDate: formatDateForGI(dueDate),
    lang: 'he',             // Hebrew document
    currency: params.currency || 'ILS',
    vatType: 1,             // Include VAT (standard)
    client: {
      id: params.clientId,
    },
    income: params.items.map(item => ({
      catalogNum: '',        // Optional SKU
      description: item.description,
      quantity: item.quantity,
      price: item.price,
      vatType: item.vatType ?? 1,
      currency: item.currency || 'ILS',
    })),
    remarks: params.remarks || '',
    signed: 1,             // Auto-sign document (1 = yes)
  };
  
  return greenInvoiceRequest('/documents', 'POST', payload) as Promise<GreenInvoiceDocument>;
}

function formatDateForGI(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}
```

### 4.2 Create Tax Invoice + Receipt (חשבונית מס/קבלה — Type 210)

Use when payment has already been received (e.g., Stripe webhook after successful charge).

```typescript
interface CreateInvoiceReceiptParams extends CreateInvoiceParams {
  payment: {
    type: PaymentType;
    bankName?: string;
    bankBranch?: string;
    bankAccount?: string;
    chequeNum?: string;
    date: Date;
    price: number;         // Amount paid (total with VAT)
  };
}

enum PaymentType {
  CASH = 1,
  CHEQUE = 2,
  BANK_TRANSFER = 3,
  CREDIT_CARD = 4,
  BIT = 10,             // Israeli Bit payment app
  PAYBOX = 11,          // Israeli PayBox
  OTHER = 99,
}

async function createInvoiceReceipt(
  params: CreateInvoiceReceiptParams
): Promise<GreenInvoiceDocument> {
  const totalWithVAT = params.items.reduce((sum, item) => {
    return sum + item.price * item.quantity * (item.vatType === 1 ? 1 + ISRAEL_VAT_RATE : 1);
  }, 0);
  
  const payload = {
    description: params.description || '',
    type: 210,  // חשבונית מס / קבלה
    date: formatDateForGI(params.documentDate || new Date()),
    lang: 'he',
    currency: params.currency || 'ILS',
    vatType: 1,
    client: { id: params.clientId },
    income: params.items.map(item => ({
      description: item.description,
      quantity: item.quantity,
      price: item.price,
      vatType: item.vatType ?? 1,
    })),
    payment: [{
      type: params.payment.type,
      date: formatDateForGI(params.payment.date),
      price: Math.round(totalWithVAT * 100) / 100,
      bankName: params.payment.bankName,
      bankBranch: params.payment.bankBranch,
      bankAccount: params.payment.bankAccount,
      chequeNum: params.payment.chequeNum,
    }],
    remarks: params.remarks || '',
    signed: 1,
  };
  
  return greenInvoiceRequest('/documents', 'POST', payload) as Promise<GreenInvoiceDocument>;
}
```

### 4.3 Create Quote (הצעת מחיר — Type 10)

```typescript
async function createQuote(params: {
  clientId: string;
  items: InvoiceLineItem[];
  validDays?: number;        // Quote validity in days (default: 30)
  remarks?: string;
  title?: string;            // Quote title in Hebrew
}): Promise<GreenInvoiceDocument> {
  const expiryDate = addDays(new Date(), params.validDays || 30);
  
  return greenInvoiceRequest('/documents', 'POST', {
    type: 10,  // הצעת מחיר
    date: formatDateForGI(new Date()),
    dueDate: formatDateForGI(expiryDate),
    lang: 'he',
    currency: 'ILS',
    vatType: 1,
    client: { id: params.clientId },
    income: params.items.map(item => ({
      description: item.description,
      quantity: item.quantity,
      price: item.price,
      vatType: item.vatType ?? 1,
    })),
    remarks: params.remarks || '',
    signed: 1,
  }) as Promise<GreenInvoiceDocument>;
}
```

---

## 5. Client Management

### 5.1 Create or Find Client

```typescript
interface GreenInvoiceClient {
  id?: string;               // GI internal ID
  name: string;              // Business name in Hebrew
  taxId?: string;            // ח.פ. / ע.מ. / ת.ז.
  accountingKey?: string;    // Accounting system key
  emails?: string[];
  phone?: string;
  mobile?: string;
  address?: string;
  city?: string;
  zip?: string;
  country?: string;          // 'IL' for Israel
  bankName?: string;
  bankBranch?: string;
  bankAccount?: string;
}

async function findOrCreateClient(
  clientData: GreenInvoiceClient
): Promise<string> {
  // Search by tax ID or name
  if (clientData.taxId) {
    const existing = await searchClientByTaxId(clientData.taxId);
    if (existing) return existing.id;
  }
  
  // Create new client
  const newClient = await greenInvoiceRequest('/clients', 'POST', {
    name: clientData.name,
    taxId: clientData.taxId,
    emails: clientData.emails,
    phone: clientData.phone,
    mobile: clientData.mobile,
    address: clientData.address,
    city: clientData.city,
    zip: clientData.zip,
    country: clientData.country || 'IL',
    accountingKey: clientData.accountingKey,
  }) as GreenInvoiceClient;
  
  return newClient.id!;
}
```

---

## 6. Recurring Billing Setup

### 6.1 Automatic Invoice on Subscription Renewal

```typescript
// Triggered by Stripe/PayPlus webhook after successful charge
async function handleSubscriptionRenewal(event: {
  customerId: string;
  amount: number;             // In ILS, amount charged (WITH VAT)
  planName: string;           // e.g., "פרמיום חודשי"
  chargeDate: Date;
  paymentMethod: 'credit_card' | 'bank_transfer';
}): Promise<GreenInvoiceDocument> {
  // 1. Get or create GI client for this customer
  const customer = await getCustomer(event.customerId);
  const giClientId = await findOrCreateClient({
    name: customer.businessName,
    taxId: customer.taxId,
    emails: [customer.email],
    mobile: customer.phone,
  });
  
  // 2. Calculate price before VAT
  const priceBeforeVAT = event.amount / (1 + ISRAEL_VAT_RATE);
  
  // 3. Generate tax invoice + receipt (type 210)
  const document = await createInvoiceReceipt({
    clientId: giClientId,
    description: `חידוש מנוי — ${event.planName}`,
    items: [{
      description: `${event.planName} — ${formatMonthYear(event.chargeDate)}`,
      quantity: 1,
      price: Math.round(priceBeforeVAT * 100) / 100,
      vatType: 1,
    }],
    documentDate: event.chargeDate,
    payment: {
      type: event.paymentMethod === 'credit_card' 
        ? PaymentType.CREDIT_CARD 
        : PaymentType.BANK_TRANSFER,
      date: event.chargeDate,
      price: event.amount,
    },
  });
  
  // 4. Email document link to client
  await sendDocumentEmail(giClientId, document.id, customer.email);
  
  // 5. Store document reference in PixelManageAI
  await saveInvoiceRecord({
    customerId: event.customerId,
    greenInvoiceDocId: document.id,
    documentNumber: document.number,
    amount: event.amount,
    type: '210',
    issuedAt: new Date(),
  });
  
  return document;
}
```

---

## 7. Payment Tracking

### 7.1 Mark Invoice as Paid (Add Receipt)

```typescript
// When payment received for an existing חשבונית מס (type 200)
async function markInvoiceAsPaid(
  documentId: string,
  payment: {
    amount: number;
    paymentType: PaymentType;
    paymentDate: Date;
    reference?: string;      // Bank reference, check number, etc.
  }
): Promise<GreenInvoiceDocument> {
  // Create a קבלה (receipt — type 300) linked to the invoice
  const invoice = await greenInvoiceRequest(`/documents/${documentId}`, 'GET') as GreenInvoiceDocument;
  
  return greenInvoiceRequest('/documents', 'POST', {
    type: 300,  // קבלה
    date: formatDateForGI(payment.paymentDate),
    lang: 'he',
    currency: 'ILS',
    client: { id: invoice.client.id },
    payment: [{
      type: payment.paymentType,
      date: formatDateForGI(payment.paymentDate),
      price: payment.amount,
      chequeNum: payment.reference,
    }],
    relatedDocuments: [{ id: documentId }],  // Link to original invoice
    signed: 1,
  }) as Promise<GreenInvoiceDocument>;
}
```

### 7.2 Get Outstanding Invoices

```typescript
async function getOutstandingInvoices(params?: {
  fromDate?: Date;
  toDate?: Date;
  clientId?: string;
}): Promise<GreenInvoiceDocument[]> {
  const response = await greenInvoiceRequest('/documents', 'GET') as any;
  
  // Filter for unpaid חשבוניות מס
  return response.items.filter((doc: GreenInvoiceDocument) => 
    doc.type === 200 && 
    doc.status === 0 &&  // 0 = unpaid/open
    (!params?.clientId || doc.client.id === params.clientId)
  );
}
```

---

## 8. Reports for Israeli Accountants

### 8.1 VAT Report (דוח מע"מ)

```typescript
// Generate monthly VAT summary for accountant
async function generateVATReport(
  month: number,    // 1-12
  year: number
): Promise<VATReport> {
  const documents = await getDocumentsByPeriod(month, year);
  
  const sales = documents.filter(d => [200, 210, 300].includes(d.type));
  
  return {
    period: `${month.toString().padStart(2, '0')}/${year}`,
    totalRevenue: sales.reduce((sum, d) => sum + d.totalAmount, 0),
    totalVAT: sales.reduce((sum, d) => sum + d.vat, 0),
    totalRevenueBeforeVAT: sales.reduce((sum, d) => sum + d.totalAmount - d.vat, 0),
    documentCount: sales.length,
    documents: sales.map(d => ({
      number: d.number,
      date: d.date,
      clientName: d.client.name,
      clientTaxId: d.client.taxId,
      amount: d.totalAmount,
      vat: d.vat,
    })),
  };
}
```

### 8.2 Client Ledger

```typescript
async function getClientLedger(
  greenInvoiceClientId: string,
  dateRange?: { from: Date; to: Date }
): Promise<ClientLedger> {
  const documents = await greenInvoiceRequest(
    `/documents?clientId=${greenInvoiceClientId}`, 'GET'
  ) as { items: GreenInvoiceDocument[] };
  
  return {
    clientId: greenInvoiceClientId,
    totalInvoiced: 0,    // Sum of all type 200 + 210
    totalPaid: 0,        // Sum of all payments received
    balance: 0,          // Invoiced - Paid
    documents: documents.items,
  };
}
```

---

## 9. PixelManageAI Integration Points

```typescript
// Environment variables required
// GREEN_INVOICE_API_ID=your-api-id
// GREEN_INVOICE_API_SECRET=your-api-secret
// GREEN_INVOICE_BASE_URL=https://api.greeninvoice.co.il/api/v1
// GREEN_INVOICE_SANDBOX_URL=https://sandbox.greeninvoice.co.il/api/v1

// PixelManageAI billing service
class IsraeliBillingService {
  // Called after Stripe/PayPlus successful payment
  async onPaymentSuccess(payment: PaymentEvent): Promise<void> {
    await handleSubscriptionRenewal({
      customerId: payment.metadata.pixelClientId,
      amount: payment.amount / 100,  // Convert agorot to shekel
      planName: payment.metadata.planName,
      chargeDate: new Date(payment.created * 1000),
      paymentMethod: 'credit_card',
    });
  }
  
  // Called when new client completes onboarding with payment
  async onClientOnboarding(client: NewClient): Promise<void> {
    await createInvoiceReceipt({
      clientId: await findOrCreateClient({
        name: client.businessName,
        taxId: client.taxId,
        emails: [client.email],
        mobile: client.phone,
      }),
      items: [{
        description: `חבילת ${client.planName} — הפעלה ראשונה`,
        quantity: 1,
        price: client.setupFee / (1 + ISRAEL_VAT_RATE),
        vatType: 1,
      }],
      payment: {
        type: PaymentType.CREDIT_CARD,
        date: new Date(),
        price: client.setupFee,
      },
    });
  }
  
  // Monthly invoice generation (if billing end-of-month)
  async generateMonthlyInvoices(): Promise<void> {
    const clients = await getActiveClients();
    for (const client of clients) {
      if (client.billingType === 'monthly-invoice') {
        await createTaxInvoice({
          clientId: client.greenInvoiceId,
          items: [{ 
            description: `שירותי ניהול שיווק דיגיטלי — ${formatMonthHebrew(new Date())}`,
            quantity: 1,
            price: client.monthlyFee,
            vatType: 1,
          }],
          paymentTermDays: 15,
          remarks: 'אנא העבר תשלום תוך 15 ימי עסקים',
        });
      }
    }
  }
}
```
