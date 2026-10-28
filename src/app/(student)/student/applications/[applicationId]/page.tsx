import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  Circle,
  Clock,
  MapPin,
  Package,
  Send,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import { getCurrentUser } from "@/server/auth/guards";
import { getStudentApplication } from "@/server/services/applications";
import { AppError } from "@/server/errors";
import { PageHeader } from "@/components/shared/page-header";
import { WithdrawButton } from "@/components/student/withdraw-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  APPLICATION_STATUS_LABELS,
  ROUND_RESULT_LABELS,
  type ApplicationStatus,
  type RoundResultStatus,
} from "@/lib/constants";
import { formatDate, formatDateTime, formatPackage } from "@/lib/formatting";

function statusVariant(status: string): "success" | "destructive" | "warning" | "info" | "secondary" | "outline" {
  if (status === "OFFERED" || status === "PASSED") return "success";
  if (status === "REJECTED" || status === "FAILED" || status === "ABSENT") return "destructive";
  if (status === "IN_PROCESS" || status === "SCHEDULED") return "warning";
  if (status === "SHORTLISTED") return "info";
  if (status === "WITHDRAWN" || status === "WAIVED") return "outline";
  return "secondary";
}

export default async function StudentApplicationDetailPage({
  params,
}: {
  params: { applicationId: string };
}) {
  const user = await getCurrentUser();
  if (!user?.studentProfile) redirect("/login");

  let application: Awaited<ReturnType<typeof getStudentApplication>>;
  try {
    application = await getStudentApplication(user.studentProfile.id, params.applicationId);
  } catch (error) {
    if (error instanceof AppError && error.code === "APPLICATION_NOT_FOUND") notFound();
    throw error;
  }

  const resultMap = new Map(application.roundResults.map((result) => [result.roundId, result]));
  const canWithdraw = ["APPLIED", "SHORTLISTED", "IN_PROCESS"].includes(application.status);

  return (
    <div>
      <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2">
        <Link href="/student/applications">
          <ArrowLeft className="h-4 w-4" /> All applications
        </Link>
      </Button>

      <PageHeader
        title={application.drive.title}
        description={`${application.drive.company.name} · ${application.drive.roleTitle}`}
        actions={
          <>
            <Badge variant={statusVariant(application.status)}>
              {APPLICATION_STATUS_LABELS[application.status as ApplicationStatus] ?? application.status}
            </Badge>
            {canWithdraw ? <WithdrawButton applicationId={application.id} /> : null}
          </>
        }
      />

      {application.status === "REJECTED" ? (
        <Alert variant="destructive" className="mb-6">
          <XCircle className="h-4 w-4" />
          <AlertTitle>Application not selected</AlertTitle>
          <AlertDescription>
            {application.rejectionReason ?? "The company moved forward with other candidates."}
          </AlertDescription>
        </Alert>
      ) : null}
      {application.status === "WITHDRAWN" ? (
        <Alert variant="warning" className="mb-6">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Application withdrawn</AlertTitle>
          <AlertDescription>
            You can reapply while the drive remains open and you still meet the rules.{" "}
            <Link href={`/student/drives/${application.driveId}`} className="font-medium underline">
              Open drive
            </Link>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Application timeline</CardTitle>
              <CardDescription>
                Applied {formatDate(application.appliedAt)} · last update {formatDate(application.statusUpdatedAt)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {application.drive.rounds.length === 0 ? (
                <p className="text-sm text-muted-foreground">The company has not published rounds yet.</p>
              ) : (
                <ol className="relative space-y-6 border-l pl-6">
                  {application.drive.rounds.map((round) => {
                    const roundResult = resultMap.get(round.id);
                    const status = roundResult?.status ?? "PENDING";
                    return (
                      <li key={round.id} className="relative">
                        <span className="absolute -left-[33px] top-0.5 flex h-5 w-5 items-center justify-center rounded-full border bg-background">
                          {status === "PASSED" ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          ) : status === "FAILED" || status === "ABSENT" ? (
                            <XCircle className="h-4 w-4 text-destructive" />
                          ) : (
                            <Circle className="h-3 w-3 text-muted-foreground" />
                          )}
                        </span>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">
                            {round.order}. {round.name}
                          </p>
                          <Badge variant={statusVariant(status)}>
                            {ROUND_RESULT_LABELS[status as RoundResultStatus] ?? status}
                          </Badge>
                          {roundResult?.score !== null && roundResult?.score !== undefined ? (
                            <Badge variant="outline">Score {roundResult.score}</Badge>
                          ) : null}
                        </div>
                        <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          {round.scheduledAt ? (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" /> {formatDateTime(round.scheduledAt)}
                            </span>
                          ) : (
                            <span>Schedule to be announced</span>
                          )}
                          {roundResult?.slotAt ? <span>· your slot {formatDateTime(roundResult.slotAt)}</span> : null}
                          {round.venue ? <span>· {round.venue}</span> : null}
                        </p>
                        {roundResult?.feedback ? (
                          <p className="mt-2 rounded-md bg-muted p-2 text-sm">{roundResult.feedback}</p>
                        ) : null}
                      </li>
                    );
                  })}
                </ol>
              )}
            </CardContent>
          </Card>

          {application.coverNote ? (
            <Card>
              <CardHeader>
                <CardTitle>Your cover note</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-line text-sm text-muted-foreground">{application.coverNote}</p>
              </CardContent>
            </Card>
          ) : null}

          {application.recruiterFeedback ? (
            <Card>
              <CardHeader>
                <CardTitle>Recruiter feedback</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-line text-sm text-muted-foreground">{application.recruiterFeedback}</p>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Application details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Detail icon={Send} label="Applied" value={formatDate(application.appliedAt)} />
              <Detail
                icon={Circle}
                label="Source"
                value={application.source === "RECRUITER" ? "Recruiter invite" : "Student application"}
              />
              <Detail
                icon={BadgeCheck}
                label="Skill match"
                value={application.matchScore !== null ? `${application.matchScore}%` : "Not recorded"}
              />
              {application.isDreamOffer ? (
                <div className="rounded-md bg-violet-50 p-2 text-xs text-violet-800 dark:bg-violet-950/30 dark:text-violet-200">
                  Dream-offer upgrade
                </div>
              ) : null}
              {application.eligibilityOverridden ? (
                <div className="rounded-md bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                  Officer eligibility override applied
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Drive summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Detail icon={MapPin} label="Location" value={application.drive.location} />
              <Detail icon={Package} label="Package" value={formatPackage(application.drive.package)} />
              <Detail icon={CalendarClock} label="Deadline" value={formatDate(application.drive.deadline)} />
              <Button asChild variant="outline" className="w-full">
                <Link href={`/student/drives/${application.driveId}`}>View drive</Link>
              </Button>
            </CardContent>
          </Card>

          {application.offer ? (
            <Card className="border-emerald-500/40">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-5 w-5" /> Offer
                </CardTitle>
                <CardDescription>
                  {APPLICATION_STATUS_LABELS.OFFERED} · {application.offer.status.toLowerCase()}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <Detail icon={Package} label="Package" value={formatPackage(application.offer.package)} />
                <Detail icon={Send} label="Role" value={application.offer.roleTitle} />
                <Detail icon={MapPin} label="Location" value={application.offer.location} />
                <Detail icon={CalendarClock} label="Offer date" value={formatDate(application.offer.offerDate)} />
                <Detail
                  icon={CalendarClock}
                  label="Joining"
                  value={formatDate(application.offer.joiningDate)}
                />
                {application.offer.notes ? (
                  <p className="rounded-md bg-muted p-2 text-xs text-muted-foreground">{application.offer.notes}</p>
                ) : null}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Detail({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof MapPin;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
