"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { removeSavedCandidateAction } from "@/server/actions/recruiter";

export function SavedCandidateActions({ studentProfileId }: { studentProfileId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function remove() {
    setLoading(true);
    const result = await removeSavedCandidateAction({ studentProfileId });
    setLoading(false);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success("Removed from saved candidates.");
    router.refresh();
  }

  return (
    <Button type="button" variant="ghost" size="sm" onClick={() => void remove()} disabled={loading}>
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
      Remove
    </Button>
  );
}
