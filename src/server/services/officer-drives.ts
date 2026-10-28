import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { audit } from "@/server/audit";
import { AppError } from "@/server/errors";
import { notifyUser, notifyUsers } from "@/server/services/notifications";
import { publishToRole, publishToUser } from "@/server/realtime/hub";
import {
  evaluateDriveStudents,
  getPlacementPolicy,
  runEligibilityForDrive,
} from "@/server/services/eligibility";
import type { DriveCreateInput, RoundResultInput } from "@/lib/validation/officer";

export type DriveListFilters = {
  q?: string;
  status?: string;
  companyId?: string;
  tier?: number;
};

export async function listDrives(filters: DriveListFilters = {}) {
  return prisma.drive.findMany({
    where: {
      ...(filters.q
        ? {
            OR: [
              { title: { contains: filters.q } },
              { roleTitle: { contains: filters.q } },
              { company: { name: { contains: filters.q } } },
            ],
          }
        : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.companyId ? { companyId: filters.companyId } : {}),
      ...(filters.tier ? { tier: filters.tier } : {}),
    },
    include: {
      company: { select: { id: true, name: true, tier: true } },
      createdBy: { select: { name: true, role: true } },
      _count: { select: { applications: true, requiredSkills: true, rounds: true } },
    },
    orderBy: [{ status: "asc" }, { deadline: "desc" }],
  });
}

export const driveAdminInclude = {
  company: true,
  createdBy: { select: { id: true, name: true, email: true, role: true } },
  approvedBy: { select: { name: true } },
  eligibilityRule: true,
  requiredSkills: { include: { skill: { select: { id: true, name: true, category: true } } } },
  rounds: {
    orderBy: { order: "asc" as const },
    include: { _count: { select: { results: true, currentApplications: true } } },
  },
  applications: {
    include: {
      studentProfile: {
        include: { user: { select: { name: true, email: true } } },
      },
      currentRound: true,
      offer: true,
      roundResults: { include: { round: { select: { name: true, order: true } } } },
    },
    orderBy: { appliedAt: "desc" as const },
  },
  overrides: {
    where: { isActive: true },
    include: { studentProfile: { include: { user: { select: { name: true, email: true } } } } },
    orderBy: { createdAt: "desc" as const },
  },
} satisfies Prisma.DriveInclude;

export async function getDriveAdminDetail(driveId: string) {
  const drive = await prisma.drive.findUnique({
    where: { id: driveId },
    include: driveAdminInclude,
  });
  if (!drive) throw new AppError("DRIVE_NOT_FOUND", "Drive not found.", 404);
  const auditLogs = await prisma.auditLog.findMany({
    where: { entityType: "Drive", entityId: drive.id },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { actor: { select: { name: true } } },
  });
  return { drive, auditLogs };
}

export async function getDriveEditorOptions() {
  const [companies, skills] = await Promise.all([
    prisma.company.findMany({
      where: { isActive: true },
      select: { id: true, name: true, tier: true },
      orderBy: { name: "asc" },
    }),
    prisma.skill.findMany({
      where: { isActive: true },
      select: { id: true, name: true, category: true },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    }),
  ]);
  return { companies, skills };
}

function buildWriteData(input: DriveCreateInput, createdById: string) {
  return {
    companyId: input.companyId,
    createdById,
    title: input.title,
    roleTitle: input.roleTitle,
    description: input.description,
    package: input.package,
    location: input.location,
    tier: input.tier,
    openings: input.openings,
    deadline: input.deadline,
    source: "OFFICER",
    status: "DRAFT",
  };
}

export async function writeDriveRelations(
  tx: Prisma.TransactionClient,
  driveId: string,
  input: DriveCreateInput,
) {
  await tx.eligibilityRule.upsert({
    where: { driveId },
    create: {
      driveId,
      minCgpa: input.minCgpa,
      maxBacklogs: input.maxBacklogs,
      allowedBranches: input.allowedBranches.join(","),
      allowedGraduationYears: input.allowedGraduationYears.join(","),
      requireVerifiedProfile: input.requireVerifiedProfile,
      requireResume: input.requireResume,
    },
    update: {
      minCgpa: input.minCgpa,
      maxBacklogs: input.maxBacklogs,
      allowedBranches: input.allowedBranches.join(","),
      allowedGraduationYears: input.allowedGraduationYears.join(","),
      requireVerifiedProfile: input.requireVerifiedProfile,
      requireResume: input.requireResume,
    },
  });
  await tx.driveRequiredSkill.deleteMany({ where: { driveId } });
  await tx.driveRequiredSkill.createMany({
    data: input.requiredSkills.map((skill) => ({
      driveId,
      skillId: skill.skillId,
      minProficiency: skill.minProficiency,
      weight: skill.weight,
      isMandatory: skill.isMandatory,
    })),
  });
  await tx.round.deleteMany({ where: { driveId } });
  if (input.rounds.length > 0) {
    await tx.round.createMany({
      data: input.rounds.map((round, index) => ({
        driveId,
        name: round.name,
        type: round.type,
        order: index + 1,
        description: round.description,
        scheduledAt: round.scheduledAt,
        durationMinutes: round.durationMinutes,
        venue: round.venue,
        meetingLink: round.meetingLink,
      })),
    });
  }
}

export async function createDrive(input: DriveCreateInput, officerId: string) {
  const company = await prisma.company.findUnique({ where: { id: input.companyId } });
  if (!company) throw new AppError("COMPANY_NOT_FOUND", "Company not found.", 404);
  if (!company.isActive) throw new AppError("COMPANY_INACTIVE", "Activate the company first.", 400);
  if (input.deadline.getTime() <= Date.now()) {
    throw new AppError("DEADLINE_PAST", "The application deadline must be in the future.", 400);
  }
  const drive = await prisma.$transaction(async (tx) => {
    const created = await tx.drive.create({ data: buildWriteData(input, officerId) });
    await writeDriveRelations(tx, created.id, input);
    return created;
  });
  await audit({
    actorId: officerId,
    action: "DRIVE_CREATED",
    entityType: "Drive",
    entityId: drive.id,
    after: { title: drive.title, companyId: drive.companyId, tier: drive.tier },
  });
  return drive;
}

export async function updateDrive(input: DriveCreateInput & { driveId: string }, officerId: string) {
  const existing = await prisma.drive.findUnique({
    where: { id: input.driveId },
    include: { _count: { select: { applications: true } } },
  });
  if (!existing) throw new AppError("DRIVE_NOT_FOUND", "Drive not found.", 404);
  if (!["DRAFT", "REJECTED"].includes(existing.status)) {
    throw new AppError(
      "DRIVE_LOCKED",
      "Only draft or rejected drives can be edited. Active drive rules are locked for fairness.",
      409,
    );
  }
  if (input.deadline.getTime() <= Date.now()) {
    throw new AppError("DEADLINE_PAST", "The application deadline must be in the future.", 400);
  }
  const company = await prisma.company.findUnique({ where: { id: input.companyId } });
  if (!company || !company.isActive) {
    throw new AppError("COMPANY_INACTIVE", "Choose an active company.", 400);
  }
  const drive = await prisma.$transaction(async (tx) => {
    const updated = await tx.drive.update({
      where: { id: existing.id },
      data: {
        ...buildWriteData(input, existing.createdById),
        status: "DRAFT",
        rejectionReason: null,
        approvedAt: null,
        approvedById: null,
        publishedAt: null,
      },
    });
    await writeDriveRelations(tx, existing.id, input);
    return updated;
  });
  await audit({
    actorId: officerId,
    action: "DRIVE_UPDATED",
    entityType: "Drive",
    entityId: drive.id,
    before: { title: existing.title, tier: existing.tier, deadline: existing.deadline },
    after: { title: drive.title, tier: drive.tier, deadline: drive.deadline },
  });
  return drive;
}

async function activateAndNotify(driveId: string, officerId: string) {
  const drive = await prisma.drive.findUnique({ where: { id: driveId } });
  if (!drive) throw new AppError("DRIVE_NOT_FOUND", "Drive not found.", 404);
  if (drive.deadline.getTime() <= Date.now()) {
    throw new AppError("DEADLINE_PAST", "Update the deadline before publishing.", 400);
  }
  const updated = await prisma.drive.update({
    where: { id: drive.id },
    data: {
      status: "ACTIVE",
      publishedAt: new Date(),
      approvedAt: new Date(),
      approvedById: officerId,
      rejectionReason: null,
      closedAt: null,
    },
  });
  const report = await runEligibilityForDrive(drive.id, officerId);
  publishToRole("RECRUITER", "drive.published", { driveId: drive.id, companyId: drive.companyId });
  return { drive: updated, notificationsCreated: report.notificationsCreated };
}

export async function publishDrive(driveId: string, officerId: string) {
  const drive = await prisma.drive.findUnique({ where: { id: driveId } });
  if (!drive) throw new AppError("DRIVE_NOT_FOUND", "Drive not found.", 404);
  if (drive.source !== "OFFICER") {
    throw new AppError("APPROVAL_REQUIRED", "Recruiter drives require the approval queue.", 409);
  }
  if (!["DRAFT", "REJECTED"].includes(drive.status)) {
    throw new AppError("DRIVE_STATE_INVALID", "Only draft or rejected drives can be published.", 409);
  }
  const result = await activateAndNotify(drive.id, officerId);
  await audit({
    actorId: officerId,
    action: "DRIVE_PUBLISHED",
    entityType: "Drive",
    entityId: drive.id,
    before: { status: drive.status },
    after: { status: "ACTIVE" },
    metadata: { notificationsCreated: result.notificationsCreated },
  });
  return result;
}

export async function approveDrive(input: {
  driveId: string;
  decision: "APPROVE" | "REJECT";
  reason: string | null;
  officerId: string;
}) {
  const drive = await prisma.drive.findUnique({
    where: { id: input.driveId },
    include: { createdBy: { select: { id: true } }, company: { select: { name: true } } },
  });
  if (!drive) throw new AppError("DRIVE_NOT_FOUND", "Drive not found.", 404);
  if (drive.status !== "PENDING_APPROVAL") {
    throw new AppError("DRIVE_STATE_INVALID", "This drive is not awaiting approval.", 409);
  }

  if (input.decision === "REJECT") {
    const rejected = await prisma.drive.update({
      where: { id: drive.id },
      data: {
        status: "REJECTED",
        rejectionReason: input.reason,
        approvedAt: null,
        approvedById: input.officerId,
      },
    });
    await audit({
      actorId: input.officerId,
      action: "DRIVE_REJECTED",
      entityType: "Drive",
      entityId: drive.id,
      before: { status: drive.status },
      after: { status: rejected.status },
      metadata: { reason: input.reason },
    });
    await notifyUser({
      userId: drive.createdById,
      type: "DRIVE_APPROVAL",
      title: `Drive rejected: ${drive.title}`,
      body: input.reason
        ? `The placement office rejected the drive: ${input.reason}`
        : "The placement office rejected the drive. Contact them for details.",
      link: drive.source === "RECRUITER" ? `/recruiter/drives/${drive.id}` : `/officer/drives/${drive.id}`,
      dedupeKey: `drive-rejected:${drive.id}:${rejected.updatedAt.getTime()}`,
    });
    return { status: "REJECTED" as const, notificationsCreated: 0 };
  }

  const result = await activateAndNotify(drive.id, input.officerId);
  await audit({
    actorId: input.officerId,
    action: "DRIVE_APPROVED",
    entityType: "Drive",
    entityId: drive.id,
    before: { status: drive.status },
    after: { status: "ACTIVE" },
    metadata: { notificationsCreated: result.notificationsCreated },
  });
  await notifyUser({
    userId: drive.createdById,
    type: "DRIVE_APPROVAL",
    title: `Drive approved: ${drive.title}`,
    body: `${drive.company.name} drive is now live for eligible students.`,
    link: `/recruiter/drives/${drive.id}`,
    dedupeKey: `drive-approved:${drive.id}`,
  });
  return { status: "ACTIVE" as const, notificationsCreated: result.notificationsCreated };
}

export async function changeDriveStatus(driveId: string, status: string, officerId: string) {
  const drive = await prisma.drive.findUnique({ where: { id: driveId } });
  if (!drive) throw new AppError("DRIVE_NOT_FOUND", "Drive not found.", 404);
  const allowed =
    (drive.status === "ACTIVE" && status === "CLOSED") ||
    (drive.status === "CLOSED" && status === "COMPLETED");
  if (!allowed) {
    throw new AppError("DRIVE_STATE_INVALID", "That drive status transition is not allowed.", 409);
  }
  const updated = await prisma.drive.update({
    where: { id: drive.id },
    data: {
      status,
      closedAt: status === "CLOSED" || status === "COMPLETED" ? drive.closedAt ?? new Date() : drive.closedAt,
    },
  });
  await audit({
    actorId: officerId,
    action: status === "CLOSED" ? "DRIVE_CLOSED" : "DRIVE_COMPLETED",
    entityType: "Drive",
    entityId: drive.id,
    before: { status: drive.status },
    after: { status },
  });
  publishToRole("RECRUITER", "drive.status", { driveId: drive.id, status });
  return updated;
}

export async function createRound(
  input: {
    driveId: string;
    name: string;
    type: string;
    description: string | null;
    scheduledAt: Date | null;
    durationMinutes: number | null;
    venue: string | null;
    meetingLink: string | null;
    status: string;
  },
  officerId: string,
) {
  const drive = await prisma.drive.findUnique({ where: { id: input.driveId } });
  if (!drive) throw new AppError("DRIVE_NOT_FOUND", "Drive not found.", 404);
  if (drive.status === "COMPLETED" || drive.status === "CLOSED") {
    throw new AppError("DRIVE_STATE_INVALID", "Rounds cannot be added to a closed drive.", 409);
  }
  const last = await prisma.round.findFirst({
    where: { driveId: drive.id },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  const round = await prisma.round.create({
    data: {
      driveId: drive.id,
      name: input.name,
      type: input.type,
      order: (last?.order ?? 0) + 1,
      description: input.description,
      scheduledAt: input.scheduledAt,
      durationMinutes: input.durationMinutes,
      venue: input.venue,
      meetingLink: input.meetingLink,
      status: input.status,
    },
  });
  await audit({
    actorId: officerId,
    action: "ROUND_CREATED",
    entityType: "Round",
    entityId: round.id,
    after: { driveId: drive.id, name: round.name, order: round.order },
  });
  if (round.scheduledAt) {
    await notifyRoundSchedule(round, drive.title);
  }
  return round;
}

export async function updateRound(
  input: {
    roundId: string;
    driveId: string;
    name: string;
    type: string;
    description: string | null;
    scheduledAt: Date | null;
    durationMinutes: number | null;
    venue: string | null;
    meetingLink: string | null;
    status: string;
  },
  officerId: string,
) {
  const round = await prisma.round.findUnique({
    where: { id: input.roundId },
    include: { drive: { select: { title: true } } },
  });
  if (!round || round.driveId !== input.driveId) {
    throw new AppError("ROUND_NOT_FOUND", "Round not found for this drive.", 404);
  }
  const updated = await prisma.round.update({
    where: { id: round.id },
    data: {
      name: input.name,
      type: input.type,
      description: input.description,
      scheduledAt: input.scheduledAt,
      durationMinutes: input.durationMinutes,
      venue: input.venue,
      meetingLink: input.meetingLink,
      status: input.status,
    },
  });
  await audit({
    actorId: officerId,
    action: "ROUND_UPDATED",
    entityType: "Round",
    entityId: round.id,
    before: { name: round.name, scheduledAt: round.scheduledAt, status: round.status },
    after: { name: updated.name, scheduledAt: updated.scheduledAt, status: updated.status },
  });
  const scheduleChanged =
    round.scheduledAt?.getTime() !== updated.scheduledAt?.getTime() ||
    round.status !== updated.status ||
    round.venue !== updated.venue;
  if (scheduleChanged && (updated.scheduledAt || updated.status === "CANCELLED")) {
    await notifyRoundSchedule(updated, round.drive.title);
  }
  return updated;
}

export async function removeRound(roundId: string, driveId: string, officerId: string) {
  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: { _count: { select: { results: true, currentApplications: true } } },
  });
  if (!round || round.driveId !== driveId) {
    throw new AppError("ROUND_NOT_FOUND", "Round not found for this drive.", 404);
  }
  if (round._count.results > 0 || round._count.currentApplications > 0) {
    throw new AppError("ROUND_IN_USE", "This round has results or active candidates and cannot be removed.", 409);
  }
  await prisma.round.delete({ where: { id: round.id } });
  await audit({
    actorId: officerId,
    action: "ROUND_REMOVED",
    entityType: "Round",
    entityId: round.id,
    before: { driveId, name: round.name, order: round.order },
  });
}

export async function recordRoundResult(input: RoundResultInput & { officerId: string }) {
  const result = await prisma.applicationRoundResult.findFirst({
    where: { applicationId: input.applicationId, roundId: input.roundId },
  });
  const [application, round] = await Promise.all([
    prisma.application.findUnique({
      where: { id: input.applicationId },
      include: { drive: true, studentProfile: { include: { user: { select: { id: true } } } }, offer: true },
    }),
    prisma.round.findUnique({ where: { id: input.roundId }, include: { drive: true } }),
  ]);
  if (!application) throw new AppError("APPLICATION_NOT_FOUND", "Application not found.", 404);
  if (!round || round.driveId !== application.driveId) {
    throw new AppError("ROUND_NOT_FOUND", "Round not found for this application.", 404);
  }
  if (["WITHDRAWN", "REJECTED"].includes(application.status)) {
    throw new AppError("APPLICATION_CLOSED", "This application is no longer active.", 409);
  }
  if (application.status === "OFFERED") {
    throw new AppError("APPLICATION_CLOSED", "Round results cannot be changed after an offer.", 409);
  }

  const final = ["PASSED", "FAILED", "ABSENT", "WAIVED"].includes(input.status);
  const updated = await prisma.$transaction(async (tx) => {
    const saved = await tx.applicationRoundResult.upsert({
      where: {
        applicationId_roundId: { applicationId: input.applicationId, roundId: input.roundId },
      },
      create: {
        applicationId: input.applicationId,
        roundId: input.roundId,
        status: input.status,
        score: input.score,
        slotAt: input.slotAt,
        notes: input.notes,
        feedback: input.feedback,
        resultAt: final ? new Date() : null,
        updatedById: input.officerId,
      },
      update: {
        status: input.status,
        score: input.score,
        slotAt: input.slotAt,
        notes: input.notes,
        feedback: input.feedback,
        resultAt: final ? new Date() : null,
        updatedById: input.officerId,
      },
    });

    if (input.status === "FAILED" || input.status === "ABSENT") {
      await tx.application.update({
        where: { id: application.id },
        data: {
          status: "REJECTED",
          statusUpdatedAt: new Date(),
          rejectionReason:
            input.feedback ?? (input.status === "ABSENT" ? `Absent for ${round.name}` : `Did not clear ${round.name}`),
          currentRoundId: null,
        },
      });
    } else if (input.status === "PASSED" || input.status === "WAIVED") {
      const nextRound = await tx.round.findFirst({
        where: { driveId: application.driveId, order: { gt: round.order } },
        orderBy: { order: "asc" },
        select: { id: true },
      });
      await tx.application.update({
        where: { id: application.id },
        data: {
          status: "IN_PROCESS",
          statusUpdatedAt: new Date(),
          currentRoundId: nextRound?.id ?? null,
        },
      });
    }
    return saved;
  });

  await audit({
    actorId: input.officerId,
    action: "ROUND_RESULT_RECORDED",
    entityType: "ApplicationRoundResult",
    entityId: updated.id,
    before: result ? { status: result.status, score: result.score } : null,
    after: { status: updated.status, score: updated.score },
    metadata: { applicationId: application.id, roundId: round.id },
  });
  await notifyUser({
    userId: application.studentProfile.userId,
    type: "ROUND_RESULT",
    title: `${round.name} result: ${input.status.replaceAll("_", " ").toLowerCase()}`,
    body: input.feedback ?? `Your result for ${round.name} has been recorded.`,
    link: `/student/applications/${application.id}`,
    dedupeKey: `round-result:${updated.id}:${updated.updatedAt.getTime()}`,
  });
  publishToUser(application.studentProfile.userId, "application.updated", {
    applicationId: application.id,
    status: input.status,
  });
  publishToRole("PLACEMENT_OFFICER", "drive.pipeline.updated", { driveId: application.driveId });
  return updated;
}

export async function setApplicationStatus(input: {
  applicationId: string;
  status: string;
  reason: string | null;
  officerId: string;
}) {
  const application = await prisma.application.findUnique({
    where: { id: input.applicationId },
    include: {
      drive: true,
      studentProfile: { include: { user: { select: { id: true } } } },
      offer: true,
    },
  });
  if (!application) throw new AppError("APPLICATION_NOT_FOUND", "Application not found.", 404);
  if (application.status === "OFFERED" || application.offer) {
    throw new AppError("APPLICATION_HAS_OFFER", "Revoke the offer before changing this application.", 409);
  }
  if (application.status === input.status) return application;
  const updated = await prisma.application.update({
    where: { id: application.id },
    data: {
      status: input.status,
      statusUpdatedAt: new Date(),
      rejectionReason: input.status === "REJECTED" ? input.reason : null,
      withdrawnAt: input.status === "WITHDRAWN" ? new Date() : null,
    },
  });
  await audit({
    actorId: input.officerId,
    action: "APPLICATION_STATUS_CHANGED",
    entityType: "Application",
    entityId: application.id,
    before: { status: application.status },
    after: { status: input.status },
    metadata: { reason: input.reason, driveId: application.driveId },
  });
  await notifyUser({
    userId: application.studentProfile.userId,
    type: "APPLICATION_STATUS",
    title: `Application update: ${application.drive.title}`,
    body:
      input.status === "REJECTED" && input.reason
        ? `Your application was not selected: ${input.reason}`
        : `Your application status is now ${input.status.replaceAll("_", " ").toLowerCase()}.`,
    link: `/student/applications/${application.id}`,
    dedupeKey: `application-status:${application.id}:${updated.updatedAt.getTime()}`,
  });
  publishToUser(application.studentProfile.userId, "application.updated", {
    applicationId: application.id,
    status: input.status,
  });
  publishToRole("PLACEMENT_OFFICER", "drive.pipeline.updated", { driveId: application.driveId });
  return updated;
}

export async function createOffer(input: {
  applicationId: string;
  package: number;
  roleTitle: string;
  location: string;
  joiningDate: Date | null;
  notes: string | null;
  officerId: string;
}) {
  const application = await prisma.application.findUnique({
    where: { id: input.applicationId },
    include: { drive: { include: { company: true } }, studentProfile: true, offer: true },
  });
  if (!application) throw new AppError("APPLICATION_NOT_FOUND", "Application not found.", 404);
  if (application.offer) throw new AppError("OFFER_EXISTS", "This application already has an offer.", 409);
  if (["REJECTED", "WITHDRAWN"].includes(application.status)) {
    throw new AppError("APPLICATION_CLOSED", "Offers cannot be issued for closed applications.", 409);
  }
  const accepted = await prisma.offer.findMany({
    where: { studentProfileId: application.studentProfileId, status: "ACCEPTED" },
    orderBy: { package: "desc" },
  });
  const policy = await getPlacementPolicy();
  const best = accepted[0];
  const dreamUpgrade =
    Boolean(best) &&
    policy.dreamOfferEnabled &&
    input.package > best.package &&
    input.package >= best.package * (1 + policy.minimumDreamOfferIncrease / 100);
  if (best) {
    if (accepted.length >= policy.maxOffersPerStudent && !dreamUpgrade) {
      throw new AppError(
        "PLACEMENT_POLICY_BLOCKED",
        `The student already has ${accepted.length} accepted offer(s); policy allows ${policy.maxOffersPerStudent}.`,
        409,
      );
    }
    if (policy.blockedPlacedTiers.includes(application.drive.tier) && !dreamUpgrade) {
      throw new AppError(
        "PLACEMENT_POLICY_BLOCKED",
        `The student is already placed and policy blocks tier ${application.drive.tier} offers.`,
        409,
      );
    }
  }

  const offer = await prisma.$transaction(async (tx) => {
    if (best && dreamUpgrade) {
      await tx.offer.updateMany({
        where: { studentProfileId: application.studentProfileId, status: "ACCEPTED" },
        data: { status: "DECLINED" },
      });
    }
    const created = await tx.offer.create({
      data: {
        applicationId: application.id,
        studentProfileId: application.studentProfileId,
        package: input.package,
        roleTitle: input.roleTitle,
        location: input.location,
        tier: application.drive.tier,
        status: "ACCEPTED",
        joiningDate: input.joiningDate,
        notes: input.notes,
        createdById: input.officerId,
      },
    });
    await tx.application.update({
      where: { id: application.id },
      data: {
        status: "OFFERED",
        statusUpdatedAt: new Date(),
        currentRoundId: null,
      },
    });
    return created;
  });

  await audit({
    actorId: input.officerId,
    action: "OFFER_CREATED",
    entityType: "Offer",
    entityId: offer.id,
    after: {
      applicationId: application.id,
      package: offer.package,
      tier: offer.tier,
      dreamUpgrade,
    },
  });
  await notifyUser({
    userId: application.studentProfile.userId,
    type: "OFFER",
    title: `Offer: ${offer.roleTitle} at ${application.drive.company.name}`,
    body: `Package ${offer.package.toFixed(1)} LPA. Review the offer details in the portal.`,
    link: `/student/applications/${application.id}`,
    dedupeKey: `offer:${offer.id}`,
  });
  publishToUser(application.studentProfile.userId, "offer.created", {
    applicationId: application.id,
    offerId: offer.id,
  });
  publishToRole("PLACEMENT_OFFICER", "drive.pipeline.updated", { driveId: application.driveId });
  return { offer, dreamUpgrade };
}

export async function revokeOffer(input: { offerId: string; reason: string | null; officerId: string }) {
  const offer = await prisma.offer.findUnique({
    where: { id: input.offerId },
    include: {
      application: {
        include: { drive: true, studentProfile: { include: { user: { select: { id: true } } } } },
      },
    },
  });
  if (!offer) throw new AppError("OFFER_NOT_FOUND", "Offer not found.", 404);
  if (offer.status === "REVOKED") throw new AppError("OFFER_REVOKED", "This offer is already revoked.", 409);
  const updated = await prisma.$transaction(async (tx) => {
    const saved = await tx.offer.update({
      where: { id: offer.id },
      data: { status: "REVOKED", notes: input.reason ?? offer.notes },
    });
    await tx.application.update({
      where: { id: offer.applicationId },
      data: { status: "IN_PROCESS", statusUpdatedAt: new Date() },
    });
    return saved;
  });
  await audit({
    actorId: input.officerId,
    action: "OFFER_REVOKED",
    entityType: "Offer",
    entityId: offer.id,
    before: { status: offer.status },
    after: { status: updated.status },
    metadata: { reason: input.reason },
  });
  await notifyUser({
    userId: offer.application.studentProfile.userId,
    type: "OFFER",
    title: `Offer revoked: ${offer.roleTitle}`,
    body: input.reason ?? "Contact the placement office for details.",
    link: `/student/applications/${offer.applicationId}`,
    dedupeKey: `offer-revoked:${offer.id}:${updated.updatedAt.getTime()}`,
  });
  publishToRole("PLACEMENT_OFFICER", "drive.pipeline.updated", {
    driveId: offer.application.driveId,
  });
  return updated;
}

async function notifyRoundSchedule(
  round: {
    id: string;
    name: string;
    driveId: string;
    scheduledAt: Date | null;
    venue: string | null;
    status: string;
    updatedAt: Date;
  },
  driveTitle: string,
) {
  const applications = await prisma.application.findMany({
    where: { driveId: round.driveId, status: { notIn: ["REJECTED", "WITHDRAWN"] } },
    select: { studentProfile: { select: { userId: true } } },
  });
  const when = round.scheduledAt
    ? round.scheduledAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
    : "A new time will be announced";
  await notifyUsers(
    applications.map((application) => ({
      userId: application.studentProfile.userId,
      type: "ROUND_SCHEDULED" as const,
      title: `${round.name}: ${driveTitle}`,
      body:
        round.status === "CANCELLED"
          ? `${round.name} has been cancelled. Watch for the revised schedule.`
          : `${when}${round.venue ? ` at ${round.venue}` : ""}.`,
      link: `/student/drives/${round.driveId}`,
      dedupeKey: `round-schedule:${round.id}:${round.updatedAt.getTime()}`,
    })),
  );
  for (const application of applications) {
    publishToUser(application.studentProfile.userId, "round.updated", { roundId: round.id });
  }
}

export async function getDriveEligibilityReview(driveId: string) {
  return evaluateDriveStudents(driveId);
}
