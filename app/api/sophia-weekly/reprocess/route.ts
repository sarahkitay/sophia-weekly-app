import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";
import { formatWeeklyEmail } from "@/lib/sophia-weekly/formatWeeklyEmail";
import { checkReadyToSend } from "@/lib/sophia-weekly/checkReadyToSend";
import { weekDocId, isValidRestaurantId, DEFAULT_RESTAURANT_ID } from "@/lib/sophia-weekly/restaurants";
import type { WeeklyImportDoc } from "@/lib/sophia-weekly/types";

/**
 * POST /api/sophia-weekly/reprocess?weekKey=2026-03-08&restaurantId=goldies
 * Regenerates the email from existing parsed data and updates Firestore.
 */
export async function POST(request: NextRequest) {
  const weekKey = request.nextUrl.searchParams.get("weekKey");
  const restaurantId = request.nextUrl.searchParams.get("restaurantId") ?? DEFAULT_RESTAURANT_ID;
  if (!weekKey) {
    return NextResponse.json({ error: "Missing weekKey" }, { status: 400 });
  }
  if (!isValidRestaurantId(restaurantId)) {
    return NextResponse.json({ error: "Invalid restaurantId" }, { status: 400 });
  }

  try {
    const db = getAdminDb();
    const ref = db.collection("goldiesWeeklyImports").doc(weekDocId(restaurantId, weekKey));
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Week not found" }, { status: 404 });
    }

    const doc = snap.data() as WeeklyImportDoc;
    const text = formatWeeklyEmail(doc.salesData, doc.laborData, doc.productMixData, weekKey, restaurantId);
    const ready = checkReadyToSend(doc);

    await ref.update({
      generatedEmailText: text,
      updatedAt: Timestamp.now(),
    });

    return NextResponse.json({
      ok: true,
      weekKey,
      ready,
      generatedLength: text.length,
    });
  } catch (e) {
    console.error("Reprocess error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
