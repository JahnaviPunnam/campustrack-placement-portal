import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  Clock,
  Plus,
  Search,
  Users,
} from "lucide-react";
import { requireRecruiter } from "@/server/auth/guards";
import { getRecruiterDashboard } from "@/server/services/recruiter";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { APPLICATION_STATUS_LABELS, DRIVE_STATUS_LABELS, type ApplicationStatus, type DriveStatus } from "@/lib/constants";
import { formatDate, formatDateTime, formatPackage } from "@/lib/formatting";

export const metadata = { title: "Recruiter dashboard" };
export const dynamic = "force-dynamic";

export default async function RecruiterDashboard() {
  let auth: Awaited<ReturnType<typeof requireRecruiter>>;
  try {
    auth = await requireRecruiter();
  } catch {
    redirect("/forbidden");
  }
  const { user, company, recruiter } = auth;
  const data = await getRecruiterDashboard({
    userId: user.id,
    recruiterProfileId: recruiter.id,
    companyId: company.id,
    companyName: company.name,
  });

  return (
    <div>
      <PageHeader
        title={`${company.name} workspace`}
        description="Your company's drives, candidates, and interview pipeline."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/recruiter/candidates">
                <Search className="h-4 w-4" /> Find candidates
              </Link>
            </Button>
            <Button asChild>
              <Link href="/recruiter/drives/request">
                <Plus className="h-4 w-4" /> Request a drive
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Active drives" value={data.metrics.activeDrives} icon={BriefcaseBusiness} />
        <StatCard title="Applicants" value={data.metrics.applicants} icon={Users} />
        <StatCard title="In process" value={data.metrics.inProcess} icon={Clock} />
        <StatCard title="Offers accepted" value={data.metrics.acceptedOffers} icon={CheckCircle2} />
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[1fr_380px]">
        <div className="space-y-5">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>Your drives</CardTitle>
                <CardDescription>{data.metrics.totalDrives} drive(s) for {company.name}.</CardDescription>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link href="/recruiter/drives">View all</Link>
              </Button>
            </CardHeader>
            <CardContent>
              <div className="divide-y">
                {data.drives.map((drive) => (
                  <Link
                    key={drive.id}
                    href={`/recruiter/drives/${drive.id}`}
                    className="flex flex-col gap-2 py-3 hover:opacity-80 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-medium">{drive.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {drive.roleTitle} · {formatPackage(drive.package)} · closes {formatDate(drive.deadline)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          drive.status === "ACTIVE"
                            ? "success"
                            : drive.status === "PENDING_APPROVAL"
                              ? "warning"
                              : drive.status === "REJECTED"
                                ? "destructive"
                                : "secondary"
                        }
                      >
                        {DRIVE_STATUS_LABELS[drive.status as DriveStatus] ?? drive.status}
                      </Badge>
                      <span className="text-sm">{drive._count.applications} applicants</span>
                    </div>
                  </Link>
                ))}
                {data.drives.length === 0 ? (
                  <div className="py-10 text-center text-sm text-muted-foreground">
                    No drives yet.{" "}
                    <Link href="/recruiter/drives/request" className="font-medium text-primary hover:underline">
                      Request your first drive
                    </Link>
                    .
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent applicants</CardTitle>
              <CardDescription>Newest candidates across your active pipeline.</CardDescription>
            </CardHeader>
            <CardContent>
              {data.recentApplications.length === 0 ? (
                <p className="text-sm text-muted-foreground">No applications yet.</p>
              ) : (
                <div className="divide-y">
                  {data.recentApplications.map((application) => (
                    <Link
                      key={application.id}
                      href={`/recruiter/drives/${application.drive.id}`}
                      className="flex flex-wrap items-center justify-between gap-2 py-3 hover:opacity-80"
                    >
                      <div>
                        <p className="font-medium">{application.studentProfile.user.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {application.studentProfile.rollNumber} · {application.studentProfile.branch} ·{" "}
                          {application.drive.title}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          {APPLICATION_STATUS_LABELS[application.status as ApplicationStatus] ??
                            application.status}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {application.matchScore !== null ? `${application.matchScore}%` : "—"}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Upcoming rounds</CardTitle>
              <CardDescription>Your next scheduled interview stages.</CardDescription>
            </CardHeader>
            <CardContent>
              {data.upcomingRounds.length === 0 ? (
                <p className="text-sm text-muted-foreground">No scheduled rounds.</p>
              ) : (
                <div className="space-y-3">
                  {data.upcomingRounds.map((round) => (
                    <Link
                      key={round.id}
                      href={`/recruiter/drives/${round.drive.id}`}
                      className="flex items-start gap-2 rounded-lg border p-3 text-sm hover:bg-muted/40"
                    >
                      <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <div>
                        <p className="font-medium">{round.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {round.drive.title} · {formatDateTime(round.scheduledAt)}
                          {round.venue ? ` · ${round.venue}` : ""}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pipeline mix</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.statusCounts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No applications yet.</p>
              ) : (
                data.statusCounts.map((entry) => (
                  <div key={entry.status} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {APPLICATION_STATUS_LABELS[entry.status as ApplicationStatus] ?? entry.status}
                    </span>
                    <span className="font-medium">{entry.count}</span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
