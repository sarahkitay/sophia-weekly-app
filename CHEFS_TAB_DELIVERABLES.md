# Chef's Tab – Implementation Deliverables

## 1. Files created and modified

### New files (Chef's Tab)

**Lib – types, engine, utils**
- `lib/chefs-tab/types.ts` – Dish, DishIngredient, Ingredient, Invoice, InvoiceLineItem, CSV types
- `lib/chefs-tab/firestore.ts` – Collection names, docWithId, toIso
- `lib/chefs-tab/units.ts` – Unit normalization, conversion, ingredientPortionCost
- `lib/chefs-tab/costing.ts` – suggestedPrice, actualFoodCostPercent, scenarioPrices, costingStatus
- `lib/chefs-tab/normalize.ts` – normalizeIngredientName
- `lib/chefs-tab/matching.ts` – matchLineItemToIngredients (exact, alias, fuzzy)
- `lib/chefs-tab/csv.ts` – parseCsv, mapRowToParsed

**Tests**
- `lib/chefs-tab/__tests__/units.test.ts` – Unit conversion and portion cost tests
- `lib/chefs-tab/__tests__/costing.test.ts` – Pricing formula tests
- `vitest.config.ts` – Vitest config

**API routes**
- `app/api/chefs-tab/dashboard/route.ts` – GET dashboard stats
- `app/api/chefs-tab/dishes/route.ts` – GET/POST dishes
- `app/api/chefs-tab/dishes/[id]/route.ts` – GET/PATCH/DELETE dish
- `app/api/chefs-tab/dishes/[id]/ingredients/route.ts` – GET/POST dish ingredients
- `app/api/chefs-tab/dishes/[id]/ingredients/[ingId]/route.ts` – PATCH/DELETE dish ingredient
- `app/api/chefs-tab/ingredients/route.ts` – GET/POST ingredients
- `app/api/chefs-tab/ingredients/[id]/route.ts` – GET/PATCH/DELETE ingredient
- `app/api/chefs-tab/ingredients/match/route.ts` – GET match suggestions for a line item
- `app/api/chefs-tab/invoices/route.ts` – GET/POST invoices
- `app/api/chefs-tab/invoices/parse-csv/route.ts` – POST parse CSV for import
- `app/api/chefs-tab/invoices/[id]/route.ts` – GET invoice with line items
- `app/api/chefs-tab/invoices/[id]/line-items/[lineId]/route.ts` – PATCH map line to ingredient
- `app/api/chefs-tab/costing/route.ts` – GET costing for all dishes
- `app/api/chefs-tab/seed/route.ts` – POST seed demo data

**App – layout and pages**
- `app/chefs-tab/ChefsTabContext.tsx` – Restaurant ID context
- `app/chefs-tab/layout.tsx` – Header, restaurant switcher, subnav (Dashboard, Dishes, Ingredients, Invoices, Costing)
- `app/chefs-tab/page.tsx` – Dashboard
- `app/chefs-tab/dishes/page.tsx` – Dishes list
- `app/chefs-tab/dishes/new/page.tsx` – Create dish
- `app/chefs-tab/dishes/[id]/page.tsx` – Dish detail
- `app/chefs-tab/ingredients/page.tsx` – Ingredients list
- `app/chefs-tab/invoices/page.tsx` – Invoices list
- `app/chefs-tab/invoices/upload/page.tsx` – CSV upload and column mapping
- `app/chefs-tab/invoices/[id]/page.tsx` – Invoice detail and line-item mapping
- `app/chefs-tab/costing/page.tsx` – Costing / pricing table

### Modified files

- `app/goldies/page.tsx` – Added Link import and “Chef’s Tab” item with icon in hamburger menu
- `package.json` – Added `test` and `test:watch` scripts (vitest)

---

## 2. Database (Firestore) changes

No migrations; Firestore is schema-less. New collections (all scoped by `restaurantId`):

| Collection | Purpose |
|------------|--------|
| `chefsTab_dishes` | Dish name, category, current menu price, target food cost %, garnish buffer |
| `chefsTab_dish_ingredients` | Recipe lines: dishId, ingredientId (nullable), rawName, quantityRequired, unitRequired, prepYieldPercent, sortOrder |
| `chefsTab_ingredients` | Canonical name, normalized name, default unit, aliases array |
| `chefsTab_invoices` | Vendor, invoice number/date, sourceType (csv/pdf/manual), parse status |
| `chefsTab_invoice_line_items` | invoiceId, ingredientId (nullable), raw item name, quantity, unit, total cost, isMapped |

**Composite indexes** (Firebase will prompt when first used):
- `chefsTab_dishes`: `restaurantId` (ASC) + `updatedAt` (DESC)
- `chefsTab_ingredients`: `restaurantId` (ASC) + `canonicalName` (ASC)
- `chefsTab_invoices`: `restaurantId` (ASC) + `updatedAt` (DESC)
- `chefsTab_invoice_line_items`: `invoiceId` (ASC) + `isMapped` (ASC) for costing queries

---

## 3. Routes added

| Method | Path | Purpose |
|--------|------|--------|
| GET | `/chefs-tab` | Dashboard (redirect / same as dashboard) |
| GET | `/chefs-tab/dashboard` | Dashboard (nav points to `/chefs-tab`) |
| GET/POST | `/chefs-tab/dishes` | List / create dishes |
| GET/PATCH/DELETE | `/chefs-tab/dishes/[id]` | Dish detail / update / delete |
| GET/POST | `/chefs-tab/dishes/[id]/ingredients` | List / add recipe ingredients |
| PATCH/DELETE | `/chefs-tab/dishes/[id]/ingredients/[ingId]` | Update / remove recipe line |
| GET/POST | `/chefs-tab/ingredients` | List / create ingredients |
| GET/PATCH/DELETE | `/chefs-tab/ingredients/[id]` | Ingredient detail / update / delete |
| GET | `/chefs-tab/ingredients/match` | Match suggestions for invoice line |
| GET/POST | `/chefs-tab/invoices` | List / create invoice (e.g. from CSV) |
| POST | `/api/chefs-tab/invoices/parse-csv` | Parse CSV, return headers + rows |
| GET | `/chefs-tab/invoices/[id]` | Invoice detail and line mapping |
| PATCH | `/api/chefs-tab/invoices/[id]/line-items/[lineId]` | Map line item to ingredient |
| GET | `/chefs-tab/costing` | Costing / pricing table |
| GET | `/api/chefs-tab/dashboard` | Dashboard stats |
| GET | `/api/chefs-tab/costing` | Costing data for all dishes |
| POST | `/api/chefs-tab/seed` | Seed demo data |

---

## 4. Components and UI

- **Layout**: Shared Chef’s Tab layout with restaurant switcher (same localStorage key as Weekly Recap) and subnav.
- **No separate component library**: Tables, forms, cards, and buttons use Tailwind and inline JSX, consistent with the existing goldies page.
- **ChefsTabContext**: Provides `restaurantId` and `setRestaurantId` to all Chef’s Tab pages.

---

## 5. Services / utilities

- **Units** (`lib/chefs-tab/units.ts`): normalizeUnit, convertUnits, ingredientPortionCost (weight/volume/each).
- **Costing** (`lib/chefs-tab/costing.ts`): suggestedPrice, actualFoodCostPercent, grossProfit, scenarioPrices (22/24/26/28%), costingStatus.
- **Matching** (`lib/chefs-tab/matching.ts`): matchLineItemToIngredients (exact → alias → fuzzy), confidence and source.
- **CSV** (`lib/chefs-tab/csv.ts`): parseCsv, mapRowToParsed with column mapping.

---

## 6. What is fully working

- Chef’s Tab in hamburger menu; navigation to `/chefs-tab` and subnav (Dashboard, Dishes, Ingredients, Invoices, Costing).
- Restaurant scoping: all data filtered by `restaurantId` (same as Weekly Recap).
- Create dish with name, category, description, menu price, target food cost %, garnish buffer, and recipe ingredients (name, qty, unit, prep yield %).
- Dishes list with plate cost, menu price, actual food cost %, suggested price @ 24%, status.
- Dish detail with recipe ingredients, costing summary, scenario pricing, status badges.
- Upload CSV invoice: parse → preview → column mapping → vendor/date → save invoice and line items.
- Invoice detail: list line items, “Suggest” loads match suggestions; dropdown to map to existing ingredient; clear mapping.
- Ingredients list (searchable); ingredients created when mapping invoice lines (or via API).
- Costing page: table with plate cost, menu price, actual food cost %, suggested @ 24%, price delta, gross profit, status (on target / slightly off / underpriced / missing / partial).
- Dashboard: total dishes, total invoices, unmapped line items count, dishes needing attention, recent invoices.
- Seed: `POST /api/chefs-tab/seed?restaurantId=goldies` creates 3 dishes (Braised Short Rib, Pasta Primavera, Caesar Salad), 7 ingredients, 1 invoice, 7 mapped line items.
- Unit conversion and costing formulas covered by unit tests.

---

## 7. What is scaffolded or limited

- **PDF invoice**: Not implemented; CSV only. API and types support `sourceType: "pdf"` and `fileUrl` for a future PDF/OCR flow.
- **Create ingredient from invoice UI**: Mapping only to existing ingredients. “Create new ingredient” from invoice detail is not in the UI (can be added via Ingredients API and then selected).
- **Edit dish**: No dedicated edit page; dish detail is read-only. Edit can be added via PATCH to `/api/chefs-tab/dishes/[id]` and an edit form.
- **Bulk ingredient mapping**: Single-line mapping only; no “apply to all similar” or bulk confirm.
- **Export costing to CSV**: Not implemented.
- **Cost trend / last known cost on ingredient**: Not implemented; costing uses latest mapped invoice line per ingredient.

---

## 8. Assumptions and limitations

- **Tenancy**: Current MVP uses client-selected restaurant scoping for data segmentation, but does not yet implement server-enforced tenant authorization.
- **Firestore indexes**: Composite indexes for `restaurantId` + `updatedAt` and `restaurantId` + `canonicalName` may be required; create when Firebase suggests them.
- **Units**: Weight (g, kg, oz, lb) and volume (ml, l, tsp, tbsp, cup, pint, quart, gallon) and “each” are supported. No automatic “each” to weight/volume.
- **Latest cost**: Costing uses the most recent invoice (by `updatedAt`) that has a mapped line for each ingredient; one cost per ingredient.
- **Tests**: Vitest; run with `npm run test`. If vitest is not installed, run `npm install -D vitest` then `npm run test`.

---

## 9. Next phase recommendations

1. **PDF invoice OCR**  
   Integrate an OCR or PDF-parsing service (e.g. Google Document AI, or a dedicated invoice API), store extracted line items in `chefsTab_invoice_line_items`, and reuse the same mapping and costing flow.

2. **Vendor integrations**  
   Optional sync with vendor portals or accounting systems to pull invoices or prices by SKU and pre-fill line items or ingredient costs.

3. **Recipe yield intelligence**  
   Use prep yield % and pack sizes to suggest recipe quantities or flag waste; optional “yield from invoice” when pack size and unit match.

4. **Price change alerts**  
   When a new invoice is mapped, compare new vs previous cost per ingredient and surface “cost increased / decreased” for dishes using that ingredient; optional email or in-app notification.

5. **Bulk mapping and export**  
   “Map all exact matches” and “Export costing table to CSV” for reporting and updates in spreadsheets.

6. **Edit dish and create ingredient from invoice**  
   Add dish edit page and “Create new ingredient” from invoice detail so operators can fix or add ingredients without leaving the invoice flow.
