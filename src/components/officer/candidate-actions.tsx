"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, RotateCcw, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  APPLICATION_STATUSES,
  APPLICATION_STATUS_LABELS,
  ROUND_RESULT_STATUSES,
  ROUND_RESULT_LABELS,
} from "@/lib/constants";
import {
  createOfferAction,
  recordRoundResultAction,
  revokeOfferAction,
  setApplicationStatusAction,
} from "@/server/actions/officer-drives";

type RoundOption = {
  id: string;
  name: string;
  order: number;
  resultStatus?: string;
  resultScore?: number | null;
};

type OfferState = {
  id: string;
  status: string;
  package: number;
} | null;

export function CandidateActions({
  applicationId,
  status,
  studentName,
  roleTitle,
  packageValue,
  rounds,
  offer,
}: {
  applicationId: string;
  status: string;
  studentName: string;
  roleTitle: string;
  packageValue: number;
  rounds: RoundOption[];
  offer: OfferState;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("status");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [nextStatus, setNextStatus] = useState(status);
  const [statusReason, setStatusReason] = useState("");
  const [roundId, setRoundId] = useState(rounds[0]?.id ?? "");
  const [roundStatus, setRoundStatus] = useState("PASSED");
  const [score, setScore] = useState("");
  const [feedback, setFeedback] = useState("");
  const [offerPackage, setOfferPackage] = useState(String(packageValue));
  const [offerRole, setOfferRole] = useState(roleTitle);
  const [offerLocation, setOfferLocation] = useState("");
  const [joiningDate, setJoiningDate] = useState("");
  const [offerNotes, setOfferNotes] = useState("");
  const [revokeReason, setRevokeReason] = useState("");

  const selectedRound = rounds.find((round) => round.id === roundId);

  async function saveStatus() {
    setLoading(true);
    setError(null);
    const result = await setApplicationStatusAction({
      applicationId,
      status: nextStatus,
      reason: statusReason,
    });
    setLoading(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    toast.success("Application status updated.");
    setOpen(false);
    router.refresh();
  }

  async function saveRound() {
    if (!roundId) {
      setError("Choose a round.");
      return;
    }
    setLoading(true);
    setError(null);
    const result = await recordRoundResultAction({
      applicationId,
      roundId,
      status: roundStatus,
      score,
      feedback,
      notes: "",
    });
    setLoading(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    toast.success("Round result saved.");
    setOpen(false);
    router.refresh();
  }

  async function createOffer() {
    setLoading(true);
    setError(null);
    const result = await createOfferAction({
      applicationId,
      package: offerPackage,
      roleTitle: offerRole,
      location: offerLocation,
      joiningDate,
      notes: offerNotes,
    });
    setLoading(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    toast.success(
      result.data.dreamUpgrade
        ? "Offer recorded as a policy-approved dream upgrade."
        : "Offer recorded.",
    );
    setOpen(false);
    router.refresh();
  }

  async function revokeOffer() {
    if (!offer) return;
    setLoading(true);
    setError(null);
    const result = await revokeOfferAction({ offerId: offer.id, reason: revokeReason });
    setLoading(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    toast.success("Offer revoked.");
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Settings2 className="h-3.5 w-3.5" /> Manage
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{studentName}</DialogTitle>
            <DialogDescription>Update status, round result, or offer.</DialogDescription>
          </DialogHeader>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="status">Status</TabsTrigger>
              <TabsTrigger value="round">Round result</TabsTrigger>
              <TabsTrigger value="offer">Offer</TabsTrigger>
            </TabsList>

            <TabsContent value="status" className="space-y-3">
              <div className="space-y-2">
                <Label>Application status</Label>
                <Select value={nextStatus} onChange={(event) => setNextStatus(event.target.value)}>
                  {APPLICATION_STATUSES.filter((entry) => entry !== "OFFERED").map((entry) => (
                    <option key={entry} value={entry}>
                      {APPLICATION_STATUS_LABELS[entry]}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Reason / feedback</Label>
                <Textarea
                  value={statusReason}
                  onChange={(event) => setStatusReason(event.target.value)}
                  rows={3}
                  maxLength={500}
                  placeholder="Shown to the student when rejecting."
                />
              </div>
              <Button type="button" onClick={() => void saveStatus()} disabled={loading || nextStatus === status}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Update status
              </Button>
            </TabsContent>

            <TabsContent value="round" className="space-y-3">
              {rounds.length === 0 ? (
                <p className="text-sm text-muted-foreground">Add a round first.</p>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>Round</Label>
                    <Select value={roundId} onChange={(event) => setRoundId(event.target.value)}>
                      {rounds.map((round) => (
                        <option key={round.id} value={round.id}>
                          #{round.order} {round.name}
                          {round.resultStatus ? ` · ${round.resultStatus}` : ""}
                        </option>
                      ))}
                    </Select>
                    {selectedRound?.resultStatus ? (
                      <p className="text-xs text-muted-foreground">
                        Existing result: {selectedRound.resultStatus}
                        {selectedRound.resultScore !== null && selectedRound.resultScore !== undefined
                          ? ` · score ${selectedRound.resultScore}`
                          : ""}
                      </p>
                    ) : null}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Result</Label>
                      <Select value={roundStatus} onChange={(event) => setRoundStatus(event.target.value)}>
                        {ROUND_RESULT_STATUSES.map((entry) => (
                          <option key={entry} value={entry}>
                            {ROUND_RESULT_LABELS[entry]}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Score</Label>
                      <Input
                        type="number"
                        min="0"
                        max="1000"
                        value={score}
                        onChange={(event) => setScore(event.target.value)}
                        placeholder="Optional"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Feedback</Label>
                    <Textarea
                      value={feedback}
                      onChange={(event) => setFeedback(event.target.value)}
                      rows={3}
                      maxLength={2000}
                    />
                  </div>
                  <Button type="button" onClick={() => void saveRound()} disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    Save result
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Failed or absent results reject the application. Passed results advance to the next
                    round automatically.
                  </p>
                </>
              )}
            </TabsContent>

            <TabsContent value="offer" className="space-y-3">
              {offer ? (
                <div className="space-y-3">
                  <div className="rounded-lg border p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium">Existing offer</p>
                      <Badge variant={offer.status === "ACCEPTED" ? "success" : "outline"}>
                        {offer.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">Package: {offer.package.toFixed(1)} LPA</p>
                  </div>
                  {offer.status !== "REVOKED" ? (
                    <>
                      <div className="space-y-2">
                        <Label>Revoke reason</Label>
                        <Textarea
                          value={revokeReason}
                          onChange={(event) => setRevokeReason(event.target.value)}
                          rows={2}
                          maxLength={500}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="destructive"
                        onClick={() => void revokeOffer()}
                        disabled={loading}
                      >
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                        Revoke offer
                      </Button>
                    </>
                  ) : null}
                </div>
              ) : (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Package (LPA)</Label>
                      <Input
                        type="number"
                        min="0.1"
                        max="500"
                        step="0.1"
                        value={offerPackage}
                        onChange={(event) => setOfferPackage(event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Role</Label>
                      <Input value={offerRole} onChange={(event) => setOfferRole(event.target.value)} maxLength={100} />
                    </div>
                    <div className="space-y-2">
                      <Label>Location</Label>
                      <Input
                        value={offerLocation}
                        onChange={(event) => setOfferLocation(event.target.value)}
                        maxLength={100}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Joining date</Label>
                      <Input
                        type="date"
                        value={joiningDate}
                        onChange={(event) => setJoiningDate(event.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <Textarea
                      value={offerNotes}
                      onChange={(event) => setOfferNotes(event.target.value)}
                      rows={2}
                      maxLength={1000}
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={() => void createOffer()}
                    disabled={loading || !offerPackage || !offerRole || !offerLocation}
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    Record offer
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Placement policy is enforced. Dream upgrades replace existing accepted offers.
                  </p>
                </>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}
