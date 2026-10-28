import Link from "next/link";
import { BriefcaseBusiness, Plus, Search } from "lucide-react";
import { requireRecruiter } from "@/server/auth/guards";
import { listRecruiterDrives } from "@/server/services/recruiter";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DRIVE_STATUS_LABELS, type DriveStatus } from "@/lib/constants";
import { formatDate, formatPackage } from "@/lib/formatting";

export const metadata = { title: "My drives" };
export const dynamic = "force-dynamic";

export default async function RecruiterDrivesPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string };
}) {
  const { user, company, recruiter } = await requireRecruiter();
  const drives = await listRecruiterDrives({
    userId: user.id,
    recruiterProfileId: recruiter.id,
    companyId: company.id,
    companyName: company.name,
  });
  const query = searchParams.q?.trim().toLowerCase();
  const status = searchParams.status;
  const filtered = drives.filter((drive) => {
    const matchesQuery = query
      ? `${drive.title} ${drive.roleTitle} ${drive.location}`.toLowerCase().includes(query)
      : true;
    return matchesQuery && (status ? drive.status === status : true);
  });

  return (
    <div>
      <PageHeader
        title="My drives"
        description={`Drives requested and run by ${company.name}.`}
        actions={
          <Button asChild>
            <Link href="/recruiter/drives/request">
              <Plus className="h-4 w-4" /> Request a drive
            </Link>
          </Button>
        }
      />

      <Card className="mb-5">
        <CardContent className="pt-6">
          <form method="get" className="grid gap-3 sm:grid-cols-[1fr_0.7fr_auto_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                name="q"
                defaultValue={searchParams.q ?? ""}
                placeholder="Search drives or locations"
                className="pl-9"
              />
            </div>
            <select
              name="status"
              defaultValue={searchParams.status ?? ""}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">All statuses</option>
              {Object.entries(DRIVE_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <Button type="submit">Filter</Button>
            <Button asChild variant="ghost">
              <Link href="/recruiter/drives">Clear</Link>
            </Button>
          </form>
        </CardContent>
      </Card>

      {filtered.length === 0 ? (
        <EmptyState
          icon={BriefcaseBusiness}
          title="No drives found"
          description="Adjust the filters or request a new drive for approval."
          actionHref="/recruiter/drives/request"
          actionLabel="Request a drive"
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Drive</th>
                    <th className="px-4 py-3 font-medium">Package</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Deadline</th>
                    <th className="px-4 py-3 font-medium">Applicants</th>
                    <th className="px-4 py-3 font-medium">Rounds</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((drive) => (
                    <tr key={drive.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <Link href={`/recruiter/drives/${drive.id}`} className="font-medium hover:underline">
                          {drive.title}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {drive.roleTitle} · {drive.location}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p>{formatPackage(drive.package)}</p>
                        <p className="text-xs text-muted-foreground">Tier {drive.tier}</p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={
                            drive.status === "ACTIVE"
                              ? "success"
                              : drive.status === "PENDING_APPROVAL"
                                ? "warning"
                                : drive.status === "REJECTED"
                                  ? "destructive"
                                  : "outline"
                          }
                        >
                          {DRIVE_STATUS_LABELS[drive.status as DriveStatus] ?? drive.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">{formatDate(drive.deadline)}</td>
                      <td className="px-4 py-3">{drive._count.applications}</td>
                      <td className="px-4 py-3">{drive._count.rounds}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
