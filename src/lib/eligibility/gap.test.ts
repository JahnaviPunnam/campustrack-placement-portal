import { describe, expect, it } from "vitest";
import { computeSkillGap } from "./gap";

const studentSkills = [
  { skillId: "react", name: "React", proficiency: 4 },
  { skillId: "git", name: "Git", proficiency: 5 },
  { skillId: "node", name: "Node.js", proficiency: 2 },
];

const targetSkills = [
  {
    skillId: "react",
    name: "React",
    requiredProficiency: 4,
    weight: 2,
    resources: [{ title: "React docs", url: "https://react.dev", type: "DOCS" }],
  },
  {
    skillId: "node",
    name: "Node.js",
    requiredProficiency: 4,
    weight: 1,
    resources: [{ title: "Node docs", url: "https://nodejs.org", type: "DOCS" }],
  },
  {
    skillId: "sql",
    name: "SQL",
    requiredProficiency: 3,
    weight: 1,
    resources: [{ title: "SQL practice", url: "https://example.com/sql", type: "PRACTICE" }],
  },
];

describe("skill gap", () => {
  it("computes match, missing skills, gap sizes, and resources", () => {
    const result = computeSkillGap(studentSkills, targetSkills);
    expect(result.totalTargetSkills).toBe(3);
    expect(result.matchScore).toBeGreaterThan(0);
    expect(result.missing.map((skill) => skill.skillId)).toEqual(["sql", "node"]);
    expect(result.missing[0]?.resources).toHaveLength(1);
    expect(result.missing.find((skill) => skill.skillId === "node")?.gap).toBe(2);
    expect(result.strengths.map((skill) => skill.skillId)).toEqual(["react"]);
  });

  it("returns 100 and no gaps when all targets are met", () => {
    const result = computeSkillGap(
      [
        { skillId: "react", name: "React", proficiency: 5 },
        { skillId: "node", name: "Node.js", proficiency: 5 },
        { skillId: "sql", name: "SQL", proficiency: 4 },
      ],
      targetSkills,
    );
    expect(result.matchScore).toBe(100);
    expect(result.missing).toHaveLength(0);
  });

  it("handles no target skills", () => {
    const result = computeSkillGap(studentSkills, []);
    expect(result.matchScore).toBe(100);
    expect(result.missing).toHaveLength(0);
  });

  it("prioritises mandatory gaps before optional gaps", () => {
    const result = computeSkillGap(
      [],
      [
        { skillId: "optional", name: "A Optional", requiredProficiency: 4, isMandatory: false },
        { skillId: "mandatory", name: "B Mandatory", requiredProficiency: 3, isMandatory: true },
      ],
    );
    expect(result.missing[0]?.skillId).toBe("mandatory");
  });
});
