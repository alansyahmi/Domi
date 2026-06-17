import { getRuntimeEnv } from "../runtime-env";
import { sendWhatsAppMessage, type WhatsAppCredentials } from "./whatsapp";
import { sendEmail, buildLeadNotificationHtml } from "./email";
import type { Agent, Lead } from "../../types";

export interface NotificationContext {
  /** Human-readable event description, e.g. "New lead from Report Shared Link" */
  eventLabel: string;
  /** The report or valuation URL the lead came from */
  assetUrl?: string;
  /** Free-text message from the prospect, if any */
  prospectMessage?: string;
}

/**
 * Notify an agent about a new lead capture.
 *
 * Priority order:
 * 1. WhatsApp (if the agent has connected WhatsApp Business)
 * 2. Email (always sent as fallback)
 *
 * Logs errors but never throws — the lead capture should succeed
 * regardless of whether notification delivery fails.
 */
export async function notifyAgentNewLead(
  agent: Pick<Agent, "id" | "fullName" | "email" | "phone" | "whatsappNumber">,
  lead: Pick<Lead, "name" | "source" | "propertyInterest" | "budget" | "preferredChannel">,
  context: NotificationContext,
): Promise<void> {
  const env = getRuntimeEnv();

  // --- Try WhatsApp first ---
  const whatsappCreds = getWhatsAppCredentials(env);
  if (whatsappCreds && agent.whatsappNumber) {
    const waMessage = buildWhatsAppAlert(agent, lead, context);
    const result = await sendWhatsAppMessage(whatsappCreds, agent.whatsappNumber, waMessage);
    if (result.success) {
      console.log(`[Notify] WhatsApp sent to ${agent.fullName} for lead ${lead.name}`);
      return; // WhatsApp succeeded — skip email
    }
    console.warn("[Notify] WhatsApp failed, falling back to email:", result.error);
  }

  // --- Fallback to email ---
  if (env.RESEND_API_KEY) {
    const html = buildLeadNotificationHtml({
      agentName: agent.fullName,
      prospectName: lead.name,
      source: lead.source,
      propertyInterest: lead.propertyInterest,
      budget: lead.budget,
      preferredChannel: lead.preferredChannel,
      message: context.prospectMessage,
    });

    const result = await sendEmail(env.RESEND_API_KEY, {
      from: env.RESEND_FROM_EMAIL || "Signatis <reports@signatis.app>",
      to: agent.email,
      subject: `🔔 New Lead: ${lead.name} — ${lead.propertyInterest}`,
      html,
    });

    if (result.success) {
      console.log(`[Notify] Email sent to ${agent.email} for lead ${lead.name}`);
    } else {
      console.error("[Notify] Email also failed:", result.error);
    }
  } else {
    console.warn("[Notify] No RESEND_API_KEY configured — unable to send email notification.");
  }
}

/**
 * Build a concise WhatsApp alert message for the agent.
 * Kept short since WhatsApp has no rich formatting in text mode.
 */
function buildWhatsAppAlert(
  agent: Pick<Agent, "fullName">,
  lead: Pick<Lead, "name" | "source" | "propertyInterest" | "budget" | "preferredChannel">,
  context: NotificationContext,
): string {
  const lines = [
    `🔔 New Lead: ${lead.name}`,
    `Source: ${lead.source}`,
    `Property: ${lead.propertyInterest}`,
    `Budget: ${lead.budget}`,
    `Contact via: ${lead.preferredChannel}`,
  ];

  if (context.prospectMessage) {
    lines.push(`Message: ${context.prospectMessage.slice(0, 200)}`);
  }

  if (context.assetUrl) {
    lines.push(`Report: ${context.assetUrl}`);
  }

  return lines.join("\n");
}

/**
 * Retrieve WhatsApp credentials from runtime environment variables.
 * In production these would come from the agent_credentials table;
 * for now they are set globally via env vars.
 *
 * Returns null if credentials are not configured.
 */
function getWhatsAppCredentials(env: Record<string, string | undefined>): WhatsAppCredentials | null {
  const phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    return null;
  }

  return { phoneNumberId, accessToken };
}
