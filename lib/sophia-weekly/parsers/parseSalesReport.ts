import * as XLSX from "xlsx";
import AdmZip from "adm-zip";
import type { SalesData } from "../types";
import { normalizeLabel, parseCurrency } from "../utils";

/**
 * Sales Summary: either a single CSV or a ZIP containing multiple CSVs.
 * All fields default to 0. discountsTotal = sum of discount buckets.
 */

const SALES_ZIP_FILES = [
  "net sales summary.csv",
  "sales category summary.csv",
  "service daypart summary.csv",
  "dining options summary.csv",
  "check discounts.csv",
  "menu item discounts.csv",
] as const;

function parseCsvBuffer(buffer: Buffer): string[][] {
  const u8 = new Uint8Array(buffer);
  const wb = XLSX.read(u8, { type: "array", raw: true });
  const first = wb.SheetNames[0];
  if (!first) return [];
  const ws = wb.Sheets[first];
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
}

/** Parse all sheets from a workbook (for combined Toast exports that use multiple sheets). */
function parseAllSheets(buffer: Buffer): string[][][] {
  const u8 = new Uint8Array(buffer);
  const wb = XLSX.read(u8, { type: "array", raw: true });
  return (wb.SheetNames || []).map((name) => {
    const ws = wb.Sheets[name];
    return ws ? XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) : [];
  });
}

function findEntryName(entries: { entryName: string }[], name: string): string | null {
  const want = normalizeLabel(name);
  for (const e of entries) {
    const base = e.entryName.replace(/^.*\//, "").trim();
    if (normalizeLabel(base) === want) return e.entryName;
  }
  for (const e of entries) {
    if (normalizeLabel(e.entryName).includes(want) || want.includes(normalizeLabel(e.entryName))) return e.entryName;
  }
  return null;
}

/** Prefer "Net sales" column for Toast sales reports so we never use "Items" (count) or "Discount amount" by mistake. */
function findValueCol(header: string[]): number {
  const netSalesIdx = header.findIndex((h) => /net\s*sales|netsales/i.test(normalizeLabel(h)));
  if (netSalesIdx >= 0) return netSalesIdx;
  const idx = header.findIndex((h) =>
    /amount|total|sales|pay|value|revenue|current|week\s*(\d|$)/i.test(normalizeLabel(h))
  );
  return idx >= 0 ? idx : 1;
}

/** Try to find a numeric value in a row (for category/row-based sheets). Prefer valueCol, then first non-zero numeric column. */
function findValueInRow(row: string[], valueCol: number, header: string[]): number {
  const tryCols = [valueCol, 1, 2, 3].filter((c) => c >= 0 && c < row.length);
  for (const c of tryCols) {
    const v = parseCurrency(row[c]);
    if (v > 0) return v;
  }
  for (const c of tryCols) {
    const v = parseCurrency(row[c]);
    if (!Number.isNaN(v)) return v;
  }
  return 0;
}

function extractByMap(
  rows: string[][],
  map: Record<string, keyof SalesData>
): Partial<SalesData> {
  const out: Partial<SalesData> = {};
  if (!rows.length) return out;
  const header = rows[0].map((c) => String(c ?? ""));
  const dataRow = rows[1];
  const valueCol = findValueCol(header);

  for (const [label, key] of Object.entries(map)) {
    const normLabel = normalizeLabel(label);
    const colIdx = header.findIndex((h) => normalizeLabel(h).includes(normLabel) || normLabel.includes(normalizeLabel(h)));
    if (colIdx >= 0 && dataRow) {
      (out as Record<string, number>)[key] = parseCurrency(dataRow[colIdx]);
      continue;
    }
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r] ?? [];
      const cell = normalizeLabel(String(row[0] ?? ""));
      if (cell.includes(normLabel) || normLabel.includes(cell)) {
        const val = findValueInRow(row, valueCol, header);
        if (val > 0) (out as Record<string, number>)[key] = val;
        else (out as Record<string, number>)[key] = parseCurrency(row[valueCol] ?? row[1]);
        break;
      }
    }
  }
  return out;
}

function emptySalesData(): SalesData {
  return {
    netSales: 0,
    food: 0,
    wine: 0,
    naBev: 0,
    liquor: 0,
    draft: 0,
    bottledBeer: 0,
    lunch: 0,
    dinner: 0,
    onlineOrdering: 0,
    takeOut: 0,
    discountsTotal: 0,
    familyMeal: 0,
    employeeDiscount: 0,
    quality: 0,
    unknown: 0,
    ownerDiscount: 0,
    farmerDiscount: 0,
    friendAndFamily: 0,
    gift: 0,
    trivia: 0,
    donation: 0,
  };
}

function mergeSalesPartial(into: SalesData, partial: Partial<SalesData>): void {
  for (const [k, v] of Object.entries(partial)) {
    if (v !== undefined && typeof v === "number") {
      (into as Record<string, number>)[k] = v;
    }
  }
}

/** Parse Net sales summary.csv → netSales */
function parseNetSalesSummary(rows: string[][]): Partial<SalesData> {
  const out: Partial<SalesData> = {};
  if (!rows.length) return out;
  const header = rows[0].map((c) => String(c ?? ""));
  const dataRow = rows[1] ?? rows[rows.length - 1];
  if (!dataRow) return out;
  const idx = header.findIndex((h) => /net\s*sales|netsales|total\s*sales|revenue/i.test(normalizeLabel(h)));
  if (idx >= 0) out.netSales = parseCurrency(dataRow[idx]);
  return out;
}

/** Parse Sales category summary.csv - labels Toast may use for category rows/columns */
const salesCategoryMap: Record<string, keyof SalesData> = {
  food: "food",
  wine: "wine",
  "na beverage": "naBev",
  "na bev": "naBev",
  "non-alcoholic": "naBev",
  "n/a beverage": "naBev",
  "non alcoholic": "naBev",
  liquor: "liquor",
  spirits: "liquor",
  "draft beer": "draft",
  draft: "draft",
  "bottled beer": "bottledBeer",
  bottled: "bottledBeer",
  "beer": "bottledBeer",
};

/** Parse Service Daypart summary.csv */
const daypartMap: Record<string, keyof SalesData> = {
  lunch: "lunch",
  dinner: "dinner",
};

/** Parse Dining options summary.csv */
const diningOptionMap: Record<string, keyof SalesData> = {
  "take out": "takeOut",
  "online ordering - takeout": "onlineOrdering",
};

/**
 * Parse Check Discounts.csv / Menu Item Discounts.csv.
 * Toast format: rows with Discount (or Name) in col 0, Amount in Amount column.
 * Maps CSV discount type names to SalesData keys. discountsTotal = sum of all buckets.
 */
const DISCOUNT_LABEL_TO_KEY: Record<string, keyof SalesData> = {
  "staff meal": "familyMeal",
  "employee discount - item": "employeeDiscount",
  "employee discount": "employeeDiscount",
  gift: "gift",
  "farmer's discount": "farmerDiscount",
  "farmer discount": "farmerDiscount",
  quality: "quality",
  unknown: "unknown",
  "owner discount": "ownerDiscount",
  "friend & family": "friendAndFamily",
  "friend and family": "friendAndFamily",
  trivia: "trivia",
  "trivia first place 20$": "trivia",
  donation: "donation",
};

function parseDiscounts(rows: string[][]): Partial<SalesData> {
  if (!rows.length) return {};
  const header = rows[0].map((c) => String(c ?? ""));
  const nameCol = header.findIndex((h) => /discount|name|type|category/i.test(normalizeLabel(h)));
  const amountCol = header.findIndex((h) => /^amount$|^total$|discount\s*amount|value/i.test(normalizeLabel(h)));
  const useNameCol = nameCol >= 0 ? nameCol : 0;
  const useAmountCol = amountCol >= 0 ? amountCol : (header.length > 3 ? 3 : 1);

  const out: Partial<SalesData> = {};
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const name = normalizeLabel(String(row[useNameCol] ?? ""));
    if (!name || name === "total") continue;
    const amount = parseCurrency(row[useAmountCol]);
    if (amount === 0) continue;
    for (const [label, key] of Object.entries(DISCOUNT_LABEL_TO_KEY)) {
      const match =
        label === "gift"
          ? (name === "gift" || (name.startsWith("gift") && !name.includes("card") && !name.includes("certificate")))
          : name.includes(label) || label.includes(name);
      if (match) {
        const existing = (out as Record<string, number>)[key] ?? 0;
        (out as Record<string, number>)[key] = existing + amount;
        break;
      }
    }
  }
  return out;
}

/** Discounts/Comps Total = Employee + Farmer + Gift + Staff Meal + (Trivia + Friend & Family when present in CSV). */
function computeDiscountsTotal(data: SalesData): number {
  return (
    (data.employeeDiscount ?? 0) +
    (data.farmerDiscount ?? 0) +
    (data.gift ?? 0) +
    (data.familyMeal ?? 0) +
    (data.trivia ?? 0) +
    (data.friendAndFamily ?? 0)
  );
}

function parseFromZip(zip: AdmZip): { data: SalesData; errors: string[] } {
  const errors: string[] = [];
  const data = emptySalesData();
  const entries = zip.getEntries();

  const getBuffer = (name: (typeof SALES_ZIP_FILES)[number]): Buffer | null => {
    const path = findEntryName(entries, name);
    if (!path) return null;
    const entry = zip.getEntry(path);
    if (!entry || entry.isDirectory) return null;
    return entry.getData();
  };

  const buf = getBuffer("net sales summary.csv");
  if (buf) mergeSalesPartial(data, parseNetSalesSummary(parseCsvBuffer(buf)));

  const catBuf = getBuffer("sales category summary.csv");
  if (catBuf) mergeSalesPartial(data, extractByMap(parseCsvBuffer(catBuf), salesCategoryMap));

  const daypartBuf = getBuffer("service daypart summary.csv");
  if (daypartBuf) mergeSalesPartial(data, extractByMap(parseCsvBuffer(daypartBuf), daypartMap));

  const diningBuf = getBuffer("dining options summary.csv");
  if (diningBuf) mergeSalesPartial(data, extractByMap(parseCsvBuffer(diningBuf), diningOptionMap));

  const checkDiscBuf = getBuffer("check discounts.csv");
  if (checkDiscBuf) mergeSalesPartial(data, parseDiscounts(parseCsvBuffer(checkDiscBuf)));

  const menuDiscBuf = getBuffer("menu item discounts.csv");
  if (menuDiscBuf) mergeSalesPartial(data, parseDiscounts(parseCsvBuffer(menuDiscBuf)));

  data.discountsTotal = computeDiscountsTotal(data);
  return { data, errors };
}

/** Single-CSV dispatch by filename (for uploads of individual CSVs). */
const FILE_TYPE_MAP = [
  { match: "net sales summary", map: "netSales" as const },
  { match: "sales category summary", map: "salesCategory" as const },
  { match: "category summary", map: "salesCategory" as const },
  { match: "service daypart summary", map: "daypart" as const },
  { match: "daypart", map: "daypart" as const },
  { match: "dining options summary", map: "diningOption" as const },
  { match: "dining options", map: "diningOption" as const },
  { match: "check discounts", map: "checkDiscounts" as const },
  { match: "menu item discounts", map: "menuItemDiscounts" as const },
] as const;

function getFileType(filename: string): (typeof FILE_TYPE_MAP)[number]["map"] | null {
  const lower = normalizeLabel(filename);
  for (const { match, map } of FILE_TYPE_MAP) {
    if (lower.includes(match)) return map;
  }
  return null;
}

function parseSingleCsv(buffer: Buffer, fileType: (typeof FILE_TYPE_MAP)[number]["map"]): Partial<SalesData> {
  const rows = parseCsvBuffer(buffer);
  if (!rows.length) return {};
  switch (fileType) {
    case "netSales":
      return parseNetSalesSummary(rows);
    case "salesCategory":
      return extractByMap(rows, salesCategoryMap);
    case "daypart":
      return extractByMap(rows, daypartMap);
    case "diningOption":
      return extractByMap(rows, diningOptionMap);
    case "checkDiscounts":
    case "menuItemDiscounts":
      return parseDiscounts(rows);
    default:
      return {};
  }
}

export function parseSalesReport(
  buffer: Buffer,
  filename?: string
): { data: SalesData; errors: string[] } {
  const errors: string[] = [];
  const isZip = buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b;

  if (isZip) {
    try {
      const zip = new AdmZip(buffer);
      return parseFromZip(zip);
    } catch (e) {
      errors.push(e instanceof Error ? e.message : "Failed to parse ZIP");
      return { data: emptySalesData(), errors };
    }
  }

  const data = emptySalesData();
  const fileType = filename ? getFileType(filename) : null;

  if (fileType) {
    mergeSalesPartial(data, parseSingleCsv(buffer, fileType));
  } else {
    // Unknown filename: try all sheets (Toast sometimes uses one workbook with multiple sheets)
    const allSheets = parseAllSheets(buffer);
    for (const rows of allSheets) {
      if (!rows.length) continue;
      mergeSalesPartial(data, parseNetSalesSummary(rows));
      mergeSalesPartial(data, extractByMap(rows, salesCategoryMap));
      mergeSalesPartial(data, extractByMap(rows, daypartMap));
      mergeSalesPartial(data, extractByMap(rows, diningOptionMap));
      mergeSalesPartial(data, parseDiscounts(rows));
    }
  }

  data.discountsTotal = computeDiscountsTotal(data);
  return { data, errors };
}
