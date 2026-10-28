"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createCompanyAction, updateCompanyAction } from "@/server/actions/officer-companies";

type CompanyValues = {
  id?: string;
  name?: string;
  industry?: string;
  location?: string | null;
  website?: string | null;
  tier?: number;
  description?: string | null;
};

export function CompanyForm({ company }: { company?: CompanyValues }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({});

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setFieldErrors({});
    const form = new FormData(event.currentTarget);
    const input = {
      ...(company?.id ? { companyId: company.id } : {}),
      name: String(form.get("name") ?? ""),
      industry: String(form.get("industry") ?? ""),
      location: String(form.get("location") ?? ""),
      website: String(form.get("website") ?? ""),
      tier: String(form.get("tier") ?? "2"),
      description: String(form.get("description") ?? ""),
    };
    const result = company?.id
      ? await updateCompanyAction(input)
      : await createCompanyAction(input);
    setLoading(false);
    if (!result.ok) {
      setError(result.error.message);
      setFieldErrors(result.error.fieldErrors ?? {});
      return;
    }
    toast.success(company?.id ? "Company updated." : "Company created.");
    if (!company?.id && result.data && "companyId" in result.data) {
      router.push(`/officer/companies/${result.data.companyId}`);
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Company name" error={fieldErrors.name?.[0]}>
          <Input name="name" defaultValue={company?.name ?? ""} required maxLength={100} />
        </Field>
        <Field label="Industry" error={fieldErrors.industry?.[0]}>
          <Input name="industry" defaultValue={company?.industry ?? ""} required maxLength={80} />
        </Field>
        <Field label="Location" error={fieldErrors.location?.[0]}>
          <Input name="location" defaultValue={company?.location ?? ""} maxLength={80} placeholder="Bengaluru" />
        </Field>
        <Field label="Website" error={fieldErrors.website?.[0]}>
          <Input name="website" type="url" defaultValue={company?.website ?? ""} placeholder="https://example.com" />
        </Field>
        <Field label="Tier" error={fieldErrors.tier?.[0]}>
          <Select name="tier" defaultValue={String(company?.tier ?? 2)}>
            <option value="1">Tier 1 · Mass recruiter</option>
            <option value="2">Tier 2 · Standard</option>
            <option value="3">Tier 3 · Dream</option>
          </Select>
        </Field>
      </div>
      <Field label="Description" error={fieldErrors.description?.[0]}>
        <Textarea name="description" defaultValue={company?.description ?? ""} rows={4} maxLength={2000} />
      </Field>
      <Button type="submit" disabled={loading}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        {company?.id ? "Save changes" : "Create company"}
      </Button>
    </form>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
