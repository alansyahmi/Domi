export type Intent = 0 | 1;
export type Sentiment = "positive" | "neutral" | "negative";
export type ReportStatus = "ready" | "running" | "draft";
export type ReportCacheStatus = "hit" | "miss" | "refreshed" | "fallback";
export type ListingIntent = "sale" | "rent" | "auction" | "valuation";
export type PropertyTenure = "freehold" | "leasehold" | "unknown";
export type ReportIndexLookupStatus = "fresh_hit" | "stale_hit" | "miss";
export type ReportLiveSearchStatus = "not_needed" | "validated" | "limited" | "failed";
export type ReportCitationSourceType = "official" | "community" | "comparable_listing" | "transaction" | "neighborhood" | "model" | "other";

export type PreferredChannel = "whatsapp" | "telegram" | "messenger" | "instagram" | "email" | "phone";

export type LeadStage = "new" | "contacted" | "engaged" | "viewing" | "negotiating" | "closed_won" | "closed_lost";

export interface Agent {
  id: string;
  workosUserId: string;
  fullName: string;
  email: string;
  phone: string;
  plan: "Premium Agent" | "Starter Agent";
  avatarInitials: string;
  ingestionAddress: string;
  renNumber?: string;
  agencyName?: string;
  whatsappNumber?: string;
  avatarUrl?: string;
  companyLogoUrl?: string;
  bio?: string;
}

export interface Lead {
  id: string;
  agentId: string;
  name: string;
  email: string;
  phone: string;
  source: string;
  propertyInterest: string;
  budget: string;
  emailOpens: number;
  linkClicks: number;
  reportViews: number;
  inquirySentiment: number;
  sentiment: Sentiment;
  score: number;
  intent: Intent;
  tier: "Hot" | "Warm" | "Cold";
  stage: LeadStage;
  preferredChannel: PreferredChannel;
  lastContactedAt?: string;
  createdAt: string;
}

export interface LeadEvent {
  id: string;
  leadId: string;
  agentId: string;
  eventType: "email_open" | "link_click" | "report_view" | "manual_note" | "stage_change";
  eventLabel: string;
  occurredAt: string;
}

export interface PropertyReport {
  id: string;
  agentId: string;
  title: string;
  propertyName: string;
  propertyKey: string;
  address: string;
  propertyType: string;
  sqft: number;
  bedrooms: number;
  bathrooms: number;
  yearBuilt: number;
  status: ReportStatus;
  marketSignal: string;
  sentimentSummary: string;
  generatedAt: string;
  cacheStatus: ReportCacheStatus;
  shareToken: string;
  inputSnapshot: ReportInputSnapshot;
  indexLookup: ReportIndexLookup;
  analytics: ReportAnalytics;
  citations: ReportCitation[];
  comparableListings: ReportComparableListing[];
  contentSections: ReportContentSection[];
}

export interface Integration {
  id: string;
  agentId: string;
  name: string;
  description: string;
  status: "connected" | "available";
}

export interface SupportRequest {
  id: string;
  agentId: string;
  name: string;
  category: string;
  subject: string;
  message: string;
  createdAt: string;
}

export interface DashboardData {
  agent: Agent;
  totals: {
    leadsScored: number;
    averageIntentScore: number;
    reportsGenerated: number;
    highIntentLeads: number;
  };
  highIntentLeads: Lead[];
  recentReports: PropertyReport[];
}

export interface PropertyReportInput {
  propertyName?: string;
  address?: string;
  propertyType?: string;
  listingIntent?: ListingIntent;
  tenure?: PropertyTenure;
  askingPriceRm?: number;
  sqft?: number;
  bedrooms?: number;
  bathrooms?: number;
  yearBuilt?: number;
  sourceUrl?: string;
  sourceNotes?: string;
  bypassCache?: boolean;
}

export interface ReportInputSnapshot {
  propertyName: string;
  address: string;
  propertyType: string;
  listingIntent: ListingIntent;
  tenure: PropertyTenure;
  askingPriceRm: number;
  sqft: number;
  bedrooms: number;
  bathrooms: number;
  yearBuilt: number;
  sourceUrl?: string;
  sourceNotes?: string;
}

export interface ReportCitation {
  title: string;
  url: string;
  snippet?: string;
  retrievedAt?: string;
  sourceType?: ReportCitationSourceType;
}

export interface ReportComparableListing {
  title: string;
  sourceName?: string;
  url: string;
  askingPriceRm?: number;
  builtUpSqft?: number;
  bedrooms?: number;
  bathrooms?: number;
  listingIntent?: ListingIntent;
  snippet?: string;
  unitType?: string;
  maintenanceFeePsf?: number;
}

export interface ReportTransactedPrice {
  priceRm: number;
  transactedDate?: string;
  unitType?: string;
  builtUpSqft?: number;
  sourceName?: string;
  sourceUrl?: string;
  isAskingFallback?: boolean;
}

export interface ReportUnitTypeVariation {
  name: string;
  bedrooms?: number;
  bathrooms?: number;
  builtUpSqftMin?: number;
  builtUpSqftMax?: number;
  askingPriceRmMin?: number;
  askingPriceRmMax?: number;
  listingCount?: number;
}

export interface ReportDeveloperInfo {
  developerName: string;
  pastProjects?: string[];
  upcomingProjects?: string[];
  trackRecordSentiment?: Sentiment;
  lastRefreshedAt?: string;
}

export interface ReportInfrastructureProject {
  name: string;
  type: "mrt" | "lrt" | "highway" | "bus_rapid_transit" | "other";
  distanceKm?: number;
  completionYear?: number;
  status?: string;
  sourceUrl?: string;
}

export interface ReportAnalytics {
  sentiment: Sentiment;
  pricingTrend: string;
  confidenceScore: number;
  dataCompleteness: number;
  priceCertainty: number;
  freshnessDays: number;
  neighborhoodVibe?: {
    score: number;
    label: string;
    amenities: Array<{
      name: string;
      type: string;
      rating?: number;
      distance?: string;
    }>;
  };
  medianPrice?: number;
  medianPricePerSqft?: number;
  transactedPrices?: ReportTransactedPrice[];
  unitTypeVariations?: ReportUnitTypeVariation[];
  developerTrackRecord?: ReportDeveloperInfo;
  upcomingInfrastructure?: ReportInfrastructureProject[];
  averageMaintenanceFeePsf?: number;
  estimatedGrossYield?: number;
  averageRentalPrice?: number;
}

export interface ReportIndexLookup {
  propertyKey: string;
  status: ReportIndexLookupStatus;
  liveSearchStatus: ReportLiveSearchStatus;
  freshnessDays: number | null;
  citationsCount: number;
  summary: string;
  checkedAt: string;
}

export interface ReportContentSection {
  title: string;
  body: string;
}
