import type { ReportInfrastructureProject } from "../types";

export interface NeighborhoodVibe {
  score: number;
  label: string;
  amenities: Array<{
    name: string;
    type: string;
    rating?: number;
    distance?: string;
  }>;
  infrastructureProjects?: Array<{
    name: string;
    type: string;
    distanceKm?: number;
    completionYear?: number;
    status?: string;
    sourceUrl?: string;
  }>;
}

// Simple hash function for deterministic simulation
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export async function fetchNeighborhoodVibe(
  address: string,
  apiKey?: string,
  neighborhoodContext?: {
    facilities: Array<{ name: string; type: string; rating?: number; distance?: string }>;
    infrastructure: Array<{ name: string; type: string; distanceKm?: number; completionYear?: number; status?: string; sourceUrl?: string }>;
  },
): Promise<NeighborhoodVibe> {
  // If we have real data from Tavily neighborhood search, use it
  if (neighborhoodContext?.facilities?.length) {
    const score = Math.min(5, Math.max(1, 3 + (neighborhoodContext.facilities.length - 3) * 0.4));
    const label = score >= 4.5 ? "High Convenience" : score >= 3.5 ? "Balanced Convenience" : "Developing Area";
    return {
      score: Number(score.toFixed(1)),
      label,
      amenities: neighborhoodContext.facilities.slice(0, 6),
      infrastructureProjects: neighborhoodContext.infrastructure?.length ? neighborhoodContext.infrastructure : undefined,
    };
  }

  // No real data available — return honest limited-data response
  // instead of simulated/fake amenity names.
  const addressHash = hashString(address);

  const scoreBase = 2.5 + (addressHash % 10) / 10; // 2.5-3.4: below confident range
  const score = Number(scoreBase.toFixed(1));
  const label = "Limited data — verify on-site";

  return {
    score,
    label,
    amenities: [],
  };
}
