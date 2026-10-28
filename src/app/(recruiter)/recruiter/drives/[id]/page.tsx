import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, FileText, MapPin, Pencil, ShieldCheck, Users } from "lucide-react";
import { requireRecruiter } from "@/server/auth/guards";
import { getRecruiterDriveDetail } from "@/server/services/recruiter";
import { AppError } from "@/server/errors";
import { PageHeader } from "@/components/shared/page-header";
import { RecruiterPipelineActions } from "@/components/recruiter/candidate-pipeline-actions";
import { ShortlistExportControls } from "@/components/reports/shortlist-export-controls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  APPLICATION_STATUS_LABELS,
  DRIVE_STATUS_LABELS,
  type ApplicationStatus,
  type DriveStatus,
} from "@/lib/constants";
import { formatDate, formatDateTime, formatPackage } from "@/lib/formatting";

export const metadata = { title: "Drive" };
export const dynamic = "force-dynamic";

export default async function RecruiterDrivePage({ params }: { params: { id: string } }) {
  const { user, company, recruiter } = await requireRecruiter();
  const context = {
    userId: user.id,
    recruiterProfileId: recruiter.id,
    companyId: company.id,
    companyName: company.name,
  };
  let drive: Awaited<ReturnType<typeof getRecruiterDriveDetail>>;
  try {
    drive = await getRecruiterDriveDetail(context, params.id);
  } catch (error) {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  }

  const rule = drive.eligibilityRule;
  const inProcess = drive.applications.filter((application) =>
    ["SHORTLISTED", "IN_PROCESS"].includes(application.status),
  ).length;
  const offers = drive.applications.filter((application) => application.offer).length;
  const canManage = drive.status === "ACTIVE";

  return (
    <div>
      <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2">
        <Link href="/recruiter/drives">
          <ArrowLeft className="h-4 w-4" /> My drives
        </Link>
      </Button>
      <PageHeader
        title={drive.title}
        description={`${drive.roleTitle} · ${formatPackage(drive.package)} · Tier ${drive.tier}`}
        actions={
          <>
            <Badge
              variant={
                drive.status === "ACTIVE"
                  ? "success"
                  : drive.status === "PENDING_APPROVAL"
                    ? "warning"
                    : drive.status === "REJECTED"
                      ? "destructive"
                      : "outline"
              }
              className="px-3 py-1.5"
            >
              {DRIVE_STATUS_LABELS[drive.status as DriveStatus] ?? drive.status}
            </Badge>
            {drive.source === "RECRUITER" && drive.status === "REJECTED" ? (
              <Button asChild variant="outline">
                <Link href={`/recruiter/drives/${drive.id}/edit`}>
                  <Pencil className="h-4 w-4" /> Edit and resubmit
                </Link>
              </Button>
            ) : null}
            {drive.status === "ACTIVE" ? (
              <Button asChild variant="outline">
                <Link href={`/recruiter/candidates?driveId=${drive.id}`}>
                  <Users className="h-4 w-4" /> Find candidates
                </Link>
              </Button>
            ) : null}
          </>
        }
      />

      {drive.rejectionReason ? (
        <div className="mb-5 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
          <span className="font-medium">Placement office feedback:</span> {drive.rejectionReason}
        </div>
      ) : null}

      {drive.status === "PENDING_APPROVAL" ? (
        <div className="mb-5 rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 text-sm text-amber-900 dark:text-amber-200">
          This request is awaiting placement-office review. You can add candidates once it is live.
        </div>
      ) : null}

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={Users} label="Applicants" value={drive.applications.length} />
        <Metric icon={Users} label="In process" value={inProcess} />
        <Metric icon={ShieldCheck} label="Offers" value={offers} />
        <Metric icon={CalendarDays} label="Rounds" value={drive.rounds.length} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Applicant pipeline</CardTitle>
              <CardDescription>
                Shortlist candidates, record interview results, reject, and share feedback.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {drive.applications.length === 0 ? (
                <p className="px-6 pb-6 text-sm text-muted-foreground">
                  No applications yet.{" "}
                  {drive.status === "ACTIVE" ? (
                    <Link href={`/recruiter/candidates?driveId=${drive.id}`} className="font-medium text-primary hover:underline">
                      Search verified candidates
                    </Link>
                  ) : null}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-y bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-4 py-2.5 font-medium">Student</th>
                        <th className="px-4 py-2.5 font-medium">Status</th>
                        <th className="px-4 py-2.5 font-medium">Match</th>
                        <th className="px-4 py-2.5 font-medium">Stage</th>
                        <th className="px-4 py-2.5 font-medium">Offer</th>
                        <th className="px-4 py-2.5 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {drive.applications.map((application) => (
                        <tr key={application.id} className="hover:bg-muted/30">
                          <td className="px-4 py-3">
                            <p className="font-medium">{application.studentProfile.user.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {application.studentProfile.rollNumber} · {application.studentProfile.branch} ·{" "}
                              {application.studentProfile.graduationYear}
                            </p>
                            {application.studentProfile.resumePath ? (
                              <a
                                href={`/api/resumes/${application.studentProfileId}`}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                              >
                                <FileText className="h-3 w-3" /> Resume
                              </a>
                            ) : null}
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              variant={
                                application.status === "OFFERED"
                                  ? "success"
                                  : application.status === "REJECTED"
                                    ? "destructive"
                                    : application.status === "WITHDRAWN"
                                      ? "outline"
                                      : "info"
                              }
                            >
                              {APPLICATION_STATUS_LABELS[application.status as ApplicationStatus] ??
                                application.status}
                            </Badge>
                            {application.eligibilityOverridden ? (
                              <p className="mt-1 text-[11px] text-sky-700 dark:text-sky-300">Override applied</p>
                            ) : null}
                          </td>
                          <td className="px-4 py-3">
                            {application.matchScore !== null ? `${application.matchScore}%` : "—"}
                          </td>
                          <td className="px-4 py-3">
                            {application.currentRound?.name ?? "—"}
                            <p className="text-xs text-muted-foreground">
                              {application.roundResults.length} result(s)
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            {application.offer ? (
                              <>
                                <p>{formatPackage(application.offer.package)}</p>
                                <p className="text-xs text-muted-foreground">{application.offer.status}</p>
                              </>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {canManage ? (
                              <RecruiterPipelineActions
                                driveId={drive.id}
                                applicationId={application.id}
                                studentProfileId={application.studentProfileId}
                                status={application.status}
                                feedback={application.recruiterFeedback}
                                rounds={drive.rounds.map((round) => {
                                  const result = application.roundResults.find(
                                    (entry) => entry.roundId === round.id,
                                  );
                                  return {
                                    id: round.id,
                                    name: round.name,
                                    order: round.order,
                                    resultStatus: result?.status,
                                    resultScore: result?.score ?? null,
                                  };
                                })}
                              />
                            ) : (
                              <span className="text-xs text-muted-foreground">Read only</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Interview rounds</CardTitle>
              <CardDescription>Stages configured for this drive.</CardDescription>
            </CardHeader>
            <CardContent>
              {drive.rounds.length === 0 ? (
                <p className="text-sm text-muted-foreground">No rounds configured.</p>
              ) : (
                <div className="divide-y rounded-lg border">
                  {drive.rounds.map((round) => (
                    <div key={round.id} className="flex flex-wrap items-start justify-between gap-2 p-3 text-sm">
                      <div>
                        <p className="font-medium">
                          #{round.order} {round.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateTime(round.scheduledAt)}
                          {round.venue ? ` · ${round.venue}` : ""}
                          {round.durationMinutes ? ` · ${round.durationMinutes} min` : ""}
                        </p>
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        <Badge variant="outline">{round.status}</Badge>
                        <p className="mt-1">
                          {round._count.results} result(s) · {round._count.currentApplications} active
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Drive details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Detail icon={MapPin} label="Location" value={drive.location} />
              <Detail icon={CalendarDays} label="Deadline" value={formatDate(drive.deadline)} />
              <Detail icon={Users} label="Openings" value={drive.openings?.toString() ?? "Not specified"} />
              <Detail icon={ShieldCheck} label="Source" value={drive.source === "RECRUITER" ? "Company request" : "Placement office"} />
              {drive.description ? (
                <p className="whitespace-pre-line rounded-md bg-muted p-2 text-xs text-muted-foreground">
                  {drive.description}
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Eligibility</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Minimum CGPA" value={rule?.minCgpa?.toString() ?? "Any"} />
              <Row label="Maximum backlogs" value={rule?.maxBacklogs?.toString() ?? "Any"} />
              <Row label="Branches" value={rule?.allowedBranches || "All"} />
              <Row label="Graduation years" value={rule?.allowedGraduationYears || "All"} />
              <Row label="Verified profile" value={rule?.requireVerifiedProfile ? "Required" : "Optional"} />
              <Row label="Resume" value={rule?.requireResume ? "Required" : "Optional"} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Required skills</CardTitle>
            </CardHeader>
            <CardContent>
              {drive.requiredSkills.length === 0 ? (
                <p className="text-sm text-muted-foreground">No required skills.</p>
              ) : (
                <div className="space-y-2">
                  {drive.requiredSkills.map((skill) => (
                    <div key={skill.id} className="flex items-center justify-between gap-2 text-sm">
                      <span>
                        {skill.skill.name}
                        {skill.isMandatory ? "" : " (optional)"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        L{skill.minProficiency} · weight {skill.weight}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Shortlist exports</CardTitle>
              <CardDescription>
                Export the candidates your company has shortlisted for this drive.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ShortlistExportControls
                driveId={drive.id}
                rounds={drive.rounds.map((round) => ({
                  id: round.id,
                  name: round.name,
                  order: round.order,
                }))}
              />
            </CardContent>
          </Card>

          {drive.applications.some((application) => application.recruiterFeedback) ? (
            <Card>
              <CardHeader>
                <CardTitle>Recent feedback</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {drive.applications
                  .filter((application) => application.recruiterFeedback)
                  .slice(0, 4)
                  .map((application) => (
                    <div key={application.id} className="rounded-md border p-2 text-xs">
                      <p className="font-medium">{application.studentProfile.user.name}</p>
                      <p className="whitespace-pre-line text-muted-foreground">{application.recruiterFeedback}</p>
                    </div>
                  ))}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: number;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="rounded-lg bg-primary/10 p-2 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="text-xl font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
