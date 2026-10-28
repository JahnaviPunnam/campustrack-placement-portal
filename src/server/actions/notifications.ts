"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { actionError, actionOk, type ActionResult } from "@/lib/action-result";
import { requireUser } from "@/server/auth/guards";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/server/services/notifications";

const notificationSchema = z.object({ notificationId: z.string().min(1) });

function revalidateNotificationSurfaces() {
  revalidatePath("/student/notifications");
  revalidatePath("/officer/notifications");
  revalidatePath("/recruiter/notifications");
}

export async function markAnyNotificationReadAction(input: unknown): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const data = notificationSchema.parse(input);
    await markNotificationRead(user.id, data.notificationId);
    revalidateNotificationSurfaces();
    return actionOk(undefined);
  } catch (error) {
    return actionError(error);
  }
}

export async function markAllAnyNotificationsReadAction(): Promise<ActionResult> {
  try {
    const user = await requireUser();
    await markAllNotificationsRead(user.id);
    revalidateNotificationSurfaces();
    return actionOk(undefined);
  } catch (error) {
    return actionError(error);
  }
}
