import type { ReportAnalytics } from "../types";

export interface NeighborhoodVibe {
  score: number;
  label: string;
  amenities: Array<{
    name: string;
    type: string;
    rating?: number;
    distance?: string;
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
  apiKey?: string
): Promise<NeighborhoodVibe> {
  // If we had a real apiKey, we would hit Google Places API here.
  // For now, we return a simulated response based on the address.
  const addressHash = hashString(address);
  
  // Deterministic simulation
  const scoreBase = 3.5 + (addressHash % 15) / 10; // between 3.5 and 4.9
  const score = Number(scoreBase.toFixed(1));

  let label = "Balanced Convenience";
  if (score >= 4.5) label = "High Convenience";
  else if (score < 4.0) label = "Developing Area";

  const isUrban = addressHash % 2 === 0;

  const amenities = isUrban
    ? [
        {
          name: "LRT Station " + (addressHash % 100),
          type: "transit",
          rating: 4.1 + (addressHash % 8) / 10,
          distance: `${(addressHash % 15) + 2} mins walk`,
        },
        {
          name: "Central Grocer",
          type: "grocery",
          rating: 4.3 + (addressHash % 5) / 10,
          distance: `${(addressHash % 10) + 1} mins walk`,
        },
        {
          name: "City International School",
          type: "school",
          rating: 4.5,
          distance: "5 mins drive",
        },
      ]
    : [
        {
          name: "Neighborhood Mall",
          type: "grocery",
          rating: 4.0 + (addressHash % 6) / 10,
          distance: "5 mins drive",
        },
        {
          name: "National School " + (addressHash % 50),
          type: "school",
          rating: 3.8 + (addressHash % 10) / 10,
          distance: "8 mins drive",
        },
        {
          name: "Community Park",
          type: "park",
          rating: 4.6,
          distance: "10 mins walk",
        },
      ];

  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 800));

  return {
    score,
    label,
    amenities,
  };
}
