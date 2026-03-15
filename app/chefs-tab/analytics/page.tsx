"use client";

import { useEffect, useState } from "react";
import { useChefsTab } from "../ChefsTabContext";

interface IngredientStat {
  ingredientId: string;
  canonicalName: string;
  dishCount: number;
  dishIds: string[];
  averageFoodCostPercent: number | null;
  inInvoices: boolean;
  totalPurchasedCost: number;
}

export default function AnalyticsPage() {
  const { restaurantId } = useChefsTab();
  const [bestMargins, setBestMargins] = useState<IngredientStat[]>([]);
  const [underutilized, setUnderutilized] = useState<IngredientStat[]>([]);
  const [mostUsed, setMostUsed] = useState<IngredientStat[]>([]);
  const [leastUsed, setLeastUsed] = useState<IngredientStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/chefs-tab/ingredients/analytics?restaurantId=${encodeURIComponent(restaurantId)}`
        );
        const data = await res.json();
        if (cancelled) return;
        if (data.error) throw new Error(data.error);
        setBestMargins(data.bestMargins ?? []);
        setUnderutilized(data.underutilized ?? []);
        setMostUsed(data.mostUsed ?? []);
        setLeastUsed(data.leastUsed ?? []);
      } catch {
        if (!cancelled) {
          setBestMargins([]);
          setUnderutilized([]);
          setMostUsed([]);
          setLeastUsed([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => { cancelled = true; };
  }, [restaurantId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-stone-500 text-sm">Loading analytics...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-stone-800">Ingredient analytics</h2>
        <p className="text-sm text-stone-500 mt-1">
          Best margins = ingredients used in dishes with the lowest food cost %. Underutilized = bought on invoices but used in 0–1 dishes. Most/least used = by number of recipes (dishes) using each ingredient. Annual usage is based on recipe count; connect sales data later for true annual volume.
        </p>
      </div>

      <section className="bg-white rounded-lg border border-stone-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-100">
          <h3 className="text-sm font-semibold text-stone-800">Best margins</h3>
          <p className="text-xs text-stone-500 mt-0.5">
            Ingredients in dishes with the lowest food cost % (best profit potential)
          </p>
        </div>
        <div className="overflow-x-auto">
          {bestMargins.length === 0 ? (
            <p className="p-5 text-sm text-stone-500">
              No data yet. Add dishes with menu prices and map invoice ingredients to see margins.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200">
                  <th className="text-left px-4 py-3 font-medium text-stone-700">Ingredient</th>
                  <th className="text-right px-4 py-3 font-medium text-stone-700">Avg food cost %</th>
                  <th className="text-right px-4 py-3 font-medium text-stone-700">Used in dishes</th>
                  <th className="text-right px-4 py-3 font-medium text-stone-700">Purchased ($)</th>
                </tr>
              </thead>
              <tbody>
                {bestMargins.slice(0, 15).map((s) => (
                  <tr key={s.ingredientId} className="border-b border-stone-100 hover:bg-stone-50/50">
                    <td className="px-4 py-3 font-medium text-stone-800">{s.canonicalName}</td>
                    <td className="px-4 py-3 text-right text-emerald-700 font-medium">
                      {(s.averageFoodCostPercent ?? 0).toFixed(1)}%
                    </td>
                    <td className="px-4 py-3 text-right text-stone-700">{s.dishCount}</td>
                    <td className="px-4 py-3 text-right text-stone-700">
                      {s.totalPurchasedCost > 0 ? `$${s.totalPurchasedCost.toFixed(2)}` : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="bg-white rounded-lg border border-stone-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-100">
          <h3 className="text-sm font-semibold text-stone-800">Not used all the way</h3>
          <p className="text-xs text-stone-500 mt-0.5">
            Bought on invoices but used in 0–1 recipes - consider reducing order size or adding more dishes that use them
          </p>
        </div>
        <div className="overflow-x-auto">
          {underutilized.length === 0 ? (
            <p className="p-5 text-sm text-stone-500">
              None. Every invoiced ingredient is used in at least 2 dishes, or you have no mapped invoice lines yet.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200">
                  <th className="text-left px-4 py-3 font-medium text-stone-700">Ingredient</th>
                  <th className="text-right px-4 py-3 font-medium text-stone-700">Used in dishes</th>
                  <th className="text-right px-4 py-3 font-medium text-stone-700">Purchased ($)</th>
                </tr>
              </thead>
              <tbody>
                {underutilized.map((s) => (
                  <tr key={s.ingredientId} className="border-b border-stone-100 hover:bg-stone-50/50">
                    <td className="px-4 py-3 font-medium text-stone-800">{s.canonicalName}</td>
                    <td className="px-4 py-3 text-right text-amber-700">{s.dishCount}</td>
                    <td className="px-4 py-3 text-right text-stone-700">
                      ${s.totalPurchasedCost.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white rounded-lg border border-stone-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-stone-100">
            <h3 className="text-sm font-semibold text-stone-800">Most used (by recipe count)</h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Ingredients used in the most dishes - high recipe coverage
            </p>
          </div>
          <div className="overflow-x-auto">
            {mostUsed.length === 0 ? (
              <p className="p-5 text-sm text-stone-500">No ingredients in recipes yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-200">
                    <th className="text-left px-4 py-3 font-medium text-stone-700">Ingredient</th>
                    <th className="text-right px-4 py-3 font-medium text-stone-700">Dishes</th>
                  </tr>
                </thead>
                <tbody>
                  {mostUsed.slice(0, 10).map((s) => (
                    <tr key={s.ingredientId} className="border-b border-stone-100 hover:bg-stone-50/50">
                      <td className="px-4 py-3 font-medium text-stone-800">{s.canonicalName}</td>
                      <td className="px-4 py-3 text-right text-stone-700">{s.dishCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <section className="bg-white rounded-lg border border-stone-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-stone-100">
            <h3 className="text-sm font-semibold text-stone-800">Least used (by recipe count)</h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Ingredients used in the fewest dishes - narrow use
            </p>
          </div>
          <div className="overflow-x-auto">
            {leastUsed.length === 0 ? (
              <p className="p-5 text-sm text-stone-500">No ingredients in recipes yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-200">
                    <th className="text-left px-4 py-3 font-medium text-stone-700">Ingredient</th>
                    <th className="text-right px-4 py-3 font-medium text-stone-700">Dishes</th>
                  </tr>
                </thead>
                <tbody>
                  {leastUsed
                    .filter((s) => s.dishCount > 0)
                    .slice(-10)
                    .reverse()
                    .map((s) => (
                      <tr key={s.ingredientId} className="border-b border-stone-100 hover:bg-stone-50/50">
                        <td className="px-4 py-3 font-medium text-stone-800">{s.canonicalName}</td>
                        <td className="px-4 py-3 text-right text-stone-700">{s.dishCount}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
            {leastUsed.some((s) => s.dishCount === 0) && (
              <p className="px-4 py-2 text-xs text-stone-500 border-t border-stone-100">
                Some ingredients appear in 0 recipes (invoices only); not shown above.
              </p>
            )}
          </div>
        </section>
      </div>

      <p className="text-xs text-stone-500">
        <strong>Note:</strong> &quot;Used most/least&quot; is by number of recipes (dishes) that include the ingredient. For true annual usage (volume or $), connect dish sales or production counts later.
      </p>
    </div>
  );
}
