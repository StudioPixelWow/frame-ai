/**
 * Receipt OCR + Classification Engine
 * Uses OpenAI Vision API to scan Hebrew receipts and extract structured data.
 */

import OpenAI from 'openai';
import type { ExpenseCategory } from '@/lib/db/schema';

/* ══════════════════════════════════════════════════════════════════════════
   Types
   ══════════════════════════════════════════════════════════════════════════ */

export interface ReceiptScanResult {
  vendorName: string;
  vendorTaxId: string;       // ח.פ. or ע.מ.
  receiptDate: string;       // ISO date
  receiptNumber: string;
  subtotal: number;
  vatAmount: number;
  total: number;
  currency: 'ILS' | 'USD' | 'EUR';
  category: ExpenseCategory;
  categoryConfidence: number; // 0–1
  isDeductible: boolean;
  deductionPercentage: number;
  ocrText: string;
  fiscalMonth: number;
  fiscalYear: number;
}

export interface ScanError {
  success: false;
  error: string;
}

export interface ScanSuccess {
  success: true;
  data: ReceiptScanResult;
}

export type ScanResponse = ScanSuccess | ScanError;

/* ══════════════════════════════════════════════════════════════════════════
   Israeli tax deduction rules
   ══════════════════════════════════════════════════════════════════════════ */

const DEDUCTION_RULES: Record<ExpenseCategory, number> = {
  office: 100,
  software: 100,
  advertising: 100,
  travel: 100,
  meals: 25,
  professional_services: 100,
  equipment: 100,
  insurance: 100,
  taxes: 100,
  supplies: 100,
  utilities: 100,
  rent: 100,
  salary: 100,
  other: 0,
};

/* ══════════════════════════════════════════════════════════════════════════
   Category labels (Hebrew) — used in the classification prompt
   ══════════════════════════════════════════════════════════════════════════ */

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  office: 'משרד',
  software: 'תוכנה',
  advertising: 'פרסום',
  travel: 'נסיעות',
  meals: 'ארוחות / כיבוד',
  professional_services: 'שירותים מקצועיים',
  equipment: 'ציוד',
  insurance: 'ביטוח',
  taxes: 'מיסים / אגרות',
  supplies: 'חומרים מתכלים',
  utilities: 'חשבונות שוטפים',
  rent: 'שכירות',
  salary: 'שכר',
  other: 'אחר',
};

/* ══════════════════════════════════════════════════════════════════════════
   OpenAI client singleton
   ══════════════════════════════════════════════════════════════════════════ */

let _openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (_openai) return _openai;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('Missing OPENAI_API_KEY environment variable');
  _openai = new OpenAI({ apiKey });
  return _openai;
}

/* ══════════════════════════════════════════════════════════════════════════
   Main scan function
   ══════════════════════════════════════════════════════════════════════════ */

export async function scanReceipt(imageUrl: string): Promise<ScanResponse> {
  try {
    const openai = getOpenAI();

    const categoryList = Object.entries(CATEGORY_LABELS)
      .map(([key, heb]) => `"${key}" (${heb})`)
      .join(', ');

    const systemPrompt = `You are an expert Israeli receipt/invoice OCR system.
You read Hebrew and English receipts and extract structured data.
Return ONLY valid JSON — no markdown fences, no extra text.

Extract the following fields:
- vendorName: string — the business name
- vendorTaxId: string — ח.פ. (company) or ע.מ. (authorized dealer) number. Return empty string if not found.
- receiptDate: string — ISO date (YYYY-MM-DD). If unclear, return best guess.
- receiptNumber: string — receipt or invoice number. Return empty string if not found.
- subtotal: number — amount before VAT
- vatAmount: number — VAT (מע"מ) amount. 0 if not listed or exempt.
- total: number — total amount including VAT
- currency: "ILS" | "USD" | "EUR" — detect from symbols (₪/ש"ח = ILS, $/$ = USD, €/EUR = EUR). Default "ILS".
- category: one of [${categoryList}] — classify the expense based on vendor and items
- categoryConfidence: number 0-1 — how confident you are in the category
- ocrText: string — full raw text extracted from the receipt

Rules:
- Israeli VAT rate is 18% (since 2025). If subtotal is given but not VAT, calculate it.
- If only the total is visible, derive subtotal = total / 1.18 and vatAmount = total - subtotal.
- Amounts should be numbers, not strings. Round to 2 decimal places.
- Dates in DD/MM/YYYY format are common in Israel — parse accordingly.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 2000,
      temperature: 0,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Extract all data from this receipt image.' },
            { type: 'image_url', image_url: { url: imageUrl, detail: 'high' } },
          ],
        },
      ],
    });

    const raw = response.choices[0]?.message?.content?.trim();
    if (!raw) {
      return { success: false, error: 'Empty response from OCR model' };
    }

    // Strip markdown code fences if present
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return { success: false, error: `Failed to parse OCR response as JSON: ${cleaned.slice(0, 200)}` };
    }

    // Validate and normalise
    const category = validateCategory(parsed.category as string);
    const deductionPct = DEDUCTION_RULES[category];
    const total = roundTwo(Number(parsed.total) || 0);
    const vatAmount = roundTwo(Number(parsed.vatAmount) || 0);
    const subtotal = roundTwo(Number(parsed.subtotal) || (total - vatAmount));

    const receiptDate = parseDate(String(parsed.receiptDate || ''));
    const dateObj = new Date(receiptDate);

    const result: ReceiptScanResult = {
      vendorName: String(parsed.vendorName || 'לא זוהה'),
      vendorTaxId: String(parsed.vendorTaxId || ''),
      receiptDate,
      receiptNumber: String(parsed.receiptNumber || ''),
      subtotal,
      vatAmount,
      total,
      currency: validateCurrency(parsed.currency as string),
      category,
      categoryConfidence: clamp(Number(parsed.categoryConfidence) || 0.5, 0, 1),
      isDeductible: deductionPct > 0,
      deductionPercentage: deductionPct,
      ocrText: String(parsed.ocrText || ''),
      fiscalMonth: dateObj.getMonth() + 1,
      fiscalYear: dateObj.getFullYear(),
    };

    return { success: true, data: result };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error during receipt scan';
    console.error('[receipt-scanner] Scan failed:', msg);
    return { success: false, error: msg };
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   Helpers
   ══════════════════════════════════════════════════════════════════════════ */

const ALL_CATEGORIES: ExpenseCategory[] = [
  'office', 'software', 'advertising', 'travel', 'meals',
  'professional_services', 'equipment', 'insurance', 'taxes',
  'supplies', 'utilities', 'rent', 'salary', 'other',
];

function validateCategory(raw: string): ExpenseCategory {
  if (ALL_CATEGORIES.includes(raw as ExpenseCategory)) return raw as ExpenseCategory;
  return 'other';
}

function validateCurrency(raw: string): 'ILS' | 'USD' | 'EUR' {
  if (raw === 'USD' || raw === 'EUR') return raw;
  return 'ILS';
}

function parseDate(raw: string): string {
  if (!raw) return new Date().toISOString().split('T')[0];
  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  // DD/MM/YYYY
  const ddmm = raw.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/);
  if (ddmm) {
    const [, d, m, y] = ddmm;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return new Date().toISOString().split('T')[0];
}

function roundTwo(n: number): number {
  return Math.round(n * 100) / 100;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export { DEDUCTION_RULES, CATEGORY_LABELS, ALL_CATEGORIES };
