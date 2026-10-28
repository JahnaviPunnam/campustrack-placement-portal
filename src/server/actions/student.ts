"use server";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { actionError, actionOk, type ActionResult } from "@/lib/action-result";
import {
  applyToDriveSchema,
  profileUpdateSchema,
  skillInputSchema,
  skillRemoveSchema,
  skillUpdateSchema,
  targetRoleSchema,
  withdrawApplicationSchema,
} from "@/lib/validation/student";
import { requireStudent } from "@/server/auth/guards";
import { AppError } from "@/server/errors";
import { getEnv } from "@/lib/env";
import {
  addStudentSkill,
  removeStudentSkill,
  setTargetRole,
  updateResumePath,
  updateStudentProfile,
  updateStudentSkill,
} from "@/server/services/students";
import { applyToDrive, withdrawApplication } from "@/server/services/applications";

function revalidateStudentSurface() {
  revalidatePath("/student");
  revalidatePath("/student/profile");
  revalidatePath("/student/skills");
  revalidatePath("/student/skills/gap");
  revalidatePath("/student/drives");
  revalidatePath("/student/applications");
}

export async function updateProfileAction(input: unknown): Promise<ActionResult<{ name: string }>> {
  try {
    const { user, profile } = await requireStudent();
    const data = profileUpdateSchema.parse(input);
    const updated = await updateStudentProfile(profile.id, user.id, user.id, data);
    revalidateStudentSurface();
    return actionOk({ name: updated.user.name });
  } catch (error) {
    return actionError(error);
  }
}

export async function uploadResumeAction(formData: FormData): Promise<ActionResult<{ name: string }>> {
  try {
    const { user, profile } = await requireStudent();
    const env = getEnv();
    const file = formData.get("resume");
    if (!(file instanceof File) || file.size === 0) {
      throw new AppError("RESUME_REQUIRED", "Choose a PDF file to upload.", 400);
    }
    const maxBytes = Math.floor(env.MAX_RESUME_MB * 1024 * 1024);
    if (file.size > maxBytes) {
      throw new AppError("RESUME_TOO_LARGE", `Resume must be ${env.MAX_RESUME_MB} MB or smaller.`, 400);
    }
    if (file.type && file.type !== "application/pdf") {
      throw new AppError("RESUME_INVALID_TYPE", "Only PDF resumes are accepted.", 400);
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length < 5 || buffer.subarray(0, 5).toString("ascii") !== "%PDF-") {
      throw new AppError("RESUME_INVALID_TYPE", "The uploaded file is not a valid PDF.", 400);
    }

    const directory = path.resolve(process.cwd(), env.UPLOAD_DIR, "resumes", profile.id);
    await mkdir(directory, { recursive: true });
    const filename = `${crypto.randomUUID()}.pdf`;
    const fullPath = path.join(directory, filename);
    await writeFile(fullPath, buffer, { flag: "wx" });
    const relativePath = path.relative(process.cwd(), fullPath).split(path.sep).join("/");
    const originalName = (file.name || "resume.pdf").replace(/[^\w.\- ()]/g, "_").slice(0, 120);

    await updateResumePath(profile.id, user.id, {
      resumePath: relativePath,
      resumeOriginalName: originalName,
      resumeMimeType: "application/pdf",
      resumeSizeBytes: buffer.length,
    });
    revalidateStudentSurface();
    return actionOk({ name: originalName });
  } catch (error) {
    return actionError(error);
  }
}

export async function addSkillAction(input: unknown): Promise<ActionResult> {
  try {
    const { user, profile } = await requireStudent();
    const data = skillInputSchema.parse(input);
    await addStudentSkill(profile.id, user.id, data);
    revalidateStudentSurface();
    return actionOk(undefined);
  } catch (error) {
    return actionError(error);
  }
}

export async function updateSkillAction(input: unknown): Promise<ActionResult> {
  try {
    const { user, profile } = await requireStudent();
    const data = skillUpdateSchema.parse(input);
    await updateStudentSkill(profile.id, user.id, data);
    revalidateStudentSurface();
    return actionOk(undefined);
  } catch (error) {
    return actionError(error);
  }
}

export async function removeSkillAction(input: unknown): Promise<ActionResult> {
  try {
    const { user, profile } = await requireStudent();
    const data = skillRemoveSchema.parse(input);
    await removeStudentSkill(profile.id, user.id, data.studentSkillId);
    revalidateStudentSurface();
    return actionOk(undefined);
  } catch (error) {
    return actionError(error);
  }
}

export async function setTargetRoleAction(input: unknown): Promise<ActionResult> {
  try {
    const { user, profile } = await requireStudent();
    const data = targetRoleSchema.parse(input);
    await setTargetRole(profile.id, user.id, data.roleProfileId);
    revalidateStudentSurface();
    return actionOk(undefined);
  } catch (error) {
    return actionError(error);
  }
}

export async function applyToDriveAction(input: unknown): Promise<ActionResult<{ applicationId: string }>> {
  try {
    const { user, profile } = await requireStudent();
    const data = applyToDriveSchema.parse(input);
    const { application } = await applyToDrive({
      profileId: profile.id,
      userId: user.id,
      actorId: user.id,
      driveId: data.driveId,
      coverNote: data.coverNote,
    });
    revalidateStudentSurface();
    return actionOk({ applicationId: application.id });
  } catch (error) {
    return actionError(error);
  }
}

export async function withdrawApplicationAction(input: unknown): Promise<ActionResult> {
  try {
    const { user, profile } = await requireStudent();
    const data = withdrawApplicationSchema.parse(input);
    await withdrawApplication({
      profileId: profile.id,
      actorId: user.id,
      applicationId: data.applicationId,
    });
    revalidateStudentSurface();
    return actionOk(undefined);
  } catch (error) {
    return actionError(error);
  }
}
