import Link from "next/link";
import { CheckSquare } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { DriveApprovalActions } from "@/components/officer/drive-approval-actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, formatPackage } from "@/lib/formatting";
import { listDrives } from "@/server/services/officer-drives";

export const metadata = { title: "Drive approvals" };
export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  const drives = await listDrives({ status: "PENDING_APPROVAL" });

  return (
    <div>
      <PageHeader
        title="Drive approvals"
        description="Review recruiter submissions before they become visible to students."
      />
      {drives.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          title="No drives awaiting approval"
          description="Recruiter submissions will appear here for review."
        />
      ) : (
        <div className="space-y-4">
          {drives.map((drive) => (
            <Card key={drive.id}>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle>
                      <Link href={`/officer/drives/${drive.id}`} className="hover:underline">
                        {drive.title}
                      </Link>
                    </CardTitle>
                    <CardDescription>
                      {drive.company.name} · {drive.roleTitle} · submitted by {drive.createdBy.name}
                    </CardDescription>
                  </div>
                  <DriveApprovalActions driveId={drive.id} />
                </div>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2 text-sm">
                <Badge variant="secondary">{formatPackage(drive.package)}</Badge>
                <Badge variant="outline">Tier {drive.tier}</Badge>
                <Badge variant="outline">{drive._count.requiredSkills} skills</Badge>
                <Badge variant="outline">{drive._count.rounds} rounds</Badge>
                <Badge variant="warning">Deadline {formatDate(drive.deadline)}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
