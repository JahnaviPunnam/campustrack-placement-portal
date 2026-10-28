import { describe, expect, it } from "vitest";
import {
  applyToDriveSchema,
  profileUpdateSchema,
  skillInputSchema,
  withdrawApplicationSchema,
} from "./student";

const baseProfile = {
  name: "Asha Rao",
  phone: "",
  branch: "CSE",
  graduationYear: String(new Date().getUTCFullYear()),
  cgpa: "",
  backlogs: "0",
  headline: "",
  location: "",
  githubUrl: "",
  linkedinUrl: "",
  targetRoleProfileId: "",
};

describe("student validation", () => {
  it("normalises empty optional profile values to null", () => {
    const parsed = profileUpdateSchema.parse(baseProfile);
    expect(parsed.phone).toBeNull();
    expect(parsed.cgpa).toBeNull();
    expect(parsed.githubUrl).toBeNull();
    expect(parsed.targetRoleProfileId).toBeNull();
  });

  it("accepts a complete profile", () => {
    const parsed = profileUpdateSchema.parse({
      ...baseProfile,
      phone: "9876543210",
      cgpa: "8.75",
      githubUrl: "https://github.com/asha",
      linkedinUrl: "https://linkedin.com/in/asha",
    });
    expect(parsed.cgpa).toBe(8.75);
    expect(parsed.phone).toBe("9876543210");
  });

  it("rejects an out-of-range CGPA", () => {
    expect(() => profileUpdateSchema.parse({ ...baseProfile, cgpa: "11" })).toThrow();
  });

  it("rejects invalid branch and graduation year", () => {
    expect(() => profileUpdateSchema.parse({ ...baseProfile, branch: "BIO" })).toThrow();
    expect(() => profileUpdateSchema.parse({ ...baseProfile, graduationYear: "1999" })).toThrow();
  });

  it("rejects a non-http profile link", () => {
    expect(() =>
      profileUpdateSchema.parse({ ...baseProfile, githubUrl: "javascript:alert(1)" }),
    ).toThrow();
  });

  it("coerces skill proficiency and normalises empty evidence", () => {
    const parsed = skillInputSchema.parse({ skillId: "skill_1", proficiency: "4", evidence: "" });
    expect(parsed.proficiency).toBe(4);
    expect(parsed.evidence).toBeNull();
  });

  it("rejects proficiency outside 1-5", () => {
    expect(() => skillInputSchema.parse({ skillId: "skill_1", proficiency: 6 })).toThrow();
    expect(() => skillInputSchema.parse({ skillId: "skill_1", proficiency: 0 })).toThrow();
  });

  it("requires a drive id for applications and caps the cover note", () => {
    expect(() => applyToDriveSchema.parse({ driveId: "" })).toThrow();
    const parsed = applyToDriveSchema.parse({ driveId: "drive_1", coverNote: "" });
    expect(parsed.coverNote).toBeNull();
    expect(() =>
      applyToDriveSchema.parse({ driveId: "drive_1", coverNote: "x".repeat(1501) }),
    ).toThrow();
  });

  it("requires an application id to withdraw", () => {
    expect(() => withdrawApplicationSchema.parse({ applicationId: "" })).toThrow();
  });
});
