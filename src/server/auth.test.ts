import { describe, expect, it } from "vitest";
import { buildCookie, requireSession } from "./auth";

describe("auth helpers", () => {
  it("requires a WorkOS sealed session cookie", async () => {
    const result = await requireSession({
      cookieHeader: "",
      workos: null,
      env: { WORKOS_COOKIE_PASSWORD: "x".repeat(32) },
    });

    expect(result.authenticated).toBe(false);
    if (!result.authenticated) {
      expect(result.status).toBe(401);
    }
  });

  it("serializes secure http-only cookies", () => {
    expect(buildCookie("wos-session", "abc123", { maxAge: 60 })).toContain(
      "wos-session=abc123; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=60",
    );
  });
});
