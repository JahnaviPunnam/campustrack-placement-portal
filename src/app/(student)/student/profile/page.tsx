import Link from "next/link";
import { redirect } from "next/navigation";
import { BadgeCheck, FileText, ShieldQuestion, Sparkles } from "lucide-react";
import { getCurrentUser } from "@/server/auth/guards";
import { prisma } from "@/server/db";
import { getStudentProfile } from "@/server/services/students";
import { PageHeader } from "@/components/shared/page-header";
import { ProfileForm } from "@/components/student/profile-form";
import { ResumeUploader } from "@/components/student/resume-uploader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { computeProfileCompleteness } from "@/lib/profile-completeness";

export const metadata = { title: "Profile" };

export default async function StudentProfilePage() {
  const user = await getCurrentUser();
  if (!user?.studentProfile) redirect("/login");
  const [profile, roleProfiles] = await Promise.all([
    getStudentProfile(user.studentProfile.id),
    prisma.roleProfile.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  const completeness = computeProfileCompleteness({
    phone: profile.phone,
    location: profile.location,
    branch: profile.branch,
    graduationYear: profile.graduationYear,
    cgpa: profile.cgpa,
    backlogs: profile.backlogs,
    resumePath: profile.resumePath,
    githubUrl: profile.githubUrl,
    linkedinUrl: profile.linkedinUrl,
    skillCount: profile.skills.length,
    evidenceSkillCount: profile.skills.filter((skill) => skill.evidence).length,
    targetRoleProfileId: profile.targetRoleProfileId,
  });

  return (
    <div>
      <PageHeader
        title="Profile"
        description="Keep your academic details, links, and resume current. Changes are audited."
        actions={
          <Button asChild variant="outline">
            <Link href="/student/skills">Manage skills</Link>
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card>
          <CardHeader>
            <CardTitle>Personal and academic details</CardTitle>
            <CardDescription>Verification status is controlled by the placement office.</CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileForm
              email={profile.user.email}
              name={profile.user.name}
              phone={profile.phone}
              branch={profile.branch}
              graduationYear={profile.graduationYear}
              cgpa={profile.cgpa}
              backlogs={profile.backlogs}
              headline={profile.headline}
              location={profile.location}
              githubUrl={profile.githubUrl}
              linkedinUrl={profile.linkedinUrl}
              targetRoleProfileId={profile.targetRoleProfileId}
              roleProfiles={roleProfiles}
            />
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                {profile.isVerified ? (
                  <BadgeCheck className="h-4 w-4 text-emerald-500" />
                ) : (
                  <ShieldQuestion className="h-4 w-4 text-amber-500" />
                )}
                Verification
              </CardTitle>
            </CardHeader>
            <CardContent>
              {profile.isVerified ? (
                <div className="space-y-2">
                  <Badge variant="success">Verified profile</Badge>
                  <p className="text-sm text-muted-foreground">
                    Your academic details have been checked by the placement office.
                  </p>
                  {profile.verificationNote ? (
                    <p className="rounded-md bg-muted p-2 text-xs text-muted-foreground">
                      {profile.verificationNote}
                    </p>
                  ) : null}
                </div>
              ) : (
                <Alert variant="warning">
                  <ShieldQuestion className="h-4 w-4" />
                  <AlertTitle>Pending verification</AlertTitle>
                  <AlertDescription>
                    Drives requiring verification will block applications until an officer reviews
                    your profile.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4" /> Resume
              </CardTitle>
              <CardDescription>Only PDF files up to 5 MB.</CardDescription>
            </CardHeader>
            <CardContent>
              <ResumeUploader
                profileId={profile.id}
                fileName={profile.resumeOriginalName}
                updatedAt={profile.resumeUpdatedAt?.toISOString() ?? null}
                sizeBytes={profile.resumeSizeBytes}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4" /> Completeness
              </CardTitle>
              <CardDescription>{completeness.percentage}% complete</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Progress value={completeness.percentage} />
              <div className="space-y-2">
                {completeness.sections.map((section) => (
                  <div key={section.label} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{section.label}</span>
                    <span>
                      {section.earned}/{section.points}
                    </span>
                  </div>
                ))}
              </div>
              {completeness.missing.length > 0 ? (
                <div className="rounded-md border border-dashed p-3">
                  <p className="text-xs font-medium">Next steps</p>
                  <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
                    {completeness.missing.map((item) => (
                      <li key={item}>• {item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
