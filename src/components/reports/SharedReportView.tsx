import { Building2, Download, Mail, Phone, ShieldCheck } from "lucide-react";
import { buildSharedReportPdfUrl } from "../../lib/api";
import type { Agent, PropertyReport } from "../../types";
import ReportCitationList from "./ReportCitationList";

function formatRm(value: number): string {
  return value > 0 ? `RM ${value.toLocaleString("en-MY")}` : "Available on request";
}

function labelValue(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default function SharedReportView({ agent, report }: { agent: Agent; report: PropertyReport }) {
  const input = report.inputSnapshot;

  return (
    <main className="shared-report-page">
      <section className="shared-report-shell">
        <header className="shared-report-header">
          <div className="brand-mark">
            <Building2 size={24} aria-hidden="true" />
          </div>
          <div>
            <p className="eyebrow">{agent.agencyName || "Signatis Realty"}</p>
            <h1>{report.title}</h1>
            <p>{report.address}</p>
          </div>
          <a className="primary-button" href={buildSharedReportPdfUrl(report.shareToken)} rel="noreferrer" target="_blank">
            <Download size={18} aria-hidden="true" />
            Download PDF
          </a>
        </header>

        <div className="shared-report-summary">
          <article>
            <span>Pricing signal</span>
            <strong>{report.marketSignal}</strong>
          </article>
          <article>
            <span>Asking price</span>
            <strong>{formatRm(input.askingPriceRm)}</strong>
          </article>
          <article>
            <span>Listing</span>
            <strong>{labelValue(input.listingIntent)} | {labelValue(input.tenure)}</strong>
          </article>
          <article>
            <span>Buyer sentiment</span>
            <strong>{report.analytics.sentiment}</strong>
          </article>
          <article>
            <span>Confidence</span>
            <strong>{Math.round(report.analytics.confidenceScore * 100)}%</strong>
          </article>
        </div>

        <section className="card p-6 md:p-8">
          <div className="flex items-start gap-3">
            <ShieldCheck size={22} className="mt-1 text-emerald-600" aria-hidden="true" />
            <div>
              <h2 className="m-0 text-2xl font-extrabold">Executive read</h2>
              <p className="m-0 mt-2 text-slate-700">{report.sentimentSummary}</p>
            </div>
          </div>
        </section>

        <div className="grid gap-4">
          {report.contentSections.map((section) => (
            <section className="card p-6 md:p-8" key={section.title}>
              <h2 className="m-0 text-2xl font-extrabold">{section.title}</h2>
              <p className="m-0 mt-3 text-slate-700">{section.body}</p>
            </section>
          ))}
        </div>

        <section className="card p-6 md:p-8">
          <h2 className="m-0 mb-4 text-2xl font-extrabold">Sources</h2>
          <ReportCitationList citations={report.citations} />
        </section>

        <footer className="shared-report-footer">
          <div>
            <strong>{agent.fullName}</strong>
            <span>{agent.renNumber || agent.plan}</span>
          </div>
          <div className="shared-report-contact">
            <a href={`mailto:${agent.email}`}>
              <Mail size={16} aria-hidden="true" />
              {agent.email}
            </a>
            <a href={`tel:${agent.phone}`}>
              <Phone size={16} aria-hidden="true" />
              {agent.phone}
            </a>
          </div>
        </footer>
      </section>
    </main>
  );
}
