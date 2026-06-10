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

async function apiJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  return (await response.json()) as T;
}

export async function loadBootstrapData(): Promise<BootstrapData> {
  try {
    const [dashboard, leads, reports, settings, csrf] = await Promise.all([
      apiJson<DashboardData>("/api/dashboard"),
      apiJson<{ leads: Lead[] }>("/api/leads"),
      apiJson<{ reports: PropertyReport[] }>("/api/reports"),
      apiJson<{ agent: Agent; integrations: Integration[] }>("/api/settings"),
      apiJson<{ csrfToken: string }>("/api/csrf-token"),
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
    const isLocalPreview = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
    if (!import.meta.env.DEV && !isLocalPreview) {
      window.location.assign(`/login?returnTo=${encodeURIComponent(window.location.pathname)}`);
      throw error;
    }

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
}

export async function createReportApi(input: PropertyReportInput): Promise<PropertyReport> {
  const response = await apiJson<{ report: PropertyReport }>("/api/reports/create", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return response.report;
}

export async function saveSettingsApi(input: Pick<Agent, "fullName" | "email" | "phone">) {
  return apiJson<{ agent: Agent; integrations: Integration[] }>("/api/settings", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function submitSupportRequestApi(input: Pick<SupportRequest, "name" | "category" | "subject" | "message">) {
  return apiJson<{ request: SupportRequest }>("/api/support-requests", {
    method: "POST",
    body: JSON.stringify(input),
  });
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
  window.location.assign(location);
}
