import { z } from "zod";

export const exportFormatSchema = z.enum(["csv", "pdf"]).default("csv");
export const exportIdentifierSchema = z.string().trim().min(1).max(100);

export const driveExportQuerySchema = z.object({
  driveId: exportIdentifierSchema,
  format: exportFormatSchema,
});

export const shortlistExportQuerySchema = z.object({
  driveId: exportIdentifierSchema,
  roundId: exportIdentifierSchema.optional(),
  format: exportFormatSchema,
});

export type DriveExportQuery = z.infer<typeof driveExportQuerySchema>;
export type ShortlistExportQuery = z.infer<typeof shortlistExportQuerySchema>;
