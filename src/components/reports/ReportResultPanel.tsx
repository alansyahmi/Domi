import { BadgeDollarSign, BarChart3, Database, FileText, Gauge, KeyRound, MapPin, SearchCheck, ShieldCheck, Sparkles, Star, TrendingUp } from "lucide-react";
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

function bodyToBullets(body: string): string[] {
  return body
    .split(/\n+/)
    .flatMap((line) => line.split(/(?<=[.!?])\s+/))
    .map((part) => part.trim())
    .filter(Boolean);
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
          <Database size={20} aria-hidden="true" />
          <span>Data Completeness</span>
          <strong>{Math.round(report.analytics.dataCompleteness * 100)}% ({report.citations.length} sources)</strong>
        </article>
        <article>
          <BadgeDollarSign size={20} aria-hidden="true" />
          <span>Price Certainty</span>
          <strong>{report.analytics.priceCertainty >= 0.60 ? "High" : report.analytics.priceCertainty >= 0.35 ? "Moderate" : "Low"}{report.analytics.priceCertainty < 0.35 ? " (askings only)" : ""}</strong>
        </article>
        <article>
          <ShieldCheck size={20} aria-hidden="true" />
          <span>Freshness</span>
          <strong>{report.analytics.freshnessDays === 0 ? "Today" : `${report.analytics.freshnessDays}d`}</strong>
        </article>
      </div>

      <ReportPricingPanel report={report} variant="agent" />

      {report.analytics.neighborhoodVibe && (
        <div className="mb-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <MapPin size={20} aria-hidden="true" />
              </div>
              <div>
                <h3 className="m-0 text-lg font-bold text-slate-800">Neighborhood Vibe</h3>
                <p className="m-0 text-sm text-slate-500">{report.analytics.neighborhoodVibe.label}</p>
              </div>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-2xl font-black text-slate-800 flex items-center gap-1">
                {report.analytics.neighborhoodVibe.score.toFixed(1)} <Star size={20} className="fill-yellow-400 text-yellow-400" />
              </span>
              <span className="text-xs text-slate-500 font-medium">Google Places</span>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {report.analytics.neighborhoodVibe.amenities.map((amenity, i) => (
              <div key={i} className="flex flex-col rounded-lg bg-slate-50 p-3 border border-slate-100">
                <span className="text-xs font-bold uppercase text-slate-400 mb-1">{amenity.type}</span>
                <span className="text-sm font-semibold text-slate-800 truncate">{amenity.name}</span>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full">{amenity.distance}</span>
                  {amenity.rating && (
                    <span className="text-xs font-bold text-slate-600 flex items-center gap-1">
                      {amenity.rating.toFixed(1)} <Star size={12} className="fill-yellow-400 text-yellow-400" />
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-4">
        {report.contentSections.map((section) => (
          <article className="report-section" key={section.title}>
            <div className="flex items-center gap-2">
              <BarChart3 size={18} aria-hidden="true" />
              <h3>{section.title}</h3>
            </div>
            <ul className="m-0 list-disc space-y-2 pl-5">
              {bodyToBullets(section.body).map((item, index) => (
                <li key={`${section.title}-${index}`}>{item}</li>
              ))}
            </ul>
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
