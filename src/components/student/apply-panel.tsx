"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Send, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { applyToDriveAction } from "@/server/actions/student";
import type { ApplicationStatus } from "@/lib/constants";
import { APPLICATION_STATUS_LABELS } from "@/lib/constants";

type ApplyPanelProps = {
  driveId: string;
  eligible: boolean;
  reasons: string[];
  warnings: string[];
  overrideReason: string | null;
  application: { id: string; status: string } | null;
};

export function ApplyPanel({
  driveId,
  eligible,
  reasons,
  warnings,
  overrideReason,
  application,
}: ApplyPanelProps) {
  const router = useRouter();
  const [coverNote, setCoverNote] = useState("");
  const [loading, setLoading] = useState(false);
  const canApply = eligible || Boolean(overrideReason);

  async function apply() {
    setLoading(true);
    const result = await applyToDriveAction({ driveId, coverNote });
    setLoading(false);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success("Application submitted.");
    router.push(`/student/applications/${result.data.applicationId}`);
    router.refresh();
  }

  if (application && !["WITHDRAWN", "REJECTED"].includes(application.status)) {
    return (
      <div className="space-y-3">
        <Alert variant={application.status === "OFFERED" ? "success" : "info"}>
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>Application {APPLICATION_STATUS_LABELS[application.status as ApplicationStatus] ?? application.status}</AlertTitle>
          <AlertDescription>Track rounds and updates in your application detail.</AlertDescription>
        </Alert>
        <Button asChild className="w-full">
          <Link href={`/student/applications/${application.id}`}>View application</Link>
        </Button>
      </div>
    );
  }

  if (application?.status === "REJECTED") {
    return (
      <Alert variant="destructive">
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>Application closed</AlertTitle>
        <AlertDescription>This drive has already rejected your application.</AlertDescription>
      </Alert>
    );
  }

  if (!canApply) {
    return (
      <div className="space-y-3">
        <Alert variant="warning">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Not eligible</AlertTitle>
          <AlertDescription>
            Resolve the items below, or contact the placement office if you believe this is incorrect.
          </AlertDescription>
        </Alert>
        <ul className="space-y-1.5 text-sm text-muted-foreground">
          {reasons.map((reason) => (
            <li key={reason}>• {reason}</li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {overrideReason ? (
        <Alert variant="warning">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Officer override</AlertTitle>
          <AlertDescription>{overrideReason}</AlertDescription>
        </Alert>
      ) : null}
      {warnings.length > 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <p className="font-medium">Before you apply</p>
          <ul className="mt-1 space-y-1">
            {warnings.map((warning) => (
              <li key={warning}>• {warning}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="coverNote">Cover note (optional)</Label>
        <Textarea
          id="coverNote"
          value={coverNote}
          onChange={(event) => setCoverNote(event.target.value)}
          rows={4}
          maxLength={1500}
          placeholder="Why are you a strong fit for this role?"
        />
        <p className="text-right text-xs text-muted-foreground">{coverNote.length}/1500</p>
      </div>
      <Button onClick={apply} disabled={loading} className="w-full">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        {application?.status === "WITHDRAWN" ? "Reapply" : "Apply now"}
      </Button>
    </div>
  );
}
