import { handlers } from "@/auth";
import { clientKeyFromHeaders, rateLimit } from "@/server/auth/rate-limit";
import { getEnv } from "@/lib/env";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return handlers.GET(request as never);
}

export async function POST(request: Request) {
  const env = getEnv();
  const key = clientKeyFromHeaders(request.headers, "auth-ip");
  const result = rateLimit(key, env.AUTH_RATE_LIMIT_MAX * 4, env.AUTH_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000);
  if (!result.allowed) {
    return Response.json(
      { error: { code: "RATE_LIMITED", message: "Too many attempts. Try again later." } },
      { status: 429, headers: { "Retry-After": String(result.retryAfterSeconds) } },
    );
  }
  return handlers.POST(request as never);
}
