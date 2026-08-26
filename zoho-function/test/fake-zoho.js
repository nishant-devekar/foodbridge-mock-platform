/* ==========================================================================
   A stand-in for Zoho Books, so the bridge's REAL code path -- real fetch,
   real OAuth refresh, real payload, real envelope parsing -- can be exercised
   without credentials.

   This does NOT stand in for the integration. zoho.js and sync.js run
   unmodified against it; the only thing replaced is the far end of the socket,
   which is the one piece we cannot have until the customer connects their
   account. Every id it returns is its own invention and never reaches a user:
   these are test doubles inside `node --test`, not a fallback the app can use.
   ========================================================================== */

import { createServer } from "node:http";

export function startFakeZoho(opts = {}) {
  const state = {
    orders: new Map(),          // salesorder_id -> record
    posts: 0,                   // how many CREATE calls actually arrived
    tokenCalls: 0,
    lastPayload: null,
    seq: 1,
    hangOnCreate: opts.hangOnCreate || false,   // never answer POST (timeout)
    rejectCreate: opts.rejectCreate || false,   // Zoho refuses the order
    badAuth: opts.badAuth || false,
    mangleQty: opts.mangleQty || false,         // return a different quantity
  };

  const send = (res, status, body) => {
    const s = JSON.stringify(body);
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(s);
  };

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, "http://x");

    if (url.pathname === "/oauth/v2/token") {
      state.tokenCalls++;
      // Zoho reports a bad refresh token as HTTP 200 with an `error` key.
      if (state.badAuth) return send(res, 200, { error: "invalid_code" });
      return send(res, 200, { access_token: "test-access-token", expires_in: 3600, api_domain: "http://127.0.0.1" });
    }

    if (url.pathname === "/books/v3/salesorders" && req.method === "POST") {
      if (state.hangOnCreate) return; // socket left open -> client times out
      state.posts++;
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      state.lastPayload = payload;
      if (state.rejectCreate) return send(res, 400, { code: 1002, message: "Invalid value passed for item_id" });

      const id = String(460000000000000000n + BigInt(state.seq));
      const number = "SO-" + String(state.seq).padStart(5, "0");
      state.seq++;
      const record = {
        salesorder_id: id,
        salesorder_number: number,
        status: "draft",
        reference_number: payload.reference_number,
        customer_id: payload.customer_id,
        customer_name: "Test Customer",
        date: payload.date,
        line_items: (payload.line_items || []).map((l) => ({
          item_id: l.item_id,
          quantity: state.mangleQty ? Number(l.quantity) + 1 : Number(l.quantity),
          unit: l.unit || "",
        })),
      };
      state.orders.set(id, record);
      return send(res, 201, { code: 0, message: "success", salesorder: record });
    }

    if (url.pathname === "/books/v3/salesorders" && req.method === "GET") {
      const ref = url.searchParams.get("reference_number");
      const rows = [...state.orders.values()].filter((o) => !ref || o.reference_number === ref);
      return send(res, 200, { code: 0, message: "success", salesorders: rows });
    }

    const m = url.pathname.match(/^\/books\/v3\/salesorders\/(.+)$/);
    if (m && req.method === "GET") {
      const rec = state.orders.get(decodeURIComponent(m[1]));
      if (!rec) return send(res, 404, { code: 1001, message: "Sales order does not exist" });
      return send(res, 200, { code: 0, message: "success", salesorder: rec });
    }

    return send(res, 404, { code: 9999, message: "not found" });
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({
        state,
        port,
        origin: `http://127.0.0.1:${port}`,
        close: () => new Promise((r) => server.close(r)),
      });
    });
  });
}
