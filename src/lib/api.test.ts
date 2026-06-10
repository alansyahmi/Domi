import { describe, expect, it } from "vitest";
import { buildApiHeaders } from "./api";

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
