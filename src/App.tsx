import { useEffect, useMemo, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { buildReportDraft, buildReportPropertyKey, normalizeReportInput } from "./domain/reports";
import { computeLeadScore } from "./domain/leadScoring";
import {
  createReportApi,
  loadBootstrapData,
  saveSettingsApi,
  submitSupportRequestApi,
  connectIntegrationApi,
  disconnectIntegrationApi,
  createLeadApi,
  deleteLeadApi,
  getLeadEventsApi,
  updateLeadStageApi,
  sendLeadMessageApi,
  saveWhatsAppCredentialsApi,
  deleteWhatsAppCredentialsApi,
  connectTelegramApi,
  disconnectTelegramApi,
  setLeadTelegramChatIdApi,
  sendReportApi,
  injectDemoLeadApi,
  deletePropertyCacheApi,
  type BootstrapData,
} from "./lib/api";

import Layout from "./components/Layout";
import DashboardPage from "./pages/DashboardPage";
import OmniboxPage from "./pages/OmniboxPage";
import LegalSupportPage from "./pages/LegalSupportPage";
import ReportGeneratorPage from "./pages/ReportGeneratorPage";
import SettingsPage from "./pages/SettingsPage";
import SharedReportPage from "./pages/SharedReportPage";
import LandingPage from "./pages/LandingPage";
import type { Agent, Integration, PropertyReport, PropertyReportInput, SupportRequest, Lead, LeadEvent } from "./types";
import type { SignatisAuthMode } from "./lib/auth-mode";

export interface AppData extends BootstrapData {}

function formatRm(value: number): string {
  return value > 0 ? `RM ${value.toLocaleString("en-MY")}` : "price not provided";
}

function clampConfidence(value: number): number {
  return Math.max(0.1, Math.min(1, Number(value.toFixed(2))));
}

function buildLocalReport(input: PropertyReportInput, agentId: string): PropertyReport {
  const normalized = normalizeReportInput(input);
  const draft = buildReportDraft(normalized);
  const propertyKey = buildReportPropertyKey(normalized);
  const now = new Date();
  const sentiments: Array<"positive" | "neutral" | "negative"> = ["positive", "neutral", "negative"];
  const randomSentiment = sentiments[Math.floor(Math.random() * sentiments.length)]!;
  const confidenceVariation = Math.round((0.68 + Math.random() * 0.24) * 100) / 100;
  return {
    id: `report_local_${Date.now()}`,
    agentId,
    title: draft.title,
    propertyName: normalized.propertyName ?? normalized.address,
    propertyKey,
    address: normalized.address,
    propertyType: normalized.propertyType,
    sqft: normalized.sqft,
    bedrooms: normalized.bedrooms,
    bathrooms: normalized.bathrooms,
    yearBuilt: normalized.yearBuilt,
    status: draft.status,
    marketSignal: draft.marketSignal,
    sentimentSummary: draft.sentimentSummary,
    generatedAt: now.toISOString(),
    cacheStatus: "refreshed",
    shareToken: `shr_local_${Date.now()}`,
    inputSnapshot: normalized,
    indexLookup: {
      propertyKey,
      status: "miss",
      liveSearchStatus: "validated",
      freshnessDays: 0,
      citationsCount: 3,
      summary: draft.marketSignal,
      checkedAt: now.toISOString(),
    },
    analytics: {
      sentiment: randomSentiment,
      pricingTrend: draft.marketSignal,
      confidenceScore: Math.min(clampConfidence(confidenceVariation), 0.92),
      dataCompleteness: 0.72,
      priceCertainty: 0.30,
      freshnessDays: 0,
    },
    citations: [
      {
        title: "re:AI refreshed market intelligence",
        url: "https://re-ai.app/research/refreshed-market-model",
      },
      {
        title: `${normalized.propertyName} — refreshed listing signals`,
        url: `https://re-ai.app/research/${propertyKey}`,
        sourceType: "comparable_listing",
      },
    ],
    comparableListings: [],
    contentSections: [
      {
        title: "Market read (refreshed)",
        body: `${normalized.propertyName} is positioned as a ${normalized.tenure} ${normalized.propertyType.toLowerCase()} for ${normalized.listingIntent} in ${normalized.address} at ${formatRm(normalized.askingPriceRm)}. This is a refreshed intelligence report with updated market signals.`,
      },
      {
        title: "Pricing signal",
        body: `${draft.marketSignal}. Agent context and optional listing facts support the current asking position.${normalized.sourceNotes ? ` Notes: ${normalized.sourceNotes}` : ""}`,
      },
      {
        title: "Buyer sentiment",
        body: draft.sentimentSummary,
      },
    ],
  };
}

function WorkosApp() {
  return <SignatisWorkspace authMode="workos" />;
}

export default function App({ authMode }: { authMode: SignatisAuthMode }) {
  const location = useLocation();

  if (location.pathname === "/") {
    return <LandingPage authMode={authMode} />;
  }



  if (location.pathname.startsWith("/reports/share/")) {
    return <SharedReportPage />;
  }

  if (authMode === "workos") {
    return <WorkosApp />;
  }

  return <SignatisWorkspace authMode="demo" />;
}

function SignatisWorkspace({
  authMode,
}: {
  authMode: SignatisAuthMode;
}) {
  const location = useLocation();
  const [data, setData] = useState<AppData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    setError(null);
    void loadBootstrapData({
      authMode,
    })
      .then(setData)
      .catch((loadError: unknown) => {
        setError(loadError instanceof Error ? loadError.message : "Unable to load re:AI.");
      });
  }, [authMode, retryCount]);

  const dashboard = useMemo(() => {
    if (!data) return null;
    return {
      ...data.dashboard,
      agent: data.settings.agent,
      highIntentLeads: data.leads.filter((lead) => lead.intent === 1).sort((a, b) => b.score - a.score),
      recentReports: data.reports.slice(0, 3),
      totals: {
        ...data.dashboard.totals,
        highIntentLeads: data.leads.filter((lead) => lead.intent === 1).length,
        reportsGenerated: Math.max(data.dashboard.totals.reportsGenerated, data.reports.length),
      },
    };
  }, [data]);

  async function createReport(input: PropertyReportInput): Promise<PropertyReport> {
    if (!data) throw new Error("re:AI is still loading.");
    const report = data.demoMode
      ? buildLocalReport(input, data.settings.agent.id)
      : await createReportApi(input);
    setData({
      ...data,
      reports: [report, ...data.reports],
      dashboard: {
        ...data.dashboard,
        recentReports: [report, ...data.dashboard.recentReports],
      },
    });
    setNotice("Property report is ready.");
    return report;
  }

  async function sendReport(reportId: string, leadId: string): Promise<void> {
    if (!data) throw new Error("re:AI is still loading.");
    if (data.demoMode) {
      console.log(`[Demo] Sending report ${reportId} to lead ${leadId}`);
      // Simulate demo mode send
      await new Promise((resolve) => setTimeout(resolve, 800));
      setNotice("Report emailed to prospect with tracking pixel.");
    } else {
      const result = await sendReportApi(reportId, leadId);
      if (!result.success) {
        throw new Error(result.message || "Failed to send report");
      }
      setNotice("Report emailed to prospect.");
    }
  }

  async function saveSettings(input: Omit<Agent, "id" | "workosUserId" | "plan" | "avatarInitials" | "ingestionAddress">): Promise<void> {
    if (!data) return;
    const result = data.demoMode
      ? {
          agent: { ...data.settings.agent, ...input },
          integrations: data.settings.integrations,
        }
      : await saveSettingsApi(input);

    setData({
      ...data,
      settings: result,
      dashboard: {
        ...data.dashboard,
        agent: result.agent,
      },
    });
    setNotice("Settings saved.");
  }

  async function connectIntegration(id: string, name: string, description: string): Promise<void> {
    if (!data) return;
    const result = data.demoMode
      ? {
          integrations: [
            ...data.settings.integrations,
            { id, agentId: data.settings.agent.id, name, description, status: "connected" as const }
          ]
        }
      : await connectIntegrationApi(id, name, description);

    setData({
      ...data,
      settings: {
        ...data.settings,
        integrations: result.integrations,
      },
    });
    setNotice(`${name} connected.`);
  }

  async function disconnectIntegration(id: string): Promise<void> {
    if (!data) return;
    const integration = data.settings.integrations.find((item) => item.id === id);
    const result = data.demoMode
      ? {
          integrations: data.settings.integrations.filter((item) => item.id !== id)
        }
      : await disconnectIntegrationApi(id);

    setData({
      ...data,
      settings: {
        ...data.settings,
        integrations: result.integrations,
      },
    });
    setNotice(`${integration?.name || "Integration"} disconnected.`);
  }

  async function saveWhatsAppCredentials(phoneNumberId: string, accessToken: string): Promise<void> {
    if (!data) return;
    if (!data.demoMode) {
      await saveWhatsAppCredentialsApi(phoneNumberId, accessToken);
    }
    setData({
      ...data,
      settings: {
        ...data.settings,
        integrations: [
          ...data.settings.integrations.filter((i) => i.id !== "whatsapp"),
          { id: "whatsapp", agentId: data.settings.agent.id, name: "WhatsApp Business API", description: "Meta Developer API", status: "connected" }
        ],
      },
    });
    setNotice("WhatsApp Business API connected.");
  }

  async function deleteWhatsAppCredentials(): Promise<void> {
    if (!data) return;
    if (!data.demoMode) {
      await deleteWhatsAppCredentialsApi();
    }
    setData({
      ...data,
      settings: {
        ...data.settings,
        integrations: data.settings.integrations.filter((i) => i.id !== "whatsapp"),
      },
    });
    setNotice("WhatsApp Business API disconnected.");
  }

  async function connectTelegram(botToken: string): Promise<{ botName?: string }> {
    if (!data) return {};
    const result = await connectTelegramApi(botToken);
    if (!result.success) throw new Error(result.error ?? "Failed to connect Telegram bot.");
    setData({
      ...data,
      settings: {
        ...data.settings,
        integrations: [
          ...data.settings.integrations.filter((i) => i.id !== "telegram"),
          { id: "telegram", agentId: data.settings.agent.id, name: "Telegram Bot", description: `@${result.botName ?? "bot"}`, status: "connected" }
        ],
      },
    });
    setNotice("Telegram bot connected.");
    return { botName: result.botName };
  }

  async function disconnectTelegram(): Promise<void> {
    if (!data) return;
    await disconnectTelegramApi();
    setData({
      ...data,
      settings: {
        ...data.settings,
        integrations: data.settings.integrations.filter((i) => i.id !== "telegram"),
      },
    });
    setNotice("Telegram bot disconnected.");
  }

  async function setLeadTelegramChatId(leadId: string, chatId: string): Promise<void> {
    if (!data) return;
    const result = await setLeadTelegramChatIdApi(leadId, chatId);
    if (!result.success) throw new Error(result.error ?? "Failed to save Telegram chat ID.");
    setData({
      ...data,
      leads: data.leads.map((l) => l.id === leadId ? { ...l, telegramChatId: chatId || undefined } : l),
    });
  }

  async function submitSupport(input: Pick<SupportRequest, "name" | "category" | "subject" | "message">): Promise<void> {
    if (!data) return;
    if (!data.demoMode) {
      await submitSupportRequestApi(input);
    }
    setNotice("Support request submitted.");
  }

  async function createLead(input: {
    name: string;
    email: string;
    phone: string;
    source: string;
    propertyInterest: string;
    budget: string;
    message?: string;
    preferredChannel?: string;
  }): Promise<Lead> {
    if (!data) throw new Error("re:AI is still loading.");
    let lead: Lead;
    if (data.demoMode) {
      const id = `lead_local_${Date.now()}`;
      const messageText = input.message?.trim() || "";
      let inquirySentiment = 0;
      const lowerMsg = messageText.toLowerCase();

      if (/love|interested|viewing|buy|nice|great|good|excellent|perfect|keen/i.test(lowerMsg)) {
        inquirySentiment = 0.8;
      } else if (/bad|expensive|defect|broken|poor|disappointed|issue|noise|concern/i.test(lowerMsg)) {
        inquirySentiment = -0.6;
      }

      const scoreObj = computeLeadScore({
        emailOpens: 0,
        linkClicks: 0,
        reportViews: 1,
        inquirySentiment,
      });

      const sentiment = inquirySentiment > 0.2 ? "positive" : inquirySentiment < -0.2 ? "negative" : "neutral";

      lead = {
        id,
        agentId: data.settings.agent.id,
        name: input.name,
        email: input.email,
        phone: input.phone,
        source: input.source,
        propertyInterest: input.propertyInterest,
        budget: input.budget,
        emailOpens: 0,
        linkClicks: 0,
        reportViews: 1,
        inquirySentiment,
        sentiment,
        score: scoreObj.score,
        intent: scoreObj.intent,
        tier: scoreObj.tier,
        stage: "new",
        preferredChannel: (input.preferredChannel ?? "whatsapp") as "whatsapp" | "telegram" | "messenger" | "instagram" | "email" | "phone",
        createdAt: new Date().toISOString(),
      };
    } else {
      const res = await createLeadApi(input);
      lead = res.lead;
    }

    setData({
      ...data,
      leads: [lead, ...data.leads],
    });
    setNotice(`Prospect ${lead.name} added.`);
    return lead;
  }

  async function updateLeadStage(leadId: string, stage: string): Promise<void> {
    if (!data) return;
    if (!data.demoMode) {
      await updateLeadStageApi(leadId, stage);
    }
    setData({
      ...data,
      leads: data.leads.map((l) =>
        l.id === leadId ? { ...l, stage: stage as Lead["stage"], lastContactedAt: new Date().toISOString() } : l,
      ),
    });
  }

  async function sendLeadMessage(leadId: string, text: string): Promise<void> {
    if (!data) return;
    if (data.demoMode) {
      console.log(`[Demo] Simulating WhatsApp message to lead ${leadId}: ${text}`);
      await new Promise(resolve => setTimeout(resolve, 800));
      setData({
        ...data,
        leads: data.leads.map((lead) => (lead.id === leadId && lead.stage === "new" ? { ...lead, stage: "contacted" } : lead)),
      });
      setNotice("WhatsApp message simulated.");
    } else {
      const result = await sendLeadMessageApi(leadId, text);
      if (!result.success) {
        throw new Error(result.error || "Failed to send message.");
      }
      setNotice("WhatsApp message dispatched.");
      setData({
        ...data,
        leads: data.leads.map((lead) => (lead.id === leadId && lead.stage === "new" ? { ...lead, stage: "contacted" } : lead)),
      });
    }
  }

  async function deleteLead(leadId: string): Promise<void> {
    if (!data) return;
    const lead = data.leads.find((l) => l.id === leadId);
    if (!lead) return;

    if (!data.demoMode) {
      await deleteLeadApi(leadId);
    }

    setData({
      ...data,
      leads: data.leads.filter((l) => l.id !== leadId),
    });
    setNotice(`Prospect ${lead.name} deleted.`);
  }

  async function deletePropertyCache(propertyName: string): Promise<void> {
    if (!data) return;
    const propertyKey = buildReportPropertyKey({ propertyName });

    if (!data.demoMode) {
      await deletePropertyCacheApi(propertyKey, propertyName);
    }

    setData({
      ...data,
      reports: data.reports.filter(
        (r) =>
          r.propertyKey !== propertyKey &&
          r.propertyName?.toLowerCase() !== propertyName.toLowerCase()
      ),
    });
    setNotice("Property cache and associated reports removed.");
  }


  async function getLeadEvents(leadId: string): Promise<LeadEvent[]> {
    if (!data) return [];
    if (data.demoMode) {
      const lead = data.leads.find((l) => l.id === leadId);
      if (!lead) return [];
      const events: LeadEvent[] = [];
      if (lead.emailOpens > 0) {
        events.push({
          id: `ev_open_${leadId}`,
          leadId,
          agentId: data.settings.agent.id,
          eventType: "email_open",
          eventLabel: `Opened update email (${lead.emailOpens} times)`,
          occurredAt: lead.createdAt,
        });
      }
      if (lead.linkClicks > 0) {
        events.push({
          id: `ev_click_${leadId}`,
          leadId,
          agentId: data.settings.agent.id,
          eventType: "link_click",
          eventLabel: `Clicked property report link (${lead.linkClicks} times)`,
          occurredAt: lead.createdAt,
        });
      }
      events.push({
        id: `ev_init_${leadId}`,
        leadId,
        agentId: data.settings.agent.id,
        eventType: "report_view",
        eventLabel: `Viewed property report for ${lead.propertyInterest}`,
        occurredAt: lead.createdAt,
      });
      return events;
    } else {
      const res = await getLeadEventsApi(leadId);
      return res;
    }
  }

  async function logout(): Promise<void> {
    if (!data || data.demoMode) {
      window.location.href = "/";
      return;
    }

    // POST to /logout — the server clears our session cookie and returns a
    // 302 redirect to Scalekit's sign-out URL (which then bounces back to our
    // app).  Use redirect: "manual" so we can navigate the page ourselves
    // rather than letting fetch chase the full redirect chain.
    const resp = await fetch("/logout", {
      method: "POST",
      headers: {
        "x-csrf-token": data.csrfToken,
      },
      redirect: "manual",
    });

    if (resp.type === "opaqueredirect" || resp.status === 302) {
      // Follow the redirect manually — the server points the browser at
      // Scalekit's sign-out endpoint which will clear the Scalekit session
      // and then redirect back to our app.
      const location = resp.headers.get("Location");
      if (location) {
        window.location.href = location;
        return;
      }
    }

    // Fallback: hard reload landing page
    window.location.href = "/?logout=true";
  }

  const isUnauthorized = error?.includes("401") || error?.includes("Unauthorized");

  if (isUnauthorized) {
    const selectAccount = typeof window !== "undefined" ? localStorage.getItem("prompt_select_account") !== "false" : true;
    const promptParam = selectAccount ? "&prompt=select_account" : "&prompt=";
    window.location.href = `/login?returnTo=${encodeURIComponent(location.pathname)}${promptParam}`;
    return null;
  }

  async function handleInjectDemoLead() {
    if (!data) return;
    if (data.demoMode) {
      alert("Please connect to the real backend database (authMode='workos') to inject leads via API, or we can mock it here if needed.");
      return;
    }
    try {
      const res = await injectDemoLeadApi();
      if (res.success) {
        setNotice("Inbound lead simulated successfully!");
        setData({
          ...data,
          leads: [res.lead, ...data.leads],
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to inject demo lead.");
    }
  }

  if (error) {
    return (
      <main className="min-h-screen grid place-items-center p-6">
        <section className="card max-w-xl p-8 text-center">
          <h1 className="section-title">re:AI could not start</h1>
          <p className="mt-4" style={{ color: "rgba(247,247,244,0.6)" }}>{error}</p>
          <button
            className="primary-button mt-6"
            onClick={() => setRetryCount((prev) => prev + 1)}
            type="button"
          >
            Try Again
          </button>
        </section>
      </main>
    );
  }

  if (!data || !dashboard) {
    return (
      <main className="min-h-screen grid place-items-center bg-[#1a1a1a]">
        <div className="card p-10 text-center landing-card-shadow border border-white/10 max-w-sm w-full mx-4 animate-pulse">
          <div className="hci-loader-container">
            <div className="hci-loader-logo">re</div>
            <div>
              <p className="font-bold m-0" style={{ color: "rgba(247,247,244,0.6)" }}>Loading re:AI workspace...</p>
              <div className="hci-loading-bar" />
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <Layout agent={data.settings.agent} demoMode={data.demoMode} notice={notice} onLogout={logout}>
      <div className="route-transition" key={location.pathname}>
        <Routes>
          <Route path="/dashboard" element={<DashboardPage dashboard={dashboard} demoMode={data.demoMode} onInjectDemoLead={handleInjectDemoLead} />} />
          <Route
            path="/report-generator"
            element={<ReportGeneratorPage demoMode={data.demoMode} reports={data.reports} leads={data.leads} onCreateReport={createReport} onSendReport={sendReport} onDeletePropertyCache={deletePropertyCache} />}
          />
          <Route
            path="/leads"
            element={
              <OmniboxPage
                demoMode={data.demoMode}
                leads={data.leads}
                onCreateLead={createLead}
                onDeleteLead={deleteLead}
                onGetLeadEvents={getLeadEvents}
                onUpdateLeadStage={updateLeadStage}
                onSendLeadMessage={sendLeadMessage}
                onSetLeadTelegramChatId={setLeadTelegramChatId}
              />
            }
          />
          <Route
            path="/settings"
            element={
              <SettingsPage
                agent={data.settings.agent}
                integrations={data.settings.integrations as Integration[]}
                onSave={saveSettings}
                onConnectIntegration={connectIntegration}
                onDisconnectIntegration={disconnectIntegration}
                onSaveWhatsAppCredentials={saveWhatsAppCredentials}
                onDeleteWhatsAppCredentials={deleteWhatsAppCredentials}
                onConnectTelegram={connectTelegram}
                onDisconnectTelegram={disconnectTelegram}
              />
            }
          />
          <Route
            path="/legal-support"
            element={<LegalSupportPage agent={data.settings.agent} onSubmitSupport={submitSupport} />}
          />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </div>
    </Layout>
  );
}
