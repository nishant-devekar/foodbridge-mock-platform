# FoodBridge → Zoho Books bridge

The smallest server-side thing that makes a confirmed FoodBridge order appear
as a **real sales order in the customer's Zoho Books account**.

```
GitHub Pages                    this function                  Zoho Books
(static FoodBridge)             (holds the secrets)
       │                               │                            │
       │  POST /api/sales-order        │                            │
       │  { order }                    │  refresh_token → access    │
       ├──────────────────────────────▶│───────────────────────────▶│
       │                               │  POST /books/v3/salesorders│
       │                               │  GET  /salesorders/{id}    │
       │◀──────────────────────────────┤◀───────────────────────────┤
       │  real salesorder_id + number  │                            │
```

Nothing here is mocked. Every sales order id, number and status the UI shows
came out of Zoho. There is no offline success path: if this function is
unreachable or unconfigured, FoodBridge reports the order as **not** synced.

**Scope, deliberately:** one Zoho Books organisation, mappings as two literal
objects, no database, no auth, no multi-tenancy. This is a PMF experiment.

---

## What you need before it can work

Five things, none of which can be invented:

| # | Value | Where it comes from |
|---|---|---|
| 1 | `ZOHO_CLIENT_ID` | [api-console.zoho.in](https://api-console.zoho.in) → *Server-based Applications* |
| 2 | `ZOHO_CLIENT_SECRET` | same screen |
| 3 | `ZOHO_ORGANIZATION_ID` | Zoho Books → Settings → Organisation Profile |
| 4 | `ZOHO_REFRESH_TOKEN` | minted by the one-time `/api/connect` flow below |
| 5 | Customer + item ids | Zoho Books → Customers / Items → the id in the URL |

Use the API console for **the customer's own region**. An India account is
`api-console.zoho.in`, `accounts.zoho.in`, `www.zohoapis.in`. A `.com` client
will not work against a `.in` organisation.

---

## Setup

### 1. Configure

```bash
cd zoho-function
cp .env.example .env
```

Fill in `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, and `ZOHO_ORGANIZATION_ID`.
Check `ZOHO_ACCOUNTS_URL` / `ZOHO_API_BASE_URL` match the customer's region
(they default to India).

On the Zoho API console, set the client's **Authorized Redirect URI** to
exactly the `ZOHO_REDIRECT_URI` value — character for character.

### 2. Mint the refresh token (once, ever)

```bash
node dev-server.js
```

Open <http://localhost:8787/api/connect>, sign in as the customer's Zoho admin,
approve. The callback page shows the refresh token once. Paste it into
`ZOHO_REFRESH_TOKEN` and restart.

Scopes requested — only these two:

```
ZohoBooks.salesorders.CREATE
ZohoBooks.salesorders.READ
```

After this, no salesperson ever authenticates with Zoho. The refresh token
mints access tokens on demand and does not expire until revoked.

### 3. Map the customer and products

```bash
node seed-catalogue.js --dry-run   # show what it would create
node seed-catalogue.js             # create it, then write mappings.js
```

Seeds the whole FoodBridge catalogue into Zoho — every customer as a contact,
every product as an item — and writes [`mappings.js`](mappings.js) from the ids
Zoho hands back. Idempotent: existing contacts (matched by name) and items
(matched by SKU) are reused, so re-running creates nothing.

**Pricing:** the rate is read out of the tenant's own product names ("… NEW MRP
660"). That is an MRP — retail, not the trade price a distributor charges a
shop. Correct it on the Zoho item if it differs; FoodBridge never sends a price,
so Zoho's number is always the one that counts. 23 of 86 products carry no MRP
in their name and are created at 0.

To map by hand instead, edit [`mappings.js`](mappings.js) directly.

```js
export const ZOHO_CUSTOMER_MAP = {
  "c01": "460000000000123456",          // FoodBridge id → Zoho contact_id
};

export const ZOHO_ITEM_MAP = {
  "p01": { itemId: "460000000000098765", unit: "Box", factor: 1 },
};
```

`factor` is how many Zoho units make **one** FoodBridge unit. Leave it at `1`
when the Zoho item is already sold by the box. Set it to `12` when Zoho sells
the item in pieces and a FoodBridge Box is twelve of them — otherwise "19 Box"
silently becomes 19 jars.

Only map the products you are actually testing with.

### 4. Point the app at it

The static app reads one non-secret value,
`v4/modules/foodbridge-customer-mockup/v3/screens/customers/integration-config.js`,
which defaults to `http://localhost:8787`. When you deploy the function, set
that to its URL and add the Pages origin to `ALLOWED_ORIGINS`:

```
ALLOWED_ORIGINS=https://nishant-devekar.github.io
```

### 5. Deploy (when you want it off localhost)

```bash
./node_modules/.bin/vercel login
./deploy.sh
```

`deploy.sh` links the project, pushes every value from `.env` into the Vercel
environment, and deploys. `api/*.js` become the endpoints. Nothing else moves —
FoodBridge stays on GitHub Pages.

**Devices no longer need provisioning.** `FB_API_KEY` must match `DEFAULT_KEY`
in `v4/modules/foodbridge-customer-mockup/v3/screens/customers/integration-config.js`,
which every browser sends. Rotating the key means changing both and redeploying
both — the function (`./deploy.sh`) and the page.

The old `?fbkey=<key>` provisioning link is gone. It stored the key and then
stripped it from the address bar, which meant the URL people actually kept and
shared carried no key, and those browsers got a `401` at Confirm Order with a
`Retry Sync` that could never succeed. Such links are now ignored and only
stripped, and keys stored under the old scheme are dropped on load so no
browser stays pinned to a rotated one.

`?fbapi=<url>` still overrides the bridge URL per device, which is what local
work needs; a bridge run with `FB_API_KEY` unset skips the key check entirely.

```js
localStorage.setItem("fb-api-base", "http://localhost:8787")
```

**About that key.** A deployed bridge creates real sales orders in a real Zoho
organisation, and CORS does not stop a `curl`. `FB_API_KEY` means the URL alone
is not enough. It is **not authentication** — the browser has to carry it, so
anyone reading the page source has it. It is the difference between a scanner
finding the endpoint and someone deliberately going after it. Leave it unset and
the check is skipped, which is fine on localhost and not fine in public.

Since the key now ships in a public repo, that speed bump is lower than it was:
a scanner grepping GitHub can find it without ever loading the page. It was
already public to every user of the app, so this is a difference of degree —
but treat the key as **rotatable and expected to leak**, and let the real
containment be what it always was: OAuth credentials that stay on the server,
one Zoho organisation, and a mapping table that refuses anything it does not
recognise. `ALLOWED_ORIGINS` still restricts browser traffic to the Pages
origin, which is the control doing the most work for real users.

---

## Endpoints

| Route | Purpose |
|---|---|
| `POST /api/sales-order` | the only one FoodBridge calls |
| `GET /api/health` | what is configured, what is missing (names only) |
| `GET /api/connect` | one-time OAuth start |
| `GET /api/callback` | one-time OAuth callback |

---

## Duplicate protection

A FoodBridge order id maps to **at most one** Zoho sales order, however many
times Retry is pressed. Enforced by asking Zoho, not by remembering:

1. Order already carries a `zohoOrderId` → `GET` it, return it.
2. Otherwise `GET /salesorders?reference_number=FB-SO-…` → found, return it.
3. Only if neither → `POST` a new one.
4. A **timeout** is never treated as a failure. Zoho may hold the order with
   only the reply lost, so the retry searches by reference before writing.

The FoodBridge order id travels as Zoho's `reference_number`, which is what
makes both the duplicate check and "where did this order come from?" work.

## Pricing

`rate` is **not** sent. FoodBridge holds no price for any product, so omitting
it lets Zoho apply the item's own configured selling price. Inventing a number
would produce a financially wrong order that looks right.

## Verification

After creating, the function `GET`s the order back and compares reference,
customer, line count, item ids and quantities. A mismatch is reported as a
**failure** with the Zoho id, not as success.

## Tests

```bash
npm test
```

Twelve tests run `zoho.js` and `sync.js` unmodified over real HTTP against a
local stand-in for Zoho ([`test/fake-zoho.js`](test/fake-zoho.js)): happy path,
confirmed-quantity-not-recommended, unit conversion, unmapped customer,
unmapped product, Zoho rejection, retry idempotency, timeout recovery,
verification mismatch, auth failure, secret redaction, deep-link absence.

The stand-in replaces only the far end of the socket. It is not a fallback the
app can reach — it exists only inside `node --test`.

## Secrets

`.env`, `.env.*` and `.vercel` are gitignored. No credential is committed, sent
to the browser, logged, or written into the static app. The browser knows one
thing: the function's URL.
