# Build brief: "Basket" — personal multi-store shopping basket

You are building a small production web app for one user (me). Read this whole brief before writing any code. Plan the file structure first, then build in the order given in §10, verifying each stage compiles and runs before moving on. Commit as you go. If anything in this brief is out of date (a deprecated library, a renamed model id), search for the current equivalent, use it, and tell me what you changed. Ask me for env values when you need them — don't invent keys.

## 1. What this app is

I collect product links from any online store (ASOS, END., Uniqlo, Zara, Vinted, eBay…). The app:

1. Scrapes each page **server-side** for name, brand, price, currency, and the product photo.
2. Generates a standardised **AI "studio packshot"** for every item — the product re-shot on a pure white background — so the whole grid looks uniform regardless of how bad the source photo was.
3. Groups items by store with GBP totals, statuses (Want / Ordered / Arrived), and quantities.
4. Gives me a store-by-store **checkout run**: open each store's links, buy there myself, mark ordered, next store.
5. Installs on my iPhone; I add items straight from the share sheet.

Hard rule: **no payments, no card details, no checkout inside the app — ever.** Checkout means opening the store's own site. Do not build anything that stores or transmits payment credentials.

## 2. Stack

- Next.js (latest stable, App Router) + TypeScript strict + Tailwind. One repo.
- Deploy target: Vercel free tier. Set up `vercel.json` / function config as needed.
- Database: Postgres on Neon, via drizzle-orm + drizzle-kit migrations.
- Image storage: Vercel Blob.
- AI: Google Gemini API for image generation (Nano Banana family — verify the current model id, e.g. `gemini-2.5-flash-image`) and for one small text fallback task.
- Scraping: node fetch + cheerio; playwright-core + @sparticuz/chromium for rendered pages; optional commercial scraping API for hard sites.

## 3. Environment variables

```
DATABASE_URL            # Neon
BLOB_READ_WRITE_TOKEN   # Vercel Blob
GEMINI_API_KEY
ACCESS_CODE             # my passcode, I choose it
SCRAPER_API_KEY         # optional — ScraperAPI or similar, for bot-walled sites
APP_URL                 # e.g. https://basket-emile.vercel.app
AUTO_STUDIO             # "true" to auto-generate packshots after scrape (default false)
STUDIO_MONTHLY_CAP      # default 200
BACK_VIEW               # "true" to also generate back views (default false)
```

Create `.env.example` with all of these and comments.

## 4. Auth — single user, passcode gate

- Middleware protects every route except `/unlock`, `/api/quick-add`, manifest, icons.
- `/unlock`: a passcode screen (numeric keypad feel). Correct code → httpOnly cookie `basket_auth` containing an HMAC of ACCESS_CODE; 90-day expiry.
- `/api/quick-add` authenticates with `?code=<ACCESS_CODE>` instead (needed for the iOS Shortcut). Rate-limit it lightly (in-memory or upstash-free is fine) and return 401 on bad code.

## 5. Data model (drizzle)

`items`:
- id (cuid), url (text), store (text, hostname without www), name (text), brand (text, nullable)
- priceMinor (int, nullable — store money in minor units), currency (char 3, nullable)
- qty (int, default 1)
- status: enum `want | ordered | arrived` (default want)
- category: enum `jacket | top | trousers | shoes | accessory | other`
- sourceImageUrl (text, nullable), studioImageUrl (text, nullable), studioBackUrl (text, nullable)
- fetchState: enum `pending | ok | partial | failed`
- previousPriceMinor (int, nullable — for the price-drop stretch), lastCheckedAt (timestamp, nullable)
- createdAt, updatedAt

`studio_usage`: id, month (e.g. "2026-08"), count — for the generation cap.

## 6. Scraping pipeline — `/lib/enrich.ts` (the heart of the app)

`POST /api/items {url}` → normalise URL (add https, strip tracking params like utm_*, fbclid) → insert row with fetchState pending → run `enrich(itemId)`.

**Tier 1 — direct fetch.** GET the URL with a realistic mobile Safari User-Agent, `Accept-Language: en-GB,en`, 8s timeout, follow redirects. Parse the HTML with cheerio, in this priority order:

1. **JSON-LD**: every `<script type="application/ld+json">`, including `@graph` arrays. Find `@type: Product` (or array containing it). Take `name`, `brand.name` (or `brand` string), `image` (string or array — take the first/largest), `offers` → `price` + `priceCurrency` (offers may be an object, an array, or an AggregateOffer — handle `lowPrice`).
2. **Meta tags**: `og:title`, `og:image` / `og:image:secure_url`, `twitter:image`, `product:price:amount` + `product:price:currency`, `og:price:amount` + `og:price:currency`.
3. `[itemprop=price]` content attribute.
4. `<title>` as last-resort name; strip site suffixes like " | ASOS" / " - Vinted".

Sanity rules: price must be > 0 and < £100,000; absolutise relative image URLs; reject images that are obviously not product shots (svg, favicon paths, images whose URL suggests a logo/sprite). Decode HTML entities.

**Tier 2 — rendered fetch.** Only if Tier 1 is missing price or image AND (the host is in a `JS_SITES` list you maintain, or the HTML looked like an app shell). Launch playwright-core with @sparticuz/chromium, `domcontentloaded` + 2s settle, then run the same parser on the rendered HTML. Dynamic-import so local dev without chromium still works; on Vercel give this function 1536MB memory. If launch fails, degrade silently to Tier 1's result.

**Tier 3 — proxy scraping API.** Only if SCRAPER_API_KEY is set AND still missing price/image AND host is in `HARD_SITES` (start with: vinted.*, depop.com, grailed.com, ebay.*). Call the provider with JS rendering on, parse the same way.

**Tier 4 — AI text fallback.** Gemini text call with whatever we have (title, URL slug) to fill **brand and category only**. It must never invent a price or an image.

Outcome → fetchState: `ok` (name+price+image), `partial` (some), `failed` (nothing useful). Never fake data — a missing price stays missing and the UI says so.

Write unit tests for the parser against 4–5 saved HTML fixtures (a JSON-LD site, an og-tags-only site, an AggregateOffer case, a bot-wall challenge page that should yield nothing). Parsing is the fragile part of this app; test it.

## 7. Studio packshot pipeline — `/lib/studio.ts` (the marquee feature)

Triggers: a "Studio photo" button on each item; a "Generate all missing" button on the basket; automatically after enrich when AUTO_STUDIO=true.

1. Check the monthly cap (studio_usage vs STUDIO_MONTHLY_CAP). Over cap → friendly refusal message.
2. Download sourceImageUrl server-side.
3. Call the Gemini image model with the source image plus this prompt (adjust the bracketed part by category):

> "Professional e-commerce product photo of this exact item. Extract the product from the photo and re-shoot it as a clean studio packshot: centred, front view, [garments: flat-lay or ghost-mannequin / shoes: pair in three-quarter side profile / accessories: front-on], pure white seamless background (#FFFFFF), soft even studio lighting, subtle natural shadow beneath the item, no people, no hands, no text, no props, no watermark. Preserve the item's exact colours, materials, proportions, logos, stitching and details. Square 1:1 composition."

4. Save the PNG to Vercel Blob → studioImageUrl. Keep the original. Increment usage. On any failure, keep showing the original and surface a toast.
5. If BACK_VIEW=true, run a second generation for the back view → studioBackUrl, and label it "AI guess" in the UI — the model is inferring a back it has never seen, and I understand that.
6. UI: thumbnails prefer studioImageUrl when present; the item editor gets an Original / Studio toggle and a Regenerate button.

## 8. Screens & design system

Routes: `/unlock`, `/` (basket), `/run` (checkout run), `/settings`, plus `/api/*`.

**Copy this design system exactly — it's the look I've already approved. No gradients, no glassmorphism, no emoji-as-UI.**

- Canvas `#F5F5F7`. Cards `#FFFFFF`, radius 24, shadow `0 1px 2px rgba(0,0,0,0.04)`. Image tiles `#F2F2F4`, radius 14, images `object-contain`. Hairlines `#EDEDEF`.
- Ink `#111114`, grey `#8A8A8E`, light grey `#B5B5BA`. Accent lilac `#7B61FF`. Green `#34C759`, amber `#FF9F0A`, red `#FF3B30`.
- Font: `-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', Arial, sans-serif`. Prices and counts get `font-variant-numeric: tabular-nums`.
- Primary buttons: black pills — `#111114` background, white 15px/600 text, fully rounded, 14px vertical padding.
- Status chips: tinted pills, 11px/600 — Want lilac, Ordered amber, Arrived green, each on a 10%-opacity tint of its colour.

**Basket screen `/`:** Title "Basket" (26/700) with "n items · m stores" right-aligned in grey. Two view chips (Basket / Checkout — active is black pill). Rounded paste bar with a black circular ＋. Store sections: 16px favicon + domain (13/600) + count, subtotal right. Item rows: 64px thumb on tile; name 14/600 two-line clamp; price 14/700 (or a lilac "Add price" button when missing, or a red "Fetch failed — fill manually" state); brand in light grey; right column = status chip over a − qty + stepper pill. Tapping the thumb or name opens an inline editor: name, price, image URL, Retry auto-fetch, Studio photo / Regenerate, Original–Studio toggle, Remove (two-tap confirm). Per-store "Open all" and "Copy links" text buttons. Bottom summary card: Items / Stores / Unpriced rows, hairline, Total (18/700), black pill "Checkout · £x". Non-GBP items are flagged and excluded from the Total.

**Run screen `/run`:** one store at a time. "Store i of n" header with subtotal. Card: store favicon + name, item rows with 44px thumbs, hairlines, bold Total row, "Open all / Copy links" row. Black pill "Mark as Ordered", grey text "Skip this store". Progress dots (done green, current black, upcoming light). Completion card with a green tick, count and total, "Back to basket". Footnote: "Approve each payment in your banking app."

**Settings:** shows which env keys are present (booleans only, never values), studio usage this month vs cap, JSON export/import of items, and the iOS Shortcut instructions from §9.

Every screen needs proper empty, loading (skeleton shimmer on pending thumbs), and error states. Mobile-first at 390px; centred max-width column on desktop.

## 9. Adding items from anywhere

1. The paste bar.
2. `GET or POST /api/quick-add?code=<ACCESS_CODE>&url=<link>` → create + enrich → 302 to `/` (or JSON when `Accept: application/json`).
3. PWA `manifest.json` with `share_target` (GET; url/text/title params → `/share` route → quick-add). This covers Android and desktop Chrome.
4. iOS Safari does **not** support share_target — so after deploy, write me exact step-by-step instructions (in the README and on /settings) for building an iOS Shortcut called "Add to Basket" that appears in the share sheet and calls `/api/quick-add` with the shared URL and my code.
5. PWA basics: manifest, generated monochrome shopping-bag icons, `display: standalone`, minimal service worker so it installs cleanly. Offline support not required.

## 10. Build order

1. Scaffold + Tailwind tokens + fonts. 2. Drizzle schema, migrations, passcode middleware + /unlock. 3. Items CRUD + paste-bar add flow. 4. Tier-1 scraper + parser unit tests. 5. Basket screen complete. 6. Run screen complete. 7. Tiers 2–4. 8. Studio pipeline + cap. 9. quick-add, share_target, PWA, README + Shortcut guide. 10. Stretch (below) only if everything else passes.

**Stretch, only after §11 passes:** Vercel cron, daily: re-run Tier 1 on all `want` items; on a price drop, set previousPriceMinor and show a struck-through "was £x" badge on the row.

## 11. Acceptance checklist — run through this yourself and show me the results

- Paste an ASOS, Uniqlo and END. link → name, price, photo appear with no typing from me.
- Paste a Vinted link → with SCRAPER_API_KEY set it fills; without it, the item lands in a clean "fill manually" state and the editor opens.
- Studio photo turns a cluttered source image into the item on white; the grid looks uniform; the Original/Studio toggle works; the cap counter increments.
- A USD item is flagged "other currency" and excluded from the GBP total.
- Checkout run across two stores: open all, mark ordered, dots advance, completion card correct.
- Fresh incognito browser hits the passcode wall; `/api/quick-add` works with the code param and 401s without it.
- `npm run build` is clean; deployed and working on Vercel; installs as a PWA on Android/desktop.

## 12. What NOT to build

No payments or card storage. No accounts or multi-user. No emails, analytics, or dark mode. No admin panel. No tests beyond the parser fixtures. Keep it exactly this scope — if you think something extra is essential, ask me first.
