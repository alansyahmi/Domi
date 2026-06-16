/**
 * Real Tavily smoke: does /extract now fill comparable specs that snippets miss?
 *   npx tsx scripts/smoke-listing-extract.ts
 * Uses the real TAVILY_API_KEY from .env.local (spends a few credits).
 */
import { getRuntimeEnv } from "../src/server/runtime-env";
import { createTavilyResearchProvider } from "../src/server/report-research";

async function run(label: string, extract: "on" | "off") {
  const env = { ...getRuntimeEnv(), TAVILY_EXTRACT: extract };
  const provider = createTavilyResearchProvider(env as never);
  const result = await provider.research({
    propertyName: "Mont Kiara",
    address: "Mont Kiara, Kuala Lumpur",
    propertyType: "Condo",
    listingIntent: "sale",
  });
  const listings = result.comparableListings ?? [];
  console.log(`\n=== ${label} (TAVILY_EXTRACT=${extract}) — ${listings.length} comparables ===`);
  for (const l of listings) {
    console.log(
      `• ${l.title.slice(0, 50)}\n    price=${l.askingPriceRm ?? "TBD"}  sqft=${l.builtUpSqft ?? "TBD"}  bed=${l.bedrooms ?? "TBD"}  bath=${l.bathrooms ?? "TBD"}  [${l.sourceName}]`,
    );
  }
  const withSpecs = listings.filter((l) => l.builtUpSqft || l.bedrooms || l.bathrooms).length;
  console.log(`  → ${withSpecs}/${listings.length} have size/bed/bath specs`);
  return withSpecs;
}

async function main() {
  if (!getRuntimeEnv().TAVILY_API_KEY) throw new Error("Missing TAVILY_API_KEY in .env.local");
  const off = await run("SNIPPET ONLY (old behaviour)", "off");
  const on = await run("WITH EXTRACT (new behaviour)", "on");
  console.log(`\nRESULT: snippet-only filled specs on ${off} listings, extract filled ${on}.`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
