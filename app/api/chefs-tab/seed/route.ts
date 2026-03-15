import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";
import { isValidRestaurantId, DEFAULT_RESTAURANT_ID } from "@/lib/sophia-weekly/restaurants";
import { COLLECTIONS } from "@/lib/chefs-tab/firestore";
import { normalizeIngredientName } from "@/lib/chefs-tab/normalize";

/**
 * POST /api/chefs-tab/seed?restaurantId=goldies
 * Seeds demo data: 3 dishes, 1 invoice, 6–10 line items, some mapped.
 */
export async function POST(request: NextRequest) {
  const restaurantId = request.nextUrl.searchParams.get("restaurantId") ?? DEFAULT_RESTAURANT_ID;
  if (!isValidRestaurantId(restaurantId)) {
    return NextResponse.json({ error: "Invalid restaurantId" }, { status: 400 });
  }
  try {
    const db = getAdminDb();
    const now = new Date().toISOString();
    const ts = Timestamp.fromDate(new Date(now));

    const ingredients: Array<{ id: string; name: string; unit: string }> = [];
    const ingRef = db.collection(COLLECTIONS.ingredients);
    const ingNames = ["short rib", "potatoes", "cream", "romaine", "parmesan", "pasta", "vegetables"];
    for (const name of ingNames) {
      const ref = await ingRef.add({
        restaurantId,
        canonicalName: name,
        normalizedName: normalizeIngredientName(name),
        defaultUnit: name === "cream" ? "cup" : name === "short rib" ? "lb" : "each",
        aliases: [],
        createdAt: ts,
        updatedAt: ts,
      });
      ingredients.push({ id: ref.id, name, unit: name === "cream" ? "cup" : name === "short rib" ? "lb" : "each" });
    }

    const getIngId = (name: string) => ingredients.find((i) => i.name === name)?.id ?? ingredients[0].id;

    const dishesData = [
      { name: "Braised Short Rib", category: "Mains", ingredients: [{ name: "short rib", qty: 8, unit: "oz" }, { name: "potatoes", qty: 4, unit: "oz" }] },
      { name: "Pasta Primavera", category: "Mains", ingredients: [{ name: "pasta", qty: 1, unit: "each" }, { name: "vegetables", qty: 2, unit: "oz" }, { name: "cream", qty: 0.25, unit: "cup" }] },
      { name: "Caesar Salad", category: "Salads", ingredients: [{ name: "romaine", qty: 1, unit: "each" }, { name: "parmesan", qty: 0.5, unit: "oz" }] },
    ];

    for (const d of dishesData) {
      const dishRef = await db.collection(COLLECTIONS.dishes).add({
        restaurantId,
        name: d.name,
        slug: d.name.toLowerCase().replace(/\s+/g, "-"),
        category: d.category,
        description: null,
        currentMenuPrice: d.name === "Braised Short Rib" ? 28 : d.name === "Caesar Salad" ? 14 : null,
        targetFoodCostPercent: 24,
        garnishBufferCost: 0.5,
        notes: null,
        createdAt: ts,
        updatedAt: ts,
      });
      let order = 0;
      for (const ing of d.ingredients) {
        await db.collection(COLLECTIONS.dishIngredients).add({
          dishId: dishRef.id,
          ingredientId: getIngId(ing.name),
          rawName: ing.name,
          quantityRequired: ing.qty,
          unitRequired: ing.unit,
          prepYieldPercent: null,
          notes: null,
          sortOrder: order++,
          createdAt: ts,
          updatedAt: ts,
        });
      }
    }

    const invRef = await db.collection(COLLECTIONS.invoices).add({
      restaurantId,
      vendorName: "Demo Vendor",
      invoiceNumber: "INV-001",
      invoiceDate: new Date().toISOString().slice(0, 10),
      sourceType: "csv",
      uploadStatus: "uploaded",
      parseStatus: "parsed",
      createdAt: ts,
      updatedAt: ts,
    });

    const lineItems = [
      { raw: "beef short rib 40lb case", ing: "short rib", qty: 40, unit: "lb", cost: 180 },
      { raw: "russet potatoes 20 lb", ing: "potatoes", qty: 20, unit: "lb", cost: 18 },
      { raw: "heavy cream qt", ing: "cream", qty: 1, unit: "quart", cost: 8 },
      { raw: "romaine lettuce case", ing: "romaine", qty: 12, unit: "each", cost: 24 },
      { raw: "parmesan wedge", ing: "parmesan", qty: 1, unit: "each", cost: 22 },
      { raw: "pasta penne 1lb", ing: "pasta", qty: 1, unit: "lb", cost: 4 },
      { raw: "mixed vegetables 2lb", ing: "vegetables", qty: 2, unit: "lb", cost: 6 },
    ];

    for (const line of lineItems) {
      const ingId = getIngId(line.ing);
      await db.collection(COLLECTIONS.invoiceLineItems).add({
        invoiceId: invRef.id,
        ingredientId: ingId,
        rawItemName: line.raw,
        normalizedItemName: normalizeIngredientName(line.raw),
        quantityPurchased: line.qty,
        purchaseUnit: line.unit,
        totalCost: line.cost,
        unitCost: line.cost / line.qty,
        isMapped: true,
        matchConfidence: 1,
        createdAt: ts,
        updatedAt: ts,
      });
    }

    return NextResponse.json({
      ok: true,
      restaurantId,
      dishes: dishesData.length,
      ingredients: ingredients.length,
      invoiceId: invRef.id,
      lineItems: lineItems.length,
    });
  } catch (e) {
    console.error("Chefs-tab seed:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Seed failed" },
      { status: 500 }
    );
  }
}
