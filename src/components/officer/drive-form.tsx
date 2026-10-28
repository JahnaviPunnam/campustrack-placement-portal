"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { BRANCHES, GRADUATION_YEARS, ROUND_TYPES, ROUND_TYPE_LABELS } from "@/lib/constants";
import { createDriveAction, updateDriveAction } from "@/server/actions/officer-drives";
import {
  createRecruiterDriveRequestAction,
  updateRecruiterDriveRequestAction,
} from "@/server/actions/recruiter";

type Option = { id: string; name: string; category?: string; tier?: number };

export type DriveFormInitial = {
  id?: string;
  companyId: string;
  title: string;
  roleTitle: string;
  description: string;
  location: string;
  package: string;
  tier: number;
  openings: string;
  deadline: string;
  minCgpa: string;
  maxBacklogs: string;
  allowedBranches: string[];
  allowedGraduationYears: number[];
  requireVerifiedProfile: boolean;
  requireResume: boolean;
  requiredSkills: { skillId: string; minProficiency: number; weight: number; isMandatory: boolean }[];
  rounds: {
    name: string;
    type: string;
    description: string;
    scheduledAt: string;
    durationMinutes: string;
    venue: string;
    meetingLink: string;
  }[];
};

export function DriveForm({
  companies,
  skills,
  initial,
  mode,
  scope = "officer",
  lockedCompanyId,
}: {
  companies: Option[];
  skills: Option[];
  initial: DriveFormInitial;
  mode: "create" | "edit";
  scope?: "officer" | "recruiter";
  lockedCompanyId?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tier, setTier] = useState(initial.tier);
  const [branches, setBranches] = useState<string[]>(initial.allowedBranches);
  const [years, setYears] = useState<number[]>(initial.allowedGraduationYears);
  const [skillRows, setSkillRows] = useState(initial.requiredSkills);
  const [rounds, setRounds] = useState(initial.rounds);

  const skillsById = useMemo(() => new Map(skills.map((skill) => [skill.id, skill])), [skills]);

  function toggleBranch(branch: string) {
    setBranches((current) =>
      current.includes(branch) ? current.filter((value) => value !== branch) : [...current, branch],
    );
  }

  function toggleYear(year: number) {
    setYears((current) =>
      current.includes(year) ? current.filter((value) => value !== year) : [...current, year].sort(),
    );
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const input = {
      ...(mode === "edit" && initial.id ? { driveId: initial.id } : {}),
      companyId: String(form.get("companyId") ?? ""),
      title: String(form.get("title") ?? ""),
      roleTitle: String(form.get("roleTitle") ?? ""),
      description: String(form.get("description") ?? ""),
      package: String(form.get("package") ?? ""),
      location: String(form.get("location") ?? ""),
      tier: String(tier),
      openings: String(form.get("openings") ?? ""),
      deadline: String(form.get("deadline") ?? ""),
      minCgpa: String(form.get("minCgpa") ?? ""),
      maxBacklogs: String(form.get("maxBacklogs") ?? ""),
      allowedBranches: branches,
      allowedGraduationYears: years,
      requireVerifiedProfile: form.get("requireVerifiedProfile") === "on",
      requireResume: form.get("requireResume") === "on",
      requiredSkills: skillRows,
      rounds: rounds.map((round) => ({
        name: round.name,
        type: round.type,
        description: round.description,
        scheduledAt: round.scheduledAt ? new Date(round.scheduledAt).toISOString() : "",
        durationMinutes: round.durationMinutes,
        venue: round.venue,
        meetingLink: round.meetingLink,
      })),
    };
    const result =
      scope === "recruiter"
        ? mode === "edit"
          ? await updateRecruiterDriveRequestAction(input)
          : await createRecruiterDriveRequestAction(input)
        : mode === "edit"
          ? await updateDriveAction(input)
          : await createDriveAction(input);
    setLoading(false);
    if (!result.ok) {
      setError(
        result.error.fieldErrors
          ? `${result.error.message} ${Object.values(result.error.fieldErrors).flat().join(" ")}`
          : result.error.message,
      );
      return;
    }
    toast.success(
      scope === "recruiter"
        ? mode === "edit"
          ? "Drive request resubmitted for approval."
          : "Drive request submitted for approval."
        : mode === "edit"
          ? "Drive updated."
          : "Drive created as a draft.",
    );
    const driveId =
      mode === "edit" && initial.id
        ? initial.id
        : result.data && "driveId" in result.data
          ? result.data.driveId
          : null;
    if (driveId) {
      router.push(scope === "recruiter" ? `/recruiter/drives/${driveId}` : `/officer/drives/${driveId}`);
    }
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Role and company</CardTitle>
          <CardDescription>The package tier controls placement policy checks.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Company">
            {lockedCompanyId ? (
              <>
                <input type="hidden" name="companyId" value={lockedCompanyId} />
                <Select value={lockedCompanyId} disabled>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </Select>
              </>
            ) : (
              <Select
                name="companyId"
                defaultValue={initial.companyId}
                required
                onChange={(event) => {
                  const company = companies.find((entry) => entry.id === event.target.value);
                  if (company?.tier) setTier(company.tier);
                }}
              >
                <option value="">Choose a company</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Placement tier">
            <Select value={String(tier)} onChange={(event) => setTier(Number(event.target.value))}>
              <option value="1">Tier 1 · Mass recruiter</option>
              <option value="2">Tier 2 · Standard</option>
              <option value="3">Tier 3 · Dream</option>
            </Select>
          </Field>
          <Field label="Drive title">
            <Input name="title" defaultValue={initial.title} required maxLength={160} placeholder="Campus Hiring 2026" />
          </Field>
          <Field label="Role title">
            <Input name="roleTitle" defaultValue={initial.roleTitle} required maxLength={100} placeholder="Software Engineer" />
          </Field>
          <Field label="Package (LPA)">
            <Input
              name="package"
              type="number"
              min="0.1"
              max="500"
              step="0.1"
              defaultValue={initial.package}
              required
            />
          </Field>
          <Field label="Location">
            <Input name="location" defaultValue={initial.location} required maxLength={100} />
          </Field>
          <Field label="Openings">
            <Input name="openings" type="number" min="1" defaultValue={initial.openings} placeholder="Optional" />
          </Field>
          <Field label="Application deadline">
            <Input name="deadline" type="date" defaultValue={initial.deadline} required />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Description">
              <Textarea name="description" defaultValue={initial.description} rows={4} maxLength={4000} />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Eligibility criteria</CardTitle>
          <CardDescription>Leave academic thresholds blank for no restriction.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Minimum CGPA">
              <Input name="minCgpa" type="number" min="0" max="10" step="0.1" defaultValue={initial.minCgpa} />
            </Field>
            <Field label="Maximum backlogs">
              <Input name="maxBacklogs" type="number" min="0" max="30" defaultValue={initial.maxBacklogs} />
            </Field>
          </div>
          <div>
            <Label>Allowed branches</Label>
            <p className="mb-2 text-xs text-muted-foreground">No selection means all branches.</p>
            <div className="flex flex-wrap gap-2">
              {BRANCHES.map((branch) => (
                <label
                  key={branch}
                  className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={branches.includes(branch)}
                    onChange={() => toggleBranch(branch)}
                    className="h-4 w-4 accent-primary"
                  />
                  {branch}
                </label>
              ))}
            </div>
          </div>
          <div>
            <Label>Allowed graduation years</Label>
            <p className="mb-2 text-xs text-muted-foreground">No selection means all years.</p>
            <div className="flex flex-wrap gap-2">
              {GRADUATION_YEARS.map((year) => (
                <label
                  key={year}
                  className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={years.includes(year)}
                    onChange={() => toggleYear(year)}
                    className="h-4 w-4 accent-primary"
                  />
                  {year}
                </label>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:gap-6">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="requireVerifiedProfile"
                defaultChecked={initial.requireVerifiedProfile}
                className="h-4 w-4 accent-primary"
              />
              Require verified profile
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="requireResume"
                defaultChecked={initial.requireResume}
                className="h-4 w-4 accent-primary"
              />
              Require resume
            </label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>Required skills</CardTitle>
              <CardDescription>Student match scores use these weights and levels.</CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setSkillRows((current) => [
                  ...current,
                  { skillId: "", minProficiency: 3, weight: 3, isMandatory: true },
                ])
              }
            >
              <Plus className="h-4 w-4" /> Add skill
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {skillRows.length === 0 ? (
            <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              Add at least one required skill.
            </p>
          ) : (
            <div className="space-y-3">
              {skillRows.map((row, index) => (
                <div key={index} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[2fr_0.8fr_0.8fr_auto_auto]">
                  <Select
                    value={row.skillId}
                    onChange={(event) =>
                      setSkillRows((current) =>
                        current.map((entry, entryIndex) =>
                          entryIndex === index ? { ...entry, skillId: event.target.value } : entry,
                        ),
                      )
                    }
                  >
                    <option value="">Choose skill</option>
                    {skills.map((skill) => (
                      <option key={skill.id} value={skill.id}>
                        {skill.name}
                        {skill.category ? ` · ${skill.category}` : ""}
                      </option>
                    ))}
                  </Select>
                  <Select
                    value={String(row.minProficiency)}
                    onChange={(event) =>
                      setSkillRows((current) =>
                        current.map((entry, entryIndex) =>
                          entryIndex === index ? { ...entry, minProficiency: Number(event.target.value) } : entry,
                        ),
                      )
                    }
                  >
                    {[1, 2, 3, 4, 5].map((level) => (
                      <option key={level} value={level}>
                        Level {level}
                      </option>
                    ))}
                  </Select>
                  <Select
                    value={String(row.weight)}
                    onChange={(event) =>
                      setSkillRows((current) =>
                        current.map((entry, entryIndex) =>
                          entryIndex === index ? { ...entry, weight: Number(event.target.value) } : entry,
                        ),
                      )
                    }
                  >
                    {[1, 2, 3, 4, 5].map((weight) => (
                      <option key={weight} value={weight}>
                        Weight {weight}
                      </option>
                    ))}
                  </Select>
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={row.isMandatory}
                      onChange={(event) =>
                        setSkillRows((current) =>
                          current.map((entry, entryIndex) =>
                            entryIndex === index
                              ? { ...entry, isMandatory: event.target.checked }
                              : entry,
                          ),
                        )
                      }
                      className="h-4 w-4 accent-primary"
                    />
                    Mandatory
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setSkillRows((current) => current.filter((_, entryIndex) => entryIndex !== index))}
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">Remove skill</span>
                  </Button>
                  {row.skillId ? (
                    <Badge variant="outline" className="sm:col-span-5">
                      {skillsById.get(row.skillId)?.name}
                    </Badge>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>Rounds</CardTitle>
              <CardDescription>Optional. Results can be recorded once the drive is live.</CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setRounds((current) => [
                  ...current,
                  {
                    name: "",
                    type: "TECHNICAL",
                    description: "",
                    scheduledAt: "",
                    durationMinutes: "",
                    venue: "",
                    meetingLink: "",
                  },
                ])
              }
            >
              <Plus className="h-4 w-4" /> Add round
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {rounds.length === 0 ? (
            <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              No rounds added yet.
            </p>
          ) : (
            <div className="space-y-4">
              {rounds.map((round, index) => (
                <div key={index} className="space-y-3 rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">Round {index + 1}</p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setRounds((current) => current.filter((_, entryIndex) => entryIndex !== index))}
                    >
                      <Trash2 className="h-4 w-4" /> Remove
                    </Button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input
                      value={round.name}
                      onChange={(event) =>
                        setRounds((current) =>
                          current.map((entry, entryIndex) =>
                            entryIndex === index ? { ...entry, name: event.target.value } : entry,
                          ),
                        )
                      }
                      placeholder="Round name"
                      maxLength={100}
                    />
                    <Select
                      value={round.type}
                      onChange={(event) =>
                        setRounds((current) =>
                          current.map((entry, entryIndex) =>
                            entryIndex === index ? { ...entry, type: event.target.value } : entry,
                          ),
                        )
                      }
                    >
                      {ROUND_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {ROUND_TYPE_LABELS[type]}
                        </option>
                      ))}
                    </Select>
                    <Input
                      type="datetime-local"
                      value={round.scheduledAt}
                      onChange={(event) =>
                        setRounds((current) =>
                          current.map((entry, entryIndex) =>
                            entryIndex === index ? { ...entry, scheduledAt: event.target.value } : entry,
                          ),
                        )
                      }
                    />
                    <Input
                      type="number"
                      min="5"
                      max="600"
                      value={round.durationMinutes}
                      onChange={(event) =>
                        setRounds((current) =>
                          current.map((entry, entryIndex) =>
                            entryIndex === index ? { ...entry, durationMinutes: event.target.value } : entry,
                          ),
                        )
                      }
                      placeholder="Duration (minutes)"
                    />
                    <Input
                      value={round.venue}
                      onChange={(event) =>
                        setRounds((current) =>
                          current.map((entry, entryIndex) =>
                            entryIndex === index ? { ...entry, venue: event.target.value } : entry,
                          ),
                        )
                      }
                      placeholder="Venue"
                      maxLength={160}
                    />
                    <Input
                      type="url"
                      value={round.meetingLink}
                      onChange={(event) =>
                        setRounds((current) =>
                          current.map((entry, entryIndex) =>
                            entryIndex === index ? { ...entry, meetingLink: event.target.value } : entry,
                          ),
                        )
                      }
                      placeholder="Meeting link (optional)"
                    />
                  </div>
                  <Textarea
                    value={round.description}
                    onChange={(event) =>
                      setRounds((current) =>
                        current.map((entry, entryIndex) =>
                          entryIndex === index ? { ...entry, description: event.target.value } : entry,
                        ),
                      )
                    }
                    rows={2}
                    placeholder="Round details"
                    maxLength={500}
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Button type="submit" disabled={loading}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        {scope === "recruiter"
          ? mode === "edit"
            ? "Resubmit for approval"
            : "Submit for approval"
          : mode === "edit"
            ? "Save drive"
            : "Create draft drive"}
      </Button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
