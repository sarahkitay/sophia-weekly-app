import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getAdminDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";

type ReportType = "SALES" | "LABOR" | "PRODUCT_MIX" | "UNKNOWN";

function verifyMailgunSignature(params: {
  timestamp: string;
  token: string;
  signature: string;
}) {
  const signingKey = process.env.MAILGUN_SIGNING_KEY;
  if (!signingKey) {
    throw new Error("MAILGUN_SIGNING_KEY is missing");
  }

  const expected = crypto
    .createHmac("sha256", signingKey)
    .update(`${params.timestamp}${params.token}`)
    .digest("hex");

  const expectedBuf = Buffer.from(expected, "utf8");
  const signatureBuf = Buffer.from(params.signature, "utf8");

  if (expectedBuf.length !== signatureBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, signatureBuf);
}

function classifyReport(subject: string, filename: string): ReportType {
  const text = `${subject} ${filename}`.toLowerCase();

  if (
    text.includes("product mix") ||
    text.includes("productmix") ||
    text.includes("mix") ||
    text.includes("item sales")
  ) {
    return "PRODUCT_MIX";
  }

  if (
    text.includes("labor") ||
    text.includes("time entries") ||
    text.includes("timeentries") ||
    text.includes("payroll")
  ) {
    return "LABOR";
  }

  if (
    text.includes("sales") ||
    text.includes("summary") ||
    text.includes("financial") ||
    text.includes("net sales")
  ) {
    return "SALES";
  }

  return "UNKNOWN";
}

function inferWeekKey(subject: string, filename: string) {
  const text = `${subject} ${filename}`;

  const isoMatch = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (isoMatch) return isoMatch[1];

  const slashMatch = text.match(/\b(\d{1,2}\/\d{1,2}\/20\d{2})\b/);
  if (slashMatch) {
    const [m, d, y] = slashMatch[1].split("/");
    const dt = new Date(`${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}T00:00:00Z`);
    return dt.toISOString().slice(0, 10);
  }

  const now = new Date();
  const day = now.getUTCDay();
  const sunday = new Date(now);
  sunday.setUTCDate(now.getUTCDate() - day);
  return sunday.toISOString().slice(0, 10);
}

function safeString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value : "";
}

async function fileToBase64(file: File) {
  const arrayBuffer = await file.arrayBuffer();
  return Buffer.from(arrayBuffer).toString("base64");
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const timestamp = safeString(formData.get("timestamp"));
    const token = safeString(formData.get("token"));
    const signature = safeString(formData.get("signature"));

    if (!timestamp || !token || !signature) {
      return NextResponse.json(
        { ok: false, error: "Missing Mailgun signature fields" },
        { status: 400 }
      );
    }

    const isValid = verifyMailgunSignature({ timestamp, token, signature });
    if (!isValid) {
      return NextResponse.json(
        { ok: false, error: "Invalid Mailgun signature" },
        { status: 401 }
      );
    }

    const sender = safeString(formData.get("sender"));
    const recipient = safeString(formData.get("recipient"));
    const subject = safeString(formData.get("subject"));
    const bodyPlain = safeString(formData.get("body-plain"));

    const attachments: File[] = [];
    for (const [, value] of formData.entries()) {
      if (value instanceof File) attachments.push(value);
    }

    if (!attachments.length) {
      return NextResponse.json(
        {
          ok: false,
          error: "No attachments found",
          sender,
          recipient,
          subject,
        },
        { status: 400 }
      );
    }

    const db = getAdminDb();
    const processed: Array<{
      filename: string;
      mimeType: string;
      size: number;
      reportType: ReportType;
      weekKey: string;
    }> = [];

    for (const file of attachments) {
      const filename = file.name || "unknown-file";
      const mimeType = file.type || "application/octet-stream";
      const reportType = classifyReport(subject, filename);
      const weekKey = inferWeekKey(subject, filename);
      const base64 = await fileToBase64(file);

      const docRef = db.collection("goldiesWeeklyImports").doc(weekKey);
      const snap = await docRef.get();
      const existing = snap.exists ? snap.data() : {};

      const fieldPrefix =
        reportType === "SALES"
          ? "sales"
          : reportType === "LABOR"
          ? "labor"
          : reportType === "PRODUCT_MIX"
          ? "productMix"
          : "unknown";

      const updatePayload: Record<string, unknown> = {
        weekKey,
        updatedAt: new Date().toISOString(),
        lastSender: sender,
        recipient,
      };

      if (reportType === "UNKNOWN") {
        const currentErrors = Array.isArray(existing?.parseErrors)
          ? existing.parseErrors
          : [];

        updatePayload.parseErrors = [
          ...currentErrors,
          `Unknown report type for attachment "${filename}" on subject "${subject}"`,
        ];
      } else {
        updatePayload[`${fieldPrefix}Received`] = true;
        updatePayload[`${fieldPrefix}Parsed`] = false;
        updatePayload[`${fieldPrefix}Meta`] = {
          filename,
          mimeType,
          subject,
          sender,
          receivedAt: new Date().toISOString(),
          size: file.size,
        };
        updatePayload[`${fieldPrefix}RawBase64`] = base64;
        updatePayload[`${fieldPrefix}RawFilename`] = filename;
        updatePayload[`${fieldPrefix}BodyPlain`] = bodyPlain;
      }

      await docRef.set(updatePayload, { merge: true });

      processed.push({
        filename,
        mimeType,
        size: file.size,
        reportType,
        weekKey,
      });
    }

    return NextResponse.json({
      ok: true,
      sender,
      recipient,
      subject,
      attachmentsProcessed: processed.length,
      processed,
    });
  } catch (error) {
    console.error("Mailgun inbound error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown server error",
      },
      { status: 500 }
    );
  }
}
