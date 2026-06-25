import {
  ArrowRight,
  Bot,
  Building2,
  ChevronDown,
  ChevronRight,
  Clock,
  Columns3,
  Facebook,
  Flame,
  Inbox,
  Instagram,
  ListTodo,
  MessageCircle,
  Plus,
  QrCode,
  Send,
  ShieldAlert,
  Snowflake,
  Sparkles,
  Table2,
  Wifi,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { simulateQualify } from "../domain/qualify";
import LeadManagementPage from "./LeadManagementPage";
import {
  getOmniboxApi,
  seedOmniboxApi,
  getConversationMessagesApi,
  markConversationReadApi,
  type OmniboxData,
} from "../lib/api";
import {
  demoListings,
  demoConversations,
  demoLeadIntelligence,
  demoMessages,
  demoOmniLeads,
} from "../data/demo";
import type {
  Conversation,
  ConversationChannel,
  Lead,
  LeadEvent,
  LeadIntelligence,
  LeadStage,
  Listing,
  Message,
} from "../types";

type OmniView = "today" | "inbox" | "pipeline" | "table";

type LeadStatus = "awaiting" | "new" | "cold" | "progress" | "closed";

interface LeadCard {
  lead: Lead;
  intel: LeadIntelligence | null;
  priority: number;
  status: LeadStatus;
  stage: LeadStage;
  daysIdle: number;
  convId: string | null;
  nextAction: string;
}

const PIPELINE_STAGES: { key: LeadStage; label: string }[] = [
  { key: "new", label: "New" },
  { key: "contacted", label: "Contacted" },
  { key: "engaged", label: "Engaged" },
  { key: "viewing", label: "Viewing" },
  { key: "negotiating", label: "Negotiating" },
  { key: "closed_won", label: "Won" },
];

function fallbackPriority(lead: Lead): number {
  if (lead.intent === 1) return 82;
  if (lead.tier === "Hot") return 76;
  if (lead.tier === "Warm") return 52;
  return 28;
}

function nextStage(stage: LeadStage): LeadStage | null {
  const order: LeadStage[] = ["new", "contacted", "engaged", "viewing", "negotiating", "closed_won"];
  const i = order.indexOf(stage);
  if (i === -1 || i >= order.length - 1) return null;
  return order[i + 1]!;
}

// ── Automations config (agent-controlled, persisted) ────────────────────────
interface Automations {
  autoQualify: boolean;
  zeroSecondReply: boolean;
  autoFollowUp: boolean;
  menuText: string;
}

const DEFAULT_AUTOMATIONS: Automations = {
  autoQualify: true,
  zeroSecondReply: true,
  autoFollowUp: true,
  menuText: "Hi! Thanks for reaching out 👋 To help you fast, are you looking to:\n1) Buy to stay   2) Buy to invest   3) Just checking price",
};

function loadAutomations(): Automations {
  try {
    const raw = localStorage.getItem("reai_automations");
    return raw ? { ...DEFAULT_AUTOMATIONS, ...(JSON.parse(raw) as Partial<Automations>) } : DEFAULT_AUTOMATIONS;
  } catch {
    return DEFAULT_AUTOMATIONS;
  }
}

// Pool of realistic inbound messages to demo the automation chain.
const SIM_INBOUND: { name: string; handle: string; channel: ConversationChannel; listingIdx: number; message: string }[] = [
  { name: "Farah Aziz", handle: "+60 13-220 4471", channel: "whatsapp", listingIdx: 0, message: "Hi, is the PR1MA Bandar Layangkasa unit still available? Looking to buy to stay, budget around 320k, need 3 rooms and must be near MRT." },
  { name: "Kevin Lim", handle: "kevin.lim.kl", channel: "messenger", listingIdx: 1, message: "Interested in Residensi Suasana. Is it freehold? Honestly the price feels a bit high vs nearby, can owner nego?" },
  { name: "Siti Rahmah", handle: "+60 17-889 2231", channel: "whatsapp", listingIdx: 2, message: "Hi looking to rent Mont Kiara Astana, 2 rooms furnished, can move in this week urgent. Budget RM3500." },
  { name: "WIN BIG REALTY", handle: "+60 11-7000 1234", channel: "whatsapp", listingIdx: 0, message: "GUARANTEED HIGH ROI!! List your property FREE now bit.ly/zz1 co-broke welcome promo ends today" },
];

type LeadHandlers = {
  demoMode?: boolean;
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
};

const TEXT = "rgba(247,247,244,0.95)";
const MUTED = "rgba(247,247,244,0.5)";
const FAINT = "rgba(247,247,244,0.32)";
const PANEL = "rgba(255,255,255,0.035)";
const PANEL_HI = "rgba(255,255,255,0.07)";
const LINE = "rgba(255,255,255,0.08)";
const GOLD = "#ffd45a";
const GREEN = "#4ade80";
const RED = "#f87171";

const CHANNELS: { id: ConversationChannel; label: string; color: string; Icon: typeof MessageCircle }[] = [
  { id: "whatsapp", label: "WhatsApp", color: "#25D366", Icon: MessageCircle },
  { id: "messenger", label: "Messenger", color: "#0084FF", Icon: Facebook },
  { id: "telegram", label: "Telegram", color: "#229ED9", Icon: Send },
  { id: "instagram", label: "Instagram", color: "#E1306C", Icon: Instagram },
];

function channelMeta(channel: ConversationChannel) {
  return CHANNELS.find((c) => c.id === channel) ?? CHANNELS[0];
}

function relativeTime(iso?: string): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.round(hrs / 24)}d`;
}

function priorityColor(pct: number): string {
  if (pct >= 75) return GOLD;
  if (pct >= 45) return "#93c5fd";
  return MUTED;
}

export default function OmniboxPage(props: LeadHandlers) {
  const [view, setView] = useState<OmniView>("today");
  const [stageOverrides, setStageOverrides] = useState<Record<string, LeadStage>>({});
  const [data, setData] = useState<OmniboxData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [draft, setDraft] = useState("");

  const [qrOpen, setQrOpen] = useState(false);
  const [waConnected, setWaConnected] = useState(false);

  // Automations (Tier 1)
  const [automations, setAutomations] = useState<Automations>(() => loadAutomations());
  const [autoOpen, setAutoOpen] = useState(false);
  const [threads, setThreads] = useState<Record<string, Message[]>>({}); // demo message overlay (in-session)
  const [extraLeads, setExtraLeads] = useState<Lead[]>([]); // simulated inbound leads
  const [qualifyingConvId, setQualifyingConvId] = useState<string | null>(null);
  const simCount = useRef(0);

  function updateAutomations(patch: Partial<Automations>) {
    setAutomations((prev) => {
      const next = { ...prev, ...patch };
      try { localStorage.setItem("reai_automations", JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }

  // Load the inbox once.
  useEffect(() => {
    const applyExpand = (listings: Listing[]) => {
      const exp: Record<string, boolean> = { __unmatched: true };
      listings.forEach((l) => (exp[l.id] = true));
      setExpanded(exp);
    };

    if (props.demoMode) {
      const demo: OmniboxData = { listings: demoListings, conversations: demoConversations, intelligence: demoLeadIntelligence };
      setData(demo);
      setThreads({ ...demoMessages });
      applyExpand(demo.listings);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    getOmniboxApi()
      .then((d) => {
        if (!active) return;
        setData(d);
        applyExpand(d.listings);
      })
      .catch((e: unknown) => active && setError(e instanceof Error ? e.message : "Failed to load Omnibox."))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [props.demoMode]);

  // Load messages when a conversation is opened, and mark it read.
  useEffect(() => {
    if (!selectedConvId) {
      setMessages([]);
      return;
    }
    if (props.demoMode) {
      // Messages are served from the in-session `threads` overlay; just mark read.
      setData((prev) =>
        prev
          ? { ...prev, conversations: prev.conversations.map((c) => (c.id === selectedConvId ? { ...c, unreadCount: 0 } : c)) }
          : prev,
      );
      return;
    }
    let active = true;
    setMessagesLoading(true);
    getConversationMessagesApi(selectedConvId)
      .then((m) => active && setMessages(m))
      .catch(() => active && setMessages([]))
      .finally(() => active && setMessagesLoading(false));
    void markConversationReadApi(selectedConvId).catch(() => {});
    setData((prev) =>
      prev
        ? { ...prev, conversations: prev.conversations.map((c) => (c.id === selectedConvId ? { ...c, unreadCount: 0 } : c)) }
        : prev,
    );
    return () => {
      active = false;
    };
  }, [selectedConvId, props.demoMode]);

  const leadsById = useMemo(() => {
    const map = new Map<string, Lead>();
    props.leads.forEach((l) => map.set(l.id, l));
    if (props.demoMode) demoOmniLeads.forEach((l) => map.set(l.id, l));
    extraLeads.forEach((l) => map.set(l.id, l));
    return map;
  }, [props.leads, props.demoMode, extraLeads]);

  const displayedMessages = props.demoMode ? (selectedConvId ? threads[selectedConvId] ?? [] : []) : messages;

  const intelByLead = useMemo(() => {
    const map = new Map<string, LeadIntelligence>();
    data?.intelligence.forEach((i) => map.set(i.leadId, i));
    return map;
  }, [data]);

  // Group conversations under their matched listing (+ an Unmatched bucket).
  const grouped = useMemo(() => {
    const byListing = new Map<string, Conversation[]>();
    const unmatched: Conversation[] = [];
    (data?.conversations ?? []).forEach((c) => {
      if (c.listingId) {
        const arr = byListing.get(c.listingId) ?? [];
        arr.push(c);
        byListing.set(c.listingId, arr);
      } else {
        unmatched.push(c);
      }
    });
    const sortByPriority = (a: Conversation, b: Conversation) => {
      const pa = a.leadId ? intelByLead.get(a.leadId)?.priorityPct ?? 0 : 0;
      const pb = b.leadId ? intelByLead.get(b.leadId)?.priorityPct ?? 0 : 0;
      return pb - pa;
    };
    byListing.forEach((arr) => arr.sort(sortByPriority));
    unmatched.sort(sortByPriority);
    return { byListing, unmatched };
  }, [data, intelByLead]);

  // Unified lead book (props + demo omni leads) for management views.
  const allLeads = useMemo(() => {
    const map = new Map<string, Lead>();
    props.leads.forEach((l) => map.set(l.id, l));
    if (props.demoMode) demoOmniLeads.forEach((l) => map.set(l.id, l));
    extraLeads.forEach((l) => map.set(l.id, l));
    return [...map.values()];
  }, [props.leads, props.demoMode, extraLeads]);

  const convByLead = useMemo(() => {
    const map = new Map<string, Conversation>();
    (data?.conversations ?? []).forEach((c) => {
      if (c.leadId && !map.has(c.leadId)) map.set(c.leadId, c);
    });
    return map;
  }, [data]);

  const leadCards = useMemo<LeadCard[]>(() => {
    const now = Date.now();
    const DAY = 86400000;
    return allLeads.map((lead) => {
      const intel = intelByLead.get(lead.id) ?? null;
      const conv = convByLead.get(lead.id) ?? null;
      const stage = stageOverrides[lead.id] ?? lead.stage;
      const lastActivity = lead.lastContactedAt ?? conv?.lastMessageAt ?? lead.createdAt;
      const daysIdle = Math.max(0, Math.floor((now - new Date(lastActivity).getTime()) / DAY));
      const closed = stage === "closed_won" || stage === "closed_lost";
      let status: LeadStatus;
      if (closed) status = "closed";
      else if ((conv?.unreadCount ?? 0) > 0) status = "awaiting";
      else if (stage === "new") status = "new";
      else if (daysIdle >= 3) status = "cold";
      else status = "progress";
      const priority = intel?.priorityPct ?? fallbackPriority(lead);
      const nextAction =
        status === "awaiting" ? "Reply now"
        : status === "new" ? "Qualify"
        : status === "cold" ? `Follow up · idle ${daysIdle}d`
        : status === "closed" ? "—"
        : "Continue";
      return { lead, intel, priority, status, stage, daysIdle, convId: conv?.id ?? null, nextAction };
    });
  }, [allLeads, intelByLead, convByLead, stageOverrides]);

  const coldCount = leadCards.filter((c) => c.status === "cold").length;

  function advanceStage(lead: Lead) {
    const cur = stageOverrides[lead.id] ?? lead.stage;
    const nxt = nextStage(cur);
    if (!nxt) return;
    setStageOverrides((p) => ({ ...p, [lead.id]: nxt }));
    void props.onUpdateLeadStage(lead.id, nxt).catch(() => {});
  }

  function openCard(card: LeadCard) {
    if (card.convId) {
      setSelectedConvId(card.convId);
      setView("inbox");
    } else {
      setView("table");
    }
  }

  const selectedConv = data?.conversations.find((c) => c.id === selectedConvId) ?? null;
  const selectedLead = selectedConv?.leadId ? leadsById.get(selectedConv.leadId) ?? null : null;
  const selectedIntel = selectedConv?.leadId ? intelByLead.get(selectedConv.leadId) ?? null : null;

  async function handleSeed() {
    if (props.demoMode) {
      setData({ listings: demoListings, conversations: demoConversations, intelligence: demoLeadIntelligence });
      const exp: Record<string, boolean> = { __unmatched: true };
      demoListings.forEach((l) => (exp[l.id] = true));
      setExpanded(exp);
      return;
    }
    setSeeding(true);
    setError(null);
    try {
      const result = await seedOmniboxApi();
      setData({ listings: result.listings, conversations: result.conversations, intelligence: result.intelligence });
      const exp: Record<string, boolean> = { __unmatched: true };
      result.listings.forEach((l) => (exp[l.id] = true));
      setExpanded(exp);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to seed demo inbox.");
    } finally {
      setSeeding(false);
    }
  }

  function handleSend() {
    const text = draft.trim();
    if (!text || !selectedConvId) return;
    const msg: Message = {
      id: `local_${Date.now()}`,
      conversationId: selectedConvId,
      agentId: selectedConv?.agentId ?? "",
      direction: "outbound",
      author: "agent",
      body: text,
      kind: "text",
      sentAt: new Date().toISOString(),
    };
    if (props.demoMode) {
      setThreads((prev) => ({ ...prev, [selectedConvId]: [...(prev[selectedConvId] ?? []), msg] }));
    } else {
      setMessages((prev) => [...prev, msg]);
    }
    setDraft("");
  }

  // ── Tier 1 automation: simulate an inbound and run the chain live ──────────
  function simulateInbound() {
    if (!data) return;
    const scenario = SIM_INBOUND[simCount.current % SIM_INBOUND.length]!;
    simCount.current += 1;
    const stamp = Date.now();
    const leadId = `lead_sim_${stamp}`;
    const convId = `conv_sim_${stamp}`;
    const listing = data.listings[scenario.listingIdx] ?? data.listings[0];
    const agentId = listing?.agentId ?? "agent_demo";

    const lead: Lead = {
      id: leadId, agentId, name: scenario.name, email: "inbound@lead",
      phone: scenario.channel === "messenger" ? "N/A" : scenario.handle,
      source: scenario.channel === "messenger" ? "Facebook" : "WhatsApp",
      propertyInterest: listing?.title ?? "General", budget: "—",
      emailOpens: 0, linkClicks: 0, reportViews: 0, inquirySentiment: 0, sentiment: "neutral",
      score: 0, intent: 0, tier: "Cold", stage: "new", preferredChannel: scenario.channel,
      listingId: listing?.id, createdAt: new Date(stamp).toISOString(),
    };
    const conv: Conversation = {
      id: convId, agentId, leadId, listingId: listing?.id, channel: scenario.channel,
      externalId: scenario.handle, contactName: scenario.name, contactHandle: scenario.handle,
      status: "open", unreadCount: 1, lastMessageAt: new Date(stamp).toISOString(),
      lastMessagePreview: scenario.message, createdAt: new Date(stamp).toISOString(),
    };
    const inboundMsg: Message = {
      id: `m_${stamp}_in`, conversationId: convId, agentId, direction: "inbound", author: "lead",
      body: scenario.message, kind: "text", sentAt: new Date(stamp).toISOString(),
    };

    setExtraLeads((prev) => [lead, ...prev]);
    setThreads((prev) => ({ ...prev, [convId]: [inboundMsg] }));
    setData((prev) => (prev ? { ...prev, conversations: [conv, ...prev.conversations] } : prev));
    if (listing) setExpanded((prev) => ({ ...prev, [listing.id]: true }));
    setSelectedConvId(convId);
    setView("inbox");

    // 1) Zero-second auto-reply (instant qualifying menu)
    if (automations.zeroSecondReply) {
      const replyMsg: Message = {
        id: `m_${stamp}_auto`, conversationId: convId, agentId, direction: "outbound", author: "auto",
        body: automations.menuText, kind: "menu", sentAt: new Date(stamp + 700).toISOString(),
      };
      window.setTimeout(() => setThreads((prev) => ({ ...prev, [convId]: [...(prev[convId] ?? []), replyMsg] })), 700);
    }

    // 2) Auto-qualify (fills the intelligence panel)
    if (automations.autoQualify) {
      setQualifyingConvId(convId);
      window.setTimeout(() => {
        const q = simulateQualify(scenario.message, { askingPriceRm: listing?.askingPriceRm });
        const intel: LeadIntelligence = {
          leadId, agentId, role: q.role, budgetMinRm: q.budgetMinRm, budgetMaxRm: q.budgetMaxRm,
          lookingFor: q.lookingFor, dealbreakers: q.dealbreakers, objections: q.objections, urgencyTier: q.urgencyTier,
          matchPct: q.matchPct, matchedListingId: listing?.id, botProbability: q.botProbability, priorityPct: q.priorityPct,
          xai: {
            summary: q.xaiSummary,
            factors: [],
            sources: ["Opening message (auto-qualified)", listing ? `Listing record ${listing.title}` : "—"],
          },
          updatedAt: new Date().toISOString(),
        };
        setData((prev) => (prev ? { ...prev, intelligence: [...prev.intelligence.filter((i) => i.leadId !== leadId), intel] } : prev));
        setExtraLeads((prev) =>
          prev.map((l) =>
            l.id === leadId
              ? { ...l, score: q.priorityPct, intent: q.priorityPct >= 70 ? 1 : 0, tier: q.priorityPct >= 70 ? "Hot" : q.priorityPct >= 45 ? "Warm" : "Cold" }
              : l,
          ),
        );
        setQualifyingConvId(null);
      }, automations.zeroSecondReply ? 1400 : 900);
    }
  }

  function toggle(id: string) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  const autoCount = [automations.autoQualify, automations.zeroSecondReply, automations.autoFollowUp].filter(Boolean).length;
  const toggle_props = {
    view, setView, waConnected, coldCount, autoCount,
    onConnect: () => setQrOpen(true),
    onAutomations: () => setAutoOpen(true),
    onSimulate: simulateInbound,
  };
  const qrModal = qrOpen ? (
    <QrConnectModal onClose={() => setQrOpen(false)} onConnect={() => { setWaConnected(true); setQrOpen(false); }} />
  ) : null;
  const autoModal = autoOpen ? (
    <AutomationsModal automations={automations} onChange={updateAutomations} onClose={() => setAutoOpen(false)} />
  ) : null;

  // ── Today: priority work queue ───────────────────────────────────────────
  if (view === "today") {
    return (
      <main className="page">
        <ViewToggle {...toggle_props} />
        {loading ? (
          <div className="mt-8 text-sm" style={{ color: MUTED }}>Loading…</div>
        ) : (data?.listings.length ?? 0) === 0 ? (
          <EmptyState seeding={seeding} onSeed={handleSeed} />
        ) : (
          <TodayQueue cards={leadCards} onOpen={openCard} />
        )}
        {qrModal}
        {autoModal}
      </main>
    );
  }

  // ── Pipeline: stage board ────────────────────────────────────────────────
  if (view === "pipeline") {
    return (
      <main className="page">
        <ViewToggle {...toggle_props} />
        {loading ? (
          <div className="mt-8 text-sm" style={{ color: MUTED }}>Loading…</div>
        ) : (data?.listings.length ?? 0) === 0 ? (
          <EmptyState seeding={seeding} onSeed={handleSeed} />
        ) : (
          <PipelineBoard cards={leadCards} onAdvance={advanceStage} onOpen={openCard} />
        )}
        {qrModal}
        {autoModal}
      </main>
    );
  }

  // ── Table view (legacy lead management, preserved) ───────────────────────
  if (view === "table") {
    return (
      <main className="page">
        <ViewToggle {...toggle_props} />
        <LeadManagementPage {...props} />
        {qrModal}
        {autoModal}
      </main>
    );
  }

  return (
    <main className="page">
      <ViewToggle {...toggle_props} />

      <ConnectionBanner waConnected={waConnected} />

      {loading ? (
        <div className="mt-8 text-sm" style={{ color: MUTED }}>Loading inbox…</div>
      ) : error ? (
        <div className="mt-6 rounded-xl px-4 py-3 text-sm" style={{ color: RED, background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.18)" }}>{error}</div>
      ) : (data?.listings.length ?? 0) === 0 ? (
        <EmptyState seeding={seeding} onSeed={handleSeed} />
      ) : (
        <div
          className="mt-5 grid gap-3"
          style={{ gridTemplateColumns: "20rem minmax(0, 1fr) 20rem", height: "calc(100vh - 16rem)", minHeight: "34rem" }}
        >
          {/* ── Left: inverted tree (listings → conversations) ── */}
          <aside className="rounded-2xl overflow-y-auto" style={{ background: PANEL, border: `1px solid ${LINE}` }}>
            <div className="px-4 py-3 sticky top-0 z-10 flex items-center gap-2" style={{ background: "#262626", borderBottom: `1px solid ${LINE}` }}>
              <Inbox size={15} style={{ color: GOLD }} />
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: MUTED }}>Inventory · Inbox</span>
            </div>

            {data!.listings.map((listing) => {
              const convs = grouped.byListing.get(listing.id) ?? [];
              const isOpen = expanded[listing.id];
              return (
                <ListingNode
                  key={listing.id}
                  listing={listing}
                  conversations={convs}
                  open={isOpen}
                  onToggle={() => toggle(listing.id)}
                  selectedConvId={selectedConvId}
                  onSelectConv={setSelectedConvId}
                  intelByLead={intelByLead}
                />
              );
            })}

            {grouped.unmatched.length > 0 && (
              <div>
                <button
                  className="w-full flex items-center gap-2 px-4 py-3 text-left"
                  style={{ background: "transparent", border: "none", borderTop: `1px solid ${LINE}`, cursor: "pointer" }}
                  onClick={() => toggle("__unmatched")}
                >
                  {expanded.__unmatched ? <ChevronDown size={14} style={{ color: FAINT }} /> : <ChevronRight size={14} style={{ color: FAINT }} />}
                  <span className="text-sm font-semibold" style={{ color: MUTED }}>Unmatched inquiries</span>
                  <span className="ml-auto text-xs" style={{ color: FAINT }}>{grouped.unmatched.length}</span>
                </button>
                {expanded.__unmatched &&
                  grouped.unmatched.map((c) => (
                    <ConversationRow
                      key={c.id}
                      conversation={c}
                      intel={c.leadId ? intelByLead.get(c.leadId) ?? null : null}
                      selected={c.id === selectedConvId}
                      onSelect={() => setSelectedConvId(c.id)}
                    />
                  ))}
              </div>
            )}
          </aside>

          {/* ── Center: conversation thread ── */}
          <section className="rounded-2xl flex flex-col overflow-hidden" style={{ background: PANEL, border: `1px solid ${LINE}` }}>
            {!selectedConv ? (
              <div className="flex-1 grid place-items-center text-sm" style={{ color: FAINT }}>
                Select a conversation to view the thread.
              </div>
            ) : (
              <ThreadView
                conversation={selectedConv}
                lead={selectedLead}
                messages={displayedMessages}
                loading={messagesLoading}
                draft={draft}
                setDraft={setDraft}
                onSend={handleSend}
                waConnected={waConnected}
              />
            )}
          </section>

          {/* ── Right: leads intelligence ── */}
          <aside className="rounded-2xl overflow-y-auto" style={{ background: PANEL, border: `1px solid ${LINE}` }}>
            <IntelligencePanel lead={selectedLead} intel={selectedIntel} qualifying={qualifyingConvId === selectedConvId} />
          </aside>
        </div>
      )}

      {qrModal}
      {autoModal}
    </main>
  );
}

// ── Header / view toggle ──────────────────────────────────────────────────
function ViewToggle({
  view,
  setView,
  waConnected,
  onConnect,
  onAutomations,
  onSimulate,
  coldCount,
  autoCount,
}: {
  view: OmniView;
  setView: (v: OmniView) => void;
  waConnected: boolean;
  onConnect: () => void;
  onAutomations: () => void;
  onSimulate: () => void;
  coldCount: number;
  autoCount: number;
}) {
  const tabs: { key: OmniView; label: string; Icon: typeof Inbox }[] = [
    { key: "today", label: "Today", Icon: ListTodo },
    { key: "inbox", label: "Inbox", Icon: Inbox },
    { key: "pipeline", label: "Pipeline", Icon: Columns3 },
    { key: "table", label: "Leads table", Icon: Table2 },
  ];
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap">
      <div>
        <h1 className="text-3xl font-extrabold m-0" style={{ color: TEXT }}>Omnibox</h1>
        <p className="mt-1 text-sm m-0" style={{ color: MUTED }}>One inbox for every channel, organized by your listings.</p>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex rounded-xl p-0.5" style={{ background: PANEL, border: `1px solid ${LINE}` }}>
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setView(t.key)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold relative"
              style={{ background: view === t.key ? PANEL_HI : "transparent", color: view === t.key ? TEXT : MUTED, border: "none", cursor: "pointer" }}
            >
              <t.Icon size={15} /> {t.label}
              {t.key === "today" && coldCount > 0 && (
                <span className="ml-1 text-[0.65rem] font-bold px-1.5 rounded-full" style={{ background: "rgba(248,113,113,0.18)", color: RED }}>{coldCount}</span>
              )}
            </button>
          ))}
        </div>
        <button
          onClick={onSimulate}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold"
          style={{ background: PANEL_HI, color: TEXT, border: `1px solid ${LINE}`, cursor: "pointer" }}
          title="Simulate an inbound lead to see the automations fire"
        >
          <Plus size={15} /> Simulate inbound
        </button>
        <button
          onClick={onAutomations}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold relative"
          style={{ background: "rgba(255,212,90,0.1)", color: GOLD, border: "1px solid rgba(255,212,90,0.25)", cursor: "pointer" }}
        >
          <Zap size={15} /> Automations
          <span className="text-[0.65rem] font-bold px-1.5 rounded-full" style={{ background: "rgba(255,212,90,0.18)" }}>{autoCount}</span>
        </button>
        <button
          onClick={onConnect}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-bold"
          style={{
            background: waConnected ? "rgba(74,222,128,0.12)" : PANEL_HI,
            color: waConnected ? GREEN : TEXT,
            border: `1px solid ${waConnected ? "rgba(74,222,128,0.25)" : LINE}`,
            cursor: "pointer",
          }}
        >
          <QrCode size={15} />
          {waConnected ? "WhatsApp connected" : "Connect WhatsApp"}
        </button>
      </div>
    </div>
  );
}

function ConnectionBanner({ waConnected }: { waConnected: boolean }) {
  return (
    <div
      className="mt-4 flex items-center gap-3 px-4 py-2.5 rounded-xl flex-wrap"
      style={{ background: "rgba(74,222,128,0.06)", border: "1px solid rgba(74,222,128,0.16)" }}
    >
      <Wifi size={15} style={{ color: GREEN }} />
      <span className="text-xs font-bold uppercase tracking-wider" style={{ color: GREEN }}>All portals operational // Ingestion active</span>
      <div className="flex items-center gap-3 ml-auto">
        {CHANNELS.map((c) => {
          const live = c.id === "whatsapp" ? waConnected : c.id === "messenger";
          return (
            <span key={c.id} className="flex items-center gap-1.5 text-xs" style={{ color: live ? "rgba(247,247,244,0.7)" : FAINT }}>
              <c.Icon size={13} style={{ color: live ? c.color : FAINT }} />
              <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: live ? GREEN : "rgba(255,255,255,0.15)" }} />
            </span>
          );
        })}
      </div>
    </div>
  );
}

function EmptyState({ seeding, onSeed }: { seeding: boolean; onSeed: () => void }) {
  return (
    <div className="mt-10 rounded-2xl px-8 py-14 text-center" style={{ background: PANEL, border: `1px dashed ${LINE}` }}>
      <Inbox size={32} style={{ color: FAINT }} className="mx-auto" />
      <h2 className="mt-4 text-xl font-bold m-0" style={{ color: TEXT }}>Your Omni-Inbox is empty</h2>
      <p className="mt-2 text-sm m-0 mx-auto" style={{ color: MUTED, maxWidth: "30rem" }}>
        Seed a demo set of listings, multi-channel conversations, and AI lead intelligence to see the full Omnibox in action.
      </p>
      <button
        onClick={onSeed}
        disabled={seeding}
        className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold"
        style={{ background: GOLD, color: "#1a1100", border: "none", cursor: seeding ? "default" : "pointer", opacity: seeding ? 0.7 : 1 }}
      >
        <Sparkles size={16} /> {seeding ? "Seeding…" : "Seed demo inbox"}
      </button>
    </div>
  );
}

// ── Left rail nodes ─────────────────────────────────────────────────────────
function ListingNode({
  listing,
  conversations,
  open,
  onToggle,
  selectedConvId,
  onSelectConv,
  intelByLead,
}: {
  listing: Listing;
  conversations: Conversation[];
  open: boolean;
  onToggle: () => void;
  selectedConvId: string | null;
  onSelectConv: (id: string) => void;
  intelByLead: Map<string, LeadIntelligence>;
}) {
  const priceLabel = listing.listingIntent === "rent"
    ? `RM ${listing.askingPriceRm.toLocaleString("en-MY")}/mo`
    : `RM ${listing.askingPriceRm.toLocaleString("en-MY")}`;
  return (
    <div style={{ borderTop: `1px solid ${LINE}` }}>
      <button
        className="w-full flex items-start gap-2 px-4 py-3 text-left"
        style={{ background: "transparent", border: "none", cursor: "pointer" }}
        onClick={onToggle}
      >
        {open ? <ChevronDown size={14} style={{ color: FAINT, marginTop: 3 }} /> : <ChevronRight size={14} style={{ color: FAINT, marginTop: 3 }} />}
        <Building2 size={15} style={{ color: GOLD, marginTop: 2, flexShrink: 0 }} />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold truncate" style={{ color: TEXT }}>{listing.title}</span>
          <span className="block text-xs truncate mt-0.5" style={{ color: FAINT }}>{priceLabel} · {listing.bedrooms ?? "?"}R · {listing.area ?? listing.address}</span>
        </span>
        <span className="text-xs px-1.5 py-0.5 rounded-full shrink-0" style={{ background: PANEL_HI, color: MUTED }}>{conversations.length}</span>
      </button>
      {open &&
        conversations.map((c) => (
          <ConversationRow
            key={c.id}
            conversation={c}
            intel={c.leadId ? intelByLead.get(c.leadId) ?? null : null}
            selected={c.id === selectedConvId}
            onSelect={() => onSelectConv(c.id)}
            nested
          />
        ))}
      {open && conversations.length === 0 && (
        <div className="px-4 pb-3 pl-10 text-xs" style={{ color: FAINT }}>No inquiries yet.</div>
      )}
    </div>
  );
}

function ConversationRow({
  conversation,
  intel,
  selected,
  onSelect,
  nested,
}: {
  conversation: Conversation;
  intel: LeadIntelligence | null;
  selected: boolean;
  onSelect: () => void;
  nested?: boolean;
}) {
  const meta = channelMeta(conversation.channel);
  const isBot = (intel?.botProbability ?? 0) >= 0.6;
  const priority = intel?.priorityPct ?? 0;
  return (
    <button
      onClick={onSelect}
      className="w-full flex items-start gap-2.5 py-2.5 pr-3 text-left"
      style={{
        paddingLeft: nested ? "2.5rem" : "1rem",
        background: selected ? "rgba(255,212,90,0.08)" : "transparent",
        borderLeft: selected ? `2px solid ${GOLD}` : "2px solid transparent",
        border: "none",
        cursor: "pointer",
      }}
    >
      <span className="relative shrink-0" style={{ marginTop: 2 }}>
        <meta.Icon size={16} style={{ color: meta.color }} />
        {conversation.unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full" style={{ background: GOLD }} />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="text-sm font-semibold truncate" style={{ color: isBot ? RED : TEXT }}>{conversation.contactName}</span>
          {isBot && <ShieldAlert size={12} style={{ color: RED, flexShrink: 0 }} />}
          <span className="ml-auto text-xs shrink-0" style={{ color: FAINT }}>{relativeTime(conversation.lastMessageAt)}</span>
        </span>
        <span className="block text-xs truncate mt-0.5" style={{ color: conversation.unreadCount > 0 ? "rgba(247,247,244,0.7)" : FAINT }}>
          {conversation.lastMessagePreview || "No messages yet"}
        </span>
      </span>
      {!isBot && priority > 0 && (
        <span className="text-xs font-bold shrink-0" style={{ color: priorityColor(priority), marginTop: 1 }}>{priority}</span>
      )}
    </button>
  );
}

// ── Center thread ────────────────────────────────────────────────────────────
function ThreadView({
  conversation,
  lead,
  messages,
  loading,
  draft,
  setDraft,
  onSend,
  waConnected,
}: {
  conversation: Conversation;
  lead: Lead | null;
  messages: Message[];
  loading: boolean;
  draft: string;
  setDraft: (v: string) => void;
  onSend: () => void;
  waConnected: boolean;
}) {
  const meta = channelMeta(conversation.channel);
  const canReply = conversation.channel !== "whatsapp" || waConnected;
  return (
    <>
      <div className="px-5 py-3.5 flex items-center gap-3" style={{ borderBottom: `1px solid ${LINE}` }}>
        <meta.Icon size={18} style={{ color: meta.color }} />
        <div className="min-w-0">
          <div className="text-sm font-bold truncate" style={{ color: TEXT }}>{conversation.contactName}</div>
          <div className="text-xs truncate" style={{ color: FAINT }}>{meta.label} · {conversation.contactHandle}</div>
        </div>
        {lead && (
          <span className="ml-auto text-xs px-2.5 py-1 rounded-full" style={{ background: PANEL_HI, color: MUTED }}>
            {lead.propertyInterest}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
        {loading ? (
          <div className="text-sm" style={{ color: FAINT }}>Loading messages…</div>
        ) : (
          messages.map((m) => <MessageBubble key={m.id} message={m} />)
        )}
      </div>

      <div className="px-4 py-3" style={{ borderTop: `1px solid ${LINE}` }}>
        {canReply ? (
          <div className="flex items-end gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  onSend();
                }
              }}
              rows={1}
              placeholder={`Reply on ${meta.label}…`}
              className="flex-1 resize-none rounded-xl px-3 py-2.5 text-sm outline-none"
              style={{ background: "rgba(0,0,0,0.25)", border: `1px solid ${LINE}`, color: TEXT, maxHeight: "8rem" }}
            />
            <button
              onClick={onSend}
              disabled={!draft.trim()}
              className="flex items-center justify-center rounded-xl"
              style={{ width: "2.6rem", height: "2.6rem", background: draft.trim() ? GOLD : PANEL_HI, color: draft.trim() ? "#1a1100" : FAINT, border: "none", cursor: draft.trim() ? "pointer" : "default" }}
              aria-label="Send"
            >
              <Send size={16} />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 py-2 text-xs rounded-xl" style={{ color: MUTED, background: PANEL }}>
            <QrCode size={14} /> Connect WhatsApp to reply on this channel.
          </div>
        )}
      </div>
    </>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const outbound = message.direction === "outbound";
  const isAuto = message.author === "auto";
  const isMenu = message.kind === "menu";
  return (
    <div className="flex flex-col" style={{ alignItems: outbound ? "flex-end" : "flex-start" }}>
      {isAuto && (
        <span className="flex items-center gap-1 text-[0.65rem] font-bold uppercase tracking-wider mb-1" style={{ color: GOLD }}>
          <Sparkles size={10} /> Zero-second auto-reply
        </span>
      )}
      <div
        className="px-3.5 py-2.5 text-sm"
        style={{
          maxWidth: "78%",
          borderRadius: outbound ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
          background: outbound ? (isAuto ? "rgba(255,212,90,0.12)" : "rgba(255,212,90,0.16)") : PANEL_HI,
          color: TEXT,
          border: isAuto ? "1px solid rgba(255,212,90,0.25)" : `1px solid ${LINE}`,
          lineHeight: 1.45,
        }}
      >
        {message.body}
        {isMenu && (
          <span className="block mt-1 text-xs italic" style={{ color: MUTED }}>↳ awaiting the lead's choice…</span>
        )}
      </div>
      <span className="text-[0.65rem] mt-1" style={{ color: FAINT }}>{relativeTime(message.sentAt)}</span>
    </div>
  );
}

// ── Right: intelligence ──────────────────────────────────────────────────────
function IntelligencePanel({ lead, intel, qualifying }: { lead: Lead | null; intel: LeadIntelligence | null; qualifying?: boolean }) {
  if (qualifying && !intel) {
    return (
      <div className="grid place-items-center h-full text-sm px-6 text-center" style={{ color: GOLD }}>
        <div className="flex flex-col items-center gap-2">
          <Bot size={22} className="animate-pulse" />
          <span className="font-bold">Auto-qualifying{lead ? ` ${lead.name}` : ""}…</span>
          <span style={{ color: FAINT }}>Reading the opening message for intent, budget and red flags.</span>
        </div>
      </div>
    );
  }
  if (!lead || !intel) {
    return (
      <div className="grid place-items-center h-full text-sm px-6 text-center" style={{ color: FAINT }}>
        Lead intelligence appears here when you open a conversation.
      </div>
    );
  }
  const isBot = intel.botProbability >= 0.6;
  return (
    <div className="p-4">
      <div className="px-3 py-3 rounded-xl mb-3" style={{ background: PANEL_HI, border: `1px solid ${LINE}` }}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: MUTED }}>Priority</span>
          <span className="text-2xl font-extrabold leading-none" style={{ color: priorityColor(intel.priorityPct) }}>{intel.priorityPct}%</span>
        </div>
        <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
          <div style={{ width: `${intel.priorityPct}%`, height: "100%", background: priorityColor(intel.priorityPct) }} />
        </div>
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <Chip label={intel.role} />
          <Chip label={`${intel.urgencyTier} urgency`} tone={intel.urgencyTier === "alpha" ? "gold" : "muted"} />
          {intel.matchPct != null && <Chip label={`${intel.matchPct}% match`} tone={intel.matchPct >= 75 ? "green" : "muted"} />}
        </div>
      </div>

      {isBot && (
        <div className="px-3 py-2.5 rounded-xl mb-3 flex items-start gap-2" style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)" }}>
          <ShieldAlert size={15} style={{ color: RED, marginTop: 1 }} />
          <div>
            <div className="text-xs font-bold" style={{ color: RED }}>Integrity shield: {Math.round(intel.botProbability * 100)}% bot probability</div>
            <div className="text-xs mt-0.5" style={{ color: MUTED }}>Flagged as likely spam / co-broke fisher.</div>
          </div>
        </div>
      )}

      {intel.budgetMinRm != null && (
        <Section title="Budget">
          <span className="text-sm font-bold" style={{ color: TEXT }}>
            RM {intel.budgetMinRm.toLocaleString("en-MY")}{intel.budgetMaxRm ? ` – ${intel.budgetMaxRm.toLocaleString("en-MY")}` : ""}
          </span>
        </Section>
      )}

      {intel.lookingFor.length > 0 && (
        <Section title="Looking for">
          <BulletList items={intel.lookingFor} tone={GREEN} />
        </Section>
      )}

      {intel.dealbreakers.length > 0 && (
        <Section title="Dealbreakers">
          <BulletList items={intel.dealbreakers} tone={RED} />
        </Section>
      )}

      {intel.objections.length > 0 && (
        <Section title="Objections">
          <BulletList items={intel.objections} tone="#fbbf24" />
        </Section>
      )}

      {intel.xai.summary && (
        <Section title="Why this score (XAI)">
          <p className="text-xs leading-relaxed m-0" style={{ color: MUTED }}>{intel.xai.summary}</p>
          <div className="mt-2 flex flex-col gap-1.5">
            {intel.xai.factors.map((f) => (
              <div key={f.label} className="text-xs">
                <div className="flex items-center justify-between">
                  <span style={{ color: "rgba(247,247,244,0.75)" }}>{f.label}</span>
                  <span style={{ color: FAINT }}>{Math.round(f.weight * 100)}%</span>
                </div>
                <div className="mt-0.5" style={{ color: FAINT }}>{f.detail}</div>
              </div>
            ))}
          </div>
          {intel.xai.sources.length > 0 && (
            <div className="mt-2.5 pt-2.5" style={{ borderTop: `1px solid ${LINE}` }}>
              <span className="text-[0.65rem] font-bold uppercase tracking-wider" style={{ color: FAINT }}>Sources</span>
              <ul className="mt-1 m-0 pl-4 text-xs" style={{ color: MUTED }}>
                {intel.xai.sources.map((s) => <li key={s}>{s}</li>)}
              </ul>
            </div>
          )}
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-3.5">
      <div className="text-[0.65rem] font-bold uppercase tracking-widest mb-1.5" style={{ color: FAINT }}>{title}</div>
      {children}
    </div>
  );
}

function BulletList({ items, tone }: { items: string[]; tone: string }) {
  return (
    <ul className="m-0 p-0 flex flex-col gap-1" style={{ listStyle: "none" }}>
      {items.map((it) => (
        <li key={it} className="flex items-start gap-2 text-xs" style={{ color: "rgba(247,247,244,0.8)" }}>
          <span className="inline-block rounded-full mt-1.5 shrink-0" style={{ width: 5, height: 5, background: tone }} />
          {it}
        </li>
      ))}
    </ul>
  );
}

function Chip({ label, tone = "muted" }: { label: string; tone?: "muted" | "gold" | "green" }) {
  const styles = {
    muted: { background: PANEL_HI, color: MUTED },
    gold: { background: "rgba(255,212,90,0.14)", color: GOLD },
    green: { background: "rgba(74,222,128,0.12)", color: GREEN },
  }[tone];
  return (
    <span className="text-xs font-semibold px-2 py-0.5 rounded-full capitalize" style={styles}>{label}</span>
  );
}

// ── Today: priority work queue ───────────────────────────────────────────────
function statusMeta(status: LeadStatus): { label: string; color: string; Icon: typeof Clock } {
  switch (status) {
    case "awaiting": return { label: "Awaiting reply", color: GOLD, Icon: MessageCircle };
    case "cold": return { label: "Going cold", color: RED, Icon: Snowflake };
    case "new": return { label: "New", color: "#93c5fd", Icon: Sparkles };
    case "closed": return { label: "Closed", color: MUTED, Icon: Clock };
    default: return { label: "In progress", color: MUTED, Icon: Clock };
  }
}

function TodayQueue({ cards, onOpen }: { cards: LeadCard[]; onOpen: (c: LeadCard) => void }) {
  const urgency = (c: LeadCard) =>
    c.priority + (c.status === "awaiting" ? 1000 : 0) + (c.status === "cold" ? 600 : 0) + (c.status === "new" ? 300 : 0);
  const ranked = cards.filter((c) => c.status !== "closed").sort((a, b) => urgency(b) - urgency(a));
  const awaiting = cards.filter((c) => c.status === "awaiting").length;
  const cold = cards.filter((c) => c.status === "cold").length;

  return (
    <div className="mt-5">
      <div className="flex items-center gap-4 flex-wrap mb-4">
        <h2 className="text-lg font-extrabold m-0" style={{ color: TEXT }}>Today — who to work first</h2>
        <div className="flex items-center gap-3 text-xs" style={{ color: MUTED }}>
          <span className="flex items-center gap-1"><MessageCircle size={13} style={{ color: GOLD }} /> {awaiting} awaiting</span>
          <span className="flex items-center gap-1"><Snowflake size={13} style={{ color: RED }} /> {cold} going cold</span>
          <span>{ranked.length} active</span>
        </div>
      </div>

      {ranked.length === 0 ? (
        <div className="rounded-2xl px-6 py-10 text-center text-sm" style={{ background: PANEL, border: `1px solid ${LINE}`, color: FAINT }}>
          You're all caught up. Nothing needs attention right now.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {ranked.map((card) => {
            const meta = statusMeta(card.status);
            return (
              <button
                key={card.lead.id}
                onClick={() => onOpen(card)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left"
                style={{ background: PANEL, border: `1px solid ${card.status === "cold" ? "rgba(248,113,113,0.22)" : LINE}`, cursor: "pointer" }}
              >
                <meta.Icon size={17} style={{ color: meta.color, flexShrink: 0 }} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold truncate" style={{ color: TEXT }}>{card.lead.name}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded-full shrink-0" style={{ background: PANEL_HI, color: meta.color }}>{meta.label}</span>
                  </div>
                  <div className="text-xs truncate mt-0.5" style={{ color: FAINT }}>{card.lead.propertyInterest} · {card.lead.budget}</div>
                </div>
                <div className="text-right shrink-0 hidden sm:block" style={{ minWidth: "8rem" }}>
                  <div className="text-xs font-semibold" style={{ color: meta.color }}>{card.nextAction}</div>
                  <div className="text-[0.7rem]" style={{ color: FAINT }}>priority {card.priority}</div>
                </div>
                <ArrowRight size={16} style={{ color: FAINT, flexShrink: 0 }} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Pipeline: stage board ──────────────────────────────────────────────────
function PipelineBoard({ cards, onAdvance, onOpen }: { cards: LeadCard[]; onAdvance: (lead: Lead) => void; onOpen: (c: LeadCard) => void }) {
  return (
    <div className="mt-5 overflow-x-auto pb-2">
      <div className="flex gap-3" style={{ minWidth: "60rem" }}>
        {PIPELINE_STAGES.map((col) => {
          const items = cards.filter((c) => c.stage === col.key).sort((a, b) => b.priority - a.priority);
          return (
            <div key={col.key} className="flex-1 rounded-2xl flex flex-col" style={{ background: PANEL, border: `1px solid ${LINE}`, minWidth: "12.5rem" }}>
              <div className="px-3 py-2.5 flex items-center justify-between sticky top-0" style={{ borderBottom: `1px solid ${LINE}` }}>
                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: col.key === "closed_won" ? GREEN : MUTED }}>{col.label}</span>
                <span className="text-xs px-1.5 rounded-full" style={{ background: PANEL_HI, color: FAINT }}>{items.length}</span>
              </div>
              <div className="p-2 flex flex-col gap-2 overflow-y-auto" style={{ maxHeight: "calc(100vh - 18rem)", minHeight: "8rem" }}>
                {items.map((card) => {
                  const canAdvance = nextStage(card.stage) !== null;
                  return (
                    <div key={card.lead.id} className="rounded-xl p-2.5" style={{ background: PANEL_HI, border: `1px solid ${LINE}` }}>
                      <button onClick={() => onOpen(card)} className="w-full text-left" style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0 }}>
                        <div className="flex items-center gap-1.5">
                          <span className="inline-block rounded-full shrink-0" style={{ width: 6, height: 6, background: priorityColor(card.priority) }} />
                          <span className="text-sm font-semibold truncate" style={{ color: TEXT }}>{card.lead.name}</span>
                        </div>
                        <div className="text-xs truncate mt-0.5" style={{ color: FAINT }}>{card.lead.propertyInterest}</div>
                      </button>
                      {canAdvance && (
                        <button
                          onClick={() => onAdvance(card.lead)}
                          className="mt-2 w-full flex items-center justify-center gap-1 py-1 rounded-lg text-[0.7rem] font-bold"
                          style={{ background: "transparent", border: `1px solid ${LINE}`, color: MUTED, cursor: "pointer" }}
                        >
                          Advance <ArrowRight size={12} />
                        </button>
                      )}
                    </div>
                  );
                })}
                {items.length === 0 && <div className="text-xs text-center py-3" style={{ color: FAINT }}>—</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Automations control panel (agent-controlled, Amanah-aligned) ─────────────
function AutomationsModal({
  automations,
  onChange,
  onClose,
}: {
  automations: Automations;
  onChange: (patch: Partial<Automations>) => void;
  onClose: () => void;
}) {
  const rows: { key: "autoQualify" | "zeroSecondReply" | "autoFollowUp"; title: string; desc: string }[] = [
    { key: "autoQualify", title: "Auto-qualify inbound", desc: "Extract role, budget, looking-for, dealbreakers, urgency & bot probability the moment a message lands." },
    { key: "zeroSecondReply", title: "Zero-second auto-reply", desc: "Send an instant qualifying menu on first contact so intent is captured even while you're away." },
    { key: "autoFollowUp", title: "Auto follow-up", desc: "Draft a nudge for leads going cold and queue it in Today for your one-tap approval." },
  ];
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md rounded-2xl p-6" style={{ background: "#1e1e1e", border: `1px solid ${LINE}` }}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-extrabold m-0 flex items-center gap-2" style={{ color: TEXT }}>
            <Zap size={18} style={{ color: GOLD }} /> Automations
          </h2>
          <button onClick={onClose} className="icon-button btn-sm" aria-label="Close"><X size={18} /></button>
        </div>
        <p className="text-sm m-0 mb-4" style={{ color: MUTED }}>
          re:AI does the busywork — qualifying, replying, following up. <strong style={{ color: TEXT }}>You stay in control</strong>: nothing is sent to a client without your say-so.
        </p>

        <div className="flex flex-col gap-2.5">
          {rows.map((r) => {
            const on = automations[r.key];
            return (
              <div key={r.key} className="flex items-start gap-3 p-3 rounded-xl" style={{ background: PANEL_HI, border: `1px solid ${LINE}` }}>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold" style={{ color: TEXT }}>{r.title}</div>
                  <div className="text-xs mt-0.5" style={{ color: MUTED }}>{r.desc}</div>
                </div>
                <button
                  onClick={() => onChange({ [r.key]: !on })}
                  className="shrink-0 rounded-full transition-colors"
                  style={{ width: "2.5rem", height: "1.4rem", background: on ? GREEN : "rgba(255,255,255,0.15)", border: "none", cursor: "pointer", position: "relative" }}
                  aria-label={`Toggle ${r.title}`}
                >
                  <span className="block rounded-full" style={{ width: "1.05rem", height: "1.05rem", background: "#fff", position: "absolute", top: "0.17rem", left: on ? "1.28rem" : "0.17rem", transition: "left 140ms ease" }} />
                </button>
              </div>
            );
          })}
        </div>

        {automations.zeroSecondReply && (
          <div className="mt-3">
            <label className="text-xs font-bold uppercase tracking-wider" style={{ color: FAINT }}>Zero-second reply message</label>
            <textarea
              value={automations.menuText}
              onChange={(e) => onChange({ menuText: e.target.value })}
              rows={3}
              className="mt-1 w-full resize-none rounded-xl px-3 py-2 text-sm outline-none"
              style={{ background: "rgba(0,0,0,0.25)", border: `1px solid ${LINE}`, color: TEXT }}
            />
          </div>
        )}

        <p className="text-[0.7rem] mt-4 m-0 flex items-center gap-1.5" style={{ color: FAINT }}>
          <Bot size={12} /> Demo mode — automations fire on "Simulate inbound". Saved on this device.
        </p>
      </div>
    </div>
  );
}

// ── Mock QR connect (sells the unofficial-WhatsApp story, zero risk) ─────────
function QrConnectModal({ onClose, onConnect }: { onClose: () => void; onConnect: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-sm rounded-2xl p-6" style={{ background: "#1e1e1e", border: `1px solid ${LINE}` }}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-extrabold m-0 flex items-center gap-2" style={{ color: TEXT }}>
            <MessageCircle size={18} style={{ color: "#25D366" }} /> Connect WhatsApp
          </h2>
          <button onClick={onClose} className="icon-button btn-sm" aria-label="Close"><X size={18} /></button>
        </div>
        <p className="text-sm m-0 mb-4" style={{ color: MUTED }}>
          Link your own number — no Business API needed. Open WhatsApp → <strong style={{ color: TEXT }}>Linked devices</strong> → scan this code.
        </p>
        <div className="mx-auto rounded-xl grid place-items-center" style={{ width: "12rem", height: "12rem", background: "#fff" }}>
          <FakeQr />
        </div>
        <button
          onClick={onConnect}
          className="mt-5 w-full py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
          style={{ background: "#25D366", color: "#04210f", border: "none", cursor: "pointer" }}
        >
          <QrCode size={15} /> Simulate scan & connect
        </button>
        <p className="text-[0.65rem] text-center mt-2 m-0" style={{ color: FAINT }}>Demo mode — no real device is linked.</p>
      </div>
    </div>
  );
}

function FakeQr() {
  // Deterministic pseudo-QR grid (decorative).
  const cells = [];
  for (let i = 0; i < 169; i++) {
    const on = (i * 73 + (i % 13) * 31 + Math.floor(i / 13) * 17) % 3 === 0;
    cells.push(<div key={i} style={{ background: on ? "#000" : "transparent" }} />);
  }
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(13, 1fr)", width: "10rem", height: "10rem", gap: 1 }}>
      {cells}
    </div>
  );
}
