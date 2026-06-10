import { describe, expect, it } from "vitest";
import { resolveAuthMode } from "./auth-mode";

describe("auth mode", () => {
  it("defaults local development to demo mode", () => {
    expect(resolveAuthMode({ dev: true, prod: false, mode: undefined })).toBe("demo");
  });

  it("forces production to WorkOS mode", () => {
    expect(resolveAuthMode({ dev: false, prod: true, mode: "demo" })).toBe("workos");
  });

  it("honors explicit WorkOS mode outside production", () => {
    expect(resolveAuthMode({ dev: true, prod: false, mode: "workos" })).toBe("workos");
  });
});
