import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";
import { isValidRestaurantId, DEFAULT_RESTAURANT_ID } from "@/lib/sophia-weekly/restaurants";
import { COLLECTIONS, docWithId } from "@/lib/chefs-tab/firestore";
import { normalizeIngredientName } from "@/lib/chefs-tab/normalize";

/** GET /api/chefs-tab/ingredients?restaurantId= */
export async function GET(request: NextRequest) {
  const restaurantId = request.nextUrl.searchParams.get("restaurantId") ?? DEFAULT_RESTAURANT_ID;
  if (!isValidRestaurantId(restaurantId)) {
    return NextResponse.json({ error: "Invalid restaurantId" }, { status: 400 });
  }
  try {
    const db = getAdminDb();
    const snap = await db
      .collection(COLLECTIONS.ingredients)
      .where("restaurantId", "==", restaurantId)
      .orderBy("canonicalName", "asc")
      .get();
    const ingredients = snap.docs.map((d) => docWithId(d.id, d.data()));
    return NextResponse.json({ ingredients });
  } catch (e) {
    console.error("Chefs-tab ingredients GET:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/** POST /api/chefs-tab/ingredients - create ingredient */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const restaurantId = body.restaurantId ?? DEFAULT_RESTAURANT_ID;
    if (!isValidRestaurantId(restaurantId)) {
      return NextResponse.json({ error: "Invalid restaurantId" }, { status: 400 });
    }
    const canonicalName = (body.canonicalName ?? body.name ?? "").trim();
    if (!canonicalName) {
      return NextResponse.json({ error: "Missing ingredient name" }, { status: 400 });
    }
    const normalizedName = normalizeIngredientName(canonicalName);
    const aliases = Array.isArray(body.aliases) ? body.aliases.map((a: string) => String(a).trim()).filter(Boolean) : [];
    const now = new Date().toISOString();
    const doc = {
      restaurantId,
      canonicalName,
      normalizedName,
      defaultUnit: body.defaultUnit ? String(body.defaultUnit).trim() : null,
      aliases,
      createdAt: now,
      updatedAt: now,
    };
    const db = getAdminDb();
    const ref = await db.collection(COLLECTIONS.ingredients).add({
      ...doc,
      createdAt: Timestamp.fromDate(new Date(doc.createdAt)),
      updatedAt: Timestamp.fromDate(new Date(doc.updatedAt)),
    });
    return NextResponse.json({ id: ref.id, ...doc });
  } catch (e) {
    console.error("Chefs-tab ingredients POST:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
