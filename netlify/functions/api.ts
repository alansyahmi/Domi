import type { Config } from "@netlify/functions";
import { WorkOS } from "@workos-inc/node";
import { createCsrfToken, requireSession, verifyWorkosToken, type SessionResult } from "../../src/server/auth";
import {
  createSignatisDb,
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
} from "../../src/server/db";
import { getRuntimeEnv } from "../../src/server/runtime-env";
import { validateReportInput } from "../../src/domain/reports";
import { generatePropertyReport } from "../../src/server/report-pipeline";
import { generateReportPdf } from "../../src/server/report-pdf";
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
  return new Response(data, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}

function getWorkos() {
  const runtimeEnv = getRuntimeEnv();
  if (!runtimeEnv.WORKOS_API_KEY || !runtimeEnv.WORKOS_CLIENT_ID) {
    return null;
  }

  return new WorkOS(runtimeEnv.WORKOS_API_KEY, {
    clientId: runtimeEnv.WORKOS_CLIENT_ID,
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
      db: ReturnType<typeof createSignatisDb>;
      responseHeaders: Headers;
    }
  | { ok: false; response: Response }
> {
  const runtimeEnv = getRuntimeEnv();
  const responseHeaders = new Headers();
  const authHeader = req.headers.get("Authorization");
  const workos = getWorkos();

  let session: SessionResult | null = null;

  if (authHeader && authHeader.startsWith("Bearer ") && workos) {
    const token = authHeader.substring(7);
    try {
      const verifiedUser = await verifyWorkosToken(token, workos, runtimeEnv.WORKOS_CLIENT_ID ?? "");
      session = {
        authenticated: true,
        user: verifiedUser,
      };
    } catch (error) {
      console.error("Bearer token verification failed:", error);
    }
  }

  if (!session || !session.authenticated) {
    session = await requireSession({
      cookieHeader: req.headers.get("cookie"),
      workos,
      env: runtimeEnv,
    });
  }

  if (!session.authenticated) {
    return {
      ok: false,
      response: json({ error: session.reason }, { status: session.status }),
    };
  }

  if (session.setCookie) {
    responseHeaders.append("Set-Cookie", session.setCookie);
  }

  const db = createSignatisDb(runtimeEnv);

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
      } else if (workos) {
        const workosUser = await workos.userManagement.getUser(sessionUser.id);
        sessionUser = {
          id: workosUser.id,
          email: workosUser.email,
          firstName: workosUser.firstName,
          lastName: workosUser.lastName,
        };
      }
    } catch (dbOrWorkosError) {
      console.error("Error retrieving user details:", dbOrWorkosError);
      sessionUser = {
        id: sessionUser.id,
        email: "agent@signatis.app",
        firstName: "Signatis",
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
    return json({ csrfToken: createCsrfToken(runtimeEnv.CSRF_SECRET) });
  }

  const shareInquiryMatch = endpoint.match(/^reports\/share\/([^/]+)\/inquiry$/);
  if (shareInquiryMatch && req.method === "POST") {
    const runtimeEnv = getRuntimeEnv();
    const db = createSignatisDb(runtimeEnv);
    const report = await getReportByShareToken(db, shareInquiryMatch[1]);
    if (!report) {
      return json({ error: "Shared report not found." }, { status: 404 });
    }
    const body = await readJson<{ name?: string; email?: string; phone?: string; message?: string }>(req);
    if (!body.name || !body.email || !body.phone) {
      return json({ error: "Name, email, and phone are required." }, { status: 422 });
    }

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
    });

    return json({ success: true, lead });
  }

  if (shareMatch && req.method === "GET") {
    const runtimeEnv = getRuntimeEnv();
    const db = createSignatisDb(runtimeEnv);
    const report = await getReportByShareToken(db, shareMatch[1]);
    if (!report) {
      return json({ error: "Shared report not found." }, { status: 404 });
    }
    const agent = await getAgentById(db, report.agentId);
    if (!agent) {
      return json({ error: "Report agent not found." }, { status: 404 });
    }

    if (shareMatch[2] === "pdf") {
      return pdf(generateReportPdf(report, agent), `${report.propertyKey || report.id}.pdf`);
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
      }>(req);
      if (!body.name || !body.email || !body.phone) {
        return json({ error: "Name, email, and phone are required." }, { status: 422, headers: responseHeaders });
      }
      const lead = await createLead(db, agent.id, {
        name: body.name.trim(),
        email: body.email.trim(),
        phone: body.phone.trim(),
        source: body.source?.trim() || "Manual Add",
        propertyInterest: body.propertyInterest?.trim() || "General Interest",
        budget: body.budget?.trim() || "TBD",
        message: body.message,
      });
      return json({ success: true, lead }, { status: 201, headers: responseHeaders });
    }

    const leadDeleteMatch = endpoint.match(/^leads\/([^/]+)$/);
    if (leadDeleteMatch && req.method === "DELETE") {
      await deleteLead(db, agent.id, leadDeleteMatch[1]);
      return json({ success: true }, { headers: responseHeaders });
    }

    const leadEventsMatch = endpoint.match(/^leads\/([^/]+)\/events$/);
    if (leadEventsMatch && req.method === "GET") {
      const events = await getLeadEvents(db, agent.id, leadEventsMatch[1]);
      return json({ events }, { headers: responseHeaders });
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
      const pdfResponse = pdf(generateReportPdf(report, agent), `${report.propertyKey || report.id}.pdf`);
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
