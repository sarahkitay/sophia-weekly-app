import crypto from "crypto";

/**
 * Verify Mailgun webhook signature.
 * See: https://documentation.mailgun.com/en/latest/user_manual.html#webhooks
 * If MAILGUN_SIGNING_KEY is not set, skips verification (dev only).
 */
export function verifyMailgunSignature(
  signingKey: string | undefined,
  token: string,
  timestamp: string,
  signature: string
): boolean {
  if (!signingKey) return true;
  const payload = `${timestamp}${token}`;
  const expected = crypto.createHmac("sha256", signingKey).update(payload).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expected, "hex"));
}
