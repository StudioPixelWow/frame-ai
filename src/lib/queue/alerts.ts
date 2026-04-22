/**
 * PixelManageAI — Job Exhaustion Alerts
 *
 * Fires a webhook when a job exhausts all retry attempts.
 * Targets Slack incoming webhooks or any HTTP endpoint.
 *
 * Set ALERT_WEBHOOK_URL in production; alerts are silently
 * skipped when the env var is unset (local dev).
 */

/**
 * Alert that a job has exhausted all retries.
 * Never throws — alert failures are non-critical.
 */
export async function alertJobExhausted(
  jobType: string,
  jobId: string,
  error: string,
  projectId: string,
): Promise<void> {
  const webhookUrl = process.env.ALERT_WEBHOOK_URL;
  if (!webhookUrl) return; // alerts disabled in dev

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: [
          `⚠ *${jobType} job exhausted*`,
          `Job: \`${jobId}\``,
          `Project: \`${projectId}\``,
          `Error: ${error.slice(0, 200)}`,
        ].join("\n"),
      }),
    });
  } catch {
    /* never throw from alert path */
  }
}
