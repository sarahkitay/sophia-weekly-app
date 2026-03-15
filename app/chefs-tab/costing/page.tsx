"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useChefsTab } from "../ChefsTabContext";

interface CostProvenance {
  rawName: string;
  portionCost: number;
  vendorName: string;
  invoiceDate: string | null;
}

interface CostingRow {
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
  status: string;
  statusReason: string;
  unmappedCount: number;
  needsReviewCount: number;
  costProvenance?: CostProvenance[];
}

export default function CostingPage() {
  const { restaurantId } = useChefsTab();
  const [dishes, setDishes] = useState<CostingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [applyingId, setApplyingId] = useState<string | null>(null);

  const refetch = () => {
    fetch(`/api/chefs-tab/costing?restaurantId=${encodeURIComponent(restaurantId)}`)
      .then((r) => r.json())
      .then((data) => { if (!data.error) setDishes(data.dishes ?? []); });
  };

  const applySuggestedPrice = async (dishId: string) => {
    setApplyingId(dishId);
    try {
      const res = await fetch(`/api/chefs-tab/dishes/${dishId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId, currentMenuPrice: dishes.find((d) => d.dishId === dishId)?.suggestedPriceAt24 }),
      });
      if (res.ok) refetch();
    } finally {
      setApplyingId(null);
    }
  };

  const applyAllSuggestedPrices = async () => {
    setApplyingId("all");
    try {
      for (const d of dishes) {
        await fetch(`/api/chefs-tab/dishes/${d.dishId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ restaurantId, currentMenuPrice: d.suggestedPriceAt24 }),
        });
      }
      refetch();
    } finally {
      setApplyingId(null);
    }
  };

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      try {
        const res = await fetch(`/api/chefs-tab/costing?restaurantId=${encodeURIComponent(restaurantId)}`);
        const data = await res.json();
        if (cancelled) return;
        if (data.error) throw new Error(data.error);
        setDishes(data.dishes ?? []);
      } catch {
        if (!cancelled) setDishes([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => { cancelled = true; };
  }, [restaurantId]);

  const statusCell = (d: CostingRow) => {
    const status = d.status;
    const classes: Record<string, string> = {
      on_target: "bg-emerald-100 text-emerald-800",
      slightly_off: "bg-amber-100 text-amber-800",
      underpriced: "bg-red-100 text-red-800",
      missing: "bg-stone-100 text-stone-600",
      partial: "bg-amber-100 text-amber-800",
    };
    return (
      <div className="flex flex-col gap-0.5">
        <span
          title={d.statusReason}
          className={`inline-flex w-fit px-1.5 py-0.5 rounded text-xs font-medium ${classes[status] ?? "bg-stone-100"}`}
        >
          {status.replace("_", " ")}
        </span>
        {status !== "on_target" && d.statusReason && (
          <p className="text-xs text-stone-500 max-w-[200px] leading-tight" title={d.statusReason}>
            {d.statusReason}
          </p>
        )}
      </div>
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
      <h2 className="text-lg font-semibold text-stone-800">Costing / Pricing</h2>
      <p className="text-sm text-stone-500">
        Profitability by dish. Suggested menu price is based on your target food cost percentage (default 24%). Each status badge shows why a dish is flagged - read the line under the badge for the reason.
      </p>
      <details className="text-sm text-stone-600 bg-stone-50 rounded-lg px-4 py-2 border border-stone-100">
        <summary className="cursor-pointer font-medium">How we flag dishes</summary>
        <ul className="mt-2 list-disc list-inside space-y-1 text-stone-500">
          <li><strong>On target</strong> - Food cost within 1% of your target.</li>
          <li><strong>Slightly off</strong> - Within 5%; consider a small price tweak.</li>
          <li><strong>Underpriced</strong> - Food cost &gt;5% above target; raise price or reduce cost.</li>
          <li><strong>Partial</strong> - No menu price set; add one to see actual food cost %.</li>
          <li><strong>Missing</strong> - Plate cost is $0; map recipe ingredients to invoice lines.</li>
        </ul>
      </details>

      {dishes.length > 0 && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={applyAllSuggestedPrices}
            disabled={applyingId !== null}
            className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
          >
            {applyingId === "all" ? "Applying..." : "Apply 24% suggested price to all dishes"}
          </button>
          <span className="text-xs text-stone-500">Sets each dish&apos;s menu price to the suggested price at 24% food cost.</span>
        </div>
      )}

      <div className="bg-white rounded-lg border border-stone-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200">
                <th className="text-left px-4 py-3 font-medium text-stone-700">Dish</th>
                <th className="text-left px-4 py-3 font-medium text-stone-700">Category</th>
                <th className="text-right px-4 py-3 font-medium text-stone-700">Plate cost</th>
                <th className="text-right px-4 py-3 font-medium text-stone-700">Menu price</th>
                <th className="text-right px-4 py-3 font-medium text-stone-700">Actual food cost %</th>
                <th className="text-right px-4 py-3 font-medium text-stone-700">Suggested @ 24%</th>
                <th className="text-right px-4 py-3 font-medium text-stone-700">Price delta</th>
                <th className="text-right px-4 py-3 font-medium text-stone-700">Gross profit</th>
                <th className="text-left px-4 py-3 font-medium text-stone-700">Status</th>
                <th className="text-left px-4 py-3 font-medium text-stone-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {dishes.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-stone-500">
                    No dishes. Create dishes and map invoice ingredients to see costing.
                  </td>
                </tr>
              ) : (
                dishes.map((d) => {
                  const delta =
                    d.currentMenuPrice != null && d.suggestedPriceAt24
                      ? d.currentMenuPrice - d.suggestedPriceAt24
                      : null;
                  return (
                    <tr key={d.dishId} className="border-b border-stone-100 hover:bg-stone-50/50">
                      <td className="px-4 py-3 font-medium text-stone-800">{d.dishName}</td>
                      <td className="px-4 py-3 text-stone-600">{d.category || "-"}</td>
                      <td className="px-4 py-3 text-right text-stone-700">
                        ${d.plateCost.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right text-stone-700">
                        {d.currentMenuPrice != null ? `$${d.currentMenuPrice.toFixed(2)}` : "-"}
                      </td>
                      <td className="px-4 py-3 text-right text-stone-700">
                        {d.actualFoodCostPercent != null ? `${d.actualFoodCostPercent.toFixed(1)}%` : "-"}
                      </td>
                      <td className="px-4 py-3 text-right text-stone-700 font-medium">
                        ${d.suggestedPriceAt24.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {delta != null ? (
                          <span className={delta < 0 ? "text-red-600" : "text-stone-700"}>
                            {delta >= 0 ? "+" : ""}${delta.toFixed(2)}
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-stone-700">
                        {d.grossProfit != null ? `$${d.grossProfit.toFixed(2)}` : "-"}
                      </td>
                      <td className="px-4 py-3">{statusCell(d)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <Link
                            href={`/chefs-tab/dishes/${d.dishId}`}
                            className="text-amber-600 hover:underline font-medium"
                          >
                            View
                          </Link>
                          {d.plateCost > 0 && (
                            <button
                              type="button"
                              onClick={() => applySuggestedPrice(d.dishId)}
                              disabled={applyingId !== null}
                              className="text-left text-amber-600 hover:underline text-sm font-medium disabled:opacity-50"
                            >
                              {applyingId === d.dishId ? "Applying..." : "Use 24% price"}
                            </button>
                          )}
                          {d.costProvenance && d.costProvenance.length > 0 && (
                            <details className="text-xs text-stone-500">
                              <summary className="cursor-pointer hover:text-stone-700">Cost source</summary>
                              <ul className="mt-1 space-y-0.5 list-none">
                                {d.costProvenance.slice(0, 3).map((p, i) => (
                                  <li key={i}>
                                    {p.rawName}: ${p.portionCost.toFixed(2)} - {p.vendorName}
                                    {p.invoiceDate ? `, ${p.invoiceDate}` : ""}
                                  </li>
                                ))}
                                {d.costProvenance.length > 3 && (
                                  <li>+{d.costProvenance.length - 3} more</li>
                                )}
                              </ul>
                            </details>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-stone-500">
        Green: on target. Yellow: slightly off. Red: underpriced or missing costing. Price delta = current menu price − suggested price @ 24%.
      </p>
    </div>
  );
}
