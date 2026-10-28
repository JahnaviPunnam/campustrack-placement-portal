import Link from "next/link";
import { redirect } from "next/navigation";
import { BarChart3, Sparkles } from "lucide-react";
import { getCurrentUser } from "@/server/auth/guards";
import { getSkillsPageData } from "@/server/services/students";
import { PageHeader } from "@/components/shared/page-header";
import { SkillsManager } from "@/components/student/skills-manager";
import { StatCard } from "@/components/shared/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "Skills" };

export default async function StudentSkillsPage() {
  const user = await getCurrentUser();
  if (!user?.studentProfile) redirect("/login");
  const { profile, catalog, roleProfiles } = await getSkillsPageData(user.studentProfile.id);
  const verified = profile.skills.filter((skill) => skill.isVerified).length;
  const withEvidence = profile.skills.filter((skill) => skill.evidence).length;

  return (
    <div>
      <PageHeader
        title="Skills"
        description="Track proficiency honestly, attach evidence, and work toward your target role."
        actions={
          <Button asChild variant="outline">
            <Link href="/student/skills/gap">
              <BarChart3 className="h-4 w-4" /> View gap analysis
            </Link>
          </Button>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard title="Skills" value={profile.skills.length} hint="On your profile" icon={Sparkles} />
        <StatCard title="With evidence" value={withEvidence} hint="Projects and certifications" />
        <StatCard title="Verified" value={verified} hint="Checked by the placement office" />
      </div>

      <Card>
        <CardContent className="pt-6">
          <SkillsManager
            catalog={catalog}
            roleProfiles={roleProfiles}
            targetRoleProfileId={profile.targetRoleProfileId}
            skills={profile.skills.map((entry) => ({
              id: entry.id,
              skillId: entry.skillId,
              name: entry.skill.name,
              category: entry.skill.category,
              proficiency: entry.proficiency,
              evidence: entry.evidence,
              isVerified: entry.isVerified,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
