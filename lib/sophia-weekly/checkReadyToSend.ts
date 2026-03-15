import type { WeeklyImportDoc } from "./types";

function hasMeaningfulProductMix(mix: { topFoodItems?: string[]; topCocktailItems?: string[]; topWineItems?: string[]; topBeerItems?: string[] } | undefined): boolean {
  if (!mix) return false;
  const a = mix.topFoodItems ?? [];
  const b = mix.topCocktailItems ?? [];
  const c = mix.topWineItems ?? [];
  const d = mix.topBeerItems ?? [];
  return a.length > 0 || b.length > 0 || c.length > 0 || d.length > 0;
}

/**
 * True when we have sales + labor parsed and product mix (from upload or manual best sellers).
 */
export function checkReadyToSend(doc: WeeklyImportDoc): boolean {
  return (
    doc.salesReceived &&
    doc.salesParsed &&
    doc.laborReceived &&
    doc.laborParsed &&
    (doc.productMixParsed || hasMeaningfulProductMix(doc.productMixData))
  );
}
