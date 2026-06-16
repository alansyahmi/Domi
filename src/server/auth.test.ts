import { describe, expect, it } from "vitest";
import {
  buildCookie,
  parseCookies,
  requireSession,
  sealSession,
  unsealSession,
} from "./auth";

describe("auth helpers", () => {
  const secret = "a-very-secure-secret-key-that-is-at-least-32-characters";
  const mockUser = {
    id: "user_123",
    email: "agent@example.com",
    firstName: "Ada",
    lastName: "Agent",
  };

  it("requires a sealed session cookie", async () => {
    const result = await requireSession({
      cookieHeader: "",
      env: { SESSION_SECRET: secret },
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

  it("parses cookies from header", () => {
    const cookies = parseCookies("foo=bar; wos-session=abc123");
    expect(cookies).toEqual({
      foo: "bar",
      "wos-session": "abc123",
    });
  });

  it("seals and unseals sessions correctly", async () => {
    const sealed = await sealSession(mockUser, secret);
    expect(typeof sealed).toBe("string");

    const unsealed = await unsealSession(sealed, secret);
    expect(unsealed).toEqual(mockUser);
  });

  it("fails to unseal with incorrect secret", async () => {
    const sealed = await sealSession(mockUser, secret);
    const unsealed = await unsealSession(sealed, "wrong-secret-key-incorrect-length-etc");
    expect(unsealed).toBeNull();
  });

  it("fails to unseal with invalid token", async () => {
    const unsealed = await unsealSession("invalid-token-string", secret);
    expect(unsealed).toBeNull();
  });

  it("validates session successfully via requireSession", async () => {
    const sealed = await sealSession(mockUser, secret);
    const cookieHeader = `wos-session=${sealed}`;
    
    const result = await requireSession({
      cookieHeader,
      env: { SESSION_SECRET: secret },
    });

    expect(result.authenticated).toBe(true);
    if (result.authenticated) {
      expect(result.user).toEqual(mockUser);
    }
  });
});
