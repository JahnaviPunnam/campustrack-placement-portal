import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, MapPin, ShieldCheck, Users } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { DriveAdminActions } from "@/components/officer/drive-admin-actions";
import { RoundManager } from "@/components/officer/round-manager";
import { CandidateActions } from "@/components/officer/candidate-actions";
import { ExportButton } from "@/components/shared/export-button";
import { ShortlistExportControls } from "@/components/reports/shortlist-export-controls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  APPLICATION_STATUS_LABELS,
  DRIVE_STATUS_LABELS,
} from "@/lib/constants";
import { formatDate, formatDateTime, formatPackage } from "@/lib/formatting";
import { getDriveAdminDetail } from "@/server/services/officer-drives";
import { AppError } from "@/server/errors";

export const dynamic = "force-dynamic";

export default async function DriveDetailPage({ params }: { params: { id: string } }) {
  let data: Awaited<ReturnType<typeof getDriveAdminDetail>>;
  try {
    data = await getDriveAdminDetail(params.id);
  } catch (error) {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  }
  const { drive, auditLogs } = data;
  const offers = drive.applications.filter((application) => application.offer).length;
  const inProcess = drive.applications.filter((application) =>
    ["SHORTLISTED", "IN_PROCESS"].includes(application.status),
  ).length;
  const rule = drive.eligibilityRule;

  return (
    <div>
      <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2">
        <Link href="/officer/drives">
          <ArrowLeft className="h-4 w-4" /> Drives
        </Link>
      </Button>
      <PageHeader
        title={drive.title}
        description={`${drive.company.name} · ${drive.roleTitle} · ${formatPackage(drive.package)} · Tier ${drive.tier}`}
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
              {DRIVE_STATUS_LABELS[drive.status as keyof typeof DRIVE_STATUS_LABELS]}
            </Badge>
            <Button asChild variant="outline">
              <Link href={`/officer/drives/${drive.id}/eligibility`}>
                <ShieldCheck className="h-4 w-4" /> Eligibility review
              </Link>
            </Button>
            <DriveAdminActions driveId={drive.id} status={drive.status} source={drive.source} />
          </>
        }
      />

      {drive.rejectionReason ? (
        <div className="mb-5 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
          <span className="font-medium">Rejected:</span> {drive.rejectionReason}
        </div>
      ) : null}

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={Users} label="Applicants" value={drive.applications.length} />
        <Metric icon={Users} label="In process" value={inProcess} />
        <Metric icon={ShieldCheck} label="Offers" value={offers} />
        <Metric icon={ShieldCheck} label="Active overrides" value={drive.overrides.length} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Candidate pipeline</CardTitle>
              <CardDescription>
                Record round outcomes, update application states, and issue policy-checked offers.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {drive.applications.length === 0 ? (
                <p className="px-6 pb-6 text-sm text-muted-foreground">No applications yet.</p>
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
                        <th className="px-4 py-2.5 font-medium" />
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {drive.applications.map((application) => (
                        <tr key={application.id} className="hover:bg-muted/30">
                          <td className="px-4 py-3">
                            <Link
                              href={`/officer/students/${application.studentProfileId}`}
                              className="font-medium hover:underline"
                            >
                              {application.studentProfile.user.name}
                            </Link>
                            <p className="text-xs text-muted-foreground">
                              {application.studentProfile.rollNumber} · {application.studentProfile.branch}
                            </p>
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
                              {APPLICATION_STATUS_LABELS[application.status as keyof typeof APPLICATION_STATUS_LABELS]}
                            </Badge>
                            {application.eligibilityOverridden ? (
                              <p className="mt-1 text-xs text-sky-700 dark:text-sky-300">Override applied</p>
                            ) : null}
                          </td>
                          <td className="px-4 py-3">{application.matchScore ?? "—"}%</td>
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
                            <CandidateActions
                              applicationId={application.id}
                              status={application.status}
                              studentName={application.studentProfile.user.name}
                              roleTitle={drive.roleTitle}
                              packageValue={drive.package}
                              offer={
                                application.offer
                                  ? {
                                      id: application.offer.id,
                                      status: application.offer.status,
                                      package: application.offer.package,
                                    }
                                  : null
                              }
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
              <CardTitle>Rounds</CardTitle>
              <CardDescription>Manage the interview stages for this drive.</CardDescription>
            </CardHeader>
            <CardContent>
              <RoundManager
                driveId={drive.id}
                rounds={drive.rounds.map((round) => ({
                  id: round.id,
                  name: round.name,
                  type: round.type,
                  status: round.status,
                  order: round.order,
                  scheduledAt: round.scheduledAt ? round.scheduledAt.toISOString() : null,
                  durationMinutes: round.durationMinutes,
                  venue: round.venue,
                  meetingLink: round.meetingLink,
                  description: round.description,
                  resultCount: round._count.results,
                  currentCount: round._count.currentApplications,
                }))}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Eligibility overrides</CardTitle>
              <CardDescription>
                Manual exceptions are audited and visible to students on the drive page.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {drive.overrides.length === 0 ? (
                <p className="text-sm text-muted-foreground">No active overrides.</p>
              ) : (
                <div className="divide-y rounded-lg border">
                  {drive.overrides.map((override) => (
                    <div key={override.id} className="flex flex-wrap justify-between gap-2 p-3 text-sm">
                      <div>
                        <Link
                          href={`/officer/students/${override.studentProfileId}`}
                          className="font-medium hover:underline"
                        >
                          {override.studentProfile.user.name}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {override.studentProfile.rollNumber}
                        </p>
                      </div>
                      <p className="max-w-md text-xs text-muted-foreground">{override.reason}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Audit trail</CardTitle>
            </CardHeader>
            <CardContent>
              {auditLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No activity recorded.</p>
              ) : (
                <div className="space-y-3">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                      <p>
                        <span className="font-medium">{log.actor?.name ?? "System"}</span>{" "}
                        <span className="text-muted-foreground">{log.action}</span>
                      </p>
                      <span className="text-xs text-muted-foreground">{formatDateTime(log.createdAt)}</span>
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
              <Row label="Company" value={drive.company.name} />
              <Row label="Role" value={drive.roleTitle} />
              <Row label="Package" value={formatPackage(drive.package)} />
              <Row label="Tier" value={`Tier ${drive.tier}`} />
              <Row label="Openings" value={drive.openings ? String(drive.openings) : "Not specified"} />
              <Row label="Deadline" value={formatDate(drive.deadline)} />
              <Row label="Source" value={drive.source} />
              <Row label="Created by" value={drive.createdBy.name} />
              <Row label="Published" value={formatDateTime(drive.publishedAt)} />
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" /> {drive.location}
              </p>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5" /> Deadline {formatDate(drive.deadline)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Eligibility rules</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Minimum CGPA" value={rule?.minCgpa?.toString() ?? "None"} />
              <Row label="Maximum backlogs" value={rule?.maxBacklogs?.toString() ?? "None"} />
              <Row label="Branches" value={rule?.allowedBranches || "All"} />
              <Row label="Graduation years" value={rule?.allowedGraduationYears || "All"} />
              <Row label="Verified profile" value={rule?.requireVerifiedProfile ? "Required" : "Not required"} />
              <Row label="Resume" value={rule?.requireResume ? "Required" : "Not required"} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Exports</CardTitle>
              <CardDescription>
                Eligible candidates and shortlists scoped to this drive.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-medium">Eligible list</p>
                <div className="flex flex-wrap gap-2">
                  <ExportButton
                    url={`/api/exports/eligible?driveId=${drive.id}&format=csv`}
                    label="Eligible CSV"
                    format="csv"
                  />
                  <ExportButton
                    url={`/api/exports/eligible?driveId=${drive.id}&format=pdf`}
                    label="Eligible PDF"
                    format="pdf"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Shortlists</p>
                <ShortlistExportControls
                  driveId={drive.id}
                  rounds={drive.rounds.map((round) => ({
                    id: round.id,
                    name: round.name,
                    order: round.order,
                  }))}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Required skills</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {drive.requiredSkills.map((required) => (
                  <div key={required.id} className="flex items-center justify-between gap-2 text-sm">
                    <div>
                      <p>{required.skill.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Level {required.minProficiency}/5 · weight {required.weight}
                      </p>
                    </div>
                    <Badge variant={required.isMandatory ? "outline" : "secondary"}>
                      {required.isMandatory ? "Mandatory" : "Preferred"}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
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
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border p-4">
      <span className="rounded-md bg-muted p-2">
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-xl font-bold">{value}</p>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
