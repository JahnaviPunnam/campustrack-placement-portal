import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { AppError } from "@/server/errors";
import { audit } from "@/server/audit";
import { computeProfileCompleteness } from "@/lib/profile-completeness";
import { getStudentDriveEligibility } from "@/server/services/eligibility";
import type { ProfileUpdateInput, SkillInput, SkillUpdateInput } from "@/lib/validation/student";

export const studentProfileInclude = {
  targetRoleProfile: true,
  user: { select: { name: true, email: true } },
  skills: { include: { skill: true }, orderBy: { updatedAt: "desc" } },
} satisfies Prisma.StudentProfileInclude;

export type StudentProfileBundle = Prisma.StudentProfileGetPayload<{ include: typeof studentProfileInclude }>;

export async function getStudentProfile(profileId: string): Promise<StudentProfileBundle> {
  const profile = await prisma.studentProfile.findUnique({
    where: { id: profileId },
    include: studentProfileInclude,
  });
  if (!profile) throw new AppError("PROFILE_NOT_FOUND", "Student profile not found.", 404);
  return profile;
}

export async function updateStudentProfile(
  profileId: string,
  userId: string,
  actorId: string,
  input: ProfileUpdateInput,
) {
  const before = await getStudentProfile(profileId);
  if (input.targetRoleProfileId) {
    const role = await prisma.roleProfile.findFirst({
      where: { id: input.targetRoleProfileId, isActive: true },
      select: { id: true },
    });
    if (!role) throw new AppError("ROLE_NOT_FOUND", "Choose an active target role.", 400);
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { name: input.name } });
    return tx.studentProfile.update({
      where: { id: profileId },
      data: {
        phone: input.phone,
        branch: input.branch,
        graduationYear: input.graduationYear,
        cgpa: input.cgpa,
        backlogs: input.backlogs,
        headline: input.headline,
        location: input.location,
        githubUrl: input.githubUrl,
        linkedinUrl: input.linkedinUrl,
        targetRoleProfileId: input.targetRoleProfileId,
      },
      include: studentProfileInclude,
    });
  });

  await audit({
    actorId,
    action: "STUDENT_PROFILE_UPDATED",
    entityType: "StudentProfile",
    entityId: profileId,
    before: {
      name: before.user.name,
      phone: before.phone,
      branch: before.branch,
      graduationYear: before.graduationYear,
      cgpa: before.cgpa,
      backlogs: before.backlogs,
      headline: before.headline,
      location: before.location,
      targetRoleProfileId: before.targetRoleProfileId,
    },
    after: {
      name: input.name,
      phone: input.phone,
      branch: input.branch,
      graduationYear: input.graduationYear,
      cgpa: input.cgpa,
      backlogs: input.backlogs,
      headline: input.headline,
      location: input.location,
      targetRoleProfileId: input.targetRoleProfileId,
    },
  });
  return updated;
}

export async function updateResumePath(
  profileId: string,
  actorId: string,
  data: {
    resumePath: string;
    resumeOriginalName: string;
    resumeMimeType: string;
    resumeSizeBytes: number;
  },
) {
  const before = await prisma.studentProfile.findUnique({
    where: { id: profileId },
    select: { resumePath: true, resumeOriginalName: true },
  });
  const updated = await prisma.studentProfile.update({
    where: { id: profileId },
    data: { ...data, resumeUpdatedAt: new Date() },
    select: { id: true, resumePath: true, resumeOriginalName: true, resumeUpdatedAt: true },
  });
  await audit({
    actorId,
    action: "RESUME_UPLOADED",
    entityType: "StudentProfile",
    entityId: profileId,
    before,
    after: { resumePath: updated.resumePath, resumeOriginalName: updated.resumeOriginalName },
  });
  return updated;
}

export async function getSkillsPageData(profileId: string) {
  const [profile, catalog, roleProfiles] = await Promise.all([
    getStudentProfile(profileId),
    prisma.skill.findMany({
      where: { isActive: true },
      orderBy: [{ category: "asc" }, { name: "asc" }],
      select: { id: true, name: true, category: true, slug: true },
    }),
    prisma.roleProfile.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  return { profile, catalog, roleProfiles };
}

export async function addStudentSkill(
  profileId: string,
  actorId: string,
  input: SkillInput,
) {
  const skill = await prisma.skill.findFirst({
    where: { id: input.skillId, isActive: true },
    select: { id: true, name: true },
  });
  if (!skill) throw new AppError("SKILL_NOT_FOUND", "That skill is not available.", 400);
  const existing = await prisma.studentSkill.findUnique({
    where: { studentProfileId_skillId: { studentProfileId: profileId, skillId: input.skillId } },
  });
  if (existing) throw new AppError("SKILL_EXISTS", "That skill is already on your profile.", 409);

  const created = await prisma.$transaction(async (tx) => {
    const studentSkill = await tx.studentSkill.create({
      data: {
        studentProfileId: profileId,
        skillId: input.skillId,
        proficiency: input.proficiency,
        evidence: input.evidence,
      },
      include: { skill: true },
    });
    await tx.skillHistory.create({
      data: {
        studentProfileId: profileId,
        skillId: input.skillId,
        proficiency: input.proficiency,
        note: "Skill added",
        source: "MANUAL",
      },
    });
    return studentSkill;
  });
  await audit({
    actorId,
    action: "STUDENT_SKILL_ADDED",
    entityType: "StudentSkill",
    entityId: created.id,
    after: { skill: skill.name, proficiency: input.proficiency, hasEvidence: Boolean(input.evidence) },
  });
  return created;
}

export async function updateStudentSkill(
  profileId: string,
  actorId: string,
  input: SkillUpdateInput,
) {
  const existing = await prisma.studentSkill.findFirst({
    where: { id: input.studentSkillId, studentProfileId: profileId },
    include: { skill: true },
  });
  if (!existing) throw new AppError("SKILL_NOT_FOUND", "Skill not found on your profile.", 404);
  if (existing.skillId !== input.skillId) {
    throw new AppError("INVALID_SKILL", "The selected skill does not match this entry.", 400);
  }
  const changed = existing.proficiency !== input.proficiency || existing.evidence !== input.evidence;
  const shouldResetVerification = changed && existing.isVerified;

  const updated = await prisma.$transaction(async (tx) => {
    const studentSkill = await tx.studentSkill.update({
      where: { id: existing.id },
      data: {
        proficiency: input.proficiency,
        evidence: input.evidence,
        ...(shouldResetVerification
          ? { isVerified: false, verifiedAt: null, verifiedById: null }
          : {}),
      },
      include: { skill: true },
    });
    if (existing.proficiency !== input.proficiency) {
      await tx.skillHistory.create({
        data: {
          studentProfileId: profileId,
          skillId: input.skillId,
          proficiency: input.proficiency,
          note: "Proficiency updated",
          source: "MANUAL",
        },
      });
    }
    return studentSkill;
  });
  await audit({
    actorId,
    action: "STUDENT_SKILL_UPDATED",
    entityType: "StudentSkill",
    entityId: existing.id,
    before: {
      proficiency: existing.proficiency,
      evidence: existing.evidence,
      isVerified: existing.isVerified,
    },
    after: {
      proficiency: input.proficiency,
      evidence: input.evidence,
      isVerified: updated.isVerified,
    },
  });
  return updated;
}

export async function removeStudentSkill(
  profileId: string,
  actorId: string,
  studentSkillId: string,
) {
  const existing = await prisma.studentSkill.findFirst({
    where: { id: studentSkillId, studentProfileId: profileId },
    include: { skill: true },
  });
  if (!existing) throw new AppError("SKILL_NOT_FOUND", "Skill not found on your profile.", 404);
  await prisma.studentSkill.delete({ where: { id: existing.id } });
  await audit({
    actorId,
    action: "STUDENT_SKILL_REMOVED",
    entityType: "StudentSkill",
    entityId: existing.id,
    before: {
      skillId: existing.skillId,
      skill: existing.skill.name,
      proficiency: existing.proficiency,
    },
  });
}

export async function setTargetRole(
  profileId: string,
  actorId: string,
  roleProfileId: string | null,
) {
  if (roleProfileId) {
    const role = await prisma.roleProfile.findFirst({
      where: { id: roleProfileId, isActive: true },
      select: { id: true, name: true },
    });
    if (!role) throw new AppError("ROLE_NOT_FOUND", "Choose an active target role.", 400);
  }
  const before = await prisma.studentProfile.findUnique({
    where: { id: profileId },
    select: { targetRoleProfileId: true },
  });
  const updated = await prisma.studentProfile.update({
    where: { id: profileId },
    data: { targetRoleProfileId: roleProfileId },
    select: { targetRoleProfileId: true },
  });
  await audit({
    actorId,
    action: "TARGET_ROLE_UPDATED",
    entityType: "StudentProfile",
    entityId: profileId,
    before,
    after: updated,
  });
  return updated;
}

export async function getStudentDashboard(profileId: string, userId: string) {
  const now = new Date();
  const [profile, applicationCount, activeApplicationCount, offerCount, unread, upcomingRounds, driveEligibility, recentApplications] =
    await Promise.all([
      getStudentProfile(profileId),
      prisma.application.count({ where: { studentProfileId: profileId } }),
      prisma.application.count({
        where: { studentProfileId: profileId, status: { in: ["APPLIED", "SHORTLISTED", "IN_PROCESS", "OFFERED"] } },
      }),
      prisma.offer.count({ where: { studentProfileId: profileId, status: "ACCEPTED" } }),
      prisma.notification.count({ where: { userId, isRead: false } }),
      prisma.applicationRoundResult.findMany({
        where: {
          application: { studentProfileId: profileId, status: { notIn: ["WITHDRAWN", "REJECTED"] } },
          round: { scheduledAt: { gte: now }, status: { in: ["PLANNED", "SCHEDULED"] } },
        },
        include: {
          round: true,
          application: { include: { drive: { include: { company: true } } } },
        },
        orderBy: { round: { scheduledAt: "asc" } },
        take: 5,
      }),
      getStudentDriveEligibility(profileId),
      prisma.application.findMany({
        where: { studentProfileId: profileId },
        include: { drive: { include: { company: true } }, currentRound: true, offer: true },
        orderBy: { appliedAt: "desc" },
        take: 4,
      }),
    ]);

  const completeness = computeProfileCompleteness({
    phone: profile.phone,
    location: profile.location,
    branch: profile.branch,
    graduationYear: profile.graduationYear,
    cgpa: profile.cgpa,
    backlogs: profile.backlogs,
    resumePath: profile.resumePath,
    githubUrl: profile.githubUrl,
    linkedinUrl: profile.linkedinUrl,
    skillCount: profile.skills.length,
    evidenceSkillCount: profile.skills.filter((skill) => skill.evidence).length,
    targetRoleProfileId: profile.targetRoleProfileId,
  });

  return {
    profile,
    applicationCount,
    activeApplicationCount,
    offerCount,
    unread,
    upcomingRounds,
    completeness,
    eligibleDrives: driveEligibility.filter((entry) => entry.result.eligible || entry.override),
    openDrives: driveEligibility,
    recentApplications,
  };
}
