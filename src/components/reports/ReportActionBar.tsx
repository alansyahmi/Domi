import { Check, Copy, Download, ExternalLink } from "lucide-react";
import { useMemo, useState } from "react";
import { buildSharedReportPdfUrl, buildSharedReportUrl } from "../../lib/api";
import type { PropertyReport } from "../../types";

function absoluteShareUrl(token: string): string {
  const path = buildSharedReportUrl(token);
  if (typeof window === "undefined") return path;
  return new URL(path, window.location.origin).toString();
}

export default function ReportActionBar({ report }: { report: PropertyReport }) {
  const [copied, setCopied] = useState(false);
  const localOnly = report.id.startsWith("report_local_") || report.shareToken.startsWith("shr_local_") || report.shareToken.startsWith("shr_demo_");
  const sharePath = buildSharedReportUrl(report.shareToken);
  const shareUrl = useMemo(() => absoluteShareUrl(report.shareToken), [report.shareToken]);
  const pdfUrl = buildSharedReportPdfUrl(report.shareToken);

  async function copyShareLink() {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
      return;
    }

    window.prompt("Copy report link", shareUrl);
  }

  return (
    <div className="report-actions">
      {localOnly ? (
        <>
          <button className="secondary-button" disabled type="button">
            <Download size={18} aria-hidden="true" />
            PDF after sign-in
          </button>
          <button className="secondary-button" disabled type="button">
            <Copy size={18} aria-hidden="true" />
            Share after sign-in
          </button>
        </>
      ) : (
        <>
          <a className="secondary-button" href={pdfUrl} rel="noreferrer" target="_blank">
            <Download size={18} aria-hidden="true" />
            PDF
          </a>
          <button className="secondary-button" onClick={() => void copyShareLink()} type="button">
            {copied ? <Check size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}
            {copied ? "Copied" : "Copy link"}
          </button>
          <a className="primary-button" href={sharePath} rel="noreferrer" target="_blank">
            <ExternalLink size={18} aria-hidden="true" />
            Open share page
          </a>
        </>
      )}
    </div>
  );
}
