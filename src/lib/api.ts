import { demoAgent, demoDashboard, demoIntegrations, demoLeads, demoReports } from "../data/demo";
import type {
  Agent,
  Conversation,
  DashboardData,
  Integration,
  Lead,
  LeadEvent,
  LeadIntelligence,
  Listing,
  Message,
  PropertyReport,
  PropertyReportInput,
  SupportRequest,
} from "../types";

export interface OmniboxData {
  listings: Listing[];
  conversations: Conversation[];
  intelligence: LeadIntelligence[];
}

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
      const errJson = (await response.json()) as { error?: string };
      // Preserve the status code prefix so the UI can detect auth errors
      if (errJson.error) msg = `[${response.status}] ${errJson.error}`;
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

export async function deleteLeadApi(leadId: string): Promise<{ success: boolean }> {
  return await apiJson<{ success: boolean }>(`/api/leads/${leadId}`, {
    method: "DELETE",
  });
}

export async function injectDemoLeadApi(): Promise<{ success: boolean; lead: Lead }> {
  return await apiJson<{ success: boolean; lead: Lead }>("/api/leads/demo-inject", {
    method: "POST",
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

// ── Omnibox (Omni-Inbox) ──────────────────────────────────────────────────
export async function getOmniboxApi(): Promise<OmniboxData> {
  return await apiJson<OmniboxData>("/api/omnibox");
}

export async function seedOmniboxApi(): Promise<OmniboxData & { seeded: boolean; leads: Lead[] }> {
  return await apiJson<OmniboxData & { seeded: boolean; leads: Lead[] }>("/api/omnibox/seed", {
    method: "POST",
  });
}

export async function getConversationMessagesApi(conversationId: string): Promise<Message[]> {
  const result = await apiJson<{ messages: Message[] }>(`/api/conversations/${encodeURIComponent(conversationId)}/messages`);
  return result.messages;
}

export async function markConversationReadApi(conversationId: string): Promise<{ success: boolean }> {
  return await apiJson<{ success: boolean }>(`/api/conversations/${encodeURIComponent(conversationId)}/read`, {
    method: "POST",
  });
}

export async function assignLeadListingApi(leadId: string, listingId: string | null): Promise<{ success: boolean }> {
  return await apiJson<{ success: boolean }>(`/api/leads/${encodeURIComponent(leadId)}/listing`, {
    method: "PATCH",
    body: JSON.stringify({ listingId }),
  });
}

export async function saveWhatsAppCredentialsApi(
  phoneNumberId: string,
  accessToken: string
): Promise<{ success: boolean }> {
  return await apiJson<{ success: boolean }>(`/api/settings/whatsapp`, {
    method: "POST",
    body: JSON.stringify({ phoneNumberId, accessToken }),
  });
}

export async function deleteWhatsAppCredentialsApi(): Promise<{ success: boolean }> {
  return await apiJson<{ success: boolean }>(`/api/settings/whatsapp`, {
    method: "DELETE",
  });
}

export async function setLeadTelegramChatIdApi(
  leadId: string,
  chatId: string,
): Promise<{ success: boolean; error?: string }> {
  return await apiJson<{ success: boolean; error?: string }>(`/api/leads/${leadId}/telegram-chat-id`, {
    method: "PATCH",
    body: JSON.stringify({ chatId }),
  });
}

export async function connectTelegramApi(
  botToken: string,
): Promise<{ success: boolean; botName?: string; error?: string }> {
  return await apiJson<{ success: boolean; botName?: string; error?: string }>(`/api/integrations/telegram/connect`, {
    method: "POST",
    body: JSON.stringify({ botToken }),
  });
}

export async function disconnectTelegramApi(): Promise<{ success: boolean }> {
  return await apiJson<{ success: boolean }>(`/api/integrations/telegram/disconnect`, {
    method: "POST",
  });
}

export async function testTelegramApi(chatId: string): Promise<{ success: boolean; error?: string }> {
  return await apiJson<{ success: boolean; error?: string }>(`/api/integrations/telegram/test`, {
    method: "POST",
    body: JSON.stringify({ chatId }),
  });
}

export async function getTelegramStatusApi(): Promise<{ connected: boolean; botName?: string }> {
  return await apiJson<{ connected: boolean; botName?: string }>(`/api/integrations/telegram/status`);
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

export async function deletePropertyCacheApi(
  propertyKey: string,
  propertyName: string,
): Promise<{ success: boolean }> {
  return await apiJson<{ success: boolean }>("/api/properties/delete-cache", {
    method: "POST",
    body: JSON.stringify({ propertyKey, propertyName }),
  });
}

