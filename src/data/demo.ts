import type { Agent, Conversation, DashboardData, Integration, Lead, LeadIntelligence, Listing, ListingPitch, Message, PropertyReport } from "../types";

function formatRm(value: number): string {
  return `RM ${value.toLocaleString("en-MY")}`;
}

export const demoAgent: Agent = {
  id: "agent_demo",
  workosUserId: "user_demo",
  fullName: "Zitouni Maliki",
  email: "z.maliki@signatis.app",
  phone: "+60 12-555 8472",
  plan: "Premium Agent",
  avatarInitials: "ZM",
  ingestionAddress: "inbound+zm8472@leads.signatis.app",
  renNumber: "REN 58234",
  agencyName: "Signatis Realty",
  whatsappNumber: "+60 12-555 8472",
  avatarUrl: "",
  companyLogoUrl: "",
  bio: "Real estate negotiator specializing in residential properties in Klang Valley.",
};

export const demoLeads: Lead[] = [
  {
    id: "lead_1",
    agentId: demoAgent.id,
    name: "Amanda Lee",
    email: "amanda.l@example.com",
    phone: "+60 12-019 8472",
    source: "Direct Inquiry",
    propertyInterest: "Downtown condo",
    budget: "RM 850k",
    emailOpens: 8,
    linkClicks: 4,
    reportViews: 2,
    inquirySentiment: 0.7,
    sentiment: "positive",
    score: 31,
    intent: 1,
    tier: "Hot",
    stage: "engaged",
    preferredChannel: "whatsapp",
    createdAt: "2026-06-09T10:30:00.000Z",
  },
  {
    id: "lead_2",
    agentId: demoAgent.id,
    name: "Chen Wei Kiat",
    email: "cwk_99@test.com",
    phone: "+60 17-448 2041",
    source: "Facebook",
    propertyInterest: "Subang family home",
    budget: "RM 1.2M",
    emailOpens: 2,
    linkClicks: 0,
    reportViews: 0,
    inquirySentiment: 0.1,
    sentiment: "neutral",
    score: 2,
    intent: 0,
    tier: "Cold",
    stage: "new",
    preferredChannel: "messenger",
    createdAt: "2026-06-08T15:20:00.000Z",
  },
  {
    id: "lead_3",
    agentId: demoAgent.id,
    name: "Sarah Mahmud",
    email: "sarah.m88@mail.com",
    phone: "+60 19-482 5510",
    source: "Lowyat",
    propertyInterest: "Mont Kiara unit",
    budget: "RM 980k",
    emailOpens: 12,
    linkClicks: 7,
    reportViews: 3,
    inquirySentiment: -0.4,
    sentiment: "negative",
    score: 43,
    intent: 1,
    tier: "Hot",
    stage: "negotiating",
    preferredChannel: "telegram",
    createdAt: "2026-06-07T12:15:00.000Z",
  },
  {
    id: "lead_4",
    agentId: demoAgent.id,
    name: "David Tan",
    email: "dtan.invest@biz.com",
    phone: "+60 13-775 1158",
    source: "Direct Inquiry",
    propertyInterest: "Klang Valley shoplot",
    budget: "RM 2.4M",
    emailOpens: 1,
    linkClicks: 0,
    reportViews: 0,
    inquirySentiment: 0,
    sentiment: "neutral",
    score: 1,
    intent: 0,
    tier: "Cold",
    stage: "new",
    preferredChannel: "phone",
    createdAt: "2026-06-05T08:00:00.000Z",
  },
];

function reportExtras(
  propertyName: string,
  propertyKey: string,
  marketSignal: string,
  sentimentSummary: string,
  askingPriceRm: number,
  tenure: "freehold" | "leasehold" | "unknown" = "freehold",
): Pick<
  PropertyReport,
  "propertyName" | "propertyKey" | "cacheStatus" | "shareToken" | "inputSnapshot" | "indexLookup" | "analytics" | "citations" | "comparableListings" | "contentSections"
> {
  return {
    propertyName,
    propertyKey,
    cacheStatus: "hit",
    shareToken: `shr_demo_${propertyKey}`,
    indexLookup: {
      propertyKey,
      status: "fresh_hit",
      liveSearchStatus: "not_needed",
      freshnessDays: 1,
      citationsCount: 1,
      summary: marketSignal,
      checkedAt: "2026-06-10T10:30:00.000Z",
    },
    inputSnapshot: {
      propertyName,
      address: propertyName,
      propertyType: "Residential Property",
      listingIntent: "sale",
      tenure,
      askingPriceRm,
      sqft: 0,
      bedrooms: 0,
      bathrooms: 0,
      yearBuilt: 2026,
    },
    analytics: {
      sentiment: "positive",
      pricingTrend: marketSignal,
      confidenceScore: 0.82,
      dataCompleteness: 0.78,
      priceCertainty: 0.45,
      freshnessDays: 1,
    },
    citations: [
      {
        title: "Signatis deterministic market model",
        url: "https://signatis.app/research/static-market-model",
      },
    ],
    comparableListings: [],
    contentSections: [
      { title: "Market read", body: `${marketSignal} at ${formatRm(askingPriceRm)} with ${tenure} tenure.` },
      { title: "Buyer sentiment", body: sentimentSummary },
    ],
  };
}

export const demoReports: PropertyReport[] = [
  {
    id: "report_1",
    agentId: demoAgent.id,
    title: "142 Oak St Analysis",
    address: "142 Oak St",
    propertyType: "Terrace House",
    sqft: 2500,
    bedrooms: 4,
    bathrooms: 3,
    yearBuilt: 2018,
    status: "ready",
    marketSignal: "Premium resale signal",
    sentimentSummary: "Neighborhood stability and family amenities lead buyer sentiment.",
    generatedAt: "2026-06-10T10:30:00.000Z",
    ...reportExtras(
      "142 Oak St",
      "142-oak-st",
      "Premium resale signal",
      "Neighborhood stability and family amenities lead buyer sentiment.",
      1250000,
      "freehold",
    ),
  },
  {
    id: "report_2",
    agentId: demoAgent.id,
    title: "Downtown Market Overview",
    address: "Downtown Market Overview",
    propertyType: "Market Brief",
    sqft: 1800,
    bedrooms: 3,
    bathrooms: 2,
    yearBuilt: 2020,
    status: "ready",
    marketSignal: "Balanced market signal",
    sentimentSummary: "Urban convenience is the dominant buyer narrative.",
    generatedAt: "2026-06-09T12:00:00.000Z",
    ...reportExtras(
      "Downtown Market Overview",
      "downtown-market-overview",
      "Balanced market signal",
      "Urban convenience is the dominant buyer narrative.",
      850000,
      "leasehold",
    ),
  },
  {
    id: "report_3",
    agentId: demoAgent.id,
    title: "Q3 Predictor Model",
    address: "Klang Valley Portfolio",
    propertyType: "Forecast",
    sqft: 3200,
    bedrooms: 0,
    bathrooms: 0,
    yearBuilt: 2026,
    status: "running",
    marketSignal: "Processing market deltas",
    sentimentSummary: "Awaiting neighborhood sentiment refresh.",
    generatedAt: "2026-06-10T09:15:00.000Z",
    ...reportExtras(
      "Klang Valley Portfolio",
      "klang-valley-portfolio",
      "Processing market deltas",
      "Awaiting neighborhood sentiment refresh.",
      2400000,
      "unknown",
    ),
  },
];

export const demoIntegrations: Integration[] = [
  {
    id: "integration_calendar",
    agentId: demoAgent.id,
    name: "Google Calendar",
    description: "Syncs property showings and client meetings.",
    status: "connected",
  },
  {
    id: "integration_data",
    agentId: demoAgent.id,
    name: "Licensed Market Data",
    description: "Live property data for report generation.",
    status: "connected",
  },
];

export const demoDashboard: DashboardData = {
  agent: demoAgent,
  totals: {
    leadsScored: 1248,
    averageIntentScore: 0.84,
    reportsGenerated: 342,
    highIntentLeads: 2,
  },
  highIntentLeads: demoLeads.filter((lead) => lead.intent === 1),
  recentReports: demoReports,
};

// ── Omnibox (Omni-Inbox) demo bundle ──────────────────────────────────────
// Self-contained so the Omnibox renders with zero backend (demo mode).
const minsAgo = (m: number) => new Date(Date.now() - m * 60000).toISOString();

export const demoListings: Listing[] = [
  {
    id: "listing_demo_1",
    agentId: demoAgent.id,
    propertyKey: "pr1ma-bandar-layangkasa",
    title: "PR1MA, Bandar Layangkasa",
    address: "Bandar Layangkasa, Dengkil, Selangor",
    propertyType: "Serviced Residence",
    listingIntent: "sale",
    askingPriceRm: 310000,
    bedrooms: 3,
    bathrooms: 2,
    builtUpSqft: 850,
    area: "Dengkil",
    portalRefs: { propertyguru: "PG-pr1mab", iproperty: "IP-pr1mab" },
    status: "active",
    createdAt: minsAgo(60 * 24 * 3),
  },
  {
    id: "listing_demo_2",
    agentId: demoAgent.id,
    propertyKey: "residensi-suasana-damansara-damai",
    title: "Residensi Suasana, Damansara Damai",
    address: "Damansara Damai, Petaling Jaya",
    propertyType: "Condominium",
    listingIntent: "sale",
    askingPriceRm: 450000,
    bedrooms: 3,
    bathrooms: 2,
    builtUpSqft: 1000,
    area: "Damansara Damai",
    portalRefs: { propertyguru: "PG-suasana", iproperty: "IP-suasana" },
    status: "active",
    createdAt: minsAgo(60 * 24 * 2),
  },
  {
    id: "listing_demo_3",
    agentId: demoAgent.id,
    propertyKey: "mont-kiara-astana",
    title: "Mont Kiara Astana",
    address: "Mont Kiara, Kuala Lumpur",
    propertyType: "Condominium",
    listingIntent: "rent",
    askingPriceRm: 3500,
    bedrooms: 2,
    bathrooms: 2,
    builtUpSqft: 1100,
    area: "Mont Kiara",
    portalRefs: { propertyguru: "PG-mkastana" },
    status: "active",
    createdAt: minsAgo(60 * 24),
  },
];

export const demoOmniLeads: Lead[] = [
  {
    id: "lead_omni_1", agentId: demoAgent.id, name: "Nurul Hidayah", email: "nurulhiday@inbox.lead",
    phone: "+60 12-388 1029", source: "WhatsApp", propertyInterest: "PR1MA, Bandar Layangkasa", budget: "RM 300k - 330k",
    emailOpens: 0, linkClicks: 0, reportViews: 1, inquirySentiment: 0.8, sentiment: "positive",
    score: 22, intent: 1, tier: "Hot", stage: "engaged", preferredChannel: "whatsapp", listingId: "listing_demo_1", createdAt: minsAgo(240),
  },
  {
    id: "lead_omni_2", agentId: demoAgent.id, name: "Daniel Wong", email: "danielwong@inbox.lead",
    phone: "N/A", source: "Facebook", propertyInterest: "Residensi Suasana, Damansara Damai", budget: "RM 420k - 480k",
    emailOpens: 0, linkClicks: 0, reportViews: 1, inquirySentiment: 0, sentiment: "neutral",
    score: 12, intent: 0, tier: "Warm", stage: "contacted", preferredChannel: "messenger", listingId: "listing_demo_2", createdAt: minsAgo(90),
  },
  {
    id: "lead_omni_3", agentId: demoAgent.id, name: "Investor Lead (unverified)", email: "unknown@inbox.lead",
    phone: "+60 11-5500 0000", source: "WhatsApp", propertyInterest: "Mont Kiara Astana", budget: "Not specified",
    emailOpens: 0, linkClicks: 0, reportViews: 0, inquirySentiment: 0, sentiment: "neutral",
    score: 1, intent: 0, tier: "Cold", stage: "new", preferredChannel: "whatsapp", listingId: "listing_demo_3", createdAt: minsAgo(30),
  },
];

export const demoConversations: Conversation[] = [
  {
    id: "conv_demo_1", agentId: demoAgent.id, leadId: "lead_omni_1", listingId: "listing_demo_1",
    channel: "whatsapp", externalId: "+60 12-388 1029", contactName: "Nurul Hidayah", contactHandle: "+60 12-388 1029",
    status: "open", unreadCount: 1, lastMessageAt: minsAgo(230), lastMessagePreview: "Perfect, this one is 3R2B at RM310k. Sending you the full report now.", createdAt: minsAgo(240),
  },
  {
    id: "conv_demo_2", agentId: demoAgent.id, leadId: "lead_omni_2", listingId: "listing_demo_2",
    channel: "messenger", externalId: "daniel.wong.92", contactName: "Daniel Wong", contactHandle: "daniel.wong.92",
    status: "open", unreadCount: 1, lastMessageAt: minsAgo(60), lastMessagePreview: "Honestly the price feels a bit high vs the one nearby. Can owner nego?", createdAt: minsAgo(90),
  },
  {
    id: "conv_demo_3", agentId: demoAgent.id, leadId: "lead_omni_3", listingId: "listing_demo_3",
    channel: "whatsapp", externalId: "+60 11-5500 0000", contactName: "Investor Lead (unverified)", contactHandle: "+60 11-5500 0000",
    status: "open", unreadCount: 1, lastMessageAt: minsAgo(30), lastMessagePreview: "GUARANTEED HIGH ROI!! Click here to list your property FREE bit.ly/xy9", createdAt: minsAgo(30),
  },
];

export const demoMessages: Record<string, Message[]> = {
  conv_demo_1: [
    { id: "m1a", conversationId: "conv_demo_1", agentId: demoAgent.id, direction: "inbound", author: "lead", body: "Hi, saw the PR1MA Bandar Layangkasa unit on PropertyGuru. Is it still available?", kind: "text", sentAt: minsAgo(240) },
    { id: "m1b", conversationId: "conv_demo_1", agentId: demoAgent.id, direction: "outbound", author: "auto", body: "Hi! Thanks for reaching out 👋 To help you fast, are you looking to: 1) Buy to stay  2) Buy to invest  3) Just checking price", kind: "menu", sentAt: minsAgo(239) },
    { id: "m1c", conversationId: "conv_demo_1", agentId: demoAgent.id, direction: "inbound", author: "lead", body: "1, buy to stay. My budget is around 320k, need 3 rooms. Must be near the MRT though, I don't drive.", kind: "menu_reply", sentAt: minsAgo(235) },
    { id: "m1d", conversationId: "conv_demo_1", agentId: demoAgent.id, direction: "outbound", author: "agent", body: "Perfect, this one is 3R2B at RM310k. Sending you the full report now.", kind: "text", sentAt: minsAgo(230) },
  ],
  conv_demo_2: [
    { id: "m2a", conversationId: "conv_demo_2", agentId: demoAgent.id, direction: "inbound", author: "lead", body: "Hello, interested in Residensi Suasana. What's the maintenance fee like? And is it freehold?", kind: "text", sentAt: minsAgo(90) },
    { id: "m2b", conversationId: "conv_demo_2", agentId: demoAgent.id, direction: "outbound", author: "agent", body: "Hi Daniel! Maintenance is ~RM0.28/sqft, and yes it's freehold.", kind: "text", sentAt: minsAgo(80) },
    { id: "m2c", conversationId: "conv_demo_2", agentId: demoAgent.id, direction: "inbound", author: "lead", body: "Ok noted. Honestly the price feels a bit high vs the one nearby. Can owner nego?", kind: "text", sentAt: minsAgo(60) },
  ],
  conv_demo_3: [
    { id: "m3a", conversationId: "conv_demo_3", agentId: demoAgent.id, direction: "inbound", author: "lead", body: "GUARANTEED HIGH ROI!! Click here to list your property FREE bit.ly/xy9 co-broke welcome", kind: "text", sentAt: minsAgo(30) },
  ],
};

export const demoPitches: ListingPitch[] = [
  {
    id: "pitch_demo_1",
    property: "Residensi Suasana, Damansara Damai",
    ownerName: "Pn. Faridah",
    recommendedRange: "RM 432,000 – RM 468,000",
    reliability: "Moderate · 71%",
    stage: "won",
    createdAt: minsAgo(60 * 24 * 6),
  },
  {
    id: "pitch_demo_2",
    property: "Sunway Velocity V Residence",
    ownerName: "Mr. Tan",
    recommendedRange: "RM 610,000 – RM 660,000",
    reliability: "Moderate · 68%",
    stage: "responded",
    createdAt: minsAgo(60 * 20),
  },
];

export const demoLeadIntelligence: LeadIntelligence[] = [
  {
    leadId: "lead_omni_1", agentId: demoAgent.id, role: "buyer", budgetMinRm: 300000, budgetMaxRm: 330000,
    lookingFor: ["3 bedrooms", "Buy to stay (own-stay)", "Walking distance to MRT/public transit"],
    dealbreakers: ["No car — must be transit-accessible", "Above RM330k"], objections: [],
    urgencyTier: "alpha", matchPct: 88, matchedListingId: "listing_demo_1", botProbability: 0.03, priorityPct: 91,
    xai: {
      summary: "High-priority buyer: clear own-stay intent, budget brackets the asking price, and the unit fits the 3-room requirement. Only watch-item is transit access.",
      factors: [
        { label: "Budget fit", detail: "Stated RM300–330k brackets the RM310k asking price.", weight: 0.35 },
        { label: "Intent clarity", detail: "Chose 'buy to stay' in the qualifying menu within 5 min.", weight: 0.3 },
        { label: "Requirement match", detail: "Needs 3 rooms; unit is 3R2B.", weight: 0.2 },
        { label: "Urgency", detail: "Fast replies, asked availability first.", weight: 0.15 },
      ],
      sources: ["Qualifying menu reply", "OpenDOSM Dengkil price band (anchor)", "Listing record RM310k"],
    },
    updatedAt: minsAgo(230),
  },
  {
    leadId: "lead_omni_2", agentId: demoAgent.id, role: "buyer", budgetMinRm: 420000, budgetMaxRm: 480000,
    lookingFor: ["Freehold tenure", "Reasonable maintenance fee"], dealbreakers: ["Overpriced vs nearby comparables"],
    objections: ["Price perceived high vs nearby comps", "Negotiation expected"],
    urgencyTier: "beta", matchPct: 72, matchedListingId: "listing_demo_2", botProbability: 0.05, priorityPct: 68,
    xai: {
      summary: "Engaged buyer with a price objection. Budget covers the asking price but sentiment is price-sensitive; needs a comps-backed justification to move forward.",
      factors: [
        { label: "Budget fit", detail: "RM420–480k covers the RM450k asking price.", weight: 0.3 },
        { label: "Objection", detail: "Explicit price-vs-comparables concern; expects negotiation.", weight: 0.3 },
        { label: "Engagement", detail: "Asked specific due-diligence questions (tenure, fees).", weight: 0.25 },
        { label: "Urgency", detail: "Replies within the hour but no timeline stated.", weight: 0.15 },
      ],
      sources: ["Conversation objection flags", "OpenDOSM Petaling price band (anchor)", "Listing record RM450k"],
    },
    updatedAt: minsAgo(60),
  },
  {
    leadId: "lead_omni_3", agentId: demoAgent.id, role: "unknown", lookingFor: [], dealbreakers: [], objections: [],
    urgencyTier: "passive", matchPct: 0, botProbability: 0.93, priorityPct: 4,
    xai: {
      summary: "Likely spam / co-broke fisher. Message contains a shortened link, all-caps marketing, and no genuine inquiry signal. Flagged by the integrity shield.",
      factors: [
        { label: "Bot probability", detail: "Shortened link + ALL CAPS promo + generic 'co-broke welcome'.", weight: 0.6 },
        { label: "No intent signal", detail: "No property question, budget, or qualifying answer.", weight: 0.4 },
      ],
      sources: ["Integrity shield: link + spam-pattern detection"],
    },
    updatedAt: minsAgo(30),
  },
];
