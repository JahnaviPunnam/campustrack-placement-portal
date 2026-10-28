import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

export default NextAuth(authConfig).auth;

export const config = {
  matcher: [
    "/student/:path*",
    "/officer/:path*",
    "/recruiter/:path*",
    "/account/:path*",
    "/forbidden",
    "/api/events",
    "/api/notifications",
    "/api/uploads/:path*",
    "/api/files/:path*",
    "/api/imports/:path*",
    "/api/exports/:path*",
  ],
};
