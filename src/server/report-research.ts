import type { ListingIntent, PropertyReportInput, ReportCitation, ReportCitationSourceType, ReportComparableListing, ReportUnitTypeVariation, Sentiment } from "../types";
import { conflictsWithPropertyName, matchesPropertyName, normalizeReportInput, propertyNameTokens } from "../domain/reports";

const MAX_TAVILY_RESULTS_PER_LANE = 20;
const MAX_TAVILY_EXTRACT_URLS = 10;
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
  if (!value) return "advanced";
  if (value === "basic" || value === "advanced" || value === "fast" || value === "ultra-fast") return value;
  return "advanced";
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

function buildLocationVariants(input: PropertyReportInput): string[] {
  const normalized = normalizeReportInput(input);
  const raw = [normalized.propertyName, normalized.address]
    .map((value) => value.trim())
    .filter(Boolean);
  const variants = new Set<string>();
  const prefixVariants: Array<[RegExp, string]> = [
    [/^taman\s+/i, "Tmn "],
    [/^tmn\s+/i, "Taman "],
    [/^bandar\s+/i, "Bdr "],
    [/^bdr\s+/i, "Bandar "],
    [/^jalan\s+/i, "Jln "],
    [/^jln\s+/i, "Jalan "],
    [/^lorong\s+/i, "Lrg "],
    [/^lrg\s+/i, "Lorong "],
    [/^seksyen\s+/i, "Sek "],
    [/^sek\s+/i, "Seksyen "],
    [/^bukit\s+/i, "Bt "],
    [/^bt\s+/i, "Bukit "],
    [/^kampung\s+/i, "Kg "],
    [/^kampong\s+/i, "Kg "],
    [/^kg\s+/i, "Kampung "],
    [/^menara\s+/i, "Mnr "],
    [/^mnr\s+/i, "Menara "],
  ];

  for (const value of raw) {
    variants.add(value);
    for (const [pattern, replacement] of prefixVariants) {
      if (pattern.test(value)) {
        variants.add(value.replace(pattern, replacement));
      }
    }
    variants.add(value.replace(/^taman\s+/i, ""));
    variants.add(value.replace(/^bandar\s+/i, ""));
    variants.add(value.replace(/^jalan\s+/i, ""));
    variants.add(value.replace(/^lorong\s+/i, ""));
    variants.add(value.replace(/^seksyen\s+/i, ""));
    variants.add(value.replace(/^bukit\s+/i, ""));
    variants.add(value.replace(/^kampung\s+/i, ""));
    variants.add(value.replace(/^kampong\s+/i, ""));
    variants.add(value.replace(/^menara\s+/i, ""));
  }

  return [...variants].map((value) => compact(value)).filter((value, index, arr) => Boolean(value) && arr.indexOf(value) === index);
}

type TavilySourceLane = Extract<ReportCitationSourceType, "official" | "community" | "comparable_listing" | "transaction" | "neighborhood">;

function buildTavilyQueryVariations(input: PropertyReportInput, sourceType: TavilySourceLane): string[] {
  const base = buildBaseTavilyQuery(input);
  const propertyName = input.propertyName?.trim() || "property";
  const area = input.address?.trim()?.split(",")[0] || propertyName;
  const addressParts = input.address?.trim()?.split(",") ?? [];
  const city = addressParts.length > 1 ? addressParts[addressParts.length - 1].trim() : "Malaysia";
  const locationVariants = buildLocationVariants(input);
  const primaryLocation = locationVariants[0] || propertyName;
  const secondaryLocation = locationVariants[1] || area;

  if (sourceType === "official") {
    return [
      compact(`${base} official developer listing sales gallery property portal Malaysia`),
      compact(`"${primaryLocation}" official listing developer Malaysia`),
      compact(`"${propertyName}" developer pricing brochure "official launch" pakej harga maklumat pemaju hartanah Malaysia`),
    ];
  }
  if (sourceType === "comparable_listing") {
    const intentPart = input.listingIntent === "rent" ? '"for rent"' : input.listingIntent === "sale" ? '"for sale"' : '("for sale" OR "for rent")';
    const rentSuffix = input.listingIntent === "rent" ? ' "per month" OR monthly OR sebulan OR "monthly rental"' : "";
    return [
      // Portal + Facebook listing sweep
      compact(`"${propertyName}" ${intentPart} site:iproperty.com.my OR site:propertyguru.com.my OR site:mudah.my OR site:facebook.com`),
      // Structured listing specs (portal detail pages)
      compact(`"${propertyName}" ${intentPart} price built-up sqft bedrooms bathrooms "${area}"`),
      // Social media / informal post pricing — cast a wider net with price keywords
      compact(`"${propertyName}" ${intentPart} RM OR harga OR price OR nego OR negotiable "${area}"`),
      // Facebook group posts specifically — the site: operator targets them
      compact(`"${propertyName}" ${intentPart} RM OR BND OR harga site:facebook.com`),
      // Rental-specific: capture monthly rates in informal posts
      compact(`"${primaryLocation}" ${intentPart} "RM" OR price OR harga${rentSuffix} sqft bedrooms "${area}"`),
    ];
  }
  if (sourceType === "transaction") {
    return [
      compact(`"${propertyName}" transacted price "sold price" transaction NPL "last transacted" site:brickz.my OR site:edgeprop.my "${area}" Malaysia`),
      compact(`"${primaryLocation}" transacted price sold price Malaysia`),
      compact(`"${propertyName}" harga transaksi urusniaga dijual NPL brickz edgeprop "${area}" Malaysia`),
    ];
  }
  if (sourceType === "neighborhood") {
    return [
      compact(`"${area}" nearby facilities amenities "within walking distance" OR "minutes walk" OR "short drive" school "primary school" OR "secondary school" mall OR "shopping mall" hospital OR clinic LRT OR MRT station upcoming infrastructure development project "${city}" Malaysia`),
      compact(`"${primaryLocation}" kemudahan berdekatan sekolah klinik hospital mall stesen LRT MRT pembangunan infrastruktur kawasan perumahan "${city}" Malaysia`),
      compact(`"${secondaryLocation}" nearby facilities school hospital mall MRT "${city}" Malaysia`),
    ];
  }

  // community lane (default)
  return [
    compact(`${base} review complaint forum resident experience noise midnight defects maintenance parking developer track record Malay English ulasan aduan forum komuniti pengalaman penghuni bising malam masalah -site:propertyguru.com.my -site:iproperty.com.my`),
    compact(`"${propertyName}" ulasan penghuni masalah aduan komuniti forum review pengalaman residents "${area}"`),
    compact(`"${primaryLocation}" forum resident review complaint parking noise maintenance Malaysia`),
    // Pricing signals in community discussions: is it worth the price?
    compact(`"${propertyName}" harga berbaloi mahal murah worth price overpriced "${area}"`),
  ];
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

function isComparableListingDetailUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.replace(/^www\d*\./, "");
    const path = parsed.pathname.toLowerCase();

    if (host === "mudah.my") {
      return /\/.+\d{6,}\.htm$/i.test(path) && !parsed.search;
    }

    if (host === "propertyguru.com.my") {
      return /^\/property-listing\/[^\s/?#]+$/i.test(path) && !parsed.search;
    }

    if (host === "iproperty.com.my") {
      return /\/(?:sale|rent)-\d+\/?$/i.test(path) && !parsed.search;
    }

    if (host === "facebook.com" || host.endsWith(".facebook.com")) {
      return /\/(?:posts|marketplace\/item|groups\/[^/]+\/(?:permalink|posts)|share\/p)\b/i.test(path) && !parsed.search;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Detect search-result / directory / browse page URLs that do NOT represent
 * individual listing detail pages. Only listing detail pages carry concrete
 * data (price, sqft, bedrooms) needed for reliable comparable analysis.
 *
 * This inspects URL path and query structure — independent of page title —
 * so search pages are rejected even when their title lacks obvious keywords.
 */
export function isSearchResultUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    const path = parsed.pathname.toLowerCase();
    const search = parsed.search.toLowerCase();
    const host = parsed.hostname.replace(/^www\d*\./, "");

    // Generic query-param search indicators (any site)
    if (/\b[qk]=(?!$)/i.test(search)) return true;
    if (/\b(query|keyword|search|term|text)=/i.test(search)) return true;

    // Generic path-based search/directory indicators (any site)
    if (/\/(search|find|browse|catalog|category|all-listings|results)\b/i.test(path)) return true;

    // "for-sale" or "for-rent" with query params = search, not listing
    if (/\/for-(sale|rent)\?/i.test(path + (search ? "?" : ""))) return true;

    // Mudah.my specific
    if (host === "mudah.my") {
      // Individual listing: /<title-slug>-<digits>.htm
      if (/\/.+\d{6,}\.htm$/i.test(path)) return false;
      // /<location>/for-sale or /<location>/for-rent (with or without query) = search
      if (/\/for-(sale|rent)/i.test(path)) return true;
      // Any path with search query params on mudah = search page
      if (search) return true;
    }

    // PropertyGuru specific
    if (host === "propertyguru.com.my") {
      // Individual listing: /property-listing/<title>-<id>
      if (/\/property-listing\//i.test(path)) return false;
      if (search) return true;
    }

    // iProperty specific
    if (host === "iproperty.com.my") {
      // Individual listing: …/sale-<digits> or …/rent-<digits>
      if (/\/(?:sale|rent)-\d+$/i.test(path)) return false;
      if (/\/search/i.test(path) || search) return true;
    }

    // EdgeProp specific
    if (host === "edgeprop.my") {
      // /buy or /rent paths are search/browse, not individual listings
      if (/\/(?:buy|rent)\b/i.test(path)) return true;
    }

    // Facebook Marketplace — individual listing posts have /posts/ or /marketplace/item/
    if (host === "facebook.com" || host.endsWith(".facebook.com")) {
      if (/\/(?:posts|marketplace\/item|groups\/[^/]+\/permalink)\b/i.test(path)) return false;
      if (search) return true;
    }

    // Generic: any URL with query params on a known listing portal is suspicious
    if (search) return true;

    return false;
  } catch {
    return true; // unparseable URL → reject
  }
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
  transactedPrices?: Array<{ priceRm: number; transactedDate?: string; unitType?: string; builtUpSqft?: number; sourceName?: string; sourceUrl?: string; isAskingFallback?: boolean }>;
  neighborhoodContext?: {
    facilities: Array<{ name: string; type: string; rating?: number; distance?: string }>;
    infrastructure: Array<{ name: string; type: string; distanceKm?: number; completionYear?: number; status?: string; sourceUrl?: string }>;
  };
  developerName?: string;
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
  /** Set to "off" to skip the per-listing page extraction step. Defaults on. */
  TAVILY_EXTRACT?: string;
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

interface TavilyExtractItem {
  url?: string;
  raw_content?: string;
}

interface TavilyExtractResponse {
  results?: TavilyExtractItem[];
  failed_results?: unknown[];
}

const MAX_EXTRACT_CONTENT_CHARS = 8000;

/**
 * Pull the full page content for a handful of listing URLs via Tavily's
 * /extract endpoint. Search only returns short snippets; extract returns the
 * full listing body so we can parse exact price/sqft/bed/bath.
 *
 * Fully defensive: any failure returns an empty map so callers transparently
 * fall back to the search snippet. Caps URLs to control credit spend.
 */
async function tavilyExtractListings(apiKey: string, urls: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const target = urls.slice(0, MAX_TAVILY_EXTRACT_URLS);
  if (target.length === 0) return map;

  try {
    const response = await fetch("https://api.tavily.com/extract", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ urls: target, extract_depth: "advanced" }),
    });
    if (!response.ok) return map;
    const payload = (await response.json()) as TavilyExtractResponse;
    for (const item of payload.results ?? []) {
      if (item.url && item.raw_content?.trim()) {
        map.set(item.url.trim().toLowerCase(), item.raw_content);
      }
    }
  } catch {
    // Network/parse failure — fall back to snippets.
  }
  return map;
}

interface TavilyLaneResult {
  answer: string;
  sources: ReportCitation[];
  comparableListings?: ReportComparableListing[];
  transactedPrices?: Array<{ priceRm: number; transactedDate?: string; unitType?: string; builtUpSqft?: number; sourceName?: string; sourceUrl?: string; isAskingFallback?: boolean }>;
  neighborhoodContext?: {
    facilities: Array<{ name: string; type: string; rating?: number; distance?: string }>;
    infrastructure: Array<{ name: string; type: string; distanceKm?: number; completionYear?: number; status?: string; sourceUrl?: string }>;
  };
  developerName?: string;
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

/**
 * Normalize a numeric string that may use commas or dots as thousands separators.
 * Handles: "1,234,567", "123.456.789", "1.234.567,89", "1,234,567.89", "1234567"
 */
function normalizeNumberStr(numStr: string): number {
  const hasComma = numStr.includes(",");
  const hasDot = numStr.includes(".");
  const dotCount = hasDot ? (numStr.match(/\./g)?.length ?? 0) : 0;
  const commaCount = hasComma ? (numStr.match(/,/g)?.length ?? 0) : 0;

  if (hasComma && hasDot) {
    // Both present: determine which is thousands and which is decimal
    const lastComma = numStr.lastIndexOf(",");
    const lastDot = numStr.lastIndexOf(".");
    if (lastDot > lastComma) {
      // "1,234,567.89" — commas are thousands, dot is decimal
      return Number(numStr.replace(/,/g, ""));
    }
    // "1.234.567,89" — dots are thousands, comma is decimal
    return Number(numStr.replace(/\./g, "").replace(",", "."));
  }
  if (dotCount > 1) {
    // Multiple dots: European thousands separator e.g. "123.000.000"
    return Number(numStr.replace(/\./g, ""));
  }
  if (dotCount === 1 && /\.\d{3}$/.test(numStr)) {
    // Single dot followed by exactly 3 digits: likely European thousands
    // separator (e.g. "450.000" → 450000). Property prices are rarely
    // specified to 3 decimal places, so treat this as thousands.
    return Number(numStr.replace(/\./g, ""));
  }
  if (commaCount > 1) {
    // Multiple commas: standard thousands separator e.g. "1,234,567"
    return Number(numStr.replace(/,/g, ""));
  }
  if (commaCount === 1 && /,\d{3}$/.test(numStr)) {
    // "1,500" — comma as thousands separator
    return Number(numStr.replace(/,/g, ""));
  }
  // Single comma with 1-2 trailing digits: decimal (e.g. "1500,50")
  // Single dot with 1-2 trailing digits: decimal (e.g. "1500.50")
  // No separators: plain number
  return Number(numStr.replace(/,/g, ""));
}

/** Suffix multipliers for price shorthand: "450k" → ×1000, "1.2m" → ×1000000 */
const PRICE_SUFFIX_MULTIPLIER: Record<string, number> = {
  k: 1000,
  ribu: 1000,
  m: 1000000,
  mil: 1000000,
  million: 1000000,
  juta: 1000000,
  jt: 1000000,
};

function applyPriceSuffix(value: number, suffix?: string): number {
  if (!suffix) return value;
  const multiplier = PRICE_SUFFIX_MULTIPLIER[suffix.toLowerCase()];
  return multiplier ? value * multiplier : value;
}

/**
 * Parse an asking price from text, supporting multiple currency formats
 * commonly found in Malaysian and Bruneian property listings:
 *
 *   RM 450,000 | RM450k | RM1.2m | BND 250,000 | B$350000 | $450,000
 *   RM 450.000 (dots as thousands) | RM 123 000 (spaces)
 *   RM 450,000 - RM 550,000 (ranges — takes the lower bound)
 *   harga RM 450k | price: 450,000 | asking 1.2 juta
 */
function parseAskingPriceRm(text: string): number | undefined {
  // Comprehensive currency-anchored pattern.
  // Group 1: number  |  Group 2: suffix (k/m/juta/etc.)
  const match = text.match(
    /\b(?:RM|BND|B\$|SGD)\s*([0-9][0-9.,]*(?:\.\d+)?)\s*(k|m|mil|million|juta|jt|ribu)?\b/i,
  );
  if (!match?.[1]) return undefined;
  const value = normalizeNumberStr(match[1]);
  if (!Number.isFinite(value) || value <= 0) return undefined;
  return applyPriceSuffix(value, match[2]);
}

/**
 * Fallback price parser for text that lacks a clear currency prefix.
 * Used for informal posts (Facebook, forums) where the price may be
 * implied by surrounding keywords rather than an explicit "RM" marker.
 *
 * Applies a plausibility floor (≥ 30000 for sale, ≥ 150 for rent) to
 * avoid matching unrelated numbers.
 */
function parseLoosePriceRm(text: string): number | undefined {
  const patterns: Array<{ re: RegExp; suffixGroup?: number }> = [
    // "asking price 450,000" / "price: 1.2m" / "harga RM 450k"
    {
      re: /\b(?:asking\s+price|price|priced\s+at|harga|jual|sewa)\s*:?\s*(?:rm\s*)?([0-9][0-9.,]*(?:\.\d+)?)\s*(k|m|mil|million|juta|jt|ribu)?\b/i,
      suffixGroup: 2,
    },
    // "RM 450k" but RM didn't trigger parseAskingPriceRm (edge case)
    {
      re: /\b(?:rm|bnd|b\$)\s*([0-9][0-9.,]*(?:\.\d+)?)\s*(k|m|mil|million|juta|jt|ribu)?\b/i,
      suffixGroup: 2,
    },
    // "$450,000" / "$ 450k" — dollar sign in property context
    {
      re: /\$\s*([0-9][0-9.,]*(?:\.\d+)?)\s*(k|m|mil|million|juta|jt)?\b/i,
      suffixGroup: 2,
    },
    // Number with suffix: "450k" / "1.2m" / "1.2 juta" (standalone with suffix)
    {
      re: /\b([0-9][0-9.,]*(?:\.\d+)?)\s*(k|m|mil|million|juta|jt)\b/i,
      suffixGroup: 2,
    },
    // Plain large number in a price-like position: "1,234,567" / "450.000"
    {
      re: /\b([0-9]{1,3}(?:[,.]\d{3}){1,3})\b/,
    },
  ];

  for (const { re, suffixGroup } of patterns) {
    const match = text.match(re);
    if (!match?.[1]) continue;
    const value = normalizeNumberStr(match[1]);
    if (!Number.isFinite(value) || value <= 0) continue;
    const scaled = suffixGroup ? applyPriceSuffix(value, match[suffixGroup]) : value;
    if (scaled >= 30000) return scaled;
  }

  return undefined;
}

/**
 * Aggressively extract any price-like number from social-media post text.
 * Facebook group posts often lack structured markup — the price is buried
 * in freeform text like:
 *
 *   "Taman Rimbunan Hijau for sale! 450k nego. 3BR 2BA"
 *   "Rumah untuk dijual. Harga: RM 350,000 boleh runding"
 *   "Monthly rental $1,200 unfurnished"
 *
 * This parser casts a wider net than parseLoosePriceRm but still requires
 * contextual signals (currency symbol, suffix, or price keyword in vicinity)
 * to avoid matching irrelevant numbers like sqft or phone numbers.
 */
function parsePriceFromSocialPost(text: string): number | undefined {
  const compactText = text.replace(/\s+/g, " ").trim();

  // Signal words that indicate a number near them might be a price
  const priceContextRe = /\b(?:price|harga|jual|sewa|sale|rent|asking|nego|negotiable|boleh\s*runding|monthly|per\s*month|priced|offer|offering|dijual|disewa|rm|bnd|b\$)\b/i;

  // If the text has no pricing context at all, don't guess
  if (!priceContextRe.test(compactText)) return undefined;

  // Try the structured parsers first
  const structured = parseAskingPriceRm(compactText);
  if (structured !== undefined) return structured;

  // Try loose patterns
  const loose = parseLoosePriceRm(compactText);
  if (loose !== undefined) return loose;

  // Broad sweep: any number ≥ 30000 near a price keyword
  // Look within a 100-char window around each price keyword
  priceContextRe.lastIndex = 0;
  let ctxMatch: RegExpExecArray | null;
  while ((ctxMatch = priceContextRe.exec(compactText)) !== null) {
    const windowStart = Math.max(0, ctxMatch.index - 60);
    const windowEnd = Math.min(compactText.length, ctxMatch.index + 100);
    const window = compactText.slice(windowStart, windowEnd);

    // Match any substantial number in this window
    const numRe = /\b([0-9][0-9.,]{2,}(?:\.\d+)?)\s*(k|m|mil|million|juta|jt)?\b/gi;
    let numMatch: RegExpExecArray | null;
    while ((numMatch = numRe.exec(window)) !== null) {
      const value = normalizeNumberStr(numMatch[1]);
      if (!Number.isFinite(value) || value <= 0) continue;
      const scaled = applyPriceSuffix(value, numMatch[2]);
      // Broad floor: most property prices in Malaysia/Brunei are ≥ 30000 for sale
      // or ≥ 150 for rent — accept anything plausibly priced
      if (scaled >= 150) return scaled;
    }
  }

  return undefined;
}

/** Detect explicit monthly rental phrasing to distinguish rent from sale prices. */
function isMonthlyRental(text: string): boolean {
  return /\b(?:per\s*month|monthly|\/month|\/mth|\/mo|sebulan|per\s*bulan|sewa\s*bulanan)\b/i.test(text);
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

function parseLooseRoomCounts(text: string): { bedrooms?: number; bathrooms?: number } {
  const compactText = compact(text);
  const shorthand = compactText.match(/\b([0-9]{1,2})\s*[bB]\s+([0-9]{1,2})\s*[bB]\b/);
  if (shorthand?.[1] && shorthand?.[2]) {
    const bedrooms = Number(shorthand[1]);
    const bathrooms = Number(shorthand[2]);
    return {
      bedrooms: Number.isFinite(bedrooms) && bedrooms > 0 ? bedrooms : undefined,
      bathrooms: Number.isFinite(bathrooms) && bathrooms > 0 ? bathrooms : undefined,
    };
  }

  const labeled = compactText.match(/\b([0-9]{1,2})\s*(?:bed(?:room)?s?|br)\s+([0-9]{1,2})\s*(?:bath(?:room)?s?|ba)\b/i);
  if (labeled?.[1] && labeled?.[2]) {
    const bedrooms = Number(labeled[1]);
    const bathrooms = Number(labeled[2]);
    return {
      bedrooms: Number.isFinite(bedrooms) && bedrooms > 0 ? bedrooms : undefined,
      bathrooms: Number.isFinite(bathrooms) && bathrooms > 0 ? bathrooms : undefined,
    };
  }

  return {};
}

function parseTrailingRoomCounts(title: string): { bedrooms?: number; bathrooms?: number } {
  // Matches trailing " 3 2" or " 3 2 1" at the end of listing titles (typical on iProperty/PropertyGuru)
  const match = title.trim().match(/\b([1-9])\s+([1-9])(?:\s+[0-9])?$/);
  if (match) {
    const bedrooms = Number(match[1]);
    const bathrooms = Number(match[2]);
    if (bedrooms <= 10 && bathrooms <= 10) {
      return { bedrooms, bathrooms };
    }
  }
  return {};
}


function parseMaintenanceFeePsf(text: string): number | undefined {
  const psfMatch = text.match(/\b(?:maintenance|sinking\s+fund|service\s+charge)\s*(?:fee|cost)?\s*:?\s*RM\s*([\d.]+)\s*(?:per\s*sqft|psf|\/sqft)/i);
  if (psfMatch) {
    const value = Number(psfMatch[1]);
    return Number.isFinite(value) && value > 0 ? value : undefined;
  }
  const monthlyMatch = text.match(/\bRM\s*([\d,]+)\s*\/\s*month/i);
  const sqftMatch = text.match(/\b([\d,]{3,})\s*sqft\b/i);
  if (monthlyMatch && sqftMatch) {
    const monthly = Number(monthlyMatch[1].replace(/,/g, ""));
    const sqft = Number(sqftMatch[1].replace(/,/g, ""));
    if (monthly > 0 && sqft > 0) return Number((monthly / sqft).toFixed(2));
  }
  return undefined;
}

interface TransactedPriceRaw {
  priceRm: number;
  date?: string;
  sqft?: number;
  isAskingFallback?: boolean;
}

function parseTransactedPrices(text: string, sourceName?: string): TransactedPriceRaw[] {
  const results: TransactedPriceRaw[] = [];
  const seen = new Set<number>();
  const CURRENCY = /(?:RM|BND|B\$|SGD)/.source;
  const patterns = [
    // "Transacted: RM 520,000 on 15 Jan 2026"
    new RegExp(`\\b(?:transacted|sold(?:\\s+price)?|NPL)\\s*:?\\s*${CURRENCY}\\s*([\\d,]+(?:\\.[\\d]+)?)\\s*(k|m|mil|million|juta|jt)?\\s*(?:on\\s+(\\d{1,2}\\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\\s+\\d{4}))?`, "gi"),
    // "RM 750,000 (Mar 2026)" near "sold" or "transacted" context
    new RegExp(`\\b${CURRENCY}\\s*([\\d,]+(?:\\.[\\d]+)?)\\s*(k|m|mil|million|juta|jt)?\\s*\\((\\d{1,2}\\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\\s+\\d{4})\\)`, "gi"),
    // "last transacted: RM 450k"
    new RegExp(`\\blast\\s+transacted\\s*:?\\s*${CURRENCY}\\s*([\\d,]+(?:\\.[\\d]+)?)\\s*(k|m|mil|million|juta|jt)?`, "gi"),
  ];
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      let price = normalizeNumberStr(match[1]);
      if (!Number.isFinite(price) || price <= 0 || seen.has(price)) continue;
      const suffix = match[2]?.toLowerCase();
      if (suffix) price = applyPriceSuffix(price, suffix);
      seen.add(price);
      const sqftMatch = text.match(/\b([\d,]{3,})\s*sqft\b/i);
      results.push({
        priceRm: price,
        date: match[3] || undefined,
        sqft: sqftMatch ? Number(sqftMatch[1].replace(/,/g, "")) : undefined,
      });
    }
  }
  return results.slice(0, 3);
}

export function extractUnitTypes(listings: ReportComparableListing[]): ReportUnitTypeVariation[] {
  const TITLE_TYPE_RE = /\b(?:type\s*([a-z])\b|unit\s*([a-z]))/i;
  const clusters = new Map<string, {
    bedrooms?: number;
    bathrooms?: number;
    sqftMin?: number;
    sqftMax?: number;
    priceMin?: number;
    priceMax?: number;
    count: number;
  }>();
  for (const listing of listings) {
    const typeMatch = (listing.title ?? "").match(TITLE_TYPE_RE) || listing.snippet?.match(TITLE_TYPE_RE);
    let key: string;
    if (typeMatch) {
      key = `type_${(typeMatch[1] || typeMatch[2]).toUpperCase()}`;
    } else if (listing.bedrooms && listing.bathrooms) {
      key = `${listing.bedrooms}BR_${listing.bathrooms}BA`;
    } else if (listing.bedrooms) {
      key = `${listing.bedrooms}BR`;
    } else {
      key = "unknown_type";
    }
    const existing = clusters.get(key);
    if (existing) {
      existing.count++;
      if (listing.builtUpSqft) {
        existing.sqftMin = existing.sqftMin !== undefined ? Math.min(existing.sqftMin, listing.builtUpSqft) : listing.builtUpSqft;
        existing.sqftMax = existing.sqftMax !== undefined ? Math.max(existing.sqftMax, listing.builtUpSqft) : listing.builtUpSqft;
      }
      if (listing.askingPriceRm) {
        existing.priceMin = existing.priceMin !== undefined ? Math.min(existing.priceMin, listing.askingPriceRm) : listing.askingPriceRm;
        existing.priceMax = existing.priceMax !== undefined ? Math.max(existing.priceMax, listing.askingPriceRm) : listing.askingPriceRm;
      }
    } else {
      clusters.set(key, {
        bedrooms: listing.bedrooms,
        bathrooms: listing.bathrooms,
        sqftMin: listing.builtUpSqft,
        sqftMax: listing.builtUpSqft,
        priceMin: listing.askingPriceRm,
        priceMax: listing.askingPriceRm,
        count: 1,
      });
    }
  }
  const variations: ReportUnitTypeVariation[] = [];
  for (const [key, cluster] of clusters) {
    let name = key;
    if (cluster.bedrooms && cluster.bathrooms) {
      name = `Type ${cluster.bedrooms}BR ${cluster.bathrooms}BA`;
    } else if (cluster.bedrooms) {
      name = `Type ${cluster.bedrooms}BR`;
    }
    variations.push({
      name,
      bedrooms: cluster.bedrooms,
      bathrooms: cluster.bathrooms,
      builtUpSqftMin: cluster.sqftMin,
      builtUpSqftMax: cluster.sqftMax,
      askingPriceRmMin: cluster.priceMin,
      askingPriceRmMax: cluster.priceMax,
      listingCount: cluster.count,
    });
  }
  return variations.sort((a, b) => (b.listingCount ?? 0) - (a.listingCount ?? 0));
}

function parseNeighborhoodContext(results: TavilyResult[]): {
  facilities: Array<{ name: string; type: string; rating?: number; distance?: string }>;
  infrastructure: Array<{ name: string; type: string; distanceKm?: number; completionYear?: number; status?: string; sourceUrl?: string }>;
} {
  const facilities: Array<{ name: string; type: string; rating?: number; distance?: string }> = [];
  const infrastructure: Array<{ name: string; type: string; distanceKm?: number; completionYear?: number; status?: string; sourceUrl?: string }> = [];
  const seenFacility = new Set<string>();
  const seenInfra = new Set<string>();
  const FACILITY_RE = /(\d+)\s*(?:mins?(?:\s*(?:walk|drive))|km)\s*(?:to|from)?\s*([A-Z][A-Za-z\s]+?)(?:school|mall|hospital|clinic|LRT|MRT|station|supermarket|park|mosque|temple)/gi;
  const INFRA_RE = /(?:MRT|LRT|highway|expressway)\s*(?:line|station|extension|project)?\s*([A-Za-z][A-Za-z\s\d]+?)(?:\s*(?:by|completing|completed|expected|scheduled)\s*(\d{4}))?/gi;

  for (const result of results) {
    const text = compact(`${result.title ?? ""} ${result.content ?? ""}`);
    FACILITY_RE.lastIndex = 0;
    let fmatch: RegExpExecArray | null;
    while ((fmatch = FACILITY_RE.exec(text)) !== null) {
      const distance = fmatch[1];
      const name = compact(fmatch[2] || "nearby facility");
      const key = name.toLowerCase();
      if (seenFacility.has(key)) continue;
      seenFacility.add(key);
      const typeMatch = text.slice(fmatch.index, fmatch.index + 120).match(/\b(school|hospital|clinic|mall|LRT|MRT|station|supermarket|park|mosque|temple)\b/i);
      facilities.push({
        name: `${name}${typeMatch ? ` ${typeMatch[1]}` : ""}`.trim(),
        type: typeMatch?.[1]?.toLowerCase() || "other",
        distance: `${distance} mins`,
      });
    }

    INFRA_RE.lastIndex = 0;
    let imatch: RegExpExecArray | null;
    while ((imatch = INFRA_RE.exec(text)) !== null) {
      const projectName = compact(imatch[1] || "upcoming project");
      const key = projectName.toLowerCase();
      if (seenInfra.has(key)) continue;
      seenInfra.add(key);
      const year = imatch[2] ? Number(imatch[2]) : undefined;
      const typeCheck = text.slice(Math.max(0, imatch.index - 20), imatch.index + 100);
      infrastructure.push({
        name: projectName,
        type: /MRT/i.test(typeCheck) ? "mrt" : /LRT/i.test(typeCheck) ? "lrt" : /highway|expressway/i.test(typeCheck) ? "highway" : "other",
        distanceKm: undefined,
        completionYear: year && year >= 2026 && year <= 2030 ? year : undefined,
        status: /under construction/i.test(typeCheck) ? "under construction" : /planned/i.test(typeCheck) ? "planned" : /approved/i.test(typeCheck) ? "approved" : undefined,
        sourceUrl: result.url,
      });
    }
  }
  return { facilities: facilities.slice(0, 8), infrastructure: infrastructure.slice(0, 5) };
}

function parseDeveloperName(text: string): string | undefined {
  const patterns = [
    /\bdeveloped\s+by\s+([A-Z][A-Za-z0-9\s&]+?)(?:\.|,|\s*$|\s+(?:and|with|in|at|near|is|a))/i,
    /\b([A-Z][A-Za-z0-9\s&]+?)\s+(?:Development|Developments|Group|Holdings|Properties|Berhad|Bhd|Sdn)\b/i,
    /\bpemaju\s*:?\s*([A-Z][A-Za-z0-9\s&]+?)(?:\.|,|$)/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return compact(match[1]);
    }
  }
  return undefined;
}

function inferListingIntent(text: string, fallback?: ListingIntent): ListingIntent | undefined {
  if (/\b(for rent|rental|sewa|rent|disewa|penyewa|tenant|monthly|per\s*month|\/mth|\/mo|sebulan)\b/i.test(text)) return "rent";
  if (/\b(for sale|sale|sell|jual|asking price|dijual|penjual)\b/i.test(text)) return "sale";
  return fallback === "sale" || fallback === "rent" ? fallback : undefined;
}

function extractComparableListing(
  input: PropertyReportInput,
  result: TavilyResult,
  fullContent?: string,
): ReportComparableListing | null {
  if (!result.title?.trim() || !result.url?.trim() || !isHttpUrl(result.url)) return null;
  if (!isTrustedListingUrl(result.url) || isSocialListingUrl(result.url)) return null;
  if (!isComparableListingDetailUrl(result.url)) return null;

  const propertyName = normalizeReportInput(input).propertyName;
  const title = compact(result.title);
  if (!matchesPropertyName(propertyName, title, true)) return null;
  if (conflictsWithPropertyName(propertyName, title)) return null;
  if (isLandedListingTitle(title)) return null;

  // Reject anything that is not a direct listing detail page.
  if (result.url && !isComparableListingDetailUrl(result.url)) return null;

  const isDirectory = /\b(?:directory|list of|search results|find properties|all listings|results for|properties in)\b/i.test(title) ||
                      /^\d+\s+(?:houses?|condos?|properties?|apartments?|units?|flats?|residences?|listings?)\b/i.test(title) ||
                      /\b\d+\s+items\b/i.test(title) ||
                      /\b\d+\s*(?:results?|listings?|properties?|units?|ads?)\s*(?:found|available|matching|for)\b/i.test(title) ||
                      /\b(?:search|filter|sort)\s*(?:results?|by|page)\b/i.test(title) ||
                      /\bfor\s+(?:sale|rent)\s+in\b/i.test(title);
  if (isDirectory) return null;

  // Prefer the full extracted page content (exact specs) over the search snippet.
  const detail = (fullContent?.trim() ? fullContent : result.content ?? "").slice(0, MAX_EXTRACT_CONTENT_CHARS);
  const text = compact(`${result.title} ${detail}`);
  const sourceHost = result.url ? hostFromUrl(result.url) : undefined;
  const isSocialSource = sourceHost === "facebook.com" || sourceHost?.endsWith?.(".facebook.com");

  // Cascading price parsers: strict → loose → social-post
  const strictPrice = parseAskingPriceRm(text);
  const loosePrice = strictPrice === undefined ? parseLoosePriceRm(text) : undefined;
  const socialPrice = (strictPrice ?? loosePrice) === undefined && isSocialSource
    ? parsePriceFromSocialPost(text)
    : undefined;
  const parsedPrice = strictPrice ?? loosePrice ?? socialPrice;
  const looseRooms = parseLooseRoomCounts(text);
  const priceNote = parsedPrice !== undefined && (strictPrice === undefined || isSocialSource)
    ? "Price inferred from post text."
    : undefined;

  // Detect rental intent: explicit keywords override the fallback
  const monthlyRental = isMonthlyRental(text);
  const intent = monthlyRental ? "rent" : inferListingIntent(text, input.listingIntent);
  if (parsedPrice !== undefined) {
    if (intent === "rent" && parsedPrice < 150) {
      return null; // garbage price matched
    } else if (intent !== "rent" && parsedPrice < 30000) {
      return null; // garbage price matched
    }
  }

  const trailingRooms = parseTrailingRoomCounts(result.title ?? "");

  return {
    title: compact(result.title),
    sourceName: sourceNameFromUrl(result.url),
    url: compact(result.url),
    askingPriceRm: parsedPrice,
    builtUpSqft: parseBuiltUpSqft(text),
    bedrooms: parseBedrooms(text) ?? looseRooms.bedrooms ?? trailingRooms.bedrooms,
    bathrooms: parseBathrooms(text) ?? looseRooms.bathrooms ?? trailingRooms.bathrooms,
    listingIntent: intent,
    snippet: result.content ? compact(result.content) : undefined,
    priceNote,
  };
}

interface ParsedListingCard {
  title: string;
  url: string;
  askingPriceRm?: number;
  builtUpSqft?: number;
  bedrooms?: number;
  bathrooms?: number;
}

// PropertyGuru and iProperty index pages both render each unit as a compact
// data line: "RM <price>[ - RM <max>] RM <psf> psf ### <name> [<bed> <bath>
// <carpark> | * * *] <sqft>[ Sqft - <max>] sqft". Individual listing-detail
// pages are blocked by portal anti-bot, but these SEO index pages extract fine,
// so we parse the repeated unit cards out of them.
//
// Parsing is window-based around each "###" heading (robust to nested ![Image]
// markdown and template variance) rather than bracket-scoped.
const CARD_HEADING_RE = /#{2,3}[ \t]+/g;
// The "RM <price> RM <psf> psf" pair must sit immediately before the heading.
const CARD_PRICE_BEFORE_RE = /RM\s*([\d,]+)(?:\s*-\s*RM\s*[\d,]+)?\s+RM\s*[\d.,]+\s*psf(?:\s*-\s*RM\s*[\d.,]+\s*psf)?\s*$/i;
// After the heading: "<name> [<bed> <bath> [<carpark>]] <sqft> sqft". Beds/baths
// are 1-2 digit counts; sqft is 3+ digits — so it never swallows a count. The
// optional count cluster (or iProperty's "* * *") is stripped from the title.
const CARD_SPECS_AFTER_RE = /(?:(\d{1,2})\s+(\d{1,2})(?:\s+(\d{1,2}))?\s+)?([\d,]{3,})\s*Sq\s?\.?\s*ft/i;
const CARD_LISTING_URL_RE = /https:\/\/www\.propertyguru\.com\.my\/property-listing\/[^\s)"']+|https:\/\/www\.iproperty\.com\.my\/[^\s)"']*?(?:sale|rent)-\d+[^\s)"']*/i;

const MIN_PLAUSIBLE_SQFT = 200;
const MAX_PLAUSIBLE_SQFT = 50000;

/**
 * Reject implausible room counts from a mis-read number cluster. Beds/baths sit
 * in 1..20; a bath count far above beds (e.g. "1 7") almost always means the
 * cluster was misaligned, so drop both rather than show wrong data.
 */
function sanitizeRoomCounts(bed?: number, bath?: number): { bedrooms?: number; bathrooms?: number } {
  const bedrooms = bed && bed >= 1 && bed <= 20 ? bed : undefined;
  let bathrooms = bath && bath >= 1 && bath <= 20 ? bath : undefined;
  if (bedrooms !== undefined && bathrooms !== undefined && bathrooms > bedrooms + 3) {
    return { bedrooms: undefined, bathrooms: undefined };
  }
  // A bath count with no bed count comes from an unreliable cluster read.
  if (bedrooms === undefined) bathrooms = undefined;
  return { bedrooms, bathrooms };
}

function sanitizeSqft(value?: number): number | undefined {
  return value && value >= MIN_PLAUSIBLE_SQFT && value <= MAX_PLAUSIBLE_SQFT ? value : undefined;
}

export function parseListingIndexCards(rawContent: string): ParsedListingCard[] {
  const cards: ParsedListingCard[] = [];
  const seen = new Set<string>();
  CARD_HEADING_RE.lastIndex = 0;
  let heading: RegExpExecArray | null;
  while ((heading = CARD_HEADING_RE.exec(rawContent)) !== null) {
    const beforeWindow = compact(rawContent.slice(Math.max(0, heading.index - 240), heading.index));
    const priceMatch = beforeWindow.match(CARD_PRICE_BEFORE_RE);
    if (!priceMatch) continue; // heading is not a priced listing card

    const afterStart = heading.index + heading[0].length;
    const afterWindow = compact(rawContent.slice(afterStart, afterStart + 440));
    const specMatch = afterWindow.match(CARD_SPECS_AFTER_RE);
    if (!specMatch || specMatch.index === undefined) continue;
    // Title is everything before the spec cluster, minus trailing "* * *"/punctuation.
    const title = compact(afterWindow.slice(0, specMatch.index)).replace(/[\s*,–-]+$/, "").trim();
    if (!title) continue;

    // The listing URL closes the card markup after the data line, so search
    // forward only — a backward window would grab the previous card's URL.
    const urlWindow = rawContent.slice(afterStart, afterStart + 1400);
    const url = urlWindow.match(CARD_LISTING_URL_RE)?.[0] ?? "";
    if (!url || seen.has(url)) continue;
    seen.add(url);

    const price = Number(priceMatch[1].replace(/,/g, ""));
    const { bedrooms, bathrooms } = sanitizeRoomCounts(
      specMatch[1] ? Number(specMatch[1]) : undefined,
      specMatch[2] ? Number(specMatch[2]) : undefined,
    );
    cards.push({
      title,
      url,
      askingPriceRm: price > 0 ? price : undefined,
      bedrooms,
      bathrooms,
      builtUpSqft: sanitizeSqft(Number(specMatch[4].replace(/,/g, ""))),
    });
  }
  return cards;
}

function buildComparableFromCard(
  input: PropertyReportInput,
  card: ParsedListingCard,
): ReportComparableListing | null {
  const propertyName = normalizeReportInput(input).propertyName;
  const gateText = compact(`${card.title} ${card.url}`);
  if (!matchesPropertyName(propertyName, gateText, true)) return null;
  if (conflictsWithPropertyName(propertyName, card.title)) return null;
  if (isLandedListingTitle(card.title)) return null;

  const intent = inferListingIntent(card.title, input.listingIntent);
  if (card.askingPriceRm !== undefined) {
    if (intent === "rent" && card.askingPriceRm < 150) return null;
    if (intent === "sale" && card.askingPriceRm < 30000) return null;
  }

  const trailingRooms = parseTrailingRoomCounts(card.title);

  return {
    title: compact(card.title),
    sourceName: sourceNameFromUrl(card.url),
    url: compact(card.url),
    askingPriceRm: card.askingPriceRm,
    builtUpSqft: card.builtUpSqft,
    bedrooms: card.bedrooms ?? trailingRooms.bedrooms,
    bathrooms: card.bathrooms ?? trailingRooms.bathrooms,
    listingIntent: intent,
  };
}

/**
 * Derive a data-driven pricing trend by comparing the target asking price
 * against comparable listings and transaction data, rather than using a
 * hardcoded threshold.
 */
export function derivePricingTrend(
  input: PropertyReportInput,
  comparables: ReportComparableListing[],
  transacted: Array<{ priceRm: number; isAskingFallback?: boolean }>,
  _communityAnswer: string,
): string {
  if (input.listingIntent === "rent") return "Rental yield positioning";

  const targetPrice = input.askingPriceRm ?? 0;
  const compPrices = comparables
    .map((c) => c.askingPriceRm)
    .filter((p): p is number => typeof p === "number" && p > 0)
    .sort((a, b) => a - b);
  const compMedian = compPrices.length >= 2
    ? compPrices[Math.floor(compPrices.length / 2)]
    : compPrices[0];

  const realTxPrices = (transacted ?? [])
    .filter((tx) => !tx.isAskingFallback)
    .map((tx) => tx.priceRm)
    .sort((a, b) => a - b);

  // Transaction momentum: are prices rising?
  const risingTx = realTxPrices.length >= 2 && realTxPrices[realTxPrices.length - 1] > realTxPrices[0];
  const fallingTx = realTxPrices.length >= 2 && realTxPrices[realTxPrices.length - 1] < realTxPrices[0];

  // Target vs market median
  const premiumPct = targetPrice > 0 && compMedian && compMedian > 0
    ? ((targetPrice - compMedian) / compMedian) * 100
    : undefined;

  if (risingTx) {
    if (premiumPct !== undefined && premiumPct > 15) {
      return "Above-market with upward transaction momentum";
    }
    return "Market-consistent with upward transaction momentum";
  }

  if (fallingTx) {
    if (premiumPct !== undefined && premiumPct > 10) {
      return "Above-market with softening transaction trend — justify with differentiation";
    }
    return "Softening transaction trend — price sensitivity likely";
  }

  if (premiumPct !== undefined && premiumPct > 20) {
    return "Premium pricing — merits strong differentiation narrative";
  }
  if (premiumPct !== undefined && premiumPct > 5) {
    return "Slightly above market — highlight unique value";
  }
  if (premiumPct !== undefined && premiumPct < -10) {
    return "Below-market pricing — potential buyer interest signal";
  }
  if (premiumPct !== undefined && premiumPct < -5) {
    return "Competitive pricing — slight discount to market";
  }

  if (compPrices.length >= 3) {
    return "Market-aligned with healthy comparable coverage";
  }
  if (compPrices.length >= 1) {
    return "Limited comparable data — treat pricing as directional";
  }

  return "Balanced pricing discovery";
}

/** Positive and negative keyword sets for sentiment analysis. */
const NEGATIVE_KEYWORDS_RE = /complaint|aduan|bising|noise|defect|masalah|midnight|track record|rosak|bocor|leak|pecah|buruk|kecewa|seram|tidak puas|banjir|flood|sempit|cramped|mahal|overpriced|teruk|terrible|miskin|poor condition|abandoned|terbengkalai/i;
const POSITIVE_KEYWORDS_RE = /recommend|good|great|excellent|baik|bagus|puas hati|selesa|moden|bersih|tenang|selamat|popular|high demand|sought after|premium|exclusive|luxury|strategic|prime location/i;

/**
 * Score a text snippet for sentiment: -1 for negative, +1 for positive, 0 for neutral/mixed.
 */
function scoreSentimentText(text: string): number {
  const neg = (text.match(NEGATIVE_KEYWORDS_RE) || []).length;
  const pos = (text.match(POSITIVE_KEYWORDS_RE) || []).length;
  if (neg > pos) return -1;
  if (pos > neg) return 1;
  return 0;
}

/**
 * Derive sentiment from all five Tavily answer lanes using weighted scoring.
 * Community voice (residents/buyers) carries the most weight.
 */
export function deriveSentiment(
  answers: { official: string; community: string; comparable: string; transaction: string; neighborhood: string },
  comparables: ReportComparableListing[],
  _propertyType?: string,
): Sentiment {
  const weightedScore =
    scoreSentimentText(answers.community) * 0.50 +
    scoreSentimentText(answers.official) * 0.20 +
    scoreSentimentText(answers.comparable) * 0.10 +
    scoreSentimentText(answers.transaction) * 0.10 +
    scoreSentimentText(answers.neighborhood) * 0.10;

  // Listing velocity: many active listings can signal seller urgency (slight negative)
  const listingVelocity = comparables.length >= 6 ? -0.15 : comparables.length >= 4 ? -0.05 : 0;

  const finalScore = weightedScore + listingVelocity;

  if (finalScore <= -0.3) return "negative";
  if (finalScore >= 0.2) return "positive";
  return "neutral";
}

export function createFallbackResearch(input: PropertyReportInput): ReportResearchResult {
  const normalized = normalizeReportInput(input);
  const compactLocation = normalized.address.replace(/\s+/g, " ").trim();
  const propertyTypeLabel = input.propertyType?.trim()?.toLowerCase() || "property";
  const pricingTrend = derivePricingTrend(input, [], [], "");
  const sentiment = deriveSentiment(
    { official: "", community: "", comparable: "", transaction: "", neighborhood: "" },
    [],
    normalized.propertyType,
  );
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
    sentiment,
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
        const queries = buildTavilyQueryVariations(input, sourceType);
        const maxResults = parseMaxResults(env.TAVILY_MAX_RESULTS);
        const searchDepth = normalizeSearchDepth(env.TAVILY_SEARCH_DEPTH);

        // Fire all query variations in parallel for this lane
        const variationResponses = await Promise.all(
          queries.map(async (query, index) => {
            try {
              const response = await fetch("https://api.tavily.com/search", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${env.TAVILY_API_KEY}`,
                },
                body: JSON.stringify({
                  query,
                  search_depth: searchDepth,
                  max_results: maxResults,
                  country: "malaysia",
                  include_answer: index === 0 ? true : false,
                  topic: "general",
                }),
              });
              if (!response.ok) return null;
              return (await response.json()) as TavilyResponse;
            } catch {
              return null;
            }
          }),
        );

        // Primary answer comes from the first variation
        const primaryPayload = variationResponses[0];
        if (!primaryPayload) {
          throw new Error(`Tavily search failed for ${sourceType} lane`);
        }

        // Merge results from all variations, deduplicate by URL
        const seenUrls = new Set<string>();
        const mergedResults: TavilyResult[] = [];
        for (const vr of variationResponses) {
          if (!vr?.results) continue;
          for (const result of vr.results) {
            const key = (result.url ?? "").trim().toLowerCase();
            if (!key || seenUrls.has(key)) continue;
            seenUrls.add(key);
            mergedResults.push(result);
          }
        }

        const sortedResults = mergedResults
          .filter((result) => {
            if (sourceType === "community" && result.url && isPortalListingUrl(result.url)) {
              return false;
            }
            return passesPropertyNameGate(input, result, false);
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
          .slice(0, maxResults);
        let extracted = new Map<string, string>();
        if (sourceType === "comparable_listing" && env.TAVILY_EXTRACT !== "off") {
          const listingUrls = sortedResults
            .map((result) => result.url)
            .filter((url): url is string => typeof url === "string" && url !== "" && isHttpUrl(url) && isTrustedListingUrl(url) && !isSocialListingUrl(url));
          extracted = await tavilyExtractListings(env.TAVILY_API_KEY as string, listingUrls);
        }
        let comparableListings: ReportComparableListing[] | undefined;
        if (sourceType === "comparable_listing") {
          const collected: ReportComparableListing[] = [];
          const seenListingUrls = new Set<string>();
          const seenContent = new Set<string>();
          // Same physical unit can appear under different URLs; collapse on
          // title+price+size so the table does not repeat near-identical rows.
          const contentKey = (l: ReportComparableListing): string =>
            `${l.title.toLowerCase().replace(/\s+/g, " ").trim()}|${l.askingPriceRm ?? ""}|${l.builtUpSqft ?? ""}`;
          const pushUnique = (listing: ReportComparableListing): void => {
            const ck = contentKey(listing);
            if (seenListingUrls.has(listing.url) || seenContent.has(ck)) return;
            seenListingUrls.add(listing.url);
            seenContent.add(ck);
            collected.push(listing);
          };
          for (const result of sortedResults) {
            const key = result.url?.trim().toLowerCase();
            const rawContent = key ? extracted.get(key) : undefined;
            // A directory/index page can expand into many fully-specced unit cards.
            const cards = rawContent && key && /(?:propertyguru|iproperty)\.com\.my/.test(key)
              ? parseListingIndexCards(rawContent)
              : [];
            const cardListings = cards
              .map((card) => buildComparableFromCard(input, card))
              .filter((listing): listing is ReportComparableListing => Boolean(listing));
            if (cardListings.length > 0) {
              cardListings.forEach(pushUnique);
            } else {
              // No usable cards (thin template / different layout) — fall back to
              // single-listing extraction so we never do worse than the snippet.
              const listing = extractComparableListing(input, result, rawContent);
              if (listing) pushUnique(listing);
            }
          }
          // Prefer listings with concrete specs (price or size) up front.
          comparableListings = collected
            .sort((a, b) => Number(Boolean(b.askingPriceRm || b.builtUpSqft)) - Number(Boolean(a.askingPriceRm || a.builtUpSqft)))
            .slice(0, 15);
        }

        let transactedPrices: TavilyLaneResult["transactedPrices"];
        if (sourceType === "transaction") {
          const collected: TavilyLaneResult["transactedPrices"] = [];
          const seenPrices = new Set<number>();
          for (const result of sortedResults) {
            const text = compact(`${result.title ?? ""} ${result.content ?? ""}`);
            const parsed = parseTransactedPrices(text, sourceNameFromUrl(result.url ?? ""));
            for (const tx of parsed) {
              if (seenPrices.has(tx.priceRm)) continue;
              seenPrices.add(tx.priceRm);
              collected.push({
                priceRm: tx.priceRm,
                transactedDate: tx.date,
                builtUpSqft: tx.sqft,
                sourceName: sourceNameFromUrl(result.url ?? ""),
                sourceUrl: result.url,
                isAskingFallback: false,
              });
            }
          }
          // If no transactions found, fall back to asking prices from the listing results
          if (collected.length === 0 && sortedResults.length > 0) {
            for (const result of sortedResults.slice(0, 3)) {
              const text = compact(`${result.title ?? ""} ${result.content ?? ""}`);
              const askingPrice = parseAskingPriceRm(text);
              if (askingPrice && askingPrice > 0 && !seenPrices.has(askingPrice)) {
                seenPrices.add(askingPrice);
                collected.push({
                  priceRm: askingPrice,
                  builtUpSqft: parseBuiltUpSqft(text),
                  sourceName: sourceNameFromUrl(result.url ?? ""),
                  sourceUrl: result.url,
                  isAskingFallback: true,
                });
              }
            }
          }
          transactedPrices = collected.slice(0, 3);
        }

        let neighborhoodContext: TavilyLaneResult["neighborhoodContext"];
        if (sourceType === "neighborhood") {
          neighborhoodContext = parseNeighborhoodContext(sortedResults);
        }

        // Parse developer name from official lane results
        let developerName: string | undefined;
        if (sourceType === "official") {
          for (const result of sortedResults) {
            const text = compact(`${result.title ?? ""} ${result.content ?? ""}`);
            const name = parseDeveloperName(text);
            if (name) { developerName = name; break; }
          }
          if (!developerName && primaryPayload.answer) {
            developerName = parseDeveloperName(primaryPayload.answer);
          }
        }

        return {
          answer: compact(primaryPayload.answer ?? sortedResults.find((result) => result.content?.trim())?.content ?? ""),
          sources,
          comparableListings,
          transactedPrices,
          neighborhoodContext,
          developerName,
        };
      }

      const emptyLane = (): TavilyLaneResult => ({
        answer: "",
        sources: [],
        comparableListings: [],
      });
      const [official, community, comparable, transaction, neighborhood] = await Promise.all([
        searchLane("official"),
        searchLane("community"),
        searchLane("comparable_listing").catch(emptyLane),
        searchLane("transaction").catch(emptyLane),
        searchLane("neighborhood").catch(emptyLane),
      ]);
      const sources = dedupeCitations([
        ...official.sources,
        ...community.sources,
        ...comparable.sources,
        ...(transaction.sources ?? []),
        ...(neighborhood.sources ?? []),
      ]);
      const summary = compact([
        official.answer ? `Official/listing signals: ${official.answer}` : "",
        community.answer ? `Community/user signals: ${community.answer}` : "",
        comparable.answer ? `Current listing signals: ${comparable.answer}` : "",
        transaction.answer ? `Transaction data: ${transaction.answer}` : "",
        neighborhood.answer ? `Neighborhood context: ${neighborhood.answer}` : "",
      ].filter(Boolean).join(" "));

      if (!summary) {
        throw new Error("Tavily search returned no usable summary.");
      }

      if (sources.length === 0) {
        throw new Error("Tavily search returned no valid citations.");
      }

      // Derive data-driven pricing trend
      const comparableListings = comparable.comparableListings ?? [];
      const pricingTrend = derivePricingTrend(input, comparableListings, transaction.transactedPrices ?? [], community.answer);

      // Multi-lane weighted sentiment
      const sentiment = deriveSentiment(
        {
          official: official.answer,
          community: community.answer,
          comparable: comparable.answer,
          transaction: transaction.answer,
          neighborhood: neighborhood.answer,
        },
        comparableListings,
        normalized.propertyType,
      );

      return {
        propertyName: normalized.propertyName,
        summary,
        pricingTrend,
        sentiment,
        sources,
        comparableListings,
        transactedPrices: transaction.transactedPrices,
        neighborhoodContext: neighborhood.neighborhoodContext,
        developerName: official.developerName,
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
