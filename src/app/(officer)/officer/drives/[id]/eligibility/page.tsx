import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Search, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { OverrideControls } from "@/components/officer/override-controls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getDriveEligibilityReview } from "@/server/services/officer-drives";
import { AppError } from "@/server/errors";

export const dynamic = "force-dynamic";

export default async function DriveEligibilityPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { q?: string };
}) {
  let review: Awaited<ReturnType<typeof getDriveEligibilityReview>>;
  try {
    review = await getDriveEligibilityReview(params.id);
  } catch (error) {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  }
  const query = searchParams.q?.trim().toLowerCase() ?? "";
  const evaluations = review.evaluations.filter((entry) => {
    if (!query) return true;
    return (
      entry.student.rollNumber.toLowerCase().includes(query) ||
      entry.student.user.name.toLowerCase().includes(query) ||
      entry.student.user.email.toLowerCase().includes(query)
    );
  });
  const eligible = evaluations.filter((entry) => entry.result.eligible).length;
  const overridden = evaluations.filter((entry) => entry.override).length;
  const ineligible = evaluations.length - eligible;

  return (
    <div>
      <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2">
        <Link href={`/officer/drives/${params.id}`}>
          <ArrowLeft className="h-4 w-4" /> {review.drive.title}
        </Link>
      </Button>
      <PageHeader
        title="Eligibility review"
        description={`${review.drive.title} · ${review.drive.company.name}`}
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Summary label="Eligible" value={eligible} tone="success" />
        <Summary label="Ineligible" value={ineligible} tone="warning" />
        <Summary label="Active overrides" value={overridden} tone="info" />
      </div>

      <Card className="mb-4">
        <CardContent className="pt-6">
          <form method="get" className="flex flex-wrap gap-3">
            <div className="relative min-w-56 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                name="q"
                defaultValue={searchParams.q ?? ""}
                placeholder="Name, email or roll number"
                className="pl-9"
              />
            </div>
            <Button type="submit">Search</Button>
            <Button asChild variant="ghost">
              <Link href={`/officer/drives/${params.id}/eligibility`}>Clear</Link>
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Student</th>
                  <th className="px-4 py-3 font-medium">Eligibility</th>
                  <th className="px-4 py-3 font-medium">Reasons</th>
                  <th className="px-4 py-3 font-medium">Application</th>
                  <th className="px-4 py-3 font-medium">Exception</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {evaluations.map((entry) => (
                  <tr key={entry.student.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <Link href={`/officer/students/${entry.student.id}`} className="font-medium hover:underline">
                        {entry.student.user.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {entry.student.rollNumber} · {entry.student.branch} · {entry.student.graduationYear}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      {entry.result.eligible ? (
                        <Badge variant="success" className="gap-1">
                          <ShieldCheck className="h-3 w-3" /> Eligible
                        </Badge>
                      ) : entry.override ? (
                        <Badge variant="info">Overridden</Badge>
                      ) : (
                        <Badge variant="warning">Ineligible</Badge>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground">{entry.result.matchScore}% match</p>
                    </td>
                    <td className="max-w-md px-4 py-3">
                      {entry.result.reasons.length === 0 ? (
                        <span className="text-xs text-muted-foreground">No blocking reasons.</span>
                      ) : (
                        <ul className="space-y-1 text-xs text-muted-foreground">
                          {entry.result.reasons.map((reason) => (
                            <li key={reason.code}>{reason.message}</li>
                          ))}
                        </ul>
                      )}
                      {entry.override ? (
                        <p className="mt-1 text-xs text-sky-700 dark:text-sky-300">
                          Override: {entry.override.reason}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      {entry.applicationStatus ? (
                        <Badge variant="outline">{entry.applicationStatus}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">Not applied</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <OverrideControls
                        driveId={review.drive.id}
                        studentProfileId={entry.student.id}
                        studentName={entry.student.user.name}
                        override={entry.override}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      {evaluations.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No students match this search.</p>
      ) : null}
    </div>
  );
}

function Summary({ label, value, tone }: { label: string; value: number; tone: "success" | "warning" | "info" }) {
  const color =
    tone === "success"
      ? "text-emerald-700 dark:text-emerald-300"
      : tone === "warning"
        ? "text-amber-700 dark:text-amber-300"
        : "text-sky-700 dark:text-sky-300";
  return (
    <div className="rounded-lg border p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
