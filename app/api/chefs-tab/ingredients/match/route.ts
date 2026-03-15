import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { isValidRestaurantId, DEFAULT_RESTAURANT_ID } from "@/lib/sophia-weekly/restaurants";
import { COLLECTIONS, docWithId } from "@/lib/chefs-tab/firestore";
import { matchLineItemToIngredients } from "@/lib/chefs-tab/matching";
import type { Ingredient } from "@/lib/chefs-tab/types";

/**
 * GET /api/chefs-tab/ingredients/match?restaurantId=&rawItemName=...
 * Returns suggested ingredient matches for an invoice line item.
 */
export async function GET(request: NextRequest) {
  const restaurantId = request.nextUrl.searchParams.get("restaurantId") ?? DEFAULT_RESTAURANT_ID;
  const rawItemName = request.nextUrl.searchParams.get("rawItemName") ?? "";
  const normalizedItemName = request.nextUrl.searchParams.get("normalizedItemName") ?? "";
  if (!isValidRestaurantId(restaurantId)) {
    return NextResponse.json({ error: "Invalid restaurantId" }, { status: 400 });
  }
  try {
    const db = getAdminDb();
    const ingSnap = await db
      .collection(COLLECTIONS.ingredients)
      .where("restaurantId", "==", restaurantId)
      .get();
    const ingredients: Ingredient[] = ingSnap.docs.map((d) => docWithId(d.id, d.data()) as Ingredient);

    const lineItem = {
      rawItemName: rawItemName || "Unknown",
      normalizedItemName: normalizedItemName || "",
    };
    const matches = matchLineItemToIngredients(lineItem, ingredients);
    return NextResponse.json({ matches });
  } catch (e) {
    console.error("Chefs-tab match GET:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
