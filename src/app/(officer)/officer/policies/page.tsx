import Link from "next/link";
import { History } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { PolicyForm } from "@/components/officer/policy-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/formatting";
import { getPlacementPolicy } from "@/server/services/officer-companies";
import { prisma } from "@/server/db";

export const metadata = { title: "Placement policy" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const policy = await getPlacementPolicy();
  const updates = await prisma.auditLog.findMany({
    where: { action: "POLICY_UPDATED" },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: { actor: { select: { name: true } } },
  });

  return (
    <div>
      <PageHeader
        title="Placement policy"
        description="Campus-wide rules applied to drive eligibility and offer approvals."
        actions={
          <Button asChild variant="outline">
            <Link href="/officer/audit">
              <History className="h-4 w-4" /> Audit log
            </Link>
          </Button>
        }
      />
      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader>
            <CardTitle>Policy settings</CardTitle>
            <CardDescription>
              Changes apply to future eligibility evaluations and offer decisions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PolicyForm
              policy={{
                maxOffersPerStudent: policy.maxOffersPerStudent,
                blockedPlacedTiers: policy.blockedPlacedTiers,
                dreamOfferEnabled: policy.dreamOfferEnabled,
                minimumDreamOfferIncrease: policy.minimumDreamOfferIncrease,
                requireVerifiedProfileDefault: policy.requireVerifiedProfileDefault,
              }}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent changes</CardTitle>
          </CardHeader>
          <CardContent>
            {updates.length === 0 ? (
              <p className="text-sm text-muted-foreground">No policy changes recorded.</p>
            ) : (
              <div className="space-y-3">
                {updates.map((update) => (
                  <div key={update.id} className="text-sm">
                    <p className="font-medium">{update.actor?.name ?? "System"}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(update.createdAt)}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
