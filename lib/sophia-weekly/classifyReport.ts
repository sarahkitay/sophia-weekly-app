import type { ReportType } from "./types";

/**
 * Classify inbound report by filename and/or subject.
 * Edit these rules when you see real Toast export filenames/subjects.
 */
/** Toast sales-style filenames that should always be SALES (checked before regex). */
const SALES_FILENAME_HINTS = [
  "cash activity",
  "day of week",
  "time of day",
  "net sales",
  "sales category",
  "service daypart",
  "dining options",
  "check discounts",
  "menu item discounts",
];

export function classifyReport(
  subject: string,
  attachmentNames: string[]
): ReportType | null {
  const combined = [subject, ...attachmentNames].join(" ").toLowerCase().replace(/\s+/g, " ").trim();

  // PRODUCT_MIX: product mix, productmix, item sales, mix (but not "sales" in name)
  if (
    /product\s*mix|productmix|mix\s*report|item\s*sales/.test(combined) ||
    (combined.includes("mix") && !combined.includes("labor") && !combined.includes("sales"))
  ) {
    return "PRODUCT_MIX";
  }

  // LABOR: labor, labor break down, time entries (not "time of day"), payroll, job, pay
  if (
    /labor|breakdown|break\s*down|time\s*entries|payroll|hours|job\s*title|regular\s*pay|overtime/.test(combined)
  ) {
    return "LABOR";
  }

  // SALES: explicit Toast filenames first, then regex
  if (SALES_FILENAME_HINTS.some((hint) => combined.includes(hint))) {
    return "SALES";
  }
  if (
    /sales|summary|financial|net\s*sales|revenue|category\s*summary|daypart|dining\s*option|check\s*discount|menu\s*item\s*discount|cash\s*activity|day\s*of\s*week|time\s*of\s*day|totals/.test(combined)
  ) {
    return "SALES";
  }

  return null;
}
