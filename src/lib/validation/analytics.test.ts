import { describe, expect, it } from "vitest";
import {
  driveExportQuerySchema,
  exportIdentifierSchema,
  shortlistExportQuerySchema,
} from "./analytics";

describe("analytics export validation", () => {
  it("defaults the export format to CSV", () => {
    expect(driveExportQuerySchema.parse({ driveId: "drive_1" }).format).toBe("csv");
    expect(shortlistExportQuerySchema.parse({ driveId: "drive_1", roundId: "round_1" })).toEqual({
      driveId: "drive_1",
      roundId: "round_1",
      format: "csv",
    });
  });

  it("accepts PDF exports and trims identifiers", () => {
    expect(
      shortlistExportQuerySchema.parse({ driveId: " drive_1 ", roundId: " round_2 ", format: "pdf" }),
    ).toEqual({ driveId: "drive_1", roundId: "round_2", format: "pdf" });
  });

  it("rejects missing/blank identifiers and unsupported formats", () => {
    expect(() => driveExportQuerySchema.parse({})).toThrow();
    expect(() => exportIdentifierSchema.parse("   ")).toThrow();
    expect(() => shortlistExportQuerySchema.parse({ driveId: "drive_1", format: "xlsx" })).toThrow();
    expect(() => exportIdentifierSchema.parse("x".repeat(101))).toThrow();
  });
});
