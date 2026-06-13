import { useAuth } from "@workos-inc/authkit-react";
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
  type BootstrapData,
} from "./lib/api";
import Layout from "./components/Layout";
import DashboardPage from "./pages/DashboardPage";
import LeadManagementPage from "./pages/LeadManagementPage";
import LegalSupportPage from "./pages/LegalSupportPage";
import ReportGeneratorPage from "./pages/ReportGeneratorPage";
import SettingsPage from "./pages/SettingsPage";
import SharedReportPage from "./pages/SharedReportPage";
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
      freshnessDays: 0,
    },
    citations: [
      {
        title: "Signatis refreshed market intelligence",
        url: "https://signatis.app/research/refreshed-market-model",
      },
      {
        title: `${normalized.propertyName} — refreshed listing signals`,
        url: `https://signatis.app/research/${propertyKey}`,
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
  const auth = useAuth();
  return <SignatisWorkspace auth={auth} authMode="workos" />;
}

export default function App({ authMode }: { authMode: SignatisAuthMode }) {
  const location = useLocation();

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
  auth,
}: {
  authMode: SignatisAuthMode;
  auth?: ReturnType<typeof useAuth>;
}) {
  const location = useLocation();
  const [data, setData] = useState<AppData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (authMode === "workos" && auth?.isLoading) return;
    if (authMode === "workos" && !auth?.user) {
      setData(null);
      return;
    }

    setError(null);
    void loadBootstrapData({
      authMode,
      getAccessToken: authMode === "workos" ? auth?.getAccessToken : undefined,
    })
      .then(setData)
      .catch((loadError: unknown) => {
        setError(loadError instanceof Error ? loadError.message : "Unable to load Signatis.");
      });
  }, [authMode, auth?.isLoading, auth?.user, auth?.getAccessToken, retryCount]);

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
    if (!data) throw new Error("Signatis is still loading.");
    const report = data.demoMode
      ? buildLocalReport(input, data.settings.agent.id)
      : await createReportApi(input, auth?.getAccessToken);
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

  async function saveSettings(input: Omit<Agent, "id" | "workosUserId" | "plan" | "avatarInitials" | "ingestionAddress">): Promise<void> {
    if (!data) return;
    const result = data.demoMode
      ? {
          agent: { ...data.settings.agent, ...input },
          integrations: data.settings.integrations,
        }
      : await saveSettingsApi(input, auth?.getAccessToken);

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
      : await connectIntegrationApi(id, name, description, auth?.getAccessToken);

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
      : await disconnectIntegrationApi(id, auth?.getAccessToken);

    setData({
      ...data,
      settings: {
        ...data.settings,
        integrations: result.integrations,
      },
    });
    if (integration) {
      setNotice(`${integration.name} disconnected.`);
    }
  }


  async function submitSupport(input: Pick<SupportRequest, "name" | "category" | "subject" | "message">): Promise<void> {
    if (!data) return;
    if (!data.demoMode) {
      await submitSupportRequestApi(input, auth?.getAccessToken);
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
  }): Promise<Lead> {
    if (!data) throw new Error("Signatis is still loading.");
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
        createdAt: new Date().toISOString(),
      };
    } else {
      const res = await createLeadApi(input, auth?.getAccessToken);
      lead = res.lead;
    }

    setData({
      ...data,
      leads: [lead, ...data.leads],
    });
    setNotice(`Prospect ${lead.name} added.`);
    return lead;
  }

  async function deleteLead(leadId: string): Promise<void> {
    if (!data) return;
    const lead = data.leads.find((l) => l.id === leadId);
    if (!lead) return;

    if (!data.demoMode) {
      await deleteLeadApi(leadId, auth?.getAccessToken);
    }

    setData({
      ...data,
      leads: data.leads.filter((l) => l.id !== leadId),
    });
    setNotice(`Prospect ${lead.name} deleted.`);
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
      const res = await getLeadEventsApi(leadId, auth?.getAccessToken);
      return res.events;
    }
  }

  async function logout(): Promise<void> {
    if (!data || data.demoMode) {
      setNotice("Demo mode does not have an active WorkOS session.");
      return;
    }
    auth?.signOut({ returnTo: `${window.location.origin}/dashboard` });
  }

  if (authMode === "workos" && auth?.isLoading) {
    return (
      <main className="min-h-screen grid place-items-center bg-[#f7f9fb]">
        <div className="card p-8 text-center">
          <div className="brand-mark mx-auto mb-4">S</div>
          <p className="text-slate-600">Authenticating...</p>
        </div>
      </main>
    );
  }

  if (authMode === "workos" && !auth?.user) {
    return (
      <main className="min-h-screen grid place-items-center p-6">
        <section className="card max-w-xl p-8 text-center">
          <div className="brand-mark mx-auto mb-4">S</div>
          <h1 className="section-title">Welcome to Signatis</h1>
          <p className="mt-4 text-slate-600">Sign in to access your real estate workspace</p>
          <button
            className="primary-button mt-6"
            onClick={() => void auth?.signIn({ state: { returnTo: window.location.pathname } })}
            type="button"
          >
            Sign in with WorkOS
          </button>
        </section>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen grid place-items-center p-6">
        <section className="card max-w-xl p-8 text-center">
          <h1 className="section-title">Signatis could not start</h1>
          <p className="mt-4 text-slate-600">{error}</p>
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
      <main className="min-h-screen grid place-items-center bg-[#f7f9fb]">
        <div className="card p-8 text-center">
          <div className="brand-mark mx-auto mb-4">S</div>
          <p className="text-slate-600">Loading Signatis workspace...</p>
        </div>
      </main>
    );
  }

  return (
    <Layout agent={data.settings.agent} demoMode={data.demoMode} notice={notice} onLogout={logout}>
      <div className="route-transition" key={location.pathname}>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage dashboard={dashboard} />} />
          <Route
            path="/report-generator"
            element={<ReportGeneratorPage reports={data.reports} onCreateReport={createReport} />}
          />
          <Route
            path="/leads"
            element={
              <LeadManagementPage
                leads={data.leads}
                onCreateLead={createLead}
                onDeleteLead={deleteLead}
                onGetLeadEvents={getLeadEvents}
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
