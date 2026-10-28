"use server";

import { revalidatePath } from "next/cache";
import { actionError, actionOk, type ActionResult } from "@/lib/action-result";
import {
  importStudentsSchema,
  skillVerificationSchema,
  studentVerificationSchema,
} from "@/lib/validation/officer";
import { requireOfficer } from "@/server/auth/guards";
import {
  importStudentsCsv,
  verifyStudentProfile,
  verifyStudentSkill,
} from "@/server/services/officer-students";

export async function verifyStudentAction(
  input: unknown,
): Promise<ActionResult<{ isVerified: boolean }>> {
  try {
    const officer = await requireOfficer();
    const data = studentVerificationSchema.parse(input);
    const updated = await verifyStudentProfile({
      studentProfileId: data.studentProfileId,
      isVerified: data.isVerified,
      note: data.note,
      officerId: officer.id,
    });
    revalidatePath("/officer/students");
    revalidatePath(`/officer/students/${data.studentProfileId}`);
    revalidatePath("/officer");
    return actionOk({ isVerified: updated.isVerified });
  } catch (error) {
    return actionError(error);
  }
}

export async function verifySkillAction(
  input: unknown,
): Promise<ActionResult<{ isVerified: boolean }>> {
  try {
    const officer = await requireOfficer();
    const data = skillVerificationSchema.parse(input);
    const updated = await verifyStudentSkill({
      studentSkillId: data.studentSkillId,
      isVerified: data.isVerified,
      officerId: officer.id,
    });
    revalidatePath("/officer/students");
    return actionOk({ isVerified: updated.isVerified });
  } catch (error) {
    return actionError(error);
  }
}

export async function importStudentsAction(input: unknown): Promise<
  ActionResult<{
    created: number;
    updated: number;
    failed: number;
    credentials: { row: number; email: string; password: string }[];
    errors: { row: number; message: string }[];
  }>
> {
  try {
    const officer = await requireOfficer();
    const data = importStudentsSchema.parse(input);
    const result = await importStudentsCsv(data.csv, officer.id);
    revalidatePath("/officer/students");
    revalidatePath("/officer");
    return actionOk(result);
  } catch (error) {
    return actionError(error);
  }
}
