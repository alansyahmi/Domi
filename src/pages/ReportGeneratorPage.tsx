import { useState } from "react";
import ReportInputPanel from "../components/reports/ReportInputPanel";
import ReportResultPanel from "../components/reports/ReportResultPanel";
import ReportWorkflowStatus from "../components/reports/ReportWorkflowStatus";
import { formatDateTime } from "../lib/format";
import type { PropertyReport, PropertyReportInput } from "../types";

export default function ReportGeneratorPage({
  reports,
  leads,
  onCreateReport,
  onSendReport,
}: {
  reports: PropertyReport[];
  leads: import("../types").Lead[];
  onCreateReport: (input: PropertyReportInput) => Promise<PropertyReport>;
  onSendReport: (reportId: string, leadId: string) => Promise<void>;
}) {
  const [latest, setLatest] = useState<PropertyReport | null>(reports[0] ?? null);
  const [generating, setGenerating] = useState(false);

  return (
    <main className="page">
      <div className="report-generator-header">
        <div>
          <h1 className="section-title">Generate Property Report</h1>
          <p className="mt-4 max-w-3xl text-xl text-slate-600">
            Start with a property name. re:AI checks cached intelligence, enriches with research when needed, then packages analytics, citations, PDF, and share link.
          </p>
        </div>
        {latest ? (
          <div className="card report-latest-mini">
            <span>Latest</span>
            <strong>{latest.propertyName}</strong>
            <small>{formatDateTime(latest.generatedAt)}</small>
          </div>
        ) : null}
      </div>

      <div className="mt-8">
        <ReportWorkflowStatus active={generating} />
      </div>

      <div className="mt-8 grid grid-cols-1 xl:grid-cols-[minmax(28rem,0.9fr)_minmax(0,1.2fr)] gap-8">
        <ReportInputPanel
          onCreateReport={onCreateReport}
          onGeneratingChange={setGenerating}
          onReportCreated={setLatest}
        />

        {latest ? (
          <ReportResultPanel report={latest} leads={leads} onSendReport={onSendReport} />
        ) : (
          <section className="card report-empty-state p-8">
            <p className="eyebrow">Awaiting report</p>
            <h2 className="m-0 mt-2 text-3xl font-extrabold">Your generated report will appear here.</h2>
            <p className="m-0 mt-4 text-slate-600">
              The preview will include pricing trend, buyer sentiment, confidence, source citations, PDF export, and a client-ready share link.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
