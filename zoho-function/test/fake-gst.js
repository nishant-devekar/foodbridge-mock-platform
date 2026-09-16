/* A stand-in for the GST provider, over real HTTP on a real socket. Nothing in
   gst.js is stubbed — only the far end, which is Sandbox.co.in itself. The
   point is to exercise the actual fetch, the actual timeout and the actual
   response reading, not a mock of them. */

import { createServer } from "node:http";

export function startFakeGst(opts = {}) {
  const calls = { authenticate: 0, search: 0, lastGstin: null, lastAuthHeader: null };

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");

    if (url.pathname === "/authenticate") {
      calls.authenticate += 1;
      if (opts.authStatus && opts.authStatus !== 200) {
        res.writeHead(opts.authStatus, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ message: "bad credentials" }));
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify(
        opts.authBody !== undefined ? opts.authBody : { access_token: "tok-123" }
      ));
    }

    if (url.pathname === "/gst/compliance/public/gstin/search") {
      calls.search += 1;
      calls.lastAuthHeader = req.headers.authorization || null;
      calls.lastMethod = req.method;
      calls.lastContentType = req.headers["content-type"] || null;
      /* The real endpoint is a POST carrying { gstin } as JSON. Reading it the
         same way here means a regression back to a query string fails. */
      const chunks = [];
      for await (const c of req) chunks.push(c);
      try { calls.lastGstin = JSON.parse(Buffer.concat(chunks).toString("utf8")).gstin; }
      catch { calls.lastGstin = null; }

      if (opts.hang) return;                       // never responds -> timeout
      const status = opts.searchStatus || 200;
      res.writeHead(status, { "Content-Type": "application/json" });
      return res.end(JSON.stringify(opts.searchBody !== undefined ? opts.searchBody : {}));
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "no such route" }));
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({
        origin: `http://127.0.0.1:${port}`,
        calls,
        close: () => new Promise((r) => server.close(r)),
      });
    });
  });
}

/* A taxpayer record in the shape GSTN uses and the resellers pass through. */
export const ACTIVE_TAXPAYER = {
  gstin: "27ABCDE1234F1Z5",
  lgnm: "MIHA FOODS PRIVATE LIMITED",
  tradeNam: "Miha Foods",
  sts: "Active",
  ctb: "Private Limited Company",
};

export const CANCELLED_TAXPAYER = {
  gstin: "27ABCDE1234F1Z5",
  lgnm: "MIHA FOODS PRIVATE LIMITED",
  sts: "Cancelled",
};
