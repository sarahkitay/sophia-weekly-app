"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useChefsTab } from "./ChefsTabContext";

interface DashboardData {
  totalDishes: number;
  totalInvoices: number;
  unmappedLineItems: number;
  recentInvoices: Array<{
    id: string;
    vendorName: string;
    invoiceDate: string | null;
    parseStatus: string;
    updatedAt: string | null;
  }>;
}

export default function ChefsTabDashboardPage() {
  const { restaurantId } = useChefsTab();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [costing, setCosting] = useState<{ underpriced: number; missing: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      try {
        const [resDashboard, resCosting] = await Promise.all([
          fetch(`/api/chefs-tab/dashboard?restaurantId=${encodeURIComponent(restaurantId)}`),
          fetch(`/api/chefs-tab/costing?restaurantId=${encodeURIComponent(restaurantId)}`),
        ]);
        if (cancelled) return;
        const dash = await resDashboard.json();
        const cost = await resCosting.json();
        if (dash.error) throw new Error(dash.error);
        setData(dash);
        const dishes = Array.isArray(cost.dishes) ? cost.dishes : [];
        setCosting({
          underpriced: dishes.filter((d: { status: string }) => d.status === "underpriced").length,
          missing: dishes.filter((d: { status: string }) => d.status === "missing" || d.status === "partial").length,
        });
      } catch {
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => { cancelled = true; };
  }, [restaurantId]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-stone-500 text-sm">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-stone-800">Dashboard</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-stone-200 shadow-sm p-5">
          <p className="text-xs font-medium text-stone-500 uppercase tracking-wide">Total dishes</p>
          <p className="text-2xl font-semibold text-stone-800 mt-1">{data?.totalDishes ?? 0}</p>
          <Link href="/chefs-tab/dishes" className="text-sm text-amber-600 hover:underline mt-2 inline-block">
            View dishes
          </Link>
        </div>
        <div className="bg-white rounded-lg border border-stone-200 shadow-sm p-5">
          <p className="text-xs font-medium text-stone-500 uppercase tracking-wide">Total invoices</p>
          <p className="text-2xl font-semibold text-stone-800 mt-1">{data?.totalInvoices ?? 0}</p>
          <Link href="/chefs-tab/invoices" className="text-sm text-amber-600 hover:underline mt-2 inline-block">
            View invoices
          </Link>
        </div>
        <div className="bg-white rounded-lg border border-stone-200 shadow-sm p-5">
          <p className="text-xs font-medium text-stone-500 uppercase tracking-wide">Needs ingredient mapping</p>
          <p className="text-2xl font-semibold text-stone-800 mt-1">{data?.unmappedLineItems ?? 0}</p>
          <p className="text-xs text-stone-500 mt-1">Unmapped invoice line items</p>
        </div>
        <div className="bg-white rounded-lg border border-stone-200 shadow-sm p-5">
          <p className="text-xs font-medium text-stone-500 uppercase tracking-wide">Dishes needing attention</p>
          <p className="text-2xl font-semibold text-amber-700 mt-1">{((costing?.underpriced ?? 0) + (costing?.missing ?? 0))}</p>
          <p className="text-xs text-stone-500 mt-1">Underpriced or missing costing</p>
          <Link href="/chefs-tab/costing" className="text-sm text-amber-600 hover:underline mt-2 inline-block">
            Costing table
          </Link>
        </div>
      </div>

      <section className="bg-white rounded-lg border border-stone-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-100">
          <h3 className="text-sm font-semibold text-stone-800">Recent invoice uploads</h3>
        </div>
        <div className="overflow-x-auto">
          {!data?.recentInvoices?.length ? (
            <p className="p-5 text-sm text-stone-500">No invoices yet. Upload a CSV from the Invoices page.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200">
                  <th className="text-left px-4 py-2 font-medium text-stone-700">Vendor</th>
                  <th className="text-left px-4 py-2 font-medium text-stone-700">Date</th>
                  <th className="text-left px-4 py-2 font-medium text-stone-700">Status</th>
                  <th className="text-left px-4 py-2 font-medium text-stone-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.recentInvoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-stone-100 hover:bg-stone-50/50">
                    <td className="px-4 py-2 text-stone-800">{inv.vendorName}</td>
                    <td className="px-4 py-2 text-stone-600">{inv.invoiceDate ?? "-"}</td>
                    <td className="px-4 py-2">
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                        inv.parseStatus === "parsed" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                      }`}>
                        {inv.parseStatus}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <Link href={`/chefs-tab/invoices/${inv.id}`} className="text-amber-600 hover:underline font-medium">
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <p className="text-xs text-stone-500">
        Suggested menu price is based on your target food cost percentage (default 24%). Review low-confidence ingredient matches before finalizing costs.
      </p>
    </div>
  );
}
