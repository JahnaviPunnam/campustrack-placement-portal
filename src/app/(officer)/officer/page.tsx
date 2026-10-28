import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CircleDollarSign,
  ClipboardCheck,
  GraduationCap,
  ShieldCheck,
  TrendingUp,
  Users,
} from "lucide-react";
import { getCurrentUser } from "@/server/auth/guards";
import { getOfficerDashboard } from "@/server/services/analytics";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ApplicationStatusChart, BranchPlacementChart } from "@/components/charts/placement-charts";
import { formatDate, formatPackage, formatPercent } from "@/lib/formatting";

export const dynamic = "force-dynamic";

export default async function OfficerDashboard() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const data = await getOfficerDashboard();
  const { metrics } = data;

  return (
    <div>
      <PageHeader
        title="Placement overview"
        description="Live campus-wide metrics, approvals, and verification queues."
        actions={
          <>
            {metrics.pendingApprovals > 0 ? (
              <Button asChild variant="outline">
                <Link href="/officer/approvals">
                  <ClipboardCheck className="h-4 w-4" /> {metrics.pendingApprovals} approval
                  {metrics.pendingApprovals === 1 ? "" : "s"}
                </Link>
              </Button>
            ) : null}
            <Button asChild>
              <Link href="/officer/drives/new">Create drive</Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total students"
          value={metrics.totalStudents}
          icon={Users}
          hint={`${metrics.verifiedStudents} verified (${formatPercent(metrics.verificationRate)})`}
        />
        <StatCard
          title="Placement rate"
          value={formatPercent(metrics.placementRate)}
          icon={GraduationCap}
          hint={`${metrics.placedStudents} students placed`}
        />
        <StatCard
          title="Average package"
          value={formatPackage(metrics.averagePackage)}
          icon={CircleDollarSign}
          hint={`Median ${formatPackage(metrics.medianPackage)}`}
        />
        <StatCard
          title="Highest package"
          value={formatPackage(metrics.highestPackage)}
          icon={TrendingUp}
          hint={`${metrics.activeDrives} active drives`}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Branch-wise placement</CardTitle>
            <CardDescription>Students placed versus total students in each branch.</CardDescription>
          </CardHeader>
          <CardContent>
            <BranchPlacementChart data={data.branchPlacement} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Application pipeline</CardTitle>
            <CardDescription>All applications by current status.</CardDescription>
          </CardHeader>
          <CardContent>
            <ApplicationStatusChart data={data.statusCounts} />
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Recent drives</CardTitle>
              <CardDescription>Applications and overrides per drive.</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/officer/drives">Manage drives</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {data.recentDrives.map((drive) => (
                <Link
                  key={drive.id}
                  href={`/officer/drives/${drive.id}`}
                  className="flex flex-col gap-2 py-3 hover:opacity-80 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium">{drive.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {drive.company.name} · {formatPackage(drive.package)} · closes {formatDate(drive.deadline)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={
                        drive.status === "ACTIVE"
                          ? "success"
                          : drive.status === "PENDING_APPROVAL"
                            ? "warning"
                            : "secondary"
                      }
                    >
                      {drive.status.replaceAll("_", " ")}
                    </Badge>
                    <span className="text-sm font-medium">{drive._count.applications} applicants</span>
                    {drive._count.overrides > 0 ? (
                      <Badge variant="outline">{drive._count.overrides} overrides</Badge>
                    ) : null}
                  </div>
                </Link>
              ))}
              {data.recentDrives.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No drives yet. Create the first one to start notifying eligible students.
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" /> Verification queue
            </CardTitle>
            <CardDescription>Unverified student profiles.</CardDescription>
          </CardHeader>
          <CardContent>
            {data.pendingVerification.length === 0 ? (
              <p className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">
                Every profile is verified.
              </p>
            ) : (
              <ul className="divide-y">
                {data.pendingVerification.map((student) => (
                  <li key={student.id} className="py-2.5">
                    <Link
                      href={`/officer/students/${student.id}`}
                      className="flex items-center justify-between gap-2 hover:opacity-80"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{student.user.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {student.rollNumber} · {student.branch}
                        </p>
                      </div>
                      <Badge variant="warning">Review</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <Button asChild variant="outline" size="sm" className="mt-3 w-full">
              <Link href="/officer/students?verified=0">Open queue</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top hiring companies</CardTitle>
            <CardDescription>Accepted offers by company.</CardDescription>
          </CardHeader>
          <CardContent>
            {data.companyOffers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No offers recorded yet.</p>
            ) : (
              <div className="divide-y">
                {data.companyOffers.map((company, index) => (
                  <div key={company.company} className="flex items-center justify-between py-2.5">
                    <div className="flex items-center gap-3">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                        {index + 1}
                      </span>
                      <p className="text-sm font-medium">{company.company}</p>
                    </div>
                    <div className="text-right text-sm">
                      <p>{company.offers} offers</p>
                      <p className="text-xs text-muted-foreground">{formatPackage(company.averagePackage)} avg</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick actions</CardTitle>
            <CardDescription>Common placement-cell workflows.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            <Button asChild variant="outline" className="w-full justify-start gap-2">
              <Link href="/officer/students">
                <Users className="h-4 w-4" /> Manage students
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-start gap-2">
              <Link href="/officer/students/import">
                <ClipboardCheck className="h-4 w-4" /> Import CSV
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-start gap-2">
              <Link href="/officer/companies">Companies and recruiters</Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-start gap-2">
              <Link href="/officer/reports">Reports</Link>
            </Button>
            <div className="col-span-full rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
              Eligibility is re-evaluated on activation and every application. Overrides are
              audited and snapshots are immutable.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
