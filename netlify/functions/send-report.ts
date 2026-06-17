import type { Config, Context } from "@netlify/functions";
import { getRuntimeEnv } from "../../src/server/runtime-env";
import { createSignatisDb } from "../../src/server/db";
import { buildReportDeliveryHtml, sendEmail } from "../../src/server/notifications/email";

export default async function handler(request: Request, context: Context) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const env = getRuntimeEnv();

  let body: Record<string, any>;
  try {
    body = (await request.json()) as Record<string, any>;
  } catch (e) {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
  }

  const { leadId, reportId } = body;
  if (!leadId || !reportId) {
    return new Response(JSON.stringify({ error: "Missing leadId or reportId" }), { status: 400 });
  }

  try {
    const db = createSignatisDb(env);

    // 1. Fetch Lead
    const leadResult = await db.execute({
      sql: "SELECT * FROM leads WHERE id = ? LIMIT 1",
      args: [leadId],
    });
    const leadRow = leadResult.rows[0] as Record<string, any> | undefined;
    if (!leadRow) {
      return new Response(JSON.stringify({ error: "Lead not found" }), { status: 404 });
    }

    // 2. Fetch Report
    const reportResult = await db.execute({
      sql: "SELECT * FROM property_reports WHERE id = ? LIMIT 1",
      args: [reportId],
    });
    const reportRow = reportResult.rows[0] as Record<string, any> | undefined;
    if (!reportRow) {
      return new Response(JSON.stringify({ error: "Report not found" }), { status: 404 });
    }

    if (!env.RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY is not configured on the server." }), { status: 500 });
    }

    const host = new URL(request.url).origin;
    const shareUrl = `${host}/reports/share/${reportRow.share_token}`;
    const trackedShareUrl = `${host}/t/c/${leadId}?u=${encodeURIComponent(shareUrl)}`;
    const pixelUrl = `${host}/t/o/${leadId}`;

    const html = buildReportDeliveryHtml({
      prospectName: leadRow.name,
      propertyName: reportRow.property_name,
      shareUrl,
      trackedShareUrl,
      pixelUrl,
    });

    const result = await sendEmail(env.RESEND_API_KEY, {
      from: env.RESEND_FROM_EMAIL || "Signatis <reports@signatis.app>",
      to: leadRow.email,
      subject: `Your Property Report: ${reportRow.property_name}`,
      html,
    });

    if (!result.success) {
      return new Response(JSON.stringify({ error: result.error || "Failed to send email via Resend" }), { status: 500 });
    }

    return new Response(JSON.stringify({ success: true, message: "Email sent" }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    console.error("Send Report Error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), { status: 500 });
  }
}

export const config: Config = {
  path: "/api/send-report",
};
