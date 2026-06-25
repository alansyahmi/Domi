import type { MessageDirection, PitchStage } from "../types";

/**
 * The ROI / attribution ledger — the running scoreboard of what re:AI did for
 * the agent this period. Reads from outcome labels (won/lost pitches),
 * conversation timing, and intelligence signals. Pure + testable so it can run
 * against demo data now and live data later.
 */
export interface RoiLedger {
  listingsWon: number;
  activePitches: number;
  leadsHandled: number;
  respondedPct: number;
  medianResponseMins: number | null;
  hotLeads: number;
  hoursSaved: number;
  dealValueRm: number;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

export function computeRoiLedger(input: {
  pitches: { stage: PitchStage }[];
  conversations: { id: string; listingId?: string }[];
  messagesByConversation: Record<string, { direction: MessageDirection; sentAt: string }[]>;
  intelligence: { priorityPct: number }[];
  listings: { id: string; askingPriceRm: number }[];
  reportsCount: number;
}): RoiLedger {
  const listingsWon = input.pitches.filter((p) => p.stage === "won").length;
  const activePitches = input.pitches.filter((p) => p.stage === "pitched" || p.stage === "responded").length;

  // Speed-to-lead: minutes between the first inbound and the first reply.
  const responseDeltas: number[] = [];
  let respondedCount = 0;
  for (const conv of input.conversations) {
    const msgs = [...(input.messagesByConversation[conv.id] ?? [])].sort(
      (a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime(),
    );
    const firstInbound = msgs.find((m) => m.direction === "inbound");
    if (!firstInbound) continue;
    const inboundTime = new Date(firstInbound.sentAt).getTime();
    const firstReply = msgs.find((m) => m.direction === "outbound" && new Date(m.sentAt).getTime() >= inboundTime);
    if (firstReply) {
      respondedCount += 1;
      responseDeltas.push((new Date(firstReply.sentAt).getTime() - inboundTime) / 60000);
    }
  }

  const leadsHandled = input.conversations.length;
  const respondedPct = leadsHandled > 0 ? Math.round((respondedCount / leadsHandled) * 100) : 0;
  const medianResponseMins = median(responseDeltas);

  const hotLeads = input.intelligence.filter((i) => i.priorityPct >= 70).length;

  // ~2 hours saved per cited report / CMA the agent didn't have to build by hand.
  const hoursSaved = Math.round((input.reportsCount + input.pitches.length) * 2);

  // Deal value in play: asking price of every listing with live conversation activity.
  const activeListingIds = new Set(input.conversations.map((c) => c.listingId).filter(Boolean) as string[]);
  const dealValueRm = input.listings
    .filter((l) => activeListingIds.has(l.id))
    .reduce((sum, l) => sum + (l.askingPriceRm || 0), 0);

  return { listingsWon, activePitches, leadsHandled, respondedPct, medianResponseMins, hotLeads, hoursSaved, dealValueRm };
}
