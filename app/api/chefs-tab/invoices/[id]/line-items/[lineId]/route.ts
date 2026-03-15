import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";
import { isValidRestaurantId, DEFAULT_RESTAURANT_ID } from "@/lib/sophia-weekly/restaurants";
import { COLLECTIONS } from "@/lib/chefs-tab/firestore";

/** PATCH /api/chefs-tab/invoices/[id]/line-items/[lineId] - map to ingredient or clear */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; lineId: string }> }
) {
  const { id: invoiceId, lineId } = await params;
  try {
    const body = await request.json();
    const restaurantId = body.restaurantId ?? DEFAULT_RESTAURANT_ID;
    if (!isValidRestaurantId(restaurantId)) {
      return NextResponse.json({ error: "Invalid restaurantId" }, { status: 400 });
    }
    const db = getAdminDb();
    const invSnap = await db.collection(COLLECTIONS.invoices).doc(invoiceId).get();
    if (!invSnap.exists || invSnap.data()!.restaurantId !== restaurantId) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }
    const lineRef = db.collection(COLLECTIONS.invoiceLineItems).doc(lineId);
    const lineSnap = await lineRef.get();
    if (!lineSnap.exists || lineSnap.data()!.invoiceId !== invoiceId) {
      return NextResponse.json({ error: "Line item not found" }, { status: 404 });
    }

    const ingredientId = body.ingredientId ?? null;
    const update: Record<string, unknown> = {
      ingredientId,
      isMapped: !!ingredientId,
      matchConfidence: body.matchConfidence ?? (ingredientId ? 1 : null),
      updatedAt: Timestamp.now(),
    };
    await lineRef.update(update);
    return NextResponse.json({ ok: true, id: lineId });
  } catch (e) {
    console.error("Chefs-tab line item PATCH:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
