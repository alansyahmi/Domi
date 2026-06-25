import { Clock, Flame, Sparkles, Trophy, Wallet } from "lucide-react";
import type { RoiLedger } from "../domain/roi";

function rmShort(value: number): string {
  if (value >= 1_000_000) return `RM ${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `RM ${Math.round(value / 1000)}k`;
  return `RM ${value}`;
}

export default function RoiLedgerBanner({ ledger }: { ledger: RoiLedger }) {
  const metrics = [
    { icon: Trophy, label: "Listings won", value: String(ledger.listingsWon), hero: true },
    {
      icon: Clock,
      label: "Median first reply",
      value: ledger.medianResponseMins == null ? "—" : ledger.medianResponseMins < 1 ? "<1 min" : `${Math.round(ledger.medianResponseMins)} min`,
    },
    { icon: Flame, label: "Hot leads surfaced", value: String(ledger.hotLeads) },
    { icon: Clock, label: "Hours saved", value: `${ledger.hoursSaved}h` },
    { icon: Wallet, label: "Deal value in play", value: rmShort(ledger.dealValueRm) },
  ];

  return (
    <section
      className="rounded-2xl p-5 md:p-6 mb-6"
      style={{
        background: "linear-gradient(135deg, rgba(255,212,90,0.08), rgba(255,255,255,0.02))",
        border: "1px solid rgba(255,212,90,0.22)",
      }}
    >
      <p className="m-0 mb-4 flex items-center gap-2 text-sm font-bold" style={{ color: "#fbbf24", letterSpacing: "0.03em" }}>
        <Sparkles size={15} aria-hidden="true" />
        This month, re:AI worked for you
      </p>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {metrics.map((m) => (
          <div key={m.label} className="flex flex-col gap-1">
            <m.icon size={16} aria-hidden="true" style={{ color: m.hero ? "#4ade80" : "rgba(247,247,244,0.45)" }} />
            <span className="text-2xl font-extrabold leading-none" style={{ color: m.hero ? "#4ade80" : "rgba(247,247,244,0.95)" }}>
              {m.value}
            </span>
            <span className="text-[0.7rem] font-bold uppercase tracking-wide" style={{ color: "rgba(247,247,244,0.4)" }}>
              {m.label}
            </span>
          </div>
        ))}
      </div>
      <p className="m-0 mt-4 text-xs" style={{ color: "rgba(247,247,244,0.4)" }}>
        Responded to {ledger.respondedPct}% of inbound · {ledger.activePitches} listing pitch{ledger.activePitches === 1 ? "" : "es"} in flight.
      </p>
    </section>
  );
}
