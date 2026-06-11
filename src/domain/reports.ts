import type { ListingIntent, PropertyReportInput, PropertyTenure, ReportInputSnapshot, ReportStatus } from "../types";

export interface ReportValidationResult {
  valid: boolean;
  errors: Partial<Record<keyof PropertyReportInput, string>>;
}

export interface ReportDraft {
  title: string;
  status: ReportStatus;
  sections: string[];
  marketSignal: string;
  sentimentSummary: string;
}

const CURRENT_YEAR = new Date().getFullYear();
const LISTING_INTENTS: ListingIntent[] = ["sale", "rent", "auction", "valuation"];
const PROPERTY_TENURES: PropertyTenure[] = ["freehold", "leasehold", "unknown"];

function isListingIntent(value: unknown): value is ListingIntent {
  return typeof value === "string" && LISTING_INTENTS.includes(value as ListingIntent);
}

function isPropertyTenure(value: unknown): value is PropertyTenure {
  return typeof value === "string" && PROPERTY_TENURES.includes(value as PropertyTenure);
}

function isValidUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function validateReportInput(input: PropertyReportInput): ReportValidationResult {
  const errors: ReportValidationResult["errors"] = {};
  const propertyName = input.propertyName?.trim() ?? "";

  if (!propertyName) {
    errors.propertyName = "Property name is required.";
  }

  if (input.listingIntent !== undefined && !isListingIntent(input.listingIntent)) {
    errors.listingIntent = "Listing intent is invalid.";
  }

  if (input.tenure !== undefined && !isPropertyTenure(input.tenure)) {
    errors.tenure = "Tenure is invalid.";
  }

  if (input.askingPriceRm !== undefined && (!Number.isFinite(input.askingPriceRm) || input.askingPriceRm <= 0)) {
    errors.askingPriceRm = "Asking price must be greater than zero.";
  }

  if (input.sqft !== undefined && (!Number.isFinite(input.sqft) || input.sqft <= 0)) {
    errors.sqft = "Square footage must be greater than zero.";
  }

  if (input.bedrooms !== undefined && (!Number.isFinite(input.bedrooms) || input.bedrooms < 0)) {
    errors.bedrooms = "Bedrooms cannot be negative.";
  }

  if (input.bathrooms !== undefined && (!Number.isFinite(input.bathrooms) || input.bathrooms < 0)) {
    errors.bathrooms = "Bathrooms cannot be negative.";
  }

  if (
    input.yearBuilt !== undefined &&
    (!Number.isFinite(input.yearBuilt) || input.yearBuilt < 1800 || input.yearBuilt > CURRENT_YEAR + 1)
  ) {
    errors.yearBuilt = "Year built must be realistic.";
  }

  if (input.sourceUrl?.trim() && !isValidUrl(input.sourceUrl.trim())) {
    errors.sourceUrl = "Source URL must be a valid URL.";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

function normalizeTextKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalizeReportInput(input: PropertyReportInput): ReportInputSnapshot {
  const propertyName = input.propertyName?.trim() || input.address?.trim() || "Unnamed Property";
  const address = input.address?.trim() || propertyName;

  return {
    propertyName,
    address,
    propertyType: input.propertyType?.trim() || "Residential Property",
    listingIntent: isListingIntent(input.listingIntent) ? input.listingIntent : "sale",
    tenure: isPropertyTenure(input.tenure) ? input.tenure : "unknown",
    askingPriceRm: input.askingPriceRm ?? 0,
    sqft: input.sqft ?? 0,
    bedrooms: input.bedrooms ?? 0,
    bathrooms: input.bathrooms ?? 0,
    yearBuilt: input.yearBuilt ?? CURRENT_YEAR,
    sourceUrl: input.sourceUrl?.trim() || undefined,
    sourceNotes: input.sourceNotes?.trim() || undefined,
  };
}

export function buildReportPropertyKey(input: PropertyReportInput): string {
  const normalized = normalizeReportInput(input);
  return normalizeTextKey(normalized.propertyName || normalized.address) || "unnamed-property";
}

export function buildReportDraft(input: PropertyReportInput): ReportDraft {
  const normalized = normalizeReportInput(input);
  const normalizedAddress = normalized.address;
  const age = Math.max(0, CURRENT_YEAR - normalized.yearBuilt);
  const density = normalized.sqft > 0 ? normalized.sqft / Math.max(1, normalized.bedrooms + normalized.bathrooms) : 0;
  const marketSignal =
    density >= 350 && age <= 20
      ? "Premium resale signal"
      : density >= 250
        ? "Balanced market signal"
        : "Value-sensitive market signal";

  return {
    title: `${normalizedAddress} Analysis`,
    status: "ready",
    sections: [
      "Comparable market analysis",
      "Pricing signal summary",
      "Neighborhood sentiment",
    ],
    marketSignal,
    sentimentSummary:
      normalized.propertyType.toLowerCase().includes("condo")
        ? "Urban convenience is the dominant buyer narrative."
        : "Neighborhood stability and family amenities lead buyer sentiment.",
  };
}
