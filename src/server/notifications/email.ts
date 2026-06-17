/**
 * Resend email client for transactional email delivery.
 *
 * Used for:
 * - Auto-delivering report PDFs to prospects
 * - Fallback agent notifications when WhatsApp is unavailable
 * - Follow-up nurture sequences
 */

const RESEND_API_BASE = "https://api.resend.com";

export interface EmailAttachment {
  filename: string;
  content: string; // base64-encoded
  contentType?: string;
}

export interface SendEmailInput {
  from?: string;
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
  attachment?: EmailAttachment;
}

export interface SendEmailResult {
  success: boolean;
  id?: string;
  error?: string;
}

/**
 * Send a transactional email via Resend API.
 */
export async function sendEmail(
  apiKey: string,
  input: SendEmailInput,
): Promise<SendEmailResult> {
  const to = Array.isArray(input.to) ? input.to : [input.to];

  try {
    const fromEmail = input.from || process.env.RESEND_FROM_EMAIL || "Signatis <reports@signatis.app>";
    const body: Record<string, unknown> = {
      from: fromEmail,
      to,
      subject: input.subject,
      html: input.html,
    };

    if (input.replyTo) {
      body.reply_to = input.replyTo;
    }

    if (input.attachment) {
      body.attachments = [
        {
          filename: input.attachment.filename,
          content: input.attachment.content,
          content_type: input.attachment.contentType ?? "application/pdf",
        },
      ];
    }

    const response = await fetch(`${RESEND_API_BASE}/emails`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data: unknown = await response.json();

    if (!response.ok) {
      const errorData = data as { message?: string; error?: string };
      const errorMsg = errorData?.message ?? errorData?.error ?? `HTTP ${response.status}`;
      console.error("[Email] Send failed:", errorMsg);
      return { success: false, error: String(errorMsg) };
    }

    const successData = data as { id?: string };
    return {
      success: true,
      id: successData?.id,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Email] Exception:", message);
    return { success: false, error: message };
  }
}

/**
 * Verify that a Resend API key is valid by making a lightweight API call.
 */
export async function verifyEmailApiKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const response = await fetch(`${RESEND_API_BASE}/api-keys`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      return { valid: false, error: `HTTP ${response.status}` };
    }

    return { valid: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { valid: false, error: message };
  }
}

/**
 * Build a lead notification HTML email for the agent.
 */
export function buildLeadNotificationHtml(params: {
  agentName: string;
  prospectName: string;
  source: string;
  propertyInterest: string;
  budget: string;
  preferredChannel: string;
  message?: string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f7f9fb; padding: 2rem;">
  <div style="max-width: 560px; margin: 0 auto; background: white; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden;">
    <div style="background: #041627; padding: 1.5rem 2rem;">
      <h1 style="color: white; margin: 0; font-size: 1.25rem;">🔔 New Lead Captured</h1>
    </div>
    <div style="padding: 2rem;">
      <p style="color: #475569; margin: 0 0 1.5rem;">Hi <strong>${escapeHtml(params.agentName)}</strong>,</p>
      <table style="width: 100%; border-collapse: collapse;">
        <tr><td style="padding: 0.5rem 0; color: #64748b; width: 40%;">Prospect</td><td style="font-weight: 700;">${escapeHtml(params.prospectName)}</td></tr>
        <tr><td style="padding: 0.5rem 0; color: #64748b;">Source</td><td>${escapeHtml(params.source)}</td></tr>
        <tr><td style="padding: 0.5rem 0; color: #64748b;">Property</td><td>${escapeHtml(params.propertyInterest)}</td></tr>
        <tr><td style="padding: 0.5rem 0; color: #64748b;">Budget</td><td>${escapeHtml(params.budget)}</td></tr>
        <tr><td style="padding: 0.5rem 0; color: #64748b;">Prefers</td><td>${escapeHtml(params.preferredChannel)}</td></tr>
      </table>
      ${params.message ? `<div style="margin-top: 1rem; padding: 1rem; background: #f1f5f9; border-radius: 8px;"><p style="margin: 0; color: #475569;"><strong>Message:</strong> ${escapeHtml(params.message)}</p></div>` : ""}
      <a href="https://signatis.app/leads" style="display: inline-block; margin-top: 1.5rem; padding: 0.75rem 2rem; background: #041627; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">View in Signatis</a>
    </div>
  </div>
</body>
</html>`.trim();
}

/**
 * Build a simple HTML email for auto-delivering a report PDF to a prospect.
 */
export function buildReportDeliveryHtml(params: {
  prospectName: string;
  propertyName: string;
  shareUrl: string;
  trackedShareUrl?: string;
  pixelUrl?: string;
}): string {
  const finalUrl = params.trackedShareUrl ?? params.shareUrl;
  const pixelHtml = params.pixelUrl 
    ? `\n  <img src="${escapeHtml(params.pixelUrl)}" width="1" height="1" alt="" style="display:none;" />`
    : "";

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f7f9fb; padding: 2rem;">
  <div style="max-width: 560px; margin: 0 auto; background: white; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden;">
    <div style="background: #041627; padding: 1.5rem 2rem;">
      <h1 style="color: white; margin: 0; font-size: 1.25rem;">Your Property Report</h1>
    </div>
    <div style="padding: 2rem;">
      <p style="color: #475569;">Hi <strong>${escapeHtml(params.prospectName)}</strong>,</p>
      <p style="color: #475569;">Thanks for your interest in <strong>${escapeHtml(params.propertyName)}</strong>. Here's the full market analysis report you requested.</p>
      <a href="${escapeHtml(finalUrl)}" style="display: inline-block; padding: 0.75rem 2rem; background: #041627; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">View Full Report</a>
      <p style="color: #94a3b8; font-size: 0.875rem; margin-top: 1.5rem;">If you have any questions, simply reply to this email or reach out to your agent directly.</p>
    </div>
  </div>${pixelHtml}
</body>
</html>`.trim();
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
