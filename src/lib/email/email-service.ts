/**
 * ── PIXEL Email Service ──
 *
 * Sends real emails via Gmail SMTP using App Password.
 * Falls back to console logging when credentials are not configured.
 *
 * Setup:
 * 1. Go to Google Account → Security → 2-Step Verification → App Passwords
 * 2. Create a new app password for "Mail"
 * 3. Set environment variables (or save in settings page):
 *    - GMAIL_USER=your@gmail.com
 *    - GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
 *
 * The settings page stores credentials in the gmail_settings DB table.
 * Environment variables take precedence over DB settings.
 */

import * as tls from 'tls';

// ── Email Automation Safety Gate ─────────────────────────────────────────────

let cachedEmailEnabled: boolean | null = null;
let lastEmailEnabledCheck = 0;
const EMAIL_ENABLED_CACHE_MS = 30_000; // Re-check every 30s

// ── Test Mode Whitelist ──────────────────────────────────────────────────────
// When set, ONLY these addresses can receive email. All others are blocked.
const TEST_MODE_WHITELIST: string[] | null = null;

/**
 * Check if email automations are enabled in app_settings.
 * Default: OFF (false) — if the setting is missing, treat as OFF.
 */
export async function isEmailAutomationsEnabled(): Promise<boolean> {
  const now = Date.now();
  if (cachedEmailEnabled !== null && (now - lastEmailEnabledCheck) < EMAIL_ENABLED_CACHE_MS) {
    return cachedEmailEnabled;
  }

  try {
    const { getSupabase } = await import('@/lib/db/store');
    const sb = getSupabase();
    const { data } = await sb
      .from('app_settings')
      .select('value')
      .eq('key', 'email_automations_enabled')
      .maybeSingle();

    cachedEmailEnabled = data?.value?.enabled === true;
    lastEmailEnabledCheck = now;
    return cachedEmailEnabled;
  } catch (e) {
    console.warn('[Email-Safety] Failed to check email_automations_enabled — defaulting to OFF:', e);
    return false; // Default OFF if we can't read the setting
  }
}

/** Clear cached email-enabled state (call after toggling in settings) */
export function clearEmailEnabledCache() {
  cachedEmailEnabled = null;
  lastEmailEnabledCheck = 0;
}

/**
 * Log a blocked email attempt to the email_blocked_log table.
 */
async function logBlockedEmail(options: EmailOptions, reason: string): Promise<void> {
  try {
    const { getSupabase } = await import('@/lib/db/store');
    const sb = getSupabase();
    await sb.from('app_settings').upsert({
      key: `email_blocked_${Date.now()}`,
      value: {
        type: 'blocked_email_log',
        status: 'blocked',
        reason,
        to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        subject: options.subject,
        timestamp: new Date().toISOString(),
      },
    }, { onConflict: 'key' });
  } catch (e) {
    console.warn('[Email-Safety] Failed to log blocked email:', e);
  }
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;           // Override sender display name
  replyTo?: string;
  attachments?: EmailAttachment[];
}

export interface EmailAttachment {
  filename: string;
  content?: string | Buffer;  // Base64 string or Buffer
  contentType?: string;
  url?: string;               // URL to fetch content from
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  mock?: boolean;
}

interface GmailCredentials {
  email: string;
  appPassword: string;
  senderName?: string;
}

// ── Credential Loading ───────────────────────────────────────────────────────

let cachedCredentials: GmailCredentials | null = null;
let lastCredentialCheck = 0;
const CREDENTIAL_CACHE_MS = 60_000; // Re-check every minute

async function getCredentials(): Promise<GmailCredentials | null> {
  // Environment variables always take precedence
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    return {
      email: process.env.GMAIL_USER,
      appPassword: process.env.GMAIL_APP_PASSWORD,
      senderName: process.env.GMAIL_SENDER_NAME || 'PIXEL Studio',
    };
  }

  // Check cache
  const now = Date.now();
  if (cachedCredentials && (now - lastCredentialCheck) < CREDENTIAL_CACHE_MS) {
    return cachedCredentials;
  }

  // Try loading from DB (gmail_settings table)
  try {
    const { gmailSettings } = await import('@/lib/db');
    const allSettings = await gmailSettings.getAllAsync();
    const settings = allSettings[0]; // Take first active settings
    if (settings && settings.connectedEmail && settings.accessToken) {
      cachedCredentials = {
        email: settings.connectedEmail,
        appPassword: settings.accessToken, // We store app password in accessToken field
        senderName: settings.senderDisplayName || 'PIXEL Studio',
      };
      lastCredentialCheck = now;
      return cachedCredentials;
    }
  } catch (e) {
    console.warn('[Email] Failed to load credentials from DB:', e);
  }

  return null;
}

/** Clear cached credentials (call after settings update) */
export function clearEmailCredentialCache() {
  cachedCredentials = null;
  lastCredentialCheck = 0;
}

// ── SMTP Implementation ─────────────────────────────────────────────────────

function encodeBase64(str: string): string {
  return Buffer.from(str).toString('base64');
}

function smtpCommand(socket: tls.TLSSocket, command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('SMTP timeout')), 15000);
    socket.once('data', (data: Buffer) => {
      clearTimeout(timeout);
      resolve(data.toString());
    });
    socket.write(command + '\r\n');
  });
}

function waitForGreeting(socket: tls.TLSSocket): Promise<string> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('SMTP greeting timeout')), 10000);
    socket.once('data', (data: Buffer) => {
      clearTimeout(timeout);
      resolve(data.toString());
    });
  });
}

async function sendViaSMTP(creds: GmailCredentials, options: EmailOptions): Promise<EmailResult> {
  const recipients = Array.isArray(options.to) ? options.to : [options.to];
  const fromName = options.from || creds.senderName || 'PIXEL Studio';
  const fromEmail = creds.email;
  const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  // Build MIME message
  const messageId = `<${Date.now()}.${Math.random().toString(36).slice(2)}@pixel.studio>`;

  let mimeBody = [
    `From: "${fromName}" <${fromEmail}>`,
    `To: ${recipients.join(', ')}`,
    `Subject: =?UTF-8?B?${encodeBase64(options.subject)}?=`,
    `Message-ID: ${messageId}`,
    `MIME-Version: 1.0`,
    `Date: ${new Date().toUTCString()}`,
  ];

  if (options.replyTo) {
    mimeBody.push(`Reply-To: ${options.replyTo}`);
  }

  if (options.attachments && options.attachments.length > 0) {
    mimeBody.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
    mimeBody.push('');
    mimeBody.push(`--${boundary}`);
    mimeBody.push('Content-Type: text/html; charset=UTF-8');
    mimeBody.push('Content-Transfer-Encoding: base64');
    mimeBody.push('');
    mimeBody.push(encodeBase64(options.html || options.text || ''));

    for (const att of options.attachments) {
      let content = '';
      if (att.content) {
        content = typeof att.content === 'string' ? att.content : att.content.toString('base64');
      } else if (att.url) {
        try {
          const res = await fetch(att.url);
          const buf = Buffer.from(await res.arrayBuffer());
          content = buf.toString('base64');
        } catch { continue; }
      }
      if (!content) continue;

      mimeBody.push(`--${boundary}`);
      mimeBody.push(`Content-Type: ${att.contentType || 'application/octet-stream'}; name="${att.filename}"`);
      mimeBody.push(`Content-Disposition: attachment; filename="${att.filename}"`);
      mimeBody.push('Content-Transfer-Encoding: base64');
      mimeBody.push('');
      // Split base64 into 76-char lines
      for (let i = 0; i < content.length; i += 76) {
        mimeBody.push(content.slice(i, i + 76));
      }
    }
    mimeBody.push(`--${boundary}--`);
  } else {
    mimeBody.push('Content-Type: text/html; charset=UTF-8');
    mimeBody.push('Content-Transfer-Encoding: base64');
    mimeBody.push('');
    mimeBody.push(encodeBase64(options.html || options.text || ''));
  }

  const rawMessage = mimeBody.join('\r\n');

  return new Promise((resolve) => {
    const socket = tls.connect({
      host: 'smtp.gmail.com',
      port: 465,
      timeout: 20000,
    });

    let step = 'connect';

    socket.on('error', (err) => {
      console.error(`[Email-SMTP] Error at step ${step}:`, err.message);
      socket.destroy();
      resolve({ success: false, error: `SMTP error: ${err.message}` });
    });

    socket.on('timeout', () => {
      console.error('[Email-SMTP] Connection timeout');
      socket.destroy();
      resolve({ success: false, error: 'SMTP connection timeout' });
    });

    (async () => {
      try {
        // Wait for greeting
        step = 'greeting';
        const greeting = await waitForGreeting(socket);
        if (!greeting.startsWith('220')) throw new Error(`Bad greeting: ${greeting.trim()}`);

        // EHLO
        step = 'ehlo';
        const ehlo = await smtpCommand(socket, `EHLO pixel.studio`);
        if (!ehlo.includes('250')) throw new Error(`EHLO failed: ${ehlo.trim()}`);

        // AUTH LOGIN
        step = 'auth-start';
        const authResp = await smtpCommand(socket, 'AUTH LOGIN');
        if (!authResp.startsWith('334')) throw new Error(`AUTH failed: ${authResp.trim()}`);

        step = 'auth-user';
        const userResp = await smtpCommand(socket, encodeBase64(creds.email));
        if (!userResp.startsWith('334')) throw new Error(`Auth user failed: ${userResp.trim()}`);

        step = 'auth-pass';
        const passResp = await smtpCommand(socket, encodeBase64(creds.appPassword));
        if (!passResp.startsWith('235')) throw new Error(`Authentication failed — check your App Password. Response: ${passResp.trim()}`);

        // MAIL FROM
        step = 'mail-from';
        const fromResp = await smtpCommand(socket, `MAIL FROM:<${fromEmail}>`);
        if (!fromResp.startsWith('250')) throw new Error(`MAIL FROM failed: ${fromResp.trim()}`);

        // RCPT TO (for each recipient)
        for (const rcpt of recipients) {
          step = `rcpt-to-${rcpt}`;
          const rcptResp = await smtpCommand(socket, `RCPT TO:<${rcpt}>`);
          if (!rcptResp.startsWith('250')) throw new Error(`RCPT TO ${rcpt} failed: ${rcptResp.trim()}`);
        }

        // DATA
        step = 'data';
        const dataResp = await smtpCommand(socket, 'DATA');
        if (!dataResp.startsWith('354')) throw new Error(`DATA failed: ${dataResp.trim()}`);

        // Send message body + terminator
        step = 'message';
        const msgResp = await smtpCommand(socket, rawMessage + '\r\n.');
        if (!msgResp.startsWith('250')) throw new Error(`Message rejected: ${msgResp.trim()}`);

        // QUIT
        step = 'quit';
        try { await smtpCommand(socket, 'QUIT'); } catch { /* ignore */ }
        socket.destroy();

        console.log(`[Email] ✓ Sent to ${recipients.join(', ')}: ${options.subject}`);
        resolve({ success: true, messageId });
      } catch (err: any) {
        console.error(`[Email-SMTP] Failed at step ${step}:`, err.message);
        socket.destroy();
        resolve({ success: false, error: err.message });
      }
    })();
  });
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Send an email using configured Gmail credentials.
 * Falls back to console logging if no credentials are configured.
 */
export async function sendEmail(options: EmailOptions): Promise<EmailResult> {
  // ── Email Safety Gate ──────────────────────────────────────────────────────
  // Block ALL email sending when automations are disabled in Settings.
  // Default: OFF. If setting is missing, treat as OFF.
  const emailEnabled = await isEmailAutomationsEnabled();
  if (!emailEnabled) {
    console.warn(`[Email-Safety] BLOCKED — email automations disabled. To: ${options.to}, Subject: ${options.subject}`);
    await logBlockedEmail(options, 'email_automations_disabled');
    return { success: false, error: 'Email automations are disabled in Settings. הפעל אוטומציות דיוור בהגדרות.' };
  }

  // ── Test-Mode Whitelist Guard ─────────────────────────────────────────────
  // When TEST_MODE_WHITELIST is set, only whitelisted addresses can receive.
  if (TEST_MODE_WHITELIST && TEST_MODE_WHITELIST.length > 0) {
    const recipients = Array.isArray(options.to) ? options.to : [options.to];
    const blocked = recipients.filter(
      (r) => !TEST_MODE_WHITELIST.some((w) => r.trim().toLowerCase() === w.toLowerCase())
    );
    if (blocked.length > 0) {
      console.warn(`[Email-Safety] BLOCKED — non-whitelisted recipient(s): ${blocked.join(', ')}. Subject: ${options.subject}`);
      await logBlockedEmail(options, 'non_studio_pixel_test_recipient');
      return {
        success: false,
        error: `מצב בדיקות: הנמען ${blocked.join(', ')} אינו ברשימת הבדיקות. רק office@s-pixel.co.il מורשה.`,
      };
    }
  }

  const creds = await getCredentials();

  if (!creds) {
    console.log(`[Email-Mock] No Gmail credentials configured. Would send to: ${options.to}`);
    console.log(`[Email-Mock] Subject: ${options.subject}`);
    return { success: true, mock: true, error: 'No Gmail credentials — email logged but not sent' };
  }

  try {
    return await sendViaSMTP(creds, options);
  } catch (err: any) {
    console.error('[Email] sendEmail failed:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Test Gmail connection with current credentials.
 * Returns success if SMTP auth succeeds.
 */
export async function testGmailConnection(email: string, appPassword: string): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    const socket = tls.connect({
      host: 'smtp.gmail.com',
      port: 465,
      timeout: 15000,
    });

    socket.on('error', (err) => {
      socket.destroy();
      resolve({ success: false, error: `Connection error: ${err.message}` });
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve({ success: false, error: 'Connection timeout' });
    });

    (async () => {
      try {
        const greeting = await waitForGreeting(socket);
        if (!greeting.startsWith('220')) throw new Error('Bad greeting');

        await smtpCommand(socket, 'EHLO pixel.studio');
        const authResp = await smtpCommand(socket, 'AUTH LOGIN');
        if (!authResp.startsWith('334')) throw new Error('AUTH not supported');

        await smtpCommand(socket, encodeBase64(email));
        const passResp = await smtpCommand(socket, encodeBase64(appPassword));

        try { await smtpCommand(socket, 'QUIT'); } catch {}
        socket.destroy();

        if (passResp.startsWith('235')) {
          resolve({ success: true });
        } else {
          resolve({ success: false, error: 'סיסמת האפליקציה שגויה — ודא שיצרת סיסמת אפליקציה ולא סיסמה רגילה' });
        }
      } catch (err: any) {
        socket.destroy();
        resolve({ success: false, error: err.message });
      }
    })();
  });
}

/**
 * Check if email system is configured and ready.
 */
export async function isEmailConfigured(): Promise<boolean> {
  const creds = await getCredentials();
  return creds !== null;
}

/**
 * Get the configured sender email (for display purposes).
 */
export async function getSenderEmail(): Promise<string | null> {
  const creds = await getCredentials();
  return creds?.email || null;
}
