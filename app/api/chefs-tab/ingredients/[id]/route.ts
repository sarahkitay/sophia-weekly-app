import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";
import { isValidRestaurantId, DEFAULT_RESTAURANT_ID } from "@/lib/sophia-weekly/restaurants";
import { COLLECTIONS, docWithId } from "@/lib/chefs-tab/firestore";
import { normalizeIngredientName } from "@/lib/chefs-tab/normalize";

/** GET /api/chefs-tab/ingredients/[id] */
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
    const snap = await db.collection(COLLECTIONS.ingredients).doc(id).get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Ingredient not found" }, { status: 404 });
    }
    const data = snap.data()!;
    if (data.restaurantId !== restaurantId) {
      return NextResponse.json({ error: "Ingredient not found" }, { status: 404 });
    }
    return NextResponse.json(docWithId(id, data));
  } catch (e) {
    console.error("Chefs-tab ingredient GET:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/** PATCH /api/chefs-tab/ingredients/[id] */
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
    const ref = db.collection(COLLECTIONS.ingredients).doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Ingredient not found" }, { status: 404 });
    }
    const existing = snap.data()!;
    if (existing.restaurantId !== restaurantId) {
      return NextResponse.json({ error: "Ingredient not found" }, { status: 404 });
    }

    const canonicalName = body.canonicalName != null ? String(body.canonicalName).trim() : existing.canonicalName;
    const update: Record<string, unknown> = {
      canonicalName: canonicalName || existing.canonicalName,
      normalizedName: canonicalName ? normalizeIngredientName(canonicalName) : existing.normalizedName,
      defaultUnit: body.defaultUnit !== undefined ? (body.defaultUnit ? String(body.defaultUnit).trim() : null) : existing.defaultUnit,
      aliases: body.aliases !== undefined ? (Array.isArray(body.aliases) ? body.aliases.map((a: string) => String(a).trim()).filter(Boolean) : existing.aliases) : existing.aliases,
      updatedAt: Timestamp.now(),
    };
    await ref.update(update);
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    console.error("Chefs-tab ingredient PATCH:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/** DELETE /api/chefs-tab/ingredients/[id] */
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
    const ref = db.collection(COLLECTIONS.ingredients).doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Ingredient not found" }, { status: 404 });
    }
    if (snap.data()!.restaurantId !== restaurantId) {
      return NextResponse.json({ error: "Ingredient not found" }, { status: 404 });
    }
    await ref.delete();
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    console.error("Chefs-tab ingredient DELETE:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
