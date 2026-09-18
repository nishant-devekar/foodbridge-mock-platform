/* Demo feedback. What is under test is the PROMISE the browser relies on: an
   entry is either stored, or the caller is told it was not — never the first
   when the second is true, because the page drops its local copy on success. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/* The module reads FB_FEEDBACK_FILE at import time, so point it at a scratch
   file before importing it. */
const DIR = mkdtempSync(join(tmpdir(), "fb-feedback-"));
process.env.FB_FEEDBACK_FILE = join(DIR, "feedback.jsonl");
delete process.env.FB_FEEDBACK_KV_URL;
delete process.env.FB_FEEDBACK_KV_TOKEN;

const { cleanEntry, store, list, feedbackStore, FeedbackError } = await import("../feedback.js");

/* ── the shape, validated here rather than trusted from the page ───────── */

test("a rating outside 1-5 is refused, and nothing is written", async () => {
  for (const bad of [0, 6, "", null, undefined, "five", NaN]) {
    assert.throws(() => cleanEntry({ rating: bad }), (e) => e instanceof FeedbackError && e.reason === "bad_rating",
      "rating " + JSON.stringify(bad));
  }
});

test("name, comment and phone are normalised, and a number keeps its last ten digits", () => {
  const e = cleanEntry({
    rating: "4",
    name: "  Asha   Mehta  ",
    comment: " Liked   it ",
    phone: "+91 98765 43210",
  });
  assert.equal(e.rating, 4);
  assert.equal(e.name, "Asha Mehta");
  assert.equal(e.comment, "Liked it");
  assert.equal(e.phone, "+91 9876543210");
  assert.match(e.id, /^FB-/);
  assert.ok(Date.parse(e.at), "carries a timestamp");
});

test("an entry with no name or number is still valid — a rating alone is the point", () => {
  const e = cleanEntry({ rating: 5 });
  assert.equal(e.name, "");
  assert.equal(e.phone, "");
  assert.equal(e.comment, "");
});

test("a queued entry keeps the time it was GIVEN, and notes when it arrived", () => {
  const said = new Date(Date.now() - 3 * 864e5).toISOString();   // delivered three days late
  const e = cleanEntry({ rating: 4, at: said });
  assert.equal(e.at, said, "the hour someone actually spoke is what the operator reads");
  assert.ok(Date.parse(e.received) > Date.parse(e.at), "arrival is kept alongside, not instead");
});

test("a browser clock that is wrong cannot backdate or postdate an entry", () => {
  for (const bad of [new Date(Date.now() + 864e5).toISOString(),   // tomorrow
                     new Date(Date.now() - 400 * 864e5).toISOString(),  // last year
                     "not a date", "", null]) {
    const e = cleanEntry({ rating: 4, at: bad });
    assert.ok(Math.abs(Date.parse(e.at) - Date.now()) < 5000, "falls back to arrival time");
    assert.equal(e.received, undefined, "and does not claim a delay it cannot show");
  }
});

test("long text is truncated rather than refused", () => {
  const e = cleanEntry({ rating: 3, comment: "x".repeat(5000), name: "y".repeat(500) });
  assert.equal(e.comment.length, 1200);
  assert.equal(e.name.length, 80);
});

/* ── the file store, which is what `npm run dev` gives a demo ──────────── */

test("the local store writes one JSON line per entry and reads them back newest first", async () => {
  assert.equal(feedbackStore(), "file");

  const first = await store(cleanEntry({ rating: 2, name: "First", phone: "9000000001" }));
  const second = await store(cleanEntry({ rating: 5, name: "Second", phone: "9000000002" }));

  const lines = readFileSync(process.env.FB_FEEDBACK_FILE, "utf8").trim().split("\n");
  assert.equal(lines.length, 2);
  assert.deepEqual(JSON.parse(lines[0]).id, first.id);

  const back = await list(10);
  assert.equal(back.length, 2);
  assert.equal(back[0].id, second.id, "newest first");
  assert.equal(back[1].name, "First");
});

test("reading an empty store is an empty list, not an error", async () => {
  process.env.FB_FEEDBACK_FILE = join(DIR, "empty.jsonl");
  const { list: freshList } = await import("../feedback.js?empty");
  assert.deepEqual(await freshList(10), []);
  assert.equal(existsSync(join(DIR, "empty.jsonl")), true, "touched, so the store reports as writable");
});
