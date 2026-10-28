import Link from "next/link";
import { Activity, Download, FileText, Filter, Layers, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { ExportButton } from "@/components/shared/export-button";
import { ShortlistExportControls } from "@/components/reports/shortlist-export-controls";
import {
  BranchPlacementChart,
  CompanyOffersChart,
  DriveFunnelChart,
  MonthlyOffersChart,
  SkillDemandHeatmap,
  TopDemandSkills,
} from "@/components/charts/placement-charts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import {
  getDriveFunnels,
  getPlacementReport,
  getSkillDemandAnalytics,
} from "@/server/services/analytics";
import { formatDate, formatPackage, formatPercent } from "@/lib/formatting";
import { funnelConversion } from "@/lib/reporting";

export const metadata = { title: "Reports" };
export const dynamic = "force-dynamic";

type SearchParams = { year?: string; branch?: string; company?: string; drive?: string };

export default async function ReportsPage({ searchParams }: { searchParams: SearchParams }) {
  const year = Number(searchParams.year);
  const filters = {
    graduationYear: Number.isInteger(year) && year > 2000 ? year : undefined,
    branch: searchParams.branch || undefined,
    companyId: searchParams.company || undefined,
  };
  const report = await getPlacementReport(filters);
  const driveId = report.filterOptions.drives.some((drive) => drive.id === searchParams.drive)
    ? searchParams.drive
    : undefined;
  const analyticsFilters = { ...filters, driveId };
  const [skills, funnels] = await Promise.all([
    getSkillDemandAnalytics(analyticsFilters),
    getDriveFunnels(analyticsFilters),
  ]);
  const selectedFunnel = driveId ? (funnels[0] ?? null) : null;

  const query = new URLSearchParams();
  if (filters.graduationYear) query.set("year", String(filters.graduationYear));
  if (filters.branch) query.set("branch", filters.branch);
  if (filters.companyId) query.set("company", filters.companyId);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  const driveHref = (id?: string) => {
    const next = new URLSearchParams(query);
    if (id) next.set("drive", id);
    return `/officer/reports${next.toString() ? `?${next.toString()}` : ""}`;
  };

  return (
    <div>
      <PageHeader
        title="Placement reports"
        description="Placement outcomes, drive funnels, and skill supply/demand across the campus."
        actions={
          <>
            <ExportButton
              url={`/api/officer/reports/placement${suffix ? `${suffix}&format=csv` : "?format=csv"}`}
              label="Placement CSV"
              format="csv"
            />
            <ExportButton
              url={`/api/officer/reports/placement${suffix ? `${suffix}&format=pdf` : "?format=pdf"}`}
              label="Placement PDF"
              format="pdf"
            />
          </>
        }
      />

      <Card className="mb-5">
        <CardContent className="pt-6">
          <form method="get" className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Filter className="h-3.5 w-3.5" /> Graduation year
              </span>
              <Select name="year" defaultValue={searchParams.year ?? ""} className="w-40">
                <option value="">All years</option>
                {report.filterOptions.years.map((entry) => (
                  <option key={entry} value={entry}>
                    {entry}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Branch</span>
              <Select name="branch" defaultValue={searchParams.branch ?? ""} className="w-40">
                <option value="">All branches</option>
                {report.filterOptions.branches.map((branch) => (
                  <option key={branch} value={branch}>
                    {branch}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Company</span>
              <Select name="company" defaultValue={searchParams.company ?? ""} className="w-48">
                <option value="">All companies</option>
                {report.filterOptions.companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </Select>
            </div>
            {driveId ? <input type="hidden" name="drive" value={driveId} /> : null}
            <Button type="submit">Apply</Button>
            <Button asChild variant="ghost">
              <Link href="/officer/reports">Clear</Link>
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Students in scope" value={report.totals.students} icon={Filter} />
        <StatCard
          title="Placed"
          value={report.totals.placed}
          icon={Download}
          hint={`${formatPercent(report.totals.placementRate)} placement rate`}
        />
        <StatCard
          title="Average package"
          value={formatPackage(report.totals.averagePackage)}
          icon={FileText}
          hint={`Median ${formatPackage(report.totals.medianPackage)}`}
        />
        <StatCard
          title="Highest package"
          value={formatPackage(report.totals.highestPackage)}
          icon={FileText}
          hint={`${report.totals.offers} accepted offers`}
        />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Drive placement funnel</CardTitle>
              <CardDescription>
                Applied → shortlisted → every interview round → offered, for each drive in scope.
              </CardDescription>
            </div>
            <form method="get" className="flex flex-wrap items-end gap-2">
              {filters.graduationYear ? <input type="hidden" name="year" value={filters.graduationYear} /> : null}
              {filters.branch ? <input type="hidden" name="branch" value={filters.branch} /> : null}
              {filters.companyId ? <input type="hidden" name="company" value={filters.companyId} /> : null}
              <Select name="drive" defaultValue={driveId ?? ""} className="w-64">
                <option value="">All drives</option>
                {report.filterOptions.drives.map((drive) => (
                  <option key={drive.id} value={drive.id}>
                    {drive.title} · {drive.company.name}
                  </option>
                ))}
              </Select>
              <Button type="submit" size="sm">
                View funnel
              </Button>
              {driveId ? (
                <Button asChild variant="ghost" size="sm">
                  <Link href={driveHref()}>All drives</Link>
                </Button>
              ) : null}
            </form>
          </div>
        </CardHeader>
        <CardContent>
          {selectedFunnel ? (
            <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
              <div>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <p className="font-medium">{selectedFunnel.title}</p>
                  <Badge variant="outline">{selectedFunnel.company}</Badge>
                  <Badge variant="secondary">{formatPackage(selectedFunnel.package)}</Badge>
                  <Badge variant="secondary">Tier {selectedFunnel.tier}</Badge>
                </div>
                <DriveFunnelChart
                  data={selectedFunnel.stages.map((stage) => ({ label: stage.label, count: stage.count }))}
                />
              </div>
              <div className="space-y-2 rounded-lg border p-3 text-sm">
                {selectedFunnel.stages.map((stage) => (
                  <div key={stage.key} className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">{stage.label}</span>
                    <span className="font-medium">
                      {stage.count}
                      <span className="ml-1 text-xs font-normal text-muted-foreground">
                        ({funnelConversion(stage.count, selectedFunnel.applied) ?? 0}%)
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : funnels.length === 0 ? (
            <EmptyState
              icon={Activity}
              title="No drive funnels in scope"
              description="No drives match the selected company, branch, or graduation year."
              actionHref="/officer/reports"
              actionLabel="Reset filters"
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-y bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5 font-medium">Drive</th>
                    <th className="px-3 py-2.5 font-medium">Applied</th>
                    <th className="px-3 py-2.5 font-medium">Shortlisted</th>
                    <th className="px-3 py-2.5 font-medium">Rounds</th>
                    <th className="px-3 py-2.5 font-medium">Offered</th>
                    <th className="px-3 py-2.5 font-medium">Offer conversion</th>
                    <th className="px-3 py-2.5 font-medium" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {funnels.map((funnel) => (
                    <tr key={funnel.driveId} className="hover:bg-muted/30">
                      <td className="px-3 py-2.5">
                        <p className="font-medium">{funnel.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {funnel.company} · {formatPackage(funnel.package)}
                        </p>
                      </td>
                      <td className="px-3 py-2.5">{funnel.applied}</td>
                      <td className="px-3 py-2.5">{funnel.shortlisted}</td>
                      <td className="px-3 py-2.5">{funnel.rounds.length}</td>
                      <td className="px-3 py-2.5">{funnel.offered}</td>
                      <td className="px-3 py-2.5">
                        {funnelConversion(funnel.offered, funnel.applied) ?? 0}%
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <Button asChild size="sm" variant="ghost">
                          <Link href={driveHref(funnel.driveId)}>View funnel</Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedFunnel ? (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Drive exports</CardTitle>
            <CardDescription>
              Eligible candidates use live eligibility and active overrides. Shortlists can be exported
              for the whole drive or a single round.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 md:grid-cols-2">
            <div className="space-y-3 rounded-lg border p-3">
              <p className="text-sm font-medium">Eligible list</p>
              <p className="text-xs text-muted-foreground">
                Officer-only CSV/PDF for candidates eligible for {selectedFunnel.title}.
              </p>
              <div className="flex flex-wrap gap-2">
                <ExportButton
                  url={`/api/exports/eligible?driveId=${selectedFunnel.driveId}&format=csv`}
                  label="Eligible CSV"
                  format="csv"
                />
                <ExportButton
                  url={`/api/exports/eligible?driveId=${selectedFunnel.driveId}&format=pdf`}
                  label="Eligible PDF"
                  format="pdf"
                />
              </div>
            </div>
            <div className="space-y-3 rounded-lg border p-3">
              <p className="text-sm font-medium">Shortlists</p>
              <p className="text-xs text-muted-foreground">
                Officer or owning-recruiter export, optionally scoped to one round.
              </p>
              <ShortlistExportControls driveId={selectedFunnel.driveId} rounds={selectedFunnel.rounds} />
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Skill supply vs demand</CardTitle>
            <CardDescription>
              Students holding each skill versus drive requirements in scope. Deeper cells indicate
              higher counts; coverage is students per requirement.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {skills.heatmap.length === 0 ? (
              <EmptyState
                icon={Layers}
                title="No skill data in scope"
                description="Adjust the year, branch, or company filter to see skill supply and demand."
              />
            ) : (
              <>
                <div className="mb-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline">{skills.supplyClaims} student skill claims</Badge>
                  <Badge variant="outline">{skills.demandRequirements} drive requirements</Badge>
                </div>
                <SkillDemandHeatmap
                  data={skills.heatmap}
                  maxSupply={skills.maxSupply}
                  maxDemand={skills.maxDemand}
                />
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Top in-demand skills</CardTitle>
            <CardDescription>Skills required by the most drives, with current student supply.</CardDescription>
          </CardHeader>
          <CardContent>
            {skills.topDemand.length === 0 ? (
              <EmptyState
                icon={TrendingUp}
                title="No drive skill demand"
                description="No drives with required skills match this scope."
              />
            ) : (
              <TopDemandSkills data={skills.topDemand} />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Branch placement</CardTitle>
            <CardDescription>Placed students versus eligible students in scope.</CardDescription>
          </CardHeader>
          <CardContent>
            {report.branchStats.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No branch data in scope.</p>
            ) : (
              <BranchPlacementChart data={report.branchStats} />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Top companies</CardTitle>
            <CardDescription>Offers and average package by company.</CardDescription>
          </CardHeader>
          <CardContent>
            {report.companyStats.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No company offers in scope.</p>
            ) : (
              <CompanyOffersChart data={report.companyStats.slice(0, 8)} />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Offer trend</CardTitle>
            <CardDescription>Accepted offers over the last six months.</CardDescription>
          </CardHeader>
          <CardContent>
            <MonthlyOffersChart data={report.monthlyTrend} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Company performance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {report.companyStats.length === 0 ? (
              <p className="text-sm text-muted-foreground">No offers in this scope.</p>
            ) : (
              report.companyStats.map((company) => (
                <div key={company.companyId} className="flex items-center justify-between gap-3 text-sm">
                  <span>{company.company}</span>
                  <span className="flex items-center gap-2">
                    <Badge variant="outline">{company.offers} offers</Badge>
                    <span>{formatPackage(company.averagePackage)}</span>
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Offer detail</CardTitle>
          <CardDescription>{report.rows.length} offer record(s) in this scope.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {report.rows.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              No offer records match the selected filters.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-y bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Student</th>
                    <th className="px-4 py-2.5 font-medium">Branch</th>
                    <th className="px-4 py-2.5 font-medium">Company / Role</th>
                    <th className="px-4 py-2.5 font-medium">Package</th>
                    <th className="px-4 py-2.5 font-medium">Tier</th>
                    <th className="px-4 py-2.5 font-medium">Offer date</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {report.rows.map((row, index) => (
                    <tr key={`${row.rollNumber}-${index}`}>
                      <td className="px-4 py-2.5">
                        <p className="font-medium">{row.studentName}</p>
                        <p className="text-xs text-muted-foreground">{row.rollNumber}</p>
                      </td>
                      <td className="px-4 py-2.5">
                        {row.branch} · {row.graduationYear}
                      </td>
                      <td className="px-4 py-2.5">
                        <p>{row.company}</p>
                        <p className="text-xs text-muted-foreground">{row.roleTitle}</p>
                      </td>
                      <td className="px-4 py-2.5">{formatPackage(row.package)}</td>
                      <td className="px-4 py-2.5">{row.tier}</td>
                      <td className="px-4 py-2.5">{formatDate(row.offerDate)}</td>
                      <td className="px-4 py-2.5">
                        <Badge variant={row.offerStatus === "ACCEPTED" ? "success" : "outline"}>
                          {row.offerStatus}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
