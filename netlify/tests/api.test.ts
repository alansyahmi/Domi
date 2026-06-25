import { beforeEach, describe, expect, it, vi } from "vitest";

const mockAgent = {
  id: "agent_123",
  workosUserId: "user_123",
  fullName: "Ada Agent",
  email: "ada@example.com",
  phone: "+60 12-555 8472",
  plan: "Premium Agent",
  avatarInitials: "AA",
  ingestionAddress: "inbound+aa@leads.re-ai.app",
};

const mockReport = {
  id: "report_123",
  agentId: "agent_123",
  title: "The Estate KL Analysis",
  address: "The Estate KL",
  propertyType: "Residential Property",
  sqft: 0,
  bedrooms: 0,
  bathrooms: 0,
  yearBuilt: 2026,
  status: "ready",
  marketSignal: "Stable premium demand",
  sentimentSummary: "Positive buyer sentiment.",
  generatedAt: "2026-06-11T00:00:00.000Z",
  propertyName: "The Estate KL",
  propertyKey: "the-estate-kl",
  cacheStatus: "miss",
  shareToken: "shr_123",
  inputSnapshot: {
    propertyName: "The Estate KL",
    address: "Jalan Ampang, Kuala Lumpur",
    propertyType: "Condo",
    listingIntent: "sale",
    tenure: "freehold",
    askingPriceRm: 1250000,
    sqft: 0,
    bedrooms: 0,
    bathrooms: 0,
    yearBuilt: 2026,
  },
  indexLookup: {
    propertyKey: "the-estate-kl",
    status: "miss",
    liveSearchStatus: "validated",
    freshnessDays: null,
    citationsCount: 1,
    summary: "Premium demand is stable.",
    checkedAt: "2026-06-11T00:00:00.000Z",
  },
  analytics: {
    sentiment: "positive",
    pricingTrend: "Stable premium demand",
    confidenceScore: 0.84,
    freshnessDays: 0,
  },
  citations: [{ title: "Source", url: "https://example.com" }],
  contentSections: [{ title: "Market read", body: "Premium demand is stable." }],
};

const dbMock = { execute: vi.fn() };

vi.mock("@workos-inc/node", () => ({
  WorkOS: vi.fn().mockImplementation(function () {
    return {
      userManagement: {
        getUser: vi.fn(),
        getJwksUrl: vi.fn(),
      },
    };
  }),
}));

vi.mock("../../src/server/runtime-env", () => ({
  getRuntimeEnv: () => ({
    WORKOS_API_KEY: "key",
    WORKOS_CLIENT_ID: "client",
    WORKOS_COOKIE_PASSWORD: "x".repeat(32),
    TURSO_DATABASE_URL: "file:test",
    TURSO_AUTH_TOKEN: "token",
    CSRF_SECRET: "secret",
  }),
}));

vi.mock("../../src/server/auth", () => ({
  createCsrfToken: () => "csrf",
  requireSession: vi.fn().mockResolvedValue({
    authenticated: true,
    user: { id: "user_123", email: "ada@example.com", firstName: "Ada", lastName: "Agent" },
  }),
  verifyWorkosToken: vi.fn().mockResolvedValue({
    id: "user_123",
    email: "ada@example.com",
    firstName: "Ada",
    lastName: "Agent",
  }),
}));

vi.mock("../../src/server/db", () => ({
  createReAIDb: () => dbMock,
  ensureAgentWorkspace: vi.fn().mockResolvedValue(mockAgent),
  getDashboardData: vi.fn(),
  getIntegrations: vi.fn(),
  getLeads: vi.fn(),
  getReports: vi.fn(),
  updateAgentSettings: vi.fn(),
  connectIntegration: vi.fn(),
  disconnectIntegration: vi.fn(),
  createSupportRequest: vi.fn(),
  getReportById: vi.fn().mockResolvedValue(mockReport),
  getReportByShareToken: vi.fn().mockImplementation((_db, token) =>
    token === "shr_123" ? Promise.resolve(mockReport) : Promise.resolve(null),
  ),
  getAgentById: vi.fn().mockResolvedValue(mockAgent),
}));

vi.mock("../../src/server/report-pipeline", () => ({
  generatePropertyReport: vi.fn().mockResolvedValue(mockReport),
}));

vi.mock("../../src/server/report-pdf", () => ({
  generateReportPdf: () => new TextEncoder().encode("%PDF-1.4\nmock"),
}));

describe("api report routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates reports from property-name-only requests", async () => {
    const { default: handler } = await import("../functions/api");
    const response = await handler(
      new Request("https://example.com/api/reports/create", {
        method: "POST",
        headers: { Authorization: "Bearer token" },
        body: JSON.stringify({
          propertyName: "The Estate KL",
        }),
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      report: { id: "report_123", shareToken: "shr_123" },
    });
  });

  it("streams authenticated report PDFs", async () => {
    const { default: handler } = await import("../functions/api");
    const response = await handler(
      new Request("https://example.com/api/reports/report_123/pdf", {
        method: "GET",
        headers: { Authorization: "Bearer token" },
      }),
    );

    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(Buffer.from(await response.arrayBuffer()).subarray(0, 4).toString("utf8")).toBe("%PDF");
  });

  it("returns public shared reports without auth", async () => {
    const { default: handler } = await import("../functions/api");
    const response = await handler(new Request("https://example.com/api/reports/share/shr_123"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      report: { id: "report_123", shareToken: "shr_123" },
    });
  });

  it("returns 404 for invalid share tokens", async () => {
    const { default: handler } = await import("../functions/api");
    const response = await handler(new Request("https://example.com/api/reports/share/invalid"));

    expect(response.status).toBe(404);
  });
});
