import { BarChart3, CheckCircle2, Database, FileText, Search, ShieldCheck } from "lucide-react";

const steps = [
  { label: "Index lookup", icon: Database },
  { label: "Live research", icon: Search },
  { label: "Validate/store", icon: ShieldCheck },
  { label: "Analytics", icon: BarChart3 },
  { label: "Report ready", icon: FileText },
];

export default function ReportWorkflowStatus({ active }: { active: boolean }) {
  return (
    <div className={`report-workflow ${active ? "is-active" : ""}`} aria-label="Report generation workflow" role="list">
      {steps.map((step, index) => (
        <div className="report-workflow-step" key={step.label} role="listitem">
          <span className="report-workflow-icon">
            {active && index === steps.length - 1 ? (
              <CheckCircle2 size={18} aria-hidden="true" />
            ) : (
              <step.icon size={18} aria-hidden="true" />
            )}
          </span>
          <span>{step.label}</span>
        </div>
      ))}
    </div>
  );
}
