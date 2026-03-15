"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useChefsTab } from "../ChefsTabContext";

interface Dish {
  id: string;
  name: string;
  category: string;
  currentMenuPrice?: number | null;
  targetFoodCostPercent: number;
  updatedAt: string;
}

export default function DishesListPage() {
  const { restaurantId } = useChefsTab();
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [costing, setCosting] = useState<Record<string, { plateCost: number; suggestedPriceAt24: number; actualFoodCostPercent?: number | null; status: string }>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      try {
        const [resDishes, resCosting] = await Promise.all([
          fetch(`/api/chefs-tab/dishes?restaurantId=${encodeURIComponent(restaurantId)}`),
          fetch(`/api/chefs-tab/costing?restaurantId=${encodeURIComponent(restaurantId)}`),
        ]);
        if (cancelled) return;
        const d = await resDishes.json();
        const c = await resCosting.json();
        if (d.error) throw new Error(d.error);
        setDishes(d.dishes ?? []);
        const map: Record<string, { plateCost: number; suggestedPriceAt24: number; actualFoodCostPercent?: number | null; status: string }> = {};
        (c.dishes ?? []).forEach((x: { dishId: string; plateCost: number; suggestedPriceAt24: number; actualFoodCostPercent?: number | null; status: string }) => {
          map[x.dishId] = {
            plateCost: x.plateCost,
            suggestedPriceAt24: x.suggestedPriceAt24,
            actualFoodCostPercent: x.actualFoodCostPercent,
            status: x.status,
          };
        });
        setCosting(map);
      } catch {
        if (!cancelled) setDishes([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => { cancelled = true; };
  }, [restaurantId]);

  const statusBadge = (status: string) => {
    const classes: Record<string, string> = {
      on_target: "bg-emerald-100 text-emerald-800",
      slightly_off: "bg-amber-100 text-amber-800",
      underpriced: "bg-red-100 text-red-800",
      missing: "bg-stone-100 text-stone-600",
      partial: "bg-amber-100 text-amber-800",
    };
    return (
      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${classes[status] ?? "bg-stone-100 text-stone-600"}`}>
        {status.replace("_", " ")}
      </span>
    );
  };

  if (loading && !dishes.length) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-stone-500 text-sm">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 className="text-lg font-semibold text-stone-800">Dishes</h2>
        <Link
          href="/chefs-tab/dishes/new"
          className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors"
        >
          Create dish
        </Link>
      </div>

      <div className="bg-white rounded-lg border border-stone-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200">
                <th className="text-left px-4 py-3 font-medium text-stone-700">Dish</th>
                <th className="text-left px-4 py-3 font-medium text-stone-700">Category</th>
                <th className="text-right px-4 py-3 font-medium text-stone-700">Plate cost</th>
                <th className="text-right px-4 py-3 font-medium text-stone-700">Menu price</th>
                <th className="text-right px-4 py-3 font-medium text-stone-700">Food cost %</th>
                <th className="text-right px-4 py-3 font-medium text-stone-700">Suggested @ 24%</th>
                <th className="text-left px-4 py-3 font-medium text-stone-700">Status</th>
                <th className="text-left px-4 py-3 font-medium text-stone-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {dishes.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-stone-500">
                    No dishes yet. Create a dish to get started.
                  </td>
                </tr>
              ) : (
                dishes.map((dish) => {
                  const cost = costing[dish.id];
                  return (
                    <tr key={dish.id} className="border-b border-stone-100 hover:bg-stone-50/50">
                      <td className="px-4 py-3 font-medium text-stone-800">{dish.name}</td>
                      <td className="px-4 py-3 text-stone-600">{dish.category || "-"}</td>
                      <td className="px-4 py-3 text-right text-stone-700">
                        {cost ? `$${cost.plateCost.toFixed(2)}` : "-"}
                      </td>
                      <td className="px-4 py-3 text-right text-stone-700">
                        {dish.currentMenuPrice != null ? `$${Number(dish.currentMenuPrice).toFixed(2)}` : "-"}
                      </td>
                      <td className="px-4 py-3 text-right text-stone-700">
                        {cost?.actualFoodCostPercent != null ? `${cost.actualFoodCostPercent.toFixed(1)}%` : "-"}
                      </td>
                      <td className="px-4 py-3 text-right text-stone-700">
                        {cost ? `$${cost.suggestedPriceAt24.toFixed(2)}` : "-"}
                      </td>
                      <td className="px-4 py-3">{cost ? statusBadge(cost.status) : "-"}</td>
                      <td className="px-4 py-3">
                        <Link href={`/chefs-tab/dishes/${dish.id}`} className="text-amber-600 hover:underline font-medium">
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
