import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/guards";
import { roleHome } from "@/lib/roles";
import type { Role } from "@/lib/constants";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { registered?: string; callbackUrl?: string };
}) {
  const user = await getCurrentUser();
  if (user) {
    if (user.mustChangePassword) redirect("/account/password");
    redirect(roleHome(user.role as Role));
  }

  return (
    <div className="w-full max-w-md">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sign in with your campus account to continue.
        </p>
      </div>
      {searchParams.registered ? (
        <div className="mb-4 rounded-lg border border-emerald-500/40 bg-emerald-50 p-3 text-sm text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
          Account created. Sign in to complete your profile.
        </div>
      ) : null}
      <LoginForm callbackUrl={searchParams.callbackUrl} />
      <p className="mt-6 text-center text-sm text-muted-foreground">
        New student?{" "}
        <Link href="/register" className="font-medium text-primary hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
