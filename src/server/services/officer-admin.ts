import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { escapeSpreadsheetCell } from "@/lib/csv";

export type AuditFilters = {
  q?: string;
  action?: string;
  entityType?: string;
  from?: string;
  to?: string;
  page?: number;
};

function auditWhere(filters: AuditFilters): Prisma.AuditLogWhereInput {
  const from = filters.from ? new Date(`${filters.from}T00:00:00.000Z`) : null;
  const to = filters.to ? new Date(`${filters.to}T23:59:59.999Z`) : null;
  return {
    ...(filters.q
      ? {
          OR: [
            { action: { contains: filters.q } },
            { entityType: { contains: filters.q } },
            { entityId: { contains: filters.q } },
            { actor: { name: { contains: filters.q } } },
            { actor: { email: { contains: filters.q } } },
          ],
        }
      : {}),
    ...(filters.action ? { action: filters.action } : {}),
    ...(filters.entityType ? { entityType: filters.entityType } : {}),
    ...(from || to
      ? {
          createdAt: {
            ...(from && !Number.isNaN(from.getTime()) ? { gte: from } : {}),
            ...(to && !Number.isNaN(to.getTime()) ? { lte: to } : {}),
          },
        }
      : {}),
  };
}

export async function listAuditLogs(filters: AuditFilters = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = 50;
  const where = auditWhere(filters);
  const [logs, total, actions, entityTypes] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { actor: { select: { name: true, email: true, role: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({ distinct: ["action"], select: { action: true }, orderBy: { action: "asc" } }),
    prisma.auditLog.findMany({
      distinct: ["entityType"],
      select: { entityType: true },
      orderBy: { entityType: "asc" },
    }),
  ]);
  return {
    logs,
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    actions: actions.map((entry) => entry.action),
    entityTypes: entityTypes.map((entry) => entry.entityType),
  };
}

export async function getAuditExportRows(filters: AuditFilters) {
  return prisma.auditLog.findMany({
    where: auditWhere(filters),
    include: { actor: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take: 20_000,
  });
}

export function auditExportCsv(rows: Awaited<ReturnType<typeof getAuditExportRows>>): string {
  const header = [
    "createdAt",
    "actor",
    "actorEmail",
    "action",
    "entityType",
    "entityId",
    "ipAddress",
    "metadata",
  ];
  const lines = [header.join(",")];
  for (const row of rows) {
    const values = [
      row.createdAt.toISOString(),
      row.actor?.name ?? "System",
      row.actor?.email ?? "",
      row.action,
      row.entityType,
      row.entityId ?? "",
      row.ipAddress ?? "",
      row.metadataJson ?? "",
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
