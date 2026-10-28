import type { Prisma } from "@prisma/client";
import { evaluateEligibility, type EligibilityDrive, type EligibilityResult, type EligibilityStudent, type PlacementPolicyInput } from "@/lib/eligibility";
import { parseCsvNumbers } from "@/lib/csv";
import { prisma } from "@/server/db";
import { AppError } from "@/server/errors";
import { audit } from "@/server/audit";
import { notifyUsers } from "@/server/services/notifications";
import { publishToRole } from "@/server/realtime/hub";

export const driveEligibilityInclude = {
  eligibilityRule: true,
  requiredSkills: { include: { skill: true } },
  company: true,
} satisfies Prisma.DriveInclude;

export const studentEligibilityInclude = {
  user: { select: { id: true, name: true, email: true } },
  skills: { include: { skill: true } },
  offers: { where: { status: "ACCEPTED" }, select: { package: true, tier: true } },
} satisfies Prisma.StudentProfileInclude;

export type DriveForEligibility = Prisma.DriveGetPayload<{ include: typeof driveEligibilityInclude }>;
export type StudentForEligibility = Prisma.StudentProfileGetPayload<{ include: typeof studentEligibilityInclude }>;

export const DEFAULT_POLICY: PlacementPolicyInput = {
  maxOffersPerStudent: 1,
  blockedPlacedTiers: [1, 2],
  dreamOfferEnabled: true,
  minimumDreamOfferIncrease: 0,
};

export async function getPlacementPolicy(): Promise<PlacementPolicyInput> {
  const policy = await prisma.placementPolicy.findUnique({ where: { id: "global" } });
  if (!policy) return DEFAULT_POLICY;
  return {
    maxOffersPerStudent: policy.maxOffersPerStudent,
    blockedPlacedTiers: parseCsvNumbers(policy.blockedPlacedTiers),
    dreamOfferEnabled: policy.dreamOfferEnabled,
    minimumDreamOfferIncrease: policy.minimumDreamOfferIncrease,
  };
}

export function mapStudent(student: StudentForEligibility): EligibilityStudent {
  return {
    studentProfileId: student.id,
    cgpa: student.cgpa,
    backlogs: student.backlogs,
    branch: student.branch,
    graduationYear: student.graduationYear,
    isVerified: student.isVerified,
    hasResume: Boolean(student.resumePath),
    skills: student.skills.map((skill) => ({
      skillId: skill.skillId,
      name: skill.skill.name,
      proficiency: skill.proficiency,
    })),
    acceptedOffers: student.offers.map((offer) => ({ package: offer.package, tier: offer.tier })),
  };
}

export function mapDrive(
  drive: DriveForEligibility,
  policy: PlacementPolicyInput,
  existingApplication: { status: string } | null,
): EligibilityDrive {
  const rules = drive.eligibilityRule;
  return {
    driveId: drive.id,
    title: drive.title,
    status: drive.status,
    deadline: drive.deadline.toISOString(),
    package: drive.package,
    tier: drive.tier,
    rules: {
      minCgpa: rules?.minCgpa ?? null,
      maxBacklogs: rules?.maxBacklogs ?? null,
      allowedBranches: rules ? rules.allowedBranches.split(",").map((value) => value.trim()).filter(Boolean) : [],
      allowedGraduationYears: rules ? parseCsvNumbers(rules.allowedGraduationYears) : [],
      requireVerifiedProfile: rules?.requireVerifiedProfile ?? true,
      requireResume: rules?.requireResume ?? true,
    },
    requiredSkills: drive.requiredSkills.map((required) => ({
      skillId: required.skillId,
      name: required.skill.name,
      minProficiency: required.minProficiency,
      weight: required.weight,
      isMandatory: required.isMandatory,
    })),
    policy,
    existingApplication,
  };
}

export function evaluateMapped(
  student: StudentForEligibility,
  drive: DriveForEligibility,
  policy: PlacementPolicyInput,
  existingApplication: { status: string } | null,
  now = new Date(),
): EligibilityResult {
  return evaluateEligibility({
    student: mapStudent(student),
    drive: mapDrive(drive, policy, existingApplication),
    now: now.toISOString(),
  });
}

export async function getDriveForEligibility(driveId: string): Promise<DriveForEligibility> {
  const drive = await prisma.drive.findUnique({
    where: { id: driveId },
    include: driveEligibilityInclude,
  });
  if (!drive) throw new AppError("DRIVE_NOT_FOUND", "Drive not found.", 404);
  return drive;
}

export async function getStudentForEligibility(studentProfileId: string): Promise<StudentForEligibility> {
  const student = await prisma.studentProfile.findUnique({
    where: { id: studentProfileId },
    include: studentEligibilityInclude,
  });
  if (!student) throw new AppError("STUDENT_NOT_FOUND", "Student profile not found.", 404);
  return student;
}

export async function evaluateStudentForDrive(
  studentProfileId: string,
  driveId: string,
): Promise<{ result: EligibilityResult; drive: DriveForEligibility; student: StudentForEligibility; override: { reason: string } | null }> {
  const [drive, student, policy, application, override] = await Promise.all([
    getDriveForEligibility(driveId),
    getStudentForEligibility(studentProfileId),
    getPlacementPolicy(),
    prisma.application.findUnique({
      where: { studentProfileId_driveId: { studentProfileId, driveId } },
      select: { status: true },
    }),
    getActiveOverride(studentProfileId, driveId),
  ]);
  const result = evaluateMapped(student, drive, policy, application);
  return { result, drive, student, override };
}

export async function evaluateDriveStudents(driveId: string): Promise<{
  drive: DriveForEligibility;
  policy: PlacementPolicyInput;
  evaluations: {
    student: StudentForEligibility;
    result: EligibilityResult;
    applicationStatus: string | null;
    override: { id: string; reason: string } | null;
  }[];
  eligibleCount: number;
}> {
  const [drive, policy, students, applications, overrides] = await Promise.all([
    getDriveForEligibility(driveId),
    getPlacementPolicy(),
    prisma.studentProfile.findMany({
      where: { user: { isActive: true } },
      include: studentEligibilityInclude,
      orderBy: { rollNumber: "asc" },
    }),
    prisma.application.findMany({ where: { driveId }, select: { studentProfileId: true, status: true } }),
    prisma.eligibilityOverride.findMany({
      where: { driveId, isActive: true },
      select: { id: true, studentProfileId: true, reason: true },
    }),
  ]);
  const appMap = new Map(applications.map((application) => [application.studentProfileId, application.status]));
  const overrideMap = new Map(
    overrides.map((override) => [override.studentProfileId, { id: override.id, reason: override.reason }]),
  );
  const evaluations = students.map((student) => {
    const status = appMap.get(student.id) ?? null;
    const result = evaluateMapped(student, drive, policy, status ? { status } : null);
    return {
      student,
      result,
      applicationStatus: status,
      override: overrideMap.get(student.id) ?? null,
    };
  });
  return {
    drive,
    policy,
    evaluations,
    eligibleCount: evaluations.filter((entry) => entry.result.eligible || entry.override).length,
  };
}

export async function getStudentDriveEligibility(studentProfileId: string): Promise<
  { drive: DriveForEligibility; result: EligibilityResult; override: { reason: string } | null }[]
> {
  const [student, policy, drives, applications, overrides] = await Promise.all([
    getStudentForEligibility(studentProfileId),
    getPlacementPolicy(),
    prisma.drive.findMany({
      where: { status: "ACTIVE" },
      include: driveEligibilityInclude,
      orderBy: { deadline: "asc" },
    }),
    prisma.application.findMany({
      where: { studentProfileId },
      select: { driveId: true, status: true },
    }),
    prisma.eligibilityOverride.findMany({
      where: { studentProfileId, isActive: true },
      select: { driveId: true, reason: true },
    }),
  ]);
  const appMap = new Map(applications.map((application) => [application.driveId, application.status]));
  const overrideMap = new Map(overrides.map((override) => [override.driveId, { reason: override.reason }]));
  return drives.map((drive) => {
    const status = appMap.get(drive.id);
    return {
      drive,
      result: evaluateMapped(student, drive, policy, status ? { status } : null),
      override: overrideMap.get(drive.id) ?? null,
    };
  });
}

export function serializeEligibilitySnapshot(
  result: EligibilityResult,
  evaluatedAt: Date,
  override?: { reason: string; applied: boolean } | null,
) {
  return JSON.stringify({
    ...result,
    evaluatedAt: evaluatedAt.toISOString(),
    override: override ?? null,
  });
}

export async function getActiveOverride(studentProfileId: string, driveId: string) {
  return prisma.eligibilityOverride.findFirst({
    where: { studentProfileId, driveId, isActive: true },
    select: { id: true, reason: true, createdAt: true },
  });
}

export async function createOverride(input: {
  studentProfileId: string;
  driveId: string;
  reason: string;
  actorId: string;
}) {
  const [student, drive] = await Promise.all([
    prisma.studentProfile.findUnique({ where: { id: input.studentProfileId }, select: { id: true, rollNumber: true } }),
    prisma.drive.findUnique({ where: { id: input.driveId }, select: { id: true, title: true } }),
  ]);
  if (!student) throw new AppError("STUDENT_NOT_FOUND", "Student not found.", 404);
  if (!drive) throw new AppError("DRIVE_NOT_FOUND", "Drive not found.", 404);

  const override = await prisma.eligibilityOverride.upsert({
    where: {
      studentProfileId_driveId: { studentProfileId: input.studentProfileId, driveId: input.driveId },
    },
    create: {
      studentProfileId: input.studentProfileId,
      driveId: input.driveId,
      reason: input.reason,
      createdById: input.actorId,
    },
    update: {
      reason: input.reason,
      isActive: true,
      revokedAt: null,
      revokedById: null,
      revokeReason: null,
      createdById: input.actorId,
    },
  });
  await audit({
    actorId: input.actorId,
    action: "ELIGIBILITY_OVERRIDE_CREATED",
    entityType: "EligibilityOverride",
    entityId: override.id,
    after: { student: student.rollNumber, drive: drive.title, reason: input.reason },
  });
  return override;
}

export async function revokeOverride(input: {
  overrideId: string;
  reason: string;
  actorId: string;
}) {
  const existing = await prisma.eligibilityOverride.findUnique({ where: { id: input.overrideId } });
  if (!existing) throw new AppError("OVERRIDE_NOT_FOUND", "Override not found.", 404);
  const updated = await prisma.eligibilityOverride.update({
    where: { id: input.overrideId },
    data: {
      isActive: false,
      revokedAt: new Date(),
      revokedById: input.actorId,
      revokeReason: input.reason,
    },
  });
  await audit({
    actorId: input.actorId,
    action: "ELIGIBILITY_OVERRIDE_REVOKED",
    entityType: "EligibilityOverride",
    entityId: existing.id,
    before: existing,
    after: updated,
  });
  return updated;
}

export async function runEligibilityForDrive(driveId: string, actorId: string): Promise<{
  eligible: number;
  ineligible: number;
  overridden: number;
  notificationsCreated: number;
}> {
  const { drive, evaluations } = await evaluateDriveStudents(driveId);
  if (drive.status !== "ACTIVE") {
    return { eligible: 0, ineligible: 0, overridden: 0, notificationsCreated: 0 };
  }
  const eligibleEntries = evaluations.filter((entry) => entry.result.eligible || entry.override);
  const notificationInputs = eligibleEntries.map((entry) => ({
    userId: entry.student.userId,
    type: "DRIVE_NEW_ELIGIBLE" as const,
    title: `New eligible drive: ${drive.title}`,
    body: `You are eligible for ${drive.roleTitle} at ${drive.company.name}. Apply before ${drive.deadline.toLocaleDateString("en-IN")}.`,
    link: `/student/drives/${drive.id}`,
    dedupeKey: `drive-eligible:${drive.id}`,
  }));
  const notificationsCreated = await notifyUsers(notificationInputs);
  const overridden = evaluations.filter((entry) => entry.override && !entry.result.eligible).length;
  const eligible = evaluations.filter((entry) => entry.result.eligible).length;
  const ineligible = evaluations.length - eligible - overridden;
  await audit({
    actorId,
    action: "DRIVE_ELIGIBILITY_RUN",
    entityType: "Drive",
    entityId: drive.id,
    metadata: {
      eligible,
      ineligible,
      overridden,
      notificationsCreated,
      evaluated: evaluations.length,
    },
  });
  publishToRole("PLACEMENT_OFFICER", "drive.eligibility.updated", {
    driveId: drive.id,
    eligible,
    ineligible,
    overridden,
  });
  return { eligible, ineligible, overridden, notificationsCreated };
}
