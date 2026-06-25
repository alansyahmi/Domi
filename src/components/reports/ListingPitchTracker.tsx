import { Award, ChevronRight, Trophy, X } from "lucide-react";
import type { ListingPitch, PitchStage } from "../../types";

const STAGES: { key: PitchStage; label: string }[] = [
  { key: "pitched", label: "Pitched" },
  { key: "responded", label: "Responded" },
  { key: "won", label: "Won" },
];

function stageIndex(stage: PitchStage): number {
  const i = STAGES.findIndex((s) => s.key === stage);
  return i === -1 ? 0 : i;
}

function nextStage(stage: PitchStage): PitchStage | null {
  if (stage === "pitched") return "responded";
  if (stage === "responded") return "won";
  return null;
}

export default function ListingPitchTracker({
  pitches,
  onAdvance,
  onMarkLost,
}: {
  pitches: ListingPitch[];
  onAdvance: (id: string, stage: PitchStage) => void;
  onMarkLost: (id: string) => void;
}) {
  const won = pitches.filter((p) => p.stage === "won").length;
  const active = pitches.filter((p) => p.stage === "pitched" || p.stage === "responded").length;

  return (
    <section className="card p-6 md:p-7">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Trophy size={18} aria-hidden="true" style={{ color: "#fbbf24" }} />
          <h2 className="m-0 text-xl font-extrabold">Listing pipeline</h2>
        </div>
        <span className="text-sm" style={{ color: "rgba(247,247,244,0.55)" }}>
          <strong style={{ color: "#4ade80" }}>{won}</strong> won · {active} active
        </span>
      </div>
      <p className="m-0 mb-4 text-sm" style={{ color: "rgba(247,247,244,0.5)" }}>
        Every CMA you track lands here. Move it forward as the owner responds.
      </p>

      {pitches.length === 0 ? (
        <p className="m-0 text-sm italic" style={{ color: "rgba(247,247,244,0.4)" }}>
          No pitches yet. Generate a CMA above and click "Track this pitch."
        </p>
      ) : (
        <div className="grid gap-3">
          {pitches.map((p) => {
            const idx = stageIndex(p.stage);
            const next = nextStage(p.stage);
            const isClosed = p.stage === "won" || p.stage === "lost";
            return (
              <article
                key={p.id}
                className="rounded-xl p-4"
                style={{
                  background: p.stage === "won" ? "rgba(74,222,128,0.07)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${p.stage === "won" ? "rgba(74,222,128,0.25)" : "rgba(255,255,255,0.07)"}`,
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="m-0 font-bold truncate" style={{ color: "rgba(247,247,244,0.92)" }}>{p.property}</p>
                    <p className="m-0 text-xs truncate" style={{ color: "rgba(247,247,244,0.5)" }}>
                      {p.ownerName} · {p.recommendedRange} · {p.reliability}
                    </p>
                  </div>
                  {p.stage === "won" ? (
                    <span className="text-xs font-bold flex items-center gap-1 shrink-0" style={{ color: "#4ade80" }}>
                      <Trophy size={13} aria-hidden="true" /> Won → in inventory
                    </span>
                  ) : p.stage === "lost" ? (
                    <span className="text-xs font-bold shrink-0" style={{ color: "rgba(247,247,244,0.4)" }}>Lost</span>
                  ) : null}
                </div>

                {/* Stage stepper */}
                <div className="flex items-center gap-1.5 mt-3">
                  {STAGES.map((s, i) => (
                    <div key={s.key} className="flex items-center gap-1.5 flex-1">
                      <span
                        className="block rounded-full"
                        style={{
                          width: i <= idx && p.stage !== "lost" ? "0.6rem" : "0.45rem",
                          height: i <= idx && p.stage !== "lost" ? "0.6rem" : "0.45rem",
                          background: i <= idx && p.stage !== "lost" ? (p.stage === "won" ? "#4ade80" : "#fbbf24") : "rgba(255,255,255,0.15)",
                        }}
                      />
                      <span className="text-[0.62rem] font-bold uppercase tracking-wide" style={{ color: i <= idx && p.stage !== "lost" ? "rgba(247,247,244,0.8)" : "rgba(247,247,244,0.3)" }}>
                        {s.label}
                      </span>
                      {i < STAGES.length - 1 && <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />}
                    </div>
                  ))}
                </div>

                {!isClosed && (
                  <div className="flex items-center gap-2 mt-3">
                    {next && (
                      <button className="secondary-button btn-sm" onClick={() => onAdvance(p.id, next)}>
                        {next === "won" ? <><Trophy size={14} aria-hidden="true" /> Mark won</> : <>Mark responded <ChevronRight size={14} aria-hidden="true" /></>}
                      </button>
                    )}
                    <button className="ghost-button btn-sm" onClick={() => onMarkLost(p.id)} title="Mark as lost">
                      <X size={14} aria-hidden="true" /> Lost
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
