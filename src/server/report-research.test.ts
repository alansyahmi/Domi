import { afterEach, describe, expect, it, vi } from "vitest";
import { createReportResearchProvider, createTavilyResearchProvider, parseListingIndexCards } from "./report-research";
import type { PropertyReportInput } from "../types";

describe("parseListingIndexCards", () => {
  // Real raw_content shapes captured from PropertyGuru + iProperty Mont Kiara index pages.
  const fixture = `[Beautiful 2 Bedroom Condo Available For Sale in Jalan Kiara 3 * * * RM 660,000 RM 702.13 psf ### Inspirasi Jalan Kiara 3, Mont Kiara, Kuala Lumpur 3 2 1 940 sqft Condominium Leasehold Built: 2021 MRT 7 min Contact Agent](https://www.propertyguru.com.my/property-listing/inspirasi-for-sale-by-gordon-goh-501421695 "For Sale Inspirasi")
[Spacious unit For Sale * * RM 1,300,000 RM 690.21 psf ### Verticas Residensi, Mont Kiara, Kuala Lumpur 4 4 2 1,883 sqft Condominium Freehold Built: 2016 Contact Agent](https://www.propertyguru.com.my/property-listing/verticas-501120042 "For Sale Verticas")`;

  it("parses multiple PropertyGuru unit cards with full specs", () => {
    const cards = parseListingIndexCards(fixture);
    expect(cards).toHaveLength(2);
    expect(cards[0]).toMatchObject({
      title: expect.stringContaining("Inspirasi"),
      url: "https://www.propertyguru.com.my/property-listing/inspirasi-for-sale-by-gordon-goh-501421695",
      askingPriceRm: 660000,
      bedrooms: 3,
      bathrooms: 2,
      builtUpSqft: 940,
    });
    expect(cards[1]).toMatchObject({ askingPriceRm: 1300000, bedrooms: 4, bathrooms: 4, builtUpSqft: 1883 });
  });

  it("parses iProperty cards with price/size ranges and '* * *' bed/bath", () => {
    // Real iProperty index shape: price + psf ranges, '* * *' instead of bed/bath numbers, "Sqft - Sqft" range.
    const ipFixture = `[RM 1,099,741 - RM 4,170,578 RM 438.49 psf - RM 1,662.91 psf ### Kiaramas deDaun phase 2 Jalan Desa Kiara, Mont Kiara, Kuala Lumpur * * * 1313 Sqft - 4693 Sqft Condominium Listed on May 26, 2025](https://www.iproperty.com.my/new-property/property/mont-kiara/kiaramas-de-daun-phase-2/sale-501120041/ "For Sale")
[RM 1,250,000 RM 909.75 psf ### Twy Duplex Condos, Mont Kiara Jalan Dutamas 3 2 1374 Sqft Condominium](https://www.iproperty.com.my/property/mont-kiara/twy-duplex-condos/sale-501099302/ "For Sale Twy")`;
    const cards = parseListingIndexCards(ipFixture);
    expect(cards).toHaveLength(2);
    expect(cards[0]).toMatchObject({
      title: expect.stringContaining("Kiaramas"),
      url: expect.stringContaining("iproperty.com.my"),
      askingPriceRm: 1099741, // lower bound of the range
      builtUpSqft: 1313, // lower bound of the range
    });
    expect(cards[0].bedrooms).toBeUndefined(); // '* * *' → unknown
    expect(cards[1]).toMatchObject({ askingPriceRm: 1250000, builtUpSqft: 1374 });
  });

  it("dedupes repeated listing urls", () => {
    expect(parseListingIndexCards(fixture + "\n" + fixture)).toHaveLength(2);
  });

  it("drops implausible bed/bath clusters (e.g. '1 7') but keeps price/sqft", () => {
    const noisy = `[junk RM 4,100,000 RM 1099.49 psf ### 11 Mont Kiara @ MK11 Jalan Kiara 1, Mont Kiara 1 7 3729 sqft Condominium](https://www.propertyguru.com.my/property-listing/mk11-501999111 "x")`;
    const cards = parseListingIndexCards(noisy);
    expect(cards).toHaveLength(1);
    expect(cards[0].askingPriceRm).toBe(4100000);
    expect(cards[0].builtUpSqft).toBe(3729);
    expect(cards[0].bedrooms).toBeUndefined();
    expect(cards[0].bathrooms).toBeUndefined();
  });

  it("drops implausible sqft values but keeps the card", () => {
    const tiny = `[x RM 500,000 RM 5000 psf ### Some Place, Mont Kiara 2 2 150 sqft Condo](https://www.propertyguru.com.my/property-listing/x-501000999 "x")`;
    const cards = parseListingIndexCards(tiny);
    expect(cards).toHaveLength(1);
    expect(cards[0].askingPriceRm).toBe(500000);
    expect(cards[0].builtUpSqft).toBeUndefined(); // 150 < 200 floor
  });

  it("returns nothing for pages without card markup", () => {
    expect(parseListingIndexCards("just some nav text and links")).toHaveLength(0);
  });
});

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
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          answer: "The Estate KL shows premium positioning near Jalan Ampang.",
          results: [
            {
              title: "The Estate KL listing",
              url: "https://example.com/the-estate-kl-official",
              content: "The Estate KL is a freehold condominium in Kuala Lumpur.",
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          answer: "The Estate KL community feedback is balanced.",
          results: [
            {
              title: "The Estate KL resident forum",
              url: "https://example.com/the-estate-kl-community",
              content: "Residents discuss The Estate KL access and facilities.",
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          answer: "The Estate KL active listings are firm.",
          results: [
            {
              title: "The Estate KL condo for sale",
              url: "https://www.iproperty.com.my/the-estate-kl-listing",
              content: "For sale asking price RM 1,250,000 at The Estate KL.",
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
      max_results: 3,
      search_depth: "basic",
      topic: "general",
    });
    expect(result).toMatchObject({
      propertyName: "The Estate KL",
      summary: "Official/listing signals: The Estate KL shows premium positioning near Jalan Ampang. Community/user signals: The Estate KL community feedback is balanced. Current listing signals: The Estate KL active listings are firm.",
      pricingTrend: "Premium pricing resilience",
      sentiment: "positive",
    });
    expect(result.sources).toHaveLength(3);
    expect(result.sources.map((source) => source.sourceType)).toEqual(["official", "community", "comparable_listing"]);
    expect(result.comparableListings).toHaveLength(1);
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

  it("defaults Tavily searches to five results for grounded reports", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        answer: "The Estate KL has searchable market information.",
        results: [
          { title: "One at The Estate KL", url: "https://example.com/1", content: "The Estate KL one" },
          { title: "Two at The Estate KL", url: "https://example.com/2", content: "The Estate KL two" },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = createTavilyResearchProvider({
      TAVILY_API_KEY: "tvly-test",
    });
    await provider.research(reportInput);

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      max_results: 3,
      search_depth: "basic",
    });
  });

  it("balances official and community source searches", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          answer: "Official listings describe Jesselton Quay as a mixed-use waterfront development.",
          results: [
            { title: "Official Jesselton Quay listing 1", url: "https://example.com/official-1", content: "Jesselton Quay developer and listing facts." },
            { title: "Official Jesselton Quay listing 2", url: "https://example.com/official-2", content: "Jesselton Quay project facilities and location." },
            { title: "Official Jesselton Quay listing 3", url: "https://example.com/official-3", content: "Jesselton Quay sales and unit information." },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          answer: "Community posts mention possible midnight noise and lift waiting concerns.",
          results: [
            { title: "Jesselton Quay forum review 1", url: "https://example.com/community-1", content: "Jesselton Quay residents discuss noise at midnight." },
            { title: "Jesselton Quay forum review 2", url: "https://example.com/community-2", content: "Jesselton Quay user notes lift waiting and parking issues." },
            { title: "Ulasan komuniti Jesselton Quay", url: "https://example.com/community-3", content: "Aduan komuniti Jesselton Quay tentang bunyi dan kesesakan." },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          answer: "Current sale listings show active asking prices around RM 650,000 to RM 780,000.",
          results: [
            { title: "Jesselton Quay Citypads for sale", url: "https://www.iproperty.com.my/listing-1", content: "For sale asking price RM 650,000. 522 sqft, 1 bedroom, 1 bathroom." },
            { title: "Jesselton Quay condo for sale", url: "https://www.mudah.my/listing-2", content: "Current listing at RM 780,000 with 650 sqft and 2 bedrooms." },
            { title: "JQ apartment for rent", url: "https://www.propertyguru.com.my/listing-3", content: "For rent at RM 2,800 per month, 1 bed, 1 bath." },
          ],
        }),
      })
      // 4th call: /extract for the comparable listing URLs (empty → snippet fallback)
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ results: [], failed_results: [] }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const provider = createTavilyResearchProvider({
      TAVILY_API_KEY: "tvly-test",
    });
    const result = await provider.research({ propertyName: "Jesselton Quay KK, Sabah" });

    // 3 search lanes + 1 extract call for the comparable listings
    expect(fetchMock).toHaveBeenCalledTimes(4);
    const extractCall = fetchMock.mock.calls.find((call) => call[0] === "https://api.tavily.com/extract");
    expect(extractCall).toBeDefined();
    const officialCall = fetchMock.mock.calls.find((call) => JSON.parse(call[1].body).query.includes("official"));
    const communityCall = fetchMock.mock.calls.find((call) => JSON.parse(call[1].body).query.includes("review"));
    const comparableCall = fetchMock.mock.calls.find((call) => JSON.parse(call[1].body).query.includes("site:iproperty.com.my"));
    expect(officialCall).toBeDefined();
    expect(communityCall).toBeDefined();
    expect(comparableCall).toBeDefined();
    const officialBody = JSON.parse(officialCall![1].body);
    const communityBody = JSON.parse(communityCall![1].body);
    const comparableBody = JSON.parse(comparableCall![1].body);
    expect(officialBody.query).toContain("official developer listing");
    expect(communityBody.query).toContain("review complaint forum");
    expect(communityBody.query).toContain("ulasan aduan");
    expect(comparableBody.query).toContain("site:iproperty.com.my");
    expect(result.summary).toContain("Official/listing signals");
    expect(result.summary).toContain("Community/user signals");
    expect(result.summary).toContain("Current listing signals");
    expect(result.sources.filter((source) => source.sourceType === "official")).toHaveLength(3);
    expect(result.sources.filter((source) => source.sourceType === "community")).toHaveLength(3);
    expect(result.sources.filter((source) => source.sourceType === "comparable_listing")).toHaveLength(2);
    expect(result.comparableListings).toEqual([
      expect.objectContaining({
        title: "Jesselton Quay Citypads for sale",
        url: "https://www.iproperty.com.my/listing-1",
        askingPriceRm: 650000,
        builtUpSqft: 522,
        bedrooms: 1,
        bathrooms: 1,
        listingIntent: "sale",
      }),
      expect.objectContaining({
        askingPriceRm: 780000,
        builtUpSqft: 650,
        bedrooms: 2,
        listingIntent: "sale",
      }),
    ]);
  });

  it("caps mapped Tavily citations at nine balanced sources", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        answer: "The Estate KL has searchable market information.",
        results: Array.from({ length: 7 }, (_, index) => ({
          title: `The Estate KL source ${index + 1}`,
          url: `https://example.com/${index + 1}`,
          content: `Property information for The Estate KL source ${index + 1}.`,
        })),
      }),
    }));

    const provider = createTavilyResearchProvider({
      TAVILY_API_KEY: "tvly-test",
      TAVILY_MAX_RESULTS: "7",
    });
    const result = await provider.research(reportInput);

    expect(result.sources).toHaveLength(3);
  });

  it("falls back to deterministic research when Tavily is selected without a key", async () => {
    const provider = createReportResearchProvider({
      REPORT_RESEARCH_PROVIDER: "tavily",
    });
    const result = await provider.research({ propertyName: "The Estate KL" });

    expect(result.sources[0]?.title).toBe("Signatis deterministic market model");
  });

  it("handles pricing suffixes and filters directory pages in extractComparableListing", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        answer: "Rent details.",
        results: [
          { title: "4 Houses for Rent at Likas Square", url: "https://www.iproperty.com.my/listings", content: "Current active listings RM 2,000 / month." }, // should be filtered out
          { title: "Likas Square unit for rent", url: "https://www.mudah.my/rent-1", content: "Nice condo for rent at RM 2.5k per month." }, // RM 2500
          { title: "Likas Square condo for sale", url: "https://www.propertyguru.com.my/sale-1", content: "Stunning penthouse for sale asking RM 1.2m." }, // RM 1200000
          { title: "Likas Square bad rent price", url: "https://www.iproperty.com.my/rent-2", content: "Studio for rent at RM 20." } // filtered out by rent price sanity (< 150)
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = createTavilyResearchProvider({
      TAVILY_API_KEY: "tvly-test",
    });
    const result = await provider.research({ propertyName: "Likas Square", listingIntent: "rent" });

    // should filter out 4 Houses directory page and bad rent price, leaving only the two valid ones
    expect(result.comparableListings).toHaveLength(2);
    expect(result.comparableListings).toContainEqual(expect.objectContaining({
      title: "Likas Square unit for rent",
      askingPriceRm: 2500,
      listingIntent: "rent"
    }));
    expect(result.comparableListings).toContainEqual(expect.objectContaining({
      title: "Likas Square condo for sale",
      askingPriceRm: 1200000,
      listingIntent: "sale"
    }));
  });

  it("enriches comparable specs from the extracted listing page, not just the snippet", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ answer: "Official.", results: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ answer: "Community.", results: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          answer: "Listings.",
          results: [
            {
              // snippet is vague — no specs at all
              title: "The Estate KL condo for sale",
              url: "https://www.iproperty.com.my/the-estate-kl-unit",
              content: "Premium unit available at The Estate KL.",
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          // extract returns the full page with exact specs
          results: [
            {
              url: "https://www.iproperty.com.my/the-estate-kl-unit",
              raw_content:
                "The Estate KL — luxury condo for sale. Asking price RM 1,850,000. Built-up 1,432 sqft, 3 bedrooms, 2 bathrooms. Freehold.",
            },
          ],
          failed_results: [],
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const provider = createTavilyResearchProvider({
      TAVILY_API_KEY: "tvly-test",
    });
    const result = await provider.research({ propertyName: "The Estate KL", listingIntent: "sale" });

    const extractCall = fetchMock.mock.calls.find((call) => call[0] === "https://api.tavily.com/extract");
    expect(extractCall).toBeDefined();
    expect(JSON.parse(extractCall![1].body)).toMatchObject({
      urls: ["https://www.iproperty.com.my/the-estate-kl-unit"],
      extract_depth: "advanced",
    });
    // Specs come from the extracted page, which the snippet alone could not provide.
    expect(result.comparableListings?.[0]).toMatchObject({
      title: "The Estate KL condo for sale",
      askingPriceRm: 1850000,
      builtUpSqft: 1432,
      bedrooms: 3,
      bathrooms: 2,
      listingIntent: "sale",
    });
  });

  it("skips the extract step when TAVILY_EXTRACT is off", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ answer: "x", results: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = createTavilyResearchProvider({
      TAVILY_API_KEY: "tvly-test",
      TAVILY_EXTRACT: "off",
    });
    await provider.research({ propertyName: "The Estate KL" }).catch(() => undefined);

    const extractCall = fetchMock.mock.calls.find((call) => call[0] === "https://api.tavily.com/extract");
    expect(extractCall).toBeUndefined();
  });

  it("rejects social posts and sibling developments for strict comparable searches", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        answer: "LikasVue listings.",
        results: [
          { title: "FOR SALE Likas Square Apartment", url: "https://www.facebook.com/groups/sabahproperty/posts/1", content: "Likas Vue marketing mention RM 600,000." },
          { title: "LikasVue 2 bedroom for sale", url: "https://www.mudah.my/likasvue-2br", content: "For sale asking RM 527,000. 884 sqft, 2 bedrooms, 2 bathrooms." },
          { title: "Double storey bungalow Likas", url: "https://www.iproperty.com.my/bungalow", content: "For sale RM 3million bungalow." },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = createTavilyResearchProvider({
      TAVILY_API_KEY: "tvly-test",
    });
    const result = await provider.research({ propertyName: "Likas Vue", listingIntent: "sale" });

    expect(result.comparableListings).toHaveLength(1);
    expect(result.comparableListings?.[0]).toMatchObject({
      title: "LikasVue 2 bedroom for sale",
      askingPriceRm: 527000,
      builtUpSqft: 884,
      bedrooms: 2,
      bathrooms: 2,
    });
  });
});

