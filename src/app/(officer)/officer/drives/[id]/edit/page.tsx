import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { DriveForm } from "@/components/officer/drive-form";
import { Button } from "@/components/ui/button";
import { parseCsvNumbers } from "@/lib/csv";
import { getDriveAdminDetail, getDriveEditorOptions } from "@/server/services/officer-drives";
import { AppError } from "@/server/errors";

export const metadata = { title: "Edit drive" };
export const dynamic = "force-dynamic";

export default async function EditDrivePage({ params }: { params: { id: string } }) {
  let drive: Awaited<ReturnType<typeof getDriveAdminDetail>>["drive"];
  try {
    drive = (await getDriveAdminDetail(params.id)).drive;
  } catch (error) {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  }
  if (!["DRAFT", "REJECTED"].includes(drive.status)) {
    redirect(`/officer/drives/${drive.id}`);
  }
  const options = await getDriveEditorOptions();
  const rule = drive.eligibilityRule;
  return (
    <div>
      <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2">
        <Link href={`/officer/drives/${drive.id}`}>
          <ArrowLeft className="h-4 w-4" /> {drive.title}
        </Link>
      </Button>
      <PageHeader
        title={`Edit ${drive.title}`}
        description="Saving resets a rejected drive to draft so it can be reviewed again."
      />
      <DriveForm
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
