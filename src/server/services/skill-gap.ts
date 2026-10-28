import { computeSkillGap, type SkillGapResult, type GapTargetSkill } from "@/lib/eligibility";
import { prisma } from "@/server/db";
import { AppError } from "@/server/errors";

export async function getRoleOptions() {
  return prisma.roleProfile.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, description: true },
  });
}

export async function getSkillGapForRole(studentProfileId: string, roleProfileId: string): Promise<{
  targetName: string;
  targetDescription: string | null;
  gap: SkillGapResult;
}> {
  const [studentSkills, role] = await Promise.all([
    prisma.studentSkill.findMany({
      where: { studentProfileId },
      include: { skill: true },
    }),
    prisma.roleProfile.findUnique({
      where: { id: roleProfileId },
      include: {
        skills: {
          include: {
            skill: { include: { learningResources: { where: { isActive: true } } } },
          },
        },
      },
    }),
  ]);
  if (!role) throw new AppError("ROLE_NOT_FOUND", "Target role not found.", 404);

  const targets: GapTargetSkill[] = role.skills.map((entry) => ({
    skillId: entry.skillId,
    name: entry.skill.name,
    requiredProficiency: entry.requiredProficiency,
    weight: entry.weight,
    isMandatory: entry.isMandatory,
    resources: entry.skill.learningResources.map((resource) => ({
      title: resource.title,
      url: resource.url,
      provider: resource.provider,
      type: resource.type,
    })),
  }));

  return {
    targetName: role.name,
    targetDescription: role.description,
    gap: computeSkillGap(
      studentSkills.map((skill) => ({
        skillId: skill.skillId,
        name: skill.skill.name,
        proficiency: skill.proficiency,
      })),
      targets,
    ),
  };
}

export async function getSkillGapForDrive(studentProfileId: string, driveId: string): Promise<{
  targetName: string;
  targetDescription: string | null;
  driveId: string;
  gap: SkillGapResult;
}> {
  const [studentSkills, drive] = await Promise.all([
    prisma.studentSkill.findMany({
      where: { studentProfileId },
      include: { skill: true },
    }),
    prisma.drive.findUnique({
      where: { id: driveId },
      include: {
        requiredSkills: {
          include: {
            skill: { include: { learningResources: { where: { isActive: true } } } },
          },
        },
      },
    }),
  ]);
  if (!drive) throw new AppError("DRIVE_NOT_FOUND", "Drive not found.", 404);

  const targets: GapTargetSkill[] = drive.requiredSkills.map((entry) => ({
    skillId: entry.skillId,
    name: entry.skill.name,
    requiredProficiency: entry.minProficiency,
    weight: entry.weight,
    isMandatory: entry.isMandatory,
    resources: entry.skill.learningResources.map((resource) => ({
      title: resource.title,
      url: resource.url,
      provider: resource.provider,
      type: resource.type,
    })),
  }));

  return {
    targetName: drive.title,
    targetDescription: drive.description,
    driveId: drive.id,
    gap: computeSkillGap(
      studentSkills.map((skill) => ({
        skillId: skill.skillId,
        name: skill.skill.name,
        proficiency: skill.proficiency,
      })),
      targets,
    ),
  };
}
