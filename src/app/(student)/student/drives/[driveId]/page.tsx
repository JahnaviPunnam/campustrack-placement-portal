import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  Circle,
  Clock,
  MapPin,
  Package,
  ShieldCheck,
  Users,
  XCircle,
} from "lucide-react";
import { getCurrentUser } from "@/server/auth/guards";
import { getStudentDriveDetail } from "@/server/services/drives";
import { AppError } from "@/server/errors";
import { PageHeader } from "@/components/shared/page-header";
import { ApplyPanel } from "@/components/student/apply-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatDate, formatDateTime, formatPackage, isDeadlinePassed } from "@/lib/formatting";

export default async function StudentDriveDetailPage({ params }: { params: { driveId: string } }) {
  const user = await getCurrentUser();
  if (!user?.studentProfile) redirect("/login");

  let data: Awaited<ReturnType<typeof getStudentDriveDetail>>;
  try {
    data = await getStudentDriveDetail(user.studentProfile.id, params.driveId);
  } catch (error) {
    if (error instanceof AppError && error.code === "DRIVE_NOT_FOUND") notFound();
    throw error;
  }
  const { drive, student, result, application, override } = data;
  const skillMap = new Map(student.skills.map((skill) => [skill.skillId, skill]));
  const deadlinePassed = isDeadlinePassed(drive.deadline);
  const closed = drive.status !== "ACTIVE" || deadlinePassed;

  return (
    <div>
      <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2">
        <Link href="/student/drives">
          <ArrowLeft className="h-4 w-4" /> All drives
        </Link>
      </Button>

      <PageHeader
        title={drive.title}
        description={`${drive.company.name} · ${drive.roleTitle}`}
        actions={
          <>
            <Badge variant={closed ? "outline" : "success"}>{closed ? "Closed" : "Open"}</Badge>
            <Badge variant="secondary">Tier {drive.tier}</Badge>
            {application ? (
              <Button asChild variant="outline" size="sm">
                <Link href={`/student/applications/${application.id}`}>Your application</Link>
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>About the role</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" /> {drive.location}
                </span>
                <span className="flex items-center gap-1.5">
                  <Package className="h-4 w-4" /> {formatPackage(drive.package)}
                </span>
                <span className="flex items-center gap-1.5">
                  <Users className="h-4 w-4" /> {drive.openings ?? "—"} openings
                </span>
                <span className="flex items-center gap-1.5">
                  <CalendarClock className="h-4 w-4" /> Apply by {formatDate(drive.deadline)}
                </span>
              </div>
              <p className="whitespace-pre-line text-sm text-muted-foreground">
                {drive.description ?? "No description provided."}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Eligibility rules</CardTitle>
              <CardDescription>All mandatory rules must pass unless an officer override is active.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <Rule label="Minimum CGPA" value={drive.eligibilityRule?.minCgpa?.toFixed(2) ?? "No minimum"} />
              <Rule label="Maximum backlogs" value={drive.eligibilityRule?.maxBacklogs?.toString() ?? "No limit"} />
              <Rule
                label="Branches"
                value={
                  drive.eligibilityRule?.allowedBranches
                    ? drive.eligibilityRule.allowedBranches.split(",").filter(Boolean).join(", ")
                    : "All branches"
                }
              />
              <Rule
                label="Graduation years"
                value={
                  drive.eligibilityRule?.allowedGraduationYears
                    ? drive.eligibilityRule.allowedGraduationYears.split(",").filter(Boolean).join(", ")
                    : "All years"
                }
              />
              <Rule
                label="Verified profile"
                value={drive.eligibilityRule?.requireVerifiedProfile === false ? "Not required" : "Required"}
              />
              <Rule
                label="Resume"
                value={drive.eligibilityRule?.requireResume === false ? "Not required" : "Required"}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Required skills</CardTitle>
              <CardDescription>
                Your weighted skill match is {result.matchScore}%.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Progress value={result.matchScore} />
              <div className="divide-y">
                {drive.requiredSkills.map((required) => {
                  const current = skillMap.get(required.skillId)?.proficiency ?? 0;
                  const met = current >= required.minProficiency;
                  return (
                    <div key={required.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{required.skill.name}</p>
                          <Badge variant={required.isMandatory ? "secondary" : "outline"}>
                            {required.isMandatory ? "Required" : "Optional"}
                          </Badge>
                          <span className="text-xs text-muted-foreground">weight {required.weight}</span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Need {required.minProficiency}/5 · you have {current}/5
                        </p>
                      </div>
                      {met ? (
                        <span className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="h-4 w-4" /> Met
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-sm text-amber-600 dark:text-amber-400">
                          <Circle className="h-4 w-4" /> Gap of {Math.max(0, required.minProficiency - current)}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {result.missingSkills.length > 0 ? (
                <div className="rounded-lg border border-dashed p-4">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <BookOpen className="h-4 w-4" /> Resources for your gaps
                  </p>
                  <div className="mt-3 space-y-3">
                    {drive.requiredSkills
                      .filter((required) => result.missingSkills.some((missing) => missing.skillId === required.skillId))
                      .map((required) => (
                        <div key={required.id}>
                          <p className="text-sm font-medium">{required.skill.name}</p>
                          {required.skill.learningResources.length > 0 ? (
                            <ul className="mt-1 space-y-1">
                              {required.skill.learningResources.map((resource) => (
                                <li key={resource.id}>
                                  <a
                                    href={resource.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-sm text-primary hover:underline"
                                  >
                                    {resource.title}
                                  </a>
                                  <span className="ml-1 text-xs text-muted-foreground">
                                    {resource.type.toLowerCase()}
                                    {resource.provider ? ` · ${resource.provider}` : ""}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-xs text-muted-foreground">No resources linked yet.</p>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Selection process</CardTitle>
              <CardDescription>{drive.rounds.length} round(s)</CardDescription>
            </CardHeader>
            <CardContent>
              {drive.rounds.length === 0 ? (
                <p className="text-sm text-muted-foreground">Round details will be announced later.</p>
              ) : (
                <ol className="relative space-y-4 border-l pl-5">
                  {drive.rounds.map((round) => (
                    <li key={round.id} className="relative">
                      <span className="absolute -left-[27px] top-1 flex h-3 w-3 items-center justify-center rounded-full border-2 border-background bg-primary" />
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">
                          {round.order}. {round.name}
                        </p>
                        <Badge variant="outline">{round.type.toLowerCase()}</Badge>
                        {round.status === "SCHEDULED" ? <Badge variant="info">Scheduled</Badge> : null}
                      </div>
                      <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {round.scheduledAt ? (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {formatDateTime(round.scheduledAt)}
                          </span>
                        ) : (
                          <span>Schedule to be announced</span>
                        )}
                        {round.venue ? <span>· {round.venue}</span> : null}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="lg:sticky lg:top-24">
            <CardHeader>
              <CardTitle>Eligibility</CardTitle>
              <CardDescription>
                {override
                  ? "An active officer override allows your application."
                  : result.eligible
                    ? "You meet the rules for this drive."
                    : "Resolve these items to apply."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {closed && !application ? (
                <div className="space-y-3">
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                    <p className="flex items-center gap-2 font-medium">
                      <XCircle className="h-4 w-4" /> Applications are closed
                    </p>
                    <p className="mt-1">{deadlinePassed ? "The deadline has passed." : "This drive is no longer active."}</p>
                  </div>
                  {result.reasons.length > 0 ? (
                    <ul className="space-y-1.5 text-sm text-muted-foreground">
                      {result.reasons.map((reason) => (
                        <li key={`${reason.code}-${reason.skillId ?? ""}`}>• {reason.message}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : (
                <ApplyPanel
                  driveId={drive.id}
                  eligible={result.eligible}
                  reasons={result.reasons.map((reason) => reason.message)}
                  warnings={result.warnings.map((warning) => warning.message)}
                  overrideReason={override?.reason ?? null}
                  application={application ? { id: application.id, status: application.status } : null}
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-4 w-4" /> Match snapshot
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Skill match</span>
                <Badge variant={result.matchScore >= 75 ? "success" : result.matchScore >= 40 ? "warning" : "destructive"}>
                  {result.matchScore}%
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Skills met</span>
                <span>{result.matchedSkillIds.length}/{drive.requiredSkills.length}</span>
              </div>
              {result.isDreamOffer ? (
                <div className="rounded-md bg-violet-50 p-2 text-xs text-violet-800 dark:bg-violet-950/30 dark:text-violet-200">
                  Dream-offer upgrade applies to this drive.
                </div>
              ) : null}
              <p className="text-xs text-muted-foreground">
                Eligibility is re-checked when you apply. Your snapshot is stored with the application.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Rule({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}
