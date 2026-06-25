import { useState } from "react";
import { Award, TrendingUp } from "lucide-react";
import type { PropertyReport } from "../../types";
import { deriveReportTrust } from "../../domain/reports";

function rm(value: number): string {
  return `RM ${Math.round(value).toLocaleString("en-MY")}`;
}

/**
 * Derives a recommended asking-price range for the listing pitch.
 * Prefers transacted/median data; falls back to the agent's input, clearly
 * labelled directional so a thin-data CMA is never passed off as precise.
 */
function recommendedRange(report: PropertyReport): { range: string; basis: string; directional: boolean } | null {
  const median = report.analytics.medianPrice ?? 0;
  const asking = report.inputSnapshot.askingPriceRm ?? 0;
  const compCount = report.comparableListings?.length ?? 0;
  const base = median > 0 ? median : asking;
  if (base <= 0) return null;

  const low = base * 0.96;
  const high = base * 1.04;
  if (median > 0) {
    return { range: `${rm(low)} – ${rm(high)}`, basis: `${compCount} comparable${compCount === 1 ? "" : "s"}`, directional: false };
  }
  return { range: `${rm(low)} – ${rm(high)}`, basis: "your input — no transacted comparables yet", directional: true };
}

export default function ListingPitchPanel({
  report,
  alreadyTracked,
  onTrack,
}: {
  report: PropertyReport;
  alreadyTracked: boolean;
  onTrack: (ownerName: string, recommendedRange: string) => void;
}) {
  const [ownerName, setOwnerName] = useState("");
  const trust = deriveReportTrust(report);
  const rec = recommendedRange(report);
  const firstName = ownerName.trim().split(" ")[0] || "there";

  return (
    <section
      className="card p-6 md:p-7 mb-6"
      style={{ border: "1px solid rgba(255,212,90,0.25)", background: "linear-gradient(135deg, rgba(255,212,90,0.06), rgba(255,255,255,0.02))" }}
    >
      <div className="flex items-center gap-2 mb-1" style={{ color: "#fbbf24" }}>
        <Award size={16} aria-hidden="true" />
        <span className="eyebrow" style={{ color: "#fbbf24" }}>Listing Pitch · CMA</span>
      </div>
      <h2 className="m-0 text-2xl font-extrabold">{report.propertyName}</h2>
      <p className="m-0 mt-1 text-slate-700">Win this mandate with a cited, client-ready market read.</p>

      {/* Recommended asking-price range */}
      <div className="mt-5 rounded-xl p-4" style={{ background: "rgba(0,0,0,0.22)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <p className="m-0 mb-1 text-xs font-bold uppercase tracking-wider" style={{ color: "rgba(247,247,244,0.45)", letterSpacing: "0.08em" }}>
          Recommended asking price
        </p>
        {rec ? (
          <>
            <p className="m-0 text-2xl font-extrabold flex items-center gap-2" style={{ color: "rgba(247,247,244,0.95)" }}>
              <TrendingUp size={20} aria-hidden="true" style={{ color: "#fbbf24" }} />
              {rec.range}
            </p>
            <p className="m-0 mt-1 text-xs" style={{ color: rec.directional ? "#fbbf24" : "rgba(247,247,244,0.5)" }}>
              Based on {rec.basis} · reliability: <strong>{trust.label} · {trust.score}%</strong>
              {rec.directional ? " — confirm against transacted data before quoting the owner." : "."}
            </p>
          </>
        ) : (
          <p className="m-0 text-sm" style={{ color: "#fbbf24" }}>
            Not enough data to recommend a price yet. Add comparables or an asking price first.
          </p>
        )}
      </div>

      {/* Pitch angle preview (what the agent says to the owner) */}
      <div className="mt-4 rounded-lg p-3 text-sm italic" style={{ background: "rgba(0,0,0,0.25)", color: "rgba(247,247,244,0.6)", border: "1px solid rgba(255,255,255,0.05)" }}>
        "Hi {firstName}, I've put together a market analysis for your property — here's where it sits today and how I'd price and position it to sell. Can we book 15 minutes?"
      </div>

      {/* Track the pitch */}
      {alreadyTracked ? (
        <p className="mt-4 mb-0 text-sm font-bold flex items-center gap-2" style={{ color: "#4ade80" }}>
          <Award size={15} aria-hidden="true" /> Tracked in your listing pipeline below.
        </p>
      ) : (
        <div className="mt-4 flex flex-wrap items-end gap-2">
          <label className="flex-1 min-w-[12rem]">
            <span className="block text-xs font-bold mb-1" style={{ color: "rgba(247,247,244,0.6)" }}>Owner name</span>
            <input
              className="input bg-[#121212] border-[#2d2d2d] w-full"
              placeholder="e.g. Encik Rahman"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
            />
          </label>
          <button
            className="primary-button btn-success"
            disabled={!ownerName.trim() || !rec}
            onClick={() => onTrack(ownerName.trim(), rec?.range ?? "—")}
            title={!rec ? "Need a price basis first" : !ownerName.trim() ? "Enter the owner's name" : undefined}
          >
            <Award size={16} aria-hidden="true" /> Track this pitch
          </button>
        </div>
      )}
    </section>
  );
}
