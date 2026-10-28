import path from "node:path";
import { getEnv } from "@/lib/env";
import { AppError } from "@/server/errors";

export function uploadRoot(): string {
  return path.resolve(process.cwd(), getEnv().UPLOAD_DIR);
}

export function resolveUploadPath(relativePath: string): string {
  const root = uploadRoot();
  const resolved = path.resolve(process.cwd(), relativePath);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new AppError("INVALID_FILE_PATH", "Invalid file path.", 400);
  }
  return resolved;
}

export function safeDownloadName(value: string | null | undefined): string {
  const cleaned = (value ?? "resume.pdf").replace(/[^\w.\- ()]/g, "_").slice(0, 120);
  return cleaned.toLowerCase().endsWith(".pdf") ? cleaned : `${cleaned}.pdf`;
}
