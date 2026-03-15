"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useChefsTab } from "../../ChefsTabContext";

interface LineItem {
  id: string;
  rawItemName: string;
  normalizedItemName: string;
  quantityPurchased?: number | null;
  purchaseUnit?: string | null;
  totalCost: number;
  unitCost?: number | null;
  isMapped: boolean;
  ingredientId?: string | null;
  matchConfidence?: number | null;
}

interface Invoice {
  id: string;
  vendorName: string;
  invoiceDate?: string | null;
  invoiceNumber?: string | null;
  parseStatus: string;
}

interface Ingredient {
  id: string;
  canonicalName: string;
}

export default function InvoiceDetailPage() {
  const params = useParams();
  const { restaurantId } = useChefsTab();
  const id = params.id as string;
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapping, setMapping] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    async function run() {
      setLoading(true);
      try {
        const [resInv, resIng] = await Promise.all([
          fetch(`/api/chefs-tab/invoices/${id}?restaurantId=${encodeURIComponent(restaurantId)}`),
          fetch(`/api/chefs-tab/ingredients?restaurantId=${encodeURIComponent(restaurantId)}`),
        ]);
        if (cancelled) return;
        const invData = await resInv.json();
        const ingData = await resIng.json();
        if (invData.error) throw new Error(invData.error);
        setInvoice(invData.invoice);
        setLineItems(invData.lineItems ?? []);
        setIngredients(ingData.ingredients ?? []);
      } catch {
        if (!cancelled) setInvoice(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => { cancelled = true; };
  }, [id, restaurantId]);

  const mapLineToIngredient = async (lineId: string, ingredientId: string | null, confidence?: number) => {
    setMapping(lineId);
    setMessage(null);
    try {
      const res = await fetch(`/api/chefs-tab/invoices/${id}/line-items/${lineId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId, ingredientId, matchConfidence: confidence ?? 1 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to map");
      setLineItems((prev) =>
        prev.map((line) =>
          line.id === lineId ? { ...line, ingredientId, isMapped: !!ingredientId, matchConfidence: confidence ?? 1 } : line
        )
      );
      setMessage({ type: "ok", text: "Mapping saved." });
    } catch (err) {
      setMessage({ type: "err", text: err instanceof Error ? err.message : "Error" });
    } finally {
      setMapping(null);
    }
  };

  const [suggestions, setSuggestions] = useState<Record<string, Array<{ ingredientId: string; canonicalName: string; confidence: number; source: string }>>>({});
  const [loadingSuggestions, setLoadingSuggestions] = useState<Record<string, boolean>>({});
  const [createForLine, setCreateForLine] = useState<{ lineId: string; rawItemName: string } | null>(null);
  const [newIngredientName, setNewIngredientName] = useState("");
  const [newIngredientUnit, setNewIngredientUnit] = useState("");
  const [creating, setCreating] = useState(false);
  const [bulkMapping, setBulkMapping] = useState(false);

  const loadSuggestions = async (lineId: string, rawItemName: string, normalizedItemName: string) => {
    if (suggestions[lineId]?.length) return;
    setLoadingSuggestions((p) => ({ ...p, [lineId]: true }));
    try {
      const res = await fetch(
        `/api/chefs-tab/ingredients/match?restaurantId=${encodeURIComponent(restaurantId)}&rawItemName=${encodeURIComponent(rawItemName)}&normalizedItemName=${encodeURIComponent(normalizedItemName)}`
      );
      const data = await res.json();
      if (data.matches) setSuggestions((p) => ({ ...p, [lineId]: data.matches }));
    } finally {
      setLoadingSuggestions((p) => ({ ...p, [lineId]: false }));
    }
  };

  const openCreateIngredient = (line: LineItem) => {
    setCreateForLine({ lineId: line.id, rawItemName: line.rawItemName });
    setNewIngredientName(line.rawItemName.trim());
    setNewIngredientUnit(line.purchaseUnit?.trim() || "");
  };

  const mapExactMatches = async () => {
    setBulkMapping(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/chefs-tab/invoices/${id}/map-exact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      const mapped = data.mapped ?? 0;
      setMessage({ type: "ok", text: mapped > 0 ? `${mapped} line(s) mapped to ingredients.` : "No exact matches found." });
      if (mapped > 0) {
        const resInv = await fetch(`/api/chefs-tab/invoices/${id}?restaurantId=${encodeURIComponent(restaurantId)}`);
        const invData = await resInv.json();
        if (invData.lineItems) setLineItems(invData.lineItems);
        const resIng = await fetch(`/api/chefs-tab/ingredients?restaurantId=${encodeURIComponent(restaurantId)}`);
        const ingData = await resIng.json();
        if (ingData.ingredients) setIngredients(ingData.ingredients);
      }
    } catch (err) {
      setMessage({ type: "err", text: err instanceof Error ? err.message : "Failed" });
    } finally {
      setBulkMapping(false);
    }
  };

  const createIngredientAndMap = async () => {
    if (!createForLine || !newIngredientName.trim()) return;
    setCreating(true);
    setMessage(null);
    try {
      const res = await fetch("/api/chefs-tab/ingredients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId,
          canonicalName: newIngredientName.trim(),
          defaultUnit: newIngredientUnit.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create ingredient");
      const ingredientId = data.id;
      await mapLineToIngredient(createForLine.lineId, ingredientId, 1);
      setIngredients((prev) => [...prev, { id: ingredientId, canonicalName: newIngredientName.trim() }]);
      setCreateForLine(null);
      setMessage({ type: "ok", text: "Ingredient created and line mapped." });
    } catch (err) {
      setMessage({ type: "err", text: err instanceof Error ? err.message : "Failed" });
    } finally {
      setCreating(false);
    }
  };

  if (loading && !invoice) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-stone-500 text-sm">Loading...</p>
      </div>
    );
  }
  if (!invoice) {
    return (
      <div className="py-12">
        <p className="text-stone-500">Invoice not found.</p>
        <Link href="/chefs-tab/invoices" className="text-amber-600 hover:underline mt-2 inline-block">
          Back to invoices
        </Link>
      </div>
    );
  }

  const unmappedCount = lineItems.filter((l) => !l.isMapped).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 flex-wrap">
        <Link href="/chefs-tab/invoices" className="text-stone-500 hover:text-stone-700 text-sm font-medium">
          ← Invoices
        </Link>
        <h2 className="text-lg font-semibold text-stone-800">{invoice.vendorName}</h2>
        {invoice.invoiceNumber && (
          <span className="text-stone-500 text-sm">#{invoice.invoiceNumber}</span>
        )}
        {unmappedCount > 0 && (
          <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
            {unmappedCount} unmapped
          </span>
        )}
      </div>

      <p className="text-sm text-stone-500">
        Review low-confidence ingredient matches before finalizing costs. Map each line to an ingredient so dish plate costs can be calculated.
      </p>

      {unmappedCount > 0 && (
        <button
          type="button"
          onClick={mapExactMatches}
          disabled={bulkMapping}
          className="px-4 py-2 bg-stone-200 text-stone-800 rounded-lg text-sm font-medium hover:bg-stone-300 disabled:opacity-50"
        >
          {bulkMapping ? "Mapping…" : "Map exact matches"}
        </button>
      )}

      {message && (
        <p className={`text-sm ${message.type === "ok" ? "text-emerald-600" : "text-red-600"}`}>
          {message.text}
        </p>
      )}

      <div className="bg-white rounded-lg border border-stone-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-stone-50 border-b border-stone-200">
              <th className="text-left px-4 py-3 font-medium text-stone-700">Item</th>
              <th className="text-right px-4 py-3 font-medium text-stone-700">Qty</th>
              <th className="text-left px-4 py-3 font-medium text-stone-700">Unit</th>
              <th className="text-right px-4 py-3 font-medium text-stone-700">Total cost</th>
              <th className="text-left px-4 py-3 font-medium text-stone-700">Mapped to</th>
              <th className="text-left px-4 py-3 font-medium text-stone-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((line) => (
              <tr key={line.id} className="border-b border-stone-100 hover:bg-stone-50/50">
                <td className="px-4 py-3 text-stone-800">{line.rawItemName}</td>
                <td className="px-4 py-3 text-right text-stone-700">{line.quantityPurchased ?? "-"}</td>
                <td className="px-4 py-3 text-stone-700">{line.purchaseUnit ?? "-"}</td>
                <td className="px-4 py-3 text-right text-stone-700 font-medium">
                  ${Number(line.totalCost).toFixed(2)}
                </td>
                <td className="px-4 py-3">
                  {line.isMapped ? (
                    <span className="text-emerald-600 text-xs font-medium">
                      {ingredients.find((i) => i.id === line.ingredientId)?.canonicalName ?? "Mapped"}
                    </span>
                  ) : (
                    <span className="text-amber-600 text-xs">Needs mapping</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {!line.isMapped && (
                      <button
                        type="button"
                        onClick={() => loadSuggestions(line.id, line.rawItemName, line.normalizedItemName)}
                        disabled={loadingSuggestions[line.id]}
                        className="text-xs text-amber-600 hover:underline font-medium"
                      >
                        {loadingSuggestions[line.id] ? "..." : "Suggest"}
                      </button>
                    )}
                    {suggestions[line.id]?.length ? (
                      <span className="flex flex-wrap gap-1">
                        {suggestions[line.id].slice(0, 3).map((m) => (
                          <button
                            key={m.ingredientId}
                            type="button"
                            onClick={() => mapLineToIngredient(line.id, m.ingredientId, m.confidence)}
                            disabled={mapping === line.id}
                            className="px-1.5 py-0.5 rounded bg-stone-100 hover:bg-amber-100 text-stone-700 text-xs font-medium disabled:opacity-50"
                          >
                            {m.canonicalName} ({Math.round(m.confidence * 100)}%)
                          </button>
                        ))}
                      </span>
                    ) : null}
                    <select
                      value={line.ingredientId ?? ""}
                      onChange={(e) => mapLineToIngredient(line.id, e.target.value || null)}
                      disabled={mapping === line.id}
                      className="border border-stone-300 rounded px-2 py-1 text-xs focus:ring-2 focus:ring-amber-500/30 outline-none max-w-[10rem]"
                    >
                      <option value="">- Select -</option>
                      {ingredients.map((ing) => (
                        <option key={ing.id} value={ing.id}>
                          {ing.canonicalName}
                        </option>
                      ))}
                    </select>
                    {!line.isMapped && (
                      <button
                        type="button"
                        onClick={() => openCreateIngredient(line)}
                        className="text-xs text-stone-600 hover:text-amber-600 hover:underline font-medium"
                      >
                        Create new
                      </button>
                    )}
                    {line.isMapped && (
                      <button
                        type="button"
                        onClick={() => mapLineToIngredient(line.id, null)}
                        disabled={mapping === line.id}
                        className="text-xs text-red-600 hover:underline"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {createForLine && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40"
          onClick={() => setCreateForLine(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Create ingredient"
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-sm w-full p-5 border border-stone-200"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold text-stone-800 mb-3">Create ingredient & map line</h3>
            <p className="text-xs text-stone-500 mb-3">
              From: &quot;{createForLine.rawItemName}&quot;
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Canonical name *</label>
                <input
                  type="text"
                  value={newIngredientName}
                  onChange={(e) => setNewIngredientName(e.target.value)}
                  className="w-full border border-stone-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500/30 outline-none"
                  placeholder="e.g. short rib"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Default unit</label>
                <input
                  type="text"
                  value={newIngredientUnit}
                  onChange={(e) => setNewIngredientUnit(e.target.value)}
                  className="w-full border border-stone-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500/30 outline-none"
                  placeholder="e.g. lb"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={createIngredientAndMap}
                disabled={creating || !newIngredientName.trim()}
                className="px-3 py-2 bg-amber-600 text-white rounded text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
              >
                {creating ? "..." : "Create & map"}
              </button>
              <button
                type="button"
                onClick={() => setCreateForLine(null)}
                className="px-3 py-2 border border-stone-300 rounded text-sm font-medium text-stone-700 hover:bg-stone-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
