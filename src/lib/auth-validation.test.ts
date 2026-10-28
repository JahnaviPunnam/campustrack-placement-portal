import { describe, expect, it } from "vitest";
import { loginSchema, registerSchema } from "@/lib/validation/auth";
import { parseCsv, parseCsvNumbers, parseCsvYears, serializeCsv, escapeSpreadsheetCell } from "@/lib/csv";
import { computeProfileCompleteness } from "@/lib/profile-completeness";

describe("auth validation", () => {
  it("normalizes login email", () => {
    const result = loginSchema.parse({ email: "  Student@Campus.Test ", password: "x" });
    expect(result.email).toBe("student@campus.test");
  });

  it("rejects a weak password", () => {
    const result = registerSchema.safeParse({
      name: "Test Student",
      email: "test@campus.test",
      password: "weak",
      confirmPassword: "weak",
      rollNumber: "CSE2026999",
      branch: "CSE",
      graduationYear: new Date().getUTCFullYear(),
      cgpa: "8.2",
      backlogs: "0",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid registration", () => {
    const result = registerSchema.safeParse({
      name: "Test Student",
      email: "test@campus.test",
      password: "Strong@123",
      confirmPassword: "Strong@123",
      rollNumber: "CSE2026999",
      branch: "CSE",
      graduationYear: new Date().getUTCFullYear(),
      cgpa: "8.2",
      backlogs: "0",
    });
    expect(result.success).toBe(true);
  });
});

describe("csv helpers", () => {
  it("parses, trims and deduplicates", () => {
    expect(parseCsv(" CSE, IT ,,CSE ")).toEqual(["CSE", "IT", "CSE"]);
    expect(serializeCsv(["CSE", "IT", "CSE"])).toBe("CSE,IT");
  });

  it("parses numeric csv values safely", () => {
    expect(parseCsvNumbers("1,2,foo,4")).toEqual([1, 2, 4]);
    expect(parseCsvYears("2026,2027,1800,2027")).toEqual([2026, 2027]);
  });

  it("escapes spreadsheet formulas", () => {
    expect(escapeSpreadsheetCell("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(escapeSpreadsheetCell("normal")).toBe("normal");
  });
});

describe("profile completeness", () => {
  it("computes 100 for a complete profile", () => {
    const result = computeProfileCompleteness({
      phone: "9999999999",
      location: "Bengaluru",
      branch: "CSE",
      graduationYear: 2026,
      cgpa: 8.5,
      backlogs: 0,
      resumePath: "resume.pdf",
      githubUrl: "https://github.com/x",
      linkedinUrl: "https://linkedin.com/in/x",
      skillCount: 8,
      evidenceSkillCount: 3,
      targetRoleProfileId: "role-1",
    });
    expect(result.percentage).toBe(100);
    expect(result.missing).toHaveLength(0);
  });

  it("reports missing items", () => {
    const result = computeProfileCompleteness({
      phone: null,
      location: null,
      branch: "CSE",
      graduationYear: 2026,
      cgpa: null,
      backlogs: 0,
      resumePath: null,
      githubUrl: null,
      linkedinUrl: null,
      skillCount: 0,
      evidenceSkillCount: 0,
      targetRoleProfileId: null,
    });
    expect(result.percentage).toBe(15);
    expect(result.missing.length).toBeGreaterThan(3);
  });
});
