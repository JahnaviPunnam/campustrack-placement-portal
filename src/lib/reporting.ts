import { escapeSpreadsheetCell } from "@/lib/csv";

export function buildCsv(
  headers: readonly string[],
  rows: readonly (readonly (string | number | null | undefined)[])[],
): string {
  const render = (value: string | number | null | undefined) => {
    const text = value === null || value === undefined ? "" : String(value);
    return `"${escapeSpreadsheetCell(text).replaceAll('"', '""')}"`;
  };
  return [headers.map(render).join(","), ...rows.map((row) => row.map(render).join(","))].join("\n");
}

export function funnelConversion(part: number, total: number): number | null {
  if (total <= 0) return null;
  return Math.round((part / total) * 1000) / 10;
}

export function heatmapIntensity(value: number, max: number): number {
  if (value <= 0 || max <= 0) return 0;
  return Math.max(0.08, Math.min(1, value / max));
}
