import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireRecruiter } from "@/server/auth/guards";
import {
  getRecruiterDriveDetail,
  getRecruiterDriveEditorOptions,
} from "@/server/services/recruiter";
import { AppError } from "@/server/errors";
import { parseCsvNumbers } from "@/lib/csv";
import { PageHeader } from "@/components/shared/page-header";
import { DriveForm } from "@/components/officer/drive-form";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Edit drive request" };
export const dynamic = "force-dynamic";

export default async function EditRecruiterDrivePage({ params }: { params: { id: string } }) {
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
  if (drive.source !== "RECRUITER" || drive.status !== "REJECTED") {
    redirect(`/recruiter/drives/${drive.id}`);
  }
  const options = await getRecruiterDriveEditorOptions(context);
  const rule = drive.eligibilityRule;

  return (
    <div>
      <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2">
        <Link href={`/recruiter/drives/${drive.id}`}>
          <ArrowLeft className="h-4 w-4" /> {drive.title}
        </Link>
      </Button>
      <PageHeader
        title={`Edit ${drive.title}`}
        description="Saving resubmits the rejected request to the placement office for approval."
      />
      <DriveForm
        scope="recruiter"
        lockedCompanyId={company.id}
        companies={options.companies}
        skills={options.skills}
        mode="edit"
        initial={{
          id: drive.id,
          companyId: drive.companyId,
          title: drive.title,
          roleTitle: drive.roleTitle,
          description: drive.description ?? "",
          location: drive.location,
          package: String(drive.package),
          tier: drive.tier,
          openings: drive.openings?.toString() ?? "",
          deadline: drive.deadline.toISOString().slice(0, 10),
          minCgpa: rule?.minCgpa?.toString() ?? "",
          maxBacklogs: rule?.maxBacklogs?.toString() ?? "",
          allowedBranches: rule?.allowedBranches.split(",").filter(Boolean) ?? [],
          allowedGraduationYears: parseCsvNumbers(rule?.allowedGraduationYears),
          requireVerifiedProfile: rule?.requireVerifiedProfile ?? true,
          requireResume: rule?.requireResume ?? true,
          requiredSkills: drive.requiredSkills.map((skill) => ({
            skillId: skill.skillId,
            minProficiency: skill.minProficiency,
            weight: skill.weight,
            isMandatory: skill.isMandatory,
          })),
          rounds: drive.rounds.map((round) => ({
            name: round.name,
            type: round.type,
            description: round.description ?? "",
            scheduledAt: round.scheduledAt ? round.scheduledAt.toISOString().slice(0, 16) : "",
            durationMinutes: round.durationMinutes?.toString() ?? "",
            venue: round.venue ?? "",
            meetingLink: round.meetingLink ?? "",
          })),
        }}
      />
    </div>
  );
}
