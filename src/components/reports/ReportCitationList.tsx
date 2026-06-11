import { ExternalLink } from "lucide-react";
import type { ReportCitation } from "../../types";

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
            <strong>{citation.title}</strong>
            {citation.snippet ? <span>{citation.snippet}</span> : null}
          </span>
          <ExternalLink size={16} aria-hidden="true" />
        </a>
      ))}
    </div>
  );
}
