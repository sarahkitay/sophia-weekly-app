import * as XLSX from "xlsx";
import type { ProductMixData } from "../types";
import { normalizeLabel } from "../utils";

/** Category/department labels that must not be stored as "top selling items" (from sales reports or headers). */
const CATEGORY_LABELS = new Set([
  "food", "wine", "beer", "cocktails", "liquor", "spirits", "draft", "bottled",
  "na beverage", "na bev", "non-alcoholic", "entree", "entrees", "other",
  "category", "department", "type", "total", "net sales", "revenue",
]);

function isCategoryLabel(name: string): boolean {
  const n = normalizeLabel(name);
  if (!n || n.length < 2) return true;
  return CATEGORY_LABELS.has(n) || CATEGORY_LABELS.has(n.replace(/\s+/g, " "));
}

/**
 * Product Mix export: top-selling items for Food, Cocktails, Wine, Beer.
 * Only real item names; category/department labels are filtered out (no mock data).
 */
function parseCsvOrSheet(buffer: Buffer): string[][] {
  const u8 = new Uint8Array(buffer);
  const wb = XLSX.read(u8, { type: "array", raw: true });
  const first = wb.SheetNames[0];
  if (!first) return [];
  const ws = wb.Sheets[first];
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
}

function findCol(header: string[], ...names: string[]): number {
  const lower = header.map((h) => normalizeLabel(String(h ?? "")));
  for (const n of names) {
    const idx = lower.findIndex((h) => h.includes(normalizeLabel(n)) || normalizeLabel(n).includes(h));
    if (idx >= 0) return idx;
  }
  return -1;
}

export function parseProductMixReport(buffer: Buffer): { data: ProductMixData; errors: string[] } {
  const errors: string[] = [];
  const data: ProductMixData = {
    topFoodItems: [],
    topCocktailItems: [],
    topWineItems: [],
    topBeerItems: [],
  };
  const rows = parseCsvOrSheet(buffer);
  if (!rows.length) {
    errors.push("No rows in product mix file");
    return { data, errors };
  }

  const header = rows[0].map((c) => String(c ?? ""));
  const nameCol = findCol(header, "item", "name", "product", "menu item", "description");
  const categoryCol = findCol(header, "category", "type", "department", "group");
  const qtyCol = findCol(header, "quantity", "qty", "count", "sold", "units");
  const amountCol = findCol(header, "amount", "revenue", "sales", "total");
  const sortIdx = qtyCol >= 0 ? qtyCol : amountCol >= 0 ? amountCol : -1;
  if (sortIdx < 0) {
    return { data: { topFoodItems: [], topCocktailItems: [], topWineItems: [], topBeerItems: [] }, errors: ["No quantity or amount column found; not a product mix report"] };
  }

  const nameIdx = nameCol >= 0 ? nameCol : 0;
  const catIdx = categoryCol >= 0 ? categoryCol : 1;

  type Row = { name: string; category: string; sortVal: number };
  const items: Row[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const name = String(row[nameIdx] ?? "").trim();
    const category = normalizeLabel(String(row[catIdx] ?? ""));
    const sortVal = Number(String(row[sortIdx] ?? "").replace(/[$,]/g, "")) || 0;
    if (sortVal <= 0) continue;
    if (!name || isCategoryLabel(name)) continue;
    items.push({ name, category, sortVal });
  }

  const byCategory = new Map<string, Row[]>();
  for (const item of items) {
    const cat = item.category || "other";
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(item);
  }

  const top = (categoryKeys: string[], limit = 3): string[] => {
    const combined: Row[] = [];
    for (const key of byCategory.keys()) {
      const match = categoryKeys.some((k) => key.includes(k) || k.includes(key));
      if (match) combined.push(...(byCategory.get(key) ?? []));
    }
    combined.sort((a, b) => b.sortVal - a.sortVal);
    return combined.slice(0, limit).map((r) => r.name);
  };

  data.topFoodItems = top(["food", "entree", "entrees"]);
  data.topCocktailItems = top(["cocktail", "cocktails", "liquor", "spirits"]);
  data.topWineItems = top(["wine", "wines"]);
  data.topBeerItems = top(["beer", "beers", "draft"]);

  return { data, errors };
}
