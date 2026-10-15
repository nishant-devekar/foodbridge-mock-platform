// Store activation inside the v10 Control Tower (15 Oct 2026).
//
// The module's own modal — store-activation v0.1.12 as released to QA, its components untouched (upload, reading,
// the review sheet, the map picker, submit) — on the module's own in-memory API (dev/mockApi: its reader answers from
// the test bed's read results, and "Try a sample file" works). What is v10's: the host ports. Saved products and
// customers live in localStorage (fb.v7.sa.store), where the Control Tower's journey reads them as facts.
//
//   ?step=items|customers     the step the modal opens on
//   ?mode=setup|smartImport   Activate your store (both steps) or Smart import (one step)
//
// The Control Tower keeps this page in one frame over itself for as long as it is open, so the module's in-memory API (an
// import half fixed) lives on between opens. It opens the modal again with {type:"fb:sa:open", step, mode}; closing the
// modal posts {type:"fb:sa:closed"} back.
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { CustomerImportRow, ProductImportRecord, RowResult, StoreActivationHostPorts } from "@store-activation/ssot/frontend-domain-model";
import type { ImportKind, ImportMode } from "@store-activation/ssot/domain-model";
import { StoreActivationProvider, useStoreActivation } from "../src/host";
import { ActivationModal } from "../src/components/modal/ActivationModal";
import { createMockApi } from "../dev/mockApi";
import "./index.css";

const KEY = "fb.v7.sa.store";
type Saved = { products: ProductImportRecord[]; customers: CustomerImportRow[]; open: { items: number; customers: number }; at?: number };

function read(): Saved {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "null");
    if (v && Array.isArray(v.products) && Array.isArray(v.customers)) return { open: { items: 0, customers: 0 }, ...v };
  } catch {
    /* a blocked store starts empty */
  }
  return { products: [], customers: [], open: { items: 0, customers: 0 } };
}
function write(s: Saved) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...s, at: Date.now() }));
  } catch {
    /* per device only */
  }
}

const qs = new URLSearchParams(location.search);
const STEP: ImportKind = qs.get("step") === "customers" ? "customers" : "items";
const MODE: ImportMode = qs.get("mode") === "smartImport" ? "smartImport" : "setup";
const api = createMockApi({ delayMs: 2500 });

const ports: StoreActivationHostPorts = {
  countProducts: async () => read().products.length,
  countCustomers: async () => read().customers.length,
  listProductNames: async () => read().products.map((p) => p.Product),
  listProductCategories: async () => [...new Set(["GROCERY", "BISCUITS", "BEVERAGES", ...read().products.map((p) => p.Category)])],
  listCustomerPhones: async () => read().customers.map((c) => ({ name: c.organizationName, phone: c.phone })),
  importProducts: async (records): Promise<RowResult[]> => {
    const s = read();
    s.products = s.products.concat(records);
    write(s);
    return records.map((_, index) => ({ index, ok: true }));
  },
  importCustomers: async (rows): Promise<RowResult[]> => {
    const s = read();
    s.customers = s.customers.concat(rows);
    write(s);
    return rows.map((_, index) => ({ index, ok: true }));
  },
};

/* The modal, placed the way the provider places it, with a close that tells the Control Tower. Rows still waiting in an
   open import are written down each time the status moves, so the journey knows what is left to fix. */
function Host() {
  const ctx = useStoreActivation();
  const [at, setAt] = useState<{ step: ImportKind; mode: ImportMode; n: number } | null>({ step: STEP, mode: MODE, n: 0 });
  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.origin !== location.origin || !e.data || e.data.type !== "fb:sa:open") return;
      setAt((cur) => ({ step: e.data.step === "customers" ? "customers" : "items", mode: e.data.mode === "smartImport" ? "smartImport" : "setup", n: (cur ? cur.n : 0) + 1 }));
      void ctx.refresh();
    };
    window.addEventListener("message", on);
    return () => window.removeEventListener("message", on);
  }, [ctx]);
  useEffect(() => {
    if (!ctx.status) return;
    const left = (k: ImportKind) => ctx.status!.active.filter((a) => a.step === k).reduce((n, a) => n + (a.openRows || 0), 0);
    const s = read();
    s.open = { items: left("items"), customers: left("customers") };
    write(s);
  }, [ctx.status]);
  if (!ctx.status || !at) return null;
  return (
    <ActivationModal
      key={at.n}
      initialStep={at.step}
      mode={at.mode}
      onClose={() => {
        setAt(null);
        void ctx.refresh().finally(() => window.parent.postMessage({ type: "fb:sa:closed" }, location.origin));
      }}
    />
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <StoreActivationProvider api={api} ports={ports} flags={{ enabled: true, smartImport: true }}>
      <Host />
    </StoreActivationProvider>
  </StrictMode>,
);
