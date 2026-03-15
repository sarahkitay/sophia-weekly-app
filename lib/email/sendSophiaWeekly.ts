/**
 * Send the weekly recap as plain text via Mailgun.
 * Recipients: SOPHIA_WEEKLY_RECIPIENTS (comma-separated) or pass array.
 */
export async function sendSophiaWeeklyEmail(
  bodyPlain: string,
  subject: string,
  recipients?: string[]
): Promise<{ success: boolean; error?: string }> {
  const to = recipients?.length
    ? recipients
    : (process.env.SOPHIA_WEEKLY_RECIPIENTS || "").split(",").map((e) => e.trim()).filter(Boolean);
  if (!to.length) {
    return { success: false, error: "No recipients configured (SOPHIA_WEEKLY_RECIPIENTS or pass recipients)" };
  }
  const apiKey = process.env.MAILGUN_API_KEY;
  const domain = process.env.MAILGUN_DOMAIN;
  if (!apiKey || !domain) {
    return { success: false, error: "MAILGUN_API_KEY and MAILGUN_DOMAIN required for sending" };
  }

  const fromEmail = process.env.SOPHIA_WEEKLY_FROM_EMAIL || `weekly@${domain}`;
  const fromName = process.env.SOPHIA_WEEKLY_FROM_NAME || "Goldie's Weekly";
  const from = `${fromName} <${fromEmail}>`;

  const form = new URLSearchParams();
  form.set("from", from);
  form.set("subject", subject);
  form.set("text", bodyPlain);
  to.forEach((addr) => form.append("to", addr));

  try {
    const res = await fetch(`https://api.mailgun.net/v3/${domain}/messages`, {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(`api:${apiKey}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });

    const raw = await res.text();
    let message: string | undefined;
    try {
      const data = JSON.parse(raw) as { message?: string };
      message = data.message;
    } catch {
      message = raw?.slice(0, 200) || undefined;
    }
    if (!res.ok) {
      const errMsg = message || (res.status === 403 ? "Mailgun 403 Forbidden – check API key and domain (key may be revoked or domain disconnected)" : `Mailgun ${res.status}`);
      return { success: false, error: errMsg };
    }
    return { success: true };
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    return { success: false, error: err };
  }
}
