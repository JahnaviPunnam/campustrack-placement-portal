import { prisma } from "@/server/db";

const SECRET_KEYS = new Set([
  "password",
  "passwordHash",
  "currentPassword",
  "newPassword",
  "confirmPassword",
  "token",
  "secret",
]);

export function sanitizeSnapshot(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(sanitizeSnapshot);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SECRET_KEYS.has(key) ? "[REDACTED]" : sanitizeSnapshot(entry);
    }
    return out;
  }
  return value;
}

type AuditInput = {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export async function audit(input: AuditInput): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actorId: input.actorId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      beforeJson: input.before === undefined ? null : JSON.stringify(sanitizeSnapshot(input.before)),
      afterJson: input.after === undefined ? null : JSON.stringify(sanitizeSnapshot(input.after)),
      metadataJson: input.metadata ? JSON.stringify(sanitizeSnapshot(input.metadata)) : null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    },
  });
}
