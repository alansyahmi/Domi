import type { PropertyReportInput, ReportStatus } from "../types";

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

export function validateReportInput(input: PropertyReportInput): ReportValidationResult {
  const errors: ReportValidationResult["errors"] = {};

  if (!input.address.trim()) {
    errors.address = "Property address is required.";
  }

  if (!input.propertyType.trim()) {
    errors.propertyType = "Property type is required.";
  }

  if (!Number.isFinite(input.sqft) || input.sqft <= 0) {
    errors.sqft = "Square footage must be greater than zero.";
  }

  if (!Number.isFinite(input.bedrooms) || input.bedrooms < 0) {
    errors.bedrooms = "Bedrooms cannot be negative.";
  }

  if (!Number.isFinite(input.bathrooms) || input.bathrooms < 0) {
    errors.bathrooms = "Bathrooms cannot be negative.";
  }

  if (!Number.isFinite(input.yearBuilt) || input.yearBuilt < 1800 || input.yearBuilt > CURRENT_YEAR + 1) {
    errors.yearBuilt = "Year built must be realistic.";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function buildReportDraft(input: PropertyReportInput): ReportDraft {
  const normalizedAddress = input.address.trim();
  const age = Math.max(0, CURRENT_YEAR - input.yearBuilt);
  const density = input.sqft / Math.max(1, input.bedrooms + input.bathrooms);
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
      input.propertyType.toLowerCase().includes("condo")
        ? "Urban convenience is the dominant buyer narrative."
        : "Neighborhood stability and family amenities lead buyer sentiment.",
  };
}
