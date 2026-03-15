import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import type { ProductMixData } from "@/lib/sophia-weekly/types";
import { isValidRestaurantId, DEFAULT_RESTAURANT_ID } from "@/lib/sophia-weekly/restaurants";

const MAX_WEEKS = 500;
const TOP_N = 10;

type TopKey = "topFoodItems" | "topCocktailItems" | "topWineItems" | "topBeerItems";
type LowestKey = "lowestFoodItems" | "lowestCocktailItems" | "lowestWineItems" | "lowestBeerItems";

function normalizeName(s: string): string {
  return s.trim().toLowerCase();
}

/** Aggregate item counts across weeks, return top N by count. */
function aggregateCategory(
  itemsByWeek: string[][]
): { name: string; count: number }[] {
  const counts = new Map<string, { name: string; count: number }>();
  for (const weekItems of itemsByWeek) {
    for (const item of weekItems) {
      const n = normalizeName(item);
      if (!n) continue;
      const display = item.trim();
      const existing = counts.get(n);
      if (existing) {
        existing.count += 1;
      } else {
        counts.set(n, { name: display, count: 1 });
      }
    }
  }
  return [...counts.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, TOP_N);
}

/**
 * GET /api/sophia-weekly/best-sellers?restaurantId=goldies
 * Returns overall best and lowest sellers for that restaurant (sent weekly reports only).
 */
export async function GET(request: NextRequest) {
  const restaurantId = request.nextUrl.searchParams.get("restaurantId") ?? DEFAULT_RESTAURANT_ID;
  if (!isValidRestaurantId(restaurantId)) {
    return NextResponse.json({ error: "Invalid restaurantId" }, { status: 400 });
  }

  try {
    const db = getAdminDb();
    const snap = await db
      .collection("goldiesWeeklyImports")
      .where("restaurantId", "==", restaurantId)
      .orderBy("updatedAt", "desc")
      .limit(MAX_WEEKS)
      .get();

    const topKeys: TopKey[] = [
      "topFoodItems",
      "topCocktailItems",
      "topWineItems",
      "topBeerItems",
    ];
    const lowestKeys: LowestKey[] = [
      "lowestFoodItems",
      "lowestCocktailItems",
      "lowestWineItems",
      "lowestBeerItems",
    ];
    const itemsByTop: Record<TopKey, string[][]> = {
      topFoodItems: [],
      topCocktailItems: [],
      topWineItems: [],
      topBeerItems: [],
    };
    const itemsByLowest: Record<LowestKey, string[][]> = {
      lowestFoodItems: [],
      lowestCocktailItems: [],
      lowestWineItems: [],
      lowestBeerItems: [],
    };

    let sentCount = 0;
    for (const doc of snap.docs) {
      const data = doc.data();
      if (!data.sent) continue;
      sentCount += 1;
      const mix = data.productMixData as ProductMixData | undefined;
      if (!mix) continue;
      for (const key of topKeys) {
        const arr = Array.isArray(mix[key]) ? (mix[key] as string[]) : [];
        if (arr.length) itemsByTop[key].push(arr);
      }
      for (const key of lowestKeys) {
        const arr = Array.isArray(mix[key]) ? (mix[key] as string[]) : [];
        if (arr.length) itemsByLowest[key].push(arr);
      }
    }

    return NextResponse.json({
      topFoodItems: aggregateCategory(itemsByTop.topFoodItems),
      topCocktailItems: aggregateCategory(itemsByTop.topCocktailItems),
      topWineItems: aggregateCategory(itemsByTop.topWineItems),
      topBeerItems: aggregateCategory(itemsByTop.topBeerItems),
      lowestFoodItems: aggregateCategory(itemsByLowest.lowestFoodItems),
      lowestCocktailItems: aggregateCategory(itemsByLowest.lowestCocktailItems),
      lowestWineItems: aggregateCategory(itemsByLowest.lowestWineItems),
      lowestBeerItems: aggregateCategory(itemsByLowest.lowestBeerItems),
      weeksCount: sentCount,
    });
  } catch (e) {
    console.error("Best sellers error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
