import { useAuth } from "@workos-inc/authkit-react";
import { useEffect, useMemo, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { buildReportDraft } from "./domain/reports";
import {
  createReportApi,
  loadBootstrapData,
  logoutApi,
  saveSettingsApi,
  submitSupportRequestApi,
  type BootstrapData,
} from "./lib/api";
import Layout from "./components/Layout";
import DashboardPage from "./pages/DashboardPage";
import LeadManagementPage from "./pages/LeadManagementPage";
import LegalSupportPage from "./pages/LegalSupportPage";
import ReportGeneratorPage from "./pages/ReportGeneratorPage";
import SettingsPage from "./pages/SettingsPage";
import type { Agent, Integration, PropertyReport, PropertyReportInput, SupportRequest } from "./types";

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

export default function App() {
  const { isLoading: authLoading, user: authUser, signIn, signOut: authSignOut } = useAuth();
  const [data, setData] = useState<AppData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    void loadBootstrapData()
      .then(setData)
      .catch((loadError: unknown) => {
        setError(loadError instanceof Error ? loadError.message : "Unable to load Signatis.");
      });
  }, []);

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
    const report = data.demoMode ? buildLocalReport(input, data.settings.agent.id) : await createReportApi(input);
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

  async function saveSettings(input: Pick<Agent, "fullName" | "email" | "phone">): Promise<void> {
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

  async function submitSupport(input: Pick<SupportRequest, "name" | "category" | "subject" | "message">): Promise<void> {
    if (!data) return;
    if (!data.demoMode) {
      await submitSupportRequestApi(input);
    }
    setNotice("Support request submitted.");
  }

  async function logout(): Promise<void> {
    if (!data || data.demoMode) {
      setNotice("Demo mode does not have an active WorkOS session.");
      return;
    }
    // Clear server-side session first
    await logoutApi(data.csrfToken);
    // Then sign out from AuthKit client-side
    authSignOut();
  }

  // Show AuthKit loading state
  if (authLoading) {
    return (
      <main className="min-h-screen grid place-items-center bg-[#f7f9fb]">
        <div className="card p-8 text-center">
          <div className="brand-mark mx-auto mb-4">S</div>
          <p className="text-slate-600">Authenticating...</p>
        </div>
      </main>
    );
  }

  // Show sign-in if not authenticated via AuthKit
  if (!authUser) {
    return (
      <main className="min-h-screen grid place-items-center p-6">
        <section className="card max-w-xl p-8 text-center">
          <div className="brand-mark mx-auto mb-4">D</div>
          <h1 className="section-title">Welcome to Signatis</h1>
          <p className="mt-4 text-slate-600">Sign in to access your real estate workspace</p>
          <button className="primary-button mt-6" onClick={() => signIn()} type="button">
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
          <button className="primary-button mt-6" onClick={() => signIn()} type="button">
            Sign in with WorkOS
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
            />
          }
        />
        <Route
          path="/legal-support"
          element={<LegalSupportPage agent={data.settings.agent} onSubmitSupport={submitSupport} />}
        />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Layout>
  );
}
