"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useChefsTab } from "../../ChefsTabContext";

const UNITS = ["each", "oz", "lb", "g", "kg", "ml", "l", "tsp", "tbsp", "cup", "pint", "quart", "gallon"];

export default function NewDishPage() {
  const router = useRouter();
  const { restaurantId } = useChefsTab();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Uncategorized");
  const [description, setDescription] = useState("");
  const [currentMenuPrice, setCurrentMenuPrice] = useState("");
  const [targetFoodCostPercent, setTargetFoodCostPercent] = useState("24");
  const [garnishBufferCost, setGarnishBufferCost] = useState("");
  const [notes, setNotes] = useState("");
  const [ingredients, setIngredients] = useState<Array<{ rawName: string; quantityRequired: string; unitRequired: string; prepYieldPercent: string }>>([
    { rawName: "", quantityRequired: "", unitRequired: "each", prepYieldPercent: "" },
  ]);

  const addIngredient = () => {
    setIngredients((prev) => [...prev, { rawName: "", quantityRequired: "", unitRequired: "each", prepYieldPercent: "" }]);
  };

  const updateIngredient = (index: number, field: string, value: string) => {
    setIngredients((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const removeIngredient = (index: number) => {
    if (ingredients.length <= 1) return;
    setIngredients((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nameTrim = name.trim();
    if (!nameTrim) {
      setMessage({ type: "err", text: "Dish name is required." });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/chefs-tab/dishes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId,
          name: nameTrim,
          category: category.trim() || "Uncategorized",
          description: description.trim() || null,
          currentMenuPrice: currentMenuPrice ? parseFloat(currentMenuPrice) : null,
          targetFoodCostPercent: parseFloat(targetFoodCostPercent) || 24,
          garnishBufferCost: garnishBufferCost ? parseFloat(garnishBufferCost) : null,
          notes: notes.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create dish");
      const dishId = data.id;

      for (let i = 0; i < ingredients.length; i++) {
        const ing = ingredients[i];
        const qty = parseFloat(ing.quantityRequired);
        if (!ing.rawName.trim()) continue;
        await fetch(`/api/chefs-tab/dishes/${dishId}/ingredients`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            restaurantId,
            rawName: ing.rawName.trim(),
            quantityRequired: Number.isFinite(qty) ? qty : 0,
            unitRequired: ing.unitRequired || "each",
            prepYieldPercent: ing.prepYieldPercent ? parseFloat(ing.prepYieldPercent) : null,
          }),
        });
      }

      setMessage({ type: "ok", text: "Dish created." });
      router.push(`/chefs-tab/dishes/${dishId}`);
    } catch (err) {
      setMessage({ type: "err", text: err instanceof Error ? err.message : "Error saving." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/chefs-tab/dishes" className="text-stone-500 hover:text-stone-700 text-sm font-medium">
          ← Dishes
        </Link>
        <h2 className="text-lg font-semibold text-stone-800">Create dish</h2>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-stone-200 shadow-sm p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Dish name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 outline-none"
            placeholder="e.g. Braised Short Rib"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Category</label>
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 outline-none"
            placeholder="e.g. Mains"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 outline-none resize-y"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Current menu price ($)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={currentMenuPrice}
              onChange={(e) => setCurrentMenuPrice(e.target.value)}
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Target food cost %</label>
            <input
              type="number"
              step="0.5"
              min="1"
              max="100"
              value={targetFoodCostPercent}
              onChange={(e) => setTargetFoodCostPercent(e.target.value)}
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 outline-none"
            />
            <p className="text-xs text-stone-500 mt-0.5">Default 24%</p>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Garnish / misc buffer ($)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={garnishBufferCost}
            onChange={(e) => setGarnishBufferCost(e.target.value)}
            className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={1}
            className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 outline-none resize-y"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-stone-700">Recipe ingredients</label>
            <button type="button" onClick={addIngredient} className="text-sm text-amber-600 hover:underline font-medium">
              + Add ingredient
            </button>
          </div>
          <div className="space-y-3">
            {ingredients.map((ing, i) => (
              <div key={i} className="flex flex-wrap items-end gap-2 p-3 bg-stone-50 rounded-lg">
                <div className="flex-1 min-w-[120px]">
                  <input
                    type="text"
                    value={ing.rawName}
                    onChange={(e) => updateIngredient(i, "rawName", e.target.value)}
                    placeholder="Ingredient name"
                    className="w-full border border-stone-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-amber-500/30 outline-none"
                  />
                </div>
                <div className="w-20">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={ing.quantityRequired}
                    onChange={(e) => updateIngredient(i, "quantityRequired", e.target.value)}
                    placeholder="Qty"
                    className="w-full border border-stone-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-amber-500/30 outline-none"
                  />
                </div>
                <div className="w-24">
                  <select
                    value={ing.unitRequired}
                    onChange={(e) => updateIngredient(i, "unitRequired", e.target.value)}
                    className="w-full border border-stone-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-amber-500/30 outline-none"
                  >
                    {UNITS.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
                <div className="w-16">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={ing.prepYieldPercent}
                    onChange={(e) => updateIngredient(i, "prepYieldPercent", e.target.value)}
                    placeholder="Yield %"
                    className="w-full border border-stone-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-amber-500/30 outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeIngredient(i)}
                  disabled={ingredients.length <= 1}
                  className="text-red-600 hover:underline text-sm disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>

        {message && (
          <p className={`text-sm ${message.type === "ok" ? "text-emerald-600" : "text-red-600"}`}>
            {message.text}
          </p>
        )}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save dish"}
          </button>
          <Link href="/chefs-tab/dishes" className="px-4 py-2 border border-stone-300 rounded-lg text-sm font-medium text-stone-700 hover:bg-stone-50">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
