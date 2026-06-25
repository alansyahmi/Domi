import type { LeadRole, UrgencyTier } from "../types";

/**
 * Auto-qualify brain. In production this is a Gemini structured-output call
 * (same pattern as emailParser.ts); here it's a deterministic local mirror so
 * the automation runs live in demo mode with no backend. Given a lead's opening
 * message, it extracts the same fields the intelligence panel shows.
 */
export interface QualifyResult {
  role: LeadRole;
  budgetMinRm?: number;
  budgetMaxRm?: number;
  lookingFor: string[];
  dealbreakers: string[];
  objections: string[];
  urgencyTier: UrgencyTier;
  botProbability: number;
  priorityPct: number;
  matchPct?: number;
  xaiSummary: string;
}

function parseBudget(message: string): { min?: number; max?: number } {
  const nums: number[] = [];
  const re = /(?:rm\s?)?(\d+(?:[.,]\d+)?)\s?(k|m|ribu|juta)?/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(message)) !== null) {
    let v = parseFloat(m[1]!.replace(/,/g, ""));
    const unit = (m[2] || "").toLowerCase();
    if (unit === "k" || unit === "ribu") v *= 1000;
    else if (unit === "m" || unit === "juta") v *= 1_000_000;
    else if (v >= 50 && v < 10000) v *= 1000; // bare "320" → 320k in property context
    if (v >= 50_000 && v <= 50_000_000) nums.push(v);
  }
  if (nums.length === 0) return {};
  nums.sort((a, b) => a - b);
  if (nums.length === 1) return { max: nums[0] };
  return { min: nums[0], max: nums[nums.length - 1] };
}

export function simulateQualify(message: string, ctx?: { askingPriceRm?: number }): QualifyResult {
  const text = message.toLowerCase();

  const spammy =
    /(https?:\/\/|bit\.ly|wa\.me|guaranteed|click here|co-?broke|free listing|high roi|promo)/i.test(message) ||
    (message.replace(/[^a-z]/gi, "").length > 18 && message === message.toUpperCase());
  const botProbability = spammy ? 0.92 : 0.04;

  let role: LeadRole = "unknown";
  if (/\b(sell|jual|list my|owner)\b/.test(text)) role = "seller";
  else if (/\b(rent|sewa|tenant|lease)\b/.test(text)) role = "tenant";
  else if (/\b(buy|beli|purchase|own\s?stay|invest|looking for|interested)\b/.test(text)) role = "buyer";

  const budget = parseBudget(message);

  const lookingFor: string[] = [];
  const bed = text.match(/(\d)\s*(?:bed|bedroom|room|bilik|r\b)/);
  if (bed) lookingFor.push(`${bed[1]} bedrooms`);
  if (/own\s?stay|duduk sendiri|to stay/.test(text)) lookingFor.push("Own-stay");
  if (/invest/.test(text)) lookingFor.push("Investment");
  if (/mrt|lrt|transit|train|public transport|komuter/.test(text)) lookingFor.push("Near MRT / transit");
  if (/freehold/.test(text)) lookingFor.push("Freehold");
  if (/furnish/.test(text)) lookingFor.push("Furnished");

  const dealbreakers: string[] = [];
  if (/no car|don'?t drive|tak ada kereta|tiada kereta/.test(text)) dealbreakers.push("No car — must be transit-accessible");
  if (budget.max && /budget|max|below|under|bajet|paling/.test(text)) dealbreakers.push(`Above RM${budget.max.toLocaleString("en-MY")}`);

  const objections: string[] = [];
  if (/expensive|mahal|too high|overprice|nego/.test(text)) objections.push("Price perceived high / expects negotiation");
  if (/loan|bank|valuation/.test(text)) objections.push("Financing / valuation concern");

  const urgent = /urgent|asap|today|this week|segera|cepat|immediately/.test(text);
  const urgencyTier: UrgencyTier = spammy ? "passive" : urgent ? "alpha" : role === "buyer" && budget.max ? "beta" : "passive";

  let priorityPct = spammy ? 4 : 28;
  if (role === "buyer" || role === "seller") priorityPct += 24;
  if (budget.max) priorityPct += 20;
  if (lookingFor.length >= 2) priorityPct += 10;
  if (urgencyTier === "alpha") priorityPct += 18;
  priorityPct = Math.max(2, Math.min(97, priorityPct));

  let matchPct: number | undefined;
  if (ctx?.askingPriceRm && budget.max) {
    matchPct =
      budget.max >= ctx.askingPriceRm && (budget.min ?? 0) <= ctx.askingPriceRm * 1.12
        ? 86
        : budget.max >= ctx.askingPriceRm * 0.9
          ? 62
          : 32;
  }

  const xaiSummary = spammy
    ? "Flagged by the integrity shield: promotional language and/or a link, with no genuine inquiry signal."
    : `Auto-qualified from the opening message — ${role !== "unknown" ? role : "intent unclear"}${budget.max ? `, budget to RM${budget.max.toLocaleString("en-MY")}` : ""}${lookingFor.length ? `, wants ${lookingFor[0]!.toLowerCase()}` : ""}${urgent ? ", urgent" : ""}.`;

  return { role, budgetMinRm: budget.min, budgetMaxRm: budget.max, lookingFor, dealbreakers, objections, urgencyTier, botProbability, priorityPct, matchPct, xaiSummary };
}
