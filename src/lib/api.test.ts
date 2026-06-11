import { describe, expect, it } from "vitest";
import {
  buildApiHeaders,
  buildReportDetailUrl,
  buildReportPdfUrl,
  buildSharedReportPdfUrl,
  buildSharedReportUrl,
} from "./api";

describe("api auth headers", () => {
  it("adds a bearer token when a token provider is supplied", async () => {
    await expect(buildApiHeaders(() => Promise.resolve("token_123"))).resolves.toMatchObject({
      Authorization: "Bearer token_123",
      "Content-Type": "application/json",
    });
  });

  it("omits Authorization when no token provider is supplied", async () => {
    await expect(buildApiHeaders()).resolves.toEqual({
      "Content-Type": "application/json",
    });
  });
});

describe("report URLs", () => {
  it("builds authenticated report detail URLs", () => {
    expect(buildReportDetailUrl("report_123")).toBe("/api/reports/report_123");
  });

  it("builds authenticated report PDF URLs", () => {
    expect(buildReportPdfUrl("report_123")).toBe("/api/reports/report_123/pdf");
  });

  it("builds frontend shared report URLs", () => {
    expect(buildSharedReportUrl("shr_123")).toBe("/reports/share/shr_123");
  });

  it("builds public shared PDF URLs", () => {
    expect(buildSharedReportPdfUrl("shr_123")).toBe("/api/reports/share/shr_123/pdf");
  });

  it("escapes report and share URL identifiers", () => {
    expect(buildReportDetailUrl("report 123")).toBe("/api/reports/report%20123");
    expect(buildSharedReportPdfUrl("shr/123")).toBe("/api/reports/share/shr%2F123/pdf");
  });
});
