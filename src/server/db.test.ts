import { describe, expect, it, vi } from "vitest";
import {
  getTursoConfig,
  toSqlArgs,
  connectIntegration,
  disconnectIntegration,
  getReportByShareToken,
  savePropertyReport,
} from "./db";

describe("database helpers", () => {
  it("requires Turso credentials", () => {
    expect(() => getTursoConfig({})).toThrow(
      "Missing environment variable TURSO_DATABASE_URL",
    );
  });

  it("passes defined SQL args through unchanged", () => {
    expect(toSqlArgs(["agent_1", undefined, 12, null])).toEqual([
      "agent_1",
      12,
      null,
    ]);
  });

  describe("integrations database helpers", () => {
    it("connectIntegration executes INSERT statement", async () => {
      const executeMock = vi.fn().mockResolvedValue({ rows: [] });
      const dbMock = { execute: executeMock };

      const result = await connectIntegration(
        dbMock as any,
        "agent_123",
        "portal_pg",
        "PropertyGuru",
        "Sync leads"
      );

      expect(executeMock).toHaveBeenCalledWith({
        sql: expect.stringContaining("INSERT OR REPLACE INTO integrations"),
        args: ["portal_pg", "agent_123", "PropertyGuru", "Sync leads"],
      });
      expect(result).toEqual({
        id: "portal_pg",
        agentId: "agent_123",
        name: "PropertyGuru",
        description: "Sync leads",
        status: "connected",
      });
    });

    it("disconnectIntegration executes DELETE statement", async () => {
      const executeMock = vi.fn().mockResolvedValue({ rows: [] });
      const dbMock = { execute: executeMock };

      await disconnectIntegration(dbMock as any, "agent_123", "portal_pg");

      expect(executeMock).toHaveBeenCalledWith({
        sql: expect.stringContaining("DELETE FROM integrations"),
        args: ["portal_pg", "agent_123"],
      });
    });
  });

  describe("report persistence helpers", () => {
    it("stores report metadata, analytics, citations, and share token", async () => {
      const executeMock = vi.fn().mockResolvedValue({ rows: [] });
      const dbMock = { execute: executeMock };

      await savePropertyReport(dbMock as any, {
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
          address: "The Estate KL",
          propertyType: "Residential Property",
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
          confidenceScore: 0.78,
          freshnessDays: 0,
        },
        citations: [{ title: "Source", url: "https://example.com" }],
        comparableListings: [],
        contentSections: [{ title: "Market read", body: "Premium demand is stable." }],
      });

      expect(executeMock).toHaveBeenCalledWith({
        sql: expect.stringContaining("INSERT INTO property_reports"),
        args: expect.arrayContaining([
          "the-estate-kl",
          "miss",
          "shr_123",
          JSON.stringify([{ title: "Source", url: "https://example.com" }]),
        ]),
      });
    });

    it("looks up reports by share token", async () => {
      const executeMock = vi.fn().mockResolvedValue({
        rows: [
          {
            id: "report_123",
            agent_id: "agent_123",
            title: "The Estate KL Analysis",
            address: "The Estate KL",
            property_type: "Residential Property",
            sqft: 0,
            bedrooms: 0,
            bathrooms: 0,
            year_built: 2026,
            status: "ready",
            market_signal: "Stable premium demand",
            sentiment_summary: "Positive buyer sentiment.",
            generated_at: "2026-06-11T00:00:00.000Z",
            property_name: "The Estate KL",
            property_key: "the-estate-kl",
            cache_status: "miss",
            share_token: "shr_123",
            input_json: "{}",
            analytics_json: "{}",
            citations_json: "[]",
            content_sections_json: "[]",
          },
        ],
      });
      const dbMock = { execute: executeMock };

      const report = await getReportByShareToken(dbMock as any, "shr_123");

      expect(executeMock).toHaveBeenCalledWith({
        sql: expect.stringContaining("WHERE share_token = ?"),
        args: ["shr_123"],
      });
      expect(report?.id).toBe("report_123");
      expect(report?.shareToken).toBe("shr_123");
      expect(report?.analytics).toMatchObject({
        sentiment: "neutral",
        pricingTrend: "Stable premium demand",
        confidenceScore: 0.68,
        freshnessDays: 0,
      });
      expect(report?.indexLookup).toMatchObject({
        propertyKey: "the-estate-kl",
        status: "miss",
        liveSearchStatus: "validated",
        citationsCount: 0,
      });
    });
  });

  describe("leads database helpers", () => {
    it("deleteLead executes DELETE statements for events and lead", async () => {
      const executeMock = vi.fn().mockResolvedValue({ rows: [] });
      const dbMock = { execute: executeMock };

      const { deleteLead } = await import("./db");
      await deleteLead(dbMock as any, "agent_123", "lead_456");

      expect(executeMock).toHaveBeenNthCalledWith(1, {
        sql: "DELETE FROM lead_events WHERE lead_id = ? AND agent_id = ?",
        args: ["lead_456", "agent_123"],
      });
      expect(executeMock).toHaveBeenNthCalledWith(2, {
        sql: "DELETE FROM leads WHERE id = ? AND agent_id = ?",
        args: ["lead_456", "agent_123"],
      });
    });

    it("getAgentByIngestionAddress matches case-insensitively", async () => {
      const executeMock = vi.fn().mockResolvedValue({ rows: [] });
      const dbMock = { execute: executeMock };

      const { getAgentByIngestionAddress } = await import("./db");
      await getAgentByIngestionAddress(dbMock as any, "  Inbound+AB12CD@Leads.Signatis.App  ");

      expect(executeMock).toHaveBeenCalledWith({
        sql: expect.stringContaining("LOWER(ingestion_address) = ?"),
        args: ["inbound+ab12cd@leads.signatis.app"],
      });
    });

    it("recordLeadEngagement increments opens, rescores, and logs an event", async () => {
      const leadRow = {
        id: "lead_456",
        agent_id: "agent_123",
        name: "Ahmad",
        email: "a@b.com",
        phone: "012",
        source: "PropertyGuru",
        property_interest: "Condo",
        budget: "RM 900k",
        email_opens: 2,
        link_clicks: 1,
        report_views: 1,
        inquiry_sentiment: 0.5,
        sentiment: "positive",
        score: 9,
        intent: 0,
        tier: "Cold",
        stage: "new",
        preferred_channel: "whatsapp",
        created_at: "2026-06-11T00:00:00.000Z",
      };
      const executeMock = vi
        .fn()
        .mockResolvedValueOnce({ rows: [leadRow] }) // SELECT lead
        .mockResolvedValue({ rows: [] }); // UPDATE + INSERT event
      const dbMock = { execute: executeMock };

      const { recordLeadEngagement } = await import("./db");
      const updated = await recordLeadEngagement(dbMock as any, "lead_456", "email_open");

      // opens 2->3; score = 3 + 1*3 + 1*4 + round(0.5*4)=2 => 12
      expect(updated?.emailOpens).toBe(3);
      expect(updated?.score).toBe(12);
      expect(executeMock).toHaveBeenNthCalledWith(2, {
        sql: expect.stringContaining("UPDATE leads SET email_opens = ?"),
        args: [3, 1, 12, expect.any(Number), "Warm", "lead_456"],
      });
      expect(executeMock).toHaveBeenNthCalledWith(3, {
        sql: expect.stringContaining("INSERT INTO lead_events"),
        args: expect.arrayContaining(["lead_456", "agent_123", "email_open"]),
      });
    });

    it("recordLeadEngagement returns null when the lead is missing", async () => {
      const executeMock = vi.fn().mockResolvedValue({ rows: [] });
      const dbMock = { execute: executeMock };

      const { recordLeadEngagement } = await import("./db");
      const result = await recordLeadEngagement(dbMock as any, "nope", "link_click");

      expect(result).toBeNull();
      expect(executeMock).toHaveBeenCalledTimes(1);
    });

    it("getLeadEvents queries events in chronological order", async () => {
      const executeMock = vi.fn().mockResolvedValue({
        rows: [
          {
            id: "event_1",
            lead_id: "lead_456",
            agent_id: "agent_123",
            event_type: "manual_note",
            event_label: "Call log",
            occurred_at: "2026-06-11T12:00:00.000Z",
          },
        ],
      });
      const dbMock = { execute: executeMock };

      const { getLeadEvents } = await import("./db");
      const events = await getLeadEvents(dbMock as any, "agent_123", "lead_456");

      expect(executeMock).toHaveBeenCalledWith({
        sql: "SELECT * FROM lead_events WHERE lead_id = ? AND agent_id = ? ORDER BY occurred_at DESC",
        args: ["lead_456", "agent_123"],
      });
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        id: "event_1",
        leadId: "lead_456",
        agentId: "agent_123",
        eventType: "manual_note",
        eventLabel: "Call log",
        occurredAt: "2026-06-11T12:00:00.000Z",
      });
    });
  });
});
