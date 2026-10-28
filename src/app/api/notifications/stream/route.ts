import { NextResponse } from "next/server";
import type { Role } from "@/lib/constants";
import { requireUser } from "@/server/auth/guards";
import { isAppError } from "@/server/errors";
import {
  companyChannel,
  roleChannel,
  sendHeartbeat,
  subscribe,
  userChannel,
} from "@/server/realtime/hub";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  let user: Awaited<ReturnType<typeof requireUser>>;
  try {
    user = await requireUser();
  } catch (error) {
    if (isAppError(error)) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.status },
      );
    }
    console.error(error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Unable to open the live connection." } },
      { status: 500 },
    );
  }

  const channels = [userChannel(user.id)];
  if (user.role !== "STUDENT") {
    channels.push(roleChannel(user.role as Role));
  }
  if (user.recruiterProfile) {
    channels.push(companyChannel(user.recruiterProfile.companyId));
  }

  let cleanup = () => {};
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const subscriptions = channels.map((channel) => subscribe(channel, controller));
      const heartbeat = setInterval(() => sendHeartbeat(controller), 15_000);
      let closed = false;

      const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        for (const subscription of subscriptions) subscription.close();
        try {
          controller.close();
        } catch {
          // The browser may have already cancelled the stream.
        }
      };

      request.signal.addEventListener("abort", close, { once: true });
      cleanup = close;
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
