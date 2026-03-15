import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { isValidRestaurantId, DEFAULT_RESTAURANT_ID } from "@/lib/sophia-weekly/restaurants";

/**
 * GET /api/sophia-weekly/history?limit=100&restaurantId=goldies
 * Returns last N weeks (by updatedAt desc) for that restaurant. Saved reports only.
 */
export async function GET(request: NextRequest) {
  const limit = Math.min(Number(request.nextUrl.searchParams.get("limit")) || 50, 500);
  const restaurantId = request.nextUrl.searchParams.get("restaurantId") ?? DEFAULT_RESTAURANT_ID;
  if (!isValidRestaurantId(restaurantId)) {
    return NextResponse.json({ error: "Invalid restaurantId" }, { status: 400 });
  }

  try {
    const db = getAdminDb();
    const snap = await db
      .collection("goldiesWeeklyImports")
      .where("restaurantId", "==", restaurantId)
      .orderBy("updatedAt", "desc")
      .limit(limit)
      .get();

    const weeks = snap.docs.map((d) => {
      const data = d.data();
      const sentAt = data.sentAt;
      const updatedAt = data.updatedAt;
      return {
        weekKey: data.weekKey,
        sent: data.sent ?? false,
        sentAt: sentAt ? { seconds: sentAt.seconds } : null,
        updatedAt: updatedAt ? { seconds: updatedAt.seconds } : null,
        ready:
          data.salesParsed &&
          data.laborParsed &&
          data.productMixParsed &&
          !!data.generatedEmailText,
      };
    });

    return NextResponse.json({ weeks });
  } catch (e) {
    console.error("History error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
