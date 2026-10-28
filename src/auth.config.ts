import type { NextAuthConfig } from "next-auth";
import { NextResponse } from "next/server";
import type { Role } from "@/lib/constants";

const ROLE_PREFIXES: { prefix: string; role: Role }[] = [
  { prefix: "/student", role: "STUDENT" },
  { prefix: "/officer", role: "PLACEMENT_OFFICER" },
  { prefix: "/recruiter", role: "RECRUITER" },
  { prefix: "/api/student", role: "STUDENT" },
  { prefix: "/api/officer", role: "PLACEMENT_OFFICER" },
  { prefix: "/api/recruiter", role: "RECRUITER" },
];

function isApiPath(pathname: string) {
  return pathname.startsWith("/api/");
}

function deny(pathname: string, status: 401 | 403, message: string) {
  if (isApiPath(pathname)) {
    return NextResponse.json({ error: { code: status === 401 ? "UNAUTHENTICATED" : "FORBIDDEN", message } }, { status });
  }
  if (status === 401) {
    const url = new URL("/login", process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000");
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.redirect(new URL("/forbidden", process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"));
}

export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  trustHost: true,
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.mustChangePassword = Boolean(user.mustChangePassword);
        token.sessionVersion = typeof user.sessionVersion === "number" ? user.sessionVersion : 0;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = typeof token.id === "string" ? token.id : "";
        session.user.role = token.role as Role;
        session.user.mustChangePassword = Boolean(token.mustChangePassword);
        session.user.sessionVersion = typeof token.sessionVersion === "number" ? token.sessionVersion : 0;
      }
      return session;
    },
    authorized({ auth, request }) {
      const pathname = request.nextUrl.pathname;
      if (!auth?.user) {
        return deny(pathname, 401, "Authentication required.");
      }
      if (auth.user.mustChangePassword && !pathname.startsWith("/account/password")) {
        if (isApiPath(pathname)) {
          return NextResponse.json(
            { error: { code: "PASSWORD_CHANGE_REQUIRED", message: "Change your temporary password first." } },
            { status: 403 },
          );
        }
        return NextResponse.redirect(
          new URL("/account/password", process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
        );
      }
      const match = ROLE_PREFIXES.find((entry) => pathname.startsWith(entry.prefix));
      if (match && auth.user.role !== match.role) {
        return deny(pathname, 403, "You do not have access to this area.");
      }
      return true;
    },
  },
} satisfies NextAuthConfig;
