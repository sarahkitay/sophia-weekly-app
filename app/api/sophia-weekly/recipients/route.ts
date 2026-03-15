import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";

const CONFIG_COLLECTION = "goldiesWeeklyConfig";
const RECIPIENTS_DOC_ID = "recipients";

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

/**
 * GET /api/sophia-weekly/recipients
 * Returns the saved recipient email list (used when sending the weekly recap).
 */
export async function GET() {
  try {
    const db = getAdminDb();
    const snap = await db.collection(CONFIG_COLLECTION).doc(RECIPIENTS_DOC_ID).get();
    const recipients: string[] = Array.isArray(snap.data()?.recipients) ? snap.data()!.recipients : [];
    return NextResponse.json({ recipients });
  } catch (e) {
    console.error("Get recipients error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/sophia-weekly/recipients
 * Body: { recipients: string[] } - full list to save. Replaces existing.
 * Validates emails; saves to Firestore.
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const raw = body?.recipients;
    if (!Array.isArray(raw)) {
      return NextResponse.json({ error: "Body must include recipients array" }, { status: 400 });
    }

    const recipients = raw
      .map((e: unknown) => (typeof e === "string" ? e.trim().toLowerCase() : ""))
      .filter(Boolean)
      .filter((e: string) => isValidEmail(e));

    const unique = [...new Set(recipients)];

    const db = getAdminDb();
    await db.collection(CONFIG_COLLECTION).doc(RECIPIENTS_DOC_ID).set(
      { recipients: unique, updatedAt: new Date().toISOString() },
      { merge: true }
    );

    return NextResponse.json({ ok: true, recipients: unique });
  } catch (e) {
    console.error("PATCH recipients error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
