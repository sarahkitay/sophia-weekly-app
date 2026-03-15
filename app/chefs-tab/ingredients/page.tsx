"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useChefsTab } from "../ChefsTabContext";

interface Ingredient {
  id: string;
  canonicalName: string;
  normalizedName: string;
  defaultUnit?: string | null;
  aliases: string[];
  updatedAt: string;
}

export default function IngredientsPage() {
  const { restaurantId } = useChefsTab();
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      try {
        const res = await fetch(`/api/chefs-tab/ingredients?restaurantId=${encodeURIComponent(restaurantId)}`);
        const data = await res.json();
        if (cancelled) return;
        if (data.error) throw new Error(data.error);
        setIngredients(data.ingredients ?? []);
      } catch {
        if (!cancelled) setIngredients([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => { cancelled = true; };
  }, [restaurantId]);

  const filtered = search.trim()
    ? ingredients.filter(
        (i) =>
          i.canonicalName.toLowerCase().includes(search.toLowerCase()) ||
          (i.aliases ?? []).some((a) => a.toLowerCase().includes(search.toLowerCase()))
      )
    : ingredients;

  if (loading && !ingredients.length) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-stone-500 text-sm">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-stone-800">Ingredients</h2>
      <p className="text-sm text-stone-500">
        Canonical ingredient list. Add aliases to improve invoice line matching. Ingredients are created when you map invoice items or add them from the Invoices page.
      </p>

      <div className="flex gap-4">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search ingredients..."
          className="flex-1 max-w-xs border border-stone-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 outline-none"
        />
      </div>

      <div className="bg-white rounded-lg border border-stone-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-stone-50 border-b border-stone-200">
              <th className="text-left px-4 py-3 font-medium text-stone-700">Canonical name</th>
              <th className="text-left px-4 py-3 font-medium text-stone-700">Default unit</th>
              <th className="text-left px-4 py-3 font-medium text-stone-700">Aliases</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-stone-500">
                  {ingredients.length === 0
                    ? "No ingredients yet. Upload an invoice and map line items to create ingredients."
                    : "No ingredients match your search."}
                </td>
              </tr>
            ) : (
              filtered.map((ing) => (
                <tr key={ing.id} className="border-b border-stone-100 hover:bg-stone-50/50">
                  <td className="px-4 py-3 font-medium text-stone-800">{ing.canonicalName}</td>
                  <td className="px-4 py-3 text-stone-600">{ing.defaultUnit ?? "-"}</td>
                  <td className="px-4 py-3 text-stone-600">
                    {(ing.aliases ?? []).length ? ing.aliases.join(", ") : "-"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
