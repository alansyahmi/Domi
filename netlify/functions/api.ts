import type { Config } from "@netlify/functions";
import { createCsrfToken, requireSession, type SessionResult } from "../../src/server/auth";
import {
  createReAIDb,
  createSupportRequest,
  ensureAgentWorkspace,
  getAgentById,
  getDashboardData,
  getIntegrations,
  getLeads,
  getReportById,
  getReportByShareToken,
  getReports,
  updateAgentSettings,
  connectIntegration,
  disconnectIntegration,
  createLead,
  deleteLead,
  getLeadEvents,
  updateLeadStage,
  setLeadTelegramChatId,
  getCredentials,
  saveCredentials,
  deleteCredentials,
} from "../../src/server/db";
import { getRuntimeEnv } from "../../src/server/runtime-env";
import { validateReportInput } from "../../src/domain/reports";
import { generatePropertyReport } from "../../src/server/report-pipeline";
import { generateReportPdf } from "../../src/server/report-pdf";
import { verifyWhatsAppCredentials, sendWhatsAppMessage } from "../../src/server/notifications/whatsapp";
import { sendTelegramMessage, verifyTelegramToken } from "../../src/server/notifications/telegram";
import { notifyAgentNewLead } from "../../src/server/notifications";
import type { Agent, PropertyReportInput } from "../../src/types";

function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  return new Response(JSON.stringify(data), {
    ...init,
    headers,
  });
}

function getEndpoint(req: Request): string {
  const pathname = new URL(req.url).pathname;
  const apiIndex = pathname.indexOf("/api/");
  if (apiIndex >= 0) return pathname.slice(apiIndex + 5).replace(/^\/+/, "");
  return pathname.split("/").filter(Boolean).at(-1) ?? "";
}

function pdf(data: Uint8Array, filename: string): Response {
  return new Response(data as any, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}

async function readJson<T>(req: Request): Promise<T> {
  if (!req.body) return {} as T;
  return (await req.json()) as T;
}

async function authenticatedContext(req: Request): Promise<
  | {
      ok: true;
      agent: Agent;
      db: ReturnType<typeof createReAIDb>;
      responseHeaders: Headers;
    }
  | { ok: false; response: Response }
> {
  const runtimeEnv = getRuntimeEnv();
  const responseHeaders = new Headers();

  const session = await requireSession({
    cookieHeader: req.headers.get("cookie"),
    env: runtimeEnv,
  });

  if (!session.authenticated) {
    return {
      ok: false,
      response: json({ error: session.reason }, { status: session.status }),
    };
  }

  if (session.setCookie) {
    responseHeaders.append("Set-Cookie", session.setCookie);
  }

  const db = createReAIDb(runtimeEnv);
  let sessionUser = session.user;

  if (!sessionUser.email) {
    try {
      const existing = await db.execute<Record<string, unknown>>({
        sql: "SELECT email, full_name FROM agents WHERE workos_user_id = ? LIMIT 1",
        args: [sessionUser.id],
      });
      if (existing.rows[0]) {
        const row = existing.rows[0];
        const fullName = String(row.full_name);
        sessionUser = {
          id: sessionUser.id,
          email: String(row.email),
          firstName: fullName.split(" ")[0],
          lastName: fullName.split(" ").slice(1).join(" ") || null,
        };
      }
    } catch (dbError) {
      console.error("Error retrieving user details:", dbError);
      sessionUser = {
        id: sessionUser.id,
        email: "agent@re-ai.app",
        firstName: "re:AI",
        lastName: "Agent",
      };
    }
  }

  const agent = await ensureAgentWorkspace(db, sessionUser);

  return {
    ok: true,
    agent,
    db,
    responseHeaders,
  };
}

export default async (req: Request) => {
  const endpoint = getEndpoint(req);
  const shareMatch = endpoint.match(/^reports\/share\/([^/]+)(?:\/(pdf))?$/);

  if (endpoint === "csrf-token") {
    const runtimeEnv = getRuntimeEnv();
    if (!runtimeEnv.CSRF_SECRET) {
      return json({ error: "CSRF_SECRET is not configured." }, { status: 500 });
    }
    return json({ csrfToken: await createCsrfToken(runtimeEnv.CSRF_SECRET) });
  }

  const shareInquiryMatch = endpoint.match(/^reports\/share\/([^/]+)\/inquiry$/);
  if (shareInquiryMatch && req.method === "POST") {
    const runtimeEnv = getRuntimeEnv();
    const db = createReAIDb(runtimeEnv);
    const report = await getReportByShareToken(db, shareInquiryMatch[1]);
    if (!report) {
      return json({ error: "Shared report not found." }, { status: 404 });
    }
    const body = await readJson<{ name?: string; email?: string; phone?: string; message?: string; preferredChannel?: string }>(req);
    if (!body.name || !body.email || !body.phone) {
      return json({ error: "Name, email, and phone are required." }, { status: 422 });
    }

    const validChannels = ["whatsapp", "telegram", "messenger", "instagram", "email", "phone"] as const;
    const preferredChannel = body.preferredChannel && validChannels.includes(body.preferredChannel as typeof validChannels[number])
      ? (body.preferredChannel as "whatsapp" | "telegram" | "messenger" | "instagram" | "email" | "phone")
      : "whatsapp";

    const budget = report.inputSnapshot.askingPriceRm > 0
      ? `RM ${report.inputSnapshot.askingPriceRm.toLocaleString("en-MY")}`
      : "TBD";

    const lead = await createLead(db, report.agentId, {
      name: body.name.trim(),
      email: body.email.trim(),
      phone: body.phone.trim(),
      source: "Report Shared Link",
      propertyInterest: report.propertyName || report.address,
      budget,
      message: body.message,
      preferredChannel,
    });

    // Fire-and-forget notification to the agent
    const agent = await getAgentById(db, report.agentId);
    if (agent) {
      notifyAgentNewLead(
        agent,
        lead,
        {
          eventLabel: "New lead from Report Shared Link",
          assetUrl: `https://re-ai.app/reports/share/${report.shareToken}`,
          prospectMessage: body.message,
        },
      ).catch((err) => console.error("[Notify] Failed:", err));
    }

    return json({ success: true, lead });
  }

  if (shareMatch && req.method === "GET") {
    const runtimeEnv = getRuntimeEnv();
    const db = createReAIDb(runtimeEnv);
    const report = await getReportByShareToken(db, shareMatch[1]);
    if (!report) {
      return json({ error: "Shared report not found." }, { status: 404 });
    }
    const agent = await getAgentById(db, report.agentId);
    if (!agent) {
      return json({ error: "Report agent not found." }, { status: 404 });
    }

    if (shareMatch[2] === "pdf") {
      return pdf(await generateReportPdf(report, agent), `${report.propertyKey || report.id}.pdf`);
    }

    return json({ report, agent });
  }

  const context = await authenticatedContext(req);
  if (!context.ok) return context.response;

  const { db, agent, responseHeaders } = context;

  try {
    if (endpoint === "me" && req.method === "GET") {
      return json({ agent }, { headers: responseHeaders });
    }

    if (endpoint === "dashboard" && req.method === "GET") {
      return json(await getDashboardData(db, agent), { headers: responseHeaders });
    }

    if (endpoint === "leads" && req.method === "GET") {
      return json({ leads: await getLeads(db, agent.id) }, { headers: responseHeaders });
    }

    if (endpoint === "leads/create" && req.method === "POST") {
      const body = await readJson<{
        name?: string;
        email?: string;
        phone?: string;
        source?: string;
        propertyInterest?: string;
        budget?: string;
        message?: string;
        preferredChannel?: string;
      }>(req);
      if (!body.name || !body.email || !body.phone) {
        return json({ error: "Name, email, and phone are required." }, { status: 422, headers: responseHeaders });
      }

      const validChannels = ["whatsapp", "telegram", "messenger", "instagram", "email", "phone"] as const;
      const preferredChannel = body.preferredChannel && validChannels.includes(body.preferredChannel as typeof validChannels[number])
        ? (body.preferredChannel as "whatsapp" | "telegram" | "messenger" | "instagram" | "email" | "phone")
        : "whatsapp";

      const lead = await createLead(db, agent.id, {
        name: body.name.trim(),
        email: body.email.trim(),
        phone: body.phone.trim(),
        source: body.source?.trim() || "Manual Add",
        propertyInterest: body.propertyInterest?.trim() || "General Interest",
        budget: body.budget?.trim() || "TBD",
        message: body.message,
        preferredChannel,
      });

      // Fire-and-forget notification to the agent
      notifyAgentNewLead(
        agent,
        lead,
        {
          eventLabel: `New lead from ${lead.source}`,
          prospectMessage: body.message,
        },
      ).catch((err) => console.error("[Notify] Failed:", err));

      return json({ success: true, lead }, { status: 201, headers: responseHeaders });
    }

    if (endpoint === "leads/demo-inject" && req.method === "POST") {
      // Inject a highly realistic Malaysian persona
      const lead = await createLead(db, agent.id, {
        name: "Ahmad Razak",
        email: "ahmad.razak.88@gmail.com",
        phone: "+60123456789",
        source: "PropertyGuru Inquiry",
        propertyInterest: "Residensi Suasana, Damansara Damai",
        budget: "RM 450,000",
        message: "Hi, I saw this listing and I am very interested. Can we schedule a viewing this weekend? I have loan pre-approval ready.",
        preferredChannel: "whatsapp",
      });

      // Boost intent manually for demo effect
      await db.execute({
        sql: "UPDATE leads SET score = 85, intent = 1, tier = 'Hot' WHERE id = ?",
        args: [lead.id],
      });

      return json({ success: true, lead: { ...lead, score: 85, intent: 1, tier: 'Hot' } }, { status: 201, headers: responseHeaders });
    }

    const leadDeleteMatch = endpoint.match(/^leads\/([^/]+)$/);
    if (leadDeleteMatch && req.method === "DELETE") {
      await deleteLead(db, agent.id, leadDeleteMatch[1]);
      return json({ success: true }, { headers: responseHeaders });
    }

    const settingsMatch = endpoint.match(/^settings$/);
    if (settingsMatch && req.method === "POST") {
      const payload = await readJson<Omit<Agent, "id" | "plan" | "workosUserId" | "avatarInitials" | "ingestionAddress">>(req);
      const updated = await updateAgentSettings(db, agent.id, payload);
      return json({ agent: updated }, { headers: responseHeaders });
    }

    const whatsappSettingsMatch = endpoint.match(/^settings\/whatsapp$/);
    if (whatsappSettingsMatch && req.method === "POST") {
      const payload = await readJson<{ phoneNumberId: string; accessToken: string }>(req);
      if (!payload.phoneNumberId || !payload.accessToken) {
        return json({ error: "Missing phoneNumberId or accessToken" }, { status: 400, headers: responseHeaders });
      }
      await saveCredentials(db, agent.id, "whatsapp", payload.accessToken, { phoneNumberId: payload.phoneNumberId });
      return json({ success: true }, { headers: responseHeaders });
    }
    if (whatsappSettingsMatch && req.method === "DELETE") {
      await deleteCredentials(db, agent.id, "whatsapp");
      return json({ success: true }, { headers: responseHeaders });
    }

    const leadEventsMatch = endpoint.match(/^leads\/([^/]+)\/events$/);
    if (leadEventsMatch && req.method === "GET") {
      const events = await getLeadEvents(db, agent.id, leadEventsMatch[1]);
      return json({ events }, { headers: responseHeaders });
    }

    const leadMessageMatch = endpoint.match(/^leads\/([^/]+)\/message$/);
    if (leadMessageMatch && req.method === "POST") {
      const leadId = leadMessageMatch[1];
      const body = await readJson<{ text?: string }>(req);
      if (!body.text?.trim()) {
        return json({ error: "Message text is required." }, { status: 422, headers: responseHeaders });
      }

      const leadsList = await getLeads(db, agent.id);
      const lead = leadsList.find((l) => l.id === leadId);
      if (!lead) {
        return json({ error: "Lead not found." }, { status: 404, headers: responseHeaders });
      }

      // Try Telegram first (if configured and lead has a chat_id)
      const telegramCreds = await getCredentials(db, agent.id, "telegram");
      const whatsappCreds = await getCredentials(db, agent.id, "whatsapp");
      let channel = "simulated";

      if (telegramCreds && lead.telegramChatId) {
        const result = await sendTelegramMessage(telegramCreds.encryptedValue, lead.telegramChatId, body.text);
        if (result.success) {
          channel = "telegram";
          console.log("[Telegram] Message sent successfully.");
        } else {
          console.warn("[Telegram] Failed to send:", result.error);
        }
      } else if (whatsappCreds) {
        const metadata = whatsappCreds.metadata as { phoneNumberId?: string };
        const result = await sendWhatsAppMessage(
          { phoneNumberId: metadata.phoneNumberId ?? "", accessToken: whatsappCreds.encryptedValue },
          lead.phone,
          body.text
        );
        if (result.success) {
          channel = "whatsapp";
          console.log("[WhatsApp] Message sent successfully via Meta API.");
        } else {
          console.warn("[WhatsApp] Failed to send:", result.error);
        }
      } else {
        console.log("[Simulated] Outreach to:", lead.phone, "Msg:", body.text);
      }

      const eventLabel = channel === "telegram"
        ? "Sent Telegram outreach message"
        : channel === "whatsapp"
          ? "Sent WhatsApp outreach message"
          : "Outreach simulated (no messaging channel configured)";

      // Log event
      await db.execute({
        sql: `INSERT INTO lead_events (id, lead_id, agent_id, event_type, event_label, occurred_at) VALUES (?, ?, ?, ?, ?, ?)`,
        args: [
          `event_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
          leadId,
          agent.id,
          channel === "telegram" ? "telegram_outreach" : "whatsapp_outreach",
          eventLabel,
          new Date().toISOString(),
        ],
      });

      // Update stage to contacted if new
      if (lead.stage === "new") {
        await updateLeadStage(db, agent.id, leadId, "contacted");
      }

      return json({ success: true }, { headers: responseHeaders });
    }

    const leadTelegramMatch = endpoint.match(/^leads\/([^/]+)\/telegram-chat-id$/);
    if (leadTelegramMatch && req.method === "PATCH") {
      const body = await readJson<{ chatId?: string }>(req);
      if (body.chatId === undefined) {
        return json({ error: "chatId is required." }, { status: 422, headers: responseHeaders });
      }
      await setLeadTelegramChatId(db, agent.id, leadTelegramMatch[1], body.chatId);
      return json({ success: true }, { headers: responseHeaders });
    }

    const leadStageMatch = endpoint.match(/^leads\/([^/]+)\/stage$/);
    if (leadStageMatch && req.method === "POST") {
      const body = await readJson<{ stage?: string }>(req);
      const validStages = ["new", "contacted", "engaged", "viewing", "negotiating", "closed_won", "closed_lost"] as const;
      if (!body.stage || !validStages.includes(body.stage as typeof validStages[number])) {
        return json({ error: "Invalid stage." }, { status: 422, headers: responseHeaders });
      }
      await updateLeadStage(db, agent.id, leadStageMatch[1], body.stage as "new" | "contacted" | "engaged" | "viewing" | "negotiating" | "closed_won" | "closed_lost");
      return json({ success: true }, { headers: responseHeaders });
    }

    if (endpoint === "reports" && req.method === "GET") {
      return json({ reports: await getReports(db, agent.id) }, { headers: responseHeaders });
    }

    const reportDetailMatch = endpoint.match(/^reports\/([^/]+)$/);
    if (reportDetailMatch && req.method === "GET") {
      const report = await getReportById(db, agent.id, reportDetailMatch[1]);
      if (!report) {
        return json({ error: "Report not found." }, { status: 404, headers: responseHeaders });
      }
      return json({ report }, { headers: responseHeaders });
    }

    const reportPdfMatch = endpoint.match(/^reports\/([^/]+)\/pdf$/);
    if (reportPdfMatch && req.method === "GET") {
      const report = await getReportById(db, agent.id, reportPdfMatch[1]);
      if (!report) {
        return json({ error: "Report not found." }, { status: 404, headers: responseHeaders });
      }
      const pdfResponse = pdf(await generateReportPdf(report, agent), `${report.propertyKey || report.id}.pdf`);
      responseHeaders.forEach((value, key) => pdfResponse.headers.append(key, value));
      return pdfResponse;
    }

    if (endpoint === "reports/create" && req.method === "POST") {
      const input = await readJson<PropertyReportInput>(req);
      const validation = validateReportInput(input);
      if (!validation.valid) {
        return json({ errors: validation.errors }, { status: 422, headers: responseHeaders });
      }
      return json({ report: await generatePropertyReport(db, agent, input) }, { status: 201, headers: responseHeaders });
    }

    if (endpoint === "settings" && req.method === "GET") {
      return json(
        {
          agent,
          integrations: await getIntegrations(db, agent.id),
        },
        { headers: responseHeaders },
      );
    }

    if (endpoint === "settings" && req.method === "POST") {
      const body = await readJson<Omit<Agent, "id" | "workosUserId" | "plan" | "avatarInitials" | "ingestionAddress">>(req);
      return json(
        {
          agent: await updateAgentSettings(db, agent.id, {
            fullName: body.fullName?.trim() || agent.fullName,
            email: body.email?.trim() || agent.email,
            phone: body.phone?.trim() || agent.phone,
            renNumber: body.renNumber?.trim() ?? agent.renNumber ?? "",
            agencyName: body.agencyName?.trim() ?? agent.agencyName ?? "",
            whatsappNumber: body.whatsappNumber?.trim() ?? agent.whatsappNumber ?? "",
            avatarUrl: body.avatarUrl?.trim() ?? agent.avatarUrl ?? "",
            companyLogoUrl: body.companyLogoUrl?.trim() ?? agent.companyLogoUrl ?? "",
            bio: body.bio?.trim() ?? agent.bio ?? "",
          }),
          integrations: await getIntegrations(db, agent.id),
        },
        { headers: responseHeaders },
      );
    }

    if (endpoint === "integrations/connect" && req.method === "POST") {
      const body = await readJson<{ id?: string; name?: string; description?: string }>(req);
      if (!body.id || !body.name) {
        return json({ error: "Missing integration details." }, { status: 422, headers: responseHeaders });
      }
      await connectIntegration(db, agent.id, body.id, body.name, body.description ?? "");
      return json({ integrations: await getIntegrations(db, agent.id) }, { headers: responseHeaders });
    }

    if (endpoint === "integrations/disconnect" && req.method === "POST") {
      const body = await readJson<{ id?: string }>(req);
      if (!body.id) {
        return json({ error: "Missing integration id." }, { status: 422, headers: responseHeaders });
      }
      await disconnectIntegration(db, agent.id, body.id);
      return json({ integrations: await getIntegrations(db, agent.id) }, { headers: responseHeaders });
    }

    // ── WhatsApp Integration ──────────────────────────────────

    if (endpoint === "integrations/whatsapp/status" && req.method === "GET") {
      const creds = await getCredentials(db, agent.id, "whatsapp");
      return json({ connected: creds !== null }, { headers: responseHeaders });
    }

    if (endpoint === "integrations/whatsapp/connect" && req.method === "POST") {
      const body = await readJson<{ phoneNumberId?: string; accessToken?: string }>(req);
      if (!body.phoneNumberId || !body.accessToken) {
        return json({ error: "Phone Number ID and Access Token are required." }, { status: 422, headers: responseHeaders });
      }
      // Validate credentials before saving
      const verifyResult = await verifyWhatsAppCredentials({ phoneNumberId: body.phoneNumberId, accessToken: body.accessToken });
      if (!verifyResult.valid) {
        return json({ error: verifyResult.error ?? "Invalid WhatsApp credentials." }, { status: 400, headers: responseHeaders });
      }
      await saveCredentials(db, agent.id, "whatsapp", body.accessToken, { phoneNumberId: body.phoneNumberId });
      return json({ success: true }, { headers: responseHeaders });
    }

    if (endpoint === "integrations/whatsapp/disconnect" && req.method === "POST") {
      await deleteCredentials(db, agent.id, "whatsapp");
      return json({ success: true }, { headers: responseHeaders });
    }

    if (endpoint === "integrations/whatsapp/test" && req.method === "POST") {
      const creds = await getCredentials(db, agent.id, "whatsapp");
      if (!creds) {
        return json({ error: "WhatsApp not connected." }, { status: 400, headers: responseHeaders });
      }
      const metadata = creds.metadata as { phoneNumberId?: string };
      const result = await sendWhatsAppMessage(
        { phoneNumberId: metadata.phoneNumberId ?? "", accessToken: creds.encryptedValue },
        agent.whatsappNumber || agent.phone,
        "✅ re:AI WhatsApp integration is working! You'll receive lead notifications here.",
      );
      if (!result.success) {
        return json({ error: result.error ?? "Failed to send test message." }, { status: 500, headers: responseHeaders });
      }
      return json({ success: true, messageId: result.messageId }, { headers: responseHeaders });
    }

    // ── Telegram Integration ──────────────────────────────────

    if (endpoint === "integrations/telegram/status" && req.method === "GET") {
      const creds = await getCredentials(db, agent.id, "telegram");
      const metadata = creds?.metadata as { botName?: string } | undefined;
      return json({ connected: creds !== null, botName: metadata?.botName }, { headers: responseHeaders });
    }

    if (endpoint === "integrations/telegram/connect" && req.method === "POST") {
      const body = await readJson<{ botToken?: string }>(req);
      if (!body.botToken?.trim()) {
        return json({ error: "Bot token is required." }, { status: 422, headers: responseHeaders });
      }
      const verifyResult = await verifyTelegramToken(body.botToken);
      if (!verifyResult.valid) {
        return json({ error: verifyResult.error ?? "Invalid bot token." }, { status: 400, headers: responseHeaders });
      }
      await saveCredentials(db, agent.id, "telegram", body.botToken, { botName: verifyResult.botName });
      return json({ success: true, botName: verifyResult.botName }, { headers: responseHeaders });
    }

    if (endpoint === "integrations/telegram/disconnect" && req.method === "POST") {
      await deleteCredentials(db, agent.id, "telegram");
      return json({ success: true }, { headers: responseHeaders });
    }

    if (endpoint === "integrations/telegram/test" && req.method === "POST") {
      const body = await readJson<{ chatId?: string }>(req);
      if (!body.chatId?.trim()) {
        return json({ error: "A chat_id is required for the test." }, { status: 422, headers: responseHeaders });
      }
      const creds = await getCredentials(db, agent.id, "telegram");
      if (!creds) {
        return json({ error: "Telegram bot not connected." }, { status: 400, headers: responseHeaders });
      }
      const result = await sendTelegramMessage(
        creds.encryptedValue,
        body.chatId,
        "✅ re:AI Telegram integration is working! You'll receive lead notifications here.",
      );
      if (!result.success) {
        return json({ error: result.error ?? "Failed to send test message." }, { status: 500, headers: responseHeaders });
      }
      return json({ success: true, messageId: result.messageId }, { headers: responseHeaders });
    }

    if (endpoint === "support-requests" && req.method === "POST") {
      const body = await readJson<{
        name?: string;
        category?: string;
        subject?: string;
        message?: string;
      }>(req);

      if (!body.subject?.trim() || !body.message?.trim()) {
        return json(
          { error: "Subject and message are required." },
          { status: 422, headers: responseHeaders },
        );
      }

      return json(
        {
          request: await createSupportRequest(db, agent.id, {
            name: body.name?.trim() || agent.fullName,
            category: body.category?.trim() || "Technical Issue",
            subject: body.subject.trim(),
            message: body.message.trim(),
          }),
        },
        { status: 201, headers: responseHeaders },
      );
    }

    return json({ error: "Not found." }, { status: 404, headers: responseHeaders });
  } catch (error) {
    return json(
      {
        error: error instanceof Error ? error.message : "Unexpected API error.",
      },
      { status: 500, headers: responseHeaders },
    );
  }
};

export const config: Config = {
  path: "/api/*",
};
