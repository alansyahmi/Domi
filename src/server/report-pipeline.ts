import { randomBytes } from "node:crypto";
import {
  buildReportDraft,
  buildReportPropertyKey,
  hasTargetAskingPrice,
  matchesPropertyName,
  normalizeReportInput,
  validateReportInput,
  calculateMarketPricingStats,
} from "../domain/reports";
import type {
  Agent,
  PropertyReport,
  PropertyReportInput,
  ReportAnalytics,
  ReportCacheStatus,
  ReportCitation,
  ReportComparableListing,
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
const MIN_INDEX_CITATIONS = 2;
const MAX_REPORT_CITATIONS = 9;
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
      sourceType: citation.sourceType,
    }))
    .slice(0, MAX_REPORT_CITATIONS);
}

function sanitizeComparableListings(
  listings: ReportComparableListing[] | undefined,
  propertyName?: string,
): ReportComparableListing[] {
  return (listings ?? [])
    .filter((listing) => listing.title?.trim() && listing.url?.trim() && isHttpUrl(listing.url.trim()))
    .filter((listing) => !propertyName || matchesPropertyName(propertyName, listing.title, true))
    .map((listing) => ({
      title: listing.title.trim(),
      sourceName: listing.sourceName?.trim(),
      url: listing.url.trim(),
      askingPriceRm: listing.askingPriceRm && listing.askingPriceRm > 0 ? Math.round(listing.askingPriceRm) : undefined,
      builtUpSqft: listing.builtUpSqft && listing.builtUpSqft > 0 ? Math.round(listing.builtUpSqft) : undefined,
      bedrooms: listing.bedrooms && listing.bedrooms > 0 ? Math.round(listing.bedrooms) : undefined,
      bathrooms: listing.bathrooms && listing.bathrooms > 0 ? Math.round(listing.bathrooms) : undefined,
      listingIntent: listing.listingIntent,
      snippet: listing.snippet?.trim(),
    }))
    .slice(0, 6);
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
    comparableListings: sanitizeComparableListings(research.comparableListings, research.propertyName),
  };
}

function canStoreInIndex(research: ReportResearchResult): boolean {
  const citations = sanitizeCitations(research.sources);
  const typedCitations = citations.filter((citation) => citation.sourceType === "official" || citation.sourceType === "community");
  if (typedCitations.length > 0) {
    return (
      typedCitations.filter((citation) => citation.sourceType === "official").length >= MIN_INDEX_CITATIONS &&
      typedCitations.filter((citation) => citation.sourceType === "community").length >= MIN_INDEX_CITATIONS
    );
  }
  return citations.length >= MIN_INDEX_CITATIONS;
}

function researchFromCache(cache: Awaited<ReturnType<typeof getPropertyIntelligenceCache>>): ReportResearchResult | null {
  if (!cache) return null;
  const candidate: ReportResearchResult = {
    propertyName: cache.propertyName,
    summary: String(cache.payload.summary ?? ""),
    pricingTrend: String(cache.payload.pricingTrend ?? "Balanced pricing discovery"),
    sentiment: (cache.payload.sentiment as Sentiment) ?? "neutral",
    sources: cache.citations,
    comparableListings: sanitizeComparableListings(cache.payload.comparableListings as ReportComparableListing[] | undefined, cache.propertyName),
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
  const comparableCount = sanitizeComparableListings(research.comparableListings, research.propertyName).length;
  const sourceWeight = Math.min(0.22, research.sources.length * 0.035);
  const comparableWeight = comparableCount >= 2 ? 0.04 : comparableCount === 1 ? 0.01 : -0.05;
  const cacheWeight = cacheStatus === "fallback" ? -0.24 : cacheStatus === "hit" ? 0.08 : 0;
  return {
    sentiment: research.sentiment,
    pricingTrend: research.pricingTrend,
    confidenceScore: clampConfidence(0.68 + sourceWeight + comparableWeight + cacheWeight - Math.min(0.12, freshnessDays * 0.01)),
    freshnessDays,
  };
}

function sourceSnippets(citations: ReportCitation[], sourceType: ReportCitation["sourceType"]): string[] {
  return citations
    .filter((citation) => citation.sourceType === sourceType)
    .map((citation) => citation.snippet || citation.title)
    .filter(Boolean)
    .slice(0, 3);
}

function joinSignals(signals: string[], fallback: string): string {
  return signals.length ? signals.map((signal) => signal.charAt(0).toLowerCase() + signal.slice(1)).join(" ") : fallback;
}

function watchoutKeywords(text: string): string[] {
  const checks: Array<[string, RegExp]> = [
    ["noise or late-night disturbance", /noise|bising|midnight|malam|disturbance/i],
    ["defects or maintenance follow-up", /defect|maintenance|maintain|rosak|repair|masalah|leak/i],
    ["parking or congestion", /parking|parkir|traffic|congestion|jam|sesak/i],
    ["safety or access expectations", /safety|security|safe|akses|access/i],
    ["developer track record", /developer track record|track record|pemaju/i],
  ];
  return checks.filter(([, pattern]) => pattern.test(text)).map(([label]) => label);
}

function formatComparablePrice(listing: ReportComparableListing): string {
  return listing.askingPriceRm ? formatRm(listing.askingPriceRm) : "price not shown in snippet";
}

function comparableListingLine(listing: ReportComparableListing): string {
  const facts = [
    formatComparablePrice(listing),
    listing.builtUpSqft ? `${listing.builtUpSqft.toLocaleString("en-MY")} sqft` : "",
    listing.bedrooms ? `${listing.bedrooms} bed` : "",
    listing.bathrooms ? `${listing.bathrooms} bath` : "",
    listing.sourceName,
  ].filter(Boolean);
  return `${listing.title}: ${facts.join(", ") || "listing facts require verification"}`;
}

function comparablePriceRange(listings: ReportComparableListing[]): string {
  const prices = listings
    .map((listing) => listing.askingPriceRm)
    .filter((price): price is number => typeof price === "number" && Number.isFinite(price) && price > 0)
    .sort((left, right) => left - right);
  if (prices.length === 0) return "no clear asking-price range was extractable from snippets";
  if (prices.length === 1) return `${formatRm(prices[0])} from one cited listing`;
  return `${formatRm(prices[0])} to ${formatRm(prices[prices.length - 1])} across cited listings`;
}

function comparableContextText(input: ReturnType<typeof normalizeReportInput>, listings: ReportComparableListing[]): string {
  if (listings.length === 0) {
    return "Current listing coverage is limited in this report, so pricing posture should be checked against active portal listings before publication.";
  }
  const stats = calculateMarketPricingStats({ inputSnapshot: input, comparableListings: listings });
  const sample = listings.slice(0, 3).map(comparableListingLine).join(" ");
  const priceAvgStr = stats.averagePrice > 0 ? `RM ${stats.averagePrice.toLocaleString("en-MY", { maximumFractionDigits: 0 })}` : "TBD";
  const ppsAvgStr = stats.averagePricePerSqft > 0 ? `RM ${stats.averagePricePerSqft.toLocaleString("en-MY", { maximumFractionDigits: 0 })}/sqft` : "TBD";
  const rangeStr =
    stats.priceRangeMin > 0 && stats.priceRangeMax > 0
      ? stats.priceRangeMin === stats.priceRangeMax
        ? formatRm(stats.priceRangeMin)
        : `${formatRm(stats.priceRangeMin)} to ${formatRm(stats.priceRangeMax)}`
      : comparablePriceRange(listings);

  if (stats.mode === "comparable_market") {
    return `Active ${input.propertyName} listings show ${rangeStr} across ${stats.validPriceCount} cited listing${stats.validPriceCount === 1 ? "" : "s"}. The average asking price is ${priceAvgStr}${stats.averagePricePerSqft > 0 ? ` with an average of ${ppsAvgStr} where size data is available` : ""}. ${sample}. Treat these as directional market context for similar units at this development, not a valuation of a specific unit.`;
  }

  const targetPpsStr = stats.targetPricePerSqft > 0 ? `RM ${stats.targetPricePerSqft.toLocaleString("en-MY", { maximumFractionDigits: 0 })}/sqft` : "TBD";
  const priceDiffText = stats.priceDifferencePct === 0
    ? "at market average"
    : `${Math.abs(stats.priceDifferencePct).toFixed(1)}% ${stats.priceDifferencePct > 0 ? "premium" : "discount"}`;
  const ppsDiffText = stats.ppsDifferencePct === 0
    ? "at market average"
    : `${Math.abs(stats.ppsDifferencePct).toFixed(1)}% ${stats.ppsDifferencePct > 0 ? "premium" : "discount"}`;
  const compStatsText = stats.averagePrice > 0
    ? ` The comparable market average price is ${priceAvgStr} (${priceDiffText} relative to target). The market average price per square foot is ${ppsAvgStr}, compared to the target property's asking PPS of ${targetPpsStr} (${ppsDiffText}).`
    : "";

  return `Current listing signals include ${listings.length} cited active listing${listings.length === 1 ? "" : "s"} with ${comparablePriceRange(listings)}.${compStatsText} ${sample}. Treat these as directional asking context, not a valuation.`;
}

function buildContentSections(
  research: ReportResearchResult,
  analytics: ReportAnalytics,
  input: ReturnType<typeof normalizeReportInput>,
  limitedSourceCoverage = false,
): ReportContentSection[] {
  const intentLabel = input.askingPriceRm <= 0 && input.tenure === "unknown" ? "market review" : input.listingIntent === "sale" ? "sale" : input.listingIntent;
  const tenureText = input.tenure === "unknown" ? "" : ` with ${input.tenure} tenure`;
  const priceText = input.askingPriceRm > 0 ? ` and an asking price of ${formatRm(input.askingPriceRm)}` : ", with asking price to be confirmed";
  const officialSignals = sourceSnippets(research.sources, "official");
  const communitySignals = sourceSnippets(research.sources, "community");
  const comparableSignals = sourceSnippets(research.sources, "comparable_listing");
  const comparableListings = sanitizeComparableListings(research.comparableListings, input.propertyName);
  const officialText = joinSignals(officialSignals, "Official/listing source coverage is limited, so factual advantages should be verified before publication.");
  const communityText = joinSignals(communitySignals, "Community/user source coverage is limited, so buyer concerns should be checked during listing preparation.");
  const comparableText = comparableContextText(input, comparableListings);
  const comparableSignalText = joinSignals(comparableSignals, "Current listing source coverage is limited, so price positioning should be checked against active portals.");
  const watchouts = watchoutKeywords(`${research.summary} ${communityText}`);
  const coverageText = limitedSourceCoverage
    ? " This report uses limited source coverage in one lane, so conclusions should be treated as directional until more balanced citations are available."
    : " Source coverage includes both official/listing and community/user signals.";
  const sourceNote = input.sourceNotes ? ` Agent notes: ${input.sourceNotes}` : "";
  const watchoutDetails = watchouts.length
    ? `Buyer questions to prepare for: ${watchouts.join(", ")}.`
    : "Buyer questions to prepare for: maintenance expectations, access, surrounding activity, and how the property compares with nearby alternatives.";

  return [
    {
      title: "Executive Read",
      body: `${research.summary} This is a client-facing analyst view for ${input.propertyName}, positioned for ${intentLabel}${tenureText}${priceText}.${coverageText} ${sourceNote}`.trim(),
    },
    {
      title: "Best-Fit Buyer Profile",
      body: `Likely best suited to buyers who value the property type, location convenience, and lifestyle fit more than a purely lowest-price comparison. For client conversations, frame the target buyer around use-case fit, daily convenience, and tolerance for the watchouts noted below.`,
    },
    {
      title: "Current Listing Context",
      body: comparableText,
    },
    {
      title: "Market Positioning",
      body: `${analytics.pricingTrend}. Position the property against nearby alternatives by separating source-backed facts from buyer perception: official/listing signals support the core value story, community/user signals show what should be clarified before a serious viewing or offer, and current listing signals show how active alternatives may frame buyer expectations. ${comparableSignalText}`,
    },
    {
      title: "Strengths to Lead With",
      body: `Lead with source-backed advantages, not exaggerated claims. Official/listing signals indicate: ${officialText}`,
    },
    {
      title: "Watchouts and Buyer Questions",
      body: `${communityText} ${watchoutDetails} Keep phrasing neutral: present these as points to clarify rather than defects unless verified directly.`,
    },
    {
      title: "Pricing Posture",
      body: hasTargetAskingPrice(input)
        ? `${analytics.pricingTrend}. With ${Math.round(analytics.confidenceScore * 100)}% confidence and ${research.sources.length} cited sources, use a measured pricing posture: explain the asking position with current listing signals, avoid overclaiming scarcity or exact valuation, and leave room to respond if buyer feedback clusters around the watchouts.`
        : `${analytics.pricingTrend}. With ${Math.round(analytics.confidenceScore * 100)}% confidence and ${research.sources.length} cited sources, frame pricing around active ${input.propertyName} listings and similar units in the area rather than a specific unit ask. Use the cited listing range as directional market context, avoid overclaiming exact valuation, and leave room to respond if buyer feedback clusters around the watchouts.`,
    },
    {
      title: "Recommended Listing Narrative",
      body: `Use a client-safe narrative: highlight the verified lifestyle and location strengths first, then acknowledge practical buyer questions transparently. The tone should be balanced, evidence-led, and reassuring rather than hard-sell or defensive.`,
    },
    {
      title: "Next Steps",
      body: `Before publishing, verify current asking price, tenure, unit facts, photos, facilities, maintenance details, active competing listings, and any recurring community concerns. Prepare answers for the watchouts, update listing copy with only source-backed claims, and refresh the report when new official, community, or listing evidence appears.`,
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
  let limitedSourceCoverage = false;

  const bypassCache = input.bypassCache === true;

  if (!bypassCache && cachedResearch && cachedFreshnessDays <= CACHE_FRESHNESS_DAYS) {
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
      const indexReady = canStoreInIndex(research);
      limitedSourceCoverage = !indexReady;
      cacheStatus = cached && indexReady ? "refreshed" : "miss";
      indexLookup = createIndexLookup(
        propertyKey,
        lookupStatus,
        indexReady ? "validated" : "limited",
        lookupFreshnessDays,
        research.sources.length,
        research.summary,
        now.toISOString(),
      );
      if (indexReady) {
        await savePropertyIntelligence(db, {
          propertyKey,
          propertyName: research.propertyName,
          payload: {
            summary: research.summary,
            pricingTrend: research.pricingTrend,
            sentiment: research.sentiment,
            comparableListings: sanitizeComparableListings(research.comparableListings, research.propertyName),
          },
          citations: research.sources,
          refreshedAt: now.toISOString(),
        });
      }
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
  const comparableListings = sanitizeComparableListings(research.comparableListings, normalized.propertyName);
  const analytics = buildAnalytics(research, cacheStatus, cacheStatus === "hit" ? cachedFreshnessDays : 0);
  const contentSections = buildContentSections(research, analytics, normalized, limitedSourceCoverage);
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
    comparableListings,
    contentSections,
  };

  await savePropertyReport(db, report);
  return report;
}
