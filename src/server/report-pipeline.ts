import { randomBytesBase64url } from "./crypto";
import {
  buildReportDraft,
  buildReportPropertyKey,
  hasTargetAskingPrice,
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
import type { ReAIDbClient } from "./db";
import {
  getPropertyIntelligenceCache,
  savePropertyIntelligence,
  savePropertyReport,
} from "./db";
import {
  createFallbackResearch,
  createReportResearchProvider,
  extractUnitTypes,
  type ReportResearchProvider,
  type ReportResearchResult,
} from "./report-research";
import { fetchNeighborhoodVibe, type NeighborhoodVibe } from "./places";
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
  return `${prefix}_${Date.now().toString(36)}_${randomBytesBase64url(8)}`;
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
): ReportComparableListing[] {
  return (listings ?? [])
    .filter((listing) => listing.title?.trim() && listing.url?.trim() && isHttpUrl(listing.url.trim()))
    .map((listing) => ({
      title: listing.title.trim(),
      sourceName: listing.sourceName?.trim(),
      url: listing.url.trim(),
      askingPriceRm: listing.askingPriceRm && listing.askingPriceRm > 0 ? Math.round(listing.askingPriceRm) : undefined,
      priceNote: listing.priceNote?.trim(),
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
    comparableListings: sanitizeComparableListings(research.comparableListings),
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
    comparableListings: sanitizeComparableListings(cache.payload.comparableListings as ReportComparableListing[] | undefined),
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

function countUniqueSourceLanes(sources: ReportCitation[]): number {
  return new Set(sources.map((s) => s.sourceType).filter(Boolean)).size;
}

function buildAnalytics(research: ReportResearchResult, cacheStatus: ReportCacheStatus, freshnessDays: number, neighborhoodVibe?: NeighborhoodVibe): ReportAnalytics {
  const comparableCount = sanitizeComparableListings(research.comparableListings).length;
  const sourceWeight = Math.min(0.22, research.sources.length * 0.035);
  const comparableWeight = comparableCount >= 2 ? 0.04 : comparableCount === 1 ? 0.01 : -0.05;
  const cacheWeight = cacheStatus === "fallback" ? -0.24 : cacheStatus === "hit" ? 0.08 : 0;
  const transactionWeight = (research.transactedPrices?.length ?? 0) >= 2 ? 0.05 : (research.transactedPrices?.length ?? 0) === 1 ? 0.02 : 0;
  const neighborhoodWeight = neighborhoodVibe ? 0.03 : 0;

  // Data Completeness: how much source-backed info we found
  const uniqueLanes = countUniqueSourceLanes(research.sources);
  const dataCompleteness = clampConfidence(
    0.30
    + Math.min(0.27, research.sources.length * 0.03)
    + (uniqueLanes / 5) * 0.18
    + (comparableCount >= 3 ? 0.10 : comparableCount >= 1 ? 0.05 : 0)
    - Math.min(0.15, freshnessDays * 0.01),
  );

  // Price Certainty: how many actual transacted prices we found vs. just asking prices
  const realTxCount = (research.transactedPrices ?? []).filter((tx) => !tx.isAskingFallback).length;
  const txBonus = realTxCount >= 3 ? 0.45 : realTxCount >= 2 ? 0.25 : realTxCount >= 1 ? 0.10 : 0;
  const compBonus = realTxCount > 0 && comparableCount >= 3 ? 0.10 : 0;
  const cacheBonus = cacheStatus === "hit" ? 0.05 : 0;
  const priceCertainty = Math.min(0.95, clampConfidence(0.20 + txBonus + compBonus + cacheBonus));

  return {
    sentiment: research.sentiment,
    pricingTrend: research.pricingTrend,
    confidenceScore: clampConfidence(0.68 + sourceWeight + comparableWeight + cacheWeight + transactionWeight + neighborhoodWeight - Math.min(0.12, freshnessDays * 0.01)),
    dataCompleteness,
    priceCertainty,
    freshnessDays,
    neighborhoodVibe,
    transactedPrices: research.transactedPrices?.map((tx) => ({
      priceRm: tx.priceRm,
      transactedDate: tx.transactedDate,
      unitType: tx.unitType,
      builtUpSqft: tx.builtUpSqft,
      sourceName: tx.sourceName,
      sourceUrl: tx.sourceUrl,
      isAskingFallback: tx.isAskingFallback,
    })),
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
    ["upcoming construction nearby", /upcoming\s+(?:construction|development|project|MRT|LRT|highway)/i],
    ["maintenance fee concerns", /maintenance\s+fee|sinking\s+fund|service\s+charge/i],
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
    const medianStr = stats.medianPrice > 0 ? ` (median ${formatRm(stats.medianPrice)})` : "";
    return `Active ${input.propertyName} listings show ${rangeStr} across ${stats.validPriceCount} cited listing${stats.validPriceCount === 1 ? "" : "s"}. The average asking price is ${priceAvgStr}${medianStr}${stats.averagePricePerSqft > 0 ? ` with an average of ${ppsAvgStr} where size data is available` : ""}. ${sample}. Treat these as directional market context for similar units at this development, not a valuation of a specific unit.`;
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

function bulletLines(lines: Array<string | undefined | null>): string {
  return lines.filter((line): line is string => Boolean(line && line.trim())).join("\n");
}

function conciseObjectionNotes(watchouts: string[], research: ReportResearchResult, input: ReturnType<typeof normalizeReportInput>): string {
  const notes: string[] = [];

  if (watchouts.includes("noise or late-night disturbance")) {
    notes.push("Noise: verify floor, block, and management rules before the buyer commits.");
  }
  if (watchouts.includes("defects or maintenance follow-up")) {
    notes.push("Maintenance: review AGM minutes, service charge, and sinking fund details before presenting.");
  }
  if (watchouts.includes("parking or congestion")) {
    notes.push("Parking: confirm the exact bay allocation and visitor parking policy for this unit.");
  }
  if (watchouts.includes("safety or access expectations")) {
    notes.push("Access: check the security flow at viewing time and confirm the gated-entry experience.");
  }
  if (watchouts.includes("developer track record")) {
    notes.push("Developer: anchor the conversation on completed projects and current management quality.");
  }
  if (watchouts.includes("upcoming construction nearby")) {
    notes.push("Construction: frame nearby works as a convenience tradeoff, not a surprise.");
  }
  if (watchouts.includes("maintenance fee concerns")) {
    notes.push("Holding cost: compare service charges and sinking fund strength against nearby alternatives.");
  }

  const hasTransactions = (research.transactedPrices ?? []).length > 0;
  const hasComparables = sanitizeComparableListings(research.comparableListings).length > 0;

  if (!hasTransactions) {
    notes.push("Pricing: present active asking prices as directional context, not a valuation.");
  }
  if (hasComparables) {
    notes.push("Comparison: adjust for floor plan, facing, condition, and renovation quality.");
  }

  if (notes.length === 0) {
    notes.push("Confidence: keep the tone measured, evidence-led, and clear about what still needs verification.");
  }

  notes.push(`Goal: help the buyer make a calm, informed decision about ${input.propertyName}.`);
  return bulletLines(notes);
}

function buildContentSections(
  research: ReportResearchResult,
  analytics: ReportAnalytics,
  input: ReturnType<typeof normalizeReportInput>,
  _limitedSourceCoverage = false,
): ReportContentSection[] {
  const officialSignals = sourceSnippets(research.sources, "official");
  const communitySignals = sourceSnippets(research.sources, "community");
  const comparableSignals = sourceSnippets(research.sources, "comparable_listing");
  const comparableListings = sanitizeComparableListings(research.comparableListings);
  const officialText = joinSignals(officialSignals, "Official/listing source coverage is limited, so factual advantages should be verified before publication.");
  const communityText = joinSignals(communitySignals, "Community/user source coverage is limited, so buyer concerns should be checked during listing preparation.");
  const comparableText = comparableContextText(input, comparableListings);
  const comparableSignalText = joinSignals(comparableSignals, "Current listing source coverage is limited, so price positioning should be checked against active portals.");
  const watchouts = watchoutKeywords(`${research.summary} ${communityText}`);
  const watchoutDetails = watchouts.length
    ? `Buyer questions to prepare for: ${watchouts.join(", ")}.`
    : "Buyer questions to prepare for: maintenance expectations, access, surrounding activity, and how the property compares with nearby alternatives.";

  // Data-driven buyer profile
  const buyerProfileParts: string[] = [];
  const avgSqftValues = comparableListings
    .map((c) => c.builtUpSqft)
    .filter((s): s is number => typeof s === "number" && s > 0);
  if (avgSqftValues.length >= 2) {
    const meanSqft = avgSqftValues.reduce((a, b) => a + b, 0) / avgSqftValues.length;
    buyerProfileParts.push(
      meanSqft >= 1500
        ? "Family-upsizers seeking spacious layouts"
        : meanSqft >= 800
          ? "Young professionals and small families"
          : "Singles, couples, or investors targeting compact units",
    );
  }
  if (analytics.neighborhoodVibe?.amenities?.length) {
    const amenityTypes = analytics.neighborhoodVibe.amenities.map((a) => a.type);
    if (amenityTypes.includes("transit")) buyerProfileParts.push("commuters relying on public transit");
    if (amenityTypes.includes("school")) buyerProfileParts.push("families with school-age children");
    if (amenityTypes.includes("mall") || amenityTypes.includes("grocery")) buyerProfileParts.push("buyers who value walkable retail access");
  }
  const pricesForProfile = comparableListings.map((c) => c.askingPriceRm).filter((p): p is number => typeof p === "number" && p > 0).sort((a, b) => a - b);
  if (pricesForProfile.length >= 2) {
    const medianProfile = pricesForProfile[Math.floor(pricesForProfile.length / 2)];
    buyerProfileParts.push(
      medianProfile >= 1_000_000
        ? "affluent buyers comfortable above the RM 1M bracket"
        : "value-conscious buyers in the mid-market segment",
    );
  }
  const buyerProfileText = buyerProfileParts.length
    ? bulletLines([
        `Best suited to ${buyerProfileParts.join("; ")}.`,
        "Lead with the day-to-day use case instead of generic lifestyle language.",
        "Position the property against convenience, layout fit, and price discipline.",
      ])
    : bulletLines([
        "Best suited to buyers who value location convenience and lifestyle fit over a purely lowest-price comparison.",
        "Frame the target buyer around daily use case, access, and layout fit.",
        "Use the watchouts below to qualify whether the property is a real fit.",
      ]);

  // Developer context for Strengths section
  const developerContext = analytics.developerTrackRecord?.developerName
    ? `Developer context: ${analytics.developerTrackRecord.developerName} is behind this project. Verify past delivery quality and buyer satisfaction before presenting.`
    : "";

  // Community quote for Watchouts
  const communitySnippets = sourceSnippets(research.sources, "community");
  const communityQuote = communitySnippets.length > 0
    ? ` Specific resident feedback includes: "${communitySnippets[0].slice(0, 120)}".`
    : "";

  // Pricing posture enrichment with actual numbers
  let pricingPostureExtra = "";
  if (analytics.medianPrice && analytics.medianPrice > 0 && input.askingPriceRm > 0) {
    const diffPct = ((input.askingPriceRm - analytics.medianPrice) / analytics.medianPrice * 100);
    const direction = diffPct > 0 ? "above" : "below";
    pricingPostureExtra = ` The asking price sits ~${Math.abs(Number(diffPct.toFixed(1)))}% ${direction} the comparable median of ${formatRm(analytics.medianPrice)}.`;
  }
  const realTxCount = (analytics.transactedPrices ?? []).filter((tx) => !tx.isAskingFallback).length;
  if (realTxCount > 0) {
    pricingPostureExtra += " Recent transacted prices support the directional pricing narrative above.";
  }

  // Rental yield enrichment
  let rentalYieldSection: ReportContentSection | null = null;
  if (analytics.estimatedGrossYield !== undefined && analytics.averageRentalPrice !== undefined) {
    const rentalCompCount = comparableListings.filter((c) => c.listingIntent === "rent").length;
    const yieldPct = analytics.estimatedGrossYield.toFixed(1);
    rentalYieldSection = {
      title: "Rental Yield Context",
      body: bulletLines([
        `Based on ${rentalCompCount} cited rental listing${rentalCompCount === 1 ? "" : "s"} averaging RM ${analytics.averageRentalPrice.toLocaleString("en-MY", { maximumFractionDigits: 0 })}/month, the estimated gross rental yield at the asking price is ${yieldPct}%.`,
        analytics.estimatedGrossYield >= 5 ? "Yield is competitive for the Malaysian residential market." : analytics.estimatedGrossYield >= 3 ? "Yield is moderate and worth checking against your target return." : "Yield is below typical investor thresholds.",
        "Verify against actual tenanted units and factor in maintenance fees, vacancy, and management costs.",
      ]),
    };
  }

  const tldrPropertyLine = `${input.propertyType}, ${input.bedrooms || "?"}+${input.bathrooms || "?"}, ${input.sqft > 0 ? `${input.sqft.toLocaleString("en-MY")} sqft` : "size TBC"}, ${input.tenure !== "unknown" ? input.tenure : "tenure TBC"}.`;
  const tldrPriceLine = comparableListings.length > 0
    ? `${comparablePriceRange(comparableListings)} across active listings.${realTxCount === 0 ? " Treat this as directional because no recent transactions were cited." : realTxCount === 1 ? " One recent transaction provides some price anchoring." : ` ${realTxCount} recent transactions provide pricing support.`}`
    : "No comparable active listings were found. Verify pricing against your own recent deal experience.";
  const tldrPerk = analytics.neighborhoodVibe?.amenities?.length
    ? `Nearby ${analytics.neighborhoodVibe.amenities.slice(0, 3).map((a) => a.name).join(", ")}${analytics.neighborhoodVibe.amenities.length > 3 ? ", and more" : ""} support the convenience story.`
    : officialSignals.length > 0
      ? `Source-backed positives include ${officialSignals.slice(0, 2).join("; ")}.`
      : "Verify key selling points before presenting.";
  const tldrRisk = watchouts.length > 0
    ? `${input.propertyName} has watchouts around ${watchouts.slice(0, 3).join(", ")}. ${communityQuote}`
    : "No specific red flags surfaced, but always verify maintenance, access, and noise during a physical viewing.";
  const tldrEdge = watchouts.length > 0
    ? `Lead with the location and lifestyle perks, then handle ${watchouts[0]} early in the conversation.`
    : "Lead with verified location and lifestyle advantages, then qualify the buyer against the profile below.";

  const tldrBody = bulletLines([
    `Property: ${tldrPropertyLine}`,
    `Market read: ${analytics.pricingTrend}.`,
    `Price stance: ${tldrPriceLine}`,
    `Main upside: ${tldrPerk}`,
    `Main watchout: ${tldrRisk}`,
    `Agent angle: ${tldrEdge}`,
  ]);

  let investorSnapshot: ReportContentSection | null = null;
  if (input.listingIntent === "sale" || (input.listingIntent as string) === "sale") {
    const yieldLine = analytics.estimatedGrossYield !== undefined
      ? `Estimated gross yield: ${analytics.estimatedGrossYield.toFixed(1)}% based on asking price ${formatRm(input.askingPriceRm > 0 ? input.askingPriceRm : (analytics.medianPrice ?? 0))} and rental around RM ${(analytics.averageRentalPrice ?? 0).toLocaleString("en-MY", { maximumFractionDigits: 0 })}/month.`
      : "Estimated gross yield: insufficient rental comparable data. Verify against area rental listings before presenting.";
    const feeLine = analytics.averageMaintenanceFeePsf !== undefined
      ? `Maintenance fee: about RM ${analytics.averageMaintenanceFeePsf.toFixed(2)}/sqft based on cited comparables. Verify the exact rate with management.`
      : "Maintenance fee: not cited in available sources, so verify before presenting.";
    const riskLine = watchouts.length > 0
      ? `Capital appreciation risk: the flagged watchouts (${watchouts.slice(0, 2).join(", ")}) may cap upside versus nearby developments.`
      : "Capital appreciation risk: no major red flags surfaced, but standard market risk still applies.";

    investorSnapshot = {
      title: "Investor Snapshot",
      body: bulletLines([
        yieldLine,
        feeLine,
        riskLine,
        "Investor angle: buy for cash flow and defensible positioning, not for a hype-driven flip.",
      ]),
    };
  }

  const objectionBody = conciseObjectionNotes(watchouts, research, input);

  // Price certainty label for pricing posture
  const dataCompPct = Math.round(analytics.dataCompleteness * 100);
  const priceCertLabel = analytics.priceCertainty >= 0.60 ? "High" : analytics.priceCertainty >= 0.35 ? "Moderate" : "Low";
  const priceCertNote = realTxCount === 0 ? " (No recent transactions found — pricing based on asking prices only)" : "";

  const sections: ReportContentSection[] = [
    {
      title: "TL;DR for the Agent",
      body: tldrBody,
    },
    {
      title: "Best-Fit Buyer Profile",
      body: buyerProfileText,
    },
    ...(investorSnapshot ? [investorSnapshot] : []),
    {
      title: "Current Listing Context",
      body: comparableText,
    },
    {
      title: "Market Positioning",
      body: bulletLines([
        `${analytics.pricingTrend}.`,
        "Position the property against nearby alternatives, not against generic market averages.",
        "Separate source-backed facts from buyer perception before a serious viewing or offer.",
        `Current listing signals: ${comparableSignalText}`,
      ]),
    },
    {
      title: "Strengths to Lead With",
      body: bulletLines([
        `Official/listing signals: ${officialText}`,
        developerContext || undefined,
        "Lead with verified advantages, not exaggerated claims.",
      ]),
    },
    {
      title: "Watchouts and Buyer Questions",
      body: bulletLines([
        `Community/user signals: ${communityText}${communityQuote}`,
        watchoutDetails,
        "Keep phrasing neutral and present these as points to clarify, not defects.",
      ]),
    },
    {
      title: "Handling Objections",
      body: objectionBody,
    },
    {
      title: "Pricing Posture",
      body: hasTargetAskingPrice(input)
        ? bulletLines([
            analytics.pricingTrend,
            `Data completeness: ${dataCompPct}% (${research.sources.length} sources).`,
            `Price certainty: ${priceCertLabel}${priceCertNote}.`,
            "Use a measured pricing posture and avoid overclaiming exact valuation.",
            "Leave room to respond if buyer feedback clusters around the watchouts.",
            pricingPostureExtra || undefined,
          ])
        : bulletLines([
            analytics.pricingTrend,
            `Data completeness: ${dataCompPct}% (${research.sources.length} sources).`,
            `Price certainty: ${priceCertLabel}${priceCertNote}.`,
            `Frame pricing around active ${input.propertyName} listings and similar units in the area.`,
            "Use the cited listing range as directional market context, not as a valuation.",
            pricingPostureExtra || undefined,
          ]),
    },
    {
      title: "Recommended Listing Narrative",
      body: bulletLines([
        "Lead with verified lifestyle and location strengths.",
        "Acknowledge practical buyer questions transparently.",
        "Keep the tone balanced, evidence-led, and reassuring.",
      ]),
    },
    {
      title: "Recent Transaction History",
      body: research.transactedPrices && research.transactedPrices.length > 0
        ? bulletLines([
            `Found ${research.transactedPrices.length} recent price record${research.transactedPrices.length === 1 ? "" : "s"}.`,
            ...research.transactedPrices.map((tx) => {
              const source = tx.sourceName ? ` via ${tx.sourceName}` : "";
              const date = tx.transactedDate ? ` (${tx.transactedDate})` : "";
              const fallback = tx.isAskingFallback ? " [asking price]" : "";
              return `RM ${tx.priceRm.toLocaleString("en-MY", { maximumFractionDigits: 0 })}${date}${fallback}${source}.`;
            }),
            "Treat these as directional context for pricing discussions.",
          ])
        : "No recent transaction data was available, so the pricing analysis relies on current asking prices from active listings.",
    },
    {
      title: "Nearby Facilities & Infrastructure",
      body: analytics.neighborhoodVibe?.amenities?.length
        ? (() => {
            const facilityLines = analytics.neighborhoodVibe.amenities.map((a) => {
              const rating = a.rating ? ` (${a.rating.toFixed(1)}★)` : "";
              const distance = a.distance ? ` — ${a.distance}` : "";
              return `${a.type}: ${a.name}${rating}${distance}`;
            });
            const infraLines = analytics.upcomingInfrastructure && analytics.upcomingInfrastructure.length > 0
              ? analytics.upcomingInfrastructure.map((i) => {
                  const year = i.completionYear ? ` (by ${i.completionYear})` : "";
                  const dist = i.distanceKm ? ` ~${i.distanceKm}km` : "";
                  return `Infrastructure: ${i.name}${dist}${year}.`;
                })
              : [];
            return bulletLines([
              ...facilityLines,
              ...infraLines,
              "This neighborhood context helps buyers gauge daily convenience and future accessibility.",
            ]);
          })()
        : "Neighborhood facility and infrastructure data is currently limited. Verify nearby essentials before presenting.",
    },
    {
      title: "Next Steps",
      body: bulletLines([
        "Verify the current asking price, tenure, unit facts, photos, and facilities.",
        "Confirm maintenance details, competing listings, and recurring community concerns.",
        "Prepare concise answers for the watchouts before you publish.",
        "Refresh the report when new official, community, or listing evidence appears.",
      ]),
    },
  ];

  if (rentalYieldSection) {
    // Insert rental yield after Market Positioning
    const marketPosIndex = sections.findIndex((s) => s.title === "Market Positioning");
    sections.splice(marketPosIndex + 1, 0, rentalYieldSection);
  }

  return sections;
}

function sentimentSummary(sentiment: Sentiment): string {
  if (sentiment === "positive") return "Buyer sentiment is positive with strong positioning potential.";
  if (sentiment === "negative") return "Buyer sentiment shows caution and needs value-led positioning.";
  return "Buyer sentiment is neutral with room for targeted positioning.";
}

export async function generatePropertyReport(
  db: ReAIDbClient,
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
            comparableListings: sanitizeComparableListings(research.comparableListings),
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

  // Fetch neighborhood vibe async
  let vibe: NeighborhoodVibe | undefined;
  try {
    vibe = await fetchNeighborhoodVibe(normalized.address, undefined, research.neighborhoodContext);
  } catch (err) {
    console.error("Failed to fetch neighborhood vibe:", err);
  }

  const citations = sanitizeCitations(research.sources);
  const comparableListings = sanitizeComparableListings(research.comparableListings);
  const analytics = buildAnalytics(research, cacheStatus, cacheStatus === "hit" ? cachedFreshnessDays : 0, vibe);

  // Enrich analytics with additional computed data
  const pricingStats = calculateMarketPricingStats({
    inputSnapshot: normalized,
    comparableListings,
  });
  analytics.medianPrice = pricingStats.medianPrice;
  analytics.medianPricePerSqft = pricingStats.medianPricePerSqft;
  analytics.averageMaintenanceFeePsf = pricingStats.averageMaintenanceFeePsf;

  // Populate upcoming infrastructure from research neighborhood context
  if (research.neighborhoodContext?.infrastructure?.length) {
    analytics.upcomingInfrastructure = research.neighborhoodContext.infrastructure.map((i) => ({
      name: i.name,
      type: i.type as "mrt" | "lrt" | "highway" | "bus_rapid_transit" | "other",
      distanceKm: i.distanceKm,
      completionYear: i.completionYear,
      status: i.status,
      sourceUrl: i.sourceUrl,
    }));
  }

  // Extract unit type variations from comparable listings
  if (comparableListings.length > 0) {
    analytics.unitTypeVariations = extractUnitTypes(comparableListings);
  }

  // Populate developer track record if research identified a developer
  if (research.developerName) {
    analytics.developerTrackRecord = {
      developerName: research.developerName,
    };
  }

  // Populate rental yield from pricing stats
  if (pricingStats.estimatedGrossYield !== undefined) {
    analytics.estimatedGrossYield = pricingStats.estimatedGrossYield;
    analytics.averageRentalPrice = pricingStats.averageRentalPrice;
  }

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
