"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { extractTopAndLowest } from "@/lib/sophia-weekly/parseOrderDetailPaste";
import {
  RESTAURANT_IDS,
  RESTAURANT_LABELS,
  type RestaurantId,
  DEFAULT_RESTAURANT_ID,
} from "@/lib/sophia-weekly/restaurants";
import {
  getCurrentWeekKey,
  getNextWeekKey,
  getMondayForDate,
  getWeekRangeLabel,
} from "@/lib/sophia-weekly/weekUtils";

const RESTAURANT_STORAGE_KEY = "sophiaWeeklyRestaurant";

interface WeekDoc {
  weekKey: string;
  exists: boolean;
  salesReceived?: boolean;
  laborReceived?: boolean;
  productMixReceived?: boolean;
  salesParsed?: boolean;
  laborParsed?: boolean;
  productMixParsed?: boolean;
  generatedEmailText?: string;
  sent?: boolean;
  sentAt?: { seconds: number } | null;
  updatedAt?: { seconds: number };
  parseErrors?: string[];
  productMixData?: {
    topFoodItems?: string[];
    topCocktailItems?: string[];
    topWineItems?: string[];
    topBeerItems?: string[];
    lowestFoodItems?: string[];
    lowestCocktailItems?: string[];
    lowestWineItems?: string[];
    lowestBeerItems?: string[];
  };
}

interface HistoryItem {
  weekKey: string;
  sent: boolean;
  sentAt: { seconds: number } | null;
  updatedAt: { seconds: number } | null;
  ready: boolean;
}

interface BestSellerItem {
  name: string;
  count: number;
}

interface OverallBestSellers {
  topFoodItems: BestSellerItem[];
  topCocktailItems: BestSellerItem[];
  topWineItems: BestSellerItem[];
  topBeerItems: BestSellerItem[];
  lowestFoodItems: BestSellerItem[];
  lowestCocktailItems: BestSellerItem[];
  lowestWineItems: BestSellerItem[];
  lowestBeerItems: BestSellerItem[];
  weeksCount: number;
}

export default function GoldiesWeeklyPage() {
  const [restaurantId, setRestaurantIdState] = useState<RestaurantId>(DEFAULT_RESTAURANT_ID);
  const [menuOpen, setMenuOpen] = useState(false);
  const [weekKey, setWeekKey] = useState(getCurrentWeekKey());
  const [doc, setDoc] = useState<WeekDoc | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [sendConfirmOpen, setSendConfirmOpen] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(RESTAURANT_STORAGE_KEY);
    if (stored && RESTAURANT_IDS.includes(stored as RestaurantId)) {
      setRestaurantIdState(stored as RestaurantId);
    }
  }, []);
  const setRestaurantId = useCallback((id: RestaurantId) => {
    setRestaurantIdState(id);
    setMenuOpen(false);
    if (typeof localStorage !== "undefined") localStorage.setItem(RESTAURANT_STORAGE_KEY, id);
  }, []);

  const [topFood, setTopFood] = useState<string[]>(["", "", ""]);
  const [topCocktails, setTopCocktails] = useState<string[]>(["", "", ""]);
  const [topWine, setTopWine] = useState<string[]>(["", "", ""]);
  const [topBeer, setTopBeer] = useState<string[]>(["", "", ""]);
  const [lowestFood, setLowestFood] = useState<string[]>(["", "", ""]);
  const [lowestCocktails, setLowestCocktails] = useState<string[]>(["", "", ""]);
  const [lowestWine, setLowestWine] = useState<string[]>(["", "", ""]);
  const [lowestBeer, setLowestBeer] = useState<string[]>(["", "", ""]);

  const [recipients, setRecipients] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [recipientsLoading, setRecipientsLoading] = useState(false);

  const [overallBestSellers, setOverallBestSellers] = useState<OverallBestSellers | null>(null);
  const [bestSellersDropdownOpen, setBestSellersDropdownOpen] = useState(false);
  const [wipingBestSellers, setWipingBestSellers] = useState(false);

  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [pasteSalesByItem, setPasteSalesByItem] = useState("");
  const [pasteParseMessage, setPasteParseMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const fetchWeek = useCallback(async (wk: string) => {
    try {
      const res = await fetch(
        `/api/sophia-weekly/week?weekKey=${encodeURIComponent(wk)}&restaurantId=${encodeURIComponent(restaurantId)}`
      );
      const data = await res.json();
      setDoc({ ...data, weekKey: wk });
      const mix = data.productMixData ?? {};
      setTopFood(((mix.topFoodItems ?? []) as string[]).concat("", "", "").slice(0, 3));
      setTopCocktails(((mix.topCocktailItems ?? []) as string[]).concat("", "", "").slice(0, 3));
      setTopWine(((mix.topWineItems ?? []) as string[]).concat("", "", "").slice(0, 3));
      setTopBeer(((mix.topBeerItems ?? []) as string[]).concat("", "", "").slice(0, 3));
      const noSide = (arr: string[]) => arr.filter((s) => !s.toLowerCase().includes("side"));
      setLowestFood(noSide((mix.lowestFoodItems ?? []) as string[]).concat("", "", "").slice(0, 3));
      setLowestCocktails(noSide((mix.lowestCocktailItems ?? []) as string[]).concat("", "", "").slice(0, 3));
      setLowestWine(noSide((mix.lowestWineItems ?? []) as string[]).concat("", "", "").slice(0, 3));
      setLowestBeer(noSide((mix.lowestBeerItems ?? []) as string[]).concat("", "", "").slice(0, 3));
    } catch {
      setDoc({ weekKey: wk, exists: false });
    }
  }, [restaurantId]);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/sophia-weekly/history?limit=200&restaurantId=${encodeURIComponent(restaurantId)}`
      );
      const data = await res.json();
      setHistory(data.weeks ?? []);
    } catch {
      setHistory([]);
    }
  }, [restaurantId]);

  const fetchBestSellers = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/sophia-weekly/best-sellers?restaurantId=${encodeURIComponent(restaurantId)}`
      );
      const data = await res.json();
      if (data.topFoodItems) setOverallBestSellers(data);
      else setOverallBestSellers(null);
    } catch {
      setOverallBestSellers(null);
    }
  }, [restaurantId]);

  const fetchRecipients = useCallback(async () => {
    try {
      const res = await fetch("/api/sophia-weekly/recipients");
      const data = await res.json();
      setRecipients(Array.isArray(data.recipients) ? data.recipients : []);
    } catch {
      setRecipients([]);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchWeek(weekKey), fetchHistory(), fetchRecipients(), fetchBestSellers()]).finally(() => setLoading(false));
  }, [weekKey, restaurantId, fetchWeek, fetchHistory, fetchRecipients, fetchBestSellers]);

  /** Collect all files from a drop, including recursing into directories. */
  const getFilesFromDrop = useCallback((dataTransfer: DataTransfer): Promise<File[]> => {
    const files: File[] = [];
    const items = dataTransfer.items;
    if (!items?.length) return Promise.resolve(files);

    const getEntry = (item: DataTransferItem): FileSystemEntry | null => {
      if (typeof (item as unknown as { webkitGetAsEntry?: () => FileSystemEntry }).webkitGetAsEntry === "function") {
        return (item as unknown as { webkitGetAsEntry: () => FileSystemEntry }).webkitGetAsEntry();
      }
      return null;
    };

    const readDir = (reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> =>
      new Promise((resolve, reject) => reader.readEntries(resolve));

    const traverse = async (entry: FileSystemEntry): Promise<void> => {
      if (entry.isFile) {
        await new Promise<void>((resolve, reject) => {
          (entry as FileSystemFileEntry).file((f) => {
            files.push(f);
            resolve();
          }, reject);
        });
      } else if (entry.isDirectory) {
        const reader = (entry as FileSystemDirectoryEntry).createReader();
        let entries: FileSystemEntry[] = [];
        do {
          entries = await readDir(reader);
          for (const e of entries) await traverse(e);
        } while (entries.length > 0);
      }
    };

    return (async () => {
      for (let i = 0; i < items.length; i++) {
        const entry = getEntry(items[i]);
        if (entry) await traverse(entry);
        else {
          const file = items[i].getAsFile();
          if (file) files.push(file);
        }
      }
      return files;
    })();
  }, []);

  const handleUpload = async (files: FileList | File[] | null) => {
    const list = !files ? [] : Array.isArray(files) ? files : Array.from(files);
    if (!list.length) return;
    setUploading(true);
    setMessage(null);
    try {
      const form = new FormData();
      form.set("weekKey", weekKey);
      form.set("restaurantId", restaurantId);
      for (const file of list) {
        form.append("files", file);
      }
      const res = await fetch("/api/sophia-weekly/upload", { method: "POST", body: form });
      let data: { error?: string; filesProcessed?: number; ready?: boolean; parseErrors?: string[] } = {};
      try {
        data = await res.json();
      } catch {
        setMessage({ type: "err", text: "Server returned invalid response" });
        return;
      }
      if (!res.ok) {
        setMessage({ type: "err", text: data.error ?? "Upload failed" });
        return;
      }
      const errNote = data.parseErrors?.length
        ? ` (${data.parseErrors.length} note(s): ${data.parseErrors.slice(0, 2).join("; ")}${data.parseErrors.length > 2 ? "..." : ""})`
        : "";
      setMessage({
        type: "ok",
        text: `Processed ${list.length} file(s). ${data.ready ? "Recap ready." : ""}${errNote}`,
      });
      if (data.parseErrors?.length) {
        console.warn("Upload parse/classification notes:", data.parseErrors);
      }
      await fetchWeek(weekKey);
      await fetchHistory();
      await fetchBestSellers();
    } catch (e) {
      setMessage({ type: "err", text: e instanceof Error ? e.message : "Upload failed" });
    } finally {
      setUploading(false);
    }
  };

  const saveRecipients = async (list: string[]) => {
    setRecipientsLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/sophia-weekly/recipients", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipients: list }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "err", text: data.error ?? "Failed to save recipients" });
        return;
      }
      setRecipients(data.recipients ?? list);
      setMessage({ type: "ok", text: "Recipients saved." });
      setNewEmail("");
    } catch (e) {
      setMessage({ type: "err", text: e instanceof Error ? e.message : "Failed to save" });
    } finally {
      setRecipientsLoading(false);
    }
  };

  const addRecipient = () => {
    const email = newEmail.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setMessage({ type: "err", text: "Enter a valid email address." });
      return;
    }
    if (recipients.includes(email)) {
      setMessage({ type: "err", text: "That email is already in the list." });
      return;
    }
    saveRecipients([...recipients, email]);
  };

  const removeRecipient = (email: string) => {
    saveRecipients(recipients.filter((e) => e !== email));
  };

  const updateTopItems = async () => {
    setMessage(null);
    try {
      const res = await fetch("/api/sophia-weekly/week", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weekKey,
          restaurantId,
          productMixData: {
            topFoodItems: topFood.map((s) => s.trim()).filter(Boolean),
            topCocktailItems: topCocktails.map((s) => s.trim()).filter(Boolean),
            topWineItems: topWine.map((s) => s.trim()).filter(Boolean),
            topBeerItems: topBeer.map((s) => s.trim()).filter(Boolean),
            lowestFoodItems: lowestFood.map((s) => s.trim()).filter(Boolean),
            lowestCocktailItems: lowestCocktails.map((s) => s.trim()).filter(Boolean),
            lowestWineItems: lowestWine.map((s) => s.trim()).filter(Boolean),
            lowestBeerItems: lowestBeer.map((s) => s.trim()).filter(Boolean),
          },
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setMessage({ type: "err", text: data.error ?? "Update failed" });
        return;
      }
      setMessage({ type: "ok", text: "Top items updated. Preview refreshed." });
      await fetchWeek(weekKey);
      await fetchBestSellers();
    } catch (e) {
      setMessage({ type: "err", text: e instanceof Error ? e.message : "Update failed" });
    }
  };

  /** Parse pasted Toast order detail (item, menuGroup, salesCategory, qty, sales). Strict 5-column; categorizes by salesCategory only; excludes garbage; merges duplicates. */
  const extractFromOrderDetailPaste = () => {
    setPasteParseMessage(null);
    const raw = pasteSalesByItem.trim();
    if (!raw) {
      setPasteParseMessage({ type: "err", text: "Paste something first." });
      return;
    }
    const result = extractTopAndLowest(raw);
    setTopFood([result.topFood[0] ?? "", result.topFood[1] ?? "", result.topFood[2] ?? ""]);
    setTopWine([result.topWine[0] ?? "", result.topWine[1] ?? "", result.topWine[2] ?? ""]);
    setTopBeer([result.topBeer[0] ?? "", result.topBeer[1] ?? "", result.topBeer[2] ?? ""]);
    setTopCocktails([result.topCocktails[0] ?? "", result.topCocktails[1] ?? "", result.topCocktails[2] ?? ""]);
    setLowestFood([result.lowestFood[0] ?? "", result.lowestFood[1] ?? "", result.lowestFood[2] ?? ""]);
    setLowestWine([result.lowestWine[0] ?? "", result.lowestWine[1] ?? "", result.lowestWine[2] ?? ""]);
    setLowestBeer([result.lowestBeer[0] ?? "", result.lowestBeer[1] ?? "", result.lowestBeer[2] ?? ""]);
    setLowestCocktails([result.lowestCocktails[0] ?? "", result.lowestCocktails[1] ?? "", result.lowestCocktails[2] ?? ""]);
    const totalFilled =
      result.topFood.length + result.topWine.length + result.topBeer.length + result.topCocktails.length +
      result.lowestFood.length + result.lowestWine.length + result.lowestBeer.length + result.lowestCocktails.length;
    if (totalFilled === 0) {
      setPasteParseMessage({ type: "err", text: "No rows matched. Paste Toast order detail: 5 columns (item, menu group, sales category, qty, sales), tab-separated." });
      return;
    }
    setPasteParseMessage({ type: "ok", text: `Filled top 3 and lowest 3 per category (Food, Wine, Beer, Cocktails). Click "Update top items" to save.` });
  };

  /** Move to next week (start over). Report history already has the current week. Pass silent to skip setting a message (e.g. after send). */
  const startOver = useCallback((silent?: boolean) => {
    const next = getNextWeekKey(weekKey);
    setWeekKey(next);
    if (!silent) setMessage({ type: "ok", text: `Starting next week (${next}). Upload reports when ready.` });
  }, [weekKey]);

  const runAction = async (
    action: "process" | "send" | "reprocess",
    params?: string
  ) => {
    setActionLoading(action);
    setMessage(null);
    try {
      const url = `/api/sophia-weekly/${action}?weekKey=${encodeURIComponent(weekKey)}&restaurantId=${encodeURIComponent(restaurantId)}${params ?? ""}`;
      const opts: RequestInit = { method: "POST" };
      if (action === "send" && currentDoc?.generatedEmailText?.trim()) {
        opts.headers = { "Content-Type": "application/json" };
        opts.body = JSON.stringify({ emailBody: currentDoc.generatedEmailText });
      }
      const res = await fetch(url, opts);
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "err", text: data.error ?? "Failed" });
        return;
      }
      if (action === "send") {
        setMessage({ type: "ok", text: "Email sent. Saved to report history. Starting next week." });
        await fetchWeek(weekKey);
        await fetchHistory();
        await fetchBestSellers();
        startOver(true);
      } else {
        setMessage({ type: "ok", text: data.message ?? "Done" });
        await fetchWeek(weekKey);
        await fetchHistory();
        await fetchBestSellers();
      }
    } catch (e) {
      setMessage({ type: "err", text: e instanceof Error ? e.message : "Error" });
    } finally {
      setActionLoading(null);
    }
  };

  if (loading && !doc) {
    return (
      <main className="min-h-screen w-full bg-white flex items-center justify-center">
        <p className="text-stone-500 text-sm">Loading...</p>
      </main>
    );
  }

  const currentDoc = doc ?? { weekKey, exists: false };
  const ready =
    currentDoc.salesParsed &&
    currentDoc.laborParsed &&
    currentDoc.productMixParsed &&
    !!currentDoc.generatedEmailText;

  return (
    <main className="min-h-screen min-w-0 bg-stone-50/60">
      {/* Header: hamburger + title (current restaurant); week ending + Sophia Kitay + instructions right */}
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
                  <div
                    className="fixed inset-0 z-20"
                    aria-hidden
                    onClick={() => setMenuOpen(false)}
                  />
                  <div className="absolute left-0 top-full mt-1 z-30 min-w-[12rem] py-1 bg-white rounded-lg border border-stone-200 shadow-lg">
                    {RESTAURANT_IDS.map((id) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setRestaurantId(id)}
                        className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                          id === restaurantId
                            ? "bg-amber-50 text-amber-800 font-medium"
                            : "text-stone-700 hover:bg-stone-50"
                        }`}
                      >
                        {RESTAURANT_LABELS[id]}
                      </button>
                    ))}
                    <div className="border-t border-stone-100 my-1" />
                    <Link
                      href="/chefs-tab"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-stone-700 hover:bg-stone-50 transition-colors"
                    >
                      <span aria-hidden>🍳</span>
                      Chef&apos;s Tab
                    </Link>
                  </div>
                </>
              )}
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold text-stone-800 tracking-tight">
                {RESTAURANT_LABELS[restaurantId]}
              </h1>
              <p className="text-stone-500 text-sm mt-0.5">Weekly recap</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <div className="flex items-center gap-3 sm:gap-4">
              <label className="flex items-center gap-2 text-stone-600 text-sm">
                <span className="text-stone-500">Week (Thu–Mon)</span>
                <input
                  type="date"
                  value={weekKey}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (!v) return;
                    const monday = getMondayForDate(new Date(v + "T12:00:00"));
                    setWeekKey(monday);
                  }}
                  className="bg-stone-100/80 border-0 rounded px-1.5 py-0.5 text-stone-700 font-medium focus:ring-2 focus:ring-amber-500/30 outline-none cursor-pointer max-w-[10rem]"
                />
                <span className="text-stone-700 font-medium whitespace-nowrap">
                  {getWeekRangeLabel(weekKey)}
                </span>
              </label>
              <span className="text-stone-300">|</span>
              <p className="text-stone-700 text-sm font-medium">Sophia Kitay</p>
            </div>
            <button
              type="button"
              onClick={() => setInstructionsOpen(true)}
              className="text-xs text-amber-600 hover:text-amber-700 hover:underline font-medium mt-0.5"
            >
              How to use
            </button>
          </div>
        </div>
      </header>

      {/* Instructions panel (overlay) */}
      {instructionsOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40"
          onClick={() => setInstructionsOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Instructions"
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[85vh] overflow-y-auto border border-stone-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-stone-800">How to use</h2>
                <button
                  type="button"
                  onClick={() => setInstructionsOpen(false)}
                  className="p-1.5 rounded text-stone-400 hover:text-stone-600 hover:bg-stone-100"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
              <ol className="list-decimal list-inside space-y-3 text-sm text-stone-700">
                <li>In Toast, go into <strong>Sales Summary</strong> and <strong>Labor Summary</strong>.</li>
                <li>Either <strong>email and save to device</strong> or <strong>pull a CSV</strong>.</li>
                <li>Drag the folders or files into the upload box on this page and wait for the system to say <strong>parsed</strong>.</li>
                <li>Add best and lowest sellers:
                  <ul className="list-disc list-inside ml-4 mt-1.5 space-y-0.5 text-stone-600">
                    <li>By hand in the Food / Cocktails / Wine / Beer boxes (top and lowest), or</li>
                    <li>Paste <strong>order detail</strong> (menu item, type - food/wine/cocktails/beer - quantity per line, tab or comma separated) into the paste box and click <strong>Extract top & lowest</strong> to fill top 3 and lowest 3 per category.</li>
                  </ul>
                </li>
                <li>Click <strong>Update top items and refresh draft</strong>, then review the email and send when ready.</li>
                <li>If discount numbers (e.g. trivia, friend & family) look wrong for the week, click <strong>Start over (same week)</strong>, then drag your Sales Summary folder in again so all numbers come from that upload.</li>
              </ol>
            </div>
          </div>
        </div>
      )}

      <div className="w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 xl:gap-8">
          {/* Left column: upload, status */}
          <div className="xl:col-span-5 space-y-6">
            {/* Upload */}
            <section className="bg-white rounded-lg border border-stone-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-stone-100">
                <h2 className="text-sm font-semibold text-stone-800">Upload reports</h2>
                <p className="text-xs text-stone-500 mt-0.5">Drop Toast CSVs or Excel here. Files are auto-classified (Sales, Labor, Product Mix) and parsed for the selected week.</p>
              </div>
          <div
            className={`
              mx-4 mb-4 rounded border-2 border-dashed p-8 text-center transition-all duration-150
              ${dragOver ? "border-amber-400 bg-amber-50/50" : "border-stone-200 bg-stone-50/50"}
              ${uploading ? "pointer-events-none opacity-70" : "cursor-pointer hover:border-stone-300 hover:bg-stone-50"}
            `}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={async (e) => {
              e.preventDefault();
              setDragOver(false);
              const files = await getFilesFromDrop(e.dataTransfer);
              handleUpload(files);
            }}
            onClick={() => document.getElementById("goldies-file-input")?.click()}
          >
            <input
              id="goldies-file-input"
              type="file"
              accept=".csv,.xls,.xlsx,.zip,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/zip"
              multiple
              className="hidden"
              onChange={(e) => { handleUpload(e.target.files); e.target.value = ""; }}
            />
            <input
              id="goldies-folder-input"
              type="file"
              // @ts-expect-error webkitdirectory is supported in Chrome/Safari/Edge for folder selection
              webkitdirectory=""
              multiple
              className="hidden"
              onChange={(e) => { handleUpload(e.target.files); e.target.value = ""; }}
            />
            {uploading ? (
              <p className="text-sm text-stone-600">Processing...</p>
            ) : (
              <>
                <p className="text-sm font-medium text-stone-700">Drag files or a folder here, or click to choose files</p>
                <p className="text-xs text-stone-500 mt-1">
                  <button
                    type="button"
                    onClick={(ev) => { ev.stopPropagation(); document.getElementById("goldies-folder-input")?.click(); }}
                    className="text-amber-600 hover:underline font-medium"
                  >
                    Select folder
                  </button>
                  {" "}to add all files from a folder. CSV or Excel; include &quot;sales&quot;, &quot;labor&quot;, or &quot;product mix&quot; in filenames if not auto-detected.
                </p>
              </>
            )}
          </div>
            </section>

            {/* Status */}
            <section className="bg-white rounded-lg border border-stone-200 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-stone-800 mb-3">This week&apos;s status</h2>
              <ul className="grid gap-2 sm:grid-cols-2 text-sm">
                <li className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${currentDoc.salesParsed ? "bg-emerald-500" : currentDoc.salesReceived ? "bg-amber-500" : "bg-stone-300"}`} />
                Sales {currentDoc.salesReceived ? (currentDoc.salesParsed ? "parsed" : "received, not parsed") : "missing"}
                </li>
                <li className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${currentDoc.laborParsed ? "bg-emerald-500" : currentDoc.laborReceived ? "bg-amber-500" : "bg-stone-300"}`} />
                  Labor {currentDoc.laborReceived ? (currentDoc.laborParsed ? "parsed" : "received, not parsed") : "missing"}
                </li>
                <li className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${currentDoc.productMixParsed ? "bg-emerald-500" : currentDoc.productMixReceived ? "bg-amber-500" : "bg-stone-300"}`} />
                  Product mix {currentDoc.productMixReceived ? (currentDoc.productMixParsed ? "parsed" : "received, not parsed") : "missing"}
                </li>
                <li className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${ready ? "bg-emerald-500" : "bg-stone-300"}`} />
                  Email draft {ready ? "ready" : "not ready"}
                </li>
                <li className="flex items-center gap-2 sm:col-span-2">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${currentDoc.sent ? "bg-emerald-500" : "bg-stone-300"}`} />
                  Sent {currentDoc.sent ? "yes" : "no"}
                </li>
              </ul>
              {currentDoc.parseErrors?.length ? (
                <div className="mt-3 rounded px-3 py-2 bg-amber-50 text-amber-800">
                  <p className="text-xs font-medium mb-0.5">Parse notes</p>
                  <p className="text-xs text-amber-700 mb-1">Warnings from uploads: files that couldn’t be classified (e.g. unknown type) or parser errors. Shown so you can fix filenames or ignore unneeded files.</p>
                  <p className="text-xs text-amber-700">{[...new Set(currentDoc.parseErrors)].join("; ")}</p>
                </div>
              ) : null}
            </section>

            {/* Recipients */}
            <section className="bg-white rounded-lg border border-stone-200 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-stone-800 mb-1">Recipients</h2>
              <p className="text-xs text-stone-500 mb-3">Team emails that receive the weekly recap when you click Send. Add or remove below; changes are saved.</p>
              <ul className="space-y-2 mb-4">
                {recipients.length === 0 && (
                  <li className="text-sm text-stone-500">No recipients yet. Add an email below.</li>
                )}
                {recipients.map((email) => (
                  <li key={email} className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-stone-700 truncate">{email}</span>
                    <button
                      type="button"
                      onClick={() => removeRecipient(email)}
                      disabled={recipientsLoading}
                      className="shrink-0 text-red-600 hover:underline text-xs font-medium disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addRecipient())}
                  placeholder="team@example.com"
                  className="flex-1 min-w-0 border border-stone-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 outline-none"
                />
                <button
                  type="button"
                  onClick={addRecipient}
                  disabled={recipientsLoading}
                  className="px-4 py-2 bg-amber-600 text-white rounded text-sm font-medium hover:bg-amber-700 disabled:opacity-50 transition-colors"
                >
                  {recipientsLoading ? "..." : "Add"}
                </button>
              </div>
            </section>
          </div>

          {/* Right column: top items, preview, actions, history */}
          <div className="xl:col-span-7 space-y-6">
            {/* Order detail paste: menu item, menu group type, quantity → top 3 + lowest 3 per category */}
            <section className="bg-white rounded-lg border border-stone-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-stone-100">
                <h2 className="text-sm font-semibold text-stone-800">Order detail (paste)</h2>
                <p className="text-xs text-stone-500 mt-0.5">Paste one line per item: <strong>menu item</strong>, <strong>menu group type</strong> (food, wine, cocktails, or beer), <strong>quantity sold</strong>. Tab or comma separated. We’ll fill top 3 and lowest 3 for each category.</p>
              </div>
              <div className="p-5">
                <textarea
                  value={pasteSalesByItem}
                  onChange={(e) => setPasteSalesByItem(e.target.value)}
                  placeholder={"e.g.: House Salad, Food, 42\nOld Fashioned, Cocktails, 28\n... (menu item, type, quantity per line)"}
                  rows={4}
                  className="w-full border border-stone-300 rounded-md px-3 py-2.5 text-sm text-stone-700 placeholder:text-stone-400 focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 outline-none resize-y min-h-[6rem]"
                />
                <div className="flex items-center gap-3 mt-3">
                  <button
                    type="button"
                    onClick={extractFromOrderDetailPaste}
                    className="px-4 py-2 bg-amber-600 text-white rounded-md text-sm font-medium hover:bg-amber-700 transition-colors"
                  >
                    Extract top & lowest
                  </button>
                  {pasteParseMessage && (
                    <p className={`text-sm ${pasteParseMessage.type === "ok" ? "text-emerald-600" : "text-red-600"}`}>
                      {pasteParseMessage.text}
                    </p>
                  )}
                </div>
              </div>
            </section>

            {/* Top Selling Items (this week) */}
            <section className="bg-white rounded-lg border border-stone-200 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-stone-800 mb-1">Top selling items (this week)</h2>
              <p className="text-xs text-stone-500 mb-4">Edit after uploads or paste order detail above and click Extract, then update to refresh the email draft.</p>
              <div className="grid gap-4 sm:grid-cols-2">
            {[
              { label: "Food", value: topFood, set: setTopFood },
              { label: "Wine", value: topWine, set: setTopWine },
              { label: "Beer", value: topBeer, set: setTopBeer },
              { label: "Cocktails", value: topCocktails, set: setTopCocktails },
            ].map(({ label, value, set }) => (
              <div key={label}>
                <label className="block text-xs font-medium text-stone-600 mb-1.5">{label}</label>
                <div className="flex gap-2">
                  {[0, 1, 2].map((i) => (
                    <input
                      key={i}
                      type="text"
                      value={value[i] ?? ""}
                      onChange={(e) => set((prev) => [...prev.slice(0, i), e.target.value, ...prev.slice(i + 1)].slice(0, 3))}
                      placeholder={i === 0 ? "1st" : i === 1 ? "2nd" : "3rd"}
                      className="flex-1 min-w-0 border border-stone-300 rounded px-2.5 py-2 text-sm focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 outline-none"
                    />
                  ))}
                </div>
              </div>
            ))}
              </div>
            {/* Lowest selling items (this week) - same style */}
              <h2 className="text-sm font-semibold text-stone-800 mt-6 mb-1">Lowest selling items (this week)</h2>
              <p className="text-xs text-stone-500 mb-4">Top 3 lowest by quantity per category. Paste order detail above to fill, or edit by hand.</p>
              <div className="grid gap-4 sm:grid-cols-2">
            {[
              { label: "Food", value: lowestFood, set: setLowestFood },
              { label: "Wine", value: lowestWine, set: setLowestWine },
              { label: "Beer", value: lowestBeer, set: setLowestBeer },
              { label: "Cocktails", value: lowestCocktails, set: setLowestCocktails },
            ].map(({ label, value, set }) => (
              <div key={label}>
                <label className="block text-xs font-medium text-stone-600 mb-1.5">{label}</label>
                <div className="flex gap-2">
                  {[0, 1, 2].map((i) => (
                    <input
                      key={i}
                      type="text"
                      value={value[i] ?? ""}
                      onChange={(e) => set((prev) => [...prev.slice(0, i), e.target.value, ...prev.slice(i + 1)].slice(0, 3))}
                      placeholder={i === 0 ? "1st lowest" : i === 1 ? "2nd" : "3rd"}
                      className="flex-1 min-w-0 border border-stone-300 rounded px-2.5 py-2 text-sm focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 outline-none"
                    />
                  ))}
                </div>
              </div>
            ))}
              </div>
              <button
                type="button"
                onClick={updateTopItems}
                className="mt-4 px-4 py-2 bg-stone-200 text-stone-800 rounded text-sm font-medium hover:bg-stone-300 transition-colors min-h-[2.5rem]"
              >
                Update top items and refresh draft
              </button>
            </section>

            {/* Email preview */}
            <section className="bg-white rounded-lg border border-stone-200 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-stone-800 mb-3">Email preview</h2>
              <pre className="bg-stone-100 rounded p-4 text-xs font-mono text-stone-700 whitespace-pre-wrap overflow-x-auto max-h-[28rem] overflow-y-auto border border-stone-200">
                {currentDoc.generatedEmailText || "(No generated email yet)"}
              </pre>
            </section>

            {/* Actions + message */}
            <section className="bg-white rounded-lg border border-stone-200 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-stone-800 mb-3">Actions</h2>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => runAction("reprocess")}
                  disabled={!!actionLoading}
                  className="px-4 py-2.5 bg-stone-200 text-stone-800 rounded text-sm font-medium hover:bg-stone-300 disabled:opacity-50 transition-colors min-h-[2.5rem]"
                >
                  {actionLoading === "reprocess" ? "..." : "Reprocess week"}
                </button>
                <button
                  type="button"
                  onClick={() => setSendConfirmOpen(true)}
                  disabled={!!actionLoading || !ready}
                  className="px-4 py-2.5 bg-amber-600 text-white rounded text-sm font-medium hover:bg-amber-700 disabled:opacity-50 transition-colors min-h-[2.5rem]"
                >
                  Send email now
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setActionLoading("clear");
                    setMessage(null);
                    try {
                      const res = await fetch("/api/sophia-weekly/clear-week-product-mix", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ weekKey, restaurantId }),
                      });
                      const data = await res.json();
                      if (!res.ok) {
                        setMessage({ type: "err", text: data.error ?? "Clear failed" });
                        return;
                      }
                      setTopFood(["", "", ""]);
                      setTopWine(["", "", ""]);
                      setTopBeer(["", "", ""]);
                      setTopCocktails(["", "", ""]);
                      setLowestFood(["", "", ""]);
                      setLowestWine(["", "", ""]);
                      setLowestBeer(["", "", ""]);
                      setLowestCocktails(["", "", ""]);
                      setMessage({ type: "ok", text: "Same week fully cleared. All uploaded files' data (sales, labor) and top/lowest sellers are wiped. Drag your Sales Summary and Labor folders in again to start fresh. History unchanged." });
                      await fetchWeek(weekKey);
                    } catch (e) {
                      setMessage({ type: "err", text: e instanceof Error ? e.message : "Clear failed" });
                    } finally {
                      setActionLoading(null);
                    }
                  }}
                  disabled={!!actionLoading}
                  className="px-4 py-2.5 border border-stone-300 text-stone-700 rounded text-sm font-medium hover:bg-stone-100 disabled:opacity-50 transition-colors min-h-[2.5rem]"
                >
                  {actionLoading === "clear" ? "..." : "Start over (same week)"}
                </button>
                <p className="text-xs text-stone-500 mt-1">Wipes all uploaded files and top/lowest items for this week so you can re-upload fresh.</p>
                <button
                  type="button"
                  onClick={() => startOver()}
                  disabled={!!actionLoading}
                  className="px-4 py-2.5 border border-stone-300 text-stone-700 rounded text-sm font-medium hover:bg-stone-100 disabled:opacity-50 transition-colors min-h-[2.5rem]"
                >
                  Start over (next week)
                </button>
              </div>
              {message && (
                <p className={`mt-4 text-sm rounded px-3 py-2.5 ${message.type === "ok" ? "text-emerald-800 bg-emerald-50" : "text-red-800 bg-red-50"}`}>
                  {message.text}
                </p>
              )}
            </section>

            {/* Report history (all saved reports) */}
            <section className="bg-white rounded-lg border border-stone-200 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-stone-800 mb-3">Report history</h2>
              <p className="text-xs text-stone-500 mb-3">All saved reports. Click View to open that week.</p>
              <ul className="space-y-2 max-h-64 overflow-y-auto">
                {history.length === 0 && <li className="text-sm text-stone-500">No reports yet.</li>}
                {history.map((w) => (
                  <li key={w.weekKey} className="flex items-center gap-3 text-sm flex-wrap">
                    <span className="text-stone-700">{getWeekRangeLabel(w.weekKey)}</span>
                    <span className="font-mono text-stone-500 text-xs">{w.weekKey}</span>
                    <span className={w.sent ? "text-emerald-600" : "text-stone-500"}>{w.sent ? "Sent" : "Not sent"}</span>
                    <button
                      type="button"
                      onClick={() => setWeekKey(w.weekKey)}
                      className="text-amber-700 hover:underline font-medium py-1"
                    >
                      View
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>


        {/* History of best sellers – full width at bottom */}
        <section className="mt-10 w-full">
          <div className="bg-white rounded-lg border border-stone-200 shadow-sm overflow-hidden">
            <button
              type="button"
              onClick={() => setBestSellersDropdownOpen((o) => !o)}
              className="w-full flex items-center justify-between px-5 py-4 text-left text-sm font-semibold text-stone-800 hover:bg-stone-50 transition-colors"
            >
              <span>History of best sellers</span>
              <span className="text-stone-400">{bestSellersDropdownOpen ? "▼" : "▶"}</span>
            </button>
            {bestSellersDropdownOpen && (
              <div className="px-5 pb-5 pt-0 border-t border-stone-100">
                <p className="text-xs text-stone-500 mb-3">From sent emails only. Wipe clears unsent weeks only; sent history is kept.</p>
                <div className="flex flex-wrap gap-2 mb-4">
                  <button
                    type="button"
                    onClick={async () => {
                      setWipingBestSellers(true);
                      setMessage(null);
                      try {
                        const res = await fetch(
                          `/api/sophia-weekly/wipe-best-sellers?restaurantId=${encodeURIComponent(restaurantId)}`,
                          { method: "POST" }
                        );
                        const data = await res.json();
                        if (!res.ok) {
                          setMessage({ type: "err", text: data.error ?? "Wipe failed" });
                          return;
                        }
                        setMessage({ type: "ok", text: `Cleared best seller data from ${data.wiped} week(s).` });
                        setOverallBestSellers(null);
                        await fetchBestSellers();
                        await fetchWeek(weekKey);
                      } catch (e) {
                        setMessage({ type: "err", text: e instanceof Error ? e.message : "Wipe failed" });
                      } finally {
                        setWipingBestSellers(false);
                      }
                    }}
                    disabled={wipingBestSellers}
                    className="px-3 py-1.5 text-xs font-medium rounded border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    {wipingBestSellers ? "..." : "Wipe best seller history"}
                  </button>
                </div>
                {!overallBestSellers || overallBestSellers.weeksCount === 0 ? (
                  <p className="text-sm text-stone-500">No sent reports yet. Send weekly emails to build history.</p>
                ) : (overallBestSellers.topFoodItems.length + overallBestSellers.topCocktailItems.length + overallBestSellers.topWineItems.length + overallBestSellers.topBeerItems.length) === 0 ? (
                  <p className="text-sm text-stone-500">No best seller data in sent reports.</p>
                ) : (
                  <>
                    <span className="text-xs font-semibold text-stone-600 uppercase tracking-wide">Top sellers</span>
                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-6">
                      {[
                        { label: "Food", items: overallBestSellers.topFoodItems },
                        { label: "Wine", items: overallBestSellers.topWineItems },
                        { label: "Beer", items: overallBestSellers.topBeerItems },
                        { label: "Cocktails", items: overallBestSellers.topCocktailItems },
                      ].map(({ label, items }) => (
                        <div key={"top-" + label}>
                          <span className="text-xs font-medium text-stone-600">{label}</span>
                          <ul className="mt-1 space-y-0.5 text-sm text-stone-700">
                            {items.length === 0 ? (
                              <li className="text-stone-500">No items</li>
                            ) : (
                              items.map((item, i) => (
                                <li key={"top-" + label + "-" + i + "-" + item.name}>
                                  {item.name}
                                  <span className="text-stone-400 ml-1">({item.count})</span>
                                </li>
                              ))
                            )}
                          </ul>
                        </div>
                      ))}
                    </div>
                    <span className="text-xs font-semibold text-stone-600 uppercase tracking-wide">Lowest sellers</span>
                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                      {[
                        { label: "Food", items: overallBestSellers.lowestFoodItems ?? [] },
                        { label: "Wine", items: overallBestSellers.lowestWineItems ?? [] },
                        { label: "Beer", items: overallBestSellers.lowestBeerItems ?? [] },
                        { label: "Cocktails", items: overallBestSellers.lowestCocktailItems ?? [] },
                      ].map(({ label, items }) => (
                        <div key={"low-" + label}>
                          <span className="text-xs font-medium text-stone-600">{label}</span>
                          <ul className="mt-1 space-y-0.5 text-sm text-stone-700">
                            {items.length === 0 ? (
                              <li className="text-stone-500">No items</li>
                            ) : (
                              items.map((item, i) => (
                                <li key={"low-" + label + "-" + i + "-" + item.name}>
                                  {item.name}
                                  <span className="text-stone-400 ml-1">({item.count})</span>
                                </li>
                              ))
                            )}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Send confirmation modal: shows exact subject + body, Approve sends it */}
      {sendConfirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50"
          onClick={() => setSendConfirmOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="send-confirm-title"
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col border border-stone-200"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="send-confirm-title" className="text-lg font-semibold text-stone-800 px-5 pt-5 pb-2">
              Confirm send
            </h2>
            <p className="text-sm text-stone-500 px-5 pb-3">
              This is exactly what will be sent. Approve to send, or Cancel to go back.
            </p>
            <div className="px-5 space-y-2 flex-shrink-0">
              <div>
                <span className="text-xs font-medium text-stone-500">Subject:</span>
                <p className="text-sm font-medium text-stone-800">
                  Weekly Recap {getWeekRangeLabel(weekKey)}
                </p>
              </div>
              <span className="text-xs font-medium text-stone-500">Body:</span>
            </div>
            <pre className="flex-1 min-h-0 mx-5 mb-4 p-4 bg-stone-100 rounded-lg text-xs font-mono text-stone-700 whitespace-pre-wrap overflow-auto border border-stone-200">
              {currentDoc.generatedEmailText || "(No content)"}
            </pre>
            <div className="flex gap-3 px-5 pb-5">
              <button
                type="button"
                onClick={() => {
                  setSendConfirmOpen(false);
                  runAction("send");
                }}
                disabled={!!actionLoading}
                className="px-4 py-2.5 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
              >
                {actionLoading === "send" ? "Sending…" : "Approve & send"}
              </button>
              <button
                type="button"
                onClick={() => setSendConfirmOpen(false)}
                className="px-4 py-2.5 border border-stone-300 text-stone-700 rounded-lg text-sm font-medium hover:bg-stone-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
