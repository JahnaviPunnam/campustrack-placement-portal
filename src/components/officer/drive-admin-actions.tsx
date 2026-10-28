"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Pencil, Radio, RefreshCw, Square } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  changeDriveStatusAction,
  publishDriveAction,
  runDriveEligibilityAction,
} from "@/server/actions/officer-drives";

export function DriveAdminActions({
  driveId,
  status,
  source,
}: {
  driveId: string;
  status: string;
  source: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function publish() {
    setBusy("publish");
    const result = await publishDriveAction({ driveId, status: "ACTIVE" });
    setBusy(null);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success(
      `Drive published. ${result.data.notificationsCreated} eligible student notification(s) created.`,
    );
    router.refresh();
  }

  async function runEligibility() {
    setBusy("eligibility");
    const result = await runDriveEligibilityAction({ driveId, status: "ACTIVE" });
    setBusy(null);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success(
      `${result.data.eligible} eligible, ${result.data.ineligible} ineligible, ${result.data.overridden} overridden.`,
    );
    router.refresh();
  }

  async function changeStatus(next: "CLOSED" | "COMPLETED") {
    setBusy(next);
    const result = await changeDriveStatusAction({ driveId, status: next });
    setBusy(null);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success(next === "CLOSED" ? "Drive closed." : "Drive marked completed.");
    router.refresh();
  }

  return (
    <>
      {["DRAFT", "REJECTED"].includes(status) && source === "OFFICER" ? (
        <Button type="button" onClick={() => void publish()} disabled={busy !== null}>
          {busy === "publish" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radio className="h-4 w-4" />}
          Publish
        </Button>
      ) : null}
      {["DRAFT", "REJECTED"].includes(status) ? (
        <Button asChild variant="outline">
          <Link href={`/officer/drives/${driveId}/edit`}>
            <Pencil className="h-4 w-4" /> Edit
          </Link>
        </Button>
      ) : null}
      {status === "ACTIVE" ? (
        <>
          <Button type="button" variant="outline" onClick={() => void runEligibility()} disabled={busy !== null}>
            {busy === "eligibility" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Run eligibility
          </Button>
          <Button type="button" variant="outline" onClick={() => void changeStatus("CLOSED")} disabled={busy !== null}>
            {busy === "CLOSED" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4" />}
            Close drive
          </Button>
        </>
      ) : null}
      {status === "CLOSED" ? (
        <Button type="button" onClick={() => void changeStatus("COMPLETED")} disabled={busy !== null}>
          {busy === "COMPLETED" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
          Mark completed
        </Button>
      ) : null}
    </>
  );
}
