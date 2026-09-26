/* Store Builder · the screens.

   Built for someone who reads a little and taps a lot:
   - one question per screen, spoken aloud on 🔊, in Hindi or English;
   - choose, don't type: chips, big + / − buttons, phone contacts, a catalogue
     of real pack photos;
   - every screen can always go on ("Next" is never disabled), and home shows
     what is done;
   - everything saves by itself, on this phone (localStorage for answers,
     IndexedDB for photos and voice notes). Nothing is sent anywhere until
     the owner saves or shares the file himself.
   The phone's own back button works: every screen and every sheet is a
   history entry. */

(function () {
  "use strict";

  const CAT = window.SB_CATALOGUE, M = window.SB_MODEL, X = window.SB_EXPORT, I18N = window.SB_I18N;
  const KEY = "fb.storebuilder.v1";
  const STEPS = M.STEPS;
  const ic = window.SB_ICON;
  /* companies and rates were steps until 26 Sep 2026; old photos still name them. */
  const ICON = { store: "store", companies: "building", rates: "rupee", items: "box", people: "contacts", shops: "users", staff: "staff", suppliers: "truck", usual: "repeat", stock: "warehouse", rules: "rules", finish: "send" };
  const $app = document.getElementById("app");
  const $sheet = document.getElementById("sheet");
  const $toast = document.getElementById("toast");

  /* The phone's contact picker (search, tick many, Add -- as WhatsApp's
     "share contact"). Android Chrome has it on. iPhone Safari has it too, but
     off until "Contact Picker API" is turned on in Safari's Feature Flags; no
     web page can reach iPhone contacts any other way. Checked on each tap, so
     turning the flag on needs no reload. */
  function canPick() { return !!(navigator.contacts && navigator.contacts.select); }
  function phoneKind() {
    const ua = navigator.userAgent || "";
    if (/iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) return "ios";
    if (/Android/.test(ua)) return "android";
    return "other";
  }
  const canScan = "BarcodeDetector" in window && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  const canSpeak = "speechSynthesis" in window;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const canRecord = "MediaRecorder" in window && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  let canShareFiles = false;
  try { canShareFiles = !!(navigator.canShare && navigator.canShare({ files: [new File(["x"], "x.txt", { type: "text/plain" })] })); } catch (e) { canShareFiles = false; }

  let S = load();
  let view = "welcome";
  let sheet = null;
  const ui = { peopleTab: null, peopleQ: "", pickBy: "company", sheetStack: [], itemsQ: "", compQ: "", saQ: "", saOpen: false, saAdding: false, saConfirm: false, saFlash: null, lastSorted: [], photoFor: null, rec: null, stream: null, scanTimer: null };
  const urls = {};

  /* ─────────────────────────────────────────────────────── storage ── */

  function load() {
    try { return M.migrate(JSON.parse(localStorage.getItem(KEY))); } catch (e) { return M.blank(); }
  }
  function save() {
    S.updatedAt = Date.now();
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast("⚠ " + e.message); }
  }

  const DB = (function () {
    let opening = null;
    function open() {
      if (!opening) opening = new Promise(function (res, rej) {
        const r = indexedDB.open("fb-storebuilder", 1);
        r.onupgradeneeded = function () { r.result.createObjectStore("blobs"); };
        r.onsuccess = function () { res(r.result); };
        r.onerror = function () { rej(r.error); };
      });
      return opening;
    }
    function run(mode, fn) {
      return open().then(function (db) {
        return new Promise(function (res, rej) {
          const tx = db.transaction("blobs", mode);
          const req = fn(tx.objectStore("blobs"));
          tx.oncomplete = function () { res(req ? req.result : undefined); };
          tx.onerror = function () { rej(tx.error); };
        });
      });
    }
    return {
      put: function (id, blob) { return run("readwrite", function (st) { return st.put(blob, id); }); },
      get: function (id) { return run("readonly", function (st) { return st.get(id); }); },
      del: function (id) { return run("readwrite", function (st) { return st.delete(id); }); },
      clear: function () { return run("readwrite", function (st) { return st.clear(); }); },
    };
  })();

  /* ─────────────────────────────────────────────────────── helpers ── */

  function t(k, v) {
    const L = I18N[S.lang || "hi"] || I18N.en;
    if (v && v.n === 1 && L[k + "_1"] != null) k = k + "_1";   // "1 shop", not "1 shops"
    let s = L[k] != null ? L[k] : I18N.en[k] != null ? I18N.en[k] : k;
    if (v) Object.keys(v).forEach(function (x) { s = s.split("{" + x + "}").join(v[x]); });
    return s;
  }
  function h(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
  }
  function rupee(n) { return n == null || n === "" || isNaN(n) ? "" : "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 }); }
  function catName(c) { const x = CAT.categories[c] || CAT.categories.other; return S.lang === "en" ? x.en : x.hi; }
  function dayName(d) { return t("d_" + d); }
  function dayList(days) { return M.DAYS.filter(function (d) { return (days || []).indexOf(d) >= 0; }).map(dayName).join(", "); }

  function rootOf(path) { return path[0] === "@" ? [sheet, path.slice(1)] : [S, path]; }
  function getPath(path) {
    const r = rootOf(path);
    return r[1].split(".").reduce(function (o, k) { return o == null ? undefined : o[k]; }, r[0]);
  }
  function setPath(path, v) {
    const r = rootOf(path);
    const ks = r[1].split(".");
    let o = r[0];
    for (let i = 0; i < ks.length - 1; i++) {
      if (o[ks[i]] == null || typeof o[ks[i]] !== "object") o[ks[i]] = {};
      o = o[ks[i]];
    }
    const last = ks[ks.length - 1];
    if (v === null || v === undefined) delete o[last]; else o[last] = v;
  }

  function toast(msg) {
    $toast.textContent = msg;
    $toast.classList.add("show");
    clearTimeout(toast.t);
    toast.t = setTimeout(function () { $toast.classList.remove("show"); }, 2600);
  }

  function speak(text) {
    if (!canSpeak) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = S.lang === "en" ? "en-IN" : "hi-IN";
    const v = speechSynthesis.getVoices().find(function (x) { return x.lang === u.lang; });
    if (v) u.voice = v;
    u.rate = 0.95;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  }

  /* ─────────────────────────────────────────────── bits of screen ──
     26 Sep 2026: the onboarding flow's clothes (modules/foodbridge-onboarding):
     a back arrow and segmented progress, a bold title with the question
     under it, hairline rows, line icons, one green button pinned at the
     bottom. What each screen asks and does is unchanged. */

  const LOGO = '<img class="sb-logo" src="../assets/foodbridge-mark.png" alt="FoodBridge" width="28" height="28">';

  function chips(opts, isOn, attrs, cls) {
    return '<div class="chips ' + (cls || "") + '">' + opts.map(function (o) {
      return '<button type="button" class="chip' + (isOn(o.v) ? " on" : "") + '" ' + attrs + ' data-v="' + h(o.v) + '">' +
        (o.icon ? ic(o.icon, 18) : "") + "<span>" + h(o.label) + "</span></button>";
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
  function yesNo(path) {
    return setChips(path, "bool", [{ v: "1", label: t("yes"), icon: "thumb" }, { v: "0", label: t("no"), icon: "hand" }], "two");
  }
  function dayChips(path) {
    return setChips(path, "arr", M.DAYS.map(function (d) { return { v: d, label: dayName(d) }; }), "days");
  }

  function input(path, o) {
    o = o || {};
    const v = getPath(path);
    const tag = o.area ? "textarea" : "input";
    const attrs = ' data-bind="' + h(path) + '"' + (o.kind ? ' data-kind="' + o.kind + '"' : "") + (o.touch ? ' data-touch="' + h(o.touch) + '"' : "") +
      (o.rerender ? " data-rerender" : "") + (o.ph ? ' placeholder="' + h(o.ph) + '"' : "") + (o.mode ? ' inputmode="' + o.mode + '"' : "") +
      (o.type ? ' type="' + o.type + '"' : tag === "input" ? ' type="text"' : "") + (o.max ? ' maxlength="' + o.max + '"' : "") +
      (o.upper ? ' autocapitalize="characters" class="upper"' : "") + ' autocomplete="off"';
    const el = tag === "textarea" ? "<textarea rows=\"2\"" + attrs + ">" + h(v) + "</textarea>" : "<input" + attrs + ' value="' + h(v == null ? "" : v) + '">';
    const mic = o.mic ? micBtn(path) : "";
    return '<div class="inp' + (o.area ? " is-area" : "") + '">' + el + mic + "</div>";
  }

  function micBtn(path, cls) {
    return SR && !ui.micOff ? '<button type="button" class="sb-icbtn' + (cls ? " " + cls : "") + '" data-act="dictate" data-path="' + h(path) + '" aria-label="' + h(t("micSpeak")) + '" aria-pressed="false">' + ic("mic") + "</button>" : "";
  }

  function field(icon, label, inner, hint) {
    inner = inner.replace(/<(input|textarea|select) (?![^>]*aria-label)/, '<$1 aria-label="' + h(label) + '" ');
    return '<section class="sb-field"><label class="sb-label">' + ic(icon, 18) + "<span>" + h(label) + "</span></label>" + inner +
      (hint ? '<p class="sb-hint">' + hint + "</p>" : "") + "</section>";
  }

  function stepper(path, o) {
    o = o || {};
    const own = getPath(path);
    const v = own == null && o.base != null ? o.base : own;
    const a = ' data-path="' + h(path) + '"' + (o.base != null ? ' data-base="' + o.base + '"' : "") + (o.min != null ? ' data-min="' + o.min + '"' : "") + (o.max != null ? ' data-max="' + o.max + '"' : "") +
      (o.zero ? ' data-zero="del"' : "") + (o.touch ? ' data-touch="' + h(o.touch) + '"' : "");
    return '<div class="stepper' + (o.small ? " small" : "") + '">' +
      '<button type="button" data-act="step" data-d="-' + (o.by || 1) + '"' + a + ' aria-label="−">' + ic("minus", 18) + "</button>" +
      '<input data-bind="' + h(path) + '" data-kind="num" data-rerender inputmode="decimal" value="' + h(v == null ? "" : v) + '" placeholder="–"' + (o.touch ? ' data-touch="' + h(o.touch) + '"' : "") + ">" +
      '<button type="button" data-act="step" data-d="' + (o.by || 1) + '"' + a + ' aria-label="+">' + ic("plus", 18) + "</button></div>";
  }

  function thumb(id) { return '<img class="thumb" data-paper="' + h(id) + '" alt="">'; }

  /* Initials in a grey disc, as the onboarding's staff list shows people. */
  function avatar(name) {
    const w = String(name || "").trim().split(/\s+/).filter(Boolean);
    const s = w.length > 1 ? w[0][0] + w[w.length - 1][0] : (w[0] || "?").slice(0, 2);
    return '<span class="avatar">' + h(s.toUpperCase()) + "</span>";
  }

  function search(key, ph) {
    return '<label class="sb-search">' + ic("search", 18) + '<input type="search" data-search="' + key + '" value="' + h(ui[key]) + '" placeholder="' + h(ph) + '" aria-label="' + h(ph) + '"></label>';
  }

  function empty(text, act, to, label, icon) {
    return '<div class="empty"><p>' + h(text) + '</p><button class="sb-btn is-alt" data-act="' + act + '"' + (to ? ' data-to="' + to + '"' : "") + ">" +
      (icon ? ic(icon, 18) : "") + h(label) + "</button></div>";
  }

  function frame(step, body, foot) {
    const i = STEPS.indexOf(step);
    const next = STEPS[i + 1];
    const bars = STEPS.map(function (s, k) { return '<i class="' + (k <= i ? "on" : "") + '"></i>'; }).join("");
    return '<header class="sb-top">' +
      '<button class="sb-back" data-act="go" data-to="home" aria-label="' + h(t("home")) + '">' + ic("back", 22) + "</button>" +
      '<div class="sb-prog" role="progressbar" aria-valuemin="1" aria-valuemax="' + STEPS.length + '" aria-valuenow="' + (i + 1) + '">' + bars + "</div>" +
      "</header>" +
      '<main class="sb-main">' +
      '<p class="sb-step">' + h(t("stepOf", { n: i + 1, total: STEPS.length })) + "</p>" +
      '<h1 class="sb-h1">' + h(t("title_" + step)) + "</h1>" +
      /* The spoken-question line is for Hindi readers; in English the title says enough. */
      (S.lang === "en" ? "" : '<div class="sb-ask"><p class="sb-sub">' + h(t("q_" + step)) + "</p>" +
        (canSpeak ? '<button class="sb-listen" data-act="speak" data-key="q_' + step + '" aria-label="' + h(t("listen")) + '">' + ic("listen", 18) + "</button>" : "") + "</div>") +
      body + "</main>" +
      /* 26 Sep 2026, the owner: a step ends in Save, back to the steps list,
         never Next into the following step. The list is where he always is. */
      (next ? '<footer class="sb-foot">' + (foot || "") + '<button class="sb-cta" data-act="saveStep" data-step="' + step + '">' + ic("check", 20) + h(t("save")) + "</button></footer>"
        : foot ? '<footer class="sb-foot">' + foot + "</footer>" : "");
  }

  /* ─────────────────────────────────────────────────────── screens ── */

  const SCREENS = {};
  const SHEETS = {};

  /* Language and welcome on one screen: the FoodBridge mark and title sit in the
     middle, the language switch sits over Start and changes the words in place. */
  SCREENS.welcome = function () {
    const en = S.lang === "en";
    return '<main class="sb-main is-welcome">' +
      '<p class="sb-brand">' + LOGO + "</p>" +
      '<h1 class="sb-h1 is-center">' + h(t("wTitle")) + "</h1></main>" +
      '<footer class="sb-foot">' +
      '<div class="seg sb-langs" role="group" aria-label="भाषा · Language">' +
      '<button class="' + (en ? "" : "on") + '" data-act="lang" data-v="hi" aria-pressed="' + !en + '">' + ic("langs") + "हिंदी</button>" +
      '<button class="' + (en ? "on" : "") + '" data-act="lang" data-v="en" aria-pressed="' + en + '">' + ic("langs") + "English</button></div>" +
      '<button class="sb-cta" data-act="start">' + h(t("wStart")) + "</button>" +
      "</footer>";
  };

  function statusText(step, P) {
    const p = P[step];
    switch (step) {
      case "store": return S.store.name || t("sNone");
      case "items": return p.n ? t("sItems", { n: p.n }) : t("sNone");
      case "people": {
        const bits = [p.shops ? t("sShops", { n: p.shops }) : "", p.staff ? t("sStaff", { n: p.staff }) : "", p.suppliers ? t("sSup", { n: p.suppliers }) : "", p.left ? t("pToSort", { n: p.left }) : ""].filter(Boolean);
        return bits.length ? bits.join(" · ") : t("sNone");
      }
      case "stock": return p.n ? t("sStock", { n: p.n }) : S.skipped.stock ? t("sSkipped") : t("sNone");
      case "rules": return p.n ? t("sRules", { n: p.n }) : t("sNone");
      default: return "";
    }
  }

  SCREENS.home = function () {
    const P = M.progress(CAT, S);
    const work = STEPS.filter(function (s) { return s !== "finish"; });
    const done = work.filter(function (s) { return P[s].done; }).length;
    const nextStep = work.find(function (s) { return !P[s].done; }) || "finish";
    return '<header class="sb-top is-home">' + LOGO + '<span class="sb-top-t">' + h(t("appName")) + "</span>" +
      '<button class="sb-topbtn" data-act="menu" aria-label="' + h(t("menu")) + '">' + ic("more", 22) + "</button></header>" +
      '<main class="sb-main">' +
      '<div class="sb-homehead">' + (S.store.photo ? thumb(S.store.photo) : "") +
      '<div><h1 class="sb-h1">' + h(S.store.name || t("hTitle")) + '</h1><p class="sb-sub">' + h(t("hProgress", { n: done, total: work.length })) + "</p></div></div>" +
      '<div class="sb-bar"><i style="width:' + Math.round(done / work.length * 100) + '%"></i></div>' +
      '<ol class="sb-group steps">' + STEPS.map(function (s, i) {
        const d = P[s].done;
        return '<li><button class="sb-grow' + (d ? " is-done" : "") + (s === nextStep ? " is-next" : "") + '" data-act="go" data-to="' + s + '">' +
          '<span class="sb-grow-ic">' + ic(ICON[s], 18) + "</span>" +
          '<span class="sb-grow-main"><span class="sb-grow-t">' + (i + 1) + ". " + h(t("title_" + s)) + '</span><span class="sb-grow-s">' + h(statusText(s, P)) + "</span></span>" +
          (d ? '<span class="sb-grow-tick">' + ic("check", 18) + "</span>" : '<span class="sb-grow-go">' + ic("chev", 16) + "</span>") + "</button></li>";
      }).join("") + "</ol></main>";   // no Continue button (owner, 26 Sep): he taps a step in the list; the next one is tinted
  };

  /* The Shop step, rebuilt 26 Sep 2026 to feel quick: the basics in one card
     (the empty box says what goes in it), taps before typing (the phone's own
     autofill for name, mobile and address; GPS for the address), and no hint
     lines. A GST that looks wrong is never flagged here (owner, 26 Sep 2026):
     the Send step lists it as still to fill. */
  SCREENS.store = function () {
    const st = S.store;
    /* GPS sits at the end of the "Shop location" label: a link before, a tick after. */
    const where = '<span class="sb-line">' + (st.loc
      ? '<span class="ok">' + ic("check", 14) + h(t("fLocSavedS")) + '</span>·<button type="button" class="sb-inlink" data-act="locate">' + h(t("change")) + "</button>"
      : '<button type="button" class="sb-inlink" data-act="locate">' + ic("pin", 15) + h(t("fLocBtn")) + "</button>") + "</span>";
    return frame("store",
      '<div class="sb-group fc is-first">' +
        cardRow("store", "store.name", { ph: t("fShopName"), mic: true, ac: "organization" }) +
        cardRow("user", "store.owner", { ph: t("fOwner"), mic: true, ac: "name" }) +
        cardRow("mobile", "store.mobile", { ph: t("fMobile"), type: "tel", mode: "tel", max: 14, ac: "tel-national" }) +
        cardRow("receipt", "store.gst", { ph: t("fGst"), kind: "upper", upper: true, max: 15 }) +
      "</div>" +
      field("tag", t("fType"), setChips("store.type", "str", [
        { v: "distributor", label: t("tDistributor") }, { v: "superstockist", label: t("tSuperstockist") },
        { v: "wholesaler", label: t("tWholesaler") }, { v: "cnf", label: t("tCnf") }, { v: "retailer", label: t("tRetailer") }])) +
      field("factory", t("fMakes"), yesNo("store.makes")) +
      '<section class="sb-field"><div class="sb-label is-row"><span class="sb-label-t">' + ic("map", 18) + "<span>" + h(t("fLoc")) + "</span></span>" + where + "</div>" +
        '<div class="sb-group fc">' + cardRow("home", "store.address", { ph: t("fAddress"), area: true, mic: true, ac: "street-address" }) + "</div></section>" +
      field("warehouse", t("fGodown"), godowns(st)));
    /* Gone 26 Sep 2026 (owner): the shop photo (an older save's still shows on the steps list and in the file), and
       "Areas you supply to" (areas now come only from each customer's sheet). */
  };

  /* A row in a form card: an icon, a borderless box whose placeholder is its
     label, and its tools (mic, camera). o.ac is the autofill hint that lets the
     phone fill it in one tap. */
  function cardRow(icon, path, o) {
    const v = getPath(path);
    const attrs = ' data-bind="' + h(path) + '"' + (o.kind ? ' data-kind="' + o.kind + '"' : "") + (o.rerender ? " data-rerender" : "") +
      ' placeholder="' + h(o.ph) + '" aria-label="' + h(o.ph) + '"' + (o.mode ? ' inputmode="' + o.mode + '"' : "") +
      (o.area ? ' rows="1"' : ' type="' + (o.type || "text") + '"') + (o.max ? ' maxlength="' + o.max + '"' : "") +
      (o.upper ? ' autocapitalize="characters" class="upper"' : "") + ' autocomplete="' + (o.ac || "off") + '"';
    const el = o.area ? "<textarea" + attrs + ">" + h(v || "") + "</textarea>" : "<input" + attrs + ' value="' + h(v == null ? "" : v) + '">';
    return '<div class="fc-row"><span class="fc-ic">' + ic(icon, 18) + "</span>" + el + (o.mic ? micBtn(path, "is-plain") : "") + (o.tail || "") + "</div>";
  }

  /* One or more godowns, as one card: the shop itself (a tick row), then a row per
     other godown (number, address that grows, mic, remove), then "Add a godown". */
  function godowns(st) {
    const first = st.godownAtShop ? 2 : 1;
    const shop = st.godownAtShop === true;
    return '<div class="sb-group fc">' +
      '<button type="button" class="fc-row gd-shop' + (shop ? " on" : "") + '" data-act="set" data-path="store.godownAtShop" data-kind="flip" aria-pressed="' + shop + '">' +
        '<span class="gd-n">' + ic("store", 16) + '</span><span class="fc-t">' + h(t("gShop")) + '</span><span class="gd-tick">' + ic("check", 14) + "</span></button>" +
      st.godowns.map(function (g, i) {
        const path = "store.godowns." + i, name = t("gN", { n: first + i });
        return '<div class="fc-row"><span class="gd-n">' + (first + i) + "</span>" +
          '<textarea rows="1" data-bind="' + path + '" placeholder="' + h(t("fGodownAddr")) + '" aria-label="' + h(name) + '" autocomplete="off">' + h(g) + "</textarea>" +
          micBtn(path, "is-plain") +
          '<button type="button" class="sb-icbtn is-plain gd-x" data-act="delGodown" data-i="' + i + '" aria-label="' + h(t("remove") + " · " + name) + '">' + ic("x", 18) + "</button></div>";
      }).join("") +
      '<button type="button" class="fc-row fc-act" data-act="addGodown"><span class="gd-n">' + ic("plus", 16) + "</span><span>" + h(t("gAdd")) + "</span></button>" +
      "</div>";
  }

  function selectedNote(text) { return '<span class="foot-note">' + ic("circleCheck", 16) + "<span>" + h(text) + "</span></span>"; }

  /* ── Products ────────────────────────────────────────────────────────────
     26 Sep 2026, the owner: no long list to scroll. The step is a short
     menu: search, what he chose, and two ways in -- by company or by type
     (the aisles of a shop, fresh and loose goods first). A tile opens a
     picture grid; a tap on a picture chooses it. Food only. */

  /* A product's name in his language: loose goods have a Hindi name, packs
     keep the name printed on them. */
  function nm(it) { return S.lang !== "en" && it.hi ? it.hi : it.name; }
  function packLabel(it) { return it.loose ? t("per_" + it.per) : it.pack; }

  /* His photo, else the pack photo, else the picture; the picture shows
     if a photo fails to load. */
  function pickImg(it) {
    const img = it.photo ? '<img data-paper="' + h(it.photo) + '" alt="">'
      : it.img ? '<img src="' + h(it.img) + '" alt=""' + (it.loose ? ' class="is-fresh"' : "") + ' loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">' : "";
    return img + '<span class="pick-emoji">' + it.icon + "</span>";
  }

  function pickCard(it) {
    return '<button class="pick' + (it.on ? " on" : "") + '" data-act="toggleItem" data-id="' + h(it.id) + '" aria-pressed="' + it.on + '">' +
      '<span class="pick-img">' + pickImg(it) + '<span class="pick-tick">' + ic("check", 14) + "</span></span>" +
      '<span class="pick-name">' + h(nm(it)) + '</span><span class="pick-pack">' + h(packLabel(it)) + "</span></button>";
  }
  function pickGrid(ids) {
    return '<div class="picks">' + ids.map(function (id) { return M.item(CAT, S, id); }).filter(Boolean).map(pickCard).join("") + "</div>";
  }

  /* What one tile holds: a company's products, or an aisle's. */
  function groupIds(by, id) {
    const all = CAT.items.concat(Object.keys(S.customItems).map(function (k) { return Object.assign({ id: k }, S.customItems[k]); }));
    if (by === "co") return all.filter(function (x) { return x.company === id; }).map(function (x) { return x.id; });
    const a = (CAT.aisles || []).find(function (x) { return x.id === id; });
    return a ? all.filter(function (x) { return a.cats.indexOf(x.cat) >= 0; }).map(function (x) { return x.id; }) : [];
  }
  function chosenIn(ids) { return ids.filter(function (id) { return S.items[id]; }).length; }

  function tileBadge(n) { return n ? '<i class="tile-n">' + ic("check", 12) + n + "</i>" : ""; }

  function companyTiles() {
    return '<div class="tiles">' + M.companyList(CAT, S).map(function (c) {
      const ids = groupIds("co", c.id);
      if (!ids.length) return "";
      const first = M.item(CAT, S, ids[0]);
      return '<button class="tile" data-act="picker" data-by="co" data-id="' + h(c.id) + '">' + tileBadge(chosenIn(ids)) +
        '<span class="tile-img">' + pickImg(first) + '</span><b>' + h(c.short) + "</b><small>" + h(t("iCount", { n: ids.length })) + "</small></button>";
    }).join("") + "</div>";
  }

  /* An aisle's face: its chosen product's real photo (a.rep), else the first one with a photo, else its picture. */
  function aisleFace(a, ids) {
    const rep = a.rep && M.item(CAT, S, a.rep);
    if (rep && rep.img) return rep;
    const withImg = ids.map(function (id) { return M.item(CAT, S, id); }).find(function (it) { return it && (it.img || it.photo); });
    return withImg || { icon: a.icon };
  }

  function typeTiles() {
    const tile = function (a) {
      const ids = groupIds("aisle", a.id);
      return '<button class="tile is-type" data-act="picker" data-by="aisle" data-id="' + a.id + '">' + tileBadge(chosenIn(ids)) +
        '<span class="tile-img">' + pickImg(aisleFace(a, ids)) + '</span><b>' + h(S.lang === "en" ? a.en : a.hi) + "</b><small>" + h(t("iCount", { n: ids.length })) + "</small></button>";
    };
    const fresh = CAT.aisles.filter(function (a) { return a.fresh; }), packed = CAT.aisles.filter(function (a) { return !a.fresh; });
    return '<p class="sb-glabel">' + h(t("iFresh")) + '</p><div class="tiles">' + fresh.map(tile).join("") + "</div>" +
      '<p class="sb-glabel">' + h(t("iPacked")) + '</p><div class="tiles">' + packed.map(tile).join("") + "</div>";
  }

  function mineRow() {
    const its = M.chosenItems(CAT, S);
    if (!its.length) return "";
    const noPrice = its.filter(function (it) { return it.loose && it.sell == null; }).length;
    return '<button class="sb-row mine" data-act="mine"><span class="mine-imgs">' + its.slice(-3).reverse().map(function (it) { return '<span class="pick-img">' + pickImg(it) + "</span>"; }).join("") + "</span>" +
      '<span class="sb-row-main"><span class="sb-row-t">' + h(t("iMine")) + " · " + its.length + "</span>" +
      '<span class="sb-row-s' + (noPrice ? " is-warn" : "") + '">' + h(noPrice ? t("iNeedPrice", { n: noPrice }) : t("iMineSub")) + "</span></span>" +
      '<span class="sb-row-chev">' + ic("chev", 18) + "</span></button>";
  }

  const SEARCH_MAX = 60;
  function itemsBody() {
    const q = ui.itemsQ.trim();
    if (q) {
      const ids = M.search(CAT, S, q, null);
      if (!ids.length) return empty(t("iEmpty"), "newItem", "", t("iNew"), "plus");
      return pickGrid(ids.slice(0, SEARCH_MAX)) + (ids.length > SEARCH_MAX ? '<p class="sb-hint center-text">' + h(t("iMore", { n: SEARCH_MAX, total: ids.length })) + "</p>" : "");
    }
    const by = ui.pickBy || "company";
    return mineRow() +
      '<div class="seg" role="tablist">' +
      '<button role="tab" aria-selected="' + (by === "company") + '" class="' + (by === "company" ? "on" : "") + '" data-act="ui" data-k="pickBy" data-v="company">' + ic("building", 18) + h(t("iByCompany")) + "</button>" +
      '<button role="tab" aria-selected="' + (by === "type") + '" class="' + (by === "type" ? "on" : "") + '" data-act="ui" data-k="pickBy" data-v="type">' + ic("grid", 18) + h(t("iByType")) + "</button></div>" +
      (by === "type" ? typeTiles() : companyTiles());
  }

  SCREENS.items = function () {
    const n = Object.keys(S.items).length;
    return frame("items",
      '<label class="sb-search">' + ic("search", 18) +
      '<input type="search" data-search="itemsQ" value="' + h(ui.itemsQ) + '" placeholder="' + h(t("iSearch")) + '" aria-label="' + h(t("iSearch")) + '">' +
      (canScan ? '<button type="button" class="sb-search-btn" data-act="scan" aria-label="' + h(t("iScan")) + '">' + ic("barcode", 20) + "</button>" : "") + "</label>" +
      '<div id="list">' + itemsBody() + "</div>" +
      '<button class="sb-link is-sm" data-act="newItem">' + ic("plus", 18) + h(t("iNotFound")) + "</button>",   // photo credits: the Menu sheet and the file
      n ? selectedNote(t("iChosen", { n: n })) : "");
  };

  /* ── Contacts ────────────────────────────────────────────────────────────
     26 Sep 2026, the owner: Phone contacts, Customers, Staff and Suppliers
     are one step. Bring contacts in once, then tag each one; each tag has its
     own tab with only what that kind of person needs (a customer's delivery
     days, a staff member's job, a supplier's companies). Sorting is one tap a
     person, with a guess from the name, and one tap for "the rest are
     customers" -- most of a distributor's phone book is customers. */

  function payLabel(v) { return v === "cash" ? t("payCash") : v ? t("payDays", { n: v }) : ""; }

  function starBtn(p) {
    return '<button class="star' + (p.big ? " on" : "") + '" data-act="set" data-path="people.' + h(p.id) + '.big" data-kind="flip" aria-pressed="' + !!p.big + '" aria-label="' + h(t("shBig")) + '">' + ic("star", 20) + "</button>";
  }

  function roleOpts() {
    return [{ v: "salesman", label: t("roleSalesman"), icon: "bike" }, { v: "delivery", label: t("roleDelivery"), icon: "truck" },
      { v: "supervisor", label: t("roleSupervisor"), icon: "eye" }, { v: "office", label: t("roleOffice"), icon: "receipt" }];
  }

  function companyOpts() {
    let cos = M.companyList(CAT, S).filter(function (c) { return S.companies[c.id]; });
    if (!cos.length) cos = M.companyList(CAT, S);
    return cos.map(function (c) { return { v: c.id, label: c.short }; });
  }

  /* 26 Sep 2026, the owner: slicker, more people on screen at once. One
     dense list per tab instead of a card each: to sort, a row is the name and
     four tag buttons, one tap files it; a customer row carries its star and a
     mini day row; staff a mini job row; suppliers their companies. The tabs
     are count tiles pinned under the top bar. */

  const TAGS = [["shop", "users", "pShop"], ["staff", "staff", "pStaff"], ["supplier", "truck", "pSupplier"]];

  function tagBtns(p, guess, withX) {
    return '<div class="ptags">' + TAGS.map(function (x) {
      return '<button class="ptag ' + x[0] + (guess === x[0] ? " is-guess" : "") + '" data-act="sort" data-id="' + h(p.id) + '" data-v="' + x[0] + '" aria-label="' + h(t(x[2])) + '">' +
        ic(x[1], 18) + "<span>" + h(t(x[2])) + "</span></button>";
    }).join("") +
      (withX ? '<button class="ptag is-x" data-act="sort" data-id="' + h(p.id) + '" data-v="skip" aria-label="' + h(t("pSkip")) + '">' + ic("x", 18) + "</button>" : "") + "</div>";
  }

  function rowMain(p, sub, warn) {
    return '<div class="prow-main" data-act="personEdit" data-id="' + h(p.id) + '"><b>' + h(p.name) + "</b>" +
      '<small class="' + (warn ? "warn" : "") + '">' + h(sub) + "</small></div>";
  }

  function matchQ(p) {
    const q = (ui.peopleQ || "").toLowerCase().trim();
    return !q || (p.name + " " + p.phone).toLowerCase().indexOf(q) >= 0 || M.phone10(p.phone).indexOf(q.replace(/\D/g, "") || "~") >= 0;
  }

  function sortRows() {
    const u = M.unsorted(S).filter(matchQ);
    const skipped = M.peopleOf(S, "skip").filter(matchQ);
    let out = u.length ? '<div class="plist">' + u.map(function (p) {
      return '<div class="prow is-sort">' + rowMain(p, M.phoneShow(p.phone)) + tagBtns(p, M.guessType(p.name), true) + "</div>";
    }).join("") + "</div>" : "";
    if (!u.length && !ui.peopleQ) out = S.order.length ? '<div class="sb-callout">' + ic("circleCheck", 18) + "<p>" + h(t("pAllSorted")) + "</p></div>" : '<div class="empty"><p>' + h(t("pNone")) + "</p></div>";
    if (skipped.length) {
      out += '<details class="pskip"><summary>' + h(t("pSkippedList")) + " · " + skipped.length + ic("chev", 16) + "</summary>" +
        '<div class="plist">' + skipped.map(function (p) { return '<div class="prow is-sort">' + rowMain(p, M.phoneShow(p.phone)) + tagBtns(p, null, false) + "</div>"; }).join("") + "</div></details>";
    }
    return out;
  }

  function customerRows() {
    return '<div class="plist">' + M.peopleOf(S, "shop").filter(matchQ).map(function (p) {
      const bits = [M.phoneShow(p.phone), p.area, payLabel(p.pay)].filter(Boolean).join(" · ");
      return '<div class="prow is-cust">' + starBtn(p) + rowMain(p, bits) + '<span class="prow-go">' + ic("chev", 16) + "</span>" +
        '<div class="prow-sub">' + setChips("people." + p.id + ".days", "arr", M.DAYS.map(function (d) { return { v: d, label: dayName(d) }; }), "days mini") + "</div></div>";
    }).join("") + "</div>";
  }

  function staffRows() {
    return '<div class="plist">' + M.peopleOf(S, "staff").filter(matchQ).map(function (p) {
      return '<div class="prow is-staff">' + avatar(p.name) + rowMain(p, M.phoneShow(p.phone) + (dayList(p.days) ? " · " + dayList(p.days) : "")) + '<span class="prow-go">' + ic("chev", 16) + "</span>" +
        '<div class="prow-sub">' + setChips("people." + p.id + ".role", "str", roleOpts(), "roles mini") + "</div></div>";
    }).join("") + "</div>";
  }

  function supplierRows() {
    return '<div class="plist">' + M.peopleOf(S, "supplier").filter(matchQ).map(function (p) {
      const cos = (p.companies || []).map(function (id) { const c = M.companyById(CAT, S, id); return c ? c.short : ""; }).filter(Boolean).join(", ");
      return '<div class="prow is-sup">' + avatar(p.name) + rowMain(p, cos || t("suNoCo"), !cos) + '<span class="prow-go">' + ic("chev", 16) + "</span></div>";
    }).join("") + "</div>";
  }

  function peopleList(tab) {
    if (tab === "shop") return M.peopleOf(S, "shop").length ? customerRows() : '<div class="empty"><p>' + h(t("shEmpty")) + "</p></div>";
    if (tab === "staff") return M.peopleOf(S, "staff").length ? staffRows() : '<div class="empty"><p>' + h(t("stEmpty")) + "</p>" +
      (S.skipped.staff ? '<p class="ok">' + ic("check", 16) + h(t("stNone")) + "</p>" : '<button class="sb-btn" data-act="skip" data-step="staff" data-stay="1">' + h(t("stNone")) + "</button>") + "</div>";
    if (tab === "supplier") return M.peopleOf(S, "supplier").length ? supplierRows() : '<div class="empty"><p>' + h(t("suEmpty")) + "</p>" +
      (S.skipped.suppliers ? '<p class="ok">' + ic("check", 16) + h(t("suNone")) + "</p>" : '<button class="sb-btn" data-act="skip" data-step="suppliers" data-stay="1">' + h(t("suNone")) + "</button>") + "</div>";
    return sortRows();
  }

  function peopleTab() {
    const left = M.unsorted(S).length;
    return ui.peopleTab || (left ? "sort" : "shop");
  }

  SCREENS.people = function () {
    const left = M.unsorted(S).length;
    const n = { sort: left, shop: M.peopleOf(S, "shop").length, staff: M.peopleOf(S, "staff").length, supplier: M.peopleOf(S, "supplier").length };
    const tab = peopleTab();
    const tabs = [["sort", "pTabSort"], ["shop", "tShops"], ["staff", "tStaff"], ["supplier", "tSuppliers"]];
    /* A bar over the list: what one tap does here. */
    let bar = "";
    if (tab === "sort" && (left > 1 || ui.lastSorted.length)) {
      bar = '<div class="pbar">' + (left > 1 ? '<button class="sb-more" data-act="sortAll">' + ic("users", 16) + h(t("pRestCustomers", { n: left })) + "</button>" : "<span></span>") +
        (ui.lastSorted.length ? '<button class="sb-more is-quiet" data-act="undoSort">' + ic("undo", 16) + h(t("pUndo")) + "</button>" : "") + "</div>";
    } else if (tab === "shop" && n.shop) bar = '<p class="pbar-hint">' + h(t("pShopHint")) + "</p>";
    return frame("people",
      '<div class="add-row">' +
      '<button class="sb-cta" data-act="pick">' + ic("contacts", 20) + h(t("pPick")) + "</button>" +
      '<button class="sb-btn" data-act="personNew">' + ic("pen", 18) + h(t("pTypeShort")) + "</button></div>" +
      '<div class="ptabs" role="tablist">' + tabs.map(function (x) {
        return '<button role="tab" aria-selected="' + (tab === x[0]) + '" class="ptab' + (tab === x[0] ? " on" : "") + (x[0] === "sort" && left ? " is-todo" : "") + '" data-act="ui" data-k="peopleTab" data-v="' + x[0] + '">' +
          "<b>" + n[x[0]] + "</b><span>" + h(t(x[1])) + "</span></button>";
      }).join("") + "</div>" +
      ((tab === "sort" ? left : n[tab]) > 8 || ui.peopleQ ? search("peopleQ", t("pSearch")) : "") +
      bar +
      '<div id="plist">' + peopleList(tab) + "</div>");
  };

  /* ── Godown stock ────────────────────────────────────────────────────────
     27 Sep 2026, the owner: the platform's Customer Stock Audit, screen for
     screen (modules/foodbridge-customer-mockup/v3/screens/customers/
     stock-audit.js, the Quick Audit loop), with one change of context: he is
     counting his own godown, not a customer's shelf, so there is no "who are
     you visiting" and the audit starts at the count. Search → add → count in
     the row (unit above the − n + stepper) → Finish Audit, asked inline in
     the footer. The ← asks before throwing an unsaved count away. Its look is
     the platform's too (the .sa block in sb.css), not the onboarding's. */

  function saDraft() {
    if (!S.stockDraft) S.stockDraft = M.stockDraft(CAT, S);
    const d = S.stockDraft;
    d.sel = d.sel.filter(function (id) { return S.items[id]; });   // a product dropped on the Products step leaves the count too
    return d;
  }
  function saItems() { return saDraft().sel.map(function (id) { return M.item(CAT, S, id); }).filter(Boolean); }
  function saCounted(id) { const l = saDraft().lines[id]; return !!l && l.qty != null; }
  function saStats() {
    const its = saItems();
    const n = its.filter(function (it) { return saCounted(it.id); }).length;
    return { its: its, n: n, total: its.length, pct: its.length ? Math.round(n / its.length * 100) : 0 };
  }
  function saDirty() { return !!S.stockDraft && M.draftSig(S.stockDraft) !== M.draftSig(M.stockDraft(CAT, S)); }
  function saUnitLabel(it, k) { return it.loose ? t("u_" + k) : k === "case" ? t("uCase") : t("uPiece"); }
  function saLineUnit(it) { const l = saDraft().lines[it.id]; return (l && l.unit) || M.countUnit(it); }
  function saSub(it) {
    const co = it.company && M.companyById(CAT, S, it.company);
    return [packLabel(it), co ? co.short : ""].filter(Boolean).join(" · ");
  }
  const saSearching = function () { return !!ui.saQ.trim() || ui.saOpen || ui.saAdding; };

  function saHeadHTML() {
    const s = saStats();
    return '<button type="button" class="ws-exit" data-act="saExit" aria-label="' + h(t("saExit")) + '">←</button>' +
      '<span class="ws-who">' + h(t("title_stock")) + "</span>" +
      (s.total ? '<span class="ws-count">' + h(t("saProg", { n: s.n, total: s.total })) + "</span>" : "") +
      '<div class="ws-bar"><span style="width:' + s.pct + '%"></span></div>';
  }

  /* While the box is in use the results own the screen; cleared, the count comes back. */
  function saBodyHTML() {
    const q = ui.saQ.trim();
    const d = saDraft();
    if (saSearching()) {
      const mine = Object.keys(S.items).filter(function (id) { return d.sel.indexOf(id) < 0; });
      let ids, total = 0;
      if (q) ids = M.search(CAT, S, q, null).filter(function (id) { return d.sel.indexOf(id) < 0; })
        .sort(function (a, b) { return (S.items[b] ? 1 : 0) - (S.items[a] ? 1 : 0); });   // his own products first
      else {
        const pool = (mine.length ? mine : M.search(CAT, S, "", null).filter(function (id) { return d.sel.indexOf(id) < 0; }))
          .map(function (id) { return M.item(CAT, S, id); }).filter(Boolean).sort(function (a, b) { return nm(a).localeCompare(nm(b)); });
        total = pool.length;
        ids = pool.slice(0, 5).map(function (it) { return it.id; });
      }
      const rows = ids.map(function (id) { return M.item(CAT, S, id); }).filter(Boolean);
      return '<div class="picker-list dropdown">' + (rows.length
        ? rows.map(function (it) {
          return '<button type="button" class="picker-row" data-act="saAdd" data-id="' + h(it.id) + '">' +
            '<span><span class="nm">' + h(nm(it)) + '</span><div class="sub">' + h(saSub(it)) + "</div></span>" +
            '<span class="add-ic" aria-hidden="true">+</span></button>';
        }).join("")
        : '<div class="dropdown-empty">' + h(t("saNoFound")) + '<button type="button" class="np-add" data-act="saNew">' + h(t("saAddProduct")) + "</button></div>") +
        (!q && total > rows.length ? '<div class="suggest-hint">' + h(t("saShowing", { n: rows.length, total: total })) + "</div>" : "") + "</div>";
    }
    const its = saItems();
    return '<div class="section-head-row"><h2>' + h(t("saSelected")) + "</h2></div>" + (its.length
      ? '<div class="qc-card">' + its.map(saRowHTML).join("") + "</div>"
      : '<div class="sah-empty"><div class="big">📋</div><p>' + h(t("saEmpty")) + "<br>" + h(t("saEmpty2")) + "</p></div>");
  }

  const TRASH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>';

  /* An untouched row's box is empty, not 0: blank is "not counted", 0 is "none there". */
  function saRowHTML(it) {
    const l = saDraft().lines[it.id];
    const done = saCounted(it.id);
    const id = h(it.id);
    return '<div class="qc-line qc-row' + (done ? " done" : "") + '" data-row="' + id + '">' +
      '<div class="info"><div class="nm" title="' + h(nm(it)) + '">' + h(nm(it)) + '</div><div class="meta">' + h(saSub(it)) + '</div><div class="meta ask">' + h(t("saRemoveQ")) + "</div></div>" +
      '<span class="qty-col">' +
        '<button type="button" class="unit-pick" data-act="saUnit" data-id="' + id + '" aria-label="' + h(saUnitLabel(it, saLineUnit(it))) + '"><span class="lbl">' + h(saUnitLabel(it, saLineUnit(it))) + '</span><span class="chev" aria-hidden="true">⌄</span></button>' +
        '<span class="pd-stepper"><button type="button" data-act="saStep" data-id="' + id + '" data-d="-1" aria-label="−">−</button>' +
        '<span class="val"><input type="text" inputmode="numeric" autocomplete="off" autocorrect="off" spellcheck="false" enterkeyhint="done" size="3" data-sa-qty="' + id + '" value="' + (done ? l.qty : "") + '" placeholder="0" aria-label="' + h(nm(it)) + '"></span>' +
        '<button type="button" data-act="saStep" data-id="' + id + '" data-d="1" aria-label="+">+</button></span></span>' +
      '<button type="button" class="qc-remove" data-act="saRemove" aria-label="' + h(t("remove")) + " " + h(nm(it)) + '">' + TRASH + "</button>" +
      '<button type="button" class="ci-btn sm yes" data-act="saRemoveYes" data-id="' + id + '" aria-label="' + h(t("remove")) + '">✓</button>' +
      '<button type="button" class="ci-btn sm no" data-act="saRemoveNo" aria-label="' + h(t("cancel")) + '">✗</button></div>';
  }

  /* The footer in its two states; the question is recomputed on every change behind it. */
  function saFootHTML() {
    if (!ui.saConfirm) {
      return (saSearching() ? "" : '<button type="button" class="btn-add" data-act="saAddBtn">' + h(t("saAddProduct")) + "</button>") +
        '<button type="button" class="btn-wide primary" data-act="saFinish">' + h(t("saFinish")) + "</button>";
    }
    const s = saStats();
    const detail = s.n < s.total ? t("saSomeCounted", { n: s.n, total: s.total }) : t("saAllCounted", { n: s.total });
    return '<span class="confirm-inline"><span class="ci-copy"><span class="ci-prompt">' + h(t("saFinishQ")) + '</span><span class="ci-detail">' + h(detail) + "</span></span>" +
      '<button type="button" class="ci-btn yes" data-act="saYes" aria-label="' + h(t("saFinish")) + '">✓</button>' +
      '<button type="button" class="ci-btn no" data-act="saNo" aria-label="' + h(t("saKeep")) + '">✗</button></span>';
  }

  SCREENS.stock = function () {
    saDraft();
    return '<main class="sa sa-main"><div class="ws-head" id="saHead">' + saHeadHTML() + "</div>" +
      '<div class="sah-search-row"><div class="sah-search"><input type="search" id="saQ" autocapitalize="none" autocorrect="off" autocomplete="off" spellcheck="false" enterkeyhint="search" value="' + h(ui.saQ) + '" placeholder="' + h(t("saSearch")) + '" aria-label="' + h(t("saSearch")) + '"></div></div>' +
      '<div id="saBody">' + saBodyHTML() + "</div></main>" +
      '<footer class="sa sah-foot ws-foot"><div class="inner" id="saFoot">' + saFootHTML() + "</div></footer>";
  };

  /* In place, never a full redraw: a redraw would rebuild the box he is typing in. */
  function saRefresh(body) {
    const set = function (id, html) { const n = document.getElementById(id); if (n) n.innerHTML = html; };
    set("saHead", saHeadHTML());
    if (body) set("saBody", saBodyHTML());
    set("saFoot", saFootHTML());
  }

  function saWrite(id, qty) {
    const it = M.item(CAT, S, id);
    if (!it) return;
    const d = saDraft();
    const l = d.lines[id] || (d.lines[id] = { qty: null, unit: M.countUnit(it) });
    l.qty = qty;
    save();
    const row = document.querySelector('.qc-row[data-row="' + id + '"]');
    if (row) {
      row.classList.add("done");
      const inp = row.querySelector("input");
      if (inp && inp.value !== String(qty)) inp.value = qty;
    }
    saRefresh(false);
  }

  function saFlash(id) {
    const col = document.querySelector('.qc-row[data-row="' + id + '"] .qty-col');
    if (!col) return;
    const b = document.createElement("span");
    b.className = "unit-flash";
    b.setAttribute("role", "status");
    b.innerHTML = '<span class="ic" aria-hidden="true">✓</span>' + h(t("saUpdated"));
    col.insertBefore(b, col.querySelector(".pd-stepper"));
    setTimeout(function () { b.classList.add("out"); setTimeout(function () { b.remove(); }, 220); }, 1500);
  }

  /* The platform's unit sheet: his price for one of that unit, and the unit. */
  function saPrice(it, k) {
    if (it.sell == null) return null;
    return M.round2(it.sell * M.unitPer(it, k));
  }
  function saMoney(v) { return "₹" + Number(v).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function saPriceHTML(it, k) {
    const v = saPrice(it, k);
    return v == null ? '<span class="us-price none">' + h(t("saNoPrice")) + "</span>" : '<span class="us-price">' + h(saMoney(v)) + "</span>";
  }

  SHEETS.saUnit = function (sh) {
    const it = M.item(CAT, S, sh.id);
    if (!it) return "";
    const base = saUnitLabel(it, M.countUnits(it)[0].k);
    return '<div class="grip"></div><h2 class="us-name">' + h(nm(it)) + '</h2><p class="us-sku">' + h(saSub(it)) + "</p>" +
      '<div class="us-now"><span class="us-now-copy"><span class="us-label">' + h(t("saPrice")) + '</span><span id="usPrice">' + saPriceHTML(it, sh.picked) + "</span></span>" +
      '<span class="us-pick"><label class="us-label" for="usUnit">' + h(t("saUnitSel")) + '</label><span class="us-select"><select id="usUnit">' +
      M.countUnits(it).map(function (u) {
        return '<option value="' + h(u.k) + '"' + (u.k === sh.picked ? " selected" : "") + ">" + h(saUnitLabel(it, u.k) + (u.per > 1 ? " (" + u.per + " " + base + ")" : "")) + "</option>";
      }).join("") + '</select><span class="chev" aria-hidden="true">⌄</span></span></span></div>' +
      '<div class="sheet-acts" id="usActs">' + saUnitActs(it, sh) + "</div>";
  };
  SHEETS.saUnit.sa = true;

  function saUnitActs(it, sh) {
    if (!sh.asking) return '<button type="button" class="sheet-btn primary" data-act="saUnitAsk">' + h(t("save")) + "</button>";
    const changed = sh.picked !== sh.cur;
    const v = saPrice(it, sh.picked);
    const detail = (changed ? saUnitLabel(it, sh.cur) + " → " + saUnitLabel(it, sh.picked) : saUnitLabel(it, sh.picked)) + (v != null ? " · " + saMoney(v) : "");
    return '<span class="confirm-inline"><span class="ci-copy"><span class="ci-prompt">' + h(t(changed ? "saChangeUnit" : "saSaveUnit")) + '</span><span class="ci-detail">' + h(detail) + "</span></span>" +
      '<button type="button" class="ci-btn yes" data-act="saUnitYes" aria-label="' + h(t("save")) + '">✓</button>' +
      '<button type="button" class="ci-btn no" data-act="saUnitNo" aria-label="' + h(t("cancel")) + '">✗</button></span>';
  }
  function saUnitRedraw() {
    const it = M.item(CAT, S, sheet.id);
    const acts = document.getElementById("usActs");
    if (!it || !acts) return;
    acts.classList.toggle("asking", !!sheet.asking);
    acts.innerHTML = saUnitActs(it, sheet);
  }

  /* Leaving asks only when there is something to lose (ruthless panes, 24 Sep). */
  SHEETS.saLeave = function () {
    const s = saStats();
    const so = !s.total ? t("saNoneSel") : !s.n ? t("saNoneCounted") : t("saSoFar", { n: s.n, total: s.total });
    return (S.store.name ? '<div class="eyebrow">' + h(S.store.name) + "</div>" : "") +
      "<h2>" + h(t("saLeaveQ")) + '</h2><p class="sub">' + h(so + " " + t("saLeaveSub")) + "</p>" +
      '<div class="sheet-acts"><button type="button" class="sheet-btn primary" data-act="closeSheet">' + h(t("saKeep")) + "</button>" +
      '<button type="button" class="sheet-btn danger" data-act="saDiscard">' + h(t("saEnd")) + "</button></div>";
  };
  SHEETS.saLeave.sa = "center";

  SCREENS.rules = function () {
    return frame("rules",
      field("cash", t("ruPay"), setChips("rules.payMethods", "arr", [{ v: "cash", label: t("mCash"), icon: "cash" }, { v: "upi", label: t("mUpi"), icon: "upi" },
        { v: "cheque", label: t("mCheque"), icon: "receipt" }, { v: "credit", label: t("mCredit"), icon: "ledger" }])) +
      field("calendar", t("ruRoutes"), yesNo("rules.routes")) +
      field("mobile", t("ruSelf"), yesNo("rules.selfOrder")) +
      field("divide", t("ruPart"), yesNo("rules.partPay")) +
      field("returns", t("ruReturns"), setChips("rules.returns", "str", [{ v: "credit", label: t("retCredit") }, { v: "replace", label: t("retReplace") }, { v: "none", label: t("retNone") }], "col")) +
      field("steps", t("ruSteps"), setChips("rules.steps", "str", [{ v: "simple", label: t("stepsSimple") }, { v: "dispatch", label: t("stepsDispatch") }], "col")) +
      field("hourglass", t("ruBatches"), yesNo("rules.batches")) +
      field("sunrise", t("ruMorning"), setChips("rules.morning", "str", [{ v: "orders", label: t("mnOrders"), icon: "receipt" }, { v: "money", label: t("mnMoney"), icon: "rupee" },
        { v: "stock", label: t("mnStock"), icon: "box" }, { v: "trucks", label: t("mnTrucks"), icon: "truck" }])) +
      '<button class="sb-btn is-alt wide sb-voice" data-act="papers" data-rec="1">' + ic("mic", 18) + h(t("ruVoice")) + "</button>");
  };

  SCREENS.finish = function () {
    const its = Object.keys(S.items).length;
    const gaps = M.missing(CAT, S);
    const row = function (icon, n, label, to, tab) {
      return '<button class="sb-grow" data-act="go" data-to="' + to + '"' + (tab ? ' data-tab="' + tab + '"' : "") + '><span class="sb-grow-ic">' + ic(icon, 18) + '</span><span class="sb-grow-t">' + h(label) + "</span>" +
        '<span class="sb-grow-n">' + n + '</span><span class="sb-grow-go">' + ic("chev", 16) + "</span></button>";
    };
    return frame("finish",
      '<div class="sb-group is-found">' +
      row("box", its, t("tProducts"), "items") + row("users", M.peopleOf(S, "shop").length, t("tShops"), "people", "shop") +
      row("truck", M.peopleOf(S, "supplier").length, t("tSuppliers"), "people", "supplier") + row("staff", M.peopleOf(S, "staff").length, t("tStaff"), "people", "staff") +
      '<button class="sb-grow" data-act="papers"><span class="sb-grow-ic">' + ic("camera", 18) + '</span><span class="sb-grow-t">' + h(t("tPapers")) + '</span><span class="sb-grow-n">' + S.papers.length + '</span><span class="sb-grow-go">' + ic("chev", 16) + "</span></button></div>" +
      (gaps.length
        ? '<p class="sb-glabel">' + h(t("fiMissing")) + '</p><div class="sb-group">' + gaps.map(function (g) {
          const gi = { shop: "users", staff: "staff", supplier: "truck" }[g.tab] || ICON[g.step];
          return '<button class="sb-grow is-need" data-act="go" data-to="' + g.step + '"' + (g.tab ? ' data-tab="' + g.tab + '"' : "") + '><span class="sb-grow-ic">' + ic(gi, 18) + '</span><span class="sb-grow-t">' + h(t("gap_" + g.key)) + "</span>" +
            (g.n > 1 ? '<i class="pill">' + g.n + "</i>" : "") + '<span class="sb-grow-go">' + ic("chev", 16) + "</span></button>";
        }).join("") + "</div>"
        : '<div class="sb-callout">' + ic("circleCheck", 18) + "<p>" + h(t("fiNoMissing")) + "</p></div>") +
      '<p class="sb-glabel">' + h(t("fiHow")) + '</p><ol class="sb-card how-send"><li>' + h(t("fiHow1")) + "</li><li>" + h(t("fiHow2")) + "</li><li>" + h(t("fiHow3")) + "</li></ol>",
      '<button class="sb-cta" data-act="saveFile">' + ic("save", 20) + h(t("fiSave")) + "</button>" +
      (canShareFiles ? '<button class="sb-cta is-alt" data-act="share">' + ic("share", 20) + h(t("fiShare")) + "</button>" : "") +
      '<button class="sb-link is-sm" data-act="excel">' + ic("sheet", 18) + h(t("fiExcel")) + "</button>");
  };

  /* ───────────────────────────────────────────────────────── sheets ── */

  function sheetWrap(title, body, foot) {
    return '<div class="sheet-grip"></div><div class="sheet-head"><h2>' + title + '</h2><button class="sheet-x" data-act="closeSheet" aria-label="' + h(t("cancel")) + '">' + ic("x", 18) + "</button></div>" +
      '<div class="sheet-body">' + body + "</div>" + (foot ? '<div class="sheet-foot">' + foot + "</div>" : "");
  }

  function menuRow(act, icon, label, extra) {
    return '<button class="sb-row' + (extra && extra.cls ? " " + extra.cls : "") + '" data-act="' + act + '"' + (extra && extra.attrs ? " " + extra.attrs : "") + '><span class="sb-row-ic">' + ic(icon) + '</span><span class="sb-row-main"><span class="sb-row-t">' + h(label) + '</span></span><span class="sb-row-chev">' + ic("chev", 18) + "</span></button>";
  }

  SHEETS.menu = function () {
    return sheetWrap(h(t("menu")),
      '<div class="sb-list">' +
      menuRow("lang", "langs", t("menuLang"), { attrs: 'data-v="' + (S.lang === "en" ? "hi" : "en") + '"' }) +
      menuRow("confirm", "trash", t("menuFresh"), { cls: "is-bad", attrs: 'data-what="fresh"' }) + "</div>" +
      '<p class="sb-hint">' + h(CAT.note) + '</p><p class="sb-hint">' + h(CAT.credit) + "</p>");
  };

  SHEETS.confirm = function () {
    return sheetWrap(h(t("cfTitle")), '<div class="sb-callout is-bad">' + ic("alert", 18) + "<p>" + h(t("cfFresh")) + "</p></div>",
      '<button class="sb-btn" data-act="closeSheet">' + h(t("cancel")) + "</button>" +
      '<button class="sb-cta is-bad" data-act="fresh">' + h(t("cfFreshYes")) + "</button>");
  };

  /* A tile's products as pictures: tap to choose, or take them all. */
  SHEETS.picker = function (sh) {
    const ids = groupIds(sh.by, sh.id);
    const n = chosenIn(ids);
    let title = "";
    if (sh.by === "co") { const c = M.companyById(CAT, S, sh.id); title = c ? c.short : ""; }
    else { const a = CAT.aisles.find(function (x) { return x.id === sh.id; }); title = a ? (S.lang === "en" ? a.en : a.hi) : ""; }
    return sheetWrap(h(title),
      '<div class="pick-bar"><span>' + h(t("iCount", { n: ids.length })) + (n ? " · " + h(t("iChosen", { n: n })) : "") + "</span>" +
      '<button class="sb-more" data-act="pickAll">' + h(n === ids.length ? t("iClearAll") : t("iSelectAll")) + "</button></div>" +
      pickGrid(ids),
      '<button class="sb-cta" data-act="closeSheet">' + h(t("done")) + "</button>");
  };

  /* What he chose, with its price; a pencil opens the product. */
  SHEETS.mine = function () {
    const need = function (it) { return it.sell == null ? 0 : 1; };
    const its = M.chosenItems(CAT, S).sort(function (a, b) { return need(a) - need(b); });   // what still needs a price, first
    return sheetWrap(h(t("iMine")) + " · " + its.length,
      (its.length ? '<div class="mine-list">' + its.map(function (it) {
        const price = it.sell == null ? '<span class="warn">' + h(t("iAddPrice")) + "</span>"
          : '<span class="price">' + h(t("iShopPrice")) + " " + rupee(it.sell) + (it.loose ? " " + h(t("per_" + it.per)) : it.unit === "case" ? " · " + h(t("iCaseOf", { n: it.caseQty })) : "") + "</span>";
        return '<div class="mine-row"><span class="pick-img" data-act="itemSheet" data-id="' + h(it.id) + '">' + pickImg(it) + "</span>" +
          '<div class="prod-main" data-act="itemSheet" data-id="' + h(it.id) + '"><b>' + h(nm(it)) + '</b><span class="sb-muted">' + h(packLabel(it)) + "</span>" + price + "</div>" +
          '<button class="sb-icbtn is-plain" data-act="itemSheet" data-id="' + h(it.id) + '" aria-label="' + h(t("change")) + '">' + ic("pencil", 18) + "</button>" +
          '<button class="sb-icbtn is-plain is-x" data-act="toggleItem" data-id="' + h(it.id) + '" aria-label="' + h(t("remove")) + '">' + ic("x", 18) + "</button></div>";
      }).join("") + "</div>" : '<p class="sb-muted center-text">' + h(t("iEmpty")) + "</p>"),
      '<button class="sb-cta" data-act="closeSheet">' + h(t("done")) + "</button>");
  };

  function priceInput(p, key, val) {
    return '<div class="inp"><input data-bind="' + p + key + '" data-kind="num" data-touch="' + p + "touched." + key + '" data-rerender inputmode="decimal" placeholder="₹" value="' + h(val == null ? "" : val) + '"></div>';
  }

  SHEETS.item = function (sh) {
    const id = sh.id;
    const it = M.item(CAT, S, id);
    if (!it) return sheetWrap("", "");
    const p = "items." + id + ".";
    const head = '<div class="item-head"><span class="pick-img is-lg">' + pickImg(it) + "</span><div><b>" + h(nm(it)) + '</b><small class="sb-muted">' + h(packLabel(it)) + " · " + h(catName(it.cat)) + "</small>" +
      (it.loose || it.custom || it.touched.mrp ? "" : '<small class="warn">' + ic("alert", 14) + h(t("isCheckMrp")) + "</small>") + "</div></div>";
    const speed = field("timer", t("isSpeed"), setChips(p + "speed", "str", [{ v: "fast", label: t("spFast"), icon: "fast" }, { v: "med", label: t("spMed"), icon: "med" }, { v: "slow", label: t("spSlow"), icon: "slow" }]));
    const remove = '<button class="sb-btn is-bad wide" data-act="removeItem" data-id="' + h(id) + '">' + ic("trash", 18) + h(t("isRemove")) + "</button>";
    const done = '<button class="sb-cta" data-act="closeSheet">' + h(t("done")) + "</button>";
    /* Loose goods: a price per kg / dozen / … that only he knows. */
    if (it.loose) {
      return sheetWrap(h(nm(it)), head +
        field("store", t("isSellPer", { per: t("per_" + it.per) }), priceInput(p, "sell", it.sell), it.sell == null ? h(t("isLooseHint")) : "") +
        field("cart", t("isBuyPer", { per: t("per_" + it.per) }), priceInput(p, "buy", it.buy)) +
        speed + remove, done);
    }
    return sheetWrap(h(nm(it)), head +
      field("tag", t("isMrp"), stepper(p + "mrp", { min: 0, base: it.mrp, touch: p + "touched.mrp" })) +
      field("store", t("isSell"), priceInput(p, "sell", it.sell),
        [it.touched.sell || it.touched.buy || (S.companies[it.company] || {}).seen ? "" : h(t("isStdPrice")),
          it.unit === "case" ? h(t("isCaseTotal", { n: M.unitPrice(it, "sell") })) : ""].filter(Boolean).join(" ")) +
      field("cart", t("isBuy"), priceInput(p, "buy", it.buy)) +
      field("box", t("isUnit"), setChips(p + "unit", "str", [{ v: "piece", label: t("uPiece") }, { v: "case", label: t("uCase") }], "two") +
        '<p class="mini">' + h(t("isCaseQty")) + "</p>" + stepper(p + "caseQty", { min: 1, base: it.caseQty })) +
      speed +
      field("receipt", t("isGst"), chips([0, 5, 18, 40].map(function (g) { return { v: g, label: g + "%" }; }), function (g) { return Number(g) === it.gst; },
        'data-act="set" data-path="' + p + 'gst" data-kind="num"') +
        (S.items[id] && S.items[id].gst == null ? '<p class="sb-hint">' + h(catName(it.cat)) + ": " + it.gst + "%</p>" : "")) +
      field("barcode", t("isBarcode"), input(p + "barcode", { mode: "numeric" }), it.barcode && !(S.items[id] || {}).barcode ? h(it.barcode) : "") +
      remove, done);
  };

  const PERS = ["kg", "dozen", "piece", "bunch", "litre", "pack"];
  const LOOSE_CATS = ["veg", "fruit", "eggs", "meat", "milk", "freshdairy", "grains", "dryfruit", "spice", "other"];

  SHEETS.newItem = function (sh) {
    const d = sh.draft;
    const loose = !!d.loose;
    const cats = (loose ? LOOSE_CATS : Object.keys(CAT.categories)).map(function (k) { return '<option value="' + k + '"' + (d.cat === k ? " selected" : "") + ">" + CAT.categories[k].icon + " " + h(catName(k)) + "</option>"; }).join("");
    const kind = field("box", t("isKind"), setChips("@draft.loose", "bool", [{ v: "0", label: t("kPacked") }, { v: "1", label: t("kLoose") }], "two"));
    const photo = field("camera", t("isPhoto"), d.photo ? '<div class="photo-row">' + thumb(d.photo) + '<button class="sb-btn" data-act="photo" data-for="draft">' + h(t("change")) + "</button></div>"
      : '<button class="sb-btn wide" data-act="photo" data-for="draft">' + ic("camera", 18) + h(t("takePhoto")) + "</button>");
    const name = field("pen", t("isName"), input("@draft.name", { mic: true }));
    const category = field("grid", t("isCategory"), '<div class="inp"><select data-bind="@draft.cat">' + cats + "</select></div>");
    if (loose) {
      return sheetWrap(h(t("iNew")), kind + name +
        field("ruler", t("isPer"), setChips("@draft.per", "str", PERS.map(function (x) { return { v: x, label: t("per_" + x) }; }))) +
        field("store", t("isSellPer", { per: t("per_" + (d.per || "kg")) }), input("@draft.sell", { kind: "num", mode: "decimal", ph: "₹" })) +
        category + photo,
        '<button class="sb-cta" data-act="saveItem">' + h(t("save")) + "</button>");
    }
    const cos = companyOpts().concat([{ v: "", label: t("otherCompany") }]);
    return sheetWrap(h(t("iNew")), kind + photo + name +
      field("building", t("isCompany"), setChips("@draft.company", "str", cos) +
        (d.company ? "" : '<div class="gap"></div>' + input("@draft.companyName", { ph: t("cNewName"), mic: true }))) +
      field("ruler", t("isPack"), input("@draft.pack")) +
      field("tag", t("isMrp"), input("@draft.mrp", { kind: "num", mode: "decimal", ph: "₹" })) +
      field("box", t("isCaseQty"), stepper("@draft.caseQty", { min: 1 })) +
      category +
      (d.barcode ? field("barcode", t("isBarcode"), '<p class="sb-strong">' + h(d.barcode) + "</p>") : ""),
      '<button class="sb-cta" data-act="saveItem">' + h(t("save")) + "</button>");
  };

  SHEETS.scan = function () {
    return sheetWrap(h(t("scTitle")), '<div class="scan"><video id="scanVideo" playsinline muted></video><i class="scan-line"></i></div>');
  };

  function typeOpts(withSkip) {
    const o = [{ v: "shop", label: t("pShop"), icon: "users" }, { v: "supplier", label: t("pSupplier"), icon: "truck" }, { v: "staff", label: t("pStaff"), icon: "staff" }];
    return withSkip ? o.concat([{ v: "skip", label: t("pSkip"), icon: "ban" }]) : o;
  }

  /* iPhone Safari and computers do not let a web page open the phone's contacts. */
  SHEETS.noPicker = function () {
    const k = phoneKind();
    const steps = k === "ios" ? ["pIos1", "pIos2", "pIos3"] : k === "android" ? ["pAnd1", "pAnd2"] : ["pOther1"];
    return sheetWrap(h(t("pPick")),
      '<div class="sb-callout is-warn">' + ic("info", 18) + "<p>" + h(t(k === "ios" ? "pNoPickerIos" : "pNoPicker")) + "</p></div>" +
      '<ol class="sb-card how-send">' + steps.map(function (x) { return "<li>" + h(t(x)) + "</li>"; }).join("") + "</ol>" +
      (k === "ios" ? '<p class="sb-hint">' + h(t("pIosOld")) + "</p>" : "") +
      '<p class="sb-hint">' + h(t("pNoPicker2")) + "</p>",
      '<button class="sb-cta" data-act="personNew">' + ic("pen", 18) + h(t("pTypeShort")) + "</button>");
  };

  SHEETS.personNew = function (sh) {
    return sheetWrap(h(t("pType")),
      field("user", t("pName"), input("@draft.name", { mic: true })) +
      field("mobile", t("pPhone"), input("@draft.phone", { type: "tel", mode: "tel", max: 14 })) +
      field("tag", t("pIsA"), setChips("@draft.type", "str", typeOpts())) +
      (sh.added ? '<p class="ok">' + ic("check", 16) + h(t("pAdded", { n: sh.added })) + "</p>" : ""),
      '<button class="sb-btn is-alt" data-act="savePerson" data-more="1">' + ic("plus", 18) + h(t("pSaveNext")) + "</button>" +
      '<button class="sb-cta" data-act="savePerson">' + h(t("save")) + "</button>");
  };

  SHEETS.personEdit = function (sh) {
    const p = S.people[sh.id];
    if (!p) return sheetWrap("", "");
    const b = "people." + p.id + ".";
    let body = field("user", t("pName"), input(b + "name", { mic: true })) + field("mobile", t("pPhone"), input(b + "phone", { type: "tel", mode: "tel", max: 14 }));
    if (p.type === "shop") {
      const areas = (S.store.areas || []).map(function (a) { return { v: a, label: a }; });
      body +=
        field("star", t("shBig"), yesNo(b + "big")) +
        field("calendar", t("shDays"), dayChips(b + "days")) +
        field("map", t("shArea"), (areas.length ? setChips(b + "area", "str", areas) : "") +
          '<div class="inp row"><input id="areaNew" type="text" placeholder="' + h(t("fAreaPh")) + '"><button class="sb-btn" data-act="addArea" data-person="' + h(p.id) + '">' + ic("plus", 18) + h(t("add")) + "</button></div>") +
        field("cash", t("shPay"), setChips(b + "pay", "auto", [{ v: "cash", label: t("payCash") }, { v: 7, label: t("payDays", { n: 7 }) }, { v: 15, label: t("payDays", { n: 15 }) }, { v: 30, label: t("payDays", { n: 30 }) }])) +
        field("list", t("shRate"), setChips(b + "rate", "str", [{ v: "normal", label: t("rtNormal") }, { v: "wholesale", label: t("rtWholesale") }, { v: "special", label: t("rtSpecial") }])) +
        field("phone", t("shHow"), setChips(b + "how", "str", [{ v: "salesman", label: t("howSalesman") }, { v: "phone", label: t("howPhone") }, { v: "whatsapp", label: t("howWhatsapp") }, { v: "self", label: t("howSelf") }])) +
        field("ledger", t("shOwes"), input(b + "owes", { kind: "num", mode: "numeric" }), h(t("shOwesHint"))) +
        field("note", t("shNote"), input(b + "note", { area: true, mic: true }));
    } else if (p.type === "staff") {
      body +=
        field("role", t("pStaff"), setChips(b + "role", "str", roleOpts(), "roles")) +
        field("calendar", t("stDays"), dayChips(b + "days")) +
        field("truck", t("stVehicle"), input(b + "vehicle", { upper: true, kind: "upper" })) +
        field("cash", t("stCash"), yesNo(b + "cash"));
    } else if (p.type === "supplier") {
      body +=
        field("building", t("suCompanies"), setChips(b + "companies", "arr", companyOpts())) +
        field("hash", t("suCode"), input(b + "code")) +
        field("receipt", t("suGst"), input(b + "gst", { upper: true, kind: "upper", max: 15 })) +
        field("timer", t("suLead"), setChips(b + "lead", "num", [1, 2, 3, 7].map(function (n) { return { v: n, label: t("daysN", { n: n }) }; }))) +
        field("ledger", t("suOwe"), input(b + "owe", { kind: "num", mode: "numeric" }), h(t("shOwesHint")));
    }
    body += field("tag", t("pIsA"), setChips(b + "type", "str", typeOpts(true))) +
      '<button class="sb-btn is-bad wide" data-act="delPerson" data-id="' + h(p.id) + '">' + ic("trash", 18) + h(t("pRemove")) + "</button>";
    return sheetWrap(h(p.name), body, '<button class="sb-cta" data-act="closeSheet">' + h(t("done")) + "</button>");
  };

  SHEETS.papers = function () {
    const rec = ui.rec;
    const list = S.papers.slice().reverse();
    return sheetWrap(h(t("paTitle")),
      '<p class="sb-hint is-top">' + h(t("paPhotoHint")) + "</p>" +
      '<div class="stack">' +
      '<button class="sb-cta" data-act="photo" data-for="paper">' + ic("camera", 20) + h(t("paPhoto")) + "</button>" +
      '<button class="sb-btn wide" data-act="gallery">' + ic("gallery", 18) + h(S.lang === "en" ? "From gallery" : "गैलरी से") + "</button>" +
      (canRecord ? (rec ? '<button class="sb-btn is-bad wide" data-act="recStop">' + ic("stop", 18) + h(t("paStop")) + ' · <span id="recT">' + h(t("paRecording", { s: 0 })) + "</span></button>"
        : '<button class="sb-btn wide" data-act="recStart">' + ic("mic", 18) + h(t("paVoice")) + "</button>") : "") + "</div>" +
      (list.length ? '<div class="papers">' + list.map(function (p) {
        return '<div class="paper">' + (p.kind === "photo" ? thumb(p.id) : '<audio controls preload="none" data-paper-audio="' + h(p.id) + '"></audio>') +
          "<small>" + ic(ICON[p.step] || "camera", 14) + h(t("title_" + p.step)) + "</small>" +
          '<button class="sb-icbtn" data-act="delPaper" data-id="' + h(p.id) + '" aria-label="' + h(t("paDelete")) + '">' + ic("trash", 16) + "</button></div>";
      }).join("") + "</div>" : '<p class="sb-muted center-text">' + h(t("paNone")) + "</p>"));
  };

  /* ───────────────────────────────────────────────────────── render ── */

  /* A redraw must never take the cursor away: the box that had focus (or
     the one just tapped, when a redraw follows a blur) gets it back, with
     its caret and anything typed in an unbound box. */
  function focusKey(a) {
    if (!a || !/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return null;
    if (a.id) return "#" + a.id;
    if (a.dataset.bind) return '[data-bind="' + a.dataset.bind + '"]';
    if (a.dataset.search) return '[data-search="' + a.dataset.search + '"]';
    return null;
  }

  function render() {
    const a = document.activeElement;
    const fk = focusKey(a);
    const caret = fk && a.selectionStart != null ? [a.selectionStart, a.selectionEnd] : null;
    const loose = fk && a.id ? a.value : null;
    document.documentElement.lang = S.lang === "en" ? "en" : "hi";
    const prevBody = $sheet.querySelector(".sheet-body");
    const keep = prevBody && sheet && prevBody.dataset.kind === sheet.kind + (sheet.id || "") ? prevBody.scrollTop : 0;
    $app.innerHTML = (SCREENS[view] || SCREENS.home)();
    $app.classList.toggle("is-sa", view === "stock");
    const sa = sheet && SHEETS[sheet.kind] && SHEETS[sheet.kind].sa;
    if (sa) {
      /* The platform's own sheet (Godown stock): a bottom sheet, or a centred card. */
      $sheet.innerHTML = '<div class="sa sah-sheet-scrim' + (sa === "center" ? " center" : "") + '" data-act="saScrim"><div class="sah-sheet" role="dialog" aria-modal="true">' + SHEETS[sheet.kind](sheet) + "</div></div>";
    } else if (sheet && SHEETS[sheet.kind]) {
      $sheet.innerHTML = '<div class="scrim" data-act="closeSheet"></div><div class="sheet" role="dialog" aria-modal="true">' + SHEETS[sheet.kind](sheet) + "</div>";
      const body = $sheet.querySelector(".sheet-body");
      if (body) { body.dataset.kind = sheet.kind + (sheet.id || ""); body.scrollTop = keep; }
    } else {
      $sheet.innerHTML = "";
    }
    document.body.classList.toggle("has-sheet", !!sheet);
    if (fk) {
      const n = document.querySelector(fk);
      if (n) {
        if (loose != null) n.value = loose;
        n.focus({ preventScroll: true });
        if (caret) try { n.setSelectionRange(caret[0], caret[1]); } catch (e) { /* not a text box */ }
      }
    }
    hydrate();
    if (ui.saFlash && view === "stock" && !sheet) { saFlash(ui.saFlash); ui.saFlash = null; }
  }

  function refreshList(key) {
    if (key === "itemsQ") document.getElementById("list").innerHTML = itemsBody();
    else if (key === "peopleQ") document.getElementById("plist").innerHTML = peopleList(peopleTab());
    hydrate();
  }

  function paperUrl(id) {
    if (urls[id]) return Promise.resolve(urls[id]);
    return DB.get(id).then(function (b) { if (!b) return ""; urls[id] = URL.createObjectURL(b); return urls[id]; }).catch(function () { return ""; });
  }

  function hydrate() {
    document.querySelectorAll("img[data-paper]:not([src])").forEach(function (img) {
      paperUrl(img.dataset.paper).then(function (u) { if (u) img.src = u; });
    });
    document.querySelectorAll("audio[data-paper-audio]:not([src])").forEach(function (a) {
      paperUrl(a.dataset.paperAudio).then(function (u) { if (u) a.src = u; });
    });
    if (sheet && sheet.kind === "scan" && !ui.stream && !ui.scanStarting) startScan();
    if (ui.dict) markMic();
    document.querySelectorAll("textarea[data-bind]").forEach(fitArea);
  }

  /* An address box grows with what's in it, so a found address shows whole. */
  function fitArea(el) { el.style.height = "auto"; el.style.height = el.scrollHeight + 2 + "px"; }

  function syncSave() { M.syncCompanies(CAT, S); save(); }

  function go(to) {
    stopMedia();
    sheet = null;
    ui.sheetStack = [];
    view = to;
    history.pushState({ to: to }, "", "#" + to);
    render();
    window.scrollTo(0, 0);
  }

  /* A sheet opened from a sheet (a product from Your products) returns to it. */
  function openSheet(sh) {
    if (sheet) ui.sheetStack.push(sheet);
    sheet = sh;
    history.pushState({ to: view, sheet: 1 }, "", location.hash);
    render();
  }

  function closeSheet() { if (sheet) history.back(); }

  window.addEventListener("popstate", function (e) {
    stopMedia();
    if (sheet) { sheet = ui.sheetStack.pop() || null; render(); return; }
    view = (e.state && e.state.to) || (S.startedAt ? "home" : "welcome");
    render();
    window.scrollTo(0, 0);
  });

  /* ──────────────────────────────────────────────── camera and voice ── */

  function stopMedia() {
    if (ui.stream) { ui.stream.getTracks().forEach(function (tr) { tr.stop(); }); ui.stream = null; }
    clearTimeout(ui.scanTimer);
    if (ui.rec && ui.rec.mr.state !== "inactive") ui.rec.mr.stop();
    stopDictate();
  }

  function compress(file) {
    return new Promise(function (res) {
      const img = new Image();
      const u = URL.createObjectURL(file);
      img.onload = function () {
        const max = 1400;
        const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
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

  async function addPhotos(files) {
    const target = ui.photoFor || "paper";
    for (const f of files) {
      const b = await compress(f);
      const id = M.uid("ph");
      await DB.put(id, b);
      S.papers.push({ id: id, kind: "photo", step: view, at: Date.now(), mime: b.type || "image/jpeg", note: target === "draft" ? "product photo" : "" });
      if (target === "draft" && sheet && sheet.draft) sheet.draft.photo = id;
    }
    save();
    render();
    toast("✓ " + t("paSaved"));
  }

  async function recStart() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      const chunks = [];
      const started = Date.now();
      ui.rec = { mr: mr, chunks: chunks, started: started };
      mr.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
      mr.onstop = async function () {
        stream.getTracks().forEach(function (tr) { tr.stop(); });
        clearInterval(ui.rec && ui.rec.tick);
        ui.rec = null;
        if (chunks.length) {
          const blob = new Blob(chunks, { type: mr.mimeType || "audio/webm" });
          const id = M.uid("vn");
          await DB.put(id, blob);
          S.papers.push({ id: id, kind: "voice", step: view, at: Date.now(), mime: blob.type });
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
    } catch (e) {
      toast(t("paNoMic"));
    }
  }

  async function startScan() {
    if (!document.getElementById("scanVideo")) return;
    ui.scanStarting = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      ui.scanStarting = false;
      const video = document.getElementById("scanVideo");
      if (!sheet || sheet.kind !== "scan" || !video) { stream.getTracks().forEach(function (tr) { tr.stop(); }); return; }
      ui.stream = stream;
      video.srcObject = stream;
      await video.play();
      const det = new window.BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"] });
      const loop = async function () {
        if (!ui.stream) return;
        try {
          const codes = await det.detect(video);
          if (codes.length) { onBarcode(codes[0].rawValue); return; }
        } catch (e) { /* frame not ready */ }
        ui.scanTimer = setTimeout(loop, 250);
      };
      loop();
    } catch (e) {
      ui.scanStarting = false;
      toast(t("scNoCamera"));
      closeSheet();
    }
  }

  function onBarcode(code) {
    stopMedia();
    if (navigator.vibrate) navigator.vibrate(80);
    const id = M.findBarcode(CAT, S, code);
    if (id) {
      if (!S.items[id]) S.items[id] = { unit: "case" };
      syncSave();
      toast(t("scFound", { name: M.item(CAT, S, id).name }));
      closeSheet();
    } else {
      sheet = { kind: "newItem", draft: { barcode: code, company: "", cat: "other", caseQty: 1, loose: false, per: "kg" } };
      render();
      toast(t("scNew"));
    }
  }

  /* Use my location: the GPS point, then the address for it from OpenStreetMap's
     Nominatim (free, no key, the map data the platform already draws). The
     address is always in English, the way bills and GST papers write it: OSM's
     Hindi names are patchy and come back half Devanagari, half Latin. It fills
     the address box when the box is empty or still holds the last found
     address; anything he typed himself stays. */
  function locate() {
    if (!navigator.geolocation) { toast(t("fLocFail")); return; }
    if (ui.locating) return;
    ui.locating = true;
    toast(t("fLocWait"));
    navigator.geolocation.getCurrentPosition(function (pos) {
      const prev = S.store.loc && S.store.loc.address;
      const loc = S.store.loc = { lat: pos.coords.latitude, lng: pos.coords.longitude, acc: Math.round(pos.coords.accuracy) };
      save();
      render();
      toast(t("fAddrWait"));
      findAddress(loc.lat, loc.lng).then(function (addr) {
        ui.locating = false;
        if (S.store.loc !== loc) return;
        if (!addr) { toast("✓ " + t("fLocSaved") + " · " + t("fAddrNone")); return; }
        loc.address = addr;
        const cur = (S.store.address || "").trim();
        const fill = !cur || cur === prev;
        if (fill) S.store.address = addr;
        save();
        render();
        toast("✓ " + t(fill ? "fAddrAdded" : "fAddrKept"));
      });
    }, function (e) {
      ui.locating = false;
      toast(t(e && e.code === 1 ? "fLocDenied" : "fLocFail"));
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
  }

  function findAddress(lat, lng) {
    const url = "https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&addressdetails=1&accept-language=en" +
      "&lat=" + lat.toFixed(6) + "&lon=" + lng.toFixed(6);
    const ctl = "AbortController" in window ? new AbortController() : null;
    const stop = setTimeout(function () { if (ctl) ctl.abort(); }, 10000);
    return fetch(url, { headers: { Accept: "application/json" }, signal: ctl ? ctl.signal : undefined })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { return j ? M.shortAddress(j.address) : ""; })
      .catch(function () { return ""; })
      .then(function (a) { clearTimeout(stop); return a; });
  }

  /* Speak to type (Web Speech). Chrome and Edge on Android and desktop, Safari
     14.5+ on iPhone and Mac (only with Siri / Dictation on); not Firefox, not
     most in-app browsers. One listener at a time, tap the mic again to stop.
     Every failure says what to do; where the service is missing for good the
     mics go for the session and the keyboard's own mic key is the way. */
  const MIC_ERR = { "not-allowed": "micBlocked", "no-speech": "micNoSpeech", "audio-capture": "micNone", network: "micNet" };

  function dictate(path) {
    if (ui.dict) { const same = ui.dict.path === path; stopDictate(); if (same) return; }
    if (!SR || ui.micOff) { toast(t("micUnsupported")); return; }
    let r;
    try { r = new SR(); } catch (e) { micGone(); return; }
    r.lang = S.lang === "en" ? "en-IN" : "hi-IN";
    r.interimResults = false;
    r.maxAlternatives = 1;
    const d = ui.dict = { r: r, path: path, heard: false };
    r.onresult = function (e) {
      const last = e.results[e.results.length - 1];
      const said = last && last[0] ? last[0].transcript.trim() : "";
      if (!said) return;
      d.heard = true;
      /* A name is said again to fix it; an address is said in parts. */
      const el = document.querySelector('[data-bind="' + path + '"]');
      const cur = el && el.tagName === "TEXTAREA" ? getPath(path) || "" : "";
      const v = (cur ? cur + " " : "") + said;
      setPath(path, v);
      if (path[0] !== "@") save();
      if (el) { el.value = v; if (el.tagName === "TEXTAREA") fitArea(el); }
    };
    r.onnomatch = function () { d.err = "no-speech"; };
    r.onerror = function (e) { if (!d.err || e.error !== "aborted") d.err = e.error; };
    r.onend = function () {
      if (ui.dict !== d) return;
      endDictate();
      /* Brave and some webviews answer "network" every time while online: twice in a row means no service. */
      ui.micNetFails = d.err === "network" && navigator.onLine ? (ui.micNetFails || 0) + 1 : 0;
      if (d.err === "service-not-allowed" || d.err === "language-not-supported" || ui.micNetFails >= 2) micGone();
      else if (d.err && d.err !== "aborted") toast(t(MIC_ERR[d.err] || "micFail"));
      else if (!d.heard && !d.stopped) toast(t("micNoSpeech"));
    };
    if (canSpeak) speechSynthesis.cancel();
    try { r.start(); } catch (e) { endDictate(); toast(t("micFail")); return; }
    /* Some webviews never answer: give up after 15 s rather than listen forever. */
    d.timer = setTimeout(function () { if (ui.dict === d) { d.err = d.err || "no-speech"; try { r.abort(); } catch (e) { /* gone */ } setTimeout(function () { if (ui.dict === d) r.onend(); }, 400); } }, 15000);
    markMic();
    toast(t("listening"));
  }

  function stopDictate() {
    const d = ui.dict;
    if (!d) return;
    d.stopped = true;
    try { d.r.stop(); } catch (e) { /* not started */ }
    endDictate();
  }

  function endDictate() {
    if (ui.dict) clearTimeout(ui.dict.timer);
    ui.dict = null;
    markMic();
  }

  function micGone() { endDictate(); ui.micOff = true; render(); toast(t("micUnsupported")); }

  function markMic() {
    document.querySelectorAll('[data-act="dictate"]').forEach(function (b) {
      const on = !!ui.dict && ui.dict.path === b.dataset.path;
      b.classList.toggle("is-on", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  function addMany(list, src, type) {
    let a = 0, d = 0;
    list.forEach(function (c) {
      if (!c.name && !c.phone) return;
      const r = M.addPerson(S, { name: c.name || c.phone, phone: M.phone10(c.phone) || c.phone || "", src: src, type: type || null });
      if (r.dup) d++; else a++;
    });
    save();
    render();
    toast(t("pAdded", { n: a }) + (d ? " · " + t("pDup", { n: d }) : ""));
  }

  /* ───────────────────────────────────────────────────────── export ── */

  async function gatherBlobs() {
    const out = {};
    for (const p of S.papers) {
      const b = await DB.get(p.id).catch(function () { return null; });
      if (b) out[p.id] = { bytes: new Uint8Array(await b.arrayBuffer()), mime: b.type || p.mime };
    }
    return out;
  }

  function download(blob, name) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  }

  /* ──────────────────────────────────────────────────────── actions ── */

  const ACT = {
    go: function (el) {
      if (el.dataset.to === "people") ui.peopleTab = el.dataset.tab || null;
      if (el.dataset.to === "stock") { ui.saQ = ""; ui.saOpen = ui.saAdding = ui.saConfirm = false; }
      go(el.dataset.to);
    },
    saveStep: function (el) {
      save();
      go("home");
      toast("✓ " + t("savedStep", { step: t("title_" + el.dataset.step) }));
    },
    skip: function (el) { S.skipped[el.dataset.step] = true; save(); if (el.dataset.stay) render(); else go("home"); },
    lang: function (el) {
      S.lang = el.dataset.v; save();
      if (view === "welcome") render(); else closeSheet();
    },
    start: function () { if (!S.lang) S.lang = "hi"; if (!S.startedAt) S.startedAt = Date.now(); save(); go("store"); },
    speak: function (el) { speak(t(el.dataset.key)); },
    menu: function () { openSheet({ kind: "menu" }); },
    closeSheet: function () { closeSheet(); },
    papers: function (el) { openSheet({ kind: "papers" }); if (el.dataset.rec && canRecord) recStart(); },
    ui: function (el) { ui[el.dataset.k] = el.dataset.v; render(); },

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
    },
    step: function (el) {
      const path = el.dataset.path;
      const d = Number(el.dataset.d);
      const min = el.dataset.min != null ? Number(el.dataset.min) : 0;
      const max = el.dataset.max != null ? Number(el.dataset.max) : Infinity;
      const cur = getPath(path);
      const base = el.dataset.base != null ? Number(el.dataset.base) : null;
      let v = cur == null || cur === "" ? (base != null ? base + d : d > 0 ? d : 0) : Number(cur) + d;
      v = Math.min(max, Math.max(min, Math.round(v * 100) / 100));
      if (v <= 0 && el.dataset.zero) setPath(path, null); else setPath(path, v);
      if (el.dataset.touch) setPath(el.dataset.touch, true);
      if (path[0] !== "@") save();
      render();
    },

    locate: locate,
    dictate: function (el) { dictate(el.dataset.path); },
    addGodown: function () {
      /* An empty one is already waiting: go to it rather than stack another. */
      const list = S.store.godowns;
      if (!list.length || String(list[list.length - 1] || "").trim()) { list.push(""); save(); render(); }
      const boxes = document.querySelectorAll('textarea[data-bind^="store.godowns."]');
      if (boxes.length) boxes[boxes.length - 1].focus();
    },
    delGodown: function (el) { S.store.godowns.splice(Number(el.dataset.i), 1); save(); render(); },
    addArea: function (el) {
      const inp = document.getElementById("areaNew");
      const v = (inp && inp.value || "").trim();
      if (!v) return;
      inp.value = "";
      if (S.store.areas.indexOf(v) < 0) S.store.areas.push(v);
      if (el.dataset.person && S.people[el.dataset.person]) S.people[el.dataset.person].area = v;
      save();
      render();
    },
    photo: function (el) { ui.photoFor = el.dataset.for; document.getElementById("filePhoto").click(); },
    gallery: function () { ui.photoFor = "paper"; document.getElementById("fileGallery").click(); },
    recStart: recStart,
    recStop: function () { if (ui.rec) ui.rec.mr.stop(); },
    delPaper: function (el) {
      const id = el.dataset.id;
      S.papers = S.papers.filter(function (p) { return p.id !== id; });
      if (S.store.photo === id) S.store.photo = null;
      DB.del(id).catch(function () {});
      save();
      render();
    },

    toggleItem: function (el) {
      const id = el.dataset.id;
      if (S.items[id]) delete S.items[id];
      else S.items[id] = { unit: "case" };
      syncSave();
      render();
    },
    pickAll: function () {
      const ids = groupIds(sheet.by, sheet.id);
      const all = ids.every(function (id) { return S.items[id]; });
      ids.forEach(function (id) { if (all) delete S.items[id]; else if (!S.items[id]) S.items[id] = { unit: "case" }; });
      syncSave();
      render();
    },
    picker: function (el) { openSheet({ kind: "picker", by: el.dataset.by, id: el.dataset.id }); },
    mine: function () { openSheet({ kind: "mine" }); },
    itemSheet: function (el) { openSheet({ kind: "item", id: el.dataset.id }); },
    removeItem: function (el) { delete S.items[el.dataset.id]; syncSave(); closeSheet(); },
    newItem: function () { openSheet({ kind: "newItem", draft: { name: ui.itemsQ || "", company: "", cat: "other", caseQty: 1, loose: false, per: "kg" } }); },
    saveItem: function () {
      const d = sheet.draft;
      if (!(d.name || "").trim()) { toast(t("isName")); return; }
      if (!d.company && (d.companyName || "").trim()) {
        const cid = M.uid("co");
        S.customCompanies.push({ id: cid, name: d.companyName.trim(), short: d.companyName.trim(), color: "#6B7280" });
        d.company = cid;
      }
      const id = M.uid("new");
      if (d.loose) {
        S.customItems[id] = { name: d.name.trim(), brand: "", company: "", pack: d.per || "kg", per: d.per || "kg", loose: true, mrp: null, caseQty: 1, cat: d.cat || "other", photo: d.photo || null, barcode: "" };
        S.items[id] = { unit: "piece", sell: d.sell != null ? d.sell : undefined, touched: d.sell != null ? { sell: true } : {} };
      } else {
        S.customItems[id] = { name: d.name.trim(), brand: "", company: d.company || "", pack: d.pack || "", mrp: d.mrp || null, caseQty: d.caseQty || 1, cat: d.cat || "other", photo: d.photo || null, barcode: d.barcode || "" };
        S.items[id] = { unit: "case", barcode: d.barcode || "", touched: { mrp: true } };
      }
      if (sheet.toCount) { saDraft().sel.unshift(id); ui.saQ = ""; ui.saOpen = ui.saAdding = false; }
      syncSave();
      closeSheet();
      toast("✓ " + d.name.trim());
    },
    scan: function () { openSheet({ kind: "scan" }); },

    pick: async function () {
      if (!canPick()) { openSheet({ kind: "noPicker" }); return; }
      try {
        const list = await navigator.contacts.select(["name", "tel"], { multiple: true });
        if (!list || !list.length) return;
        ui.peopleTab = "sort";
        /* A contact can hold several numbers: take the mobile. */
        addMany(list.map(function (c) {
          const tels = c.tel || [];
          const mob = tels.find(function (x) { const d = M.phone10(x); return d.length === 10 && /^[6-9]/.test(d); });
          return { name: (c.name && c.name[0]) || "", phone: mob || tels[0] || "" };
        }), "contact");
      } catch (e) { /* the owner closed the picker */ }
    },
    personNew: function (el) {
      const tab = ["shop", "staff", "supplier"].indexOf(ui.peopleTab) >= 0 ? ui.peopleTab : null;
      openSheet({ kind: "personNew", draft: { name: "", phone: "", type: el.dataset.type || tab }, added: 0 });
    },
    savePerson: function (el) {
      const d = sheet.draft;
      if (!(d.name || "").trim() && !d.phone) return;
      const r = M.addPerson(S, { name: (d.name || "").trim() || d.phone, phone: M.phone10(d.phone) || d.phone || "", type: d.type || null, src: "typed" });
      save();
      if (r.dup) toast(t("pDup", { n: 1 }));
      if (el.dataset.more) {
        sheet.added = (sheet.added || 0) + (r.dup ? 0 : 1);
        sheet.draft = { name: "", phone: "", type: d.type };
        render();
        const first = $sheet.querySelector("input");
        if (first) first.focus();
      } else closeSheet();
    },
    personEdit: function (el) { openSheet({ kind: "personEdit", id: el.dataset.id }); },
    sort: function (el) {
      const p = S.people[el.dataset.id];
      if (!p) return;
      p.type = el.dataset.v;
      ui.lastSorted.push(p.id);
      save();
      render();
    },
    /* Most of his phone book is customers: the rest, in one tap. Undo takes them all back. */
    sortAll: function () {
      const ids = M.unsorted(S).map(function (p) { return p.id; });
      ids.forEach(function (id) { S.people[id].type = "shop"; });
      ui.lastSorted.push(ids);
      save();
      ui.peopleTab = "shop";
      render();
      toast("✓ " + t("pSortedAll", { n: ids.length }));
    },
    undoSort: function () {
      const last = ui.lastSorted.pop();
      [].concat(last || []).forEach(function (id) { if (S.people[id]) S.people[id].type = null; });
      if (last) { save(); if (Array.isArray(last)) ui.peopleTab = "sort"; }
      render();
    },
    delPerson: function (el) { M.removePerson(S, el.dataset.id); save(); closeSheet(); },

    saveFile: async function () {
      toast(t("fiWorking"));
      const p = X.pack(CAT, S, await gatherBlobs(), new Date());
      download(new Blob([p.bytes], { type: "application/zip" }), p.name);
      toast("✓ " + t("fiSaved", { name: p.name }));
    },
    excel: function () {
      const now = new Date();
      download(new Blob([X.xlsx(X.sheets(CAT, S, now))], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), X.fileBase(S, now) + ".xlsx");
    },
    share: async function () {
      const f = X.shareText(CAT, S, await gatherBlobs(), new Date());
      const file = new File([f.text], f.name, { type: "text/plain" });
      try {
        if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file], title: f.name });
        else toast(t("fiShareFail"));
      } catch (e) { if (e.name !== "AbortError") toast(t("fiShareFail")); }
    },
    confirm: function (el) { sheet = { kind: "confirm", what: el.dataset.what }; render(); },

    /* Godown stock: the platform's Stock Audit. */
    saScrim: function (el, e) { if (e.target === el) closeSheet(); },
    saExit: function () { if (saDirty()) openSheet({ kind: "saLeave" }); else { S.stockDraft = null; save(); go("home"); } },
    saDiscard: function () {
      S.stockDraft = null;
      ui.saQ = ""; ui.saOpen = ui.saAdding = ui.saConfirm = false;
      save();
      go("home");
      toast(t("saDiscarded"));
    },
    saAdd: function (el) {
      const id = el.dataset.id;
      if (!S.items[id]) { S.items[id] = { unit: "case" }; M.syncCompanies(CAT, S); }   // counted in his godown, so he sells it
      const d = saDraft();
      if (d.sel.indexOf(id) < 0) d.sel.unshift(id);   // newest on top, where he is looking
      ui.saQ = ""; ui.saOpen = ui.saAdding = ui.saConfirm = false;
      save();
      render();
    },
    saAddBtn: function () {
      ui.saOpen = ui.saAdding = true;
      ui.saConfirm = false;
      saRefresh(true);
      const box = document.getElementById("saQ");
      if (box) box.focus();
    },
    saNew: function () {
      openSheet({ kind: "newItem", toCount: true, draft: { name: ui.saQ.trim(), company: "", cat: "other", caseQty: 1, loose: false, per: "kg" } });
    },
    saStep: function (el) {
      const l = saDraft().lines[el.dataset.id];
      const cur = l && l.qty != null ? l.qty : 0;
      saWrite(el.dataset.id, Math.max(0, cur + Number(el.dataset.d)));
    },
    /* Remove is asked in the row (✓ / ✗), one row at a time. */
    saRemove: function (el) {
      document.querySelectorAll(".qc-row.confirming").forEach(function (r) { r.classList.remove("confirming"); });
      el.closest(".qc-row").classList.add("confirming");
    },
    saRemoveNo: function (el) { el.closest(".qc-row").classList.remove("confirming"); },
    saRemoveYes: function (el) {
      const d = saDraft(), id = el.dataset.id;
      d.sel = d.sel.filter(function (x) { return x !== id; });
      delete d.lines[id];
      ui.saConfirm = false;
      save();
      saRefresh(true);
    },
    saUnit: function (el) {
      const it = M.item(CAT, S, el.dataset.id);
      if (!it) return;
      const cur = saLineUnit(it);
      openSheet({ kind: "saUnit", id: it.id, cur: cur, picked: cur, asking: false });
    },
    saUnitAsk: function () { sheet.asking = true; saUnitRedraw(); },
    saUnitNo: function () { sheet.asking = false; saUnitRedraw(); },
    /* A new unit keeps the number and re-reads it: three of something bigger. */
    saUnitYes: function () {
      const it = M.item(CAT, S, sheet.id);
      if (it) {
        const d = saDraft();
        const l = d.lines[it.id] || (d.lines[it.id] = { qty: null, unit: M.countUnit(it) });
        l.unit = sheet.picked;
        save();
        ui.saFlash = it.id;
      }
      closeSheet();
    },
    saFinish: function () {
      if (!saStats().n) { toast(t("saCountFirst")); return; }
      ui.saConfirm = true;
      saRefresh(false);
    },
    saNo: function () { ui.saConfirm = false; saRefresh(false); },
    saYes: function () {
      if (!S.stockDraft) return;
      const n = M.applyCount(CAT, S, S.stockDraft);
      S.stockDraft = null;
      ui.saQ = ""; ui.saOpen = ui.saAdding = ui.saConfirm = false;
      save();
      go("home");
      toast(t("saSaved", { n: n }));
    },
    fresh: async function () {
      const lang = S.lang;
      localStorage.removeItem(KEY);
      await DB.clear().catch(function () {});
      S = M.blank();
      S.lang = lang;
      save();
      sheet = null;
      go("welcome");
    },
  };

  /* ───────────────────────────────────────────────────────── events ── */

  document.addEventListener("click", function (e) {
    const el = e.target.closest("[data-act]");
    if (!el) return;
    const a = ACT[el.dataset.act];
    if (!a) return;
    if (el.dataset.act === "saScrim" && e.target !== el) return;   // a tap inside the sheet, not on the dim
    e.preventDefault();
    a(el, e);
  });

  document.addEventListener("input", function (e) {
    const el = e.target;
    if (el.dataset.bind) {
      if (el.tagName === "TEXTAREA") fitArea(el);
      let v = el.value;
      const kind = el.dataset.kind;
      if (kind === "num") { v = v.replace(/[^\d.]/g, ""); v = v === "" ? null : Number(v); }
      if (kind === "upper") v = v.toUpperCase();
      setPath(el.dataset.bind, v);
      if (el.dataset.touch) setPath(el.dataset.touch, true);
      if (el.dataset.bind[0] !== "@") save();
    } else if (el.dataset.search) {
      ui[el.dataset.search] = el.value;
      refreshList(el.dataset.search);
    } else if (el.id === "saQ") {
      ui.saQ = el.value;
      ui.saConfirm = false;
      saRefresh(true);
    } else if (el.dataset.saQty != null) {
      /* Typed over a 0, the 0 goes: "05" is 5. Cleared, it is 0 -- he looked. */
      saWrite(el.dataset.saQty, Math.max(0, parseInt(el.value.replace(/\D/g, ""), 10) || 0));
    }
  });

  /* The count's search box opens its list the moment it is tapped, and closes when he taps away.
     The close waits a beat so a tap on a result lands first. */
  document.addEventListener("focusin", function (e) {
    if (e.target.id !== "saQ" || ui.saOpen) return;
    ui.saOpen = true;
    ui.saConfirm = false;
    saRefresh(true);
  });
  document.addEventListener("focusout", function (e) {
    if (e.target.id !== "saQ") return;
    setTimeout(function () {
      if (view !== "stock" || document.activeElement === document.getElementById("saQ") || !ui.saOpen) return;
      ui.saOpen = ui.saAdding = false;
      saRefresh(true);
    }, 150);
  });

  document.addEventListener("change", function (e) {
    const el = e.target;
    if (el.id === "usUnit" && sheet && sheet.kind === "saUnit") {
      const it = M.item(CAT, S, sheet.id);
      sheet.picked = el.value;
      sheet.asking = false;
      const p = document.getElementById("usPrice");
      if (p && it) p.innerHTML = saPriceHTML(it, el.value);
      saUnitRedraw();
      return;
    }
    if (el.dataset.bind && (el.dataset.rerender !== undefined || el.tagName === "SELECT")) setTimeout(render, 0);
    if (el.id === "filePhoto" || el.id === "fileGallery") { if (el.files.length) addPhotos(Array.from(el.files)); el.value = ""; }
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && e.target.id === "areaNew") { e.preventDefault(); const b = e.target.parentElement.querySelector('[data-act="addArea"]'); if (b) b.click(); }
    if (e.key === "Escape" && sheet) closeSheet();
  });

  if (canSpeak) speechSynthesis.getVoices();

  /* ─────────────────────────────────────────────────────────── start ── */

  M.tidy(CAT, S);   // saves from before 26 Sep: companies chosen on their own step, non-food products
  const hash = location.hash.slice(1);
  view = !S.startedAt ? "welcome" : STEPS.indexOf(hash) >= 0 || hash === "home" ? hash : "home";
  history.replaceState({ to: view }, "", "#" + view);
  render();
})();
