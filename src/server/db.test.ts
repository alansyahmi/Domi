import { describe, expect, it, vi } from "vitest";
import { getTursoConfig, toSqlArgs, connectIntegration, disconnectIntegration } from "./db";

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

  describe("integrations database helpers", () => {
    it("connectIntegration executes INSERT statement", async () => {
      const executeMock = vi.fn().mockResolvedValue({ rows: [] });
      const dbMock = { execute: executeMock };

      const result = await connectIntegration(
        dbMock as any,
        "agent_123",
        "portal_pg",
        "PropertyGuru",
        "Sync leads"
      );

      expect(executeMock).toHaveBeenCalledWith({
        sql: expect.stringContaining("INSERT OR REPLACE INTO integrations"),
        args: ["portal_pg", "agent_123", "PropertyGuru", "Sync leads"],
      });
      expect(result).toEqual({
        id: "portal_pg",
        agentId: "agent_123",
        name: "PropertyGuru",
        description: "Sync leads",
        status: "connected",
      });
    });

    it("disconnectIntegration executes DELETE statement", async () => {
      const executeMock = vi.fn().mockResolvedValue({ rows: [] });
      const dbMock = { execute: executeMock };

      await disconnectIntegration(dbMock as any, "agent_123", "portal_pg");

      expect(executeMock).toHaveBeenCalledWith({
        sql: expect.stringContaining("DELETE FROM integrations"),
        args: ["portal_pg", "agent_123"],
      });
    });
  });
});
