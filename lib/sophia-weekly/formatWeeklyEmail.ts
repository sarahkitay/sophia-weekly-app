import type { SalesData, LaborData, ProductMixData } from "./types";
import { aggregateWeeklyReport, type WeeklyReport } from "./aggregateWeeklyReport";
import { formatCurrency, formatPercent } from "./utils";
import { getWeekRangeLabelLong } from "./weekUtils";
import { DEFAULT_RESTAURANT_ID, type RestaurantId } from "./restaurants";

/** Signature lines per restaurant so emails don’t all say Goldies and the Roost. */
const SIGNATURE_LINES: Record<RestaurantId, string[]> = {
  goldies: [
    "Sophia Kitay (she/her), Co-Owner/Founder",
    "Goldie's and The Roost",
    "701 N Main St. Coupeville, WA 98239",
  ],
  osprey: ["Sophia Kitay, Co-Owner & Founder, Osprey Fish Co"],
  "oyster-catcher": ["Sophia Kitay, Co-Owner & Founder, The Oyster Catcher"],
};

const NOT_REPORTED = "-";

function formatTopItems(items: string[], max = 3): string {
  if (!items?.length) return NOT_REPORTED;
  return items.slice(0, max).map((item, i) => `${i + 1}. ${item}`).join(" ");
}

/**
 * Generate the final plain-text weekly email in the exact required format.
 * Includes both Top Selling Items and Lowest Selling Items (Food, Wine, Beer, Cocktails for each).
 * Only includes values that were actually parsed; shows "-" when data was not reported.
 * weekKey (Monday of Thu–Mon week): when provided, prepends "Week of Thursday Mar 6 – Monday Mar 10".
 */
export function formatWeeklyEmail(
  sales: SalesData | undefined,
  labor: LaborData | undefined,
  productMix: ProductMixData | undefined,
  weekKey?: string,
  restaurantId: RestaurantId = DEFAULT_RESTAURANT_ID
): string {
  const r = aggregateWeeklyReport(sales, labor, productMix);
  const hasSales = sales != null && (Number(sales.netSales) > 0 || Object.keys(sales).some((k) => k !== "netSales" && Number((sales as Record<string, unknown>)[k]) !== 0));
  const hasLabor = labor != null && Number(labor.totalLaborCost) > 0;
  const hasMix = productMix != null && (
    ((productMix.topFoodItems ?? []).length > 0) ||
    ((productMix.topCocktailItems ?? []).length > 0) ||
    ((productMix.topWineItems ?? []).length > 0) ||
    ((productMix.topBeerItems ?? []).length > 0) ||
    ((productMix.lowestFoodItems ?? []).length > 0) ||
    ((productMix.lowestCocktailItems ?? []).length > 0) ||
    ((productMix.lowestWineItems ?? []).length > 0) ||
    ((productMix.lowestBeerItems ?? []).length > 0)
  );
  const body = formatWeeklyReport(r, hasSales, hasLabor, hasMix, restaurantId);
  if (weekKey) {
    const rangeLine = "Week of " + getWeekRangeLabelLong(weekKey);
    return rangeLine + "\n\n" + body;
  }
  return body;
}

/** Format an already-aggregated WeeklyReport. Use hasSales/hasLabor/hasMix to show "-" when not parsed. */
export function formatWeeklyReport(
  r: WeeklyReport,
  hasSales = true,
  hasLabor = true,
  hasMix = true,
  restaurantId: RestaurantId = DEFAULT_RESTAURANT_ID
): string {
  const lines: string[] = [];
  const cur = (n: number | undefined) => (hasSales ? formatCurrency(n) : NOT_REPORTED);
  const pct = (n: number | undefined) => (hasLabor ? formatPercent(n) : NOT_REPORTED);
  const laborCur = (n: number | undefined) => (hasLabor ? formatCurrency(n) : NOT_REPORTED);

  lines.push("Net Sales: " + cur(r.netSales));
  lines.push("Food: " + cur(r.food));
  lines.push("Wine: " + cur(r.wine));
  lines.push("NA Bev: " + cur(r.naBev));
  lines.push("Liquor: " + cur(r.liquor));
  lines.push("Draft: " + cur(r.draft));
  lines.push("Bottled Beer: " + cur(r.bottledBeer));
  lines.push("Lunch: " + cur(r.lunch));
  lines.push("Dinner: " + cur(r.dinner));
  lines.push("Online Ordering: " + cur(r.onlineOrdering));
  lines.push("Take Out: " + cur(r.takeOut));
  lines.push("");
  lines.push("Discounts/Comps Total: " + cur(r.discountsTotal));
  lines.push("Staff Meal: " + cur(r.familyMeal));
  lines.push("Employee Discount: " + cur(r.employeeDiscount));
  lines.push("Quality: " + cur(r.quality));
  lines.push("Unknown: " + cur(r.unknown));
  lines.push("Owner Discount: " + cur(r.ownerDiscount));
  lines.push("Farmer Discount: " + cur(r.farmerDiscount));
  lines.push("Friend & Family: " + cur(r.friendAndFamily));
  lines.push("Gift: " + cur(r.gift));
  lines.push("Trivia: " + cur(r.trivia));
  lines.push("Donation: " + cur(r.donation));
  lines.push("");
  lines.push("Total Labor Cost: " + laborCur(r.totalLaborCost));
  lines.push("Total Labor Percentage: " + pct(r.totalLaborPercentage));
  lines.push("FOH Cost: " + laborCur(r.fohCost));
  lines.push("FOH OT: " + laborCur(r.fohOt));
  lines.push("FOH Percentage: " + pct(r.fohPercentage));
  lines.push("BOH Cost: " + laborCur(r.bohCost));
  lines.push("BOH OT: " + laborCur(r.bohOt));
  lines.push("BOH Percentage: " + pct(r.bohPercentage));
  lines.push("Owner's Payroll: " + laborCur(r.ownersPayroll));
  lines.push("");
  lines.push("Top Selling Items");
  lines.push("Food: " + (hasMix ? formatTopItems(r.topFoodItems) : NOT_REPORTED));
  lines.push("Wine: " + (hasMix ? formatTopItems(r.topWineItems) : NOT_REPORTED));
  lines.push("Beer: " + (hasMix ? formatTopItems(r.topBeerItems) : NOT_REPORTED));
  lines.push("Cocktails: " + (hasMix ? formatTopItems(r.topCocktailItems) : NOT_REPORTED));
  lines.push("");
  lines.push("Lowest Selling Items");
  lines.push("Food: " + (hasMix ? formatTopItems(r.lowestFoodItems) : NOT_REPORTED));
  lines.push("Wine: " + (hasMix ? formatTopItems(r.lowestWineItems) : NOT_REPORTED));
  lines.push("Beer: " + (hasMix ? formatTopItems(r.lowestBeerItems) : NOT_REPORTED));
  lines.push("Cocktails: " + (hasMix ? formatTopItems(r.lowestCocktailItems) : NOT_REPORTED));
  lines.push("");
  lines.push("--");
  for (const line of SIGNATURE_LINES[restaurantId]) {
    lines.push(line);
  }

  return lines.join("\n");
}
