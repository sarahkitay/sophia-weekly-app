"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useChefsTab } from "../../ChefsTabContext";
import { toOz } from "@/lib/chefs-tab/units";

interface DishData {
  dish: {
    id: string;
    name: string;
    category: string;
    description?: string;
    currentMenuPrice?: number | null;
    targetFoodCostPercent: number;
    garnishBufferCost?: number | null;
    notes?: string;
  };
  ingredients: Array<{
    id: string;
    rawName: string;
    quantityRequired: number;
    unitRequired: string;
    quantityPerPlateOz?: number | null;
    prepYieldPercent?: number | null;
    ingredientId?: string | null;
  }>;
}

interface CostProvenance {
  rawName: string;
  portionCost: number;
  vendorName: string;
  invoiceDate: string | null;
}

interface CostingRow {
  dishId: string;
  plateCost: number;
  currentMenuPrice: number | null;
  suggestedPriceAt24: number;
  actualFoodCostPercent: number | null;
  scenarioPrices: Record<number, number>;
  status: string;
  statusReason?: string;
  costProvenance?: CostProvenance[];
}

export default function DishDetailPage() {
  const params = useParams();
  const { restaurantId } = useChefsTab();
  const id = params.id as string;
  const [data, setData] = useState<DishData | null>(null);
  const [costing, setCosting] = useState<CostingRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [applyingPrice, setApplyingPrice] = useState(false);
  const [editingOzIngId, setEditingOzIngId] = useState<string | null>(null);
  const [ozOverrideValue, setOzOverrideValue] = useState("");
  const [savingOz, setSavingOz] = useState(false);

  const refetch = () => {
    if (!id) return;
    Promise.all([
      fetch(`/api/chefs-tab/dishes/${id}?restaurantId=${encodeURIComponent(restaurantId)}`),
      fetch(`/api/chefs-tab/costing?restaurantId=${encodeURIComponent(restaurantId)}`),
    ]).then(([rD, rC]) => Promise.all([rD.json(), rC.json()])).then(([dishData, costData]) => {
      if (dishData.error) return;
      setData(dishData);
      const match = (costData.dishes ?? []).find((d: { dishId: string }) => d.dishId === id);
      setCosting(match ?? null);
    });
  };

  const handleApplySuggestedPrice = async () => {
    if (!costing) return;
    setApplyingPrice(true);
    try {
      const res = await fetch(`/api/chefs-tab/dishes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId, currentMenuPrice: costing.suggestedPriceAt24 }),
      });
      if (res.ok) refetch();
    } finally {
      setApplyingPrice(false);
    }
  };

  const handleSaveOzOverride = async (ingId: string) => {
    const val = ozOverrideValue.trim() === "" ? null : parseFloat(ozOverrideValue);
    setSavingOz(true);
    try {
      await fetch(`/api/chefs-tab/dishes/${id}/ingredients/${ingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId, quantityPerPlateOz: val != null && Number.isFinite(val) ? val : null }),
      });
      setEditingOzIngId(null);
      setOzOverrideValue("");
      refetch();
    } finally {
      setSavingOz(false);
    }
  };

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    async function run() {
      setLoading(true);
      try {
        const [resDish, resCosting] = await Promise.all([
          fetch(`/api/chefs-tab/dishes/${id}?restaurantId=${encodeURIComponent(restaurantId)}`),
          fetch(`/api/chefs-tab/costing?restaurantId=${encodeURIComponent(restaurantId)}`),
        ]);
        if (cancelled) return;
        const dishData = await resDish.json();
        const costData = await resCosting.json();
        if (dishData.error) throw new Error(dishData.error);
        setData(dishData);
        const match = (costData.dishes ?? []).find((d: { dishId: string }) => d.dishId === id);
        setCosting(match ?? null);
      } catch {
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => { cancelled = true; };
  }, [id, restaurantId]);

  const statusBadge = (status: string) => {
    const classes: Record<string, string> = {
      on_target: "bg-emerald-100 text-emerald-800",
      slightly_off: "bg-amber-100 text-amber-800",
      underpriced: "bg-red-100 text-red-800",
      missing: "bg-stone-100 text-stone-600",
      partial: "bg-amber-100 text-amber-800",
    };
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${classes[status] ?? "bg-stone-100"}`}>
        {status.replace("_", " ")}
      </span>
    );
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-stone-500 text-sm">Loading...</p>
      </div>
    );
  }
  if (!data?.dish) {
    return (
      <div className="py-12">
        <p className="text-stone-500">Dish not found.</p>
        <Link href="/chefs-tab/dishes" className="text-amber-600 hover:underline mt-2 inline-block">
          Back to dishes
        </Link>
      </div>
    );
  }

  const dish = data.dish;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-4 flex-wrap">
        <Link href="/chefs-tab/dishes" className="text-stone-500 hover:text-stone-700 text-sm font-medium">
          ← Dishes
        </Link>
        <h2 className="text-lg font-semibold text-stone-800">{dish.name}</h2>
        {costing && (
          <div className="flex flex-col gap-0.5">
            {statusBadge(costing.status)}
            {costing.status !== "on_target" && costing.statusReason && (
              <p className="text-xs text-stone-500 max-w-sm">{costing.statusReason}</p>
            )}
          </div>
        )}
        <Link
          href={`/chefs-tab/dishes/${id}/edit`}
          className="ml-auto px-3 py-1.5 bg-stone-200 text-stone-800 rounded text-sm font-medium hover:bg-stone-300"
        >
          Edit dish
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-stone-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-stone-800 mb-3">Details</h3>
          <dl className="space-y-1 text-sm">
            <dt className="text-stone-500">Category</dt>
            <dd className="text-stone-800">{dish.category || "-"}</dd>
            {dish.description && (
              <>
                <dt className="text-stone-500 mt-2">Description</dt>
                <dd className="text-stone-800">{dish.description}</dd>
              </>
            )}
            <dt className="text-stone-500 mt-2">Current menu price</dt>
            <dd className="text-stone-800">
              {dish.currentMenuPrice != null ? `$${Number(dish.currentMenuPrice).toFixed(2)}` : "-"}
            </dd>
            <dt className="text-stone-500">Target food cost %</dt>
            <dd className="text-stone-800">{dish.targetFoodCostPercent}%</dd>
            {dish.garnishBufferCost != null && dish.garnishBufferCost > 0 && (
              <>
                <dt className="text-stone-500">Garnish / buffer</dt>
                <dd className="text-stone-800">${Number(dish.garnishBufferCost).toFixed(2)}</dd>
              </>
            )}
          </dl>
        </div>

        <div className="bg-white rounded-lg border border-stone-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-stone-800 mb-3">Costing</h3>
          <dl className="space-y-1 text-sm">
            <dt className="text-stone-500">Plate cost</dt>
            <dd className="text-stone-800 font-medium">
              {costing ? `$${costing.plateCost.toFixed(2)}` : "-"}
            </dd>
            <dt className="text-stone-500 mt-2">Suggested price @ 24%</dt>
            <dd className="text-stone-800 flex items-center gap-2 flex-wrap">
              {costing ? `$${costing.suggestedPriceAt24.toFixed(2)}` : "-"}
              {costing && (
                <button
                  type="button"
                  onClick={handleApplySuggestedPrice}
                  disabled={applyingPrice}
                  className="px-2 py-1 bg-amber-600 text-white rounded text-xs font-medium hover:bg-amber-700 disabled:opacity-50"
                >
                  {applyingPrice ? "Applying..." : "Use as menu price"}
                </button>
              )}
            </dd>
            {costing?.actualFoodCostPercent != null && (
              <>
                <dt className="text-stone-500 mt-2">Actual food cost %</dt>
                <dd className="text-stone-800">{costing.actualFoodCostPercent.toFixed(1)}%</dd>
              </>
            )}
          </dl>
          {costing?.scenarioPrices && (
            <div className="mt-3 pt-3 border-t border-stone-100">
              <p className="text-xs font-medium text-stone-500 mb-2">Scenario pricing</p>
              <ul className="text-sm text-stone-700 space-y-0.5">
                {[22, 24, 26, 28].map((pct) => (
                  <li key={pct}>
                    {pct}%: ${(costing.scenarioPrices[pct] ?? 0).toFixed(2)}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {costing?.costProvenance && costing.costProvenance.length > 0 && (
            <div className="mt-3 pt-3 border-t border-stone-100">
              <p className="text-xs font-medium text-stone-500 mb-2">Cost source (latest cost, vendor, invoice date)</p>
              <ul className="text-xs text-stone-600 space-y-1">
                {costing.costProvenance.map((p, i) => (
                  <li key={i}>
                    <strong>{p.rawName}</strong>: ${p.portionCost.toFixed(2)} - {p.vendorName}
                    {p.invoiceDate ? `, ${p.invoiceDate}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg border border-stone-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-100">
          <h3 className="text-sm font-semibold text-stone-800">Recipe ingredients</h3>
          <p className="text-xs text-stone-500 mt-0.5">
            Map invoice line items to these ingredients on the Invoices page to calculate plate cost.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200">
                <th className="text-left px-4 py-2 font-medium text-stone-700">Ingredient</th>
                <th className="text-right px-4 py-2 font-medium text-stone-700">Quantity</th>
                <th className="text-left px-4 py-2 font-medium text-stone-700">Unit</th>
                <th className="text-left px-4 py-2 font-medium text-stone-700">Amount per plate (oz)</th>
                <th className="text-left px-4 py-2 font-medium text-stone-700">Mapped</th>
              </tr>
            </thead>
            <tbody>
              {data.ingredients.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-4 text-stone-500 text-center">
                    No ingredients. Edit dish to add recipe ingredients.
                  </td>
                </tr>
              ) : (
                data.ingredients.map((ing) => {
                  const ozEquivalent = toOz(ing.quantityRequired, ing.unitRequired);
                  const canUseOz = ozEquivalent !== null;
                  const displayOz = ing.quantityPerPlateOz != null ? ing.quantityPerPlateOz : (ozEquivalent ?? undefined);
                  const isEditing = editingOzIngId === ing.id;
                  return (
                    <tr key={ing.id} className="border-b border-stone-100">
                      <td className="px-4 py-2 text-stone-800">{ing.rawName}</td>
                      <td className="px-4 py-2 text-right text-stone-700">{ing.quantityRequired}</td>
                      <td className="px-4 py-2 text-stone-700">{ing.unitRequired}</td>
                      <td className="px-4 py-2">
                        {canUseOz ? (
                          isEditing ? (
                            <div className="flex items-center gap-1 flex-wrap">
                              <input
                                type="number"
                                step="0.1"
                                min="0"
                                value={ozOverrideValue}
                                onChange={(e) => setOzOverrideValue(e.target.value)}
                                placeholder={displayOz != null ? String(displayOz) : "oz"}
                                className="w-16 border border-stone-300 rounded px-1.5 py-0.5 text-sm"
                              />
                              <span className="text-stone-500 text-xs">oz</span>
                              <button type="button" onClick={() => handleSaveOzOverride(ing.id)} disabled={savingOz} className="text-amber-600 text-xs font-medium hover:underline disabled:opacity-50">Save</button>
                              <button type="button" onClick={() => { setEditingOzIngId(null); setOzOverrideValue(""); }} className="text-stone-500 text-xs hover:underline">Cancel</button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <span className="text-stone-700">
                                {displayOz != null ? `${displayOz} oz` : "-"}
                                {ing.quantityPerPlateOz != null && <span className="text-amber-600 text-xs ml-0.5">(override)</span>}
                              </span>
                              <button type="button" onClick={() => { setEditingOzIngId(ing.id); setOzOverrideValue(ing.quantityPerPlateOz != null ? String(ing.quantityPerPlateOz) : (ozEquivalent != null ? String(ozEquivalent) : "")); }} className="text-amber-600 text-xs font-medium hover:underline">Edit</button>
                            </div>
                          )
                        ) : (
                          <span className="text-stone-400 text-xs">N/A (not weight)</span>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        {ing.ingredientId ? (
                          <span className="text-emerald-600 text-xs font-medium">Mapped</span>
                        ) : (
                          <span className="text-amber-600 text-xs">Needs mapping</span>
                        )}
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
        Suggested menu price is based on your target food cost percentage. Unit mismatch detected - manual review recommended for any line that does not convert.
      </p>
    </div>
  );
}
