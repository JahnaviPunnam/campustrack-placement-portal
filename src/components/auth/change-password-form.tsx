"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSession, signOut } from "next-auth/react";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { changePasswordAction } from "@/server/actions/auth";
import { roleHome } from "@/lib/roles";

export function ChangePasswordForm() {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setErrors({});
    setFormError(null);
    const form = new FormData(event.currentTarget);
    const result = await changePasswordAction({
      currentPassword: String(form.get("currentPassword") ?? ""),
      newPassword: String(form.get("newPassword") ?? ""),
      confirmPassword: String(form.get("confirmPassword") ?? ""),
    });
    setLoading(false);
    if (!result.ok) {
      setErrors(result.error.fieldErrors ?? {});
      setFormError(result.error.message);
      return;
    }
    toast.success("Password updated. Please sign in again.");
    const session = await getSession();
    await signOut({ redirect: false });
    if (!session) {
      router.push("/login");
      return;
    }
    router.push(session.user.mustChangePassword ? "/login" : roleHome(session.user.role));
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {formError ? (
        <Alert variant="destructive">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="currentPassword">Current password</Label>
        <Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required />
        {errors.currentPassword ? <p className="text-xs text-destructive">{errors.currentPassword[0]}</p> : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="newPassword">New password</Label>
        <Input id="newPassword" name="newPassword" type="password" autoComplete="new-password" required />
        {errors.newPassword ? <p className="text-xs text-destructive">{errors.newPassword[0]}</p> : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm new password</Label>
        <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required />
        {errors.confirmPassword ? <p className="text-xs text-destructive">{errors.confirmPassword[0]}</p> : null}
      </div>
      <Button type="submit" className="w-full gap-2" disabled={loading}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
        {loading ? "Updating…" : "Update password"}
      </Button>
    </form>
  );
}
