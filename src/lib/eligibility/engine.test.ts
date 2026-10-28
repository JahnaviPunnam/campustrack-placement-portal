import { describe, expect, it } from "vitest";
import { computeSkillMatch, evaluateEligibility } from "./engine";
import type { EligibilityDrive, EligibilityStudent, RequiredSkill } from "./types";

const NOW = "2026-01-01T00:00:00.000Z";

function makeStudent(overrides: Partial<EligibilityStudent> = {}): EligibilityStudent {
  return {
    studentProfileId: "student-1",
    cgpa: 8,
    backlogs: 1,
    branch: "CSE",
    graduationYear: 2026,
    isVerified: true,
    hasResume: true,
    skills: [
      { skillId: "react", name: "React", proficiency: 3 },
      { skillId: "node", name: "Node.js", proficiency: 4 },
      { skillId: "docker", name: "Docker", proficiency: 2 },
    ],
    acceptedOffers: [],
    ...overrides,
  };
}

function makeDrive(overrides: Partial<EligibilityDrive> = {}): EligibilityDrive {
  return {
    driveId: "drive-1",
    title: "Software Engineer",
    status: "ACTIVE",
    deadline: "2026-06-01T00:00:00.000Z",
    package: 12,
    tier: 2,
    rules: {
      minCgpa: 7.5,
      maxBacklogs: 1,
      allowedBranches: ["CSE", "IT"],
      allowedGraduationYears: [2026, 2027],
      requireVerifiedProfile: true,
      requireResume: true,
    },
    requiredSkills: [
      { skillId: "react", name: "React", minProficiency: 3, weight: 2, isMandatory: true },
      { skillId: "node", name: "Node.js", minProficiency: 3, weight: 1, isMandatory: true },
      { skillId: "docker", name: "Docker", minProficiency: 2, weight: 1, isMandatory: false },
    ],
    policy: {
      maxOffersPerStudent: 1,
      blockedPlacedTiers: [1, 2],
      dreamOfferEnabled: true,
      minimumDreamOfferIncrease: 0,
    },
    existingApplication: null,
    ...overrides,
  };
}

function evaluate(student: EligibilityStudent, drive: EligibilityDrive, now = NOW) {
  return evaluateEligibility({ student, drive, now });
}

describe("eligibility engine", () => {
  it("1. returns eligible for a student meeting every rule", () => {
    const result = evaluate(makeStudent(), makeDrive());
    expect(result.eligible).toBe(true);
    expect(result.reasons).toHaveLength(0);
    expect(result.matchScore).toBe(100);
  });

  it("2. passes when CGPA exactly equals the cutoff", () => {
    const result = evaluate(makeStudent({ cgpa: 7.5 }), makeDrive());
    expect(result.eligible).toBe(true);
  });

  it("3. rejects CGPA below the cutoff with an exact reason", () => {
    const result = evaluate(makeStudent({ cgpa: 7.4 }), makeDrive());
    expect(result.eligible).toBe(false);
    expect(result.reasons).toContainEqual(
      expect.objectContaining({ code: "CGPA_BELOW", actual: 7.4, required: 7.5 }),
    );
  });

  it("4. rejects a missing CGPA as an incomplete profile", () => {
    const result = evaluate(makeStudent({ cgpa: null }), makeDrive());
    expect(result.reasons.some((reason) => reason.code === "PROFILE_INCOMPLETE")).toBe(true);
    expect(result.reasons.some((reason) => reason.code === "CGPA_BELOW")).toBe(false);
  });

  it("5. passes when backlogs equal the maximum", () => {
    const result = evaluate(makeStudent({ backlogs: 1 }), makeDrive());
    expect(result.eligible).toBe(true);
  });

  it("6. rejects too many backlogs", () => {
    const result = evaluate(makeStudent({ backlogs: 2 }), makeDrive());
    expect(result.reasons).toContainEqual(
      expect.objectContaining({ code: "BACKLOGS_EXCEEDED", actual: 2, required: 1 }),
    );
  });

  it("7. allows a listed branch", () => {
    const result = evaluate(makeStudent({ branch: "IT" }), makeDrive());
    expect(result.eligible).toBe(true);
  });

  it("8. rejects a branch outside the list", () => {
    const result = evaluate(makeStudent({ branch: "ECE" }), makeDrive());
    expect(result.reasons.some((reason) => reason.code === "BRANCH_NOT_ALLOWED")).toBe(true);
  });

  it("9. treats an empty branch list as all branches", () => {
    const drive = makeDrive({
      rules: { ...makeDrive().rules, allowedBranches: [] },
    });
    const result = evaluate(makeStudent({ branch: "MECH" }), drive);
    expect(result.eligible).toBe(true);
  });

  it("10. allows a listed graduation year", () => {
    const result = evaluate(makeStudent({ graduationYear: 2027 }), makeDrive());
    expect(result.eligible).toBe(true);
  });

  it("11. rejects an unlisted graduation year", () => {
    const result = evaluate(makeStudent({ graduationYear: 2025 }), makeDrive());
    expect(result.reasons.some((reason) => reason.code === "GRADUATION_YEAR_NOT_ALLOWED")).toBe(true);
  });

  it("12. treats an empty graduation-year list as all years", () => {
    const drive = makeDrive({
      rules: { ...makeDrive().rules, allowedGraduationYears: [] },
    });
    const result = evaluate(makeStudent({ graduationYear: 2030 }), drive);
    expect(result.eligible).toBe(true);
  });

  it("13. passes a mandatory skill exactly at the required proficiency", () => {
    const result = evaluate(
      makeStudent({ skills: [{ skillId: "react", name: "React", proficiency: 3 }, { skillId: "node", name: "Node.js", proficiency: 3 }, { skillId: "docker", name: "Docker", proficiency: 2 }] }),
      makeDrive(),
    );
    expect(result.eligible).toBe(true);
  });

  it("14. passes a mandatory skill above the requirement", () => {
    const result = evaluate(
      makeStudent({ skills: [{ skillId: "react", name: "React", proficiency: 5 }, { skillId: "node", name: "Node.js", proficiency: 4 }, { skillId: "docker", name: "Docker", proficiency: 3 }] }),
      makeDrive(),
    );
    expect(result.eligible).toBe(true);
    expect(result.matchScore).toBe(100);
  });

  it("15. rejects a mandatory skill below the requirement", () => {
    const result = evaluate(
      makeStudent({ skills: [{ skillId: "react", name: "React", proficiency: 2 }, { skillId: "node", name: "Node.js", proficiency: 4 }, { skillId: "docker", name: "Docker", proficiency: 2 }] }),
      makeDrive(),
    );
    expect(result.eligible).toBe(false);
    expect(result.reasons).toContainEqual(
      expect.objectContaining({ code: "SKILL_PROFICIENCY_BELOW", skillId: "react", actual: 2, required: 3 }),
    );
  });

  it("16. returns one reason for each missing mandatory skill", () => {
    const result = evaluate(
      makeStudent({ skills: [{ skillId: "docker", name: "Docker", proficiency: 2 }] }),
      makeDrive(),
    );
    expect(result.reasons.filter((reason) => reason.code === "SKILL_PROFICIENCY_BELOW")).toHaveLength(2);
  });

  it("17. lets an optional skill shortfall pass with a warning and lower score", () => {
    const result = evaluate(
      makeStudent({ skills: [{ skillId: "react", name: "React", proficiency: 3 }, { skillId: "node", name: "Node.js", proficiency: 3 }, { skillId: "docker", name: "Docker", proficiency: 0 }] }),
      makeDrive(),
    );
    expect(result.eligible).toBe(true);
    expect(result.matchScore).toBeLessThan(100);
    expect(result.warnings.some((warning) => warning.code === "OPTIONAL_SKILL_GAP")).toBe(true);
  });

  it("18. returns a 100 match score when no skills are required", () => {
    const drive = makeDrive({ requiredSkills: [] });
    const result = evaluate(makeStudent(), drive);
    expect(result.eligible).toBe(true);
    expect(result.matchScore).toBe(100);
  });

  it("19. computes the weighted match score", () => {
    const required: RequiredSkill[] = [
      { skillId: "a", name: "A", minProficiency: 2, weight: 1, isMandatory: true },
      { skillId: "b", name: "B", minProficiency: 4, weight: 3, isMandatory: true },
    ];
    const result = computeSkillMatch(required, [
      { skillId: "a", name: "A", proficiency: 1 },
      { skillId: "b", name: "B", proficiency: 4 },
    ]);
    expect(result.score).toBe(88);
  });

  it("20. deduplicates student skills using the highest proficiency", () => {
    const result = evaluate(
      makeStudent({
        skills: [
          { skillId: "react", name: "React", proficiency: 1 },
          { skillId: "react", name: "React", proficiency: 5 },
          { skillId: "node", name: "Node.js", proficiency: 4 },
          { skillId: "docker", name: "Docker", proficiency: 2 },
        ],
      }),
      makeDrive(),
    );
    expect(result.eligible).toBe(true);
  });

  it("21. treats an unknown required skill as zero proficiency", () => {
    const drive = makeDrive({
      requiredSkills: [
        { skillId: "quantum", name: "Quantum", minProficiency: 3, weight: 1, isMandatory: true },
      ],
    });
    const result = evaluate(makeStudent(), drive);
    expect(result.eligible).toBe(false);
    expect(result.missingSkills[0]?.actual).toBe(0);
  });

  it("22. rejects a drive that is not active", () => {
    const result = evaluate(makeStudent(), makeDrive({ status: "DRAFT" }));
    expect(result.reasons.some((reason) => reason.code === "DRIVE_NOT_ACTIVE")).toBe(true);
  });

  it("23. rejects a passed deadline", () => {
    const result = evaluate(makeStudent(), makeDrive(), "2026-06-02T00:00:00.000Z");
    expect(result.reasons.some((reason) => reason.code === "DEADLINE_PASSED")).toBe(true);
  });

  it("24. allows an application exactly at the deadline instant", () => {
    const result = evaluate(makeStudent(), makeDrive(), "2026-06-01T00:00:00.000Z");
    expect(result.eligible).toBe(true);
  });

  it("25. rejects an existing active application", () => {
    const result = evaluate(makeStudent(), makeDrive({ existingApplication: { status: "APPLIED" } }));
    expect(result.reasons.some((reason) => reason.code === "ALREADY_APPLIED")).toBe(true);
  });

  it("26. allows reapplication after withdrawal", () => {
    const result = evaluate(makeStudent(), makeDrive({ existingApplication: { status: "WITHDRAWN" } }));
    expect(result.eligible).toBe(true);
  });

  it("27. treats a rejected application as terminal", () => {
    const result = evaluate(makeStudent(), makeDrive({ existingApplication: { status: "REJECTED" } }));
    expect(result.reasons.some((reason) => reason.code === "ALREADY_APPLIED")).toBe(true);
  });

  it("28. rejects an unverified profile when verification is required", () => {
    const result = evaluate(makeStudent({ isVerified: false }), makeDrive());
    expect(result.reasons.some((reason) => reason.code === "PROFILE_NOT_VERIFIED")).toBe(true);
  });

  it("29. only warns for an unverified profile when verification is optional", () => {
    const drive = makeDrive({
      rules: { ...makeDrive().rules, requireVerifiedProfile: false },
    });
    const result = evaluate(makeStudent({ isVerified: false }), drive);
    expect(result.eligible).toBe(true);
    expect(result.warnings.some((warning) => warning.code === "PROFILE_NOT_VERIFIED_OPTIONAL")).toBe(true);
  });

  it("30. rejects a missing resume when required", () => {
    const result = evaluate(makeStudent({ hasResume: false }), makeDrive());
    expect(result.reasons.some((reason) => reason.code === "RESUME_MISSING")).toBe(true);
  });

  it("31. blocks a placed student from a blocked tier", () => {
    const result = evaluate(
      makeStudent({ acceptedOffers: [{ package: 8, tier: 1 }] }),
      makeDrive({ package: 8, tier: 2 }),
    );
    expect(result.reasons.some((reason) => reason.code === "PLACED_TIER_BLOCKED")).toBe(true);
    expect(result.isDreamOffer).toBe(false);
  });

  it("32. allows a placed student through the dream-offer exception", () => {
    const result = evaluate(
      makeStudent({ acceptedOffers: [{ package: 8, tier: 1 }] }),
      makeDrive({ package: 18, tier: 3 }),
    );
    expect(result.eligible).toBe(true);
    expect(result.isDreamOffer).toBe(true);
    expect(result.warnings.some((warning) => warning.code === "DREAM_OFFER_UPGRADE")).toBe(true);
  });

  it("33. blocks when maximum accepted offers is reached", () => {
    const drive = makeDrive({
      package: 8,
      tier: 3,
      policy: { ...makeDrive().policy, blockedPlacedTiers: [], maxOffersPerStudent: 1 },
    });
    const result = evaluate(makeStudent({ acceptedOffers: [{ package: 8, tier: 2 }] }), drive);
    expect(result.reasons.some((reason) => reason.code === "MAX_OFFERS_REACHED")).toBe(true);
  });

  it("34. returns reasons in a deterministic order and does not mutate inputs", () => {
    const student = makeStudent({ cgpa: 6, backlogs: 3, branch: "ECE", isVerified: false, hasResume: false });
    const drive = makeDrive({ existingApplication: { status: "APPLIED" } });
    const before = JSON.stringify({ student, drive });
    const first = evaluate(student, drive);
    const second = evaluate(student, drive);
    expect(first).toEqual(second);
    expect(JSON.stringify({ student, drive })).toBe(before);
    const codes = first.reasons.map((reason) => reason.code);
    expect(codes.indexOf("ALREADY_APPLIED")).toBeLessThan(codes.indexOf("CGPA_BELOW"));
    expect(codes.indexOf("CGPA_BELOW")).toBeLessThan(codes.indexOf("BRANCH_NOT_ALLOWED"));
  });

  it("35. reports multiple deterministic failure reasons together", () => {
    const result = evaluate(
      makeStudent({ cgpa: 6, backlogs: 3, branch: "ECE", isVerified: false, hasResume: false }),
      makeDrive(),
    );
    expect(result.eligible).toBe(false);
    const codes = result.reasons.map((reason) => reason.code);
    expect(codes).toEqual(
      expect.arrayContaining([
        "PROFILE_NOT_VERIFIED",
        "RESUME_MISSING",
        "CGPA_BELOW",
        "BACKLOGS_EXCEEDED",
        "BRANCH_NOT_ALLOWED",
      ]),
    );
  });

  it("36. handles a malformed deadline as passed rather than throwing", () => {
    const result = evaluate(makeStudent(), makeDrive({ deadline: "not-a-date" }));
    expect(result.reasons.some((reason) => reason.code === "DEADLINE_PASSED")).toBe(true);
  });
});
