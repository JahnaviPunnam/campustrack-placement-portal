import { NextResponse } from "next/server";
import { requireUser } from "@/server/auth/guards";
import { prisma } from "@/server/db";
import { AppError, isAppError } from "@/server/errors";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.object({
  unreadOnly: z.enum(["0", "1"]).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  since: z.string().datetime().optional(),
});

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const url = new URL(request.url);
    const parsed = querySchema.safeParse({
      unreadOnly: url.searchParams.get("unreadOnly") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
      since: url.searchParams.get("since") ?? undefined,
    });
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", "Invalid notification query.", 400);

    const { unreadOnly, limit, since } = parsed.data;
    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: {
          userId: user.id,
          ...(unreadOnly === "1" ? { isRead: false } : {}),
          ...(since ? { createdAt: { gt: new Date(since) } } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        select: {
          id: true,
          type: true,
          title: true,
          body: true,
          link: true,
          isRead: true,
          createdAt: true,
        },
      }),
      prisma.notification.count({ where: { userId: user.id, isRead: false } }),
    ]);

    return NextResponse.json({
      notifications: notifications.map((n) => ({ ...n, createdAt: n.createdAt.toISOString() })),
      unreadCount,
    });
  } catch (error) {
    if (isAppError(error)) {
      return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status });
    }
    console.error(error);
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Unable to load notifications." } }, { status: 500 });
  }
}
