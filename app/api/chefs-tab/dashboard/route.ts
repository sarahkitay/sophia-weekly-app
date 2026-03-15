import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { isValidRestaurantId, DEFAULT_RESTAURANT_ID } from "@/lib/sophia-weekly/restaurants";
import { COLLECTIONS } from "@/lib/chefs-tab/firestore";

/**
 * GET /api/chefs-tab/dashboard?restaurantId=
 * Returns counts and recent items for Chef's Tab dashboard.
 */
export async function GET(request: NextRequest) {
  const restaurantId = request.nextUrl.searchParams.get("restaurantId") ?? DEFAULT_RESTAURANT_ID;
  if (!isValidRestaurantId(restaurantId)) {
    return NextResponse.json({ error: "Invalid restaurantId" }, { status: 400 });
  }
  try {
    const db = getAdminDb();

    const [dishesSnap, invoicesSnap, lineItemsSnap] = await Promise.all([
      db.collection(COLLECTIONS.dishes).where("restaurantId", "==", restaurantId).get(),
      db
        .collection(COLLECTIONS.invoices)
        .where("restaurantId", "==", restaurantId)
        .orderBy("updatedAt", "desc")
        .limit(10)
        .get(),
      db.collection(COLLECTIONS.invoiceLineItems).get(),
    ]);

    const invoiceIds = new Set(invoicesSnap.docs.map((d) => d.id));
    let unmappedLineItems = 0;
    lineItemsSnap.docs.forEach((d) => {
      const data = d.data();
      if (invoiceIds.has(data.invoiceId) && !data.isMapped) unmappedLineItems++;
    });

    const totalDishes = dishesSnap.size;
    const totalInvoices = invoicesSnap.size;
    const recentInvoices = invoicesSnap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        vendorName: data.vendorName,
        invoiceDate: data.invoiceDate,
        parseStatus: data.parseStatus,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() ?? null,
      };
    });

    return NextResponse.json({
      totalDishes,
      totalInvoices,
      unmappedLineItems,
      recentInvoices,
    });
  } catch (e) {
    console.error("Chefs-tab dashboard GET:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
