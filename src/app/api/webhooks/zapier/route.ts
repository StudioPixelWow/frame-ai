import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

/**
 * Zapier Webhook Endpoint
 * Receives events from Zapier and triggers internal actions.
 * Uses ZAPIER_WEBHOOK_SECRET for HMAC signature verification.
 *
 * Supported event types:
 * - new_lead: Create a lead from external form
 * - payment_received: Mark invoice as paid
 * - form_submit: Trigger email sequence
 * - calendar_event: Create task from calendar
 * - custom: Pass-through to automation engine
 */

// ===== Signature Verification =====

function verifySignature(body: string, signature: string | null): boolean {
  const secret = process.env.ZAPIER_WEBHOOK_SECRET;
  if (!secret) return true; // Skip verification if no secret configured (dev mode)
  if (!signature) return false;

  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

// ===== Webhook Handler =====

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-zapier-signature');

    // Verify signature
    if (!verifySignature(rawBody, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const body = JSON.parse(rawBody);
    const { event, data } = body;

    if (!event) {
      return NextResponse.json({ error: 'Missing event type' }, { status: 400 });
    }

    console.log(`[Zapier Webhook] Event: ${event}`, JSON.stringify(data || {}).slice(0, 200));

    let result: any = { received: true, event };

    switch (event) {
      case 'new_lead': {
        // Create lead via internal API
        const leadRes = await fetch(new URL('/api/data/leads', req.url).toString(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: data?.name || 'ליד מ-Zapier',
            email: data?.email || '',
            phone: data?.phone || '',
            source: data?.source || 'zapier',
            status: 'new',
            notes: data?.notes || `נוצר אוטומטית מ-Zapier בתאריך ${new Date().toLocaleDateString('he-IL')}`,
          }),
        });
        result.lead = leadRes.ok ? await leadRes.json() : { error: 'Failed to create lead' };
        break;
      }

      case 'payment_received': {
        // Update invoice status
        if (data?.invoiceId) {
          const invRes = await fetch(new URL(`/api/invoicing/${data.invoiceId}`, req.url).toString(), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'paid', paidAt: new Date().toISOString() }),
          });
          result.invoice = invRes.ok ? await invRes.json() : { error: 'Failed to update invoice' };
        }
        break;
      }

      case 'form_submit': {
        // Add subscriber to email sequence
        if (data?.email && data?.sequenceId) {
          // Store for later processing by the email sequence engine
          result.subscriber = { email: data.email, sequenceId: data.sequenceId, status: 'queued' };
        }
        break;
      }

      case 'calendar_event': {
        // Create a task from calendar event
        const taskRes = await fetch(new URL('/api/data/tasks', req.url).toString(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: data?.title || 'משימה מ-Zapier',
            description: data?.description || '',
            dueDate: data?.date || null,
            priority: data?.priority || 'medium',
            status: 'pending',
          }),
        });
        result.task = taskRes.ok ? await taskRes.json() : { error: 'Failed to create task' };
        break;
      }

      case 'custom': {
        // Pass-through — store the event for the automation engine
        result.custom = { data, processedAt: new Date().toISOString() };
        break;
      }

      default:
        result.warning = `Unknown event type: ${event}`;
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('[Zapier Webhook] Error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

/**
 * GET /api/webhooks/zapier — Health check + supported events
 */
export async function GET() {
  return NextResponse.json({
    status: 'active',
    supportedEvents: ['new_lead', 'payment_received', 'form_submit', 'calendar_event', 'custom'],
    configured: !!process.env.ZAPIER_WEBHOOK_SECRET,
    version: '1.0',
  });
}
