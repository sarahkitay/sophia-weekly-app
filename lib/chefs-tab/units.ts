/**
 * Unit normalization and conversion for recipe costing.
 * Supports weight (g, kg, oz, lb), volume (ml, l, tsp, tbsp, cup, pint, quart, gallon), and each.
 */

export const SUPPORTED_UNITS = [
  "each",
  "oz",
  "lb",
  "g",
  "kg",
  "ml",
  "l",
  "tsp",
  "tbsp",
  "cup",
  "pint",
  "quart",
  "gallon",
] as const;

export type SupportedUnit = (typeof SUPPORTED_UNITS)[number];

const UNIT_ALIASES: Record<string, SupportedUnit> = {
  each: "each",
  ea: "each",
  unit: "each",
  units: "each",
  ounce: "oz",
  oz: "oz",
  ounces: "oz",
  lb: "lb",
  lbs: "lb",
  pound: "lb",
  pounds: "lb",
  gram: "g",
  g: "g",
  grams: "g",
  kilogram: "kg",
  kg: "kg",
  kilograms: "kg",
  milliliter: "ml",
  ml: "ml",
  milliliters: "ml",
  litre: "l",
  liter: "l",
  l: "l",
  litres: "l",
  liters: "l",
  teaspoon: "tsp",
  tsp: "tsp",
  teaspoons: "tsp",
  tablespoon: "tbsp",
  tbsp: "tbsp",
  tablespoons: "tbsp",
  cup: "cup",
  cups: "cup",
  pint: "pint",
  pt: "pint",
  pints: "pint",
  quart: "quart",
  qt: "quart",
  qts: "quart",
  quarts: "quart",
  gallon: "gallon",
  gal: "gallon",
  gallons: "gallon",
};

/** Normalize unit string to canonical SupportedUnit or null if unknown */
export function normalizeUnit(raw: string | undefined): SupportedUnit | null {
  if (raw == null || raw === "") return null;
  const key = raw.trim().toLowerCase().replace(/\s+/g, "");
  return UNIT_ALIASES[key] ?? null;
}

/** Weight in grams (base for weight) */
const LB_TO_G = 453.592;
const OZ_TO_G = LB_TO_G / 16;

/** Volume in ml (base for volume) */
const TSP_TO_ML = 4.92892;
const TBSP_TO_ML = TSP_TO_ML * 3;
const CUP_TO_ML = 236.588;
const PINT_TO_ML = CUP_TO_ML * 2;
const QUART_TO_ML = PINT_TO_ML * 2;
const GALLON_TO_ML = QUART_TO_ML * 4;

function toBaseWeight(unit: SupportedUnit, value: number): number | null {
  switch (unit) {
    case "g":
      return value;
    case "kg":
      return value * 1000;
    case "oz":
      return value * OZ_TO_G;
    case "lb":
      return value * LB_TO_G;
    default:
      return null;
  }
}

function fromBaseWeight(toUnit: SupportedUnit, baseGrams: number): number | null {
  switch (toUnit) {
    case "g":
      return baseGrams;
    case "kg":
      return baseGrams / 1000;
    case "oz":
      return baseGrams / OZ_TO_G;
    case "lb":
      return baseGrams / LB_TO_G;
    default:
      return null;
  }
}

function toBaseVolume(unit: SupportedUnit, value: number): number | null {
  switch (unit) {
    case "ml":
      return value;
    case "l":
      return value * 1000;
    case "tsp":
      return value * TSP_TO_ML;
    case "tbsp":
      return value * TBSP_TO_ML;
    case "cup":
      return value * CUP_TO_ML;
    case "pint":
      return value * PINT_TO_ML;
    case "quart":
      return value * QUART_TO_ML;
    case "gallon":
      return value * GALLON_TO_ML;
    default:
      return null;
  }
}

function fromBaseVolume(toUnit: SupportedUnit, baseMl: number): number | null {
  switch (toUnit) {
    case "ml":
      return baseMl;
    case "l":
      return baseMl / 1000;
    case "tsp":
      return baseMl / TSP_TO_ML;
    case "tbsp":
      return baseMl / TBSP_TO_ML;
    case "cup":
      return baseMl / CUP_TO_ML;
    case "pint":
      return baseMl / PINT_TO_ML;
    case "quart":
      return baseMl / QUART_TO_ML;
    case "gallon":
      return baseMl / GALLON_TO_ML;
    default:
      return null;
  }
}

const WEIGHT_UNITS: SupportedUnit[] = ["g", "kg", "oz", "lb"];
const VOLUME_UNITS: SupportedUnit[] = ["ml", "l", "tsp", "tbsp", "cup", "pint", "quart", "gallon"];

function isWeight(u: SupportedUnit): boolean {
  return WEIGHT_UNITS.includes(u);
}
function isVolume(u: SupportedUnit): boolean {
  return VOLUME_UNITS.includes(u);
}

/**
 * Cost per ounce for a weight purchase. Returns null if purchase unit is not weight.
 * Used when recipe specifies amount per plate in oz (quantityPerPlateOz override).
 */
export function costPerOz(
  totalCost: number,
  quantityPurchased: number,
  purchaseUnit: string | undefined
): number | null {
  const pUnit = normalizeUnit(purchaseUnit);
  if (!pUnit || !isWeight(pUnit) || totalCost <= 0 || quantityPurchased <= 0) return null;
  const purchaseInG = toBaseWeight(pUnit, quantityPurchased);
  if (purchaseInG == null) return null;
  const purchaseInOz = purchaseInG / OZ_TO_G;
  return totalCost / purchaseInOz;
}

/**
 * Convert quantity in given unit to oz. Returns null for non-weight units.
 */
export function toOz(quantity: number, unit: string | undefined): number | null {
  const u = normalizeUnit(unit);
  if (!u || !isWeight(u)) return null;
  const baseG = toBaseWeight(u, quantity);
  return baseG != null ? baseG / OZ_TO_G : null;
}

/**
 * Convert value from fromUnit to toUnit.
 * Returns null if units are incompatible (e.g. weight to volume) or unknown.
 */
export function convertUnits(
  value: number,
  fromUnit: string | undefined,
  toUnit: string | undefined
): number | null {
  const from = normalizeUnit(fromUnit);
  const to = normalizeUnit(toUnit);
  if (!from || !to) return null;
  if (from === to) return value;
  if (from === "each" || to === "each") return null; // each is not convertible to weight/volume
  if (isWeight(from) && isWeight(to)) {
    const base = toBaseWeight(from, value);
    return base != null ? fromBaseWeight(to, base) : null;
  }
  if (isVolume(from) && isVolume(to)) {
    const base = toBaseVolume(from, value);
    return base != null ? fromBaseVolume(to, base) : null;
  }
  return null; // weight <-> volume not supported
}

/**
 * Cost per unit in recipe unit: (totalCost / quantityInPurchaseUnit) * (recipeQty / purchaseQtyInRecipeUnit).
 * If units match or are convertible, returns cost for recipeQty in recipeUnit.
 * Returns null if incompatible or missing data.
 */
export function costPerRecipeUnit(
  totalCost: number,
  quantityPurchased: number,
  purchaseUnit: string | undefined,
  recipeQuantity: number,
  recipeUnit: string | undefined
): number | null {
  const pUnit = normalizeUnit(purchaseUnit);
  const rUnit = normalizeUnit(recipeUnit);
  if (!pUnit || !rUnit) return null;
  if (totalCost <= 0 || quantityPurchased <= 0) return null;

  if (pUnit === "each" && rUnit === "each") {
    return (totalCost / quantityPurchased) * recipeQuantity;
  }
  if (pUnit !== "each" && rUnit !== "each") {
    const converted = convertUnits(recipeQuantity, rUnit, pUnit);
    if (converted == null) return null;
    const costPerPurchaseUnit = totalCost / quantityPurchased;
    return costPerPurchaseUnit * (converted / quantityPurchased);
  }
  return null;
}

/**
 * Simpler: get cost for one unit of purchase unit (e.g. $ per lb).
 * Then multiply by recipe usage after converting recipe amount to purchase unit.
 */
export function ingredientPortionCost(
  totalCost: number,
  quantityPurchased: number,
  purchaseUnit: string | undefined,
  recipeQuantity: number,
  recipeUnit: string | undefined
): { cost: number; compatible: true } | { cost: null; compatible: false; reason: string } {
  const pUnit = normalizeUnit(purchaseUnit);
  const rUnit = normalizeUnit(recipeUnit);
  if (totalCost <= 0 || quantityPurchased <= 0) {
    return { cost: null, compatible: false, reason: "Missing or invalid cost or quantity" };
  }
  if (!pUnit) {
    return { cost: null, compatible: false, reason: "Unsupported purchase unit" };
  }
  if (!rUnit) {
    return { cost: null, compatible: false, reason: "Unsupported recipe unit" };
  }

  if (pUnit === "each" && rUnit === "each") {
    const unitCost = totalCost / quantityPurchased;
    return { cost: Math.round(unitCost * recipeQuantity * 100) / 100, compatible: true };
  }

  if (isWeight(pUnit) && isWeight(rUnit)) {
    const purchaseInBase = toBaseWeight(pUnit, quantityPurchased);
    const recipeInBase = toBaseWeight(rUnit, recipeQuantity);
    if (purchaseInBase == null || recipeInBase == null) {
      return { cost: null, compatible: false, reason: "Unit conversion failed" };
    }
    const costPerBase = totalCost / purchaseInBase;
    const cost = costPerBase * recipeInBase;
    return { cost: Math.round(cost * 100) / 100, compatible: true };
  }

  if (isVolume(pUnit) && isVolume(rUnit)) {
    const purchaseInBase = toBaseVolume(pUnit, quantityPurchased);
    const recipeInBase = toBaseVolume(rUnit, recipeQuantity);
    if (purchaseInBase == null || recipeInBase == null) {
      return { cost: null, compatible: false, reason: "Unit conversion failed" };
    }
    const costPerBase = totalCost / purchaseInBase;
    const cost = costPerBase * recipeInBase;
    return { cost: Math.round(cost * 100) / 100, compatible: true };
  }

  return {
    cost: null,
    compatible: false,
    reason: "Unit mismatch - manual review recommended (e.g. weight vs volume)",
  };
}
