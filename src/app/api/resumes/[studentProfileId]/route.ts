import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { requireUser } from "@/server/auth/guards";
import { prisma } from "@/server/db";
import { AppError, isAppError } from "@/server/errors";
import { resolveUploadPath, safeDownloadName } from "@/server/files";
import { audit } from "@/server/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: { studentProfileId: string } },
) {
  try {
    const user = await requireUser();
    const profile = await prisma.studentProfile.findUnique({
      where: { id: params.studentProfileId },
      select: {
        id: true,
        userId: true,
        resumePath: true,
        resumeOriginalName: true,
        isVerified: true,
      },
    });
    if (!profile?.resumePath) throw new AppError("RESUME_NOT_FOUND", "Resume not found.", 404);

    if (user.role === "STUDENT" && profile.userId !== user.id) {
      throw new AppError("FORBIDDEN", "You cannot access this resume.", 403);
    }
    if (user.role !== "STUDENT" && user.role !== "PLACEMENT_OFFICER" && user.role !== "RECRUITER") {
      throw new AppError("FORBIDDEN", "You cannot access this resume.", 403);
    }
    if (user.role === "RECRUITER" && !profile.isVerified) {
      throw new AppError("FORBIDDEN", "Recruiters can only view verified student resumes.", 403);
    }

    const file = await readFile(resolveUploadPath(profile.resumePath));
    if (profile.userId !== user.id) {
      await audit({
        actorId: user.id,
        action: "RESUME_VIEWED",
        entityType: "StudentProfile",
        entityId: profile.id,
      });
    }
    return new NextResponse(new Uint8Array(file), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${safeDownloadName(profile.resumeOriginalName)}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (isAppError(error)) {
      return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status });
    }
    console.error(error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Unable to load resume." } },
      { status: 500 },
    );
  }
}
