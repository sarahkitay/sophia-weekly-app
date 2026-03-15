import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";
import { isValidRestaurantId, DEFAULT_RESTAURANT_ID } from "@/lib/sophia-weekly/restaurants";
import { COLLECTIONS } from "@/lib/chefs-tab/firestore";
import { normalizeIngredientName } from "@/lib/chefs-tab/normalize";

/**
 * POST /api/chefs-tab/invoices/[id]/map-exact
 * Body: { restaurantId }
 * Finds unmapped line items whose normalized name exactly matches an ingredient (or alias), applies mapping, returns count.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: invoiceId } = await params;
  try {
    const body = await request.json().catch(() => ({}));
    const restaurantId = body.restaurantId ?? DEFAULT_RESTAURANT_ID;
    if (!isValidRestaurantId(restaurantId)) {
      return NextResponse.json({ error: "Invalid restaurantId" }, { status: 400 });
    }
    const db = getAdminDb();

    const invSnap = await db.collection(COLLECTIONS.invoices).doc(invoiceId).get();
    if (!invSnap.exists || invSnap.data()!.restaurantId !== restaurantId) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const [lineSnap, ingSnap] = await Promise.all([
      db.collection(COLLECTIONS.invoiceLineItems).where("invoiceId", "==", invoiceId).get(),
      db.collection(COLLECTIONS.ingredients).where("restaurantId", "==", restaurantId).get(),
    ]);

    const normToIng = new Map<string, { id: string; canonicalName: string }>();
    ingSnap.docs.forEach((d) => {
      const data = d.data();
      const id = d.id;
      const canonical = data.canonicalName ?? "";
      const norm = normalizeIngredientName(canonical);
      if (norm) normToIng.set(norm, { id, canonicalName: canonical });
      (data.aliases ?? []).forEach((alias: string) => {
        const aNorm = normalizeIngredientName(alias);
        if (aNorm && !normToIng.has(aNorm)) normToIng.set(aNorm, { id, canonicalName: canonical });
      });
    });

    const toMap: Array<{ lineId: string; ingredientId: string; rawItemName: string; canonicalName: string }> = [];
    for (const lineDoc of lineSnap.docs) {
      const data = lineDoc.data();
      if (data.isMapped || data.ingredientId) continue;
      const raw = (data.rawItemName ?? "").trim();
      const norm = normalizeIngredientName(raw);
      if (!norm) continue;
      const match = normToIng.get(norm);
      if (match) toMap.push({ lineId: lineDoc.id, ingredientId: match.id, rawItemName: raw, canonicalName: match.canonicalName });
    }

    const batch = db.batch();
    const now = Timestamp.now();
    for (const { lineId, ingredientId } of toMap) {
      const ref = db.collection(COLLECTIONS.invoiceLineItems).doc(lineId);
      batch.update(ref, { ingredientId, isMapped: true, matchConfidence: 1, updatedAt: now });
    }
    if (toMap.length > 0) await batch.commit();

    return NextResponse.json({
      ok: true,
      mapped: toMap.length,
      details: toMap.map(({ lineId, rawItemName, canonicalName }) => ({ lineId, rawItemName, canonicalName })),
    });
  } catch (e) {
    console.error("Chefs-tab map-exact:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
