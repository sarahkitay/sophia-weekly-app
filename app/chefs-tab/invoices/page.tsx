"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useChefsTab } from "../ChefsTabContext";

interface Invoice {
  id: string;
  vendorName: string;
  invoiceDate?: string | null;
  invoiceNumber?: string | null;
  sourceType: string;
  parseStatus: string;
  updatedAt: string;
}

export default function InvoicesListPage() {
  const { restaurantId } = useChefsTab();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      try {
        const res = await fetch(`/api/chefs-tab/invoices?restaurantId=${encodeURIComponent(restaurantId)}`);
        const data = await res.json();
        if (cancelled) return;
        if (data.error) throw new Error(data.error);
        setInvoices(data.invoices ?? []);
      } catch {
        if (!cancelled) setInvoices([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => { cancelled = true; };
  }, [restaurantId]);

  if (loading && !invoices.length) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-stone-500 text-sm">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 className="text-lg font-semibold text-stone-800">Invoices</h2>
        <Link
          href="/chefs-tab/invoices/upload"
          className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors"
        >
          Upload invoice (CSV)
        </Link>
      </div>

      <p className="text-sm text-stone-500">
        Upload a CSV invoice, then map line items to ingredients so dish costing can be calculated.
      </p>

      <div className="bg-white rounded-lg border border-stone-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-stone-50 border-b border-stone-200">
              <th className="text-left px-4 py-3 font-medium text-stone-700">Vendor</th>
              <th className="text-left px-4 py-3 font-medium text-stone-700">Invoice #</th>
              <th className="text-left px-4 py-3 font-medium text-stone-700">Date</th>
              <th className="text-left px-4 py-3 font-medium text-stone-700">Source</th>
              <th className="text-left px-4 py-3 font-medium text-stone-700">Status</th>
              <th className="text-left px-4 py-3 font-medium text-stone-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-stone-500">
                  No invoices yet. Upload a CSV to get started.
                </td>
              </tr>
            ) : (
              invoices.map((inv) => (
                <tr key={inv.id} className="border-b border-stone-100 hover:bg-stone-50/50">
                  <td className="px-4 py-3 font-medium text-stone-800">{inv.vendorName}</td>
                  <td className="px-4 py-3 text-stone-600">{inv.invoiceNumber ?? "-"}</td>
                  <td className="px-4 py-3 text-stone-600">{inv.invoiceDate ?? "-"}</td>
                  <td className="px-4 py-3 text-stone-600">{inv.sourceType}</td>
                  <td className="px-4 py-3">
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                      inv.parseStatus === "parsed" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                    }`}>
                      {inv.parseStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/chefs-tab/invoices/${inv.id}`} className="text-amber-600 hover:underline font-medium">
                      View & map
                    </Link>
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
