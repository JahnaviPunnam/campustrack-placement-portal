"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updatePolicyAction } from "@/server/actions/officer-companies";

export function PolicyForm({
  policy,
}: {
  policy: {
    maxOffersPerStudent: number;
    blockedPlacedTiers: string;
    dreamOfferEnabled: boolean;
    minimumDreamOfferIncrease: number;
    requireVerifiedProfileDefault: boolean;
  };
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const result = await updatePolicyAction({
      maxOffersPerStudent: String(form.get("maxOffersPerStudent") ?? ""),
      blockedPlacedTiers: String(form.get("blockedPlacedTiers") ?? ""),
      dreamOfferEnabled: form.get("dreamOfferEnabled") === "on",
      minimumDreamOfferIncrease: String(form.get("minimumDreamOfferIncrease") ?? ""),
      requireVerifiedProfileDefault: form.get("requireVerifiedProfileDefault") === "on",
    });
    setLoading(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    toast.success("Placement policy updated.");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="maxOffers">Maximum accepted offers per student</Label>
          <Input
            id="maxOffers"
            name="maxOffersPerStudent"
            type="number"
            min="1"
            max="5"
            defaultValue={policy.maxOffersPerStudent}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="blockedTiers">Blocked tiers after placement</Label>
          <Input
            id="blockedTiers"
            name="blockedPlacedTiers"
            defaultValue={policy.blockedPlacedTiers}
            placeholder="1,2"
          />
          <p className="text-xs text-muted-foreground">Comma-separated tiers, for example 1,2.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="dreamIncrease">Minimum dream offer increase (%)</Label>
          <Input
            id="dreamIncrease"
            name="minimumDreamOfferIncrease"
            type="number"
            min="0"
            max="100"
            step="0.1"
            defaultValue={policy.minimumDreamOfferIncrease}
          />
        </div>
      </div>
      <div className="space-y-3">
        <label className="flex cursor-pointer items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="dreamOfferEnabled"
            defaultChecked={policy.dreamOfferEnabled}
            className="mt-0.5 h-4 w-4 accent-primary"
          />
          <span>
            Allow dream-offer upgrades
            <span className="block text-xs text-muted-foreground">
              A placed student may accept a higher-package offer when it clears the minimum increase.
            </span>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="requireVerifiedProfileDefault"
            defaultChecked={policy.requireVerifiedProfileDefault}
            className="mt-0.5 h-4 w-4 accent-primary"
          />
          <span>
            Require verified profiles on new drives
            <span className="block text-xs text-muted-foreground">
              Default value for new eligibility rules. Officers can still override per drive.
            </span>
          </span>
        </label>
      </div>
      <Button type="submit" disabled={loading}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Save policy
      </Button>
    </form>
  );
}
