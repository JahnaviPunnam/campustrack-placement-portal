import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "@/auth.config";
import { loginSchema } from "@/lib/validation/auth";
import { prisma } from "@/server/db";
import { DUMMY_PASSWORD_HASH, verifyPassword } from "@/server/auth/password";
import { rateLimit } from "@/server/auth/rate-limit";
import { getEnv } from "@/lib/env";
import type { Role } from "@/lib/constants";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = loginSchema.safeParse(raw);
        if (!parsed.success) return null;
        const env = getEnv();
        const attempt = rateLimit(
          `login:${parsed.data.email}`,
          env.AUTH_RATE_LIMIT_MAX,
          env.AUTH_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
        );
        if (!attempt.allowed) return null;

        const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
        if (!user || !user.isActive) {
          await verifyPassword(parsed.data.password, DUMMY_PASSWORD_HASH);
          return null;
        }
        const valid = await verifyPassword(parsed.data.password, user.passwordHash);
        if (!valid) return null;

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role as Role,
          mustChangePassword: user.mustChangePassword,
          sessionVersion: user.sessionVersion,
        };
      },
    }),
  ],
});
