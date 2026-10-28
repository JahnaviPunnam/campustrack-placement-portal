"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { BRANCHES, GRADUATION_YEARS } from "@/lib/constants";
import { updateProfileAction } from "@/server/actions/student";

type ProfileFormProps = {
  email: string;
  name: string;
  phone: string | null;
  branch: string;
  graduationYear: number;
  cgpa: number | null;
  backlogs: number;
  headline: string | null;
  location: string | null;
  githubUrl: string | null;
  linkedinUrl: string | null;
  targetRoleProfileId: string | null;
  roleProfiles: { id: string; name: string }[];
};

export function ProfileForm(props: ProfileFormProps) {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setErrors({});
    setFormError(null);
    const form = new FormData(event.currentTarget);
    const result = await updateProfileAction({
      name: String(form.get("name") ?? ""),
      phone: String(form.get("phone") ?? ""),
      branch: String(form.get("branch") ?? ""),
      graduationYear: String(form.get("graduationYear") ?? ""),
      cgpa: String(form.get("cgpa") ?? ""),
      backlogs: String(form.get("backlogs") ?? "0"),
      headline: String(form.get("headline") ?? ""),
      location: String(form.get("location") ?? ""),
      githubUrl: String(form.get("githubUrl") ?? ""),
      linkedinUrl: String(form.get("linkedinUrl") ?? ""),
      targetRoleProfileId: String(form.get("targetRoleProfileId") ?? ""),
    });
    setSaving(false);
    if (!result.ok) {
      setErrors(result.error.fieldErrors ?? {});
      setFormError(result.error.message);
      return;
    }
    toast.success("Profile updated.");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      {formError ? (
        <Alert variant="destructive">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" name="name" defaultValue={props.name} errors={errors.name} />
        <Field label="Email" name="email" defaultValue={props.email} disabled />
        <Field label="Phone" name="phone" defaultValue={props.phone ?? ""} errors={errors.phone} placeholder="9876543210" />
        <Field label="Location" name="location" defaultValue={props.location ?? ""} errors={errors.location} placeholder="Bengaluru" />
        <div className="space-y-2">
          <Label htmlFor="branch">Branch</Label>
          <Select id="branch" name="branch" defaultValue={props.branch}>
            {BRANCHES.map((branch) => (
              <option key={branch} value={branch}>
                {branch}
              </option>
            ))}
          </Select>
          <FieldError errors={errors.branch} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="graduationYear">Graduation year</Label>
          <Select id="graduationYear" name="graduationYear" defaultValue={props.graduationYear}>
            {GRADUATION_YEARS.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </Select>
          <FieldError errors={errors.graduationYear} />
        </div>
        <Field
          label="CGPA"
          name="cgpa"
          type="number"
          step="0.01"
          min="0"
          max="10"
          defaultValue={props.cgpa ?? ""}
          errors={errors.cgpa}
        />
        <Field
          label="Backlogs"
          name="backlogs"
          type="number"
          min="0"
          max="30"
          defaultValue={props.backlogs}
          errors={errors.backlogs}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="headline">Headline</Label>
        <Textarea
          id="headline"
          name="headline"
          rows={2}
          maxLength={160}
          defaultValue={props.headline ?? ""}
          placeholder="Final-year CSE student building reliable web products."
        />
        <FieldError errors={errors.headline} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="GitHub URL" name="githubUrl" defaultValue={props.githubUrl ?? ""} errors={errors.githubUrl} placeholder="https://github.com/…" />
        <Field label="LinkedIn URL" name="linkedinUrl" defaultValue={props.linkedinUrl ?? ""} errors={errors.linkedinUrl} placeholder="https://linkedin.com/in/…" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="targetRoleProfileId">Target role</Label>
        <Select
          id="targetRoleProfileId"
          name="targetRoleProfileId"
          defaultValue={props.targetRoleProfileId ?? ""}
        >
          <option value="">Not selected</option>
          {props.roleProfiles.map((role) => (
            <option key={role.id} value={role.id}>
              {role.name}
            </option>
          ))}
        </Select>
        <p className="text-xs text-muted-foreground">
          Your target role powers the skill-gap analysis and profile completeness score.
        </p>
        <FieldError errors={errors.targetRoleProfileId} />
      </div>

      <Button type="submit" disabled={saving}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        {saving ? "Saving…" : "Save profile"}
      </Button>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  errors,
  ...props
}: {
  label: string;
  name: string;
  type?: string;
  errors?: string[];
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} {...props} />
      <FieldError errors={errors} />
    </div>
  );
}

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return <p className="text-xs font-medium text-destructive">{errors[0]}</p>;
}
