import Link from "next/link";
import { Search, SlidersHorizontal, Users } from "lucide-react";
import { requireRecruiter } from "@/server/auth/guards";
import { searchCandidates } from "@/server/services/recruiter";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { CandidateCard } from "@/components/recruiter/candidate-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  BRANCHES,
  GRADUATION_YEARS,
  SKILL_CATEGORIES,
  SKILL_CATEGORY_LABELS,
  type Branch,
  type SkillCategory,
} from "@/lib/constants";

export const metadata = { title: "Candidate search" };
export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function CandidateSearchPage({ searchParams }: { searchParams: SearchParams }) {
  const { user, company, recruiter } = await requireRecruiter();
  const q = first(searchParams.q)?.trim() || undefined;
  const branchValue = first(searchParams.branch);
  const branch = BRANCHES.includes(branchValue as Branch) ? branchValue : undefined;
  const year = Number(first(searchParams.year));
  const graduationYear = Number.isInteger(year) && year > 2000 ? year : undefined;
  const cgpa = Number(first(searchParams.minCgpa));
  const minCgpa = Number.isFinite(cgpa) && cgpa > 0 ? cgpa : undefined;
  const rawSkills = searchParams.skills;
  const skillIds = (Array.isArray(rawSkills) ? rawSkills : rawSkills ? [rawSkills] : []).filter(Boolean);
  const matchMode = first(searchParams.matchMode) === "OR" ? "OR" : "AND";
  const driveId = first(searchParams.driveId) || undefined;
  const savedOnly = first(searchParams.savedOnly) === "1";

  const data = await searchCandidates(
    {
      userId: user.id,
      recruiterProfileId: recruiter.id,
      companyId: company.id,
      companyName: company.name,
    },
    { q, branch, graduationYear, minCgpa, skillIds, matchMode, driveId, savedOnly },
  );
  const selected = new Set(skillIds);
  const skillsByCategory = SKILL_CATEGORIES.map((category) => ({
    category,
    skills: data.skills.filter((skill) => skill.category === category),
  })).filter((group) => group.skills.length > 0);

  return (
    <div>
      <PageHeader
        title="Candidate search"
        description="Verified students across the campus. Rank by drive fit or skill coverage, then save or shortlist."
        actions={
          <Button asChild variant="outline">
            <Link href="/recruiter/saved">
              <Users className="h-4 w-4" /> Saved candidates
            </Link>
          </Button>
        }
      />

      <Card className="mb-5">
        <CardContent className="space-y-4 pt-6">
          <form method="get" className="space-y-4">
            <div className="grid gap-3 lg:grid-cols-3">
              <div className="relative lg:col-span-2">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  name="q"
                  defaultValue={q ?? ""}
                  placeholder="Name, roll number, headline, location"
                  className="pl-9"
                />
              </div>
              <Select name="driveId" defaultValue={driveId ?? ""}>
                <option value="">Rank by selected skills</option>
                {data.drives.map((drive) => (
                  <option key={drive.id} value={drive.id}>
                    Rank for: {drive.title}
                  </option>
                ))}
              </Select>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Select name="branch" defaultValue={branch ?? ""}>
                <option value="">All branches</option>
                {BRANCHES.map((entry) => (
                  <option key={entry} value={entry}>
                    {entry}
                  </option>
                ))}
              </Select>
              <Select name="year" defaultValue={graduationYear?.toString() ?? ""}>
                <option value="">All graduation years</option>
                {GRADUATION_YEARS.map((entry) => (
                  <option key={entry} value={entry}>
                    {entry}
                  </option>
                ))}
              </Select>
              <Input
                name="minCgpa"
                type="number"
                min="0"
                max="10"
                step="0.1"
                defaultValue={minCgpa?.toString() ?? ""}
                placeholder="Minimum CGPA"
              />
              <Select name="matchMode" defaultValue={matchMode}>
                <option value="AND">Match all selected skills</option>
                <option value="OR">Match any selected skill</option>
              </Select>
            </div>

            <details className="rounded-lg border p-3" open={selected.size > 0}>
              <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                <SlidersHorizontal className="h-4 w-4" />
                Skills filter
                <Badge variant="outline">{selected.size} selected</Badge>
              </summary>
              <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {skillsByCategory.map((group) => (
                  <div key={group.category}>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {SKILL_CATEGORY_LABELS[group.category as SkillCategory]}
                    </p>
                    <div className="max-h-44 space-y-1 overflow-y-auto pr-1">
                      {group.skills.map((skill) => (
                        <label key={skill.id} className="flex cursor-pointer items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            name="skills"
                            value={skill.id}
                            defaultChecked={selected.has(skill.id)}
                            className="h-4 w-4 accent-primary"
                          />
                          {skill.name}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </details>

            <div className="flex flex-wrap items-center gap-4">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="savedOnly"
                  value="1"
                  defaultChecked={savedOnly}
                  className="h-4 w-4 accent-primary"
                />
                Saved candidates only
              </label>
              <Button type="submit">Apply filters</Button>
              <Button asChild variant="ghost">
                <Link href="/recruiter/candidates">Clear</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {data.total} verified candidate{data.total === 1 ? "" : "s"} found.
        </p>
        {data.drive ? (
          <p className="text-sm">
            Ranked for <span className="font-medium">{data.drive.title}</span>
          </p>
        ) : skillIds.length > 0 ? (
          <p className="text-sm">
            Ranked by skill coverage ({matchMode === "AND" ? "all" : "any"} selected skills)
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">Select a drive or skills to rank candidates.</p>
        )}
      </div>

      {data.candidates.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No candidates found"
          description="Adjust the skills, branch, year, or search text."
          actionHref="/recruiter/candidates"
          actionLabel="Reset filters"
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {data.candidates.map((candidate) => (
            <CandidateCard
              key={candidate.id}
              candidate={candidate}
              drives={data.drives}
              rankedForDrive={Boolean(data.drive)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
