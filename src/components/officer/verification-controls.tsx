"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Loader2, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { verifySkillAction, verifyStudentAction } from "@/server/actions/officer-students";

export function VerifyStudentControl({
  studentProfileId,
  isVerified,
  note,
}: {
  studentProfileId: string;
  isVerified: boolean;
  note: string | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [value, setValue] = useState(note ?? "");

  async function submit(next: boolean) {
    setLoading(true);
    const result = await verifyStudentAction({
      studentProfileId,
      isVerified: next,
      note: value,
    });
    setLoading(false);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success(next ? "Profile verified." : "Verification revoked.");
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="verification-note">Verification note</Label>
        <Textarea
          id="verification-note"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          rows={3}
          maxLength={500}
          placeholder="Optional note shown to the student."
        />
      </div>
      {isVerified ? (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => submit(false)}
          disabled={loading}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldOff className="h-4 w-4" />}
          Revoke verification
        </Button>
      ) : (
        <Button type="button" className="w-full" onClick={() => submit(true)} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />}
          Verify profile
        </Button>
      )}
    </div>
  );
}

export function VerifySkillControl({
  studentSkillId,
  isVerified,
}: {
  studentSkillId: string;
  isVerified: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    const result = await verifySkillAction({
      studentSkillId,
      isVerified: !isVerified,
    });
    setLoading(false);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success(isVerified ? "Skill verification removed." : "Skill verified.");
    router.refresh();
  }

  return (
    <Button type="button" variant="ghost" size="sm" onClick={toggle} disabled={loading}>
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : isVerified ? (
        <ShieldOff className="h-3.5 w-3.5" />
      ) : (
        <BadgeCheck className="h-3.5 w-3.5" />
      )}
      {isVerified ? "Unverify" : "Verify"}
    </Button>
  );
}
