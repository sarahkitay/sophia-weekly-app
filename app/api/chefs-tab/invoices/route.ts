import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";
import { isValidRestaurantId, DEFAULT_RESTAURANT_ID } from "@/lib/sophia-weekly/restaurants";
import { COLLECTIONS, docWithId } from "@/lib/chefs-tab/firestore";

/** GET /api/chefs-tab/invoices?restaurantId= */
export async function GET(request: NextRequest) {
  const restaurantId = request.nextUrl.searchParams.get("restaurantId") ?? DEFAULT_RESTAURANT_ID;
  if (!isValidRestaurantId(restaurantId)) {
    return NextResponse.json({ error: "Invalid restaurantId" }, { status: 400 });
  }
  try {
    const db = getAdminDb();
    const snap = await db
      .collection(COLLECTIONS.invoices)
      .where("restaurantId", "==", restaurantId)
      .orderBy("updatedAt", "desc")
      .limit(200)
      .get();
    const invoices = snap.docs.map((d) => docWithId(d.id, d.data()));
    return NextResponse.json({ invoices });
  } catch (e) {
    console.error("Chefs-tab invoices GET:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/** POST /api/chefs-tab/invoices - create invoice (e.g. from CSV import) */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const restaurantId = body.restaurantId ?? DEFAULT_RESTAURANT_ID;
    if (!isValidRestaurantId(restaurantId)) {
      return NextResponse.json({ error: "Invalid restaurantId" }, { status: 400 });
    }
    const vendorName = (body.vendorName ?? body.vendor ?? "").trim();
    if (!vendorName) {
      return NextResponse.json({ error: "Missing vendor name" }, { status: 400 });
    }
    const lineItems = Array.isArray(body.lineItems) ? body.lineItems : [];
    const now = new Date().toISOString();
    const db = getAdminDb();
    const invoiceRef = await db.collection(COLLECTIONS.invoices).add({
      restaurantId,
      vendorName,
      invoiceNumber: body.invoiceNumber?.trim() || null,
      invoiceDate: body.invoiceDate?.trim() || null,
      sourceType: body.sourceType || "csv",
      fileUrl: body.fileUrl ?? null,
      rawCsvBase64: body.rawCsvBase64 ?? null,
      uploadStatus: "uploaded",
      parseStatus: lineItems.length > 0 ? "parsed" : "pending",
      createdAt: Timestamp.fromDate(new Date(now)),
      updatedAt: Timestamp.fromDate(new Date(now)),
    });
    const invoiceId = invoiceRef.id;

    const batch = db.batch();
    const { normalizeIngredientName } = await import("@/lib/chefs-tab/normalize");
    for (let i = 0; i < lineItems.length; i++) {
      const row = lineItems[i];
      const rawItemName = (row.itemName ?? row.rawItemName ?? "").trim() || "Unknown";
      const totalCost = Number(row.totalCost);
      if (!Number.isFinite(totalCost)) continue;
      const lineRef = db.collection(COLLECTIONS.invoiceLineItems).doc();
      batch.set(lineRef, {
        invoiceId,
        ingredientId: null,
        rawItemName,
        normalizedItemName: normalizeIngredientName(rawItemName),
        quantityPurchased: row.quantity != null ? Number(row.quantity) : null,
        purchaseUnit: row.unit ? String(row.unit).trim() : null,
        packSizeValue: row.packSizeValue != null ? Number(row.packSizeValue) : null,
        packSizeUnit: row.packSizeUnit ?? null,
        totalCost,
        unitCost: row.unitCost != null ? Number(row.unitCost) : null,
        vendorSku: row.vendorSku ?? null,
        isMapped: false,
        matchConfidence: null,
        createdAt: Timestamp.fromDate(new Date(now)),
        updatedAt: Timestamp.fromDate(new Date(now)),
      });
    }
    await batch.commit();

    return NextResponse.json({
      id: invoiceId,
      vendorName,
      invoiceNumber: body.invoiceNumber?.trim() || null,
      invoiceDate: body.invoiceDate?.trim() || null,
      sourceType: body.sourceType || "csv",
      parseStatus: "parsed",
      lineCount: lineItems.length,
    });
  } catch (e) {
    console.error("Chefs-tab invoices POST:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
