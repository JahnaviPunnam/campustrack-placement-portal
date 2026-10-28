"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
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
import { Textarea } from "@/components/ui/textarea";
import { ROUND_STATUSES, ROUND_TYPES, ROUND_TYPE_LABELS } from "@/lib/constants";
import { formatDateTime } from "@/lib/formatting";
import {
  createRoundAction,
  removeRoundAction,
  updateRoundAction,
} from "@/server/actions/officer-drives";

export type RoundItem = {
  id: string;
  name: string;
  type: string;
  status: string;
  order: number;
  scheduledAt: string | null;
  durationMinutes: number | null;
  venue: string | null;
  meetingLink: string | null;
  description: string | null;
  resultCount: number;
  currentCount: number;
};

type RoundDraft = {
  name: string;
  type: string;
  status: string;
  description: string;
  scheduledAt: string;
  durationMinutes: string;
  venue: string;
  meetingLink: string;
};

const EMPTY: RoundDraft = {
  name: "",
  type: "TECHNICAL",
  status: "PLANNED",
  description: "",
  scheduledAt: "",
  durationMinutes: "",
  venue: "",
  meetingLink: "",
};

export function RoundManager({ driveId, rounds }: { driveId: string; rounds: RoundItem[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<RoundDraft>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  function startCreate() {
    setEditingId(null);
    setDraft(EMPTY);
    setError(null);
    setOpen(true);
  }

  function startEdit(round: RoundItem) {
    setEditingId(round.id);
    setDraft({
      name: round.name,
      type: round.type,
      status: round.status,
      description: round.description ?? "",
      scheduledAt: round.scheduledAt ? round.scheduledAt.slice(0, 16) : "",
      durationMinutes: round.durationMinutes?.toString() ?? "",
      venue: round.venue ?? "",
      meetingLink: round.meetingLink ?? "",
    });
    setError(null);
    setOpen(true);
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const input = {
      driveId,
      ...(editingId ? { roundId: editingId } : {}),
      name: draft.name,
      type: draft.type,
      status: draft.status,
      description: draft.description,
      scheduledAt: draft.scheduledAt ? new Date(draft.scheduledAt).toISOString() : "",
      durationMinutes: draft.durationMinutes,
      venue: draft.venue,
      meetingLink: draft.meetingLink,
    };
    const result = editingId ? await updateRoundAction(input) : await createRoundAction(input);
    setLoading(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    toast.success(editingId ? "Round updated." : "Round added.");
    setOpen(false);
    router.refresh();
  }

  async function remove(roundId: string) {
    setRemoving(roundId);
    const result = await removeRoundAction({ roundId });
    setRemoving(null);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success("Round removed.");
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{rounds.length} round(s)</p>
        <Button type="button" size="sm" variant="outline" onClick={startCreate}>
          <Plus className="h-4 w-4" /> Add round
        </Button>
      </div>

      {rounds.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          No rounds yet. Add interview stages before recording results.
        </p>
      ) : (
        <div className="divide-y rounded-lg border">
          {rounds.map((round) => (
            <div key={round.id} className="flex flex-wrap items-start justify-between gap-3 p-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">#{round.order}</span>
                  <p className="font-medium">{round.name}</p>
                  <Badge variant="outline">{ROUND_TYPE_LABELS[round.type as keyof typeof ROUND_TYPE_LABELS]}</Badge>
                  <Badge
                    variant={
                      round.status === "COMPLETED"
                        ? "success"
                        : round.status === "CANCELLED"
                          ? "destructive"
                          : round.status === "SCHEDULED"
                            ? "info"
                            : "secondary"
                    }
                  >
                    {round.status}
                  </Badge>
                </div>
                <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <CalendarClock className="h-3.5 w-3.5" />
                  {formatDateTime(round.scheduledAt)}
                  {round.venue ? ` · ${round.venue}` : ""}
                  {round.durationMinutes ? ` · ${round.durationMinutes} min` : ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  {round.resultCount} result(s) · {round.currentCount} candidate(s) at this stage
                </p>
              </div>
              <div className="flex gap-1">
                <Button type="button" variant="ghost" size="sm" onClick={() => startEdit(round)}>
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => void remove(round.id)}
                  disabled={removing === round.id || round.resultCount > 0 || round.currentCount > 0}
                >
                  {removing === round.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={save} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit round" : "Add round"}</DialogTitle>
              <DialogDescription>
                Rounds are ordered automatically. Scheduling changes notify candidates in the pipeline.
              </DialogDescription>
            </DialogHeader>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="round-name">Name</Label>
                <Input
                  id="round-name"
                  value={draft.name}
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                  required
                  maxLength={100}
                />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value })}>
                  {ROUND_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {ROUND_TYPE_LABELS[type]}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value })}>
                  {ROUND_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="round-schedule">Scheduled at</Label>
                <Input
                  id="round-schedule"
                  type="datetime-local"
                  value={draft.scheduledAt}
                  onChange={(event) => setDraft({ ...draft, scheduledAt: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="round-duration">Duration (minutes)</Label>
                <Input
                  id="round-duration"
                  type="number"
                  min="5"
                  max="600"
                  value={draft.durationMinutes}
                  onChange={(event) => setDraft({ ...draft, durationMinutes: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="round-venue">Venue</Label>
                <Input
                  id="round-venue"
                  value={draft.venue}
                  onChange={(event) => setDraft({ ...draft, venue: event.target.value })}
                  maxLength={160}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="round-link">Meeting link</Label>
                <Input
                  id="round-link"
                  type="url"
                  value={draft.meetingLink}
                  onChange={(event) => setDraft({ ...draft, meetingLink: event.target.value })}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="round-description">Description</Label>
                <Textarea
                  id="round-description"
                  value={draft.description}
                  onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                  rows={3}
                  maxLength={500}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {editingId ? "Save round" : "Add round"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
