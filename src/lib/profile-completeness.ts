type CompletenessInput = {
  phone: string | null;
  location: string | null;
  branch: string;
  graduationYear: number;
  cgpa: number | null;
  backlogs: number;
  resumePath: string | null;
  githubUrl: string | null;
  linkedinUrl: string | null;
  skillCount: number;
  evidenceSkillCount: number;
  targetRoleProfileId: string | null;
};

export type CompletenessResult = {
  percentage: number;
  missing: string[];
  sections: { label: string; points: number; earned: number }[];
};

export function computeProfileCompleteness(input: CompletenessInput): CompletenessResult {
  const identity = (input.phone ? 5 : 0) + (input.location ? 5 : 0);
  const academics =
    (input.branch ? 5 : 0) +
    (input.graduationYear ? 5 : 0) +
    (input.cgpa !== null ? 5 : 0) +
    (input.backlogs >= 0 ? 5 : 0);
  const resume = input.resumePath ? 20 : 0;
  const links = (input.githubUrl ? 5 : 0) + (input.linkedinUrl ? 5 : 0);
  const skills = Math.round(Math.min(input.skillCount / 5, 1) * 25);
  const evidence = Math.round(Math.min(input.evidenceSkillCount / 2, 1) * 10);
  const target = input.targetRoleProfileId ? 5 : 0;

  const sections = [
    { label: "Identity", points: 10, earned: identity },
    { label: "Academics", points: 20, earned: academics },
    { label: "Resume", points: 20, earned: resume },
    { label: "Links", points: 10, earned: links },
    { label: "Skills", points: 25, earned: skills },
    { label: "Evidence", points: 10, earned: evidence },
    { label: "Target role", points: 5, earned: target },
  ];

  const missing: string[] = [];
  if (!input.phone) missing.push("Add a phone number");
  if (!input.location) missing.push("Add your location");
  if (input.cgpa === null) missing.push("Add your CGPA");
  if (!input.resumePath) missing.push("Upload your resume");
  if (!input.githubUrl) missing.push("Add a GitHub link");
  if (!input.linkedinUrl) missing.push("Add a LinkedIn link");
  if (input.skillCount < 5) missing.push(`Add ${5 - input.skillCount} more skill(s)`);
  if (input.evidenceSkillCount < 2) missing.push("Add evidence to at least 2 skills");
  if (!input.targetRoleProfileId) missing.push("Choose a target role");

  return {
    percentage: Math.min(100, sections.reduce((sum, section) => sum + section.earned, 0)),
    missing,
    sections,
  };
}
