import { useEffect, useState } from "react";
import { BarChart3, CheckCircle2, Database, FileText, Search, ShieldCheck } from "lucide-react";

const steps = [
  { label: "Checking intelligence index", icon: Database },
  { label: "Analyzing PropertyGuru listings", icon: Search },
  { label: "Fetching Google Places vibe", icon: ShieldCheck },
  { label: "Synthesizing market sentiment", icon: BarChart3 },
  { label: "Report ready", icon: FileText },
];

export default function ReportWorkflowStatus({ active, startTime }: { active: boolean; startTime?: number }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!active) {
      setCurrentStep(0);
      setElapsed(0);
      return;
    }

    // Progress through steps every 1.2s to simulate AI thinking
    const stepInterval = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev >= steps.length - 1) {
          clearInterval(stepInterval);
          return prev;
        }
        return prev + 1;
      });
    }, 1200);

    // Stopwatch timer
    const elapsedInterval = startTime ? setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 250) : undefined;

    return () => {
      clearInterval(stepInterval);
      if (elapsedInterval) clearInterval(elapsedInterval);
    };
  }, [active, startTime]);

  return (
    <div className={`report-workflow ${active ? "is-active" : ""}`} aria-label="Report generation workflow" role="list">
      {active && (
        <div className="report-workflow-stopwatch" aria-live="polite">
          Generating report… {elapsed > 0 ? `(${elapsed}s)` : ""}
        </div>
      )}
      {steps.map((step, index) => {
        const isCompleted = active && index < currentStep;
        const isCurrent = active && index === currentStep;
        return (
          <div
            className={`report-workflow-step ${isCompleted ? "completed" : ""} ${isCurrent ? "current font-bold text-emerald-600" : ""}`}
            key={step.label}
            role="listitem"
          >
            <span className={`report-workflow-icon ${isCurrent ? "animate-pulse" : ""} ${isCompleted ? "text-emerald-500" : ""}`}>
              {isCompleted || (active && index === steps.length - 1) ? (
                <CheckCircle2 size={18} aria-hidden="true" />
              ) : (
                <step.icon size={18} aria-hidden="true" />
              )}
            </span>
            <span>{step.label}</span>
          </div>
        );
      })}
    </div>
  );
}
