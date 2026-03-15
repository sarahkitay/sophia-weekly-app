"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { RESTAURANT_IDS, RESTAURANT_LABELS, type RestaurantId } from "@/lib/sophia-weekly/restaurants";
import { ChefsTabProvider, useChefsTab } from "./ChefsTabContext";

const RESTAURANT_TOGGLE_LABELS: Record<RestaurantId, string> = {
  goldies: "Goldies",
  "oyster-catcher": "Oyster Catcher",
  osprey: "Osprey",
};

const NAV = [
  { href: "/chefs-tab", label: "Dashboard" },
  { href: "/chefs-tab/dishes", label: "Dishes" },
  { href: "/chefs-tab/ingredients", label: "Ingredients" },
  { href: "/chefs-tab/invoices", label: "Invoices" },
  { href: "/chefs-tab/costing", label: "Costing / Pricing" },
  { href: "/chefs-tab/analytics", label: "Analytics" },
];

function ChefsTabLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { restaurantId, setRestaurantId } = useChefsTab();
  const [menuOpen, setMenuOpen] = useState(false);

  const setRestaurantIdAndClose = (id: ReturnType<typeof useChefsTab>["restaurantId"]) => {
    setRestaurantId(id);
    setMenuOpen(false);
  };

  return (
    <main className="min-h-screen min-w-0 bg-stone-50/60">
      <header className="bg-white border-b border-stone-200 sticky top-0 z-10 shadow-sm">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                className="p-2 rounded-lg text-stone-600 hover:bg-stone-100 hover:text-stone-800 focus:ring-2 focus:ring-amber-500/30 outline-none"
                aria-label="Choose restaurant"
                aria-expanded={menuOpen}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-20" aria-hidden onClick={() => setMenuOpen(false)} />
                  <div className="absolute left-0 top-full mt-1 z-30 min-w-[12rem] py-1 bg-white rounded-lg border border-stone-200 shadow-lg">
                    {RESTAURANT_IDS.map((id) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setRestaurantIdAndClose(id)}
                        className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                          id === restaurantId ? "bg-amber-50 text-amber-800 font-medium" : "text-stone-700 hover:bg-stone-50"
                        }`}
                      >
                        {RESTAURANT_LABELS[id]}
                      </button>
                    ))}
                    <div className="border-t border-stone-100 my-1" />
                    <Link
                      href="/goldies"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-stone-700 hover:bg-stone-50 transition-colors"
                    >
                      Weekly Recap
                    </Link>
                  </div>
                </>
              )}
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold text-stone-800 tracking-tight">
                Chef&apos;s Tab
              </h1>
              <p className="text-stone-500 text-sm mt-0.5 sm:sr-only">{RESTAURANT_LABELS[restaurantId]}</p>
            </div>
          </div>
          {/* Restaurant toggle: switch between the three restaurants */}
          <div className="flex items-center gap-1 border-t border-stone-100 pt-3 mt-3">
            <span className="text-xs font-medium text-stone-500 uppercase tracking-wide mr-2 shrink-0">Location</span>
            <div className="flex rounded-lg border border-stone-200 p-0.5 bg-stone-50">
              {RESTAURANT_IDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setRestaurantId(id)}
                  title={RESTAURANT_LABELS[id]}
                  className={`shrink-0 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    id === restaurantId
                      ? "bg-white text-amber-800 shadow-sm border border-stone-200"
                      : "text-stone-600 hover:text-stone-800"
                  }`}
                >
                  {RESTAURANT_TOGGLE_LABELS[id]}
                </button>
              ))}
            </div>
          </div>
        </div>
        <nav className="px-4 sm:px-6 lg:px-8 border-t border-stone-100 flex gap-1 overflow-x-auto">
          {NAV.map(({ href, label }) => {
            const active = pathname === href || (href !== "/chefs-tab" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={`shrink-0 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  active
                    ? "border-amber-500 text-amber-700"
                    : "border-transparent text-stone-600 hover:text-stone-800 hover:border-stone-200"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </header>
      <div className="w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {children}
      </div>
    </main>
  );
}

export default function ChefsTabLayout({ children }: { children: React.ReactNode }) {
  return (
    <ChefsTabProvider>
      <ChefsTabLayoutInner>{children}</ChefsTabLayoutInner>
    </ChefsTabProvider>
  );
}
