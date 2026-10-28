"use server";

import { revalidatePath } from "next/cache";
import { actionError, actionOk, type ActionResult } from "@/lib/action-result";
import {
  recruiterDriveRequestSchema,
  recruiterDriveUpdateSchema,
  recruiterFeedbackSchema,
  recruiterRejectSchema,
  recruiterRoundResultSchema,
  savedCandidateRemoveSchema,
  savedCandidateSchema,
  shortlistCandidateSchema,
} from "@/lib/validation/recruiter";
import { requireRecruiter } from "@/server/auth/guards";
import {
  createRecruiterDriveRequest,
  recordRecruiterRoundResult,
  rejectRecruiterApplication,
  removeSavedCandidate,
  saveCandidate,
  shortlistCandidate,
  updateRecruiterDriveRequest,
  updateRecruiterFeedback,
  type RecruiterContext,
} from "@/server/services/recruiter";

async function recruiterContext(): Promise<RecruiterContext> {
  const { user, recruiter, company } = await requireRecruiter();
  return {
    userId: user.id,
    recruiterProfileId: recruiter.id,
    companyId: company.id,
    companyName: company.name,
  };
}

function revalidateRecruiterDrive(driveId: string) {
  revalidatePath("/recruiter");
  revalidatePath("/recruiter/drives");
  revalidatePath(`/recruiter/drives/${driveId}`);
  revalidatePath("/officer/approvals");
  revalidatePath("/officer/drives");
  revalidatePath("/student/applications");
}

export async function createRecruiterDriveRequestAction(
  input: unknown,
): Promise<ActionResult<{ driveId: string }>> {
  try {
    const context = await recruiterContext();
    const data = recruiterDriveRequestSchema.parse(input);
    const drive = await createRecruiterDriveRequest(data, context);
    revalidateRecruiterDrive(drive.id);
    return actionOk({ driveId: drive.id });
  } catch (error) {
    return actionError(error);
  }
}

export async function updateRecruiterDriveRequestAction(input: unknown): Promise<ActionResult> {
  try {
    const context = await recruiterContext();
    const data = recruiterDriveUpdateSchema.parse(input);
    await updateRecruiterDriveRequest(data, context);
    revalidateRecruiterDrive(data.driveId);
    return actionOk(undefined);
  } catch (error) {
    return actionError(error);
  }
}

export async function saveCandidateAction(
  input: unknown,
): Promise<ActionResult<{ saved: boolean }>> {
  try {
    const context = await recruiterContext();
    const data = savedCandidateSchema.parse(input);
    await saveCandidate(context, data);
    revalidatePath("/recruiter/candidates");
    revalidatePath("/recruiter/saved");
    return actionOk({ saved: true });
  } catch (error) {
    return actionError(error);
  }
}

export async function removeSavedCandidateAction(input: unknown): Promise<ActionResult> {
  try {
    const context = await recruiterContext();
    const data = savedCandidateRemoveSchema.parse(input);
    await removeSavedCandidate(context, data.studentProfileId);
    revalidatePath("/recruiter/candidates");
    revalidatePath("/recruiter/saved");
    return actionOk(undefined);
  } catch (error) {
    return actionError(error);
  }
}

export async function shortlistCandidateAction(input: unknown): Promise<ActionResult> {
  try {
    const context = await recruiterContext();
    const data = shortlistCandidateSchema.parse(input);
    const application = await shortlistCandidate(context, data);
    revalidateRecruiterDrive(data.driveId);
    revalidatePath("/recruiter/candidates");
    revalidatePath(`/student/applications/${application.id}`);
    return actionOk(undefined);
  } catch (error) {
    return actionError(error);
  }
}

export async function updateRecruiterFeedbackAction(input: unknown): Promise<ActionResult> {
  try {
    const context = await recruiterContext();
    const data = recruiterFeedbackSchema.parse(input);
    await updateRecruiterFeedback(context, data);
    revalidatePath("/recruiter/drives");
    return actionOk(undefined);
  } catch (error) {
    return actionError(error);
  }
}

export async function rejectRecruiterApplicationAction(input: unknown): Promise<ActionResult> {
  try {
    const context = await recruiterContext();
    const data = recruiterRejectSchema.parse(input);
    const application = await rejectRecruiterApplication(context, data);
    revalidateRecruiterDrive(application.driveId);
    return actionOk(undefined);
  } catch (error) {
    return actionError(error);
  }
}

export async function recordRecruiterRoundResultAction(input: unknown): Promise<ActionResult> {
  try {
    const context = await recruiterContext();
    const data = recruiterRoundResultSchema.parse(input);
    const { driveId } = await recordRecruiterRoundResult(context, data);
    revalidatePath(`/recruiter/drives/${driveId}`);
    revalidatePath("/recruiter/drives");
    revalidatePath("/student/applications");
    return actionOk(undefined);
  } catch (error) {
    return actionError(error);
  }
}
