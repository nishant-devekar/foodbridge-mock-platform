/* Load the FoodBridge browser seed into Node. It is an IIFE that assigns
   window.SEED, so a bare `window` is all it needs — no parsing, no duplicate
   copy of the catalogue that could drift from the one the app actually uses. */
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { resolve } from "node:path";

const SEED_PATH = resolve(
  "../v4/modules/foodbridge-customer-mockup/v3/screens/customers/seed.inline.js"
);

export function loadSeed() {
  const ctx = { window: {}, document: undefined, console };
  vm.createContext(ctx);
  vm.runInContext(readFileSync(SEED_PATH, "utf8"), ctx);
  return ctx.window.SEED;
}
