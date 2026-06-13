import { createClient } from "@tursodatabase/serverless/compat";
import { buildReportDraft, buildReportPropertyKey, normalizeReportInput } from "../domain/reports";
import { getRuntimeEnv } from "./runtime-env";
import type {
  Agent,
  DashboardData,
  Integration,
  Lead,
  LeadEvent,
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

export interface SignatisDbClient {
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

export function createSignatisDb(env: DbEnv): SignatisDbClient {
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
];

export async function ensureSchema(db: SignatisDbClient): Promise<void> {
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
    freshnessDays: 0,
  };
  const analyticsPayload = parseJson<Partial<ReportAnalytics> & { indexLookup?: ReportIndexLookup }>(row.analytics_json, fallbackAnalytics);
  const analytics: ReportAnalytics = {
    sentiment: parseSentiment(analyticsPayload.sentiment),
    pricingTrend: analyticsPayload.pricingTrend || fallbackAnalytics.pricingTrend,
    confidenceScore: Number.isFinite(analyticsPayload.confidenceScore) ? Number(analyticsPayload.confidenceScore) : fallbackAnalytics.confidenceScore,
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
  db: SignatisDbClient,
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

export async function seedWorkspace(db: SignatisDbClient, agentId: string): Promise<void> {
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

export async function getDashboardData(db: SignatisDbClient, agent: Agent): Promise<DashboardData> {
  const leads = (await getLeads(db, agent.id)).sort((a, b) => b.score - a.score);
  const reports = await getReports(db, agent.id);
  const averageScore = leads.length
    ? Number((leads.reduce((total, lead) => total + lead.score, 0) / leads.length / 40).toFixed(2))
    : 0;

  return {
    agent,
    totals: {
      leadsScored: Math.max(1248, leads.length),
      averageIntentScore: averageScore || 0.84,
      reportsGenerated: Math.max(342, reports.length),
      highIntentLeads: leads.filter((lead) => lead.intent === 1).length,
    },
    highIntentLeads: leads.filter((lead) => lead.intent === 1).slice(0, 3),
    recentReports: reports.slice(0, 3),
  };
}

export async function getLeads(db: SignatisDbClient, agentId: string): Promise<Lead[]> {
  const result = await db.execute<Record<string, unknown>>({
    sql: "SELECT * FROM leads WHERE agent_id = ? ORDER BY created_at DESC",
    args: [agentId],
  });
  return result.rows.map(mapLead);
}

export async function getReports(db: SignatisDbClient, agentId: string): Promise<PropertyReport[]> {
  const result = await db.execute<Record<string, unknown>>({
    sql: "SELECT * FROM property_reports WHERE agent_id = ? ORDER BY generated_at DESC",
    args: [agentId],
  });
  return result.rows.map(mapReport);
}

export async function getReportById(
  db: SignatisDbClient,
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
  db: SignatisDbClient,
  shareToken: string,
): Promise<PropertyReport | null> {
  const result = await db.execute<Record<string, unknown>>({
    sql: "SELECT * FROM property_reports WHERE share_token = ? LIMIT 1",
    args: [shareToken],
  });
  return result.rows[0] ? mapReport(result.rows[0]) : null;
}

export async function getAgentById(db: SignatisDbClient, agentId: string): Promise<Agent | null> {
  const result = await db.execute<Record<string, unknown>>({
    sql: "SELECT * FROM agents WHERE id = ? LIMIT 1",
    args: [agentId],
  });
  return result.rows[0] ? mapAgent(result.rows[0]) : null;
}

export async function getPropertyIntelligenceCache(
  db: SignatisDbClient,
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
  db: SignatisDbClient,
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

export async function savePropertyReport(
  db: SignatisDbClient,
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

export async function getIntegrations(db: SignatisDbClient, agentId: string): Promise<Integration[]> {
  const result = await db.execute<Record<string, unknown>>({
    sql: "SELECT * FROM integrations WHERE agent_id = ? ORDER BY name ASC",
    args: [agentId],
  });
  return result.rows.map(mapIntegration);
}

export async function connectIntegration(
  db: SignatisDbClient,
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
  db: SignatisDbClient,
  agentId: string,
  integrationId: string,
): Promise<void> {
  await db.execute({
    sql: "DELETE FROM integrations WHERE id = ? AND agent_id = ?",
    args: [integrationId, agentId],
  });
}


export async function createReport(
  db: SignatisDbClient,
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
  db: SignatisDbClient,
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
  db: SignatisDbClient,
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
  db: SignatisDbClient,
  agentId: string,
  input: {
    name: string;
    email: string;
    phone: string;
    source: string;
    propertyInterest: string;
    budget: string;
    message?: string;
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
    createdAt: new Date().toISOString(),
  };

  await db.execute({
    sql: `INSERT INTO leads (
      id, agent_id, name, email, phone, source, property_interest, budget,
      email_opens, link_clicks, report_views, inquiry_sentiment, sentiment,
      score, intent, tier, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
  db: SignatisDbClient,
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

export async function getLeadEvents(
  db: SignatisDbClient,
  agentId: string,
  leadId: string,
): Promise<LeadEvent[]> {
  const result = await db.execute<Record<string, unknown>>({
    sql: "SELECT * FROM lead_events WHERE lead_id = ? AND agent_id = ? ORDER BY occurred_at DESC",
    args: [leadId, agentId],
  });
  return result.rows.map(mapLeadEvent);
}
