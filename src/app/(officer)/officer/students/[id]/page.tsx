import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BadgeCheck, FileText, Mail, Phone } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { VerifySkillControl, VerifyStudentControl } from "@/components/officer/verification-controls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { APPLICATION_STATUS_LABELS } from "@/lib/constants";
import { formatCgpa, formatDate, formatDateTime, formatPackage } from "@/lib/formatting";
import { getStudentAdminDetail } from "@/server/services/officer-students";
import { AppError } from "@/server/errors";

export const dynamic = "force-dynamic";

export default async function StudentDetailPage({ params }: { params: { id: string } }) {
  let data: Awaited<ReturnType<typeof getStudentAdminDetail>>;
  try {
    data = await getStudentAdminDetail(params.id);
  } catch (error) {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  }
  const { student, auditLogs } = data;
  const acceptedOffer = student.offers.find((offer) => offer.status === "ACCEPTED");

  return (
    <div>
      <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2">
        <Link href="/officer/students">
          <ArrowLeft className="h-4 w-4" /> Students
        </Link>
      </Button>
      <PageHeader
        title={student.user.name}
        description={`${student.rollNumber} · ${student.branch} · Class of ${student.graduationYear}`}
        actions={
          <>
            {student.resumePath ? (
              <Button asChild variant="outline">
                <a href={`/api/resumes/${student.id}`} target="_blank" rel="noreferrer">
                  <FileText className="h-4 w-4" /> Resume
                </a>
              </Button>
            ) : null}
            {student.isVerified ? (
              <Badge variant="success" className="gap-1 px-3 py-1.5">
                <BadgeCheck className="h-3.5 w-3.5" /> Verified
              </Badge>
            ) : (
              <Badge variant="warning" className="px-3 py-1.5">
                Verification pending
              </Badge>
            )}
          </>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Academic profile</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Detail label="CGPA" value={formatCgpa(student.cgpa)} />
              <Detail label="Backlogs" value={String(student.backlogs)} />
              <Detail label="Graduation year" value={String(student.graduationYear)} />
              <Detail label="Target role" value={student.targetRoleProfile?.name ?? "Not set"} />
              <Detail
                label="Email"
                value={
                  <span className="inline-flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                    {student.user.email}
                  </span>
                }
              />
              <Detail
                label="Phone"
                value={
                  student.phone ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                      {student.phone}
                    </span>
                  ) : (
                    "Not provided"
                  )
                }
              />
              <Detail label="Account" value={student.user.isActive ? "Active" : "Deactivated"} />
              <Detail label="Last login" value={formatDateTime(student.user.lastLoginAt)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Skills</CardTitle>
              <CardDescription>
                {student.skills.length} declared skill{student.skills.length === 1 ? "" : "s"}.
                Verified claims are visible to recruiters.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {student.skills.length === 0 ? (
                <p className="text-sm text-muted-foreground">No skills declared yet.</p>
              ) : (
                <div className="divide-y rounded-lg border">
                  {student.skills.map((skill) => (
                    <div key={skill.id} className="flex flex-wrap items-start justify-between gap-3 p-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{skill.skill.name}</p>
                          <Badge variant={skill.isVerified ? "success" : "outline"}>
                            {skill.isVerified ? "Verified" : "Unverified"}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            Level {skill.proficiency}/5
                          </span>
                        </div>
                        {skill.evidence ? (
                          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{skill.evidence}</p>
                        ) : null}
                        {skill.isVerified && skill.verifiedBy ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Verified by {skill.verifiedBy.name} on {formatDate(skill.verifiedAt)}
                          </p>
                        ) : null}
                      </div>
                      <VerifySkillControl studentSkillId={skill.id} isVerified={skill.isVerified} />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Applications</CardTitle>
              <CardDescription>All drive applications, newest first.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {student.applications.length === 0 ? (
                <p className="px-6 pb-6 text-sm text-muted-foreground">No applications yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-y bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-4 py-2.5 font-medium">Drive</th>
                        <th className="px-4 py-2.5 font-medium">Status</th>
                        <th className="px-4 py-2.5 font-medium">Current round</th>
                        <th className="px-4 py-2.5 font-medium">Applied</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {student.applications.map((application) => (
                        <tr key={application.id}>
                          <td className="px-4 py-3">
                            <p className="font-medium">{application.drive.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {application.drive.company.name}
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
                          </td>
                          <td className="px-4 py-3">{application.currentRound?.name ?? "—"}</td>
                          <td className="px-4 py-3">{formatDate(application.appliedAt)}</td>
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
              <CardTitle>Recent profile activity</CardTitle>
            </CardHeader>
            <CardContent>
              {auditLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No recorded activity.</p>
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
              <CardTitle>Verification</CardTitle>
              <CardDescription>
                Confirm academic details against office records before opening verified-only drives.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {student.verifiedAt ? (
                <p className="text-xs text-muted-foreground">
                  Verified {formatDate(student.verifiedAt)}
                  {student.verifiedBy ? ` by ${student.verifiedBy.name}` : ""}
                </p>
              ) : null}
              <VerifyStudentControl
                studentProfileId={student.id}
                isVerified={student.isVerified}
                note={student.verificationNote}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Placement summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Detail
                label="Best accepted offer"
                value={
                  acceptedOffer
                    ? `${formatPackage(acceptedOffer.package)} · ${acceptedOffer.roleTitle} at ${acceptedOffer.application.drive.company.name}`
                    : "Not placed"
                }
              />
              <Detail label="Applications" value={String(student.applications.length)} />
              <Detail label="Offers" value={String(student.offers.length)} />
              <Detail label="Member since" value={formatDate(student.user.createdAt)} />
              <p className="text-xs text-muted-foreground">
                Exports and reports follow the active placement policy.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-0.5 text-sm">{value}</div>
    </div>
  );
}
