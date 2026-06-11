import { afterEach, describe, expect, it, vi } from "vitest";
import { createReportResearchProvider, createTavilyResearchProvider } from "./report-research";
import type { PropertyReportInput } from "../types";

const reportInput: PropertyReportInput = {
  propertyName: "The Estate KL",
  address: "Jalan Ampang, Kuala Lumpur",
  propertyType: "Condo",
  listingIntent: "sale",
  tenure: "freehold",
  askingPriceRm: 1250000,
};

describe("Tavily report research provider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("builds a Malaysia-focused Tavily request and maps citations", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        answer: "The Estate KL shows premium positioning near Jalan Ampang.",
        results: [
          {
            title: "The Estate KL listing",
            url: "https://example.com/the-estate-kl",
            content: "The Estate KL is a freehold condominium in Kuala Lumpur.",
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = createTavilyResearchProvider({
      REPORT_RESEARCH_PROVIDER: "tavily",
      TAVILY_API_KEY: "tvly-test",
      TAVILY_SEARCH_DEPTH: "basic",
      TAVILY_MAX_RESULTS: "5",
    });
    const result = await provider.research(reportInput);

    expect(fetchMock).toHaveBeenCalledWith("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer tvly-test",
      },
      body: expect.any(String),
    });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      query: expect.stringContaining("The Estate KL"),
      country: "malaysia",
      include_answer: true,
      max_results: 5,
      search_depth: "basic",
      topic: "general",
    });
    expect(result).toMatchObject({
      propertyName: "The Estate KL",
      summary: "The Estate KL shows premium positioning near Jalan Ampang.",
      pricingTrend: "Premium pricing resilience",
      sentiment: "positive",
      sources: [
        {
          title: "The Estate KL listing",
          url: "https://example.com/the-estate-kl",
          snippet: "The Estate KL is a freehold condominium in Kuala Lumpur.",
        },
      ],
    });
  });

  it("rejects Tavily responses without valid source citations", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        answer: "Uncited answer.",
        results: [{ title: "Broken", url: "not-a-url", content: "No useful source." }],
      }),
    }));

    const provider = createTavilyResearchProvider({
      REPORT_RESEARCH_PROVIDER: "tavily",
      TAVILY_API_KEY: "tvly-test",
    });

    await expect(provider.research(reportInput)).rejects.toThrow("Tavily search returned no valid citations.");
  });

  it("omits unknown optional fields from property-name-only Tavily queries", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        answer: "The Estate KL has searchable market information.",
        results: [
          {
            title: "The Estate KL",
            url: "https://example.com/the-estate-kl",
            content: "Property information for The Estate KL.",
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = createTavilyResearchProvider({
      REPORT_RESEARCH_PROVIDER: "tavily",
      TAVILY_API_KEY: "tvly-test",
    });
    await provider.research({ propertyName: "The Estate KL" });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.query).toContain("The Estate KL");
    expect(body.query).not.toContain("RM 0");
    expect(body.query).not.toContain("unknown");
    expect(body.query).not.toContain("Residential Property");
    expect(body.query).not.toContain("sale");
  });

  it("uses Tavily automatically when a Tavily API key is configured", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        answer: "The Estate KL has searchable market information.",
        results: [
          {
            title: "The Estate KL",
            url: "https://example.com/the-estate-kl",
            content: "Property information for The Estate KL.",
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = createReportResearchProvider({
      TAVILY_API_KEY: "tvly-test",
    });
    await provider.research({ propertyName: "The Estate KL" });

    expect(fetchMock).toHaveBeenCalled();
  });

  it("falls back to deterministic research when Tavily is selected without a key", async () => {
    const provider = createReportResearchProvider({
      REPORT_RESEARCH_PROVIDER: "tavily",
    });
    const result = await provider.research({ propertyName: "The Estate KL" });

    expect(result.sources[0]?.title).toBe("Signatis deterministic market model");
  });
});
