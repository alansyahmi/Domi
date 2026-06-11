import { describe, expect, it } from "vitest";
import {
  buildReportDraft,
  buildReportPropertyKey,
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
});
