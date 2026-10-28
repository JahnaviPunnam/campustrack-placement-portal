import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { AppError } from "@/server/errors";
import {
  driveEligibilityInclude,
  evaluateMapped,
  getActiveOverride,
  getPlacementPolicy,
  getStudentForEligibility,
  getStudentDriveEligibility,
} from "@/server/services/eligibility";

export const studentDriveDetailInclude = {
  ...driveEligibilityInclude,
  requiredSkills: {
    include: {
      skill: { include: { learningResources: { where: { isActive: true } } } },
    },
  },
  rounds: { orderBy: { order: "asc" as const } },
} satisfies Prisma.DriveInclude;

export async function getStudentDrives(profileId: string) {
  return getStudentDriveEligibility(profileId);
}

export async function getStudentDriveDetail(profileId: string, driveId: string) {
  const drive = await prisma.drive.findFirst({
    where: { id: driveId, status: { in: ["ACTIVE", "CLOSED", "COMPLETED"] } },
    include: studentDriveDetailInclude,
  });
  if (!drive) throw new AppError("DRIVE_NOT_FOUND", "Drive not found.", 404);
  const [student, policy, application, override] = await Promise.all([
    getStudentForEligibility(profileId),
    getPlacementPolicy(),
    prisma.application.findUnique({
      where: { studentProfileId_driveId: { studentProfileId: profileId, driveId } },
      select: { id: true, status: true, matchScore: true, appliedAt: true },
    }),
    getActiveOverride(profileId, driveId),
  ]);
  const result = evaluateMapped(student, drive, policy, application ? { status: application.status } : null);
  return { drive, student, result, application, override };
}
