import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { CompanyForm } from "@/components/officer/company-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "New company" };

export default function NewCompanyPage() {
  return (
    <div>
      <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2">
        <Link href="/officer/companies">
          <ArrowLeft className="h-4 w-4" /> Companies
        </Link>
      </Button>
      <PageHeader
        title="New company"
        description="Add a recruiting organization and its placement tier."
      />
      <Card>
        <CardContent className="pt-6">
          <CompanyForm />
        </CardContent>
      </Card>
    </div>
  );
}
