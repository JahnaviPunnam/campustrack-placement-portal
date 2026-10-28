import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowUpRight, BookOpen, Target, TriangleAlert } from "lucide-react";
import { getCurrentUser } from "@/server/auth/guards";
import { getRoleOptions, getSkillGapForRole } from "@/server/services/skill-gap";
import { getStudentProfile } from "@/server/services/students";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/shared/empty-state";

export const metadata = { title: "Skill gap" };

export default async function SkillGapPage({
  searchParams,
}: {
  searchParams: { role?: string };
}) {
  const user = await getCurrentUser();
  if (!user?.studentProfile) redirect("/login");
  const [profile, roles] = await Promise.all([
    getStudentProfile(user.studentProfile.id),
    getRoleOptions(),
  ]);
  const requestedRole = searchParams.role && roles.some((role) => role.id === searchParams.role)
    ? searchParams.role
    : null;
  const selectedRole =
    requestedRole ?? profile.targetRoleProfileId ?? roles[0]?.id ?? null;
  const selected = roles.find((role) => role.id === selectedRole) ?? null;
  const result = selected ? await getSkillGapForRole(profile.id, selected.id) : null;

  return (
    <div>
      <PageHeader
        title="Skill gap"
        description="Compare your current skills against a target role and focus on the highest-impact gaps."
      />

      {roles.length === 0 ? (
        <EmptyState
          icon={Target}
          title="No target roles configured"
          description="The placement office has not published role profiles yet."
        />
      ) : (
        <div className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              <form method="get" className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1 space-y-2">
                  <label htmlFor="role" className="text-sm font-medium">
                    Target role
                  </label>
                  <Select id="role" name="role" defaultValue={selectedRole ?? ""}>
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <Button type="submit">Analyse gap</Button>
              </form>
              {selected?.description ? (
                <p className="mt-3 text-sm text-muted-foreground">{selected.description}</p>
              ) : null}
            </CardContent>
          </Card>

          {result ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Readiness for {result.targetName}</CardTitle>
                  <CardDescription>
                    {result.gap.totalTargetSkills - result.gap.missing.length} of{" "}
                    {result.gap.totalTargetSkills} target skills meet the required level.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-2xl font-bold">{result.gap.matchScore}%</span>
                      <Badge variant={result.gap.matchScore >= 75 ? "success" : result.gap.matchScore >= 40 ? "warning" : "destructive"}>
                        {result.gap.matchScore >= 75 ? "Strong" : result.gap.matchScore >= 40 ? "Developing" : "Early"}
                      </Badge>
                    </div>
                    <Progress value={result.gap.matchScore} />
                  </div>
                  {result.gap.strengths.length > 0 ? (
                    <div>
                      <p className="text-sm font-medium">Strengths</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {result.gap.strengths.map((skill) => (
                          <Badge key={skill.skillId} variant="secondary">
                            {skill.name} · {skill.current}/{skill.required}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              <div>
                <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
                  <TriangleAlert className="h-4 w-4 text-amber-500" /> Priority gaps
                </h2>
                {result.gap.missing.length === 0 ? (
                  <Card>
                    <CardContent className="p-6 text-sm text-muted-foreground">
                      You meet every requirement for this role. Keep adding evidence as you build.
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {result.gap.missing.map((skill) => (
                      <Card key={skill.skillId}>
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <CardTitle className="text-base">{skill.name}</CardTitle>
                              <CardDescription>
                                You: {skill.current}/5 · Required: {skill.required}/5
                              </CardDescription>
                            </div>
                            <Badge variant={skill.isMandatory ? "destructive" : "outline"}>
                              {skill.isMandatory ? "Required" : "Optional"}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <Progress value={(skill.current / 5) * 100} className="h-1.5" />
                          {skill.resources.length > 0 ? (
                            <div>
                              <p className="flex items-center gap-1.5 text-xs font-medium">
                                <BookOpen className="h-3.5 w-3.5" /> Learn
                              </p>
                              <ul className="mt-1.5 space-y-1">
                                {skill.resources.map((resource) => (
                                  <li key={`${skill.skillId}-${resource.url}`}>
                                    <a
                                      href={resource.url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                                    >
                                      {resource.title}
                                      <ArrowUpRight className="h-3 w-3" />
                                    </a>
                                    {resource.provider ? (
                                      <span className="ml-1 text-xs text-muted-foreground">
                                        · {resource.provider}
                                      </span>
                                    ) : null}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground">No resources linked yet.</p>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button asChild>
                  <Link href="/student/skills">Update your skills</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href={`/student/drives?role=${selected?.id ?? ""}`}>Browse matching drives</Link>
                </Button>
              </div>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
