import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { DriveForm, type DriveFormInitial } from "@/components/officer/drive-form";
import { Button } from "@/components/ui/button";
import { getDriveEditorOptions } from "@/server/services/officer-drives";

export const metadata = { title: "New drive" };
export const dynamic = "force-dynamic";

const initial: DriveFormInitial = {
  companyId: "",
  title: "",
  roleTitle: "",
  description: "",
  location: "",
  package: "",
  tier: 2,
  openings: "",
  deadline: "",
  minCgpa: "",
  maxBacklogs: "",
  allowedBranches: [],
  allowedGraduationYears: [],
  requireVerifiedProfile: true,
  requireResume: true,
  requiredSkills: [],
  rounds: [],
};

export default async function NewDrivePage() {
  const options = await getDriveEditorOptions();
  return (
    <div>
      <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2">
        <Link href="/officer/drives">
          <ArrowLeft className="h-4 w-4" /> Drives
        </Link>
      </Button>
      <PageHeader
        title="New drive"
        description="Draft a drive, configure eligibility and rounds, then publish it to students."
      />
      <DriveForm companies={options.companies} skills={options.skills} initial={initial} mode="create" />
    </div>
  );
}
