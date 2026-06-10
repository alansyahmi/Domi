import { createClient } from "@tursodatabase/serverless/compat";
import { buildReportDraft } from "../domain/reports";
import { getRuntimeEnv } from "./runtime-env";
import type {
  Agent,
  DashboardData,
  Integration,
  Lead,
  LeadEvent,
  PropertyReport,
  PropertyReportInput,
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
    address TEXT NOT NULL,
    property_type TEXT NOT NULL,
    sqft INTEGER NOT NULL,
    bedrooms INTEGER NOT NULL,
    bathrooms REAL NOT NULL,
    year_built INTEGER NOT NULL,
    status TEXT NOT NULL,
    market_signal TEXT NOT NULL,
    sentiment_summary TEXT NOT NULL,
    generated_at TEXT NOT NULL,
    FOREIGN KEY(agent_id) REFERENCES agents(id)
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

export function mapReport(row: Record<string, unknown>): PropertyReport {
  return {
    id: String(row.id),
    agentId: String(row.agent_id),
    title: String(row.title),
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
  };

  await db.execute({
    sql: `INSERT INTO agents (
      id, workos_user_id, full_name, email, phone, plan, avatar_initials, ingestion_address
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      agent.id,
      agent.workosUserId,
      agent.fullName,
      agent.email,
      agent.phone,
      agent.plan,
      agent.avatarInitials,
      agent.ingestionAddress,
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

  const reportInputs: Array<PropertyReportInput & { id: string; generatedAt: string }> = [
    {
      id: "report_1",
      address: "142 Oak St",
      propertyType: "Terrace House",
      sqft: 2500,
      bedrooms: 4,
      bathrooms: 3,
      yearBuilt: 2018,
      generatedAt: "2026-06-10T10:30:00.000Z",
    },
    {
      id: "report_2",
      address: "Downtown Market Overview",
      propertyType: "Market Brief",
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

export async function getIntegrations(db: SignatisDbClient, agentId: string): Promise<Integration[]> {
  const result = await db.execute<Record<string, unknown>>({
    sql: "SELECT * FROM integrations WHERE agent_id = ? ORDER BY name ASC",
    args: [agentId],
  });
  return result.rows.map(mapIntegration);
}

export async function createReport(
  db: SignatisDbClient,
  agentId: string,
  input: PropertyReportInput,
): Promise<PropertyReport> {
  const draft = buildReportDraft(input);
  const id = `report_${Date.now()}`;
  const generatedAt = new Date().toISOString();

  await db.execute({
    sql: `INSERT INTO property_reports (
      id, agent_id, title, address, property_type, sqft, bedrooms, bathrooms,
      year_built, status, market_signal, sentiment_summary, generated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      agentId,
      draft.title,
      input.address.trim(),
      input.propertyType.trim(),
      input.sqft,
      input.bedrooms,
      input.bathrooms,
      input.yearBuilt,
      draft.status,
      draft.marketSignal,
      draft.sentimentSummary,
      generatedAt,
    ],
  });

  return {
    id,
    agentId,
    title: draft.title,
    address: input.address.trim(),
    propertyType: input.propertyType.trim(),
    sqft: input.sqft,
    bedrooms: input.bedrooms,
    bathrooms: input.bathrooms,
    yearBuilt: input.yearBuilt,
    status: draft.status,
    marketSignal: draft.marketSignal,
    sentimentSummary: draft.sentimentSummary,
    generatedAt,
  };
}

export async function updateAgentSettings(
  db: SignatisDbClient,
  agentId: string,
  values: Pick<Agent, "fullName" | "email" | "phone">,
): Promise<Agent> {
  await db.execute({
    sql: "UPDATE agents SET full_name = ?, email = ?, phone = ? WHERE id = ?",
    args: [values.fullName, values.email, values.phone, agentId],
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
