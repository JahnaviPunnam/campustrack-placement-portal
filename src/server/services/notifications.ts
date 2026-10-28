import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import type { NotificationType } from "@/lib/constants";
import { publishToUser } from "@/server/realtime/hub";
import { safeInternalPath } from "@/lib/utils";

export type NotificationInput = {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string | null;
  dedupeKey?: string | null;
};

type DbClient = Prisma.TransactionClient | typeof prisma;

export async function createNotification(
  input: NotificationInput,
  db: DbClient = prisma,
): Promise<{ id: string; createdAt: Date; created: boolean }> {
  const link = safeInternalPath(input.link) ?? null;
  if (input.dedupeKey) {
    const existing = await db.notification.findUnique({
      where: { userId_dedupeKey: { userId: input.userId, dedupeKey: input.dedupeKey } },
    });
    if (existing) return { id: existing.id, createdAt: existing.createdAt, created: false };
  }
  const notification = await db.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      link,
      dedupeKey: input.dedupeKey ?? null,
    },
  });
  return { id: notification.id, createdAt: notification.createdAt, created: true };
}

export async function notifyUser(input: NotificationInput): Promise<void> {
  const result = await createNotification(input);
  if (result.created) {
    publishToUser(input.userId, "notification.created", {
      id: result.id,
      type: input.type,
      title: input.title,
      body: input.body,
      link: safeInternalPath(input.link) ?? null,
      isRead: false,
      createdAt: result.createdAt.toISOString(),
    });
  }
}

export async function notifyUsers(inputs: NotificationInput[]): Promise<number> {
  let created = 0;
  for (const input of inputs) {
    const result = await createNotification(input);
    if (result.created) {
      created += 1;
      publishToUser(input.userId, "notification.created", {
        id: result.id,
        type: input.type,
        title: input.title,
        body: input.body,
        link: safeInternalPath(input.link) ?? null,
        isRead: false,
        createdAt: result.createdAt.toISOString(),
      });
    }
  }
  return created;
}

export async function getUserNotifications(userId: string, limit = 50) {
  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.notification.count({ where: { userId, isRead: false } }),
  ]);
  return { notifications, unreadCount };
}

export async function markNotificationRead(userId: string, notificationId: string): Promise<boolean> {
  const result = await prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { isRead: true },
  });
  return result.count > 0;
}

export async function markAllNotificationsRead(userId: string): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
  return result.count;
}
