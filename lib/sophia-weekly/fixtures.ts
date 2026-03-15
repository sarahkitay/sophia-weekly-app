import type { SalesData, LaborData, ProductMixData } from "./types";

/**
 * Sample parsed data for demo/test mode. Use to test formatWeeklyEmail without real Toast files.
 */
export const FIXTURE_SALES: SalesData = {
  netSales: 30802.85,
  food: 21979.51,
  wine: 1659,
  naBev: 897.99,
  liquor: 4033.5,
  draft: 1947,
  bottledBeer: 335,
  lunch: 10538,
  dinner: 22141,
  onlineOrdering: 1827,
  takeOut: 4450,
  discountsTotal: 1976.15,
  familyMeal: 674,
  employeeDiscount: 400.25,
  quality: 30,
  unknown: 0,
  ownerDiscount: 414.4,
  farmerDiscount: 0,
  friendAndFamily: 0,
  gift: 437.5,
  trivia: 20,
  donation: 0,
};

export const FIXTURE_LABOR: LaborData = {
  totalLaborCost: 7411.37,
  totalLaborPercentage: 24.06,
  fohCost: 3143.99,
  fohOt: 0,
  fohPercentage: 10.21,
  bohCost: 4267.38,
  bohOt: 335.07,
  bohPercentage: 13.86,
  ownersPayroll: 2708.33,
};

export const FIXTURE_PRODUCT_MIX: ProductMixData = {
  topFoodItems: ["Pepp", "Knots", "House Salad"],
  topCocktailItems: ["Pink Panther", "Old Fashioned", "Honey Bear"],
  topWineItems: ["House Red", "PG", "SB"],
  topBeerItems: ["Draft Lager", "Draft Pils", "Draft IPA"],
};
