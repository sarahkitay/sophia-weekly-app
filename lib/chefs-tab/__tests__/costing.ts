/**
 * Centralized costing and pricing logic for Chef's Tab.
 * All formulas in one place; round display to 2 decimals.
 */

const TARGET_FOOD_COST_DEFAULT = 24;
const SCENARIO_PERCENTS = [22, 24, 26, 28] as const;

/** Suggested menu price from plate cost and target food cost % */
export function suggestedPrice(plateCost: number, targetFoodCostPercent: number): number {
  if (targetFoodCostPercent <= 0) return 0;
  const p = targetFoodCostPercent / 100;
  const price = plateCost / p;
  return Math.round(price * 100) / 100;
}

/** Actual food cost % given plate cost and current menu price */
export function actualFoodCostPercent(plateCost: number, menuPrice: number): number | null {
  if (menuPrice <= 0) return null;
  return Math.round((plateCost / menuPrice) * 10000) / 100;
}

/** Gross profit per plate */
export function grossProfit(price: number, plateCost: number): number {
  return Math.round((price - plateCost) * 100) / 100;
}

/** Scenario prices at 22%, 24%, 26%, 28% */
export function scenarioPrices(plateCost: number): Record<number, number> {
  const out: Record<number, number> = {};
  for (const pct of SCENARIO_PERCENTS) {
    out[pct] = suggestedPrice(plateCost, pct);
  }
  return out;
}

export function getDefaultTargetFoodCostPercent(): number {
  return TARGET_FOOD_COST_DEFAULT;
}

export function getScenarioPercents(): readonly number[] {
  return SCENARIO_PERCENTS;
}

/** Status for costing display */
export type CostingStatus = "on_target" | "slightly_off" | "underpriced" | "missing" | "partial";

export function costingStatus(
  plateCost: number,
  menuPrice: number | null | undefined,
  targetPercent: number
): CostingStatus {
  if (plateCost <= 0) return "missing";
  if (menuPrice == null || menuPrice <= 0) return "partial";
  const actual = (plateCost / menuPrice) * 100;
  const diff = Math.abs(actual - targetPercent);
  if (diff <= 1) return "on_target";
  if (actual > targetPercent + 5) return "underpriced";
  if (diff <= 5) return "slightly_off";
  return "on_target"; // within range or overpriced (we don't flag overpriced as bad)
}

/** Human-readable reason for the status - use in UI so users understand why a dish is flagged */
export function costingStatusReason(
  status: CostingStatus,
  plateCost: number,
  menuPrice: number | null | undefined,
  targetPercent: number
): string {
  switch (status) {
    case "missing":
      return "Plate cost is $0. Add recipe ingredients and map them to invoice line items so we can calculate cost.";
    case "partial":
      return "No menu price set. Add a current menu price to see actual food cost % and compare to target.";
    case "on_target":
      return `Food cost is within 1% of your ${targetPercent}% target.`;
    case "slightly_off":
      const actualS = menuPrice != null && menuPrice > 0 ? ((plateCost / menuPrice) * 100).toFixed(1) : "?";
      return `Food cost is ${actualS}% (target ${targetPercent}%). Within 5% - consider a small price tweak.`;
    case "underpriced":
      const actualU = menuPrice != null && menuPrice > 0 ? ((plateCost / menuPrice) * 100).toFixed(1) : "?";
      return `Food cost is ${actualU}% - above your ${targetPercent}% target. Dish is underpriced; raise menu price or reduce cost.`;
    default:
      return "";
  }
}
