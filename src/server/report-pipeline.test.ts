import { describe, expect, it, vi } from "vitest";
import { generatePropertyReport } from "./report-pipeline";
import type { Agent, PropertyReportInput } from "../types";
import type { ReAIDbClient } from "./db";
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
  return { execute } as unknown as ReAIDbClient & { execute: ReturnType<typeof vi.fn> };
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
  });

  it("calls live search and bypasses cache when bypassCache is true", async () => {
    const provider: ReportResearchProvider = {
      research: vi.fn().mockResolvedValue({
        propertyName: "The Estate KL",
        summary: "Fresh live research summary.",
        pricingTrend: "Premium pricing resilience",
        sentiment: "positive",
        sources: [
          { title: "Updated Source", url: "https://example.com/updated" },
          { title: "Updated Market Source", url: "https://example.com/updated-market" },
        ],
      }),
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

    const report = await generatePropertyReport(db, agent, { ...reportInput, bypassCache: true }, { provider });

    expect(provider.research).toHaveBeenCalled();
    expect(report.cacheStatus).toBe("refreshed");
    expect(report.citations).toEqual([
      { title: "Updated Source", url: "https://example.com/updated" },
      { title: "Updated Market Source", url: "https://example.com/updated-market" },
    ]);
  });

  it("calls live search when cache is missing and stores validated intelligence", async () => {
    const provider: ReportResearchProvider = {
      research: vi.fn().mockResolvedValue({
        propertyName: "The Estate KL",
        summary: "Live research summary.",
        pricingTrend: "Asking prices are firming",
        sentiment: "positive",
        sources: [
          { title: "Live Source", url: "https://example.com/live" },
          { title: "Market Source", url: "https://example.com/market" },
        ],
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
      citationsCount: 2,
      summary: "Live research summary.",
    });
    expect(report.citations).toEqual([
      { title: "Live Source", url: "https://example.com/live" },
      { title: "Market Source", url: "https://example.com/market" },
    ]);
    expect(db.execute).toHaveBeenCalledWith(expect.objectContaining({
      sql: expect.stringContaining("INSERT OR REPLACE INTO property_intelligence_cache"),
    }));
  });

  it("stores normalized comparable listings with validated balanced intelligence", async () => {
    const provider: ReportResearchProvider = {
      research: vi.fn().mockResolvedValue({
        propertyName: "The Estate KL",
        summary: "Official/listing signals: premium city facilities. Community/user signals: buyer questions mention parking. Current listing signals: active listings show directional asking context.",
        pricingTrend: "Balanced pricing discovery",
        sentiment: "neutral",
        comparableListings: [
          {
            title: "The Estate KL condo for sale",
            sourceName: "Property portal",
            url: "https://example.com/listing",
            askingPriceRm: 1250000,
            builtUpSqft: 850,
            bedrooms: 2,
            bathrooms: 2,
            listingIntent: "sale",
            snippet: "Current asking price RM 1,250,000 for 850 sqft.",
          },
        ],
        sources: [
          { title: "Official 1", url: "https://example.com/official-1", snippet: "Premium city facilities.", sourceType: "official" },
          { title: "Official 2", url: "https://example.com/official-2", snippet: "Location and amenities.", sourceType: "official" },
          { title: "Community 1", url: "https://example.com/community-1", snippet: "Buyer questions mention parking.", sourceType: "community" },
          { title: "Community 2", url: "https://example.com/community-2", snippet: "Residents discuss access.", sourceType: "community" },
          { title: "Listing 1", url: "https://example.com/listing", snippet: "Current asking price RM 1,250,000 for 850 sqft.", sourceType: "comparable_listing" },
        ],
      }),
    };
    const db = createDbMock([[]]);

    const report = await generatePropertyReport(db, agent, reportInput, { provider });
    const savedIndexCall = db.execute.mock.calls.find(([statement]) =>
      typeof statement === "object" && String(statement.sql).includes("INSERT OR REPLACE INTO property_intelligence_cache"),
    );
    const sections = Object.fromEntries(report.contentSections.map((section) => [section.title, section.body]));

    expect(report.indexLookup.liveSearchStatus).toBe("validated");
    expect(report.comparableListings).toEqual([
      expect.objectContaining({
        title: "The Estate KL condo for sale",
        askingPriceRm: 1250000,
        builtUpSqft: 850,
      }),
    ]);
    expect(sections["Current Listing Context"]).toContain("RM 1,250,000");
    expect(sections["Pricing Posture"]).toContain("current listing signals");
    expect(savedIndexCall).toBeTruthy();
    expect(JSON.parse(String((savedIndexCall?.[0] as { args: unknown[] }).args[2]))).toMatchObject({
      comparableListings: [
        expect.objectContaining({
          askingPriceRm: 1250000,
          builtUpSqft: 850,
        }),
      ],
    });
  });

  it("generates reports from property-name-only input", async () => {
    const provider: ReportResearchProvider = {
      research: vi.fn().mockResolvedValue({
        propertyName: "The Estate KL",
        summary: "Live research filled missing property details.",
        pricingTrend: "Balanced pricing discovery",
        sentiment: "neutral",
        comparableListings: [
          {
            title: "The Estate KL condo for sale",
            sourceName: "iproperty.com.my",
            url: "https://www.iproperty.com.my/the-estate-kl",
            askingPriceRm: 900000,
            builtUpSqft: 850,
            listingIntent: "sale",
          },
          {
            title: "The Estate KL premium unit for sale",
            sourceName: "mudah.my",
            url: "https://www.mudah.my/the-estate-kl-premium",
            askingPriceRm: 1100000,
            builtUpSqft: 950,
            listingIntent: "sale",
          },
        ],
        sources: [
          { title: "Live Source", url: "https://example.com/live" },
          { title: "Market Source", url: "https://example.com/market" },
        ],
      }),
    };
    const db = createDbMock([[]]);

    const report = await generatePropertyReport(db, agent, { propertyName: "The Estate KL" }, { provider });
    const sections = Object.fromEntries(report.contentSections.map((section) => [section.title, section.body]));
    const savedReportCall = db.execute.mock.calls.find(([statement]) =>
      typeof statement === "object" && String(statement.sql).includes("INSERT INTO property_reports"),
    );

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
    expect(sections["Current Listing Context"]).toContain("Active The Estate KL listings show");
    expect(sections["Current Listing Context"]).not.toContain("relative to target");
    expect(savedReportCall).toBeTruthy();
    expect((savedReportCall?.[0] as { sql: string }).sql).toContain("comparable_listings_json");
  });

  it("uses one-source live research without storing it in the index", async () => {
    const provider: ReportResearchProvider = {
      research: vi.fn().mockResolvedValue({
        propertyName: "The Estate KL",
        summary: "Single-source live research summary.",
        pricingTrend: "Balanced pricing discovery",
        sentiment: "neutral",
        sources: [{ title: "Only Source", url: "https://example.com/only" }],
      }),
    };
    const db = createDbMock([[]]);

    const report = await generatePropertyReport(db, agent, reportInput, { provider });

    expect(report.cacheStatus).toBe("miss");
    expect(report.indexLookup).toMatchObject({
      status: "miss",
      liveSearchStatus: "limited",
      citationsCount: 1,
      summary: "Single-source live research summary.",
    });
    expect(report.citations).toEqual([{ title: "Only Source", url: "https://example.com/only" }]);
    expect(db.execute).not.toHaveBeenCalledWith(expect.objectContaining({
      sql: expect.stringContaining("INSERT OR REPLACE INTO property_intelligence_cache"),
    }));
  });

  it("does not index live research when all citations come from one source lane", async () => {
    const provider: ReportResearchProvider = {
      research: vi.fn().mockResolvedValue({
        propertyName: "The Estate KL",
        summary: "Official-only live research summary.",
        pricingTrend: "Balanced pricing discovery",
        sentiment: "neutral",
        sources: [
          { title: "Official 1", url: "https://example.com/official-1", sourceType: "official" },
          { title: "Official 2", url: "https://example.com/official-2", sourceType: "official" },
          { title: "Official 3", url: "https://example.com/official-3", sourceType: "official" },
        ],
      }),
    };
    const db = createDbMock([[]]);

    const report = await generatePropertyReport(db, agent, reportInput, { provider });

    expect(report.indexLookup.liveSearchStatus).toBe("limited");
    expect(db.execute).not.toHaveBeenCalledWith(expect.objectContaining({
      sql: expect.stringContaining("INSERT OR REPLACE INTO property_intelligence_cache"),
    }));
  });

  it("assembles a client-facing advisory brief from official and community sources", async () => {
    const provider: ReportResearchProvider = {
      research: vi.fn().mockResolvedValue({
        propertyName: "The Estate KL",
        summary: "Official/listing signals: waterfront access, retail convenience, and compact city living. Community/user signals: some residents mention midnight noise, parking congestion, and maintenance follow-up questions.",
        pricingTrend: "Balanced pricing discovery",
        sentiment: "neutral",
        sources: [
          {
            title: "Official listing",
            url: "https://example.com/official",
            snippet: "Waterfront access, retail convenience, and city facilities.",
            sourceType: "official",
          },
          {
            title: "Property portal",
            url: "https://example.com/portal",
            snippet: "Compact city living near shops and transport.",
            sourceType: "official",
          },
          {
            title: "Resident forum",
            url: "https://example.com/forum",
            snippet: "Residents mention midnight noise and parking congestion.",
            sourceType: "community",
          },
          {
            title: "Community review",
            url: "https://example.com/review",
            snippet: "Maintenance follow-up questions appear in user comments.",
            sourceType: "community",
          },
        ],
      }),
    };
    const db = createDbMock([[]]);

    const report = await generatePropertyReport(db, agent, reportInput, { provider });
    const sections = Object.fromEntries(report.contentSections.map((section) => [section.title, section.body]));

    expect(Object.keys(sections)).toEqual([
      "TL;DR for the Agent",
      "Best-Fit Buyer Profile",
      "Investor Snapshot",
      "Current Listing Context",
      "Market Positioning",
      "Strengths to Lead With",
      "Watchouts and Buyer Questions",
      "Handling Objections",
      "Pricing Posture",
      "Recommended Listing Narrative",
      "Recent Transaction History",
      "Nearby Facilities & Infrastructure",
      "Next Steps",
    ]);
    expect(sections["Strengths to Lead With"]).toContain("waterfront access");
    expect(sections["Watchouts and Buyer Questions"]).toContain("midnight noise");
    expect(sections["Watchouts and Buyer Questions"]).toContain("Buyer questions");
    expect(sections["Recommended Listing Narrative"]).toContain("client-safe");
    expect(report.contentSections.map((section) => section.body).join(" ")).not.toMatch(/cache|index|Tavily|live search/i);
  });

  it("adds a source coverage caveat when one source lane is limited", async () => {
    const provider: ReportResearchProvider = {
      research: vi.fn().mockResolvedValue({
        propertyName: "The Estate KL",
        summary: "Official/listing signals: waterfront access and retail convenience.",
        pricingTrend: "Balanced pricing discovery",
        sentiment: "neutral",
        sources: [
          { title: "Official listing", url: "https://example.com/official-1", snippet: "Waterfront access.", sourceType: "official" },
          { title: "Portal listing", url: "https://example.com/official-2", snippet: "Retail convenience.", sourceType: "official" },
        ],
      }),
    };
    const db = createDbMock([[]]);

    const report = await generatePropertyReport(db, agent, reportInput, { provider });
    const watchouts = report.contentSections.find((section) => section.title === "Watchouts and Buyer Questions")?.body ?? "";

    expect(report.indexLookup.liveSearchStatus).toBe("limited");
    expect(watchouts).toContain("Community/user source coverage is limited");
  });

  it("refreshes stale indexed intelligence through live search", async () => {
    const provider: ReportResearchProvider = {
      research: vi.fn().mockResolvedValue({
        propertyName: "The Estate KL",
        summary: "Fresh live research summary.",
        pricingTrend: "Premium pricing resilience",
        sentiment: "positive",
        sources: [
          { title: "Updated Source", url: "https://example.com/updated" },
          { title: "Updated Market Source", url: "https://example.com/updated-market" },
        ],
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
      citationsCount: 2,
      summary: "Fresh live research summary.",
    });
    expect(report.citations).toEqual([
      { title: "Updated Source", url: "https://example.com/updated" },
      { title: "Updated Market Source", url: "https://example.com/updated-market" },
    ]);
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
    expect(report.contentSections.map((section) => section.body).join(" ")).toContain("TL;DR");
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
