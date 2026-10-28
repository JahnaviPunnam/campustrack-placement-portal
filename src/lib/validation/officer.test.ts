import { describe, expect, it } from "vitest";
import {
  companySchema,
  driveCreateSchema,
  importedStudentRowSchema,
  offerCreateSchema,
  policyUpdateSchema,
} from "./officer";

describe("officer validation", () => {
  it("normalizes an imported student row", () => {
    const parsed = importedStudentRowSchema.parse({
      name: "Asha Rao",
      email: "ASHA@Example.EDU",
      rollNumber: "CSE-2026-001",
      branch: "CSE",
      graduationYear: "2026",
      cgpa: "",
      backlogs: "0",
      phone: "",
    });
    expect(parsed.email).toBe("asha@example.edu");
    expect(parsed.graduationYear).toBe(2026);
    expect(parsed.cgpa).toBeNull();
    expect(parsed.phone).toBeNull();
  });

  it("rejects invalid imported student fields", () => {
    expect(() =>
      importedStudentRowSchema.parse({
        name: "A",
        email: "not-an-email",
        rollNumber: "x",
        branch: "BIO",
        graduationYear: "1999",
      }),
    ).toThrow();
  });

  it("validates company URL and tier", () => {
    expect(() =>
      companySchema.parse({
        name: "Acme",
        industry: "Software",
        tier: "4",
        website: "javascript:alert(1)",
      }),
    ).toThrow();

    const parsed = companySchema.parse({
      name: "Acme",
      industry: "Software",
      tier: "2",
      website: "https://acme.test",
      location: "",
    });
    expect(parsed.tier).toBe(2);
    expect(parsed.location).toBeNull();
  });

  it("accepts a complete drive and normalizes the deadline", () => {
    const parsed = driveCreateSchema.parse({
      companyId: "company_1",
      title: "Campus Hiring",
      roleTitle: "Engineer",
      description: "",
      package: "9.5",
      location: "Remote",
      tier: "3",
      openings: "",
      deadline: "2026-12-31",
      minCgpa: "",
      maxBacklogs: "1",
      allowedBranches: ["CSE", "IT"],
      allowedGraduationYears: ["2026"],
      requireVerifiedProfile: true,
      requireResume: true,
      requiredSkills: [{ skillId: "skill_1", minProficiency: "3", weight: "4", isMandatory: true }],
      rounds: [],
    });
    expect(parsed.deadline.toISOString()).toBe("2026-12-31T23:59:59.999Z");
    expect(parsed.allowedGraduationYears).toEqual([2026]);
    expect(parsed.openings).toBeNull();
    expect(parsed.minCgpa).toBeNull();
  });

  it("rejects impossible calendar dates", () => {
    expect(() =>
      driveCreateSchema.parse({
        companyId: "company_1",
        title: "Campus Hiring",
        roleTitle: "Engineer",
        package: "9.5",
        location: "Remote",
        tier: 2,
        deadline: "2026-02-31",
        allowedBranches: [],
        allowedGraduationYears: [],
        requireVerifiedProfile: true,
        requireResume: true,
        requiredSkills: [{ skillId: "skill_1", minProficiency: 3, weight: 3, isMandatory: true }],
        rounds: [],
      }),
    ).toThrow();
  });

  it("rejects duplicate skills on a drive", () => {
    expect(() =>
      driveCreateSchema.parse({
        companyId: "company_1",
        title: "Campus Hiring",
        roleTitle: "Engineer",
        package: "9.5",
        location: "Remote",
        tier: 2,
        deadline: "2026-12-31",
        allowedBranches: [],
        allowedGraduationYears: [],
        requireVerifiedProfile: true,
        requireResume: true,
        requiredSkills: [
          { skillId: "skill_1", minProficiency: 3, weight: 3, isMandatory: true },
          { skillId: "skill_1", minProficiency: 2, weight: 2, isMandatory: false },
        ],
        rounds: [],
      }),
    ).toThrow();
  });

  it("validates policy tier CSVs", () => {
    expect(
      policyUpdateSchema.parse({
        maxOffersPerStudent: "1",
        blockedPlacedTiers: "1,2",
        dreamOfferEnabled: true,
        minimumDreamOfferIncrease: "10",
        requireVerifiedProfileDefault: true,
      }).blockedPlacedTiers,
    ).toBe("1,2");
    expect(() =>
      policyUpdateSchema.parse({
        maxOffersPerStudent: "1",
        blockedPlacedTiers: "1,4",
        dreamOfferEnabled: true,
        minimumDreamOfferIncrease: "10",
        requireVerifiedProfileDefault: true,
      }),
    ).toThrow();
  });

  it("validates offer package and joining date", () => {
    const parsed = offerCreateSchema.parse({
      applicationId: "application_1",
      package: "12.5",
      roleTitle: "Engineer",
      location: "Bengaluru",
      joiningDate: "2027-07-01",
      notes: "",
    });
    expect(parsed.package).toBe(12.5);
    expect(parsed.joiningDate?.toISOString()).toBe("2027-07-01T00:00:00.000Z");
    expect(() =>
      offerCreateSchema.parse({
        applicationId: "application_1",
        package: "0",
        roleTitle: "E",
        location: "X",
        joiningDate: "not-a-date",
      }),
    ).toThrow();
  });
});
