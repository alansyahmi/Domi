import { describe, expect, it } from "vitest";
import { getTursoConfig, toSqlArgs } from "./db";

describe("database helpers", () => {
  it("requires Turso credentials", () => {
    expect(() => getTursoConfig({})).toThrow(
      "Missing environment variable TURSO_DATABASE_URL",
    );
  });

  it("passes defined SQL args through unchanged", () => {
    expect(toSqlArgs(["agent_1", undefined, 12, null])).toEqual([
      "agent_1",
      12,
      null,
    ]);
  });
});
