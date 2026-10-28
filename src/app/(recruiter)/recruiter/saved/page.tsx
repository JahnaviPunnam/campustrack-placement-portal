import Link from "next/link";
import { Bookmark, FileText, Search } from "lucide-react";
import { requireRecruiter } from "@/server/auth/guards";
import { listSavedCandidates } from "@/server/services/recruiter";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { SavedCandidateActions } from "@/components/recruiter/saved-candidate-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatCgpa, relativeTime } from "@/lib/formatting";

export const metadata = { title: "Saved candidates" };
export const dynamic = "force-dynamic";

export default async function SavedCandidatesPage() {
  const { user, company, recruiter } = await requireRecruiter();
  const saved = await listSavedCandidates({
    userId: user.id,
    recruiterProfileId: recruiter.id,
    companyId: company.id,
    companyName: company.name,
  });

  return (
    <div>
      <PageHeader
        title="Saved candidates"
        description="Your private talent pool. Notes are visible only to you."
        actions={
          <Button asChild variant="outline">
            <Link href="/recruiter/candidates">
              <Search className="h-4 w-4" /> Candidate search
            </Link>
          </Button>
        }
      />

      {saved.length === 0 ? (
        <EmptyState
          icon={Bookmark}
          title="No saved candidates"
          description="Save verified students from candidate search to revisit them later."
          actionHref="/recruiter/candidates"
          actionLabel="Search candidates"
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {saved.map((entry) => {
            const student = entry.studentProfile;
            return (
              <Card key={entry.id}>
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{student.user.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {student.rollNumber} · {student.branch} · {student.graduationYear} · CGPA{" "}
                        {formatCgpa(student.cgpa)}
                      </p>
                      {student.targetRoleProfile ? (
                        <p className="text-xs text-muted-foreground">
                          Target role: {student.targetRoleProfile.name}
                        </p>
                      ) : null}
                    </div>
                    <span className="text-xs text-muted-foreground">{relativeTime(entry.createdAt)}</span>
                  </div>

                  {entry.note ? (
                    <p className="mt-3 whitespace-pre-line rounded-md bg-muted p-2 text-sm">{entry.note}</p>
                  ) : null}

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {student.skills.slice(0, 8).map((skill) => (
                      <Badge key={skill.id} variant={skill.isVerified ? "success" : "outline"}>
                        {skill.skill.name} · {skill.proficiency}
                      </Badge>
                    ))}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {student.resumePath ? (
                      <Button asChild size="sm" variant="outline">
                        <a href={`/api/resumes/${student.id}`} target="_blank" rel="noreferrer">
                          <FileText className="h-3.5 w-3.5" /> Resume
                        </a>
                      </Button>
                    ) : (
                      <span className="self-center text-xs text-muted-foreground">No resume</span>
                    )}
                    <SavedCandidateActions studentProfileId={student.id} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
