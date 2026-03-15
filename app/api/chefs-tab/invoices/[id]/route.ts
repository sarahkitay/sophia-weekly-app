import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { isValidRestaurantId, DEFAULT_RESTAURANT_ID } from "@/lib/sophia-weekly/restaurants";
import { COLLECTIONS, docWithId } from "@/lib/chefs-tab/firestore";

/** GET /api/chefs-tab/invoices/[id] - invoice with line items */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const restaurantId = request.nextUrl.searchParams.get("restaurantId") ?? DEFAULT_RESTAURANT_ID;
  if (!isValidRestaurantId(restaurantId)) {
    return NextResponse.json({ error: "Invalid restaurantId" }, { status: 400 });
  }
  try {
    const db = getAdminDb();
    const invSnap = await db.collection(COLLECTIONS.invoices).doc(id).get();
    if (!invSnap.exists) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }
    const invData = invSnap.data()!;
    if (invData.restaurantId !== restaurantId) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }
    const invoice = docWithId(id, invData);

    const lineSnap = await db
      .collection(COLLECTIONS.invoiceLineItems)
      .where("invoiceId", "==", id)
      .get();
    const lineItems = lineSnap.docs.map((d) => docWithId(d.id, d.data(), ["createdAt", "updatedAt"]));

    return NextResponse.json({ invoice, lineItems });
  } catch (e) {
    console.error("Chefs-tab invoice GET:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
