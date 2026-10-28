"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, MessageSquare, Settings2, UserCheck, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  ROUND_RESULT_LABELS,
  ROUND_RESULT_STATUSES,
} from "@/lib/constants";
import {
  recordRecruiterRoundResultAction,
  rejectRecruiterApplicationAction,
  shortlistCandidateAction,
  updateRecruiterFeedbackAction,
} from "@/server/actions/recruiter";

type RoundOption = {
  id: string;
  name: string;
  order: number;
  resultStatus?: string;
  resultScore?: number | null;
};

export function RecruiterPipelineActions({
  driveId,
  applicationId,
  studentProfileId,
  status,
  rounds,
  feedback,
}: {
  driveId: string;
  applicationId: string;
  studentProfileId: string;
  status: string;
  rounds: RoundOption[];
  feedback: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [tab, setTab] = useState("round");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roundId, setRoundId] = useState(rounds[0]?.id ?? "");
  const [roundStatus, setRoundStatus] = useState("PASSED");
  const [score, setScore] = useState("");
  const [roundFeedback, setRoundFeedback] = useState("");
  const [feedbackDraft, setFeedbackDraft] = useState(feedback ?? "");
  const [rejectReason, setRejectReason] = useState("");

  const active = ["APPLIED", "SHORTLISTED", "IN_PROCESS"].includes(status);
  if (!active) return null;

  const selectedRound = rounds.find((round) => round.id === roundId);
  const canRecordResult = ["SHORTLISTED", "IN_PROCESS"].includes(status);

  async function saveRound() {
    if (!roundId) {
      setError("Choose a round.");
      return;
    }
    setLoading(true);
    setError(null);
    const result = await recordRecruiterRoundResultAction({
      applicationId,
      roundId,
      status: roundStatus,
      score,
      slotAt: "",
      notes: "",
      feedback: roundFeedback,
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

  async function saveFeedback() {
    setLoading(true);
    setError(null);
    const result = await updateRecruiterFeedbackAction({ applicationId, feedback: feedbackDraft });
    setLoading(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    toast.success("Feedback saved.");
    setOpen(false);
    router.refresh();
  }

  async function reject() {
    setLoading(true);
    setError(null);
    const result = await rejectRecruiterApplicationAction({ applicationId, reason: rejectReason });
    setLoading(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    toast.success("Application rejected.");
    setRejectOpen(false);
    router.refresh();
  }

  return (
    <>
      <div className="flex flex-wrap gap-1">
        {status === "APPLIED" ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={async () => {
              setLoading(true);
              const result = await shortlistCandidateAction({
                driveId,
                studentProfileId,
                note: "",
              });
              setLoading(false);
              if (!result.ok) {
                toast.error(result.error.message);
                return;
              }
              toast.success("Candidate shortlisted.");
              router.refresh();
            }}
            disabled={loading}
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserCheck className="h-3.5 w-3.5" />}
            Shortlist
          </Button>
        ) : null}
        {status === "SHORTLISTED" || status === "IN_PROCESS" ? (
          <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
            <Settings2 className="h-3.5 w-3.5" /> Manage
          </Button>
        ) : null}
        <Button type="button" size="sm" variant="ghost" onClick={() => setRejectOpen(true)}>
          <XCircle className="h-3.5 w-3.5" /> Reject
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Candidate stage</DialogTitle>
            <DialogDescription>Record interview results or share feedback with the candidate.</DialogDescription>
          </DialogHeader>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="round">Round result</TabsTrigger>
              <TabsTrigger value="feedback">Feedback</TabsTrigger>
            </TabsList>
            <TabsContent value="round" className="space-y-3">
              {rounds.length === 0 ? (
                <p className="text-sm text-muted-foreground">No rounds are configured for this drive yet.</p>
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
                    <Label>Round feedback</Label>
                    <Textarea
                      value={roundFeedback}
                      onChange={(event) => setRoundFeedback(event.target.value)}
                      rows={3}
                      maxLength={2000}
                    />
                  </div>
                  <Button type="button" onClick={() => void saveRound()} disabled={loading || !canRecordResult}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    Save result
                  </Button>
                </>
              )}
            </TabsContent>
            <TabsContent value="feedback" className="space-y-3">
              <div className="space-y-2">
                <Label>Feedback shown to the candidate</Label>
                <Textarea
                  value={feedbackDraft}
                  onChange={(event) => setFeedbackDraft(event.target.value)}
                  rows={5}
                  maxLength={2000}
                  placeholder="Interview observations, strengths, or next steps."
                />
              </div>
              <Button type="button" onClick={() => void saveFeedback()} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
                Save feedback
              </Button>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject application</DialogTitle>
            <DialogDescription>The reason is shown to the student.</DialogDescription>
          </DialogHeader>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <Textarea
            value={rejectReason}
            onChange={(event) => setRejectReason(event.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Why is this candidate not moving forward?"
          />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={() => void reject()} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
