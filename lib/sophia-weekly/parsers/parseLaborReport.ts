import * as XLSX from "xlsx";
import type { LaborData } from "../types";
import { normalizeLabel, parseCurrency } from "../utils";

/**
 * Labor export (Toast Labor Break Down, CSV/Excel): Job Title, Regular Pay, Overtime Pay, Total Pay.
 * - Total labor = FOH + BOH total pay from the file.
 * - FOH cost = sum of bartender, cashier, shift manager, runner, server.
 * - BOH cost = sum of am dish, pm dish, cook, pastry chef, chef.
 * - Overtime = FOH OT and BOH OT from the file.
 * - Total labor % and FOH % / BOH % = those costs / net sales at aggregation time.
 * Owner's Payroll is NOT from file; always 2708.33.
 */

/** FOH categories: summed to get total FOH cost. */
const FOH_JOB_TITLES = [
  "bartender",
  "cashier",
  "shift manager",
  "runner",
  "server",
];

/** BOH categories: summed to get total BOH cost. */
const BOH_JOB_TITLES = ["am dish", "pm dish", "cook", "pastry chef", "chef", "am dishwasher", "pm dishwasher"];

function isFoh(title: string): boolean {
  const t = normalizeLabel(title);
  return FOH_JOB_TITLES.some((j) => t === j || t.includes(j) || j.includes(t));
}

function isBoh(title: string): boolean {
  const t = normalizeLabel(title);
  // Match "AM Dishwasher", "AM Dish", "PM Dish", etc.
  if (t.includes("am") && (t.includes("dish") || t.includes("dishwasher"))) return true;
  if (t.includes("pm") && (t.includes("dish") || t.includes("dishwasher"))) return true;
  return BOH_JOB_TITLES.some((j) => t === j || t.includes(j) || j.includes(t));
}

function parseCsvBuffer(buffer: Buffer): string[][] {
  const u8 = new Uint8Array(buffer);
  const wb = XLSX.read(u8, { type: "array", raw: true });
  const first = wb.SheetNames[0];
  if (!first) return [];
  const ws = wb.Sheets[first];
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
}

/** Return true if this row looks like a header (contains job/title/pay/cost/overtime keywords). */
function looksLikeHeader(row: string[]): boolean {
  const joined = row.map((c) => String(c ?? "").toLowerCase()).join(" ");
  return (
    /job|title|position|role|employee\s*type|department/.test(joined) ||
    /pay|wage|salary|gross|regular|overtime|ot\b|cost|hours/.test(joined)
  );
}

function findCol(header: string[], ...nameGroups: string[][]): number {
  const lower = header.map((h) => normalizeLabel(String(h ?? "")));
  for (const names of nameGroups) {
    for (const n of names) {
      const norm = normalizeLabel(n);
      const idx = lower.findIndex((h) => h.includes(norm) || norm.includes(h));
      if (idx >= 0) return idx;
    }
  }
  return -1;
}

const OWNERS_PAYROLL_CONSTANT = 2708.33;

export function parseLaborReport(buffer: Buffer): { data: LaborData; errors: string[] } {
  const errors: string[] = [];
  const rows = parseCsvBuffer(buffer);
  if (!rows.length) {
    errors.push("No rows in labor file");
    return {
      data: {
        totalLaborCost: 0,
        totalLaborPercentage: 0,
        fohCost: 0,
        fohOt: 0,
        fohPercentage: 0,
        bohCost: 0,
        bohOt: 0,
        bohPercentage: 0,
        ownersPayroll: OWNERS_PAYROLL_CONSTANT,
      },
      errors,
    };
  }

  // If the first row doesn't look like a header, use the second (Toast sometimes has a title row).
  let headerRowIndex = 0;
  const firstRow = rows[0].map((c) => String(c ?? ""));
  if (!looksLikeHeader(firstRow) && rows.length > 1) {
    const secondRow = rows[1].map((c) => String(c ?? ""));
    if (looksLikeHeader(secondRow)) headerRowIndex = 1;
  }
  const header = rows[headerRowIndex].map((c) => String(c ?? ""));

  const jobTitleCol = findCol(header, ["job title", "title", "job", "position", "role", "department", "employee type"]);
  const regularPayCol = findCol(header, ["regular cost", "regular pay", "regular", "base pay", "standard pay"]);
  const overtimePayCol = findCol(header, ["overtime cost", "overtime pay", "overtime", "ot pay", "ot"]);
  const totalPayCol = findCol(header, ["total cost", "total pay", "total", "gross pay", "gross", "pay", "amount"]);
  // Toast export has "Last Name" / "First Name"; summary rows (one per job title) have these empty. Use only summary rows to avoid double-counting.
  const nameCol = findCol(header, ["last name", "first name", "chosen name"]);

  let fohCost = 0;
  let fohOt = 0;
  let bohCost = 0;
  let bohOt = 0;

  const j = jobTitleCol >= 0 ? jobTitleCol : 0;
  const r = regularPayCol >= 0 ? regularPayCol : 1;
  const o = overtimePayCol >= 0 ? overtimePayCol : 2;
  const t = totalPayCol >= 0 ? totalPayCol : 3;

  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    // If this export has a name column, skip detail rows (only use summary rows where name is empty).
    if (nameCol >= 0) {
      const nameVal = String(row[nameCol] ?? "").trim();
      if (nameVal !== "") continue;
    }
    const title = String(row[j] ?? "").trim();
    if (!title) continue;
    const totalPay = parseCurrency(row[t] ?? row[r]);
    const otPay = parseCurrency(row[o]);
    if (isFoh(title)) {
      fohCost += totalPay;
      fohOt += otPay;
    } else if (isBoh(title)) {
      bohCost += totalPay;
      bohOt += otPay;
    }
  }

  const totalLaborCost = fohCost + bohCost;
  const dataRowCount = Math.max(0, rows.length - headerRowIndex - 1);
  if (dataRowCount > 0 && totalLaborCost === 0) {
    errors.push(
      "Labor file had rows but no FOH/BOH totals parsed. Check that columns include Job Title (or Position/Role), Total Pay (or Gross Pay), and Overtime Pay. Job titles must match: FOH = bartender, cashier, shift manager, runner, server; BOH = am dish, pm dish, cook, pastry chef, chef."
    );
  }

  const data: LaborData = {
    totalLaborCost,
    totalLaborPercentage: 0,
    fohCost,
    fohOt,
    fohPercentage: 0,
    bohCost,
    bohOt,
    bohPercentage: 0,
    ownersPayroll: OWNERS_PAYROLL_CONSTANT,
  };

  return { data, errors };
}
