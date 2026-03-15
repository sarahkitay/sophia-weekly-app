export interface ParsedInbound {
  sender: string;
  recipient: string;
  subject: string;
  timestamp: string;
  token: string;
  signature: string;
  /** key = filename, value = Buffer */
  attachments: Map<string, Buffer>;
  bodyPlain?: string;
}

/**
 * Parse multipart/form-data from Mailgun inbound.
 * Next.js 14: use request.formData() then extract fields and files.
 */
export async function parseInboundFormData(formData: FormData): Promise<ParsedInbound> {
  const attachments = new Map<string, Buffer>();
  let sender = "";
  let recipient = "";
  let subject = "";
  let timestamp = "";
  let token = "";
  let signature = "";
  let bodyPlain = "";

  for (const [key, value] of formData.entries()) {
    if (value instanceof File) {
      const buf = Buffer.from(await value.arrayBuffer());
      const name = (value as File & { name?: string }).name || key || "attachment";
      attachments.set(name, buf);
      continue;
    }
    const str = String(value);
    switch (key) {
      case "sender":
        sender = str;
        break;
      case "recipient":
        recipient = str;
        break;
      case "Subject":
      case "subject":
        subject = str;
        break;
      case "timestamp":
        timestamp = str;
        break;
      case "token":
        token = str;
        break;
      case "signature":
        signature = str;
        break;
      case "body-plain":
        bodyPlain = str;
        break;
      default:
        break;
    }
  }

  return {
    sender,
    recipient,
    subject,
    timestamp,
    token,
    signature,
    attachments,
    bodyPlain,
  };
}
