import { prisma } from "@/server/db";
import { AppError } from "@/server/errors";
import { evaluateDriveStudents } from "@/server/services/eligibility";

export type EligibleListRow = {
  rollNumber: string;
  name: string;
  email: string;
  branch: string;
  graduationYear: number;
  cgpa: number | null;
  backlogs: number;
  matchScore: number;
  applicationStatus: string | null;
  overrideReason: string | null;
};

export type ShortlistListRow = {
  rollNumber: string;
  name: string;
  email: string;
  branch: string;
  graduationYear: number;
  cgpa: number | null;
  status: string;
  stage: string;
  roundStatus: string | null;
  roundScore: number | null;
  offerPackage: number | null;
  offerStatus: string | null;
  appliedAt: Date;
};

export async function getEligibleList(driveId: string) {
  const review = await evaluateDriveStudents(driveId);
  const rows: EligibleListRow[] = review.evaluations
    .filter((entry) => entry.result.eligible || entry.override)
    .map((entry) => ({
      rollNumber: entry.student.rollNumber,
      name: entry.student.user.name,
      email: entry.student.user.email,
      branch: entry.student.branch,
      graduationYear: entry.student.graduationYear,
      cgpa: entry.student.cgpa,
      backlogs: entry.student.backlogs,
      matchScore: entry.result.matchScore,
      applicationStatus: entry.applicationStatus,
      overrideReason: entry.override?.reason ?? null,
    }))
    .sort((a, b) => b.matchScore - a.matchScore || a.rollNumber.localeCompare(b.rollNumber));

  return {
    drive: {
      id: review.drive.id,
      title: review.drive.title,
      roleTitle: review.drive.roleTitle,
      company: review.drive.company.name,
      package: review.drive.package,
      tier: review.drive.tier,
      status: review.drive.status,
    },
    rows,
  };
}

export async function getShortlistList(input: {
  driveId: string;
  roundId?: string;
  companyId?: string | null;
}) {
  const drive = await prisma.drive.findUnique({
    where: { id: input.driveId },
    include: {
      company: { select: { id: true, name: true } },
      rounds: { orderBy: { order: "asc" }, select: { id: true, name: true, order: true } },
    },
  });
  if (!drive) throw new AppError("DRIVE_NOT_FOUND", "Drive not found.", 404);
  if (input.companyId && drive.companyId !== input.companyId) {
    throw new AppError("FORBIDDEN", "You can only export shortlists for your company's drives.", 403);
  }

  const round = input.roundId
    ? drive.rounds.find((entry) => entry.id === input.roundId) ?? null
    : null;
  if (input.roundId && !round) {
    throw new AppError("ROUND_NOT_FOUND", "Round not found for this drive.", 404);
  }

  const applications = await prisma.application.findMany({
    where: {
      driveId: drive.id,
      ...(round
        ? {
            OR: [
              { roundResults: { some: { roundId: round.id } } },
              { currentRound: { order: { gte: round.order } } },
            ],
          }
        : {
            OR: [
              { status: { in: ["SHORTLISTED", "IN_PROCESS", "OFFERED"] } },
              { roundResults: { some: {} } },
              { currentRoundId: { not: null } },
            ],
          }),
    },
    include: {
      studentProfile: {
        select: {
          rollNumber: true,
          branch: true,
          graduationYear: true,
          cgpa: true,
          user: { select: { name: true, email: true } },
        },
      },
      currentRound: { select: { name: true, order: true } },
      offer: { select: { package: true, status: true } },
      roundResults: { select: { roundId: true, status: true, score: true } },
    },
    orderBy: { appliedAt: "asc" },
  });

  const rows: ShortlistListRow[] = applications
    .map((application) => {
      const result = round
        ? application.roundResults.find((entry) => entry.roundId === round.id) ?? null
        : null;
      return {
        rollNumber: application.studentProfile.rollNumber,
        name: application.studentProfile.user.name,
        email: application.studentProfile.user.email,
        branch: application.studentProfile.branch,
        graduationYear: application.studentProfile.graduationYear,
        cgpa: application.studentProfile.cgpa,
        status: application.status,
        stage: application.currentRound?.name ?? round?.name ?? "Shortlisted",
        roundStatus: result?.status ?? null,
        roundScore: result?.score ?? null,
        offerPackage: application.offer?.package ?? null,
        offerStatus: application.offer?.status ?? null,
        appliedAt: application.appliedAt,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name) || a.rollNumber.localeCompare(b.rollNumber));

  return {
    drive: {
      id: drive.id,
      title: drive.title,
      roleTitle: drive.roleTitle,
      company: drive.company.name,
      package: drive.package,
      tier: drive.tier,
      status: drive.status,
    },
    round,
    rows,
  };
}
