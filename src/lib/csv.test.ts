import { describe, expect, it } from "vitest";
import {
  escapeSpreadsheetCell,
  parseCsv,
  parseCsvNumbers,
  parseCsvYears,
  serializeCsv,
} from "./csv";

describe("CSV helpers", () => {
  it("parses comma-separated values and trims empty entries", () => {
    expect(parseCsv(" CSE, IT, ,AIML ")).toEqual(["CSE", "IT", "AIML"]);
    expect(parseCsv(null)).toEqual([]);
  });

  it("serializes unique values", () => {
    expect(serializeCsv(["CSE", " IT ", "CSE", 2026])).toBe("CSE,IT,2026");
  });

  it("parses finite numbers and drops invalid parts", () => {
    expect(parseCsvNumbers("2025, 2026, nope, 2027.9")).toEqual([2025, 2026, 2027.9]);
  });

  it("normalizes graduation years to unique integers within range", () => {
    expect(parseCsvYears("2025.8,2025,1989,2101,2026,2026")).toEqual([2025, 2026]);
  });

  it("escapes spreadsheet formula cells", () => {
    expect(escapeSpreadsheetCell("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(escapeSpreadsheetCell("+1")).toBe("'+1");
    expect(escapeSpreadsheetCell("-1")).toBe("'-1");
    expect(escapeSpreadsheetCell("@cmd")).toBe("'@cmd");
    expect(escapeSpreadsheetCell("hello")).toBe("hello");
  });
});
