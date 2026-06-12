# Frame AI — WhatsApp QR Sender Service

A small always-on Node service that connects to WhatsApp via **QR scan**
(whatsapp-web.js) and lets the main Frame AI app broadcast messages (text +
graphic) to clients, with an adjustable delay between recipients.

> ⚠️ This **cannot** run on Vercel — it needs a persistent process and a headless
> browser. Deploy it on **Railway**, **Render**, or a small **VPS**.
> ⚠️ It uses the unofficial WhatsApp Web protocol. The connected number carries a
> ban risk if used for spammy volume — keep delays sane and lists opt‑in.

## 1. Deploy

**Railway / Render (easiest):**
1. Create a new service from this `whatsapp-service/` folder (set it as the root).
2. Build command: `npm install` · Start command: `npm start`.
3. Add a **persistent volume** mounted at `/app/.wwebjs_auth` (so the login
   survives restarts). On Railway add a Volume; on Render add a Disk.
4. Environment variables:
   - `SERVICE_SECRET` — a long random string (must match the main app).
   - `SESSION_DIR` — `/app/.wwebjs_auth` (or wherever your volume is mounted).
   - `PORT` — usually provided by the platform automatically.

**VPS:** `npm install && SERVICE_SECRET=... node index.js` behind a reverse proxy
with HTTPS.

## 2. Connect (scan the QR)

In the Frame AI app open **דיוור וואטסאפ** → it shows the QR from this service.
Scan it in WhatsApp → *Linked devices* → *Link a device*. Once it says
**מחובר**, you're ready.

## 3. Point the main app at this service

In the main app's Vercel env set:
- `WHATSAPP_SERVICE_URL` — the public URL of this service (e.g. `https://wa.up.railway.app`).
- `WHATSAPP_SERVICE_SECRET` — the same value as `SERVICE_SECRET` here.

## API (bearer `SERVICE_SECRET`)

- `GET /status` → `{ state, connected, me, qr }` (qr is a PNG data URL while pairing)
- `POST /logout` → forces a fresh QR
- `POST /send-batch` `{ recipients:[{phone,name}], message, mediaUrl?, intervalSeconds }` → `{ jobId }`
- `GET /batch/:id` → `{ total, sent, failed, done, results }`
- `GET /health` → liveness (no auth)

Phone numbers are normalized for Israel automatically (`05X…` → `9725X…`); pass
full international digits for other countries. `{{name}}` in the message is
replaced per recipient.
