import Link from "next/link";
import { BriefcaseBusiness, CheckSquare, Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { DRIVE_STATUSES, DRIVE_STATUS_LABELS } from "@/lib/constants";
import { formatDate, formatPackage } from "@/lib/formatting";
import { listDrives } from "@/server/services/officer-drives";

export const metadata = { title: "Drives" };
export const dynamic = "force-dynamic";

export default async function OfficerDrivesPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string; tier?: string };
}) {
  const tier = Number(searchParams.tier);
  const drives = await listDrives({
    q: searchParams.q?.trim() || undefined,
    status: DRIVE_STATUSES.includes(searchParams.status as (typeof DRIVE_STATUSES)[number])
      ? searchParams.status
      : undefined,
    tier: Number.isInteger(tier) && tier >= 1 && tier <= 3 ? tier : undefined,
  });

  return (
    <div>
      <PageHeader
        title="Drives"
        description="Create drives, approve recruiter submissions, and run the candidate pipeline."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/officer/approvals">
                <CheckSquare className="h-4 w-4" /> Approvals
              </Link>
            </Button>
            <Button asChild>
              <Link href="/officer/drives/new">
                <Plus className="h-4 w-4" /> New drive
              </Link>
            </Button>
          </>
        }
      />

      <Card className="mb-5">
        <CardContent className="pt-6">
          <form method="get" className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.5fr_0.8fr_0.7fr_auto_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                name="q"
                defaultValue={searchParams.q ?? ""}
                placeholder="Drive, role or company"
                className="pl-9"
              />
            </div>
            <Select name="status" defaultValue={searchParams.status ?? ""}>
              <option value="">All statuses</option>
              {DRIVE_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {DRIVE_STATUS_LABELS[status]}
                </option>
              ))}
            </Select>
            <Select name="tier" defaultValue={searchParams.tier ?? ""}>
              <option value="">All tiers</option>
              <option value="1">Tier 1</option>
              <option value="2">Tier 2</option>
              <option value="3">Tier 3</option>
            </Select>
            <Button type="submit">Filter</Button>
            <Button asChild variant="ghost">
              <Link href="/officer/drives">Clear</Link>
            </Button>
          </form>
        </CardContent>
      </Card>

      {drives.length === 0 ? (
        <EmptyState
          icon={BriefcaseBusiness}
          title="No drives found"
          description="Create a drive or adjust the current filters."
          actionHref="/officer/drives/new"
          actionLabel="New drive"
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
                    <th className="px-4 py-3 font-medium">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {drives.map((drive) => (
                    <tr key={drive.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <Link href={`/officer/drives/${drive.id}`} className="font-medium hover:underline">
                          {drive.title}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {drive.company.name} · {drive.roleTitle}
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
                          {DRIVE_STATUS_LABELS[drive.status as keyof typeof DRIVE_STATUS_LABELS]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">{formatDate(drive.deadline)}</td>
                      <td className="px-4 py-3">{drive._count.applications}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs">{drive.createdBy.name}</span>
                      </td>
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
