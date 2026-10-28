"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldPlus, ShieldX } from "lucide-react";
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
import { createOverrideAction, revokeOverrideAction } from "@/server/actions/officer-drives";

export function OverrideControls({
  driveId,
  studentProfileId,
  studentName,
  override,
}: {
  driveId: string;
  studentProfileId: string;
  studentName: string;
  override: { id: string; reason: string } | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setLoading(true);
    setError(null);
    const result = await createOverrideAction({ driveId, studentProfileId, reason });
    setLoading(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    toast.success("Eligibility override granted.");
    setOpen(false);
    router.refresh();
  }

  async function revoke() {
    if (!override) return;
    setLoading(true);
    setError(null);
    const result = await revokeOverrideAction({ overrideId: override.id, reason });
    setLoading(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    toast.success("Override revoked.");
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant={override ? "ghost" : "outline"}
        onClick={() => {
          setReason(override?.reason ?? "");
          setOpen(true);
        }}
      >
        {override ? <ShieldX className="h-3.5 w-3.5" /> : <ShieldPlus className="h-3.5 w-3.5" />}
        {override ? "Revoke override" : "Override"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{override ? "Revoke eligibility override" : "Grant eligibility override"}</DialogTitle>
            <DialogDescription>
              {studentName}
              {override ? " was manually allowed to apply." : " does not meet the drive criteria."}
            </DialogDescription>
          </DialogHeader>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div className="space-y-2">
            <Label>Reason</Label>
            <Textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              maxLength={500}
              required
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant={override ? "destructive" : "default"}
              onClick={() => void (override ? revoke() : create())}
              disabled={loading || reason.trim().length < (override ? 5 : 10)}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : override ? <ShieldX className="h-4 w-4" /> : <ShieldPlus className="h-4 w-4" />}
              {override ? "Revoke" : "Grant override"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
