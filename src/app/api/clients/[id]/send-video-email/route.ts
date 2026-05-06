/**
 * POST /api/clients/[id]/send-video-email
 * Send one or more videos to a client by email.
 * Updates each project's status to 'sent_to_client', logs the email, and creates an activity entry.
 */

import { NextRequest, NextResponse } from 'next/server';
import { projects, clientEmailLogs, activities } from '@/lib/db';
import { ensureSeeded } from '@/lib/db/seed';
import { getClientById } from '@/lib/db/client-helpers';
import { sendEmail } from '@/lib/email/email-service';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  ensureSeeded();

  try {
    const { id } = await context.params;
    const client = await getClientById(id);
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const body = await req.json();
    const {
      projectIds,
      recipientEmail,
      subject,
      bodyText,
    }: {
      projectIds: string[];
      recipientEmail: string;
      subject: string;
      bodyText: string;
    } = body;

    if (!projectIds || projectIds.length === 0) {
      return NextResponse.json({ error: 'Missing projectIds' }, { status: 400 });
    }
    if (!subject) {
      return NextResponse.json({ error: 'Missing subject' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const email = recipientEmail || client.email;
    const updatedProjects: string[] = [];
    const failedProjects: string[] = [];

    // Update each project status
    for (const pid of projectIds) {
      try {
        const project = projects.getById(pid);
        if (!project) {
          failedProjects.push(pid);
          continue;
        }
        if (project.clientId !== id) {
          failedProjects.push(pid);
          continue;
        }

        projects.update(pid, {
          ...project,
          status: 'sent_to_client',
          sentToClientAt: now,
          sentToClientEmail: email,
          updatedAt: now,
        });
        updatedProjects.push(pid);
      } catch (err) {
        console.error(`[SendVideoEmail] Failed to update project ${pid}:`, err);
        failedProjects.push(pid);
      }
    }

    // Build video links HTML
    const videoLinks = updatedProjects.map(pid => {
      const p = projects.getById(pid);
      const videoUrl = (p as any)?.videoUrl || (p as any)?.video_url || '';
      return `<li style="margin-bottom: 8px;"><strong>${p?.name || pid}</strong>${videoUrl ? ` — <a href="${videoUrl}" style="color: #2563eb;">צפה בסרטון</a>` : ''}</li>`;
    }).join('');

    const htmlBody = `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; padding: 20px; margin: 0;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
    <div style="background: linear-gradient(135deg, #7c3aed, #2563eb); padding: 24px 32px; color: white;">
      <div style="font-size: 20px; font-weight: 700;">🎬 סרטונים מוכנים!</div>
    </div>
    <div style="padding: 32px;">
      <p style="font-size: 15px; color: #334155;">שלום ${client.name || ''},</p>
      <p style="font-size: 15px; color: #334155;">${bodyText || `הסרטונים שלך מוכנים לצפייה.`}</p>
      <ul style="padding-right: 20px; margin: 16px 0;">${videoLinks}</ul>
    </div>
    <div style="background: #f8fafc; padding: 16px 32px; border-top: 1px solid #e2e8f0;">
      <div style="font-size: 12px; color: #94a3b8; text-align: center;">נשלח באמצעות PixelManageAI · סטודיו פיקסל</div>
    </div>
  </div>
</body>
</html>`;

    // Send real email
    const emailResult = await sendEmail({ to: email, subject, html: htmlBody });

    // Log the email
    const emailLog = clientEmailLogs.create({
      clientId: id,
      emailType: 'video_send',
      subject,
      recipientEmail: email,
      sentAt: now,
      status: emailResult.success ? 'sent' : 'failed',
      createdAt: now,
    } as any);

    // Create activity entry
    const videoNames = updatedProjects.map(pid => {
      const p = projects.getById(pid);
      return p?.name || pid;
    });

    activities.create({
      type: 'project',
      icon: '🎬',
      title: updatedProjects.length === 1
        ? `סרטון נשלח ללקוח: ${videoNames[0]}`
        : `${updatedProjects.length} סרטונים נשלחו ללקוח`,
      description: `נשלח ל-${email} | נושא: ${subject}${updatedProjects.length > 1 ? ` | סרטונים: ${videoNames.join(', ')}` : ''}`,
      entityId: id,
      userId: null,
      createdAt: now,
    } as any);

    console.log(`[SendVideoEmail] Sent ${updatedProjects.length} videos to ${email} for client ${id}`);

    return NextResponse.json({
      success: true,
      sent: updatedProjects.length,
      failed: failedProjects.length,
      emailLog,
      updatedProjects,
      failedProjects,
    });
  } catch (error) {
    console.error('[SendVideoEmail] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to send video email', details: errorMessage },
      { status: 500 }
    );
  }
}
