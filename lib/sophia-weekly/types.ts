export type ReportType = "SALES" | "LABOR" | "PRODUCT_MIX";

export interface SalesData {
  netSales?: number;
  food?: number;
  wine?: number;
  naBev?: number;
  liquor?: number;
  draft?: number;
  bottledBeer?: number;
  lunch?: number;
  dinner?: number;
  onlineOrdering?: number;
  takeOut?: number;
  discountsTotal?: number;
  familyMeal?: number;
  employeeDiscount?: number;
  quality?: number;
  unknown?: number;
  ownerDiscount?: number;
  farmerDiscount?: number;
  friendAndFamily?: number;
  gift?: number;
  trivia?: number;
  donation?: number;
}

export interface LaborData {
  totalLaborCost?: number;
  totalLaborPercentage?: number;
  fohCost?: number;
  fohOt?: number;
  fohPercentage?: number;
  bohCost?: number;
  bohOt?: number;
  bohPercentage?: number;
  ownersPayroll?: number;
}

export interface ProductMixData {
  topFoodItems?: string[];
  topCocktailItems?: string[];
  topWineItems?: string[];
  topBeerItems?: string[];
  lowestFoodItems?: string[];
  lowestCocktailItems?: string[];
  lowestWineItems?: string[];
  lowestBeerItems?: string[];
}

export interface WeeklyImportDoc {
  weekKey: string;
  salesReceived: boolean;
  laborReceived: boolean;
  productMixReceived: boolean;
  salesParsed: boolean;
  laborParsed: boolean;
  productMixParsed: boolean;
  salesData?: SalesData;
  laborData?: LaborData;
  productMixData?: ProductMixData;
  generatedEmailText: string;
  sent: boolean;
  sentAt: { seconds: number; nanoseconds?: number } | null;
  recipients: string[];
  updatedAt: { seconds: number; nanoseconds?: number };
  parseErrors: string[];
  emailSubjects?: Record<string, string>;
  attachmentNames?: Record<string, string>;
}
