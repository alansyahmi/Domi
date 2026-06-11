import type { Agent, PropertyReport } from "../types";

function escapePdfText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
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

function textAt(x: number, y: number, size: number, value: string): string {
  return `BT /F1 ${size} Tf ${x} ${y} Td (${escapePdfText(value)}) Tj ET`;
}

function formatRm(value: number): string {
  return value > 0 ? `RM ${value.toLocaleString("en-MY")}` : "Price not provided";
}

function labelValue(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function wrappedTextAt(x: number, y: number, size: number, value: string, maxLength = 86): { commands: string[]; nextY: number } {
  const commands: string[] = [];
  let cursorY = y;
  for (const line of wrapText(value, maxLength)) {
    commands.push(textAt(x, cursorY, size, line));
    cursorY -= size + 5;
  }
  return { commands, nextY: cursorY };
}

function buildTextCommands(report: PropertyReport, agent: Agent): string {
  const input = report.inputSnapshot;
  const commands: string[] = [
    "0.96 0.97 0.98 rg 0 0 612 792 re f",
    "1 1 1 rg 54 52 504 688 re f",
    "0.86 0.89 0.93 RG 54 52 504 688 re S",
    "0.02 0.09 0.15 rg 54 690 504 50 re f",
    textAt(72, 710, 10, "SIGNATIS PROPERTY REPORT"),
    textAt(72, 650, 24, report.title),
    textAt(72, 624, 11, `${agent.fullName}${agent.agencyName ? ` | ${agent.agencyName}` : ""}`),
    textAt(72, 606, 11, `${report.address} | ${report.propertyType}`),
    textAt(72, 588, 11, `${labelValue(input.listingIntent)} | ${labelValue(input.tenure)} | ${formatRm(input.askingPriceRm)}`),
    "0.98 0.83 0.35 rg 72 570 468 2 re f",
  ];

  let y = 542;
  const summary = [
    `Market signal: ${report.marketSignal}`,
    `Buyer sentiment: ${report.sentimentSummary}`,
    `Pricing trend: ${report.analytics.pricingTrend}`,
    `Confidence: ${Math.round(report.analytics.confidenceScore * 100)}%`,
  ];

  for (const item of summary) {
    const wrapped = wrappedTextAt(72, y, 11, item, 82);
    commands.push(...wrapped.commands);
    y = wrapped.nextY - 4;
  }

  y -= 8;
  for (const section of report.contentSections) {
    commands.push(textAt(72, y, 15, section.title));
    y -= 20;
    const wrapped = wrappedTextAt(72, y, 10, section.body, 88);
    commands.push(...wrapped.commands);
    y = wrapped.nextY - 12;
  }

  if (report.citations.length > 0) {
    commands.push(textAt(72, y, 15, "Citations"));
    y -= 18;
    for (const citation of report.citations.slice(0, 4)) {
      const wrapped = wrappedTextAt(72, y, 9, `${citation.title}: ${citation.url}`, 96);
      commands.push(...wrapped.commands);
      y = wrapped.nextY - 4;
    }
  }

  commands.push(
    "0.02 0.09 0.15 rg 54 52 504 34 re f",
    textAt(72, 64, 9, `${agent.email}  |  ${agent.phone}`),
  );
  return commands.join("\n");
}

export function generateReportPdf(report: PropertyReport, agent: Agent): Uint8Array {
  const stream = buildTextCommands(report, agent);
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream`,
  ];

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
