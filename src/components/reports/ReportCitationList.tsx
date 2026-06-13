import { ExternalLink } from "lucide-react";
import type { ReportCitation } from "../../types";

function sourceLabel(citation: ReportCitation): string | null {
  if (citation.sourceType === "official") return "Official";
  if (citation.sourceType === "community") return "Community";
  if (citation.sourceType === "model") return "Model";
  if (citation.sourceType === "other") return "Other";
  return null;
}

export default function ReportCitationList({ citations }: { citations: ReportCitation[] }) {
  if (citations.length === 0) {
    return <p className="m-0 text-slate-600">No citations were attached to this report.</p>;
  }

  return (
    <div className="grid gap-3">
      {citations.map((citation) => (
        <a
          className="report-citation"
          href={citation.url}
          key={`${citation.title}-${citation.url}`}
          rel="noreferrer"
          target="_blank"
        >
          <span className="min-w-0">
            <span className="report-citation-title">
              <strong>{citation.title}</strong>
              {sourceLabel(citation) ? <span className="report-source-tag">{sourceLabel(citation)}</span> : null}
            </span>
            {citation.snippet ? <span>{citation.snippet}</span> : null}
          </span>
          <ExternalLink size={16} aria-hidden="true" />
        </a>
      ))}
    </div>
  );
}
