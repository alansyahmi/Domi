import { describe, expect, it } from "vitest";
import { classifyLeadIntent, computeLeadScore } from "./leadScoring";

describe("lead scoring", () => {
  it("classifies highly engaged leads as binary intent 1", () => {
    const result = computeLeadScore({
      emailOpens: 8,
      linkClicks: 4,
      reportViews: 2,
      inquirySentiment: 0.7,
    });

    expect(result.score).toBe(31);
    expect(result.intent).toBe(1);
    expect(result.tier).toBe("Hot");
  });

  it("classifies low engagement leads as binary intent 0", () => {
    expect(
      classifyLeadIntent({
        emailOpens: 1,
        linkClicks: 0,
        reportViews: 0,
        inquirySentiment: -0.3,
      }),
    ).toEqual({ intent: 0, tier: "Cold" });
  });
});
