import { useAuth } from "@workos-inc/authkit-react";
import { useEffect, useMemo, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { buildReportDraft } from "./domain/reports";
import {
  createReportApi,
  loadBootstrapData,
  saveSettingsApi,
  submitSupportRequestApi,
  connectIntegrationApi,
  disconnectIntegrationApi,
  type BootstrapData,
} from "./lib/api";
import Layout from "./components/Layout";
import DashboardPage from "./pages/DashboardPage";
import LeadManagementPage from "./pages/LeadManagementPage";
import LegalSupportPage from "./pages/LegalSupportPage";
import ReportGeneratorPage from "./pages/ReportGeneratorPage";
import SettingsPage from "./pages/SettingsPage";
import type { Agent, Integration, PropertyReport, PropertyReportInput, SupportRequest } from "./types";
import type { SignatisAuthMode } from "./lib/auth-mode";

export interface AppData extends BootstrapData {}

function buildLocalReport(input: PropertyReportInput, agentId: string): PropertyReport {
  const draft = buildReportDraft(input);
  return {
    id: `report_local_${Date.now()}`,
    agentId,
    title: draft.title,
    address: input.address.trim(),
    propertyType: input.propertyType.trim(),
    sqft: input.sqft,
    bedrooms: input.bedrooms,
    bathrooms: input.bathrooms,
    yearBuilt: input.yearBuilt,
    status: draft.status,
    marketSignal: draft.marketSignal,
    sentimentSummary: draft.sentimentSummary,
    generatedAt: new Date().toISOString(),
  };
}

function WorkosApp() {
  const auth = useAuth();
  return <SignatisWorkspace auth={auth} authMode="workos" />;
}

export default function App({ authMode }: { authMode: SignatisAuthMode }) {
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
          <Route path="/leads" element={<LeadManagementPage leads={data.leads} />} />
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
