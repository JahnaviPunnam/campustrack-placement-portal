"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Power } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setCompanyStatusAction } from "@/server/actions/officer-companies";

export function CompanyStatusControl({
  companyId,
  isActive,
}: {
  companyId: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    const result = await setCompanyStatusAction({ companyId, isActive: !isActive });
    setLoading(false);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success(isActive ? "Company deactivated." : "Company activated.");
    router.refresh();
  }

  return (
    <Button type="button" variant="outline" onClick={toggle} disabled={loading}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />}
      {isActive ? "Deactivate company" : "Activate company"}
    </Button>
  );
}
