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
  const ICON = { store: "🏪", companies: "🏢", rates: "💰", items: "📦", people: "📱", shops: "🛒", staff: "👷", suppliers: "🚚", usual: "🔁", stock: "🏬", rules: "⚙️", finish: "✅" };
  const $app = document.getElementById("app");
  const $sheet = document.getElementById("sheet");
  const $toast = document.getElementById("toast");

  const canPick = "contacts" in navigator && "ContactsManager" in window;
  const canScan = "BarcodeDetector" in window && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  const canSpeak = "speechSynthesis" in window;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const canRecord = "MediaRecorder" in window && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  let canShareFiles = false;
  try { canShareFiles = !!(navigator.canShare && navigator.canShare({ files: [new File(["x"], "x.txt", { type: "text/plain" })] })); } catch (e) { canShareFiles = false; }

  let S = load();
  let view = "lang";
  let sheet = null;
  const ui = { itemsCo: "", itemsQ: "", compQ: "", stockCo: "", usualQ: "", lastSorted: [], photoFor: null, rec: null, stream: null, scanTimer: null };
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

  /* ─────────────────────────────────────────────── bits of screen ── */

  function chips(opts, isOn, attrs, cls) {
    return '<div class="chips ' + (cls || "") + '">' + opts.map(function (o) {
      return '<button type="button" class="chip' + (isOn(o.v) ? " on" : "") + '" ' + attrs + ' data-v="' + h(o.v) + '">' +
        (o.icon ? '<span class="ci">' + o.icon + "</span>" : "") + h(o.label) + "</button>";
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
    return setChips(path, "bool", [{ v: "1", label: t("yes"), icon: "👍" }, { v: "0", label: t("no"), icon: "✋" }], "two");
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
    const mic = o.mic && SR ? '<button type="button" class="icon-btn mic" data-act="dictate" data-path="' + h(path) + '" aria-label="🎤">🎤</button>' : "";
    return '<div class="inp">' + el + mic + "</div>";
  }

  function field(icon, label, inner, hint) {
    inner = inner.replace(/<(input|textarea|select) (?![^>]*aria-label)/, '<$1 aria-label="' + h(label) + '" ');
    return '<section class="card field"><label><span class="fi">' + icon + "</span>" + h(label) + "</label>" + inner + (hint ? '<p class="hint">' + hint + "</p>" : "") + "</section>";
  }

  function stepper(path, o) {
    o = o || {};
    const own = getPath(path);
    const v = own == null && o.base != null ? o.base : own;
    const a = ' data-path="' + h(path) + '"' + (o.base != null ? ' data-base="' + o.base + '"' : "") + (o.min != null ? ' data-min="' + o.min + '"' : "") + (o.max != null ? ' data-max="' + o.max + '"' : "") +
      (o.zero ? ' data-zero="del"' : "") + (o.touch ? ' data-touch="' + h(o.touch) + '"' : "");
    return '<div class="stepper' + (o.small ? " small" : "") + '">' +
      '<button type="button" data-act="step" data-d="-' + (o.by || 1) + '"' + a + ' aria-label="−">−</button>' +
      '<input data-bind="' + h(path) + '" data-kind="num" data-rerender inputmode="decimal" value="' + h(v == null ? "" : v) + '" placeholder="–"' + (o.touch ? ' data-touch="' + h(o.touch) + '"' : "") + ">" +
      '<button type="button" data-act="step" data-d="' + (o.by || 1) + '"' + a + ' aria-label="+">+</button></div>';
  }

  /* A pack: his own photo, else the real catalogue photo, else the category's picture. */
  function packTile(it, small) {
    const co = M.companyById(CAT, S, it.company);
    const img = it.photo ? '<img data-paper="' + h(it.photo) + '" alt="">'
      : it.img ? '<img src="' + h(it.img) + '" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">' : "";
    return '<div class="pack' + (small ? " sm" : "") + (img ? " photo" : "") + '" style="--c:' + (co ? co.color : "#6B7280") + '">' +
      img + '<span class="pi">' + it.icon + "</span>" + (small ? "" : "<small>" + h(co ? co.short : "") + "</small>") + "</div>";
  }

  function thumb(id) { return '<img class="thumb" data-paper="' + h(id) + '" alt="">'; }

  function papersBadge() {
    const n = S.papers.length;
    return n ? '<i class="badge">' + n + "</i>" : "";
  }

  function frame(step, body, foot) {
    const i = STEPS.indexOf(step);
    const next = STEPS[i + 1];
    return '<header class="bar">' +
      '<button class="icon-btn" data-act="go" data-to="home" aria-label="' + h(t("home")) + '">🏠</button>' +
      '<div class="bar-title"><small>' + h(t("stepOf", { n: i + 1, total: STEPS.length })) + "</small><b>" + h(t("title_" + step)) + "</b></div>" +
      '<button class="icon-btn" data-act="papers" aria-label="' + h(t("papers")) + '">📷' + papersBadge() + "</button>" +
      "</header>" +
      '<div class="progress"><i style="width:' + Math.round((i + 1) / STEPS.length * 100) + '%"></i></div>' +
      '<main class="page">' +
      '<div class="ask"><span class="ask-icon">' + ICON[step] + "</span><p>" + h(t("q_" + step)) + "</p>" +
      (canSpeak ? '<button class="icon-btn speak" data-act="speak" data-key="q_' + step + '" aria-label="' + h(t("listen")) + '">🔊</button>' : "") + "</div>" +
      body + "</main>" +
      (next ? '<footer class="foot">' + (foot || "") + '<button class="btn primary big" data-act="next" data-step="' + step + '">' + h(t("next")) + " ➜</button></footer>" : "");
  }

  /* ─────────────────────────────────────────────────────── screens ── */

  const SCREENS = {};

  SCREENS.lang = function () {
    return '<main class="page center">' +
      '<div class="logo">🏪</div><p class="brand">FoodBridge</p>' +
      '<h1 class="lang-title">अपनी भाषा चुनें<small>Choose your language</small></h1>' +
      '<button class="btn big lang" data-act="lang" data-v="hi">हिंदी</button>' +
      '<button class="btn big lang" data-act="lang" data-v="en">English</button></main>';
  };

  SCREENS.welcome = function () {
    return '<main class="page center">' +
      '<div class="logo">🏪</div><p class="brand">FoodBridge</p>' +
      "<h1>" + h(t("wTitle")) + "</h1><p class=\"lead\">" + h(t("wSub")) + "</p>" +
      '<ul class="how"><li><span>👆</span>' + h(t("tProducts")) + " · " + h(t("tShops")) + " · " + h(t("tStaff")) + "</li>" +
      "<li><span>📷</span>" + h(t("paPhotoHint")) + "</li><li><span>💾</span>" + h(t("fiSave")) + "</li></ul>" +
      '<button class="btn primary big" data-act="start">' + h(t("wStart")) + " ➜</button>" +
      '<button class="btn link" data-act="openFile">' + h(t("wHaveFile")) + "</button></main>";
  };

  function statusText(step, P) {
    const p = P[step];
    switch (step) {
      case "store": return S.store.name || t("sNone");
      case "companies": return p.n ? t("sCompanies", { n: p.n }) : t("sNone");
      case "rates": return p.done ? "✓" : p.n ? t("sCompanies", { n: p.n }) : t("sNone");
      case "items": return p.n ? t("sItems", { n: p.n }) : t("sNone");
      case "people": return p.n ? t("sPeople", { n: p.n }) + (M.unsorted(S).length ? " · " + t("pLeft", { n: M.unsorted(S).length }) : "") : t("sNone");
      case "shops": return p.n ? t("sShops", { n: p.n }) : t("sNone");
      case "staff": return p.n ? t("sStaff", { n: p.n }) : S.skipped.staff ? t("sSkipped") : t("sNone");
      case "suppliers": return p.n ? t("sSup", { n: p.n }) : S.skipped.suppliers ? t("sSkipped") : t("sNone");
      case "usual": return p.n ? t("sUsual", { n: p.n }) : t("sNone");
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
    return '<header class="bar home">' +
      '<div class="bar-title"><small>FoodBridge</small><b>' + h(t("appName")) + "</b></div>" +
      '<button class="icon-btn" data-act="papers" aria-label="' + h(t("papers")) + '">📷' + papersBadge() + "</button>" +
      '<button class="icon-btn" data-act="menu" aria-label="menu">⋯</button></header>' +
      '<main class="page">' +
      '<section class="hero">' + (S.store.photo ? thumb(S.store.photo) : '<span class="hero-icon">🏪</span>') +
      "<div><b>" + h(S.store.name || t("hTitle")) + "</b><small>" + h(t("hProgress", { n: done, total: work.length })) + "</small>" +
      '<div class="progress in"><i style="width:' + Math.round(done / work.length * 100) + '%"></i></div></div></section>' +
      '<ol class="steps">' + STEPS.map(function (s, i) {
        const d = P[s].done;
        return '<li><button data-act="go" data-to="' + s + '" class="' + (d ? "done" : "") + (s === nextStep ? " next" : "") + '">' +
          '<span class="num">' + (d ? "✓" : i + 1) + '</span><span class="si">' + ICON[s] + "</span>" +
          '<span class="st"><b>' + h(t("title_" + s)) + "</b><small>" + h(statusText(s, P)) + "</small></span><span class=\"chev\">›</span></button></li>";
      }).join("") + "</ol></main>" +
      '<footer class="foot"><button class="btn primary big" data-act="go" data-to="' + nextStep + '">' +
      h(nextStep === "finish" ? t("hGoSend") : t("hContinue") + ": " + t("title_" + nextStep)) + " ➜</button></footer>";
  };

  SCREENS.store = function () {
    const st = S.store;
    const gst = st.gst ? (M.gstOk(st.gst) ? '<span class="ok">✓ ' + h(t("fGstOk")) + "</span>" : '<span class="warn">⚠ ' + h(t("fGstBad")) + "</span>") : "";
    const loc = st.loc
      ? '<p class="ok big">📍 ' + h(t("fLocSaved")) + ' ✓</p><button class="btn" data-act="locate">' + h(t("change")) + "</button>"
      : '<button class="btn primary" data-act="locate">📍 ' + h(t("fLocBtn")) + "</button>";
    const areas = '<div class="chips">' + (st.areas || []).map(function (a, i) {
      return '<span class="chip on">' + h(a) + '<button class="x" data-act="delArea" data-i="' + i + '" aria-label="' + h(t("remove")) + '">✕</button></span>';
    }).join("") + "</div>" +
      '<div class="inp row"><input id="areaNew" type="text" placeholder="' + h(t("fAreaPh")) + '" autocomplete="off"><button class="btn" data-act="addArea">＋ ' + h(t("add")) + "</button></div>";
    return frame("store",
      field("🏪", t("fShopName"), input("store.name", { mic: true })) +
      field("👤", t("fOwner"), input("store.owner", { mic: true })) +
      field("📱", t("fMobile"), input("store.mobile", { type: "tel", mode: "tel", max: 14 }), h(t("fMobileHint"))) +
      field("🧾", t("fGst"), input("store.gst", { kind: "upper", upper: true, max: 15, rerender: true }), h(t("fGstHint")) + " " + gst) +
      field("🏷️", t("fType"), setChips("store.type", "str", [
        { v: "distributor", label: t("tDistributor") }, { v: "superstockist", label: t("tSuperstockist") },
        { v: "wholesaler", label: t("tWholesaler") }, { v: "cnf", label: t("tCnf") }, { v: "retailer", label: t("tRetailer") }])) +
      field("🏭", t("fMakes"), yesNo("store.makes")) +
      field("📍", t("fLoc"), loc + '<div class="gap"></div>' + input("store.address", { area: true, mic: true, ph: t("fAddress") })) +
      field("🏬", t("fGodown"), setChips("store.godownSame", "bool", [{ v: "1", label: t("gSame") }, { v: "0", label: t("gOther") }], "two") +
        (st.godownSame === false ? input("store.godownAddress", { area: true, mic: true, ph: t("fGodownAddr") }) : "")) +
      field("🗺️", t("fAreas"), areas) +
      field("📸", t("fShopPhoto"), st.photo ? '<div class="photo-row">' + thumb(st.photo) + '<button class="btn" data-act="photo" data-for="store">' + h(t("change")) + "</button></div>"
        : '<button class="btn" data-act="photo" data-for="store">📷 ' + h(t("takePhoto")) + "</button>"));
  };

  function companyTiles() {
    const q = ui.compQ.toLowerCase().trim();
    const list = M.companyList(CAT, S).filter(function (c) {
      if (!q) return true;
      const brands = CAT.items.filter(function (x) { return x.company === c.id; }).map(function (x) { return x.brand; }).join(" ");
      return (c.name + " " + c.short + " " + brands).toLowerCase().indexOf(q) >= 0;
    });
    return '<div class="tiles">' + list.map(function (c) {
      const on = !!S.companies[c.id];
      const brands = [];
      CAT.items.forEach(function (x) { if (x.company === c.id && brands.indexOf(x.brand) < 0) brands.push(x.brand); });
      return '<button class="tile' + (on ? " on" : "") + '" style="--c:' + c.color + '" data-act="toggleCompany" data-id="' + h(c.id) + '">' +
        '<span class="tick">' + (on ? "✓" : "") + "</span><b>" + h(c.short) + "</b><small>" + h(brands.slice(0, 4).join(" · ")) + "</small></button>";
    }).join("") + "</div>" +
      '<button class="btn wide" data-act="newCompany">＋ ' + h(t("cNotHere")) + "</button>";
  }

  SCREENS.companies = function () {
    const n = Object.keys(S.companies).length;
    return frame("companies",
      '<div class="search"><input type="search" data-search="compQ" value="' + h(ui.compQ) + '" placeholder="🔍 ' + h(t("cSearch")) + '"></div>' +
      '<div id="list">' + companyTiles() + "</div>",
      n ? '<span class="foot-note">✓ ' + h(t("cSelected", { n: n })) + "</span>" : "");
  };

  SCREENS.rates = function () {
    const cos = M.companyList(CAT, S).filter(function (c) { return S.companies[c.id]; });
    if (!cos.length) return frame("rates", '<div class="empty"><p>' + h(t("rNone")) + '</p><button class="btn primary" data-act="go" data-to="companies">' + h(t("rGoCompanies")) + "</button></div>");
    let changed = false;
    cos.forEach(function (c) { if (!S.companies[c.id].seen) { S.companies[c.id].seen = true; changed = true; } });
    if (changed) save();
    return frame("rates", '<p class="hint top">' + h(t("rHint")) + "</p>" + cos.map(function (c) {
      const r = S.companies[c.id];
      const buy = Number(r.buy) || 0, sell = Number(r.sell) || 0;
      const you = M.round2(sell - buy), shop = M.round2(100 - sell);
      const w = function (x) { return Math.max(0, Math.min(100, x)); };
      return '<section class="card rate" style="--c:' + c.color + '"><h3>' + h(c.short) + "</h3>" +
        '<p class="muted">' + h(t("rOn100")) + "</p>" +
        '<div class="rate-row"><span>🛒 ' + h(t("rYouBuy")) + "</span>" + stepper("companies." + c.id + ".buy", { min: 1, max: 100 }) + "</div>" +
        '<div class="rate-row"><span>🏪 ' + h(t("rYouSell")) + "</span>" + stepper("companies." + c.id + ".sell", { min: 1, max: 100 }) + "</div>" +
        '<div class="rate-bar" aria-hidden="true"><i class="b" style="width:' + w(buy) + '%">₹' + buy + '</i><i class="y" style="width:' + w(you) + '%"></i><i class="s" style="width:' + w(shop) + '%"></i></div>' +
        '<p class="earn"><b class="' + (you < 0 ? "warn" : "ok") + '">' + h(t("rYouEarn", { n: you })) + "</b> · " + h(t("rShopEarns", { n: shop })) + "</p></section>";
    }).join(""));
  };

  function itemIds() {
    const q = ui.itemsQ.trim();
    const co = ui.itemsCo;
    if (q) return M.search(CAT, S, q, co || null);
    if (co) return M.search(CAT, S, "", co);
    const seen = {};
    const out = [];
    const push = function (id) { if (!seen[id]) { seen[id] = 1; out.push(id); } };
    Object.keys(S.items).forEach(push);
    CAT.items.forEach(function (x) { if (S.companies[x.company]) push(x.id); });
    Object.keys(S.customItems).forEach(push);
    return out;
  }

  function itemCard(id) {
    const it = M.item(CAT, S, id);
    if (!it) return "";
    const price = it.on ? '<span class="price">' + h(t("iShopPrice")) + " " + rupee(it.sell) + (it.unit === "case" ? " · " + h(t("iCaseOf", { n: it.caseQty })) + " = " + rupee(M.unitPrice(it, "sell")) : "") + "</span>" : "";
    return '<div class="prod' + (it.on ? " on" : "") + '">' + packTile(it) +
      '<div class="prod-main"' + (it.on ? ' data-act="itemSheet" data-id="' + h(id) + '"' : ' data-act="toggleItem" data-id="' + h(id) + '"') + ">" +
      "<b>" + h(it.name) + '</b><span class="muted">' + h(it.pack) + " · " + h(t("iMrp")) + " " + rupee(it.mrp) + "</span>" + price + "</div>" +
      '<div class="prod-act">' + (it.on ? '<button class="icon-btn" data-act="itemSheet" data-id="' + h(id) + '" aria-label="' + h(t("change")) + '">✎</button>' : "") +
      '<button class="add' + (it.on ? " on" : "") + '" data-act="toggleItem" data-id="' + h(id) + '" aria-label="' + h(it.on ? t("remove") : t("add")) + '">' + (it.on ? "✓" : "＋") + "</button></div></div>";
  }

  function itemsList() {
    const ids = itemIds();
    const co = ui.itemsCo;
    let head = "";
    if (co && !ui.itemsQ) {
      const left = ids.filter(function (id) { return !S.items[id]; }).length;
      if (left) head = '<button class="btn wide" data-act="addAll">＋ ' + h(t("iAddAll", { n: left })) + "</button>";
    }
    if (!ids.length) {
      if (!ui.itemsQ && !Object.keys(S.companies).length) return '<div class="empty"><p>' + h(t("iNoCompanies")) + '</p><button class="btn primary" data-act="go" data-to="companies">' + h(t("rGoCompanies")) + "</button></div>";
      return '<div class="empty"><p>' + h(t("iEmpty")) + '</p><button class="btn primary" data-act="newItem">＋ ' + h(t("iNew")) + "</button></div>";
    }
    return head + ids.map(itemCard).join("");
  }

  function coFilter(key) {
    const cos = M.companyList(CAT, S).filter(function (c) { return S.companies[c.id]; });
    if (!cos.length) return "";
    return '<div class="chips scroll">' + [{ id: "", short: t("iAll") }].concat(cos).map(function (c) {
      return '<button class="chip' + (ui[key] === c.id ? " on" : "") + '" data-act="ui" data-k="' + key + '" data-v="' + h(c.id) + '">' + h(c.short) + "</button>";
    }).join("") + "</div>";
  }

  SCREENS.items = function () {
    const n = Object.keys(S.items).length;
    return frame("items",
      coFilter("itemsCo") +
      '<div class="search"><input type="search" data-search="itemsQ" value="' + h(ui.itemsQ) + '" placeholder="🔍 ' + h(t("iSearch")) + '"></div>' +
      '<div class="tools">' + (canScan ? '<button class="btn" data-act="scan">▦ ' + h(t("iScan")) + "</button>" : "") +
      '<button class="btn" data-act="newItem">＋ ' + h(t("iNew")) + "</button></div>" +
      '<div id="list">' + itemsList() + "</div>" +
      '<p class="credit">' + h(CAT.credit) + "</p>",
      n ? '<span class="foot-note">✓ ' + h(t("iChosen", { n: n })) + "</span>" : "");
  };

  SCREENS.people = function () {
    const u = M.unsorted(S);
    const cur = u[0];
    const shops = M.peopleOf(S, "shop").length, sups = M.peopleOf(S, "supplier").length, staff = M.peopleOf(S, "staff").length;
    const skipped = M.peopleOf(S, "skip");
    let sorter = "";
    if (cur) {
      sorter = '<section class="card sorter"><p class="muted">' + h(t("pWho")) + ' <span class="pill">' + h(t("pLeft", { n: u.length })) + "</span></p>" +
        '<p class="who">' + h(cur.name) + '</p><p class="who-ph">📞 ' + h(M.phoneShow(cur.phone)) + "</p>" +
        '<div class="sort-grid">' +
        '<button class="sort shop" data-act="sort" data-id="' + h(cur.id) + '" data-v="shop"><span>🏪</span>' + h(t("pShop")) + "</button>" +
        '<button class="sort sup" data-act="sort" data-id="' + h(cur.id) + '" data-v="supplier"><span>🚚</span>' + h(t("pSupplier")) + "</button>" +
        '<button class="sort staff" data-act="sort" data-id="' + h(cur.id) + '" data-v="staff"><span>👷</span>' + h(t("pStaff")) + "</button>" +
        '<button class="sort skip" data-act="sort" data-id="' + h(cur.id) + '" data-v="skip"><span>✖</span>' + h(t("pSkip")) + "</button></div>" +
        (ui.lastSorted.length ? '<button class="btn link" data-act="undoSort">↶ ' + h(t("pUndo")) + "</button>" : "") + "</section>";
    } else if (S.order.length) {
      sorter = '<p class="ok big center-text">✓ ' + h(t("pAllSorted")) + "</p>" +
        (ui.lastSorted.length ? '<p class="center-text"><button class="btn link" data-act="undoSort">↶ ' + h(t("pUndo")) + "</button></p>" : "");
    }
    return frame("people",
      '<div class="stack">' +
      (canPick ? '<button class="btn primary big" data-act="pick">📱 ' + h(t("pPick")) + "</button>" : '<p class="hint">' + h(t("pNoPicker")) + "</p>") +
      '<button class="btn big" data-act="vcf">📄 ' + h(t("pFile")) + "</button>" +
      '<button class="btn big" data-act="personNew">✍️ ' + h(t("pType")) + "</button></div>" +
      sorter +
      '<div class="counts">' +
      '<button data-act="go" data-to="shops"><span>🏪</span><b>' + shops + "</b>" + h(t("tShops")) + "</button>" +
      '<button data-act="go" data-to="suppliers"><span>🚚</span><b>' + sups + "</b>" + h(t("tSuppliers")) + "</button>" +
      '<button data-act="go" data-to="staff"><span>👷</span><b>' + staff + "</b>" + h(t("tStaff")) + "</button></div>" +
      (skipped.length ? '<details class="card"><summary>' + h(t("pSkippedList")) + " (" + skipped.length + ")</summary>" + skipped.map(function (p) {
        return '<div class="row-line"><span>' + h(p.name) + ' <small class="muted">' + h(M.phoneShow(p.phone)) + "</small></span>" +
          '<button class="btn small" data-act="set" data-path="people.' + h(p.id) + '.type" data-kind="str" data-v="shop">🏪</button>' +
          '<button class="btn small" data-act="set" data-path="people.' + h(p.id) + '.type" data-kind="str" data-v="supplier">🚚</button>' +
          '<button class="btn small" data-act="set" data-path="people.' + h(p.id) + '.type" data-kind="str" data-v="staff">👷</button></div>';
      }).join("") + "</details>" : ""));
  };

  function payLabel(v) { return v === "cash" ? t("payCash") : v ? t("payDays", { n: v }) : ""; }

  SCREENS.shops = function () {
    const shops = M.peopleOf(S, "shop");
    const body = shops.length ? shops.map(function (p) {
      const bits = [p.area, payLabel(p.pay), p.owes ? t("shOwesShow", { n: Number(p.owes).toLocaleString("en-IN") }) : ""].filter(Boolean).join(" · ");
      return '<section class="card person">' +
        '<div class="person-top"><button class="star' + (p.big ? " on" : "") + '" data-act="set" data-path="people.' + h(p.id) + '.big" data-kind="flip" aria-label="' + h(t("shBig")) + '">' + (p.big ? "★" : "☆") + "</button>" +
        '<div class="pn" data-act="personEdit" data-id="' + h(p.id) + '"><b>' + h(p.name) + "</b><small>" + h(M.phoneShow(p.phone)) + (bits ? " · " + h(bits) : "") + "</small></div>" +
        '<button class="btn small" data-act="personEdit" data-id="' + h(p.id) + '">' + h(t("more")) + " ›</button></div>" +
        dayChips("people." + p.id + ".days") + "</section>";
    }).join("") : '<div class="empty"><p>' + h(t("shEmpty")) + '</p><button class="btn primary" data-act="go" data-to="people">📱 ' + h(t("title_people")) + "</button></div>";
    return frame("shops", '<button class="btn wide" data-act="personNew" data-type="shop">＋ ' + h(t("shAdd")) + "</button>" + body);
  };

  SCREENS.staff = function () {
    const staff = M.peopleOf(S, "staff");
    const body = staff.length ? staff.map(function (p) {
      return '<section class="card person"><div class="person-top"><span class="avatar">👷</span>' +
        '<div class="pn" data-act="personEdit" data-id="' + h(p.id) + '"><b>' + h(p.name) + "</b><small>" + h(M.phoneShow(p.phone)) +
        ((p.days || []).length ? " · " + dayList(p.days) : "") + "</small></div>" +
        '<button class="btn small" data-act="personEdit" data-id="' + h(p.id) + '">' + h(t("more")) + " ›</button></div>" +
        setChips("people." + p.id + ".role", "str", roleOpts(), "roles") + "</section>";
    }).join("") : '<div class="empty"><p>' + h(t("stEmpty")) + "</p>" +
      (S.skipped.staff ? '<p class="muted">✓ ' + h(t("stNone")) + "</p>" : '<button class="btn" data-act="skip" data-step="staff">' + h(t("stNone")) + "</button>") + "</div>";
    return frame("staff", '<button class="btn wide" data-act="personNew" data-type="staff">＋ ' + h(t("stAdd")) + "</button>" + body);
  };

  function roleOpts() {
    return [{ v: "salesman", label: t("roleSalesman"), icon: "🛵" }, { v: "delivery", label: t("roleDelivery"), icon: "🚚" },
      { v: "supervisor", label: t("roleSupervisor"), icon: "👀" }, { v: "office", label: t("roleOffice"), icon: "🧾" }];
  }

  function companyOpts() {
    let cos = M.companyList(CAT, S).filter(function (c) { return S.companies[c.id]; });
    if (!cos.length) cos = M.companyList(CAT, S);
    return cos.map(function (c) { return { v: c.id, label: c.short }; });
  }

  SCREENS.suppliers = function () {
    const sups = M.peopleOf(S, "supplier");
    const body = sups.length ? sups.map(function (p) {
      return '<section class="card person"><div class="person-top"><span class="avatar">🚚</span>' +
        '<div class="pn" data-act="personEdit" data-id="' + h(p.id) + '"><b>' + h(p.name) + "</b><small>" + h(M.phoneShow(p.phone)) +
        (p.owe ? " · " + h(rupee(p.owe)) : "") + "</small></div>" +
        '<button class="btn small" data-act="personEdit" data-id="' + h(p.id) + '">' + h(t("more")) + " ›</button></div>" +
        '<p class="mini">' + h(t("suCompanies")) + "</p>" + setChips("people." + p.id + ".companies", "arr", companyOpts()) + "</section>";
    }).join("") : '<div class="empty"><p>' + h(t("suEmpty")) + "</p>" +
      (S.skipped.suppliers ? '<p class="muted">✓ ' + h(t("suNone")) + "</p>" : '<button class="btn" data-act="skip" data-step="suppliers">' + h(t("suNone")) + "</button>") + "</div>";
    return frame("suppliers", '<button class="btn wide" data-act="personNew" data-type="supplier">＋ ' + h(t("suAdd")) + "</button>" + body);
  };

  SCREENS.usual = function () {
    const shops = M.peopleOf(S, "shop").slice().sort(function (a, b) { return (b.big ? 1 : 0) - (a.big ? 1 : 0); });
    const nItems = Object.keys(S.items).length;
    if (!shops.length) return frame("usual", '<div class="empty"><p>' + h(t("uNoShops")) + '</p><button class="btn primary" data-act="go" data-to="people">' + h(t("title_people")) + "</button></div>");
    if (!nItems) return frame("usual", '<div class="empty"><p>' + h(t("uNoItems")) + '</p><button class="btn primary" data-act="go" data-to="items">' + h(t("title_items")) + "</button></div>");
    const tom = M.tomorrowOrders(CAT, S);
    return frame("usual",
      (tom.length ? '<section class="banner">📅 ' + h(t("uTomorrow", { day: dayName(M.firstDay(CAT, S).day), n: tom.length })) + "</section>" : "") +
      '<p class="hint top">' + h(t("uStarHint")) + "</p>" +
      shops.map(function (p) {
        const lines = M.usualLines(CAT, S, p.id);
        const total = lines.reduce(function (s, l) { return s + (l.amount || 0); }, 0);
        return '<section class="card person"><div class="person-top">' +
          '<button class="star' + (p.big ? " on" : "") + '" data-act="set" data-path="people.' + h(p.id) + '.big" data-kind="flip" aria-label="' + h(t("shBig")) + '">' + (p.big ? "★" : "☆") + "</button>" +
          '<div class="pn" data-act="usualSheet" data-id="' + h(p.id) + '"><b>' + h(p.name) + "</b><small>" + (dayList(p.days) || "–") + "</small></div></div>" +
          (lines.length ? '<button class="btn wide ok-btn" data-act="usualSheet" data-id="' + h(p.id) + '">✓ ' + h(t("uItems", { n: lines.length, amt: rupee(total) })) + " ✎</button>"
            : '<button class="btn wide' + (p.big ? " primary" : "") + '" data-act="usualSheet" data-id="' + h(p.id) + '">＋ ' + h(t("uAdd")) + "</button>") +
          "</section>";
      }).join(""));
  };

  function stockList() {
    const its = M.chosenItems(CAT, S).filter(function (it) { return !ui.stockCo || it.company === ui.stockCo; });
    return its.map(function (it) {
      const counted = it.stockCases != null || it.stockLoose != null;
      return '<section class="card stock' + (counted ? " counted" : "") + '"><div class="stock-top">' + packTile(it, true) +
        "<div><b>" + h(it.name) + '</b><small class="muted">' + h(it.pack) + " · " + h(t("iCaseOf", { n: it.caseQty })) + "</small>" +
        (counted ? "" : '<small class="warn">' + h(t("skNotCounted")) + "</small>") + "</div></div>" +
        '<div class="stock-row"><label>📦 ' + h(t("skCases")) + "</label>" + stepper("items." + it.id + ".stockCases", { min: 0 }) + "</div>" +
        '<div class="stock-row"><label>🔹 ' + h(t("skLoose")) + "</label>" + stepper("items." + it.id + ".stockLoose", { min: 0, small: true }) + "</div></section>";
    }).join("");
  }

  SCREENS.stock = function () {
    if (!Object.keys(S.items).length) return frame("stock", '<div class="empty"><p>' + h(t("skNoItems")) + '</p><button class="btn primary" data-act="go" data-to="items">' + h(t("title_items")) + "</button></div>");
    return frame("stock", coFilter("stockCo") + stockList(),
      S.skipped.stock ? "" : '<button class="btn" data-act="skip" data-step="stock">' + h(t("skLater")) + "</button>");
  };

  SCREENS.rules = function () {
    function q(icon, label, inner) { return field(icon, label, inner); }
    return frame("rules",
      q("💵", t("ruPay"), setChips("rules.payMethods", "arr", [{ v: "cash", label: t("mCash"), icon: "💵" }, { v: "upi", label: t("mUpi"), icon: "📲" },
        { v: "cheque", label: t("mCheque"), icon: "🧾" }, { v: "credit", label: t("mCredit"), icon: "📒" }])) +
      q("🗓️", t("ruRoutes"), yesNo("rules.routes")) +
      q("📲", t("ruSelf"), yesNo("rules.selfOrder")) +
      q("➗", t("ruPart"), yesNo("rules.partPay")) +
      q("↩️", t("ruReturns"), setChips("rules.returns", "str", [{ v: "credit", label: t("retCredit") }, { v: "replace", label: t("retReplace") }, { v: "none", label: t("retNone") }], "col")) +
      q("🪜", t("ruSteps"), setChips("rules.steps", "str", [{ v: "simple", label: t("stepsSimple") }, { v: "dispatch", label: t("stepsDispatch") }], "col")) +
      q("⏳", t("ruBatches"), yesNo("rules.batches")) +
      q("🌅", t("ruMorning"), setChips("rules.morning", "str", [{ v: "orders", label: t("mnOrders"), icon: "🧾" }, { v: "money", label: t("mnMoney"), icon: "💰" },
        { v: "stock", label: t("mnStock"), icon: "📦" }, { v: "trucks", label: t("mnTrucks"), icon: "🚚" }])) +
      '<button class="btn wide big" data-act="papers" data-rec="1">🎤 ' + h(t("ruVoice")) + "</button>");
  };

  SCREENS.finish = function () {
    const its = Object.keys(S.items).length;
    const tom = M.tomorrowOrders(CAT, S);
    const tomTotal = tom.reduce(function (s, o) { return s + o.total; }, 0);
    const gaps = M.missing(CAT, S);
    const tile = function (icon, n, label, to) { return '<button class="tile-sum" data-act="go" data-to="' + to + '"><span>' + icon + "</span><b>" + n + "</b><small>" + h(label) + "</small></button>"; };
    return frame("finish",
      '<div class="sum-grid">' +
      tile("📦", its, t("tProducts"), "items") + tile("🏪", M.peopleOf(S, "shop").length, t("tShops"), "shops") +
      tile("🚚", M.peopleOf(S, "supplier").length, t("tSuppliers"), "suppliers") + tile("👷", M.peopleOf(S, "staff").length, t("tStaff"), "staff") +
      tile("🧾", tom.length + (tom.length ? " · " + rupee(tomTotal) : ""), t("tOrders"), "usual") + tile("📷", S.papers.length, t("tPapers"), "finish") + "</div>" +
      '<section class="card"><h3>' + h(gaps.length ? t("fiMissing") : t("fiNoMissing")) + "</h3>" +
      gaps.map(function (g) {
        return '<button class="gap-row" data-act="go" data-to="' + g.step + '"><span>' + ICON[g.step] + "</span><span>" + h(t("gap_" + g.key)) + "</span>" +
          (g.n > 1 ? '<i class="pill">' + g.n + "</i>" : "") + '<span class="chev">›</span></button>';
      }).join("") + "</section>" +
      '<div class="stack">' +
      '<button class="btn primary big" data-act="saveFile">💾 ' + h(t("fiSave")) + "</button>" +
      (canShareFiles ? '<button class="btn big wa" data-act="share">💬 ' + h(t("fiShare")) + "</button>" : "") +
      '<button class="btn" data-act="excel">📊 ' + h(t("fiExcel")) + "</button></div>" +
      '<section class="card how-send"><h3>' + h(t("fiHow")) + "</h3><ol><li>" + h(t("fiHow1")) + "</li><li>" + h(t("fiHow2")) + "</li><li>" + h(t("fiHow3")) + "</li></ol></section>");
  };

  /* ───────────────────────────────────────────────────────── sheets ── */

  const SHEETS = {};

  function sheetWrap(title, body, foot) {
    return '<div class="sheet-head"><b>' + title + '</b><button class="icon-btn" data-act="closeSheet" aria-label="✕">✕</button></div>' +
      '<div class="sheet-body">' + body + "</div>" + (foot ? '<div class="sheet-foot">' + foot + "</div>" : "");
  }

  SHEETS.menu = function () {
    return sheetWrap("⋯",
      '<div class="stack">' +
      '<button class="btn big" data-act="lang" data-v="' + (S.lang === "en" ? "hi" : "en") + '">🔤 ' + h(t("menuLang")) + "</button>" +
      '<button class="btn big" data-act="openFile">📂 ' + h(t("menuOpen")) + "</button>" +
      '<button class="btn big danger" data-act="confirm" data-what="fresh">🗑️ ' + h(t("menuFresh")) + "</button></div>" +
      '<p class="hint">' + h(CAT.note) + "</p><p class=\"hint\">" + h(CAT.credit) + "</p>");
  };

  SHEETS.confirm = function (sh) {
    const fresh = sh.what === "fresh";
    return sheetWrap("⚠️", '<p class="lead">' + h(fresh ? t("cfFresh") : t("cfReplace")) + "</p>",
      '<button class="btn" data-act="closeSheet">' + h(t("cancel")) + "</button>" +
      '<button class="btn ' + (fresh ? "danger" : "primary") + '" data-act="' + (fresh ? "fresh" : "applyFile") + '">' + h(fresh ? t("cfFreshYes") : t("cfOpen")) + "</button>");
  };

  SHEETS.newCompany = function () {
    return sheetWrap("🏢 " + h(t("cNotHere")), field("🏢", t("cNewName"), input("@draft.name", { mic: true })),
      '<button class="btn primary big" data-act="saveCompany">' + h(t("cAdd")) + "</button>");
  };

  SHEETS.item = function (sh) {
    const id = sh.id;
    const it = M.item(CAT, S, id);
    if (!it) return sheetWrap("", "");
    const p = "items." + id + ".";
    return sheetWrap(h(it.name),
      '<div class="item-head">' + packTile(it) + "<div><b>" + h(it.name) + '</b><small class="muted">' + h(it.pack) + " · " + h(catName(it.cat)) + "</small>" +
      (it.custom || it.touched.mrp ? "" : '<small class="warn">⚠ ' + h(t("isCheckMrp")) + "</small>") + "</div></div>" +
      field("🏷️", t("isMrp"), stepper(p + "mrp", { min: 0, base: it.mrp, touch: p + "touched.mrp" })) +
      field("🏪", t("isSell"), '<div class="inp"><input data-bind="' + p + 'sell" data-kind="num" data-touch="' + p + 'touched.sell" data-rerender inputmode="decimal" value="' + h(it.sell == null ? "" : it.sell) + '"></div>',
        it.unit === "case" ? h(t("isCaseTotal", { n: M.unitPrice(it, "sell") })) : "") +
      field("🛒", t("isBuy"), '<div class="inp"><input data-bind="' + p + 'buy" data-kind="num" data-touch="' + p + 'touched.buy" data-rerender inputmode="decimal" value="' + h(it.buy == null ? "" : it.buy) + '"></div>') +
      field("📦", t("isUnit"), setChips(p + "unit", "str", [{ v: "piece", label: t("uPiece") }, { v: "case", label: t("uCase") }], "two") +
        '<p class="mini">' + h(t("isCaseQty")) + "</p>" + stepper(p + "caseQty", { min: 1, base: it.caseQty })) +
      field("🐇", t("isSpeed"), setChips(p + "speed", "str", [{ v: "fast", label: t("spFast"), icon: "🐇" }, { v: "med", label: t("spMed"), icon: "🚶" }, { v: "slow", label: t("spSlow"), icon: "🐢" }])) +
      field("🧾", t("isGst"), chips([0, 5, 18, 40].map(function (g) { return { v: g, label: g + "%" }; }), function (g) { return Number(g) === it.gst; },
        'data-act="set" data-path="' + p + 'gst" data-kind="num"') +
        (S.items[id] && S.items[id].gst == null ? '<p class="hint">' + h(catName(it.cat)) + ": " + it.gst + "%</p>" : "")) +
      field("▦", t("isBarcode"), input(p + "barcode", { mode: "numeric" }), it.barcode && !(S.items[id] || {}).barcode ? h(it.barcode) : "") +
      '<button class="btn wide danger" data-act="removeItem" data-id="' + h(id) + '">🗑️ ' + h(t("isRemove")) + "</button>",
      '<button class="btn primary big" data-act="closeSheet">' + h(t("done")) + " ✓</button>");
  };

  SHEETS.newItem = function (sh) {
    const d = sh.draft;
    const cos = companyOpts().concat([{ v: "", label: t("otherCompany") }]);
    const cats = Object.keys(CAT.categories).map(function (k) { return '<option value="' + k + '"' + (d.cat === k ? " selected" : "") + ">" + CAT.categories[k].icon + " " + h(catName(k)) + "</option>"; }).join("");
    return sheetWrap("＋ " + h(t("iNew")),
      field("📸", t("isPhoto"), d.photo ? '<div class="photo-row">' + thumb(d.photo) + '<button class="btn" data-act="photo" data-for="draft">' + h(t("change")) + "</button></div>"
        : '<button class="btn" data-act="photo" data-for="draft">📷 ' + h(t("takePhoto")) + "</button>") +
      field("✍️", t("isName"), input("@draft.name", { mic: true })) +
      field("🏢", t("isCompany"), setChips("@draft.company", "str", cos)) +
      field("📏", t("isPack"), input("@draft.pack")) +
      field("🏷️", t("isMrp"), input("@draft.mrp", { kind: "num", mode: "decimal", ph: "₹" })) +
      field("📦", t("isCaseQty"), stepper("@draft.caseQty", { min: 1 })) +
      field("🗂️", t("isCategory"), '<div class="inp"><select data-bind="@draft.cat">' + cats + "</select></div>") +
      (d.barcode ? field("▦", t("isBarcode"), '<p class="big">' + h(d.barcode) + "</p>") : ""),
      '<button class="btn primary big" data-act="saveItem">' + h(t("save")) + " ✓</button>");
  };

  SHEETS.scan = function () {
    return sheetWrap("▦ " + h(t("scTitle")), '<div class="scan"><video id="scanVideo" playsinline muted></video><i class="scan-line"></i></div>');
  };

  SHEETS.personNew = function (sh) {
    return sheetWrap("✍️ " + h(t("pType")),
      field("👤", t("pName"), input("@draft.name", { mic: true })) +
      field("📱", t("pPhone"), input("@draft.phone", { type: "tel", mode: "tel", max: 14 })) +
      field("🏷️", t("pIsA"), setChips("@draft.type", "str", [{ v: "shop", label: t("pShop"), icon: "🏪" }, { v: "supplier", label: t("pSupplier"), icon: "🚚" }, { v: "staff", label: t("pStaff"), icon: "👷" }])) +
      (sh.added ? '<p class="ok">✓ ' + h(t("pAdded", { n: sh.added })) + "</p>" : ""),
      '<button class="btn" data-act="savePerson" data-more="1">＋ ' + h(t("pSaveNext")) + "</button>" +
      '<button class="btn primary" data-act="savePerson">' + h(t("save")) + " ✓</button>");
  };

  SHEETS.personEdit = function (sh) {
    const p = S.people[sh.id];
    if (!p) return sheetWrap("", "");
    const b = "people." + p.id + ".";
    let body = field("👤", t("pName"), input(b + "name", { mic: true })) + field("📱", t("pPhone"), input(b + "phone", { type: "tel", mode: "tel", max: 14 }));
    if (p.type === "shop") {
      const areas = (S.store.areas || []).map(function (a) { return { v: a, label: a }; });
      body +=
        field("⭐", t("shBig"), yesNo(b + "big")) +
        field("🗓️", t("shDays"), dayChips(b + "days")) +
        field("🗺️", t("shArea"), (areas.length ? setChips(b + "area", "str", areas) : "") +
          '<div class="inp row"><input id="areaNew" type="text" placeholder="' + h(t("fAreaPh")) + '"><button class="btn" data-act="addArea" data-person="' + h(p.id) + '">＋ ' + h(t("add")) + "</button></div>") +
        field("💵", t("shPay"), setChips(b + "pay", "auto", [{ v: "cash", label: t("payCash") }, { v: 7, label: t("payDays", { n: 7 }) }, { v: 15, label: t("payDays", { n: 15 }) }, { v: 30, label: t("payDays", { n: 30 }) }])) +
        field("📋", t("shRate"), setChips(b + "rate", "str", [{ v: "normal", label: t("rtNormal") }, { v: "wholesale", label: t("rtWholesale") }, { v: "special", label: t("rtSpecial") }])) +
        field("📞", t("shHow"), setChips(b + "how", "str", [{ v: "salesman", label: t("howSalesman") }, { v: "phone", label: t("howPhone") }, { v: "whatsapp", label: t("howWhatsapp") }, { v: "self", label: t("howSelf") }])) +
        field("📒", t("shOwes"), input(b + "owes", { kind: "num", mode: "numeric" }), h(t("shOwesHint"))) +
        field("📝", t("shNote"), input(b + "note", { area: true, mic: true }));
    } else if (p.type === "staff") {
      body +=
        field("🧰", t("pStaff"), setChips(b + "role", "str", roleOpts(), "roles")) +
        field("🗓️", t("stDays"), dayChips(b + "days")) +
        field("🚚", t("stVehicle"), input(b + "vehicle", { upper: true, kind: "upper" })) +
        field("💵", t("stCash"), yesNo(b + "cash"));
    } else if (p.type === "supplier") {
      body +=
        field("🏢", t("suCompanies"), setChips(b + "companies", "arr", companyOpts())) +
        field("🔢", t("suCode"), input(b + "code")) +
        field("🧾", t("suGst"), input(b + "gst", { upper: true, kind: "upper", max: 15 })) +
        field("⏱️", t("suLead"), setChips(b + "lead", "num", [1, 2, 3, 7].map(function (n) { return { v: n, label: t("daysN", { n: n }) }; }))) +
        field("📒", t("suOwe"), input(b + "owe", { kind: "num", mode: "numeric" }), h(t("shOwesHint")));
    }
    body += field("🏷️", t("pIsA"), setChips(b + "type", "str", [{ v: "shop", label: t("pShop"), icon: "🏪" }, { v: "supplier", label: t("pSupplier"), icon: "🚚" },
      { v: "staff", label: t("pStaff"), icon: "👷" }, { v: "skip", label: t("pSkip"), icon: "✖" }]));
    return sheetWrap(h(p.name), body, '<button class="btn primary big" data-act="closeSheet">' + h(t("done")) + " ✓</button>");
  };

  function usualList(shopId) {
    const q = ui.usualQ.toLowerCase().trim();
    const u = S.usual[shopId] || {};
    const its = M.chosenItems(CAT, S).filter(function (it) { return !q || (it.name + " " + it.brand + " " + it.pack).toLowerCase().indexOf(q) >= 0; })
      .sort(function (a, b) { return (u[b.id] ? 1 : 0) - (u[a.id] ? 1 : 0); });
    return its.map(function (it) {
      return '<div class="uline' + (u[it.id] ? " on" : "") + '">' + packTile(it, true) + '<div class="un"><b>' + h(it.name) + '</b><small class="muted">' + h(it.pack) + " · " +
        h(it.unit === "case" ? t("uCase") : t("uPiece")) + " " + rupee(M.unitPrice(it, "sell")) + "</small></div>" +
        stepper("usual." + shopId + "." + it.id, { min: 0, zero: true, small: true }) + "</div>";
    }).join("");
  }

  SHEETS.usual = function (sh) {
    const p = S.people[sh.id];
    if (!p) return sheetWrap("", "");
    const lines = M.usualLines(CAT, S, p.id);
    const total = lines.reduce(function (s, l) { return s + (l.amount || 0); }, 0);
    return sheetWrap("🔁 " + h(p.name),
      '<div class="search"><input type="search" data-search="usualQ" value="' + h(ui.usualQ) + '" placeholder="🔍 ' + h(t("uSearch")) + '"></div>' +
      '<div id="slist">' + usualList(p.id) + "</div>",
      '<span class="foot-note">' + h(t("uTotal")) + " <b>" + rupee(total) + "</b></span>" +
      '<button class="btn primary" data-act="closeSheet">' + h(t("done")) + " ✓</button>");
  };

  SHEETS.papers = function () {
    const rec = ui.rec;
    const list = S.papers.slice().reverse();
    return sheetWrap("📷 " + h(t("paTitle")),
      '<p class="hint">' + h(t("paPhotoHint")) + "</p>" +
      '<div class="stack">' +
      '<button class="btn primary big" data-act="photo" data-for="paper">📷 ' + h(t("paPhoto")) + "</button>" +
      '<button class="btn big" data-act="gallery">🖼️ ' + h(S.lang === "en" ? "From gallery" : "गैलरी से") + "</button>" +
      (canRecord ? (rec ? '<button class="btn big danger" data-act="recStop">⏹ ' + h(t("paStop")) + ' · <span id="recT">' + h(t("paRecording", { s: 0 })) + "</span></button>"
        : '<button class="btn big" data-act="recStart">🎤 ' + h(t("paVoice")) + "</button>") : "") + "</div>" +
      (list.length ? '<div class="papers">' + list.map(function (p) {
        return '<div class="paper">' + (p.kind === "photo" ? thumb(p.id) : '<audio controls preload="none" data-paper-audio="' + h(p.id) + '"></audio>') +
          "<small>" + ICON[p.step] + " " + h(t("title_" + p.step)) + "</small>" +
          '<button class="icon-btn" data-act="delPaper" data-id="' + h(p.id) + '" aria-label="' + h(t("paDelete")) + '">🗑️</button></div>';
      }).join("") + "</div>" : '<p class="muted center-text">' + h(t("paNone")) + "</p>"));
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
    if (sheet && SHEETS[sheet.kind]) {
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
  }

  function refreshList(key) {
    if (key === "usualQ" && sheet && sheet.kind === "usual") { document.getElementById("slist").innerHTML = usualList(sheet.id); }
    else if (key === "itemsQ") document.getElementById("list").innerHTML = itemsList();
    else if (key === "compQ") document.getElementById("list").innerHTML = companyTiles();
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
  }

  function go(to) {
    stopMedia();
    sheet = null;
    view = to;
    history.pushState({ to: to }, "", "#" + to);
    render();
    window.scrollTo(0, 0);
  }

  function openSheet(sh) {
    sheet = sh;
    history.pushState({ to: view, sheet: 1 }, "", location.hash);
    render();
  }

  function closeSheet() { if (sheet) history.back(); }

  window.addEventListener("popstate", function (e) {
    stopMedia();
    if (sheet) { sheet = null; render(); return; }
    view = (e.state && e.state.to) || (S.lang ? "home" : "lang");
    render();
    window.scrollTo(0, 0);
  });

  /* ──────────────────────────────────────────────── camera and voice ── */

  function stopMedia() {
    if (ui.stream) { ui.stream.getTracks().forEach(function (tr) { tr.stop(); }); ui.stream = null; }
    clearTimeout(ui.scanTimer);
    if (ui.rec && ui.rec.mr.state !== "inactive") ui.rec.mr.stop();
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
      S.papers.push({ id: id, kind: "photo", step: view, at: Date.now(), mime: b.type || "image/jpeg", note: target === "store" ? "shop photo" : target === "draft" ? "product photo" : "" });
      if (target === "store") S.store.photo = id;
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
      if (!S.items[id]) {
        S.items[id] = { unit: "case" };
        const base = CAT.items.find(function (x) { return x.id === id; });
        if (base && !S.companies[base.company]) S.companies[base.company] = { buy: M.DEFAULT_RULE.buy, sell: M.DEFAULT_RULE.sell };
      }
      save();
      toast(t("scFound", { name: M.item(CAT, S, id).name }));
      closeSheet();
    } else {
      sheet = { kind: "newItem", draft: { barcode: code, company: ui.itemsCo || "", cat: "other", caseQty: 1 } };
      render();
      toast(t("scNew"));
    }
  }

  function locate() {
    if (!navigator.geolocation) { toast(t("fLocFail")); return; }
    toast(t("fLocWait"));
    navigator.geolocation.getCurrentPosition(function (pos) {
      S.store.loc = { lat: pos.coords.latitude, lng: pos.coords.longitude, acc: Math.round(pos.coords.accuracy) };
      save();
      render();
      toast("📍 " + t("fLocSaved"));
    }, function () { toast(t("fLocFail")); }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
  }

  function dictate(path) {
    if (!SR) { toast(t("micUnsupported")); return; }
    const r = new SR();
    r.lang = S.lang === "en" ? "en-IN" : "hi-IN";
    r.interimResults = false;
    r.maxAlternatives = 1;
    toast("🎤 " + t("listening"));
    r.onresult = function (e) {
      const said = e.results[0][0].transcript;
      const cur = getPath(path) || "";
      const v = (cur ? cur + " " : "") + said;
      setPath(path, v);
      if (path[0] !== "@") save();
      const el = document.querySelector('[data-bind="' + path + '"]');
      if (el) el.value = v;
    };
    r.onerror = function () { toast(t("micUnsupported")); };
    r.start();
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

  let pendingFile = null;

  async function readSetup(file) {
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      pendingFile = X.read(bytes);
      if (S.startedAt || S.order.length || Object.keys(S.items).length) openSheet({ kind: "confirm", what: "replace" });
      else applyFile();
    } catch (e) {
      toast("⚠ " + t("fileBad"));
    }
  }

  async function applyFile() {
    if (!pendingFile) return;
    const lang = S.lang;
    await DB.clear().catch(function () {});
    for (const id of Object.keys(pendingFile.blobs)) {
      const b = pendingFile.blobs[id];
      await DB.put(id, new Blob([b.bytes], { type: b.mime || "application/octet-stream" }));
    }
    Object.keys(urls).forEach(function (k) { URL.revokeObjectURL(urls[k]); delete urls[k]; });
    S = pendingFile.state;
    S.lang = lang || S.lang || "hi";       // whoever opens the file keeps their own language
    if (!S.startedAt) S.startedAt = Date.now();
    pendingFile = null;
    save();
    sheet = null;
    go("home");
    toast("✓ " + t("fileOk"));
  }

  /* ──────────────────────────────────────────────────────── actions ── */

  const ACT = {
    go: function (el) { go(el.dataset.to); },
    next: function (el) {
      const i = STEPS.indexOf(el.dataset.step);
      go(STEPS[i + 1] || "home");
    },
    skip: function (el) { S.skipped[el.dataset.step] = true; save(); const i = STEPS.indexOf(el.dataset.step); go(STEPS[i + 1]); },
    lang: function (el) {
      S.lang = el.dataset.v; save();
      if (view === "lang") go(S.startedAt ? "home" : "welcome"); else closeSheet();
    },
    start: function () { if (!S.startedAt) S.startedAt = Date.now(); save(); go("store"); },
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
    delArea: function (el) { S.store.areas.splice(Number(el.dataset.i), 1); save(); render(); },
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

    toggleCompany: function (el) {
      const id = el.dataset.id;
      if (S.companies[id]) delete S.companies[id];
      else S.companies[id] = { buy: M.DEFAULT_RULE.buy, sell: M.DEFAULT_RULE.sell };
      save();
      document.getElementById("list").innerHTML = companyTiles();
      const n = Object.keys(S.companies).length;
      const note = document.querySelector(".foot .foot-note");
      if (note) note.textContent = "✓ " + t("cSelected", { n: n });
      else render();
    },
    newCompany: function () { openSheet({ kind: "newCompany", draft: { name: "" } }); },
    saveCompany: function () {
      const name = (sheet.draft.name || "").trim();
      if (!name) return;
      const id = M.uid("co");
      S.customCompanies.push({ id: id, name: name, short: name, color: "#6B7280" });
      S.companies[id] = { buy: M.DEFAULT_RULE.buy, sell: M.DEFAULT_RULE.sell };
      save();
      closeSheet();
    },

    toggleItem: function (el) {
      const id = el.dataset.id;
      if (S.items[id]) delete S.items[id];
      else {
        S.items[id] = { unit: "case" };
        const base = CAT.items.find(function (x) { return x.id === id; });
        if (base && !S.companies[base.company]) S.companies[base.company] = { buy: M.DEFAULT_RULE.buy, sell: M.DEFAULT_RULE.sell };
      }
      save();
      render();
    },
    addAll: function () {
      itemIds().forEach(function (id) { if (!S.items[id]) S.items[id] = { unit: "case" }; });
      save();
      render();
    },
    itemSheet: function (el) { openSheet({ kind: "item", id: el.dataset.id }); },
    removeItem: function (el) { delete S.items[el.dataset.id]; save(); closeSheet(); },
    newItem: function () { openSheet({ kind: "newItem", draft: { name: ui.itemsQ || "", company: ui.itemsCo || "", cat: "other", caseQty: 1 } }); },
    saveItem: function () {
      const d = sheet.draft;
      if (!(d.name || "").trim()) { toast("✍️ " + t("isName")); return; }
      const id = M.uid("new");
      S.customItems[id] = { name: d.name.trim(), brand: "", company: d.company || "", pack: d.pack || "", mrp: d.mrp || null, caseQty: d.caseQty || 1, cat: d.cat || "other", photo: d.photo || null, barcode: d.barcode || "" };
      S.items[id] = { unit: "case", barcode: d.barcode || "", touched: { mrp: true } };
      save();
      closeSheet();
      toast("✓ " + d.name.trim());
    },
    scan: function () { openSheet({ kind: "scan" }); },

    pick: async function () {
      try {
        const list = await navigator.contacts.select(["name", "tel"], { multiple: true });
        addMany(list.map(function (c) { return { name: (c.name && c.name[0]) || "", phone: (c.tel && c.tel[0]) || "" }; }), "contact");
      } catch (e) { /* the owner closed the picker */ }
    },
    vcf: function () { document.getElementById("fileVcf").click(); },
    personNew: function (el) { openSheet({ kind: "personNew", draft: { name: "", phone: "", type: el.dataset.type || null }, added: 0 }); },
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
    undoSort: function () {
      const id = ui.lastSorted.pop();
      if (id && S.people[id]) { S.people[id].type = null; save(); }
      render();
    },
    usualSheet: function (el) { ui.usualQ = ""; openSheet({ kind: "usual", id: el.dataset.id }); },

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
    openFile: function () { document.getElementById("fileSetup").click(); },
    confirm: function (el) { sheet = { kind: "confirm", what: el.dataset.what }; render(); },
    applyFile: function () { applyFile(); },
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
    e.preventDefault();
    a(el, e);
  });

  document.addEventListener("input", function (e) {
    const el = e.target;
    if (el.dataset.bind) {
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
    }
  });

  document.addEventListener("change", function (e) {
    const el = e.target;
    if (el.dataset.bind && (el.dataset.rerender !== undefined || el.tagName === "SELECT")) setTimeout(render, 0);
    if (el.id === "filePhoto" || el.id === "fileGallery") { if (el.files.length) addPhotos(Array.from(el.files)); el.value = ""; }
    if (el.id === "fileVcf" && el.files[0]) {
      el.files[0].text().then(function (txt) { addMany(M.parseVcf(txt), "vcf"); });
      el.value = "";
    }
    if (el.id === "fileSetup" && el.files[0]) { readSetup(el.files[0]); el.value = ""; }
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && e.target.id === "areaNew") { e.preventDefault(); const b = e.target.parentElement.querySelector('[data-act="addArea"]'); if (b) b.click(); }
    if (e.key === "Escape" && sheet) closeSheet();
  });

  if (canSpeak) speechSynthesis.getVoices();

  /* ─────────────────────────────────────────────────────────── start ── */

  const hash = location.hash.slice(1);
  view = !S.lang ? "lang" : STEPS.indexOf(hash) >= 0 || hash === "home" ? hash : S.startedAt ? "home" : "welcome";
  history.replaceState({ to: view }, "", "#" + view);
  render();
})();
