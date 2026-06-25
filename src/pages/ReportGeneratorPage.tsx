import { useState } from "react";
import { Award, Megaphone, UserCheck } from "lucide-react";
import ReportInputPanel from "../components/reports/ReportInputPanel";
import ReportResultPanel from "../components/reports/ReportResultPanel";
import ListingPitchPanel from "../components/reports/ListingPitchPanel";
import ListingPitchTracker from "../components/reports/ListingPitchTracker";
import { deriveReportTrust } from "../domain/reports";
import { demoPitches } from "../data/demo";
import { formatDateTime } from "../lib/format";
import type { ListingPitch, PitchStage, PropertyReport, PropertyReportInput } from "../types";

type Mode = "win-listing" | "advise-buyer" | "lead-magnet";

const MODES: { key: Mode; icon: typeof Award; title: string; blurb: string }[] = [
  { key: "win-listing", icon: Award, title: "Win the Listing", blurb: "CMA to earn the seller's mandate" },
  { key: "advise-buyer", icon: UserCheck, title: "Advise the Buyer", blurb: "Brief to justify or challenge a price" },
  { key: "lead-magnet", icon: Megaphone, title: "Lead Magnet", blurb: "Public capture page · coming next" },
];

const HEADERS: Record<Mode, { title: string; sub: string }> = {
  "win-listing": {
    title: "Reporter · Win the Listing",
    sub: "Generate a cited CMA to win the seller's mandate, then track every pitch from pitched to won.",
  },
  "advise-buyer": {
    title: "Reporter · Advise the Buyer",
    sub: "Generate a market brief to justify or challenge a property's price for your buyer.",
  },
  "lead-magnet": {
    title: "Reporter · Lead Magnet",
    sub: "Turn a listing into a public capture page that feeds the Omnibox. Coming next.",
  },
};

export default function ReportGeneratorPage({
  demoMode,
  reports,
  leads,
  onCreateReport,
  onSendReport,
  onDeletePropertyCache,
}: {
  demoMode?: boolean;
  reports: PropertyReport[];
  leads: import("../types").Lead[];
  onCreateReport: (input: PropertyReportInput) => Promise<PropertyReport>;
  onSendReport: (reportId: string, leadId: string) => Promise<void>;
  onDeletePropertyCache: (propertyName: string) => Promise<void>;
}) {
  const [latest, setLatest] = useState<PropertyReport | null>(reports[0] ?? null);
  const [generating, setGenerating] = useState(false);
  const [startTime, setStartTime] = useState<number | undefined>(undefined);
  const [mode, setMode] = useState<Mode>("win-listing");
  const [pitches, setPitches] = useState<ListingPitch[]>(() => (demoMode ? demoPitches : []));

  const header = HEADERS[mode];
  const alreadyTracked = !!latest && pitches.some((p) => p.property === latest.propertyName);

  function trackPitch(ownerName: string, recommendedRange: string) {
    if (!latest) return;
    const trust = deriveReportTrust(latest);
    setPitches((prev) => [
      {
        id: `pitch_${Date.now()}`,
        property: latest.propertyName,
        ownerName,
        recommendedRange,
        reliability: `${trust.label} · ${trust.score}%`,
        stage: "pitched",
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ]);
  }

  const advancePitch = (id: string, stage: PitchStage) =>
    setPitches((prev) => prev.map((p) => (p.id === id ? { ...p, stage } : p)));
  const markLost = (id: string) =>
    setPitches((prev) => prev.map((p) => (p.id === id ? { ...p, stage: "lost" } : p)));

  return (
    <main className="page">
      <div className="report-generator-header">
        <div>
          <h1 className="section-title">{header.title}</h1>
          <p className="mt-4 max-w-3xl text-xl text-slate-600">{header.sub}</p>
        </div>
        {latest ? (
          <div className="card report-latest-mini">
            <span>Latest</span>
            <strong>{latest.propertyName}</strong>
            <small>{formatDateTime(latest.generatedAt)}</small>
          </div>
        ) : null}
      </div>

      {/* Mode selector */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
        {MODES.map((m) => {
          const active = m.key === mode;
          return (
            <button
              key={m.key}
              onClick={() => setMode(m.key)}
              className="card text-left p-4 transition-all"
              style={{
                border: `1px solid ${active ? "rgba(255,212,90,0.5)" : "rgba(255,255,255,0.07)"}`,
                background: active ? "linear-gradient(135deg, rgba(255,212,90,0.08), rgba(255,255,255,0.02))" : undefined,
                cursor: "pointer",
              }}
            >
              <m.icon size={18} aria-hidden="true" style={{ color: active ? "#fbbf24" : "rgba(247,247,244,0.55)" }} />
              <p className="m-0 mt-2 font-bold" style={{ color: active ? "rgba(247,247,244,0.95)" : "rgba(247,247,244,0.8)" }}>{m.title}</p>
              <p className="m-0 mt-0.5 text-xs" style={{ color: "rgba(247,247,244,0.5)" }}>{m.blurb}</p>
            </button>
          );
        })}
      </div>

      <div className="mt-6 grid grid-cols-1 xl:grid-cols-[minmax(28rem,0.9fr)_minmax(0,1.2fr)] gap-8">
        <ReportInputPanel
          onCreateReport={onCreateReport}
          onGeneratingChange={setGenerating}
          onReportCreated={setLatest}
          onGenerationStart={setStartTime}
          cachedReports={reports}
          onDeletePropertyCache={onDeletePropertyCache}
          generating={generating}
          startTime={startTime}
        />

        <div className="grid gap-6">
          {mode === "lead-magnet" && (
            <section className="card p-6" style={{ border: "1px dashed rgba(255,255,255,0.15)" }}>
              <div className="flex items-center gap-2" style={{ color: "rgba(247,247,244,0.6)" }}>
                <Megaphone size={18} aria-hidden="true" />
                <strong>Lead Magnet mode is coming next.</strong>
              </div>
              <p className="m-0 mt-2 text-sm" style={{ color: "rgba(247,247,244,0.5)" }}>
                This will turn the report into a public, mobile-first capture page + a distribution kit (Facebook / WhatsApp copy) that feeds new leads straight into the Omnibox. For now, generate a report to preview the intelligence.
              </p>
            </section>
          )}

          {latest ? (
            <>
              {mode === "win-listing" && (
                <ListingPitchPanel report={latest} alreadyTracked={alreadyTracked} onTrack={trackPitch} />
              )}
              <ReportResultPanel report={latest} leads={leads} onSendReport={onSendReport} />
            </>
          ) : (
            <section className="card report-empty-state p-8">
              <p className="eyebrow">Awaiting report</p>
              <h2 className="m-0 mt-2 text-3xl font-extrabold">Your generated report will appear here.</h2>
              <p className="m-0 mt-4 text-slate-600">
                {mode === "win-listing"
                  ? "Generate a CMA, get a recommended asking-price range, then track the pitch to won."
                  : "The preview includes pricing trend, buyer sentiment, reliability, source citations, PDF export, and a client-ready share link."}
              </p>
            </section>
          )}
        </div>
      </div>

      {mode === "win-listing" && (
        <div className="mt-8">
          <ListingPitchTracker pitches={pitches} onAdvance={advancePitch} onMarkLost={markLost} />
        </div>
      )}
    </main>
  );
}
