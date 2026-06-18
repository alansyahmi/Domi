import { calculateMarketPricingStats, hasTargetAskingPrice } from "../../domain/reports";
import type { PropertyReport } from "../../types";

function formatRm(value: number): string {
  return value > 0 ? `RM ${value.toLocaleString("en-MY", { maximumFractionDigits: 0 })}` : "TBD";
}

function formatPps(value: number): string {
  return value > 0 ? `RM ${value.toLocaleString("en-MY", { maximumFractionDigits: 0 })}/sqft` : "TBD";
}

function diffTone(value: number): string {
  if (value > 0) return "text-red-600 bg-red-50";
  if (value < 0) return "text-emerald-600 bg-emerald-50";
  return "text-slate-600 bg-slate-50";
}

function diffText(value: number): string {
  if (value === 0) return "At market average";
  return `${Math.abs(value).toFixed(1)}% ${value > 0 ? "premium" : "discount"}`;
}

type PricingCard = {
  label: string;
  value: string;
  tone?: string;
};

function buildPricingCards(report: PropertyReport): { title: string; cards: PricingCard[] } {
  const stats = calculateMarketPricingStats(report);
  const compareToTarget = hasTargetAskingPrice(report.inputSnapshot);

  if (!compareToTarget) {
    const range =
      stats.priceRangeMin > 0 && stats.priceRangeMax > 0
        ? stats.priceRangeMin === stats.priceRangeMax
          ? formatRm(stats.priceRangeMin)
          : `${formatRm(stats.priceRangeMin)} – ${formatRm(stats.priceRangeMax)}`
        : "TBD";

    const cards: PricingCard[] = [
      { label: "Average asking price", value: formatRm(stats.averagePrice) },
      { label: "Active listing range", value: range },
      { label: "Average price / sqft", value: formatPps(stats.averagePricePerSqft) },
      { label: "Cited active listings", value: stats.validPriceCount > 0 ? String(stats.validPriceCount) : "TBD" },
    ];

    const saleCompsAvg = stats.averagePrice;
    if (saleCompsAvg > 0 && stats.averageRentalPrice && stats.averageRentalPrice > 0) {
      const avgYield = (stats.averageRentalPrice * 12 / saleCompsAvg) * 100;
      cards.push({
        label: "Est. Building Yield",
        value: `${avgYield.toFixed(2)}%`,
        tone: "text-emerald-650 bg-emerald-50"
      });
    }

    return {
      title: "Similar Property Pricing",
      cards,
    };
  }

  const cards: PricingCard[] = [
    { label: "Comparable Market Avg", value: formatRm(stats.averagePrice) },
    { label: "Asking vs. Average", value: diffText(stats.priceDifferencePct), tone: diffTone(stats.priceDifferencePct) },
    { label: "Market Avg PPS", value: formatPps(stats.averagePricePerSqft) },
    { label: "Asking PPS vs. Average", value: diffText(stats.ppsDifferencePct), tone: diffTone(stats.ppsDifferencePct) },
  ];

  if (stats.estimatedGrossYield && stats.estimatedGrossYield > 0) {
    cards.push({
      label: "Est. Gross Rental Yield",
      value: `${stats.estimatedGrossYield.toFixed(2)}%`,
      tone: stats.estimatedGrossYield >= 4.5 ? "text-emerald-650 bg-emerald-50" : "text-blue-600 bg-blue-50"
    });
  }

  return {
    title: "Current Market Pricing Analysis",
    cards,
  };
}

export default function ReportPricingPanel({
  report,
  variant = "shared",
}: {
  report: PropertyReport;
  variant?: "shared" | "agent";
}) {
  const { title, cards } = buildPricingCards(report);
  const isAgent = variant === "agent";
  const sharedDark = variant === "shared";
  const cardShell = isAgent
    ? "bg-white/5 p-4 rounded border border-slate-200"
    : sharedDark
      ? "bg-[#252525] p-4 rounded-xl border border-white/8 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
      : "bg-slate-50 p-5 rounded-lg border border-slate-200";

  return (
    <section className={isAgent ? "bg-slate-50 p-6 rounded-lg border border-slate-200 mb-8" : "card p-6 md:p-8"}>
      <h2 className={`m-0 font-extrabold mb-6 ${isAgent ? "text-xl flex items-center gap-2" : `text-2xl ${sharedDark ? "text-slate-100" : ""}`}`}>{title}</h2>
      <div className={`grid grid-cols-1 ${isAgent ? "sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6" : "md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"}`}>
        {cards.map((card) => (
          <div
            key={card.label}
            className={cardShell}
          >
            <span className={`text-xs font-bold uppercase tracking-wider block mb-2 ${sharedDark ? "text-slate-400" : "text-slate-500"}`}>{card.label}</span>
            <strong className={`${card.tone ? `text-xl font-extrabold px-2 py-0.5 rounded ${card.tone}` : "text-2xl text-slate-900 font-extrabold"}`}>
              {card.value}
            </strong>
          </div>
        ))}
      </div>

      {report.comparableListings && report.comparableListings.length > 0 ? (
        <div>
          <h3 className={`font-bold mb-4 ${isAgent ? "text-sm text-slate-700" : sharedDark ? "text-base text-slate-100" : "text-lg"}`}>Comparable Properties In Area</h3>
          <div className="overflow-x-auto">
            <table className={`w-full text-left border-collapse ${isAgent ? "text-xs" : "text-sm"}`}>
              <thead>
                <tr className={`border-b ${sharedDark ? "border-white/10 text-slate-400" : "border-slate-200 text-slate-500"} text-xs uppercase font-bold`}>
                  <th className={isAgent ? "py-2 px-3" : "py-3 px-4"}>Property / Title</th>
                  <th className={isAgent ? "py-2 px-3" : "py-3 px-4"}>Asking Price</th>
                  <th className={isAgent ? "py-2 px-3" : "py-3 px-4"}>Size (Sqft)</th>
                  <th className={isAgent ? "py-2 px-3" : "py-3 px-4"}>Bed/Bath</th>
                  <th className={isAgent ? "py-2 px-3" : "py-3 px-4"}>Source</th>
                </tr>
              </thead>
              <tbody className={sharedDark ? "divide-y divide-white/8" : "divide-y divide-slate-100"}>
                {report.comparableListings.map((comp, idx) => (
                  <tr key={idx} className={isAgent ? "hover:bg-slate-100" : sharedDark ? "hover:bg-white/5" : "hover:bg-slate-50"}>
                    <td className={`${isAgent ? "py-2 px-3 font-bold text-slate-800" : sharedDark ? "py-3 px-4 font-bold text-slate-100" : "py-3 px-4 font-bold text-slate-900"}`}>
                      {comp.url ? (
                        <a href={comp.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                          {comp.title}
                        </a>
                      ) : (
                        comp.title
                      )}
                    </td>
                    <td className={`${isAgent ? "py-2 px-3 font-semibold text-slate-700" : sharedDark ? "py-3 px-4 font-semibold text-slate-200" : "py-3 px-4 font-semibold text-slate-700"}`}>
                      {comp.askingPriceRm && comp.askingPriceRm > 0 ? `RM ${comp.askingPriceRm.toLocaleString("en-MY")}` : "TBD"}
                    </td>
                    <td className={`${isAgent ? "py-2 px-3 text-slate-600" : sharedDark ? "py-3 px-4 text-slate-300" : "py-3 px-4 text-slate-600"}`}>
                      {comp.builtUpSqft && comp.builtUpSqft > 0 ? `${comp.builtUpSqft.toLocaleString("en-MY")} sqft` : "TBD"}
                    </td>
                    <td className={`${isAgent ? "py-2 px-3 text-slate-600" : sharedDark ? "py-3 px-4 text-slate-300" : "py-3 px-4 text-slate-600"}`}>
                      {comp.bedrooms || comp.bathrooms ? `${comp.bedrooms ?? "-"}b / ${comp.bathrooms ?? "-"}ba` : "TBD"}
                    </td>
                    <td className={`${isAgent ? "py-2 px-3 text-slate-500 capitalize" : sharedDark ? "py-3 px-4 text-xs text-slate-400 capitalize" : "py-3 px-4 text-xs text-slate-500 capitalize"}`}>
                      {comp.sourceName || "portal"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className={sharedDark ? "rounded-xl border border-white/8 bg-white/4 p-4" : ""}>
          <p className={`m-0 italic ${isAgent ? "text-xs text-slate-500" : sharedDark ? "text-sm text-slate-300" : "text-slate-500"}`}>
            No active local comps were mapped for comparative pricing.
          </p>
        </div>
      )}
    </section>
  );
}
