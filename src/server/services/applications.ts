import { prisma } from "@/server/db";
import { AppError } from "@/server/errors";
import { audit } from "@/server/audit";
import {
  evaluateMapped,
  getActiveOverride,
  getDriveForEligibility,
  getPlacementPolicy,
  getStudentForEligibility,
  serializeEligibilitySnapshot,
} from "@/server/services/eligibility";
import { notifyUser } from "@/server/services/notifications";

export async function getStudentApplications(profileId: string, status?: string) {
  return prisma.application.findMany({
    where: {
      studentProfileId: profileId,
      ...(status ? { status } : {}),
    },
    include: {
      drive: { include: { company: true } },
      currentRound: true,
      offer: true,
      _count: { select: { roundResults: true } },
    },
    orderBy: [{ appliedAt: "desc" }],
  });
}

export async function getStudentApplication(profileId: string, applicationId: string) {
  const application = await prisma.application.findFirst({
    where: { id: applicationId, studentProfileId: profileId },
    include: {
      drive: {
        include: {
          company: true,
          eligibilityRule: true,
          requiredSkills: { include: { skill: true } },
          rounds: { orderBy: { order: "asc" } },
        },
      },
      currentRound: true,
      roundResults: { include: { round: true }, orderBy: { round: { order: "asc" } } },
      offer: true,
    },
  });
  if (!application) throw new AppError("APPLICATION_NOT_FOUND", "Application not found.", 404);
  return application;
}

export async function applyToDrive(input: {
  profileId: string;
  userId: string;
  actorId: string;
  driveId: string;
  coverNote: string | null;
}) {
  const [drive, student, policy, existing, override] = await Promise.all([
    getDriveForEligibility(input.driveId),
    getStudentForEligibility(input.profileId),
    getPlacementPolicy(),
    prisma.application.findUnique({
      where: {
        studentProfileId_driveId: { studentProfileId: input.profileId, driveId: input.driveId },
      },
    }),
    getActiveOverride(input.profileId, input.driveId),
  ]);
  if (drive.status !== "ACTIVE") {
    throw new AppError("DRIVE_NOT_OPEN", "This drive is not accepting applications.", 409);
  }
  const evaluatedAt = new Date();
  const result = evaluateMapped(
    student,
    drive,
    policy,
    existing ? { status: existing.status } : null,
    evaluatedAt,
  );
  const overrideApplied = Boolean(override) && !result.eligible;
  if (!result.eligible && !overrideApplied) {
    const reasons = result.reasons.map((reason) => reason.message).join(" ");
    throw new AppError("NOT_ELIGIBLE", reasons || "You are not eligible for this drive.", 403);
  }
  if (existing && existing.status !== "WITHDRAWN") {
    throw new AppError("ALREADY_APPLIED", "You already have an application for this drive.", 409);
  }

  const snapshot = serializeEligibilitySnapshot(result, evaluatedAt, override
    ? { reason: override.reason, applied: overrideApplied }
    : null);
  const application = await prisma.$transaction(async (tx) => {
    if (existing) {
      return tx.application.update({
        where: { id: existing.id },
        data: {
          status: "APPLIED",
          source: "STUDENT",
          coverNote: input.coverNote,
          eligibilitySnapshot: snapshot,
          matchScore: result.matchScore,
          isDreamOffer: result.isDreamOffer,
          eligibilityOverridden: overrideApplied,
          appliedAt: evaluatedAt,
          statusUpdatedAt: evaluatedAt,
          withdrawnAt: null,
          rejectionReason: null,
          recruiterFeedback: null,
        },
      });
    }
    return tx.application.create({
      data: {
        studentProfileId: input.profileId,
        driveId: input.driveId,
        status: "APPLIED",
        source: "STUDENT",
        coverNote: input.coverNote,
        eligibilitySnapshot: snapshot,
        matchScore: result.matchScore,
        isDreamOffer: result.isDreamOffer,
        eligibilityOverridden: overrideApplied,
        appliedAt: evaluatedAt,
        statusUpdatedAt: evaluatedAt,
      },
    });
  });

  await audit({
    actorId: input.actorId,
    action: existing ? "APPLICATION_REAPPLIED" : "APPLICATION_SUBMITTED",
    entityType: "Application",
    entityId: application.id,
    after: {
      driveId: drive.id,
      matchScore: result.matchScore,
      isDreamOffer: result.isDreamOffer,
      eligibilityOverridden: overrideApplied,
    },
  });

  const creator = await prisma.user.findUnique({
    where: { id: drive.createdById },
    select: { id: true, role: true },
  });
  if (creator) {
    await notifyUser({
      userId: creator.id,
      type: "APPLICATION_STATUS",
      title: `New application: ${drive.title}`,
      body: `A student applied with a ${result.matchScore}% skill match.`,
      link:
        creator.role === "RECRUITER"
          ? `/recruiter/drives/${drive.id}`
          : `/officer/drives/${drive.id}`,
    });
  }

  return { application, result, overrideApplied };
}

export async function withdrawApplication(input: {
  profileId: string;
  actorId: string;
  applicationId: string;
}) {
  const application = await prisma.application.findFirst({
    where: { id: input.applicationId, studentProfileId: input.profileId },
    include: { drive: { select: { id: true, title: true, createdById: true } } },
  });
  if (!application) throw new AppError("APPLICATION_NOT_FOUND", "Application not found.", 404);
  if (!["APPLIED", "SHORTLISTED", "IN_PROCESS"].includes(application.status)) {
    throw new AppError(
      "WITHDRAW_NOT_ALLOWED",
      application.status === "OFFERED"
        ? "You cannot withdraw after an offer. Contact the placement office."
        : "This application can no longer be withdrawn.",
      409,
    );
  }

  const updated = await prisma.application.update({
    where: { id: application.id },
    data: {
      status: "WITHDRAWN",
      statusUpdatedAt: new Date(),
      withdrawnAt: new Date(),
    },
  });
  await audit({
    actorId: input.actorId,
    action: "APPLICATION_WITHDRAWN",
    entityType: "Application",
    entityId: application.id,
    before: { status: application.status },
    after: { status: "WITHDRAWN" },
  });

  const creator = await prisma.user.findUnique({
    where: { id: application.drive.createdById },
    select: { id: true, role: true },
  });
  if (creator) {
    await notifyUser({
      userId: creator.id,
      type: "APPLICATION_STATUS",
      title: `Application withdrawn: ${application.drive.title}`,
      body: "A student withdrew their application.",
      link:
        creator.role === "RECRUITER"
          ? `/recruiter/drives/${application.drive.id}`
          : `/officer/drives/${application.drive.id}`,
    });
  }
  return updated;
}
