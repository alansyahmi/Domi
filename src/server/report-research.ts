import type { PropertyReportInput, ReportCitation, Sentiment } from "../types";
import { normalizeReportInput } from "../domain/reports";

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
  if (!Number.isFinite(parsed)) return 5;
  return Math.max(1, Math.min(20, Math.floor(parsed)));
}

function buildTavilyQuery(input: PropertyReportInput): string {
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
    "Malaysia property listing market information",
  ].filter(Boolean).join(" "));
}

function relevanceText(input: PropertyReportInput): string[] {
  const normalized = normalizeReportInput(input);
  return [normalized.propertyName, normalized.address]
    .flatMap((value) => value.toLowerCase().split(/[^a-z0-9]+/))
    .filter((part) => part.length >= 3);
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
      const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.TAVILY_API_KEY}`,
        },
        body: JSON.stringify({
          query: buildTavilyQuery(input),
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
      const sortedResults = [...(payload.results ?? [])].sort((left, right) => relevanceScore(input, right) - relevanceScore(input, left));
      const sources = sortedResults
        .filter((result) => result.title?.trim() && result.url?.trim() && isHttpUrl(result.url))
        .map((result): ReportCitation => ({
          title: compact(result.title as string),
          url: compact(result.url as string),
          snippet: result.content ? compact(result.content) : undefined,
        }))
        .slice(0, parseMaxResults(env.TAVILY_MAX_RESULTS));
      const summary = compact(payload.answer ?? sortedResults.find((result) => result.content?.trim())?.content ?? "");

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
        sentiment: normalized.propertyType.toLowerCase().includes("condo") ? "positive" : "neutral",
        sources,
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
