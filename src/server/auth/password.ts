import crypto from "node:crypto";
import bcrypt from "bcryptjs";

const RUNTIME_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, RUNTIME_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateTemporaryPassword(): string {
  return `Campus@${crypto.randomBytes(5).toString("hex")}9`;
}

export async function hashSeedPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export const DUMMY_PASSWORD_HASH =
  "$2a$10$7EqJtq98hPqEX7fNZaFWoO5Z1s9sM0u0F5Y5z3jn9Y2g0o5Q0x1b2";
