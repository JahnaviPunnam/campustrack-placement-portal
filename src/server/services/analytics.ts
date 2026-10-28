import { prisma } from "@/server/db";
import { BRANCHES } from "@/lib/constants";

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
    : (sorted[middle] ?? 0);
}

function average(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function bestOffers<T extends { studentProfileId: string; package: number }>(offers: T[]): T[] {
  const best = new Map<string, T>();
  for (const offer of offers) {
    const current = best.get(offer.studentProfileId);
    if (!current || offer.package > current.package) best.set(offer.studentProfileId, offer);
  }
  return Array.from(best.values());
}

const acceptedOfferInclude = {
  studentProfile: { select: { branch: true, graduationYear: true, rollNumber: true, user: { select: { name: true } } } },
  application: { include: { drive: { include: { company: true } } } },
} as const;

export async function getOfficerDashboard() {
  const now = new Date();
  const [
    totalStudents,
    verifiedStudents,
    activeDrives,
    pendingApprovals,
    pendingVerification,
    acceptedOffers,
    statusCounts,
    branchCounts,
    recentDrives,
  ] = await Promise.all([
    prisma.studentProfile.count(),
    prisma.studentProfile.count({ where: { isVerified: true } }),
    prisma.drive.count({ where: { status: "ACTIVE", deadline: { gt: now } } }),
    prisma.drive.count({ where: { status: "PENDING_APPROVAL" } }),
    prisma.studentProfile.findMany({
      where: { isVerified: false },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { updatedAt: "desc" },
      take: 6,
    }),
    prisma.offer.findMany({
      where: { status: "ACCEPTED" },
      include: acceptedOfferInclude,
      orderBy: { offerDate: "desc" },
    }),
    prisma.application.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.studentProfile.groupBy({ by: ["branch"], _count: { _all: true } }),
    prisma.drive.findMany({
      where: { status: { in: ["ACTIVE", "PENDING_APPROVAL", "CLOSED", "COMPLETED"] } },
      include: {
        company: true,
        _count: { select: { applications: true, overrides: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
  ]);

  const best = bestOffers(acceptedOffers);
  const packages = best.map((offer) => offer.package).sort((a, b) => a - b);
  const placedStudentIds = new Set(best.map((offer) => offer.studentProfileId));
  const placedByBranch = new Map<string, number>();
  for (const offer of best) {
    placedByBranch.set(
      offer.studentProfile.branch,
      (placedByBranch.get(offer.studentProfile.branch) ?? 0) + 1,
    );
  }

  const branchPlacement = BRANCHES.map((branch) => {
    const total = branchCounts.find((entry) => entry.branch === branch)?._count._all ?? 0;
    const placed = placedByBranch.get(branch) ?? 0;
    return {
      branch,
      total,
      placed,
      rate: total ? Math.round((placed / total) * 1000) / 10 : 0,
    };
  }).filter((entry) => entry.total > 0);

  const companyMap = new Map<string, { company: string; offers: number; packages: number[] }>();
  for (const offer of acceptedOffers) {
    const company = offer.application.drive.company.name;
    const entry = companyMap.get(company) ?? { company, offers: 0, packages: [] };
    entry.offers += 1;
    entry.packages.push(offer.package);
    companyMap.set(company, entry);
  }
  const companyOffers = Array.from(companyMap.values())
    .map((entry) => ({
      company: entry.company,
      offers: entry.offers,
      averagePackage: Math.round(average(entry.packages) * 10) / 10,
    }))
    .sort((a, b) => b.offers - a.offers)
    .slice(0, 8);

  return {
    metrics: {
      totalStudents,
      verifiedStudents,
      verificationRate: totalStudents ? Math.round((verifiedStudents / totalStudents) * 1000) / 10 : 0,
      activeDrives,
      pendingApprovals,
      placedStudents: placedStudentIds.size,
      placementRate: totalStudents ? Math.round((placedStudentIds.size / totalStudents) * 1000) / 10 : 0,
      totalOffers: acceptedOffers.length,
      averagePackage: average(packages),
      medianPackage: median(packages),
      highestPackage: packages.length ? Math.max(...packages) : 0,
    },
    statusCounts: statusCounts.map((entry) => ({
      status: entry.status,
      count: entry._count._all,
    })),
    branchPlacement,
    companyOffers,
    recentDrives,
    pendingVerification,
  };
}

export async function getReportFilters() {
  const [years, companies, drives] = await Promise.all([
    prisma.studentProfile.findMany({
      distinct: ["graduationYear"],
      select: { graduationYear: true },
      orderBy: { graduationYear: "desc" },
    }),
    prisma.company.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.drive.findMany({
      where: { status: { in: ["ACTIVE", "CLOSED", "COMPLETED"] } },
      select: { id: true, title: true, company: { select: { name: true } } },
      orderBy: [{ deadline: "desc" }, { title: "asc" }],
    }),
  ]);
  return {
    years: years.map((entry) => entry.graduationYear),
    branches: BRANCHES,
    companies,
    drives,
  };
}

export type ReportFilters = {
  graduationYear?: number;
  branch?: string;
  companyId?: string;
};

export async function getPlacementReport(filters: ReportFilters) {
  const studentWhere = {
    ...(filters.graduationYear ? { graduationYear: filters.graduationYear } : {}),
    ...(filters.branch ? { branch: filters.branch } : {}),
  };
  const [students, acceptedOffers, statusCounts, filterOptions] = await Promise.all([
    prisma.studentProfile.findMany({
      where: studentWhere,
      select: { id: true, branch: true, graduationYear: true },
    }),
    prisma.offer.findMany({
      where: {
        status: "ACCEPTED",
        studentProfile: studentWhere,
        ...(filters.companyId
          ? { application: { drive: { companyId: filters.companyId } } }
          : {}),
      },
      include: acceptedOfferInclude,
      orderBy: { offerDate: "desc" },
    }),
    prisma.application.groupBy({
      by: ["status"],
      where: { studentProfile: studentWhere },
      _count: { _all: true },
    }),
    getReportFilters(),
  ]);

  const studentIds = new Set(students.map((student) => student.id));
  const eligibleOffers = acceptedOffers.filter((offer) => studentIds.has(offer.studentProfileId));
  const best = bestOffers(eligibleOffers);
  const packages = best.map((offer) => offer.package);
  const branchTotals = new Map<string, number>();
  for (const student of students) {
    branchTotals.set(student.branch, (branchTotals.get(student.branch) ?? 0) + 1);
  }
  const branchPlaced = new Map<string, number>();
  for (const offer of best) {
    branchPlaced.set(offer.studentProfile.branch, (branchPlaced.get(offer.studentProfile.branch) ?? 0) + 1);
  }

  const companyMap = new Map<string, { companyId: string; company: string; offers: number; packages: number[] }>();
  for (const offer of eligibleOffers) {
    const company = offer.application.drive.company;
    const entry = companyMap.get(company.id) ?? {
      companyId: company.id,
      company: company.name,
      offers: 0,
      packages: [],
    };
    entry.offers += 1;
    entry.packages.push(offer.package);
    companyMap.set(company.id, entry);
  }

  const months: { key: string; label: string; offers: number }[] = [];
  const now = new Date();
  for (let offset = 5; offset >= 0; offset -= 1) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1));
    months.push({
      key: `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`,
      label: new Intl.DateTimeFormat("en-IN", { month: "short" }).format(date),
      offers: 0,
    });
  }
  for (const offer of eligibleOffers) {
    const key = `${offer.offerDate.getUTCFullYear()}-${String(offer.offerDate.getUTCMonth() + 1).padStart(2, "0")}`;
    const month = months.find((entry) => entry.key === key);
    if (month) month.offers += 1;
  }

  const rows = eligibleOffers.map((offer) => ({
    studentName: offer.studentProfile.user.name,
    rollNumber: offer.studentProfile.rollNumber,
    branch: offer.studentProfile.branch,
    graduationYear: offer.studentProfile.graduationYear,
    company: offer.application.drive.company.name,
    roleTitle: offer.roleTitle,
    package: offer.package,
    tier: offer.tier,
    offerDate: offer.offerDate,
    offerStatus: offer.status,
  }));

  return {
    filters,
    filterOptions,
    rows,
    totals: {
      students: students.length,
      placed: best.length,
      offers: eligibleOffers.length,
      placementRate: students.length ? Math.round((best.length / students.length) * 1000) / 10 : 0,
      averagePackage: average(packages),
      medianPackage: median(packages),
      highestPackage: packages.length ? Math.max(...packages) : 0,
    },
    branchStats: Array.from(branchTotals.entries())
      .map(([branch, total]) => {
        const placed = branchPlaced.get(branch) ?? 0;
        return {
          branch,
          total,
          placed,
          rate: total ? Math.round((placed / total) * 1000) / 10 : 0,
        };
      })
      .sort((a, b) => a.branch.localeCompare(b.branch)),
    companyStats: Array.from(companyMap.values())
      .map((entry) => ({
        companyId: entry.companyId,
        company: entry.company,
        offers: entry.offers,
        averagePackage: Math.round(average(entry.packages) * 10) / 10,
      }))
      .sort((a, b) => b.offers - a.offers),
    statusCounts: statusCounts.map((entry) => ({ status: entry.status, count: entry._count._all })),
    monthlyTrend: months,
  };
}


export type AnalyticsFilters = ReportFilters & { driveId?: string };

export type SkillDemandRow = {
  skillId: string;
  name: string;
  category: string;
  supply: number;
  demand: number;
  coverage: number | null;
};

export async function getSkillDemandAnalytics(filters: AnalyticsFilters = {}) {
  const studentWhere = {
    user: { isActive: true },
    ...(filters.branch ? { branch: filters.branch } : {}),
    ...(filters.graduationYear ? { graduationYear: filters.graduationYear } : {}),
  };
  const demandWhere = {
    drive: {
      ...(filters.driveId ? { id: filters.driveId } : {}),
      ...(filters.companyId ? { companyId: filters.companyId } : {}),
      ...(filters.driveId ? {} : { status: { in: ["ACTIVE", "CLOSED", "COMPLETED"] } }),
    },
  };
  const [supplyCounts, demandCounts, skills] = await Promise.all([
    prisma.studentSkill.groupBy({
      by: ["skillId"],
      where: { studentProfile: studentWhere, skill: { isActive: true } },
      _count: { _all: true },
    }),
    prisma.driveRequiredSkill.groupBy({
      by: ["skillId"],
      where: { ...demandWhere, skill: { isActive: true } },
      _count: { _all: true },
      _sum: { weight: true },
    }),
    prisma.skill.findMany({
      where: { isActive: true },
      select: { id: true, name: true, category: true },
    }),
  ]);

  const supplyMap = new Map(supplyCounts.map((entry) => [entry.skillId, entry._count._all]));
  const demandMap = new Map(demandCounts.map((entry) => [entry.skillId, entry._count._all]));
  const rows: SkillDemandRow[] = skills
    .map((skill) => {
      const supply = supplyMap.get(skill.id) ?? 0;
      const demand = demandMap.get(skill.id) ?? 0;
      return {
        skillId: skill.id,
        name: skill.name,
        category: skill.category,
        supply,
        demand,
        coverage: demand > 0 ? Math.round((supply / demand) * 100) / 100 : null,
      };
    })
    .filter((row) => row.supply > 0 || row.demand > 0)
    .sort((a, b) => b.demand - a.demand || b.supply - a.supply || a.name.localeCompare(b.name));

  const topDemand = rows.filter((row) => row.demand > 0).slice(0, 10);
  return {
    rows,
    heatmap: rows.slice(0, 24),
    topDemand,
    maxSupply: rows.reduce((max, row) => Math.max(max, row.supply), 0),
    maxDemand: rows.reduce((max, row) => Math.max(max, row.demand), 0),
    supplyClaims: rows.reduce((sum, row) => sum + row.supply, 0),
    demandRequirements: rows.reduce((sum, row) => sum + row.demand, 0),
  };
}

export type FunnelStage = { key: string; label: string; count: number };

export type DriveFunnel = {
  driveId: string;
  title: string;
  company: string;
  package: number;
  tier: number;
  stages: FunnelStage[];
  rounds: { id: string; name: string; order: number }[];
  applied: number;
  shortlisted: number;
  offered: number;
};

export async function getDriveFunnels(filters: AnalyticsFilters = {}) {
  const companyId = filters.companyId;
  const drives = await prisma.drive.findMany({
    where: {
      ...(filters.driveId
        ? { id: filters.driveId }
        : { status: { in: ["ACTIVE", "CLOSED", "COMPLETED"] } }),
      ...(companyId ? { companyId } : {}),
    },
    include: {
      company: { select: { name: true } },
      rounds: { orderBy: { order: "asc" }, select: { id: true, name: true, order: true } },
      applications: {
        where: {
          ...(filters.branch || filters.graduationYear
            ? {
                studentProfile: {
                  ...(filters.branch ? { branch: filters.branch } : {}),
                  ...(filters.graduationYear ? { graduationYear: filters.graduationYear } : {}),
                },
              }
            : {}),
        },
        select: {
          id: true,
          status: true,
          currentRoundId: true,
          roundResults: { select: { roundId: true } },
          offer: { select: { id: true } },
        },
      },
    },
    orderBy: [{ deadline: "desc" }, { title: "asc" }],
  });

  return drives.map((drive) => {
    const roundOrder = new Map(drive.rounds.map((round) => [round.id, round.order]));
    const applied = drive.applications.length;
    const shortlisted = drive.applications.filter(
      (application) =>
        ["SHORTLISTED", "IN_PROCESS", "OFFERED"].includes(application.status) ||
        application.roundResults.length > 0 ||
        application.currentRoundId !== null,
    ).length;
    const stages: FunnelStage[] = [
      { key: "APPLIED", label: "Applied", count: applied },
      { key: "SHORTLISTED", label: "Shortlisted", count: shortlisted },
    ];
    for (const round of drive.rounds) {
      const reached = drive.applications.filter((application) => {
        if (application.roundResults.some((result) => result.roundId === round.id)) return true;
        const currentOrder = application.currentRoundId
          ? (roundOrder.get(application.currentRoundId) ?? 0)
          : 0;
        return currentOrder >= round.order;
      }).length;
      stages.push({ key: `ROUND_${round.id}`, label: `R${round.order} ${round.name}`, count: reached });
    }
    const offered = drive.applications.filter(
      (application) => application.status === "OFFERED" || application.offer !== null,
    ).length;
    stages.push({ key: "OFFERED", label: "Offered", count: offered });
    return {
      driveId: drive.id,
      title: drive.title,
      company: drive.company.name,
      package: drive.package,
      tier: drive.tier,
      stages,
      rounds: drive.rounds,
      applied,
      shortlisted,
      offered,
    } satisfies DriveFunnel;
  });
}
