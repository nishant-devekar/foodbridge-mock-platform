/* Store Builder's phone-to-computer hand-off: the phone posts contacts under a
   code, the computer takes them once, and nothing but names and numbers rides
   along. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.FB_STORES_DIR = mkdtempSync(join(tmpdir(), "fb-handoff-"));
delete process.env.BLOB_READ_WRITE_TOKEN;

const { default: handler } = await import("../api/handoff.js");

function call(method, { body, url = "/api/handoff" } = {}) {
  return new Promise((resolve) => {
    const res = {
      statusCode: 0, setHeader() {},
      writeHead(s) { this.statusCode = s; },
      end(b) { resolve({ status: this.statusCode, json: JSON.parse(String(b)) }); },
    };
    handler({ method, url, headers: { origin: "" }, body }, res);
  });
}

const CODE = "k3x9m2q7w1za";

test("a hand-off is taken once, in the order it arrived, names and numbers only", async () => {
  assert.equal((await call("POST", { body: { code: CODE, hello: true } })).status, 200);
  assert.equal((await call("POST", { body: { code: CODE, people: [{ name: " Sharma  Kirana ", phone: "+91 98200 11223", email: "x@y" }] } })).status, 200);
  await call("POST", { body: { code: CODE, people: [{ name: "Patel Stores", phone: "99876<b>54321" }] } });
  const r = await call("GET", { url: "/api/handoff?code=" + CODE });
  assert.equal(r.status, 200);
  assert.equal(r.json.opened, true);
  assert.deepEqual(r.json.people, [{ name: "Sharma Kirana", phone: "+91 98200 11223" }, { name: "Patel Stores", phone: "9987654321" }]);
  const again = await call("GET", { url: "/api/handoff?code=" + CODE });
  assert.deepEqual(again.json, { opened: false, people: [], files: [], more: false });
});

test("a bad code or an empty post is refused, not stored", async () => {
  assert.equal((await call("POST", { body: { code: "../etc", people: [{ name: "A" }] } })).json.error, "bad_code");
  assert.equal((await call("POST", { body: { code: CODE, people: [] } })).json.error, "nothing_sent");
  assert.equal((await call("GET", { url: "/api/handoff?code=SHORT" })).status, 400);
});

test("photos: one per post, photos and PDFs only, and a big batch is handed over in parts", async () => {
  const C = "p4x9m2q7w1zb";
  const big = Buffer.alloc(1200 * 1024, 7).toString("base64");
  assert.equal((await call("POST", { body: { code: C, file: { name: "khata 1.jpg", type: "image/jpeg", data: big } } })).status, 200);
  assert.equal((await call("POST", { body: { code: C, file: { name: "khata 2.jpg", type: "image/jpeg", data: big } } })).status, 200);
  assert.equal((await call("POST", { body: { code: C, file: { name: "khata 3.jpg", type: "image/jpeg", data: big } } })).status, 200);
  assert.equal((await call("POST", { body: { code: C, file: { name: "x.exe", type: "application/x-msdownload", data: "AAAA" } } })).json.error, "bad_type");
  const first = await call("GET", { url: "/api/handoff?code=" + C });
  assert.equal(first.json.more, true);
  assert.ok(first.json.files.length >= 1 && first.json.files.length < 3);
  assert.equal(first.json.files[0].name, "khata 1.jpg");
  let got = first.json.files.map((f) => f.name), r = first.json;
  while (r.more) { r = (await call("GET", { url: "/api/handoff?code=" + C })).json; got = got.concat(r.files.map((f) => f.name)); }
  assert.deepEqual(got, ["khata 1.jpg", "khata 2.jpg", "khata 3.jpg"]);
});
