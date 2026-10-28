import type { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/server/db";
import { AppError } from "@/server/errors";
import type { Role } from "@/lib/constants";

export const userInclude = {
  studentProfile: true,
  recruiterProfile: { include: { company: true } },
} satisfies Prisma.UserInclude;

export type SessionUser = Prisma.UserGetPayload<{ include: typeof userInclude }>;

export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: userInclude,
  });
  if (!user || !user.isActive) return null;
  if ((session.user.sessionVersion ?? 0) !== user.sessionVersion) return null;
  return user;
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new AppError("UNAUTHENTICATED", "Please sign in to continue.", 401);
  if (user.mustChangePassword) {
    throw new AppError("PASSWORD_CHANGE_REQUIRED", "Change your temporary password first.", 403);
  }
  return user;
}

export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.role as Role)) {
    throw new AppError("FORBIDDEN", "You do not have permission to perform this action.", 403);
  }
  return user;
}

export async function requireStudent() {
  const user = await requireRole("STUDENT");
  if (!user.studentProfile) throw new AppError("PROFILE_MISSING", "Student profile is missing.", 404);
  return { user, profile: user.studentProfile };
}

export async function requireOfficer() {
  return requireRole("PLACEMENT_OFFICER");
}

export async function requireRecruiter() {
  const user = await requireRole("RECRUITER");
  if (!user.recruiterProfile) {
    throw new AppError("PROFILE_MISSING", "Recruiter profile is missing.", 404);
  }
  if (!user.recruiterProfile.company.isActive) {
    throw new AppError("COMPANY_INACTIVE", "This company account is inactive.", 403);
  }
  return { user, recruiter: user.recruiterProfile, company: user.recruiterProfile.company };
}

export function assertOfficerOrOwner(user: SessionUser, ownerId: string) {
  if (user.role !== "PLACEMENT_OFFICER" && user.id !== ownerId) {
    throw new AppError("FORBIDDEN", "You do not have access to this resource.", 403);
  }
}
