# Delivery Intelligence — Amazon Delivery Promise Checker

Enter an Amazon **ASIN** and an **Indian PIN code**, and the app checks a real data
source for availability / price / Prime eligibility, and — where a real, permitted
source is connected — the delivery-promise date. It never invents a "today + N days"
delivery date. This document explains exactly what is and isn't possible, and how
to plug in real data.

---

## 1. What I found before writing any code (read this first)

This matters more than the code, because it determines what the app can honestly do.

**There is no first-party Amazon API that returns a PIN-specific delivery-promise
date for an arbitrary ASIN.**

- **Product Advertising API (PA-API 5.0)** — Amazon's affiliate catalog API — returns
  title, images, price, `Offers.Listings.Availability.Message` ("In Stock"), and
  `DeliveryInfo.IsPrimeEligible`. It does **not** accept a postal code and does **not**
  return an estimated delivery date. (Amazon is also retiring PA-API in favour of the
  new "Creators API" during 2026 — same limitation applies there.)
- **Selling Partner API (SP-API)** — for sellers managing their *own* listings/orders.
  It has no endpoint that returns a delivery-date *estimate* for a given ASIN + postal
  code either (confirmed by Amazon's own seller-forum staff when sellers ask this exact
  question — there is no such endpoint).
- **Amazon Ads API** — advertising reporting/campaign management, unrelated to delivery
  promises.
- The only place that number exists is the **rendered product/checkout page**, computed
  live from your account/session + delivery address. There is no authorized API that
  exposes it to third parties.

**What this means for the app:**

1. The app ships with a clean **provider abstraction** (`DeliveryProvider`) so the data
   source is swappable without touching the frontend or the rest of the backend.
2. **`mock` provider** — deterministic fake data, clearly labeled `DEMO DATA`
   everywhere in the UI, for building/testing the interface. Never dressed up as real.
3. **`paapi` provider** — a real, working integration with Amazon's own Product
   Advertising API (AWS Signature V4, actually implemented, not pseudocode). It
   returns real title/price/availability/Prime data. It **always returns
   `deliveryDate: null`** and says so in its `source` field, because Amazon does not
   give that number out through this API. This is the honest ceiling of what an
   "authorized Amazon API" can do here.
4. **`thirdparty` provider** — a generic, ready-to-use REST adapter for a **permitted
   third-party delivery-data provider** you contract with directly (a paid data API,
   not a scraper you run yourself). Providers exist that check Amazon's own rendered
   page at a given postal code under their own infrastructure/ToS and sell the answer
   back as a normal JSON API (for example, marketplace data vendors on platforms like
   Apify publish exactly this as a paid "delivery & availability check" API). This
   project does not embed or endorse a specific one, and it does **not** contain any
   CAPTCHA-bypass, anti-bot-evasion, or stealth-browser code — you sign up with a
   provider under its own terms, drop the base URL + API key into Settings, and this
   adapter calls it like any other REST API.

**Where to enter credentials:** `backend/.env` (or the in-app **Settings** page, which
writes to the database and takes effect immediately, no restart needed):

```
DELIVERY_PROVIDER=thirdparty        # or paapi, or mock
PAAPI_ACCESS_KEY=...
PAAPI_SECRET_KEY=...
PAAPI_PARTNER_TAG=...
THIRDPARTY_API_BASE_URL=https://api.your-provider.com
THIRDPARTY_API_KEY=...
THIRDPARTY_API_SECRET=...
```

**How the adapter connects:** `backend/providers/thirdPartyProvider.js` has two small,
clearly-marked functions — `_buildRequest()` and `_parseResponse()` — that map your
specific provider's request/response field names onto the app's internal
`DeliveryResult` shape. That is the only file you need to touch to go live with a real
delivery-date provider. Nothing else in the app changes.

---

## 2. Architecture

```
frontend/  (static HTML/CSS/vanilla JS, no build step)
    ↓ fetch()
backend/   (Node.js + Express)
    ↓
backend/providers/  (DeliveryProvider interface)
    mock | paapi | thirdparty
    ↓
real internet call (paapi / thirdparty only)
    ↓
backend/database/  (SQLite: checks, cache, settings)
    ↓
frontend (results, history, dashboard, exports)
```

```
delivery-intelligence/
├── frontend/
│   ├── index.html            (Dashboard)
│   ├── single-check.html
│   ├── bulk-check.html       (CSV/Excel bulk + ASIN→many PINs, tabbed)
│   ├── history.html
│   ├── analytics.html        (ASIN analysis)
│   ├── settings.html
│   ├── css/style.css
│   └── js/{app,dashboard,singleCheck,bulkCheck,history,analytics,settings}.js
├── backend/
│   ├── server.js
│   ├── routes/{delivery,history,settings}.js
│   ├── controllers/{delivery,history,settings}Controller.js
│   ├── services/{cache,queue,settings,history}Service.js
│   ├── providers/{deliveryProvider,mockProvider,amazonPAAPIProvider,thirdPartyProvider,index}.js
│   ├── database/{db.js,schema.sql}
│   ├── middleware/{validate,errorHandler,rateLimiter}.js
│   └── utils/{validators,timezone}.js
├── .env.example
├── package.json
└── README.md
```

---

## 3. Installation

Requires **Node.js 18+**.

```bash
cd delivery-intelligence
cp .env.example backend/.env       # then edit backend/.env with your values
npm run install:backend            # installs backend/node_modules
```

## 4. Starting the app

**Backend:**

```bash
npm start                          # from the project root, or:
cd backend && npm start            # equivalent
```

The API listens on `http://localhost:4000` by default (`PORT` in `.env`). On first
boot it creates `backend/database/database.sqlite` automatically from `schema.sql`.

**Frontend:** it's static files, no build step. Either:

- Open `frontend/index.html` directly in a browser, or
- Serve it with any static server, e.g. `npx serve frontend` or the VS Code "Live
  Server" extension (recommended, since some browsers restrict `fetch` from `file://`).

If your frontend runs on a different origin than `http://localhost:4000`, set
`CORS_ORIGIN` in `backend/.env` to that origin, and set
`window.DELIVERY_API_BASE = 'http://your-backend-host:4000'` before `js/app.js` loads
(add a `<script>` tag with that line in each HTML file, or edit the default at the top
of `frontend/js/app.js`).

## 5. Configuring a live provider

1. Open **Settings** in the app (or edit `backend/.env` directly).
2. Pick **Active Provider**: `mock` (default, safe to demo immediately), `paapi`, or
   `thirdparty`.
3. Fill in the matching credential fields. Credentials are stored server-side only
   (SQLite `settings` table or `.env`) — never in frontend code or localStorage — and
   are masked in the UI after saving.
4. The sidebar's provider pill updates immediately: **● LIVE** (green), **API NOT
   CONFIGURED** (red, shown instead of pretending it works), or **DEMO / MOCK**
   (blue).

## 6. Testing one ASIN + PIN

1. Go to **Single Check**.
2. Enter a 10-character ASIN (e.g. `B0CHX1W1XY`) and a 6-digit Indian PIN (e.g.
   `380001`).
3. Click **Check Delivery**. With `mock` active you'll see clearly-labeled demo data
   instantly; with `paapi`/`thirdparty` active you'll see a real API response (or a
   friendly error if the ASIN isn't found / the provider is down).
4. If you check the same ASIN+PIN+quantity again within the cache window, you'll see
   **Cached Result** with a **Refresh Now** button to force a fresh lookup.

## 7. Uploading a bulk Excel/CSV file

1. Go to **Bulk Checker** → **Bulk ASIN + PIN** tab.
2. Click **Download Template** for the exact expected columns (`ASIN`, `PIN`,
   `Quantity`), or use **Upload Excel/CSV**, or paste rows directly.
3. Click **Parse Rows** to validate and de-duplicate, then **Check All**.
4. A progress bar shows live completion %, success/unavailable/error counts. Duplicate
   ASIN+PIN+quantity combinations are only checked once.
5. Filter/search/paginate the results table, then **Export Excel**.

The **One ASIN → Multiple PINs** tab works the same way for a single ASIN against a
list of pasted PIN codes, with a summary card (deliverable %, earliest/latest date).

## 8. API documentation

Base URL: `http://localhost:4000/api`

### `POST /delivery/check`
```json
// request
{ "asin": "B0XXXXXXXXXX", "postalCode": "380001", "quantity": 1, "forceRefresh": false }
```
```json
// response
{
  "success": true,
  "asin": "B0XXXXXXXXXX",
  "postalCode": "380001",
  "quantity": 1,
  "productName": "...",
  "deliverable": "yes",
  "deliveryDate": "2026-09-05",
  "deliveryDateRaw": null,
  "deliverySpeedDays": 3,
  "primeEligible": "yes",
  "providerMode": "LIVE",
  "fromCache": false,
  "checkedAt": "2026-09-02T14:20:00+05:30",
  "source": "..."
}
```

### `POST /delivery/bulk`
```json
{ "items": [{ "asin": "B0AAA12345", "postalCode": "380001", "quantity": 1 }, ...] }
```
Returns `{ jobId, totalRows, uniqueChecks, duplicatesRemoved, invalidRows }` immediately;
poll the job below for progress.

### `GET /delivery/bulk/:jobId`
Returns live progress: `{ status, total, completed, successful, unavailable, errors, percent }`.
When `status === "done"`, also includes the full `results` array.

### `GET /delivery/status`
Active provider, mode (`LIVE`/`DEMO`), whether it's configured, and the full provider
registry (used to render the sidebar/Settings status pills).

### `GET /delivery/asin/:asin/analysis`
Aggregated stats for one ASIN across every PIN it's been checked against.

### `GET /delivery/history` `DELETE /delivery/history` `GET /delivery/history/export` `GET /delivery/history/dashboard`
Filterable history listing (query params: `asin`, `postalCode`, `deliverable`,
`provider`, `dateFrom`, `dateTo`, `search`, `page`, `pageSize`), bulk/selective delete,
export-ready rows, and dashboard aggregate stats.

### `GET /settings` `POST /settings`
Read (secrets masked) / write configuration — provider selection, credentials, cache
duration, queue concurrency/rate/retries/timeout.

## 9. Rate limiting, retries, caching (how requests to the provider are controlled)

- **Queue** (`backend/services/queueService.js`): bounded concurrency (default 3),
  global requests-per-minute spacing, up to N retries per item with exponential
  backoff (1s → 2s → 4s ... capped at 15s), and a per-request timeout inside each
  provider's `fetch` call (`AbortController`). All configurable in **Settings → API /
  Provider**.
- **Cache** (`backend/services/cacheService.js`): key = `ASIN_PIN_QUANTITY`, TTL
  configurable (default 30 minutes). A cache hit never re-calls the provider; the UI
  labels it "Cached Result" with a manual "Refresh Now" override.
- Nothing in this project attempts to exceed, rotate around, or hide from any
  provider's own rate limits.

## 10. Troubleshooting

| Symptom | Cause / Fix |
|---|---|
| Sidebar shows "Backend offline" | Backend isn't running, or `window.DELIVERY_API_BASE` / `CORS_ORIGIN` mismatch. Start `npm start` in `backend/` and check the console URL. |
| "API NOT CONFIGURED" pill | Selected provider is missing required credentials — fill them in on **Settings**. |
| Single check returns `DELIVERY DATE UNAVAILABLE` on `paapi` | Expected — PA-API does not provide delivery dates (see §1). Switch to `thirdparty` for real dates, or treat `paapi` as price/availability/Prime only. |
| `better-sqlite3` fails to install/build | It ships prebuilt binaries for common platforms; if your platform lacks one, install build tools (`python3`, a C++ compiler) or use `npm rebuild better-sqlite3`. |
| Bulk job stuck at 0% | Check the backend console for errors from the active provider (timeouts, auth failures) — the queue will still retry and eventually mark stuck items as `error` rather than hang forever. |
| Excel export button does nothing | Make sure you have results loaded first (run a check before exporting); the button no-ops with a toast if there's nothing to export. |
| CORS errors in the browser console | Set `CORS_ORIGIN` in `backend/.env` to match exactly the origin the frontend is served from (protocol + host + port). |

## 11. Security notes

- All provider credentials live server-side (`.env` or the SQLite `settings` table),
  are masked in every API response, and are never sent to or stored in the frontend.
- Input is validated both client- and server-side (ASIN format, 6-digit Indian PIN,
  quantity bounds).
- The app's own API is rate-limited (`express-rate-limit`) independently from the
  outbound provider queue.
- Errors returned to the browser are generic ("Unable to retrieve delivery
  information") — raw provider/stack traces are logged server-side only.
- Nothing in this codebase performs CAPTCHA bypass, bot-detection evasion, proxy
  rotation to dodge blocks, stealth browser automation, or Amazon credential
  collection — by design, not by omission.
