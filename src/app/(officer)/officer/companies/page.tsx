import Link from "next/link";
import { Building2, Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { listCompanies } from "@/server/services/officer-companies";

export const metadata = { title: "Companies" };
export const dynamic = "force-dynamic";

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string };
}) {
  const status = searchParams.status === "active" ? true : searchParams.status === "inactive" ? false : undefined;
  const companies = await listCompanies({ q: searchParams.q?.trim() || undefined, active: status });

  return (
    <div>
      <PageHeader
        title="Companies"
        description="Manage recruiting organizations, tier policy, and recruiter access."
        actions={
          <Button asChild>
            <Link href="/officer/companies/new">
              <Plus className="h-4 w-4" /> New company
            </Link>
          </Button>
        }
      />

      <Card className="mb-5">
        <CardContent className="pt-6">
          <form method="get" className="flex flex-wrap gap-3">
            <div className="relative min-w-56 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                name="q"
                defaultValue={searchParams.q ?? ""}
                placeholder="Company, industry or location"
                className="pl-9"
              />
            </div>
            <Select name="status" defaultValue={searchParams.status ?? ""} className="w-40">
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
            <Button type="submit">Filter</Button>
            <Button asChild variant="ghost">
              <Link href="/officer/companies">Clear</Link>
            </Button>
          </form>
        </CardContent>
      </Card>

      {companies.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No companies found"
          description="Add a company to begin creating recruitment drives."
          actionHref="/officer/companies/new"
          actionLabel="New company"
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Company</th>
                    <th className="px-4 py-3 font-medium">Industry</th>
                    <th className="px-4 py-3 font-medium">Tier</th>
                    <th className="px-4 py-3 font-medium">Recruiters</th>
                    <th className="px-4 py-3 font-medium">Drives</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {companies.map((company) => (
                    <tr key={company.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <Link href={`/officer/companies/${company.id}`} className="font-medium hover:underline">
                          {company.name}
                        </Link>
                        <p className="text-xs text-muted-foreground">{company.location ?? "Location not set"}</p>
                      </td>
                      <td className="px-4 py-3">{company.industry}</td>
                      <td className="px-4 py-3">
                        <Badge variant={company.tier === 3 ? "info" : company.tier === 1 ? "outline" : "secondary"}>
                          Tier {company.tier}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">{company._count.recruiters}</td>
                      <td className="px-4 py-3">{company._count.drives}</td>
                      <td className="px-4 py-3">
                        <Badge variant={company.isActive ? "success" : "outline"}>
                          {company.isActive ? "Active" : "Inactive"}
                        </Badge>
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
