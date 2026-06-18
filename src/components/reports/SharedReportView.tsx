import { useState } from "react";
import { submitLeadInquiryApi, buildSharedReportPdfUrl } from "../../lib/api";
import type { Agent, PropertyReport } from "../../types";
import { Download, Mail, Phone, Send, CheckCircle, HelpCircle } from "lucide-react";
import ReportPricingPanel from "./ReportPricingPanel";

const faviconUrl = new URL("../../../favicon.png", import.meta.url).href;

export default function SharedReportView({
  agent,
  report,
}: {
  agent: Agent;
  report: PropertyReport;
}) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    message: "",
    preferredChannel: "whatsapp",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const formatPrice = (price: number) => {
    return price > 0 ? `RM ${price.toLocaleString("en-MY")}` : "TBD";
  };

  const handleInquirySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.phone) {
      setErrorMessage("Please fill in all required contact fields.");
      return;
    }
    setIsSubmitting(true);
    setErrorMessage("");
    try {
      const res = await submitLeadInquiryApi(report.shareToken, form);
      if (res.success) {
        setIsSuccess(true);
        setForm({ name: "", email: "", phone: "", message: "", preferredChannel: "whatsapp" });
      } else {
        setErrorMessage("Unable to submit your inquiry. Please try again.");
      }
    } catch (err) {
      console.error(err);
      setErrorMessage("An unexpected error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#1a1a1a] text-slate-800 antialiased font-sans">
      {/* Header bar */}
      <header className="sticky top-0 bg-[#1e1e1e]/90 backdrop-blur-md border-b border-[#2d2d2d] py-4 px-6 md:px-12 flex justify-between items-center z-40">
        <div className="flex items-center gap-2">
          <img src={faviconUrl} alt="" aria-hidden="true" className="brand-mark" />
          <span className="font-extrabold text-white tracking-tight">re:AI Insights</span>
        </div>
        <a
          href={buildSharedReportPdfUrl(report.shareToken)}
          target="_blank"
          rel="noreferrer"
          className="secondary-button btn-sm"
        >
          <Download size={16} />
          Download PDF
        </a>
      </header>

      {/* Main Grid */}
      <div className="max-w-[1440px] mx-auto px-6 md:px-12 py-8 grid grid-cols-1 lg:grid-cols-[1fr_20rem] xl:grid-cols-[1fr_24rem] gap-8">

        {/* Left Column: Report Insights */}
        <div className="space-y-8">
          {/* Main Title Card */}
          <div className="bg-[#1e1e1e] rounded-xl border border-[#2d2d2d] p-6 md:p-8 shadow-sm">
            <span className="text-xs uppercase text-slate-500 font-bold tracking-widest block mb-2">Market Valuation Analysis</span>
            <h1 className="text-3xl md:text-4xl font-extrabold text-white leading-tight m-0">{report.title}</h1>
            <p className="text-slate-500 mt-2 flex items-center gap-2">
              <span>{report.propertyType}</span>
              <span>•</span>
              <span>{report.sqft > 0 ? `${report.sqft.toLocaleString("en-MY")} sqft` : "Size TBD"}</span>
              <span>•</span>
              <span>{report.bedrooms} Bed / {report.bathrooms} Bath</span>
              {report.yearBuilt > 0 && (
                <>
                  <span>•</span>
                  <span>Built in {report.yearBuilt}</span>
                </>
              )}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8 pt-6 border-t border-slate-100">
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Market Readout</span>
                <p className="text-slate-700 m-0 font-medium leading-relaxed">{report.marketSignal || "No premium market signal detected."}</p>
              </div>
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Neighborhood Vibe</span>
                <p className="text-slate-700 m-0 font-medium leading-relaxed">{report.sentimentSummary || "Neighborly sentiment is stable."}</p>
              </div>
            </div>
          </div>

          {/* Pricing Panel Component */}
          <ReportPricingPanel report={report} variant="shared" />

          {/* Analysis Content Sections */}
          <section className="bg-[#1e1e1e] rounded-xl border border-[#2d2d2d] p-6 md:p-8 shadow-sm space-y-6">
            <h2 className="text-2xl font-extrabold text-white m-0">Detailed Assessment</h2>
            <div className="divide-y divide-slate-100">
              {report.contentSections && report.contentSections.map((section, idx) => (
                <div key={idx} className={`py-5 ${idx === 0 ? "pt-0" : ""}`}>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">{section.title}</h3>
                  <p className="text-slate-300 leading-relaxed m-0">{section.body}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Citations / Sources */}
          {report.citations && report.citations.length > 0 && (
            <section className="bg-[#1e1e1e] rounded-xl border border-[#2d2d2d] p-6 md:p-8 shadow-sm">
              <h2 className="text-xl font-extrabold text-white mb-4 m-0">Data Citations & References</h2>
              <ul className="space-y-3 m-0 pl-5 text-sm text-slate-300">
                {report.citations.map((cite, idx) => (
                  <li key={idx}>
                    {cite.url ? (
                      <a href={cite.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline font-medium">
                        {cite.title}
                      </a>
                    ) : (
                      cite.title)}
                    {cite.snippet && <p className="text-slate-500 text-xs mt-1 italic m-0">"{cite.snippet}"</p>}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* Right Column: Sidebar (Agent & Lead Inquiry Form) */}
        <div className="space-y-6">
          {/* Agent Card */}
          <div className="bg-[#1e1e1e] rounded-xl border border-[#2d2d2d] p-6 shadow-sm text-center">
            <div className="avatar mx-auto bg-[#1e1e1e] text-white font-bold text-2xl w-16 h-16 rounded-full flex items-center justify-center mb-4">
              {agent.avatarInitials}
            </div>
            <h2 className="text-xl font-extrabold m-0 text-slate-900">{agent.fullName}</h2>
            {agent.renNumber && <p className="text-xs text-slate-400 font-bold tracking-wider m-0 mt-1 uppercase">{agent.renNumber}</p>}
            {agent.agencyName && <p className="text-sm text-slate-500 m-0 mt-1">{agent.agencyName}</p>}
            {agent.bio && <p className="text-xs text-slate-500 italic mt-3 leading-relaxed border-t border-slate-100 pt-3">{agent.bio}</p>}

            <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col gap-2.5 text-sm">
              {agent.email && (
                <div className="flex items-center gap-2 justify-center text-slate-300">
                  <Mail size={16} />
                  <span>{agent.email}</span>
                </div>
              )}
              {agent.phone && (
                <div className="flex items-center gap-2 justify-center text-slate-300">
                  <Phone size={16} />
                  <span>{agent.phone}</span>
                </div>
              )}
            </div>
          </div>

          {/* Lead Inquiry Form */}
          <div className="bg-[#1e1e1e] rounded-xl border border-[#2d2d2d] p-6 shadow-sm sticky top-24">
            <h2 className="text-xl font-extrabold text-white mb-2 m-0">Inquire About Listing</h2>
            <p className="text-xs text-slate-500 mb-6">Leave your contact details and receive specialized assistance on this market segment.</p>

            {isSuccess ? (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-5 text-center" style={{ color: "#a7f3d0" }}>
                <CheckCircle size={36} className="mx-auto mb-3" style={{ color: "#6ee7b7" }} />
                <h3 className="text-lg font-bold m-0">Inquiry Submitted!</h3>
                <p className="text-sm mt-2">Your interest has been logged. The listing agent will connect with you shortly.</p>
              </div>
            ) : (
              <form onSubmit={handleInquirySubmit} className="space-y-4">
                {errorMessage && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-xs leading-relaxed" style={{ color: "#fca5a5" }}>
                    {errorMessage}
                  </div>
                )}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="Alan Syahmi"
                    className="w-full border border-[#2d2d2d] rounded-lg p-2.5 text-sm outline-none focus:border-white"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    placeholder="name@domain.com"
                    className="w-full border border-[#2d2d2d] rounded-lg p-2.5 text-sm outline-none focus:border-white"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Phone Number *</label>
                  <input
                    type="tel"
                    required
                    placeholder="+6012-3456789"
                    className="w-full border border-[#2d2d2d] rounded-lg p-2.5 text-sm outline-none focus:border-white"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Preferred Contact Channel *</label>
                  <select
                    className="w-full border border-[#2d2d2d] rounded-lg p-2.5 text-sm outline-none focus:border-white bg-[#1e1e1e]"
                    value={form.preferredChannel}
                    onChange={(e) => setForm({ ...form, preferredChannel: e.target.value })}
                  >
                    <option value="whatsapp">WhatsApp</option>
                    <option value="telegram">Telegram</option>
                    <option value="messenger">Facebook Messenger</option>
                    <option value="instagram">Instagram</option>
                    <option value="email">Email</option>
                    <option value="phone">Phone Call</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Message (Optional)</label>
                  <textarea
                    placeholder="Ask a question or request a viewing..."
                    rows={3}
                    className="w-full border border-[#2d2d2d] rounded-lg p-2.5 text-sm outline-none focus:border-white"
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="primary-button w-full"
                >
                  <Send size={16} />
                  {isSubmitting ? "Sending..." : "Submit Inquiry"}
                </button>
              </form>
            )}
          </div>
        </div>

      </div>
    </main>
  );
}
