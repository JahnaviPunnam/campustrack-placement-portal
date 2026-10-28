import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  CircleUserRound,
  ListChecks,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { getCurrentUser } from "@/server/auth/guards";
import { getStudentDashboard } from "@/server/services/students";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  APPLICATION_STATUS_LABELS,
  type ApplicationStatus,
} from "@/lib/constants";
import { formatDate, formatDateTime, formatPackage } from "@/lib/formatting";

export const dynamic = "force-dynamic";

export default async function StudentDashboard() {
  const user = await getCurrentUser();
  if (!user?.studentProfile) redirect("/login");
  const data = await getStudentDashboard(user.studentProfile.id, user.id);
  const { profile, completeness } = data;

  return (
    <div>
      <PageHeader
        title={`Welcome, ${user.name.split(" ")[0]}`}
        description="Your skills, applications, and upcoming deadlines at a glance."
        actions={
          <Button asChild>
            <Link href="/student/drives">
              Browse drives <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        }
      />

      {!profile.isVerified ? (
        <Alert variant="warning" className="mb-6">
          <TriangleAlert className="h-4 w-4" />
          <AlertTitle>Profile verification pending</AlertTitle>
          <AlertDescription>
            The placement office has not verified your profile yet. Drives that require verification
            will show this as an eligibility reason.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Skills"
          value={profile.skills.length}
          hint={`${profile.skills.filter((skill) => skill.evidence).length} with evidence`}
          icon={Sparkles}
        />
        <StatCard
          title="Active applications"
          value={data.activeApplicationCount}
          hint={`${data.applicationCount} total`}
          icon={ListChecks}
        />
        <StatCard
          title="Eligible drives"
          value={data.eligibleDrives.length}
          hint={`${data.openDrives.length} open in total`}
          icon={BriefcaseBusiness}
        />
        <StatCard
          title="Offers"
          value={data.offerCount}
          hint={`${data.unread} unread alerts`}
          icon={CheckCircle2}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Upcoming deadlines</CardTitle>
              <CardDescription>Active drives sorted by application deadline.</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/student/drives">View all</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {data.openDrives.length === 0 ? (
              <EmptyState
                icon={BriefcaseBusiness}
                title="No active drives"
                description="New drives will appear here as soon as the placement office publishes them."
              />
            ) : (
              <ul className="divide-y">
                {data.openDrives.slice(0, 5).map(({ drive, result, override }) => {
                  const canApply = result.eligible || override;
                  return (
                    <li key={drive.id}>
                      <Link
                        href={`/student/drives/${drive.id}`}
                        className="flex flex-col gap-2 py-3 transition hover:opacity-80 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <p className="font-medium">{drive.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {drive.company.name} · {drive.roleTitle} · {formatPackage(drive.package)}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={canApply ? "success" : "warning"}>
                            {canApply ? "Eligible" : "Not eligible"}
                          </Badge>
                          <Badge variant="outline">{result.matchScore}% match</Badge>
                          <span className="text-xs text-muted-foreground">
                            Closes {formatDate(drive.deadline)}
                          </span>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Profile completeness</CardTitle>
            <CardDescription>Complete profiles rank better with recruiters.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-medium">{completeness.percentage}%</span>
                <span className="text-muted-foreground">
                  {completeness.percentage >= 80 ? "Strong" : completeness.percentage >= 50 ? "Getting there" : "Needs work"}
                </span>
              </div>
              <Progress value={completeness.percentage} />
            </div>
            <div className="space-y-2">
              {completeness.missing.slice(0, 4).map((item) => (
                <p key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <CircleUserRound className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {item}
                </p>
              ))}
              {completeness.missing.length === 0 ? (
                <p className="flex items-start gap-2 text-sm text-emerald-600 dark:text-emerald-400">
                  <BadgeCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Profile is complete.
                </p>
              ) : null}
            </div>
            <Button asChild variant="outline" className="w-full">
              <Link href="/student/profile">Complete profile</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Recent applications</CardTitle>
              <CardDescription>Latest application activity.</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/student/applications">Tracker</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {data.recentApplications.length === 0 ? (
              <EmptyState
                icon={ListChecks}
                title="No applications yet"
                description="Find an eligible drive and apply. Your pipeline will show up here."
                actionHref="/student/drives"
                actionLabel="Browse drives"
              />
            ) : (
              <ul className="divide-y">
                {data.recentApplications.map((application) => (
                  <li key={application.id}>
                    <Link
                      href={`/student/applications/${application.id}`}
                      className="flex items-center justify-between gap-3 py-3 hover:opacity-80"
                    >
                      <div>
                        <p className="font-medium">{application.drive.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {application.drive.company.name}
                          {application.currentRound ? ` · ${application.currentRound.name}` : ""}
                        </p>
                      </div>
                      <Badge
                        variant={
                          application.status === "OFFERED"
                            ? "success"
                            : application.status === "REJECTED"
                              ? "destructive"
                              : application.status === "WITHDRAWN"
                                ? "outline"
                                : "secondary"
                        }
                      >
                        {APPLICATION_STATUS_LABELS[application.status as ApplicationStatus] ?? application.status}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Upcoming rounds</CardTitle>
              <CardDescription>Interviews and assessments on your calendar.</CardDescription>
            </div>
            <Badge variant="outline">{data.upcomingRounds.length}</Badge>
          </CardHeader>
          <CardContent>
            {data.upcomingRounds.length === 0 ? (
              <div className="rounded-lg border border-dashed px-6 py-10 text-center">
                <CalendarClock className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
                <p className="text-sm font-medium">No rounds scheduled</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Shortlisting updates will appear here and in notifications.
                </p>
              </div>
            ) : (
              <ul className="divide-y">
                {data.upcomingRounds.map((entry) => (
                  <li key={entry.id}>
                    <Link
                      href={`/student/applications/${entry.applicationId}`}
                      className="flex items-start justify-between gap-3 py-3 hover:opacity-80"
                    >
                      <div>
                        <p className="text-sm font-medium">{entry.round.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {entry.application.drive.company.name} · {entry.application.drive.title}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-medium">{formatDateTime(entry.round.scheduledAt)}</p>
                        {entry.round.venue ? (
                          <p className="text-xs text-muted-foreground">{entry.round.venue}</p>
                        ) : null}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
