"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { approveDriveAction } from "@/server/actions/officer-drives";

export function DriveApprovalActions({ driveId }: { driveId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<"APPROVE" | "REJECT" | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");

  async function decide(decision: "APPROVE" | "REJECT", rejectionReason?: string) {
    setLoading(decision);
    const result = await approveDriveAction({
      driveId,
      decision,
      reason: rejectionReason ?? "",
    });
    setLoading(null);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success(decision === "APPROVE" ? "Drive approved and published." : "Drive rejected.");
    setRejectOpen(false);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" size="sm" onClick={() => void decide("APPROVE")} disabled={loading !== null}>
        {loading === "APPROVE" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        Approve
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => setRejectOpen(true)}
        disabled={loading !== null}
      >
        <X className="h-4 w-4" /> Reject
      </Button>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject drive</DialogTitle>
            <DialogDescription>
              Give the recruiter a clear reason so they can fix and resubmit the drive.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rejection-reason">Reason</Label>
            <Textarea
              id="rejection-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={4}
              maxLength={500}
              required
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={loading !== null || reason.trim().length < 3}
              onClick={() => void decide("REJECT", reason)}
            >
              {loading === "REJECT" ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
              Reject drive
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
