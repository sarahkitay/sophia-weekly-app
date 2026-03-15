/**
 * Shared helpers for parsing and formatting. Keep isolated and editable.
 */

/** Normalize label for matching: lowercase, trim, collapse spaces. */
export function normalizeLabel(s: string): string {
  return String(s ?? "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/** Parse a value as currency; strip $ and commas. Returns 0 if invalid. */
export function parseCurrency(val: unknown): number {
  if (typeof val === "number" && !Number.isNaN(val)) return val;
  if (typeof val === "string") {
    const n = parseFloat(val.replace(/[$,]/g, ""));
    return Number.isNaN(n) ? 0 : n;
  }
  return 0;
}

/** Safe divide: numerator / denominator; return 0 if denominator is 0 or invalid. */
export function safeDivide(numerator: number, denominator: number): number {
  if (denominator == null || Number(denominator) === 0 || Number.isNaN(denominator)) return 0;
  const n = Number(numerator);
  return Number.isNaN(n) ? 0 : n / Number(denominator);
}

/** Format number as currency: $ and commas, two decimals. */
export function formatCurrency(n: number | undefined | null): string {
  if (n === undefined || n === null) return "$0";
  return "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Format decimal as percentage: XX.XX%. */
export function formatPercent(n: number | undefined | null): string {
  if (n === undefined || n === null) return "0%";
  return (Number(n) * 100).toFixed(2) + "%";
}
