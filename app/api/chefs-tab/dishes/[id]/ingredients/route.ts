import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";
import { isValidRestaurantId, DEFAULT_RESTAURANT_ID } from "@/lib/sophia-weekly/restaurants";
import { COLLECTIONS, docWithId } from "@/lib/chefs-tab/firestore";

/** GET /api/chefs-tab/dishes/[id]/ingredients */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: dishId } = await params;
  const restaurantId = request.nextUrl.searchParams.get("restaurantId") ?? DEFAULT_RESTAURANT_ID;
  if (!isValidRestaurantId(restaurantId)) {
    return NextResponse.json({ error: "Invalid restaurantId" }, { status: 400 });
  }
  try {
    const db = getAdminDb();
    const dishSnap = await db.collection(COLLECTIONS.dishes).doc(dishId).get();
    if (!dishSnap.exists || dishSnap.data()!.restaurantId !== restaurantId) {
      return NextResponse.json({ error: "Dish not found" }, { status: 404 });
    }
    const snap = await db
      .collection(COLLECTIONS.dishIngredients)
      .where("dishId", "==", dishId)
      .orderBy("sortOrder", "asc")
      .get();
    const ingredients = snap.docs.map((d) => docWithId(d.id, d.data(), ["createdAt", "updatedAt"]));
    return NextResponse.json({ ingredients });
  } catch (e) {
    console.error("Chefs-tab dish ingredients GET:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/** POST /api/chefs-tab/dishes/[id]/ingredients - add ingredient to dish */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: dishId } = await params;
  try {
    const body = await request.json();
    const restaurantId = body.restaurantId ?? DEFAULT_RESTAURANT_ID;
    if (!isValidRestaurantId(restaurantId)) {
      return NextResponse.json({ error: "Invalid restaurantId" }, { status: 400 });
    }
    const db = getAdminDb();
    const dishSnap = await db.collection(COLLECTIONS.dishes).doc(dishId).get();
    if (!dishSnap.exists || dishSnap.data()!.restaurantId !== restaurantId) {
      return NextResponse.json({ error: "Dish not found" }, { status: 404 });
    }

    const rawName = (body.rawName ?? body.ingredientName ?? "").trim();
    if (!rawName) {
      return NextResponse.json({ error: "Missing ingredient name" }, { status: 400 });
    }
    const quantityRequired = Number(body.quantityRequired);
    if (!Number.isFinite(quantityRequired) || quantityRequired < 0) {
      return NextResponse.json({ error: "Invalid quantity" }, { status: 400 });
    }
    const unitRequired = (body.unitRequired ?? body.unit ?? "each").trim() || "each";
    const existingSnap = await db
      .collection(COLLECTIONS.dishIngredients)
      .where("dishId", "==", dishId)
      .orderBy("sortOrder", "desc")
      .limit(1)
      .get();
    const nextOrder = existingSnap.empty ? 0 : (existingSnap.docs[0].data().sortOrder ?? 0) + 1;

    const now = new Date().toISOString();
    const quantityPerPlateOz = body.quantityPerPlateOz != null && body.quantityPerPlateOz !== "" ? Number(body.quantityPerPlateOz) : null;
    const doc = {
      dishId,
      ingredientId: body.ingredientId ?? null,
      rawName,
      quantityRequired,
      unitRequired,
      prepYieldPercent: body.prepYieldPercent != null ? Number(body.prepYieldPercent) : null,
      quantityPerPlateOz: quantityPerPlateOz != null && Number.isFinite(quantityPerPlateOz) ? quantityPerPlateOz : null,
      notes: (body.notes ?? "").trim() || null,
      sortOrder: nextOrder,
      createdAt: now,
      updatedAt: now,
    };
    const ref = await db.collection(COLLECTIONS.dishIngredients).add({
      ...doc,
      createdAt: Timestamp.fromDate(new Date(doc.createdAt)),
      updatedAt: Timestamp.fromDate(new Date(doc.updatedAt)),
    });
    return NextResponse.json({ id: ref.id, ...doc });
  } catch (e) {
    console.error("Chefs-tab dish ingredients POST:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
