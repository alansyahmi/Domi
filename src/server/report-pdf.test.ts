import { describe, expect, it } from "vitest";
import { generateReportPdf } from "./report-pdf";
import type { Agent, PropertyReport } from "../types";

describe("report PDF generation", () => {
  it("returns PDF bytes", () => {
    const agent: Agent = {
      id: "agent_123",
      workosUserId: "user_123",
      fullName: "Ada Agent",
      email: "ada@example.com",
      phone: "+60 12-555 8472",
      plan: "Premium Agent",
      avatarInitials: "AA",
      ingestionAddress: "inbound+aa@leads.signatis.app",
    };
    const report: PropertyReport = {
      id: "report_123",
      agentId: agent.id,
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
      cacheStatus: "hit",
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
        status: "fresh_hit",
        liveSearchStatus: "not_needed",
        freshnessDays: 0,
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

    const pdf = generateReportPdf(report, agent);

    expect(Buffer.from(pdf).subarray(0, 4).toString("utf8")).toBe("%PDF");
  });
});
