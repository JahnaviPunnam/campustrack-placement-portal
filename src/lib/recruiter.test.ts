import { describe, expect, it } from "vitest";
import { skillCoverageScore } from "./recruiter";

const skills = [
  { skillId: "react", proficiency: 5 },
  { skillId: "sql", proficiency: 2 },
];

describe("recruiter candidate scoring", () => {
  it("returns null without selected skills", () => {
    expect(skillCoverageScore(skills, [])).toBeNull();
  });

  it("caps proficiency at the target level", () => {
    expect(skillCoverageScore(skills, ["react"])).toBe(100);
  });

  it("averages coverage and treats missing skills as zero", () => {
    expect(skillCoverageScore(skills, ["react", "sql", "python"])).toBe(56);
  });

  it("deduplicates selected skills and uses the highest level", () => {
    expect(
      skillCoverageScore(
        [
          { skillId: "react", proficiency: 1 },
          { skillId: "react", proficiency: 3 },
        ],
        ["react", "react"],
      ),
    ).toBe(100);
  });
});
