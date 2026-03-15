import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";
import { isValidRestaurantId, DEFAULT_RESTAURANT_ID } from "@/lib/sophia-weekly/restaurants";
import { COLLECTIONS, docWithId } from "@/lib/chefs-tab/firestore";
import { getDefaultTargetFoodCostPercent } from "@/lib/chefs-tab/costing";

/** GET /api/chefs-tab/dishes?restaurantId=goldies */
export async function GET(request: NextRequest) {
  const restaurantId = request.nextUrl.searchParams.get("restaurantId") ?? DEFAULT_RESTAURANT_ID;
  if (!isValidRestaurantId(restaurantId)) {
    return NextResponse.json({ error: "Invalid restaurantId" }, { status: 400 });
  }
  try {
    const db = getAdminDb();
    const snap = await db
      .collection(COLLECTIONS.dishes)
      .where("restaurantId", "==", restaurantId)
      .orderBy("updatedAt", "desc")
      .get();
    const dishes = snap.docs.map((d) => docWithId(d.id, d.data()));
    return NextResponse.json({ dishes });
  } catch (e) {
    console.error("Chefs-tab dishes GET:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/** POST /api/chefs-tab/dishes - create dish */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const restaurantId = body.restaurantId ?? DEFAULT_RESTAURANT_ID;
    if (!isValidRestaurantId(restaurantId)) {
      return NextResponse.json({ error: "Invalid restaurantId" }, { status: 400 });
    }
    const name = (body.name ?? "").trim();
    if (!name) {
      return NextResponse.json({ error: "Missing dish name" }, { status: 400 });
    }
    const slug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^\w\-]/g, "");
    const now = new Date().toISOString();
    const doc = {
      restaurantId,
      name,
      slug: slug || undefined,
      category: (body.category ?? "").trim() || "Uncategorized",
      description: (body.description ?? "").trim() || null,
      currentMenuPrice: body.currentMenuPrice != null ? Number(body.currentMenuPrice) : null,
      targetFoodCostPercent: Number(body.targetFoodCostPercent) || getDefaultTargetFoodCostPercent(),
      garnishBufferCost: body.garnishBufferCost != null ? Number(body.garnishBufferCost) : null,
      notes: (body.notes ?? "").trim() || null,
      createdAt: now,
      updatedAt: now,
    };
    const db = getAdminDb();
    const ref = await db.collection(COLLECTIONS.dishes).add({
      ...doc,
      createdAt: Timestamp.fromDate(new Date(doc.createdAt)),
      updatedAt: Timestamp.fromDate(new Date(doc.updatedAt)),
    });
    return NextResponse.json({ id: ref.id, ...doc });
  } catch (e) {
    console.error("Chefs-tab dishes POST:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
