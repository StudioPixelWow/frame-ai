/**
 * Frame AI — WhatsApp QR sender microservice.
 *
 * Runs whatsapp-web.js with a persistent session (LocalAuth). Connect once by
 * scanning the QR; the session is then reused. The main Frame AI app talks to
 * this service over HTTP (shared bearer secret) to broadcast messages with an
 * adjustable delay between recipients.
 *
 * ⚠️ Must run on an ALWAYS-ON host (Railway / Render / a VPS) — NOT Vercel.
 * ⚠️ Uses the unofficial WhatsApp Web protocol; the connected number carries a
 *    ban risk if used for spammy volume. Keep delays sane and lists opt-in.
 *
 * Env:
 *   SERVICE_SECRET   shared bearer token (must match the main app).
 *   PORT             default 8080.
 *   SESSION_DIR      where to persist the session (default ./.wwebjs_auth).
 */

const express = require('express');
const QRCode = require('qrcode');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');

const PORT = process.env.PORT || 8080;
const SECRET = process.env.SERVICE_SECRET || '';
const SESSION_DIR = process.env.SESSION_DIR || './.wwebjs_auth';

// ── WhatsApp client ──────────────────────────────────────────────────────
let state = 'starting';          // starting | qr | authenticated | ready | disconnected
let lastQrDataUrl = null;        // PNG data URL of the current QR (when state === 'qr')
let meInfo = null;               // connected account info

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: SESSION_DIR }),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  },
});

client.on('qr', async (qr) => {
  state = 'qr';
  try { lastQrDataUrl = await QRCode.toDataURL(qr, { margin: 1, width: 320 }); } catch { lastQrDataUrl = null; }
  console.log('[wa] QR ready — scan to connect');
});
client.on('authenticated', () => { state = 'authenticated'; lastQrDataUrl = null; console.log('[wa] authenticated'); });
client.on('ready', () => {
  state = 'ready'; lastQrDataUrl = null;
  meInfo = client.info ? { pushname: client.info.pushname, wid: client.info.wid?._serialized } : null;
  console.log('[wa] READY as', meInfo?.pushname);
});
client.on('disconnected', (r) => { state = 'disconnected'; meInfo = null; console.log('[wa] disconnected:', r); setTimeout(() => client.initialize().catch(() => {}), 5000); });
client.on('auth_failure', (m) => { state = 'disconnected'; console.log('[wa] auth_failure:', m); });

client.initialize().catch((e) => console.error('[wa] init error', e));

// ── Phone normalization → WhatsApp chat id ───────────────────────────────
// Defaults Israeli numbers (05X → 9725X). Override by passing full intl digits.
function toChatId(raw) {
  let d = String(raw || '').replace(/[^\d]/g, '');
  if (!d) return null;
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('0')) d = '972' + d.slice(1);      // local IL → intl
  else if (d.length === 9 && d.startsWith('5')) d = '972' + d; // 5XXXXXXXX → IL
  return `${d}@c.us`;
}

// ── In-memory broadcast jobs ─────────────────────────────────────────────
const jobs = new Map(); // id → { total, sent, failed, done, results[], startedAt }

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

// Cache loaded media by URL so we don't re-download a shared graphic per recipient.
const mediaCache = new Map();
async function loadMedia(url) {
  if (!url) return null;
  if (mediaCache.has(url)) return mediaCache.get(url);
  let m = null;
  try { m = await MessageMedia.fromUrl(url, { unsafeMime: true }); } catch (e) { console.log('[wa] media load failed:', e.message); }
  mediaCache.set(url, m);
  return m;
}

async function runBatch(id, recipients, message, mediaUrl, intervalMs) {
  const job = jobs.get(id);

  for (let i = 0; i < recipients.length; i++) {
    const r = recipients[i];
    const chatId = toChatId(r.phone);
    // Per-recipient overrides (for personalized digests) fall back to the shared message/media.
    const text = ((r.message || message) || '').replace(/\{\{name\}\}/g, r.name || '');
    const media = await loadMedia(r.mediaUrl || mediaUrl);
    try {
      if (!chatId) throw new Error('invalid_phone');
      // Verify the number is on WhatsApp before sending.
      const reg = await client.isRegisteredUser(chatId).catch(() => true);
      if (!reg) throw new Error('not_on_whatsapp');
      if (media) await client.sendMessage(chatId, media, { caption: text });
      else await client.sendMessage(chatId, text);
      job.sent++;
      job.results.push({ phone: r.phone, name: r.name, ok: true });
    } catch (e) {
      job.failed++;
      job.results.push({ phone: r.phone, name: r.name, ok: false, error: e.message });
    }
    // Wait between recipients (skip after the last one).
    if (i < recipients.length - 1) await sleep(intervalMs);
  }
  job.done = true;
  job.finishedAt = Date.now();
}

// ── HTTP API ─────────────────────────────────────────────────────────────
const app = express();
app.use(express.json({ limit: '2mb' }));

function auth(req, res, next) {
  const tok = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!SECRET || tok !== SECRET) return res.status(401).json({ error: 'unauthorized' });
  next();
}

app.get('/health', (_req, res) => res.json({ ok: true, state }));

// Connection status (+ QR when pairing). Returns the QR as a data URL for the UI.
app.get('/status', auth, (_req, res) => {
  res.json({ state, connected: state === 'ready', me: meInfo, qr: state === 'qr' ? lastQrDataUrl : null });
});

// Force a fresh QR / re-login.
app.post('/logout', auth, async (_req, res) => {
  try { await client.logout(); } catch { /* */ }
  state = 'starting'; meInfo = null; lastQrDataUrl = null;
  client.initialize().catch(() => {});
  res.json({ ok: true });
});

// Start a broadcast. Body: { recipients:[{phone,name}], message, mediaUrl?, intervalSeconds }
app.post('/send-batch', auth, (req, res) => {
  if (state !== 'ready') return res.status(409).json({ error: 'not_connected', state });
  const { recipients, message, mediaUrl, intervalSeconds } = req.body || {};
  if (!Array.isArray(recipients) || recipients.length === 0) return res.status(400).json({ error: 'no_recipients' });
  // OK if there's a shared message/media, OR every recipient carries its own.
  const everyHasOwn = recipients.every((r) => (r && (r.message || r.mediaUrl)));
  if (!message && !mediaUrl && !everyHasOwn) return res.status(400).json({ error: 'empty_message' });
  const intervalMs = Math.max(5, Math.min(600, Number(intervalSeconds) || 60)) * 1000;
  const id = `b_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  jobs.set(id, { id, total: recipients.length, sent: 0, failed: 0, done: false, results: [], startedAt: Date.now(), intervalMs });
  runBatch(id, recipients, message, mediaUrl, intervalMs).catch((e) => { const j = jobs.get(id); if (j) { j.done = true; j.error = e.message; } });
  res.json({ ok: true, jobId: id, total: recipients.length, intervalSeconds: intervalMs / 1000 });
});

// Poll a broadcast's progress.
app.get('/batch/:id', auth, (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'not_found' });
  res.json(job);
});

app.listen(PORT, () => console.log(`[wa] service listening on :${PORT}`));
