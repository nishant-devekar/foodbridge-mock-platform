/* Store Builder · the desktop page (1 Oct 2026).

   Not the phone page made wider. On a computer the store is built at one
   desk, not in six trips:
   - a start screen that is the Shop step, beside "start from what you already
     have": drop a contacts file, an Excel customer list or photos of paper;
   - one desk: the sections down the left (no steps list, no Save and back),
     the work in the middle, and the store as it grows on the right, with
     Build my store always one click away;
   - what is a list of taps on the phone is a sheet here: tick products in a
     grid while they collect beside it, sort contacts with 1 2 3 0, paint
     delivery days across a week, type stock counts down a column.

   The same answers as the phone page (model.js, the same localStorage key,
   photos and builds through outbox.js), the same export, both languages. */

(function () {
  "use strict";

  const CAT = window.SB_CATALOGUE, M = window.SB_MODEL, X = window.SB_EXPORT, I18N = window.SB_I18N, IMP = window.SB_IMPORT;
  const OB = window.SB_OUTBOX, DB = OB.DB, OUTBOX = OB.OUTBOX;
  const ic = window.SB_ICON;
  const KEY = "fb.storebuilder.v1";   // the phone page's key: one store, either page
  const SECS = ["store", "items", "people", "stock", "rules"];
  const ICON = { store: "store", items: "box", people: "contacts", stock: "warehouse", rules: "rules", finish: "send" };
  const canRecord = "MediaRecorder" in window && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  const $app = document.getElementById("app");
  const $dlg = document.getElementById("dlg");
  const $toast = document.getElementById("toast");
  const $drop = document.getElementById("drop");

  /* Words only this page says; everything else comes from i18n.js. */
  const DT = {
    en: {
      dkSaved: "Saved", dkSavedAt: "Saved {t}", dkPhone: "Phone version",
      stTitle: "Let's make your store", stSub: "About 10 minutes. Everything saves as you go.",
      stSample: "Try it with sample data", nextTo: "Next: {s}", nextBuild: "Check and build",
      stepsTitle: "Steps", sendStep: "Send to FoodBridge",
      rqSub: "Fills in as you go. Send it when you're ready; anything missing is followed up later.",
      pvLabel: "Preview", pvTitle: "Your FoodBridge store", pvEmpty: "Your store takes shape here as you go.", pvNoName: "Your store",
      pvReady: "{p}% ready to send", pvRoutes: "Fixed route days", pvSelf: "Orders on phone", pvPart: "Bills paid in parts", pvStock: "Warehouse stock",
      pvDaily: "Daily work", pvFiles: "Files", pvPrices: "Change prices here", colMrp: "MRP", colCust: "Your price to customer", prPh: "Price", atDrop: "You can also drop files anywhere on this page.",
      fdSub: "Photos, screenshots, Excel sheets, PDFs, contact lists: the FoodBridge team gets every file as it came.",
      fdDrop: "Drop it here", fdOr: "or", fdBrowse: "choose from this computer", fdKinds: "Photos · Screenshots · Excel · PDF · Contacts · Anything",
      fdContacts: "{n} contacts found", fdContacts_1: "1 contact found", fdDup: "{n} already there", fdAttached: "Goes to FoodBridge as it is",
      fdRemove: "Remove", fdVoice: "Voice note", fdPhoto: "Photo",
      tPapers: "Your files", dropHere: "Drop files here", dropSub: "Photos, screenshots, Excel, PDFs, contacts: anything",
      secStore: "Shop", secItems: "Products", secPeople: "Contacts", secStock: "Stock", secRules: "Daily work",
      readyN: "{n} of {total} sections done", buildLater: "Anything missing is followed up later.",
      ypHint: "Prices start at the usual margin. Change any that differ.", ypEmpty: "Tick products in the grid. They collect here.",
      ypPiece: "/ pc", allProducts: "All products", searchKey: "/",
      pickHint: "Shift-click ticks a run · arrow keys move · Space ticks", foundN: "{n} products", foundN_1: "1 product",
      importFile: "Import file", addPerson: "Add person", addPersonGo: "Add", tNot: "Not needed",
      keysSort: "1 customer · 2 staff · 3 supplier · 0 not needed · ↑ ↓ move · U undo",
      colName: "Name", colNumber: "Mobile", colLooks: "Looks like", colArea: "Area", colPays: "Pays",
      colJob: "Job", colDays: "Days out", colVehicle: "Vehicle", colCash: "Collects cash", colCompanies: "Companies", colCode: "Your code",
      colLead: "Goods come in", colOwe: "You owe ₹", colProduct: "Product", colCount: "Count", colIn: "In", colPrice: "Your price",
      paintHint: "Drag across a row, or down a column, to set days.", starHint: "Click ★ for big customers.", sameArea: "Give {area}'s {days} to {n} more in {area}",
      sortEmptyT: "Bring your contacts in", sortEmptyS: "Import a contacts file or an Excel list, or type names. On a phone, the phone page picks from phone contacts.",
      stockAdd: "Add a product to the count", stockLegend: "Blank is not counted. 0 is looked, none there.",
      stockNoItems: "Choose your products first, then count them here.", goProducts: "Choose products", stockMore: "Add my other {n} products",
      menuSample: "Fill every section with sample data", menuPhone: "Open the phone version",
      narrow: "Made for a computer screen.", narrowLink: "Open the phone version", close: "Close",
      sampleAllBody: "Fills what is still empty in every section with sample answers. What you entered stays.",
      fiWaitingWhy: "No internet right now. It goes by itself when this computer is online.",
      noArea: "area?", notePh: "Anything about your day we should know", edit: "Edit", pickOne: "—", fiReview: "Check it once, then build your store.",
    },
    hi: {
      dkSaved: "सेव हो गया", dkSavedAt: "{t} पर सेव हुआ", dkPhone: "फ़ोन वाला",
      stTitle: "चलिए आपकी दुकान बनाते हैं", stSub: "लगभग 10 मिनट। सब अपने आप सेव होता है।",
      stSample: "नमूना डेटा से देखें", nextTo: "आगे: {s}", nextBuild: "देखें और बनाएँ",
      stepsTitle: "चरण", sendStep: "FoodBridge को भेजें",
      rqSub: "जैसे-जैसे आप भरते हैं, यह भरता जाता है। तैयार हों तब भेजें; जो छूटा, वह बाद में पूछा जाएगा।",
      pvLabel: "झलक", pvTitle: "आपकी FoodBridge दुकान", pvEmpty: "जैसे-जैसे आप भरते हैं, आपकी दुकान यहाँ बनती जाती है।", pvNoName: "आपकी दुकान",
      pvReady: "भेजने के लिए {p}% तैयार", pvRoutes: "तय रूट के दिन", pvSelf: "फ़ोन पर ऑर्डर", pvPart: "बिल किस्तों में", pvStock: "गोदाम का स्टॉक",
      pvDaily: "रोज़ का काम", pvFiles: "फ़ाइलें", pvPrices: "दाम यहाँ बदलें", colMrp: "MRP", colCust: "ग्राहक के लिए आपका दाम", prPh: "दाम", atDrop: "फ़ाइलें इस पेज पर कहीं भी छोड़ भी सकते हैं।",
      fdSub: "फ़ोटो, स्क्रीनशॉट, Excel, PDF, कॉन्टैक्ट लिस्ट: हर फ़ाइल FoodBridge टीम तक वैसी ही पहुँचेगी।",
      fdDrop: "यहाँ छोड़ें", fdOr: "या", fdBrowse: "कंप्यूटर से चुनें", fdKinds: "फ़ोटो · स्क्रीनशॉट · Excel · PDF · कॉन्टैक्ट · कुछ भी",
      fdContacts: "{n} कॉन्टैक्ट मिले", fdDup: "{n} पहले से थे", fdAttached: "FoodBridge को वैसी ही जाएगी",
      fdRemove: "हटाएँ", fdVoice: "आवाज़ नोट", fdPhoto: "फ़ोटो",
      tPapers: "आपकी फ़ाइलें", dropHere: "फ़ाइलें यहाँ छोड़ें", dropSub: "फ़ोटो, स्क्रीनशॉट, Excel, PDF, कॉन्टैक्ट: कुछ भी",
      secStore: "दुकान", secItems: "सामान", secPeople: "कॉन्टैक्ट", secStock: "स्टॉक", secRules: "रोज़ का काम",
      readyN: "{total} में से {n} हिस्से पूरे", buildLater: "जो छूटा है, उसके लिए बाद में पूछा जाएगा।",
      ypHint: "दाम आम मार्जिन से शुरू होते हैं। जो अलग हो, बदल दें।", ypEmpty: "ग्रिड में सामान पर टिक करें। वह यहाँ जुड़ता जाएगा।",
      ypPiece: "/ पीस", allProducts: "सारा सामान", searchKey: "/",
      pickHint: "Shift-क्लिक से एक साथ कई · तीर से आगे-पीछे · Space से टिक", foundN: "{n} सामान",
      importFile: "फ़ाइल से लाएँ", addPerson: "नाम जोड़ें", addPersonGo: "जोड़ें", tNot: "ज़रूरत नहीं",
      keysSort: "1 ग्राहक · 2 स्टाफ़ · 3 सप्लायर · 0 ज़रूरत नहीं · ↑ ↓ ऊपर-नीचे · U वापस",
      colName: "नाम", colNumber: "मोबाइल", colLooks: "लगता है", colArea: "इलाका", colPays: "पेमेंट",
      colJob: "काम", colDays: "किन दिनों", colVehicle: "गाड़ी", colCash: "पैसे लाता है", colCompanies: "कंपनियाँ", colCode: "आपका कोड",
      colLead: "माल कितने दिन में", colOwe: "आपको देना ₹", colProduct: "सामान", colCount: "गिनती", colIn: "में", colPrice: "आपका दाम",
      paintHint: "दिन चुनने के लिए लाइन पर या कॉलम में नीचे खींचें।", starHint: "बड़े ग्राहकों के लिए ★ दबाएँ।", sameArea: "{area} के {days} वही {n} और ग्राहकों को दें",
      sortEmptyT: "अपने कॉन्टैक्ट लाइए", sortEmptyS: "कॉन्टैक्ट फ़ाइल या Excel लिस्ट लाएँ, या नाम टाइप करें। फ़ोन पर, फ़ोन वाला पेज फ़ोन के कॉन्टैक्ट खोलता है।",
      stockAdd: "गिनती में सामान जोड़ें", stockLegend: "खाली मतलब गिना नहीं। 0 मतलब देखा, नहीं है।",
      stockNoItems: "पहले अपना सामान चुनें, फिर यहाँ गिनें।", goProducts: "सामान चुनें", stockMore: "मेरा बाकी {n} सामान जोड़ें",
      menuSample: "हर हिस्से में नमूना डेटा भरें", menuPhone: "फ़ोन वाला खोलें",
      narrow: "यह कंप्यूटर की स्क्रीन के लिए है।", narrowLink: "फ़ोन वाला खोलें", close: "बंद करें",
      sampleAllBody: "हर हिस्से में जो खाली है, वहाँ नमूना जवाब भरता है। आपका भरा हुआ वैसा ही रहता है।",
      fiWaitingWhy: "अभी इंटरनेट नहीं है। कंप्यूटर ऑनलाइन होते ही अपने आप चली जाएगी।",
      noArea: "इलाका?", notePh: "आपके दिन के बारे में कुछ और", edit: "बदलें", pickOne: "—", fiReview: "एक बार देख लें, फिर अपनी दुकान बनाएँ।",
    },
  };

  let S = load();
  let view = "desk";
  let dlg = null;
  const ui = {
    sec: "store", by: "co", group: null, itemsQ: "", lastPick: null, shown: [],
    tab: null, peopleQ: "", sortFocus: null, sortedHere: [], lastSorted: [], adding: false, paint: null,
    stQ: "", stOpen: false, needMobile: false, outbox: [], building: false, sending: false, rec: null, dragN: 0,
  };
  const urls = {};

  /* ─────────────────────────────────────────────────────── storage ── */

  function load() {
    try { return M.migrate(JSON.parse(localStorage.getItem(KEY))); } catch (e) { return M.blank(); }
  }
  function save() {
    S.updatedAt = Date.now();
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast("⚠ " + e.message); }
    const el = document.getElementById("saved");
    if (el) el.innerHTML = savedHTML();
  }
  function syncSave() { M.syncCompanies(CAT, S); save(); }

  /* The phone page open in another tab of this browser: its answers show here too. */
  window.addEventListener("storage", function (e) {
    if (e.key !== KEY) return;
    S = load();
    render();
  });

  function deliver(b) { return OB.deliver(X, b, function () { if (view === "thanks") render(); }); }
  async function sendAll() {
    if (ui.sending) return;
    ui.sending = true;
    let list = [];
    try { list = await OUTBOX.all(); } catch (e) { list = []; }
    for (const b of list.sort(function (x, y) { return x.at - y.at; })) {
      if (!(await deliver(b))) break;   // the bridge is not there: try the rest later
    }
    try { ui.outbox = await OUTBOX.all(); } catch (e) { ui.outbox = []; }
    ui.sending = false;
    render();
  }
  window.addEventListener("online", function () { sendAll(); });

  /* ─────────────────────────────────────────────────────── helpers ── */

  function t(k, v) {
    const lang = S.lang === "hi" ? "hi" : "en";
    const D = DT[lang], L = I18N[lang] || I18N.en;
    if (v && v.n === 1 && (D[k + "_1"] != null || L[k + "_1"] != null)) k = k + "_1";
    let s = D[k] != null ? D[k] : L[k] != null ? L[k] : DT.en[k] != null ? DT.en[k] : I18N.en[k] != null ? I18N.en[k] : k;
    if (v) Object.keys(v).forEach(function (x) { s = s.split("{" + x + "}").join(v[x]); });
    return s;
  }
  function h(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
  }
  function rupee(n) { return n == null || n === "" || isNaN(n) ? "" : "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 }); }
  function catName(c) { const x = CAT.categories[c] || CAT.categories.other; return S.lang === "en" ? x.en : x.hi; }
  function dayName(d) { return t("d_" + d); }
  function secName(s) { return t("sec" + s[0].toUpperCase() + s.slice(1)); }
  function nm(it) { return S.lang !== "en" && it.hi ? it.hi : it.name; }
  function packLabel(it) { return it.loose ? t("per_" + it.per) : it.pack; }
  function payLabel(v) { return v === "cash" ? t("payCash") : v ? t("payDays", { n: v }) : ""; }
  function typing(el) { return el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable); }

  function getPath(path) {
    const r = path[0] === "@" ? [dlg, path.slice(1)] : [S, path];
    return r[1].split(".").reduce(function (o, k) { return o == null ? undefined : o[k]; }, r[0]);
  }
  function setPath(path, v) {
    const r = path[0] === "@" ? [dlg, path.slice(1)] : [S, path];
    const ks = r[1].split(".");
    let o = r[0];
    for (let i = 0; i < ks.length - 1; i++) {
      if (o[ks[i]] == null || typeof o[ks[i]] !== "object") o[ks[i]] = {};
      o = o[ks[i]];
    }
    const last = ks[ks.length - 1];
    if (v === null || v === undefined) delete o[last]; else o[last] = v;
  }

  function toast(msg, act) {
    $toast.innerHTML = "<span>" + h(msg) + "</span>" + (act ? act : "");
    $toast.classList.add("show");
    clearTimeout(toast.t);
    toast.t = setTimeout(function () { $toast.classList.remove("show"); }, act ? 6000 : 2800);
  }

  function when(ms) {
    const d = new Date(ms), loc = S.lang === "en" ? "en-IN" : "hi-IN";
    return d.toLocaleTimeString(loc, { hour: "numeric", minute: "2-digit" });
  }
  function whenLong(ms) {
    const d = new Date(ms), loc = S.lang === "en" ? "en-IN" : "hi-IN";
    return d.toLocaleDateString(loc, { day: "numeric", month: "short" }) + ", " + d.toLocaleTimeString(loc, { hour: "numeric", minute: "2-digit" });
  }
  function savedHTML() { return S.updatedAt ? ic("check", 14) + h(t("dkSavedAt", { t: when(S.updatedAt) })) : ""; }

  /* ─────────────────────────────────────────────── bits of screen ── */

  const LOGO = '<img class="dk-logo" src="../foodbridge-mark-green.png?v=1" alt="FoodBridge" width="28" height="28">';

  function chips(opts, isOn, attrs, cls) {
    return '<div class="chips' + (cls ? " " + cls : "") + '">' + opts.map(function (o) {
      return '<button type="button" class="chip' + (isOn(o.v) ? " on" : "") + '" ' + attrs + ' data-v="' + h(o.v) + '">' + h(o.label) + "</button>";
    }).join("") + "</div>";
  }
  function setChips(path, kind, opts, cls) {
    const cur = getPath(path);
    return chips(opts, function (v) {
      if (kind === "arr") return (cur || []).map(String).indexOf(String(v)) >= 0;
      if (kind === "bool") return cur === (v === "1");
      return cur != null && String(cur) === String(v);
    }, 'data-act="set" data-path="' + h(path) + '" data-kind="' + kind + '"', cls);
  }
  function seg(path) {
    const v = getPath(path);
    const b = function (on, key, val) {
      return '<button type="button" class="' + (on ? "on" : "") + '" data-act="set" data-path="' + path + '" data-kind="bool" data-v="' + val + '" aria-pressed="' + on + '">' + h(t(key)) + "</button>";
    };
    return '<span class="seg">' + b(v === true, "yes", "1") + b(v === false, "no", "0") + "</span>";
  }

  /* A bound box. kind: num | upper; touch: the path that marks it as his own; rerender: redraw on change. */
  function inp(path, o) {
    o = o || {};
    const v = getPath(path);
    const tag = o.area ? "textarea" : "input";
    const attrs = ' data-bind="' + h(path) + '"' + (o.kind ? ' data-kind="' + o.kind + '"' : "") + (o.touch ? ' data-touch="' + h(o.touch) + '"' : "") +
      (o.rerender ? " data-rerender" : "") + (o.ph ? ' placeholder="' + h(o.ph) + '"' : "") + (o.mode ? ' inputmode="' + o.mode + '"' : "") +
      (o.max ? ' maxlength="' + o.max + '"' : "") + (o.list ? ' list="' + o.list + '"' : "") + (o.label ? ' aria-label="' + h(o.label) + '"' : "") +
      ' class="' + ["in", o.cls || "", o.upper ? "upper" : ""].join(" ").trim() + '" autocomplete="' + (o.ac || "off") + '"';
    return tag === "textarea" ? "<textarea rows=\"3\"" + attrs + ">" + h(v) + "</textarea>" : "<input type=\"" + (o.type || "text") + '"' + attrs + ' value="' + h(v == null ? "" : v) + '">';
  }

  function field(label, inner, hint) {
    return '<div class="fld"><label class="fld-l">' + h(label) + "</label>" + inner + (hint ? '<p class="hint">' + hint + "</p>" : "") + "</div>";
  }

  function stepper(path, o) {
    o = o || {};
    const own = getPath(path);
    const v = own == null && o.base != null ? o.base : own;
    const a = ' data-path="' + h(path) + '"' + (o.base != null ? ' data-base="' + o.base + '"' : "") + (o.min != null ? ' data-min="' + o.min + '"' : "") + (o.touch ? ' data-touch="' + h(o.touch) + '"' : "");
    return '<span class="stepper"><button type="button" data-act="step" data-d="-1"' + a + ' aria-label="−">' + ic("minus", 16) + "</button>" +
      '<input data-bind="' + h(path) + '" data-kind="num" data-rerender inputmode="decimal" value="' + h(v == null ? "" : v) + '" placeholder="–"' + (o.touch ? ' data-touch="' + h(o.touch) + '"' : "") + ">" +
      '<button type="button" data-act="step" data-d="1"' + a + ' aria-label="+">' + ic("plus", 16) + "</button></span>";
  }

  function avatar(name) {
    const w = String(name || "").trim().split(/\s+/).filter(Boolean);
    const s = w.length > 1 ? w[0][0] + w[w.length - 1][0] : (w[0] || "?").slice(0, 2);
    return '<span class="avatar">' + h(s.toUpperCase()) + "</span>";
  }

  /* His photo, else the pack photo, else the picture; the picture shows if a photo fails. */
  function pickImg(it) {
    const img = it.photo ? '<img data-paper="' + h(it.photo) + '" alt="">'
      : it.img ? '<img src="' + h(it.img) + '" alt=""' + (it.loose ? ' class="is-fresh"' : "") + ' loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">' : "";
    return img + '<span class="emoji">' + it.icon + "</span>";
  }

  /* ─────────────────────────────────────────────── the start screen ── */

  function shopFields() {
    const st = S.store, ok = M.storeReady(S), bad = ui.needMobile && !ok;
    return '<div class="fc' + (bad ? " is-bad" : "") + '">' +
        '<div class="fc-row is-mob">' + ic("mobile", 18) + inp("store.mobile", { ph: t("fMobile"), type: "tel", mode: "tel", max: 14, ac: "tel-national", label: t("fMobile") }) +
          '<span class="req' + (ok ? " is-ok" : "") + '">' + (ok ? ic("check", 14) : h(t("required"))) + "</span></div>" +
        '<div class="fc-row">' + ic("receipt", 18) + inp("store.gst", { ph: t("fGst"), kind: "upper", upper: true, max: 15, label: t("fGst") }) + "</div>" +
      "</div>" +
      '<p class="err"' + (bad ? "" : " hidden") + ">" + ic("alert", 15) + "<span>" + h(t("mobNeed")) + "</span></p>" +
      field(t("fType"), setChips("store.type", "str", [
        { v: "distributor", label: t("tDistributor") }, { v: "superstockist", label: t("tSuperstockist") },
        { v: "wholesaler", label: t("tWholesaler") }, { v: "retailer", label: t("tRetailer") },
        { v: "manufacturer", label: t("tManufacturer") }, { v: "other", label: t("tOther") }]) +
        (st.type === "other" ? inp("store.typeOther", { ph: t("fTypeOther"), cls: "wide" }) : "")) +
      field(t("fWarehouses"), stepper("store.warehouses", { min: 0 }));
  }

  /* ── Your files: whatever he drops in goes to FoodBridge as it came (1 Oct 2026, owner) ── */

  function kindOf(p) {
    const n = String(p.name || p.file || "").toLowerCase(), m = String(p.mime || "");
    if (p.kind === "photo" || /^image\//.test(m) || /\.(jpe?g|png|webp|gif|heic|heif|bmp|tiff?)$/.test(n)) return "image";
    if (p.kind === "voice" || /^audio\//.test(m)) return "voice";
    if (/\.(vcf|vcard)$/.test(n)) return "contacts";
    if (/\.(xlsx?|xlsm|csv|tsv|ods)$/.test(n)) return "sheet";
    if (/\.pdf$/.test(n) || m === "application/pdf") return "pdf";
    return "file";
  }
  const KIND_IC = { image: "image", voice: "mic", contacts: "contacts", sheet: "list", pdf: "file", file: "file" };
  function kb(n) { return n > 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round((n || 0) / 1024)) + " KB"; }

  /* The drop area: three files fall into a tray, over and over, to show what to do. */
  function dump(big) {
    return '<label class="dump' + (big ? " is-big" : "") + '">' +
      '<span class="dump-art" aria-hidden="true">' +
        '<i class="doc d1">' + ic("image", 18) + '</i><i class="doc d2">' + ic("list", 18) + '</i><i class="doc d3">' + ic("file", 18) + "</i>" +
        '<i class="tray"></i></span>' +
      "<b>" + h(t("fdDrop")) + "</b><span>" + h(t("fdOr")) + " <u>" + h(t("fdBrowse")) + "</u></span>" +
      (big ? "<small>" + h(t("fdKinds")) + "</small>" : "") +
      '<input type="file" class="sr" data-files multiple></label>';
  }

  function fileRow(p) {
    const k = kindOf(p);
    const pic = k === "image" ? '<img data-paper="' + h(p.id) + '" alt="" onerror="this.remove()">' : "";
    const what = p.kind === "voice" ? t("fdVoice") : p.contacts ? t("fdContacts", { n: p.contacts }) + (p.dup ? " · " + t("fdDup", { n: p.dup }) : "") : t("fdAttached");
    return '<li class="fl"><span class="fl-ic k-' + k + '">' + pic + ic(KIND_IC[k], 18) + "</span>" +
      '<span class="fl-m"><b>' + h(p.name || (p.kind === "voice" ? t("fdVoice") : t("fdPhoto")) + " · " + whenLong(p.at)) + "</b><small>" + (p.size ? h(kb(p.size)) + " · " : "") + h(what) + "</small></span>" +
      (p.kind === "voice" ? '<audio controls preload="none" data-paper-audio="' + h(p.id) + '"></audio>' : "") +
      '<button class="icbtn" data-act="delPaper" data-id="' + h(p.id) + '" aria-label="' + h(t("fdRemove")) + '" title="' + h(t("fdRemove")) + '">' + ic("x", 16) + "</button></li>";
  }
  function fileList(all) {
    const list = S.papers.filter(function (p) { return all || p.kind === "file"; }).slice().reverse();
    return list.length ? '<ul class="fls">' + list.map(fileRow).join("") + "</ul>" : "";
  }

  /* Files go along with a step (1 Oct 2026, owner): he fills the step, part of it or none of it,
     and attaches what he has -- a rate list, a customer list, a photo of the register. At the end
     of each step, before Next, a card asks for that step's paper and lists what is attached; the
     step's header has Attach files too, and a drop anywhere lands on the step in view. On
     Products, Contacts and Stock an attached file lets the team finish the step (M.fromFile). */
  function attachBtn(step, label, cls) {
    return '<label class="btn ' + (cls || "") + '">' + ic("clip", 16) + h(label) + '<input type="file" multiple class="sr" data-fx="' + step + '"></label>';
  }
  function attach(step) {
    const mine = M.filesFor(S, step);
    const found = mine.reduce(function (n, p) { return n + (p.contacts || 0); }, 0);
    return '<section class="att' + (mine.length ? " has" : "") + '">' +
      '<div class="att-h"><span class="att-ic">' + ic("clip", 18) + '</span><div class="att-m"><b>' + h(t("at_" + step + "_t")) + "</b><small>" + h(t("at_" + step + "_s")) + "</small></div>" +
        attachBtn(step, mine.length ? t("atMore") : t("atBtn"), mine.length ? "is-quiet" : "is-g") + "</div>" +
      (mine.length ? '<div class="att-files">' + mine.map(function (p) {
          return '<i class="fx-f k-' + kindOf(p) + '">' + ic(KIND_IC[kindOf(p)], 14) + "<span>" + h(p.name || t("fdPhoto")) + "</span><small>" + (p.size ? h(kb(p.size)) : "") + "</small>" +
            '<button type="button" data-act="delPaper" data-id="' + h(p.id) + '" aria-label="' + h(t("fdRemove")) + '" title="' + h(t("fdRemove")) + '">' + ic("x", 13) + "</button></i>";
        }).join("") + "</div>" +
        (found ? '<p class="att-note">' + ic("contacts", 14) + h(t("atFound", { n: found })) + "</p>" : M.fromFile(S, step) ? '<p class="att-note">' + ic("circleCheck", 14) + h(t("fxDone_" + step)) + "</p>" : "")
        : '<p class="att-drop">' + h(t("atDrop")) + "</p>") +
      "</section>";
  }

  /* ────────────────────────────────────────────────────── the desk ── */

  function topBar(desk) {
    const en = S.lang === "en";
    return '<header class="top">' + LOGO +
      '<span class="top-t">' + h(S.store.name || t("appName")) + "</span>" +
      '<span class="saved" id="saved">' + savedHTML() + "</span>" +
      '<span class="grow"></span>' +
      (desk ? '<button class="btn is-quiet" data-act="papers">' + ic("folder", 16) + h(t("tPapers")) + (S.papers.length ? ' <i class="pill">' + S.papers.length + "</i>" : "") + "</button>" : "") +
      '<span class="seg langs" role="group" aria-label="भाषा · Language">' +
        '<button class="' + (en ? "" : "on") + '" data-act="lang" data-v="hi" aria-pressed="' + !en + '">हिंदी</button>' +
        '<button class="' + (en ? "on" : "") + '" data-act="lang" data-v="en" aria-pressed="' + en + '">English</button></span>' +
      '<button class="icbtn" data-act="menu" aria-label="' + h(t("menu")) + '">' + ic("more", 20) + "</button>" +
      "</header>";
  }

  function statusText(sec, P) {
    const p = P[sec];
    switch (sec) {
      case "store": return M.storeReady(S) ? M.phoneShow(S.store.mobile) : t("sNone");
      case "items": return p.n ? t("sItems", { n: p.n }) : p.file ? t("sFromFile") : t("sNone");
      case "people": {
        const bits = [p.shops ? t("sShops", { n: p.shops }) : "", p.left ? t("pToSort", { n: p.left }) : ""].filter(Boolean);
        return bits.length ? bits.join(" · ") : p.file ? t("sFromFile") : t("sNone");
      }
      case "stock": return p.n ? t("sStock", { n: p.n }) : p.file ? t("sFromFile") : t("sNone");
      case "rules": return p.n ? t("sRules", { n: p.n, total: M.RULES_N }) : t("sNone");
      default: return "";
    }
  }

  /* Left: the steps, and only the steps (1 Oct 2026, owner: the three columns did not read as
     steps | work | request). Numbered, joined by a line, ticked when done, and ending in the goal:
     Send to FoodBridge. What each step holds is on the right, not repeated here. */
  function railHTML() {
    const P = M.progress(CAT, S);
    const done = SECS.filter(function (s) { return P[s].done; }).length;
    return '<p class="rail-h"><b>' + h(t("stepsTitle")) + "</b><span>" + done + "/" + SECS.length + "</span></p>" +
      '<ol class="steps">' + SECS.map(function (s, i) {
        const d = P[s].done, on = ui.sec === s;
        return '<li><button class="st' + (on ? " on" : "") + (d ? " is-done" : "") + '" data-act="sec" data-to="' + s + '" title="' + h(secName(s)) + '"' + (on ? ' aria-current="step"' : "") + ">" +
          '<span class="st-n">' + (d && !on ? ic("check", 14) : i + 1) + '</span><span class="st-t">' + h(secName(s)) + "</span>" +
          (M.filesFor(S, s).length ? '<span class="st-clip" title="' + h(t("tPapers")) + '">' + ic("clip", 13) + M.filesFor(S, s).length + "</span>" : "") + "</button></li>";
      }).join("") +
      '<li class="is-goal"><button class="st" data-act="buildAsk" title="' + h(t("sendStep")) + '"><span class="st-n">' + ic("send", 14) + '</span><span class="st-t">' + h(t("sendStep")) + "</span></button></li></ol>";
  }

  function deskView() {
    return topBar(true) +
      '<div class="narrow">' + ic("info", 16) + "<span>" + h(t("narrow")) + ' <a href="../">' + h(t("narrowLink")) + "</a></span></div>" +
      '<div class="desk">' +
        '<nav class="rail"><div id="rail">' + railHTML() + "</div>" +
          '<div class="rail-foot"><a href="../" class="link" title="' + h(t("dkPhone")) + '">' + ic("mobile", 15) + "<span>" + h(t("dkPhone")) + "</span></a></div></nav>" +
        '<main class="main" id="main" data-keep="main-' + ui.sec + '">' + sectionHTML(ui.sec) + "</main>" +
        '<aside class="side" id="side">' + sideHTML() + "</aside>" +
      "</div>";
  }

  /* Every section ends in one way on: the next section, and after Daily work, Check and build.
     The sections stay free to open in any order from the rail (1 Oct 2026). */
  function nextBar(sec) {
    const i = SECS.indexOf(sec), to = SECS[i + 1];
    const first = sec === "store" && !Object.keys(S.items).length && !S.order.length;   // nothing done yet: sample data is one click
    return attach(sec) + '<div class="nextbar">' +
      (to ? '<button class="cta" data-act="next" data-from="' + sec + '">' + h(t("nextTo", { s: secName(to) })) + ic("chev", 18) + "</button>"
        : '<button class="btn is-g is-lg" data-act="buildAsk">' + ic("store", 18) + h(t("nextBuild")) + "</button>") +   // Build my store is already green on the right
      (first ? '<button class="link" data-act="sampleAll">' + ic("sparkle", 15) + h(t("stSample")) + "</button>" : "") + "</div>";
  }

  function secHead(sec, sub, tools) {
    const sample = M.SAMPLE_STEPS.indexOf(sec) >= 0;
    const title = sec === "rules" ? t("title_rules") : sec === "store" && !M.storeReady(S) ? t("stTitle") : secName(sec);
    return '<div class="sec-head"><div><p class="eyebrow">' + h(t("stepOf", { n: SECS.indexOf(sec) + 1, total: SECS.length })) + "</p><h1>" + h(title) + "</h1>" + (sub ? '<p class="sub">' + h(sub) + "</p>" : "") + "</div>" +
      '<div class="sec-tools">' + (tools || "") + attachBtn(sec, t("atBtn") + (M.filesFor(S, sec).length ? " · " + M.filesFor(S, sec).length : ""), "is-quiet") +
      (sample ? '<button class="btn is-quiet" data-act="sampleAsk" data-step="' + sec + '">' + ic("sparkle", 15) + h(t("sampleBtn")) + "</button>" : "") + "</div></div>";
  }

  const SECTIONS = {};
  function sectionHTML(sec) { return (SECTIONS[sec] || SECTIONS.store)(); }

  /* ── Shop ── */
  /* The first thing he sees, inside the same desk as everything after it: the shop. */
  SECTIONS.store = function () {
    return secHead("store", M.storeReady(S) ? t("q_store") : t("stSub")) + '<div class="card narrowcard">' + shopFields() + "</div>" + nextBar("store");
  };

  /* ── Products: groups | grid, and what he chose collecting on the right ── */

  function allIds() {
    return CAT.items.map(function (x) { return x.id; }).concat(Object.keys(S.customItems));
  }
  function groupIds(by, id) {
    const all = CAT.items.concat(Object.keys(S.customItems).map(function (k) { return Object.assign({ id: k }, S.customItems[k]); }));
    if (id === "mine") return Object.keys(S.items);
    if (id === "all") return allIds();
    if (by === "co") return all.filter(function (x) { return x.company === id; }).map(function (x) { return x.id; });
    const a = (CAT.aisles || []).find(function (x) { return x.id === id; });
    return a ? all.filter(function (x) { return a.cats.indexOf(x.cat) >= 0; }).map(function (x) { return x.id; }) : [];
  }
  function chosenIn(ids) { return ids.filter(function (id) { return S.items[id]; }).length; }

  function groups() {
    if (ui.by === "co") return M.companyList(CAT, S).map(function (c) {
      const ids = groupIds("co", c.id);
      return ids.length ? { id: c.id, name: c.short, ids: ids } : null;
    }).filter(Boolean);
    return CAT.aisles.filter(function (a) { return a.fresh; }).concat(CAT.aisles.filter(function (a) { return !a.fresh; })).map(function (a) {
      return { id: a.id, name: S.lang === "en" ? a.en : a.hi, ids: groupIds("aisle", a.id), fresh: !!a.fresh };
    });
  }
  function curGroup() {
    const gs = groups();
    if (ui.group === "mine" || ui.group === "all") return ui.group;
    return gs.some(function (g) { return g.id === ui.group; }) ? ui.group : gs[0] ? gs[0].id : "all";
  }

  function groupsHTML() {
    const cur = curGroup();
    const row = function (id, name, ids, cls) {
      const n = id === "mine" ? 0 : chosenIn(ids);
      return '<button class="grp' + (cur === id && !ui.itemsQ.trim() ? " on" : "") + (cls ? " " + cls : "") + '" data-act="group" data-id="' + h(id) + '">' +
        "<span>" + h(name) + '</span><small class="' + (n ? "has" : "") + '">' + (n ? n + "/" : "") + ids.length + "</small></button>";
    };
    const gs = groups();
    let list = "";
    if (ui.by === "co") list = gs.map(function (g) { return row(g.id, g.name, g.ids); }).join("");
    else {
      list = '<p class="grp-l">' + h(t("iFresh")) + "</p>" + gs.filter(function (g) { return g.fresh; }).map(function (g) { return row(g.id, g.name, g.ids); }).join("") +
        '<p class="grp-l">' + h(t("iPacked")) + "</p>" + gs.filter(function (g) { return !g.fresh; }).map(function (g) { return row(g.id, g.name, g.ids); }).join("");
    }
    return '<div class="seg by">' +
        '<button class="' + (ui.by === "co" ? "on" : "") + '" data-act="by" data-v="co">' + h(t("iByCompany")) + "</button>" +
        '<button class="' + (ui.by === "aisle" ? "on" : "") + '" data-act="by" data-v="aisle">' + h(t("iByType")) + "</button></div>" +
      '<div class="grps" data-keep="grps">' + row("mine", t("iMine"), Object.keys(S.items), "is-mine") + row("all", t("allProducts"), allIds()) +
      '<hr>' + list + "</div>";
  }

  function shownIds() {
    const q = ui.itemsQ.trim();
    if (q) return M.search(CAT, S, q, null);
    return groupIds(ui.by, curGroup());
  }

  function pickCard(it) {
    const price = it.loose ? (it.sell != null ? rupee(it.sell) + " " + t("per_" + it.per) : t("per_" + it.per)) : it.mrp ? "MRP " + rupee(it.mrp) : "";
    return '<button class="pick' + (it.on ? " on" : "") + '" data-act="pick" data-id="' + h(it.id) + '" aria-pressed="' + it.on + '">' +
      '<span class="pick-img">' + pickImg(it) + '<span class="tick">' + ic("check", 13) + "</span></span>" +
      '<span class="pick-n">' + h(nm(it)) + '</span><span class="pick-s">' + h(it.loose ? (S.lang === "en" && it.hi ? it.hi : "") : it.pack) + (price ? " · " + h(price) : "") + "</span></button>";
  }

  function pickBarHTML(ids) {
    const n = chosenIn(ids);
    return "<span>" + h(t("foundN", { n: ids.length })) + (n ? " · " + h(t("iChosen", { n: n })) : "") + "</span>" +
      (ids.length ? '<button class="btn" data-act="pickAll">' + h(n === ids.length ? t("iClearAll") : t("iSelectAll") + " " + ids.length) + "</button>" : "");
  }

  function gridHTML() {
    const ids = shownIds().slice(0, 240);
    ui.shown = ids;
    if (!ids.length) {
      return '<div class="empty"><p>' + h(ui.group === "mine" && !ui.itemsQ.trim() ? t("ypEmpty") : t("iEmpty")) + "</p>" +
        (ui.itemsQ.trim() ? '<button class="btn" data-act="newItem">' + ic("plus", 16) + h(t("iNew")) + "</button>" : "") + "</div>";
    }
    if (curGroup() === "mine" && !ui.itemsQ.trim()) return priceTable();
    return '<div class="picks">' + ids.map(function (id) { return M.item(CAT, S, id); }).filter(Boolean).map(pickCard).join("") + "</div>";
  }

  /* Your products, as a price list: what he chose, the MRP, and his price to the customer, typed
     in place. What still needs a price comes first. (Until 1 Oct 2026 this list sat on the right.) */
  function priceTable() {
    const its = M.chosenItems(CAT, S).reverse();
    const need = function (it) { return it.sell == null ? 0 : 1; };
    its.sort(function (a, b) { return need(a) - need(b); });
    return '<p class="hint">' + h(t("ypHint")) + "</p>" +
      '<table class="tbl prices"><thead><tr><th></th><th>' + h(t("colProduct")) + '</th><th class="r">' + h(t("colMrp")) + '</th><th class="r">' + h(t("colCust")) + "</th><th></th></tr></thead><tbody>" +
      its.map(function (it) {
        const p = "items." + it.id + ".";
        return '<tr class="pr-r' + (it.sell == null ? " is-need" : "") + '"><td class="im"><span class="pick-img sm">' + pickImg(it) + "</span></td>" +
          '<td class="nm"><button class="nm-b" data-act="item" data-id="' + h(it.id) + '"><b>' + h(nm(it)) + "</b><small>" + h(packLabel(it)) + "</small></button></td>" +
          '<td class="r num">' + (it.mrp ? h(rupee(it.mrp)) : "—") + "</td>" +
          '<td class="r"><label class="price-in"><span>₹</span><input class="in num" data-bind="' + p + 'sell" data-kind="num" data-touch="' + p + 'touched.sell" inputmode="decimal" value="' + h(it.sell == null ? "" : it.sell) + '" placeholder="' + h(t("prPh")) + '" aria-label="' + h(t("iShopPrice")) + " · " + h(nm(it)) + '"><small>' + h(it.loose ? t("per_" + it.per).replace(/^per /, "/ ") : t("ypPiece")) + "</small></label></td>" +
          '<td class="x"><button class="icbtn" data-act="pick" data-id="' + h(it.id) + '" aria-label="' + h(t("remove")) + '" title="' + h(t("remove")) + '">' + ic("x", 15) + "</button></td></tr>";
      }).join("") + "</tbody></table>";
  }

  SECTIONS.items = function () {
    return secHead("items", "", '<button class="btn" data-act="newItem">' + ic("plus", 16) + h(t("iNew")) + "</button>") +
      '<div class="items">' +
        '<div class="items-g" id="groups">' + groupsHTML() + "</div>" +
        '<div class="items-p">' +
          '<div class="bar"><label class="search">' + ic("search", 16) +
            '<input type="search" id="itemsQ" data-q="itemsQ" value="' + h(ui.itemsQ) + '" placeholder="' + h(t("iSearch")) + '" aria-label="' + h(t("iSearch")) + '" autocomplete="off">' +
            '<kbd>/</kbd></label><div class="pickbar" id="pickbar">' + pickBarHTML(shownIds()) + "</div></div>" +
          '<div id="grid">' + gridHTML() + "</div>" +
          '<p class="hint keys">' + h(t("pickHint")) + "</p>" +
        "</div>" +
      "</div>" + nextBar("items");
  };

  /* After a tick: the card, the counts, the list on the right -- in place, so the pictures don't reload. */
  function afterPick(ids) {
    ids.forEach(function (id) {
      const card = document.querySelector('.pick[data-id="' + CSS.escape(id) + '"]');
      if (card) { const on = !!S.items[id]; card.classList.toggle("on", on); card.setAttribute("aria-pressed", on); }
    });
    const g = document.getElementById("groups");
    if (g) { const k = g.querySelector(".grps"), top = k ? k.scrollTop : 0; g.innerHTML = groupsHTML(); const k2 = g.querySelector(".grps"); if (k2) k2.scrollTop = top; }
    const pb = document.getElementById("pickbar");
    if (pb) pb.innerHTML = pickBarHTML(shownIds());
    if (ui.group === "mine" && !ui.itemsQ.trim()) { const gr = document.getElementById("grid"); if (gr) gr.innerHTML = gridHTML(); }
    refreshSide();
    refreshRail();
    hydrate();
  }

  /* ── Contacts ── */

  const TAGS = [["shop", "pShop", "1"], ["staff", "pStaff", "2"], ["supplier", "pSupplier", "3"]];

  function peopleTab() {
    return ui.tab || (M.unsorted(S).length ? "sort" : M.peopleOf(S, "shop").length ? "shop" : "sort");
  }
  function matchQ(p) {
    const q = (ui.peopleQ || "").toLowerCase().trim();
    return !q || (p.name + " " + p.phone).toLowerCase().indexOf(q) >= 0 || M.phone10(p.phone).indexOf(q.replace(/\D/g, "") || "~") >= 0;
  }
  function sortList() {
    return S.order.map(function (id) { return S.people[id]; }).filter(function (p) {
      return p && (!p.type || ui.sortedHere.indexOf(p.id) >= 0);   // a contact tagged here stays, its tag lit, until he leaves the tab
    }).filter(matchQ);
  }

  function tagBtns(p, guess) {
    return '<span class="tags">' + TAGS.map(function (x) {
      const on = p.type === x[0];
      return '<button class="tag ' + x[0] + (on ? " on" : !p.type && guess === x[0] ? " is-guess" : "") + '" data-act="sort" data-id="' + h(p.id) + '" data-v="' + x[0] + '" aria-pressed="' + on + '"><kbd>' + x[2] + "</kbd>" + h(t(x[1])) + "</button>";
    }).join("") +
      '<button class="tag is-x' + (p.type === "skip" ? " on" : "") + '" data-act="sort" data-id="' + h(p.id) + '" data-v="skip" aria-label="' + h(t("pSkip")) + '" title="' + h(t("pSkip")) + '"><kbd>0</kbd>' + ic("x", 14) + "</button></span>";
  }

  function nameCell(p, sub, warn) {
    return '<td class="nm"><button class="nm-b" data-act="person" data-id="' + h(p.id) + '"><b>' + h(p.name) + "</b>" +
      (sub != null ? '<small class="' + (warn ? "warn" : "") + '">' + h(sub) + "</small>" : "") + "</button></td>";
  }

  function addRow(type) {
    if (!ui.adding) return "";
    return '<div class="addrow">' + ic("user", 16) +
      '<input id="addName" class="in" placeholder="' + h(t("pName")) + '" autocomplete="off">' +
      '<input id="addPhone" class="in" placeholder="' + h(t("pPhone")) + '" inputmode="tel" autocomplete="off">' +
      '<select id="addType" class="in">' + [["", t("pTabSort")], ["shop", t("pShop")], ["staff", t("pStaff")], ["supplier", t("pSupplier")]].map(function (o) {
        return '<option value="' + o[0] + '"' + ((type || "") === o[0] ? " selected" : "") + ">" + h(o[1]) + "</option>";
      }).join("") + "</select>" +
      '<button class="btn is-g" data-act="addPerson">' + ic("plus", 16) + h(t("addPersonGo")) + "</button>" +
      '<button class="icbtn" data-act="addClose" aria-label="' + h(t("close")) + '">' + ic("x", 16) + "</button></div>";
  }

  function sortTable() {
    const rows = sortList();
    const left = M.unsorted(S).length;
    if (!rows.length) {
      if (S.order.length && !ui.peopleQ) return '<div class="callout">' + ic("circleCheck", 18) + "<p>" + h(t("pAllSorted")) + "</p></div>";
      if (ui.peopleQ) return '<div class="empty"><p>' + h(t("gsNoFound")) + "</p></div>";
      return '<div class="empty big">' + ic("contacts", 28) + "<h3>" + h(t("sortEmptyT")) + "</h3><p>" + h(t("sortEmptyS")) + "</p>" + '<label class="btn is-g">' + ic("file", 16) + h(t("importFile")) + '<input type="file" class="sr" data-files multiple accept=".vcf,.vcard,.csv,.tsv,.txt,.xlsx"></label> ' +
        '<button class="btn" data-act="addOpen">' + ic("pen", 16) + h(t("pType")) + "</button></div>";
    }
    if (!ui.sortFocus || !rows.some(function (p) { return p.id === ui.sortFocus; })) {
      const first = rows.find(function (p) { return !p.type; }) || rows[0];
      ui.sortFocus = first.id;
    }
    return '<div class="sortbar">' +
        (left > 1 ? '<button class="btn is-g" data-act="sortAll">' + ic("users", 16) + h(t("pRestCustomers", { n: left })) + "</button>" : "") +
        (ui.lastSorted.length ? '<button class="btn is-quiet" data-act="undoSort">' + ic("undo", 16) + h(t("pUndo")) + "</button>" : "") +
        '<span class="grow"></span><span class="hint keys">' + h(t("keysSort")) + "</span></div>" +
      '<table class="tbl sort"><thead><tr><th>' + h(t("colName")) + "</th><th>" + h(t("colNumber")) + "</th><th>" + h(t("colLooks")) + "</th><th></th></tr></thead><tbody>" +
      rows.map(function (p) {
        const g = M.guessType(p.name);
        return '<tr class="' + (p.id === ui.sortFocus ? "focus" : "") + (p.type ? " is-tagged" : "") + '" data-row="' + h(p.id) + '">' +
          nameCell(p, null) + '<td class="num">' + h(M.phoneShow(p.phone)) + "</td>" +
          '<td class="guess">' + (g ? h(t({ shop: "pShop", staff: "pStaff", supplier: "pSupplier" }[g])) : "") + "</td>" +
          '<td class="r">' + tagBtns(p, g) + "</td></tr>";
      }).join("") + "</tbody></table>";
  }

  function dayCells(p) {
    return M.DAYS.map(function (d) {
      const on = (p.days || []).indexOf(d) >= 0;
      return '<td class="dc"><button class="day' + (on ? " on" : "") + '" data-day="' + d + '" data-pid="' + h(p.id) + '" aria-pressed="' + on + '" aria-label="' + h(dayName(d)) + '"></button></td>';
    }).join("");
  }
  function dayHeads() { return M.DAYS.map(function (d) { return '<th class="dc">' + h(dayName(d)) + "</th>"; }).join(""); }

  function sel(path, opts, cur) {
    return '<select class="in" data-bind="' + h(path) + '" data-kind="auto">' + '<option value="">' + h(t("pickOne")) + "</option>" + opts.map(function (o) {
      return '<option value="' + h(o.v) + '"' + (cur != null && String(cur) === String(o.v) ? " selected" : "") + ">" + h(o.label) + "</option>";
    }).join("") + "</select>";
  }

  function areas() {
    const set = {};
    (S.store.areas || []).forEach(function (a) { if (a) set[a] = 1; });
    M.peopleOf(S, "shop").forEach(function (p) { if (p.area) set[p.area] = 1; });
    return Object.keys(set).sort();
  }

  /* "Same area, same days": an area where some customers have days and some don't. */
  function areaHints() {
    const shops = M.peopleOf(S, "shop");
    return areas().map(function (a) {
      const inA = shops.filter(function (p) { return p.area === a; });
      const withD = inA.filter(function (p) { return (p.days || []).length; });
      const without = inA.filter(function (p) { return !(p.days || []).length; });
      if (!withD.length || !without.length) return null;
      const tally = {};
      withD.forEach(function (p) { const k = M.DAYS.filter(function (d) { return p.days.indexOf(d) >= 0; }).join(","); tally[k] = (tally[k] || 0) + 1; });
      const days = Object.keys(tally).sort(function (x, y) { return tally[y] - tally[x]; })[0].split(",");
      return { area: a, days: days, n: without.length };
    }).filter(Boolean);
  }

  function custTable() {
    const shops = M.peopleOf(S, "shop").filter(matchQ);
    if (!shops.length) return '<div class="empty"><p>' + h(t("shEmpty")) + "</p></div>";
    const pays = [{ v: "cash", label: t("payCash") }, { v: 7, label: t("payDays", { n: 7 }) }, { v: 15, label: t("payDays", { n: 15 }) }, { v: 30, label: t("payDays", { n: 30 }) }];
    const hints = areaHints();
    return '<datalist id="areaList">' + areas().map(function (a) { return '<option value="' + h(a) + '">'; }).join("") + "</datalist>" +
      '<p class="hint">' + h(t("paintHint")) + " " + h(t("starHint")) + "</p>" +
      '<table class="tbl cust"><thead><tr><th class="stc"></th><th>' + h(t("colName")) + "</th><th>" + h(t("colArea")) + "</th>" + dayHeads() +
        "<th>" + h(t("colPays")) + "</th></tr></thead><tbody>" +
      shops.map(function (p) {
        return "<tr>" +
          '<td class="stc"><button class="star' + (p.big ? " on" : "") + '" data-act="set" data-path="people.' + h(p.id) + '.big" data-kind="flip" aria-pressed="' + !!p.big + '" aria-label="' + h(t("shBig")) + '">' + ic("star", 16) + "</button></td>" +
          nameCell(p, M.phoneShow(p.phone) || t("gap_shopNoPhone"), M.phone10(p.phone).length !== 10) +
          '<td class="ar">' + inp("people." + p.id + ".area", { list: "areaList", ph: t("noArea"), cls: "area", label: t("colArea") }) + "</td>" +
          dayCells(p) +
          '<td class="py">' + sel("people." + p.id + ".pay", pays, p.pay) + "</td></tr>";   // what they owe, and the rest: the name opens them
      }).join("") + "</tbody></table>" +
      (hints.length ? '<div class="hints">' + hints.map(function (x) {
        return '<button class="btn is-quiet" data-act="sameArea" data-area="' + h(x.area) + '" data-days="' + x.days.join(",") + '">' + ic("calendar", 15) +
          h(t("sameArea", { area: x.area, days: x.days.map(dayName).join(", "), n: x.n })) + "</button>";
      }).join("") + "</div>" : "");
  }

  function roleOpts() {
    return [{ v: "salesman", label: t("roleSalesman") }, { v: "delivery", label: t("roleDelivery") }, { v: "supervisor", label: t("roleSupervisor") }, { v: "office", label: t("roleOffice") }];
  }

  function staffTable() {
    const staff = M.peopleOf(S, "staff").filter(matchQ);
    if (!staff.length) {
      return '<div class="empty"><p>' + h(t("stEmpty")) + "</p>" +
        (S.skipped.staff ? '<p class="ok">' + ic("check", 16) + h(t("stNone")) + "</p>" : '<button class="btn" data-act="skip" data-step="staff">' + h(t("stNone")) + "</button>") + "</div>";
    }
    return '<p class="hint">' + h(t("paintHint")) + "</p>" +
      '<table class="tbl staff"><thead><tr><th>' + h(t("colName")) + "</th><th>" + h(t("colJob")) + "</th>" + dayHeads() + "<th>" + h(t("colVehicle")) + '</th><th class="c">' + h(t("colCash")) + "</th></tr></thead><tbody>" +
      staff.map(function (p) {
        return "<tr>" + nameCell(p, M.phoneShow(p.phone)) +
          "<td>" + sel("people." + p.id + ".role", roleOpts(), p.role) + "</td>" + dayCells(p) +
          "<td>" + inp("people." + p.id + ".vehicle", { kind: "upper", upper: true, ph: "MH 02 AB 1234", cls: "veh", label: t("colVehicle") }) + "</td>" +
          '<td class="c"><input type="checkbox" class="cb" data-act="flipCash" data-id="' + h(p.id) + '"' + (p.cash ? " checked" : "") + ' aria-label="' + h(t("colCash")) + '"></td></tr>';
      }).join("") + "</tbody></table>";
  }

  function companyOpts() {
    let cos = M.companyList(CAT, S).filter(function (c) { return S.companies[c.id]; });
    if (!cos.length) cos = M.companyList(CAT, S);
    return cos.map(function (c) { return { v: c.id, label: c.short }; });
  }

  function supTable() {
    const sups = M.peopleOf(S, "supplier").filter(matchQ);
    if (!sups.length) {
      return '<div class="empty"><p>' + h(t("suEmpty")) + "</p>" +
        (S.skipped.suppliers ? '<p class="ok">' + ic("check", 16) + h(t("suNone")) + "</p>" : '<button class="btn" data-act="skip" data-step="suppliers">' + h(t("suNone")) + "</button>") + "</div>";
    }
    const leads = [1, 2, 3, 7].map(function (n) { return { v: n, label: t("daysN", { n: n }) }; });
    return '<table class="tbl sup"><thead><tr><th>' + h(t("colName")) + "</th><th>" + h(t("colCompanies")) + "</th><th>" + h(t("colCode")) + "</th><th>" + h(t("colLead")) + '</th><th class="r">' + h(t("colOwe")) + "</th></tr></thead><tbody>" +
      sups.map(function (p) {
        return "<tr>" + nameCell(p, M.phoneShow(p.phone)) +
          '<td class="cos">' + setChips("people." + p.id + ".companies", "arr", companyOpts(), "mini" + ((p.companies || []).length ? "" : " is-warn")) + "</td>" +
          "<td>" + inp("people." + p.id + ".code", { cls: "code", label: t("colCode") }) + "</td>" +
          "<td>" + sel("people." + p.id + ".lead", leads, p.lead) + "</td>" +
          '<td class="r ow">' + inp("people." + p.id + ".owe", { kind: "num", mode: "numeric", ph: "₹", cls: "num", label: t("colOwe") }) + "</td></tr>";
      }).join("") + "</tbody></table>";
  }

  function skipTable() {
    const list = M.peopleOf(S, "skip").filter(matchQ);
    if (!list.length) return '<div class="empty"><p>' + h(t("paNone")) + "</p></div>";
    return '<table class="tbl sort"><tbody>' + list.map(function (p) {
      return "<tr>" + nameCell(p, null) + '<td class="num">' + h(M.phoneShow(p.phone)) + '</td><td class="r">' + tagBtns(p, null) + "</td></tr>";
    }).join("") + "</tbody></table>";
  }

  function peopleBody(tab) {
    return tab === "shop" ? custTable() : tab === "staff" ? staffTable() : tab === "supplier" ? supTable() : tab === "skip" ? skipTable() : sortTable();
  }

  SECTIONS.people = function () {
    const tab = peopleTab();
    const n = { sort: M.unsorted(S).length, shop: M.peopleOf(S, "shop").length, staff: M.peopleOf(S, "staff").length, supplier: M.peopleOf(S, "supplier").length, skip: M.peopleOf(S, "skip").length };
    const tabs = [["sort", "pTabSort"], ["shop", "tShops"], ["staff", "tStaff"], ["supplier", "tSuppliers"], ["skip", "tNot"]];
    return secHead("people", "",
        '<button class="btn" data-act="addOpen">' + ic("plus", 16) + h(t("addPerson")) + "</button>") +
      '<div class="ptabs" role="tablist">' + tabs.map(function (x) {
        if (x[0] === "skip" && !n.skip) return "";
        return '<button role="tab" aria-selected="' + (tab === x[0]) + '" class="ptab' + (tab === x[0] ? " on" : "") + (x[0] === "sort" && n.sort ? " is-todo" : "") + '" data-act="tab" data-v="' + x[0] + '">' +
          h(t(x[1])) + " <b>" + n[x[0]] + "</b></button>";
      }).join("") +
        '<span class="grow"></span><label class="search small">' + ic("search", 15) + '<input type="search" id="peopleQ" data-q="peopleQ" value="' + h(ui.peopleQ) + '" placeholder="' + h(t("pSearch")) + '" autocomplete="off"><kbd>/</kbd></label></div>' +
      addRow(["shop", "staff", "supplier"].indexOf(tab) >= 0 ? tab : "") +
      '<div id="plist">' + peopleBody(tab) + "</div>" + nextBar("people");
  };

  /* ── Stock: a count sheet ── */

  function stockItems() { return M.stockSel(CAT, S).map(function (id) { return M.item(CAT, S, id); }).filter(Boolean); }
  function stockMissing() { const s = M.stockSel(CAT, S); return Object.keys(S.items).filter(function (id) { return s.indexOf(id) < 0; }); }
  function unitLabel(it, k) { return it.loose ? t("u_" + k) : k === "case" ? t("uCase") : t("uPiece"); }

  function stockDrop() {
    if (!ui.stOpen || !ui.stQ.trim()) return "";
    const s = M.stockSel(CAT, S);
    const ids = M.search(CAT, S, ui.stQ.trim(), null).filter(function (id) { return s.indexOf(id) < 0; })
      .sort(function (a, b) { return (S.items[b] ? 1 : 0) - (S.items[a] ? 1 : 0); }).slice(0, 8);
    if (!ids.length) return '<div class="drop-l"><p class="hint">' + h(t("gsNoFound")) + '</p><button class="btn" data-act="newItem" data-count="1">' + ic("plus", 16) + h(t("iNew")) + "</button></div>";
    return '<div class="drop-l">' + ids.map(function (id, i) {
      const it = M.item(CAT, S, id);
      return '<button class="drop-r' + (i === 0 ? " first" : "") + '" data-act="stAdd" data-id="' + h(id) + '"><span class="pick-img sm">' + pickImg(it) + "</span><span><b>" + h(nm(it)) + "</b><small>" + h(packLabel(it)) + "</small></span>" + ic("plus", 16) + "</button>";
    }).join("") + "</div>";
  }

  function stockRow(it, i) {
    const c = M.countOf(it), k = M.lineUnit(S, it);
    const price = it.sell == null ? null : M.round2(it.sell * M.unitPer(it, k));
    const co = it.company && M.companyById(CAT, S, it.company);
    return '<tr class="' + (c ? "done" : "") + '"><td class="im"><span class="pick-img sm">' + pickImg(it) + "</span></td>" +
      '<td class="nm"><b>' + h(nm(it)) + "</b><small>" + h([packLabel(it), co ? co.short : ""].filter(Boolean).join(" · ")) + "</small></td>" +
      '<td class="cnt"><input class="in num" data-count="' + h(it.id) + '" data-i="' + i + '" inputmode="numeric" autocomplete="off" value="' + (c ? c.qty : "") + '" placeholder="–" aria-label="' + h(nm(it)) + '"></td>' +
      "<td>" + (M.countUnits(it).length > 1 ? '<select class="in" data-unit="' + h(it.id) + '">' + M.countUnits(it).map(function (u) {
        return '<option value="' + u.k + '"' + (u.k === k ? " selected" : "") + ">" + h(unitLabel(it, u.k)) + (u.per > 1 ? " · " + u.per : "") + "</option>";
      }).join("") + "</select>" : '<span class="unit">' + h(unitLabel(it, k)) + "</span>") + "</td>" +
      '<td class="r price">' + (price == null ? '<span class="warn">' + h(t("iAddPrice")) + "</span>" : h(rupee(price)) + ' <small>/ ' + h(unitLabel(it, k).toLowerCase()) + "</small>") + "</td>" +
      '<td class="x"><button class="icbtn" data-act="stRemove" data-id="' + h(it.id) + '" aria-label="' + h(t("gsRemove")) + '" title="' + h(t("gsRemove")) + '">' + ic("x", 15) + "</button></td></tr>";
  }

  function stockCounted() {
    const its = stockItems();
    return t("gsCounted", { n: its.filter(function (it) { return M.countOf(it); }).length, total: its.length });
  }

  SECTIONS.stock = function () {
    const its = stockItems(), miss = stockMissing().length;
    return secHead("stock", t("q_stock")) +
      '<div class="bar"><div class="st-add"><label class="search">' + ic("search", 16) +
        '<input type="search" id="stQ" value="' + h(ui.stQ) + '" placeholder="' + h(t("stockAdd")) + '" autocomplete="off"><kbd>/</kbd></label><div id="stDrop">' + stockDrop() + "</div></div>" +
        (miss ? '<button class="btn" data-act="stAll">' + ic("plus", 16) + h(t("stockMore", { n: miss })) + "</button>" : "") +
        '<span class="grow"></span><span class="pill-l" id="stCounted">' + h(stockCounted()) + "</span></div>" +
      (its.length
        ? '<table class="tbl stock"><thead><tr><th></th><th>' + h(t("colProduct")) + "</th><th>" + h(t("colCount")) + "</th><th>" + h(t("colIn")) + '</th><th class="r">' + h(t("colPrice")) + "</th><th></th></tr></thead><tbody>" +
          its.map(stockRow).join("") + "</tbody></table>" + '<p class="hint keys">' + h(t("stockLegend")) + " · Enter ↓ · ↑</p>"
        : '<div class="empty"><p>' + h(t("stockNoItems")) + '</p><button class="btn is-g" data-act="sec" data-to="items">' + ic("box", 16) + h(t("goProducts")) + "</button></div>") + nextBar("stock");
  };

  /* ── Daily work: every question on one page ── */

  function otherBox(path) {
    const v = getPath(path), on = Array.isArray(v) ? v.indexOf("other") >= 0 : v === "other";
    return on ? inp(path + "Other", { ph: t("otherPh"), cls: "wide" }) : "";
  }

  SECTIONS.rules = function () {
    const other = { v: "other", label: t("tOther") };
    const yn = function (label, path) { return '<div class="yn"><span>' + h(t(label)) + "</span>" + seg(path) + "</div>"; };
    return secHead("rules", t("q_rules")) +
      '<div class="rules">' +
        '<div class="card">' + yn("ruRoutes", "rules.routes") + yn("ruSelf", "rules.selfOrder") + yn("ruPart", "rules.partPay") + "</div>" +
        '<div class="card">' +
          field(t("ruPay"), setChips("rules.payMethods", "arr", [{ v: "cash", label: t("mCash") }, { v: "upi", label: t("mUpi") }, { v: "cheque", label: t("mCheque") }, { v: "credit", label: t("mCredit") }, other]) + otherBox("rules.payMethods")) +
          field(t("ruReturns"), setChips("rules.returns", "str", [{ v: "credit", label: t("retCredit") }, { v: "replace", label: t("retReplace") }, { v: "none", label: t("retNone") }, other]) + otherBox("rules.returns")) +
          field(t("ruMorning"), setChips("rules.morning", "str", [{ v: "orders", label: t("mnOrders") }, { v: "money", label: t("mnMoney") }, { v: "stock", label: t("mnStock") }, { v: "trucks", label: t("mnTrucks") }, other]) + otherBox("rules.morning")) +
        "</div>" +
        '<div class="card span">' + field(t("ruNote"), inp("rules.note", { area: true, ph: t("notePh") })) + "</div>" +
      "</div>" + nextBar("rules");
  };

  /* ── The right side: what he chose (on Products), the store at a glance, and Build ── */

  function tilesHTML() {
    const P = M.progress(CAT, S);
    const tile = function (n, label, sec, tab) {
      const file = !n && P[sec] && P[sec].file && sec !== "people";   // nothing entered, but his file stands in
      return '<button class="tile" data-act="sec" data-to="' + sec + '"' + (tab ? ' data-tab="' + tab + '"' : "") + "><b>" + (file ? ic("file", 22) : n) + "</b><span>" + h(label) + (file ? " · " + h(t("sFromFile")) : "") + "</span></button>";
    };
    return '<div class="tiles">' +
      tile(Object.keys(S.items).length, t("tProducts"), "items") + tile(M.peopleOf(S, "shop").length, t("tShops"), "people", "shop") +
      tile(M.peopleOf(S, "supplier").length, t("tSuppliers"), "people", "supplier") + tile(M.peopleOf(S, "staff").length, t("tStaff"), "people", "staff") +
      tile(P.stock.n, t("fiStock"), "stock") + tile(S.papers.length, t("tPapers"), "papers") + "</div>";
  }

  function gapsHTML(open) {
    const gaps = M.missing(CAT, S);
    if (!gaps.length) return '<div class="callout">' + ic("circleCheck", 16) + "<p>" + h(t("fiNoMissing")) + "</p></div>";
    return '<details class="gaps"' + (open ? " open" : "") + "><summary>" + ic("info", 16) + "<span>" + h(t("fiLater", { n: gaps.length })) + "</span>" + ic("chev", 14) + "</summary>" +
      gaps.map(function (g) {
        return '<button class="gap" data-act="sec" data-to="' + g.step + '"' + (g.tab ? ' data-tab="' + g.tab + '"' : "") + "><span>" + h(t("gap_" + g.key)) + "</span>" + (g.n > 1 ? '<i class="pill">' + g.n + "</i>" : "") + ic("chev", 14) + "</button>";
      }).join("") + "</details>";
  }

  function buildState() {
    const last = S.lastBuild;
    if (!last) return "";
    const wait = (ui.outbox || []).find(function (b) { return b.id === last.id; });
    if (!wait) return '<p class="sent">' + ic("circleCheck", 15) + h(t("fiSent")) + " · " + h(whenLong(last.at)) + "</p>";
    return '<p class="sent is-wait">' + ic("clock", 15) + h(t("fiWaiting")) + " · " + h(t("fiWaitingSub", { n: wait.sent, total: wait.total })) + "</p>";
  }

  /* Right: a preview of the store itself (1 Oct 2026, owner: a list of the same steps as the left
     read as a repeat). Not the process -- the result: his number and business on top, the packs he
     picked, his customers' initials, what he counted, how his day runs, his files. It starts as a
     faded outline and fills in as he works. Below: how ready it is, and Build my store. */
  function typeLabel() {
    const st = S.store, k = { distributor: "tDistributor", superstockist: "tSuperstockist", wholesaler: "tWholesaler", retailer: "tRetailer", manufacturer: "tManufacturer" }[st.type];
    return k ? t(k) : st.type === "other" ? st.typeOther || t("tOther") : "";
  }
  const skel = function (n) { return '<span class="skel">' + Array.from({ length: n }, function () { return "<i></i>"; }).join("") + "</span>"; };

  function pvBlock(sec, label, count, body) {
    return '<button class="pv-b" data-act="' + (sec === "papers" ? "papers" : "sec") + '" data-to="' + sec + '"><span class="pv-bh"><b>' + h(label) + "</b>" +
      (count ? "<i>" + count + "</i>" : "") + "</span>" + body + "</button>";
  }

  function previewHTML() {
    const P = M.progress(CAT, S), st = S.store;
    const its = M.chosenItems(CAT, S).reverse(), shops = M.peopleOf(S, "shop");
    const fileName = function (sec) { const f = M.filesFor(S, sec)[0]; return f ? '<span class="pv-file">' + ic("file", 13) + h(f.name || t("fdPhoto")) + "</span>" : ""; };
    const top = '<div class="pv-top"><span class="pv-av">' + ic("store", 20) + "</span><div><b>" + h(st.name || t("pvNoName")) + "</b>" +
      (M.storeReady(S) ? "<small>" + h([M.phoneShow(st.mobile), typeLabel(), st.gst].filter(Boolean).join(" · ")) + "</small>" : skel(1)) + "</div></div>";
    const products = its.length
      ? '<span class="pv-ths">' + its.slice(0, 5).map(function (it) { return '<span class="pick-img pv-th">' + pickImg(it) + "</span>"; }).join("") +
        (its.length > 5 ? '<span class="pv-more">+' + (its.length - 5) + "</span>" : "") + "</span>"
      : fileName("items") || '<span class="skel is-sq"><i></i><i></i><i></i><i></i></span>';
    const people = shops.length
      ? '<span class="pv-avs">' + shops.slice(0, 6).map(function (p) { return avatar(p.name); }).join("") + (shops.length > 6 ? '<span class="pv-more">+' + (shops.length - 6) + "</span>" : "") + "</span>" +
        ((P.people.staff || P.people.suppliers) ? "<small>" + h([P.people.staff ? t("sStaff", { n: P.people.staff }) : "", P.people.suppliers ? t("sSup", { n: P.people.suppliers }) : ""].filter(Boolean).join(" · ")) + "</small>" : "")
      : fileName("people") || '<span class="skel is-av"><i></i><i></i><i></i></span>';
    const stock = P.stock.n ? '<span class="pv-txt">' + h(t("sStock", { n: P.stock.n })) + "</span>" : fileName("stock") || skel(1);
    const r = S.rules, pay = { cash: "mCash", upi: "mUpi", cheque: "mCheque", credit: "mCredit" };
    const daily = (r.payMethods || []).map(function (m) { return pay[m] ? t(pay[m]) : r.payMethodsOther || t("tOther"); })
      .concat(r.routes ? [t("pvRoutes")] : [], r.selfOrder ? [t("pvSelf")] : [], r.partPay ? [t("pvPart")] : []);
    const dailyBody = daily.length ? '<span class="pv-chips">' + daily.map(function (x) { return "<i>" + h(x) + "</i>"; }).join("") + "</span>" : skel(2);
    const files = S.papers.length ? '<span class="pv-chips">' + S.papers.slice(-3).reverse().map(function (p) { return "<i>" + ic("file", 11) + h(p.name || (p.kind === "voice" ? t("fdVoice") : t("fdPhoto"))) + "</i>"; }).join("") +
      (S.papers.length > 3 ? "<i>+" + (S.papers.length - 3) + "</i>" : "") + "</span>" : skel(1);
    const empty = !its.length && !shops.length && !M.storeReady(S) && !S.papers.length;
    return '<p class="pv-label">' + h(t("pvLabel")) + "</p>" +
      '<div class="pv-card' + (empty ? " is-empty" : "") + '">' + top +
        (empty ? '<p class="pv-empty">' + h(t("pvEmpty")) + "</p>" : "") +
        pvBlock("items", t("tProducts"), its.length, products) +
        pvBlock("people", t("tShops"), shops.length, people) +
        pvBlock("stock", t("pvStock"), P.stock.n, stock) +
        pvBlock("rules", t("pvDaily"), "", dailyBody) +
        pvBlock("papers", t("pvFiles"), S.papers.length, files) +
      "</div>";
  }

  function readyHTML() {
    const P = M.progress(CAT, S);
    const pct = Math.round(SECS.filter(function (s) { return P[s].done; }).length / SECS.length * 100);
    return '<div class="ready-h"><span>' + h(t("pvReady", { p: pct })) + "</span></div>" +
      '<div class="bar-p"><i style="width:' + pct + '%"></i></div>' +
      '<button class="cta wide" data-act="buildAsk">' + ic("send", 18) + h(t("fiBuild")) + "</button>" +
      '<p class="hint center">' + h(t("buildLater")) + "</p>" + buildState();
  }

  function sideHTML() {
    return '<div class="side-top" data-keep="side">' + previewHTML() + "</div>" + '<div class="side-foot" id="ready">' + readyHTML() + "</div>";
  }

  function refreshSide() {
    const el = document.getElementById("side");
    if (!el) return;
    const k = el.querySelector(".side-top"), top = k ? k.scrollTop : 0;
    el.innerHTML = sideHTML();
    const k2 = el.querySelector(".side-top");
    if (k2) k2.scrollTop = top;
  }
  function refreshReady() { const el = document.getElementById("ready"); if (el) el.innerHTML = readyHTML(); }
  function refreshRail() { const el = document.getElementById("rail"); if (el) el.innerHTML = railHTML(); }

  /* ──────────────────────────────────────────────────────── dialogs ── */

  function dlgWrap(title, body, foot, cls) {
    return '<div class="scrim" data-act="closeDlg"></div><div class="dlg' + (cls ? " " + cls : "") + '" role="dialog" aria-modal="true" aria-label="' + h(title.replace(/<[^>]+>/g, "")) + '">' +
      '<div class="dlg-h"><h2>' + title + '</h2><button class="icbtn" data-act="closeDlg" aria-label="' + h(t("close")) + '">' + ic("x", 18) + "</button></div>" +
      '<div class="dlg-b">' + body + "</div>" + (foot ? '<div class="dlg-f">' + foot + "</div>" : "") + "</div>";
  }
  const done = function () { return '<button class="cta" data-act="closeDlg">' + h(t("done")) + "</button>"; };

  const DIALOGS = {};

  DIALOGS.menu = function () {
    const row = function (act, icon, label, attrs, cls) { return '<button class="mrow' + (cls ? " " + cls : "") + '" data-act="' + act + '"' + (attrs || "") + ">" + ic(icon, 18) + "<span>" + h(label) + "</span></button>"; };
    return dlgWrap(h(t("menu")),
      row("lang", "langs", t("menuLang"), ' data-v="' + (S.lang === "en" ? "hi" : "en") + '"') +
      row("sampleAll", "sparkle", t("menuSample")) +
      '<a class="mrow" href="../">' + ic("mobile", 18) + "<span>" + h(t("menuPhone")) + "</span></a>" +
      row("confirm", "trash", t("menuFresh"), "", "is-bad") +
      '<p class="hint">' + h(CAT.note) + '</p><p class="hint">' + h(CAT.credit) + "</p>", "", "is-sm");
  };

  DIALOGS.confirm = function () {
    return dlgWrap(h(t("cfTitle")), '<div class="callout is-bad">' + ic("alert", 18) + "<p>" + h(t("cfFresh")) + "</p></div>",
      '<button class="btn" data-act="closeDlg">' + h(t("cancel")) + '</button><button class="cta is-bad" data-act="fresh">' + h(t("cfFreshYes")) + "</button>", "is-sm");
  };

  DIALOGS.sample = function (d) {
    const all = d.step === "all";
    const needItems = d.step === "stock" && !Object.keys(S.items).length;
    return dlgWrap(h(t("sampleTitle")),
      '<div class="callout">' + ic("sparkle", 18) + "<p>" + h(all ? t("sampleAllBody") : t("sampleBody", { step: secName(d.step) })) + (needItems ? " " + h(t("sampleItemsToo")) : "") + "</p></div>",
      '<button class="btn" data-act="closeDlg">' + h(t("cancel")) + '</button><button class="cta" data-act="sampleFill" data-step="' + d.step + '">' + ic("sparkle", 16) + h(t("sampleYes")) + "</button>", "is-sm");
  };

  function priceIn(p, key, val) {
    return inp(p + key, { kind: "num", mode: "decimal", ph: "₹", touch: p + "touched." + key, rerender: true, cls: "num" });
  }

  DIALOGS.item = function (d) {
    const id = d.id, it = M.item(CAT, S, id);
    if (!it) return dlgWrap("", "");
    const p = "items." + id + ".";
    const head = '<div class="item-h"><span class="pick-img lg">' + pickImg(it) + "</span><div><b>" + h(nm(it)) + "</b><small>" + h(packLabel(it)) + " · " + h(catName(it.cat)) + "</small>" +
      (it.loose || it.custom || it.touched.mrp ? "" : '<small class="warn">' + ic("alert", 13) + h(t("isCheckMrp")) + "</small>") + "</div></div>";
    const speed = field(t("isSpeed"), setChips(p + "speed", "str", [{ v: "fast", label: t("spFast") }, { v: "med", label: t("spMed") }, { v: "slow", label: t("spSlow") }]));
    const foot = '<button class="btn is-bad" data-act="removeItem" data-id="' + h(id) + '">' + ic("trash", 16) + h(t("isRemove")) + "</button>" + done();
    if (it.loose) {
      return dlgWrap(h(nm(it)), head + '<div class="two">' +
        field(t("isSellPer", { per: t("per_" + it.per) }), priceIn(p, "sell", it.sell), it.sell == null ? h(t("isLooseHint")) : "") +
        field(t("isBuyPer", { per: t("per_" + it.per) }), priceIn(p, "buy", it.buy)) + "</div>" + speed, foot);
    }
    return dlgWrap(h(nm(it)), head +
      '<div class="two">' +
        field(t("isMrp"), stepper(p + "mrp", { min: 0, base: it.mrp, touch: p + "touched.mrp" })) +
        field(t("isGst"), chips([0, 5, 18, 40].map(function (g) { return { v: g, label: g + "%" }; }), function (g) { return Number(g) === it.gst; }, 'data-act="set" data-path="' + p + 'gst" data-kind="num"')) +
        field(t("isSell"), priceIn(p, "sell", it.sell), [it.touched.sell || it.touched.buy || (S.companies[it.company] || {}).seen ? "" : h(t("isStdPrice")),
          it.unit === "case" ? h(t("isCaseTotal", { n: M.unitPrice(it, "sell") })) : ""].filter(Boolean).join(" ")) +
        field(t("isBuy"), priceIn(p, "buy", it.buy)) +
        field(t("isUnit"), setChips(p + "unit", "str", [{ v: "piece", label: t("uPiece") }, { v: "case", label: t("uCase") }])) +
        field(t("isCaseQty"), stepper(p + "caseQty", { min: 1, base: it.caseQty })) +
      "</div>" + speed +
      field(t("isBarcode"), inp(p + "barcode", { mode: "numeric", ph: it.barcode || "" })), foot, "is-md");
  };

  const PERS = ["kg", "dozen", "piece", "bunch", "litre", "pack"];
  const LOOSE_CATS = ["veg", "fruit", "eggs", "meat", "milk", "freshdairy", "grains", "dryfruit", "spice", "other"];

  DIALOGS.newItem = function (d) {
    const dr = d.draft, loose = !!dr.loose;
    const cats = (loose ? LOOSE_CATS : Object.keys(CAT.categories)).map(function (k) { return '<option value="' + k + '"' + (dr.cat === k ? " selected" : "") + ">" + CAT.categories[k].icon + " " + h(catName(k)) + "</option>"; }).join("");
    const kind = field(t("isKind"), setChips("@draft.loose", "bool", [{ v: "0", label: t("kPacked") }, { v: "1", label: t("kLoose") }]));
    const name = field(t("isName"), inp("@draft.name", { cls: "wide" }));
    const category = field(t("isCategory"), '<select class="in" data-bind="@draft.cat">' + cats + "</select>");
    const foot = '<button class="btn" data-act="closeDlg">' + h(t("cancel")) + '</button><button class="cta" data-act="saveItem">' + h(t("save")) + "</button>";
    if (loose) {
      return dlgWrap(h(t("iNew")), kind + name + field(t("isPer"), setChips("@draft.per", "str", PERS.map(function (x) { return { v: x, label: t("per_" + x) }; }))) +
        '<div class="two">' + field(t("isSellPer", { per: t("per_" + (dr.per || "kg")) }), inp("@draft.sell", { kind: "num", mode: "decimal", ph: "₹", cls: "num" })) + category + "</div>", foot, "is-md");
    }
    const cos = '<select class="in" data-bind="@draft.company" data-rerender><option value="">' + h(t("otherCompany")) + "</option>" + M.companyList(CAT, S).map(function (c) {
      return '<option value="' + h(c.id) + '"' + (dr.company === c.id ? " selected" : "") + ">" + h(c.short) + "</option>";
    }).join("") + "</select>";
    return dlgWrap(h(t("iNew")), kind + name +
      '<div class="two">' +
        field(t("isCompany"), cos + (dr.company ? "" : inp("@draft.companyName", { ph: t("cNewName"), cls: "mt" }))) +
        field(t("isPack"), inp("@draft.pack")) +
        field(t("isMrp"), inp("@draft.mrp", { kind: "num", mode: "decimal", ph: "₹", cls: "num" })) +
        field(t("isCaseQty"), stepper("@draft.caseQty", { min: 1 })) +
        category + (dr.barcode ? field(t("isBarcode"), '<p class="strong">' + h(dr.barcode) + "</p>") : "") +
      "</div>", foot, "is-md");
  };

  DIALOGS.person = function (d) {
    const p = S.people[d.id];
    if (!p) return dlgWrap("", "");
    const b = "people." + p.id + ".";
    let body = '<div class="two">' + field(t("pName"), inp(b + "name", { cls: "wide" })) + field(t("pPhone"), inp(b + "phone", { mode: "tel", max: 14 })) + "</div>";
    if (p.type === "shop") {
      body += field(t("shDays"), setChips(b + "days", "arr", M.DAYS.map(function (x) { return { v: x, label: dayName(x) }; }))) +
        '<div class="two">' +
          field(t("shArea"), inp(b + "area", { list: "areaListD", cls: "wide" }) + '<datalist id="areaListD">' + areas().map(function (a) { return '<option value="' + h(a) + '">'; }).join("") + "</datalist>") +
          field(t("shOwes"), inp(b + "owes", { kind: "num", mode: "numeric", ph: "₹", cls: "num" }), h(t("shOwesHint"))) + "</div>" +
        field(t("shPay"), setChips(b + "pay", "auto", [{ v: "cash", label: t("payCash") }, { v: 7, label: t("payDays", { n: 7 }) }, { v: 15, label: t("payDays", { n: 15 }) }, { v: 30, label: t("payDays", { n: 30 }) }])) +
        field(t("shRate"), setChips(b + "rate", "str", [{ v: "normal", label: t("rtNormal") }, { v: "wholesale", label: t("rtWholesale") }, { v: "special", label: t("rtSpecial") }])) +
        field(t("shHow"), setChips(b + "how", "str", [{ v: "salesman", label: t("howSalesman") }, { v: "phone", label: t("howPhone") }, { v: "whatsapp", label: t("howWhatsapp") }, { v: "self", label: t("howSelf") }])) +
        field(t("shBig"), setChips(b + "big", "bool", [{ v: "1", label: t("yes") }, { v: "0", label: t("no") }])) +
        field(t("shNote"), inp(b + "note", { area: true }));
    } else if (p.type === "staff") {
      body += field(t("pStaff"), setChips(b + "role", "str", roleOpts())) + field(t("stDays"), setChips(b + "days", "arr", M.DAYS.map(function (x) { return { v: x, label: dayName(x) }; }))) +
        '<div class="two">' + field(t("stVehicle"), inp(b + "vehicle", { upper: true, kind: "upper" })) + field(t("stCash"), setChips(b + "cash", "bool", [{ v: "1", label: t("yes") }, { v: "0", label: t("no") }])) + "</div>";
    } else if (p.type === "supplier") {
      body += field(t("suCompanies"), setChips(b + "companies", "arr", companyOpts())) +
        '<div class="two">' + field(t("suCode"), inp(b + "code")) + field(t("suGst"), inp(b + "gst", { upper: true, kind: "upper", max: 15 })) +
        field(t("suLead"), setChips(b + "lead", "num", [1, 2, 3, 7].map(function (n) { return { v: n, label: t("daysN", { n: n }) }; }))) +
        field(t("suOwe"), inp(b + "owe", { kind: "num", mode: "numeric", ph: "₹", cls: "num" }), h(t("shOwesHint"))) + "</div>";
    }
    body += field(t("pIsA"), setChips(b + "type", "str", [{ v: "shop", label: t("pShop") }, { v: "staff", label: t("pStaff") }, { v: "supplier", label: t("pSupplier") }, { v: "skip", label: t("pSkip") }]));
    return dlgWrap(h(p.name), body, '<button class="btn is-bad" data-act="delPerson" data-id="' + h(p.id) + '">' + ic("trash", 16) + h(t("pRemove")) + "</button>" + done(), "is-md");
  };

  DIALOGS.papers = function () {
    return dlgWrap(h(t("tPapers")),
      '<p class="sub">' + h(t("fdSub")) + "</p>" + dump(false) +
      (canRecord ? '<div class="row">' + (ui.rec ? '<button class="btn is-bad" data-act="recStop">' + ic("stop", 16) + h(t("paStop")) + ' · <span id="recT">' + h(t("paRecording", { s: 0 })) + "</span></button>"
        : '<button class="btn" data-act="recStart">' + ic("mic", 16) + h(t("paVoice")) + "</button>") + "</div>" : "") +
      (S.papers.length ? fileList(true) : ""), done(), "is-md");
  };

  DIALOGS.build = function () {
    return dlgWrap(h(t("title_finish")), '<p class="sub">' + h(t("fiReview")) + "</p>" + tilesHTML() + gapsHTML(true) + attach("finish") + buildState(),
      '<button class="btn" data-act="closeDlg">' + h(t("cancel")) + '</button><button class="cta" data-act="build"' + (ui.building ? " disabled" : "") + ">" + ic("store", 18) + h(t(ui.building ? "fiWorking" : "fiBuild")) + "</button>", "is-md");
  };

  /* After Build my store, a whole page, as on the phone: thank you, and the FoodBridge team will reach out. */
  function thanksView() {
    const last = S.lastBuild;
    const wait = last && (ui.outbox || []).find(function (b) { return b.id === last.id; });
    let mark, title, sub, act = "";
    if (!wait) { mark = '<span class="ty-mark">' + ic("check", 44) + "</span>"; title = t("tyTitle"); sub = t("tySub"); }
    else if (ui.sending) { mark = '<span class="ty-mark is-busy">' + ic("send", 38) + "</span>"; title = t("fiSending"); sub = t("fiWaitingSub", { n: wait.sent, total: wait.total }); }
    else {
      mark = '<span class="ty-mark is-wait">' + ic("clock", 40) + "</span>"; title = t("fiWaiting"); sub = t("fiWaitingWhy");
      act = '<button class="cta" data-act="sendNow">' + ic("repeat", 18) + h(t("fiSendNow")) + "</button>";
    }
    return '<main class="ty"><div class="ty-top">' + LOGO + "<span>FoodBridge</span></div>" + mark + "<h1>" + h(title) + '</h1><p class="sub">' + h(sub) + "</p>" + act + "</main>";
  }

  /* ───────────────────────────────────────────────────────── render ── */

  function focusKey(a) {
    if (!a || !/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return null;
    if (a.id) return "#" + a.id;
    if (a.dataset.bind) return '[data-bind="' + a.dataset.bind + '"]';
    if (a.dataset.count) return '[data-count="' + a.dataset.count + '"]';
    return null;
  }

  function render() {
    const a = document.activeElement;
    const fk = focusKey(a);
    const caret = fk && a.selectionStart != null ? [a.selectionStart, a.selectionEnd] : null;
    const loose = fk && a.id ? a.value : null;
    const keep = {};
    document.querySelectorAll("[data-keep]").forEach(function (el) { keep[el.dataset.keep] = el.scrollTop; });
    document.documentElement.lang = S.lang === "en" ? "en" : "hi";
    $app.className = "is-" + view;
    $app.innerHTML = view === "thanks" ? thanksView() : deskView();
    if (dlg && DIALOGS[dlg.kind]) {
      const still = ui.shownDlg === dlg ? " is-still" : "";
      ui.shownDlg = dlg;
      $dlg.innerHTML = DIALOGS[dlg.kind](dlg);
      if (still) $dlg.querySelectorAll(".dlg, .scrim").forEach(function (x) { x.classList.add("is-still"); });
    } else { $dlg.innerHTML = ""; ui.shownDlg = null; }
    document.body.classList.toggle("has-dlg", !!dlg);
    document.querySelectorAll("[data-keep]").forEach(function (el) { if (keep[el.dataset.keep] != null) el.scrollTop = keep[el.dataset.keep]; });
    if (fk) {
      const n = document.querySelector(fk);
      if (n) {
        if (loose != null) n.value = loose;
        n.focus({ preventScroll: true });
        if (caret) try { n.setSelectionRange(caret[0], caret[1]); } catch (e) { /* not a text box */ }
      }
    }
    hydrate();
  }

  function paperUrl(id) {
    if (urls[id]) return Promise.resolve(urls[id]);
    return DB.get(id).then(function (b) { if (!b) return ""; urls[id] = URL.createObjectURL(b); return urls[id]; }).catch(function () { return ""; });
  }
  function hydrate() {
    document.querySelectorAll("img[data-paper]:not([src])").forEach(function (img) { paperUrl(img.dataset.paper).then(function (u) { if (u) img.src = u; }); });
    document.querySelectorAll("audio[data-paper-audio]:not([src])").forEach(function (a) { paperUrl(a.dataset.paperAudio).then(function (u) { if (u) a.src = u; }); });
  }

  function hashFor() {
    if (view !== "desk") return "#" + view;
    return "#" + ui.sec + (ui.sec === "people" && ui.tab ? "/" + ui.tab : "");
  }
  function go(v, sec, tab) {
    view = v;
    if (sec) { if (sec !== ui.sec) { ui.sortedHere = []; ui.adding = false; } ui.sec = sec; }
    if (tab !== undefined) { ui.tab = tab; ui.sortedHere = []; }
    dlg = null;
    history.pushState({ v: view, sec: ui.sec, tab: ui.tab }, "", hashFor());
    render();
    const m = document.getElementById("main");
    if (m) m.scrollTop = 0;
  }
  function openDlg(d) { dlg = d; render(); const f = $dlg.querySelector("input:not([type=file]), textarea"); if (f && (d.kind === "newItem")) f.focus(); }
  function closeDlg() { stopRec(); dlg = null; render(); }

  window.addEventListener("popstate", function (e) {
    const st = e.state || {};
    dlg = null;
    view = st.v || "desk";
    if (st.sec) ui.sec = st.sec;
    ui.tab = st.tab || null;
    render();
  });

  /* ──────────────────────────────────────────────── files and voice ── */

  function compress(file) {
    return new Promise(function (res) {
      const img = new Image();
      const u = URL.createObjectURL(file);
      img.onload = function () {
        const k = Math.min(1, 1400 / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement("canvas");
        c.width = Math.round(img.naturalWidth * k);
        c.height = Math.round(img.naturalHeight * k);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(u);
        c.toBlob(function (b) { res(b || file); }, "image/jpeg", 0.72);
      };
      img.onerror = function () { URL.revokeObjectURL(u); res(file); };
      img.src = u;
    });
  }

  /* Anything dropped or chosen is kept as it came, for raw/ (outbox.js take). A drop lands on
     the section in view, or on Build while its dialog is open; a contacts file or a list is also
     read, and its people wait in Contacts to sort. */
  function dropStep() { return dlg && dlg.kind === "build" ? "finish" : view === "desk" ? ui.sec : "store"; }
  async function takeFiles(files, step) {
    step = step || dropStep();
    let n = 0, found = 0;
    const notes = [];
    for (const f of files) {
      if (!f.size) continue;
      let p;
      try { p = await OB.take(X, M, IMP, S, f, step); } catch (e) { notes.push("⚠ " + f.name); continue; }
      if (p.error) { notes.push(t("fxTooBig", { file: f.name })); continue; }
      n++;
      found += p.contacts || 0;
    }
    save();
    if (view === "desk" && found && step === "people") { ui.tab = "sort"; ui.sortedHere = []; history.replaceState({ v: view, sec: ui.sec, tab: ui.tab }, "", hashFor()); }
    render();
    if (n) notes.unshift(t("fxAdded", { n: n }) + (found ? " · " + t("fxContacts", { n: found }) : ""));
    if (notes.length) toast(notes.join(" · "));
  }

  async function recStart() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      const chunks = [], started = Date.now(), step = view === "desk" ? ui.sec : "store";
      ui.rec = { mr: mr, started: started };
      mr.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
      mr.onstop = async function () {
        stream.getTracks().forEach(function (tr) { tr.stop(); });
        clearInterval(ui.rec && ui.rec.tick);
        ui.rec = null;
        if (chunks.length) {
          const blob = new Blob(chunks, { type: mr.mimeType || "audio/webm" });
          const id = M.uid("vn");
          await DB.put(id, blob);
          S.papers.push({ id: id, kind: "voice", step: step, at: Date.now(), mime: blob.type });
          save();
          toast("✓ " + t("paSaved"));
        }
        render();
      };
      mr.start();
      ui.rec.tick = setInterval(function () {
        const el = document.getElementById("recT");
        if (el) el.textContent = t("paRecording", { s: Math.round((Date.now() - started) / 1000) });
      }, 500);
      render();
    } catch (e) { toast(t("paNoMic")); }
  }
  function stopRec() { if (ui.rec && ui.rec.mr.state !== "inactive") ui.rec.mr.stop(); }

  /* ──────────────────────────────────────────────────────── actions ── */

  function toggle(id, on) {
    if (on === undefined) on = !S.items[id];
    if (on && !S.items[id]) S.items[id] = { unit: "case" };
    if (!on) delete S.items[id];
  }

  function nextUnsorted(fromId) {
    const rows = sortList();
    const i = rows.findIndex(function (p) { return p.id === fromId; });
    const after = rows.slice(i + 1).find(function (p) { return !p.type; }) || rows.find(function (p) { return !p.type; });
    return after ? after.id : fromId;
  }
  function tagPerson(id, v) {
    const p = S.people[id];
    if (!p) return;
    p.type = p.type === v ? null : v;
    if (ui.sortedHere.indexOf(p.id) < 0) ui.sortedHere.push(p.id);
    ui.lastSorted.push(p.id);
    save();
    if (p.type) ui.sortFocus = nextUnsorted(p.id);
  }
  function showSortFocus() {
    const r = document.querySelector('tr[data-row="' + CSS.escape(ui.sortFocus || "") + '"]');
    if (r) r.scrollIntoView({ block: "nearest" });
  }

  function stockWrite(id, qty) {
    const it = M.item(CAT, S, id);
    if (!it) return;
    M.setCount(S, it, qty, M.lineUnit(S, it));
    save();
    const input = document.querySelector('[data-count="' + CSS.escape(id) + '"]');
    if (input) input.closest("tr").classList.toggle("done", qty != null);
    const c = document.getElementById("stCounted");
    if (c) c.textContent = stockCounted();
    refreshRail();
    refreshSide();
  }
  function stockAdd(id) {
    if (!S.items[id]) { S.items[id] = { unit: "case" }; M.syncCompanies(CAT, S); }   // counted in his godown, so he sells it
    const s = M.stockSel(CAT, S);
    if (s.indexOf(id) < 0) s.unshift(id);
    ui.stQ = ""; ui.stOpen = false;
    save();
    render();
    const f = document.querySelector('[data-count="' + CSS.escape(id) + '"]');
    if (f) f.focus();
  }

  const ACT = {
    next: function (el) {
      /* Shop needs the login mobile before it moves on: point at the box and say why. */
      if (el.dataset.from === "store" && !M.storeReady(S)) {
        ui.needMobile = true;
        render();
        const box = document.querySelector('[data-bind="store.mobile"]');
        if (box) box.focus();
        return;
      }
      const to = SECS[SECS.indexOf(el.dataset.from) + 1];
      if (to === "stock" && !M.stockSel(CAT, S).length && Object.keys(S.items).length) ACT.stAll();
      go("desk", to, to === "people" ? (M.unsorted(S).length ? "sort" : null) : undefined);
    },
    sec: function (el) {
      if (el.dataset.to === "papers") { openDlg({ kind: "papers" }); return; }
      if (el.dataset.to === "stock" && !M.stockSel(CAT, S).length && Object.keys(S.items).length) { ACT.stAll(); }
      go("desk", el.dataset.to, el.dataset.to === "people" ? el.dataset.tab || null : undefined);
    },
    lang: function (el) { S.lang = el.dataset.v; save(); if (dlg && dlg.kind === "menu") dlg = null; render(); },
    menu: function () { openDlg({ kind: "menu" }); },
    closeDlg: closeDlg,
    confirm: function () { openDlg({ kind: "confirm" }); },
    fresh: function () {
      S = M.blank();
      S.lang = "en";
      save();
      DB.clear().catch(function () {});
      S.startedAt = Date.now();
      go("desk", "store");
    },
    sampleAsk: function (el) { openDlg({ kind: "sample", step: el.dataset.step }); },
    sampleAll: function () { openDlg({ kind: "sample", step: "all" }); },
    sampleFill: function (el) {
      const step = el.dataset.step;
      (step === "all" ? M.SAMPLE_STEPS : [step]).forEach(function (s) { M.fillSample(CAT, S, s); });
      ui.needMobile = false;
      ui.sortedHere = [];
      if (step === "people" || step === "all") ui.tab = null;
      syncSave();
      dlg = null;
      if (step === "all" && view === "desk" && ui.sec === "store") go("desk", "items");
      else render();
      toast("✓ " + t("sampleDone"));
    },
    papers: function () { openDlg({ kind: "papers" }); },
    recStart: recStart,
    recStop: stopRec,
    delPaper: function (el) {
      OB.drop(M, S, el.dataset.id);   // and the contacts it brought, if still unsorted
      save();
      render();
    },

    set: function (el) {
      const path = el.dataset.path, kind = el.dataset.kind || "str", raw = el.dataset.v;
      if (kind === "flip") setPath(path, !getPath(path));
      else if (kind === "arr") {
        const arr = (getPath(path) || []).slice();
        const i = arr.map(String).indexOf(raw);
        if (i >= 0) arr.splice(i, 1); else arr.push(raw);
        if (/\.days$/.test(path)) arr.sort(function (a, b) { return M.DAYS.indexOf(a) - M.DAYS.indexOf(b); });
        setPath(path, arr);
      } else setPath(path, kind === "bool" ? raw === "1" : kind === "num" ? Number(raw) : kind === "auto" ? (/^\d+$/.test(raw) ? Number(raw) : raw) : raw);
      if (path[0] !== "@") save();
      render();
      if (raw === "other") { const box = document.querySelector('[data-bind="' + (path === "store.type" ? "store.typeOther" : path + "Other") + '"]'); if (box) box.focus(); }
    },
    step: function (el) {
      const path = el.dataset.path, d = Number(el.dataset.d);
      const min = el.dataset.min != null ? Number(el.dataset.min) : 0;
      const cur = getPath(path), base = el.dataset.base != null ? Number(el.dataset.base) : null;
      let v = cur == null || cur === "" ? (base != null ? base + d : d > 0 ? d : 0) : Number(cur) + d;
      v = Math.max(min, Math.round(v * 100) / 100);
      setPath(path, v);
      if (el.dataset.touch) setPath(el.dataset.touch, true);
      if (path[0] !== "@") save();
      render();
    },
    skip: function (el) { S.skipped[el.dataset.step] = true; save(); render(); },

    /* Products */
    by: function (el) { ui.by = el.dataset.v; ui.group = null; ui.itemsQ = ""; render(); },
    group: function (el) { ui.group = el.dataset.id; ui.itemsQ = ""; render(); const m = document.getElementById("grid"); if (m) m.scrollIntoView({ block: "nearest" }); },
    pick: function (el, e) {
      const id = el.dataset.id;
      const inGrid = el.classList.contains("pick");
      if (inGrid && e && e.shiftKey && ui.lastPick && ui.shown.indexOf(ui.lastPick) >= 0) {
        const a = ui.shown.indexOf(ui.lastPick), b = ui.shown.indexOf(id);
        const on = !S.items[id];
        const range = ui.shown.slice(Math.min(a, b), Math.max(a, b) + 1);
        range.forEach(function (x) { toggle(x, on); });
        syncSave();
        afterPick(range);
      } else {
        toggle(id);
        syncSave();
        afterPick([id]);
      }
      if (inGrid) ui.lastPick = id;
    },
    pickAll: function () {
      const ids = shownIds();
      const all = ids.every(function (id) { return S.items[id]; });
      ids.forEach(function (id) { toggle(id, !all); });
      syncSave();
      afterPick(ids);
    },
    item: function (el) { openDlg({ kind: "item", id: el.dataset.id }); },
    removeItem: function (el) { delete S.items[el.dataset.id]; syncSave(); closeDlg(); },
    newItem: function (el) {
      const q = view === "desk" && ui.sec === "stock" ? ui.stQ : ui.itemsQ;
      const code = /^\d{8,14}$/.test(q.trim()) ? q.trim() : "";
      openDlg({ kind: "newItem", toCount: !!(el && el.dataset.count), draft: { name: code ? "" : q.trim(), company: "", cat: "other", caseQty: 1, loose: false, per: "kg", barcode: code } });
    },
    saveItem: function () {
      const d = dlg.draft;
      if (!(d.name || "").trim()) { toast(t("isName")); const f = $dlg.querySelector('[data-bind="@draft.name"]'); if (f) f.focus(); return; }
      if (!d.company && (d.companyName || "").trim()) {
        const cid = M.uid("co");
        S.customCompanies.push({ id: cid, name: d.companyName.trim(), short: d.companyName.trim(), color: "#6B7280" });
        d.company = cid;
      }
      const id = M.uid("new");
      if (d.loose) {
        S.customItems[id] = { name: d.name.trim(), brand: "", company: "", pack: d.per || "kg", per: d.per || "kg", loose: true, mrp: null, caseQty: 1, cat: d.cat || "other", photo: null, barcode: "" };
        S.items[id] = { unit: "piece", sell: d.sell != null ? d.sell : undefined, touched: d.sell != null ? { sell: true } : {} };
      } else {
        S.customItems[id] = { name: d.name.trim(), brand: "", company: d.company || "", pack: d.pack || "", mrp: d.mrp || null, caseQty: d.caseQty || 1, cat: d.cat || "other", photo: null, barcode: d.barcode || "" };
        S.items[id] = { unit: "case", barcode: d.barcode || "", touched: { mrp: true } };
      }
      if (dlg.toCount) { M.stockSel(CAT, S).unshift(id); ui.stQ = ""; ui.stOpen = false; }
      syncSave();
      dlg = null;
      render();
      toast("✓ " + d.name.trim());
    },

    /* Contacts */
    tab: function (el) { ui.tab = el.dataset.v; ui.sortedHere = []; history.replaceState({ v: view, sec: ui.sec, tab: ui.tab }, "", hashFor()); render(); },
    sort: function (el) { tagPerson(el.dataset.id, el.dataset.v); render(); },
    sortAll: function () {
      const ids = M.unsorted(S).map(function (p) { return p.id; });
      ids.forEach(function (id) { S.people[id].type = "shop"; });
      ui.lastSorted.push(ids);
      save();
      ui.tab = "shop";
      ui.sortedHere = [];
      history.replaceState({ v: view, sec: ui.sec, tab: ui.tab }, "", hashFor());
      render();
      toast("✓ " + t("pSortedAll", { n: ids.length }));
    },
    undoSort: function () {
      const last = ui.lastSorted.pop();
      [].concat(last || []).forEach(function (id) { if (S.people[id]) S.people[id].type = null; });
      if (last) { save(); if (Array.isArray(last)) ui.tab = "sort"; else ui.sortFocus = last; }
      render();
      showSortFocus();
    },
    person: function (el) { openDlg({ kind: "person", id: el.dataset.id }); },
    delPerson: function (el) { M.removePerson(S, el.dataset.id); save(); closeDlg(); },
    addOpen: function () {
      if (view === "desk" && ui.sec !== "people") { ui.sec = "people"; }
      ui.adding = true;
      render();
      const f = document.getElementById("addName");
      if (f) f.focus();
    },
    addClose: function () { ui.adding = false; render(); },
    addPerson: function () {
      const n = document.getElementById("addName"), p = document.getElementById("addPhone"), ty = document.getElementById("addType");
      const name = (n.value || "").trim(), phone = (p.value || "").trim();
      if (!name && !phone) { n.focus(); return; }
      const r = M.addPerson(S, { name: name || phone, phone: M.phone10(phone) || phone, type: ty.value || null, src: "typed" });
      save();
      if (r.dup) toast(t("pDup", { n: 1 }));
      if (!r.dup && ty.value) ui.tab = ty.value;
      const keepType = ty.value;
      render();
      const n2 = document.getElementById("addName"), t2 = document.getElementById("addType");
      if (t2) t2.value = keepType;
      if (n2) n2.focus();
    },
    flipCash: function (el) { const p = S.people[el.dataset.id]; if (p) { p.cash = !p.cash; save(); } },
    sameArea: function (el) {
      const days = el.dataset.days.split(",");
      M.peopleOf(S, "shop").forEach(function (p) { if (p.area === el.dataset.area && !(p.days || []).length) p.days = days.slice(); });
      save();
      render();
    },
    day: function (el) {
      const p = S.people[el.dataset.pid];
      if (!p) return;
      const d = el.dataset.day, days = (p.days || []).slice(), i = days.indexOf(d);
      if (i >= 0) days.splice(i, 1); else days.push(d);
      p.days = days.sort(function (a, b) { return M.DAYS.indexOf(a) - M.DAYS.indexOf(b); });
      save();
      render();
    },

    /* Stock */
    stAll: function () {
      const s = M.stockSel(CAT, S);
      stockMissing().forEach(function (id) { s.push(id); });
      save();
      if (view === "desk" && ui.sec === "stock") render();
    },
    stAdd: function (el) { stockAdd(el.dataset.id); },
    stRemove: function (el) {
      const it = M.item(CAT, S, el.dataset.id);
      if (it) M.setCount(S, it, null, M.lineUnit(S, it));
      S.stockSel = M.stockSel(CAT, S).filter(function (x) { return x !== el.dataset.id; });
      save();
      render();
    },

    /* Build */
    buildAsk: function () { openDlg({ kind: "build" }); },
    build: async function () {
      if (ui.building) return;
      ui.building = true;
      render();
      try {
        const b = await OB.make(CAT, X, S);
        ui.outbox = (ui.outbox || []).concat([b]);
        S.lastBuild = { id: b.id, at: b.at };
        save();
        ui.building = false;
        go("thanks");
        sendAll();
      } catch (e) {
        ui.building = false;
        render();
        toast("⚠ " + e.message);
      }
    },
    sendNow: function () { sendAll(); render(); },
  };

  /* ───────────────────────────────────────────────────────── events ── */

  document.addEventListener("click", function (e) {
    const el = e.target.closest("[data-act]");
    if (!el) return;
    /* A day cell is set on mousedown (so a drag paints); a click from the keyboard still sets it. */
    if (el.dataset.day != null) { if (e.detail === 0) ACT.day(el); return; }
    const a = ACT[el.dataset.act];
    if (!a) return;
    if (el.type !== "checkbox") e.preventDefault();
    a(el, e);
  });

  /* Painting days: press on a day, drag across the row or down the column, let go. */
  document.addEventListener("mousedown", function (e) {
    const el = e.target.closest("[data-day]");
    if (!el || e.button !== 0) return;
    e.preventDefault();
    const p = S.people[el.dataset.pid];
    if (!p) return;
    ui.paint = { on: (p.days || []).indexOf(el.dataset.day) < 0 };
    paintDay(el);
  });
  document.addEventListener("mouseover", function (e) {
    if (!ui.paint) return;
    const el = e.target.closest("[data-day]");
    if (el) paintDay(el);
  });
  window.addEventListener("mouseup", function () {
    if (!ui.paint) return;
    ui.paint = null;
    save();
    render();
  });
  function paintDay(el) {
    const p = S.people[el.dataset.pid];
    if (!p) return;
    const d = el.dataset.day, days = (p.days || []).filter(function (x) { return x !== d; });
    if (ui.paint.on) days.push(d);
    p.days = days.sort(function (a, b) { return M.DAYS.indexOf(a) - M.DAYS.indexOf(b); });
    el.classList.toggle("on", ui.paint.on);
    el.setAttribute("aria-pressed", ui.paint.on);
  }

  document.addEventListener("input", function (e) {
    const el = e.target;
    if (el.dataset.bind) {
      let v = el.value;
      const kind = el.dataset.kind;
      if (kind === "num") { v = v.replace(/[^\d.]/g, ""); v = v === "" ? null : Number(v); }
      if (kind === "upper") v = v.toUpperCase();
      if (el.tagName === "SELECT" && kind === "auto") v = v === "" ? null : /^\d+$/.test(v) ? Number(v) : v;
      setPath(el.dataset.bind, v);
      if (el.dataset.touch) setPath(el.dataset.touch, true);
      if (el.dataset.bind[0] === "@") return;
      save();
      if (el.dataset.bind === "store.mobile") syncMobile();
      refreshRail();
      refreshReady();
      if (/^items\..*\.sell$/.test(el.dataset.bind)) { const r = el.closest(".pr-r"); if (r) r.classList.toggle("is-need", v == null); }
      if (/\.area$/.test(el.dataset.bind) && v) { /* the area list grows as he types new ones; kept on change */ }
    } else if (el.dataset.q) {
      ui[el.dataset.q] = el.value;
      if (el.dataset.q === "itemsQ") {
        document.getElementById("grid").innerHTML = gridHTML();
        document.getElementById("pickbar").innerHTML = pickBarHTML(shownIds());
        const g = document.getElementById("groups");
        if (g) g.innerHTML = groupsHTML();
        hydrate();
      } else if (el.dataset.q === "peopleQ") {
        document.getElementById("plist").innerHTML = peopleBody(peopleTab());
      }
    } else if (el.id === "stQ") {
      ui.stQ = el.value;
      ui.stOpen = true;
      document.getElementById("stDrop").innerHTML = stockDrop();
      hydrate();
    } else if (el.dataset.count != null) {
      const raw = el.value.replace(/\D/g, "");
      if (el.value !== raw) el.value = raw;
      stockWrite(el.dataset.count, raw === "" ? null : parseInt(raw, 10));
    }
  });

  document.addEventListener("change", function (e) {
    const el = e.target;
    if (el.dataset.files != null || el.dataset.fx) { if (el.files.length) takeFiles(Array.from(el.files), el.dataset.fx); el.value = ""; return; }
    if (el.dataset.unit != null) {
      const it = M.item(CAT, S, el.dataset.unit);
      if (!it) return;
      const c = M.countOf(it);
      M.setCount(S, it, c ? c.qty : null, el.value);
      save();
      render();
      return;
    }
    if (el.dataset.bind) {
      if (/\.area$/.test(el.dataset.bind) && el.value.trim() && S.store.areas.indexOf(el.value.trim()) < 0) { S.store.areas.push(el.value.trim()); save(); }
      if (el.dataset.rerender !== undefined || el.tagName === "SELECT" || /\.area$/.test(el.dataset.bind)) setTimeout(render, 0);
    }
  });

  function syncMobile() {
    const ok = M.storeReady(S);
    if (ok) ui.needMobile = false;
    const tag = document.querySelector(".fc-row.is-mob .req");
    if (tag) { tag.classList.toggle("is-ok", ok); tag.innerHTML = ok ? ic("check", 14) : h(t("required")); }
    const fc = document.querySelector(".fc");
    if (fc) fc.classList.toggle("is-bad", !!ui.needMobile && !ok);
    const err = document.querySelector(".err");
    if (err) err.hidden = !ui.needMobile || ok;
  }

  document.addEventListener("focusin", function (e) {
    if (e.target.id === "stQ" && ui.stQ.trim() && !ui.stOpen) { ui.stOpen = true; document.getElementById("stDrop").innerHTML = stockDrop(); hydrate(); }
  });
  document.addEventListener("focusout", function (e) {
    if (e.target.id !== "stQ") return;
    setTimeout(function () {
      if (document.activeElement && document.activeElement.id === "stQ") return;
      ui.stOpen = false;
      const d = document.getElementById("stDrop");
      if (d) d.innerHTML = "";
    }, 180);
  });

  /* Arrow keys across the product grid: the row above or below is one column count away. */
  function gridMove(el, key) {
    const cards = Array.from(document.querySelectorAll("#grid .pick"));
    const i = cards.indexOf(el);
    if (i < 0) return;
    const top = cards[0].offsetTop;
    let cols = cards.findIndex(function (c) { return c.offsetTop !== top; });
    if (cols < 0) cols = cards.length;
    const j = key === "ArrowRight" ? i + 1 : key === "ArrowLeft" ? i - 1 : key === "ArrowDown" ? i + cols : i - cols;
    if (cards[j]) { cards[j].focus(); cards[j].scrollIntoView({ block: "nearest" }); }
  }

  document.addEventListener("keydown", function (e) {
    const tg = e.target;
    if (e.key === "Escape") {
      if (dlg) { closeDlg(); return; }
      if (tg.id === "stQ") { ui.stQ = ""; ui.stOpen = false; tg.value = ""; document.getElementById("stDrop").innerHTML = ""; return; }
      if (ui.adding && tg.closest && tg.closest(".addrow")) { ACT.addClose(); return; }
    }
    if (dlg) return;
    /* Enter in the boxes that act. */
    if (e.key === "Enter") {
      if (tg.id === "addName" || tg.id === "addPhone") { e.preventDefault(); ACT.addPerson(); return; }
      if (tg.id === "itemsQ") {
        /* A USB barcode scanner types the code and presses Enter. */
        const code = tg.value.trim();
        if (/^\d{8,14}$/.test(code)) {
          e.preventDefault();
          const id = M.findBarcode(CAT, S, code);
          if (id) { toggle(id, true); syncSave(); ui.itemsQ = ""; render(); toast(t("scFound", { name: M.item(CAT, S, id).name })); }
          else { toast(t("scNew")); ACT.newItem(); }
        }
        return;
      }
      if (tg.id === "stQ") {
        e.preventDefault();
        const code = tg.value.trim();
        const hit = /^\d{8,14}$/.test(code) ? M.findBarcode(CAT, S, code) : null;
        const first = hit || (document.querySelector("#stDrop .drop-r") || {}).dataset && document.querySelector("#stDrop .drop-r").dataset.id;
        if (first) stockAdd(first);
        return;
      }
    }
    /* Down the count sheet: Enter or ↓ to the next box, ↑ back. */
    if (tg.dataset && tg.dataset.count != null && (e.key === "Enter" || e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      const boxes = Array.from(document.querySelectorAll("[data-count]"));
      const j = boxes.indexOf(tg) + (e.key === "ArrowUp" ? -1 : 1);
      if (boxes[j]) { boxes[j].focus(); boxes[j].select(); }
      return;
    }
    if (tg.classList && tg.classList.contains("pick") && /^Arrow/.test(e.key)) { e.preventDefault(); gridMove(tg, e.key); return; }
    if (typing(tg) || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === "/" && view === "desk") {
      const box = document.getElementById(ui.sec === "items" ? "itemsQ" : ui.sec === "people" ? "peopleQ" : ui.sec === "stock" ? "stQ" : "");
      if (box) { e.preventDefault(); box.focus(); box.select(); }
      return;
    }
    /* Sorting contacts from the keyboard. */
    if (view === "desk" && ui.sec === "people" && peopleTab() === "sort" && ui.sortFocus) {
      const map = { 1: "shop", 2: "staff", 3: "supplier", 0: "skip" };
      const rows = sortList();
      const i = rows.findIndex(function (p) { return p.id === ui.sortFocus; });
      if (map[e.key]) { e.preventDefault(); tagPerson(ui.sortFocus, map[e.key]); render(); showSortFocus(); return; }
      if (e.key === "Enter") { const p = S.people[ui.sortFocus], g = p && M.guessType(p.name); if (g && !p.type) { e.preventDefault(); tagPerson(p.id, g); render(); showSortFocus(); } return; }
      if ((e.key === "ArrowDown" || e.key === "j") && rows[i + 1]) { e.preventDefault(); ui.sortFocus = rows[i + 1].id; render(); showSortFocus(); return; }
      if ((e.key === "ArrowUp" || e.key === "k") && rows[i - 1]) { e.preventDefault(); ui.sortFocus = rows[i - 1].id; render(); showSortFocus(); return; }
      if (e.key === "u" || e.key === "U") { e.preventDefault(); ACT.undoSort(); return; }
    }
  });

  /* Drop files anywhere: the whole window takes them. */
  function hasFiles(e) { return e.dataTransfer && Array.from(e.dataTransfer.types || []).indexOf("Files") >= 0; }
  /* On the files step its own drop area lights up; elsewhere the whole window says what it takes. */
  function dragging(on) {
    document.body.classList.toggle("is-dragging", on);
    $drop.classList.toggle("show", on && view !== "thanks");
  }
  window.addEventListener("dragenter", function (e) { if (!hasFiles(e)) return; e.preventDefault(); ui.dragN++; dragging(true); });
  window.addEventListener("dragover", function (e) { if (hasFiles(e)) e.preventDefault(); });
  window.addEventListener("dragleave", function (e) { if (!hasFiles(e)) return; ui.dragN = Math.max(0, ui.dragN - 1); if (!ui.dragN) dragging(false); });
  window.addEventListener("drop", function (e) {
    if (!hasFiles(e)) return;
    e.preventDefault();
    ui.dragN = 0;
    dragging(false);
    if (view === "thanks") return;
    takeFiles(Array.from(e.dataTransfer.files || []));
  });

  /* ─────────────────────────────────────────────────────────── start ── */

  $drop.innerHTML = '<div class="drop-in">' + ic("folder", 36) + "<b></b><small></small></div>";
  const dropWords = function () { $drop.querySelector("b").textContent = t("dropHere"); $drop.querySelector("small").textContent = t("dropSub"); };
  dropWords();
  window.addEventListener("dragenter", dropWords);

  M.tidy(CAT, S);
  const hash = location.hash.slice(1).split("/");
  /* One layout from the first second: a first visit opens the desk on the shop; a return, on the
     first section still to do. (Until 1 Oct 2026 a separate start screen came first.) */
  if (!S.startedAt) S.startedAt = Date.now();   // saved with his first answer
  if (hash[0] === "thanks" && S.lastBuild) view = "thanks";
  else {
    view = "desk";
    ui.sec = SECS.indexOf(hash[0]) >= 0 ? hash[0] : SECS.find(function (s) { return !M.progress(CAT, S)[s].done; }) || "items";
    if (ui.sec === "people" && hash[1]) ui.tab = hash[1];
  }
  history.replaceState({ v: view, sec: ui.sec, tab: ui.tab }, "", hashFor());
  render();
  OUTBOX.all().then(function (list) { ui.outbox = list || []; if (ui.outbox.length) sendAll(); else render(); }).catch(function () { ui.outbox = []; });
})();
