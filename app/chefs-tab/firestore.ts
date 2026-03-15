/**
 * Chef's Tab Firestore collection names and helpers.
 * All collections are scoped by restaurantId in queries.
 */
export const COLLECTIONS = {
  dishes: "chefsTab_dishes",
  dishIngredients: "chefsTab_dish_ingredients",
  ingredients: "chefsTab_ingredients",
  invoices: "chefsTab_invoices",
  invoiceLineItems: "chefsTab_invoice_line_items",
} as const;

/** Serialize Firestore Timestamp for JSON responses */
export function toIso(t: { seconds: number; nanoseconds?: number } | undefined): string {
  if (!t) return new Date().toISOString();
  return new Date(t.seconds * 1000 + (t.nanoseconds ?? 0) / 1e6).toISOString();
}

/** Convert doc snapshot to object with id and ISO dates */
export function docWithId<T extends Record<string, unknown>>(
  id: string,
  data: T,
  dateFields: string[] = ["createdAt", "updatedAt"]
): T & { id: string } {
  const out: Record<string, unknown> = { ...data, id };
  for (const key of dateFields) {
    const v = (data as Record<string, unknown>)[key];
    if (v && typeof v === "object" && "seconds" in v) {
      out[key] = toIso(v as { seconds: number; nanoseconds?: number });
    }
  }
  return out as T & { id: string };
}

export function requireRestaurantId(restaurantId: string | null): void {
  if (!restaurantId) throw new Error("Missing restaurantId");
}
