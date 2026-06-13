import type { ListingIntent, PropertyReportInput, ReportCitation, ReportCitationSourceType, ReportComparableListing, Sentiment } from "../types";
import { conflictsWithPropertyName, matchesPropertyName, normalizeReportInput, propertyNameTokens } from "../domain/reports";

const MAX_TAVILY_RESULTS_PER_LANE = 3;
const TRUSTED_LISTING_HOSTS = [
  "iproperty.com.my",
  "propertyguru.com.my",
  "mudah.my",
  "edgeprop.my",
  "durianproperty.com.my",
  "brickz.my",
];
const PORTAL_LISTING_HOSTS = TRUSTED_LISTING_HOSTS;

function formatRm(value: number): string {
  if (value <= 0) return "asking price to be confirmed";
  return `RM ${value.toLocaleString("en-MY", { maximumFractionDigits: 0 })}`;
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function compact(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeSearchDepth(value: string | undefined): "basic" | "advanced" | "fast" | "ultra-fast" {
  return value === "advanced" || value === "fast" || value === "ultra-fast" ? value : "basic";
}

function parseMaxResults(value: string | undefined): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return MAX_TAVILY_RESULTS_PER_LANE;
  return Math.max(1, Math.min(MAX_TAVILY_RESULTS_PER_LANE, Math.floor(parsed)));
}

function buildBaseTavilyQuery(input: PropertyReportInput): string {
  const normalized = normalizeReportInput(input);
  const address = input.address?.trim();
  const propertyType = input.propertyType?.trim();
  const askingPrice = input.askingPriceRm && input.askingPriceRm > 0 ? formatRm(input.askingPriceRm) : "";
  return compact([
    normalized.propertyName,
    address && address !== normalized.propertyName ? address : "",
    propertyType,
    input.listingIntent,
    input.tenure && input.tenure !== "unknown" ? input.tenure : "",
    askingPrice,
  ].filter(Boolean).join(" "));
}

type TavilySourceLane = Extract<ReportCitationSourceType, "official" | "community" | "comparable_listing">;

function buildTavilyQuery(input: PropertyReportInput, sourceType: TavilySourceLane): string {
  const base = buildBaseTavilyQuery(input);
  if (sourceType === "official") {
    return compact(`${base} official developer listing sales gallery property portal Malaysia`);
  }
  if (sourceType === "comparable_listing") {
    const propertyName = input.propertyName?.trim() || "property";
    const intentPart = input.listingIntent === "rent" ? '"for rent"' : input.listingIntent === "sale" ? '"for sale"' : '("for sale" OR "for rent")';
    return compact(`"${propertyName}" ${intentPart} site:iproperty.com.my OR site:propertyguru.com.my OR site:mudah.my OR site:facebook.com`);
  }

  return compact(`${base} review complaint forum resident experience noise midnight defects maintenance parking developer track record Malay English ulasan aduan forum komuniti pengalaman penghuni bising malam masalah -site:propertyguru.com.my -site:iproperty.com.my`);
}

function relevanceText(input: PropertyReportInput): string[] {
  const normalized = normalizeReportInput(input);
  return [normalized.propertyName, normalized.address]
    .flatMap((value) => propertyNameTokens(value))
    .filter((part, index, parts) => parts.indexOf(part) === index);
}

function hostFromUrl(value: string): string | undefined {
  try {
    return new URL(value).hostname.replace(/^www\d*\./, "");
  } catch {
    return undefined;
  }
}

function isTrustedListingUrl(value: string): boolean {
  const host = hostFromUrl(value);
  return Boolean(host && (
    TRUSTED_LISTING_HOSTS.some((trustedHost) => host === trustedHost || host.endsWith(`.${trustedHost}`)) ||
    host === "facebook.com" || host.endsWith(".facebook.com")
  ));
}

function isPortalListingUrl(value: string): boolean {
  const host = hostFromUrl(value);
  return Boolean(host && PORTAL_LISTING_HOSTS.some((portalHost) => host === portalHost || host.endsWith(`.${portalHost}`)));
}

function isSocialListingUrl(value: string): boolean {
  const host = hostFromUrl(value);
  return Boolean(host && /(?:instagram|tiktok|threads)\./i.test(host));
}

function isLandedListingTitle(title: string): boolean {
  return /\b(bungalow|semi[- ]?d|terrace|landed|double storey|single storey|corner lot)\b/i.test(title);
}

function passesPropertyNameGate(input: PropertyReportInput, result: TavilyResult, strict = false): boolean {
  const text = compact(`${result.title ?? ""} ${result.url ?? ""} ${result.content ?? ""}`);
  const propertyName = normalizeReportInput(input).propertyName;
  if (!matchesPropertyName(propertyName, text, strict)) return false;
  if (conflictsWithPropertyName(propertyName, text)) return false;
  return true;
}

function dedupeCitations(citations: ReportCitation[]): ReportCitation[] {
  const seen = new Set<string>();
  return citations.filter((citation) => {
    const key = citation.url.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function relevanceScore(input: PropertyReportInput, result: TavilyResult): number {
  const haystack = `${result.title ?? ""} ${result.url ?? ""} ${result.content ?? ""}`.toLowerCase();
  return relevanceText(input).reduce((score, term) => score + (haystack.includes(term) ? 1 : 0), 0);
}

export interface ReportResearchResult {
  propertyName: string;
  summary: string;
  pricingTrend: string;
  sentiment: Sentiment;
  sources: ReportCitation[];
  comparableListings?: ReportComparableListing[];
}

export interface ReportResearchProvider {
  research(input: PropertyReportInput): Promise<ReportResearchResult>;
}

export interface ReportResearchEnv {
  REPORT_RESEARCH_PROVIDER?: string;
  REPORT_RESEARCH_ENDPOINT?: string;
  REPORT_RESEARCH_API_KEY?: string;
  TAVILY_API_KEY?: string;
  TAVILY_SEARCH_DEPTH?: string;
  TAVILY_MAX_RESULTS?: string;
}

interface TavilyResult {
  title?: string;
  url?: string;
  content?: string;
}

interface TavilyResponse {
  answer?: string;
  results?: TavilyResult[];
}

interface TavilyLaneResult {
  answer: string;
  sources: ReportCitation[];
  comparableListings?: ReportComparableListing[];
}

function sourceNameFromUrl(value: string): string | undefined {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

function parseFirstNumber(text: string, pattern: RegExp): number | undefined {
  const match = text.match(pattern);
  if (!match?.[1]) return undefined;
  const value = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function parseAskingPriceRm(text: string): number | undefined {
  const match = text.match(/\bRM\s*([0-9][0-9,]*(?:\.\d+)?)\s*(k|m|million|mil)?\b/i);
  if (!match?.[1]) return undefined;
  let value = Number(match[1].replace(/,/g, ""));
  if (!Number.isFinite(value) || value <= 0) return undefined;
  
  const suffix = match[2]?.toLowerCase();
  if (suffix === "k") {
    value *= 1000;
  } else if (suffix === "m" || suffix === "million" || suffix === "mil") {
    value *= 1000000;
  }
  return value;
}

function parseBuiltUpSqft(text: string): number | undefined {
  return parseFirstNumber(text, /\b([0-9][0-9,]{2,5})\s*(?:sq\.?\s*ft|sqft|sf|square feet)\b/i);
}

function parseBedrooms(text: string): number | undefined {
  return parseFirstNumber(text, /\b([0-9]+)\s*(?:bedrooms?|beds?|br|bilik)\b/i);
}

function parseBathrooms(text: string): number | undefined {
  return parseFirstNumber(text, /\b([0-9]+)\s*(?:bathrooms?|baths?|ba)\b/i);
}

function inferListingIntent(text: string, fallback?: ListingIntent): ListingIntent | undefined {
  if (/\b(for rent|rental|sewa|rent)\b/i.test(text)) return "rent";
  if (/\b(for sale|sale|sell|jual|asking price)\b/i.test(text)) return "sale";
  return fallback === "sale" || fallback === "rent" ? fallback : undefined;
}

function extractComparableListing(input: PropertyReportInput, result: TavilyResult): ReportComparableListing | null {
  if (!result.title?.trim() || !result.url?.trim() || !isHttpUrl(result.url)) return null;
  if (!isTrustedListingUrl(result.url) || isSocialListingUrl(result.url)) return null;

  const propertyName = normalizeReportInput(input).propertyName;
  const title = compact(result.title);
  if (!matchesPropertyName(propertyName, title, true)) return null;
  if (conflictsWithPropertyName(propertyName, title)) return null;
  if (isLandedListingTitle(title)) return null;

  const isDirectory = /\b(?:directory|list of|search results|find properties|all listings|results for|properties in)\b/i.test(title) ||
                      /^\d+\s+(?:houses?|condos?|properties?|apartments?|units?|flats?|residences?|listings?)\b/i.test(title) ||
                      /\b\d+\s+items\b/i.test(title);
  if (isDirectory) return null;

  const text = compact(`${result.title} ${result.content ?? ""}`);
  const parsedPrice = parseAskingPriceRm(text);

  const intent = inferListingIntent(text, input.listingIntent);
  if (parsedPrice !== undefined) {
    if (intent === "rent" && parsedPrice < 150) {
      return null; // garbage price matched
    } else if (intent === "sale" && parsedPrice < 30000) {
      return null; // garbage price matched
    }
  }

  return {
    title: compact(result.title),
    sourceName: sourceNameFromUrl(result.url),
    url: compact(result.url),
    askingPriceRm: parsedPrice,
    builtUpSqft: parseBuiltUpSqft(text),
    bedrooms: parseBedrooms(text),
    bathrooms: parseBathrooms(text),
    listingIntent: intent,
    snippet: result.content ? compact(result.content) : undefined,
  };
}

export function createFallbackResearch(input: PropertyReportInput): ReportResearchResult {
  const normalized = normalizeReportInput(input);
  const compactLocation = normalized.address.replace(/\s+/g, " ").trim();
  const propertyTypeLabel = input.propertyType?.trim()?.toLowerCase() || "property";
  const density = normalized.sqft > 0 ? normalized.sqft / Math.max(1, normalized.bedrooms + normalized.bathrooms) : 0;
  const pricingTrend =
    normalized.listingIntent === "rent"
      ? "Rental yield positioning"
      : density >= 300 || normalized.askingPriceRm >= 1_000_000
        ? "Premium pricing resilience"
        : "Balanced pricing discovery";
  const intentPhrase = input.listingIntent
    ? input.listingIntent === "sale"
      ? "for sale"
      : input.listingIntent === "rent"
        ? "for rent"
        : `for ${input.listingIntent}`
    : "for market review";
  const tenurePhrase = input.tenure && input.tenure !== "unknown" ? `${input.tenure} ` : "";
  const notes = normalized.sourceNotes ? ` Agent notes: ${normalized.sourceNotes}` : "";

  return {
    propertyName: normalized.propertyName || compactLocation,
    summary: `${normalized.propertyName || compactLocation} is modelled as a ${tenurePhrase}${propertyTypeLabel} ${intentPhrase} with ${formatRm(normalized.askingPriceRm)} in ${compactLocation}. Buyer interest is driven by location quality, usable space, and recent market comparables.${notes}`,
    pricingTrend,
    sentiment: normalized.propertyType.toLowerCase().includes("condo") ? "positive" : "neutral",
    sources: [
      {
        title: "Signatis deterministic market model",
        url: "https://signatis.app/research/static-market-model",
        snippet: "Fallback model used when live research is unavailable.",
        sourceType: "model",
      },
    ],
  };
}

export function createFallbackResearchProvider(): ReportResearchProvider {
  return {
    async research(input) {
      return createFallbackResearch(input);
    },
  };
}

export function createHttpResearchProvider(env: ReportResearchEnv): ReportResearchProvider | null {
  if (env.REPORT_RESEARCH_PROVIDER !== "http" || !env.REPORT_RESEARCH_ENDPOINT) {
    return null;
  }

  return {
    async research(input) {
      const response = await fetch(env.REPORT_RESEARCH_ENDPOINT as string, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(env.REPORT_RESEARCH_API_KEY ? { Authorization: `Bearer ${env.REPORT_RESEARCH_API_KEY}` } : {}),
        },
        body: JSON.stringify({ input }),
      });

      if (!response.ok) {
        throw new Error(`Report research provider failed with ${response.status}`);
      }

      return (await response.json()) as ReportResearchResult;
    },
  };
}

export function createTavilyResearchProvider(env: ReportResearchEnv): ReportResearchProvider {
  if (!env.TAVILY_API_KEY) {
    throw new Error("Missing environment variable TAVILY_API_KEY");
  }

  return {
    async research(input) {
      const normalized = normalizeReportInput(input);
      async function searchLane(sourceType: TavilySourceLane): Promise<TavilyLaneResult> {
        const response = await fetch("https://api.tavily.com/search", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${env.TAVILY_API_KEY}`,
          },
          body: JSON.stringify({
            query: buildTavilyQuery(input, sourceType),
            search_depth: normalizeSearchDepth(env.TAVILY_SEARCH_DEPTH),
            max_results: parseMaxResults(env.TAVILY_MAX_RESULTS),
            country: "malaysia",
            include_answer: true,
            topic: "general",
          }),
        });

        if (!response.ok) {
          throw new Error(`Tavily search failed with ${response.status}`);
        }

        const payload = (await response.json()) as TavilyResponse;
        const sortedResults = [...(payload.results ?? [])]
          .filter((result) => {
            if (sourceType === "community" && result.url && isPortalListingUrl(result.url)) {
              return false;
            }
            return passesPropertyNameGate(input, result, sourceType === "comparable_listing");
          })
          .sort((left, right) => relevanceScore(input, right) - relevanceScore(input, left));
        const sources = sortedResults
          .filter((result) => result.title?.trim() && result.url?.trim() && isHttpUrl(result.url))
          .map((result): ReportCitation => ({
            title: compact(result.title as string),
            url: compact(result.url as string),
            snippet: result.content ? compact(result.content) : undefined,
            sourceType,
          }))
          .slice(0, parseMaxResults(env.TAVILY_MAX_RESULTS));
        const comparableListings = sourceType === "comparable_listing"
          ? sortedResults
            .map((result) => extractComparableListing(input, result))
            .filter((listing): listing is ReportComparableListing => Boolean(listing))
            .slice(0, parseMaxResults(env.TAVILY_MAX_RESULTS))
          : undefined;

        return {
          answer: compact(payload.answer ?? sortedResults.find((result) => result.content?.trim())?.content ?? ""),
          sources,
          comparableListings,
        };
      }

      const [official, community, comparable] = await Promise.all([
        searchLane("official"),
        searchLane("community"),
        searchLane("comparable_listing").catch((): TavilyLaneResult => ({
          answer: "",
          sources: [],
          comparableListings: [],
        })),
      ]);
      const sources = dedupeCitations([...official.sources, ...community.sources, ...comparable.sources]);
      const summary = compact([
        official.answer ? `Official/listing signals: ${official.answer}` : "",
        community.answer ? `Community/user signals: ${community.answer}` : "",
        comparable.answer ? `Current listing signals: ${comparable.answer}` : "",
      ].filter(Boolean).join(" "));

      if (!summary) {
        throw new Error("Tavily search returned no usable summary.");
      }

      if (sources.length === 0) {
        throw new Error("Tavily search returned no valid citations.");
      }

      return {
        propertyName: normalized.propertyName,
        summary,
        pricingTrend: normalized.listingIntent === "rent"
          ? "Rental yield positioning"
          : normalized.askingPriceRm >= 1_000_000
            ? "Premium pricing resilience"
            : "Balanced pricing discovery",
        sentiment: /complaint|aduan|bising|noise|defect|masalah|midnight|track record/i.test(community.answer)
          ? "negative"
          : normalized.propertyType.toLowerCase().includes("condo") ? "positive" : "neutral",
        sources,
        comparableListings: comparable.comparableListings ?? [],
      };
    },
  };
}

export function createReportResearchProvider(env: ReportResearchEnv): ReportResearchProvider {
  if (env.TAVILY_API_KEY && (env.REPORT_RESEARCH_PROVIDER === "tavily" || !env.REPORT_RESEARCH_PROVIDER || env.REPORT_RESEARCH_PROVIDER === "static")) {
    return createTavilyResearchProvider(env);
  }

  return createHttpResearchProvider(env) ?? createFallbackResearchProvider();
}
