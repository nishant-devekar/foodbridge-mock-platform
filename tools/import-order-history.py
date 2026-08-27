#!/usr/bin/env python3
"""Import a Zoho Books Sales Order export into v4's order-history.js.

    python3 tools/import-order-history.py ~/Downloads/Sales_Order.csv

Regenerates
  v4/modules/foodbridge-customer-mockup/v3/screens/customers/order-history.js
from a fresh export. That file is GENERATED — never hand-edit it, re-run this.

Every judgement call it makes is written into the header of the file it
produces, so the output explains itself without this script in hand. In short:
match customers by name and products by Zoho item id or exact name against
v4's own seed; keep only orders that are real demand (invoiced /
partially_invoiced / confirmed); merge orders sharing a date for one customer
into ONE buying occasion; drop weight-billed lines for the products the tenant
also sells loose; keep the last 24 months.

The forecast in predictive-order.js is FITTED to this data. If a new export
shifts the business materially, re-run that engine's back-test before trusting
the accuracy figures in its header — the tuning is not guaranteed to survive.

The catalogue and customer roster are read from the app's own seed through
node, so they can never drift out of step with the app.
"""
import csv, json, collections, re, statistics, datetime, subprocess, sys, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCREENS = os.path.join(ROOT, "v4/modules/foodbridge-customer-mockup/v3/screens/customers")
OUT = os.path.join(SCREENS, "order-history.js")
CSV_PATH = os.path.expanduser(sys.argv[1] if len(sys.argv) > 1 else "~/Downloads/Sales_Order.csv")
MONTHS = 24
KEEP_STATUS = {"invoiced", "partially_invoiced", "confirmed"}
WEIGHT_UNITS = {"g", "kg", "gm"}

if not os.path.exists(CSV_PATH):
    sys.exit("no such export: " + CSV_PATH)

csv.field_size_limit(10 ** 9)

# ---- the app's own seed is the authority on what exists --------------------
_js = ('global.window={};require(%r);const S=global.window.SEED;'
       'console.log(JSON.stringify({products:S.products.map(p=>({id:p.id,artNo:p.artNo,name:p.name})),'
       'customers:S.b2b.map(c=>({id:c._id,name:typeof c.name==="object"?c.name.en:c.name}))}));'
       % os.path.join(SCREENS, "seed.inline.js"))
seed = json.loads(subprocess.check_output(["node", "-e", _js]).decode())

norm = lambda s: re.sub(r"\s+", " ", (s or "").strip()).lower()
by_art = {p["artNo"]: p["id"] for p in seed["products"]}
by_name = {norm(p["name"]): p["id"] for p in seed["products"]}
pid_of = lambda r: by_art.get(r.get("Product ID")) or by_name.get(norm(r.get("Item Name")))

cust_by_name = collections.defaultdict(list)
for c in seed["customers"]:
    cust_by_name[norm(c["name"])].append(c["id"])

rows = list(csv.DictReader(open(CSV_PATH, encoding="utf-8-sig")))

# Customers sharing a name are split by their distinct Zoho contact id, in id
# order, so two real accounts never collapse into one history.
dup_map = {}
for n, ids in cust_by_name.items():
    if len(ids) < 2:
        continue
    zids = sorted({r["Customer ID"] for r in rows if norm(r["Customer Name"]) == n})
    dup_map.update({z: ids[i] for i, z in enumerate(zids) if i < len(ids)})

skipped = collections.Counter()
raw = {}
for r in rows:
    p = pid_of(r)
    if not p:
        skipped["no_product_match"] += 1; continue
    n = norm(r["Customer Name"])
    if n not in cust_by_name:
        skipped["no_customer_match"] += 1; continue
    if r["Status"] not in KEEP_STATUS:
        skipped["status_" + (r["Status"] or "blank")] += 1; continue
    if (r["Usage unit"] or "").lower() in WEIGHT_UNITS:
        skipped["weight_unit"] += 1; continue
    q = float(r.get("QuantityOrdered") or 0) - float(r.get("QuantityCancelled") or 0)
    if q <= 0:
        skipped["zero_qty"] += 1; continue
    ids = cust_by_name[n]
    cid = dup_map.get(r["Customer ID"], ids[0]) if len(ids) > 1 else ids[0]
    o = raw.setdefault((cid, r["SalesOrder ID"]),
                       {"at": r["Order Date"], "lines": collections.Counter(), "value": 0.0})
    o["lines"][p] += q
    try:
        o["value"] += float(r.get("Item Total") or 0)
    except ValueError:
        pass

# One VISIT is one buying occasion: orders a customer placed on the same date
# are merged. Left apart, "the last three orders" can be a single afternoon.
day = collections.defaultdict(lambda: {"lines": collections.Counter(), "value": 0.0})
for (cid, _), o in raw.items():
    d = day[(cid, o["at"])]
    d["lines"].update(o["lines"]); d["value"] += o["value"]
merged_away = len(raw) - len(day)

by_cust = collections.defaultdict(list)
for (cid, at), o in day.items():
    by_cust[cid].append({"at": at, "value": int(round(o["value"])),
                         "lines": [{"productId": k, "qty": int(round(v))}
                                   for k, v in sorted(o["lines"].items())]})
for cid in by_cust:
    by_cust[cid].sort(key=lambda o: o["at"], reverse=True)

cutoff = (datetime.date.today() - datetime.timedelta(days=int(MONTHS * 30.44))).isoformat()
signals = {}
for cid, occasions in by_cust.items():
    sel = [o for o in occasions if o["at"] >= cutoff]
    if not sel:
        continue
    ds = sorted(datetime.date.fromisoformat(o["at"]) for o in sel)
    gaps = [g for g in ((ds[i + 1] - ds[i]).days for i in range(len(ds) - 1)) if g > 0]
    signals[cid] = {"avgCycleDays": max(1, int(round(statistics.median(gaps)))) if gaps else 30,
                    "orders": sel}

name_of = {c["id"]: c["name"] for c in seed["customers"]}
n_orders = sum(len(v["orders"]) for v in signals.values())
n_lines = sum(len(o["lines"]) for v in signals.values() for o in v["orders"])
dates = sorted(o["at"] for v in signals.values() for o in v["orders"])
missing = [c["id"] for c in seed["customers"] if c["id"] not in signals]

HEADER = """/* ==========================================================================
   REAL ORDER HISTORY — generated by tools/import-order-history.py.
   DO NOT HAND-EDIT: re-run the tool against a fresh export instead.

   Source: the tenant's own Zoho Books "Sales Order" export, imported {today}.
   This is ACTUAL trading history, not invented seed data — every date,
   quantity and value below came out of that export.

   WHAT WAS KEPT
     · Orders whose customer matches one of this app's {ncust} customers by
       name, and whose line item matches one of the {nprod} catalogue products
       by Zoho item id or by exact product name.
     · Statuses invoiced / partially_invoiced / confirmed. Drafts and voided
       orders are NOT demand and are excluded.
     · Quantities as ordered less any cancellation, in the product's base unit
       — the export bills these in `pcs`, factor 1.
     · The last {months} months. The engine reads at most the last 240 days;
       the rest is kept for context and stops this file doubling in size.

   ONE VISIT IS ONE ORDER. Orders the export records on the same date for the
   same customer are MERGED into a single occasion ({merged} of them here).
   One commercial order is often split across several Zoho sales orders; left
   as they came, "the last three orders" could be a single afternoon, which is
   not three buying cycles and distorts every window the engine opens.

   WHAT WAS DROPPED, and why it matters when reading these numbers
     · {weight} lines billed by weight (`g`/`kg`). Those are goods the tenant
       also sells loose rather than as packets; averaging 500 (grams) into a
       piece count would corrupt the forecast for those products.
     · Line items for products outside this app's catalogue, and orders for
       customers outside its roster. The catalogue is a SUBSET of the tenant's
       full Zoho item list, so these orders are real but partial: `value` is
       the sum of the MATCHED lines only, never the invoice total.

   Customers sharing a name are split by their distinct Zoho contact id, so
   two real accounts never collapse into one history.

   avgCycleDays is the MEDIAN gap between that customer's real orders, not a
   target anyone set — orderingStatusFor compares it against the last order to
   bucket On Track / Slipping / Overdue.

   {ncustdata} customers · {norders} orders · {nlines} order lines · {d0} to {d1}.{absent}
   ========================================================================== */

window.FB_ORDER_HISTORY = {{
"""

out = [HEADER.format(
    today=datetime.date.today().isoformat(), ncust=len(seed["customers"]),
    nprod=len(seed["products"]), months=MONTHS, merged=merged_away,
    weight=skipped["weight_unit"], ncustdata=len(signals), norders=n_orders,
    nlines=n_lines, d0=dates[0], d1=dates[-1],
    absent=("\n   No orders in the export for: " + ", ".join(missing) +
            " — reported as no signal rather than filled in." if missing else ""))]

for cid in sorted(signals, key=lambda c: (len(c), c)):
    v = signals[cid]
    out.append("  // %s — %d orders, median cycle %d days\n"
               % (name_of.get(cid, cid), len(v["orders"]), v["avgCycleDays"]))
    out.append("  %s: { avgCycleDays: %d, orders: [\n" % (cid, v["avgCycleDays"]))
    for o in v["orders"]:
        ls = ", ".join('{ productId: "%s", qty: %d }' % (l["productId"], l["qty"])
                       for l in o["lines"])
        out.append('    { at: "%s", value: %d, lines: [%s] },\n' % (o["at"], o["value"], ls))
    out.append("  ] },\n")
out.append("};\n")

open(OUT, "w").write("".join(out))
print("wrote %s (%.1f KB)" % (os.path.relpath(OUT, ROOT), os.path.getsize(OUT) / 1024))
print("  %d customers, %d buying occasions (%d same-day orders merged), %d lines"
      % (len(signals), n_orders, merged_away, n_lines))
print("  %s to %s" % (dates[0], dates[-1]))
if missing:
    print("  no history for: %s" % ", ".join(missing))
print("  skipped rows: %s" % ", ".join("%s=%d" % kv for kv in skipped.most_common()))
print("\n  Remember to bump the ?v= cache tag in stock-audit.html.")
