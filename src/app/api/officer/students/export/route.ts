import { NextResponse } from "next/server";
import { BRANCHES } from "@/lib/constants";
import { requireOfficerApi } from "@/server/auth/api";
import { audit } from "@/server/audit";
import { getStudentsForExport, studentExportCsv } from "@/server/services/officer-students";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const guard = await requireOfficerApi();
  if (guard.response) return guard.response;
  const officer = guard.officer;
  const { searchParams } = new URL(request.url);
  const branch = searchParams.get("branch");
  const verified = searchParams.get("verified");
  const year = Number(searchParams.get("year"));
  const rows = await getStudentsForExport({
    q: searchParams.get("q")?.trim() || undefined,
    branch: BRANCHES.includes(branch as (typeof BRANCHES)[number]) ? (branch ?? undefined) : undefined,
    graduationYear: Number.isFinite(year) && year > 2000 ? year : undefined,
    verified: verified === "1" ? true : verified === "0" ? false : undefined,
  });
  const csv = studentExportCsv(rows);
  await audit({
    actorId: officer.id,
    action: "STUDENTS_EXPORTED",
    entityType: "StudentProfile",
    entityId: null,
    metadata: { count: rows.length },
  });
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="students-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
