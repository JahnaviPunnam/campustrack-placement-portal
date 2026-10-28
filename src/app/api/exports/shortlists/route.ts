import { NextResponse } from "next/server";
import { apiErrorResponse, requireShortlistExportApi } from "@/server/auth/api";
import { audit } from "@/server/audit";
import { shortlistExportQuerySchema } from "@/lib/validation/analytics";
import { buildCsv } from "@/lib/reporting";
import { renderPdfReport } from "@/server/exports/pdf";
import { getShortlistList } from "@/server/services/analytics-exports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = [
  "rollNumber",
  "name",
  "email",
  "branch",
  "graduationYear",
  "cgpa",
  "applicationStatus",
  "stage",
  "roundStatus",
  "roundScore",
  "offerPackage",
  "offerStatus",
  "appliedAt",
];

export async function GET(request: Request) {
  const guard = await requireShortlistExportApi();
  if (guard.response) return guard.response;
  const { searchParams } = new URL(request.url);
  const parsed = shortlistExportQuerySchema.safeParse({
    driveId: searchParams.get("driveId") ?? undefined,
    roundId: searchParams.get("roundId") ?? undefined,
    format: searchParams.get("format") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "A drive and valid export format are required." } },
      { status: 400 },
    );
  }

  try {
    const { drive, round, rows } = await getShortlistList({
      driveId: parsed.data.driveId,
      roundId: parsed.data.roundId,
      companyId: guard.companyId,
    });
    const date = new Date().toISOString().slice(0, 10);
    const filename = `shortlists-${drive.id}-${round?.id ?? "all"}-${date}.${parsed.data.format}`;
    await audit({
      actorId: guard.user.id,
      action: "SHORTLIST_EXPORTED",
      entityType: "Drive",
      entityId: drive.id,
      metadata: {
        format: parsed.data.format,
        roundId: round?.id ?? null,
        rows: rows.length,
        actorRole: guard.user.role,
        companyId: guard.companyId,
      },
    });

    if (parsed.data.format === "pdf") {
      const pdf = await renderPdfReport({
        title: "Shortlist",
        subtitle: [
          `${drive.title} · ${drive.roleTitle}`,
          `${drive.company} · ${drive.package.toFixed(1)} LPA · Tier ${drive.tier} · ${drive.status}`,
          round ? `Round: ${round.order}. ${round.name}` : "All shortlisted candidates",
        ],
        summary: [`Candidates: ${rows.length}`],
        headers: ["Roll", "Name", "Email", "Branch/Yr", "Status", "Stage", "Round", "Offer"],
        widths: [52, 95, 115, 45, 55, 50, 48, 55],
        rows: rows.map((row) => [
          row.rollNumber,
          row.name,
          row.email,
          `${row.branch}/${row.graduationYear}`,
          row.status,
          row.stage,
          row.roundStatus
            ? `${row.roundStatus}${row.roundScore !== null ? ` (${row.roundScore})` : ""}`
            : "—",
          row.offerPackage !== null ? `${row.offerPackage.toFixed(1)} LPA` : "—",
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
        row.status,
        row.stage,
        row.roundStatus,
        row.roundScore,
        row.offerPackage?.toFixed(2) ?? "",
        row.offerStatus,
        row.appliedAt.toISOString(),
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
