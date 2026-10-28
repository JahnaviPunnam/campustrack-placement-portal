import { NextResponse } from "next/server";
import { requireOfficerApi } from "@/server/auth/api";
import { audit } from "@/server/audit";
import { auditExportCsv, getAuditExportRows } from "@/server/services/officer-admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const guard = await requireOfficerApi();
  if (guard.response) return guard.response;
  const officer = guard.officer;
  const { searchParams } = new URL(request.url);
  const rows = await getAuditExportRows({
    q: searchParams.get("q")?.trim() || undefined,
    action: searchParams.get("action") || undefined,
    entityType: searchParams.get("entityType") || undefined,
    from: searchParams.get("from") || undefined,
    to: searchParams.get("to") || undefined,
  });
  await audit({
    actorId: officer.id,
    action: "AUDIT_EXPORTED",
    entityType: "AuditLog",
    entityId: null,
    metadata: { count: rows.length },
  });
  return new NextResponse(auditExportCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="audit-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
