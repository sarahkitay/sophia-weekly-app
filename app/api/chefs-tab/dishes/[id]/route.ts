import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";
import { isValidRestaurantId, DEFAULT_RESTAURANT_ID } from "@/lib/sophia-weekly/restaurants";
import { COLLECTIONS, docWithId } from "@/lib/chefs-tab/firestore";
import { getDefaultTargetFoodCostPercent } from "@/lib/chefs-tab/costing";

/** GET /api/chefs-tab/dishes/[id]?restaurantId= */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const restaurantId = request.nextUrl.searchParams.get("restaurantId") ?? DEFAULT_RESTAURANT_ID;
  if (!isValidRestaurantId(restaurantId)) {
    return NextResponse.json({ error: "Invalid restaurantId" }, { status: 400 });
  }
  try {
    const db = getAdminDb();
    const dishSnap = await db.collection(COLLECTIONS.dishes).doc(id).get();
    if (!dishSnap.exists) {
      return NextResponse.json({ error: "Dish not found" }, { status: 404 });
    }
    const dishData = dishSnap.data()!;
    if (dishData.restaurantId !== restaurantId) {
      return NextResponse.json({ error: "Dish not found" }, { status: 404 });
    }
    const dish = docWithId(id, dishData);

    const ingredientsSnap = await db
      .collection(COLLECTIONS.dishIngredients)
      .where("dishId", "==", id)
      .orderBy("sortOrder", "asc")
      .get();
    const ingredients = ingredientsSnap.docs.map((d) => docWithId(d.id, d.data(), ["createdAt", "updatedAt"]));

    return NextResponse.json({ dish, ingredients });
  } catch (e) {
    console.error("Chefs-tab dish GET:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/** PATCH /api/chefs-tab/dishes/[id] */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json();
    const restaurantId = body.restaurantId ?? DEFAULT_RESTAURANT_ID;
    if (!isValidRestaurantId(restaurantId)) {
      return NextResponse.json({ error: "Invalid restaurantId" }, { status: 400 });
    }
    const db = getAdminDb();
    const ref = db.collection(COLLECTIONS.dishes).doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Dish not found" }, { status: 404 });
    }
    const existing = snap.data()!;
    if (existing.restaurantId !== restaurantId) {
      return NextResponse.json({ error: "Dish not found" }, { status: 404 });
    }

    const name = body.name != null ? String(body.name).trim() : existing.name;
    if (!name) {
      return NextResponse.json({ error: "Missing dish name" }, { status: 400 });
    }
    const slug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^\w\-]/g, "");
    const update: Record<string, unknown> = {
      name,
      slug: slug || undefined,
      category: body.category != null ? String(body.category).trim() : existing.category,
      description: body.description != null ? (body.description ? String(body.description).trim() : null) : existing.description,
      currentMenuPrice: body.currentMenuPrice !== undefined ? (body.currentMenuPrice == null ? null : Number(body.currentMenuPrice)) : existing.currentMenuPrice,
      targetFoodCostPercent: body.targetFoodCostPercent != null ? Number(body.targetFoodCostPercent) : existing.targetFoodCostPercent,
      garnishBufferCost: body.garnishBufferCost !== undefined ? (body.garnishBufferCost == null ? null : Number(body.garnishBufferCost)) : existing.garnishBufferCost,
      notes: body.notes !== undefined ? (body.notes ? String(body.notes).trim() : null) : existing.notes,
      updatedAt: Timestamp.now(),
    };
    await ref.update(update);
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    console.error("Chefs-tab dish PATCH:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/** DELETE /api/chefs-tab/dishes/[id] */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const restaurantId = request.nextUrl.searchParams.get("restaurantId") ?? DEFAULT_RESTAURANT_ID;
  if (!isValidRestaurantId(restaurantId)) {
    return NextResponse.json({ error: "Invalid restaurantId" }, { status: 400 });
  }
  try {
    const db = getAdminDb();
    const ref = db.collection(COLLECTIONS.dishes).doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Dish not found" }, { status: 404 });
    }
    if (snap.data()!.restaurantId !== restaurantId) {
      return NextResponse.json({ error: "Dish not found" }, { status: 404 });
    }
    const batch = db.batch();
    const ingredientsSnap = await db.collection(COLLECTIONS.dishIngredients).where("dishId", "==", id).get();
    ingredientsSnap.docs.forEach((d) => batch.delete(d.ref));
    batch.delete(ref);
    await batch.commit();
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    console.error("Chefs-tab dish DELETE:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
