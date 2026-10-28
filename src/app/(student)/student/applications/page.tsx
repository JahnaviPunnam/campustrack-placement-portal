import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, ListChecks } from "lucide-react";
import { getCurrentUser } from "@/server/auth/guards";
import { getStudentApplications } from "@/server/services/applications";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { APPLICATION_STATUSES, APPLICATION_STATUS_LABELS, type ApplicationStatus } from "@/lib/constants";
import { formatDate } from "@/lib/formatting";
import { cn } from "@/lib/utils";

export const metadata = { title: "Applications" };

function statusVariant(status: string): "success" | "destructive" | "warning" | "info" | "secondary" | "outline" {
  if (status === "OFFERED") return "success";
  if (status === "REJECTED") return "destructive";
  if (status === "WITHDRAWN") return "outline";
  if (status === "SHORTLISTED") return "info";
  if (status === "IN_PROCESS") return "warning";
  return "secondary";
}

export default async function StudentApplicationsPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const user = await getCurrentUser();
  if (!user?.studentProfile) redirect("/login");
  const applications = await getStudentApplications(user.studentProfile.id);
  const requested = APPLICATION_STATUSES.includes(searchParams.status as ApplicationStatus)
    ? (searchParams.status as ApplicationStatus)
    : null;
  const visible = requested ? applications.filter((application) => application.status === requested) : applications;

  return (
    <div>
      <PageHeader
        title="Applications"
        description="Track every application, interview round, and offer in one place."
      />

      <div className="mb-5 flex flex-wrap gap-1 rounded-lg bg-muted p-1 w-fit">
        <Link
          href="/student/applications"
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium",
            !requested ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          All ({applications.length})
        </Link>
        {APPLICATION_STATUSES.map((status) => {
          const count = applications.filter((application) => application.status === status).length;
          if (count === 0) return null;
          return (
            <Link
              key={status}
              href={`/student/applications?status=${status}`}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium",
                requested === status ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {APPLICATION_STATUS_LABELS[status]} ({count})
            </Link>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title={requested ? "No applications with this status" : "No applications yet"}
          description="Browse open drives to find roles that match your skills and eligibility."
          actionHref="/student/drives"
          actionLabel="Browse drives"
        />
      ) : (
        <Card>
          <CardContent className="divide-y p-0">
            {visible.map((application) => (
              <Link
                key={application.id}
                href={`/student/applications/${application.id}`}
                className="flex items-center gap-4 p-4 transition-colors hover:bg-muted/40"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{application.drive.title}</p>
                    <Badge variant={statusVariant(application.status)}>
                      {APPLICATION_STATUS_LABELS[application.status as ApplicationStatus] ?? application.status}
                    </Badge>
                    {application.isDreamOffer ? <Badge variant="info">Dream</Badge> : null}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {application.drive.company.name} · {application.drive.roleTitle} · applied{" "}
                    {formatDate(application.appliedAt)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {application.currentRound
                      ? `Current round: ${application.currentRound.name}`
                      : `${application._count.roundResults} round result(s) recorded`}
                    {application.matchScore !== null ? ` · ${application.matchScore}% skill match` : ""}
                    {application.offer ? ` · offer ${application.offer.status.toLowerCase()}` : ""}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
