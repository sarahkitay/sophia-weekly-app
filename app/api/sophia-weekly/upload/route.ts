import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { classifyReport } from "@/lib/sophia-weekly/classifyReport";
import { parseReport, mergeSalesData, type SalesPartialWithSource } from "@/lib/sophia-weekly/parsers";
import { formatWeeklyEmail } from "@/lib/sophia-weekly/formatWeeklyEmail";
import { checkReadyToSend } from "@/lib/sophia-weekly/checkReadyToSend";
import { weekDocId, isValidRestaurantId, DEFAULT_RESTAURANT_ID } from "@/lib/sophia-weekly/restaurants";
import type { ReportType } from "@/lib/sophia-weekly/types";
import type { SalesData, LaborData, ProductMixData } from "@/lib/sophia-weekly/types";

export const runtime = "nodejs";

function hasMeaningfulSales(data: SalesData | undefined): boolean {
  if (!data || typeof data.netSales !== "number") return false;
  if (data.netSales > 0) return true;
  const keys = Object.keys(data).filter((k) => k !== "netSales") as (keyof SalesData)[];
  return keys.some((k) => typeof (data as Record<string, unknown>)[k] === "number" && (data as Record<string, unknown>)[k] !== 0);
}

function hasMeaningfulLabor(data: LaborData | undefined): boolean {
  if (!data || typeof data.totalLaborCost !== "number") return false;
  return data.totalLaborCost > 0;
}

function hasMeaningfulProductMix(data: ProductMixData | undefined): boolean {
  if (!data) return false;
  const a = data.topFoodItems ?? [];
  const b = data.topCocktailItems ?? [];
  const c = data.topWineItems ?? [];
  const d = data.topBeerItems ?? [];
  return a.length > 0 || b.length > 0 || c.length > 0 || d.length > 0;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const weekKey = formData.get("weekKey");
    const restaurantId = (formData.get("restaurantId") as string) ?? DEFAULT_RESTAURANT_ID;
    const wk = typeof weekKey === "string" && weekKey ? weekKey : null;
    if (!wk) {
      return NextResponse.json({ error: "Missing weekKey" }, { status: 400 });
    }
    if (!isValidRestaurantId(restaurantId)) {
      return NextResponse.json({ error: "Invalid restaurantId" }, { status: 400 });
    }

    const files: File[] = [];
    for (const [, value] of formData.entries()) {
      if (value instanceof File && value.size > 0) {
        files.push(value);
      }
    }
    if (!files.length) {
      return NextResponse.json({ error: "No files uploaded" }, { status: 400 });
    }

    const db = getAdminDb();
    const docId = weekDocId(restaurantId, wk);
    const ref = db.collection("goldiesWeeklyImports").doc(docId);
    const snap = await ref.get();
    const existing = snap.exists ? snap.data() : {};

    const salesPartials: SalesPartialWithSource[] = [];
    let laborData: LaborData | undefined;
    let productMixData: ProductMixData | undefined;
    const allErrors: string[] = [...(Array.isArray(existing?.parseErrors) ? existing.parseErrors : [])];
    let salesReceived = existing?.salesReceived ?? false;
    let laborReceived = existing?.laborReceived ?? false;
    let productMixReceived = existing?.productMixReceived ?? false;

    for (const file of files) {
      const filename = file.name || "unknown-file";
      const reportType = classifyReport("", [filename]) as ReportType | null;
      if (!reportType) {
        allErrors.push(`Unknown type for "${filename}"`);
        continue;
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const { data, errors } = parseReport(reportType, buffer, filename);

      if (errors.length) {
        allErrors.push(...errors.map((e) => `[${filename}] ${e}`));
      }

      if (reportType === "SALES") {
        salesReceived = true;
        salesPartials.push({ partial: data as Partial<SalesData>, filename: filename });
      } else if (reportType === "LABOR") {
        laborReceived = true;
        laborData = data as LaborData;
      } else if (reportType === "PRODUCT_MIX") {
        productMixReceived = true;
        productMixData = data as ProductMixData;
      }
    }

    // If we ended up with valid labor data (from any labor file), drop the "no FOH/BOH totals parsed" warning so we don't confuse when another labor file in the same upload failed.
    const finalErrors =
      laborData && hasMeaningfulLabor(laborData)
        ? allErrors.filter((e) => !e.includes("Labor file had rows but no FOH/BOH totals parsed"))
        : allErrors;

    // Merge only this upload's sales files. Discounts (including trivia, friend & family) come from Check Discounts when present.
    const salesData = salesPartials.length
      ? mergeSalesData(salesPartials)
      : (existing?.salesData as SalesData | undefined);
    // Only write sales/labor/productMix when parsed and meaningful (no auto-fill with zeros)
    const merged = {
      restaurantId,
      weekKey: wk,
      updatedAt: new Date().toISOString(),
      salesReceived,
      laborReceived,
      productMixReceived,
      salesParsed: salesPartials.length > 0 ? hasMeaningfulSales(salesData ?? undefined) : (existing?.salesParsed ?? false),
      laborParsed: !!laborData ? hasMeaningfulLabor(laborData) : (existing?.laborParsed ?? false),
      productMixParsed: !!productMixData ? hasMeaningfulProductMix(productMixData) : (existing?.productMixParsed ?? false),
      ...(salesData && hasMeaningfulSales(salesData) ? { salesData } : existing?.salesData && hasMeaningfulSales(existing.salesData as SalesData) ? { salesData: existing.salesData } : {}),
      ...(laborData && hasMeaningfulLabor(laborData) ? { laborData } : existing?.laborData && hasMeaningfulLabor(existing.laborData as LaborData) ? { laborData: existing.laborData } : {}),
      ...(productMixData && hasMeaningfulProductMix(productMixData) ? { productMixData } : existing?.productMixData && hasMeaningfulProductMix(existing.productMixData as ProductMixData) ? { productMixData: existing.productMixData } : {}),
      parseErrors: finalErrors,
    };

    const doc = { ...existing, ...merged };
    const ready = checkReadyToSend(doc as unknown as import("@/lib/sophia-weekly/types").WeeklyImportDoc);
    // Regenerate email whenever we have sales + labor + product mix (including manual best sellers), not only when "ready"
    const hasAllData =
      doc.salesData && hasMeaningfulSales(doc.salesData as SalesData) &&
      doc.laborData && hasMeaningfulLabor(doc.laborData as LaborData) &&
      doc.productMixData && hasMeaningfulProductMix(doc.productMixData as ProductMixData);
    if (hasAllData) {
      const text = formatWeeklyEmail(
        doc.salesData as SalesData,
        doc.laborData as LaborData,
        doc.productMixData as ProductMixData,
        wk,
        restaurantId
      );
      (merged as Record<string, unknown>).generatedEmailText = text;
    }

    await ref.set(merged, { merge: true });

    return NextResponse.json({
      ok: true,
      weekKey: wk,
      filesProcessed: files.length,
      salesReceived: !!salesPartials.length,
      laborReceived: !!laborData,
      productMixReceived: !!productMixData,
      ready,
      parseErrors: finalErrors.length ? finalErrors : undefined,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Upload failed";
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: msg, details: error instanceof Error ? error.stack : undefined },
      { status: 500 }
    );
  }
}
