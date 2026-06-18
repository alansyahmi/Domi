import type { Agent, PropertyReport, ReportCitation } from "../types";

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const PANEL_X = 42;
const PANEL_Y = 42;
const PANEL_W = 528;
const PANEL_H = 708;
const CONTENT_X = 66;
const CONTENT_W = 480;
const TOP_Y = 684;
const BOTTOM_Y = 90;
const PDF_VERSION = "v2";

const COLORS = {
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

type Color = readonly [number, number, number];

interface PdfPage {
  commands: string[];
  pageNumber: number;
}

function escapePdfText(value: string): string {
  return value
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "'")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function color(colorValue: Color, operator: "rg" | "RG" = "rg"): string {
  return `${colorValue.map((part) => part.toFixed(3)).join(" ")} ${operator}`;
}

function fillRect(x: number, y: number, width: number, height: number, fill: Color): string {
  return `${color(fill)} ${x} ${y} ${width} ${height} re f`;
}

function strokeRect(x: number, y: number, width: number, height: number, stroke: Color): string {
  return `${color(stroke, "RG")} ${x} ${y} ${width} ${height} re S`;
}

function line(x1: number, y1: number, x2: number, y2: number, stroke: Color, width = 1): string {
  return `${width} w ${color(stroke, "RG")} ${x1} ${y1} m ${x2} ${y2} l S`;
}

function textAt(
  x: number,
  y: number,
  size: number,
  value: string,
  font: "F1" | "F2" | "F3" = "F1",
  fill: Color = COLORS.navy,
): string {
  return `BT /${font} ${size} Tf ${color(fill)} ${x} ${y} Td (${escapePdfText(value)}) Tj ET`;
}

function wrapText(value: string, maxLength = 82): string[] {
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

function formatRm(value: number): string {
  return value > 0 ? `RM ${value.toLocaleString("en-MY")}` : "Price to be confirmed";
}

function labelValue(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function citationLabel(citation: ReportCitation): string {
  if (citation.sourceType === "official") return "Official";
  if (citation.sourceType === "community") return "Community";
  if (citation.sourceType === "model") return "Model";
  if (citation.sourceType === "comparable_listing") return "Current Listing";
  return "Source";
}

class PdfLayout {
  private pages: PdfPage[] = [];
  private cursorY = TOP_Y;

  constructor(
    private readonly report: PropertyReport,
    private readonly agent: Agent,
  ) {
    this.addPage();
  }

  render(): PdfPage[] {
    this.renderHero();
    this.renderMetricGrid();
    this.renderComparableListings();
    this.renderSections();
    this.renderCitations();
    this.renderFinalFooters();
    return this.pages;
  }

  private current(): PdfPage {
    return this.pages[this.pages.length - 1];
  }

  private add(command: string): void {
    this.current().commands.push(command);
  }

  private addPage(): void {
    const pageNumber = this.pages.length + 1;
    const page: PdfPage = { commands: [], pageNumber };
    this.pages.push(page);
    this.cursorY = TOP_Y;

    page.commands.push(
      fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, COLORS.background),
      fillRect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H, COLORS.surface),
      strokeRect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H, COLORS.line),
      fillRect(PANEL_X, 710, PANEL_W, 40, COLORS.navy),
      fillRect(66, 721, 18, 18, COLORS.gold),
      textAt(92, 724, 10, "SIGNATIS PROPERTY REPORT", "F2", COLORS.surface),
      textAt(390, 724, 8.5, `PDF ${PDF_VERSION}`, "F1", COLORS.gold),
      textAt(460, 724, 9, `Page ${pageNumber}`, "F1", COLORS.surface),
      fillRect(PANEL_X, 42, PANEL_W, 34, COLORS.navy),
      textAt(66, 55, 8.5, `${this.agent.email}  |  ${this.agent.phone}`, "F1", COLORS.surface),
    );

    if (pageNumber > 1) {
      page.commands.push(
        textAt(CONTENT_X, 682, 13, this.report.title, "F2", COLORS.navy),
        line(CONTENT_X, 668, CONTENT_X + CONTENT_W, 668, COLORS.line),
      );
      this.cursorY = 646;
    }
  }

  private renderFinalFooters(): void {
    const total = this.pages.length;
    for (const page of this.pages) {
      page.commands.push(textAt(500, 55, 8.5, `${page.pageNumber}/${total}`, "F1", COLORS.surface));
    }
  }

  private ensureSpace(height: number): void {
    if (this.cursorY - height < BOTTOM_Y) {
      this.addPage();
    }
  }

  private writeWrapped(
    text: string,
    options: {
      x?: number;
      size?: number;
      font?: "F1" | "F2" | "F3";
      fill?: Color;
      maxLength?: number;
      lineGap?: number;
      after?: number;
    } = {},
  ): void {
    const x = options.x ?? CONTENT_X;
    const size = options.size ?? 10;
    const maxLength = options.maxLength ?? 92;
    const lineGap = options.lineGap ?? 4;
    const lines = wrapText(text, maxLength);
    const lineHeight = size + lineGap;
    this.ensureSpace(lines.length * lineHeight + (options.after ?? 0));

    for (const wrappedLine of lines) {
      this.add(textAt(x, this.cursorY, size, wrappedLine, options.font ?? "F1", options.fill ?? COLORS.navy));
      this.cursorY -= lineHeight;
    }
    this.cursorY -= options.after ?? 0;
  }

  private renderHero(): void {
    const input = this.report.inputSnapshot;
    this.add(textAt(CONTENT_X, 674, 24, this.report.title, "F3", COLORS.navy));
    this.add(textAt(CONTENT_X, 648, 10.5, `${this.agent.fullName}${this.agent.agencyName ? ` | ${this.agent.agencyName}` : ""}`, "F2", COLORS.navySoft));
    this.add(textAt(CONTENT_X, 630, 10.5, `${this.report.address} | ${this.report.propertyType}`, "F1", COLORS.muted));
    this.add(textAt(CONTENT_X, 612, 10.5, `${labelValue(input.listingIntent)} | ${labelValue(input.tenure)} | ${formatRm(input.askingPriceRm)}`, "F1", COLORS.muted));
    this.add(line(CONTENT_X, 594, CONTENT_X + CONTENT_W, 594, COLORS.gold, 2));
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
      const x = CONTENT_X + (index % 2) * (cardW + 16);
      const y = this.cursorY - Math.floor(index / 2) * (cardH + 12) - cardH;
      this.add(fillRect(x, y, cardW, cardH, COLORS.surfaceSoft));
      this.add(strokeRect(x, y, cardW, cardH, COLORS.line));
      this.add(textAt(x + 12, y + 36, 8.5, label.toUpperCase(), "F2", COLORS.muted));
      this.add(textAt(x + 12, y + 17, 11, value, "F2", COLORS.navy));
    });

    this.cursorY -= 216;
  }

  private renderComparableListings(): void {
    if (this.report.comparableListings.length === 0) return;

    this.ensureSpace(84);
    this.add(textAt(CONTENT_X, this.cursorY, 15, "Comparable Listings", "F2", COLORS.navy));
    this.cursorY -= 10;
    this.add(line(CONTENT_X, this.cursorY, CONTENT_X + CONTENT_W, this.cursorY, COLORS.line));
    this.cursorY -= 16;

    const items = this.report.comparableListings.slice(0, 3);
    for (const listing of items) {
      this.ensureSpace(92);
      this.add(fillRect(CONTENT_X, this.cursorY - 52, CONTENT_W, 78, COLORS.surfaceSoft));
      this.add(strokeRect(CONTENT_X, this.cursorY - 52, CONTENT_W, 78, COLORS.line));
      this.add(textAt(CONTENT_X + 12, this.cursorY - 2, 10, listing.title, "F2", COLORS.navy));
      this.add(textAt(CONTENT_X + 12, this.cursorY - 18, 8.5, `${formatRm(listing.askingPriceRm ?? 0)}${listing.builtUpSqft ? ` | ${listing.builtUpSqft.toLocaleString("en-MY")} sqft` : ""}${listing.bedrooms || listing.bathrooms ? ` | ${listing.bedrooms ?? "-"}b / ${listing.bathrooms ?? "-"}ba` : ""}`, "F1", COLORS.muted));
      this.add(textAt(CONTENT_X + 12, this.cursorY - 34, 8, `${listing.sourceName || "portal"}${listing.listingIntent ? ` • ${labelValue(listing.listingIntent)}` : ""}`, "F1", COLORS.navySoft));
      this.cursorY -= 88;
    }
  }

  private renderSectionTitle(title: string): void {
    this.ensureSpace(38);
    this.add(textAt(CONTENT_X, this.cursorY, 15, title, "F2", COLORS.navy));
    this.cursorY -= 10;
    this.add(line(CONTENT_X, this.cursorY, CONTENT_X + CONTENT_W, this.cursorY, COLORS.line));
    this.cursorY -= 18;
  }

  private renderSections(): void {
    for (const section of this.report.contentSections) {
      this.renderSectionTitle(section.title);
      this.writeWrapped(section.body, {
        size: 10,
        fill: COLORS.navySoft,
        maxLength: 94,
        after: 14,
      });
    }
  }

  private renderCitations(): void {
    if (this.report.citations.length === 0) return;

    this.renderSectionTitle("Sources");
    for (const citation of this.report.citations) {
      const label = citationLabel(citation);
      this.ensureSpace(56);
      this.add(fillRect(CONTENT_X, this.cursorY - 34, CONTENT_W, 42, COLORS.surfaceSoft));
      this.add(strokeRect(CONTENT_X, this.cursorY - 34, CONTENT_W, 42, COLORS.line));
      this.add(textAt(CONTENT_X + 12, this.cursorY - 8, 8, label.toUpperCase(), "F2", label === "Community" ? COLORS.danger : COLORS.success));
      this.writeWrapped(`${citation.title}: ${citation.url}`, {
        x: CONTENT_X + 12,
        size: 8.5,
        fill: COLORS.navy,
        maxLength: 96,
        after: 8,
      });
    }
  }
}

function buildObjects(pages: PdfPage[]): string[] {
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
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${firstFontObject} 0 R /F2 ${firstFontObject + 1} 0 R /F3 ${firstFontObject + 2} 0 R >> >> /Contents ${contentObject} 0 R >>`,
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

export function generateReportPdf(report: PropertyReport, agent: Agent): Uint8Array {
  const pages = new PdfLayout(report, agent).render();
  const objects = buildObjects(pages);

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
