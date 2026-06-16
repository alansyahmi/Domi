import { Download, Filter, Frown, Meh, Search, SlidersHorizontal, Smile, Eye, Trash2, Plus, X, Calendar, Activity, Mail, Phone, DollarSign, MapPin } from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import { initials, sourceTone } from "../lib/format";
import type { Lead, LeadStage, Sentiment, LeadEvent } from "../types";
import { ChannelContactButton, ChannelBadge } from "../components/leads/ChannelContactButton";

function SentimentIcon({ sentiment }: { sentiment: Sentiment }) {
  if (sentiment === "positive") return <Smile size={22} className="text-emerald-600" aria-hidden="true" />;
  if (sentiment === "negative") return <Frown size={22} className="text-red-600" aria-hidden="true" />;
  return <Meh size={22} className="text-slate-600" aria-hidden="true" />;
}

export default function LeadManagementPage({
  leads,
  onCreateLead,
  onDeleteLead,
  onGetLeadEvents,
  onUpdateLeadStage,
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

  // Fetch events when active lead changes
  useEffect(() => {
    if (selectedLead) {
      setIsLoadingEvents(true);
      onGetLeadEvents(selectedLead.id)
        .then(setLeadEvents)
        .catch(console.error)
        .finally(() => setIsLoadingEvents(false));
    } else {
      setLeadEvents([]);
    }
  }, [selectedLead, onGetLeadEvents]);

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
    if (!newLeadForm.name || !newLeadForm.email || !newLeadForm.phone || !newLeadForm.propertyInterest || !newLeadForm.budget) {
      alert("Please fill in all required fields.");
      return;
    }
    setIsSubmitting(true);
    try {
      await onCreateLead(newLeadForm);
      setIsAddModalOpen(false);
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
      alert("Failed to add prospect.");
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

  async function handleDeleteLead(leadId: string) {
    if (confirm("Are you sure you want to delete this prospect?")) {
      try {
        await onDeleteLead(leadId);
        setSelectedLead(null);
      } catch (err) {
        console.error(err);
        alert("Failed to delete prospect.");
      }
    }
  }

  return (
    <main className="page relative">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <h1 className="section-title">Lead Pipeline</h1>
          <p className="mt-4 text-xl text-slate-700">Analyze and prioritize prospects based on behavioral data.</p>
        </div>
        <div className="flex gap-3">
          <button className="primary-button flex items-center gap-2" onClick={() => setIsAddModalOpen(true)}>
            <Plus size={19} aria-hidden="true" />
            Add Prospect
          </button>
          <button className="secondary-button">
            <Filter size={19} aria-hidden="true" />
            Filters
          </button>
          <button className="secondary-button">
            <Download size={19} aria-hidden="true" />
            Export
          </button>
        </div>
      </div>

      <section className="card mt-8 p-5">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(14rem,1fr)_repeat(4,12rem)_auto] gap-4 items-center">
          <label className="flex items-center gap-3 rounded-full border border-slate-300 bg-white px-4 py-2">
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
          <p className="text-emerald-600 mt-2">+12% this week</p>
        </section>
        <section className="card p-6">
          <p className="metric-label">High Intent (Score 1)</p>
          <strong className="text-3xl">{hotCount}</strong>
          <p className="text-slate-600 mt-2">27% conversion probability</p>
        </section>
        <section className="card p-6">
          <p className="metric-label">Avg Engagement</p>
          <strong className="text-3xl">{avgEngagement}%</strong>
          <p className="text-emerald-600 mt-2">+4% open rate</p>
        </section>
        <section className="card p-6 bg-[#041627] text-white relative overflow-hidden">
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
            className={`grid grid-cols-1 lg:grid-cols-[2fr_0.7fr_1.2fr_1.2fr_1.2fr_1fr_auto] gap-4 lg:gap-6 px-6 lg:px-8 py-6 border-t border-slate-200 items-center ${
              lead.intent === 1 ? "border-l-4 border-l-[#ffd45a]" : ""
            }`}
          >
            <div className="flex items-center gap-4">
              <div className="avatar small bg-[#ffd45a]">{initials(lead.name)}</div>
              <div>
                <h2 className="m-0 text-xl font-extrabold">{lead.name}</h2>
                <p className="m-0 text-slate-600">{lead.email}</p>
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
                  className="h-full bg-[#041627]"
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
            <div className="flex gap-2">
              <button
                className="p-2 rounded hover:bg-slate-200 text-slate-700 transition-colors"
                onClick={() => setSelectedLead(lead)}
                title="View Lead Profile"
              >
                <Eye size={18} />
              </button>
              <button
                className="p-2 rounded hover:bg-red-100 text-red-600 transition-colors"
                onClick={() => handleDeleteLead(lead.id)}
                title="Delete Lead"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </article>
        ))}
        {filtered.length === 0 && (
          <div className="p-8 text-center text-slate-500">No prospects matched your search.</div>
        )}
      </section>

      {/* LEAD PROFILE DETAIL DRAWER / SIDE-MODAL */}
      {selectedLead && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-lg h-full bg-white shadow-2xl flex flex-col p-6 overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-200 pb-4 mb-6">
              <div className="flex items-center gap-4">
                <div className="avatar bg-[#ffd45a]">{initials(selectedLead.name)}</div>
                <div>
                  <h2 className="text-2xl font-extrabold m-0">{selectedLead.name}</h2>
                  <span className={`tag mt-1 inline-block ${sourceTone(selectedLead.source)}`}>{selectedLead.source}</span>
                </div>
              </div>
              <button
                className="p-2 rounded-full hover:bg-slate-100 text-slate-500"
                onClick={() => setSelectedLead(null)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 space-y-6">
              {/* Scoring Summary */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 flex justify-around text-center">
                <div>
                  <p className="text-xs uppercase text-slate-500 font-semibold mb-1">Qual Score</p>
                  <strong className="text-2xl text-[#041627]">{selectedLead.score}</strong>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-500 font-semibold mb-1">Status Tier</p>
                  <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    selectedLead.tier === "Hot" ? "bg-amber-100 text-amber-800 border border-amber-200" :
                    selectedLead.tier === "Warm" ? "bg-blue-100 text-blue-800 border border-blue-200" :
                    "bg-slate-100 text-slate-800 border border-slate-200"
                  }`}>
                    {selectedLead.tier}
                  </span>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-500 font-semibold mb-1">Lead Intent</p>
                  <strong className="text-2xl text-[#041627]">{selectedLead.intent}</strong>
                </div>
              </div>

              {/* Pipeline Stage */}
              <div>
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Pipeline Stage</h3>
                <div className="flex flex-wrap gap-2">
                  {(["new", "contacted", "engaged", "viewing", "negotiating", "closed_won", "closed_lost"] as const).map((stage) => (
                    <button
                      key={stage}
                      onClick={() => {
                        onUpdateLeadStage(selectedLead.id, stage);
                        setSelectedLead({ ...selectedLead, stage, lastContactedAt: new Date().toISOString() });
                      }}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                        selectedLead.stage === stage
                          ? "bg-[#041627] text-white border-[#041627]"
                          : "bg-white text-slate-600 border-slate-300 hover:border-slate-500"
                      }`}
                    >
                      {stage.replace("_", " ")}
                    </button>
                  ))}
                </div>
              </div>

              {/* Preferred Channel */}
              <div>
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Preferred Contact</h3>
                <ChannelBadge channel={selectedLead.preferredChannel} />
              </div>

              {/* Contact Information */}
              <div>
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Contact Information</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-slate-700">
                    <Mail size={18} className="text-slate-400" />
                    <a href={`mailto:${selectedLead.email}`} className="hover:underline">{selectedLead.email}</a>
                  </div>
                  <div className="flex items-center gap-3 text-slate-700">
                    <Phone size={18} className="text-slate-400" />
                    <a href={`tel:${selectedLead.phone}`} className="hover:underline">{selectedLead.phone}</a>
                  </div>
                  <div className="pt-2">
                    <ChannelContactButton lead={selectedLead} />
                  </div>
                </div>
              </div>

              {/* Property Interests */}
              <div>
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Interest Profile</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-slate-700">
                    <MapPin size={18} className="text-slate-400" />
                    <div>
                      <p className="text-xs text-slate-400 m-0">Target Property / Area</p>
                      <p className="font-semibold m-0">{selectedLead.propertyInterest}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-slate-700">
                    <DollarSign size={18} className="text-slate-400" />
                    <div>
                      <p className="text-xs text-slate-400 m-0">Indicated Budget</p>
                      <p className="font-semibold m-0">{selectedLead.budget}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Engagement Metrics */}
              <div>
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Interaction Metrics</h3>
                <div className="grid grid-cols-3 gap-4 text-center bg-slate-50 rounded-xl p-3 border border-slate-100">
                  <div>
                    <span className="text-2xl font-bold">{selectedLead.emailOpens}</span>
                    <p className="text-xs text-slate-500 m-0">Email Opens</p>
                  </div>
                  <div>
                    <span className="text-2xl font-bold">{selectedLead.linkClicks}</span>
                    <p className="text-xs text-slate-500 m-0">Link Clicks</p>
                  </div>
                  <div>
                    <span className="text-2xl font-bold">{selectedLead.reportViews}</span>
                    <p className="text-xs text-slate-500 m-0">Report Views</p>
                  </div>
                </div>
              </div>

              {/* Inquiry Sentiment Analysis */}
              <div>
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Inquiry Sentiment</h3>
                <div className="flex items-center gap-3 bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <SentimentIcon sentiment={selectedLead.sentiment} />
                  <div>
                    <p className="font-semibold m-0 capitalize">{selectedLead.sentiment} Tone</p>
                    <p className="text-xs text-slate-500 m-0">Computed sentiment score of {selectedLead.inquirySentiment} based on prospect inquiries.</p>
                  </div>
                </div>
              </div>

              {/* Activity Timeline */}
              <div>
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Activity Timeline</h3>
                <div className="space-y-4 relative pl-4 border-l-2 border-slate-200">
                  {isLoadingEvents ? (
                    <p className="text-slate-500 text-sm">Loading activity logs...</p>
                  ) : leadEvents.length === 0 ? (
                    <p className="text-slate-500 text-sm">No recorded activity history.</p>
                  ) : (
                    leadEvents.map((event) => (
                      <div key={event.id} className="relative">
                        <div className="absolute -left-[23px] top-1 bg-white p-0.5 rounded-full border-2 border-slate-400 text-slate-500">
                          <Activity size={10} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-800 m-0">{event.eventLabel}</p>
                          <span className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                            <Calendar size={12} />
                            {new Date(event.occurredAt).toLocaleString("en-MY", { dateStyle: "medium", timeStyle: "short" })}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200 pt-4 mt-6">
              <button
                className="w-full flex items-center justify-center gap-2 py-3 bg-red-50 hover:bg-red-100 text-red-600 font-semibold rounded-lg transition-colors"
                onClick={() => handleDeleteLead(selectedLead.id)}
              >
                <Trash2 size={18} />
                Delete Prospect
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD MANUAL PROSPECT MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-white rounded-xl shadow-2xl overflow-hidden">
            <div className="flex justify-between items-center bg-[#041627] text-white p-5">
              <h2 className="text-xl font-bold m-0 flex items-center gap-2">
                <Plus size={22} />
                Add New Prospect
              </h2>
              <button
                className="p-1 rounded-full hover:bg-white/10 text-white/80 hover:text-white"
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
                  className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:border-[#041627]"
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
                    className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:border-[#041627]"
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
                    className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:border-[#041627]"
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
                    className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:border-[#041627]"
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
                    className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:border-[#041627]"
                    value={newLeadForm.budget}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, budget: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Lead Source</label>
                <select
                  className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:border-[#041627] bg-white"
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
                  className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:border-[#041627] bg-white"
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
                  className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:border-[#041627]"
                  value={newLeadForm.message}
                  onChange={(e) => setNewLeadForm({ ...newLeadForm, message: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors"
                  onClick={() => setIsAddModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-[#041627] hover:bg-[#1a2b3c] text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
                >
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
