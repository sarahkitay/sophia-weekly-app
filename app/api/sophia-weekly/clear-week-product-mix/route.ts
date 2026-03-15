import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { formatWeeklyEmail } from "@/lib/sophia-weekly/formatWeeklyEmail";
import { weekDocId, isValidRestaurantId, DEFAULT_RESTAURANT_ID } from "@/lib/sophia-weekly/restaurants";
import type { SalesData, LaborData, ProductMixData } from "@/lib/sophia-weekly/types";

const EMPTY_PRODUCT_MIX: ProductMixData = {
  topFoodItems: [],
  topCocktailItems: [],
  topWineItems: [],
  topBeerItems: [],
  lowestFoodItems: [],
  lowestCocktailItems: [],
  lowestWineItems: [],
  lowestBeerItems: [],
};

/** Empty sales and labor so the week shows as needing uploads again. */
const EMPTY_SALES: SalesData = {
  netSales: 0,
  food: 0,
  wine: 0,
  naBev: 0,
  liquor: 0,
  draft: 0,
  bottledBeer: 0,
  lunch: 0,
  dinner: 0,
  onlineOrdering: 0,
  takeOut: 0,
  discountsTotal: 0,
  familyMeal: 0,
  employeeDiscount: 0,
  quality: 0,
  unknown: 0,
  ownerDiscount: 0,
  farmerDiscount: 0,
  friendAndFamily: 0,
  gift: 0,
  trivia: 0,
  donation: 0,
};

const EMPTY_LABOR: LaborData = {
  totalLaborCost: 0,
  totalLaborPercentage: 0,
  fohCost: 0,
  fohOt: 0,
  fohPercentage: 0,
  bohCost: 0,
  bohOt: 0,
  bohPercentage: 0,
  ownersPayroll: 2708.33,
};

/**
 * POST /api/sophia-weekly/clear-week-product-mix
 * Body: { weekKey: string, restaurantId?: string }
 * Clears sales, labor, and product mix for that week so you can re-upload the folder fresh.
 */
export async function POST(request: NextRequest) {
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
    const ref = db.collection("goldiesWeeklyImports").doc(weekDocId(restaurantId, weekKey));
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Week not found" }, { status: 404 });
    }

    const text = formatWeeklyEmail(EMPTY_SALES, EMPTY_LABOR, EMPTY_PRODUCT_MIX, weekKey, restaurantId);

    await ref.set(
      {
        salesData: EMPTY_SALES,
        laborData: EMPTY_LABOR,
        productMixData: EMPTY_PRODUCT_MIX,
        generatedEmailText: text,
        salesReceived: false,
        salesParsed: false,
        laborReceived: false,
        laborParsed: false,
        productMixParsed: false,
        parseErrors: [],
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    return NextResponse.json({ ok: true, weekKey });
  } catch (e) {
    console.error("Clear week error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
