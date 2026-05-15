---
name: israeli-receipt-scanner
description: >
  Israeli receipt and document scanning, OCR, and categorization system. Covers Israeli
  receipt format recognition, Hebrew OCR, expense categorization (הוצאה מוכרת vs לא מוכרת),
  VAT extraction, integration with accounting systems, document classification
  (invoice/receipt/quote/delivery note), and automated data entry from scanned documents.
  Use when building document scanning, expense tracking, or OCR features for Israeli clients.
---

# Israeli Receipt Scanner & OCR System

## Use When...

- Building a receipt/invoice scanning feature for an Israeli SaaS or mobile app
- Implementing expense tracking with Israeli tax categorization
- Extracting structured data from Israeli tax documents (חשבוניות, קבלות)
- Classifying scanned documents by type (invoice vs receipt vs quote vs delivery note)
- Integrating with Israeli accounting software (Priority, SAP Business One, Hashavshevet)
- Building an automated bookkeeping assistant for Israeli self-employed or SMB

---

## 1. Israeli Receipt and Document Formats

### 1.1 Standard Israeli Receipt Elements

Every official Israeli fiscal receipt (קבלה/חשבונית) must contain specific elements per tax authority requirements:

```
Required elements on Israeli tax documents:
  1. Business name (שם העסק)
  2. Business registration number — one of:
     - ח.פ. (חברה פרטית — private company)
     - ע.מ. (עוסק מורשה — licensed dealer)
     - עמ"ת (עמותה — non-profit)
     - מ.ע. (מוסד ציבורי)
  3. Business address (כתובת)
  4. Document serial number (מספר מסמך)
  5. Date in Israeli format (DD/MM/YYYY)
  6. Itemized list of goods/services
  7. Price before VAT (מחיר לפני מע"מ)
  8. VAT amount (מע"מ 18%)
  9. Total price (סה"כ לתשלום)
  10. Payment method (אמצעי תשלום)

For חשבונית מס (tax invoice) specifically:
  - Client name and tax ID (חשבונית לצד ג')
  - Document is numbered sequentially
  - Must be issued by software certified by Israeli Tax Authority
    (תוכנה מאושרת ע"י רשות המיסים)

Common receipt sources in Israel:
  - Supermarket chains: רמי לוי, שופרסל, קרפור, יינות ביתן, מגה
  - Gas stations: דלק, סונול, פז
  - Pharmacies: סופר-פארם, ניו-פארם, בית מרקחת
  - Restaurants and cafes (various formats)
  - Government services (receipt is standard government format)
  - Online purchases (digital receipts via email)
  - Green Invoice / הנהלת חשבונות ישראלי formatted documents
```

### 1.2 Document Classification Map

```typescript
type IsraeliDocumentType =
  | 'חשבונית_מס'           // Tax invoice — VAT-registered business
  | 'קבלה'                 // Receipt — proof of payment
  | 'חשבונית_מס_קבלה'     // Combined tax invoice + receipt
  | 'הצעת_מחיר'            // Quote
  | 'תעודת_משלוח'          // Delivery note
  | 'חשבון_עסקה'           // Pro-forma invoice
  | 'קבלה_לא_רשמית'        // Informal receipt (e.g., handwritten, small vendor)
  | 'קבלת_כספומט'          // ATM withdrawal receipt
  | 'קבלת_תשלום_מס'        // Tax payment receipt
  | 'לא_מזוהה'             // Unknown document type

interface ClassificationResult {
  documentType: IsraeliDocumentType;
  confidence: number;      // 0-1
  isValidForVATDeduction: boolean;
  requiresManualReview: boolean;
}
```

---

## 2. OCR Pipeline Architecture

### 2.1 System Architecture

```
[Image Input]
    ↓
[Pre-processing]
  - Deskew (correct tilt)
  - Enhance contrast
  - Remove noise
  - Detect orientation (Hebrew RTL)
    ↓
[OCR Engine]
  - Hebrew + English + numbers
  - RTL text block detection
    ↓
[Post-processing]
  - Hebrew text correction (common OCR errors in Hebrew)
  - Number normalization (shekel amounts)
  - Date parsing (Israeli DD/MM/YYYY format)
    ↓
[Data Extraction]
  - Business identification
  - Document classification
  - Line item parsing
  - VAT calculation verification
    ↓
[Categorization]
  - הוצאה מוכרת classification
  - Accounting category assignment
    ↓
[Output]
  - Structured JSON
  - Accounting software import
```

### 2.2 OCR Engine Selection for Hebrew

```typescript
// Option 1: Google Cloud Vision API (recommended — best Hebrew support)
import vision from '@google-cloud/vision';

async function extractTextGCP(imageBase64: string): Promise<string> {
  const client = new vision.ImageAnnotatorClient();
  const [result] = await client.documentTextDetection({
    image: { content: imageBase64 },
    imageContext: {
      languageHints: ['he', 'en'],  // Hebrew primary, English secondary
    },
  });
  
  return result.fullTextAnnotation?.text || '';
}

// Option 2: AWS Textract (good for structured documents)
import { TextractClient, DetectDocumentTextCommand } from '@aws-sdk/client-textract';

async function extractTextAWS(imageBuffer: Buffer): Promise<string> {
  const client = new TextractClient({ region: 'eu-west-1' });
  const command = new DetectDocumentTextCommand({
    Document: { Bytes: imageBuffer },
  });
  const response = await client.send(command);
  return response.Blocks
    ?.filter(b => b.BlockType === 'LINE')
    .map(b => b.Text)
    .join('\n') || '';
}

// Option 3: Tesseract.js (open source, self-hosted)
import Tesseract from 'tesseract.js';

async function extractTextTesseract(imagePath: string): Promise<string> {
  const { data: { text } } = await Tesseract.recognize(imagePath, 'heb+eng', {
    logger: m => console.log(m),
  });
  return text;
}
```

### 2.3 Image Pre-processing

```typescript
import sharp from 'sharp';

async function preprocessReceiptImage(
  inputBuffer: Buffer
): Promise<Buffer> {
  return sharp(inputBuffer)
    // Convert to grayscale for better OCR
    .grayscale()
    // Increase contrast
    .normalise()
    // Sharpen for text
    .sharpen({ sigma: 1, m1: 0.5, m2: 0.5 })
    // Ensure minimum resolution (300 DPI equivalent)
    .resize({
      width: 2000,
      height: 2800,
      fit: 'inside',
      withoutEnlargement: false,
    })
    // Convert to PNG (lossless for OCR)
    .png({ quality: 100 })
    .toBuffer();
}

// Detect if image needs rotation
async function detectAndCorrectOrientation(
  buffer: Buffer
): Promise<{ buffer: Buffer; rotationApplied: number }> {
  const metadata = await sharp(buffer).metadata();
  // Use EXIF orientation data or ML-based orientation detection
  // Receipts are typically portrait orientation
  if (metadata.width && metadata.height && metadata.width > metadata.height) {
    // Landscape — rotate 90 degrees
    const rotated = await sharp(buffer).rotate(90).toBuffer();
    return { buffer: rotated, rotationApplied: 90 };
  }
  return { buffer, rotationApplied: 0 };
}
```

---

## 3. Israeli-Specific Data Extraction

### 3.1 Business Registration Number Extraction

```typescript
// Israeli tax ID patterns
const ISRAELI_TAX_ID_PATTERNS = {
  // חברה פרטית (Private company) — 9 digits starting with 51-57
  חברה_פרטית: /ח\.?פ\.?\s*:?\s*(\d{8,9})/gi,
  // עוסק מורשה (Licensed dealer) — 9 digits
  עוסק_מורשה: /ע\.?מ\.?\s*:?\s*(\d{8,9})/gi,
  // עמותה (Non-profit)
  עמותה: /עמ"ת\s*:?\s*(\d{6,9})/gi,
  // General tax ID (מספר עוסק)
  general: /מספר\s+עוסק\s*:?\s*(\d{8,9})/gi,
};

function extractBusinessId(text: string): {
  id: string | null;
  type: 'חברה' | 'עוסק' | 'עמותה' | 'לא_ידוע' | null;
} {
  for (const [type, pattern] of Object.entries(ISRAELI_TAX_ID_PATTERNS)) {
    pattern.lastIndex = 0;
    const match = pattern.exec(text);
    if (match) {
      return {
        id: match[1].replace(/\D/g, ''),
        type: type === 'חברה_פרטית' ? 'חברה' 
              : type === 'עוסק_מורשה' ? 'עוסק'
              : type === 'עמותה' ? 'עמותה'
              : 'לא_ידוע',
      };
    }
  }
  return { id: null, type: null };
}
```

### 3.2 Israeli Date Parsing

```typescript
// Israeli dates appear as DD/MM/YYYY or DD.MM.YYYY or DD-MM-YYYY
function parseIsraeliDate(text: string): Date | null {
  const datePatterns = [
    /(\d{1,2})\/(\d{1,2})\/(\d{4})/,  // DD/MM/YYYY
    /(\d{1,2})\.(\d{1,2})\.(\d{4})/,  // DD.MM.YYYY
    /(\d{1,2})-(\d{1,2})-(\d{4})/,    // DD-MM-YYYY
  ];
  
  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      const [, day, month, year] = match;
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      if (!isNaN(date.getTime())) return date;
    }
  }
  return null;
}

// Extract all dates from OCR text, find document date
function extractDocumentDate(ocrText: string): Date | null {
  const lines = ocrText.split('\n');
  for (const line of lines) {
    // Look for date near "תאריך" keyword
    if (/תאריך|date/i.test(line)) {
      const date = parseIsraeliDate(line);
      if (date) return date;
    }
  }
  // Fallback: find any valid date in document
  const allDates = ocrText.match(/\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{4}/g);
  if (allDates && allDates.length > 0) {
    return parseIsraeliDate(allDates[0]);
  }
  return null;
}
```

### 3.3 VAT and Amount Extraction

```typescript
interface ExtractedAmounts {
  subtotal: number | null;      // מחיר לפני מע"מ
  vatAmount: number | null;     // סכום מע"מ
  total: number | null;         // סה"כ
  vatRate: number | null;       // 0.18 (18%) or 0
  currency: 'ILS' | 'USD' | 'EUR';
  confidence: 'high' | 'medium' | 'low';
}

function extractAmounts(ocrText: string): ExtractedAmounts {
  // Hebrew amount keywords
  const subtotalKeywords = /לפני\s+מע"מ|ללא\s+מע"מ|מחיר\s+נטו|סכום\s+בסיס/i;
  const vatKeywords = /מע"מ\s+18%|מע"מ\s+\d+%|ע"מ|מס\s+ערך\s+מוסף/i;
  const totalKeywords = /סה"כ\s+לתשלום|סך\s+הכל|לתשלום|total/i;
  
  // Extract number after each keyword
  const amountPattern = /[\d,]+\.?\d{0,2}/g;
  
  function extractAfterKeyword(text: string, keyword: RegExp): number | null {
    const lines = text.split('\n');
    for (const line of lines) {
      if (keyword.test(line)) {
        const amounts = line.match(amountPattern);
        if (amounts) {
          // Take the last number in the line (usually the amount)
          const cleaned = amounts[amounts.length - 1].replace(/,/g, '');
          return parseFloat(cleaned);
        }
      }
    }
    return null;
  }
  
  const total = extractAfterKeyword(ocrText, totalKeywords);
  const vat = extractAfterKeyword(ocrText, vatKeywords);
  const subtotal = vat && total ? total - vat : extractAfterKeyword(ocrText, subtotalKeywords);
  
  // Validate: subtotal + vat should equal total (within rounding)
  const isValid = subtotal && vat && total && 
    Math.abs((subtotal + vat) - total) < 0.1;
  
  return {
    subtotal,
    vatAmount: vat,
    total,
    vatRate: vat && subtotal ? vat / subtotal : null,
    currency: 'ILS',
    confidence: isValid ? 'high' : (total ? 'medium' : 'low'),
  };
}
```

---

## 4. Expense Categorization — הוצאות מוכרות

### 4.1 Israeli Tax Authority Categories

```typescript
// הוצאות מוכרות — tax-deductible expenses for Israeli businesses
// Based on Israeli Income Tax Ordinance (פקודת מס הכנסה)

enum ExpenseCategory {
  // Fully deductible (100%)
  OFFICE_RENT = 'שכר_דירה_משרד',           // Full office rent
  PROFESSIONAL_SERVICES = 'שירותים_מקצועיים', // Accountant, lawyer
  EQUIPMENT_BUSINESS = 'ציוד_עסקי',         // Business equipment
  SOFTWARE = 'תוכנות',                       // Software licenses
  MARKETING = 'שיווק_ופרסום',               // Advertising, marketing
  INSURANCE_BUSINESS = 'ביטוח_עסקי',        // Business insurance
  SALARY = 'שכר_עבודה',                     // Employee salaries
  SUBSCRIPTIONS = 'מנויים_עסקיים',          // Business subscriptions
  
  // Partially deductible
  CAR_EXPENSES = 'הוצאות_רכב',             // 45% deductible (personal use limitation)
  MOBILE_PHONE = 'טלפון_נייד',             // 50% deductible (personal use)
  HOME_OFFICE = 'משרד_בבית',               // Part of home expenses
  MEALS_ENTERTAINMENT = 'ארוחות_ועסקים',   // 80% deductible with business purpose
  
  // Not deductible
  FINES = 'קנסות',                          // Traffic fines, penalty payments
  PERSONAL_EXPENSES = 'הוצאות_פרטיות',      // Personal, non-business
  
  // Requires documentation
  GIFTS = 'מתנות',                          // Up to ₪210/year per recipient
  TRAVEL_ABROAD = 'נסיעות_לחוץ_לארץ',      // With receipts and business purpose
}

// Deductibility rates
const DEDUCTIBILITY_RATES: Record<ExpenseCategory, number> = {
  [ExpenseCategory.OFFICE_RENT]: 1.0,
  [ExpenseCategory.PROFESSIONAL_SERVICES]: 1.0,
  [ExpenseCategory.EQUIPMENT_BUSINESS]: 1.0,
  [ExpenseCategory.SOFTWARE]: 1.0,
  [ExpenseCategory.MARKETING]: 1.0,
  [ExpenseCategory.INSURANCE_BUSINESS]: 1.0,
  [ExpenseCategory.SALARY]: 1.0,
  [ExpenseCategory.SUBSCRIPTIONS]: 1.0,
  [ExpenseCategory.CAR_EXPENSES]: 0.45,
  [ExpenseCategory.MOBILE_PHONE]: 0.5,
  [ExpenseCategory.HOME_OFFICE]: 0.33,   // Typically 1/3 of home expenses
  [ExpenseCategory.MEALS_ENTERTAINMENT]: 0.8,
  [ExpenseCategory.FINES]: 0,
  [ExpenseCategory.PERSONAL_EXPENSES]: 0,
  [ExpenseCategory.GIFTS]: 1.0,          // Up to limit
  [ExpenseCategory.TRAVEL_ABROAD]: 1.0,  // With documentation
};
```

### 4.2 AI-Powered Categorization

```typescript
// Use LLM to categorize receipts based on vendor and items
async function categorizeExpense(params: {
  vendorName: string;
  vendorCategory?: string;    // From business registry
  lineItems: string[];
  amount: number;
}): Promise<{
  category: ExpenseCategory;
  deductibilityRate: number;
  confidence: number;
  notes?: string;
}> {
  // Rule-based first pass
  const ruleBasedCategory = applyIsraeliExpenseRules(params);
  if (ruleBasedCategory.confidence > 0.9) return ruleBasedCategory;
  
  // LLM for ambiguous cases
  const prompt = `
    ספק: ${params.vendorName}
    פריטים: ${params.lineItems.join(', ')}
    סכום: ₪${params.amount}
    
    קטגר הוצאה זו לפי הקטגוריות הבאות לצרכי מס בישראל:
    ${Object.values(ExpenseCategory).join(', ')}
    
    האם זו הוצאה מוכרת? מה שיעור ההכרה?
    ענה בפורמט JSON: { category, deductibilityRate, notes }
  `;
  
  // ... call LLM API
  return { category: ExpenseCategory.PROFESSIONAL_SERVICES, deductibilityRate: 1.0, confidence: 0.8 };
}

// Rule-based categorization for common Israeli vendors
function applyIsraeliExpenseRules(params: {
  vendorName: string;
  lineItems: string[];
  amount: number;
}): { category: ExpenseCategory; deductibilityRate: number; confidence: number } {
  const vendor = params.vendorName.toLowerCase();
  
  // Gas stations (Israeli chains) → Car expenses
  if (/דלק|סונול|פז|צמד|יוניפל|ten|ten-ev/i.test(vendor)) {
    return { category: ExpenseCategory.CAR_EXPENSES, deductibilityRate: 0.45, confidence: 0.95 };
  }
  
  // Supermarkets → likely personal (low deductibility unless business meal)
  if (/רמי לוי|שופרסל|קרפור|מגה|יינות|אושר עד/i.test(vendor)) {
    return { category: ExpenseCategory.PERSONAL_EXPENSES, deductibilityRate: 0, confidence: 0.8 };
  }
  
  // Office supply stores
  if (/office depot|סיטיקום|kravitz|קרביץ/i.test(vendor)) {
    return { category: ExpenseCategory.EQUIPMENT_BUSINESS, deductibilityRate: 1.0, confidence: 0.9 };
  }
  
  // Telecom (Cellcom, Partner, Hot Mobile, Pelephone, 012)
  if (/סלקום|פרטנר|hot mobile|פלאפון|012/i.test(vendor)) {
    return { category: ExpenseCategory.MOBILE_PHONE, deductibilityRate: 0.5, confidence: 0.9 };
  }
  
  // Restaurants
  if (params.lineItems.some(item => /ארוחה|אוכל|שתייה|קפה|מנה/i.test(item))) {
    return { category: ExpenseCategory.MEALS_ENTERTAINMENT, deductibilityRate: 0.8, confidence: 0.75 };
  }
  
  // Default
  return { category: ExpenseCategory.PROFESSIONAL_SERVICES, deductibilityRate: 1.0, confidence: 0.3 };
}
```

---

## 5. Complete Document Processing Pipeline

### 5.1 Main Processing Function

```typescript
interface ScannedDocumentResult {
  // Classification
  documentType: IsraeliDocumentType;
  isValidTaxDocument: boolean;
  
  // Extracted data
  vendor: {
    name: string | null;
    taxId: string | null;
    taxIdType: 'חברה' | 'עוסק' | 'עמותה' | null;
    address: string | null;
  };
  
  document: {
    number: string | null;
    date: Date | null;
    dueDate: Date | null;
  };
  
  amounts: ExtractedAmounts;
  
  lineItems: Array<{
    description: string;
    quantity: number | null;
    unitPrice: number | null;
    total: number | null;
  }>;
  
  // Categorization
  expenseCategory: ExpenseCategory;
  deductibilityRate: number;
  isHotzaaHakara: boolean;    // הוצאה מוכרת
  
  // Meta
  confidence: 'high' | 'medium' | 'low';
  requiresManualReview: boolean;
  reviewReasons: string[];
  rawText: string;
  processingTimeMs: number;
}

async function processIsraeliDocument(
  imageInput: Buffer | string  // Buffer or base64 string
): Promise<ScannedDocumentResult> {
  const startTime = Date.now();
  
  // 1. Pre-process image
  const buffer = typeof imageInput === 'string' 
    ? Buffer.from(imageInput, 'base64') 
    : imageInput;
  const processed = await preprocessReceiptImage(buffer);
  const { buffer: oriented } = await detectAndCorrectOrientation(processed);
  
  // 2. Extract text via OCR
  const rawText = await extractTextGCP(oriented.toString('base64'));
  
  // 3. Classify document type
  const docType = classifyIsraeliDocument(rawText);
  
  // 4. Extract structured data
  const businessId = extractBusinessId(rawText);
  const date = extractDocumentDate(rawText);
  const amounts = extractAmounts(rawText);
  const lineItems = extractLineItems(rawText);
  
  // 5. Categorize expense
  const categorization = await categorizeExpense({
    vendorName: extractVendorName(rawText) || '',
    lineItems: lineItems.map(i => i.description),
    amount: amounts.total || 0,
  });
  
  // 6. Validation
  const reviewReasons: string[] = [];
  if (!businessId.id) reviewReasons.push('לא זוהה מספר עוסק');
  if (!date) reviewReasons.push('לא זוהה תאריך');
  if (amounts.confidence === 'low') reviewReasons.push('סכומים לא ברורים');
  if (amounts.vatRate && Math.abs(amounts.vatRate - 0.18) > 0.01) {
    reviewReasons.push(`שיעור מע"מ חריג: ${(amounts.vatRate * 100).toFixed(1)}%`);
  }
  
  return {
    documentType: docType,
    isValidTaxDocument: docType !== 'לא_מזוהה' && !!businessId.id,
    vendor: {
      name: extractVendorName(rawText),
      taxId: businessId.id,
      taxIdType: businessId.type,
      address: extractAddress(rawText),
    },
    document: {
      number: extractDocumentNumber(rawText),
      date,
      dueDate: null,
    },
    amounts,
    lineItems,
    expenseCategory: categorization.category,
    deductibilityRate: categorization.deductibilityRate,
    isHotzaaHakara: categorization.deductibilityRate > 0,
    confidence: reviewReasons.length === 0 ? 'high' : reviewReasons.length <= 2 ? 'medium' : 'low',
    requiresManualReview: reviewReasons.length > 0,
    reviewReasons,
    rawText,
    processingTimeMs: Date.now() - startTime,
  };
}
```

---

## 6. Integration with Accounting Systems

### 6.1 Export Formats

```typescript
// Export to Hashavshevet (חשבשבת) format
function exportToHashavshevet(document: ScannedDocumentResult): string {
  // Hashavshevet uses a specific CSV format
  const date = document.document.date 
    ? formatDateForGI(document.document.date) 
    : formatDateForGI(new Date());
  
  return [
    document.vendor.taxId || '',          // מזהה עסק
    document.vendor.name || '',            // שם ספק
    date,                                  // תאריך
    document.document.number || '',        // מספר מסמך
    document.amounts.subtotal?.toFixed(2) || '0',  // סכום לפני מע"מ
    document.amounts.vatAmount?.toFixed(2) || '0', // מע"מ
    document.amounts.total?.toFixed(2) || '0',     // סה"כ
    document.expenseCategory,             // קטגוריה
    document.deductibilityRate.toString(), // שיעור הכרה
  ].join(',');
}

// Export to Priority ERP format
function exportToPriority(documents: ScannedDocumentResult[]): object[] {
  return documents.map(doc => ({
    REFERENCE: doc.document.number,
    BOOKNUM: '',            // Will be assigned by Priority
    IVDATE: doc.document.date?.toISOString(),
    CURDATE: new Date().toISOString(),
    VATPRICE: doc.amounts.vatAmount,
    PRICE: doc.amounts.total,
    DESCRIPTION: `${doc.vendor.name} — ${doc.expenseCategory}`,
    DEBIT: doc.expenseCategory,
  }));
}
```

---

## 7. PixelManageAI Integration

```typescript
// API endpoint for receipt scanning
// app/api/receipts/scan/route.ts

import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get('receipt') as File;
  const clientId = formData.get('clientId') as string;
  
  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }
  
  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await processIsraeliDocument(buffer);
  
  // Save to database
  await saveExpenseRecord({
    clientId,
    scanResult: result,
    originalFileName: file.name,
    uploadedAt: new Date(),
  });
  
  // If high confidence and valid, optionally auto-post to accounting
  if (result.confidence === 'high' && result.isValidTaxDocument) {
    await queueForAccountingSync(clientId, result);
  }
  
  return NextResponse.json({
    success: true,
    document: result,
    message: result.requiresManualReview 
      ? 'המסמך עובד אך דורש בדיקה ידנית' 
      : 'המסמך עובד בהצלחה',
  });
}

// Batch processing for multiple receipts
async function processBatchReceipts(
  clientId: string,
  files: File[]
): Promise<{ processed: number; failed: number; results: ScannedDocumentResult[] }> {
  const results = await Promise.allSettled(
    files.map(async file => {
      const buffer = Buffer.from(await file.arrayBuffer());
      return processIsraeliDocument(buffer);
    })
  );
  
  const processed = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;
  const successResults = results
    .filter((r): r is PromiseFulfilledResult<ScannedDocumentResult> => r.status === 'fulfilled')
    .map(r => r.value);
  
  return { processed, failed, results: successResults };
}
```
