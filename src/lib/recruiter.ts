export type CandidateSkillLevel = {
  skillId: string;
  proficiency: number;
};

export function skillCoverageScore(
  skills: readonly CandidateSkillLevel[],
  selectedSkillIds: readonly string[],
): number | null {
  const unique = Array.from(new Set(selectedSkillIds));
  if (unique.length === 0) return null;
  const levels = new Map<string, number>();
  for (const skill of skills) {
    const current = levels.get(skill.skillId) ?? 0;
    if (skill.proficiency > current) levels.set(skill.skillId, skill.proficiency);
  }
  const total = unique.reduce((sum, skillId) => {
    const proficiency = Math.max(0, levels.get(skillId) ?? 0);
    return sum + Math.min(1, proficiency / 3);
  }, 0);
  return Math.round((total / unique.length) * 100);
}
