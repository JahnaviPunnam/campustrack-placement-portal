import { prisma } from "@/server/db";
import { audit } from "@/server/audit";
import { AppError } from "@/server/errors";
import { generateTemporaryPassword, hashPassword } from "@/server/auth/password";
import type { PolicyUpdateInput, RecruiterCreateInput } from "@/lib/validation/officer";

export type CompanyListFilters = { q?: string; active?: boolean };

export async function listCompanies(filters: CompanyListFilters = {}) {
  return prisma.company.findMany({
    where: {
      ...(filters.q
        ? {
            OR: [
              { name: { contains: filters.q } },
              { industry: { contains: filters.q } },
              { location: { contains: filters.q } },
            ],
          }
        : {}),
      ...(filters.active !== undefined ? { isActive: filters.active } : {}),
    },
    include: {
      _count: { select: { recruiters: true, drives: true } },
    },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });
}

export async function getCompanyDetail(companyId: string) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: {
      createdBy: { select: { name: true } },
      recruiters: {
        include: { user: { select: { id: true, name: true, email: true, isActive: true, lastLoginAt: true, mustChangePassword: true } } },
        orderBy: { createdAt: "asc" },
      },
      drives: {
        select: { id: true, title: true, status: true, deadline: true, tier: true },
        orderBy: { createdAt: "desc" },
        take: 8,
      },
      _count: { select: { recruiters: true, drives: true } },
    },
  });
  if (!company) throw new AppError("COMPANY_NOT_FOUND", "Company not found.", 404);
  return company;
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || "company";
}

async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name);
  let candidate = base;
  let suffix = 2;
  while (await prisma.company.findUnique({ where: { slug: candidate }, select: { id: true } })) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

type CompanyInput = {
  name: string;
  industry: string;
  location: string | null;
  website: string | null;
  tier: number;
  description: string | null;
};

export async function createCompany(input: CompanyInput, officerId: string) {
  const existing = await prisma.company.findUnique({ where: { name: input.name }, select: { id: true } });
  if (existing) throw new AppError("COMPANY_EXISTS", "A company with this name already exists.", 409);
  const company = await prisma.company.create({
    data: {
      ...input,
      slug: await uniqueSlug(input.name),
      createdById: officerId,
    },
  });
  await audit({
    actorId: officerId,
    action: "COMPANY_CREATED",
    entityType: "Company",
    entityId: company.id,
    after: { name: company.name, industry: company.industry, tier: company.tier },
  });
  return company;
}

export async function updateCompany(input: CompanyInput & { companyId: string }, officerId: string) {
  const company = await prisma.company.findUnique({ where: { id: input.companyId } });
  if (!company) throw new AppError("COMPANY_NOT_FOUND", "Company not found.", 404);
  const duplicate = await prisma.company.findFirst({
    where: { name: input.name, id: { not: company.id } },
    select: { id: true },
  });
  if (duplicate) throw new AppError("COMPANY_EXISTS", "A company with this name already exists.", 409);
  const updated = await prisma.company.update({
    where: { id: company.id },
    data: {
      name: input.name,
      industry: input.industry,
      location: input.location,
      website: input.website,
      tier: input.tier,
      description: input.description,
    },
  });
  await audit({
    actorId: officerId,
    action: "COMPANY_UPDATED",
    entityType: "Company",
    entityId: company.id,
    before: { name: company.name, industry: company.industry, tier: company.tier },
    after: { name: updated.name, industry: updated.industry, tier: updated.tier },
  });
  return updated;
}

export async function setCompanyActive(companyId: string, isActive: boolean, officerId: string) {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) throw new AppError("COMPANY_NOT_FOUND", "Company not found.", 404);
  const { updated, sessionsRevoked } = await prisma.$transaction(async (tx) => {
    const saved = await tx.company.update({ where: { id: company.id }, data: { isActive } });
    if (isActive) return { updated: saved, sessionsRevoked: 0 };
    const recruiters = await tx.user.findMany({
      where: { recruiterProfile: { companyId: company.id } },
      select: { id: true },
    });
    if (recruiters.length === 0) return { updated: saved, sessionsRevoked: 0 };
    const result = await tx.user.updateMany({
      where: { id: { in: recruiters.map((recruiter) => recruiter.id) } },
      data: { sessionVersion: { increment: 1 } },
    });
    return { updated: saved, sessionsRevoked: result.count };
  });
  await audit({
    actorId: officerId,
    action: isActive ? "COMPANY_ACTIVATED" : "COMPANY_DEACTIVATED",
    entityType: "Company",
    entityId: company.id,
    before: { isActive: company.isActive },
    after: { isActive },
    metadata: { recruiterSessionsRevoked: sessionsRevoked },
  });
  return updated;
}

export async function createRecruiter(input: RecruiterCreateInput, officerId: string) {
  const company = await prisma.company.findUnique({ where: { id: input.companyId } });
  if (!company) throw new AppError("COMPANY_NOT_FOUND", "Company not found.", 404);
  if (!company.isActive) throw new AppError("COMPANY_INACTIVE", "Activate the company first.", 400);
  const existing = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
  if (existing) throw new AppError("EMAIL_IN_USE", "An account with this email already exists.", 409);
  const password = generateTemporaryPassword();
  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash,
      role: "RECRUITER",
      mustChangePassword: true,
      recruiterProfile: {
        create: {
          companyId: company.id,
          designation: input.designation,
          phone: input.phone,
        },
      },
    },
    include: { recruiterProfile: true },
  });
  await audit({
    actorId: officerId,
    action: "RECRUITER_CREATED",
    entityType: "User",
    entityId: user.id,
    metadata: { companyId: company.id, email: user.email },
  });
  return { password, email: user.email, recruiterProfileId: user.recruiterProfile!.id };
}

export async function resetRecruiterPassword(recruiterProfileId: string, officerId: string) {
  const recruiter = await prisma.recruiterProfile.findUnique({
    where: { id: recruiterProfileId },
    include: { user: true, company: true },
  });
  if (!recruiter) throw new AppError("RECRUITER_NOT_FOUND", "Recruiter not found.", 404);
  const password = generateTemporaryPassword();
  await prisma.user.update({
    where: { id: recruiter.userId },
    data: {
      passwordHash: await hashPassword(password),
      mustChangePassword: true,
      sessionVersion: { increment: 1 },
    },
  });
  await audit({
    actorId: officerId,
    action: "RECRUITER_PASSWORD_RESET",
    entityType: "User",
    entityId: recruiter.userId,
    metadata: { companyId: recruiter.companyId },
  });
  return { email: recruiter.user.email, password };
}

export async function setRecruiterActive(
  recruiterProfileId: string,
  isActive: boolean,
  officerId: string,
) {
  const recruiter = await prisma.recruiterProfile.findUnique({
    where: { id: recruiterProfileId },
    include: { user: true },
  });
  if (!recruiter) throw new AppError("RECRUITER_NOT_FOUND", "Recruiter not found.", 404);
  await prisma.user.update({
    where: { id: recruiter.userId },
    data: {
      isActive,
      sessionVersion: isActive ? undefined : { increment: 1 },
    },
  });
  await audit({
    actorId: officerId,
    action: isActive ? "RECRUITER_ACTIVATED" : "RECRUITER_DEACTIVATED",
    entityType: "User",
    entityId: recruiter.userId,
    metadata: { companyId: recruiter.companyId },
  });
}

export async function getPlacementPolicy() {
  const policy = await prisma.placementPolicy.findFirst({ orderBy: { updatedAt: "desc" } });
  if (!policy) throw new AppError("POLICY_MISSING", "Placement policy is not configured.", 500);
  return policy;
}

export async function updatePlacementPolicy(input: PolicyUpdateInput, officerId: string) {
  const current = await getPlacementPolicy();
  const updated = await prisma.placementPolicy.update({
    where: { id: current.id },
    data: {
      maxOffersPerStudent: input.maxOffersPerStudent,
      blockedPlacedTiers: input.blockedPlacedTiers,
      dreamOfferEnabled: input.dreamOfferEnabled,
      minimumDreamOfferIncrease: input.minimumDreamOfferIncrease,
      requireVerifiedProfileDefault: input.requireVerifiedProfileDefault,
      updatedById: officerId,
    },
  });
  await audit({
    actorId: officerId,
    action: "POLICY_UPDATED",
    entityType: "PlacementPolicy",
    entityId: current.id,
    before: {
      maxOffersPerStudent: current.maxOffersPerStudent,
      blockedPlacedTiers: current.blockedPlacedTiers,
      dreamOfferEnabled: current.dreamOfferEnabled,
      minimumDreamOfferIncrease: current.minimumDreamOfferIncrease,
      requireVerifiedProfileDefault: current.requireVerifiedProfileDefault,
    },
    after: {
      maxOffersPerStudent: updated.maxOffersPerStudent,
      blockedPlacedTiers: updated.blockedPlacedTiers,
      dreamOfferEnabled: updated.dreamOfferEnabled,
      minimumDreamOfferIncrease: updated.minimumDreamOfferIncrease,
      requireVerifiedProfileDefault: updated.requireVerifiedProfileDefault,
    },
  });
  return updated;
}
