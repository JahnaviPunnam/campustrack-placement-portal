"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { BRANCHES, GRADUATION_YEARS } from "@/lib/constants";
import { registerStudentAction } from "@/server/actions/auth";

type Errors = Record<string, string[] | undefined>;

export function RegisterForm() {
  const router = useRouter();
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    setFormError(null);
    setLoading(true);
    const form = new FormData(event.currentTarget);
    const payload = {
      name: String(form.get("name") ?? ""),
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
      confirmPassword: String(form.get("confirmPassword") ?? ""),
      rollNumber: String(form.get("rollNumber") ?? ""),
      branch: String(form.get("branch") ?? ""),
      graduationYear: String(form.get("graduationYear") ?? ""),
      cgpa: String(form.get("cgpa") ?? ""),
      backlogs: String(form.get("backlogs") ?? "0"),
    };

    const result = await registerStudentAction(payload);
    setLoading(false);
    if (!result.ok) {
      setErrors(result.error.fieldErrors ?? {});
      setFormError(result.error.message);
      return;
    }
    toast.success("Account created. Sign in to continue.");
    router.push("/login?registered=1");
  }

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle>Student details</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-5" noValidate>
          {formError ? (
            <Alert variant="destructive">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" name="name" errors={errors.name} autoComplete="name" />
            <Field label="Email" name="email" type="email" errors={errors.email} autoComplete="email" />
            <Field label="Roll number" name="rollNumber" errors={errors.rollNumber} placeholder="CSE2026001" />
            <div className="space-y-2">
              <Label htmlFor="branch">Branch</Label>
              <Select id="branch" name="branch" required defaultValue="CSE">
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
              <Select id="graduationYear" name="graduationYear" required defaultValue={GRADUATION_YEARS[0]}>
                {GRADUATION_YEARS.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </Select>
              <FieldError errors={errors.graduationYear} />
            </div>
            <Field label="CGPA (optional)" name="cgpa" type="number" step="0.01" min="0" max="10" errors={errors.cgpa} />
            <Field label="Backlogs" name="backlogs" type="number" min="0" max="30" errors={errors.backlogs} defaultValue="0" />
            <Field label="Password" name="password" type="password" errors={errors.password} autoComplete="new-password" />
            <Field
              label="Confirm password"
              name="confirmPassword"
              type="password"
              errors={errors.confirmPassword}
              autoComplete="new-password"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Password must be at least 8 characters and include upper case, lower case, and a number.
          </p>
          <Button type="submit" className="w-full gap-2" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            {loading ? "Creating account…" : "Create account"}
          </Button>
        </form>
      </CardContent>
    </Card>
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
      <Input id={name} name={name} type={type} required={type !== "number" || name !== "cgpa"} {...props} />
      <FieldError errors={errors} />
    </div>
  );
}

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return <p className="text-xs font-medium text-destructive">{errors[0]}</p>;
}
