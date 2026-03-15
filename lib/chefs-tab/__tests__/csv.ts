/**
 * CSV parsing for invoice import. Handles quoted fields and optional header mapping.
 */

export interface ParseCsvResult {
  headers: string[];
  rows: string[][];
  errors: string[];
}

/**
 * Parse CSV string into headers and rows. First row is treated as header if hasHeaders.
 */
export function parseCsv(csvText: string, hasHeaders = true): ParseCsvResult {
  const errors: string[] = [];
  const rows: string[][] = [];
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim().length > 0);
  for (let i = 0; i < lines.length; i++) {
    const row = parseCsvLine(lines[i]);
    if (row.length) rows.push(row);
  }
  const headers = hasHeaders && rows.length > 0 ? rows[0] : [];
  const dataRows = hasHeaders && rows.length > 1 ? rows.slice(1) : rows;
  return { headers, rows: dataRows, errors };
}

/** Parse a single CSV line respecting quoted commas */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if ((c === "," && !inQuotes) || (c === "\t" && !inQuotes)) {
      result.push(current.trim());
      current = "";
    } else {
      current += c;
    }
  }
  result.push(current.trim());
  return result;
}

export type ColumnKey =
  | "itemName"
  | "quantity"
  | "unit"
  | "packSize"
  | "totalCost"
  | "unitCost"
  | "vendor"
  | "invoiceNumber"
  | "invoiceDate";

/** Map header index to column key and parse row into typed values */
export function mapRowToParsed(
  row: string[],
  columnMap: Partial<Record<ColumnKey, number>>,
  options?: { vendor?: string; invoiceNumber?: string; invoiceDate?: string }
): {
  itemName: string;
  quantity?: number;
  unit?: string;
  packSize?: string;
  totalCost: number;
  unitCost?: number;
  vendor?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
} {
  const get = (key: ColumnKey): string => {
    const idx = columnMap[key];
    if (idx == null || idx < 0 || idx >= row.length) return "";
    return (row[idx] ?? "").trim();
  };
  const num = (key: ColumnKey): number | undefined => {
    const s = get(key).replace(/[$,]/g, "");
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : undefined;
  };
  return {
    itemName: get("itemName") || "Unknown item",
    quantity: num("quantity"),
    unit: get("unit") || undefined,
    packSize: get("packSize") || undefined,
    totalCost: num("totalCost") ?? 0,
    unitCost: num("unitCost"),
    vendor: get("vendor") || options?.vendor,
    invoiceNumber: get("invoiceNumber") || options?.invoiceNumber,
    invoiceDate: get("invoiceDate") || options?.invoiceDate,
  };
}
