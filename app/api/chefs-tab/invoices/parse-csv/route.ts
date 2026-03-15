import { NextRequest, NextResponse } from "next/server";
import { parseCsv } from "@/lib/chefs-tab/csv";

/**
 * POST /api/chefs-tab/invoices/parse-csv
 * Body: FormData with "file" (CSV file) or "csv" (raw text).
 * Returns { headers, rows } for client to preview and map columns.
 */
export async function POST(request: NextRequest) {
  try {
    let csvText: string;
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      const raw = formData.get("csv") as string | null;
      if (file && file.size > 0) {
        csvText = await file.text();
      } else if (raw && typeof raw === "string") {
        csvText = raw;
      } else {
        return NextResponse.json({ error: "Missing file or csv in body" }, { status: 400 });
      }
    } else {
      const body = await request.json();
      csvText = body.csv ?? body.text ?? "";
      if (!csvText || typeof csvText !== "string") {
        return NextResponse.json({ error: "Missing csv or text in body" }, { status: 400 });
      }
    }

    const hasHeaders = true;
    const result = parseCsv(csvText, hasHeaders);
    return NextResponse.json({
      headers: result.headers,
      rows: result.rows,
      errors: result.errors,
      rowCount: result.rows.length,
    });
  } catch (e) {
    console.error("Chefs-tab parse-csv:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Parse failed" },
      { status: 500 }
    );
  }
}
