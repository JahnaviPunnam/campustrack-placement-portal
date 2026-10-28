"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { withdrawApplicationAction } from "@/server/actions/student";

export function WithdrawButton({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function withdraw() {
    if (!window.confirm("Withdraw this application? You can reapply while the drive is open.")) return;
    setLoading(true);
    const result = await withdrawApplicationAction({ applicationId });
    setLoading(false);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success("Application withdrawn.");
    router.refresh();
  }

  return (
    <Button type="button" variant="outline" onClick={withdraw} disabled={loading}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />}
      Withdraw
    </Button>
  );
}
