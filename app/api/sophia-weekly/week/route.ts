import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { formatWeeklyEmail } from "@/lib/sophia-weekly/formatWeeklyEmail";
import { weekDocId, isValidRestaurantId, DEFAULT_RESTAURANT_ID } from "@/lib/sophia-weekly/restaurants";
import type { SalesData, LaborData, ProductMixData } from "@/lib/sophia-weekly/types";

/**
 * GET /api/sophia-weekly/week?weekKey=2026-03-08&restaurantId=goldies
 * Returns the weekly import doc for the dashboard. restaurantId scopes to that location.
 */
export async function GET(request: NextRequest) {
  const weekKey = request.nextUrl.searchParams.get("weekKey");
  const restaurantId = request.nextUrl.searchParams.get("restaurantId") ?? DEFAULT_RESTAURANT_ID;
  if (!weekKey) {
    return NextResponse.json({ error: "Missing weekKey" }, { status: 400 });
  }
  if (!isValidRestaurantId(restaurantId)) {
    return NextResponse.json({ error: "Invalid restaurantId" }, { status: 400 });
  }

  try {
    const db = getAdminDb();
    const col = db.collection("goldiesWeeklyImports");
    let snap = await col.doc(weekDocId(restaurantId, weekKey)).get();
    if (!snap.exists && restaurantId === "goldies") {
      snap = await col.doc(weekKey).get();
    }
    if (!snap.exists) {
      return NextResponse.json({ weekKey, exists: false });
    }

    const data = snap.data();
    const sentAt = data?.sentAt;
    const updatedAt = data?.updatedAt;
    return NextResponse.json({
      weekKey,
      exists: true,
      ...data,
      sentAt: sentAt ? { seconds: sentAt.seconds, nanoseconds: sentAt.nanoseconds } : null,
      updatedAt: updatedAt ? { seconds: updatedAt.seconds, nanoseconds: updatedAt.nanoseconds } : null,
    });
  } catch (e) {
    console.error("Get week error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/sophia-weekly/week
 * Body: { weekKey: string, restaurantId?: string, productMixData?: { ... } }
 * Updates top selling items (and/or other productMixData), regenerates the email draft, saves to Firestore.
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const weekKey = body?.weekKey;
    const restaurantId = body?.restaurantId ?? DEFAULT_RESTAURANT_ID;
    if (!weekKey || typeof weekKey !== "string") {
      return NextResponse.json({ error: "Missing weekKey" }, { status: 400 });
    }
    if (!isValidRestaurantId(restaurantId)) {
      return NextResponse.json({ error: "Invalid restaurantId" }, { status: 400 });
    }

    const db = getAdminDb();
    const docId = weekDocId(restaurantId, weekKey);
    const ref = db.collection("goldiesWeeklyImports").doc(docId);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Week not found" }, { status: 404 });
    }

    const doc = snap.data() ?? {};
    const existingMix = (doc.productMixData as ProductMixData) ?? {};
    const incoming = body.productMixData ?? {};
    const productMixData: ProductMixData = {
      topFoodItems: incoming.topFoodItems ?? existingMix.topFoodItems ?? [],
      topCocktailItems: incoming.topCocktailItems ?? existingMix.topCocktailItems ?? [],
      topWineItems: incoming.topWineItems ?? existingMix.topWineItems ?? [],
      topBeerItems: incoming.topBeerItems ?? existingMix.topBeerItems ?? [],
      lowestFoodItems: incoming.lowestFoodItems ?? existingMix.lowestFoodItems ?? [],
      lowestCocktailItems: incoming.lowestCocktailItems ?? existingMix.lowestCocktailItems ?? [],
      lowestWineItems: incoming.lowestWineItems ?? existingMix.lowestWineItems ?? [],
      lowestBeerItems: incoming.lowestBeerItems ?? existingMix.lowestBeerItems ?? [],
    };

    const text = formatWeeklyEmail(
      doc.salesData as SalesData | undefined,
      doc.laborData as LaborData | undefined,
      productMixData,
      weekKey,
      restaurantId
    );

    const hasMix =
      (productMixData.topFoodItems?.length ?? 0) > 0 ||
      (productMixData.topCocktailItems?.length ?? 0) > 0 ||
      (productMixData.topWineItems?.length ?? 0) > 0 ||
      (productMixData.topBeerItems?.length ?? 0) > 0 ||
      (productMixData.lowestFoodItems?.length ?? 0) > 0 ||
      (productMixData.lowestCocktailItems?.length ?? 0) > 0 ||
      (productMixData.lowestWineItems?.length ?? 0) > 0 ||
      (productMixData.lowestBeerItems?.length ?? 0) > 0;
    await ref.set(
      {
        productMixData,
        generatedEmailText: text,
        updatedAt: new Date().toISOString(),
        ...(hasMix ? { productMixReceived: true, productMixParsed: true } : {}),
      },
      { merge: true }
    );

    return NextResponse.json({ ok: true, weekKey });
  } catch (e) {
    console.error("PATCH week error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
