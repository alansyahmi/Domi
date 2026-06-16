import { RefreshCw, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";
import { formatDateTime, initials } from "../lib/format";
import type { DashboardData, PropertyReport } from "../types";
import { ChannelContactButton } from "../components/leads/ChannelContactButton";

function MetricCard({
  label,
  value,
  hint,
  gold,
}: {
  label: string;
  value: string;
  hint: string;
  gold?: boolean;
}) {
  return (
    <section className={`card metric-card ${gold ? "gold" : ""}`}>
      <p className="metric-label">{label}</p>
      <div className="mt-4 flex items-end gap-4">
        <strong className="metric-value">{value}</strong>
        <span className="mb-2 text-emerald-600 font-semibold">{hint}</span>
      </div>
    </section>
  );
}

function ReportStatus({ report }: { report: PropertyReport }) {
  return (
    <span className={`status-chip ${report.status === "ready" ? "status-ready" : "status-running"}`}>
      {report.status === "ready" ? "Ready" : "Running"}
    </span>
  );
}

export default function DashboardPage({ dashboard }: { dashboard: DashboardData }) {
  return (
    <main className="page">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <MetricCard label="Total Leads Scored" value={dashboard.totals.leadsScored.toLocaleString()} hint="+12%" />
        <MetricCard label="Average Intent Score" value={dashboard.totals.averageIntentScore.toFixed(2)} hint="High" gold />
        <MetricCard label="Reports Generated" value={dashboard.totals.reportsGenerated.toLocaleString()} hint="This Month" />
      </div>

      <div className="mt-12 grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(24rem,1fr)] gap-10">
        <section>
          <div className="dashboard-section-header">
            <h2 className="section-title">High-Intent Leads</h2>
            <Link to="/leads" className="secondary-button">
              View All
            </Link>
          </div>
          <div className="grid gap-4">
            {dashboard.highIntentLeads.map((lead) => (
              <article key={lead.id} className="card border-l-4 border-l-[#ffd45a] p-5 flex items-center gap-5">
                <div className="avatar">{initials(lead.name)}</div>
                <div className="min-w-0 flex-1">
                  <h3 className="m-0 text-xl font-extrabold">{lead.name}</h3>
                  <p className="m-0 text-slate-700 truncate">
                    {lead.propertyInterest} • {lead.budget}
                  </p>
                </div>
                <div className="text-center">
                  <div className="eyebrow">Intent</div>
                  <div className="text-3xl font-extrabold">{lead.intent}</div>
                </div>
                <ChannelContactButton lead={lead} size="sm" />
              </article>
            ))}
          </div>
        </section>

        <section>
          <h2 className="section-title mb-6">Recent Reports</h2>
          <div className="card overflow-hidden">
            {dashboard.recentReports.map((report) => (
              <article key={report.id} className="border-b border-slate-200 last:border-b-0 p-5 flex items-start gap-4">
                <div className="mt-1">
                  {report.status === "running" ? (
                    <RefreshCw size={20} className="text-slate-600" aria-hidden="true" />
                  ) : (
                    <TrendingUp size={20} className="text-emerald-600" aria-hidden="true" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="m-0 text-lg font-extrabold">{report.title}</h3>
                  <p className="m-0 text-slate-700">{formatDateTime(report.generatedAt)}</p>
                </div>
                <ReportStatus report={report} />
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
