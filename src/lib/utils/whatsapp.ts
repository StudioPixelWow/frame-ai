/**
 * Client-safe WhatsApp helpers.
 * Builds a wa.me deep-link that opens WhatsApp with a pre-filled message —
 * the user just reviews and presses send. No API/token needed.
 */

/** Normalize an Israeli phone to international digits for wa.me (e.g. 0501234567 → 972501234567). */
export function normalizeIsraeliPhone(raw: string | null | undefined): string {
  if (!raw) return '';
  let d = String(raw).replace(/[^\d+]/g, '');
  if (d.startsWith('+')) d = d.slice(1);
  if (d.startsWith('972')) return d;
  if (d.startsWith('0')) return `972${d.slice(1)}`;
  // Bare mobile without leading 0 (e.g. 50...) → assume IL
  if (d.length === 9 && d.startsWith('5')) return `972${d}`;
  return d;
}

/** Build a wa.me link with an encoded message. Returns '' if phone is unusable. */
export function buildWhatsAppLink(phone: string | null | undefined, message: string): string {
  const num = normalizeIsraeliPhone(phone);
  if (!num || num.length < 8) return '';
  return `https://wa.me/${num}?text=${encodeURIComponent(message)}`;
}

/** Open a WhatsApp chat in a new tab. Returns false if the phone was unusable. */
export function openWhatsApp(phone: string | null | undefined, message: string): boolean {
  const url = buildWhatsAppLink(phone, message);
  if (!url) return false;
  if (typeof window !== 'undefined') window.open(url, '_blank', 'noopener,noreferrer');
  return true;
}

/** Maya's annual website-hosting collection message. */
export function hostingCollectionMessage(clientName: string): string {
  return `היי ${clientName},
תשלום שנתי על אחסון אתר טרם בוצע,
אשמח להסדיר את התשלום בהקדם,
איך תרצו לשלם? העברה בנקאית או חיוב באשראי?

תודה רבה מראש,
מאיה - סטודיו פיקסל`;
}

/** Maya's monthly retainer collection reminder. */
export function retainerCollectionMessage(clientName: string, amount?: number): string {
  const amt = amount && amount > 0 ? ` (₪${amount.toLocaleString('he-IL')})` : '';
  return `היי ${clientName},
תזכורת ידידותית לגבי התשלום החודשי${amt} שטרם הוסדר,
אשמח להסדיר את התשלום בהקדם,
איך תרצו לשלם? העברה בנקאית או חיוב באשראי?

תודה רבה מראש,
מאיה - סטודיו פיקסל`;
}
