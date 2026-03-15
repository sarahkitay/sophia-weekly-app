import { getAdminDb } from "../firebase/admin";
import { Timestamp } from "firebase-admin/firestore";
import { formatWeeklyEmail } from "./formatWeeklyEmail";
import { FIXTURE_SALES, FIXTURE_LABOR, FIXTURE_PRODUCT_MIX } from "./fixtures";

/**
 * Seed Firestore with one demo week for testing.
 * Call from /api/sophia-weekly/seed-demo or run in a script.
 */
export async function seedDemoWeek(weekKey: string): Promise<void> {
  const db = getAdminDb();
  const generated = formatWeeklyEmail(FIXTURE_SALES, FIXTURE_LABOR, FIXTURE_PRODUCT_MIX, weekKey);
  const ref = db.collection("goldiesWeeklyImports").doc(weekKey);
  await ref.set({
    weekKey,
    salesReceived: true,
    laborReceived: true,
    productMixReceived: true,
    salesParsed: true,
    laborParsed: true,
    productMixParsed: true,
    salesData: FIXTURE_SALES,
    laborData: FIXTURE_LABOR,
    productMixData: FIXTURE_PRODUCT_MIX,
    generatedEmailText: generated,
    sent: false,
    sentAt: null,
    recipients: [],
    updatedAt: Timestamp.now(),
    parseErrors: [],
    emailSubjects: {},
    attachmentNames: {},
  });
}
