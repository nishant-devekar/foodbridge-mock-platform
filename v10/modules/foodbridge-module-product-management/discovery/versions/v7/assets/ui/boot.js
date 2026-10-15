// Screen bootstrap (Addendum 006). Loads ../seed-data/seed.json and builds the same mock
// ApiClient the sandbox route would use, then mounts the screen inside a host-like content
// frame (storefront-frontend layout/Main.jsx's padding) — host chrome itself is not rendered.
//
// Screens are mounted the way the HOST mounts them (storefront-frontend/src/pages/*.jsx):
// showHeading={false}, onNotify wired to the host's toasts, onSaveFile to the host's file save.
// Discovery v7 (Addendum 015, module 126–132): every host input arrives as a prop —
// configureCurrency / configureHostConfig — and no module code reads the host's storage. The
// Discovery panel below plays the host; its own settings live under "discovery.host".
// Currency defaults to no symbol, as the module's own DEFAULT_CURRENCY does.

const Host = {
  get() {
    try {
      return { onNotify: true, onSaveFile: true, productVideoEnabled: true, ...JSON.parse(localStorage.getItem("discovery.host") || "{}") };
    } catch {
      return { onNotify: true, onSaveFile: true, productVideoEnabled: true };
    }
  },
  // The host's own globalSetting — the one storage key the module still reads, by the module
  // owner's recorded decision (amds-debt B6, productVideoFeature.ts, module Addendum 135).
  writeVideoFlag(on) {
    let gs = {};
    try {
      gs = JSON.parse(localStorage.getItem("globalSetting") || "{}") || {};
    } catch {}
    gs.appProp = { ...(gs.appProp || {}), productManagementFeatures: { ...(gs.appProp?.productManagementFeatures || {}), productVideoEnabled: on } };
    try {
      localStorage.setItem("globalSetting", JSON.stringify(gs));
    } catch {}
  },
};

const Boot = {
  seed: null,
  locationId: null,
  // resolveNotify: the host's toast when it passes one, the module's built-in notice when not (130).
  onNotify: PM.notify.resolveNotify(Host.get().onNotify ? (message, type) => K.notify(message, type) : undefined),
  // utils/saveFile.ts (115): the host's onSaveFile when it passes one (Android writes and opens the file), the
  // browser download otherwise. The stand-in host saves in the browser and says so, like a native host would.
  onSaveFile: Host.get().onSaveFile ? (blob, fileName) => (PM.saveFile.browserDownload(blob, fileName), K.notify(`Saved ${fileName}`, "success")) : undefined,
  saveFile(blob, fileName) {
    return PM.saveFile.saveFile(blob, fileName, this.onSaveFile);
  },

  // Host stand-in for ProductListShell's importMenuExtra + refreshKey (module Addendum 133): the
  // store-activation "Smart import" a host puts at the top of the Import popup. It calls the module's
  // own importProductRecords; one record has no article number, so the backend makes an AUTO- code.
  listProps: {
    refreshKey: 0,
    importMenuExtra: ({ catalogueType }) =>
      `<button type="button" data-on-click="host.smartImport|${catalogueType}" data-testid="host-smart-import" class="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm font-medium text-emerald-700 hover:bg-emerald-50">${K.icon("FiUploadCloud", "h-4 w-4")}Smart import <span class="text-[11px] font-normal text-gray-400">(host)</span></button>`,
  },
  async start(seedKey, mount) {
    const host = Host.get();
    K.onSaveFile = this.onSaveFile;
    PM.format.configureCurrency(host.currency || undefined);
    PM.hostConfig.configureHostConfig({
      zohoSyncEnabled: host.zohoSyncEnabled === true,
      supportedUnitIndexLevel: host.supportedUnitIndexLevel ?? null,
      priceCalculationUnitIndex: host.priceCalculationUnitIndex,
    });
    Host.writeVideoFlag(host.productVideoEnabled === true);
    const res = await fetch("../seed-data/seed.json");
    this.seed = await res.json();
    this.locationId = this.seed.locationId;
    // v6 (Addendum 007): Finished Goods also reads catalogues (selection by catalogue, impact).
    const seed = seedKey === "finishedGoods" ? { ...this.seed.products, catalogues: this.seed.catalogues.catalogues } : this.seed[seedKey];
    // Addendum 015: the mock behind a discovery "server" that applies Development's backend rules.
    const data = Scenario.apply(seedKey, structuredClone(seed));
    const client = DiscoveryServer.wrap(PM.createMockApiClient(data), { ...data, locationId: this.locationId });
    if ((data.catalogues ?? []).some((c) => c.discountRules)) await client.syncDiscountCatalogues(this.locationId);
    // Addendum 016 (proposed rule R7): the one-time sweep — broken products go on hold, out of every flow.
    if (seedKey === "finishedGoods" || seedKey === "catalogues") await client.sweepSaleReadiness(this.locationId);
    this.client = client;
    document.body.className = "bg-gray-50";
    document.body.innerHTML = `<main class="flex-1 overflow-y-auto overflow-x-hidden min-h-0"><div id="screen" class="w-full mx-auto px-3 sm:px-4 lg:px-6 pt-3 sm:pt-4"></div></main>`;
    DiscoveryPanel.mount();
    mount(client, document.getElementById("screen"));
  },
};

// Discovery-only knobs (NOT module UI): the host inputs the module reads, and seed scenarios
// for outcomes the plain sandbox seed never produces (e.g. a catalogue with customers
// assigned). Persisted in localStorage under the same keys the module itself reads.
const Scenario = {
  get() {
    try {
      return JSON.parse(localStorage.getItem("discovery.scenario") || "{}");
    } catch {
      return {};
    }
  },
  apply(seedKey, seed) {
    const sc = this.get();
    if ((seedKey === "catalogues" || seedKey === "finishedGoods") && sc.campaignRecipients) {
      seed.campaignRecipients = Object.fromEntries(
        seed.catalogues.map((c) => [c.id, Array.from({ length: 6 }, (_, i) => ({ id: `${c.id}-cust-${i + 1}`, name: `Customer ${i + 1}`, phone: `98765 4321${i}` }))]),
      );
    }
    if (sc.zohoSync) seed.zohoSync = ZohoScenarios[sc.zohoSync];
    // The backend's end state for raw materials (catalogueMembership, Addendum 123): MASTER holds
    // every product, RAW-MATERIAL the ACTIVE ones — the sandbox seed carries no catalogues for them.
    if (seedKey === "rawMaterials" && !seed.catalogues) {
      const entry = (p) => ({ id: p.id, price: p.price, offerPrice: p.price, priceMap: p.priceMap, offerPriceMap: p.priceMap });
      const doc = (id, type, name, list) => ({ id, locationId: seed.products[0]?.locationId, catalogueType: type, name, status: "ACTIVE", parentCatalogueReference: "", products: list.map(entry) });
      seed.catalogues = [doc("rm-master", "MASTER", "MASTER", seed.products), doc("rm-raw-material", "RAW-MATERIAL", "RAW-MATERIAL", seed.products.filter((p) => p.status === "ACTIVE"))];
    }
    // A discount catalogue (module Addenda 116/117), on by default: its products mirror DEFAULT at
    // 10 % off, and a product edit re-prices it — the discovery server runs the backend's rules.
    if ((seedKey === "finishedGoods" || seedKey === "catalogues") && sc.discountCatalogue !== false) {
      const loc = seed.catalogues[0]?.locationId;
      seed.catalogues.push({ id: "cat-discount-staff", locationId: loc, catalogueType: "CUSTOMER", name: "Staff 10% off", desc: "Discount catalogue (from the user module): DEFAULT's products at 10 % off.", status: "ACTIVE", parentCatalogueReference: "", products: [], discountRules: { pct: 10 }, modifiedAt: new Date().toISOString() });
    }
    // Addendum 017: the seed has no pricing mistakes, so the two chips that catch them never show.
    // On by default: Fruit Cake costs more than it sells for; Lemon Soda sells above its MRP.
    if ((seedKey === "finishedGoods" || seedKey === "catalogues") && sc.pricingMistakes !== false) {
      for (const p of seed.products) {
        if (p.articleNumber === "SB-14") p.costPrice = 24;
        if (p.articleNumber === "SB-22") p.maxRetailPrice = 79;
      }
    }
    return seed;
  },
};

// Outcomes the sandbox seed never produces, fed through the mock's own MockZohoSyncSeed
// contract (api-client/mock.ts) — discovery-only, not parity-checked against the sandbox.
const zohoItem = (outcome, i, extra = {}) => ({ outcome, zohoItemId: `z-${outcome}-${i}`, name: `Zoho item ${i}`, sku: `ZS-${i}`, articleNumber: outcome === "failed" ? null : `ZS-${i}`, productId: outcome === "created" || outcome === "updated" ? `sb-${i}` : null, reason: null, ...extra });
const ZohoScenarios = {
  "partial: 3 created, 2 updated, 2 failed": {
    progress: [{}, { status: "PARTIAL", itemsCreated: 3, itemsUpdated: 2, itemsFailed: 2 }],
    items: [1, 2, 3].map((i) => zohoItem("created", i)).concat([4, 5].map((i) => zohoItem("updated", i, { changedFields: ["price", "tax"] })), [6, 7].map((i) => zohoItem("failed", i, { reason: "INVALID_ZOHO_ITEM: rate" })), [8].map((i) => zohoItem("skipped", i, { reason: "ALREADY_SYNCED" }))),
  },
  "refused: Zoho not master": { start: { started: false, code: "ZOHO_NOT_MASTER", message: "not master" } },
  "refused: not configured": { start: { started: false, code: "ZOHO_NOT_CONFIGURED", message: "not configured" } },
  "inactive in Zoho: SB-39 deleted (Addendum 119)": {
    progress: [{}, { status: "SYNCED", itemsCreated: 0, itemsUpdated: 0, itemsFailed: 0, itemsDeleted: 1 }],
    items: [zohoItem("deleted", 1, { name: "Banana Chips", articleNumber: "SB-39" })],
    deactivatedArticleNumbers: ["SB-39"],
  },
  "running on page load": { latest: { jobId: "job-running", status: "RUNNING", cursor: "", itemsCreated: 0, itemsUpdated: 0, itemsFailed: 0, updatedAt: new Date().toISOString() }, progress: [{}, { status: "SYNCED", itemsCreated: 1 }], items: [zohoItem("created", 1)] },
  "last sync failed (rate limited)": { latest: { jobId: "job-failed", status: "FAILED", cursor: "", itemsCreated: 0, itemsUpdated: 0, itemsFailed: 0, errorCode: "ZOHO_RATE_LIMITED", errorMessage: "Rate limited", updatedAt: new Date().toISOString() } },
};

const DiscoveryPanel = {
  mount() {
    const host = Host.get();
    const sc = Scenario.get();
    const box = document.createElement("details");
    box.id = "discovery-panel";
    box.style.cssText = "position:fixed;left:0;bottom:96px;z-index:30000;font:12px system-ui;background:#111827;color:#f9fafb;border-radius:8px;padding:6px 10px;max-width:320px;opacity:.9";
    const opt = (v, cur) => `<option value="${v}"${String(cur ?? "") === v ? " selected" : ""}>${v === "" ? "unset" : v}</option>`;
    const chk = (id, on, label) => `<label><input type="checkbox" id="${id}"${on ? " checked" : ""}> ${label}</label>`;
    box.innerHTML = `<summary style="cursor:pointer">Discovery controls (not module UI)</summary>
      <div style="display:grid;gap:6px;margin-top:8px">
        <b>Host props</b>
        <label>currency <input id="dc-currency" style="color:#111;width:60px" value="${host.currency || ""}" placeholder="none"></label>
        <label>supportedUnitIndexLevel <select id="dc-level" style="color:#111">${["", "0", "1", "2"].map((v) => opt(v, host.supportedUnitIndexLevel)).join("")}</select></label>
        <label>priceCalculationUnitIndex <select id="dc-pci" style="color:#111">${["", "0", "1", "2"].map((v) => opt(v, host.priceCalculationUnitIndex)).join("")}</select></label>
        ${chk("dc-zoho", host.zohoSyncEnabled === true, "zohoSyncEnabled")}
        <label>campaignLinkBaseUrl <input id="dc-campaign" style="color:#111;width:150px" value="${host.campaignLinkBaseUrl || ""}" placeholder="page origin"></label>
        ${chk("dc-notify", host.onNotify, "onNotify (host toasts; off = built-in notice)")}
        ${chk("dc-save", host.onSaveFile, "onSaveFile (host file save; off = browser download)")}
        ${chk("dc-video", host.productVideoEnabled, "globalSetting…productVideoEnabled (module reads storage, amds-debt B6)")}
        <b>Seed scenarios</b>
        ${chk("dc-recipients", sc.campaignRecipients, "catalogues have customers")}
        ${chk("dc-discount", sc.discountCatalogue !== false, "a discount catalogue (Staff 10% off, 116/117)")}
        ${chk("dc-pricing", sc.pricingMistakes !== false, "pricing mistakes (one below cost, one above MRP — 017)")}
        <label>Zoho sync outcome <select id="dc-zohosync" style="color:#111">${["", ...Object.keys(ZohoScenarios)].map((v) => opt(v, sc.zohoSync)).join("")}</select></label>
        <button id="dc-apply" style="background:#16a34a;border-radius:4px;padding:2px 8px">Apply &amp; reload</button>
      </div>`;
    document.body.appendChild(box);
    box.querySelector("#dc-apply").onclick = () => {
      const level = box.querySelector("#dc-level").value;
      const pci = box.querySelector("#dc-pci").value;
      const next = {
        currency: box.querySelector("#dc-currency").value.trim() || undefined,
        supportedUnitIndexLevel: level === "" ? undefined : Number(level),
        priceCalculationUnitIndex: pci === "" ? undefined : Number(pci),
        zohoSyncEnabled: box.querySelector("#dc-zoho").checked,
        campaignLinkBaseUrl: box.querySelector("#dc-campaign").value.trim() || undefined,
        onNotify: box.querySelector("#dc-notify").checked,
        onSaveFile: box.querySelector("#dc-save").checked,
        productVideoEnabled: box.querySelector("#dc-video").checked,
      };
      try {
        localStorage.setItem("discovery.host", JSON.stringify(next));
        localStorage.setItem("discovery.scenario", JSON.stringify({ campaignRecipients: box.querySelector("#dc-recipients").checked, discountCatalogue: box.querySelector("#dc-discount").checked, pricingMistakes: box.querySelector("#dc-pricing").checked, zohoSync: box.querySelector("#dc-zohosync").value || undefined }));
      } catch {}
      location.reload();
    };
  },
};

K.on["host.smartImport"] = async (catalogueType) => {
  const records = catalogueType === "RAW-MATERIAL"
    ? [{ Category: "Raw Materials", "Sub Category": "Flour & Grains", Product: "Smart Import Semolina", Unit: "kg", Price: 48, Tax: 5 }]
    : [
        { Category: "Snacks", "Sub Category": "Chips", Product: "Smart Import Nachos", Unit: "Packet", Price: 40, Tax: 12 },
        { Category: "Beverages", "Sub Category": "Soda", Product: "Smart Import Lime Soda", Unit: "Bottle", Price: 22, Tax: 12, "Article Number": "SI-LIME" },
      ];
  const results = await PM.importProductRecordsModule.importProductRecords({ apiClient: Boot.client, locationId: Boot.locationId, records, catalogueType });
  const ok = results.filter((r) => r.ok).length;
  K.notify(`Smart import: ${ok} of ${results.length} saved${ok < results.length ? ` — ${results.find((r) => !r.ok)?.reason}` : ""}`, ok ? "success" : "error");
  Boot.listProps.refreshKey += 1;
  K.update();
};
