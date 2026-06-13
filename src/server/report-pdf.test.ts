import { describe, expect, it } from "vitest";
import { generateReportPdf } from "./report-pdf";
import type { Agent, PropertyReport } from "../types";

describe("report PDF generation", () => {
  function createReport(overrides: Partial<PropertyReport> = {}): { agent: Agent; report: PropertyReport } {
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
      comparableListings: [],
      contentSections: [{ title: "Market read", body: "Premium demand is stable." }],
      ...overrides,
    };

    return { agent, report };
  }

  it("returns PDF bytes", () => {
    const { agent, report } = createReport();

    const pdf = generateReportPdf(report, agent);

    expect(Buffer.from(pdf).subarray(0, 4).toString("utf8")).toBe("%PDF");
  });

  it("paginates long reports instead of clipping content", () => {
    const longBody = Array.from({ length: 90 }, (_, index) =>
      `Grounded source note ${index + 1}: buyer feedback, official listing facts, community complaints, and advisory caveats should remain readable in the final PDF.`,
    ).join(" ");
    const { agent, report } = createReport({
      contentSections: [
        { title: "Market read", body: longBody },
        { title: "Community watchouts", body: longBody },
        { title: "Pricing signal", body: longBody },
      ],
      citations: Array.from({ length: 6 }, (_, index) => ({
        title: `Source ${index + 1}`,
        url: `https://example.com/source-${index + 1}`,
        snippet: "Balanced source coverage for official and community signals.",
        sourceType: index < 3 ? "official" : "community",
      })),
    });

    const pdfText = Buffer.from(generateReportPdf(report, agent)).toString("utf8");

    expect((pdfText.match(/\/Type \/Page \/Parent/g) ?? []).length).toBeGreaterThan(1);
    expect(pdfText).toContain("Community watchouts");
    expect(pdfText).toContain("Page 2");
  });

  it("renders client-facing advisory sections without internal workflow wording", () => {
    const { agent, report } = createReport({
      contentSections: [
        { title: "Executive Read", body: "Balanced market review for client-facing discussion." },
        { title: "Best-Fit Buyer Profile", body: "Likely suitable for city convenience buyers." },
        { title: "Watchouts and Buyer Questions", body: "Ask about noise, parking, and maintenance expectations." },
        { title: "Recommended Listing Narrative", body: "Use a client-safe narrative around convenience and source-backed caveats." },
      ],
    });
    const pdfText = Buffer.from(generateReportPdf(report, agent)).toString("utf8");

    expect(pdfText).toContain("Best-Fit Buyer Profile");
    expect(pdfText).toContain("Watchouts and Buyer Questions");
    expect(pdfText).toContain("Recommended Listing Narrative");
    expect(pdfText).not.toMatch(/cache|index|Tavily|live search/i);
  });

  it("renders directional current listing context", () => {
    const { agent, report } = createReport({
      comparableListings: [
        {
          title: "The Estate KL condo for sale",
          url: "https://example.com/listing",
          askingPriceRm: 1250000,
          builtUpSqft: 850,
          bedrooms: 2,
          bathrooms: 2,
          listingIntent: "sale",
        },
      ],
      citations: [
        {
          title: "The Estate KL condo for sale",
          url: "https://example.com/listing",
          snippet: "Current asking price RM 1,250,000 for 850 sqft.",
          sourceType: "comparable_listing",
        },
      ],
      contentSections: [
        {
          title: "Current Listing Context",
          body: "Current listing signals show RM 1,250,000 for 850 sqft. Treat this as directional asking context, not a valuation.",
        },
      ],
    });
    const pdfText = Buffer.from(generateReportPdf(report, agent)).toString("utf8");

    expect(pdfText).toContain("Current Listing Context");
    expect(pdfText).toContain("CURRENT LISTING");
    expect(pdfText).toContain("directional asking");
    expect(pdfText).toContain("context");
    expect(pdfText).not.toMatch(/Tavily|live search|cache|index/i);
  });
});
