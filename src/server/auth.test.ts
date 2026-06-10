import { describe, expect, it, vi } from "vitest";
import { buildCookie, requireBearerSession, requireSession, verifyWorkosToken } from "./auth";

vi.mock("jose", () => {
  return {
    createRemoteJWKSet: () => () => {},
    jwtVerify: async (token: string) => {
      if (token === "valid_token") {
        return {
          payload: {
            sub: "user_123",
            email: "agent@example.com",
            firstName: "Ada",
            lastName: "Agent",
          },
        };
      }
      if (token === "missing_sub_token") {
        return {
          payload: {
            email: "agent@example.com",
          },
        };
      }
      throw new Error("Invalid token");
    },
  };
});

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

  it("accepts a verified bearer token as a session", async () => {
    const result = await requireBearerSession({
      authorizationHeader: "Bearer access_token",
      verifyAccessToken: async () => ({
        id: "user_123",
        email: "agent@example.com",
        firstName: "Ada",
        lastName: "Agent",
      }),
    });

    expect(result).toEqual({
      authenticated: true,
      user: {
        id: "user_123",
        email: "agent@example.com",
        firstName: "Ada",
        lastName: "Agent",
      },
    });
  });

  it("rejects requests without a bearer token", async () => {
    const result = await requireBearerSession({
      authorizationHeader: null,
      verifyAccessToken: async () => {
        throw new Error("should not verify");
      },
    });

    expect(result.authenticated).toBe(false);
    if (!result.authenticated) {
      expect(result.reason).toBe("No bearer token.");
    }
  });

  describe("verifyWorkosToken", () => {
    const mockWorkos = {
      userManagement: {
        getJwksUrl: () => "https://example.com/jwks",
      },
    };

    it("verifies a valid token successfully", async () => {
      const user = await verifyWorkosToken("valid_token", mockWorkos, "client_123");
      expect(user).toEqual({
        id: "user_123",
        email: "agent@example.com",
        firstName: "Ada",
        lastName: "Agent",
      });
    });

    it("fails on an invalid token", async () => {
      await expect(
        verifyWorkosToken("invalid_token", mockWorkos, "client_123")
      ).rejects.toThrow("Invalid token");
    });

    it("fails if client ID is missing", async () => {
      await expect(
        verifyWorkosToken("valid_token", mockWorkos, "")
      ).rejects.toThrow("WorkOS client ID is not configured.");
    });

    it("fails if sub claim is missing in token payload", async () => {
      await expect(
        verifyWorkosToken("missing_sub_token", mockWorkos, "client_123")
      ).rejects.toThrow("Invalid token: sub claim is missing.");
    });
  });
});
