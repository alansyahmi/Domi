import { describe, expect, it } from "vitest";
import {
  buildReportDraft,
  buildReportPropertyKey,
  calculateMarketPricingStats,
  conflictsWithPropertyName,
  hasTargetAskingPrice,
  matchesPropertyName,
  normalizeReportInput,
  validateReportInput,
} from "./reports";

describe("property reports", () => {
  it("rejects missing property name and invalid optional property metrics", () => {
    const result = validateReportInput({
      address: " ",
      propertyType: "Condo",
      sqft: -50,
      bedrooms: -1,
      bathrooms: 2,
      yearBuilt: 3020,
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual({
      propertyName: "Property name is required.",
      sqft: "Square footage must be greater than zero.",
      bedrooms: "Bedrooms cannot be negative.",
      yearBuilt: "Year built must be realistic.",
    });
  });

  it("builds a deterministic report draft for valid inputs", () => {
    const draft = buildReportDraft({
      propertyName: "142 Oak St",
      address: "142 Oak St",
      propertyType: "Terrace House",
      listingIntent: "sale",
      tenure: "freehold",
      askingPriceRm: 850000,
      sqft: 2500,
      bedrooms: 4,
      bathrooms: 3,
      yearBuilt: 2018,
    });

    expect(draft.title).toBe("142 Oak St Analysis");
    expect(draft.status).toBe("ready");
    expect(draft.sections).toEqual([
      "Comparable market analysis",
      "Pricing signal summary",
      "Neighborhood sentiment",
    ]);
  });

  it("requires only property name", () => {
    const result = validateReportInput({});

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual({
      propertyName: "Property name is required.",
    });
  });

  it("accepts property-name-only requests", () => {
    const result = validateReportInput({
      propertyName: "The Estate KL",
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it("rejects invalid asking price and source URL", () => {
    const result = validateReportInput({
      propertyName: "The Estate KL",
      address: "Jalan Ampang, Kuala Lumpur",
      propertyType: "Condo",
      listingIntent: "sale",
      tenure: "freehold",
      askingPriceRm: 0,
      sourceUrl: "not a url",
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toMatchObject({
      askingPriceRm: "Asking price must be greater than zero.",
      sourceUrl: "Source URL must be a valid URL.",
    });
  });

  it("normalizes expanded input into report-ready snapshots", () => {
    const normalized = normalizeReportInput({
      propertyName: " The Estate KL ",
      address: " Jalan Ampang, Kuala Lumpur ",
      propertyType: " Condo ",
      listingIntent: "sale",
      tenure: "freehold",
      askingPriceRm: 1250000,
      sourceUrl: " https://example.com/listing ",
      sourceNotes: " Near LRT and KLCC ",
    });

    expect(normalized).toMatchObject({
      propertyName: "The Estate KL",
      address: "Jalan Ampang, Kuala Lumpur",
      propertyType: "Condo",
      listingIntent: "sale",
      tenure: "freehold",
      askingPriceRm: 1250000,
      sourceUrl: "https://example.com/listing",
      sourceNotes: "Near LRT and KLCC",
      sqft: 0,
      bedrooms: 0,
      bathrooms: 0,
    });
  });

  it("creates stable property keys for equivalent names and addresses", () => {
    expect(
      buildReportPropertyKey({
        propertyName: "The Estate, KL",
        address: "Jalan Ampang",
        propertyType: "Condo",
        listingIntent: "sale",
        tenure: "freehold",
        askingPriceRm: 1250000,
      }),
    ).toBe(
      buildReportPropertyKey({
        propertyName: "the estate kl",
        address: "Jalan Ampang",
        propertyType: "Condo",
        listingIntent: "sale",
        tenure: "freehold",
        askingPriceRm: 1250000,
      }),
    );
  });

  it("calculates market pricing stats correctly", () => {
    const stats = calculateMarketPricingStats({
      inputSnapshot: {
        askingPriceRm: 1000000,
        sqft: 1000,
        listingIntent: "sale",
      },
      comparableListings: [
        { askingPriceRm: 900000, builtUpSqft: 900, listingIntent: "sale" },
        { askingPriceRm: 1100000, builtUpSqft: 1100, listingIntent: "sale" },
        { askingPriceRm: 3000, builtUpSqft: 1000, listingIntent: "rent" },
      ],
    });

    expect(stats.averagePrice).toBe(1000000); // (900k + 1.1M) / 2
    expect(stats.averagePricePerSqft).toBe(1000); // 900000/900 = 1000, 1100000/1100 = 1000 -> average 1000
    expect(stats.targetPricePerSqft).toBe(1000);
    expect(stats.priceDifferencePct).toBe(0);
    expect(stats.ppsDifferencePct).toBe(0);
    expect(stats.validPriceCount).toBe(2);
    expect(stats.validPpsCount).toBe(2);
    expect(stats.mode).toBe("target_comparison");
    expect(stats.averageRentalPrice).toBe(3000);
    expect(stats.estimatedGrossYield).toBe(3.6); // (3000 * 12 / 1000000) * 100
  });

  it("uses comparable market mode when asking price is missing", () => {
    const stats = calculateMarketPricingStats({
      inputSnapshot: {
        askingPriceRm: 0,
        listingIntent: "sale",
      },
      comparableListings: [
        { askingPriceRm: 450000, builtUpSqft: 900, listingIntent: "sale" },
        { askingPriceRm: 603000, builtUpSqft: 973, listingIntent: "sale" },
      ],
    });

    expect(stats.mode).toBe("comparable_market");
    expect(stats.averagePrice).toBe(526500);
    expect(stats.priceRangeMin).toBe(450000);
    expect(stats.priceRangeMax).toBe(603000);
    expect(stats.priceDifferencePct).toBe(0);
    expect(hasTargetAskingPrice({ askingPriceRm: 0 })).toBe(false);
  });

  it("matches property names strictly enough to avoid sibling developments", () => {
    expect(matchesPropertyName("Likas Vue", "LikasVue serviced residence for sale", true)).toBe(true);
    expect(matchesPropertyName("Likas Vue", "FOR SALE Likas Square Apartment", true)).toBe(false);
    expect(conflictsWithPropertyName("Likas Vue", "Likas Square apartment in Likas")).toBe(true);
  });

  it("matches abbreviated Malaysian place names in non-strict mode", () => {
    expect(matchesPropertyName("Taman Rimbunan Hijau", "Tmn Rimbunan Hijau condo for sale")).toBe(true);
    expect(matchesPropertyName("Taman Rimbunan Hijau", "Rimbunan Hijau residence in Kepong")).toBe(true);
    expect(matchesPropertyName("Taman Rimbunan Hijau", "Taman Seri Hijau condo")).toBe(false);
  });
});
