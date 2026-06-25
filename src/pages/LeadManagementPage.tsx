import { Download, Frown, Meh, Search, SlidersHorizontal, Smile, Eye, Trash2, Plus, X, Calendar, Mail, Phone, DollarSign, MapPin, Sparkles, Send } from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import { initials, sourceTone } from "../lib/format";
import type { Lead, LeadStage, Sentiment, LeadEvent } from "../types";
import { ChannelContactButton, ChannelBadge } from "../components/leads/ChannelContactButton";

function SentimentIcon({ sentiment }: { sentiment: Sentiment }) {
  if (sentiment === "positive") return <Smile size={22} className="text-emerald-600" aria-hidden="true" />;
  if (sentiment === "negative") return <Frown size={22} className="text-red-600" aria-hidden="true" />;
  return <Meh size={22} className="text-slate-300" aria-hidden="true" />;
}

export default function LeadManagementPage({
  leads,
  onCreateLead,
  onDeleteLead,
  onGetLeadEvents,
  onUpdateLeadStage,
  onSendLeadMessage,
  onSetLeadTelegramChatId,
}: {
  leads: Lead[];
  onCreateLead: (input: {
    name: string;
    email: string;
    phone: string;
    source: string;
    propertyInterest: string;
    budget: string;
    message?: string;
    preferredChannel?: string;
  }) => Promise<Lead>;
  onDeleteLead: (leadId: string) => Promise<void>;
  onGetLeadEvents: (leadId: string) => Promise<LeadEvent[]>;
  onUpdateLeadStage: (leadId: string, stage: string) => Promise<void>;
  onSendLeadMessage?: (leadId: string, text: string) => Promise<void>;
  onSetLeadTelegramChatId?: (leadId: string, chatId: string) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [intent, setIntent] = useState("all");
  const [source, setSource] = useState("all");
  const [sentiment, setSentiment] = useState("all");
  const [stageFilter, setStageFilter] = useState("all");

  // Detail Modal / Drawer State
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [leadEvents, setLeadEvents] = useState<LeadEvent[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [outreachError, setOutreachError] = useState<string | null>(null);
  const [outreachSent, setOutreachSent] = useState(false);
  const [telegramChatIdDraft, setTelegramChatIdDraft] = useState("");
  const [isSavingChatId, setIsSavingChatId] = useState(false);
  const [chatIdSaved, setChatIdSaved] = useState(false);

  // Manual Add Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newLeadForm, setNewLeadForm] = useState({
    name: "",
    email: "",
    phone: "",
    source: "Direct Inquiry",
    propertyInterest: "",
    budget: "",
    message: "",
    preferredChannel: "whatsapp",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  // Fetch events when active lead changes
  useEffect(() => {
    if (selectedLead) {
      setIsLoadingEvents(true);
      setOutreachError(null);
      setOutreachSent(false);
      setTelegramChatIdDraft(selectedLead.telegramChatId ?? "");
      setChatIdSaved(false);
      onGetLeadEvents(selectedLead.id)
        .then(setLeadEvents)
        .catch(console.error)
        .finally(() => setIsLoadingEvents(false));
    } else {
      setLeadEvents([]);
    }
  }, [selectedLead, onGetLeadEvents]);

  // Close peek card on Escape
  useEffect(() => {
    if (!selectedLead) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedLead(null);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [selectedLead]);

  const sources = useMemo(() => Array.from(new Set(leads.map((lead) => lead.source))), [leads]);
  
  const filtered = leads.filter((lead) => {
    const search = `${lead.name} ${lead.email} ${lead.propertyInterest}`.toLowerCase();
    return (
      search.includes(query.toLowerCase()) &&
      (intent === "all" || String(lead.intent) === intent) &&
      (source === "all" || lead.source === source) &&
      (sentiment === "all" || lead.sentiment === sentiment) &&
      (stageFilter === "all" || lead.stage === stageFilter)
    );
  });
  
  const hotCount = leads.filter((lead) => lead.intent === 1).length;
  const avgEngagement = leads.length > 0 ? Math.round(
    leads.reduce((total, lead) => total + Math.min(100, lead.emailOpens * 5 + lead.linkClicks * 8), 0) / leads.length
  ) : 0;

  async function handleAddLead(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!newLeadForm.name || !newLeadForm.email || !newLeadForm.phone || !newLeadForm.propertyInterest || !newLeadForm.budget) {
      setFormError("Please fill in all required fields.");
      return;
    }
    setIsSubmitting(true);
    try {
      await onCreateLead(newLeadForm);
      setIsAddModalOpen(false);
      setFormError(null);
      setNewLeadForm({
        name: "",
        email: "",
        phone: "",
        source: "Direct Inquiry",
        propertyInterest: "",
        budget: "",
        message: "",
        preferredChannel: "whatsapp",
      });
    } catch (err) {
      console.error(err);
      setFormError("Failed to add prospect. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function stageColor(stage: string): string {
    const map: Record<string, string> = {
      new: "tag-muted",
      contacted: "tag-blue",
      engaged: "tag-violet",
      viewing: "tag-blue",
      negotiating: "tag-violet",
      closed_won: "tag-blue",
      closed_lost: "tag-muted",
    };
    return map[stage] ?? "tag-muted";
  }

  async function handleDeleteLead(leadId: string, confirmed = false) {
    if (!confirmed) {
      setPendingDeleteId(leadId);
      return;
    }
    try {
      await onDeleteLead(leadId);
      setSelectedLead(null);
      setPendingDeleteId(null);
    } catch (err) {
      console.error(err);
      setPendingDeleteId(null);
    }
  }

  async function handleActionableOutreach() {
    if (!selectedLead || !onSendLeadMessage) return;
    setIsSendingMessage(true);
    setOutreachError(null);
    setOutreachSent(false);
    try {
      const template = `Hi ${selectedLead.name.split(" ")[0]}, I saw you were looking at ${selectedLead.propertyInterest || "some properties"} recently. Are you still searching? I have some new exclusive insights I can share with you!`;
      await onSendLeadMessage(selectedLead.id, template);
      setOutreachSent(true);
      setTimeout(() => {
        setIsSendingMessage(false);
      }, 500);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to send message.";
      setOutreachError(msg);
      setIsSendingMessage(false);
    }
  }

  async function handleSaveTelegramChatId() {
    if (!selectedLead || !onSetLeadTelegramChatId) return;
    setIsSavingChatId(true);
    setChatIdSaved(false);
    try {
      await onSetLeadTelegramChatId(selectedLead.id, telegramChatIdDraft.trim());
      setSelectedLead({ ...selectedLead, telegramChatId: telegramChatIdDraft.trim() || undefined });
      setChatIdSaved(true);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSavingChatId(false);
    }
  }

  function handleExport() {
    if (filtered.length === 0) return;
    const headers = ["Name", "Email", "Phone", "Source", "Property Interest", "Budget", "Score", "Intent", "Tier", "Sentiment", "Stage", "Preferred Channel", "Email Opens", "Link Clicks", "Report Views"];
    const rows = filtered.map((lead) => [
      lead.name, lead.email, lead.phone, lead.source, lead.propertyInterest,
      lead.budget, lead.score, lead.intent, lead.tier, lead.sentiment,
      lead.stage, lead.preferredChannel, lead.emailOpens, lead.linkClicks, lead.reportViews,
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `prospects-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="page relative">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <h1 className="section-title">Omnibox</h1>
          <p className="mt-4 text-xl text-slate-700">Analyze and prioritize prospects based on behavioral data.</p>
        </div>
        <div className="flex gap-3">
          <button className="primary-button flex items-center gap-2" onClick={() => setIsAddModalOpen(true)}>
            <Plus size={19} aria-hidden="true" />
            Add Prospect
          </button>
          <button className="secondary-button" onClick={handleExport} disabled={filtered.length === 0} title={filtered.length === 0 ? "No prospects to export" : `Export ${filtered.length} prospect${filtered.length === 1 ? "" : "s"} as CSV`}>
            <Download size={19} aria-hidden="true" />
            Export
          </button>
        </div>
      </div>

      <section className="card mt-8 p-5">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(14rem,1fr)_repeat(4,12rem)_auto] gap-4 items-center">
          <label className="flex items-center gap-3 rounded-full border border-[#2d2d2d] bg-[#1e1e1e] px-4 py-2">
            <Search size={20} className="text-slate-500" aria-hidden="true" />
            <input
              className="w-full border-0 outline-none bg-transparent"
              placeholder="Search leads, properties..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <select className="select" value={intent} onChange={(event) => setIntent(event.target.value)}>
            <option value="all">Intent: All</option>
            <option value="1">Intent: 1 (High)</option>
            <option value="0">Intent: 0 (Low)</option>
          </select>
          <select className="select" value={source} onChange={(event) => setSource(event.target.value)}>
            <option value="all">Source: All</option>
            {sources.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <select className="select" value={sentiment} onChange={(event) => setSentiment(event.target.value)}>
            <option value="all">Sentiment: All</option>
            <option value="positive">Positive</option>
            <option value="neutral">Neutral</option>
            <option value="negative">Negative</option>
          </select>
          <select className="select" value={stageFilter} onChange={(event) => setStageFilter(event.target.value)}>
            <option value="all">Stage: All</option>
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="engaged">Engaged</option>
            <option value="viewing">Viewing</option>
            <option value="negotiating">Negotiating</option>
            <option value="closed_won">Closed Won</option>
            <option value="closed_lost">Closed Lost</option>
          </select>
          <button
            className="ghost-button"
            onClick={() => {
              setQuery("");
              setIntent("all");
              setSource("all");
              setSentiment("all");
              setStageFilter("all");
            }}
          >
            Clear Filters
          </button>
        </div>
      </section>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-[repeat(3,1fr)_minmax(16rem,1fr)] gap-5">
        <section className="card p-6">
          <p className="metric-label">Total Leads</p>
          <strong className="text-3xl">{leads.length.toLocaleString()}</strong>
          <p className="text-slate-400 mt-2 text-sm">Total in pipeline</p>
        </section>
        <section className="card p-6">
          <p className="metric-label">High Intent (Score 1)</p>
          <strong className="text-3xl">{hotCount}</strong>
          <p className="text-slate-400 mt-2 text-sm">Binary intent score</p>
        </section>
        <section className="card p-6">
          <p className="metric-label">Avg Engagement</p>
          <strong className="text-3xl">{avgEngagement}%</strong>
          <p className="text-slate-400 mt-2 text-sm">Email opens + link clicks</p>
        </section>
        <section className="card p-6 bg-[#1e1e1e] text-white relative overflow-hidden">
          <SlidersHorizontal size={22} className="opacity-70" aria-hidden="true" />
          <p className="mt-2 text-slate-300">Priority Actions</p>
          <strong className="text-2xl">{hotCount} Hot Leads</strong>
          <p className="text-slate-300">Review now</p>
        </section>
      </div>

      <section className="card mt-8 overflow-hidden">
        <div className="hidden lg:grid grid-cols-[2fr_0.7fr_1.2fr_1.2fr_1.2fr_1fr_auto] gap-6 px-8 py-5 bg-slate-100 eyebrow">
          <span>Prospect Name</span>
          <span>Score</span>
          <span>Engagement</span>
          <span>Sentiment</span>
          <span>Stage</span>
          <span>Source</span>
          <span>Actions</span>
        </div>
        {filtered.map((lead) => (
          <article
            key={lead.id}
            className="grid grid-cols-1 lg:grid-cols-[2fr_0.7fr_1.2fr_1.2fr_1.2fr_1fr_auto] gap-4 lg:gap-6 px-6 lg:px-8 py-6 border-t border-[#2d2d2d] items-center"
          >
            <div className="flex items-center gap-4">
              <div className="avatar small bg-[#1e1e1e] text-white">{initials(lead.name)}</div>
              <div>
                <h2 className="m-0 text-xl font-extrabold">{lead.name}</h2>
                <p className="m-0 text-slate-300">{lead.email}</p>
                <span className="mt-0.5 inline-block"><ChannelBadge channel={lead.preferredChannel} /></span>
              </div>
            </div>
            <div className={`intent-badge ${lead.intent === 0 ? "zero" : ""}`}>{lead.intent}</div>
            <div>
              <div className="flex gap-8 text-sm">
                <span>Opens: {lead.emailOpens}</span>
                <span>Clicks: {lead.linkClicks}</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-slate-200 overflow-hidden">
                <div
                  className="h-full bg-[#1e1e1e]"
                  style={{ width: `${Math.min(100, lead.emailOpens * 6 + lead.linkClicks * 9)}%` }}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <SentimentIcon sentiment={lead.sentiment} />
              <span className="capitalize">{lead.sentiment}</span>
            </div>
            <div>
              <span className={`tag ${stageColor(lead.stage)}`}>{lead.stage.replace("_", " ")}</span>
            </div>
            <div>
              <span className={`tag ${sourceTone(lead.source)}`}>{lead.source}</span>
            </div>
            <div className="flex gap-2 items-center">
              {pendingDeleteId === lead.id ? (
                <>
                  <span className="text-xs text-slate-400 whitespace-nowrap">Delete?</span>
                  <button className="icon-button btn-sm btn-danger" onClick={() => void handleDeleteLead(lead.id, true)} title="Confirm delete">
                    <Trash2 size={16} />
                  </button>
                  <button className="icon-button btn-sm" onClick={() => setPendingDeleteId(null)} title="Cancel">
                    <X size={16} />
                  </button>
                </>
              ) : (
                <>
                  <button className="icon-button btn-sm" onClick={() => setSelectedLead(lead)} title="View Lead Profile">
                    <Eye size={18} />
                  </button>
                  <button className="icon-button btn-sm btn-danger" onClick={() => handleDeleteLead(lead.id)} title="Delete Lead">
                    <Trash2 size={18} />
                  </button>
                </>
              )}
            </div>
          </article>
        ))}
        {filtered.length === 0 && (
          <div className="p-8 text-center text-slate-500">No prospects matched your search.</div>
        )}
      </section>

      {/* LEAD PROFILE PEEK CARD */}
      {selectedLead && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="lead-profile-title"
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedLead(null); }}
        >
          <div
            className="w-full max-w-lg max-h-[88vh] overflow-y-auto rounded-2xl shadow-2xl"
            style={{
              background: "linear-gradient(180deg, rgba(42,42,42,0.98), rgba(32,32,32,0.98))",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            {/* ── Header ── */}
            <div className="flex items-start justify-between gap-3 px-6 pt-6 pb-3">
              <div className="flex items-center gap-3.5 min-w-0">
                <div
                  className="avatar"
                  style={{
                    width: "3.25rem",
                    height: "3.25rem",
                    fontSize: "1.25rem",
                    background: "linear-gradient(135deg, rgba(255,255,255,0.12), rgba(255,255,255,0.05))",
                    flexShrink: 0,
                  }}
                >
                  {initials(selectedLead.name)}
                </div>
                <div className="min-w-0">
                  <h2
                    id="lead-profile-title"
                    className="text-xl font-extrabold m-0 truncate"
                    style={{ color: "rgba(247,247,244,0.97)" }}
                  >
                    {selectedLead.name}
                  </h2>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className={`tag text-xs ${sourceTone(selectedLead.source)}`}>{selectedLead.source}</span>
                    <ChannelBadge channel={selectedLead.preferredChannel} />
                  </div>
                </div>
              </div>
              <button
                className="icon-button btn-sm"
                onClick={() => setSelectedLead(null)}
                aria-label="Close"
                style={{ flexShrink: 0 }}
              >
                <X size={18} />
              </button>
            </div>

            {/* ── Score strip ── */}
            <div className="flex items-center gap-3 px-6 pb-4 flex-wrap">
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-extrabold"
                style={{
                  background: selectedLead.intent === 1 ? "rgba(255,212,90,0.15)" : "rgba(255,255,255,0.05)",
                  color: selectedLead.intent === 1 ? "#ffd45a" : "rgba(247,247,244,0.5)",
                }}
              >
                Intent {selectedLead.intent}
              </span>
              <span
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold"
                style={{
                  background:
                    selectedLead.tier === "Hot" ? "rgba(251,191,36,0.15)" :
                    selectedLead.tier === "Warm" ? "rgba(96,165,250,0.15)" :
                    "rgba(255,255,255,0.04)",
                  color:
                    selectedLead.tier === "Hot" ? "#fbbf24" :
                    selectedLead.tier === "Warm" ? "#93c5fd" :
                    "rgba(247,247,244,0.5)",
                  border: "1px solid",
                  borderColor:
                    selectedLead.tier === "Hot" ? "rgba(251,191,36,0.25)" :
                    selectedLead.tier === "Warm" ? "rgba(96,165,250,0.25)" :
                    "rgba(255,255,255,0.06)",
                }}
              >
                {selectedLead.tier}
              </span>
              <span className="text-xs font-bold" style={{ color: "rgba(247,247,244,0.4)" }}>
                Score {selectedLead.score}
              </span>
            </div>

            {/* ── Divider ── */}
            <div className="mx-6" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }} />

            {/* ── Contact row ── */}
            <div className="px-6 py-4">
              <div className="flex items-stretch gap-2">
                <a
                  href={`mailto:${selectedLead.email}`}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    color: "rgba(247,247,244,0.85)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    textDecoration: "none",
                  }}
                >
                  <Mail size={16} />
                  Email
                </a>
                <a
                  href={`tel:${selectedLead.phone}`}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    color: "rgba(247,247,244,0.85)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    textDecoration: "none",
                  }}
                >
                  <Phone size={16} />
                  Call
                </a>
                <ChannelContactButton lead={selectedLead} size="sm" />
              </div>
            </div>

            {/* ── Divider ── */}
            <div className="mx-6" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }} />

            {/* ── Interest + Budget ── */}
            <div className="px-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider m-0 mb-1" style={{ color: "rgba(247,247,244,0.35)", letterSpacing: "0.08em" }}>
                    Property
                  </p>
                  <p className="text-sm font-bold m-0 flex items-center gap-1.5" style={{ color: "rgba(247,247,244,0.9)" }}>
                    <MapPin size={14} style={{ color: "rgba(247,247,244,0.35)", flexShrink: 0 }} />
                    {selectedLead.propertyInterest}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider m-0 mb-1" style={{ color: "rgba(247,247,244,0.35)", letterSpacing: "0.08em" }}>
                    Budget
                  </p>
                  <p className="text-sm font-bold m-0 flex items-center gap-1.5" style={{ color: "rgba(247,247,244,0.9)" }}>
                    <DollarSign size={14} style={{ color: "rgba(247,247,244,0.35)", flexShrink: 0 }} />
                    {selectedLead.budget}
                  </p>
                </div>
              </div>
            </div>

            {/* ── Divider ── */}
            <div className="mx-6" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }} />

            {/* ── Pipeline stepper ── */}
            <div className="px-6 py-4">
              <p className="text-xs font-bold uppercase tracking-wider m-0 mb-3" style={{ color: "rgba(247,247,244,0.35)", letterSpacing: "0.08em" }}>
                Pipeline
              </p>
              <div className="flex items-center gap-0">
                {(["new", "contacted", "engaged", "viewing", "negotiating", "closed_won", "closed_lost"] as const).map((stage, i, arr) => {
                  const isActive = selectedLead.stage === stage;
                  const isPast = arr.indexOf(selectedLead.stage) >= arr.indexOf(stage);
                  return (
                    <div key={stage} className="flex items-center flex-1 min-w-0" style={{ flex: i < arr.length - 1 ? "1 1 0%" : "0 0 auto" }}>
                      <button
                        onClick={() => {
                          onUpdateLeadStage(selectedLead.id, stage);
                          setSelectedLead({ ...selectedLead, stage, lastContactedAt: new Date().toISOString() });
                        }}
                        className="flex flex-col items-center gap-1 group relative"
                        style={{ background: "none", border: "none", cursor: "pointer", padding: 0, minWidth: 0 }}
                        title={stage.replace("_", " ")}
                      >
                        <span
                          className="block rounded-full transition-all"
                          style={{
                            width: isActive ? "0.85rem" : "0.55rem",
                            height: isActive ? "0.85rem" : "0.55rem",
                            background: isActive ? "#ffd45a" : isPast ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.1)",
                            boxShadow: isActive ? "0 0 10px rgba(255,212,90,0.4)" : "none",
                          }}
                        />
                        <span
                          className="text-[0.6rem] font-bold uppercase tracking-wider whitespace-nowrap transition-colors"
                          style={{
                            color: isActive ? "rgba(247,247,244,0.95)" : "rgba(247,247,244,0.3)",
                          }}
                        >
                          {stage === "closed_won" ? "Won" : stage === "closed_lost" ? "Lost" : stage.replace("_", " ")}
                        </span>
                      </button>
                      {i < arr.length - 1 && (
                        <div
                          className="flex-1 mx-0.5"
                          style={{
                            height: "1px",
                            background: isPast ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.05)",
                            marginBottom: "1rem",
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Divider ── */}
            <div className="mx-6" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }} />

            {/* ── Metrics + Sentiment ── */}
            <div className="px-6 py-4">
              <div className="grid grid-cols-4 gap-3 text-center">
                <div>
                  <span className="text-xl font-extrabold block" style={{ color: "rgba(247,247,244,0.95)" }}>
                    {selectedLead.emailOpens}
                  </span>
                  <span className="text-[0.65rem] font-bold uppercase tracking-wider block mt-0.5" style={{ color: "rgba(247,247,244,0.3)" }}>
                    Opens
                  </span>
                </div>
                <div>
                  <span className="text-xl font-extrabold block" style={{ color: "rgba(247,247,244,0.95)" }}>
                    {selectedLead.linkClicks}
                  </span>
                  <span className="text-[0.65rem] font-bold uppercase tracking-wider block mt-0.5" style={{ color: "rgba(247,247,244,0.3)" }}>
                    Clicks
                  </span>
                </div>
                <div>
                  <span className="text-xl font-extrabold block" style={{ color: "rgba(247,247,244,0.95)" }}>
                    {selectedLead.reportViews}
                  </span>
                  <span className="text-[0.65rem] font-bold uppercase tracking-wider block mt-0.5" style={{ color: "rgba(247,247,244,0.3)" }}>
                    Views
                  </span>
                </div>
                <div>
                  <div className="flex justify-center">
                    <SentimentIcon sentiment={selectedLead.sentiment} />
                  </div>
                  <span className="text-[0.65rem] font-bold tracking-wider block mt-0.5 capitalize" style={{ color: "rgba(247,247,244,0.3)" }}>
                    {selectedLead.sentiment}
                  </span>
                </div>
              </div>
            </div>

            {/* ── Telegram Chat ID setup ── */}
            {selectedLead.stage !== "closed_won" && selectedLead.stage !== "closed_lost" && onSetLeadTelegramChatId && (
              <>
                <div className="mx-6" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }} />
                <div className="px-6 py-4">
                  <p className="text-xs font-bold uppercase tracking-wider m-0 mb-2" style={{ color: "rgba(247,247,244,0.35)", letterSpacing: "0.08em" }}>
                    Telegram
                  </p>
                  {selectedLead.telegramChatId ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2.5 py-1 rounded-full font-bold" style={{ background: "rgba(34,158,217,0.12)", color: "#229ED9", border: "1px solid rgba(34,158,217,0.2)" }}>
                        Chat ID: {selectedLead.telegramChatId}
                      </span>
                      <button
                        className="text-xs"
                        style={{ color: "rgba(247,247,244,0.3)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                        onClick={() => { setTelegramChatIdDraft(""); setChatIdSaved(false); }}
                      >
                        change
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input
                        className="input flex-1 text-xs"
                        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(247,247,244,0.8)", height: "2rem", padding: "0 0.625rem" }}
                        placeholder="Enter Telegram chat_id (e.g. 123456789)"
                        value={telegramChatIdDraft}
                        onChange={(e) => { setTelegramChatIdDraft(e.target.value); setChatIdSaved(false); }}
                      />
                      <button
                        className="secondary-button"
                        style={{ whiteSpace: "nowrap", height: "2rem", fontSize: "0.75rem" }}
                        disabled={isSavingChatId || !telegramChatIdDraft.trim()}
                        onClick={() => void handleSaveTelegramChatId()}
                      >
                        {isSavingChatId ? "Saving…" : chatIdSaved ? "Saved ✓" : "Save"}
                      </button>
                    </div>
                  )}
                  <p className="text-[0.65rem] m-0 mt-1.5" style={{ color: "rgba(247,247,244,0.25)" }}>
                    Have the lead message your bot first, then use <code style={{ color: "rgba(247,247,244,0.4)" }}>/start</code> — the bot replies with their chat ID.
                  </p>
                </div>
              </>
            )}

            {/* ── Actionable Insight ── */}
            {selectedLead.stage !== "closed_won" && selectedLead.stage !== "closed_lost" && (
              <>
                <div className="mx-6" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }} />
                <div className="px-6 py-4">
                  <div
                    className="rounded-xl p-4"
                    style={{
                      background: "linear-gradient(135deg, rgba(255,212,90,0.06), rgba(255,255,255,0.02))",
                      border: "1px solid rgba(255,212,90,0.12)",
                    }}
                  >
                    <p className="text-xs font-bold uppercase tracking-wider m-0 mb-2 flex items-center gap-1.5" style={{ color: "#ffd45a", letterSpacing: "0.08em" }}>
                      <Sparkles size={12} />
                      {selectedLead.stage === "new" ? "Recommended Action" : "Re-engage"}
                    </p>
                    <p className="text-sm m-0 mb-3 leading-relaxed" style={{ color: "rgba(247,247,244,0.7)" }}>
                      Send a personalized Telegram message to {selectedLead.stage === "new" ? "initiate contact" : "re-engage this prospect"} about {selectedLead.propertyInterest || "their property interest"}.
                    </p>
                    <div
                      className="rounded-lg p-2.5 text-xs italic mb-3"
                      style={{ background: "rgba(0,0,0,0.25)", color: "rgba(247,247,244,0.55)", border: "1px solid rgba(255,255,255,0.05)" }}
                    >
                      Hi {selectedLead.name.split(" ")[0]}, I saw you were looking at {selectedLead.propertyInterest || "some properties"}. Are you still searching? I have some new exclusive insights I can share with you!
                    </div>
                    {outreachError && (
                      <p className="text-xs rounded-lg px-3 py-2 mb-3" style={{ color: "#f87171", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.15)" }}>
                        {outreachError}
                      </p>
                    )}
                    {outreachSent && (
                      <p className="text-xs rounded-lg px-3 py-2 mb-3 flex items-center gap-1.5" style={{ color: "#4ade80", background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.15)" }}>
                        ✓ Message dispatched via Telegram.
                      </p>
                    )}
                    <div className="flex gap-2">
                      <button
                        className="primary-button btn-success flex-1"
                        onClick={() => void handleActionableOutreach()}
                        disabled={isSendingMessage}
                      >
                        {isSendingMessage ? "Sending..." : <><Send size={16} /> {selectedLead.stage === "new" ? "Send Outreach" : "Re-engage"}</>}
                      </button>
                      <a
                        href={`https://t.me/+${selectedLead.phone.replace(/\D/g, "").replace(/^0/, "60")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="secondary-button"
                        title="Open chat in Telegram app"
                        style={{ textDecoration: "none", whiteSpace: "nowrap" }}
                      >
                        Open Telegram
                      </a>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ── Divider ── */}
            <div className="mx-6" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }} />

            {/* ── Activity Timeline ── */}
            <div className="px-6 py-4">
              <p className="text-xs font-bold uppercase tracking-wider m-0 mb-3" style={{ color: "rgba(247,247,244,0.35)", letterSpacing: "0.08em" }}>
                Activity
              </p>
              {isLoadingEvents ? (
                <p className="text-xs m-0" style={{ color: "rgba(247,247,244,0.3)" }}>Loading...</p>
              ) : leadEvents.length === 0 ? (
                <p className="text-xs m-0" style={{ color: "rgba(247,247,244,0.3)" }}>No activity recorded yet.</p>
              ) : (
                <div className="space-y-2.5 relative pl-4" style={{ borderLeft: "1px solid rgba(255,255,255,0.08)" }}>
                  {leadEvents.slice(0, 8).map((event) => (
                    <div key={event.id} className="relative text-xs">
                      <div
                        className="absolute rounded-full"
                        style={{
                          left: "-1.35rem",
                          top: "0.25rem",
                          width: "0.4rem",
                          height: "0.4rem",
                          background: "rgba(255,255,255,0.2)",
                        }}
                      />
                      <p className="font-bold m-0" style={{ color: "rgba(247,247,244,0.8)" }}>{event.eventLabel}</p>
                      <span className="flex items-center gap-1 mt-0.5" style={{ color: "rgba(247,247,244,0.3)" }}>
                        <Calendar size={10} />
                        {new Date(event.occurredAt).toLocaleString("en-MY", { dateStyle: "medium", timeStyle: "short" })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Footer ── */}
            <div className="seam-footer-p6">
              {pendingDeleteId === selectedLead.id ? (
                <div className="flex items-center gap-3 w-full">
                  <span className="text-sm" style={{ color: "rgba(247,247,244,0.5)" }}>Remove this prospect?</span>
                  <button className="primary-button btn-danger" onClick={() => void handleDeleteLead(selectedLead.id, true)}>
                    <Trash2 size={16} /> Yes, delete
                  </button>
                  <button className="secondary-button" onClick={() => setPendingDeleteId(null)}>Cancel</button>
                </div>
              ) : (
                <button className="primary-button btn-danger" onClick={() => handleDeleteLead(selectedLead.id)}>
                  <Trash2 size={16} /> Delete
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ADD MANUAL PROSPECT MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-[#1e1e1e] rounded-xl shadow-2xl overflow-hidden">
            <div className="flex justify-between items-center bg-[#1e1e1e] text-white p-5">
              <h2 className="text-xl font-bold m-0 flex items-center gap-2">
                <Plus size={22} />
                Add New Prospect
              </h2>
              <button
                className="icon-button btn-sm"
                onClick={() => setIsAddModalOpen(false)}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddLead} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Prospect Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Alan Syahmi"
                  className="w-full border border-[#2d2d2d] rounded-lg p-2.5 outline-none focus:border-white"
                  value={newLeadForm.name}
                  onChange={(e) => setNewLeadForm({ ...newLeadForm, name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    placeholder="name@example.com"
                    className="w-full border border-[#2d2d2d] rounded-lg p-2.5 outline-none focus:border-white"
                    value={newLeadForm.email}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, email: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Phone Number *</label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. +6012-3456789"
                    className="w-full border border-[#2d2d2d] rounded-lg p-2.5 outline-none focus:border-white"
                    value={newLeadForm.phone}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, phone: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Property Interest *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Mont Kiara Condo"
                    className="w-full border border-[#2d2d2d] rounded-lg p-2.5 outline-none focus:border-white"
                    value={newLeadForm.propertyInterest}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, propertyInterest: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Budget *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. RM 950k"
                    className="w-full border border-[#2d2d2d] rounded-lg p-2.5 outline-none focus:border-white"
                    value={newLeadForm.budget}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, budget: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Lead Source</label>
                <select
                  className="w-full border border-[#2d2d2d] rounded-lg p-2.5 outline-none focus:border-white bg-[#1e1e1e]"
                  value={newLeadForm.source}
                  onChange={(e) => setNewLeadForm({ ...newLeadForm, source: e.target.value })}
                >
                  <option value="Direct Inquiry">Direct Inquiry</option>
                  <option value="Facebook">Facebook Campaign</option>
                  <option value="Lowyat">Lowyat Forums</option>
                  <option value="WhatsApp">WhatsApp Message</option>
                  <option value="Cold Call">Cold Call</option>
                  <option value="Referral">Referral</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Preferred Contact Channel</label>
                <select
                  className="w-full border border-[#2d2d2d] rounded-lg p-2.5 outline-none focus:border-white bg-[#1e1e1e]"
                  value={newLeadForm.preferredChannel}
                  onChange={(e) => setNewLeadForm({ ...newLeadForm, preferredChannel: e.target.value })}
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
                <label className="block text-sm font-bold text-slate-700 mb-1">Initial Message / Notes (Optional)</label>
                <textarea
                  placeholder="Add any initial message context or notes here..."
                  rows={3}
                  className="w-full border border-[#2d2d2d] rounded-lg p-2.5 outline-none focus:border-white"
                  value={newLeadForm.message}
                  onChange={(e) => setNewLeadForm({ ...newLeadForm, message: e.target.value })}
                />
              </div>

              {formError && (
                <p className="text-sm text-red-400 rounded-lg px-3 py-2 bg-red-500/10 border border-red-500/20">{formError}</p>
              )}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button type="button" className="secondary-button" onClick={() => { setIsAddModalOpen(false); setFormError(null); }}>
                  Cancel
                </button>
                <button type="submit" disabled={isSubmitting} className="primary-button">
                  {isSubmitting ? "Adding..." : "Add Prospect"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
