import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { isValidRestaurantId, DEFAULT_RESTAURANT_ID } from "@/lib/sophia-weekly/restaurants";
import { COLLECTIONS } from "@/lib/chefs-tab/firestore";
import { ingredientPortionCost, costPerOz } from "@/lib/chefs-tab/units";
import {
  suggestedPrice,
  actualFoodCostPercent,
  grossProfit,
  scenarioPrices,
  costingStatus,
  costingStatusReason,
  type CostingStatus,
} from "@/lib/chefs-tab/costing";

type CostMapEntry = {
  totalCost: number;
  quantityPurchased: number;
  purchaseUnit: string;
};

/**
 * GET /api/chefs-tab/costing?restaurantId=
 * Returns all dishes with plate cost, suggested price, actual food cost %, status.
 */
export async function GET(request: NextRequest) {
  const restaurantId = request.nextUrl.searchParams.get("restaurantId") ?? DEFAULT_RESTAURANT_ID;
  if (!isValidRestaurantId(restaurantId)) {
    return NextResponse.json({ error: "Invalid restaurantId" }, { status: 400 });
  }
  try {
    const db = getAdminDb();

    const invoicesSnap = await db
      .collection(COLLECTIONS.invoices)
      .where("restaurantId", "==", restaurantId)
      .orderBy("updatedAt", "desc")
      .get();
    const costMap = new Map<string, CostMapEntry>();
    const provenanceMap = new Map<string, { vendorName: string; invoiceDate: string | null }>();
    for (const invDoc of invoicesSnap.docs) {
      const invData = invDoc.data();
      const vendorName = invData.vendorName ?? "";
      const invoiceDate = invData.invoiceDate ?? null;
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
        provenanceMap.set(ingId, { vendorName, invoiceDate });
      }
    }

    const dishesSnap = await db
      .collection(COLLECTIONS.dishes)
      .where("restaurantId", "==", restaurantId)
      .get();

    const results: Array<{
      dishId: string;
      dishName: string;
      category: string;
      plateCost: number;
      currentMenuPrice: number | null;
      targetFoodCostPercent: number;
      suggestedPriceAt24: number;
      actualFoodCostPercent: number | null;
      grossProfit: number | null;
      scenarioPrices: Record<number, number>;
      status: CostingStatus;
      statusReason: string;
      unmappedCount: number;
      needsReviewCount: number;
      costProvenance: Array<{ rawName: string; portionCost: number; vendorName: string; invoiceDate: string | null }>;
    }> = [];

    for (const dishDoc of dishesSnap.docs) {
      const dish = dishDoc.data();
      const dishId = dishDoc.id;
      const targetPct = Number(dish.targetFoodCostPercent) || 24;
      const garnishBuffer = Number(dish.garnishBufferCost) || 0;

      const ingSnap = await db
        .collection(COLLECTIONS.dishIngredients)
        .where("dishId", "==", dishId)
        .orderBy("sortOrder", "asc")
        .get();

      let plateCost = garnishBuffer;
      let unmappedCount = 0;
      let needsReviewCount = 0;
      const costProvenance: Array<{ rawName: string; portionCost: number; vendorName: string; invoiceDate: string | null }> = [];

      for (const di of ingSnap.docs) {
        const diData = di.data();
        const ingId = diData.ingredientId;
        const rawName = diData.rawName ?? "";
        const qty = Number(diData.quantityRequired) || 0;
        const unit = diData.unitRequired || "each";
        const quantityPerPlateOz = diData.quantityPerPlateOz != null ? Number(diData.quantityPerPlateOz) : null;
        if (!ingId) {
          unmappedCount++;
          continue;
        }
        const cost = costMap.get(ingId);
        if (!cost) {
          unmappedCount++;
          continue;
        }
        let portionCostResult: { cost: number; compatible: true } | { cost: null; compatible: false; reason: string };
        if (quantityPerPlateOz != null && quantityPerPlateOz > 0) {
          const perOz = costPerOz(cost.totalCost, cost.quantityPurchased, cost.purchaseUnit);
          if (perOz != null) {
            const costVal = Math.round(perOz * quantityPerPlateOz * 100) / 100;
            portionCostResult = { cost: costVal, compatible: true };
          } else {
            portionCostResult = ingredientPortionCost(
              cost.totalCost,
              cost.quantityPurchased,
              cost.purchaseUnit,
              qty,
              unit
            );
          }
        } else {
          portionCostResult = ingredientPortionCost(
            cost.totalCost,
            cost.quantityPurchased,
            cost.purchaseUnit,
            qty,
            unit
          );
        }
        if (portionCostResult.compatible) {
          plateCost += portionCostResult.cost;
          const prov = provenanceMap.get(ingId);
          if (prov) costProvenance.push({ rawName, portionCost: portionCostResult.cost, vendorName: prov.vendorName, invoiceDate: prov.invoiceDate });
        } else {
          needsReviewCount++;
        }
      }

      plateCost = Math.round(plateCost * 100) / 100;
      const menuPrice = dish.currentMenuPrice != null ? Number(dish.currentMenuPrice) : null;
      const suggested = suggestedPrice(plateCost, targetPct);
      const actualPct = menuPrice != null && menuPrice > 0 ? actualFoodCostPercent(plateCost, menuPrice) : null;
      const gp = menuPrice != null ? grossProfit(menuPrice, plateCost) : null;

      const status = costingStatus(plateCost, menuPrice, targetPct);
      results.push({
        dishId,
        dishName: dish.name,
        category: dish.category || "",
        plateCost,
        currentMenuPrice: menuPrice,
        targetFoodCostPercent: targetPct,
        suggestedPriceAt24: suggestedPrice(plateCost, 24),
        actualFoodCostPercent: actualPct,
        grossProfit: gp,
        scenarioPrices: scenarioPrices(plateCost),
        status,
        statusReason: costingStatusReason(status, plateCost, menuPrice, targetPct),
        unmappedCount,
        needsReviewCount,
        costProvenance,
      });
    }

    return NextResponse.json({ dishes: results });
  } catch (e) {
    console.error("Chefs-tab costing GET:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
