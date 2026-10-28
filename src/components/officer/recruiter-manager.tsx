"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, KeyRound, Loader2, Plus, Power, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createRecruiterAction,
  resetRecruiterPasswordAction,
  setRecruiterStatusAction,
} from "@/server/actions/officer-companies";
import { formatDateTime } from "@/lib/formatting";

type Recruiter = {
  id: string;
  name: string;
  email: string;
  designation: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: Date | string | null;
};

export function RecruiterManager({
  companyId,
  recruiters,
}: {
  companyId: string;
  recruiters: Recruiter[];
}) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const result = await createRecruiterAction({
      companyId,
      name: String(form.get("name") ?? ""),
      email: String(form.get("email") ?? ""),
      designation: String(form.get("designation") ?? ""),
      phone: String(form.get("phone") ?? ""),
    });
    setLoading(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setCreateOpen(false);
    setCredentials(result.data);
    toast.success("Recruiter account created.");
    router.refresh();
  }

  async function reset(recruiterId: string) {
    setBusyId(recruiterId);
    const result = await resetRecruiterPasswordAction({ recruiterProfileId: recruiterId });
    setBusyId(null);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    setCredentials(result.data);
    toast.success("Temporary password generated.");
    router.refresh();
  }

  async function toggle(recruiterId: string, isActive: boolean) {
    setBusyId(recruiterId);
    const result = await setRecruiterStatusAction({ recruiterProfileId: recruiterId, isActive });
    setBusyId(null);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success(isActive ? "Recruiter activated." : "Recruiter deactivated.");
    router.refresh();
  }

  async function copyCredentials() {
    if (!credentials) return;
    await navigator.clipboard.writeText(`Email: ${credentials.email}\nPassword: ${credentials.password}`);
    toast.success("Credentials copied.");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {recruiters.length} account{recruiters.length === 1 ? "" : "s"} linked to this company.
        </p>
        <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> Add recruiter
        </Button>
      </div>

      {recruiters.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          No recruiter accounts yet. Add one so the company can manage its own drives.
        </p>
      ) : (
        <div className="divide-y rounded-lg border">
          {recruiters.map((recruiter) => (
            <div key={recruiter.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{recruiter.name}</p>
                  <Badge variant={recruiter.isActive ? "success" : "outline"}>
                    {recruiter.isActive ? "Active" : "Disabled"}
                  </Badge>
                  {recruiter.mustChangePassword ? <Badge variant="warning">Password change</Badge> : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  {recruiter.email}
                  {recruiter.designation ? ` · ${recruiter.designation}` : ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  Last login: {formatDateTime(recruiter.lastLoginAt)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void reset(recruiter.id)}
                  disabled={busyId === recruiter.id}
                >
                  {busyId === recruiter.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <KeyRound className="h-3.5 w-3.5" />
                  )}
                  Reset password
                </Button>
                <Button
                  type="button"
                  variant={recruiter.isActive ? "ghost" : "default"}
                  size="sm"
                  onClick={() => void toggle(recruiter.id, !recruiter.isActive)}
                  disabled={busyId === recruiter.id}
                >
                  {recruiter.isActive ? <Power className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
                  {recruiter.isActive ? "Deactivate" : "Activate"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <form onSubmit={create} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Add recruiter</DialogTitle>
              <DialogDescription>
                The account starts with a one-time password and must change it at first login.
              </DialogDescription>
            </DialogHeader>
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="recruiter-name">Name</Label>
              <Input id="recruiter-name" name="name" required maxLength={80} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="recruiter-email">Work email</Label>
              <Input id="recruiter-email" name="email" type="email" required maxLength={120} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="recruiter-designation">Designation</Label>
                <Input id="recruiter-designation" name="designation" maxLength={100} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="recruiter-phone">Phone</Label>
                <Input id="recruiter-phone" name="phone" maxLength={20} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Create account
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(credentials)} onOpenChange={(open) => !open && setCredentials(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Temporary credentials</DialogTitle>
            <DialogDescription>
              Share these securely. The password is shown only now and must be changed at sign-in.
            </DialogDescription>
          </DialogHeader>
          {credentials ? (
            <div className="space-y-3 rounded-lg border bg-muted/40 p-4 font-mono text-sm">
              <p>{credentials.email}</p>
              <p>{credentials.password}</p>
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => void copyCredentials()}>
              <Copy className="h-4 w-4" /> Copy
            </Button>
            <Button type="button" onClick={() => setCredentials(null)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
