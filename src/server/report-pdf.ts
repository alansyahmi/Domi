import { calculateMarketPricingStats, hasTargetAskingPrice } from "../domain/reports";
import type { Agent, PropertyReport, ReportCitation, ReportComparableListing } from "../types";

const PDF_VERSION = "v3";

type PricingCard = {
  label: string;
  value: string;
  tone?: "success" | "warning" | "danger" | "muted";
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatRm(value: number): string {
  return value > 0 ? `RM ${value.toLocaleString("en-MY", { maximumFractionDigits: 0 })}` : "TBD";
}

function labelValue(value: string): string {
  if (!value || value.toLowerCase() === "unknown") return "TBD";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function sentimentLabel(value: string): string {
  if (value === "positive") return "Active / Positive";
  if (value === "neutral") return "Balanced / Neutral";
  if (value === "negative") return "Selective / Cautious";
  return labelValue(value);
}

function bodyToBullets(body: string): string[] {
  return body
    .split(/\n+/)
    .flatMap((line) => line.split(/(?<=[.!?])\s+/))
    .map((part) => part.trim())
    .filter(Boolean);
}

function diffTone(value: number): PricingCard["tone"] {
  if (value > 0) return "danger";
  if (value < 0) return "success";
  return "muted";
}

function diffText(value: number): string {
  if (value === 0) return "At market average";
  return `${Math.abs(value).toFixed(1)}% ${value > 0 ? "premium" : "discount"}`;
}

function buildPricingCards(report: PropertyReport): { title: string; cards: PricingCard[] } {
  const stats = calculateMarketPricingStats(report);
  const compareToTarget = hasTargetAskingPrice(report.inputSnapshot);

  if (!compareToTarget) {
    const range =
      stats.priceRangeMin > 0 && stats.priceRangeMax > 0
        ? stats.priceRangeMin === stats.priceRangeMax
          ? formatRm(stats.priceRangeMin)
          : `${formatRm(stats.priceRangeMin)} - ${formatRm(stats.priceRangeMax)}`
        : "TBD";

    const cards: PricingCard[] = [
      { label: "Average asking price", value: formatRm(stats.averagePrice), tone: "muted" },
      { label: "Active listing range", value: range, tone: "muted" },
      { label: "Average price / sqft", value: stats.averagePricePerSqft > 0 ? `RM ${stats.averagePricePerSqft.toLocaleString("en-MY", { maximumFractionDigits: 0 })}/sqft` : "TBD", tone: "muted" },
      { label: "Cited active listings", value: stats.validPriceCount > 0 ? String(stats.validPriceCount) : "TBD", tone: "muted" },
    ];

    if (stats.averageRentalPrice && stats.averageRentalPrice > 0 && stats.averagePrice > 0) {
      const avgYield = (stats.averageRentalPrice * 12 / stats.averagePrice) * 100;
      cards.push({
        label: "Estimated building yield",
        value: `${avgYield.toFixed(2)}%`,
        tone: "success",
      });
    }

    return {
      title: "Similar Property Pricing",
      cards,
    };
  }

  const cards: PricingCard[] = [
    { label: "Comparable market average", value: formatRm(stats.averagePrice), tone: "muted" },
    { label: "Asking vs. average", value: diffText(stats.priceDifferencePct), tone: diffTone(stats.priceDifferencePct) },
    { label: "Market avg PPS", value: stats.averagePricePerSqft > 0 ? `RM ${stats.averagePricePerSqft.toLocaleString("en-MY", { maximumFractionDigits: 0 })}/sqft` : "TBD", tone: "muted" },
    { label: "Asking PPS vs. average", value: diffText(stats.ppsDifferencePct), tone: diffTone(stats.ppsDifferencePct) },
  ];

  if (stats.estimatedGrossYield && stats.estimatedGrossYield > 0) {
    cards.push({
      label: "Estimated gross rental yield",
      value: `${stats.estimatedGrossYield.toFixed(2)}%`,
      tone: stats.estimatedGrossYield >= 4.5 ? "success" : "warning",
    });
  }

  return {
    title: "Current Market Pricing Analysis",
    cards,
  };
}

function renderCard(label: string, value: string, tone: PricingCard["tone"] = "muted"): string {
  return `
    <div class="mini-card">
      <span class="mini-label">${escapeHtml(label)}</span>
      <strong class="mini-value tone-${tone ?? "muted"}">${escapeHtml(value)}</strong>
    </div>
  `;
}

function renderPricingPanel(report: PropertyReport): string {
  const { title, cards } = buildPricingCards(report);
  const stats = calculateMarketPricingStats(report);

  const comparableRows = report.comparableListings
    .map((comp: ReportComparableListing) => `
      <tr>
        <td class="col-title">${comp.url ? `<a href="${escapeHtml(comp.url)}" target="_blank" rel="noreferrer">${escapeHtml(comp.title)}</a>` : escapeHtml(comp.title)}</td>
        <td>
          <div class="col-value">${escapeHtml(comp.askingPriceRm && comp.askingPriceRm > 0 ? `RM ${comp.askingPriceRm.toLocaleString("en-MY")}` : "TBD")}</div>
          ${comp.priceNote ? `<div class="price-note">${escapeHtml(comp.priceNote)}</div>` : ""}
        </td>
        <td>${escapeHtml(comp.builtUpSqft && comp.builtUpSqft > 0 ? `${comp.builtUpSqft.toLocaleString("en-MY")} sqft` : "TBD")}</td>
        <td>${escapeHtml(comp.bedrooms || comp.bathrooms ? `${comp.bedrooms ?? "-"}b / ${comp.bathrooms ?? "-"}ba` : "TBD")}</td>
        <td>${escapeHtml(comp.sourceName || "portal")}</td>
      </tr>
    `)
    .join("");

  const comparableTable = report.comparableListings.length > 0
    ? `
      <div class="pricing-table-wrap">
        <h3>Comparable Properties in Area</h3>
        <div class="table-shell">
          <table>
            <thead>
              <tr>
                <th>Property / Title</th>
                <th>Asking Price</th>
                <th>Size (Sqft)</th>
                <th>Bed/Bath</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>${comparableRows}</tbody>
          </table>
        </div>
      </div>
    `
    : `
      <div class="empty-state">
        <p>No active local comps were mapped for comparative pricing.</p>
      </div>
    `;

  const headerNote = hasTargetAskingPrice(report.inputSnapshot)
    ? `Pricing posture: compare the target ask against active listings and recent transactions, then keep the narrative measured.`
    : `Pricing posture: use the cited listing range as directional market context, not as a valuation.`;

  return `
    <section class="card section-card">
      <h2>${escapeHtml(title)}</h2>
      <div class="mini-grid">
        ${cards.map((card) => renderCard(card.label, card.value, card.tone)).join("")}
      </div>
      <p class="pricing-note">${escapeHtml(headerNote)}</p>
      ${comparableTable}
    </section>
  `;
}

function renderInsightGrid(report: PropertyReport): string {
  const input = report.inputSnapshot;
  const priceCertainty = report.analytics.priceCertainty >= 0.6 ? "High" : report.analytics.priceCertainty >= 0.35 ? "Moderate" : "Low";
  const freshness = report.analytics.freshnessDays === 0 ? "Today" : `${report.analytics.freshnessDays}d`;
  const tone = report.analytics.sentiment === "positive" ? "success" : report.analytics.sentiment === "negative" ? "danger" : "muted";

  const cards = [
    ["Pricing trend", report.analytics.pricingTrend],
    ["Asking price", formatRm(input.askingPriceRm)],
    ["Intent and tenure", `${labelValue(input.listingIntent)} | ${labelValue(input.tenure)}`],
    ["Buyer sentiment", sentimentLabel(report.analytics.sentiment)],
    ["Confidence", `${Math.round(report.analytics.confidenceScore * 100)}%`],
    ["Data completeness", `${Math.round(report.analytics.dataCompleteness * 100)}% (${report.citations.length} sources)`],
    ["Price certainty", `${priceCertainty}${report.analytics.priceCertainty < 0.35 ? " (askings only)" : ""}`],
    ["Freshness", freshness],
  ] as const;

  return `
    <div class="insight-grid">
      ${cards.map(([label, value], index) => `
        <article class="insight-card">
          <span>${escapeHtml(label)}</span>
          <strong class="${index === 3 ? `tone-${tone}` : ""}">${escapeHtml(value)}</strong>
        </article>
      `).join("")}
    </div>
  `;
}

function renderSection(sectionTitle: string, body: string): string {
  const bullets = bodyToBullets(body);
  return `
    <article class="section-card card">
      <div class="section-head">
        <span class="section-icon">▣</span>
        <h3>${escapeHtml(sectionTitle)}</h3>
      </div>
      <ul class="bullet-list">
        ${bullets.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
      </ul>
    </article>
  `;
}

function renderCitations(report: PropertyReport): string {
  if (report.citations.length === 0) {
    return `
      <section class="card section-card">
        <h2>Sources</h2>
        <p class="muted-note">No citations were attached to this report.</p>
      </section>
    `;
  }

  const label = (citation: ReportCitation): string => {
    if (citation.sourceType === "official") return "Official";
    if (citation.sourceType === "community") return "Community";
    if (citation.sourceType === "model") return "Model";
    if (citation.sourceType === "comparable_listing") return "Current Listing";
    return "Source";
  };

  return `
    <section class="card section-card">
      <h2>Sources</h2>
      <div class="citation-list">
        ${report.citations.map((citation) => `
          <article class="citation-card">
            <div class="citation-kicker citation-${label(citation).toLowerCase().replace(/\s+/g, "-")}">${escapeHtml(label(citation).toUpperCase())}</div>
            <div class="citation-body">
              <a href="${escapeHtml(citation.url)}" target="_blank" rel="noreferrer">${escapeHtml(citation.title)}</a>
              ${citation.snippet ? `<p>${escapeHtml(citation.snippet)}</p>` : ""}
            </div>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function renderHero(report: PropertyReport, agent: Agent): string {
  const input = report.inputSnapshot;
  return `
    <section class="card hero-card">
      <div class="hero-top">
        <div class="brand-mark">▣</div>
        <div class="hero-copy">
          <div class="eyebrow">Report ready</div>
          <h1>${escapeHtml(report.title)}</h1>
          <p class="subtle">${escapeHtml(report.address)}</p>
        </div>
        <div class="status-chip">Fresh intelligence</div>
      </div>
      <div class="hero-meta">
        <span>${escapeHtml(report.propertyType)}</span>
        <span>•</span>
        <span>${escapeHtml(input.askingPriceRm > 0 ? `RM ${input.askingPriceRm.toLocaleString("en-MY")}` : "Price TBD")}</span>
        <span>•</span>
        <span>${escapeHtml(labelValue(input.listingIntent))}</span>
        <span>•</span>
        <span>${escapeHtml(labelValue(input.tenure))}</span>
      </div>
      <div class="hero-body">
        <div>
          <span class="label">Market read</span>
          <p>${escapeHtml(report.marketSignal || "Market signal is not available.")}</p>
        </div>
        <div>
          <span class="label">Buyer sentiment</span>
          <p>${escapeHtml(report.sentimentSummary || "Buyer sentiment is stable.")}</p>
        </div>
      </div>
    </section>
  `;
}

function renderSideCard(report: PropertyReport, agent: Agent): string {
  const initials = escapeHtml(agent.avatarInitials || "AG");
  return `
    <section class="card side-card">
      <div class="avatar">${initials}</div>
      <h2>${escapeHtml(agent.fullName)}</h2>
      ${agent.renNumber ? `<p class="kicker">${escapeHtml(agent.renNumber)}</p>` : ""}
      ${agent.agencyName ? `<p class="subtle">${escapeHtml(agent.agencyName)}</p>` : ""}
      ${agent.bio ? `<p class="bio">${escapeHtml(agent.bio)}</p>` : ""}
      <div class="contact-list">
        ${agent.email ? `<div>${escapeHtml(agent.email)}</div>` : ""}
        ${agent.phone ? `<div>${escapeHtml(agent.phone)}</div>` : ""}
      </div>
      <div class="side-note">
        <span class="label">Prepared for</span>
        <strong>${escapeHtml(report.propertyName || report.address)}</strong>
      </div>
    </section>
  `;
}

export function buildReportPdfHtml(report: PropertyReport, agent: Agent): string {
  const sections = report.contentSections.map((section) => renderSection(section.title, section.body)).join("");
  const vibe = report.analytics.neighborhoodVibe
    ? `
      <section class="card section-card vibe-card">
        <div class="vibe-header">
          <div>
            <h2>Neighborhood Vibe</h2>
            <p class="subtle">${escapeHtml(report.analytics.neighborhoodVibe.label)}</p>
          </div>
          <div class="vibe-score">
            <strong>${report.analytics.neighborhoodVibe.score.toFixed(1)}</strong>
            <span>Places</span>
          </div>
        </div>
        <div class="amenity-grid">
          ${report.analytics.neighborhoodVibe.amenities.map((amenity) => `
            <article class="amenity-card">
              <span class="mini-label">${escapeHtml(amenity.type)}</span>
              <strong>${escapeHtml(amenity.name)}</strong>
              <div class="amenity-meta">
                <span>${escapeHtml(amenity.distance || "")}</span>
                ${amenity.rating ? `<span>${amenity.rating.toFixed(1)}★</span>` : ""}
              </div>
            </article>
          `).join("")}
        </div>
      </section>
    `
    : "";

  const sectionsColumn = `
    <div class="content-stack">
      ${renderHero(report, agent)}
      ${renderInsightGrid(report)}
      ${renderPricingPanel(report)}
      ${vibe}
      <section class="card section-card">
        <h2>Detailed Assessment</h2>
        <div class="section-stack">
          ${sections}
        </div>
      </section>
      ${renderCitations(report)}
    </div>
  `;

  return `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${escapeHtml(report.title)} PDF</title>
        <style>
          :root {
            color-scheme: dark;
            --bg: #1a1a1a;
            --surface: #1e1e1e;
            --surface-2: #252525;
            --surface-3: #2d2d2d;
            --text: #f8fafc;
            --muted: #94a3b8;
            --muted-2: #64748b;
            --line: #2d2d2d;
            --gold: #f8d56b;
            --green: #6ee7b7;
            --red: #fca5a5;
            --shadow: 0 18px 32px rgba(0, 0, 0, 0.22);
          }
          * { box-sizing: border-box; }
          html, body { margin: 0; padding: 0; background: var(--bg); color: var(--text); }
          body {
            font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            font-size: 11px;
            line-height: 1.45;
            -webkit-font-smoothing: antialiased;
            text-rendering: optimizeLegibility;
          }
          a { color: #93c5fd; text-decoration: none; }
          a:hover { text-decoration: underline; }
          .page {
            width: 100%;
            padding: 20px 20px 28px;
          }
          .topbar {
            position: sticky;
            top: 0;
            z-index: 2;
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 16px;
            margin: 0 auto 18px;
            max-width: 1440px;
            padding: 12px 16px;
            border: 1px solid var(--line);
            border-radius: 16px;
            background: rgba(30, 30, 30, 0.96);
            box-shadow: var(--shadow);
          }
          .brand {
            display: flex;
            align-items: center;
            gap: 10px;
            font-weight: 900;
            letter-spacing: 0.02em;
          }
          .brand-mark {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 28px;
            height: 28px;
            border-radius: 999px;
            background: var(--gold);
            color: #0f172a;
            font-size: 14px;
            font-weight: 900;
          }
          .topbar-right {
            display: flex;
            gap: 12px;
            align-items: center;
            color: var(--muted);
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.12em;
            font-weight: 800;
          }
          .content {
            max-width: 1440px;
            margin: 0 auto;
            display: grid;
            grid-template-columns: minmax(0, 1fr) 300px;
            gap: 18px;
            align-items: start;
          }
          .content-stack {
            display: flex;
            flex-direction: column;
            gap: 18px;
          }
          .card {
            border: 1px solid var(--line);
            border-radius: 16px;
            background: var(--surface);
            box-shadow: var(--shadow);
          }
          .hero-card { padding: 22px; }
          .hero-top {
            display: flex;
            justify-content: space-between;
            align-items: start;
            gap: 16px;
          }
          .hero-copy { flex: 1 1 auto; min-width: 0; }
          .eyebrow {
            margin: 0 0 8px;
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.16em;
            color: var(--muted-2);
            font-weight: 800;
          }
          h1, h2, h3, p { margin: 0; }
          h1 {
            font-size: 28px;
            line-height: 1.08;
            letter-spacing: -0.03em;
            font-weight: 900;
          }
          .subtle { color: var(--muted); }
          .status-chip {
            padding: 8px 12px;
            border-radius: 999px;
            background: rgba(248, 213, 107, 0.14);
            border: 1px solid rgba(248, 213, 107, 0.22);
            color: var(--gold);
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.12em;
            font-weight: 900;
            white-space: nowrap;
          }
          .hero-meta {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-top: 12px;
            color: var(--muted);
            font-weight: 700;
          }
          .hero-body {
            margin-top: 18px;
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 14px;
            padding-top: 18px;
            border-top: 1px solid var(--line);
          }
          .label {
            display: inline-block;
            margin-bottom: 6px;
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.14em;
            font-weight: 900;
            color: var(--muted-2);
          }
          .hero-body p {
            color: #e2e8f0;
            font-size: 13px;
            line-height: 1.55;
            font-weight: 600;
          }
          .insight-grid {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 12px;
          }
          .insight-card, .mini-card, .amenity-card, .citation-card {
            background: var(--surface-2);
            border: 1px solid rgba(255, 255, 255, 0.04);
            border-radius: 12px;
          }
          .insight-card {
            padding: 14px;
            min-height: 74px;
          }
          .insight-card span, .mini-label {
            display: block;
            margin-bottom: 8px;
            color: var(--muted-2);
            font-size: 9px;
            font-weight: 900;
            letter-spacing: 0.14em;
            text-transform: uppercase;
          }
          .insight-card strong {
            display: block;
            color: #f8fafc;
            font-size: 14px;
            line-height: 1.3;
            font-weight: 900;
          }
          .section-card {
            padding: 20px;
          }
          .section-card h2 {
            font-size: 20px;
            line-height: 1.15;
            font-weight: 900;
            margin-bottom: 14px;
          }
          .section-head {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 10px;
          }
          .section-icon {
            color: var(--gold);
            font-weight: 900;
          }
          .section-head h3 {
            font-size: 15px;
            font-weight: 900;
          }
          .mini-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 12px;
            margin-bottom: 12px;
          }
          .mini-card {
            padding: 14px;
          }
          .mini-value {
            display: block;
            font-size: 18px;
            line-height: 1.2;
            font-weight: 900;
          }
          .tone-success { color: var(--green); }
          .tone-warning { color: var(--gold); }
          .tone-danger { color: var(--red); }
          .tone-muted { color: #f8fafc; }
          .pricing-note, .muted-note {
            color: var(--muted);
            margin: 0 0 12px;
            font-size: 11px;
          }
          .pricing-table-wrap h3 { margin: 16px 0 10px; font-size: 14px; font-weight: 900; }
          .table-shell {
            overflow: hidden;
            border-radius: 12px;
            border: 1px solid rgba(255, 255, 255, 0.04);
          }
          table {
            width: 100%;
            border-collapse: collapse;
            background: #1d1d1d;
          }
          th, td {
            padding: 10px 12px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.04);
            vertical-align: top;
            text-align: left;
          }
          th {
            font-size: 9px;
            text-transform: uppercase;
            letter-spacing: 0.14em;
            color: var(--muted-2);
          }
          td {
            color: #cbd5e1;
            font-size: 10px;
          }
          .col-value { font-weight: 800; color: #f8fafc; }
          .price-note { margin-top: 3px; color: var(--muted); font-size: 9px; font-style: italic; }
          .col-title { font-weight: 800; color: #f8fafc; }
          .col-title a { color: #93c5fd; }
          .empty-state {
            padding: 14px;
            border: 1px dashed rgba(255, 255, 255, 0.08);
            border-radius: 12px;
            color: var(--muted);
          }
          .bullet-list {
            margin: 0;
            padding-left: 18px;
            color: #e2e8f0;
          }
          .bullet-list li {
            margin: 0 0 8px;
            padding-left: 4px;
            break-inside: avoid;
          }
          .section-stack {
            display: grid;
            gap: 14px;
          }
          .vibe-header {
            display: flex;
            justify-content: space-between;
            align-items: start;
            gap: 16px;
            margin-bottom: 14px;
          }
          .vibe-score {
            text-align: right;
          }
          .vibe-score strong {
            display: block;
            font-size: 26px;
            line-height: 1;
            font-weight: 900;
          }
          .vibe-score span {
            color: var(--muted);
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.12em;
            font-weight: 800;
          }
          .amenity-grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 12px;
          }
          .amenity-card {
            padding: 12px;
          }
          .amenity-card strong {
            display: block;
            margin-bottom: 8px;
            color: #f8fafc;
            font-size: 12px;
            font-weight: 800;
          }
          .amenity-meta {
            display: flex;
            justify-content: space-between;
            gap: 8px;
            color: var(--muted);
            font-size: 10px;
            font-weight: 700;
          }
          .citation-list {
            display: grid;
            gap: 10px;
          }
          .citation-card {
            padding: 12px;
            display: grid;
            grid-template-columns: 110px minmax(0, 1fr);
            gap: 12px;
          }
          .citation-kicker {
            align-self: start;
            justify-self: start;
            padding: 5px 8px;
            border-radius: 999px;
            font-size: 9px;
            font-weight: 900;
            letter-spacing: 0.12em;
            text-transform: uppercase;
            background: rgba(255, 255, 255, 0.04);
            color: var(--gold);
          }
          .citation-official { color: var(--green); }
          .citation-community { color: var(--red); }
          .citation-model { color: #93c5fd; }
          .citation-current-listing { color: var(--gold); }
          .citation-body a {
            display: inline-block;
            margin-bottom: 4px;
            font-weight: 800;
          }
          .citation-body p {
            margin: 0;
            color: var(--muted);
            font-size: 10px;
            font-style: italic;
          }
          .side-card {
            padding: 20px;
            position: sticky;
            top: 18px;
          }
          .avatar {
            width: 64px;
            height: 64px;
            border-radius: 999px;
            display: grid;
            place-items: center;
            background: rgba(248, 213, 107, 0.16);
            color: var(--gold);
            font-size: 22px;
            font-weight: 900;
            margin-bottom: 16px;
          }
          .side-card h2 {
            margin: 0;
            font-size: 18px;
            line-height: 1.1;
            font-weight: 900;
          }
          .kicker {
            margin: 6px 0 0;
            font-size: 10px;
            color: var(--muted-2);
            text-transform: uppercase;
            letter-spacing: 0.14em;
            font-weight: 900;
          }
          .bio {
            margin: 12px 0 0;
            color: #e2e8f0;
          }
          .contact-list {
            margin-top: 16px;
            padding-top: 14px;
            border-top: 1px solid var(--line);
            color: #cbd5e1;
            display: grid;
            gap: 8px;
            font-size: 11px;
          }
          .side-note {
            margin-top: 16px;
            padding-top: 14px;
            border-top: 1px solid var(--line);
          }
          .side-note strong {
            display: block;
            color: #f8fafc;
            font-size: 13px;
            font-weight: 800;
          }
          @media print {
            .page { padding: 0; }
            .topbar { position: fixed; top: 0; left: 0; right: 0; margin: 0 0 12px; border-radius: 0; }
            .content { padding-top: 82px; }
            .side-card { position: static; }
            .card { box-shadow: none; }
            a { color: #93c5fd; text-decoration: none; }
          }
        </style>
      </head>
      <body>
        <div class="page">
          <header class="topbar">
            <div class="brand">
              <span class="brand-mark">▣</span>
              <span>re:AI Insights</span>
            </div>
            <div class="topbar-right">
              <span>${escapeHtml(`PDF ${PDF_VERSION}`)}</span>
              <span>${escapeHtml(report.propertyKey || report.id)}</span>
            </div>
          </header>

          <main class="content">
            ${sectionsColumn}
            ${renderSideCard(report, agent)}
          </main>
        </div>
      </body>
    </html>
  `;
}

export async function generateReportPdf(report: PropertyReport, agent: Agent): Promise<Uint8Array> {
  try {
    const { chromium } = await import("@playwright/test");
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
      const html = buildReportPdfHtml(report, agent);
      await page.setContent(html, { waitUntil: "load" });
      const pdf = await page.pdf({
        format: "Letter",
        landscape: true,
        printBackground: true,
        margin: { top: "0.35in", right: "0.35in", bottom: "0.45in", left: "0.35in" },
      });
      await page.close();
      return new Uint8Array(pdf);
    } finally {
      await browser.close();
    }
  } catch {
    return generateFallbackReportPdf(report, agent);
  }
}

function generateFallbackReportPdf(report: PropertyReport, agent: Agent): Uint8Array {
  const pages = new FallbackPdfLayout(report, agent).render();
  const objects = buildFallbackPdfObjects(pages);

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];

  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (const offset of offsets.slice(1)) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new TextEncoder().encode(pdf);
}

const FALLBACK_PAGE_WIDTH = 612;
const FALLBACK_PAGE_HEIGHT = 792;
const FALLBACK_PANEL_X = 42;
const FALLBACK_PANEL_Y = 42;
const FALLBACK_PANEL_W = 528;
const FALLBACK_PANEL_H = 708;
const FALLBACK_CONTENT_X = 66;
const FALLBACK_CONTENT_W = 480;
const FALLBACK_TOP_Y = 684;
const FALLBACK_BOTTOM_Y = 90;
const FALLBACK_COLORS = {
  navy: [0.016, 0.086, 0.153],
  navySoft: [0.102, 0.169, 0.235],
  gold: [1, 0.831, 0.353],
  background: [0.969, 0.976, 0.984],
  surface: [1, 1, 1],
  surfaceSoft: [0.945, 0.957, 0.969],
  line: [0.863, 0.89, 0.918],
  muted: [0.4, 0.455, 0.522],
  success: [0.02, 0.588, 0.412],
  danger: [0.761, 0.149, 0.149],
} as const;

type FallbackColor = readonly [number, number, number];

interface FallbackPdfPage {
  commands: string[];
  pageNumber: number;
}

function fallbackEscapePdfText(value: string): string {
  return value
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "'")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function fallbackColor(colorValue: FallbackColor, operator: "rg" | "RG" = "rg"): string {
  return `${colorValue.map((part) => part.toFixed(3)).join(" ")} ${operator}`;
}

function fallbackFillRect(x: number, y: number, width: number, height: number, fill: FallbackColor): string {
  return `${fallbackColor(fill)} ${x} ${y} ${width} ${height} re f`;
}

function fallbackStrokeRect(x: number, y: number, width: number, height: number, stroke: FallbackColor): string {
  return `${fallbackColor(stroke, "RG")} ${x} ${y} ${width} ${height} re S`;
}

function fallbackLine(x1: number, y1: number, x2: number, y2: number, stroke: FallbackColor, width = 1): string {
  return `${width} w ${fallbackColor(stroke, "RG")} ${x1} ${y1} m ${x2} ${y2} l S`;
}

function fallbackTextAt(
  x: number,
  y: number,
  size: number,
  value: string,
  font: "F1" | "F2" | "F3" = "F1",
  fill: FallbackColor = FALLBACK_COLORS.navy,
): string {
  return `BT /${font} ${size} Tf ${fallbackColor(fill)} ${x} ${y} Td (${fallbackEscapePdfText(value)}) Tj ET`;
}

function fallbackWrapText(value: string, maxLength = 82): string[] {
  const words = value.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxLength && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function fallbackCitationLabel(citation: ReportCitation): string {
  if (citation.sourceType === "official") return "Official";
  if (citation.sourceType === "community") return "Community";
  if (citation.sourceType === "model") return "Model";
  if (citation.sourceType === "comparable_listing") return "Current Listing";
  return "Source";
}

class FallbackPdfLayout {
  private pages: FallbackPdfPage[] = [];
  private cursorY = FALLBACK_TOP_Y;

  constructor(
    private readonly report: PropertyReport,
    private readonly agent: Agent,
  ) {
    this.addPage();
  }

  render(): FallbackPdfPage[] {
    this.renderHero();
    this.renderMetricGrid();
    this.renderComparableListings();
    this.renderSections();
    this.renderCitations();
    this.renderFinalFooters();
    return this.pages;
  }

  private current(): FallbackPdfPage {
    return this.pages[this.pages.length - 1];
  }

  private add(command: string): void {
    this.current().commands.push(command);
  }

  private addPage(): void {
    const pageNumber = this.pages.length + 1;
    const page: FallbackPdfPage = { commands: [], pageNumber };
    this.pages.push(page);
    this.cursorY = FALLBACK_TOP_Y;

    page.commands.push(
      fallbackFillRect(0, 0, FALLBACK_PAGE_WIDTH, FALLBACK_PAGE_HEIGHT, FALLBACK_COLORS.background),
      fallbackFillRect(FALLBACK_PANEL_X, FALLBACK_PANEL_Y, FALLBACK_PANEL_W, FALLBACK_PANEL_H, FALLBACK_COLORS.surface),
      fallbackStrokeRect(FALLBACK_PANEL_X, FALLBACK_PANEL_Y, FALLBACK_PANEL_W, FALLBACK_PANEL_H, FALLBACK_COLORS.line),
      fallbackFillRect(FALLBACK_PANEL_X, 710, FALLBACK_PANEL_W, 40, FALLBACK_COLORS.navy),
      fallbackFillRect(66, 721, 18, 18, FALLBACK_COLORS.gold),
      fallbackTextAt(92, 724, 10, "SIGNATIS PROPERTY REPORT", "F2", FALLBACK_COLORS.surface),
      fallbackTextAt(390, 724, 8.5, `PDF ${PDF_VERSION}`, "F1", FALLBACK_COLORS.gold),
      fallbackTextAt(460, 724, 9, `Page ${pageNumber}`, "F1", FALLBACK_COLORS.surface),
      fallbackFillRect(FALLBACK_PANEL_X, 42, FALLBACK_PANEL_W, 34, FALLBACK_COLORS.navy),
      fallbackTextAt(66, 55, 8.5, `${this.agent.email}  |  ${this.agent.phone}`, "F1", FALLBACK_COLORS.surface),
    );

    if (pageNumber > 1) {
      page.commands.push(
        fallbackTextAt(FALLBACK_CONTENT_X, 682, 13, this.report.title, "F2", FALLBACK_COLORS.navy),
        fallbackLine(FALLBACK_CONTENT_X, 668, FALLBACK_CONTENT_X + FALLBACK_CONTENT_W, 668, FALLBACK_COLORS.line),
      );
      this.cursorY = 646;
    }
  }

  private renderFinalFooters(): void {
    const total = this.pages.length;
    for (const page of this.pages) {
      page.commands.push(fallbackTextAt(500, 55, 8.5, `${page.pageNumber}/${total}`, "F1", FALLBACK_COLORS.surface));
    }
  }

  private ensureSpace(height: number): void {
    if (this.cursorY - height < FALLBACK_BOTTOM_Y) {
      this.addPage();
    }
  }

  private writeWrapped(
    text: string,
    options: {
      x?: number;
      size?: number;
      font?: "F1" | "F2" | "F3";
      fill?: FallbackColor;
      maxLength?: number;
      lineGap?: number;
      after?: number;
    } = {},
  ): void {
    const x = options.x ?? FALLBACK_CONTENT_X;
    const size = options.size ?? 10;
    const maxLength = options.maxLength ?? 92;
    const lineGap = options.lineGap ?? 4;
    const lines = fallbackWrapText(text, maxLength);
    const lineHeight = size + lineGap;
    this.ensureSpace(lines.length * lineHeight + (options.after ?? 0));

    for (const wrappedLine of lines) {
      this.add(fallbackTextAt(x, this.cursorY, size, wrappedLine, options.font ?? "F1", options.fill ?? FALLBACK_COLORS.navy));
      this.cursorY -= lineHeight;
    }
    this.cursorY -= options.after ?? 0;
  }

  private renderHero(): void {
    const input = this.report.inputSnapshot;
    this.add(fallbackTextAt(FALLBACK_CONTENT_X, 674, 24, this.report.title, "F3", FALLBACK_COLORS.navy));
    this.add(fallbackTextAt(FALLBACK_CONTENT_X, 648, 10.5, `${this.agent.fullName}${this.agent.agencyName ? ` | ${this.agent.agencyName}` : ""}`, "F2", FALLBACK_COLORS.navySoft));
    this.add(fallbackTextAt(FALLBACK_CONTENT_X, 630, 10.5, `${this.report.address} | ${this.report.propertyType}`, "F1", FALLBACK_COLORS.muted));
    this.add(fallbackTextAt(FALLBACK_CONTENT_X, 612, 10.5, `${labelValue(input.listingIntent)} | ${labelValue(input.tenure)} | ${formatRm(input.askingPriceRm)}`, "F1", FALLBACK_COLORS.muted));
    this.add(fallbackLine(FALLBACK_CONTENT_X, 594, FALLBACK_CONTENT_X + FALLBACK_CONTENT_W, 594, FALLBACK_COLORS.gold, 2));
    this.cursorY = 568;
  }

  private renderMetricGrid(): void {
    const priceCertLabel = this.report.analytics.priceCertainty >= 0.60
      ? "High" : this.report.analytics.priceCertainty >= 0.35 ? "Moderate" : "Low";
    const metrics = [
      ["Market signal", this.report.marketSignal],
      ["Buyer sentiment", this.report.analytics.sentiment],
      ["Data completeness", `${Math.round(this.report.analytics.dataCompleteness * 100)}% (${this.report.citations.length} src)`],
      ["Price certainty", `${priceCertLabel}${this.report.analytics.priceCertainty < 0.35 ? " (askings only)" : ""}`],
      ["Confidence", `${Math.round(this.report.analytics.confidenceScore * 100)}%`],
      ["Source coverage", `${this.report.citations.length} citations`],
    ];
    const cardW = 232;
    const cardH = 58;
    this.ensureSpace(216);

    metrics.forEach(([label, value], index) => {
      const x = FALLBACK_CONTENT_X + (index % 2) * (cardW + 16);
      const y = this.cursorY - Math.floor(index / 2) * (cardH + 12) - cardH;
      this.add(fallbackFillRect(x, y, cardW, cardH, FALLBACK_COLORS.surfaceSoft));
      this.add(fallbackStrokeRect(x, y, cardW, cardH, FALLBACK_COLORS.line));
      this.add(fallbackTextAt(x + 12, y + 36, 8.5, label.toUpperCase(), "F2", FALLBACK_COLORS.muted));
      this.add(fallbackTextAt(x + 12, y + 17, 11, value, "F2", FALLBACK_COLORS.navy));
    });

    this.cursorY -= 216;
  }

  private renderComparableListings(): void {
    if (this.report.comparableListings.length === 0) return;

    this.ensureSpace(84);
    this.add(fallbackTextAt(FALLBACK_CONTENT_X, this.cursorY, 15, "Comparable Listings", "F2", FALLBACK_COLORS.navy));
    this.cursorY -= 10;
    this.add(fallbackLine(FALLBACK_CONTENT_X, this.cursorY, FALLBACK_CONTENT_X + FALLBACK_CONTENT_W, this.cursorY, FALLBACK_COLORS.line));
    this.cursorY -= 16;

    const items = this.report.comparableListings.slice(0, 3);
    for (const listing of items) {
      this.ensureSpace(92);
      this.add(fallbackFillRect(FALLBACK_CONTENT_X, this.cursorY - 52, FALLBACK_CONTENT_W, listing.priceNote ? 90 : 78, FALLBACK_COLORS.surfaceSoft));
      this.add(fallbackStrokeRect(FALLBACK_CONTENT_X, this.cursorY - 52, FALLBACK_CONTENT_W, listing.priceNote ? 90 : 78, FALLBACK_COLORS.line));
      this.add(fallbackTextAt(FALLBACK_CONTENT_X + 12, this.cursorY - 2, 10, listing.title, "F2", FALLBACK_COLORS.navy));
      this.add(fallbackTextAt(FALLBACK_CONTENT_X + 12, this.cursorY - 18, 8.5, `${formatRm(listing.askingPriceRm ?? 0)}${listing.builtUpSqft ? ` | ${listing.builtUpSqft.toLocaleString("en-MY")} sqft` : ""}${listing.bedrooms || listing.bathrooms ? ` | ${listing.bedrooms ?? "-"}b / ${listing.bathrooms ?? "-"}ba` : ""}`, "F1", FALLBACK_COLORS.muted));
      if (listing.priceNote) {
        this.add(fallbackTextAt(FALLBACK_CONTENT_X + 12, this.cursorY - 32, 8, listing.priceNote, "F1", FALLBACK_COLORS.muted));
        this.add(fallbackTextAt(FALLBACK_CONTENT_X + 12, this.cursorY - 46, 8, `${listing.sourceName || "portal"}${listing.listingIntent ? ` • ${labelValue(listing.listingIntent)}` : ""}`, "F1", FALLBACK_COLORS.navySoft));
      } else {
        this.add(fallbackTextAt(FALLBACK_CONTENT_X + 12, this.cursorY - 34, 8, `${listing.sourceName || "portal"}${listing.listingIntent ? ` • ${labelValue(listing.listingIntent)}` : ""}`, "F1", FALLBACK_COLORS.navySoft));
      }
      this.cursorY -= listing.priceNote ? 100 : 88;
    }
  }

  private renderSectionTitle(title: string): void {
    this.ensureSpace(38);
    this.add(fallbackTextAt(FALLBACK_CONTENT_X, this.cursorY, 15, title, "F2", FALLBACK_COLORS.navy));
    this.cursorY -= 10;
    this.add(fallbackLine(FALLBACK_CONTENT_X, this.cursorY, FALLBACK_CONTENT_X + FALLBACK_CONTENT_W, this.cursorY, FALLBACK_COLORS.line));
    this.cursorY -= 18;
  }

  private renderSections(): void {
    for (const section of this.report.contentSections) {
      this.renderSectionTitle(section.title);
      this.writeWrapped(section.body, {
        size: 10,
        fill: FALLBACK_COLORS.navySoft,
        maxLength: 94,
        after: 14,
      });
    }
  }

  private renderCitations(): void {
    if (this.report.citations.length === 0) return;

    this.renderSectionTitle("Sources");
    for (const citation of this.report.citations) {
      const label = fallbackCitationLabel(citation);
      this.ensureSpace(56);
      this.add(fallbackFillRect(FALLBACK_CONTENT_X, this.cursorY - 34, FALLBACK_CONTENT_W, 42, FALLBACK_COLORS.surfaceSoft));
      this.add(fallbackStrokeRect(FALLBACK_CONTENT_X, this.cursorY - 34, FALLBACK_CONTENT_W, 42, FALLBACK_COLORS.line));
      this.add(fallbackTextAt(FALLBACK_CONTENT_X + 12, this.cursorY - 8, 8, label.toUpperCase(), "F2", label === "Community" ? FALLBACK_COLORS.danger : FALLBACK_COLORS.success));
      this.writeWrapped(`${citation.title}: ${citation.url}`, {
        x: FALLBACK_CONTENT_X + 12,
        size: 8.5,
        fill: FALLBACK_COLORS.navy,
        maxLength: 96,
        after: 8,
      });
    }
  }
}

function buildFallbackPdfObjects(pages: FallbackPdfPage[]): string[] {
  const fontObjectCount = 3;
  const firstPageObject = 3;
  const firstFontObject = firstPageObject + pages.length * 2;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pages.map((_, index) => `${firstPageObject + index * 2} 0 R`).join(" ")}] /Count ${pages.length} >>`,
  ];

  pages.forEach((page, index) => {
    const pageObject = firstPageObject + index * 2;
    const contentObject = pageObject + 1;
    const stream = page.commands.join("\n");
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${FALLBACK_PAGE_WIDTH} ${FALLBACK_PAGE_HEIGHT}] /Resources << /Font << /F1 ${firstFontObject} 0 R /F2 ${firstFontObject + 1} 0 R /F3 ${firstFontObject + 2} 0 R >> >> /Contents ${contentObject} 0 R >>`,
      `<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream`,
    );
  });

  objects.push(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Times-Bold >>",
  );

  if (objects.length !== 2 + pages.length * 2 + fontObjectCount) {
    throw new Error("PDF object assembly failed.");
  }

  return objects;
}
