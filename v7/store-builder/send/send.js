/* Store Builder · send contacts from the phone to the computer (1 Oct 2026).

   The desktop Contacts screen shows a QR code for this page with a fresh code
   in the hash (#c=…&l=hi). He picks contacts in his phone's own picker
   (Android Chrome; an iPhone once its Safari setting is on), and only the
   names and numbers go to the bridge under
   that code (zoho-function/handoff.js). His computer takes them from there.
   Nothing is kept on the phone. */

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
     itself, always: Android Chrome opens it straight away; another Android browser hands the
     page to Chrome; an iPhone opens it once one Safari setting is on (the phone page's own way,
     app.js noPicker). */
  const W = HI ? {
    t: "अपने कॉन्टैक्ट कंप्यूटर पर भेजें", s: "फ़ोन की कॉन्टैक्ट लिस्ट खुलेगी। सब चुनें, या सिर्फ़ ग्राहक, सप्लायर और स्टाफ़।",
    pick: "कॉन्टैक्ट से जोड़ें", safe: "सिर्फ़ नाम और नंबर जाते हैं",
    chrome: "Chrome में खोलें", chromeS: "यह ब्राउज़र कॉन्टैक्ट नहीं खोलता। Chrome में खोलें, फिर “कॉन्टैक्ट से जोड़ें” दबाएँ।",
    iosT: "एक बार की सेटिंग, फिर कॉन्टैक्ट खुल जाएँगे",
    ios: ["Settings → Apps → Safari → Advanced → Feature Flags खोलें।", "“Contact Picker API” चालू करें।", "यहाँ लौटें और “कॉन्टैक्ट से जोड़ें” दबाएँ।"],
    iosOld: "पुराने iPhone: Settings → Safari → Advanced → Experimental Features।", again: "मैंने चालू कर दिया",
    safari: "Safari में खोलें", safariS: "iPhone पर सिर्फ़ Safari कॉन्टैक्ट खोल सकता है। Safari में खोलें, फिर “कॉन्टैक्ट से जोड़ें” दबाएँ।",
    google: "Google Contacts से जोड़ें", gFail: "Google से कॉन्टैक्ट नहीं आए। फिर कोशिश करें।",
    other: "यह पेज अपने फ़ोन पर खोलें: कंप्यूटर पर दिख रहा QR कोड फ़ोन के कैमरे से स्कैन करें।",
    sending: "भेज रहे हैं…", okT: "{n} कॉन्टैक्ट भेज दिए", okS: "अब अपने कंप्यूटर पर देखें: वे वहाँ आ गए हैं।", more: "और भेजें",
    none: "कोई कॉन्टैक्ट नहीं चुना।", fail: "भेज नहीं पाए। इंटरनेट देखें और फिर कोशिश करें।", retry: "फिर कोशिश करें",
    badT: "कोड नहीं मिला", badS: "अपने कंप्यूटर पर Store Builder में दिखा QR कोड फिर से स्कैन करें।",
  } : {
    t: "Send your contacts to your computer", s: "Your contact list opens. Select all, or just your customers, suppliers and staff.",
    pick: "Import from contacts", safe: "Only names and numbers are sent",
    chrome: "Open in Chrome", chromeS: "This browser can't open your contacts. Open the page in Chrome, then tap “Import from contacts”.",
    iosT: "One setting, once, and your contacts open here",
    ios: ["Open Settings → Apps → Safari → Advanced → Feature Flags.", "Turn on “Contact Picker API”.", "Come back here and tap “Import from contacts”."],
    iosOld: "Older iPhones: Settings → Safari → Advanced → Experimental Features.", again: "I've turned it on",
    safari: "Open in Safari", safariS: "On an iPhone only Safari can open your contacts. Open the page in Safari, then tap “Import from contacts”.",
    google: "Sync Google Contacts", gFail: "Google didn't send the contacts. Try again.",
    other: "Open this on your phone: scan the QR code on your computer with your phone's camera.",
    sending: "Sending…", okT: "{n} contacts sent", okS: "Look at your computer: they're there now.", more: "Send more",
    none: "No contacts picked.", fail: "Couldn't send. Check your internet and try again.", retry: "Try again",
    badT: "No code found", badS: "Scan the QR code in Store Builder on your computer again.",
  };
  document.documentElement.lang = HI ? "hi" : "en";

  /* The same page in Chrome, from Samsung Internet or a camera app's own browser. */
  /* iOS 17 and later open a link in Safari from any app with this prefix. */
  function safariUrl() { return "x-safari-" + location.href; }
  function chromeUrl() { return "intent://" + location.host + location.pathname + location.search + location.hash + "#Intent;scheme=" + location.protocol.replace(":", "") + ";package=com.android.chrome;end"; }

  function post(body) {
    return fetch(OB.bridge() + "/api/handoff", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.assign({ code: CODE }, body)) })
      .then(function (r) { return r.ok; }, function () { return false; });
  }

  let last = null;
  function home(err, help) {
    const k = phoneKind();
    const fix = canPick() ? "" : k === "ios" ? (help ? '<div class="how"><b>' + W.iosT + "</b><ol>" + W.ios.map(function (x) { return "<li>" + x + "</li>"; }).join("") + "</ol><small>" + W.iosOld + "</small></div>" : "")
      : k === "ios-other" ? '<p class="how">' + W.safariS + "</p>"
      : k === "android" ? '<p class="how">' + W.chromeS + "</p>" : '<p class="how">' + W.other + "</p>";
    const btn = canPick() || k === "ios" ? '<button class="cta" id="pick">' + ic("contacts", 20) + W.pick + "</button>"
      : k === "ios-other" ? '<a class="cta" href="' + safariUrl() + '">' + ic("share", 20) + W.safari + "</a>"
      : k === "android" ? '<a class="cta" href="' + chromeUrl() + '">' + ic("share", 20) + W.chrome + "</a>" : "";
    const gBtn = G && G.ready() ? '<button class="alt is-g" id="google">' + GLOGO + W.google + "</button>" : "";
    $card.innerHTML = '<span class="hero">' + ic("contacts", 30) + "</span><h1>" + W.t + '</h1><p class="s">' + W.s + "</p>" +
      (err ? '<p class="s err">' + err + "</p>" : "") + fix +
      '<div class="fill"></div>' + btn + gBtn +
      (help ? '<button class="alt" id="again">' + ic("check", 18) + W.again + "</button>" : "") +
      '<p class="safe">' + ic("lock", 13) + W.safe + "</p>";
    const p = document.getElementById("pick");
    if (p) p.onclick = function () { if (canPick()) pick(); else home(null, true); };
    const g = document.getElementById("google");
    if (g) g.onclick = function () {
      G.read().then(function (list) { send(list); }, function (e) { if (!/closed|denied|popup_closed/.test(e.message)) home(W.gFail); });
    };
    const a = document.getElementById("again");
    if (a) a.onclick = function () { if (canPick()) pick(); else location.reload(); };
  }
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

  if (!CODE) {
    $card.innerHTML = '<span class="hero">' + ic("alert", 30) + "</span><h1>" + W.badT + '</h1><p class="s">' + W.badS + "</p>";
    return;
  }
  home();
  if (G) G.preload();
  post({ hello: true });   // the computer can say "phone connected" before anything is picked
})();
