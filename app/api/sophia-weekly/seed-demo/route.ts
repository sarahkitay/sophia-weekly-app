import { NextRequest, NextResponse } from "next/server";
import { seedDemoWeek } from "@/lib/sophia-weekly/seedDemo";
import { getCurrentWeekKey } from "@/lib/sophia-weekly/weekUtils";

/**
 * POST /api/sophia-weekly/seed-demo?weekKey=2026-03-10
 * Seeds Firestore with fixture data for testing. Optional weekKey (Monday of Thu–Mon week); defaults to current week.
 */
export async function POST(request: NextRequest) {
  const weekKey = request.nextUrl.searchParams.get("weekKey") ?? getCurrentWeekKey();

  try {
    await seedDemoWeek(weekKey);
    return NextResponse.json({ ok: true, weekKey, message: "Demo week seeded" });
  } catch (e) {
    console.error("Seed demo error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
