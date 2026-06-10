import { describe, expect, it } from "vitest";
import { buildReportDraft, validateReportInput } from "./reports";

describe("property reports", () => {
  it("rejects missing address and invalid property metrics", () => {
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
      address: "Property address is required.",
      sqft: "Square footage must be greater than zero.",
      bedrooms: "Bedrooms cannot be negative.",
      yearBuilt: "Year built must be realistic.",
    });
  });

  it("builds a deterministic report draft for valid inputs", () => {
    const draft = buildReportDraft({
      address: "142 Oak St",
      propertyType: "Terrace House",
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
});
