import { NextRequest, NextResponse } from "next/server";
import { clientEmailLogs } from "@/lib/db";
import { ensureSeeded } from "@/lib/db/seed";
import { getClientById } from "@/lib/db/client-helpers";
import { sendEmail } from "@/lib/email/email-service";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  ensureSeeded();
  const client = await getClientById(id);
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const body = await req.json();
  const { emailType, subject, recipientEmail, html, text } = body;

  if (!emailType || !subject) {
    return NextResponse.json({ error: "Missing emailType or subject" }, { status: 400 });
  }

  const to = recipientEmail || client.email;
  const now = new Date().toISOString();

  // Send real email via Gmail SMTP
  const result = await sendEmail({
    to,
    subject,
    html: html || undefined,
    text: text || `${subject}\n\nנשלח ללקוח ${client.name || ''} מ-PixelManageAI`,
  });

  // Log the email
  const log = clientEmailLogs.create({
    clientId: client.id,
    emailType,
    subject,
    recipientEmail: to,
    sentAt: now,
    status: result.success ? "sent" : "failed",
    createdAt: now,
  });

  return NextResponse.json({
    success: result.success,
    mock: result.mock || false,
    emailLog: log,
    ...(result.error ? { error: result.error } : {}),
  });
}
