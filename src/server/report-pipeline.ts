import { randomBytes } from "node:crypto";
import {
  buildReportDraft,
  buildReportPropertyKey,
  normalizeReportInput,
  validateReportInput,
} from "../domain/reports";
import type {
  Agent,
  PropertyReport,
  PropertyReportInput,
  ReportAnalytics,
  ReportCacheStatus,
  ReportCitation,
  ReportContentSection,
  ReportIndexLookup,
  Sentiment,
} from "../types";
import type { SignatisDbClient } from "./db";
import {
  getPropertyIntelligenceCache,
  savePropertyIntelligence,
  savePropertyReport,
} from "./db";
import {
  createFallbackResearch,
  createReportResearchProvider,
  type ReportResearchProvider,
  type ReportResearchResult,
} from "./report-research";
import { getRuntimeEnv } from "./runtime-env";

const CACHE_FRESHNESS_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

interface GenerateOptions {
  provider?: ReportResearchProvider;
  now?: Date;
}

function createId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${randomBytes(8).toString("base64url")}`;
}

function clampConfidence(value: number): number {
  return Math.max(0, Math.min(1, Number(value.toFixed(2))));
}

function formatRm(value: number): string {
  if (value <= 0) return "asking price to be confirmed";
  return `RM ${value.toLocaleString("en-MY", { maximumFractionDigits: 0 })}`;
}

function daysSince(date: string, now: Date): number {
  const timestamp = new Date(date).getTime();
  if (!Number.isFinite(timestamp)) return CACHE_FRESHNESS_DAYS + 1;
  return Math.max(0, Math.floor((now.getTime() - timestamp) / DAY_MS));
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function sanitizeCitations(citations: ReportCitation[]): ReportCitation[] {
  return citations
    .filter((citation) => citation.title?.trim() && citation.url?.trim() && isHttpUrl(citation.url.trim()))
    .map((citation) => ({
      title: citation.title.trim(),
      url: citation.url.trim(),
      snippet: citation.snippet?.trim(),
      retrievedAt: citation.retrievedAt,
    }))
    .slice(0, 8);
}

function validatedResearch(research: ReportResearchResult): ReportResearchResult | null {
  const summary = research.summary.trim();
  const citations = sanitizeCitations(research.sources);
  if (!summary || citations.length === 0) return null;

  return {
    propertyName: research.propertyName.trim(),
    summary,
    pricingTrend: research.pricingTrend.trim() || "Balanced pricing discovery",
    sentiment: research.sentiment,
    sources: citations,
  };
}

function researchFromCache(cache: Awaited<ReturnType<typeof getPropertyIntelligenceCache>>): ReportResearchResult | null {
  if (!cache) return null;
  const candidate: ReportResearchResult = {
    propertyName: cache.propertyName,
    summary: String(cache.payload.summary ?? ""),
    pricingTrend: String(cache.payload.pricingTrend ?? "Balanced pricing discovery"),
    sentiment: (cache.payload.sentiment as Sentiment) ?? "neutral",
    sources: cache.citations,
  };
  return validatedResearch(candidate);
}

function createIndexLookup(
  propertyKey: string,
  status: ReportIndexLookup["status"],
  liveSearchStatus: ReportIndexLookup["liveSearchStatus"],
  freshnessDays: number | null,
  citationsCount: number,
  summary: string,
  checkedAt: string,
): ReportIndexLookup {
  return {
    propertyKey,
    status,
    liveSearchStatus,
    freshnessDays,
    citationsCount,
    summary,
    checkedAt,
  };
}

function buildAnalytics(research: ReportResearchResult, cacheStatus: ReportCacheStatus, freshnessDays: number): ReportAnalytics {
  const sourceWeight = Math.min(0.18, research.sources.length * 0.04);
  const cacheWeight = cacheStatus === "fallback" ? -0.24 : cacheStatus === "hit" ? 0.08 : 0;
  return {
    sentiment: research.sentiment,
    pricingTrend: research.pricingTrend,
    confidenceScore: clampConfidence(0.68 + sourceWeight + cacheWeight - Math.min(0.12, freshnessDays * 0.01)),
    freshnessDays,
  };
}

function buildContentSections(
  research: ReportResearchResult,
  analytics: ReportAnalytics,
  input: ReturnType<typeof normalizeReportInput>,
): ReportContentSection[] {
  const intentLabel = input.askingPriceRm <= 0 && input.tenure === "unknown" ? "market review" : input.listingIntent === "sale" ? "sale" : input.listingIntent;
  const tenureText = input.tenure === "unknown" ? "" : ` with ${input.tenure} tenure`;
  const priceText = input.askingPriceRm > 0 ? ` and an asking price of ${formatRm(input.askingPriceRm)}` : ", with asking price to be confirmed";
  const sourceNote = input.sourceNotes ? ` Agent notes add: ${input.sourceNotes}` : "";
  return [
    {
      title: "Market read",
      body: `${research.summary} The listing is positioned for ${intentLabel}${tenureText}${priceText}.${sourceNote}`,
    },
    {
      title: "Pricing signal",
      body: `${analytics.pricingTrend}. The current asking price is ${formatRm(input.askingPriceRm)} for a ${input.propertyType.toLowerCase()} in ${input.address}. Confidence is ${Math.round(analytics.confidenceScore * 100)}% based on available property intelligence and citation coverage.`,
    },
    {
      title: "Buyer sentiment",
      body: `Current buyer narrative is ${analytics.sentiment}, with positioning shaped by comparable supply, location quality, ${input.tenure} tenure, and the agent's branded advisory context.`,
    },
  ];
}

function sentimentSummary(sentiment: Sentiment): string {
  if (sentiment === "positive") return "Buyer sentiment is positive with strong positioning potential.";
  if (sentiment === "negative") return "Buyer sentiment shows caution and needs value-led positioning.";
  return "Buyer sentiment is neutral with room for targeted positioning.";
}

export async function generatePropertyReport(
  db: SignatisDbClient,
  agent: Agent,
  input: PropertyReportInput,
  options: GenerateOptions = {},
): Promise<PropertyReport> {
  const validation = validateReportInput(input);
  if (!validation.valid) {
    throw new Error("Invalid report input.");
  }

  const now = options.now ?? new Date();
  const normalized = normalizeReportInput(input);
  const propertyKey = buildReportPropertyKey(input);
  const cached = await getPropertyIntelligenceCache(db, propertyKey);
  const cachedFreshnessDays = cached ? daysSince(cached.refreshedAt, now) : CACHE_FRESHNESS_DAYS + 1;
  const cachedResearch = researchFromCache(cached);
  const provider = options.provider ?? createReportResearchProvider(getRuntimeEnv());

  let cacheStatus: ReportCacheStatus;
  let research: ReportResearchResult;
  let indexLookup: ReportIndexLookup;

  if (cachedResearch && cachedFreshnessDays <= CACHE_FRESHNESS_DAYS) {
    cacheStatus = "hit";
    research = cachedResearch;
    indexLookup = createIndexLookup(
      propertyKey,
      "fresh_hit",
      "not_needed",
      cachedFreshnessDays,
      research.sources.length,
      research.summary,
      now.toISOString(),
    );
  } else {
    const lookupStatus = cached ? "stale_hit" : "miss";
    const lookupFreshnessDays = cached ? cachedFreshnessDays : null;
    try {
      const liveResearch = validatedResearch(await provider.research(normalized));
      if (!liveResearch) {
        throw new Error("Live research returned no validated intelligence.");
      }
      research = liveResearch;
      cacheStatus = cached ? "refreshed" : "miss";
      indexLookup = createIndexLookup(
        propertyKey,
        lookupStatus,
        "validated",
        lookupFreshnessDays,
        research.sources.length,
        research.summary,
        now.toISOString(),
      );
      await savePropertyIntelligence(db, {
        propertyKey,
        propertyName: research.propertyName,
        payload: {
          summary: research.summary,
          pricingTrend: research.pricingTrend,
          sentiment: research.sentiment,
        },
        citations: research.sources,
        refreshedAt: now.toISOString(),
      });
    } catch {
      research = createFallbackResearch(normalized);
      cacheStatus = "fallback";
      indexLookup = createIndexLookup(
        propertyKey,
        lookupStatus,
        "failed",
        lookupFreshnessDays,
        0,
        "",
        now.toISOString(),
      );
    }
  }

  const citations = sanitizeCitations(research.sources);
  const analytics = buildAnalytics(research, cacheStatus, cacheStatus === "hit" ? cachedFreshnessDays : 0);
  const contentSections = buildContentSections(research, analytics, normalized);
  const draft = buildReportDraft(normalized);
  const report: PropertyReport = {
    id: createId("report"),
    agentId: agent.id,
    title: `${normalized.propertyName || normalized.address} Analysis`,
    propertyName: normalized.propertyName,
    propertyKey,
    address: normalized.address,
    propertyType: normalized.propertyType,
    sqft: normalized.sqft,
    bedrooms: normalized.bedrooms,
    bathrooms: normalized.bathrooms,
    yearBuilt: normalized.yearBuilt,
    status: draft.status,
    marketSignal: research.pricingTrend || draft.marketSignal,
    sentimentSummary: sentimentSummary(analytics.sentiment),
    generatedAt: now.toISOString(),
    cacheStatus,
    shareToken: createId("shr"),
    inputSnapshot: normalized,
    indexLookup,
    analytics,
    citations,
    contentSections,
  };

  await savePropertyReport(db, report);
  return report;
}
