"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useChefsTab } from "../../ChefsTabContext";

type ColumnKey = "itemName" | "quantity" | "unit" | "packSize" | "totalCost" | "unitCost" | "vendor" | "invoiceNumber" | "invoiceDate";

const COLUMN_OPTIONS: { value: ColumnKey; label: string }[] = [
  { value: "itemName", label: "Item name" },
  { value: "quantity", label: "Quantity" },
  { value: "unit", label: "Unit" },
  { value: "packSize", label: "Pack size" },
  { value: "totalCost", label: "Total cost" },
  { value: "unitCost", label: "Unit cost" },
  { value: "vendor", label: "Vendor" },
  { value: "invoiceNumber", label: "Invoice number" },
  { value: "invoiceDate", label: "Invoice date" },
];

export default function InvoiceUploadPage() {
  const router = useRouter();
  const { restaurantId } = useChefsTab();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{ headers: string[]; rows: string[][]; rowCount: number } | null>(null);
  const [columnMap, setColumnMap] = useState<Partial<Record<ColumnKey, number>>>({});
  const [vendorName, setVendorName] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [step, setStep] = useState<"upload" | "map" | "saving">("upload");
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const parseFile = useCallback(async (f: File) => {
    const form = new FormData();
    form.set("file", f);
    const res = await fetch("/api/chefs-tab/invoices/parse-csv", { method: "POST", body: form });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return { headers: data.headers ?? [], rows: data.rows ?? [], rowCount: data.rowCount ?? 0 };
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setMessage(null);
    setFile(f);
    try {
      const p = await parseFile(f);
      setPreview(p);
      setStep("map");
      const map: Partial<Record<ColumnKey, number>> = {};
      p.headers.forEach((h: string, i: number) => {
        const lower = h.toLowerCase();
        if (lower.includes("item") || lower.includes("name") || lower.includes("description")) map.itemName = i;
        else if (lower.includes("qty") || lower.includes("quantity")) map.quantity = i;
        else if (lower.includes("unit")) map.unit = i;
        else if (lower.includes("pack")) map.packSize = i;
        else if (lower.includes("total") || lower.includes("cost") || lower.includes("amount")) map.totalCost = i;
        else if (lower.includes("unit") && lower.includes("price")) map.unitCost = i;
        else if (lower.includes("vendor") || lower.includes("supplier")) map.vendor = i;
        else if (lower.includes("invoice") && lower.includes("number")) map.invoiceNumber = i;
        else if (lower.includes("date")) map.invoiceDate = i;
      });
      setColumnMap(map);
    } catch (err) {
      setMessage({ type: "err", text: err instanceof Error ? err.message : "Parse failed" });
    }
  };

  const handleSave = async () => {
    if (!preview || preview.rows.length === 0) {
      setMessage({ type: "err", text: "No rows to import." });
      return;
    }
    const vendor = vendorName.trim();
    if (!vendor) {
      setMessage({ type: "err", text: "Vendor name is required." });
      return;
    }
    setStep("saving");
    setMessage(null);
    try {
      const lineItems = preview.rows.map((row) => {
        const get = (key: ColumnKey) => {
          const idx = columnMap[key];
          if (idx == null || idx < 0 || idx >= row.length) return "";
          return (row[idx] ?? "").trim();
        };
        const num = (key: ColumnKey) => {
          const s = get(key).replace(/[$,]/g, "");
          const n = parseFloat(s);
          return Number.isFinite(n) ? n : undefined;
        };
        return {
          itemName: get("itemName") || "Unknown",
          quantity: num("quantity"),
          unit: get("unit") || undefined,
          packSize: get("packSize") || undefined,
          totalCost: num("totalCost") ?? 0,
          unitCost: num("unitCost"),
          vendor: get("vendor") || vendor,
          invoiceNumber: get("invoiceNumber") || invoiceNumber || undefined,
          invoiceDate: get("invoiceDate") || invoiceDate || undefined,
        };
      }).filter((r) => Number(r.totalCost) > 0);

      const res = await fetch("/api/chefs-tab/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId,
          vendorName: vendor,
          invoiceNumber: invoiceNumber.trim() || null,
          invoiceDate: invoiceDate.trim() || null,
          sourceType: "csv",
          lineItems,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save invoice");
      setMessage({ type: "ok", text: `Saved ${lineItems.length} line items.` });
      router.push(`/chefs-tab/invoices/${data.id}`);
    } catch (err) {
      setMessage({ type: "err", text: err instanceof Error ? err.message : "Save failed" });
      setStep("map");
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/chefs-tab/invoices" className="text-stone-500 hover:text-stone-700 text-sm font-medium">
          ← Invoices
        </Link>
        <h2 className="text-lg font-semibold text-stone-800">Upload invoice (CSV)</h2>
      </div>

      {step === "upload" && (
        <div className="bg-white rounded-lg border border-stone-200 shadow-sm p-6">
          <p className="text-sm text-stone-600 mb-4">
            Upload a CSV with columns for item name, quantity, unit, and total cost. You can map columns in the next step.
          </p>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
            className="block w-full text-sm text-stone-600 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-amber-50 file:text-amber-800 file:font-medium file:cursor-pointer hover:file:bg-amber-100"
          />
          {message && (
            <p className={`mt-3 text-sm ${message.type === "ok" ? "text-emerald-600" : "text-red-600"}`}>
              {message.text}
            </p>
          )}
        </div>
      )}

      {(step === "map" || step === "saving") && preview && (
        <>
          <div className="bg-white rounded-lg border border-stone-200 shadow-sm p-6 space-y-4">
            <h3 className="text-sm font-semibold text-stone-800">Map columns</h3>
            <p className="text-xs text-stone-500">
              Match CSV headers to fields. Expected: item name, quantity, unit, total cost.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {COLUMN_OPTIONS.map(({ value, label }) => (
                <div key={value}>
                  <label className="block text-xs font-medium text-stone-600 mb-1">{label}</label>
                  <select
                    value={columnMap[value] ?? ""}
                    onChange={(e) => setColumnMap((m) => ({ ...m, [value]: e.target.value === "" ? undefined : parseInt(e.target.value, 10) }))}
                    className="w-full border border-stone-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-amber-500/30 outline-none"
                  >
                    <option value="">-</option>
                    {preview.headers.map((h, i) => (
                      <option key={i} value={i}>{h || `Column ${i + 1}`}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Vendor name *</label>
                <input
                  type="text"
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  placeholder="e.g. Sysco"
                  className="w-full border border-stone-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500/30 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Invoice number</label>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="w-full border border-stone-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500/30 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Invoice date</label>
                <input
                  type="text"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  placeholder="YYYY-MM-DD"
                  className="w-full border border-stone-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500/30 outline-none"
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-stone-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-stone-100 text-sm font-medium text-stone-700">
              Preview ({preview.rowCount} rows)
            </div>
            <div className="overflow-x-auto max-h-64 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-stone-50 sticky top-0">
                  <tr>
                    {preview.headers.map((h, i) => (
                      <th key={i} className="text-left px-3 py-2 font-medium text-stone-600 whitespace-nowrap">
                        {h || `Col ${i + 1}`}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.slice(0, 20).map((row, ri) => (
                    <tr key={ri} className="border-b border-stone-100">
                      {row.map((cell, ci) => (
                        <td key={ci} className="px-3 py-2 text-stone-700 whitespace-nowrap">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {preview.rows.length > 20 && (
              <p className="px-4 py-2 text-xs text-stone-500 border-t border-stone-100">
                Showing first 20 of {preview.rows.length} rows.
              </p>
            )}
          </div>

          {message && (
            <p className={`text-sm ${message.type === "ok" ? "text-emerald-600" : "text-red-600"}`}>
              {message.text}
            </p>
          )}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={step === "saving"}
              className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
            >
              {step === "saving" ? "Saving..." : "Save invoice"}
            </button>
            <button
              type="button"
              onClick={() => { setStep("upload"); setPreview(null); setFile(null); }}
              className="px-4 py-2 border border-stone-300 rounded-lg text-sm font-medium text-stone-700 hover:bg-stone-50"
            >
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  );
}
