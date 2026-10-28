"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { actionError, actionOk, type ActionResult } from "@/lib/action-result";
import {
  applicationStatusSchema,
  driveApprovalSchema,
  driveCreateSchema,
  driveStatusSchema,
  driveUpdateSchema,
  offerCreateSchema,
  overrideCreateSchema,
  overrideRevokeSchema,
  roundCreateSchema,
  roundRemoveSchema,
  roundResultSchema,
  roundUpdateSchema,
} from "@/lib/validation/officer";
import { requireOfficer } from "@/server/auth/guards";
import { prisma } from "@/server/db";
import {
  approveDrive,
  changeDriveStatus,
  createDrive,
  createOffer,
  createRound,
  publishDrive,
  recordRoundResult,
  removeRound,
  revokeOffer,
  setApplicationStatus,
  updateDrive,
  updateRound,
} from "@/server/services/officer-drives";
import {
  createOverride,
  revokeOverride,
  runEligibilityForDrive,
} from "@/server/services/eligibility";

function revalidateDrive(driveId: string) {
  revalidatePath("/officer/drives");
  revalidatePath("/officer");
  revalidatePath(`/officer/drives/${driveId}`);
  revalidatePath(`/officer/drives/${driveId}/eligibility`);
  revalidatePath("/student/drives");
}

export async function createDriveAction(input: unknown): Promise<ActionResult<{ driveId: string }>> {
  try {
    const officer = await requireOfficer();
    const data = driveCreateSchema.parse(input);
    const drive = await createDrive(data, officer.id);
    revalidateDrive(drive.id);
    return actionOk({ driveId: drive.id });
  } catch (error) {
    return actionError(error);
  }
}

export async function updateDriveAction(input: unknown): Promise<ActionResult> {
  try {
    const officer = await requireOfficer();
    const data = driveUpdateSchema.parse(input);
    await updateDrive(data, officer.id);
    revalidateDrive(data.driveId);
    return actionOk(undefined);
  } catch (error) {
    return actionError(error);
  }
}

export async function publishDriveAction(input: unknown): Promise<ActionResult<{ notificationsCreated: number }>> {
  try {
    const officer = await requireOfficer();
    const data = driveStatusSchema.parse(input);
    const result = await publishDrive(data.driveId, officer.id);
    revalidateDrive(data.driveId);
    return actionOk({ notificationsCreated: result.notificationsCreated });
  } catch (error) {
    return actionError(error);
  }
}

export async function approveDriveAction(
  input: unknown,
): Promise<ActionResult<{ status: "ACTIVE" | "REJECTED"; notificationsCreated: number }>> {
  try {
    const officer = await requireOfficer();
    const data = driveApprovalSchema.parse(input);
    const result = await approveDrive({
      driveId: data.driveId,
      decision: data.decision,
      reason: data.reason,
      officerId: officer.id,
    });
    revalidateDrive(data.driveId);
    revalidatePath("/officer/approvals");
    return actionOk(result);
  } catch (error) {
    return actionError(error);
  }
}

export async function changeDriveStatusAction(input: unknown): Promise<ActionResult> {
  try {
    const officer = await requireOfficer();
    const data = driveStatusSchema.parse(input);
    await changeDriveStatus(data.driveId, data.status, officer.id);
    revalidateDrive(data.driveId);
    return actionOk(undefined);
  } catch (error) {
    return actionError(error);
  }
}

export async function runDriveEligibilityAction(
  input: unknown,
): Promise<ActionResult<{ eligible: number; ineligible: number; overridden: number; notificationsCreated: number }>> {
  try {
    const officer = await requireOfficer();
    const data = driveStatusSchema.parse(input);
    const result = await runEligibilityForDrive(data.driveId, officer.id);
    revalidateDrive(data.driveId);
    return actionOk(result);
  } catch (error) {
    return actionError(error);
  }
}

export async function createRoundAction(input: unknown): Promise<ActionResult<{ roundId: string }>> {
  try {
    const officer = await requireOfficer();
    const data = roundCreateSchema.parse(input);
    const round = await createRound(data, officer.id);
    revalidateDrive(data.driveId);
    return actionOk({ roundId: round.id });
  } catch (error) {
    return actionError(error);
  }
}

export async function updateRoundAction(input: unknown): Promise<ActionResult> {
  try {
    const officer = await requireOfficer();
    const data = roundUpdateSchema.parse(input);
    await updateRound(data, officer.id);
    revalidateDrive(data.driveId);
    return actionOk(undefined);
  } catch (error) {
    return actionError(error);
  }
}

export async function removeRoundAction(input: unknown): Promise<ActionResult> {
  try {
    const officer = await requireOfficer();
    const data = roundRemoveSchema.parse(input);
    const round = await prisma.round.findUnique({
      where: { id: data.roundId },
      select: { driveId: true },
    });
    if (round) {
      await removeRound(data.roundId, round.driveId, officer.id);
      revalidateDrive(round.driveId);
    }
    return actionOk(undefined);
  } catch (error) {
    return actionError(error);
  }
}

export async function recordRoundResultAction(input: unknown): Promise<ActionResult> {
  try {
    const officer = await requireOfficer();
    const data = roundResultSchema.parse(input);
    await recordRoundResult({ ...data, officerId: officer.id });
    revalidatePath("/officer/drives");
    return actionOk(undefined);
  } catch (error) {
    return actionError(error);
  }
}

export async function setApplicationStatusAction(input: unknown): Promise<ActionResult> {
  try {
    const officer = await requireOfficer();
    const data = applicationStatusSchema.parse(input);
    await setApplicationStatus({
      applicationId: data.applicationId,
      status: data.status,
      reason: data.reason,
      officerId: officer.id,
    });
    revalidatePath("/officer/drives");
    revalidatePath("/officer");
    return actionOk(undefined);
  } catch (error) {
    return actionError(error);
  }
}

export async function createOfferAction(
  input: unknown,
): Promise<ActionResult<{ dreamUpgrade: boolean }>> {
  try {
    const officer = await requireOfficer();
    const data = offerCreateSchema.parse(input);
    const result = await createOffer({ ...data, officerId: officer.id });
    revalidatePath("/officer/drives");
    revalidatePath("/officer");
    return actionOk({ dreamUpgrade: result.dreamUpgrade });
  } catch (error) {
    return actionError(error);
  }
}

export async function revokeOfferAction(input: unknown): Promise<ActionResult> {
  try {
    const officer = await requireOfficer();
    const data = z.object({ offerId: z.string().min(1), reason: z.string().trim().max(500).optional() }).parse(input);
    await revokeOffer({ offerId: data.offerId, reason: data.reason || null, officerId: officer.id });
    revalidatePath("/officer/drives");
    revalidatePath("/officer");
    return actionOk(undefined);
  } catch (error) {
    return actionError(error);
  }
}

export async function createOverrideAction(input: unknown): Promise<ActionResult> {
  try {
    const officer = await requireOfficer();
    const data = overrideCreateSchema.parse(input);
    await createOverride({ ...data, actorId: officer.id });
    revalidateDrive(data.driveId);
    return actionOk(undefined);
  } catch (error) {
    return actionError(error);
  }
}

export async function revokeOverrideAction(input: unknown): Promise<ActionResult> {
  try {
    const officer = await requireOfficer();
    const data = overrideRevokeSchema.parse(input);
    await revokeOverride({ overrideId: data.overrideId, reason: data.reason, actorId: officer.id });
    revalidatePath("/officer/drives");
    return actionOk(undefined);
  } catch (error) {
    return actionError(error);
  }
}
