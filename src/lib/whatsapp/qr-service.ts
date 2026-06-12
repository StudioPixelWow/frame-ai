/**
 * Server-side helper to talk to the standalone WhatsApp QR microservice.
 * Configure in Vercel:
 *   WHATSAPP_SERVICE_URL     public URL of the service (e.g. https://wa.up.railway.app)
 *   WHATSAPP_SERVICE_SECRET  shared bearer token (matches the service's SERVICE_SECRET)
 */

const URL = () => (process.env.WHATSAPP_SERVICE_URL || '').replace(/\/$/, '');
const SECRET = () => process.env.WHATSAPP_SERVICE_SECRET || '';

export function whatsappConfigured(): boolean { return !!(URL() && SECRET()); }

async function call(path: string, init?: { method?: string; body?: any; timeoutMs?: number }) {
  if (!whatsappConfigured()) return { ok: false, status: 0, data: { error: 'whatsapp_not_configured' } };
  try {
    const r = await fetch(`${URL()}${path}`, {
      method: init?.method || 'GET',
      headers: { Authorization: `Bearer ${SECRET()}`, 'Content-Type': 'application/json' },
      body: init?.body ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(init?.timeoutMs || 20000),
      cache: 'no-store',
    });
    let data: any = null;
    try { data = await r.json(); } catch { data = null; }
    return { ok: r.ok, status: r.status, data: data || {} };
  } catch (e) {
    return { ok: false, status: 0, data: { error: e instanceof Error ? e.message : 'service_unreachable' } };
  }
}

export const waStatus = () => call('/status');
export const waLogout = () => call('/logout', { method: 'POST' });
export const waSendBatch = (body: { recipients: { phone: string; name?: string; message?: string; mediaUrl?: string }[]; message?: string; mediaUrl?: string; intervalSeconds: number }) =>
  call('/send-batch', { method: 'POST', body, timeoutMs: 25000 });
export const waBatch = (id: string) => call(`/batch/${encodeURIComponent(id)}`);
