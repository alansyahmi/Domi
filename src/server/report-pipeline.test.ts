import { describe, expect, it, vi } from "vitest";
import { generatePropertyReport } from "./report-pipeline";
import type { Agent, PropertyReportInput } from "../types";
import type { SignatisDbClient } from "./db";
import type { ReportResearchProvider } from "./report-research";

const agent: Agent = {
  id: "agent_123",
  workosUserId: "user_123",
  fullName: "Ada Agent",
  email: "ada@example.com",
  phone: "+60 12-555 8472",
  plan: "Premium Agent",
  avatarInitials: "AA",
  ingestionAddress: "inbound+aa@leads.signatis.app",
  agencyName: "Signatis Realty",
  renNumber: "REN 12345",
  whatsappNumber: "+60 12-555 8472",
  avatarUrl: "",
  companyLogoUrl: "",
  bio: "Residential specialist.",
};

function createDbMock(rowsByCall: Array<Record<string, unknown>[]>) {
  const execute = vi.fn().mockImplementation(() => {
    return Promise.resolve({ rows: rowsByCall.shift() ?? [] });
  });
  return { execute } as unknown as SignatisDbClient & { execute: ReturnType<typeof vi.fn> };
}

const reportInput: PropertyReportInput = {
  propertyName: "The Estate KL",
  address: "Jalan Ampang, Kuala Lumpur",
  propertyType: "Condo",
  listingIntent: "sale",
  tenure: "freehold",
  askingPriceRm: 1250000,
  sourceNotes: "Near LRT and KLCC.",
};

describe("report pipeline", () => {
  it("uses fresh cached intelligence without calling the provider", async () => {
    const provider: ReportResearchProvider = {
      research: vi.fn(),
    };
    const db = createDbMock([
      [
        {
          property_key: "the-estate-kl",
          property_name: "The Estate KL",
          payload_json: JSON.stringify({
            summary: "Cached market intelligence.",
            pricingTrend: "Stable premium demand",
            sentiment: "positive",
            sources: [{ title: "Cached Source", url: "https://example.com/cached" }],
          }),
          citations_json: JSON.stringify([{ title: "Cached Source", url: "https://example.com/cached" }]),
          refreshed_at: new Date().toISOString(),
        },
      ],
    ]);

    const report = await generatePropertyReport(db, agent, reportInput, { provider });

    expect(provider.research).not.toHaveBeenCalled();
    expect(report.cacheStatus).toBe("hit");
    expect(report.indexLookup).toMatchObject({
      propertyKey: "the-estate-kl",
      status: "fresh_hit",
      liveSearchStatus: "not_needed",
      citationsCount: 1,
      summary: "Cached market intelligence.",
    });
    expect(report.inputSnapshot).toMatchObject({
      listingIntent: "sale",
      tenure: "freehold",
      askingPriceRm: 1250000,
    });
    expect(report.citations).toEqual([{ title: "Cached Source", url: "https://example.com/cached" }]);
    expect(report.shareToken).toMatch(/^shr_/);
  });

  it("calls live search when cache is missing and stores validated intelligence", async () => {
    const provider: ReportResearchProvider = {
      research: vi.fn().mockResolvedValue({
        propertyName: "The Estate KL",
        summary: "Live research summary.",
        pricingTrend: "Asking prices are firming",
        sentiment: "positive",
        sources: [{ title: "Live Source", url: "https://example.com/live" }],
      }),
    };
    const db = createDbMock([[]]);

    const report = await generatePropertyReport(db, agent, reportInput, { provider });

    expect(provider.research).toHaveBeenCalledWith(expect.objectContaining({
      listingIntent: "sale",
      tenure: "freehold",
      askingPriceRm: 1250000,
    }));
    expect(report.cacheStatus).toBe("miss");
    expect(report.indexLookup).toMatchObject({
      propertyKey: "the-estate-kl",
      status: "miss",
      liveSearchStatus: "validated",
      freshnessDays: null,
      citationsCount: 1,
      summary: "Live research summary.",
    });
    expect(report.citations).toEqual([{ title: "Live Source", url: "https://example.com/live" }]);
    expect(db.execute).toHaveBeenCalledWith(expect.objectContaining({
      sql: expect.stringContaining("INSERT OR REPLACE INTO property_intelligence_cache"),
    }));
  });

  it("generates reports from property-name-only input", async () => {
    const provider: ReportResearchProvider = {
      research: vi.fn().mockResolvedValue({
        propertyName: "The Estate KL",
        summary: "Live research filled missing property details.",
        pricingTrend: "Balanced pricing discovery",
        sentiment: "neutral",
        sources: [{ title: "Live Source", url: "https://example.com/live" }],
      }),
    };
    const db = createDbMock([[]]);

    const report = await generatePropertyReport(db, agent, { propertyName: "The Estate KL" }, { provider });

    expect(provider.research).toHaveBeenCalledWith(expect.objectContaining({
      propertyName: "The Estate KL",
      address: "The Estate KL",
      propertyType: "Residential Property",
      tenure: "unknown",
    }));
    expect(report.cacheStatus).toBe("miss");
    expect(report.inputSnapshot).toMatchObject({
      propertyName: "The Estate KL",
      address: "The Estate KL",
      propertyType: "Residential Property",
      askingPriceRm: 0,
    });
    expect(report.indexLookup.liveSearchStatus).toBe("validated");
  });

  it("refreshes stale indexed intelligence through live search", async () => {
    const provider: ReportResearchProvider = {
      research: vi.fn().mockResolvedValue({
        propertyName: "The Estate KL",
        summary: "Fresh live research summary.",
        pricingTrend: "Premium pricing resilience",
        sentiment: "positive",
        sources: [{ title: "Updated Source", url: "https://example.com/updated" }],
      }),
    };
    const staleDate = new Date("2026-05-01T00:00:00.000Z").toISOString();
    const db = createDbMock([
      [
        {
          property_key: "the-estate-kl",
          property_name: "The Estate KL",
          payload_json: JSON.stringify({
            summary: "Old cached market intelligence.",
            pricingTrend: "Old signal",
            sentiment: "neutral",
          }),
          citations_json: JSON.stringify([{ title: "Old Source", url: "https://example.com/old" }]),
          refreshed_at: staleDate,
        },
      ],
    ]);

    const report = await generatePropertyReport(db, agent, reportInput, {
      provider,
      now: new Date("2026-06-11T00:00:00.000Z"),
    });

    expect(provider.research).toHaveBeenCalled();
    expect(report.cacheStatus).toBe("refreshed");
    expect(report.indexLookup).toMatchObject({
      status: "stale_hit",
      liveSearchStatus: "validated",
      freshnessDays: 41,
      citationsCount: 1,
      summary: "Fresh live research summary.",
    });
    expect(report.citations).toEqual([{ title: "Updated Source", url: "https://example.com/updated" }]);
  });

  it("uses fallback research when the provider fails", async () => {
    const provider: ReportResearchProvider = {
      research: vi.fn().mockRejectedValue(new Error("provider down")),
    };
    const db = createDbMock([[]]);

    const report = await generatePropertyReport(db, agent, reportInput, { provider });

    expect(report.cacheStatus).toBe("fallback");
    expect(report.indexLookup).toMatchObject({
      status: "miss",
      liveSearchStatus: "failed",
      citationsCount: 0,
    });
    expect(db.execute).not.toHaveBeenCalledWith(expect.objectContaining({
      sql: expect.stringContaining("INSERT OR REPLACE INTO property_intelligence_cache"),
    }));
    expect(report.citations[0]?.title).toBe("Signatis deterministic market model");
    expect(report.contentSections.map((section) => section.body).join(" ")).toContain("RM 1,250,000");
    expect(report.contentSections.map((section) => section.body).join(" ")).toContain("freehold");
  });

  it("uses fallback research and skips index storage when live search has no valid citations", async () => {
    const provider: ReportResearchProvider = {
      research: vi.fn().mockResolvedValue({
        propertyName: "The Estate KL",
        summary: "Uncited live research summary.",
        pricingTrend: "Premium pricing resilience",
        sentiment: "positive",
        sources: [],
      }),
    };
    const db = createDbMock([[]]);

    const report = await generatePropertyReport(db, agent, reportInput, { provider });

    expect(report.cacheStatus).toBe("fallback");
    expect(report.indexLookup).toMatchObject({
      status: "miss",
      liveSearchStatus: "failed",
      citationsCount: 0,
    });
    expect(db.execute).not.toHaveBeenCalledWith(expect.objectContaining({
      sql: expect.stringContaining("INSERT OR REPLACE INTO property_intelligence_cache"),
    }));
  });
});
