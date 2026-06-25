import { createClient } from "@tursodatabase/serverless/compat";
import { buildReportDraft, buildReportPropertyKey, compactPropertyName, normalizeReportInput } from "../domain/reports";
import { getRuntimeEnv } from "./runtime-env";
import type {
  Agent,
  Conversation,
  ConversationChannel,
  ConversationStatus,
  DashboardData,
  Integration,
  Lead,
  LeadEvent,
  LeadIntelligence,
  LeadRole,
  LeadStage,
  LeadXai,
  Listing,
  ListingIntent,
  ListingStatus,
  Message,
  MessageAuthor,
  MessageDirection,
  MessageKind,
  PreferredChannel,
  PropertyReport,
  PropertyReportInput,
  ReportAnalytics,
  ReportCacheStatus,
  ReportCitation,
  ReportComparableListing,
  ReportContentSection,
  ReportIndexLookup,
  ReportInputSnapshot,
  SupportRequest,
  UrgencyTier,
} from "../types";
import { computeLeadScore } from "../domain/leadScoring";

type SqlPrimitive = string | number | boolean | null;

export type SqlArgs = SqlPrimitive[];

export interface DbEnv {
  TURSO_DATABASE_URL?: string;
  TURSO_AUTH_TOKEN?: string;
}

export interface TursoConfig {
  url: string;
  authToken: string;
}

export interface QueryResult<Row = Record<string, unknown>> {
  rows: Row[];
}

export interface ReAIDbClient {
  execute<Row = Record<string, unknown>>(
    statement:
      | string
      | {
          sql: string;
          args?: SqlArgs;
        },
  ): Promise<QueryResult<Row>>;
}

export interface PropertyIntelligenceCache {
  propertyKey: string;
  propertyName: string;
  payload: Record<string, unknown>;
  citations: ReportCitation[];
  refreshedAt: string;
}

export interface DeveloperIntelligenceCache {
  developerKey: string;
  developerName: string;
  pastProjects: string[];
  upcomingProjects: string[];
  sentiment?: string;
  refreshedAt: string;
}

export function getTursoConfig(env: DbEnv): TursoConfig {
  if (!env.TURSO_DATABASE_URL) {
    throw new Error("Missing environment variable TURSO_DATABASE_URL");
  }

  if (!env.TURSO_AUTH_TOKEN) {
    throw new Error("Missing environment variable TURSO_AUTH_TOKEN");
  }

  return {
    url: env.TURSO_DATABASE_URL,
    authToken: env.TURSO_AUTH_TOKEN,
  };
}

export function toSqlArgs(values: Array<SqlPrimitive | undefined>): SqlArgs {
  return values.filter((value): value is SqlPrimitive => value !== undefined);
}

export function createReAIDb(env: DbEnv): ReAIDbClient {
  const runtimeEnv = getRuntimeEnv();
  return createClient(
    getTursoConfig({
      TURSO_DATABASE_URL: env.TURSO_DATABASE_URL ?? runtimeEnv.TURSO_DATABASE_URL,
      TURSO_AUTH_TOKEN: env.TURSO_AUTH_TOKEN ?? runtimeEnv.TURSO_AUTH_TOKEN,
    }),
  );
}

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    workos_user_id TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    plan TEXT NOT NULL,
    avatar_initials TEXT NOT NULL,
    ingestion_address TEXT NOT NULL,
    ren_number TEXT,
    agency_name TEXT,
    whatsapp_number TEXT,
    avatar_url TEXT,
    company_logo_url TEXT,
    bio TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS leads (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    source TEXT NOT NULL,
    property_interest TEXT NOT NULL,
    budget TEXT NOT NULL,
    email_opens INTEGER NOT NULL,
    link_clicks INTEGER NOT NULL,
    report_views INTEGER NOT NULL,
    inquiry_sentiment REAL NOT NULL,
    sentiment TEXT NOT NULL,
    score INTEGER NOT NULL,
    intent INTEGER NOT NULL,
    tier TEXT NOT NULL,
    stage TEXT NOT NULL DEFAULT 'new',
    preferred_channel TEXT NOT NULL DEFAULT 'whatsapp',
    last_contacted_at TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY(agent_id) REFERENCES agents(id)
  )`,
  `CREATE TABLE IF NOT EXISTS lead_events (
    id TEXT PRIMARY KEY,
    lead_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    event_label TEXT NOT NULL,
    occurred_at TEXT NOT NULL,
    FOREIGN KEY(lead_id) REFERENCES leads(id),
    FOREIGN KEY(agent_id) REFERENCES agents(id)
  )`,
  `CREATE TABLE IF NOT EXISTS property_reports (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    title TEXT NOT NULL,
    property_name TEXT,
    property_key TEXT,
    address TEXT NOT NULL,
    property_type TEXT NOT NULL,
    sqft INTEGER NOT NULL,
    bedrooms INTEGER NOT NULL,
    bathrooms REAL NOT NULL,
    year_built INTEGER NOT NULL,
    status TEXT NOT NULL,
    market_signal TEXT NOT NULL,
    sentiment_summary TEXT NOT NULL,
    cache_status TEXT,
    share_token TEXT,
    input_json TEXT,
    analytics_json TEXT,
    citations_json TEXT,
    content_sections_json TEXT,
    generated_at TEXT NOT NULL,
    FOREIGN KEY(agent_id) REFERENCES agents(id)
  )`,
  `CREATE TABLE IF NOT EXISTS property_intelligence_cache (
    property_key TEXT PRIMARY KEY,
    property_name TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    citations_json TEXT NOT NULL,
    refreshed_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS developer_intelligence_cache (
    developer_key TEXT PRIMARY KEY,
    developer_name TEXT NOT NULL,
    past_projects_json TEXT NOT NULL DEFAULT '[]',
    upcoming_projects_json TEXT NOT NULL DEFAULT '[]',
    sentiment TEXT,
    refreshed_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS integrations (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL,
    FOREIGN KEY(agent_id) REFERENCES agents(id)
  )`,
  `CREATE TABLE IF NOT EXISTS support_requests (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(agent_id) REFERENCES agents(id)
  )`,
  `CREATE TABLE IF NOT EXISTS agent_credentials (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    encrypted_value TEXT NOT NULL,
    metadata_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(agent_id) REFERENCES agents(id)
  )`,
  `CREATE TABLE IF NOT EXISTS otp_codes (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    code TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    used INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  // ── Omnibox (Omni-Inbox) ──────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS listings (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    property_key TEXT NOT NULL,
    title TEXT NOT NULL,
    address TEXT NOT NULL DEFAULT '',
    property_type TEXT NOT NULL DEFAULT 'Residential',
    listing_intent TEXT NOT NULL DEFAULT 'sale',
    asking_price_rm INTEGER NOT NULL DEFAULT 0,
    bedrooms INTEGER,
    bathrooms REAL,
    built_up_sqft INTEGER,
    area TEXT,
    portal_refs_json TEXT NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL,
    FOREIGN KEY(agent_id) REFERENCES agents(id)
  )`,
  `CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    lead_id TEXT,
    listing_id TEXT,
    channel TEXT NOT NULL,
    external_id TEXT NOT NULL,
    contact_name TEXT NOT NULL DEFAULT '',
    contact_handle TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'open',
    unread_count INTEGER NOT NULL DEFAULT 0,
    last_message_at TEXT,
    last_message_preview TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    FOREIGN KEY(agent_id) REFERENCES agents(id)
  )`,
  `CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    direction TEXT NOT NULL,
    author TEXT NOT NULL DEFAULT '',
    body TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'text',
    raw_json TEXT NOT NULL DEFAULT '{}',
    sent_at TEXT NOT NULL,
    FOREIGN KEY(conversation_id) REFERENCES conversations(id),
    FOREIGN KEY(agent_id) REFERENCES agents(id)
  )`,
  `CREATE TABLE IF NOT EXISTS lead_intelligence (
    lead_id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'unknown',
    budget_min_rm INTEGER,
    budget_max_rm INTEGER,
    looking_for_json TEXT NOT NULL DEFAULT '[]',
    dealbreakers_json TEXT NOT NULL DEFAULT '[]',
    objections_json TEXT NOT NULL DEFAULT '[]',
    urgency_tier TEXT NOT NULL DEFAULT 'passive',
    match_pct INTEGER,
    matched_listing_id TEXT,
    bot_probability REAL NOT NULL DEFAULT 0,
    priority_pct INTEGER NOT NULL DEFAULT 0,
    xai_json TEXT NOT NULL DEFAULT '{}',
    updated_at TEXT NOT NULL,
    FOREIGN KEY(lead_id) REFERENCES leads(id),
    FOREIGN KEY(agent_id) REFERENCES agents(id)
  )`,
];

export async function ensureSchema(db: ReAIDbClient): Promise<void> {
  for (const statement of schemaStatements) {
    await db.execute(statement);
  }

  // Migration: Add columns to existing database if they don't exist
  const newCols = [
    "ren_number TEXT",
    "agency_name TEXT",
    "whatsapp_number TEXT",
    "avatar_url TEXT",
    "company_logo_url TEXT",
    "bio TEXT"
  ];

  for (const col of newCols) {
    try {
      await db.execute(`ALTER TABLE agents ADD COLUMN ${col}`);
    } catch {
      // Column already exists, safe to ignore
    }
  }

  const leadCols = [
    "stage TEXT NOT NULL DEFAULT 'new'",
    "preferred_channel TEXT NOT NULL DEFAULT 'whatsapp'",
    "last_contacted_at TEXT",
    "telegram_chat_id TEXT",
    "listing_id TEXT",
  ];

  for (const col of leadCols) {
    try {
      await db.execute(`ALTER TABLE leads ADD COLUMN ${col}`);
    } catch {
      // Column already exists, safe to ignore.
    }
  }

  const reportCols = [
    "property_name TEXT",
    "property_key TEXT",
    "cache_status TEXT",
    "share_token TEXT",
    "input_json TEXT",
    "analytics_json TEXT",
    "citations_json TEXT",
    "content_sections_json TEXT",
    "comparable_listings_json TEXT",
  ];

  for (const col of reportCols) {
    try {
      await db.execute(`ALTER TABLE property_reports ADD COLUMN ${col}`);
    } catch {
      // Column already exists, safe to ignore.
    }
  }
}

export function mapAgent(row: Record<string, unknown>): Agent {
  return {
    id: String(row.id),
    workosUserId: String(row.workos_user_id),
    fullName: String(row.full_name),
    email: String(row.email),
    phone: String(row.phone),
    plan: String(row.plan) as Agent["plan"],
    avatarInitials: String(row.avatar_initials),
    ingestionAddress: String(row.ingestion_address),
    renNumber: row.ren_number ? String(row.ren_number) : "",
    agencyName: row.agency_name ? String(row.agency_name) : "",
    whatsappNumber: row.whatsapp_number ? String(row.whatsapp_number) : "",
    avatarUrl: row.avatar_url ? String(row.avatar_url) : "",
    companyLogoUrl: row.company_logo_url ? String(row.company_logo_url) : "",
    bio: row.bio ? String(row.bio) : "",
  };
}

export function mapLead(row: Record<string, unknown>): Lead {
  return {
    id: String(row.id),
    agentId: String(row.agent_id),
    name: String(row.name),
    email: String(row.email),
    phone: String(row.phone),
    source: String(row.source),
    propertyInterest: String(row.property_interest),
    budget: String(row.budget),
    emailOpens: Number(row.email_opens),
    linkClicks: Number(row.link_clicks),
    reportViews: Number(row.report_views),
    inquirySentiment: Number(row.inquiry_sentiment),
    sentiment: String(row.sentiment) as Lead["sentiment"],
    score: Number(row.score),
    intent: Number(row.intent) === 1 ? 1 : 0,
    tier: String(row.tier) as Lead["tier"],
    stage: (String(row.stage ?? "new")) as LeadStage,
    preferredChannel: (String(row.preferred_channel ?? "whatsapp")) as PreferredChannel,
    telegramChatId: row.telegram_chat_id ? String(row.telegram_chat_id) : undefined,
    listingId: row.listing_id ? String(row.listing_id) : undefined,
    lastContactedAt: row.last_contacted_at ? String(row.last_contacted_at) : undefined,
    createdAt: String(row.created_at),
  };
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string" || !value.trim()) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function parseSentiment(value: unknown): ReportAnalytics["sentiment"] {
  return value === "positive" || value === "negative" || value === "neutral" ? value : "neutral";
}

export function mapReport(row: Record<string, unknown>): PropertyReport {
  const fallbackInput: ReportInputSnapshot = {
    propertyName: row.property_name ? String(row.property_name) : String(row.address),
    address: String(row.address),
    propertyType: String(row.property_type),
    listingIntent: "sale",
    tenure: "unknown",
    askingPriceRm: 0,
    sqft: Number(row.sqft),
    bedrooms: Number(row.bedrooms),
    bathrooms: Number(row.bathrooms),
    yearBuilt: Number(row.year_built),
  };
  const parsedInput = parseJson<PropertyReportInput>(row.input_json, fallbackInput);
  const inputSnapshot = normalizeReportInput({ ...fallbackInput, ...parsedInput });
  const fallbackPropertyKey = row.property_key ? String(row.property_key) : String(row.address).toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const fallbackAnalytics: ReportAnalytics = {
    sentiment: "neutral",
    pricingTrend: String(row.market_signal),
    confidenceScore: 0.68,
    dataCompleteness: 0.30,
    priceCertainty: 0.20,
    freshnessDays: 0,
  };
  const analyticsPayload = parseJson<Partial<ReportAnalytics> & { indexLookup?: ReportIndexLookup }>(row.analytics_json, fallbackAnalytics);
  const analytics: ReportAnalytics = {
    sentiment: parseSentiment(analyticsPayload.sentiment),
    pricingTrend: analyticsPayload.pricingTrend || fallbackAnalytics.pricingTrend,
    confidenceScore: Number.isFinite(analyticsPayload.confidenceScore) ? Number(analyticsPayload.confidenceScore) : fallbackAnalytics.confidenceScore,
    dataCompleteness: Number.isFinite(analyticsPayload.dataCompleteness) ? Number(analyticsPayload.dataCompleteness) : fallbackAnalytics.dataCompleteness,
    priceCertainty: Number.isFinite(analyticsPayload.priceCertainty) ? Number(analyticsPayload.priceCertainty) : fallbackAnalytics.priceCertainty,
    freshnessDays: Number.isFinite(analyticsPayload.freshnessDays) ? Number(analyticsPayload.freshnessDays) : fallbackAnalytics.freshnessDays,
  };
  const citations = parseJson<ReportCitation[]>(row.citations_json, []);
  const comparableListings = parseJson<ReportComparableListing[]>(row.comparable_listings_json, []);
  const contentSections = parseJson<ReportContentSection[]>(row.content_sections_json, [
    { title: "Market signal", body: String(row.market_signal) },
    { title: "Sentiment", body: String(row.sentiment_summary) },
  ]);
  const indexLookup = analyticsPayload.indexLookup ?? {
    propertyKey: fallbackPropertyKey,
    status: row.cache_status === "hit" ? "fresh_hit" : row.cache_status === "refreshed" ? "stale_hit" : "miss",
    liveSearchStatus: row.cache_status === "hit" ? "not_needed" : row.cache_status === "fallback" ? "failed" : "validated",
    freshnessDays: analytics.freshnessDays,
    citationsCount: citations.length,
    summary: contentSections[0]?.body ?? "",
    checkedAt: String(row.generated_at),
  } satisfies ReportIndexLookup;

  return {
    id: String(row.id),
    agentId: String(row.agent_id),
    title: String(row.title),
    propertyName: row.property_name ? String(row.property_name) : inputSnapshot.propertyName ?? String(row.address),
    propertyKey: fallbackPropertyKey,
    address: String(row.address),
    propertyType: String(row.property_type),
    sqft: Number(row.sqft),
    bedrooms: Number(row.bedrooms),
    bathrooms: Number(row.bathrooms),
    yearBuilt: Number(row.year_built),
    status: String(row.status) as PropertyReport["status"],
    marketSignal: String(row.market_signal),
    sentimentSummary: String(row.sentiment_summary),
    generatedAt: String(row.generated_at),
    cacheStatus: (row.cache_status ? String(row.cache_status) : "fallback") as ReportCacheStatus,
    shareToken: row.share_token ? String(row.share_token) : "",
    inputSnapshot,
    indexLookup,
    analytics,
    citations,
    comparableListings,
    contentSections,
  };
}

export function mapIntegration(row: Record<string, unknown>): Integration {
  return {
    id: String(row.id),
    agentId: String(row.agent_id),
    name: String(row.name),
    description: String(row.description),
    status: String(row.status) as Integration["status"],
  };
}

export function mapLeadEvent(row: Record<string, unknown>): LeadEvent {
  return {
    id: String(row.id),
    leadId: String(row.lead_id),
    agentId: String(row.agent_id),
    eventType: String(row.event_type) as LeadEvent["eventType"],
    eventLabel: String(row.event_label),
    occurredAt: String(row.occurred_at),
  };
}

export async function ensureAgentWorkspace(
  db: ReAIDbClient,
  user: { id: string; email: string; firstName?: string | null; lastName?: string | null },
): Promise<Agent> {
  await ensureSchema(db);
  const existing = await db.execute<Record<string, unknown>>({
    sql: "SELECT * FROM agents WHERE workos_user_id = ? LIMIT 1",
    args: [user.id],
  });

  if (existing.rows[0]) {
    return mapAgent(existing.rows[0]);
  }

  const agentId = `agent_${user.id.replace(/[^a-zA-Z0-9]/g, "").slice(-12) || "demo"}`;
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ") || "Signatis Agent";
  const initials = fullName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const agent: Agent = {
    id: agentId,
    workosUserId: user.id,
    fullName,
    email: user.email,
    phone: "+60 12-555 8472",
    plan: "Premium Agent",
    avatarInitials: initials || "DA",
    ingestionAddress: `inbound+${agentId.slice(-6).toLowerCase()}@leads.signatis.app`,
    renNumber: "",
    agencyName: "",
    whatsappNumber: "",
    avatarUrl: "",
    companyLogoUrl: "",
    bio: "",
  };

  await db.execute({
    sql: `INSERT INTO agents (
      id, workos_user_id, full_name, email, phone, plan, avatar_initials, ingestion_address,
      ren_number, agency_name, whatsapp_number, avatar_url, company_logo_url, bio
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      agent.id,
      agent.workosUserId,
      agent.fullName,
      agent.email,
      agent.phone,
      agent.plan,
      agent.avatarInitials,
      agent.ingestionAddress,
      agent.renNumber ?? "",
      agent.agencyName ?? "",
      agent.whatsappNumber ?? "",
      agent.avatarUrl ?? "",
      agent.companyLogoUrl ?? "",
      agent.bio ?? "",
    ],
  });

  await seedWorkspace(db, agent.id);
  return agent;
}

export async function seedWorkspace(db: ReAIDbClient, agentId: string): Promise<void> {
  const leads = [
    ["lead_1", "Amanda Lee", "amanda.l@example.com", "+60 12-019 8472", "Direct Inquiry", "Downtown condo", "RM 850k", 8, 4, 2, 0.7, "positive", "2026-06-09T10:30:00.000Z"],
    ["lead_2", "Chen Wei Kiat", "cwk_99@test.com", "+60 17-448 2041", "Facebook", "Subang family home", "RM 1.2M", 2, 0, 0, 0.1, "neutral", "2026-06-08T15:20:00.000Z"],
    ["lead_3", "Sarah Mahmud", "sarah.m88@mail.com", "+60 19-482 5510", "Lowyat", "Mont Kiara unit", "RM 980k", 12, 7, 3, -0.4, "negative", "2026-06-07T12:15:00.000Z"],
    ["lead_4", "David Tan", "dtan.invest@biz.com", "+60 13-775 1158", "Direct Inquiry", "Klang Valley shoplot", "RM 2.4M", 1, 0, 0, 0, "neutral", "2026-06-05T08:00:00.000Z"],
  ] as const;

  for (const lead of leads) {
    const [id, name, email, phone, source, interest, budget, opens, clicks, views, sentimentValue, sentiment, createdAt] = lead;
    const score = computeLeadScore({
      emailOpens: opens,
      linkClicks: clicks,
      reportViews: views,
      inquirySentiment: sentimentValue,
    });

    await db.execute({
      sql: `INSERT OR IGNORE INTO leads (
        id, agent_id, name, email, phone, source, property_interest, budget,
        email_opens, link_clicks, report_views, inquiry_sentiment, sentiment,
        score, intent, tier, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        agentId,
        name,
        email,
        phone,
        source,
        interest,
        budget,
        opens,
        clicks,
        views,
        sentimentValue,
        sentiment,
        score.score,
        score.intent,
        score.tier,
        createdAt,
      ],
    });
  }

  const reportInputs: Array<ReportInputSnapshot & { id: string; generatedAt: string }> = [
    {
      id: "report_1",
      propertyName: "142 Oak St",
      address: "142 Oak St",
      propertyType: "Terrace House",
      listingIntent: "sale",
      tenure: "freehold",
      askingPriceRm: 1250000,
      sqft: 2500,
      bedrooms: 4,
      bathrooms: 3,
      yearBuilt: 2018,
      generatedAt: "2026-06-10T10:30:00.000Z",
    },
    {
      id: "report_2",
      propertyName: "Downtown Market Overview",
      address: "Downtown Market Overview",
      propertyType: "Market Brief",
      listingIntent: "sale",
      tenure: "leasehold",
      askingPriceRm: 850000,
      sqft: 1800,
      bedrooms: 3,
      bathrooms: 2,
      yearBuilt: 2020,
      generatedAt: "2026-06-09T12:00:00.000Z",
    },
  ];

  for (const input of reportInputs) {
    const draft = buildReportDraft(input);
    await db.execute({
      sql: `INSERT OR IGNORE INTO property_reports (
        id, agent_id, title, address, property_type, sqft, bedrooms, bathrooms,
        year_built, status, market_signal, sentiment_summary, generated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        input.id,
        agentId,
        draft.title,
        input.address,
        input.propertyType,
        input.sqft,
        input.bedrooms,
        input.bathrooms,
        input.yearBuilt,
        draft.status,
        draft.marketSignal,
        draft.sentimentSummary,
        input.generatedAt,
      ],
    });
  }

  await db.execute({
    sql: `INSERT OR IGNORE INTO property_reports (
      id, agent_id, title, address, property_type, sqft, bedrooms, bathrooms,
      year_built, status, market_signal, sentiment_summary, generated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      "report_3",
      agentId,
      "Q3 Predictor Model",
      "Klang Valley Portfolio",
      "Forecast",
      3200,
      0,
      0,
      2026,
      "running",
      "Processing market deltas",
      "Awaiting neighborhood sentiment refresh.",
      "2026-06-10T09:15:00.000Z",
    ],
  });

  const integrations = [
    ["integration_calendar", "Google Calendar", "Syncs property showings and client meetings.", "connected"],
    ["integration_data", "Licensed Market Data", "Live property data for report generation.", "connected"],
  ] as const;

  for (const integration of integrations) {
    await db.execute({
      sql: "INSERT OR IGNORE INTO integrations (id, agent_id, name, description, status) VALUES (?, ?, ?, ?, ?)",
      args: [integration[0], agentId, integration[1], integration[2], integration[3]],
    });
  }
}

export async function getDashboardData(db: ReAIDbClient, agent: Agent): Promise<DashboardData> {
  const leads = (await getLeads(db, agent.id)).sort((a, b) => b.score - a.score);
  const reports = await getReports(db, agent.id);
  const averageScore = leads.length
    ? Number((leads.reduce((total, lead) => total + lead.score, 0) / leads.length / 40).toFixed(2))
    : 0;

  return {
    agent,
    totals: {
      leadsScored: leads.length,
      averageIntentScore: averageScore,
      reportsGenerated: reports.length,
      highIntentLeads: leads.filter((lead) => lead.intent === 1).length,
    },
    highIntentLeads: leads.filter((lead) => lead.intent === 1).slice(0, 3),
    recentReports: reports.slice(0, 3),
  };
}

export async function getLeads(db: ReAIDbClient, agentId: string): Promise<Lead[]> {
  const result = await db.execute<Record<string, unknown>>({
    sql: "SELECT * FROM leads WHERE agent_id = ? ORDER BY created_at DESC",
    args: [agentId],
  });
  return result.rows.map(mapLead);
}

export async function getReports(db: ReAIDbClient, agentId: string): Promise<PropertyReport[]> {
  const result = await db.execute<Record<string, unknown>>({
    sql: "SELECT * FROM property_reports WHERE agent_id = ? ORDER BY generated_at DESC",
    args: [agentId],
  });
  return result.rows.map(mapReport);
}

export async function getReportById(
  db: ReAIDbClient,
  agentId: string,
  reportId: string,
): Promise<PropertyReport | null> {
  const result = await db.execute<Record<string, unknown>>({
    sql: "SELECT * FROM property_reports WHERE id = ? AND agent_id = ? LIMIT 1",
    args: [reportId, agentId],
  });
  return result.rows[0] ? mapReport(result.rows[0]) : null;
}

export async function getReportByShareToken(
  db: ReAIDbClient,
  shareToken: string,
): Promise<PropertyReport | null> {
  const result = await db.execute<Record<string, unknown>>({
    sql: "SELECT * FROM property_reports WHERE share_token = ? LIMIT 1",
    args: [shareToken],
  });
  return result.rows[0] ? mapReport(result.rows[0]) : null;
}

export async function getAgentById(db: ReAIDbClient, agentId: string): Promise<Agent | null> {
  const result = await db.execute<Record<string, unknown>>({
    sql: "SELECT * FROM agents WHERE id = ? LIMIT 1",
    args: [agentId],
  });
  return result.rows[0] ? mapAgent(result.rows[0]) : null;
}

export async function getAgentByIngestionAddress(
  db: ReAIDbClient,
  address: string,
): Promise<Agent | null> {
  const normalized = address.trim().toLowerCase();
  const result = await db.execute<Record<string, unknown>>({
    sql: "SELECT * FROM agents WHERE LOWER(ingestion_address) = ? LIMIT 1",
    args: [normalized],
  });
  return result.rows[0] ? mapAgent(result.rows[0]) : null;
}

/**
 * Record an engagement event (email open or link click) against a lead,
 * increment the matching behavioural counter, recompute the score/tier/intent,
 * and append a lead_event. Returns the updated lead, or null if not found.
 *
 * Used by the tracking pixel and redirect routes — the only context available
 * is the lead id, so the agent is resolved from the lead row.
 */
export async function recordLeadEngagement(
  db: ReAIDbClient,
  leadId: string,
  type: "email_open" | "link_click",
  label?: string,
): Promise<Lead | null> {
  const existing = await db.execute<Record<string, unknown>>({
    sql: "SELECT * FROM leads WHERE id = ? LIMIT 1",
    args: [leadId],
  });
  if (!existing.rows[0]) return null;
  const lead = mapLead(existing.rows[0]);

  const emailOpens = lead.emailOpens + (type === "email_open" ? 1 : 0);
  const linkClicks = lead.linkClicks + (type === "link_click" ? 1 : 0);
  const score = computeLeadScore({
    emailOpens,
    linkClicks,
    reportViews: lead.reportViews,
    inquirySentiment: lead.inquirySentiment,
  });

  await db.execute({
    sql: `UPDATE leads SET email_opens = ?, link_clicks = ?, score = ?, intent = ?, tier = ? WHERE id = ?`,
    args: [emailOpens, linkClicks, score.score, score.intent, score.tier, leadId],
  });

  await db.execute({
    sql: `INSERT INTO lead_events (id, lead_id, agent_id, event_type, event_label, occurred_at)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [
      `event_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      leadId,
      lead.agentId,
      type,
      label ?? (type === "email_open" ? "Opened an email" : "Clicked a tracked link"),
      new Date().toISOString(),
    ],
  });

  return {
    ...lead,
    emailOpens,
    linkClicks,
    score: score.score,
    intent: score.intent,
    tier: score.tier,
  };
}

export async function getPropertyIntelligenceCache(
  db: ReAIDbClient,
  propertyKey: string,
): Promise<PropertyIntelligenceCache | null> {
  const result = await db.execute<Record<string, unknown>>({
    sql: "SELECT * FROM property_intelligence_cache WHERE property_key = ? LIMIT 1",
    args: [propertyKey],
  });
  const row = result.rows[0];
  if (!row) return null;

  return {
    propertyKey: String(row.property_key),
    propertyName: String(row.property_name),
    payload: parseJson<Record<string, unknown>>(row.payload_json, {}),
    citations: parseJson<ReportCitation[]>(row.citations_json, []),
    refreshedAt: String(row.refreshed_at),
  };
}

export async function savePropertyIntelligence(
  db: ReAIDbClient,
  cache: PropertyIntelligenceCache,
): Promise<void> {
  await db.execute({
    sql: `INSERT OR REPLACE INTO property_intelligence_cache (
      property_key, property_name, payload_json, citations_json, refreshed_at
    ) VALUES (?, ?, ?, ?, ?)`,
    args: [
      cache.propertyKey,
      cache.propertyName,
      JSON.stringify(cache.payload),
      JSON.stringify(cache.citations),
      cache.refreshedAt,
    ],
  });
}

export async function deletePropertyData(
  db: ReAIDbClient,
  agentId: string,
  propertyKey: string,
  propertyName: string,
): Promise<void> {
  await db.execute({
    sql: "DELETE FROM property_intelligence_cache WHERE property_key = ?",
    args: [propertyKey],
  });
  await db.execute({
    sql: "DELETE FROM property_reports WHERE agent_id = ? AND (property_key = ? OR LOWER(property_name) = ? OR LOWER(title) = ?)",
    args: [agentId, propertyKey, propertyName.toLowerCase().trim(), `${propertyName.toLowerCase().trim()} analysis`],
  });
}


export async function getDeveloperCache(
  db: ReAIDbClient,
  developerKey: string,
): Promise<DeveloperIntelligenceCache | null> {
  const result = await db.execute<Record<string, unknown>>({
    sql: "SELECT * FROM developer_intelligence_cache WHERE developer_key = ? LIMIT 1",
    args: [developerKey],
  });
  const row = result.rows[0];
  if (!row) return null;

  return {
    developerKey: String(row.developer_key),
    developerName: String(row.developer_name),
    pastProjects: parseJson<string[]>(row.past_projects_json, []),
    upcomingProjects: parseJson<string[]>(row.upcoming_projects_json, []),
    sentiment: row.sentiment ? String(row.sentiment) : undefined,
    refreshedAt: String(row.refreshed_at),
  };
}

export async function saveDeveloperCache(
  db: ReAIDbClient,
  cache: DeveloperIntelligenceCache,
): Promise<void> {
  await db.execute({
    sql: `INSERT OR REPLACE INTO developer_intelligence_cache (
      developer_key, developer_name, past_projects_json, upcoming_projects_json, sentiment, refreshed_at
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    args: [
      cache.developerKey,
      cache.developerName,
      JSON.stringify(cache.pastProjects),
      JSON.stringify(cache.upcomingProjects),
      cache.sentiment ?? null,
      cache.refreshedAt,
    ],
  });
}

export async function savePropertyReport(
  db: ReAIDbClient,
  report: PropertyReport,
): Promise<void> {
  await db.execute({
    sql: `INSERT INTO property_reports (
      id, agent_id, title, property_name, property_key, address, property_type,
      sqft, bedrooms, bathrooms, year_built, status, market_signal,
      sentiment_summary, cache_status, share_token, input_json, analytics_json,
      citations_json, content_sections_json, comparable_listings_json, generated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      report.id,
      report.agentId,
      report.title,
      report.propertyName,
      report.propertyKey,
      report.address,
      report.propertyType,
      report.sqft,
      report.bedrooms,
      report.bathrooms,
      report.yearBuilt,
      report.status,
      report.marketSignal,
      report.sentimentSummary,
      report.cacheStatus,
      report.shareToken,
      JSON.stringify(report.inputSnapshot),
      JSON.stringify({ ...report.analytics, indexLookup: report.indexLookup }),
      JSON.stringify(report.citations),
      JSON.stringify(report.contentSections),
      JSON.stringify(report.comparableListings ?? []),
      report.generatedAt,
    ],
  });
}

export async function getIntegrations(db: ReAIDbClient, agentId: string): Promise<Integration[]> {
  const result = await db.execute<Record<string, unknown>>({
    sql: "SELECT * FROM integrations WHERE agent_id = ? ORDER BY name ASC",
    args: [agentId],
  });
  return result.rows.map(mapIntegration);
}

export async function connectIntegration(
  db: ReAIDbClient,
  agentId: string,
  integrationId: string,
  name: string,
  description: string,
): Promise<Integration> {
  await db.execute({
    sql: `INSERT OR REPLACE INTO integrations (id, agent_id, name, description, status) 
          VALUES (?, ?, ?, ?, 'connected')`,
    args: [integrationId, agentId, name, description],
  });

  return {
    id: integrationId,
    agentId,
    name,
    description,
    status: "connected",
  };
}

export async function disconnectIntegration(
  db: ReAIDbClient,
  agentId: string,
  integrationId: string,
): Promise<void> {
  await db.execute({
    sql: "DELETE FROM integrations WHERE id = ? AND agent_id = ?",
    args: [integrationId, agentId],
  });
}

// ── Agent Credentials (WhatsApp, etc.) ──────────────────────────

export async function getCredentials(
  db: ReAIDbClient,
  agentId: string,
  provider: string,
): Promise<{ id: string; encryptedValue: string; metadata: Record<string, unknown> } | null> {
  const result = await db.execute<Record<string, unknown>>({
    sql: "SELECT id, encrypted_value, metadata_json FROM agent_credentials WHERE agent_id = ? AND provider = ? LIMIT 1",
    args: [agentId, provider],
  });
  const row = result.rows[0];
  if (!row) return null;
  return {
    id: String(row.id),
    encryptedValue: String(row.encrypted_value),
    metadata: parseJson<Record<string, unknown>>(row.metadata_json, {}),
  };
}

export async function saveCredentials(
  db: ReAIDbClient,
  agentId: string,
  provider: string,
  encryptedValue: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  const id = `cred_${provider}_${agentId}`;
  const now = new Date().toISOString();
  await db.execute({
    sql: `INSERT OR REPLACE INTO agent_credentials (id, agent_id, provider, encrypted_value, metadata_json, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM agent_credentials WHERE id = ?), ?), ?)`,
    args: [id, agentId, provider, encryptedValue, JSON.stringify(metadata), id, now, now],
  });
}

export async function deleteCredentials(
  db: ReAIDbClient,
  agentId: string,
  provider: string,
): Promise<void> {
  await db.execute({
    sql: "DELETE FROM agent_credentials WHERE agent_id = ? AND provider = ?",
    args: [agentId, provider],
  });
}


export async function createReport(
  db: ReAIDbClient,
  agentId: string,
  input: PropertyReportInput,
): Promise<PropertyReport> {
  const normalized = normalizeReportInput(input);
  const draft = buildReportDraft(normalized);
  const propertyKey = buildReportPropertyKey(normalized);
  const id = `report_${Date.now()}`;
  const generatedAt = new Date().toISOString();
  const report: PropertyReport = {
    id,
    agentId,
    title: draft.title,
    propertyName: normalized.propertyName ?? normalized.address,
    propertyKey,
    address: normalized.address,
    propertyType: normalized.propertyType,
    sqft: normalized.sqft,
    bedrooms: normalized.bedrooms,
    bathrooms: normalized.bathrooms,
    yearBuilt: normalized.yearBuilt,
    status: draft.status,
    marketSignal: draft.marketSignal,
    sentimentSummary: draft.sentimentSummary,
    generatedAt,
    cacheStatus: "fallback",
    shareToken: `shr_${Date.now()}`,
    inputSnapshot: normalized,
    indexLookup: {
      propertyKey,
      status: "miss",
      liveSearchStatus: "failed",
      freshnessDays: null,
      citationsCount: 0,
      summary: "",
      checkedAt: generatedAt,
    },
    analytics: {
      sentiment: "neutral",
      pricingTrend: draft.marketSignal,
      confidenceScore: 0.68,
      dataCompleteness: 0.30,
      priceCertainty: 0.20,
      freshnessDays: 0,
    },
    citations: [
      {
        title: "Signatis deterministic market model",
        url: "https://signatis.app/research/static-market-model",
      },
    ],
    comparableListings: [],
    contentSections: draft.sections.map((section) => ({
      title: section,
      body: `${section} for ${normalized.address}.`,
    })),
  };

  await savePropertyReport(db, report);
  return report;
}

export async function updateAgentSettings(
  db: ReAIDbClient,
  agentId: string,
  values: Omit<Agent, "id" | "workosUserId" | "plan" | "avatarInitials" | "ingestionAddress">,
): Promise<Agent> {
  await db.execute({
    sql: `UPDATE agents SET 
      full_name = ?, 
      email = ?, 
      phone = ?,
      ren_number = ?,
      agency_name = ?,
      whatsapp_number = ?,
      avatar_url = ?,
      company_logo_url = ?,
      bio = ?
      WHERE id = ?`,
    args: [
      values.fullName,
      values.email,


      values.phone,
      values.renNumber ?? "",
      values.agencyName ?? "",
      values.whatsappNumber ?? "",
      values.avatarUrl ?? "",
      values.companyLogoUrl ?? "",
      values.bio ?? "",
      agentId,
    ],
  });

  const result = await db.execute<Record<string, unknown>>({
    sql: "SELECT * FROM agents WHERE id = ? LIMIT 1",
    args: [agentId],
  });

  return mapAgent(result.rows[0]);
}

export async function createSupportRequest(
  db: ReAIDbClient,
  agentId: string,
  input: Omit<SupportRequest, "id" | "agentId" | "createdAt">,
): Promise<SupportRequest> {
  const request: SupportRequest = {
    id: `support_${Date.now()}`,
    agentId,
    createdAt: new Date().toISOString(),
    ...input,
  };

  await db.execute({
    sql: `INSERT INTO support_requests (
      id, agent_id, name, category, subject, message, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [
      request.id,
      request.agentId,
      request.name,
      request.category,
      request.subject,
      request.message,
      request.createdAt,
    ],
  });

  return request;
}

export async function createLead(
  db: ReAIDbClient,
  agentId: string,
  input: {
    name: string;
    email: string;
    phone: string;
    source: string;
    propertyInterest: string;
    budget: string;
    message?: string;
    preferredChannel?: PreferredChannel;
  }
): Promise<Lead> {
  const id = `lead_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const messageText = input.message?.trim() || "";
  let inquirySentiment = 0;
  const lowerMsg = messageText.toLowerCase();

  if (/love|interested|viewing|buy|nice|great|good|excellent|perfect|keen/i.test(lowerMsg)) {
    inquirySentiment = 0.8;
  } else if (/bad|expensive|defect|broken|poor|disappointed|issue|noise|concern/i.test(lowerMsg)) {
    inquirySentiment = -0.6;
  }

  const scoreObj = computeLeadScore({
    emailOpens: 0,
    linkClicks: 0,
    reportViews: 1,
    inquirySentiment,
  });

  const sentiment = inquirySentiment > 0.2 ? "positive" : inquirySentiment < -0.2 ? "negative" : "neutral";

  const lead: Lead = {
    id,
    agentId,
    name: input.name,
    email: input.email,
    phone: input.phone,
    source: input.source,
    propertyInterest: input.propertyInterest,
    budget: input.budget,
    emailOpens: 0,
    linkClicks: 0,
    reportViews: 1,
    inquirySentiment,
    sentiment,
    score: scoreObj.score,
    intent: scoreObj.intent,
    tier: scoreObj.tier,
    stage: "new",
    preferredChannel: input.preferredChannel ?? "whatsapp",
    createdAt: new Date().toISOString(),
  };

  await db.execute({
    sql: `INSERT INTO leads (
      id, agent_id, name, email, phone, source, property_interest, budget,
      email_opens, link_clicks, report_views, inquiry_sentiment, sentiment,
      score, intent, tier, stage, preferred_channel, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      lead.id,
      lead.agentId,
      lead.name,
      lead.email,
      lead.phone,
      lead.source,
      lead.propertyInterest,
      lead.budget,
      lead.emailOpens,
      lead.linkClicks,
      lead.reportViews,
      lead.inquirySentiment,
      lead.sentiment,
      lead.score,
      lead.intent,
      lead.tier,
      lead.stage,
      lead.preferredChannel,
      lead.createdAt,
    ],
  });

  if (messageText) {
    await db.execute({
      sql: `INSERT INTO lead_events (id, lead_id, agent_id, event_type, event_label, occurred_at)
            VALUES (?, ?, ?, 'manual_note', ?, ?)`,
      args: [
        `event_${Date.now()}`,
        lead.id,
        agentId,
        `Inquiry: "${messageText}"`,
        lead.createdAt,
      ],
    });
  }

  return lead;
}

export async function deleteLead(
  db: ReAIDbClient,
  agentId: string,
  leadId: string,
): Promise<void> {
  await db.execute({
    sql: "DELETE FROM lead_events WHERE lead_id = ? AND agent_id = ?",
    args: [leadId, agentId],
  });
  await db.execute({
    sql: "DELETE FROM leads WHERE id = ? AND agent_id = ?",
    args: [leadId, agentId],
  });
}

export async function updateLeadStage(
  db: ReAIDbClient,
  agentId: string,
  leadId: string,
  newStage: LeadStage,
): Promise<void> {
  const now = new Date().toISOString();
  await db.execute({
    sql: "UPDATE leads SET stage = ?, last_contacted_at = ? WHERE id = ? AND agent_id = ?",
    args: [newStage, now, leadId, agentId],
  });
  await db.execute({
    sql: `INSERT INTO lead_events (id, lead_id, agent_id, event_type, event_label, occurred_at)
          VALUES (?, ?, ?, 'stage_change', ?, ?)`,
    args: [
      `event_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      leadId,
      agentId,
      `Stage changed to ${newStage}`,
      now,
    ],
  });
}

export async function setLeadTelegramChatId(
  db: ReAIDbClient,
  agentId: string,
  leadId: string,
  chatId: string,
): Promise<void> {
  await db.execute({
    sql: "UPDATE leads SET telegram_chat_id = ? WHERE id = ? AND agent_id = ?",
    args: [chatId || null, leadId, agentId],
  });
}

export async function updateLeadLastContacted(
  db: ReAIDbClient,
  agentId: string,
  leadId: string,
): Promise<void> {
  await db.execute({
    sql: "UPDATE leads SET last_contacted_at = ? WHERE id = ? AND agent_id = ?",
    args: [new Date().toISOString(), leadId, agentId],
  });
}

export async function assignLeadToListing(
  db: ReAIDbClient,
  agentId: string,
  leadId: string,
  listingId: string | null,
): Promise<void> {
  await db.execute({
    sql: "UPDATE leads SET listing_id = ? WHERE id = ? AND agent_id = ?",
    args: [listingId, leadId, agentId],
  });
}

// ── Omnibox: Listings ─────────────────────────────────────────────────────
export function mapListing(row: Record<string, unknown>): Listing {
  return {
    id: String(row.id),
    agentId: String(row.agent_id),
    propertyKey: String(row.property_key),
    title: String(row.title),
    address: String(row.address ?? ""),
    propertyType: String(row.property_type ?? "Residential"),
    listingIntent: String(row.listing_intent ?? "sale") as ListingIntent,
    askingPriceRm: Number(row.asking_price_rm ?? 0),
    bedrooms: row.bedrooms != null ? Number(row.bedrooms) : undefined,
    bathrooms: row.bathrooms != null ? Number(row.bathrooms) : undefined,
    builtUpSqft: row.built_up_sqft != null ? Number(row.built_up_sqft) : undefined,
    area: row.area ? String(row.area) : undefined,
    portalRefs: parseJson<Record<string, string>>(row.portal_refs_json, {}),
    status: String(row.status ?? "active") as ListingStatus,
    createdAt: String(row.created_at),
  };
}

export async function getListings(db: ReAIDbClient, agentId: string): Promise<Listing[]> {
  const result = await db.execute<Record<string, unknown>>({
    sql: "SELECT * FROM listings WHERE agent_id = ? ORDER BY created_at DESC",
    args: [agentId],
  });
  return result.rows.map(mapListing);
}

export async function createListing(
  db: ReAIDbClient,
  agentId: string,
  input: {
    propertyKey: string;
    title: string;
    address?: string;
    propertyType?: string;
    listingIntent?: ListingIntent;
    askingPriceRm?: number;
    bedrooms?: number;
    bathrooms?: number;
    builtUpSqft?: number;
    area?: string;
    portalRefs?: Record<string, string>;
    status?: ListingStatus;
  },
): Promise<Listing> {
  const id = `listing_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const createdAt = new Date().toISOString();
  await db.execute({
    sql: `INSERT INTO listings (
      id, agent_id, property_key, title, address, property_type, listing_intent,
      asking_price_rm, bedrooms, bathrooms, built_up_sqft, area, portal_refs_json, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      agentId,
      input.propertyKey,
      input.title,
      input.address ?? "",
      input.propertyType ?? "Residential",
      input.listingIntent ?? "sale",
      Math.round(input.askingPriceRm ?? 0),
      input.bedrooms ?? null,
      input.bathrooms ?? null,
      input.builtUpSqft ?? null,
      input.area ?? null,
      JSON.stringify(input.portalRefs ?? {}),
      input.status ?? "active",
      createdAt,
    ],
  });
  return {
    id,
    agentId,
    propertyKey: input.propertyKey,
    title: input.title,
    address: input.address ?? "",
    propertyType: input.propertyType ?? "Residential",
    listingIntent: input.listingIntent ?? "sale",
    askingPriceRm: Math.round(input.askingPriceRm ?? 0),
    bedrooms: input.bedrooms,
    bathrooms: input.bathrooms,
    builtUpSqft: input.builtUpSqft,
    area: input.area,
    portalRefs: input.portalRefs ?? {},
    status: input.status ?? "active",
    createdAt,
  };
}

// ── Omnibox: Conversations ────────────────────────────────────────────────
export function mapConversation(row: Record<string, unknown>): Conversation {
  return {
    id: String(row.id),
    agentId: String(row.agent_id),
    leadId: row.lead_id ? String(row.lead_id) : undefined,
    listingId: row.listing_id ? String(row.listing_id) : undefined,
    channel: String(row.channel) as ConversationChannel,
    externalId: String(row.external_id),
    contactName: String(row.contact_name ?? ""),
    contactHandle: String(row.contact_handle ?? ""),
    status: String(row.status ?? "open") as ConversationStatus,
    unreadCount: Number(row.unread_count ?? 0),
    lastMessageAt: row.last_message_at ? String(row.last_message_at) : undefined,
    lastMessagePreview: String(row.last_message_preview ?? ""),
    createdAt: String(row.created_at),
  };
}

export async function getConversations(db: ReAIDbClient, agentId: string): Promise<Conversation[]> {
  const result = await db.execute<Record<string, unknown>>({
    sql: "SELECT * FROM conversations WHERE agent_id = ? ORDER BY COALESCE(last_message_at, created_at) DESC",
    args: [agentId],
  });
  return result.rows.map(mapConversation);
}

export async function getConversation(
  db: ReAIDbClient,
  agentId: string,
  conversationId: string,
): Promise<Conversation | null> {
  const result = await db.execute<Record<string, unknown>>({
    sql: "SELECT * FROM conversations WHERE id = ? AND agent_id = ? LIMIT 1",
    args: [conversationId, agentId],
  });
  return result.rows[0] ? mapConversation(result.rows[0]) : null;
}

export async function createConversation(
  db: ReAIDbClient,
  agentId: string,
  input: {
    channel: ConversationChannel;
    externalId: string;
    contactName?: string;
    contactHandle?: string;
    leadId?: string;
    listingId?: string;
  },
): Promise<Conversation> {
  const id = `conv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const createdAt = new Date().toISOString();
  await db.execute({
    sql: `INSERT INTO conversations (
      id, agent_id, lead_id, listing_id, channel, external_id,
      contact_name, contact_handle, status, unread_count, last_message_at, last_message_preview, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', 0, NULL, '', ?)`,
    args: [
      id,
      agentId,
      input.leadId ?? null,
      input.listingId ?? null,
      input.channel,
      input.externalId,
      input.contactName ?? "",
      input.contactHandle ?? "",
      createdAt,
    ],
  });
  return {
    id,
    agentId,
    leadId: input.leadId,
    listingId: input.listingId,
    channel: input.channel,
    externalId: input.externalId,
    contactName: input.contactName ?? "",
    contactHandle: input.contactHandle ?? "",
    status: "open",
    unreadCount: 0,
    lastMessagePreview: "",
    createdAt,
  };
}

export async function linkConversation(
  db: ReAIDbClient,
  agentId: string,
  conversationId: string,
  links: { leadId?: string | null; listingId?: string | null },
): Promise<void> {
  const sets: string[] = [];
  const args: (string | null)[] = [];
  if (links.leadId !== undefined) { sets.push("lead_id = ?"); args.push(links.leadId); }
  if (links.listingId !== undefined) { sets.push("listing_id = ?"); args.push(links.listingId); }
  if (sets.length === 0) return;
  args.push(conversationId, agentId);
  await db.execute({
    sql: `UPDATE conversations SET ${sets.join(", ")} WHERE id = ? AND agent_id = ?`,
    args,
  });
}

export async function setConversationStatus(
  db: ReAIDbClient,
  agentId: string,
  conversationId: string,
  status: ConversationStatus,
): Promise<void> {
  await db.execute({
    sql: "UPDATE conversations SET status = ? WHERE id = ? AND agent_id = ?",
    args: [status, conversationId, agentId],
  });
}

export async function markConversationRead(
  db: ReAIDbClient,
  agentId: string,
  conversationId: string,
): Promise<void> {
  await db.execute({
    sql: "UPDATE conversations SET unread_count = 0 WHERE id = ? AND agent_id = ?",
    args: [conversationId, agentId],
  });
}

// ── Omnibox: Messages ─────────────────────────────────────────────────────
export function mapMessage(row: Record<string, unknown>): Message {
  return {
    id: String(row.id),
    conversationId: String(row.conversation_id),
    agentId: String(row.agent_id),
    direction: String(row.direction) as MessageDirection,
    author: String(row.author ?? "lead") as MessageAuthor,
    body: String(row.body),
    kind: String(row.kind ?? "text") as MessageKind,
    raw: parseJson<Record<string, unknown>>(row.raw_json, {}),
    sentAt: String(row.sent_at),
  };
}

export async function getMessages(
  db: ReAIDbClient,
  agentId: string,
  conversationId: string,
): Promise<Message[]> {
  const result = await db.execute<Record<string, unknown>>({
    sql: "SELECT * FROM messages WHERE conversation_id = ? AND agent_id = ? ORDER BY sent_at ASC",
    args: [conversationId, agentId],
  });
  return result.rows.map(mapMessage);
}

export async function createMessage(
  db: ReAIDbClient,
  agentId: string,
  input: {
    conversationId: string;
    direction: MessageDirection;
    body: string;
    author?: MessageAuthor;
    kind?: MessageKind;
    raw?: Record<string, unknown>;
    sentAt?: string;
  },
): Promise<Message> {
  const id = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const sentAt = input.sentAt ?? new Date().toISOString();
  const author: MessageAuthor = input.author ?? (input.direction === "inbound" ? "lead" : "agent");
  const kind: MessageKind = input.kind ?? "text";
  await db.execute({
    sql: `INSERT INTO messages (
      id, conversation_id, agent_id, direction, author, body, kind, raw_json, sent_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [id, input.conversationId, agentId, input.direction, author, input.body, kind, JSON.stringify(input.raw ?? {}), sentAt],
  });
  // Roll up onto the conversation: preview, timestamp, unread (inbound only).
  const preview = input.body.length > 120 ? `${input.body.slice(0, 117)}...` : input.body;
  if (input.direction === "inbound") {
    await db.execute({
      sql: "UPDATE conversations SET last_message_at = ?, last_message_preview = ?, unread_count = unread_count + 1 WHERE id = ? AND agent_id = ?",
      args: [sentAt, preview, input.conversationId, agentId],
    });
  } else {
    await db.execute({
      sql: "UPDATE conversations SET last_message_at = ?, last_message_preview = ? WHERE id = ? AND agent_id = ?",
      args: [sentAt, preview, input.conversationId, agentId],
    });
  }
  return { id, conversationId: input.conversationId, agentId, direction: input.direction, author, body: input.body, kind, raw: input.raw ?? {}, sentAt };
}

// ── Omnibox: Lead Intelligence ────────────────────────────────────────────
export function mapLeadIntelligence(row: Record<string, unknown>): LeadIntelligence {
  return {
    leadId: String(row.lead_id),
    agentId: String(row.agent_id),
    role: String(row.role ?? "unknown") as LeadRole,
    budgetMinRm: row.budget_min_rm != null ? Number(row.budget_min_rm) : undefined,
    budgetMaxRm: row.budget_max_rm != null ? Number(row.budget_max_rm) : undefined,
    lookingFor: parseJson<string[]>(row.looking_for_json, []),
    dealbreakers: parseJson<string[]>(row.dealbreakers_json, []),
    objections: parseJson<string[]>(row.objections_json, []),
    urgencyTier: String(row.urgency_tier ?? "passive") as UrgencyTier,
    matchPct: row.match_pct != null ? Number(row.match_pct) : undefined,
    matchedListingId: row.matched_listing_id ? String(row.matched_listing_id) : undefined,
    botProbability: Number(row.bot_probability ?? 0),
    priorityPct: Number(row.priority_pct ?? 0),
    xai: parseJson<LeadXai>(row.xai_json, { summary: "", factors: [], sources: [] }),
    updatedAt: String(row.updated_at),
  };
}

export async function getLeadIntelligence(
  db: ReAIDbClient,
  agentId: string,
  leadId: string,
): Promise<LeadIntelligence | null> {
  const result = await db.execute<Record<string, unknown>>({
    sql: "SELECT * FROM lead_intelligence WHERE lead_id = ? AND agent_id = ? LIMIT 1",
    args: [leadId, agentId],
  });
  return result.rows[0] ? mapLeadIntelligence(result.rows[0]) : null;
}

export async function getLeadIntelligenceBatch(
  db: ReAIDbClient,
  agentId: string,
): Promise<LeadIntelligence[]> {
  const result = await db.execute<Record<string, unknown>>({
    sql: "SELECT * FROM lead_intelligence WHERE agent_id = ?",
    args: [agentId],
  });
  return result.rows.map(mapLeadIntelligence);
}

export async function upsertLeadIntelligence(
  db: ReAIDbClient,
  agentId: string,
  leadId: string,
  intel: Partial<Omit<LeadIntelligence, "leadId" | "agentId" | "updatedAt">>,
): Promise<void> {
  const existing = await getLeadIntelligence(db, agentId, leadId);
  const merged: LeadIntelligence = {
    leadId,
    agentId,
    role: intel.role ?? existing?.role ?? "unknown",
    budgetMinRm: intel.budgetMinRm ?? existing?.budgetMinRm,
    budgetMaxRm: intel.budgetMaxRm ?? existing?.budgetMaxRm,
    lookingFor: intel.lookingFor ?? existing?.lookingFor ?? [],
    dealbreakers: intel.dealbreakers ?? existing?.dealbreakers ?? [],
    objections: intel.objections ?? existing?.objections ?? [],
    urgencyTier: intel.urgencyTier ?? existing?.urgencyTier ?? "passive",
    matchPct: intel.matchPct ?? existing?.matchPct,
    matchedListingId: intel.matchedListingId ?? existing?.matchedListingId,
    botProbability: intel.botProbability ?? existing?.botProbability ?? 0,
    priorityPct: intel.priorityPct ?? existing?.priorityPct ?? 0,
    xai: intel.xai ?? existing?.xai ?? { summary: "", factors: [], sources: [] },
    updatedAt: new Date().toISOString(),
  };
  await db.execute({
    sql: `INSERT INTO lead_intelligence (
      lead_id, agent_id, role, budget_min_rm, budget_max_rm, looking_for_json, dealbreakers_json,
      objections_json, urgency_tier, match_pct, matched_listing_id, bot_probability, priority_pct, xai_json, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(lead_id) DO UPDATE SET
      role = excluded.role,
      budget_min_rm = excluded.budget_min_rm,
      budget_max_rm = excluded.budget_max_rm,
      looking_for_json = excluded.looking_for_json,
      dealbreakers_json = excluded.dealbreakers_json,
      objections_json = excluded.objections_json,
      urgency_tier = excluded.urgency_tier,
      match_pct = excluded.match_pct,
      matched_listing_id = excluded.matched_listing_id,
      bot_probability = excluded.bot_probability,
      priority_pct = excluded.priority_pct,
      xai_json = excluded.xai_json,
      updated_at = excluded.updated_at`,
    args: [
      merged.leadId, merged.agentId, merged.role,
      merged.budgetMinRm ?? null, merged.budgetMaxRm ?? null,
      JSON.stringify(merged.lookingFor), JSON.stringify(merged.dealbreakers), JSON.stringify(merged.objections),
      merged.urgencyTier, merged.matchPct ?? null, merged.matchedListingId ?? null,
      merged.botProbability, merged.priorityPct, JSON.stringify(merged.xai), merged.updatedAt,
    ],
  });
}

// ── Omnibox: demo seed ────────────────────────────────────────────────────
// Seeds a cohesive Omni-Inbox demo (listings → leads → conversations → messages
// + intelligence) so the inverted tree has content. Idempotent: skips if the
// agent already has listings.
export async function seedOmniboxDemo(db: ReAIDbClient, agent: Agent): Promise<{ seeded: boolean }> {
  const existing = await getListings(db, agent.id);
  if (existing.length > 0) return { seeded: false };

  const listingDefs = [
    { title: "PR1MA, Bandar Layangkasa", address: "Bandar Layangkasa, Dengkil, Selangor", area: "Dengkil", type: "Serviced Residence", intent: "sale" as ListingIntent, price: 310000, beds: 3, baths: 2, sqft: 850 },
    { title: "Residensi Suasana, Damansara Damai", address: "Damansara Damai, Petaling Jaya", area: "Damansara Damai", type: "Condominium", intent: "sale" as ListingIntent, price: 450000, beds: 3, baths: 2, sqft: 1000 },
    { title: "Mont Kiara Astana", address: "Mont Kiara, Kuala Lumpur", area: "Mont Kiara", type: "Condominium", intent: "rent" as ListingIntent, price: 3500, beds: 2, baths: 2, sqft: 1100 },
  ];

  const listings: Listing[] = [];
  for (const d of listingDefs) {
    listings.push(await createListing(db, agent.id, {
      propertyKey: compactPropertyName(d.title),
      title: d.title,
      address: d.address,
      area: d.area,
      propertyType: d.type,
      listingIntent: d.intent,
      askingPriceRm: d.price,
      bedrooms: d.beds,
      bathrooms: d.baths,
      builtUpSqft: d.sqft,
      portalRefs: { propertyguru: `PG-${compactPropertyName(d.title).slice(0, 8)}`, iproperty: `IP-${compactPropertyName(d.title).slice(0, 8)}` },
    }));
  }

  // Each thread: lead + channel conversation + a short message exchange + intelligence.
  const threads: Array<{
    listingIdx: number;
    channel: ConversationChannel;
    name: string;
    handle: string;
    propertyInterest: string;
    budget: string;
    messages: Array<{ dir: MessageDirection; author: MessageAuthor; body: string; minsAgo: number; kind?: MessageKind }>;
    intel: Partial<Omit<LeadIntelligence, "leadId" | "agentId" | "updatedAt">>;
  }> = [
    {
      listingIdx: 0,
      channel: "whatsapp",
      name: "Nurul Hidayah",
      handle: "+60 12-388 1029",
      propertyInterest: "PR1MA, Bandar Layangkasa",
      budget: "RM 300k - 330k",
      messages: [
        { dir: "inbound", author: "lead", body: "Hi, saw the PR1MA Bandar Layangkasa unit on PropertyGuru. Is it still available?", minsAgo: 240 },
        { dir: "outbound", author: "auto", body: "Hi! Thanks for reaching out 👋 To help you fast, are you looking to: 1) Buy to stay  2) Buy to invest  3) Just checking price", minsAgo: 239, kind: "menu" },
        { dir: "inbound", author: "lead", body: "1, buy to stay. My budget is around 320k, need 3 rooms. Must be near the MRT though, I don't drive.", minsAgo: 235, kind: "menu_reply" },
        { dir: "outbound", author: "agent", body: "Perfect, this one is 3R2B at RM310k. Sending you the full report now.", minsAgo: 230 },
      ],
      intel: {
        role: "buyer", budgetMinRm: 300000, budgetMaxRm: 330000,
        lookingFor: ["3 bedrooms", "Buy to stay (own-stay)", "Walking distance to MRT/public transit"],
        dealbreakers: ["No car — must be transit-accessible", "Above RM330k"],
        objections: [], urgencyTier: "alpha", matchPct: 88, matchedListingId: listings[0].id,
        botProbability: 0.03, priorityPct: 91,
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
      },
    },
    {
      listingIdx: 1,
      channel: "messenger",
      name: "Daniel Wong",
      handle: "daniel.wong.92",
      propertyInterest: "Residensi Suasana, Damansara Damai",
      budget: "RM 420k - 480k",
      messages: [
        { dir: "inbound", author: "lead", body: "Hello, interested in Residensi Suasana. What's the maintenance fee like? And is it freehold?", minsAgo: 90 },
        { dir: "outbound", author: "agent", body: "Hi Daniel! Maintenance is ~RM0.28/sqft, and yes it's freehold.", minsAgo: 80 },
        { dir: "inbound", author: "lead", body: "Ok noted. Honestly the price feels a bit high vs the one nearby. Can owner nego?", minsAgo: 60 },
      ],
      intel: {
        role: "buyer", budgetMinRm: 420000, budgetMaxRm: 480000,
        lookingFor: ["Freehold tenure", "Reasonable maintenance fee"],
        dealbreakers: ["Overpriced vs nearby comparables"],
        objections: ["Price perceived high vs nearby comps", "Negotiation expected"],
        urgencyTier: "beta", matchPct: 72, matchedListingId: listings[1].id,
        botProbability: 0.05, priorityPct: 68,
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
      },
    },
    {
      listingIdx: 2,
      channel: "whatsapp",
      name: "Investor Lead (unverified)",
      handle: "+60 11-5500 0000",
      propertyInterest: "Mont Kiara Astana",
      budget: "Not specified",
      messages: [
        { dir: "inbound", author: "lead", body: "GUARANTEED HIGH ROI!! Click here to list your property FREE bit.ly/xy9 co-broke welcome", minsAgo: 30 },
      ],
      intel: {
        role: "unknown",
        lookingFor: [],
        dealbreakers: [],
        objections: [],
        urgencyTier: "passive", matchPct: 0,
        botProbability: 0.93, priorityPct: 4,
        xai: {
          summary: "Likely spam / co-broke fisher. Message contains a shortened link, all-caps marketing, and no genuine inquiry signal. Flagged by the integrity shield.",
          factors: [
            { label: "Bot probability", detail: "Shortened link + ALL CAPS promo + generic 'co-broke welcome'.", weight: 0.6 },
            { label: "No intent signal", detail: "No property question, budget, or qualifying answer.", weight: 0.4 },
          ],
          sources: ["Integrity shield: link + spam-pattern detection"],
        },
      },
    },
  ];

  for (const t of threads) {
    const listing = listings[t.listingIdx]!;
    const lead = await createLead(db, agent.id, {
      name: t.name,
      email: `${compactPropertyName(t.name).slice(0, 10)}@inbox.lead`,
      phone: t.channel === "messenger" ? "N/A" : t.handle,
      source: t.channel === "messenger" ? "Facebook" : "WhatsApp",
      propertyInterest: t.propertyInterest,
      budget: t.budget,
      message: t.messages.find((m) => m.dir === "inbound")?.body,
      preferredChannel: t.channel,
    });
    await assignLeadToListing(db, agent.id, lead.id, listing.id);

    const conv = await createConversation(db, agent.id, {
      channel: t.channel,
      externalId: t.handle,
      contactName: t.name,
      contactHandle: t.handle,
      leadId: lead.id,
      listingId: listing.id,
    });
    for (const m of t.messages) {
      await createMessage(db, agent.id, {
        conversationId: conv.id,
        direction: m.dir,
        author: m.author,
        body: m.body,
        kind: m.kind ?? "text",
        sentAt: new Date(Date.now() - m.minsAgo * 60000).toISOString(),
      });
    }
    await upsertLeadIntelligence(db, agent.id, lead.id, t.intel);
  }

  return { seeded: true };
}

export async function getLeadEvents(
  db: ReAIDbClient,
  agentId: string,
  leadId: string,
): Promise<LeadEvent[]> {
  const result = await db.execute<Record<string, unknown>>({
    sql: "SELECT * FROM lead_events WHERE lead_id = ? AND agent_id = ? ORDER BY occurred_at DESC",
    args: [leadId, agentId],
  });
  return result.rows.map(mapLeadEvent);
}

// ── OTP (Email + OTP Authentication) ──────────────────────────────

/**
 * Generate a cryptographically random 6-digit OTP code.
 */
export function generateOtpCode(): string {
  const buf = new Uint8Array(4);
  crypto.getRandomValues(buf);
  const num = new DataView(buf.buffer).getUint32(0);
  return String(num % 1_000_000).padStart(6, "0");
}

/**
 * Store an OTP code in the database with a 5-minute expiry.
 */
export async function storeOtpCode(
  db: ReAIDbClient,
  email: string,
  code: string,
): Promise<void> {
  const id = `otp_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  await db.execute({
    sql: `INSERT INTO otp_codes (id, email, code, expires_at, used) VALUES (?, ?, ?, ?, 0)`,
    args: [id, email.toLowerCase().trim(), code, expiresAt],
  });
}

/**
 * Verify an OTP code for a given email.
 * Returns the OTP row if valid, or null if invalid/expired/already used.
 * Marks the code as used on successful verification.
 */
export async function verifyOtpCode(
  db: ReAIDbClient,
  email: string,
  code: string,
): Promise<{ id: string; email: string } | null> {
  const normalizedEmail = email.toLowerCase().trim();
  const result = await db.execute<Record<string, unknown>>({
    sql: `SELECT id, email FROM otp_codes
          WHERE email = ? AND code = ? AND used = 0 AND expires_at > ?
          ORDER BY created_at DESC LIMIT 1`,
    args: [normalizedEmail, code, new Date().toISOString()],
  });

  const row = result.rows[0];
  if (!row) return null;

  // Mark as used (single-use code)
  await db.execute({
    sql: "UPDATE otp_codes SET used = 1 WHERE id = ?",
    args: [String(row.id)],
  });

  return { id: String(row.id), email: String(row.email) };
}

/**
 * Find an agent by email address.
 */
export async function findAgentByEmail(
  db: ReAIDbClient,
  email: string,
): Promise<Agent | null> {
  const result = await db.execute<Record<string, unknown>>({
    sql: "SELECT * FROM agents WHERE LOWER(email) = ? LIMIT 1",
    args: [email.toLowerCase().trim()],
  });
  return result.rows[0] ? mapAgent(result.rows[0]) : null;
}

/**
 * Create an OTP-authenticated agent (no Scalekit ID).
 * Generates an internal user ID prefixed with "otp_".
 */
export async function createOtpAgent(
  db: ReAIDbClient,
  email: string,
  firstName?: string,
): Promise<Agent> {
  await ensureSchema(db);
  const otpUserId = `otp_${crypto.randomUUID()}`;
  const agentId = `agent_${otpUserId.replace(/[^a-zA-Z0-9]/g, "").slice(-12)}`;
  const fullName = firstName || "Signatis Agent";
  const initials = fullName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const agent: Agent = {
    id: agentId,
    workosUserId: otpUserId,
    fullName,
    email: email.toLowerCase().trim(),
    phone: "+60 12-555 8472",
    plan: "Premium Agent",
    avatarInitials: initials || "DA",
    ingestionAddress: `inbound+${agentId.slice(-6).toLowerCase()}@leads.signatis.app`,
    renNumber: "",
    agencyName: "",
    whatsappNumber: "",
    avatarUrl: "",
    companyLogoUrl: "",
    bio: "",
  };

  await db.execute({
    sql: `INSERT INTO agents (
      id, workos_user_id, full_name, email, phone, plan, avatar_initials, ingestion_address,
      ren_number, agency_name, whatsapp_number, avatar_url, company_logo_url, bio
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      agent.id,
      agent.workosUserId,
      agent.fullName,
      agent.email,
      agent.phone,
      agent.plan,
      agent.avatarInitials,
      agent.ingestionAddress,
      agent.renNumber ?? "",
      agent.agencyName ?? "",
      agent.whatsappNumber ?? "",
      agent.avatarUrl ?? "",
      agent.companyLogoUrl ?? "",
      agent.bio ?? "",
    ],
  });

  await seedWorkspace(db, agent.id);
  return agent;
}


