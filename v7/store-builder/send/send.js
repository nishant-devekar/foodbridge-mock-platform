/* Store Builder · send contacts from the phone to the computer (1 Oct 2026).

   The desktop Contacts screen shows a QR code for this page with a fresh code
   in the hash (#c=…&l=hi). He picks contacts in his phone's own picker
   (Android Chrome; an iPhone once one Safari setting is on, or iCloud on the computer), and only the
   names and numbers go to the bridge under
   that code (zoho-function/handoff.js). His computer takes them from there.
   Nothing is kept on the phone.

   #m=photos (the Files step, 1 Oct 2026): the same page takes photos instead --
   his khata, the route chart on the wall, bills, a rate list -- with the phone's
   camera or from its gallery, one post each, and they land in Files. A camera
   works in every browser, so this mode needs no hand-over to another one. */

(function () {
  "use strict";

  const IMP = window.SB_IMPORT, OB = window.SB_OUTBOX, ic = window.SB_ICON;
  const q = new URLSearchParams(location.hash.slice(1));
  const CODE = /^[a-z0-9]{12}$/.test(q.get("c") || "") ? q.get("c") : "";
  const HI = q.get("l") === "hi";
  /* Asked at the tap, not at load: on an iPhone the setting can be turned on while this page waits. */
  function canPick() { return !!(navigator.contacts && navigator.contacts.select); }
  /* Every browser (owner, 1 Oct 2026): only Chrome on Android and Safari on an iPhone can open the
    contact list, so any other browser -- Firefox, Samsung Internet, Opera, Chrome or Edge on an
    iPhone, the camera's or WhatsApp's own browser -- gets one tap that opens this page in one that
    can. Google Contacts (gcontacts.js) works in all of them, when it is switched on. */
  function phoneKind() {
    const ua = navigator.userAgent || "";
    if (/iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) {
    const safari = /Safari\//.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|YaBrowser|GSA\/|FBAN|FBAV|Instagram|Line\/|WhatsApp|DuckDuckGo|Brave/.test(ua);
    return safari ? "ios" : "ios-other";
    }
    if (/Android/.test(ua)) return "android";
    return "other";
  }
  const G = window.SB_GOOGLE;
  const $card = document.getElementById("card");

  /* No files (owner, 1 Oct 2026: nobody keeps a contacts file on a phone). His contact list
     itself: Android Chrome opens it straight away, and another Android browser hands the page to
     Chrome. An iPhone turns on one Safari setting once (or goes to Safari for it); iCloud, read
     on the computer, is its second way. */
  /* Words (owner, 1 Oct 2026: ruthless -- only what helps him act): a title, the button, and a step
     only where the phone makes one necessary. */
  const W = HI ? {
    t: "कॉन्टैक्ट भेजें", pick: "कॉन्टैक्ट चुनें", safe: "सिर्फ़ नाम और नंबर",
    chrome: "Chrome में खोलें",
    iosT: "एक बार चालू करें", ios: ["Settings › Apps › Safari › Advanced › Feature Flags", "Contact Picker API चालू करें"], again: "हो गया, कॉन्टैक्ट खोलें",
    safari: "Safari में खोलें", icAlt: "या कंप्यूटर पर iCloud से लाएँ",
    google: "Google Contacts से लाएँ", gFail: "Google से नहीं आए। फिर कोशिश करें।",
    other: "यह फ़ोन पर खोलें",
    sending: "भेज रहे हैं…", okT: "{n} भेजे", okS: "कंप्यूटर पर देखें", more: "और भेजें",
    none: "कुछ नहीं चुना", fail: "नहीं गए। फिर कोशिश करें।", retry: "फिर कोशिश करें",
    badT: "QR कोड फिर से स्कैन करें",
  } : {
    t: "Send contacts", pick: "Pick contacts", safe: "Only names and numbers",
    chrome: "Open in Chrome",
    iosT: "Turn on once", ios: ["Settings › Apps › Safari › Advanced › Feature Flags", "Turn on Contact Picker API"], again: "Done, pick contacts",
    safari: "Open in Safari", icAlt: "Or use iCloud on your computer",
    google: "Sync Google Contacts", gFail: "Google didn't send them. Try again.",
    other: "Open this on your phone",
    sending: "Sending…", okT: "{n} sent", okS: "Check your computer", more: "Send more",
    none: "Nothing picked", fail: "Couldn't send. Try again.", retry: "Try again",
    badT: "Scan the QR code again",
  };


  document.documentElement.lang = HI ? "hi" : "en";

  /* The same page in Chrome, from Samsung Internet or a camera app's own browser. */
  function chromeUrl() { return "intent://" + location.host + location.pathname + location.search + location.hash + "#Intent;scheme=" + location.protocol.replace(":", "") + ";package=com.android.chrome;end"; }

  function post(body) {
    return fetch(OB.bridge() + "/api/handoff", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.assign({ code: CODE }, body)) })
      .then(function (r) { return r.ok; }, function () { return false; });
  }

  let last = null;
  /* An iPhone (owner, 1 Oct 2026): the Safari setting first -- it is the only way the phone itself
     can pick -- shown only when he taps; another iPhone browser is sent to Safari for it. iCloud,
     read on the computer, is the second way, always there underneath. */
  function home(err, help) {
    const k = phoneKind(), ios = k === "ios" || k === "ios-other";
    const fix = canPick() ? ""
      : k === "ios" ? (help ? '<div class="how"><b>' + W.iosT + "</b><ol>" + W.ios.map(function (x) { return "<li>" + x + "</li>"; }).join("") + "</ol></div>" : "")
      : k === "ios-other" || k === "android" ? ""
      : '<p class="how">' + W.other + "</p>";
    const btn = help ? '<button class="cta" id="again">' + ic("contacts", 20) + W.again + "</button>"   // one button once the setting is shown
      : canPick() || k === "ios" ? '<button class="cta" id="pick">' + ic("contacts", 20) + W.pick + "</button>"
      : k === "ios-other" ? '<a class="cta" href="' + safariUrl() + '">' + ic("share", 20) + W.safari + "</a>"
      : k === "android" ? '<a class="cta" href="' + chromeUrl() + '">' + ic("share", 20) + W.chrome + "</a>" : "";
    const gBtn = G && G.ready() ? '<button class="alt is-g" id="google">' + GLOGO + W.google + "</button>" : "";
    $card.innerHTML = '<span class="hero">' + ic("contacts", 30) + "</span><h1>" + W.t + "</h1>" +
      (err ? '<p class="s err">' + err + "</p>" : "") + fix +
      '<div class="fill"></div>' + btn +
      gBtn +
      (ios && !canPick() ? '<p class="how is-alt">' + W.icAlt + "</p>" : "") +
      '<p class="safe">' + ic("lock", 13) + W.safe + "</p>";
    const p = document.getElementById("pick");
    if (p) p.onclick = function () { if (canPick()) pick(); else home(null, true); };
    const a = document.getElementById("again");
    if (a) a.onclick = function () { if (canPick()) pick(); else location.reload(); };
    const g = document.getElementById("google");
    if (g) g.onclick = function () {
      G.read().then(function (list) { send(list); }, function (e) { if (!/closed|denied|popup_closed/.test(e.message)) home(W.gFail); });
    };
  }
  /* iOS 17 and later open a link in Safari from any app with this prefix. */
  function safariUrl() { return "x-safari-" + location.href; }
  const GLOGO = G ? G.logo : "";
  function busy() { $card.innerHTML = '<span class="hero">' + ic("send", 30) + "</span><h1>" + W.sending + "</h1>"; }
  function done(list) {
    $card.innerHTML = '<span class="hero is-ok">' + ic("check", 32) + "</span><h1>" + W.okT.replace("{n}", list.length) + '</h1><p class="s">' + W.okS + "</p>" +
      '<div class="who">' + list.slice(0, 8).map(function (c) { return "<span>" + esc(c.name || c.phone) + "</span>"; }).join("") + (list.length > 8 ? "<span>+" + (list.length - 8) + "</span>" : "") + "</div>" +
      '<div class="fill"></div><button class="alt" id="more">' + ic("plus", 18) + W.more + "</button>";
    document.getElementById("more").onclick = function () { home(); };
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  async function send(list) {
    list = list.filter(function (c) { return c.name || c.phone; }).map(function (c) { return { name: c.name || "", phone: c.phone || "" }; });
    if (!list.length) { home(W.none); return; }
    last = list;
    busy();
    if (await post({ people: list })) done(list);
    else {
    home(W.fail);
    const f = document.querySelector(".fill");
    f.insertAdjacentHTML("afterend", '<button class="alt" id="again">' + W.retry + "</button>");
    document.getElementById("again").onclick = function () { send(last); };
    }
  }

  async function pick() {
    try {
    const list = await navigator.contacts.select(["name", "tel"], { multiple: true });
    if (!list || !list.length) return;
    send(list.map(function (c) { return { name: (c.name && c.name[0]) || "", phone: IMP.pickPhone(c.tel || []) }; }));
    } catch (e) { /* he closed the picker */ }
  }

  /* ── Photos for the Files step ── */
  const PHOTOS = q.get("m") === "photos";
  const PW = HI ? {
    t: "फ़ोटो भेजें", snap: "फ़ोटो खींचें", gallery: "गैलरी से", safe: "सिर्फ़ FoodBridge टीम देखती है",
    sending: "भेज रहे हैं… {i} / {n}", okT: "{n} भेजीं", okS: "कंप्यूटर पर देखें", more: "और खींचें",
    fail: "{n} नहीं गईं। फिर कोशिश करें।", big: "{name} बहुत बड़ी है",
  } : {
    t: "Send photos", snap: "Take photo", gallery: "From gallery", safe: "Only the FoodBridge team sees them",
    sending: "Sending {i} of {n}…", okT: "{n} sent", okS: "Check your computer", more: "Take more",
    fail: "{n} didn't send. Try again.", big: "{name} is too big",
  };

  let sentPics = [];
  function photoHome(err) {
    $card.innerHTML = '<span class="hero">' + ic("camera", 30) + "</span><h1>" + PW.t + "</h1>" +
      (err ? '<p class="s err">' + err + "</p>" : "") +
      (sentPics.length ? '<div class="pics">' + sentPics.slice(-8).map(function (u) { return '<img src="' + u + '" alt="">'; }).join("") + "</div>" : "") +
      '<div class="fill"></div>' +
      '<label class="cta">' + ic("camera", 20) + PW.snap + '<input type="file" class="sr" accept="image/*" capture="environment" id="snap"></label>' +
      '<label class="alt">' + ic("image", 18) + PW.gallery + '<input type="file" class="sr" accept="image/*,application/pdf" multiple id="gal"></label>' +
      '<p class="safe">' + ic("lock", 13) + PW.safe + "</p>";
    ["snap", "gal"].forEach(function (id) {
    document.getElementById(id).addEventListener("change", function (e) { sendPhotos(Array.from(e.target.files || [])); });
    });
  }
  /* A phone photo is 3-6 MB: down to 1600 px and JPEG, enough to read a khata page. */
  function shrink(f) {
    return new Promise(function (res) {
    if (!/^image\//.test(f.type) || /gif/.test(f.type)) { res(f); return; }
    const img = new Image(), u = URL.createObjectURL(f);
    img.onload = function () {
    const k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    URL.revokeObjectURL(u);
    c.toBlob(function (b) { res(b ? new File([b], (f.name || "photo").replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }) : f); }, "image/jpeg", 0.78);
      };
    img.onerror = function () { URL.revokeObjectURL(u); res(f); };
    img.src = u;
    });
  }
  function b64(file) {
    return file.arrayBuffer().then(function (buf) {
    const a = new Uint8Array(buf); let s = "";
    for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode.apply(null, a.subarray(i, i + 0x8000));
    return btoa(s);
    });
  }
  async function sendPhotos(files) {
    if (!files.length) return;
    let ok = 0, bad = 0, note = "";
    for (let i = 0; i < files.length; i++) {
      $card.innerHTML = '<span class="hero">' + ic("send", 30) + "</span><h1>" + PW.sending.replace("{i}", i + 1).replace("{n}", files.length) + "</h1>";
    const f = await shrink(files[i]);
    if (f.size > 2.5 * 1024 * 1024) { bad++; note = PW.big.replace("{name}", esc(files[i].name || "")); continue; }
    const name = f.name || "photo-" + (i + 1) + ".jpg";
    if (await post({ file: { name: name, type: f.type || "image/jpeg", data: await b64(f) } })) {
    ok++;
    if (/^image\//.test(f.type)) sentPics.push(URL.createObjectURL(f));
      } else bad++;
    }
    if (!ok) { photoHome(note || PW.fail.replace("{n}", bad)); return; }
    $card.innerHTML = '<span class="hero is-ok">' + ic("check", 32) + "</span><h1>" + PW.okT.replace("{n}", ok) + '</h1><p class="s">' + PW.okS + "</p>" +
      (bad ? '<p class="s err">' + (note || PW.fail.replace("{n}", bad)) + "</p>" : "") +
      '<div class="pics">' + sentPics.slice(-8).map(function (u) { return '<img src="' + u + '" alt="">'; }).join("") + "</div>" +
      '<div class="fill"></div><button class="alt" id="more">' + ic("camera", 18) + PW.more + "</button>";
    document.getElementById("more").onclick = function () { photoHome(); };
  }

  if (!CODE) {
    $card.innerHTML = '<span class="hero">' + ic("alert", 30) + "</span><h1>" + W.badT + "</h1>";
    return;
  }
  if (PHOTOS) photoHome();
  else { home(); if (G) G.preload(); }
  post({ hello: true });   // the computer can say "phone connected" before anything is picked
})();
