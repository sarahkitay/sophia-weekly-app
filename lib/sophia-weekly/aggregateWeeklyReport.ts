import type { SalesData, LaborData, ProductMixData } from "./types";
import { safeDivide } from "./utils";

const OWNERS_PAYROLL_CONSTANT = 2708.33;

export interface WeeklyReport {
  netSales: number;
  food: number;
  wine: number;
  naBev: number;
  liquor: number;
  draft: number;
  bottledBeer: number;
  lunch: number;
  dinner: number;
  onlineOrdering: number;
  takeOut: number;

  discountsTotal: number;
  familyMeal: number;
  employeeDiscount: number;
  quality: number;
  unknown: number;
  ownerDiscount: number;
  farmerDiscount: number;
  friendAndFamily: number;
  gift: number;
  trivia: number;
  donation: number;

  totalLaborCost: number;
  totalLaborPercentage: number;
  fohCost: number;
  fohOt: number;
  fohPercentage: number;
  bohCost: number;
  bohOt: number;
  bohPercentage: number;
  ownersPayroll: number;

  topFoodItems: string[];
  topCocktailItems: string[];
  topWineItems: string[];
  topBeerItems: string[];
  lowestFoodItems: string[];
  lowestCocktailItems: string[];
  lowestWineItems: string[];
  lowestBeerItems: string[];
}

function defNum(n: number | undefined | null): number {
  return n != null && !Number.isNaN(n) ? Number(n) : 0;
}

function defArr<T>(a: T[] | undefined | null): T[] {
  return Array.isArray(a) ? a : [];
}

/**
 * Combine sales, labor, and product mix into one weekly report.
 * Labor: total labor cost is from the file (FOH + BOH). FOH cost and BOH cost are from the file.
 * Overtime: fohOt and bohOt are FOH vs BOH overtime from the file.
 * Labor percentages: total labor % = totalLaborCost/netSales; FOH % = fohCost/netSales; BOH % = bohCost/netSales.
 * Owner's Payroll is always 2708.33.
 */
export function aggregateWeeklyReport(
  sales: SalesData | undefined,
  labor: LaborData | undefined,
  productMix: ProductMixData | undefined
): WeeklyReport {
  const netSales = defNum(sales?.netSales);

  const totalLaborCost = defNum(labor?.totalLaborCost);
  const fohCost = defNum(labor?.fohCost);
  const bohCost = defNum(labor?.bohCost);

  return {
    netSales,
    food: defNum(sales?.food),
    wine: defNum(sales?.wine),
    naBev: defNum(sales?.naBev),
    liquor: defNum(sales?.liquor),
    draft: defNum(sales?.draft),
    bottledBeer: defNum(sales?.bottledBeer),
    lunch: defNum(sales?.lunch),
    dinner: defNum(sales?.dinner),
    onlineOrdering: defNum(sales?.onlineOrdering),
    takeOut: defNum(sales?.takeOut),

    discountsTotal: defNum(sales?.discountsTotal),
    familyMeal: defNum(sales?.familyMeal),
    employeeDiscount: defNum(sales?.employeeDiscount),
    quality: defNum(sales?.quality),
    unknown: defNum(sales?.unknown),
    ownerDiscount: defNum(sales?.ownerDiscount),
    farmerDiscount: defNum(sales?.farmerDiscount),
    friendAndFamily: defNum(sales?.friendAndFamily),
    gift: defNum(sales?.gift),
    trivia: defNum(sales?.trivia),
    donation: defNum(sales?.donation),

    totalLaborCost,
    totalLaborPercentage: safeDivide(totalLaborCost, netSales),
    fohCost,
    fohOt: defNum(labor?.fohOt),
    fohPercentage: safeDivide(fohCost, netSales),
    bohCost,
    bohOt: defNum(labor?.bohOt),
    bohPercentage: safeDivide(bohCost, netSales),
    ownersPayroll: OWNERS_PAYROLL_CONSTANT,

    topFoodItems: defArr(productMix?.topFoodItems).slice(0, 3),
    topCocktailItems: defArr(productMix?.topCocktailItems).slice(0, 3),
    topWineItems: defArr(productMix?.topWineItems).slice(0, 3),
    topBeerItems: defArr(productMix?.topBeerItems).slice(0, 3),
    lowestFoodItems: defArr(productMix?.lowestFoodItems).slice(0, 3),
    lowestCocktailItems: defArr(productMix?.lowestCocktailItems).slice(0, 3),
    lowestWineItems: defArr(productMix?.lowestWineItems).slice(0, 3),
    lowestBeerItems: defArr(productMix?.lowestBeerItems).slice(0, 3),
  };
}
