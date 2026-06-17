import { BadgeDollarSign, BarChart3, Database, FileText, Gauge, KeyRound, SearchCheck, ShieldCheck, Sparkles, TrendingUp } from "lucide-react";
import type { PropertyReport } from "../../types";
import ReportActionBar from "./ReportActionBar";
import ReportCitationList from "./ReportCitationList";
import ReportPricingPanel from "./ReportPricingPanel";

function cacheLabel(status: PropertyReport["cacheStatus"]): string {
  if (status === "hit") return "Pre-built intelligence";
  if (status === "refreshed") return "Freshly refreshed";
  if (status === "miss") return "New intelligence";
  return "Model fallback";
}

function formatRm(value: number): string {
  return value > 0 ? `RM ${value.toLocaleString("en-MY")}` : "TBD (Market Ask)";
}

function labelValue(value: string): string {
  if (!value || value.toLowerCase() === "unknown") return "TBD (To Be Confirmed)";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function sentimentLabel(value: string): string {
  if (value === "positive") return "Active / Positive";
  if (value === "neutral") return "Balanced / Neutral";
  if (value === "negative") return "Selective / Cautious";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function lookupLabel(report: PropertyReport): string {
  if (report.indexLookup.liveSearchStatus === "validated") return "Live search validated and indexed";
  if (report.indexLookup.liveSearchStatus === "limited") return "Live search found limited source coverage";
  if (report.indexLookup.liveSearchStatus === "failed") return "Live search unavailable, fallback model used";
  return "Fresh indexed intelligence";
}

function lookupDetail(report: PropertyReport): string {
  const freshness = report.indexLookup.freshnessDays === null
    ? "No previous index"
    : report.indexLookup.freshnessDays === 0
      ? "Checked today"
      : `${report.indexLookup.freshnessDays}d old`;
  return `${freshness} | ${report.indexLookup.citationsCount} source${report.indexLookup.citationsCount === 1 ? "" : "s"}`;
}

export default function ReportResultPanel({ 
  report, 
  leads, 
  onSendReport 
}: { 
  report: PropertyReport;
  leads?: import("../../types").Lead[];
  onSendReport?: (reportId: string, leadId: string) => Promise<void>;
}) {
  const input = report.inputSnapshot;

  return (
    <section className="card report-result-panel p-6 md:p-8">
      <div className="report-result-header">
        <div className="brand-mark h-12! w-12!">
          <FileText size={24} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="eyebrow">Report ready</p>
          <h2 className="m-0 mt-1 text-3xl font-extrabold">{report.title}</h2>
          <p className="m-0 mt-2 text-slate-700">{report.address}</p>
        </div>
        <span className="status-chip status-ready">{cacheLabel(report.cacheStatus)}</span>
      </div>

      <ReportActionBar report={report} leads={leads} onSendReport={onSendReport} />

      <div className="report-index-status">
        <span className="report-index-icon">
          {report.indexLookup.liveSearchStatus === "validated" ? (
            <SearchCheck size={20} aria-hidden="true" />
          ) : (
            <Database size={20} aria-hidden="true" />
          )}
        </span>
        <div>
          <strong>{lookupLabel(report)}</strong>
          <span>{lookupDetail(report)}</span>
        </div>
      </div>

      <div className="report-insight-grid">
        <article>
          <TrendingUp size={20} aria-hidden="true" />
          <span>Pricing trend</span>
          <strong>{report.analytics.pricingTrend}</strong>
        </article>
        <article>
          <BadgeDollarSign size={20} aria-hidden="true" />
          <span>Asking price</span>
          <strong>{formatRm(input.askingPriceRm)}</strong>
        </article>
        <article>
          <KeyRound size={20} aria-hidden="true" />
          <span>Intent and tenure</span>
          <strong>{labelValue(input.listingIntent)} | {labelValue(input.tenure)}</strong>
        </article>
        <article>
          <Sparkles size={20} aria-hidden="true" />
          <span>Buyer sentiment</span>
          <strong>{sentimentLabel(report.analytics.sentiment)}</strong>
        </article>
        <article>
          <Gauge size={20} aria-hidden="true" />
          <span>Confidence</span>
          <strong>{Math.round(report.analytics.confidenceScore * 100)}%</strong>
        </article>
        <article>
          <ShieldCheck size={20} aria-hidden="true" />
          <span>Freshness</span>
          <strong>{report.analytics.freshnessDays === 0 ? "Today" : `${report.analytics.freshnessDays}d`}</strong>
        </article>
      </div>

      <ReportPricingPanel report={report} variant="agent" />

      <div className="grid gap-4">
        {report.contentSections.map((section) => (
          <article className="report-section" key={section.title}>
            <div className="flex items-center gap-2">
              <BarChart3 size={18} aria-hidden="true" />
              <h3>{section.title}</h3>
            </div>
            <p>{section.body}</p>
          </article>
        ))}
      </div>

      <div className="mt-8">
        <h3 className="m-0 mb-4 text-xl font-extrabold">Sources</h3>
        <ReportCitationList citations={report.citations} />
      </div>
    </section>
  );
}
