import { computeSkillMatch } from "./engine";
import type {
  EligibilitySkill,
  GapTargetSkill,
  SkillGapResult,
} from "./types";

export function computeSkillGap(
  studentSkills: readonly EligibilitySkill[],
  targetSkills: readonly GapTargetSkill[],
): SkillGapResult {
  const required = targetSkills.map((skill) => ({
    skillId: skill.skillId,
    name: skill.name,
    minProficiency: skill.requiredProficiency,
    weight: skill.weight ?? 1,
    isMandatory: skill.isMandatory ?? true,
  }));
  const match = computeSkillMatch(required, studentSkills);
  const studentMap = new Map(studentSkills.map((skill) => [skill.skillId, skill]));
  const targetMap = new Map(targetSkills.map((skill) => [skill.skillId, skill]));

  const missing = targetSkills
    .map((skill) => {
      const current = studentMap.get(skill.skillId)?.proficiency ?? 0;
      const requiredProficiency = Math.max(1, skill.requiredProficiency);
      if (current >= requiredProficiency) return null;
      return {
        skillId: skill.skillId,
        name: skill.name,
        current,
        required: requiredProficiency,
        gap: requiredProficiency - current,
        isMandatory: skill.isMandatory ?? true,
        resources: skill.resources ?? [],
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a, b) => {
      if (a.isMandatory !== b.isMandatory) return a.isMandatory ? -1 : 1;
      if (b.gap !== a.gap) return b.gap - a.gap;
      return a.name.localeCompare(b.name);
    });

  const strengths = match.matchedSkillIds
    .map((skillId) => {
      const target = targetMap.get(skillId);
      if (!target) return null;
      return {
        skillId,
        name: target.name,
        current: studentMap.get(skillId)?.proficiency ?? 0,
        required: Math.max(1, target.requiredProficiency),
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  return {
    matchScore: match.score,
    missing,
    strengths,
    totalTargetSkills: new Set(targetSkills.map((skill) => skill.skillId)).size,
  };
}
