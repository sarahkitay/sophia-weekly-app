/**
 * Normalize ingredient names for matching.
 */
export function normalizeIngredientName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\w\s\-]/g, "")
    .trim();
}
