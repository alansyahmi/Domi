import { Check, Copy, Download, ExternalLink, Mail, Send } from "lucide-react";
import { useMemo, useState } from "react";
import { buildSharedReportPdfUrl, buildSharedReportUrl } from "../../lib/api";
import type { PropertyReport } from "../../types";

function absoluteShareUrl(token: string): string {
  const path = buildSharedReportUrl(token);
  if (typeof window === "undefined") return path;
  return new URL(path, window.location.origin).toString();
}

export default function ReportActionBar({ 
  report,
  leads = [],
  onSendReport
}: { 
  report: PropertyReport;
  leads?: import("../../types").Lead[];
  onSendReport?: (reportId: string, leadId: string) => Promise<void>;
}) {
  const [copied, setCopied] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [reviewed, setReviewed] = useState(false);

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

  async function handleSend() {
    if (!selectedLeadId || !onSendReport) return;
    setIsSending(true);
    try {
      await onSendReport(report.id, selectedLeadId);
      setShowSendModal(false);
      setShowSuccess(true);
      window.setTimeout(() => setShowSuccess(false), 4000);
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Failed to send report.");
    } finally {
      setIsSending(false);
    }
  }

  const sendActionUi = showSendModal ? (
    <div className="flex flex-wrap items-center gap-2 bg-white border border-slate-200 rounded-lg p-1 pr-2 shadow-sm">
      <select 
        className="select py-1.5 text-sm bg-slate-50 border-0" 
        value={selectedLeadId}
        onChange={e => setSelectedLeadId(e.target.value)}
      >
        <option value="">Select prospect...</option>
        {leads.map(lead => <option key={lead.id} value={lead.id}>{lead.name} ({lead.email})</option>)}
      </select>
      <button
        className="primary-button btn-sm"
        onClick={() => void handleSend()}
        disabled={!selectedLeadId || isSending}
      >
        {isSending ? "Sending..." : <><Send size={14} /> Send</>}
      </button>
      <button
        className="ghost-button"
        onClick={() => setShowSendModal(false)}
      >
        Cancel
      </button>
    </div>
  ) : (
    <button className="primary-button" onClick={() => setShowSendModal(true)} type="button" disabled={!reviewed} title={!reviewed ? "Confirm you've reviewed the report first" : undefined}>
      <Mail size={18} aria-hidden="true" />
      {localOnly ? "Email to Prospect (Demo)" : "Email to Prospect"}
    </button>
  );

  return (
    <>
      <label
        className="flex items-start gap-2.5 mb-3 cursor-pointer select-none"
        style={{ fontSize: "0.85rem", color: "rgba(247,247,244,0.78)" }}
      >
        <input
          type="checkbox"
          checked={reviewed}
          onChange={(e) => setReviewed(e.target.checked)}
          style={{ marginTop: "0.15rem", width: "1rem", height: "1rem", accentColor: "#fbbf24", flexShrink: 0 }}
        />
        <span>
          I've reviewed this report and take responsibility for what's shared with a client.
          {!reviewed && <span style={{ color: "rgba(247,247,244,0.45)" }}> Sharing is locked until you confirm.</span>}
        </span>
      </label>

      <div className="report-actions flex-wrap gap-3" style={!reviewed ? { opacity: 0.55, pointerEvents: "none" } : undefined} aria-disabled={!reviewed}>
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
            {sendActionUi}
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
            <a className="secondary-button" href={sharePath} rel="noreferrer" target="_blank">
              <ExternalLink size={18} aria-hidden="true" />
              Open share page
            </a>
            {sendActionUi}
          </>
        )}
      </div>

      {showSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/20 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 flex flex-col items-center text-center animate-in zoom-in-95 duration-200" style={{ background: "#2a2a2a" }}>
            <div className="h-16 w-16 rounded-full flex items-center justify-center mb-5" style={{ background: "rgba(5, 150, 105, 0.15)", color: "#6ee7b7" }}>
              <Check size={32} strokeWidth={3} />
            </div>
            <h3 className="text-xl font-extrabold mb-2" style={{ color: "rgba(247,247,244,0.92)" }}>Report Sent!</h3>
            <p className="text-slate-600 mb-8 leading-relaxed">
              The property report was successfully delivered to your prospect. They'll be able to view it instantly.
            </p>
            <button 
              className="primary-button w-full justify-center text-base py-2.5" 
              onClick={() => setShowSuccess(false)}
            >
              Continue
            </button>
          </div>
        </div>
      )}
    </>
  );
}
