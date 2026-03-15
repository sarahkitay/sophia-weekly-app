import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { isValidRestaurantId, DEFAULT_RESTAURANT_ID } from "@/lib/sophia-weekly/restaurants";

const EMPTY_PRODUCT_MIX = {
  topFoodItems: [],
  topCocktailItems: [],
  topWineItems: [],
  topBeerItems: [],
  lowestFoodItems: [],
  lowestCocktailItems: [],
  lowestWineItems: [],
  lowestBeerItems: [],
};

/**
 * POST /api/sophia-weekly/wipe-best-sellers
 * Body: { restaurantId?: string } or ?restaurantId=goldies
 * Clears productMixData from unsent week docs for that restaurant only. Sent weeks are kept.
 */
const BATCH_SIZE = 500;

export async function POST(request: NextRequest) {
  const restaurantId = request.nextUrl.searchParams.get("restaurantId") ?? DEFAULT_RESTAURANT_ID;
  if (!isValidRestaurantId(restaurantId)) {
    return NextResponse.json({ error: "Invalid restaurantId" }, { status: 400 });
  }

  try {
    const db = getAdminDb();
    const snap = await db
      .collection("goldiesWeeklyImports")
      .where("restaurantId", "==", restaurantId)
      .get();
    let wiped = 0;
    for (let i = 0; i < snap.docs.length; i += BATCH_SIZE) {
      const batch = db.batch();
      const chunk = snap.docs.slice(i, i + BATCH_SIZE);
      let batchCount = 0;
      for (const doc of chunk) {
        if (doc.data()?.sent) continue;
        batch.update(doc.ref, {
          productMixData: EMPTY_PRODUCT_MIX,
          updatedAt: new Date().toISOString(),
        });
        wiped += 1;
        batchCount += 1;
      }
      if (batchCount > 0) await batch.commit();
    }
    return NextResponse.json({ ok: true, wiped });
  } catch (e) {
    console.error("Wipe best sellers error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
