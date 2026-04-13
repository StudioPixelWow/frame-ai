import { NextRequest, NextResponse } from "next/server";
import { clients, clientEmailLogs } from "@/lib/db";
import { ensureSeeded } from "@/lib/db/seed";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  ensureSeeded();
  const client = clients.getById(id);
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const body = await req.json();
  const { emailType, subject, recipientEmail } = body;

  if (!emailType || !subject) {
    return NextResponse.json({ error: "Missing emailType or subject" }, { status: 400 });
  }

  // Log the email (in production, this would send via SMTP/SendGrid/etc.)
  const now = new Date().toISOString();
  const log = clientEmailLogs.create({
    clientId: client.id,
    emailType: emailType,
    subject: subject,
    recipientEmail: recipientEmail || client.email,
    sentAt: now,
    status: "sent", // Mock: always succeeds
    createdAt: now,
  });

  return NextResponse.json({ success: true, emailLog: log });
}
