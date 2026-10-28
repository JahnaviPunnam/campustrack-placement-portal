import PDFDocument from "pdfkit";
import { NextResponse } from "next/server";
import { requireOfficerApi } from "@/server/auth/api";
import { audit } from "@/server/audit";
import { escapeSpreadsheetCell } from "@/lib/csv";
import { getPlacementReport, type ReportFilters } from "@/server/services/analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function reportFilters(searchParams: URLSearchParams): ReportFilters {
  const year = Number(searchParams.get("year"));
  return {
    graduationYear: Number.isInteger(year) && year > 2000 ? year : undefined,
    branch: searchParams.get("branch") || undefined,
    companyId: searchParams.get("company") || undefined,
  };
}

function csvForReport(report: Awaited<ReturnType<typeof getPlacementReport>>) {
  const header = [
    "rollNumber",
    "studentName",
    "branch",
    "graduationYear",
    "company",
    "roleTitle",
    "package",
    "tier",
    "offerDate",
    "offerStatus",
  ];
  const lines = [header.join(",")];
  for (const row of report.rows) {
    const values = [
      row.rollNumber,
      row.studentName,
      row.branch,
      String(row.graduationYear),
      row.company,
      row.roleTitle,
      row.package.toFixed(2),
      String(row.tier),
      row.offerDate.toISOString().slice(0, 10),
      row.offerStatus,
    ];
    lines.push(
      values
        .map((value) => escapeSpreadsheetCell(value))
        .map((value) => `"${String(value).replaceAll('"', '""')}"`)
        .join(","),
    );
  }
  return lines.join("\n");
}

function pdfForReport(report: Awaited<ReturnType<typeof getPlacementReport>>): Promise<Buffer> {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    doc.font("Helvetica-Bold").fontSize(18).fillColor("#111111").text("Placement Report");
    doc.font("Helvetica").fontSize(9).fillColor("#555555");
    doc.text(`Generated ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC`);
    doc.text(
      `Filters: year=${report.filters.graduationYear ?? "all"}, branch=${report.filters.branch ?? "all"}, company=${report.filters.companyId ?? "all"}`,
    );
    doc.moveDown();

    doc.font("Helvetica-Bold").fontSize(11).fillColor("#111111").text("Summary");
    doc.font("Helvetica").fontSize(9).fillColor("#333333");
    doc.text(`Students in scope: ${report.totals.students}`);
    doc.text(`Placed students: ${report.totals.placed} (${report.totals.placementRate}%)`);
    doc.text(`Accepted offers: ${report.totals.offers}`);
    doc.text(
      `Average / median / highest package: ${report.totals.averagePackage.toFixed(1)} / ${report.totals.medianPackage.toFixed(1)} / ${report.totals.highestPackage.toFixed(1)} LPA`,
    );
    doc.moveDown();

    doc.font("Helvetica-Bold").fontSize(11).fillColor("#111111").text("Branch placement");
    doc.font("Helvetica").fontSize(9).fillColor("#333333");
    for (const branch of report.branchStats) {
      doc.text(`${branch.branch}: ${branch.placed}/${branch.total} placed (${branch.rate}%)`);
    }
    doc.moveDown();

    doc.font("Helvetica-Bold").fontSize(11).fillColor("#111111").text("Company offers");
    doc.font("Helvetica").fontSize(9).fillColor("#333333");
    for (const company of report.companyStats.slice(0, 15)) {
      doc.text(`${company.company}: ${company.offers} offer(s), avg ${company.averagePackage.toFixed(1)} LPA`);
    }
    doc.moveDown();

    doc.font("Helvetica-Bold").fontSize(11).fillColor("#111111").text("Offer records");
    doc.font("Helvetica").fontSize(8).fillColor("#333333");
    const columns = [40, 170, 250, 340, 400, 455, 520];
    const headerY = doc.y + 4;
    doc.font("Helvetica-Bold");
    doc.text("Student", columns[0], headerY, { width: 125 });
    doc.text("Roll", columns[1], headerY, { width: 75 });
    doc.text("Branch", columns[2], headerY, { width: 85 });
    doc.text("Company", columns[3], headerY, { width: 55 });
    doc.text("Package", columns[4], headerY, { width: 50 });
    doc.text("Tier", columns[5], headerY, { width: 60 });
    doc.text("Status", columns[6], headerY, { width: 50 });
    doc.font("Helvetica");
    doc.moveDown(0.8);

    for (const row of report.rows) {
      if (doc.y > 780) {
        doc.addPage();
      }
      const y = doc.y;
      doc.text(row.studentName.slice(0, 40), columns[0], y, { width: 125, lineBreak: false });
      doc.text(row.rollNumber, columns[1], y, { width: 75, lineBreak: false });
      doc.text(`${row.branch}/${row.graduationYear}`, columns[2], y, { width: 85, lineBreak: false });
      doc.text(row.company.slice(0, 26), columns[3], y, { width: 55, lineBreak: false });
      doc.text(row.package.toFixed(1), columns[4], y, { width: 50, lineBreak: false });
      doc.text(String(row.tier), columns[5], y, { width: 60, lineBreak: false });
      doc.text(row.offerStatus, columns[6], y, { width: 50, lineBreak: false });
      doc.y = y + 14;
    }

    doc.end();
  });
}

export async function GET(request: Request) {
  const guard = await requireOfficerApi();
  if (guard.response) return guard.response;
  const officer = guard.officer;
  const { searchParams } = new URL(request.url);
  const filters = reportFilters(searchParams);
  const format = searchParams.get("format") === "pdf" ? "pdf" : "csv";
  const report = await getPlacementReport(filters);
  const filename = `placement-report-${new Date().toISOString().slice(0, 10)}.${format}`;
  await audit({
    actorId: officer.id,
    action: "REPORT_EXPORTED",
    entityType: "PlacementReport",
    entityId: null,
    metadata: { format, filters, rows: report.rows.length },
  });

  if (format === "pdf") {
    const pdf = await pdfForReport(report);
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  }

  return new NextResponse(csvForReport(report), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
