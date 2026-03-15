import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";
import { sendSophiaWeeklyEmail } from "@/lib/email/sendSophiaWeekly";
import { weekDocId, isValidRestaurantId, DEFAULT_RESTAURANT_ID } from "@/lib/sophia-weekly/restaurants";
import { getWeekRangeLabel } from "@/lib/sophia-weekly/weekUtils";

/**
 * POST /api/sophia-weekly/send?weekKey=2026-03-08&restaurantId=goldies
 * Sends the weekly recap email. If the request body contains emailBody, that exact text is sent
 * (so the email never differs from what the user sees in the preview). Otherwise uses stored generatedEmailText.
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
    let bodyText: string | null = null;
    try {
      const body = await request.json();
      if (body && typeof body.emailBody === "string" && body.emailBody.trim()) {
        bodyText = body.emailBody.trim();
      }
    } catch {
      // no body or invalid JSON
    }

    const db = getAdminDb();
    const ref = db.collection("goldiesWeeklyImports").doc(weekDocId(restaurantId, weekKey));
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Week not found" }, { status: 404 });
    }

    const doc = snap.data();
    const text = bodyText ?? doc?.generatedEmailText ?? null;
    if (!text) {
      return NextResponse.json({ error: "No generated email for this week" }, { status: 400 });
    }

    const docRecipients = doc?.recipients;
    let recipients: string[] = Array.isArray(docRecipients) ? (docRecipients as string[]) : [];
    if (!recipients.length) {
      const configSnap = await db.collection("goldiesWeeklyConfig").doc("recipients").get();
      recipients = Array.isArray(configSnap.data()?.recipients) ? (configSnap.data()!.recipients as string[]) : [];
    }
    if (!recipients.length) {
      recipients = (process.env.SOPHIA_WEEKLY_RECIPIENTS || "")
        .split(",")
        .map((e: string) => e.trim())
        .filter(Boolean);
    }
    if (!recipients.length) {
      return NextResponse.json(
        { error: "No recipients configured. Add team emails in the Recipients section above." },
        { status: 400 }
      );
    }

    const result = await sendSophiaWeeklyEmail(text, `Weekly Recap ${getWeekRangeLabel(weekKey)}`, recipients);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    await ref.update({
      sent: true,
      sentAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    return NextResponse.json({ ok: true, weekKey, sent: true });
  } catch (e) {
    console.error("Send error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
