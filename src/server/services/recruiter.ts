import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { AppError } from "@/server/errors";
import { audit } from "@/server/audit";
import { skillCoverageScore } from "@/lib/recruiter";
import type { DriveCreateInput, RoundResultInput } from "@/lib/validation/officer";
import {
  evaluateMapped,
  getActiveOverride,
  getDriveForEligibility,
  getPlacementPolicy,
  getStudentForEligibility,
  serializeEligibilitySnapshot,
  studentEligibilityInclude,
} from "@/server/services/eligibility";
import { notifyUser, notifyUsers } from "@/server/services/notifications";
import { publishToRole, publishToUser } from "@/server/realtime/hub";
import { recordRoundResult, writeDriveRelations } from "@/server/services/officer-drives";

export type RecruiterContext = {
  userId: string;
  recruiterProfileId: string;
  companyId: string;
  companyName: string;
};

export type CandidateSearchFilters = {
  q?: string;
  branch?: string;
  graduationYear?: number;
  minCgpa?: number;
  skillIds?: string[];
  matchMode?: "AND" | "OR";
  driveId?: string;
  savedOnly?: boolean;
};

export async function getRecruiterDashboard(context: RecruiterContext) {
  const now = new Date();
  const [totalDrives, activeDrives, applicants, inProcess, acceptedOffers, statusCounts, drives, upcomingRounds, recentApplications] =
    await Promise.all([
      prisma.drive.count({ where: { companyId: context.companyId } }),
      prisma.drive.count({
        where: { companyId: context.companyId, status: "ACTIVE", deadline: { gt: now } },
      }),
      prisma.application.count({ where: { drive: { companyId: context.companyId } } }),
      prisma.application.count({
        where: {
          drive: { companyId: context.companyId },
          status: { in: ["SHORTLISTED", "IN_PROCESS"] },
        },
      }),
      prisma.offer.count({
        where: { application: { drive: { companyId: context.companyId } }, status: "ACCEPTED" },
      }),
      prisma.application.groupBy({
        by: ["status"],
        where: { drive: { companyId: context.companyId } },
        _count: { _all: true },
      }),
      prisma.drive.findMany({
        where: { companyId: context.companyId },
        include: { _count: { select: { applications: true } } },
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        take: 6,
      }),
      prisma.round.findMany({
        where: {
          drive: { companyId: context.companyId },
          scheduledAt: { gte: now },
          status: { not: "CANCELLED" },
        },
        include: { drive: { select: { id: true, title: true } } },
        orderBy: { scheduledAt: "asc" },
        take: 5,
      }),
      prisma.application.findMany({
        where: { drive: { companyId: context.companyId } },
        include: {
          drive: { select: { id: true, title: true, roleTitle: true } },
          studentProfile: {
            include: { user: { select: { name: true } } },
          },
        },
        orderBy: { appliedAt: "desc" },
        take: 8,
      }),
    ]);

  return {
    metrics: {
      totalDrives,
      activeDrives,
      applicants,
      inProcess,
      acceptedOffers,
    },
    statusCounts: statusCounts.map((entry) => ({
      status: entry.status,
      count: entry._count._all,
    })),
    drives,
    upcomingRounds,
    recentApplications,
  };
}

export async function listRecruiterDrives(context: RecruiterContext) {
  return prisma.drive.findMany({
    where: { companyId: context.companyId },
    include: {
      _count: { select: { applications: true, rounds: true, requiredSkills: true } },
      approvedBy: { select: { name: true } },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
}

export async function getRecruiterDriveDetail(context: RecruiterContext, driveId: string) {
  const drive = await prisma.drive.findFirst({
    where: { id: driveId, companyId: context.companyId },
    include: {
      createdBy: { select: { name: true } },
      approvedBy: { select: { name: true } },
      eligibilityRule: true,
      requiredSkills: { include: { skill: true }, orderBy: { isMandatory: "desc" } },
      rounds: {
        orderBy: { order: "asc" },
        include: {
          _count: { select: { results: true, currentApplications: true } },
        },
      },
      applications: {
        include: {
          studentProfile: {
            include: {
              user: { select: { name: true, email: true } },
              skills: { include: { skill: { select: { name: true } } } },
            },
          },
          currentRound: true,
          offer: true,
          roundResults: { include: { round: { select: { name: true, order: true } } } },
        },
        orderBy: { appliedAt: "desc" },
      },
    },
  });
  if (!drive) throw new AppError("DRIVE_NOT_FOUND", "Drive not found.", 404);
  return drive;
}

export async function getRecruiterDriveEditorOptions(context: RecruiterContext) {
  const [company, skills] = await Promise.all([
    prisma.company.findUnique({
      where: { id: context.companyId },
      select: { id: true, name: true, tier: true },
    }),
    prisma.skill.findMany({
      where: { isActive: true },
      select: { id: true, name: true, category: true },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    }),
  ]);
  if (!company) throw new AppError("COMPANY_NOT_FOUND", "Company not found.", 404);
  return { company, companies: [company], skills };
}

async function notifyOfficersOfRequest(driveId: string, companyName: string, title: string) {
  const officers = await prisma.user.findMany({
    where: { role: "PLACEMENT_OFFICER", isActive: true },
    select: { id: true },
  });
  await notifyUsers(
    officers.map((officer) => ({
      userId: officer.id,
      type: "DRIVE_APPROVAL" as const,
      title: `Drive request: ${title}`,
      body: `${companyName} submitted a drive for approval.`,
      link: `/officer/approvals`,
      dedupeKey: `drive-request:${driveId}:${Date.now()}`,
    })),
  );
  publishToRole("PLACEMENT_OFFICER", "drive.requested", { driveId });
}

export async function createRecruiterDriveRequest(input: DriveCreateInput, context: RecruiterContext) {
  if (input.companyId !== context.companyId) {
    throw new AppError("FORBIDDEN", "You can only request drives for your company.", 403);
  }
  const company = await prisma.company.findUnique({ where: { id: context.companyId } });
  if (!company || !company.isActive) {
    throw new AppError("COMPANY_INACTIVE", "Your company account is inactive.", 403);
  }
  if (input.deadline.getTime() <= Date.now()) {
    throw new AppError("DEADLINE_PAST", "The application deadline must be in the future.", 400);
  }
  const drive = await prisma.$transaction(async (tx) => {
    const created = await tx.drive.create({
      data: {
        companyId: context.companyId,
        createdById: context.userId,
        title: input.title,
        roleTitle: input.roleTitle,
        description: input.description,
        package: input.package,
        location: input.location,
        tier: input.tier,
        openings: input.openings,
        deadline: input.deadline,
        source: "RECRUITER",
        status: "PENDING_APPROVAL",
      },
    });
    await writeDriveRelations(tx, created.id, input);
    return created;
  });
  await audit({
    actorId: context.userId,
    action: "DRIVE_REQUESTED",
    entityType: "Drive",
    entityId: drive.id,
    after: { title: drive.title, companyId: drive.companyId, tier: drive.tier },
  });
  await notifyOfficersOfRequest(drive.id, company.name, drive.title);
  return drive;
}

export async function updateRecruiterDriveRequest(
  input: DriveCreateInput & { driveId: string },
  context: RecruiterContext,
) {
  if (input.companyId !== context.companyId) {
    throw new AppError("FORBIDDEN", "You can only request drives for your company.", 403);
  }
  const existing = await prisma.drive.findFirst({
    where: { id: input.driveId, companyId: context.companyId },
    include: { company: true },
  });
  if (!existing) throw new AppError("DRIVE_NOT_FOUND", "Drive not found.", 404);
  if (existing.source !== "RECRUITER") {
    throw new AppError("FORBIDDEN", "Only recruiter-requested drives can be resubmitted.", 403);
  }
  if (existing.status !== "REJECTED") {
    throw new AppError("DRIVE_STATE_INVALID", "Only rejected drive requests can be edited.", 409);
  }
  if (!existing.company.isActive) {
    throw new AppError("COMPANY_INACTIVE", "Your company account is inactive.", 403);
  }
  if (input.deadline.getTime() <= Date.now()) {
    throw new AppError("DEADLINE_PAST", "The application deadline must be in the future.", 400);
  }
  const drive = await prisma.$transaction(async (tx) => {
    const updated = await tx.drive.update({
      where: { id: existing.id },
      data: {
        companyId: context.companyId,
        title: input.title,
        roleTitle: input.roleTitle,
        description: input.description,
        package: input.package,
        location: input.location,
        tier: input.tier,
        openings: input.openings,
        deadline: input.deadline,
        status: "PENDING_APPROVAL",
        rejectionReason: null,
        approvedAt: null,
        approvedById: null,
        publishedAt: null,
        closedAt: null,
      },
    });
    await writeDriveRelations(tx, existing.id, input);
    return updated;
  });
  await audit({
    actorId: context.userId,
    action: "DRIVE_REQUEST_RESUBMITTED",
    entityType: "Drive",
    entityId: drive.id,
    before: { title: existing.title, status: existing.status, rejectionReason: existing.rejectionReason },
    after: { title: drive.title, status: drive.status },
  });
  await notifyOfficersOfRequest(drive.id, existing.company.name, drive.title);
  return drive;
}

function candidateWhere(context: RecruiterContext, filters: CandidateSearchFilters): Prisma.StudentProfileWhereInput {
  const skillIds = Array.from(new Set(filters.skillIds ?? []));
  const andSkillFilters = skillIds.map((skillId) => ({
    skills: { some: { skillId } },
  }));
  return {
    isVerified: true,
    user: { isActive: true },
    ...(filters.q
      ? {
          OR: [
            { rollNumber: { contains: filters.q } },
            { headline: { contains: filters.q } },
            { location: { contains: filters.q } },
            { user: { name: { contains: filters.q } } },
            { user: { email: { contains: filters.q } } },
          ],
        }
      : {}),
    ...(filters.branch ? { branch: filters.branch } : {}),
    ...(filters.graduationYear ? { graduationYear: filters.graduationYear } : {}),
    ...(filters.minCgpa !== undefined ? { cgpa: { gte: filters.minCgpa } } : {}),
    ...(skillIds.length > 0
      ? filters.matchMode === "OR"
        ? { skills: { some: { skillId: { in: skillIds } } } }
        : { AND: andSkillFilters }
      : {}),
    ...(filters.savedOnly
      ? { savedByRecruiters: { some: { recruiterProfileId: context.recruiterProfileId } } }
      : {}),
  };
}

export async function searchCandidates(context: RecruiterContext, filters: CandidateSearchFilters) {
  const [drive, policy] = filters.driveId
    ? await Promise.all([getDriveForEligibility(filters.driveId), getPlacementPolicy()])
    : [null, null];
  if (drive && drive.companyId !== context.companyId) {
    throw new AppError("FORBIDDEN", "You can only rank candidates for your company's drives.", 403);
  }

  const [students, applications, overrides, skills, drives] = await Promise.all([
    prisma.studentProfile.findMany({
      where: candidateWhere(context, filters),
      include: {
        ...studentEligibilityInclude,
        targetRoleProfile: { select: { name: true } },
        savedByRecruiters: {
          where: { recruiterProfileId: context.recruiterProfileId },
          select: { note: true },
        },
      },
      orderBy: [{ cgpa: "desc" }, { rollNumber: "asc" }],
      take: 200,
    }),
    drive
      ? prisma.application.findMany({
          where: { driveId: drive.id },
          select: { studentProfileId: true, status: true },
        })
      : Promise.resolve([]),
    drive
      ? prisma.eligibilityOverride.findMany({
          where: { driveId: drive.id, isActive: true },
          select: { studentProfileId: true, reason: true },
        })
      : Promise.resolve([]),
    prisma.skill.findMany({
      where: { isActive: true },
      select: { id: true, name: true, category: true },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    }),
    prisma.drive.findMany({
      where: { companyId: context.companyId, status: "ACTIVE", deadline: { gt: new Date() } },
      select: { id: true, title: true, roleTitle: true },
      orderBy: { deadline: "asc" },
    }),
  ]);

  const applicationMap = new Map(applications.map((application) => [application.studentProfileId, application.status]));
  const overrideMap = new Map(overrides.map((override) => [override.studentProfileId, override.reason]));
  const now = new Date();

  const candidates = students
    .map((student) => {
      const result =
        drive && policy ? evaluateMapped(student, drive, policy, null, now) : null;
      const overrideReason = overrideMap.get(student.id) ?? null;
      const eligible = result ? result.eligible || Boolean(overrideReason) : null;
      const rankedScore =
        result?.matchScore ?? skillCoverageScore(student.skills, filters.skillIds ?? []);
      return {
        id: student.id,
        name: student.user.name,
        rollNumber: student.rollNumber,
        branch: student.branch,
        graduationYear: student.graduationYear,
        cgpa: student.cgpa,
        backlogs: student.backlogs,
        headline: student.headline,
        location: student.location,
        targetRole: student.targetRoleProfile?.name ?? null,
        resumeAvailable: Boolean(student.resumePath),
        isSaved: student.savedByRecruiters.length > 0,
        savedNote: student.savedByRecruiters[0]?.note ?? null,
        skills: [...student.skills]
          .sort((a, b) => b.proficiency - a.proficiency)
          .map((skill) => ({
            name: skill.skill.name,
            proficiency: skill.proficiency,
            isVerified: skill.isVerified,
          })),
        applicationStatus: applicationMap.get(student.id) ?? null,
        eligible,
        matchesSkills:
          matchModeSummary(filters.matchMode ?? "AND", filters.skillIds ?? [], new Set(student.skills.map((skill) => skill.skillId))),
        reasons: result?.reasons.slice(0, 3).map((reason) => reason.message) ?? [],
        overrideReason,
        matchScore: rankedScore,
      };
    })
    .sort((a, b) => {
      if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
      if ((b.matchScore ?? -1) !== (a.matchScore ?? -1)) return (b.matchScore ?? -1) - (a.matchScore ?? -1);
      if ((b.cgpa ?? -1) !== (a.cgpa ?? -1)) return (b.cgpa ?? -1) - (a.cgpa ?? -1);
      return a.name.localeCompare(b.name);
    });

  return {
    candidates,
    skills,
    drives,
    drive,
    total: candidates.length,
    filters,
  };
}

function matchModeSummary(mode: "AND" | "OR", selected: string[], held: Set<string>): boolean | null {
  if (selected.length === 0) return null;
  return mode === "AND"
    ? selected.every((skillId) => held.has(skillId))
    : selected.some((skillId) => held.has(skillId));
}

export async function saveCandidate(
  context: RecruiterContext,
  input: { studentProfileId: string; note: string | null },
) {
  const student = await prisma.studentProfile.findFirst({
    where: { id: input.studentProfileId, isVerified: true, user: { isActive: true } },
    select: { id: true, rollNumber: true },
  });
  if (!student) throw new AppError("STUDENT_NOT_FOUND", "Verified student not found.", 404);

  const saved = await prisma.savedCandidate.upsert({
    where: {
      recruiterProfileId_studentProfileId: {
        recruiterProfileId: context.recruiterProfileId,
        studentProfileId: student.id,
      },
    },
    create: {
      recruiterProfileId: context.recruiterProfileId,
      studentProfileId: student.id,
      note: input.note,
    },
    update: { note: input.note },
  });
  await audit({
    actorId: context.userId,
    action: "CANDIDATE_SAVED",
    entityType: "StudentProfile",
    entityId: student.id,
    metadata: { recruiterProfileId: context.recruiterProfileId },
  });
  return saved;
}

export async function removeSavedCandidate(context: RecruiterContext, studentProfileId: string) {
  const result = await prisma.savedCandidate.deleteMany({
    where: { recruiterProfileId: context.recruiterProfileId, studentProfileId },
  });
  if (result.count > 0) {
    await audit({
      actorId: context.userId,
      action: "CANDIDATE_SAVE_REMOVED",
      entityType: "StudentProfile",
      entityId: studentProfileId,
      metadata: { recruiterProfileId: context.recruiterProfileId },
    });
  }
  return result.count;
}

export async function listSavedCandidates(context: RecruiterContext) {
  return prisma.savedCandidate.findMany({
    where: { recruiterProfileId: context.recruiterProfileId },
    include: {
      studentProfile: {
        include: {
          user: { select: { name: true } },
          targetRoleProfile: { select: { name: true } },
          skills: { include: { skill: { select: { name: true } } }, orderBy: { proficiency: "desc" } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function shortlistCandidate(
  context: RecruiterContext,
  input: { driveId: string; studentProfileId: string; note: string | null },
) {
  const drive = await getDriveForEligibility(input.driveId);
  if (drive.companyId !== context.companyId) {
    throw new AppError("FORBIDDEN", "You can only shortlist candidates for your company's drives.", 403);
  }
  const student = await getStudentForEligibility(input.studentProfileId);
  if (!student.user || !student.isVerified) {
    throw new AppError("STUDENT_NOT_VERIFIED", "Only verified students can be shortlisted.", 403);
  }
  if (drive.status !== "ACTIVE" || drive.deadline.getTime() <= Date.now()) {
    throw new AppError("DRIVE_NOT_OPEN", "This drive is not accepting candidates.", 409);
  }
  const existing = await prisma.application.findUnique({
    where: {
      studentProfileId_driveId: {
        studentProfileId: input.studentProfileId,
        driveId: input.driveId,
      },
    },
  });
  if (existing && ["REJECTED", "SHORTLISTED", "IN_PROCESS", "OFFERED"].includes(existing.status)) {
    throw new AppError(
      "APPLICATION_STATE_INVALID",
      existing.status === "REJECTED"
        ? "A rejected application cannot be shortlisted again."
        : "This candidate is already shortlisted or in process.",
      409,
    );
  }

  const [policy, override] = await Promise.all([
    getPlacementPolicy(),
    getActiveOverride(input.studentProfileId, input.driveId),
  ]);
  const evaluatedAt = new Date();
  const result = evaluateMapped(student, drive, policy, null, evaluatedAt);
  const overrideApplied = Boolean(override) && !result.eligible;
  if (!result.eligible && !overrideApplied) {
    const reasons = result.reasons.map((reason) => reason.message).join(" ");
    throw new AppError("NOT_ELIGIBLE", reasons || "This candidate is not eligible for the drive.", 403);
  }
  const snapshot = serializeEligibilitySnapshot(
    result,
    evaluatedAt,
    override ? { reason: override.reason, applied: overrideApplied } : null,
  );

  const application = await prisma.$transaction(async (tx) => {
    if (existing) {
      return tx.application.update({
        where: { id: existing.id },
        data: {
          status: "SHORTLISTED",
          source: existing.status === "WITHDRAWN" ? "RECRUITER" : existing.source,
          eligibilitySnapshot: snapshot,
          matchScore: result.matchScore,
          isDreamOffer: result.isDreamOffer,
          eligibilityOverridden: overrideApplied,
          statusUpdatedAt: evaluatedAt,
          ...(input.note ? { recruiterFeedback: input.note } : {}),
          ...(existing.status === "WITHDRAWN"
            ? {
                appliedAt: evaluatedAt,
                withdrawnAt: null,
                rejectionReason: null,
                recruiterFeedback: input.note,
              }
            : {}),
        },
      });
    }
    return tx.application.create({
      data: {
        studentProfileId: input.studentProfileId,
        driveId: drive.id,
        status: "SHORTLISTED",
        source: "RECRUITER",
        recruiterFeedback: input.note,
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
    actorId: context.userId,
    action: "CANDIDATE_SHORTLISTED",
    entityType: "Application",
    entityId: application.id,
    after: {
      driveId: drive.id,
      studentProfileId: input.studentProfileId,
      matchScore: result.matchScore,
      overrideApplied,
    },
  });
  await notifyUser({
    userId: student.user.id,
    type: "APPLICATION_STATUS",
    title: `Shortlisted: ${drive.title}`,
    body: `${drive.company.name} shortlisted you. Check your application for next steps.`,
    link: `/student/applications/${application.id}`,
    dedupeKey: `candidate-shortlisted:${application.id}:${application.statusUpdatedAt.getTime()}`,
  });
  publishToUser(student.user.id, "application.updated", {
    applicationId: application.id,
    status: "SHORTLISTED",
  });
  publishToRole("PLACEMENT_OFFICER", "drive.pipeline.updated", { driveId: drive.id });
  return application;
}

export async function updateRecruiterFeedback(
  context: RecruiterContext,
  input: { applicationId: string; feedback: string | null },
) {
  const application = await prisma.application.findUnique({
    where: { id: input.applicationId },
    include: {
      drive: { include: { company: true } },
      studentProfile: { include: { user: { select: { id: true } } } },
    },
  });
  if (!application || application.drive.companyId !== context.companyId) {
    throw new AppError("APPLICATION_NOT_FOUND", "Application not found.", 404);
  }
  if (application.drive.status !== "ACTIVE") {
    throw new AppError("DRIVE_STATE_INVALID", "This drive is no longer accepting updates.", 409);
  }
  const updated = await prisma.application.update({
    where: { id: application.id },
    data: { recruiterFeedback: input.feedback },
  });
  await audit({
    actorId: context.userId,
    action: "RECRUITER_FEEDBACK_UPDATED",
    entityType: "Application",
    entityId: application.id,
    before: { feedback: application.recruiterFeedback },
    after: { feedback: updated.recruiterFeedback },
  });
  if (input.feedback) {
    await notifyUser({
      userId: application.studentProfile.user.id,
      type: "APPLICATION_STATUS",
      title: `Feedback from ${application.drive.company.name}`,
      body: input.feedback,
      link: `/student/applications/${application.id}`,
      dedupeKey: `recruiter-feedback:${application.id}:${updated.updatedAt.getTime()}`,
    });
    publishToUser(application.studentProfile.user.id, "application.updated", {
      applicationId: application.id,
      status: application.status,
    });
  }
  return updated;
}

export async function rejectRecruiterApplication(
  context: RecruiterContext,
  input: { applicationId: string; reason: string },
) {
  const application = await prisma.application.findUnique({
    where: { id: input.applicationId },
    include: { drive: true, offer: true, studentProfile: { select: { userId: true } } },
  });
  if (!application || application.drive.companyId !== context.companyId) {
    throw new AppError("APPLICATION_NOT_FOUND", "Application not found.", 404);
  }
  if (application.drive.status !== "ACTIVE") {
    throw new AppError("DRIVE_STATE_INVALID", "This drive is no longer accepting updates.", 409);
  }
  if (application.offer) {
    throw new AppError("APPLICATION_HAS_OFFER", "The placement office must revoke the offer first.", 409);
  }
  if (!["APPLIED", "SHORTLISTED", "IN_PROCESS"].includes(application.status)) {
    throw new AppError("APPLICATION_STATE_INVALID", "This application cannot be rejected now.", 409);
  }
  return prisma.application.update({
    where: { id: application.id },
    data: {
      status: "REJECTED",
      statusUpdatedAt: new Date(),
      rejectionReason: input.reason,
    },
  }).then(async (updated) => {
    await audit({
      actorId: context.userId,
      action: "APPLICATION_REJECTED",
      entityType: "Application",
      entityId: application.id,
      before: { status: application.status },
      after: { status: updated.status },
      metadata: { reason: input.reason, driveId: application.driveId },
    });
    await notifyUser({
      userId: application.studentProfile.userId,
      type: "APPLICATION_STATUS",
      title: `Application update: ${application.drive.title}`,
      body: input.reason,
      link: `/student/applications/${application.id}`,
      dedupeKey: `recruiter-rejected:${application.id}:${updated.updatedAt.getTime()}`,
    });
    publishToUser(application.studentProfile.userId, "application.updated", {
      applicationId: application.id,
      status: "REJECTED",
    });
    publishToRole("PLACEMENT_OFFICER", "drive.pipeline.updated", { driveId: application.driveId });
    return updated;
  });
}

export async function recordRecruiterRoundResult(
  context: RecruiterContext,
  input: RoundResultInput,
) {
  const application = await prisma.application.findUnique({
    where: { id: input.applicationId },
    include: { drive: true },
  });
  if (!application || application.drive.companyId !== context.companyId) {
    throw new AppError("APPLICATION_NOT_FOUND", "Application not found.", 404);
  }
  if (application.drive.status !== "ACTIVE") {
    throw new AppError("DRIVE_STATE_INVALID", "This drive is no longer accepting updates.", 409);
  }
  if (!["SHORTLISTED", "IN_PROCESS"].includes(application.status)) {
    throw new AppError("APPLICATION_STATE_INVALID", "Shortlist this candidate before recording results.", 409);
  }
  const result = await recordRoundResult({ ...input, officerId: context.userId });
  return { result, driveId: application.driveId };
}
