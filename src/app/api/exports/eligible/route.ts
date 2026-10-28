import { NextResponse } from "next/server";
import { apiErrorResponse, requireOfficerApi } from "@/server/auth/api";
import { audit } from "@/server/audit";
import { driveExportQuerySchema } from "@/lib/validation/analytics";
import { buildCsv } from "@/lib/reporting";
import { renderPdfReport } from "@/server/exports/pdf";
import { getEligibleList } from "@/server/services/analytics-exports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = [
  "rollNumber",
  "name",
  "email",
  "branch",
  "graduationYear",
  "cgpa",
  "backlogs",
  "matchScore",
  "applicationStatus",
  "overrideReason",
];

export async function GET(request: Request) {
  const guard = await requireOfficerApi();
  if (guard.response) return guard.response;
  const { searchParams } = new URL(request.url);
  const parsed = driveExportQuerySchema.safeParse({
    driveId: searchParams.get("driveId") ?? undefined,
    format: searchParams.get("format") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "A drive and valid export format are required." } },
      { status: 400 },
    );
  }

  try {
    const { drive, rows } = await getEligibleList(parsed.data.driveId);
    const date = new Date().toISOString().slice(0, 10);
    const filename = `eligible-${drive.id}-${date}.${parsed.data.format}`;
    await audit({
      actorId: guard.officer.id,
      action: "ELIGIBLE_LIST_EXPORTED",
      entityType: "Drive",
      entityId: drive.id,
      metadata: { format: parsed.data.format, rows: rows.length },
    });

    if (parsed.data.format === "pdf") {
      const pdf = await renderPdfReport({
        title: "Eligible candidates",
        subtitle: [
          `${drive.title} · ${drive.roleTitle}`,
          `${drive.company} · ${drive.package.toFixed(1)} LPA · Tier ${drive.tier} · ${drive.status}`,
        ],
        summary: [`Eligible candidates: ${rows.length}`],
        headers: ["Roll", "Name", "Email", "Branch/Yr", "CGPA", "Backlogs", "Match", "Status"],
        widths: [55, 100, 125, 50, 45, 55, 42, 43],
        rows: rows.map((row) => [
          row.rollNumber,
          row.name,
          row.email,
          `${row.branch}/${row.graduationYear}`,
          row.cgpa?.toFixed(2) ?? "—",
          String(row.backlogs),
          `${row.matchScore}%`,
          row.overrideReason ? "OVERRIDDEN" : (row.applicationStatus ?? "NOT APPLIED"),
        ]),
      });
      return new NextResponse(new Uint8Array(pdf), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": "no-store",
        },
      });
    }

    const csv = buildCsv(
      headers,
      rows.map((row) => [
        row.rollNumber,
        row.name,
        row.email,
        row.branch,
        row.graduationYear,
        row.cgpa?.toFixed(2) ?? "",
        row.backlogs,
        row.matchScore,
        row.applicationStatus ?? "NOT_APPLIED",
        row.overrideReason,
      ]),
    );
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
