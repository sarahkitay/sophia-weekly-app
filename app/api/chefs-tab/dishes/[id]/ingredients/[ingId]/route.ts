import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";
import { isValidRestaurantId, DEFAULT_RESTAURANT_ID } from "@/lib/sophia-weekly/restaurants";
import { COLLECTIONS } from "@/lib/chefs-tab/firestore";

/** PATCH /api/chefs-tab/dishes/[id]/ingredients/[ingId] */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; ingId: string }> }
) {
  const { id: dishId, ingId } = await params;
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
    const ref = db.collection(COLLECTIONS.dishIngredients).doc(ingId);
    const snap = await ref.get();
    if (!snap.exists || snap.data()!.dishId !== dishId) {
      return NextResponse.json({ error: "Ingredient line not found" }, { status: 404 });
    }
    const existing = snap.data()!;
    const update: Record<string, unknown> = {
      updatedAt: Timestamp.now(),
    };
    if (body.rawName !== undefined) update.rawName = String(body.rawName).trim();
    if (body.quantityRequired !== undefined) update.quantityRequired = Number(body.quantityRequired);
    if (body.unitRequired !== undefined) update.unitRequired = String(body.unitRequired).trim() || "each";
    if (body.ingredientId !== undefined) update.ingredientId = body.ingredientId ?? null;
    if (body.prepYieldPercent !== undefined) update.prepYieldPercent = body.prepYieldPercent == null ? null : Number(body.prepYieldPercent);
    if (body.quantityPerPlateOz !== undefined) update.quantityPerPlateOz = body.quantityPerPlateOz == null || body.quantityPerPlateOz === "" ? null : Number(body.quantityPerPlateOz);
    if (body.notes !== undefined) update.notes = body.notes ? String(body.notes).trim() : null;
    if (body.sortOrder !== undefined) update.sortOrder = Number(body.sortOrder);
    await ref.update(update);
    return NextResponse.json({ ok: true, id: ingId });
  } catch (e) {
    console.error("Chefs-tab dish ingredient PATCH:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/** DELETE /api/chefs-tab/dishes/[id]/ingredients/[ingId] */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; ingId: string }> }
) {
  const { id: dishId, ingId } = await params;
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
    const ref = db.collection(COLLECTIONS.dishIngredients).doc(ingId);
    const snap = await ref.get();
    if (!snap.exists || snap.data()!.dishId !== dishId) {
      return NextResponse.json({ error: "Ingredient line not found" }, { status: 404 });
    }
    await ref.delete();
    return NextResponse.json({ ok: true, id: ingId });
  } catch (e) {
    console.error("Chefs-tab dish ingredient DELETE:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
