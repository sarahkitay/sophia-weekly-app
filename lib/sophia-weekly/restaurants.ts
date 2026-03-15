/**
 * Restaurant IDs and display names. Used for doc IDs and UI.
 * Each restaurant has separate week docs and best-seller history.
 */
export const RESTAURANT_IDS = ["goldies", "oyster-catcher", "osprey"] as const;
export type RestaurantId = (typeof RESTAURANT_IDS)[number];

export const RESTAURANT_LABELS: Record<RestaurantId, string> = {
  goldies: "Goldies and the Roost",
  "oyster-catcher": "The Oyster Catcher",
  osprey: "Osprey Fish Co",
};

export const DEFAULT_RESTAURANT_ID: RestaurantId = "goldies";

/** Firestore doc ID for a restaurant's week. Enables separate history per restaurant. */
export function weekDocId(restaurantId: RestaurantId, weekKey: string): string {
  return `${restaurantId}_${weekKey}`;
}

export function isValidRestaurantId(id: string): id is RestaurantId {
  return RESTAURANT_IDS.includes(id as RestaurantId);
}
