import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StudentImportForm } from "@/components/officer/student-import-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Import students" };

export default function StudentImportPage() {
  return (
    <div>
      <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2">
        <Link href="/officer/students">
          <ArrowLeft className="h-4 w-4" /> Students
        </Link>
      </Button>
      <PageHeader
        title="Import students"
        description="Bulk-create or update student profiles with a validated CSV."
      />
      <Card>
        <CardHeader>
          <CardTitle>CSV import</CardTitle>
          <CardDescription>
            Required columns: name, email, rollNumber, branch, graduationYear. Optional: cgpa,
            backlogs, phone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <StudentImportForm />
        </CardContent>
      </Card>
    </div>
  );
}
