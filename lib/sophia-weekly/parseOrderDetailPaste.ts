/**
 * Strict parser for Toast order-detail paste: item, menuGroup, salesCategory, qty, sales.
 * Categorizes by salesCategory only; excludes garbage rows; merges duplicates; returns top 3 and lowest 3 per category.
 */

export type MixRow = {
  item: string;
  menuGroup: string;
  salesCategory: string;
  qty: number;
  sales: number;
};

export type SellerCategory = "food" | "wine" | "beer" | "cocktails" | null;

export function parseMixRows(raw: string): MixRow[] {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return lines
    .map((line) => {
      const byTab = line.split("\t").map((s) => s.trim());
      if (byTab.length >= 5) return byTab;
      const bySpaces = line.split(/\s{2,}/).map((s) => s.trim());
      return bySpaces.length >= 5 ? bySpaces : null;
    })
    .filter((parts): parts is string[] => parts != null && parts.length >= 5)
    .map((parts) => {
      const [item, menuGroup, salesCategory, qtyRaw, salesRaw] = parts;
      return {
        item: item ?? "",
        menuGroup: menuGroup ?? "",
        salesCategory: salesCategory ?? "",
        qty: Number((qtyRaw ?? "").replace(/,/g, "")),
        sales: Number((salesRaw ?? "").replace(/[$,]/g, "")),
      };
    })
    .filter((r) => !Number.isNaN(r.qty) && !Number.isNaN(r.sales));
}

export function getSellerCategory(row: MixRow): SellerCategory {
  const salesCat = row.salesCategory.toLowerCase().trim();
  if (salesCat === "wine") return "wine";
  if (salesCat === "beer") return "beer";
  if (salesCat === "cocktails") return "cocktails";
  if (salesCat === "food menu" || salesCat === "online ordering") return "food";
  return null;
}

export function shouldExcludeRow(row: MixRow): boolean {
  const badSalesCats = new Set([
    "gift cards",
    "liquor",
    "n/a beverages",
    "no menu",
    "drink specials menus",
  ]);

  const badMenuGroups = new Set(["open drink", "open food"]);

  if (badSalesCats.has(row.salesCategory.toLowerCase().trim())) return true;
  if (badMenuGroups.has(row.menuGroup.toLowerCase().trim())) return true;
  if (!row.item?.trim() || row.qty <= 0) return true;

  return false;
}

const ITEM_ALIASES: Record<string, string> = {
  "Meat Lover's Pie": "Meat Lover's",
  "The Pasture Pie (omnivore)": "The Pasture",
  "The Farm Pie (vegan special)": "The Farm",
  "The Curd Pie (vegetarian pie)": "The Curd",
  "Roasted Radicchio": "Radicchio",
  "Goldie's Manhatten": "Goldie's Manhattan",
};

export function normalizeItemName(item: string): string {
  const name = item.trim();
  return ITEM_ALIASES[name] ?? name;
}

export type AggregatedItem = {
  item: string;
  qty: number;
  sales: number;
};

export function aggregateItems(
  rows: MixRow[],
  target: SellerCategory
): AggregatedItem[] {
  if (target === null) return [];
  const map = new Map<string, AggregatedItem>();

  for (const row of rows) {
    if (shouldExcludeRow(row)) continue;
    if (getSellerCategory(row) !== target) continue;

    const item = normalizeItemName(row.item);

    const existing = map.get(item);
    if (existing) {
      existing.qty += row.qty;
      existing.sales += row.sales;
    } else {
      map.set(item, { item, qty: row.qty, sales: row.sales });
    }
  }

  return Array.from(map.values());
}

export function topThree(items: AggregatedItem[]): string[] {
  return [...items]
    .sort((a, b) => {
      if (b.qty !== a.qty) return b.qty - a.qty;
      if (b.sales !== a.sales) return b.sales - a.sales;
      return a.item.localeCompare(b.item);
    })
    .slice(0, 3)
    .map((x) => x.item);
}

/** Lowest-selling items must not include "side"; skip those and take the next. */
function isSideItem(name: string): boolean {
  return name.toLowerCase().includes("side");
}

export function lowestThree(items: AggregatedItem[]): string[] {
  return [...items]
    .filter((x) => x.qty > 0 && !isSideItem(x.item))
    .sort((a, b) => {
      if (a.qty !== b.qty) return a.qty - b.qty;
      if (a.sales !== b.sales) return a.sales - b.sales;
      return a.item.localeCompare(b.item);
    })
    .slice(0, 3)
    .map((x) => x.item);
}

export type TopAndLowestResult = {
  topFood: string[];
  topWine: string[];
  topBeer: string[];
  topCocktails: string[];
  lowestFood: string[];
  lowestWine: string[];
  lowestBeer: string[];
  lowestCocktails: string[];
};

export function extractTopAndLowest(raw: string): TopAndLowestResult {
  const rows = parseMixRows(raw);

  const foodItems = aggregateItems(rows, "food");
  const wineItems = aggregateItems(rows, "wine");
  const beerItems = aggregateItems(rows, "beer");
  const cocktailItems = aggregateItems(rows, "cocktails");

  return {
    topFood: topThree(foodItems),
    topWine: topThree(wineItems),
    topBeer: topThree(beerItems),
    topCocktails: topThree(cocktailItems),
    lowestFood: lowestThree(foodItems),
    lowestWine: lowestThree(wineItems),
    lowestBeer: lowestThree(beerItems),
    lowestCocktails: lowestThree(cocktailItems),
  };
}
