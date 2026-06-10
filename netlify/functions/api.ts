import type { Config } from "@netlify/functions";
import { WorkOS } from "@workos-inc/node";
import { createCsrfToken, requireSession } from "../../src/server/auth";
import {
  createDomiDb,
  createReport,
  createSupportRequest,
  ensureAgentWorkspace,
  getDashboardData,
  getIntegrations,
  getLeads,
  getReports,
  updateAgentSettings,
} from "../../src/server/db";
import { validateReportInput } from "../../src/domain/reports";
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

function getWorkos() {
  if (!process.env.WORKOS_API_KEY || !process.env.WORKOS_CLIENT_ID) {
    return null;
  }

  return new WorkOS(process.env.WORKOS_API_KEY, {
    clientId: process.env.WORKOS_CLIENT_ID,
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
      db: ReturnType<typeof createDomiDb>;
      responseHeaders: Headers;
    }
  | { ok: false; response: Response }
> {
  const responseHeaders = new Headers();
  const session = await requireSession({
    cookieHeader: req.headers.get("cookie"),
    workos: getWorkos(),
    env: process.env,
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

  const db = createDomiDb(process.env);
  const agent = await ensureAgentWorkspace(db, session.user);

  return {
    ok: true,
    agent,
    db,
    responseHeaders,
  };
}

export default async (req: Request) => {
  const endpoint = getEndpoint(req);

  if (endpoint === "csrf-token") {
    if (!process.env.CSRF_SECRET) {
      return json({ error: "CSRF_SECRET is not configured." }, { status: 500 });
    }
    return json({ csrfToken: createCsrfToken(process.env.CSRF_SECRET) });
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

    if (endpoint === "reports" && req.method === "GET") {
      return json({ reports: await getReports(db, agent.id) }, { headers: responseHeaders });
    }

    if (endpoint === "reports/create" && req.method === "POST") {
      const input = await readJson<PropertyReportInput>(req);
      const validation = validateReportInput(input);
      if (!validation.valid) {
        return json({ errors: validation.errors }, { status: 422, headers: responseHeaders });
      }
      return json({ report: await createReport(db, agent.id, input) }, { status: 201, headers: responseHeaders });
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
      const body = await readJson<Pick<Agent, "fullName" | "email" | "phone">>(req);
      return json(
        {
          agent: await updateAgentSettings(db, agent.id, {
            fullName: body.fullName?.trim() || agent.fullName,
            email: body.email?.trim() || agent.email,
            phone: body.phone?.trim() || agent.phone,
          }),
          integrations: await getIntegrations(db, agent.id),
        },
        { headers: responseHeaders },
      );
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
