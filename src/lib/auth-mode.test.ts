import { describe, expect, it } from "vitest";
import { resolveAuthMode } from "./auth-mode";

describe("auth mode", () => {
  it("defaults local development to demo mode", () => {
    expect(resolveAuthMode({ dev: true, prod: false, mode: undefined })).toBe("demo");
  });

  it("honors explicit demo mode in production for static deploy previews", () => {
    expect(resolveAuthMode({ dev: false, prod: true, mode: "demo" })).toBe("demo");
  });

  it("defaults production to demo mode when WorkOS is not configured", () => {
    expect(resolveAuthMode({ dev: false, prod: true, mode: undefined })).toBe("demo");
  });

  it("uses WorkOS in production when the client is configured", () => {
    expect(resolveAuthMode({ dev: false, prod: true, mode: undefined, workosConfigured: true })).toBe("workos");
  });

  it("honors explicit WorkOS mode when the client is configured", () => {
    expect(resolveAuthMode({ dev: true, prod: false, mode: "workos", workosConfigured: true })).toBe("workos");
  });

  it("falls back to demo when WorkOS mode is requested without a client id", () => {
    expect(resolveAuthMode({ dev: false, prod: true, mode: "workos", workosConfigured: false })).toBe("demo");
  });
});
