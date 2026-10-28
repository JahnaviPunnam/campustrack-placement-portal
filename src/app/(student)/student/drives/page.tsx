import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  MapPin,
  Sparkles,
  Users,
} from "lucide-react";
import { getCurrentUser } from "@/server/auth/guards";
import { getStudentDrives } from "@/server/services/drives";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatDate, formatPackage } from "@/lib/formatting";
import { cn } from "@/lib/utils";

export const metadata = { title: "Drives" };

export default async function StudentDrivesPage({
  searchParams,
}: {
  searchParams: { filter?: string };
}) {
  const user = await getCurrentUser();
  if (!user?.studentProfile) redirect("/login");
  const entries = await getStudentDrives(user.studentProfile.id);
  const eligible = entries.filter((entry) => entry.result.eligible || entry.override);
  const filter = searchParams.filter === "eligible" ? "eligible" : "all";
  const visible = filter === "eligible" ? eligible : entries;

  return (
    <div>
      <PageHeader
        title="Placement drives"
        description={`${entries.length} open drive${entries.length === 1 ? "" : "s"} · ${eligible.length} match your profile.`}
      />

      <div className="mb-5 flex gap-1 rounded-lg bg-muted p-1 w-fit">
        <Link
          href="/student/drives"
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium",
            filter === "all" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          All ({entries.length})
        </Link>
        <Link
          href="/student/drives?filter=eligible"
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium",
            filter === "eligible" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          Eligible ({eligible.length})
        </Link>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={BriefcaseBusiness}
          title={filter === "eligible" ? "No eligible drives right now" : "No open drives"}
          description={
            filter === "eligible"
              ? "Review the skill gaps and eligibility reasons across all drives to improve your matches."
              : "New drives appear here as soon as the placement office publishes them."
          }
          actionHref={filter === "eligible" ? "/student/drives" : "/student/skills/gap"}
          actionLabel={filter === "eligible" ? "View all drives" : "Review skill gap"}
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {visible.map(({ drive, result, override }) => {
            const canApply = result.eligible || override;
            const applied = result.reasons.some((reason) => reason.code === "ALREADY_APPLIED");
            const topReason = result.reasons[0];
            return (
              <Card key={drive.id} className="flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-lg">
                        <Link href={`/student/drives/${drive.id}`} className="hover:underline">
                          {drive.title}
                        </Link>
                      </CardTitle>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {drive.company.name} · {drive.roleTitle}
                      </p>
                    </div>
                    <Badge variant={applied ? "info" : canApply ? "success" : "warning"}>
                      {applied ? "Applied" : canApply ? "Eligible" : "Not eligible"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col justify-between gap-4">
                  <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" /> {drive.location}
                    </span>
                    <span>{formatPackage(drive.package)}</span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" /> {drive.openings ?? "—"} openings
                    </span>
                    <span className="flex items-center gap-1">
                      <CalendarClock className="h-3.5 w-3.5" /> Closes {formatDate(drive.deadline)}
                    </span>
                  </div>

                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Skill match</span>
                      <span className="font-medium">{result.matchScore}%</span>
                    </div>
                    <Progress value={result.matchScore} className="h-1.5" />
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      {applied ? (
                        <p className="flex items-center gap-1.5 text-xs text-sky-600 dark:text-sky-400">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Application already submitted
                        </p>
                      ) : canApply ? (
                        <p className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                          <Sparkles className="h-3.5 w-3.5" />
                          {override ? "Officer override available" : "You meet every eligibility rule"}
                        </p>
                      ) : (
                        <p className="flex items-center gap-1.5 truncate text-xs text-amber-600 dark:text-amber-400">
                          <CircleAlert className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{topReason?.message}</span>
                        </p>
                      )}
                    </div>
                    <Link
                      href={`/student/drives/${drive.id}`}
                      className="shrink-0 text-sm font-medium text-primary hover:underline"
                    >
                      View drive
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
