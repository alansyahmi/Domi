import { demoAgent, demoDashboard, demoIntegrations, demoLeads, demoReports } from "../data/demo";
import type {
  Agent,
  DashboardData,
  Integration,
  Lead,
  PropertyReport,
  PropertyReportInput,
  SupportRequest,
} from "../types";

export interface BootstrapData {
  dashboard: DashboardData;
  leads: Lead[];
  reports: PropertyReport[];
  settings: {
    agent: Agent;
    integrations: Integration[];
  };
  csrfToken: string;
  demoMode: boolean;
}

export type AccessTokenProvider = () => Promise<string>;

export async function buildApiHeaders(getAccessToken?: AccessTokenProvider): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (getAccessToken) {
    headers.Authorization = `Bearer ${await getAccessToken()}`;
  }

  return headers;
}

async function apiJson<T>(
  path: string,
  init: RequestInit = {},
  getAccessToken?: AccessTokenProvider,
): Promise<T> {
  const response = await fetch(path, {
    credentials: "same-origin",
    headers: {
      ...(await buildApiHeaders(getAccessToken)),
      ...(init.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  return (await response.json()) as T;
}

export async function loadBootstrapData({
  authMode = "demo",
  getAccessToken,
}: {
  authMode?: "demo" | "workos";
  getAccessToken?: AccessTokenProvider;
} = {}): Promise<BootstrapData> {
  if (authMode === "demo") {
    return {
      dashboard: demoDashboard,
      leads: demoLeads,
      reports: demoReports,
      settings: {
        agent: demoAgent,
        integrations: demoIntegrations,
      },
      csrfToken: "dev-demo-token",
      demoMode: true,
    };
  }

  try {
    const [dashboard, leads, reports, settings, csrf] = await Promise.all([
      apiJson<DashboardData>("/api/dashboard", {}, getAccessToken),
      apiJson<{ leads: Lead[] }>("/api/leads", {}, getAccessToken),
      apiJson<{ reports: PropertyReport[] }>("/api/reports", {}, getAccessToken),
      apiJson<{ agent: Agent; integrations: Integration[] }>("/api/settings", {}, getAccessToken),
      apiJson<{ csrfToken: string }>("/api/csrf-token", {}, getAccessToken),
    ]);

    return {
      dashboard,
      leads: leads.leads,
      reports: reports.reports,
      settings,
      csrfToken: csrf.csrfToken,
      demoMode: false,
    };
  } catch (error) {
    throw error;
  }
}

export async function createReportApi(input: PropertyReportInput, getAccessToken?: AccessTokenProvider): Promise<PropertyReport> {
  const response = await apiJson<{ report: PropertyReport }>("/api/reports/create", {
    method: "POST",
    body: JSON.stringify(input),
  }, getAccessToken);
  return response.report;
}

export async function saveSettingsApi(
  input: Omit<Agent, "id" | "workosUserId" | "plan" | "avatarInitials" | "ingestionAddress">,
  getAccessToken?: AccessTokenProvider,
) {
  return apiJson<{ agent: Agent; integrations: Integration[] }>("/api/settings", {
    method: "POST",
    body: JSON.stringify(input),
  }, getAccessToken);
}

export async function submitSupportRequestApi(
  input: Pick<SupportRequest, "name" | "category" | "subject" | "message">,
  getAccessToken?: AccessTokenProvider,
) {
  return apiJson<{ request: SupportRequest }>("/api/support-requests", {
    method: "POST",
    body: JSON.stringify(input),
  }, getAccessToken);
}

export async function connectIntegrationApi(
  id: string,
  name: string,
  description: string,
  getAccessToken?: AccessTokenProvider,
): Promise<{ integrations: Integration[] }> {
  return apiJson<{ integrations: Integration[] }>("/api/integrations/connect", {
    method: "POST",
    body: JSON.stringify({ id, name, description }),
  }, getAccessToken);
}

export async function disconnectIntegrationApi(
  id: string,
  getAccessToken?: AccessTokenProvider,
): Promise<{ integrations: Integration[] }> {
  return apiJson<{ integrations: Integration[] }>("/api/integrations/disconnect", {
    method: "POST",
    body: JSON.stringify({ id }),
  }, getAccessToken);
}


export async function logoutApi(csrfToken: string): Promise<void> {
  const response = await fetch("/logout", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "x-csrf-token": csrfToken,
    },
    redirect: "manual",
  });

  const location = response.headers.get("Location") || "/login";
  const browser = globalThis as typeof globalThis & {
    location?: { assign(url: string): void };
  };
  browser.location?.assign(location);
}
