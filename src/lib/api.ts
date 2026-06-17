import { demoAgent, demoDashboard, demoIntegrations, demoLeads, demoReports } from "../data/demo";
import type {
  Agent,
  DashboardData,
  Integration,
  Lead,
  LeadEvent,
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

export async function buildApiHeaders(): Promise<Record<string, string>> {
  return {
    "Content-Type": "application/json",
  };
}

async function apiJson<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(path, {
    credentials: "same-origin",
    headers: {
      ...(await buildApiHeaders()),
      ...(init.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    let msg = `${response.status} ${response.statusText}`;
    try {
      const errJson = await response.json();
      if (errJson.error) msg = errJson.error;
    } catch (e) {
      // ignore
    }
    throw new Error(msg);
  }

  return (await response.json()) as T;
}

export async function loadBootstrapData({
  authMode = "demo",
}: {
  authMode?: "demo" | "workos";
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
    throw error;
  }
}

export async function createReportApi(input: PropertyReportInput): Promise<PropertyReport> {
  const response = await apiJson<{ report: PropertyReport }>("/api/reports/create", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return response.report;
}

export async function getReportApi(reportId: string): Promise<PropertyReport> {
  const response = await apiJson<{ report: PropertyReport }>(
    buildReportDetailUrl(reportId),
  );
  return response.report;
}

export async function getSharedReportApi(token: string): Promise<{ report: PropertyReport; agent: Agent }> {
  return apiJson<{ report: PropertyReport; agent: Agent }>(`/api/reports/share/${encodeURIComponent(token)}`);
}

export function buildReportPdfUrl(reportId: string): string {
  return `/api/reports/${encodeURIComponent(reportId)}/pdf`;
}

export function buildReportDetailUrl(reportId: string): string {
  return `/api/reports/${encodeURIComponent(reportId)}`;
}

export function buildSharedReportUrl(token: string): string {
  return `/reports/share/${encodeURIComponent(token)}`;
}

export function buildSharedReportPdfUrl(token: string): string {
  return `/api/reports/share/${encodeURIComponent(token)}/pdf`;
}

export async function saveSettingsApi(
  input: Omit<Agent, "id" | "workosUserId" | "plan" | "avatarInitials" | "ingestionAddress">,
) {
  return apiJson<{ agent: Agent; integrations: Integration[] }>("/api/settings", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function submitSupportRequestApi(
  input: Pick<SupportRequest, "name" | "category" | "subject" | "message">,
) {
  return apiJson<{ request: SupportRequest }>("/api/support-requests", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function connectIntegrationApi(
  id: string,
  name: string,
  description: string,
): Promise<{ integrations: Integration[] }> {
  return apiJson<{ integrations: Integration[] }>("/api/integrations/connect", {
    method: "POST",
    body: JSON.stringify({ id, name, description }),
  });
}

export async function disconnectIntegrationApi(
  id: string,
): Promise<{ integrations: Integration[] }> {
  return apiJson<{ integrations: Integration[] }>("/api/integrations/disconnect", {
    method: "POST",
    body: JSON.stringify({ id }),
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
  const browser = globalThis as typeof globalThis & {
    location?: { assign(url: string): void };
  };
  browser.location?.assign(location);
}

export async function submitLeadInquiryApi(
  shareToken: string,
  input: { name: string; email: string; phone: string; message: string; preferredChannel?: string }
): Promise<{ success: boolean; lead: Lead }> {
  return apiJson<{ success: boolean; lead: Lead }>(`/api/reports/share/${encodeURIComponent(shareToken)}/inquiry`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function createLeadApi(
  input: {
    name: string;
    email: string;
    phone: string;
    source: string;
    propertyInterest: string;
    budget: string;
    message?: string;
    preferredChannel?: string;
  },
): Promise<{ success: boolean; lead: Lead }> {
  return apiJson<{ success: boolean; lead: Lead }>("/api/leads/create", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateLeadStageApi(
  leadId: string,
  stage: string,
): Promise<{ success: boolean }> {
  return apiJson<{ success: boolean }>(`/api/leads/${encodeURIComponent(leadId)}/stage`, {
    method: "POST",
    body: JSON.stringify({ stage }),
  });
}

export async function deleteLeadApi(
  leadId: string,
): Promise<{ success: boolean }> {
  return apiJson<{ success: boolean }>(`/api/leads/${encodeURIComponent(leadId)}`, {
    method: "DELETE",
  });
}

export async function getLeadEventsApi(leadId: string): Promise<LeadEvent[]> {
  const result = await apiJson<{ events: LeadEvent[] }>(`/api/leads/${leadId}/events`);
  return result.events;
}

export async function sendLeadMessageApi(leadId: string, text: string): Promise<{ success: boolean; error?: string }> {
  return await apiJson<{ success: boolean; error?: string }>(`/api/leads/${leadId}/message`, {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}

export async function sendReportApi(
  reportId: string,
  leadId: string,
): Promise<{ success: boolean; message?: string }> {
  return apiJson<{ success: boolean; message?: string }>("/api/send-report", {
    method: "POST",
    body: JSON.stringify({ reportId, leadId }),
  });
}
