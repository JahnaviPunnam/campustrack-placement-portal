import Link from "next/link";
import { redirect } from "next/navigation";
import { BadgeCheck, Download, Search, Upload, Users } from "lucide-react";
import { getCurrentUser } from "@/server/auth/guards";
import { listStudents } from "@/server/services/officer-students";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { BRANCHES } from "@/lib/constants";
import { formatCgpa } from "@/lib/formatting";
import { prisma } from "@/server/db";

export const metadata = { title: "Students" };
export const dynamic = "force-dynamic";

type SearchParams = {
  q?: string;
  branch?: string;
  year?: string;
  verified?: string;
  page?: string;
};

function buildQuery(params: SearchParams, overrides: Partial<SearchParams> = {}) {
  const next = new URLSearchParams();
  const merged = { ...params, ...overrides };
  for (const [key, value] of Object.entries(merged)) {
    if (value) next.set(key, value);
  }
  const query = next.toString();
  return query ? `?${query}` : "";
}

export default async function OfficerStudentsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const requestedYear = Number(searchParams.year);
  const filters = {
    q: searchParams.q?.trim() || undefined,
    branch: BRANCHES.includes(searchParams.branch as (typeof BRANCHES)[number])
      ? searchParams.branch
      : undefined,
    graduationYear:
      Number.isInteger(requestedYear) && requestedYear > 2000 ? requestedYear : undefined,
    verified:
      searchParams.verified === "1" ? true : searchParams.verified === "0" ? false : undefined,
    page: Number.isInteger(Number(searchParams.page)) ? Number(searchParams.page) : 1,
  };
  const data = await listStudents(filters);
  const years = await prisma.studentProfile.findMany({
    distinct: ["graduationYear"],
    select: { graduationYear: true },
    orderBy: { graduationYear: "desc" },
  });
  const exportQuery = buildQuery({ ...searchParams, page: undefined });

  return (
    <div>
      <PageHeader
        title="Students"
        description={`${data.total} student${data.total === 1 ? "" : "s"} matching the current filters.`}
        actions={
          <>
            <Button asChild variant="outline">
              <a href={`/api/officer/students/export${exportQuery}`}>
                <Download className="h-4 w-4" /> Export CSV
              </a>
            </Button>
            <Button asChild>
              <Link href="/officer/students/import">
                <Upload className="h-4 w-4" /> Import CSV
              </Link>
            </Button>
          </>
        }
      />

      <Card className="mb-5">
        <CardContent className="pt-6">
          <form method="get" className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.5fr_0.7fr_0.7fr_0.7fr_auto_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input name="q" defaultValue={searchParams.q ?? ""} placeholder="Name, email, roll number, phone" className="pl-9" />
            </div>
            <Select name="branch" defaultValue={searchParams.branch ?? ""}>
              <option value="">All branches</option>
              {BRANCHES.map((branch) => (
                <option key={branch} value={branch}>
                  {branch}
                </option>
              ))}
            </Select>
            <Select name="year" defaultValue={searchParams.year ?? ""}>
              <option value="">All years</option>
              {years.map((entry) => (
                <option key={entry.graduationYear} value={entry.graduationYear}>
                  {entry.graduationYear}
                </option>
              ))}
            </Select>
            <Select name="verified" defaultValue={searchParams.verified ?? ""}>
              <option value="">Any status</option>
              <option value="1">Verified</option>
              <option value="0">Pending</option>
            </Select>
            <Button type="submit">Filter</Button>
            <Button asChild variant="ghost">
              <Link href="/officer/students">Clear</Link>
            </Button>
          </form>
        </CardContent>
      </Card>

      {data.students.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No students found"
          description="Adjust the filters or import students from a CSV file."
          actionHref="/officer/students/import"
          actionLabel="Import students"
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Student</th>
                    <th className="px-4 py-3 font-medium">Branch / Year</th>
                    <th className="px-4 py-3 font-medium">CGPA / Backlogs</th>
                    <th className="px-4 py-3 font-medium">Skills</th>
                    <th className="px-4 py-3 font-medium">Applications</th>
                    <th className="px-4 py-3 font-medium">Verification</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.students.map((student) => (
                    <tr key={student.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <Link href={`/officer/students/${student.id}`} className="font-medium hover:underline">
                          {student.user.name}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {student.rollNumber} · {student.user.email}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p>{student.branch}</p>
                        <p className="text-xs text-muted-foreground">{student.graduationYear}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p>{formatCgpa(student.cgpa)}</p>
                        <p className="text-xs text-muted-foreground">{student.backlogs} backlogs</p>
                      </td>
                      <td className="px-4 py-3">{student._count.skills}</td>
                      <td className="px-4 py-3">{student._count.applications}</td>
                      <td className="px-4 py-3">
                        {student.isVerified ? (
                          <Badge variant="success" className="gap-1">
                            <BadgeCheck className="h-3 w-3" /> Verified
                          </Badge>
                        ) : (
                          <Badge variant="warning">Pending</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {data.pageCount > 1 ? (
        <div className="mt-5 flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Page {data.page} of {data.pageCount}
          </p>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm" aria-disabled={data.page <= 1}>
              <Link
                href={`/officer/students${buildQuery(searchParams, { page: String(Math.max(1, data.page - 1)) })}`}
              >
                Previous
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" aria-disabled={data.page >= data.pageCount}>
              <Link
                href={`/officer/students${buildQuery(searchParams, { page: String(Math.min(data.pageCount, data.page + 1)) })}`}
              >
                Next
              </Link>
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
