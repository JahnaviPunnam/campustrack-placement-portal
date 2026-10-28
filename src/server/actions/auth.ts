"use server";

import { headers } from "next/headers";
import { actionError, actionOk, type ActionResult } from "@/lib/action-result";
import { changePasswordSchema, registerSchema } from "@/lib/validation/auth";
import { prisma } from "@/server/db";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { getCurrentUser } from "@/server/auth/guards";
import { AppError } from "@/server/errors";
import { clientKeyFromHeaders, rateLimit } from "@/server/auth/rate-limit";
import { getEnv } from "@/lib/env";
import { audit } from "@/server/audit";
import { signOut } from "@/auth";

export async function registerStudentAction(
  input: unknown,
): Promise<ActionResult<{ userId: string }>> {
  try {
    const parsed = registerSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Please fix the highlighted fields.",
          fieldErrors: parsed.error.flatten().fieldErrors,
        },
      };
    }
    const env = getEnv();
    const headerList = headers();
    const limited = rateLimit(
      clientKeyFromHeaders(headerList, "register-ip"),
      10,
      env.AUTH_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
    );
    if (!limited.allowed) {
      throw new AppError("RATE_LIMITED", "Too many registration attempts. Try again later.", 429);
    }

    const data = parsed.data;
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new AppError("EMAIL_TAKEN", "An account with this email already exists.", 409);
    const existingRoll = await prisma.studentProfile.findUnique({
      where: { rollNumber: data.rollNumber },
    });
    if (existingRoll) {
      throw new AppError("ROLL_TAKEN", "This roll number is already registered.", 409);
    }

    const passwordHash = await hashPassword(data.password);
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          name: data.name,
          email: data.email,
          passwordHash,
          role: "STUDENT",
          studentProfile: {
            create: {
              rollNumber: data.rollNumber,
              branch: data.branch,
              graduationYear: data.graduationYear,
              cgpa: data.cgpa ?? null,
              backlogs: data.backlogs,
            },
          },
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: created.id,
          action: "STUDENT_REGISTERED",
          entityType: "User",
          entityId: created.id,
        },
      });
      return created;
    });

    return actionOk({ userId: user.id });
  } catch (error) {
    return actionError(error);
  }
}

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}

export async function changePasswordAction(input: unknown): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) throw new AppError("UNAUTHENTICATED", "Please sign in to continue.", 401);
    const parsed = changePasswordSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Please fix the highlighted fields.",
          fieldErrors: parsed.error.flatten().fieldErrors,
        },
      };
    }
    const valid = await verifyPassword(parsed.data.currentPassword, user.passwordHash);
    if (!valid) {
      throw new AppError("INVALID_PASSWORD", "Current password is incorrect.", 400, {
        currentPassword: ["Current password is incorrect"],
      });
    }
    const passwordHash = await hashPassword(parsed.data.newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, mustChangePassword: false, sessionVersion: { increment: 1 } },
    });
    await audit({
      actorId: user.id,
      action: "PASSWORD_CHANGED",
      entityType: "User",
      entityId: user.id,
    });
    return actionOk(undefined);
  } catch (error) {
    return actionError(error);
  }
}
