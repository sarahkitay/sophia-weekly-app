/**
 * Chef's Tab data types. All entities are scoped by restaurantId (tenant).
 */

export interface Dish {
  id: string;
  restaurantId: string;
  name: string;
  slug?: string;
  category: string;
  description?: string;
  currentMenuPrice?: number | null;
  targetFoodCostPercent: number;
  garnishBufferCost?: number | null;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DishIngredient {
  id: string;
  dishId: string;
  ingredientId?: string | null;
  rawName: string;
  quantityRequired: number;
  unitRequired: string;
  prepYieldPercent?: number | null;
  notes?: string;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Ingredient {
  id: string;
  restaurantId: string;
  canonicalName: string;
  normalizedName: string;
  defaultUnit?: string | null;
  aliases: string[];
  createdAt: string;
  updatedAt: string;
}

export type InvoiceSourceType = "csv" | "pdf" | "manual";
export type UploadStatus = "pending" | "uploaded" | "failed";
export type ParseStatus = "pending" | "parsed" | "failed" | "partial";

export interface Invoice {
  id: string;
  restaurantId: string;
  vendorName: string;
  invoiceNumber?: string | null;
  invoiceDate?: string | null;
  sourceType: InvoiceSourceType;
  fileUrl?: string | null;
  rawCsvBase64?: string | null;
  uploadStatus: UploadStatus;
  parseStatus: ParseStatus;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceLineItem {
  id: string;
  invoiceId: string;
  ingredientId?: string | null;
  rawItemName: string;
  normalizedItemName: string;
  quantityPurchased?: number | null;
  purchaseUnit?: string | null;
  packSizeValue?: number | null;
  packSizeUnit?: string | null;
  totalCost: number;
  unitCost?: number | null;
  vendorSku?: string | null;
  isMapped: boolean;
  matchConfidence?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CostingSnapshot {
  dishId: string;
  calculatedPlateCost: number;
  targetFoodCostPercent: number;
  suggestedPrice: number;
  actualMenuPrice?: number | null;
  actualFoodCostPercent?: number | null;
  createdAt: string;
}

/** CSV column mapping: user-selected header index/name -> field */
export interface CsvColumnMap {
  itemName?: number;
  quantity?: number;
  unit?: number;
  packSize?: number;
  totalCost?: number;
  unitCost?: number;
  vendor?: number;
  invoiceNumber?: number;
  invoiceDate?: number;
}

/** Parsed row from CSV before saving */
export interface ParsedInvoiceRow {
  itemName: string;
  quantity?: number;
  unit?: string;
  packSize?: string;
  totalCost: number;
  unitCost?: number;
  vendor?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
}

/** Ingredient match suggestion */
export interface IngredientMatch {
  ingredientId: string;
  canonicalName: string;
  confidence: number;
  source: "exact" | "alias" | "fuzzy";
}
