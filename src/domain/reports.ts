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

function primaryPropertyLabel(value: string): string {
  let primary = (value.split(",")[0] ?? value).trim();
  if (value.includes(",")) {
    const parts = primary.split(/\s+/);
    const lastPart = parts[parts.length - 1];
    if (parts.length > 2 && lastPart && /^[a-z]{2,3}$/i.test(lastPart)) {
      primary = parts.slice(0, -1).join(" ");
    }
  }
  return primary;
}

export function compactPropertyName(value: string): string {
  // Assuming primaryPropertyLabel handles extraction, convert to lowercase
  let text = primaryPropertyLabel(value).toLowerCase();

  text = text
    // 1. Structural Modifiers (Match plurals first to avoid truncation bugs)
    .replace(/\bcondominiums?\b|\bcondos?\b/g, "condo")
    .replace(/\bapartments?\b|\bapts?\b/g, "apt")
    .replace(/\bresidensi\b|\bresidences?\b/g, "res") // Handles both singular/plural/Malay
    .replace(/\bserviced\b/g, "serv")

    // 2. Local Spatial / Address Modifiers
    .replace(/\bjalan\b/g, "jln")
    .replace(/\bbukit\b/g, "bt")
    .replace(/\bkampung\b|\bkampong\b/g, "kg")
    .replace(/\btaman\b/g, "tmn")
    .replace(/\blorong\b/g, "lrg")
    .replace(/\bbandar\b/g, "bdr")
    .replace(/\bseksyen\b|\bsection\b/g, "sek")
    .replace(/\btanjung\b/g, "tg")
    .replace(/\bmenara\b/g, "mnr") // Added "Tower" shorthand

    // 3. Metric Modifiers
    .replace(/\bsquare\s*feet\b|\bsqft\b|\bsf\b/g, "sqft")
    .replace(/\bper\s*square\s*foot\b|\bpsf\b/g, "psf");

  // Strips everything except alphanumeric characters for clean DB/Routing slugs
  return text.replace(/[^a-z0-9]+/g, "");
}

export function propertyNameTokens(value: string): string[] {
  return primaryPropertyLabel(value)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3);
}

export function matchesPropertyName(propertyName: string, text: string, strict = false): boolean {
  const compact = compactPropertyName(propertyName);
  const haystack = compactPropertyName(text);
  if (compact.length < 3 || haystack.length === 0) return false;

  if (strict) {
    return haystack.includes(compact);
  }

  const tokens = propertyNameTokens(propertyName);
  if (tokens.length <= 1) {
    return haystack.includes(compact);
  }

  return tokens.every((token) => haystack.includes(token));
}

export function conflictsWithPropertyName(propertyName: string, text: string): boolean {
  const compact = compactPropertyName(propertyName);
  const haystack = compactPropertyName(text);
  const tokens = propertyNameTokens(propertyName);

  if (compact.length < 3 || tokens.length < 2) return false;
  if (haystack.includes(compact)) return false;

  const [prefix, ...suffixTokens] = tokens;
  if (!haystack.includes(prefix)) return false;

  return suffixTokens.some((token) => !haystack.includes(token));
}

export function hasTargetAskingPrice(input: { askingPriceRm?: number }): boolean {
  return (input.askingPriceRm ?? 0) > 0;
}

export type MarketPricingMode = "target_comparison" | "comparable_market";

export interface MarketPricingStats {
  mode: MarketPricingMode;
  averagePrice: number;
  averagePricePerSqft: number;
  medianPrice: number;
  medianPricePerSqft: number;
  priceDifferencePct: number;
  ppsDifferencePct: number;
  priceDifferenceRm: number;
  targetPricePerSqft: number;
  priceRangeMin: number;
  priceRangeMax: number;
  validPriceCount: number;
  validPpsCount: number;
  estimatedGrossYield?: number;
  averageRentalPrice?: number;
  averageMaintenanceFeePsf?: number;
}

function calculateMedian(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function calculateMarketPricingStats(report: {
  inputSnapshot: { askingPriceRm?: number; sqft?: number; listingIntent?: string };
  comparableListings?: Array<{ askingPriceRm?: number; builtUpSqft?: number; listingIntent?: string; maintenanceFeePsf?: number }>;
}): MarketPricingStats {
  const targetPrice = report.inputSnapshot.askingPriceRm ?? 0;
  const targetSqft = report.inputSnapshot.sqft ?? 0;
  const targetPps = targetPrice > 0 && targetSqft > 0 ? targetPrice / targetSqft : 0;
  const targetIntent = report.inputSnapshot.listingIntent || "sale";
  const compareToTarget = hasTargetAskingPrice(report.inputSnapshot);

  const comparables = report.comparableListings ?? [];

  const validPriceComps = comparables.filter(
    (c) =>
      c.askingPriceRm &&
      c.askingPriceRm > 0 &&
      (!c.listingIntent || c.listingIntent === targetIntent),
  );

  const prices = validPriceComps
    .map((c) => c.askingPriceRm)
    .filter((price): price is number => typeof price === "number" && Number.isFinite(price) && price > 0)
    .sort((left, right) => left - right);
  const totalPrices = prices.reduce((sum, price) => sum + price, 0);
  const averagePrice = prices.length > 0 ? totalPrices / prices.length : 0;

  const validPpsComps = validPriceComps.filter((c) => c.builtUpSqft && c.builtUpSqft > 0);
  const totalPps = validPpsComps.reduce(
    (sum, c) => sum + (c.askingPriceRm ?? 0) / (c.builtUpSqft ?? 1),
    0,
  );
  const averagePricePerSqft = validPpsComps.length > 0 ? totalPps / validPpsComps.length : 0;

  const medianPrice = calculateMedian(prices);
  const ppsValues = validPpsComps
    .map((c) => (c.askingPriceRm ?? 0) / (c.builtUpSqft ?? 1))
    .filter((v) => Number.isFinite(v) && v > 0)
    .sort((a, b) => a - b);
  const medianPricePerSqft = calculateMedian(ppsValues);

  const priceDifferenceRm = compareToTarget ? targetPrice - averagePrice : 0;
  const priceDifferencePct =
    compareToTarget && averagePrice > 0 ? ((targetPrice - averagePrice) / averagePrice) * 100 : 0;
  const ppsDifferencePct =
    compareToTarget && averagePricePerSqft > 0 && targetPps > 0
      ? ((targetPps - averagePricePerSqft) / averagePricePerSqft) * 100
      : 0;

  // Calculate rental stats if target is a sale property
  const rentalComps = comparables.filter(
    (c) => c.askingPriceRm && c.askingPriceRm > 0 && c.listingIntent === "rent"
  );
  const rentalPrices = rentalComps
    .map((c) => c.askingPriceRm)
    .filter((price): price is number => typeof price === "number" && price > 0);
  const averageRentalPrice = rentalPrices.length > 0
    ? rentalPrices.reduce((sum, price) => sum + price, 0) / rentalPrices.length
    : undefined;

  let estimatedGrossYield: number | undefined;
  if (targetIntent === "sale" && targetPrice > 0 && averageRentalPrice && averageRentalPrice > 0) {
    estimatedGrossYield = Number(((averageRentalPrice * 12 / targetPrice) * 100).toFixed(2));
  }

  // Compute maintenance fee average from comparables that have it
  const maintenanceFeeComps = comparables.filter(
    (c) => c.maintenanceFeePsf && c.maintenanceFeePsf > 0
  );
  const averageMaintenanceFeePsf = maintenanceFeeComps.length > 0
    ? Number((maintenanceFeeComps.reduce((sum, c) => sum + (c.maintenanceFeePsf ?? 0), 0) / maintenanceFeeComps.length).toFixed(2))
    : undefined;

  return {
    mode: compareToTarget ? "target_comparison" : "comparable_market",
    averagePrice,
    averagePricePerSqft,
    medianPrice,
    medianPricePerSqft,
    priceDifferencePct,
    ppsDifferencePct,
    priceDifferenceRm,
    targetPricePerSqft: targetPps,
    priceRangeMin: prices[0] ?? 0,
    priceRangeMax: prices.length > 0 ? prices[prices.length - 1] : 0,
    validPriceCount: validPriceComps.length,
    validPpsCount: validPpsComps.length,
    estimatedGrossYield,
    averageRentalPrice,
    averageMaintenanceFeePsf,
  };
}

