import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { CompanyForm } from "@/components/officer/company-form";
import { CompanyStatusControl } from "@/components/officer/company-status-control";
import { RecruiterManager } from "@/components/officer/recruiter-manager";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DRIVE_STATUS_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/formatting";
import { getCompanyDetail } from "@/server/services/officer-companies";
import { AppError } from "@/server/errors";

export const dynamic = "force-dynamic";

export default async function CompanyDetailPage({ params }: { params: { id: string } }) {
  let company: Awaited<ReturnType<typeof getCompanyDetail>>;
  try {
    company = await getCompanyDetail(params.id);
  } catch (error) {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  }

  return (
    <div>
      <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2">
        <Link href="/officer/companies">
          <ArrowLeft className="h-4 w-4" /> Companies
        </Link>
      </Button>
      <PageHeader
        title={company.name}
        description={`${company.industry}${company.location ? ` · ${company.location}` : ""} · Created by ${company.createdBy.name}`}
        actions={
          <>
            {company.website ? (
              <Button asChild variant="outline">
                <a href={company.website} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" /> Website
                </a>
              </Button>
            ) : null}
            <Badge variant={company.isActive ? "success" : "outline"} className="px-3 py-1.5">
              {company.isActive ? "Active" : "Inactive"}
            </Badge>
            <CompanyStatusControl companyId={company.id} isActive={company.isActive} />
          </>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Company details</CardTitle>
            </CardHeader>
            <CardContent>
              <CompanyForm
                company={{
                  id: company.id,
                  name: company.name,
                  industry: company.industry,
                  location: company.location,
                  website: company.website,
                  tier: company.tier,
                  description: company.description,
                }}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recruiter accounts</CardTitle>
              <CardDescription>
                Recruiters can create and manage drives for this company only.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RecruiterManager
                companyId={company.id}
                recruiters={company.recruiters.map((recruiter) => ({
                  id: recruiter.id,
                  name: recruiter.user.name,
                  email: recruiter.user.email,
                  designation: recruiter.designation,
                  isActive: recruiter.user.isActive,
                  mustChangePassword: recruiter.user.mustChangePassword,
                  lastLoginAt: recruiter.user.lastLoginAt,
                }))}
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Recent drives</CardTitle>
            </CardHeader>
            <CardContent>
              {company.drives.length === 0 ? (
                <p className="text-sm text-muted-foreground">No drives yet.</p>
              ) : (
                <div className="space-y-3">
                  {company.drives.map((drive) => (
                    <div key={drive.id} className="rounded-lg border p-3">
                      <p className="font-medium">{drive.title}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
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
                        <span>Tier {drive.tier}</span>
                        <span>Deadline {formatDate(drive.deadline)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>At a glance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Tier" value={`Tier ${company.tier}`} />
              <Row label="Recruiters" value={String(company._count.recruiters)} />
              <Row label="Drives" value={String(company._count.drives)} />
              <Row label="Created" value={formatDate(company.createdAt)} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
