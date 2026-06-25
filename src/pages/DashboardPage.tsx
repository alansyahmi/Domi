import { useEffect, useMemo, useState } from "react";
import { RefreshCw, TrendingUp, UserPlus } from "lucide-react";
import { Link } from "react-router-dom";
import { formatDateTime, initials } from "../lib/format";
import type { DashboardData, PropertyReport } from "../types";
import { ChannelContactButton } from "../components/leads/ChannelContactButton";
import RoiLedgerBanner from "../components/RoiLedgerBanner";
import { computeRoiLedger } from "../domain/roi";
import { demoConversations, demoLeadIntelligence, demoListings, demoMessages, demoPitches } from "../data/demo";

function AnimatedNumber({ value }: { value: number | string }) {
  const [displayValue, setDisplayValue] = useState(0);
  const numericValue = typeof value === "string" ? parseFloat(value.replace(/,/g, "")) : value;

  useEffect(() => {
    let startTimestamp: number | null = null;
    const duration = 1000;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 4);
      setDisplayValue(numericValue * ease);
      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };
    window.requestAnimationFrame(step);
  }, [numericValue]);

  if (typeof value === "string" && !value.includes(".")) {
    return <>{Math.floor(displayValue).toLocaleString()}</>;
  }
  return <>{displayValue.toFixed(2)}</>;
}

function ReportStatus({ report }: { report: PropertyReport }) {
  return (
    <span className={`status-chip ${report.status === "ready" ? "status-ready" : "status-running"}`}>
      {report.status === "ready" ? "Ready" : "Running"}
    </span>
  );
}

export default function DashboardPage({
  dashboard,
  demoMode,
  onInjectDemoLead
}: {
  dashboard: DashboardData;
  demoMode?: boolean;
  onInjectDemoLead?: () => void;
}) {
  const ledger = useMemo(
    () =>
      computeRoiLedger(
        demoMode
          ? {
              pitches: demoPitches,
              conversations: demoConversations,
              messagesByConversation: demoMessages,
              intelligence: demoLeadIntelligence,
              listings: demoListings,
              reportsCount: dashboard.totals.reportsGenerated,
            }
          : {
              pitches: [],
              conversations: [],
              messagesByConversation: {},
              intelligence: dashboard.highIntentLeads.map(() => ({ priorityPct: 100 })),
              listings: [],
              reportsCount: dashboard.totals.reportsGenerated,
            },
      ),
    [demoMode, dashboard],
  );

  const avgEngagement = dashboard.highIntentLeads.length > 0
    ? Math.round(
      dashboard.highIntentLeads.reduce(
        (total, lead) => total + Math.min(100, lead.emailOpens * 5 + lead.linkClicks * 8), 0
      ) / dashboard.highIntentLeads.length
    )
    : 0;

  return (
    <main
      style={{
        maxWidth: "92rem",
        margin: "0 auto",
        padding: "0.35rem 2.5rem 5rem",
        position: "relative",
        overflowX: "hidden",
        minHeight: "calc(100vh - 6rem)",
        background: `
          radial-gradient(900px 360px at 50% 0%, rgba(255,255,255,0.07), transparent 60%),
          linear-gradient(180deg, rgba(58,58,58,0.96), rgba(38,38,38,0.96))
        `,
      }}
    >
      {/* ── Animated bars (landing page Launch mode style) ── */}
      <div className="reai-bars" aria-hidden="true" style={{ right: "2.5rem" }}>
        <span />
        <span />
        <span />
        <span />
      </div>

      {/* ── ROI / attribution ledger ── */}
      <RoiLedgerBanner ledger={ledger} />

      {/* ── Stats cards ── */}
      <div className="reai-hero-stats" style={{ marginTop: 0 }}>
        <article className="reai-stat-card">
          <span className="reai-stat-value">
            <AnimatedNumber value={dashboard.totals.leadsScored} />
          </span>
          <span className="reai-stat-label">Total Leads Scored</span>
        </article>
        <article className="reai-stat-card">
          <span className="reai-stat-value">
            <AnimatedNumber value={dashboard.totals.averageIntentScore.toFixed(2)} />
          </span>
          <span className="reai-stat-label">Average Intent Score</span>
        </article>
        <article className="reai-stat-card">
          <span className="reai-stat-value">
            <AnimatedNumber value={dashboard.totals.reportsGenerated} />
          </span>
          <span className="reai-stat-label">Reports Generated</span>
        </article>
      </div>

      {/* ── Secondary metrics ── */}
      <div className="reai-hero-metrics">
        <div>
          <span className="reai-metric-label">High-Intent Prospects</span>
          <span className="reai-metric-value">{dashboard.highIntentLeads.length}</span>
        </div>
        <div>
          <span className="reai-metric-label">Avg Engagement</span>
          <span className="reai-metric-value">{avgEngagement}%</span>
        </div>
      </div>

      {/* ── High-Intent Leads list ── */}
      <div className="mt-10">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h3 className="m-0 text-base font-bold tracking-wider uppercase" style={{ color: "rgba(247,247,244,0.48)", letterSpacing: "0.12em" }}>
            High-Intent Leads
          </h3>
          <div className="flex gap-2">
            {onInjectDemoLead && (
              <button
                onClick={onInjectDemoLead}
                className="secondary-button btn-sm"
                title="Simulate incoming lead"
              >
                <UserPlus size={16} />
              </button>
            )}
            <Link to="/leads" className="secondary-button btn-sm">
              View All
            </Link>
          </div>
        </div>
        <div className="grid gap-3">
          {dashboard.highIntentLeads.length > 0 ? (
            dashboard.highIntentLeads.map((lead) => (
              <article
                key={lead.id}
                className="glass-surface flex items-center gap-4"
                style={{
                  padding: "1rem 1.25rem",
                  borderRadius: "1.2rem",
                  border: "1px solid rgba(255,212,90,0.18)",
                }}
              >
                <div className="avatar">{initials(lead.name)}</div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold" style={{ color: "rgba(247,247,244,0.92)", fontSize: "1.05rem" }}>
                    {lead.name}
                  </div>
                  <div style={{ color: "rgba(247,247,244,0.5)", fontSize: "0.9rem" }}>
                    {lead.propertyInterest} &bull; {lead.budget}
                  </div>
                </div>
                <div className="text-center">
                  <div className="eyebrow" style={{ fontSize: "0.7rem" }}>Intent</div>
                  <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "rgba(247,247,244,0.92)" }}>{lead.intent}</div>
                </div>
                <ChannelContactButton lead={lead} size="sm" />
              </article>
            ))
          ) : (
            <div style={{ color: "rgba(247,247,244,0.35)", fontSize: "0.95rem", padding: "1.5rem 0", textAlign: "center" }}>
              No high-intent prospects yet. New leads will appear here once scored.
            </div>
          )}
        </div>
      </div>

      {/* ── Recent Reports list ── */}
      <div className="mt-8 pb-2">
        <h3 className="m-0 mb-4 text-base font-bold tracking-wider uppercase" style={{ color: "rgba(247,247,244,0.48)", letterSpacing: "0.12em" }}>
          Recent Reports
        </h3>
        <div className="grid gap-3">
          {dashboard.recentReports.length > 0 ? (
            dashboard.recentReports.map((report) => (
              <article
                key={report.id}
                className="glass-surface flex items-center gap-4"
                style={{
                  padding: "0.9rem 1.25rem",
                  borderRadius: "1.2rem",
                }}
              >
                <div style={{ marginTop: "0.1rem" }}>
                  {report.status === "running" ? (
                    <RefreshCw size={18} style={{ color: "rgba(247,247,244,0.35)" }} aria-hidden="true" />
                  ) : (
                    <TrendingUp size={18} style={{ color: "#6ee7b7" }} aria-hidden="true" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold truncate" style={{ color: "rgba(247,247,244,0.92)", fontSize: "1rem" }}>
                    {report.title}
                  </div>
                  <div style={{ color: "rgba(247,247,244,0.5)", fontSize: "0.85rem" }}>
                    {formatDateTime(report.generatedAt)}
                  </div>
                </div>
                <ReportStatus report={report} />
              </article>
            ))
          ) : (
            <div style={{ color: "rgba(247,247,244,0.35)", fontSize: "0.95rem", padding: "1.5rem 0", textAlign: "center" }}>
              No reports generated yet. Create your first report to see it here.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
