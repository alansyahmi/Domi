import type { Intent } from "../types";

export interface LeadScoreInput {
  emailOpens: number;
  linkClicks: number;
  reportViews: number;
  inquirySentiment: number;
}

export interface LeadScoreResult {
  score: number;
  intent: Intent;
  tier: "Hot" | "Warm" | "Cold";
}

const HOT_THRESHOLD = 18;
const INTENT_THRESHOLD = 14;
const WARM_THRESHOLD = 10;

function clampSentiment(value: number): number {
  return Math.max(-1, Math.min(1, value));
}

export function computeLeadScore(input: LeadScoreInput): LeadScoreResult {
  const score = Math.max(
    0,
    input.emailOpens +
      input.linkClicks * 3 +
      input.reportViews * 4 +
      Math.round(clampSentiment(input.inquirySentiment) * 4),
  );

  return {
    score,
    ...classifyScore(score),
  };
}

export function classifyLeadIntent(input: LeadScoreInput): Pick<LeadScoreResult, "intent" | "tier"> {
  return classifyScore(computeLeadScore(input).score);
}

export function classifyScore(score: number): Pick<LeadScoreResult, "intent" | "tier"> {
  if (score >= HOT_THRESHOLD) {
    return { intent: 1, tier: "Hot" };
  }

  if (score >= WARM_THRESHOLD) {
    return {
      intent: score >= INTENT_THRESHOLD ? 1 : 0,
      tier: "Warm",
    };
  }

  return { intent: 0, tier: "Cold" };
}
