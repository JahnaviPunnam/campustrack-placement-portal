"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bookmark, BookmarkCheck, CheckCircle2, Loader2, Send } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { APPLICATION_STATUS_LABELS, type ApplicationStatus } from "@/lib/constants";
import { formatCgpa } from "@/lib/formatting";
import {
  removeSavedCandidateAction,
  saveCandidateAction,
  shortlistCandidateAction,
} from "@/server/actions/recruiter";

type Candidate = {
  id: string;
  name: string;
  rollNumber: string;
  branch: string;
  graduationYear: number;
  cgpa: number | null;
  backlogs: number;
  headline: string | null;
  location: string | null;
  targetRole: string | null;
  resumeAvailable: boolean;
  isSaved: boolean;
  savedNote: string | null;
  skills: { name: string; proficiency: number; isVerified: boolean }[];
  applicationStatus: string | null;
  eligible: boolean | null;
  matchesSkills: boolean | null;
  reasons: string[];
  overrideReason: string | null;
  matchScore: number | null;
};

type Drive = { id: string; title: string; roleTitle: string };

export function CandidateCard({
  candidate,
  drives,
  rankedForDrive,
}: {
  candidate: Candidate;
  drives: Drive[];
  rankedForDrive: boolean;
}) {
  const router = useRouter();
  const [saveOpen, setSaveOpen] = useState(false);
  const [shortlistOpen, setShortlistOpen] = useState(false);
  const [note, setNote] = useState(candidate.savedNote ?? "");
  const [driveId, setDriveId] = useState(drives[0]?.id ?? "");
  const [shortlistNote, setShortlistNote] = useState("");
  const [loading, setLoading] = useState(false);

  const terminalStatus = ["SHORTLISTED", "IN_PROCESS", "OFFERED", "REJECTED"].includes(
    candidate.applicationStatus ?? "",
  );

  async function save() {
    setLoading(true);
    const result = await saveCandidateAction({ studentProfileId: candidate.id, note });
    setLoading(false);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success("Candidate saved.");
    setSaveOpen(false);
    router.refresh();
  }

  async function removeSaved() {
    setLoading(true);
    const result = await removeSavedCandidateAction({ studentProfileId: candidate.id });
    setLoading(false);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success("Removed from saved candidates.");
    setSaveOpen(false);
    router.refresh();
  }

  async function shortlist() {
    if (!driveId) {
      toast.error("Choose a drive.");
      return;
    }
    setLoading(true);
    const result = await shortlistCandidateAction({
      driveId,
      studentProfileId: candidate.id,
      note: shortlistNote,
    });
    setLoading(false);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success("Candidate shortlisted.");
    setShortlistOpen(false);
    router.refresh();
  }

  return (
    <article className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{candidate.name}</h3>
            {candidate.isSaved ? <Badge variant="outline">Saved</Badge> : null}
            {candidate.applicationStatus ? (
              <Badge variant="info">
                {APPLICATION_STATUS_LABELS[candidate.applicationStatus as ApplicationStatus] ??
                  candidate.applicationStatus}
              </Badge>
            ) : null}
            {candidate.eligible !== null ? (
              <Badge variant={candidate.eligible ? "success" : "warning"}>
                {candidate.eligible ? "Drive eligible" : "Not eligible"}
              </Badge>
            ) : null}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {candidate.rollNumber} · {candidate.branch} · {candidate.graduationYear} · CGPA{" "}
            {formatCgpa(candidate.cgpa)} · {candidate.backlogs} backlogs
          </p>
          {candidate.headline ? <p className="mt-1 text-sm">{candidate.headline}</p> : null}
          {candidate.targetRole ? (
            <p className="text-xs text-muted-foreground">Target role: {candidate.targetRole}</p>
          ) : null}
        </div>
        <div className="text-right">
          {candidate.matchScore !== null ? (
            <p className="text-lg font-semibold">{candidate.matchScore}%</p>
          ) : (
            <p className="text-sm text-muted-foreground">No score filter</p>
          )}
          <p className="text-[11px] text-muted-foreground">
            {rankedForDrive ? "drive match" : "skill coverage"}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {candidate.skills.slice(0, 8).map((skill) => (
          <Badge key={skill.name} variant={skill.isVerified ? "success" : "outline"}>
            {skill.name} · {skill.proficiency}
          </Badge>
        ))}
        {candidate.skills.length > 8 ? (
          <Badge variant="secondary">+{candidate.skills.length - 8} more</Badge>
        ) : null}
      </div>

      {candidate.reasons.length > 0 ? (
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">{candidate.reasons[0]}</p>
      ) : null}
      {candidate.overrideReason ? (
        <p className="mt-1 text-xs text-sky-700 dark:text-sky-300">
          Officer override: {candidate.overrideReason}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => setSaveOpen(true)}>
          {candidate.isSaved ? <BookmarkCheck className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5" />}
          {candidate.isSaved ? "Saved note" : "Save"}
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={() => setShortlistOpen(true)}
          disabled={drives.length === 0 || terminalStatus}
        >
          <Send className="h-3.5 w-3.5" /> Shortlist
        </Button>
        {candidate.resumeAvailable ? (
          <Button asChild size="sm" variant="ghost">
            <a href={`/api/resumes/${candidate.id}`} target="_blank" rel="noreferrer">
              Resume
            </a>
          </Button>
        ) : (
          <span className="self-center text-xs text-muted-foreground">No resume</span>
        )}
      </div>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{candidate.isSaved ? "Saved candidate" : "Save candidate"}</DialogTitle>
            <DialogDescription>Private to you unless another recruiter saves them too.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor={`saved-note-${candidate.id}`}>Note</Label>
            <Textarea
              id={`saved-note-${candidate.id}`}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Why is this candidate worth revisiting?"
            />
          </div>
          <DialogFooter>
            {candidate.isSaved ? (
              <Button type="button" variant="destructive" onClick={() => void removeSaved()} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Remove
              </Button>
            ) : null}
            <Button type="button" onClick={() => void save()} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={shortlistOpen} onOpenChange={setShortlistOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Shortlist {candidate.name}</DialogTitle>
            <DialogDescription>
              Adds the candidate to a live drive. Eligibility and placement policy are checked again.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Drive</Label>
              <Select value={driveId} onChange={(event) => setDriveId(event.target.value)}>
                {drives.map((drive) => (
                  <option key={drive.id} value={drive.id}>
                    {drive.title} · {drive.roleTitle}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Note to candidate (optional)</Label>
              <Textarea
                value={shortlistNote}
                onChange={(event) => setShortlistNote(event.target.value)}
                rows={2}
                maxLength={500}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setShortlistOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void shortlist()} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Shortlist
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </article>
  );
}
