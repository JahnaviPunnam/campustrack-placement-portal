import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireRecruiter } from "@/server/auth/guards";
import { getRecruiterDriveEditorOptions } from "@/server/services/recruiter";
import { getPlacementPolicy } from "@/server/services/officer-companies";
import { PageHeader } from "@/components/shared/page-header";
import { DriveForm } from "@/components/officer/drive-form";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Request a drive" };
export const dynamic = "force-dynamic";

export default async function RequestDrivePage() {
  const { user, company, recruiter } = await requireRecruiter();
  const [options, policy] = await Promise.all([
    getRecruiterDriveEditorOptions({
      userId: user.id,
      recruiterProfileId: recruiter.id,
      companyId: company.id,
      companyName: company.name,
    }),
    getPlacementPolicy(),
  ]);

  return (
    <div>
      <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2">
        <Link href="/recruiter/drives">
          <ArrowLeft className="h-4 w-4" /> My drives
        </Link>
      </Button>
      <PageHeader
        title="Request a drive"
        description="Configure the role, eligibility rules, required skills, and rounds. The placement office reviews it before it goes live."
      />
      <DriveForm
        scope="recruiter"
        lockedCompanyId={company.id}
        companies={options.companies}
        skills={options.skills}
        mode="create"
        initial={{
          companyId: company.id,
          title: "",
          roleTitle: "",
          description: "",
          location: company.location ?? "",
          package: "",
          tier: company.tier,
          openings: "",
          deadline: "",
          minCgpa: "",
          maxBacklogs: "",
          allowedBranches: [],
          allowedGraduationYears: [],
          requireVerifiedProfile: policy.requireVerifiedProfileDefault,
          requireResume: true,
          requiredSkills: [],
          rounds: [],
        }}
      />
    </div>
  );
}
