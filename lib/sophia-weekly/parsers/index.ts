import type { ReportType } from "../types";
import { parseSalesReport } from "./parseSalesReport";
import { parseLaborReport } from "./parseLaborReport";
import { parseProductMixReport } from "./parseProductMixReport";
import type { SalesData, LaborData, ProductMixData } from "../types";

export function parseReport(
  type: ReportType,
  buffer: Buffer,
  filename?: string
): { data: SalesData | LaborData | ProductMixData; errors: string[] } {
  switch (type) {
    case "SALES":
      return parseSalesReport(buffer, filename);
    case "LABOR":
      return parseLaborReport(buffer);
    case "PRODUCT_MIX":
      return parseProductMixReport(buffer);
    default:
      return { data: {}, errors: ["Unknown report type"] };
  }
}

const DISCOUNT_KEYS: (keyof SalesData)[] = [
  "familyMeal", "employeeDiscount", "quality", "unknown", "ownerDiscount",
  "farmerDiscount", "friendAndFamily", "gift", "trivia", "donation",
];

/** Included in Discounts/Comps Total: always the four, plus Trivia and Friend & Family when present in CSV. */
const DISCOUNT_TOTAL_KEYS: (keyof SalesData)[] = [
  "employeeDiscount", "farmerDiscount", "gift", "familyMeal",
  "trivia", "friendAndFamily",
];

/** Discount keys that come from Check Discounts.csv (staff meal, trivia, friend & family). */
const CHECK_DISCOUNT_KEYS: (keyof SalesData)[] = ["familyMeal", "trivia", "friendAndFamily"];

/** Discount keys that come from Menu Item Discounts.csv (employee, farmer, gift, and the rest). */
const MENU_ITEM_DISCOUNT_KEYS: (keyof SalesData)[] = [
  "employeeDiscount", "farmerDiscount", "gift", "quality", "unknown", "ownerDiscount", "donation",
];

function checkDiscountSum(p: Partial<SalesData>): number {
  return (p.familyMeal ?? 0) + (p.trivia ?? 0) + (p.friendAndFamily ?? 0);
}

function menuItemDiscountSum(p: Partial<SalesData>): number {
  return (p.employeeDiscount ?? 0) + (p.farmerDiscount ?? 0) + (p.gift ?? 0);
}

function isCheckDiscountsFilename(name: string): boolean {
  return /check\s*discounts/i.test(name.replace(/\s+/g, " "));
}

function isMenuItemDiscountsFilename(name: string): boolean {
  return /menu\s*item\s*discounts/i.test(name.replace(/\s+/g, " "));
}

export type SalesPartialWithSource = { partial: Partial<SalesData>; filename?: string };

/**
 * Merge multiple partial SalesData. Non-discount keys: first non-zero per key.
 * Discount keys come from two sources and are combined:
 * - Check Discounts.csv (filename contains "check discounts"): familyMeal (staff meal), trivia, friendAndFamily.
 * - Menu Item Discounts.csv (filename contains "menu item discounts"): employeeDiscount, farmerDiscount, gift, quality, unknown, ownerDiscount, donation.
 * If a designated source file wasn't uploaded, that key falls back to first non-zero from any partial (e.g. ZIP or single-file uploads).
 */
export function mergeSalesData(
  partialsOrWithSource: Partial<SalesData>[] | SalesPartialWithSource[]
): SalesData {
  const partials: Partial<SalesData>[] = [];
  const filenames: (string | undefined)[] = [];
  for (const item of partialsOrWithSource) {
    if (item && typeof item === "object" && "partial" in item) {
      partials.push((item as SalesPartialWithSource).partial);
      filenames.push((item as SalesPartialWithSource).filename);
    } else {
      partials.push(item as Partial<SalesData>);
      filenames.push(undefined);
    }
  }

  const out: SalesData = {};
  const keys = new Set<string>();
  for (const p of partials) {
    for (const k of Object.keys(p)) keys.add(k);
  }
  for (const k of DISCOUNT_KEYS) keys.add(k);

  const withSource = partials.map((p, i) => ({ partial: p, filename: filenames[i] }));
  const checkDiscountsCandidates = withSource.filter(
    (x) => x.filename != null && isCheckDiscountsFilename(x.filename)
  );
  const menuItemDiscountsCandidates = withSource.filter(
    (x) => x.filename != null && isMenuItemDiscountsFilename(x.filename)
  );
  const primaryCheckDiscountsPartial =
    checkDiscountsCandidates.length > 0
      ? checkDiscountsCandidates.reduce((best, x) =>
          checkDiscountSum(x.partial) > checkDiscountSum(best.partial) ? x : best
        ).partial
      : undefined;
  const primaryMenuItemDiscountsPartial =
    menuItemDiscountsCandidates.length > 0
      ? menuItemDiscountsCandidates.reduce((best, x) =>
          menuItemDiscountSum(x.partial) > menuItemDiscountSum(best.partial) ? x : best
        ).partial
      : undefined;

  function firstNonZero(key: string): number {
    for (const p of partials) {
      const v = (p as Record<string, unknown>)[key];
      if (typeof v === "number" && !Number.isNaN(v) && v !== 0) return v;
    }
    for (const p of partials) {
      const v = (p as Record<string, unknown>)[key];
      if (typeof v === "number" && !Number.isNaN(v)) return v;
    }
    return 0;
  }

  for (const key of keys) {
    const isDiscount = (DISCOUNT_KEYS as string[]).includes(key);
    if (isDiscount) {
      const fromCheck = (CHECK_DISCOUNT_KEYS as string[]).includes(key);
      const fromMenu = (MENU_ITEM_DISCOUNT_KEYS as string[]).includes(key);
      let v = 0;
      if (fromCheck && primaryCheckDiscountsPartial != null) {
        const x = (primaryCheckDiscountsPartial as Record<string, unknown>)[key];
        v = typeof x === "number" && !Number.isNaN(x) ? x : 0;
      } else if (fromMenu && primaryMenuItemDiscountsPartial != null) {
        const x = (primaryMenuItemDiscountsPartial as Record<string, unknown>)[key];
        v = typeof x === "number" && !Number.isNaN(x) ? x : 0;
      } else {
        v = firstNonZero(key);
      }
      (out as Record<string, number>)[key] = v;
    } else {
      (out as Record<string, number>)[key] = firstNonZero(key) ?? 0;
    }
  }

  let total = 0;
  for (const k of DISCOUNT_TOTAL_KEYS) {
    const v = (out as Record<string, number>)[k];
    if (typeof v === "number") total += v;
  }
  out.discountsTotal = total;
  return out;
}

export { parseSalesReport, parseLaborReport, parseProductMixReport };
