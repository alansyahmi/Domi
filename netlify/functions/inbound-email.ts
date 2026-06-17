import type { Config } from "@netlify/functions";
import { getRuntimeEnv } from "../../src/server/runtime-env";
import { createSignatisDb, createLead, getAgentByIngestionAddress } from "../../src/server/db";
import { extractEmailAddress, type InboundEmail } from "../../src/server/lead-email-parser";
import { parseEmailForLead } from "../../src/server/emailParser";
import { notifyAgentNewLead } from "../../src/server/notifications";

function json(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
}

/**
 * Normalise the many shapes inbound-mail providers POST in.
 * Supports Mailgun (multipart/url-encoded), Postmark/SendGrid (JSON) and a
 * generic `{ to, from, subject, text, html }` JSON payload.
 */
async function readInboundEmail(req: Request): Promise<InboundEmail | null> {
  const contentType = req.headers.get("content-type") ?? "";

  const pick = (obj: Record<string, unknown>, ...keys: string[]): string => {
    for (const key of keys) {
      const value = obj[key];
      if (typeof value === "string" && value.trim()) return value;
    }
    return "";
  };

  let raw: Record<string, unknown> = {};
  if (contentType.includes("application/json")) {
    raw = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  } else if (contentType.includes("form")) {
    const form = await req.formData();
    raw = Object.fromEntries(Array.from(form.entries()).map(([k, v]) => [k, typeof v === "string" ? v : ""]));
  } else {
    return null;
  }

  const to = pick(raw, "to", "To", "recipient", "Recipient");
  const from = pick(raw, "from", "From", "sender", "Sender");
  if (!to) return null;

  return {
    to,
    from,
    subject: pick(raw, "subject", "Subject"),
    text: pick(raw, "text", "TextBody", "body-plain", "BodyPlain", "stripped-text"),
    html: pick(raw, "html", "HtmlBody", "body-html", "BodyHtml", "stripped-html"),
  };
}

export default async (req: Request) => {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed." }, { status: 405 });
  }

  const env = getRuntimeEnv();

  // Optional shared-secret gate so randoms can't POST fake leads.
  // Provider is configured to call /inbound-email?token=<INBOUND_WEBHOOK_SECRET>.
  if (env.INBOUND_WEBHOOK_SECRET) {
    const token = new URL(req.url).searchParams.get("token");
    if (token !== env.INBOUND_WEBHOOK_SECRET) {
      return json({ error: "Unauthorized." }, { status: 401 });
    }
  }

  const email = await readInboundEmail(req);
  if (!email) {
    return json({ error: "Unrecognized payload." }, { status: 400 });
  }

  const ingestionAddress = extractEmailAddress(email.to);
  if (!ingestionAddress) {
    return json({ error: "No recipient address." }, { status: 400 });
  }

  const db = createSignatisDb(env);
  const agent = await getAgentByIngestionAddress(db, ingestionAddress);
  if (!agent) {
    // Unknown inbox — ack with 200 so the provider does not retry forever.
    console.warn(`[Inbound] No agent for ingestion address ${ingestionAddress}`);
    return json({ skipped: "unknown_recipient" });
  }

  let parsed;
  try {
    const rawBody = (email.text && email.text.trim() ? email.text : email.html ?? "").trim();
    parsed = await parseEmailForLead(`From: ${email.from}\nSubject: ${email.subject}\n\n${rawBody}`);
  } catch (error) {
    console.warn(`[Inbound] LLM parsing failed for ${ingestionAddress} (subject: ${email.subject})`, error);
    return json({ error: "Failed to parse email with LLM", details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }

  if (!parsed || !parsed.email) {
    console.warn(`[Inbound] LLM couldn't find contact info for ${ingestionAddress} (subject: ${email.subject})`);
    return json({ skipped: "unparseable" });
  }

  const lead = await createLead(db, agent.id, {
    name: parsed.name,
    email: parsed.email || "unknown@unknown.com",
    phone: parsed.phone || "N/A",
    source: parsed.source,
    propertyInterest: parsed.propertyInterest,
    budget: parsed.budget,
    message: parsed.inquiryMessage,
  });

  notifyAgentNewLead(agent, lead, {
    eventLabel: `New lead from ${lead.source} (forwarded email)`,
    prospectMessage: parsed.inquiryMessage,
  }).catch((err) => console.error("[Inbound] Notify failed:", err));

  return json({ success: true, leadId: lead.id });
};

export const config: Config = {
  path: "/inbound-email",
};
