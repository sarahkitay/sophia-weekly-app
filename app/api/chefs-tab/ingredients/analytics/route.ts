import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { isValidRestaurantId, DEFAULT_RESTAURANT_ID } from "@/lib/sophia-weekly/restaurants";
import { COLLECTIONS } from "@/lib/chefs-tab/firestore";
import { ingredientPortionCost } from "@/lib/chefs-tab/units";
import { actualFoodCostPercent } from "@/lib/chefs-tab/costing";

type CostMapEntry = { totalCost: number; quantityPurchased: number; purchaseUnit: string };

/**
 * GET /api/chefs-tab/ingredients/analytics?restaurantId=
 * Returns ingredient analytics: best margins, underutilized, most/least used (by recipe count).
 */
export async function GET(request: NextRequest) {
  const restaurantId = request.nextUrl.searchParams.get("restaurantId") ?? DEFAULT_RESTAURANT_ID;
  if (!isValidRestaurantId(restaurantId)) {
    return NextResponse.json({ error: "Invalid restaurantId" }, { status: 400 });
  }
  try {
    const db = getAdminDb();

    const [ingSnap, dishIngSnap, dishesSnap, invoicesSnap, lineItemsSnap] = await Promise.all([
      db.collection(COLLECTIONS.ingredients).where("restaurantId", "==", restaurantId).get(),
      db.collection(COLLECTIONS.dishIngredients).get(),
      db.collection(COLLECTIONS.dishes).where("restaurantId", "==", restaurantId).get(),
      db.collection(COLLECTIONS.invoices).where("restaurantId", "==", restaurantId).orderBy("updatedAt", "desc").get(),
      db.collection(COLLECTIONS.invoiceLineItems).get(),
    ]);

    const ingredients = new Map<string, { id: string; canonicalName: string }>();
    ingSnap.docs.forEach((d) => {
      const data = d.data();
      ingredients.set(d.id, { id: d.id, canonicalName: data.canonicalName ?? "" });
    });

    const restaurantDishIds = new Set(dishesSnap.docs.map((d) => d.id));

    const ingToDishIds = new Map<string, Set<string>>();
    const dishIngredientsByDishId = new Map<string, Array<{ ingredientId: string; quantityRequired: number; unitRequired: string }>>();
    dishIngSnap.docs.forEach((d) => {
      const data = d.data();
      const dishId = data.dishId;
      const ingId = data.ingredientId;
      if (!restaurantDishIds.has(dishId)) return;
      if (ingId) {
        if (!ingToDishIds.has(ingId)) ingToDishIds.set(ingId, new Set());
        ingToDishIds.get(ingId)!.add(dishId);
      }
      if (!dishIngredientsByDishId.has(dishId)) dishIngredientsByDishId.set(dishId, []);
      dishIngredientsByDishId.get(dishId)!.push({
        ingredientId: ingId ?? "",
        quantityRequired: Number(data.quantityRequired) || 0,
        unitRequired: data.unitRequired || "each",
      });
    });
    ingredients.forEach((_, ingId) => {
      ingToDishIds.set(ingId, ingToDishIds.get(ingId) ?? new Set());
    });

    const invoiceIds = new Set(invoicesSnap.docs.map((d) => d.id));
    const ingToInvoiceTotal = new Map<string, number>();
    const ingInInvoices = new Set<string>();
    lineItemsSnap.docs.forEach((d) => {
      const data = d.data();
      if (data.invoiceId && invoiceIds.has(data.invoiceId) && data.isMapped && data.ingredientId) {
        const ingId = data.ingredientId;
        ingInInvoices.add(ingId);
        ingToInvoiceTotal.set(ingId, (ingToInvoiceTotal.get(ingId) ?? 0) + Number(data.totalCost ?? 0));
      }
    });

    const costMap = new Map<string, CostMapEntry>();
    for (const invDoc of invoicesSnap.docs) {
      const lineSnap = await db
        .collection(COLLECTIONS.invoiceLineItems)
        .where("invoiceId", "==", invDoc.id)
        .where("isMapped", "==", true)
        .get();
      for (const line of lineSnap.docs) {
        const d = line.data();
        const ingId = d.ingredientId;
        if (!ingId || costMap.has(ingId)) continue;
        const qty = d.quantityPurchased;
        const unit = d.purchaseUnit;
        if (qty == null || qty <= 0 || d.totalCost == null) continue;
        costMap.set(ingId, {
          totalCost: Number(d.totalCost),
          quantityPurchased: Number(qty),
          purchaseUnit: unit ? String(unit) : "each",
        });
      }
    }

    const dishPlateCost = new Map<string, number>();
    const dishMenuPrice = new Map<string, number>();
    for (const dishDoc of dishesSnap.docs) {
      const dish = dishDoc.data();
      const dishId = dishDoc.id;
      const garnishBuffer = Number(dish.garnishBufferCost) || 0;
      let plateCost = garnishBuffer;
      const diList = dishIngredientsByDishId.get(dishId) ?? [];
      for (const di of diList) {
        const ingId = di.ingredientId;
        if (!ingId) continue;
        const cost = costMap.get(ingId);
        if (!cost) continue;
        const result = ingredientPortionCost(
          cost.totalCost,
          cost.quantityPurchased,
          cost.purchaseUnit,
          di.quantityRequired,
          di.unitRequired
        );
        if (result.compatible) plateCost += result.cost;
      }
      plateCost = Math.round(plateCost * 100) / 100;
      dishPlateCost.set(dishId, plateCost);
      const menuPrice = dish.currentMenuPrice != null ? Number(dish.currentMenuPrice) : null;
      if (menuPrice != null) dishMenuPrice.set(dishId, menuPrice);
    }

    const dishFoodCostPercent = new Map<string, number>();
    dishPlateCost.forEach((plateCost, dishId) => {
      const menuPrice = dishMenuPrice.get(dishId);
      if (menuPrice != null && menuPrice > 0) {
        const pct = actualFoodCostPercent(plateCost, menuPrice);
        if (pct != null) dishFoodCostPercent.set(dishId, pct);
      }
    });

    type IngredientStat = {
      ingredientId: string;
      canonicalName: string;
      dishCount: number;
      dishIds: string[];
      averageFoodCostPercent: number | null;
      inInvoices: boolean;
      totalPurchasedCost: number;
    };

    const stats: IngredientStat[] = [];
    ingredients.forEach((ing, ingId) => {
      const dishIds = Array.from(ingToDishIds.get(ingId) ?? []);
      const dishCount = dishIds.length;
      const percents = dishIds
        .map((d) => dishFoodCostPercent.get(d))
        .filter((p): p is number => p != null);
      const averageFoodCostPercent =
        percents.length > 0 ? Math.round((percents.reduce((a, b) => a + b, 0) / percents.length) * 100) / 100 : null;
      stats.push({
        ingredientId: ingId,
        canonicalName: ing.canonicalName,
        dishCount,
        dishIds,
        averageFoodCostPercent,
        inInvoices: ingInInvoices.has(ingId),
        totalPurchasedCost: ingToInvoiceTotal.get(ingId) ?? 0,
      });
    });

    const bestMargins = [...stats]
      .filter((s) => s.averageFoodCostPercent != null && s.dishCount > 0)
      .sort((a, b) => (a.averageFoodCostPercent ?? 0) - (b.averageFoodCostPercent ?? 0));

    const underutilized = stats.filter((s) => s.inInvoices && s.dishCount <= 1);

    const mostUsed = [...stats].sort((a, b) => b.dishCount - a.dishCount);
    const leastUsed = [...stats].sort((a, b) => a.dishCount - b.dishCount);

    return NextResponse.json({
      bestMargins,
      underutilized,
      mostUsed,
      leastUsed,
    });
  } catch (e) {
    console.error("Chefs-tab ingredients analytics GET:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
