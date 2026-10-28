"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Loader2, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { SKILL_CATEGORIES, SKILL_CATEGORY_LABELS, type SkillCategory } from "@/lib/constants";
import {
  addSkillAction,
  removeSkillAction,
  setTargetRoleAction,
  updateSkillAction,
} from "@/server/actions/student";

type CatalogSkill = { id: string; name: string; category: string };
type StudentSkillRow = {
  id: string;
  skillId: string;
  name: string;
  category: string;
  proficiency: number;
  evidence: string | null;
  isVerified: boolean;
};

type SkillsManagerProps = {
  catalog: CatalogSkill[];
  skills: StudentSkillRow[];
  roleProfiles: { id: string; name: string }[];
  targetRoleProfileId: string | null;
};

export function SkillsManager({ catalog, skills, roleProfiles, targetRoleProfileId }: SkillsManagerProps) {
  const router = useRouter();
  const [targetRole, setTargetRole] = useState(targetRoleProfileId ?? "");
  const [savingTarget, setSavingTarget] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function saveTargetRole() {
    setSavingTarget(true);
    const result = await setTargetRoleAction({ roleProfileId: targetRole });
    setSavingTarget(false);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success("Target role updated.");
    router.refresh();
  }

  async function add(formData: FormData) {
    setBusy(true);
    const result = await addSkillAction({
      skillId: String(formData.get("skillId") ?? ""),
      proficiency: String(formData.get("proficiency") ?? ""),
      evidence: String(formData.get("evidence") ?? ""),
    });
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success("Skill added.");
    router.refresh();
  }

  async function update(id: string, formData: FormData) {
    setBusy(true);
    const result = await updateSkillAction({
      studentSkillId: id,
      skillId: String(formData.get("skillId") ?? ""),
      proficiency: String(formData.get("proficiency") ?? ""),
      evidence: String(formData.get("evidence") ?? ""),
    });
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success("Skill updated.");
    setEditingId(null);
    router.refresh();
  }

  async function remove(id: string) {
    if (!window.confirm("Remove this skill from your profile? Your proficiency history is kept.")) return;
    setBusy(true);
    const result = await removeSkillAction({ studentSkillId: id });
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success("Skill removed.");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border p-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="space-y-2">
            <Label htmlFor="targetRole">Target role</Label>
            <Select
              id="targetRole"
              value={targetRole}
              onChange={(event) => setTargetRole(event.target.value)}
            >
              <option value="">Not selected</option>
              {roleProfiles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </Select>
          </div>
          <Button type="button" variant="outline" onClick={saveTargetRole} disabled={savingTarget}>
            {savingTarget ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save target
          </Button>
        </div>
      </div>

      <section className="rounded-xl border p-4">
        <h2 className="flex items-center gap-2 font-semibold">
          <Plus className="h-4 w-4" /> Add a skill
        </h2>
        <form
          action={add}
          className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-[1.2fr_0.6fr_1.5fr_auto]"
        >
          <div className="space-y-2">
            <Label htmlFor="new-skill">Skill</Label>
            <Select id="new-skill" name="skillId" required>
              <option value="">Choose…</option>
              {SKILL_CATEGORIES.map((category) => {
                const options = catalog.filter((skill) => skill.category === category);
                if (options.length === 0) return null;
                return (
                  <optgroup key={category} label={SKILL_CATEGORY_LABELS[category]}>
                    {options.map((skill) => (
                      <option key={skill.id} value={skill.id}>
                        {skill.name}
                      </option>
                    ))}
                  </optgroup>
                );
              })}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-proficiency">Level</Label>
            <Select id="new-proficiency" name="proficiency" defaultValue="3">
              {[1, 2, 3, 4, 5].map((level) => (
                <option key={level} value={level}>
                  {level} / 5
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-evidence">Evidence</Label>
            <Textarea
              id="new-evidence"
              name="evidence"
              rows={1}
              maxLength={500}
              placeholder="Project, certification, or coursework"
            />
          </div>
          <div className="flex items-end">
            <Button type="submit" disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add
            </Button>
          </div>
        </form>
      </section>

      {skills.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          No skills yet. Add at least five to improve your profile and eligibility.
        </p>
      ) : (
        <div className="space-y-3">
          {skills.map((skill) => (
            <div key={skill.id} className="rounded-xl border p-4">
              {editingId === skill.id ? (
                <form
                  action={(formData) => update(skill.id, formData)}
                  className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_0.5fr_1.5fr_auto]"
                >
                  <input type="hidden" name="skillId" value={skill.skillId} />
                  <div className="space-y-2">
                    <Label>Skill</Label>
                    <p className="flex h-10 items-center rounded-md border bg-muted/40 px-3 text-sm">
                      {skill.name}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`level-${skill.id}`}>Level</Label>
                    <Select id={`level-${skill.id}`} name="proficiency" defaultValue={String(skill.proficiency)}>
                      {[1, 2, 3, 4, 5].map((level) => (
                        <option key={level} value={level}>
                          {level} / 5
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`evidence-${skill.id}`}>Evidence</Label>
                    <Textarea
                      id={`evidence-${skill.id}`}
                      name="evidence"
                      rows={1}
                      maxLength={500}
                      defaultValue={skill.evidence ?? ""}
                    />
                  </div>
                  <div className="flex items-end gap-1">
                    <Button type="submit" size="sm" disabled={busy}>
                      <Save className="h-4 w-4" /> Save
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{skill.name}</p>
                      <Badge variant="outline">
                        {SKILL_CATEGORY_LABELS[skill.category as SkillCategory] ?? skill.category}
                      </Badge>
                      {skill.isVerified ? (
                        <Badge variant="success" className="gap-1">
                          <BadgeCheck className="h-3 w-3" /> Verified
                        </Badge>
                      ) : null}
                    </div>
                    {skill.evidence ? (
                      <p className="mt-1 text-sm text-muted-foreground">{skill.evidence}</p>
                    ) : (
                      <p className="mt-1 text-xs text-muted-foreground">No evidence added.</p>
                    )}
                    <div className="mt-2 flex max-w-xs items-center gap-2">
                      <Progress value={skill.proficiency * 20} className="h-1.5" />
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {skill.proficiency}/5
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button type="button" size="sm" variant="ghost" onClick={() => setEditingId(skill.id)}>
                      <Pencil className="h-4 w-4" /> Edit
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => remove(skill.id)}
                      disabled={busy}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
