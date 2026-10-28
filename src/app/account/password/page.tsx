import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/guards";
import { ChangePasswordForm } from "@/components/auth/change-password-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import Link from "next/link";
import { GraduationCap } from "lucide-react";

export default async function ChangePasswordPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-4xl items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <GraduationCap className="h-5 w-5" />
          </span>
          CampusTrack
        </Link>
        <ThemeToggle />
      </header>
      <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-10">
        {user.mustChangePassword ? (
          <Badge variant="warning" className="self-start">
            Temporary password — change required
          </Badge>
        ) : null}
        <Card>
          <CardHeader>
            <CardTitle>Change password</CardTitle>
            <CardDescription>
              Signed in as {user.email}. Use a strong password you do not reuse elsewhere.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChangePasswordForm />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
