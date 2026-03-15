# Sophia Weekly Recap Tool

Internal tool for Sophia: receives Toast export emails via Mailgun, parses them, and sends a combined weekly recap to her team.

## Deploy the app

The app lives in **sophia-weekly-app/** and is a separate Next.js app (e.g. from a repo root that might be a different site). Deploy it on its own domain (e.g. **metrics.oystercatcherwhidbey.com**).

To get the tool online:

1. In **Vercel**, create a project from the repo (or use an existing one).
2. Set **Root Directory** to **`sophia-weekly-app`** if the repo contains other apps.
3. Leave **Framework** as Next.js. Build command: `npm run build`; output: `.next`.
4. Deploy, then assign your domain (e.g. **metrics.oystercatcherwhidbey.com**):
  - Project → Settings → Domains → Add your domain.
5. After deployment, use **https://metrics.oystercatcherwhidbey.com** or **https://metrics.oystercatcherwhidbey.com/goldies** to open the tool.

## Architecture summary

- **Mailgun inbound** → POST to `/api/inbound/mailgun` (multipart/form-data with attachments).
- **Classification** → By subject/filename: SALES, LABOR, PRODUCT_MIX.
- **Week key** → Inferred from subject/filename or received date (YYYY-MM-DD of week end).
- **Firestore** → One doc per week per restaurant in `goldiesWeeklyImports` (doc ID: `{restaurantId}_{weekKey}`; each doc has `restaurantId` and `weekKey`). Optional logs in `goldiesInboundLogs`. A composite index on `(restaurantId, updatedAt)` is required for history and best-sellers; Firebase will suggest it when first used.
- **When all 3 reports are in** → Generate plain-text email, optionally auto-send.
- **Hidden page** → `/goldies` for status, preview, upload, reprocess, send, and history.

## File tree

```
sophia-weekly-app/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── globals.css
│   ├── sophia-weekly/
│   │   └── page.tsx          # Hidden dashboard
│   └── api/
│       ├── inbound/
│       │   └── mailgun/
│       │       └── route.ts   # Mailgun webhook
│       └── sophia-weekly/
│           ├── process/route.ts
│           ├── send/route.ts
│           ├── reprocess/route.ts
│           ├── week/route.ts
│           ├── history/route.ts
│           └── seed-demo/route.ts
├── lib/
│   ├── firebase/
│   │   └── admin.ts
│   ├── mailgun/
│   │   ├── verifySignature.ts
│   │   └── parseInboundMultipart.ts
│   ├── email/
│   │   └── sendSophiaWeekly.ts
│   └── sophia-weekly/
│       ├── types.ts
│       ├── classifyReport.ts
│       ├── inferWeekKey.ts
│       ├── formatWeeklyEmail.ts
│       ├── checkReadyToSend.ts
│       ├── fixtures.ts
│       ├── seedDemo.ts
│       └── parsers/
│           ├── index.ts
│           ├── parseSalesReport.ts
│           ├── parseLaborReport.ts
│           └── parseProductMixReport.ts
├── .env.example
├── package.json
├── next.config.js
├── tailwind.config.ts
└── README.md
```

## Setup steps

1. **Copy env**
   ```bash
   cd sophia-weekly-app
   cp .env.example .env.local
   ```
   Fill in Firebase and Mailgun keys.

2. **Install and run**
   ```bash
   npm install
   npm run dev
   ```
   Open http://localhost:3000/sophia-weekly

3. **Mailgun**
  - Create a route: forward inbound to `https://metrics.oystercatcherwhidbey.com/api/inbound/mailgun` (or your app domain).
  - Add your Mailgun signing key to `MAILGUN_SIGNING_KEY` so webhooks are verified.

4. **Firestore**
  - Create collection `goldiesWeeklyImports` (and optionally `goldiesInboundLogs`).
  - Security: restrict reads/writes to your backend or use Firestore rules so only your app can access.

5. **Deploy**
  - Deploy this app (e.g. Vercel) and set root to `sophia-weekly-app` if in a monorepo, or deploy from this folder.

## Testing without real Toast emails

- Open `/sophia-weekly`, pick the current week, click **Seed demo data**. That fills the week with fixture sales/labor/product-mix and generates the preview.
- Use **Reprocess** to regenerate from stored data, **Send email now** to send (requires `MAILGUN_API_KEY`, `MAILGUN_DOMAIN`, and `SOPHIA_WEEKLY_RECIPIENTS`).

## Where to edit after real Toast exports

1. **Classification**  
   `lib/sophia-weekly/classifyReport.ts`  
   Adjust keywords for subject/filename so SALES, LABOR, PRODUCT_MIX are detected correctly.

2. **Week key**  
   `lib/sophia-weekly/inferWeekKey.ts`  
   If Toast uses a specific date format in subject/filename, add or tweak regexes.

3. **Parsers (column/row mapping)**  
  - Sales: `lib/sophia-weekly/parsers/parseSalesReport.ts` - header names and which row has totals.
  - Labor: `lib/sophia-weekly/parsers/parseLaborReport.ts` - label/value row matching.
  - Product mix: `lib/sophia-weekly/parsers/parseProductMixReport.ts` - category and item columns, category names.

4. **Email format**  
   `lib/sophia-weekly/formatWeeklyEmail.ts` - labels and order of lines.

All parsers support CSV, XLS, and XLSX (via the `xlsx` library). No PDF/OCR in v1.
