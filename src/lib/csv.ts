export function parseCsv(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

export function serializeCsv(values: readonly (string | number)[]): string {
  return Array.from(new Set(values.map((v) => String(v).trim()).filter(Boolean))).join(",");
}

export function parseCsvNumbers(value: string | null | undefined): number[] {
  return parseCsv(value)
    .map((part) => Number(part))
    .filter((n) => Number.isFinite(n));
}

export function parseCsvYears(value: string | null | undefined): number[] {
  return Array.from(new Set(parseCsvNumbers(value).map((n) => Math.trunc(n)))).filter(
    (n) => n >= 1990 && n <= 2100,
  );
}

export function escapeSpreadsheetCell(value: string): string {
  if (/^[=+\-@\t\r]/.test(value)) return `'${value}`;
  return value;
}
