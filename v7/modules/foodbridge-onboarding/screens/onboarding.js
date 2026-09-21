/* ==========================================================================
   ONBOARDING — the image's eleven screens, in the image's order.

   17 Sep 2026, the UI flip. The product owner's onboarding board
   (ux/target/onboarding-target.jpg) is the product UI: its screens, its
   sequence, its copy. What this cut already had — the Zoho sign-in and read
   through the bridge, the in-browser Excel/CSV reader, the dataset
   normaliser, the reorder engine — is the capability layer behind it, never a
   screen of its own.

      1  Sign Up                  name + phone (required), business + GST number
                                  (optional, a real lookup via /api/gstin); a local
                                  account (there is no auth backend)
      2  Where is your data?      Zoho · Xero · Files / Documents live;
                                  Tally · Vyapar shown as Coming soon
      3  Connect your <X> account Zoho or Xero: a real OAuth sign-in through the bridge
                                  Tally, Vyapar: their export files, read here
      4  Importing your data      the real read, step by step
      5  Data found               real counts from what was read
      6  Data check               what was not found; skipped when nothing is
      8  Ready to order           how many of the four are ready
      9  Create order             a real customer and real products, prefilled
                                  from the reorder engine where it can predict
     10  Order created            the order FoodBridge holds
     11  You're ready             into FoodBridge

   REAL: Zoho Books sign-in and read (zoho-function/onboarding.js), Excel and
   CSV read in this browser (dataset.js), FB_PREDICT. Dev stand-ins for both
   readers exist only on localhost with ?fbmock=… (readers.js guards it).
   HELD IN THIS BROWSER, and said nowhere to be anything else: the account,
   the orders created — this cut has no backend for them.
   ========================================================================== */

(function () {
  "use strict";

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.prototype.slice.call((root || document).querySelectorAll(sel));
  const esc = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const RD = function () { return window.FB_READERS; };

  /* ── icons: lucide geometry, 24 grid ─────────────────────────────────── */
  const lu = (d, size, sw) =>
    '<svg xmlns="http://www.w3.org/2000/svg" width="' + (size || 20) + '" height="' + (size || 20) +
    '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (sw || 2) + '" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + "</svg>";
  const FLASK_D = '<path d="M10 2v7.31"/><path d="M14 9.3V1.99"/><path d="M8.5 2h7"/><path d="M14 9.3a6.5 6.5 0 1 1-4 0"/><path d="M5.52 16h12.96"/>';
  const ICON = {
    back: lu('<path d="m15 18-6-6 6-6"/>', 22),
    arrowLeft: lu('<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>', 22),
    chev: lu('<path d="m9 18 6-6-6-6"/>', 18),
    chevDown: lu('<path d="m6 9 6 6 6-6"/>', 16),
    close: lu('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>', 20),
    check: lu('<path d="M20 6 9 17l-5-5"/>', 18, 2.4),
    tickSm: lu('<path d="M20 6 9 17l-5-5"/>', 14, 3.2),
    user: lu('<circle cx="12" cy="8" r="4"/><path d="M5 21a7 7 0 0 1 14 0"/>', 20, 1.6),
    doc: lu('<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v5h5"/><path d="M9 13h6"/><path d="M9 17h6"/>', 20, 1.6),
    flask: lu(FLASK_D, 20, 1.6),
    docDash: lu('<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v5h5"/><path d="M10 15h4"/>', 20, 1.6),
    phone: lu('<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z"/>', 20, 1.6),
    mail: lu('<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>', 20, 1.6),
    lock: lu('<rect width="16" height="11" x="4" y="11" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/><path d="M12 15v2"/>', 20, 1.6),
    eye: lu('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>', 20, 1.6),
    eyeOff: lu('<path d="M9.9 4.24A9 9 0 0 1 12 4c6.5 0 10 8 10 8a18 18 0 0 1-2.16 3.19"/><path d="M6.61 6.61A13.5 13.5 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.39-1.61"/><path d="m2 2 20 20"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/>', 20, 1.6),
    folder: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4.3l2 2h8.7A1.5 1.5 0 0 1 21 8.5v10a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5Z" fill="#dfe3ea" stroke="#5b6270" stroke-width="1.5"/><path d="M3 10h18" stroke="#5b6270" stroke-width="1.5"/></svg>',
    pkg: lu('<path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M12 22V12"/><path d="m3.3 7 7.703 4.734a2 2 0 0 0 1.994 0L20.7 7"/>'),
    users: lu('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'),
    person: lu('<circle cx="12" cy="7" r="4"/><path d="M5 21v-1a7 7 0 0 1 14 0v1Z"/>'),
    alertCircle: lu('<circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>', 18),
    info: lu('<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>', 18),
    search: lu('<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>', 18),
    minus: lu('<path d="M5 12h14"/>', 16),
    plus: lu('<path d="M5 12h14"/><path d="M12 5v14"/>', 16, 2.4),
    trash: lu('<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>', 16),
    shieldCheck: lu('<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1Z"/><path d="m9 12 2 2 4-4"/>', 18),
    lockFill: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 10V7a5 5 0 0 1 10 0v3h1a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Zm2 0h6V7a3 3 0 0 0-6 0Z"/><circle cx="12" cy="16" r="1.6" fill="#fff"/></svg>',
    control: lu('<path d="M21 12a9 9 0 1 1-6.22-8.56"/><path d="m9 11 3 3L22 4"/>', 18),
    /* Screen 3's marks are solid: a shield, a lock, a turning arrow. */
    shieldFill: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1Z" fill="currentColor"/><path d="m8.5 12.2 2.4 2.4 4.6-4.6" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    controlFill: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 12A8.5 8.5 0 1 1 15 4.05" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round"/><path d="M13.5 1.6 18.4 4l-3 4.4z" fill="currentColor"/><path d="m8.6 12.3 2.4 2.4 4.4-4.4" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    receipt: lu('<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M8 7h8"/><path d="M8 11h8"/><path d="M8 15h5"/>', 20, 1.6),
    banknote: lu('<rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/>', 20, 1.6),
    fileMinus: lu('<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v5h5"/><path d="M9 15h6"/>', 20, 1.6),
    cart: lu('<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>', 20, 1.6),
    coins: lu('<circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="m16.71 13.88.7.71-2.82 2.82"/>', 20, 1.6),
    orders: lu('<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v5h5"/><path d="M9 12h6"/><path d="M9 16h6"/>', 22),
  };

  /* ── brand marks, drawn at the size screens 2 and 3 show them ────────── */
  const MARK = {
    sample: function (w) {
      return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="' + w + '" height="' + w + '" aria-label="Sample data" role="img" ' +
        'fill="none" stroke="#2b2f35" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' + FLASK_D + "</svg>";
    },
    tally: function (w) {
      return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 30" width="' + w + '" height="' + Math.round(w * 30 / 64) + '" aria-label="Tally" role="img">' +
        '<text x="3" y="21" font-family="Georgia, \'Times New Roman\', serif" font-style="italic" font-weight="700" font-size="22" letter-spacing="-.5" fill="#1a1a1a">Tally</text>' +
        '<path d="M4 25.5c14-3.2 34-4 56-2.2" fill="none" stroke="#1a1a1a" stroke-width="2.3" stroke-linecap="round"/>' +
        '<path d="M5 26.6c14-2.6 33-3.2 54-1.6" fill="none" stroke="#c62828" stroke-width="1" stroke-linecap="round"/></svg>';
    },
    zoho: function (w) {
      const tile = function (x, col, ch, rot) {
        return '<g transform="rotate(' + rot + " " + (x + 7) + ' 12)"><rect x="' + x + '" y="5" width="14" height="14" rx="2" fill="' + col + '"/>' +
          '<text x="' + (x + 7) + '" y="16.3" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="11" fill="#fff">' + ch + "</text></g>";
      };
      return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 24" width="' + w + '" height="' + Math.round(w * 24 / 64) + '" aria-label="Zoho" role="img">' +
        tile(1, "#e42527", "Z", -8) + tile(17, "#089949", "O", 6) + tile(33, "#226db4", "H", -6) + tile(49, "#f9b21d", "O", 7) + "</svg>";
    },
    /* Vyapar's red and orange V, drawn to the image rather than its favicon's disc. */
    /* Xero's own mark (logos/xero.svg, Simple Icons). */
    xero: function (w) {
      return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + (w >= 40 ? "0 0 64 30" : "17 0 30 30") + '" width="' + w + '" height="' + (w >= 40 ? Math.round(w * 30 / 64) : w) + '" aria-label="Xero" role="img">' +
        '<g transform="translate(17 0) scale(1.25)"><path fill="#13B5EA" d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm6.585 14.655c-1.485 0-2.69-1.206-2.69-2.689 0-1.485 1.207-2.691 2.69-2.691 1.485 0 2.69 1.207 2.69 2.691s-1.207 2.689-2.69 2.689zM7.53 14.644c-.099 0-.192-.041-.267-.116l-2.043-2.04-2.052 2.047c-.069.068-.16.108-.258.108-.202 0-.368-.166-.368-.368 0-.099.04-.191.111-.263l2.04-2.05-2.038-2.047c-.075-.069-.113-.162-.113-.261 0-.203.166-.366.368-.366.098 0 .188.037.258.105l2.055 2.048 2.048-2.045c.069-.071.162-.108.26-.108.211 0 .375.165.375.366 0 .098-.029.188-.104.258l-2.056 2.055 2.055 2.051c.068.069.104.16.104.258 0 .202-.165.368-.365.368h-.01zm8.017-4.591c-.796.101-.882.476-.882 1.404v2.787c0 .202-.165.366-.366.366-.203 0-.367-.165-.368-.366v-4.53c0-.204.16-.366.362-.366.166 0 .316.125.346.289.27-.209.6-.317.93-.317h.105c.195 0 .359.165.359.368 0 .201-.164.352-.375.359 0 0-.09 0-.164.008l.053-.002zm-3.091 2.205H8.625c0 .019.003.037.006.057.02.105.045.211.083.31.194.531.765 1.275 1.829 1.29.33-.003.631-.086.9-.229.21-.12.391-.271.525-.428.045-.058.09-.112.12-.168.18-.229.405-.186.54-.083.164.135.18.391.045.57l-.016.016c-.21.27-.435.495-.689.66-.255.164-.525.284-.811.345-.33.09-.645.104-.975.06-1.095-.135-2.01-.93-2.28-2.01-.06-.21-.09-.42-.09-.645 0-.855.421-1.695 1.125-2.205.885-.615 2.085-.66 3-.075.63.405 1.035 1.021 1.185 1.771.075.419-.21.794-.734.81l.068-.046zm6.129-2.223c-1.064 0-1.931.865-1.931 1.931 0 1.064.866 1.931 1.931 1.931s1.931-.867 1.931-1.931c0-1.065-.866-1.933-1.931-1.933v.002zm0 2.595c-.367 0-.666-.297-.666-.666 0-.367.3-.665.666-.665.367 0 .667.299.667.665 0 .369-.3.667-.667.666zm-8.04-2.603c-.91 0-1.672.623-1.886 1.466v.03h3.776c-.203-.855-.973-1.494-1.891-1.494v-.002z"/></g></svg>';
    },
    vyapar: function (w) {
      return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="21 2 24 27" width="' + w + '" height="' + Math.round(w * 27 / 24) + '" aria-label="Vyapar" role="img">' +
        '<path d="M22 3h22l-3.5 7H29.5l5.5 5-8 13z" fill="#ee2a2f"/><path d="M22 3h22l-3.5 7H26z" fill="#f7941d"/><path d="M26 10h14.5l-6 6z" fill="#c3161c" opacity=".55"/></svg>';
    },
  };

  /* ── the image's illustrations, as SVG ───────────────────────────────── */
  const CONFETTI = [
    [22, 30, "#3b82f6", "x"], [58, 14, "#4f46e5", "d"], [96, 12, "#f59e0b", "d"], [87, 26, "#16a34a", "d"],
    [39, 42, "#f59e0b", "c"], [117, 40, "#3b82f6", "c"], [14, 58, "#16a34a", "d"], [33, 66, "#f97316", "t"],
    [106, 58, "#f59e0b", "d"], [124, 72, "#16a34a", "d"], [26, 86, "#3b82f6", "s"], [101, 83, "#f59e0b", "d"],
    [41, 96, "#f97316", "d"], [79, 101, "#6366f1", "d"], [115, 88, "#3b82f6", "d"], [92, 42, "#f97316", "c"],
  ];
  function confetti(list, dy) {
    return list.map(function (c) {
      const x = c[0], y = c[1] + dy, col = c[2];
      if (c[3] === "x") return '<path d="M' + (x - 2.5) + " " + (y - 2.5) + "l5 5M" + (x + 2.5) + " " + (y - 2.5) + 'l-5 5" stroke="' + col + '" stroke-width="1.8" stroke-linecap="round"/>';
      if (c[3] === "c") return '<path d="M' + (x - 2.6) + " " + y + 'a2.6 2.6 0 1 1 3.4 2.4" fill="none" stroke="' + col + '" stroke-width="1.6" stroke-linecap="round"/>';
      if (c[3] === "t") return '<path d="M' + x + " " + (y - 2.4) + 'l2.4 4h-4.8z" fill="' + col + '"/>';
      if (c[3] === "s") return '<rect x="' + (x - 2) + '" y="' + (y - 2) + '" width="4" height="4" rx=".8" transform="rotate(35 ' + x + " " + y + ')" fill="' + col + '"/>';
      return '<circle cx="' + x + '" cy="' + y + '" r="1.5" fill="' + col + '"/>';
    }).join("");
  }
  function heroCheck(cls) {
    /* The image scatters its confetti wider than the check: 150 by 90 around a
       45px disc. */
    const spread = CONFETTI.map(function (c) { return [65 + (c[0] - 65) * 1.3, 37 + (c[1] - 18 - 37) * 1.25, c[2], c[3]]; });
    return '<div class="ob-hero is-check' + (cls ? " " + cls : "") + '" aria-hidden="true"><svg viewBox="-10 -8 150 90" xmlns="http://www.w3.org/2000/svg">' +
      confetti(spread, 0) +
      '<circle cx="65" cy="37" r="22.5" fill="#138c40"/>' +
      '<path d="M55.5 37.5l6.5 6.5 13-13" fill="none" stroke="#fff" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round"/>' +
    "</svg></div>";
  }
  /* The files mark, at the size the cloud's slot expects. */
  const ICON_FILE_GLYPH = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="64" height="64" aria-hidden="true" ' +
    'fill="none" stroke="#2b2f35" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v5h5"/><path d="M9 13h6"/><path d="M9 17h6"/></svg>';

  function heroCloud(markSvg) {
    const tile = function (x, y, stroke, glyph) {
      return '<rect x="' + x + '" y="' + y + '" width="26" height="26" rx="6" fill="#fff" stroke="' + stroke + '" stroke-width="1"/>' + glyph;
    };
    return '<div class="ob-hero is-cloud" aria-hidden="true"><svg viewBox="0 0 170 103" xmlns="http://www.w3.org/2000/svg">' +
      '<defs><filter id="obsh" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="1" stdDeviation="1.4" flood-color="#0f172a" flood-opacity=".08"/></filter></defs>' +
      '<circle cx="62" cy="6" r="1.4" fill="#e5e7eb"/><circle cx="118" cy="12" r="1.4" fill="#e5e7eb"/>' +
      '<path d="M63 57h-2.5a12 12 0 0 1-1.4-23.9A20 20 0 0 1 97 25.5a14 14 0 0 1 14.5 17A8 8 0 0 1 109 57Z" fill="#fff" stroke="#d6d9de" stroke-width="1.2"/>' +
      '<path d="M78 58c-2 8-8 11-14 14M83 58c0 7 3 12 1 17M92 58c3 6 8 9 14 12M88 58c1 6 5 9 6 16" fill="none" stroke="#d9dce1" stroke-width="1.1" stroke-linecap="round"/>' +
      '<g transform="translate(70 31) scale(.5)">' + markSvg + "</g>" +
      '<path d="M58 42H34" stroke="#8ec9a0" stroke-width="1.1"/><path d="M38 38.5 34 42l4 3.5" fill="none" stroke="#8ec9a0" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="M111 42h24" stroke="#8ec9a0" stroke-width="1.1"/><path d="M131 38.5l4 3.5-4 3.5" fill="none" stroke="#8ec9a0" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<g filter="url(#obsh)">' +
      tile(6, 29, "#f7caca", '<rect x="12" y="35" width="14" height="14" rx="1.5" fill="#dc2626"/><rect x="14.5" y="37.5" width="4" height="4" fill="#fff"/><path d="M20.5 38h3M20.5 40.5h3M14.5 44h9M14.5 46.5h6" stroke="#fff" stroke-width="1.2"/>') +
      tile(138, 29, "#f8d7b5", '<path d="M144 38.5a1.5 1.5 0 0 1 1.5-1.5h4l1.8 2h7.2a1.5 1.5 0 0 1 1.5 1.5v7a1.5 1.5 0 0 1-1.5 1.5h-13a1.5 1.5 0 0 1-1.5-1.5z" fill="#f59e0b"/><path d="M144 42h16" stroke="#d97706" stroke-width=".8"/>') +
      tile(29, 67, "#c9dcf7", '<circle cx="42" cy="76.5" r="4.2" fill="none" stroke="#2563eb" stroke-width="2"/><path d="M34.8 88c.6-4.3 3.4-6.6 7.2-6.6s6.6 2.3 7.2 6.6z" fill="none" stroke="#2563eb" stroke-width="2" stroke-linejoin="round"/>') +
      tile(115, 67, "#f8d7b5", '<rect x="121.5" y="72" width="13" height="16" rx="1" fill="#f97316"/><path d="M124 75.5h2M129.5 75.5h2M124 79h2M129.5 79h2M124 82.5h2M129.5 82.5h2" stroke="#fff" stroke-width="1.3"/>') +
      "</g></svg></div>";
  }
  /* The small tick that sits on a title's line (21 Sep 2026) — in place of
     the large hero images, which took the room each screen needs. */
  const tick = function (cls) {
    return '<svg class="' + cls + '" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="12" fill="#138c40"/>' +
      '<path d="M7 12.4l3.3 3.3L17.2 8.8" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  };
  const TITLE_TICK = tick("ob-found-tick");
  const HERO_STORE =
    '<div class="ob-hero is-store" aria-hidden="true"><svg viewBox="0 0 170 102" xmlns="http://www.w3.org/2000/svg">' +
      confetti([[12, 8, "#3b82f6", "c"], [34, 18, "#a16207", "d"], [58, 26, "#3b82f6", "d"], [92, 26, "#16a34a", "d"], [131, 17, "#3b82f6", "d"],
        [154, 9, "#f59e0b", "s"], [10, 34, "#3b82f6", "s"], [27, 44, "#3b82f6", "c"], [150, 30, "#3b82f6", "c"], [128, 36, "#f97316", "s"],
        [20, 60, "#f59e0b", "s"], [140, 60, "#f59e0b", "c"], [11, 81, "#f59e0b", "s"], [52, 70, "#3b82f6", "d"], [128, 72, "#6366f1", "d"],
        [155, 80, "#f59e0b", "c"], [150, 98, "#3b82f6", "d"]], 0) +
      '<ellipse cx="86" cy="100" rx="56" ry="2.6" fill="#e3e6f1"/>' +
      '<rect x="53" y="44" width="70" height="56" rx="3" fill="#c7cdf3"/><rect x="67" y="67" width="41" height="33" rx="2" fill="#3f4a78"/>' +
      '<path d="M59 30h58l9 18H50z" fill="#8a96dd"/><path d="M66 30h44l4 18H62z" fill="#f4f5fb"/>' +
      '<path d="M50 48h76v4a7 7 0 0 1-7 7 7 7 0 0 1-7-7 7 7 0 0 1-7 7 7 7 0 0 1-7-7 7 7 0 0 1-7 7 7 7 0 0 1-7-7 7 7 0 0 1-7 7 7 7 0 0 1-7-7 7 7 0 0 1-7 7 7 7 0 0 1-7-7z" fill="#dfe3f8"/>' +
      '<path d="M50 48h12v4a6 6 0 0 1-12 0zM114 48h12v4a6 6 0 0 1-12 0z" fill="#6f7cd0"/>' +
      '<rect x="37" y="79" width="22" height="21" rx="1.5" fill="#e9a352"/><rect x="42" y="68" width="14" height="12" rx="1.5" fill="#f0b566"/>' +
      '<path d="M48 79v6M46.5 68v4" stroke="#c98533" stroke-width="1.4"/>' +
      '<circle cx="118" cy="88" r="12.5" fill="#f59e0b" stroke="#fff" stroke-width="2.4"/>' +
      '<path d="M112.5 88.5l3.8 3.8 7-7" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>' +
    "</svg></div>";

  /* ── sources, as screen 2 lists them ─────────────────────────────────── */
  /* mode "app": a real sign-in through the bridge. mode "files": the app's own
     export, read in this browser — neither Tally nor Vyapar offers a hosted
     API, so their exports are the honest way in. */
  const SOURCES = {
    tally: { name: "Tally", mode: "files", mark: MARK.tally },
    zoho: { name: "Zoho", mode: "app", app: "zoho", mark: MARK.zoho },
    xero: { name: "Xero", mode: "app", app: "xero", mark: MARK.xero },
    vyapar: { name: "Vyapar", mode: "files", mark: MARK.vyapar },
    files: { name: "your files", mode: "files" },
    /* Explore-only. No account, no files, no network -- it skips S03 entirely
       and goes straight to the import screen. */
    sample: { name: "Sample data", mode: "sample" },
  };
  const ACCEPT = ".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  const STORE_KEY = "fb.v7.flow";
  const ACCOUNT_KEY = "fb.v7.account";
  /* A guest is a session, not an account: its own key, in sessionStorage, so
     looking around never overwrites the account already on this device. */
  const GUEST_KEY = "fb.v7.guest";
  const ORDERS_KEY = "fb.v7.orders";
  const OAUTH_KEY = "fb.v7.zoho.pending";
  const PROGRESS = { source: 1, connect: 2, import: 2, found: 3, check: 3, ready: 3 };

  const state = {
    screen: "signup",
    sawOffer: false,          // arrived via ?start=new, so Back has somewhere to go
    view: "flow",
    form: { name: "", business: "", mobile: "", gstin: "" },
    errors: {},
    account: null,
    source: null,
    conn: { phase: "idle", handle: null, org: null },
    read: null,              // { done: steps finished, run: {stopped} }
    dataReady: null,
    parts: [],               // file parts, kept so an added file re-reads with them
    order: null,             // { customerId, customerName, lines: [{productId, name, qty, price, unit}], filter }
    created: null,
    sheet: null,
  };

  /* ── storage ─────────────────────────────────────────────────────────── */
  const ls = {
    get: function (k, s) { try { const v = (s || localStorage).getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } },
    set: function (k, v, s) { try { (s || localStorage).setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
    del: function (k, s) { try { (s || localStorage).removeItem(k); } catch (e) { /* blocked */ } },
  };
  function withoutRaw(dr) { return dr ? JSON.parse(JSON.stringify(dr, function (k, v) { return k === "raw" ? undefined : v; })) : dr; }
  function save() {
    const v = { screen: state.screen, source: state.source, dataReady: state.dataReady, parts: state.parts,
                order: state.order, created: state.created };
    if (!ls.set(STORE_KEY, v, sessionStorage)) {
      v.dataReady = withoutRaw(v.dataReady); v.parts = [];
      ls.set(STORE_KEY, v, sessionStorage);
    }
    if (state.account) ls.set(state.account.guest ? GUEST_KEY : ACCOUNT_KEY, state.account, state.account.guest ? sessionStorage : undefined);
  }
  function restore() {
    /* A guest session belongs to this tab and wins there; the account on the
       device is untouched, and comes back the moment they log in. */
    state.account = ls.get(GUEST_KEY, sessionStorage) || ls.get(ACCOUNT_KEY);
    if (!state.account) return;
    const v = ls.get(STORE_KEY, sessionStorage);
    if (!v) { state.screen = "source"; return; }
    Object.assign(state, { source: v.source, dataReady: v.dataReady, parts: v.parts || [],
                           order: v.order, created: v.created });
    // A read cannot survive a reload; it starts again from where it was started.
    state.screen = v.screen === "import" ? (v.source === "files" ? "source" : "connect") : (v.screen || "source");
    if (state.screen === "connect" && !(SOURCES[state.source] && SOURCES[state.source].mode === "app")) state.screen = "source";
    if (state.screen === "signup") state.screen = "source";
    /* Sessions stored before the Staff screen was removed (17 Sep 2026) still
       point at it. Without this they fall through draw()'s switch to the
       sign-up form, which someone who already has an account should never be
       shown again. */
    if (state.screen === "staff") state.screen = "check";
    /* Same for the Welcome screen, removed 17 Sep 2026: the flow ends at
       Order created, so a session parked on it lands there. */
    if (state.screen === "welcome") state.screen = "created";
  }

  /* ── plumbing ────────────────────────────────────────────────────────── */
  let lastPlace = null;
  function render(html) {
    const place = state.view + "/" + state.screen;
    const keep = window.scrollY;
    $("#ob-root").innerHTML = html + sheetHtml();
    if (place !== lastPlace) { lastPlace = place; window.scrollTo(0, 0); }
    else if (window.scrollY !== keep) window.scrollTo(0, keep);
    const back = $("#b-back");
    if (back) back.addEventListener("click", goBack);
    bindSheet();
    applyScrollLock();
  }
  /* A new screen closes the keyboard first: iOS Safari otherwise keeps the page
     panned where the field was, and the next screen opens shifted under the
     status bar. */
  function go(screen) {
    const a = document.activeElement;
    if (a && a !== document.body && a.blur) a.blur();
    state.screen = screen; state.sheet = null; save(); draw();
    window.scrollTo(0, 0);
  }

  const LOGO = '<img class="ob-logo" src="../../../assets/foodbridge-mark.png?v=20260921A3" alt="FoodBridge" width="28" height="28">';
  function chrome(screen, o) {
    o = o || {};
    /* 21 Sep 2026: the brand is a small mark, not a headline — the real FoodBridge
       globe (from storefront-frontend/foodbridge-logo.png), no name beside it, so the
       first thing read on the screen is its title. */
    if (o.wordmark) return '<p class="ob-wordmark">' + (o.inlineLogo ? "" : LOGO) + "</p>";
    if (o.title) {
      return '<header class="ob-top is-titled"><button class="ob-back" id="b-back" aria-label="Back">' + ICON.back + "</button>" +
        '<h1 class="ob-top-t">' + esc(o.title) + "</h1></header>";
    }
    const i = PROGRESS[screen] || 0;
    let bars = "";
    for (let k = 0; k < 4; k++) bars += '<i class="' + (k < i ? "on" : "") + '"></i>';
    return '<header class="ob-top"><button class="ob-back" id="b-back" aria-label="Back">' + ICON.arrowLeft + "</button>" +
      '<div class="ob-prog" role="progressbar" aria-valuemin="0" aria-valuemax="4" aria-valuenow="' + i + '">' + bars + "</div></header>";
  }

  /* The window that owns the platform's hash is NOT always `window.top`: the
     IVR simulator frames the platform, so `top` is the simulator and a route
     set there goes nowhere. Climb until a frame answers to FBPlatform. */
  function platformWin() {
    var w = window;
    for (var up = 0; up < 4; up++) {
      var next;
      try { next = w.parent; } catch (e) { return null; }
      if (!next || next === w) return null;
      w = next;
      try { if (w.FBPlatform) return w; } catch (e) { /* keep climbing */ }
    }
    return null;
  }

  function handoff(route) {
    var pw = platformWin();
    if (pw) { try { pw.location.hash = "#/" + route; return; } catch (e) { /* fall through */ } }
    window.location.href = "../../../index.html#/" + route;
  }

  const plural = function (n, one, many) { return n.toLocaleString("en-IN") + " " + (n === 1 ? one : many); };

  /* ── sheets: overlays on the screen they were opened from ────────────── */
  function openSheet(spec) { state.sheet = spec; draw(); }
  function closeSheet() { const s = state.sheet; state.sheet = null; if (s && s.onClose) s.onClose(); draw(); }
  function sheetHtml() {
    const s = state.sheet;
    if (!s) return "";
    return '<div class="ob-scrim" id="ob-scrim"></div>' +
      '<section class="ob-sheet" role="dialog" aria-modal="true" aria-label="' + esc(s.title) + '">' +
        '<div class="ob-sheet-grip"></div>' +
        '<header class="ob-sheet-h"><h2>' + esc(s.title) + "</h2>" +
          (s.locked ? "" : '<button class="ob-sheet-x" id="ob-sheet-x" aria-label="Close">' + ICON.close + "</button>") + "</header>" +
        '<div class="ob-sheet-b">' + s.body + "</div>" +
        (s.actions ? '<footer class="ob-sheet-f">' + s.actions + "</footer>" : "") +
      "</section>";
  }
  function bindSheet() {
    if (!state.sheet) return;
    const x = $("#ob-sheet-x"), sc = $("#ob-scrim");
    if (x) x.addEventListener("click", closeSheet);
    if (sc && !state.sheet.locked) sc.addEventListener("click", closeSheet);
    if (state.sheet.bind) state.sheet.bind();
  }
  let lockedAt = 0;
  function applyScrollLock() {
    const want = !!state.sheet, on = document.body.classList.contains("ob-locked");
    if (want === on) return;
    if (want) { lockedAt = window.scrollY; document.body.style.top = -lockedAt + "px"; document.body.classList.add("ob-locked"); }
    else { document.body.classList.remove("ob-locked"); document.body.style.top = ""; window.scrollTo(0, lockedAt); }
  }

  function goBack() {
    if (state.sheet) { if (!state.sheet.locked) closeSheet(); return; }
    switch (state.screen) {
      /* Only when the offer is where they actually came from. Someone who
         opened the web directly has never seen it, and sending them to a
         question they were not asked is worse than no back button. */
      case "signup": return state.sawOffer ? go("offer") : undefined;
      case "source": fillFormFromAccount(); return go("signup");
      case "connect": return go("source");
      case "import": return stopImport();
      case "found": return go("source");
      case "check": return go(state.dataReady ? "found" : "source");
      case "ready": return go("check");
      case "order": state.order = null; return go("ready");
      default: return;
    }
  }

  /* Buttons, not rows: what each one does is said underneath it, so the thing
     you press still looks like a thing you press. Shared by the offer screen
     and by "You're all set". */
  const pick = function (id, title, sub, alt) {
    return '<button class="ob-cta' + (alt ? " is-alt" : "") + '" id="' + id + '">' + title + "</button>" +
      (sub ? '<p class="ob-pick-s">' + sub + "</p>" : "");
  };

  /* ════════════════════════════════════════════════════════════════════
     0 · THE OFFER — the first thing a new arrival from WhatsApp sees.

     It is the consent question, and it is phrased as an OFFER rather than a
     request. "Can we contact you?" asked cold, before anything of value has
     been shown, is answered no by most people — and then exploring stops
     being a choice and becomes the default path by accident. "Shall I set up
     your business?" is the same tap and the same two outcomes, but it asks
     about what they get rather than what we take. Agreeing to have a business
     set up on this number IS the permission, recorded when it is given.

     There is no code to type. WhatsApp has already verified the number before
     the user taps anything; an OTP would prove nothing a tap does not, and
     would cost the browsers we most want to learn from.
     ════════════════════════════════════════════════════════════════════ */
  function drawOffer() {
    render(
      chrome("offer", { wordmark: true }) +
      '<main class="ob-main is-s01">' +
        '<h1 class="ob-h1 is-center s01-h">Shall I set up your business?</h1>' +
        '<p class="ob-sub is-center s01-sub">I can bring your customers, products and orders ' +
          "across from Tally, Zoho or a spreadsheet — you won\u2019t have to type them in.</p>" +
        '<div class="ob-pick" style="margin-top:2.4rem">' +
          /* Weight matters here. `is-alt` is the outlined style, so the solid
             button must be YES — making "Not now" the loud one would push
             people into exploring by visual default rather than by choice,
             and quietly turn the browse path into the main funnel. */
          pick("b-yes", "Yes, set it up", "Takes a couple of minutes") +
          pick("b-later", "Not now \u2014 show me around", "Have a look first. Nothing to undo.", true) +
        "</div>" +
      "</main>"
    );
    $("#b-yes").addEventListener("click", function () { go("signup"); });
    $("#b-later").addEventListener("click", function () { startGuest(); });
  }

  /* ════════════════════════════════════════════════════════════════════
     1 · SIGN UP
     ════════════════════════════════════════════════════════════════════ */
  function field(id, label, icon, value, o) {
    o = o || {};
    return '<div class="ob-field' + (state.errors[id] ? " is-bad" : "") + '" data-f="' + id + '">' + icon +
      '<span class="ob-field-main"><label for="f-' + id + '">' + esc(label) + "</label>" +
        '<span class="ob-field-row">' + (o.prefix ? '<span class="ob-prefix" aria-hidden="true">' + esc(o.prefix) + "</span>" : "") +
        '<input id="f-' + id + '" name="' + id + '" value="' + esc(value) + '"' +
          ' type="' + (o.type || "text") + '"' + (o.mode ? ' inputmode="' + o.mode + '"' : "") +
          (o.auto ? ' autocomplete="' + o.auto + '"' : "") + ' autocorrect="off" spellcheck="false"' +
          ' autocapitalize="' + (o.caps || "none") + '" enterkeyhint="' + (o.enter || "next") + '"' +
          (o.max ? ' maxlength="' + o.max + '"' : "") + (o.ph ? ' placeholder="' + esc(o.ph) + '"' : "") +
          (o.hint ? ' aria-describedby="h-' + id + '"' : "") + "></span></span>" +
      (o.end || "") + "</div>";
  }

  /* ── Sign Up · the rules, and how they are told ────────────────────────────
     17 Sep 2026, product owner: Create account stays disabled until the two
     required fields are right; errors and help should feel effortless.

     How it behaves:
     - Nothing is red while someone is still typing a field for the first time.
       A field is judged when they leave it, or when they try to continue.
     - Once a field has been judged, it re-judges on every keystroke, so a
       hint disappears the moment the value is right.
     - Each hint sits under its own field, says what to do (not what went
       wrong), and is read out (aria-live).
     - Typing is cleaned as it happens: the phone number keeps digits only and
       drops a pasted +91 or leading 0; the GST number is uppercased and keeps
       letters and digits only. Nothing a person types is rejected silently.
     - Tapping the disabled button is not a dead end: it points at what is
       missing, with a nudge, and puts the cursor there. */
  const SIGNUP_FIELDS = ["name", "mobile", "business", "gstin"];
  const REQUIRED = ["name", "mobile"];
  const touched = {};
  const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  const phoneKey = function (v) { return String(v || "").replace(/\D/g, "").slice(-10); };

  function cleanPhone(v) {
    let d = String(v || "").replace(/\D/g, "");
    if (d.length > 10 && d.indexOf("91") === 0) d = d.slice(2);
    if (d.length > 10 && d.charAt(0) === "0") d = d.slice(1);
    if (d.length === 11 && d.charAt(0) === "0") d = d.slice(1);
    return d.slice(0, 10);
  }
  function cleanGst(v) { return String(v || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 15); }

  /* The message for a field, or "" when it is fine. `final` is true when the
     person is trying to continue, so a half-typed optional field counts. */
  function fieldProblem(k, final) {
    const v = String(state.form[k] || "").trim();
    if (k === "name") {
      if (!v) return "Enter your full name";
      if (!/^[\p{L}][\p{L}\p{M} .'\-]*$/u.test(v)) return "Use letters only — no numbers or symbols";
      if (v.replace(/[^\p{L}]/gu, "").length < 2) return "Enter your full name";
      return "";
    }
    if (k === "mobile") {
      if (!v) return "Enter your 10-digit mobile number";
      if (!/^[6-9]/.test(v)) return "Mobile numbers start with 6, 7, 8 or 9";
      if (v.length < 10) return "Enter all 10 digits — " + (10 - v.length) + " more to go";
      /* 21 Sep 2026: no "already has an account … Log in instead" here. The
         only account on this device is the one this person just made, and
         they reach this form again by pressing Back — to edit it, not to be
         told to log in. Continuing updates that account. */
      return "";
    }
    if (k === "gstin") {
      if (!v) return "";
      if (v.length < 15) return final || touched.gstin ? "A GST number has 15 characters — " + v.length + " so far. Leave it blank if you don’t have one." : "";
      if (!GSTIN_RE.test(v)) return "This isn’t a valid GST number. It looks like 27AAPFU0939F1ZV.";
      return "";
    }
    return "";
  }
  function requiredOk() { return REQUIRED.every(function (k) { return !fieldProblem(k, true); }); }

  /* ── GST number · a REAL lookup through the bridge's /api/gstin ────────────
     The browser never holds the provider credential. A verdict belongs to the
     exact number asked about. The lookup never blocks Create account. */
  const gst = { phase: "idle", verifiedFor: "", result: null, seq: 0 };   // idle|verifying|invalid|notfound|failed
  function gstValue() { return cleanGst(state.form.gstin); }
  function gstVerified() { const g = gstValue(); return !!g && g === gst.verifiedFor && !!gst.result && gst.result.found === true; }
  function gstActive() { return !!gst.result && String(gst.result.status || "").toLowerCase() === "active"; }

  function gstEnd() {
    if (gstVerified()) return '<span class="ob-field-end" aria-label="Verified">' + ICON.shieldCheck + "</span>";
    if (gst.phase === "verifying") return '<span class="ob-verify is-busy" aria-live="polite"><span class="ob-spin"></span>Verifying</span>';
    const ready = GSTIN_RE.test(gstValue());
    return '<button type="button" class="ob-verify" id="b-verify"' + (ready ? "" : " disabled") + ">Verify</button>";
  }
  function gstBlock() {
    const box = function (cls, icon, body) {
      return '<div class="ob-callout' + cls + '" role="status" aria-live="polite">' + icon + '<div class="ob-cl-main">' + body + "</div></div>";
    };
    if (gstVerified()) {
      const r = gst.result;
      return box(gstActive() ? "" : " is-warn", ICON.shieldCheck,
        "<p><b>Business found</b></p>" +
        (r.legalName ? '<p class="ob-cl-legal">' + esc(r.legalName) + "</p>" : "") +
        (r.tradeName ? "<p>Trade name: " + esc(r.tradeName) + "</p>" : "") +
        (r.status ? "<p>Status: " + esc(r.status) + "</p>" : "") +
        (r.status && !gstActive() ? "<p><b>This GST number is not currently active.</b></p>" : "") +
        (r.legalName && !String(state.form.business || "").trim()
          ? '<button type="button" class="ob-cl-act" id="b-use-legal">Use as business name</button>' : ""));
    }
    if (gst.phase === "invalid") return box(" is-warn", ICON.alertCircle, "<p><b>The GST register doesn’t recognise this number</b></p><p>Check each character, or leave it blank for now.</p>");
    if (gst.phase === "notfound") return box(" is-warn", ICON.alertCircle, "<p><b>No business registered under this GST number</b></p><p>Check the number, or continue without it.</p>");
    if (gst.phase === "failed") return box(" is-warn", ICON.alertCircle, "<p><b>Couldn’t reach the GST service</b></p><p>Nothing is wrong with your number — we just couldn’t check it. You can continue and verify later.</p>" +
      '<button type="button" class="ob-cl-act" id="b-gst-retry">Try again</button>');
    return "";
  }

  /* Paint one field's state in place: its border, its end mark and its hint.
     No re-render, so focus, caret and the keyboard never move. */
  function paintField(k, opts) {
    const o = opts || {};
    const box = $('[data-f="' + k + '"]'), hint = $("#h-" + k);
    if (!box || !hint) return;
    const problem = touched[k] || o.final ? fieldProblem(k, o.final) : "";
    const bad = !!problem;
    box.classList.toggle("is-bad", bad);
    if (o.nudge && bad) { box.classList.remove("is-shake"); void box.offsetWidth; box.classList.add("is-shake"); }
    const input = $("#f-" + k);
    if (input) input.setAttribute("aria-invalid", bad ? "true" : "false");
    let html = "", cls = "";
    if (bad) {
      cls = "is-bad"; html = ICON.alertCircle + "<span>" + esc(problem) + "</span>";
    } else if (o.focused && k === "gstin" && !gstValue()) {
      cls = "is-help"; html = "<span>Optional. 15 characters, like 27AAPFU0939F1ZV.</span>";
    } else if (o.focused && k === "business" && !String(state.form.business || "").trim()) {
      cls = "is-help"; html = "<span>Optional. As it appears on your bills.</span>";
    }
    hint.className = "ob-hint" + (cls ? " " + cls : "");
    if (hint.getAttribute("data-html") !== html) { hint.innerHTML = html; hint.setAttribute("data-html", html); }
    if (k === "name" || k === "mobile") {
      const ok = $("#ok-" + k);
      if (ok) ok.classList.toggle("is-on", !fieldProblem(k, true));
    }
  }
  function paintGst() {
    const end = $("#gst-end"), blk = $("#gst-block"), fieldEl = $("#f-gstin");
    if (!end || !blk) return;
    end.innerHTML = gstEnd();
    blk.innerHTML = gstBlock();
    if (fieldEl) fieldEl.closest(".ob-field").classList.toggle("is-ok", gstVerified());
    const vb = $("#b-verify"); if (vb) vb.addEventListener("click", verifyGst);
    const rb = $("#b-gst-retry"); if (rb) rb.addEventListener("click", verifyGst);
    const ul = $("#b-use-legal");
    if (ul) ul.addEventListener("click", function () {
      state.form.business = gst.result.legalName; const bi = $("#f-business"); if (bi) bi.value = state.form.business;
      paintField("business"); paintGst();
    });
  }
  function paintCta() {
    const b = $("#b-create");
    if (!b) return;
    const ok = requiredOk();
    b.classList.toggle("is-disabled", !ok);
    b.setAttribute("aria-disabled", ok ? "false" : "true");
  }

  function verifyGst() {
    const g = gstValue();
    if (gst.phase === "verifying") return;
    if (!GSTIN_RE.test(g)) { touched.gstin = true; return paintField("gstin", { nudge: true }); }
    const seq = ++gst.seq;
    gst.phase = "verifying"; paintGst();
    const cfg = window.FB_INTEGRATION || {};
    const url = String(cfg.apiBaseUrl || "").replace(/\/+$/, "") + "/api/gstin?gstin=" + encodeURIComponent(g);
    fetch(url, { headers: cfg.apiKey ? { "X-FB-Key": cfg.apiKey } : {} })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (b) { return { ok: r.ok, status: r.status, body: b }; }); })
      .then(function (out) {
        if (seq !== gst.seq || gstValue() !== g) return;          // the number moved on
        const b = out.body || {};
        if (out.ok && b.found === true) { gst.result = b; gst.verifiedFor = g; gst.phase = "idle"; }
        else if (out.ok && b.found === false) { gst.phase = "notfound"; }
        else if (b.error === "invalid_gstin") { gst.phase = "invalid"; }
        else {
          gst.phase = "failed";
          console.error("[FoodBridge] GST number not checked — " + (b.error || "http_" + out.status) + (b.message ? ": " + b.message : "") + "\n  asked: " + url);
        }
        paintGst();
      })
      .catch(function (err) {
        if (seq !== gst.seq || gstValue() !== g) return;
        gst.phase = "failed";
        console.error("[FoodBridge] GST number not checked — unreachable" + (err && err.message ? ": " + err.message : "") +
          "\n  asked: " + url + "\n  Start the bridge: cd zoho-function && npm run dev, or point the page at one with ?fbapi=<base-url>");
        paintGst();
      });
  }

  function drawSignup() {
    const f = state.form;
    const okMark = function (k) { return '<span class="ob-okmark" id="ok-' + k + '" aria-hidden="true">' + ICON.check + "</span>"; };
    const wrap = function (k, html) { return '<div class="ob-fwrap">' + html + '<p class="ob-hint" id="h-' + k + '" aria-live="polite"></p></div>'; };
    render(
      /* The mark sits in front of the title here: one line, one read. */
      chrome("signup", { wordmark: true, inlineLogo: true }) +
      '<main class="ob-main is-s01">' +
        '<h1 class="ob-h1 is-center s01-h">' + LOGO + "<span>Create your account</span></h1>" +
        '<form class="ob-fields" id="signup" novalidate>' +
          wrap("name", field("name", "Full name", ICON.user, f.name, { auto: "name", caps: "words", max: 60, hint: true, end: okMark("name") })) +
          wrap("mobile", field("mobile", "Phone number", ICON.phone, f.mobile, { type: "tel", mode: "numeric", auto: "tel-national", max: 14, prefix: "+91", hint: true, end: okMark("mobile") })) +
          wrap("business", field("business", "Business name (optional)", ICON.doc, f.business, { auto: "organization", caps: "words", max: 80, hint: true })) +
          wrap("gstin", field("gstin", "GST number (optional)", ICON.shieldCheck, f.gstin || "", { caps: "characters", max: 15, enter: "go", hint: true,
            end: '<span id="gst-end" class="ob-gst-end">' + gstEnd() + "</span>" })) +
          '<button type="submit" hidden></button>' +
        "</form>" +
        '<div id="gst-block">' + gstBlock() + "</div>" +
        '<footer class="ob-foot is-inline">' +
          '<button class="ob-cta" id="b-create" aria-describedby="create-note">' + (state.account && !state.account.guest ? "Continue" : "Create account") + "</button>" +
          '<p class="ob-sr" id="create-note">Enter your full name and phone number to continue.</p>' +
          /* 21 Sep 2026: the foot is the legal line only. "Have a look around
             first" and "Log in" came out — people arrive here from WhatsApp having
             already chosen "Yes, set it up", and the chat is their way back to
             either of those. */
          '<p class="ob-terms">By continuing, you agree to our<br><button class="ob-tlink" id="b-terms">Terms of Use</button> &amp; <button class="ob-tlink" id="b-privacy">Privacy Policy</button></p>' +
        "</footer>" +
      "</main>"
    );

    const order = SIGNUP_FIELDS;
    order.forEach(function (k, i) {
      const el = $("#f-" + k);
      el.addEventListener("input", function () {
        if (k === "mobile" || k === "gstin") {
          const before = el.value, pos = el.selectionStart || before.length;
          const clean = k === "mobile" ? cleanPhone(before) : cleanGst(before);
          if (clean !== before) {
            const keptBefore = k === "mobile" ? cleanPhone(before.slice(0, pos)).length : cleanGst(before.slice(0, pos)).length;
            el.value = clean;
            try { el.setSelectionRange(keptBefore, keptBefore); } catch (e) {}
          }
        }
        f[k] = el.value;
        if (k === "gstin") {
          gst.phase = "idle"; gst.seq += 1;                         // any edit abandons a lookup in flight
          if (gstValue().length === 15) touched.gstin = true;        // a full-length number is judged at once
          paintGst();
        }
        paintField(k, { focused: true });
        paintCta();
      });
      el.addEventListener("focus", function () { paintField(k, { focused: true }); });
      el.addEventListener("blur", function () {
        f[k] = el.value.trim() === "" ? "" : el.value;
        if (String(f[k]).trim()) touched[k] = true;
        else if (REQUIRED.indexOf(k) !== -1 && touched[k] === undefined) touched[k] = false;   // left empty, not yet judged
        paintField(k);
      });
      el.addEventListener("keydown", function (e) {
        if (e.key !== "Enter") return;
        e.preventDefault();
        if (k === "gstin" && GSTIN_RE.test(gstValue()) && !gstVerified()) return verifyGst();
        const next = order[i + 1] && $("#f-" + order[i + 1]);
        if (next && k !== "gstin") next.focus(); else submit();
      });
    });
    order.forEach(function (k) { paintField(k); });
    paintGst();
    paintCta();

    const submit = function (e) {
      if (e && e.preventDefault) e.preventDefault();
      /* The disabled button still answers a tap: it shows what is missing. */
      const problems = SIGNUP_FIELDS.filter(function (k) { return !!fieldProblem(k, true); });
      if (problems.length) {
        problems.forEach(function (k) { touched[k] = true; paintField(k, { final: true, nudge: true }); });
        const first = $("#f-" + problems[0]);
        if (first) first.focus({ preventScroll: false });
        return;
      }
      createAccount();
    };
    $("#signup").addEventListener("submit", submit);
    $("#b-create").addEventListener("click", submit);
    $("#b-terms").addEventListener("click", function () { openDocSheet("Terms of Use"); });
    $("#b-privacy").addEventListener("click", function () { openDocSheet("Privacy Policy"); });
  }

  /* Nothing is asked for, and nothing already on this device is touched.

     19 Sep 2026 — a guest now lands on EXPLORE, not on S02.

     Sending someone who has just declined setup to "Where is your business
     data today?" asked them the exact question they declined, and cost about
     seven taps of import ceremony before any feature appeared. Explore and
     set-up were the same flow; only this account object separated them.
     `#/explore` is six doors into screens that already exist.

     20 Sep 2026 — the Log in sheet no longer offers this, so there is one
     caller and one destination. */
  function startGuest() {
    state.account = { guest: true, name: "", business: "", mobile: "", gstin: "", gstVerified: false, gst: null,
                      createdAt: new Date().toISOString() };
    state.dataReady = null; state.parts = []; state.order = null; state.created = null;
    state.sheet = null;
    state.screen = "source";            // where they resume if they come back to set up
    save();
    return handoff("explore");
  }

  /* Back to the form from step one: show what they entered, ready to edit. */
  function fillFormFromAccount() {
    const a = state.account; if (!a || a.guest) return;
    const f = state.form;
    if (!f.name) f.name = a.name || "";
    if (!f.mobile) f.mobile = cleanPhone(a.mobile);
    if (!f.business) f.business = a.business || "";
    if (!f.gstin) f.gstin = a.gstin || "";
  }

  function createAccount() {
    const f = state.form;
    /* A guest who signs up keeps what they already imported: the account is
       new, the work behind it is not. */
    const wasGuest = !!(state.account && state.account.guest);
    const editing = !!(state.account && !state.account.guest);
    state.account = {
      name: f.name.trim().replace(/\s+/g, " "), business: String(f.business || "").trim().replace(/\s+/g, " "),
      mobile: "+91 " + cleanPhone(f.mobile), gstin: gstValue(), gstVerified: gstVerified(),
      gst: gstVerified() ? { legalName: gst.result.legalName || null, tradeName: gst.result.tradeName || null, status: gst.result.status || null } : null,
      createdAt: new Date().toISOString(),
    };
    // The person signing up is the first member of the team, as screen 7 shows.
    if (!wasGuest && !editing) { state.dataReady = null; state.parts = []; state.order = null; state.created = null; }
    ls.del(GUEST_KEY, sessionStorage);
    go("source");
  }

  function openDocSheet(title) {
    openSheet({
      title: title,
      body: '<p class="ob-sheet-p">FoodBridge’s ' + esc(title) + " is not published in this preview yet. Your account details stay in this browser and are not sent anywhere.</p>",
      actions: '<button class="ob-cta is-ghost" id="s-close">Close</button>',
      bind: function () { $("#s-close").addEventListener("click", closeSheet); },
    });
  }

  /* Log in on this device by phone number — the account this cut keeps is local. */
  function openLogin() {
    openSheet({
      title: "Log in",
      body: '<div class="ob-fields is-sheet">' +
          field("lphone", "Phone number", ICON.phone, "", { type: "tel", mode: "numeric", auto: "tel-national", enter: "go", max: 14, prefix: "+91" }) +
        '</div><p class="ob-err" id="l-err" hidden></p>',
      /* No guest option here. Whoever opens Log in has an account; a guest
         door in this sheet was a third way in, and it opened someone else's
         dashboard. The real dead end is a number we cannot find — that one
         now leads somewhere (see below). */
      actions: '<button class="ob-cta" id="s-login">Log in</button>',
      bind: function () {
        $("#s-login").addEventListener("click", function () {
          const acc = ls.get(ACCOUNT_KEY);
          const typed = phoneKey($("#f-lphone").value);
          if (!acc || typed.length !== 10 || phoneKey(acc.mobile) !== typed) {
            const e = $("#l-err"); e.hidden = false;
            if (typed.length !== 10) { e.textContent = "Enter your 10-digit mobile number."; return; }
            /* "Create one instead" used to be plain text — the answer, with no
               way to act on it. It is a tap now, and the number they just typed
               comes with them, so it is not asked for twice. */
            e.innerHTML = 'No account with this number on this device. ' +
              '<button class="ob-tlink is-g" id="s-create" type="button">Create one instead</button>';
            $("#s-create").addEventListener("click", function () {
              state.form.mobile = typed;
              state.sheet = null;
              go("signup");
            });
            return;
          }
          /* Logging in ends the guest session, so restore() reads the account
             rather than the guest sitting in front of it. */
          ls.del(GUEST_KEY, sessionStorage);
          restore();
          state.sheet = null;
          if (state.screen === "signup") state.screen = "source";
          /* Someone logging in is coming back to the app, not to onboarding:
             their flow state is saved first, so opening onboarding again picks
             up where they left it. */
          save();
          /* The unified flow sends a returning owner straight to what needs
             them — the control tower, not the old dashboard. */
          handoff("control-tower");
        });
      },
    });
  }

  /* ════════════════════════════════════════════════════════════════════
     2 · WHERE IS YOUR DATA?
     ════════════════════════════════════════════════════════════════════ */
  /* 17 Sep 2026, product owner: Zoho and Xero are the live channels, with
     Files / Documents. Other and "I don't have any data" are gone.
     21 Sep 2026: the subtitle and the Coming soon rows (Tally, Vyapar) are
     gone too — only what someone can tap today is on the list — and Sample
     data moved off the list to a helper line beneath it. */
  function srcRow(id, mark, title, sub, soon) {
    const inner = '<span class="ob-row-logo' + (id === "zoho" ? " is-wide" : "") + '">' + mark + "</span>" +
      '<span class="ob-row-main"><span class="ob-row-t">' + title + "</span>" + (sub ? '<span class="ob-row-s">' + sub + "</span>" : "") + "</span>" +
      (soon ? '<span class="ob-row-soon">Coming soon</span>' : '<span class="ob-row-chev">' + ICON.chev + "</span>");
    if (soon) return '<div class="ob-row is-soon" aria-disabled="true">' + inner + "</div>";
    if (id === "files") {
      return '<label class="ob-row" data-src="' + id + '">' + inner + '<input type="file" id="i-' + id + '" accept="' + ACCEPT + '" multiple hidden></label>';
    }
    return '<button class="ob-row" data-src="' + id + '">' + inner + "</button>";
  }
  function drawSource() {
    render(
      chrome("source") +
      '<main class="ob-main">' +
        '<h1 class="ob-h1 s02-h">Where are your records?</h1>' +
        '<div class="ob-list is-src">' +
          srcRow("zoho", MARK.zoho(36), "Zoho") +
          srcRow("xero", MARK.xero(24), "Xero") +
          srcRow("files", ICON.doc, "Files / Documents", "Upload invoices, challans,<br>POs, Excel, CSV etc.") +
        "</div>" +
        /* Sample data is not a place records live — it is the way on for
           someone who has none of the above, so it sits under the list. */
        '<p class="ob-guest-line is-src">Don’t have these? <button class="ob-tlink is-g" id="b-sample">Try sample data</button></p>' +
      "</main>"
    );
    $$("button[data-src]").forEach(function (b) {
      b.addEventListener("click", function () {
        state.source = b.dataset.src;
        /* Sample has nothing to connect to, so S03 would be an empty screen. */
        if (b.dataset.src === "sample") return startSampleImport();
        go("connect");
      });
    });
    $("#b-sample").addEventListener("click", function () { state.source = "sample"; startSampleImport(); });
    $("#i-files").addEventListener("change", function () {
      const files = Array.prototype.slice.call(this.files || []);
      this.value = "";
      if (files.length) { state.source = "files"; startFileImport(files); }
    });
  }

  /* ════════════════════════════════════════════════════════════════════
     3 · CONNECT YOUR <X> ACCOUNT
     ════════════════════════════════════════════════════════════════════ */
  function drawConnect() {
    const s = SOURCES[state.source] && SOURCES[state.source].mode === "app" ? SOURCES[state.source] : SOURCES.zoho;
    const busy = state.conn.phase === "opening";
    const cta = s.mode === "app"
      ? '<button class="ob-cta" id="b-connect"' + (busy ? " disabled" : "") + ">" + (busy ? '<span class="ob-spin"></span>Opening ' + esc(s.name) + "…" : "Connect with " + esc(s.name)) + "</button>"
      : '<label class="ob-cta" id="b-connect">Connect with ' + esc(s.name) + '<input type="file" id="i-connect" accept="' + ACCEPT + '" multiple hidden></label>';
    render(
      chrome("connect") +
      '<main class="ob-main">' +
        '<div class="ob-hero is-logo" aria-hidden="true">' + s.mark(state.source === "vyapar" ? 52 : 108) + "</div>" +
        '<h1 class="ob-h1 is-center is-m">Connect your ' + esc(s.name) + " account</h1>" +
        '<p class="ob-sub is-center">We will securely import your data.</p>' +
        '<div class="ob-feats">' +
          '<div class="ob-feat">' + ICON.shieldFill + "<span>Auto import customers, products,<br>suppliers &amp; more</span></div>" +
          '<div class="ob-feat">' + ICON.lockFill + "<span>Secure &amp; read-only access</span></div>" +
          '<div class="ob-feat is-last">' + ICON.controlFill + "<span>You’re in control</span></div>" +
        "</div>" +
      "</main>" +
      '<footer class="ob-foot is-connect">' + cta +
        '<p class="ob-foot-note">We never make any changes in your ' + esc(s.name) + " data.</p>" +
      "</footer>"
    );
    if (s.mode === "app") {
      if (!busy) $("#b-connect").addEventListener("click", function () { startAppSignIn(s.app); });
    } else {
      $("#i-connect").addEventListener("change", function () {
        const files = Array.prototype.slice.call(this.files || []);
        this.value = "";
        if (files.length) startFileImport(files);
      });
    }
  }

  /* ── Zoho: leave for the app in the same tab; the nonce proves the return ── */
  function startAppSignIn(app) {
    const nonce = RD().newNonce();
    ls.set(OAUTH_KEY, { n: nonce, app: app, at: Date.now() }, sessionStorage);
    state.conn = { phase: "opening" };
    save(); draw();
    RD().apps[app].auth.begin(nonce, RD().returnUrl()).catch(function () {
      ls.del(OAUTH_KEY, sessionStorage);
      state.conn = { phase: "idle" };
      importFailed("We couldn\u2019t reach " + appName(app) + " just now. Nothing was read.");
    });
  }

  const appName = function (app) { return (SOURCES[app] && SOURCES[app].name) || "the app"; };

  function handleAppReturn() {
    const ret = RD().takeReturn();
    const pending = ls.get(OAUTH_KEY, sessionStorage);
    if (!ret && !pending) return;
    ls.del(OAUTH_KEY, sessionStorage);
    if (!state.account) return;
    const app = ret && SOURCES[ret.app] ? ret.app : pending && SOURCES[pending.app] ? pending.app : "zoho";
    const n = appName(app);
    state.source = app; state.screen = "connect";
    state.conn = { phase: "idle" };
    if (!ret) return;                                  // Back from the app: quietly on screen 3
    // A result this tab never asked for, or for a different app, is not a connection.
    if (!pending || ret.n !== pending.n || ret.app !== pending.app) return importFailed(n + " couldn\u2019t finish signing you in. Nothing was read.");
    if (ret.result === "denied") return importFailed("You didn\u2019t allow access in " + n + ", so nothing was read.");
    if (ret.result !== "connected" || !ret.c) return importFailed(n + " couldn\u2019t finish signing you in. Nothing was read.");
    state.conn = { phase: "connected", handle: ret.c, app: app };
    beginImport();
    discoverOrganisations();
  }

  function discoverOrganisations() {
    const handle = state.conn.handle, app = state.conn.app;
    RD().apps[app].reader.organisations(handle).then(function (orgs) {
      if (state.conn.handle !== handle || !state.read) return;
      if (!orgs.length) return importFailed(app === "xero" ? "This Xero login doesn\u2019t have an organisation FoodBridge can read." : "This Zoho account doesn\u2019t have a Zoho Books business.");
      if (orgs.length === 1) return readApp(orgs[0]);
      let picked = -1;
      openSheet({
        title: "Which business should FoodBridge read?",
        body: '<div class="ob-choices" role="radiogroup">' + orgs.map(function (o, i) {
          return '<button class="ob-choice" role="radio" aria-checked="false" data-org="' + i + '"><span class="ob-radio"></span><span class="ob-choice-t">' + esc(o.name) + "</span></button>";
        }).join("") + "</div>",
        actions: '<button class="ob-cta" id="s-read" disabled>Continue</button>',
        onClose: function () { stopImport(); },
        bind: function () {
          $$("[data-org]").forEach(function (b) {
            b.addEventListener("click", function () {
              picked = Number(b.dataset.org);
              $$("[data-org]").forEach(function (x) { const on = Number(x.dataset.org) === picked; x.classList.toggle("is-on", on); x.setAttribute("aria-checked", on); });
              $("#s-read").disabled = false;
            });
          });
          $("#s-read").addEventListener("click", function () { if (picked >= 0) { state.sheet = null; readApp(orgs[picked]); } });
        },
      });
    }, function (err) { if (state.read) importFailed(readFailedText(err && err.reason, app)); });
  }

  function readFailedText(reason, app) {
    const n = appName(app);
    return {
      busy: n + " is busy right now. Nothing was kept. Try again in a few minutes.",
      daily_limit: n + " has reached today\u2019s limit for reading this account. Nothing was kept. Try again tomorrow.",
      expired: "Your " + n + " sign-in expired before we finished. Nothing was kept.",
      forbidden: "This " + n + " login can\u2019t see your orders. Try again with the account owner\u2019s login.",
    }[reason] || n + " stopped responding. Nothing was kept.";
  }

  /* ════════════════════════════════════════════════════════════════════
     4 · IMPORTING YOUR DATA — five steps, each advanced by real work
     ════════════════════════════════════════════════════════════════════ */
  /* `add` marks an import started from the check screen for a single file:
     same screen, its own five steps, and it returns to check rather than
     going on to Data found. */
  function beginImport(add) {
    state.read = { done: 0, run: { stopped: false }, add: add || null };
    state.screen = "import";
    state.sheet = null;
    draw();
  }
  function step(n) { if (state.read && n > state.read.done) { state.read.done = n; if (state.screen === "import" && !state.sheet) drawImport(); } }
  /* ?obslow on localhost holds each step long enough to photograph screen 4. */
  const SLOW = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && /obslow/.test(location.search + (function () { try { return window.top.location.search; } catch (e) { return ""; } })());
  const pause = function () { return new Promise(function (r) { setTimeout(r, SLOW ? 2500 : 260); }); };

  function readApp(org) {
    const run = state.read.run;
    state.conn.org = org;
    step(1);                                            // connected, and the business chosen
    const app = state.conn.app;
    RD().apps[app].reader.read(state.conn.handle, org, {
      shouldStop: function () { return run.stopped; },
      onProgress: function (p) { if (!run.stopped && (p.others === "reading" || p.others === "done")) step(2); },
    }).then(async function (raw) {
      if (run.stopped || !raw) return;
      raw.app = app;
      step(2); await pause();
      const ready = window.FB_DATASET.fromApp(raw);
      step(3); await pause();
      window.FB_DATASET.toEngine(ready.dataset);
      step(4); await pause();
      if (!run.stopped) finishImport(ready, []);
    }, function (err) {
      if (!run.stopped) importFailed(readFailedText(err && err.reason, app));
    });
  }

  async function startFileImport(files) {
    beginImport();
    const run = state.read.run;
    const parts = [], failed = [];
    const take = function (i, found) {
      (found || []).forEach(function (p) { parts.push({ id: "f" + i + p.type, name: files[i].name, type: p.type, records: p.records, skipped: p.skipped }); });
    };
    step(1);                                            // the files are open
    for (let i = 0; i < files.length; i++) {
      if (run.stopped) return;
      let out;
      try { out = await RD().files.read(files[i], null, { shouldStop: function () { return run.stopped; } }); }
      catch (e) { out = { ok: false, reason: "damaged" }; }
      if (run.stopped) return;
      if (out && out.ok) take(i, out.found);
      else if (out && out.reason === "ambiguous") {
        const t = await askKind(files[i].name, out.choices);
        if (run.stopped) return;
        let again = null;
        if (t) { try { again = await RD().files.read(files[i], [t]); } catch (e) { again = null; } }
        if (again && again.ok) take(i, again.found); else failed.push(files[i].name);
      } else failed.push(files[i].name);
    }
    step(2); await pause();
    if (run.stopped) return;
    if (!parts.length) {
      return importFailed(failed.length === 1
        ? "We couldn’t find orders, customers or products in " + failed[0] + ". Its first rows need column names, such as Customer Name, Item Name and Quantity."
        : "We couldn’t find orders, customers or products in these files.");
    }
    const ready = window.FB_DATASET.fromFiles(parts);
    step(3); await pause();
    window.FB_DATASET.toEngine(ready.dataset);
    step(4); await pause();
    if (run.stopped) return;
    if (failed.length) ready.notes = Object.assign({}, ready.notes, { unreadFiles: failed });
    finishImport(ready, parts);
  }

  /* ────────────────────────────────────────────── the sample business ──
     S02's explore-only channel. Someone who has no account to connect and no
     export to hand should still get to see what FoodBridge does, rather than
     leave on S02.

     Its records are the demonstration tenant's (the same export the dev
     stand-ins use), but they arrive here as their OWN source: app "sample",
     registered in dataset.js so nothing stamps them as read from Zoho. They
     are loaded only when this row is tapped -- ~200KB that a real import
     should not pay for -- and never read the network beyond this origin.  */
  const SAMPLE_ORG = { id: "sample", name: "Sample Distributors" };
  let sampleLoading = null;

  function loadSampleRecords() {
    if (window.SEED && window.FB_ORDER_HISTORY && window.FB_SAMPLE) return Promise.resolve();
    if (sampleLoading) return sampleLoading;
    /* Carry whatever cache-busting token this build was served with, so the
       sample cannot come back stale from a version the rest of the page is
       no longer using. */
    const self = document.querySelector('script[src*="onboarding.js"]');
    const q = self && self.src.indexOf("?") !== -1 ? self.src.slice(self.src.indexOf("?")) : "";
    const base = "../../foodbridge-customer-mockup/v3/screens/customers/";
    const one = function (file) {
      return new Promise(function (res, rej) {
        const el = document.createElement("script");
        el.src = new URL(base + file + q, location.href).toString();
        el.onload = res;
        el.onerror = function () { rej(new Error(file)); };
        document.head.appendChild(el);
      });
    };
    const here = function (file) {
      return new Promise(function (res, rej) {
        const el = document.createElement("script");
        el.src = new URL(file + q, location.href).toString();
        el.onload = res;
        el.onerror = function () { rej(new Error(file)); };
        document.head.appendChild(el);
      });
    };
    sampleLoading = one("order-history.js")
      .then(function () { return one("seed.inline.js"); })
      .then(function () { return here("sample-business.js"); })
      .catch(function (e) { sampleLoading = null; throw e; });
    return sampleLoading;
  }

  /* The demonstration tenant's export, in the shape fromApp() reads -- the
     same shape the real Zoho and Xero readers hand over, so S05 onward cannot
     tell the difference and no screen needs a special case. */
  function sampleRaw() {
    const seed = window.SEED || {};
    const hist = window.FB_ORDER_HISTORY || {};
    const nameOf = function (c) { return (c.name && (c.name.en || c.name)) || c._id; };
    const customers = (seed.b2b || []).map(function (c) { return { id: c._id, name: nameOf(c) }; });
    const products = (seed.products || []).map(function (p) {
      const r = { id: p.id, name: p.name, sku: p.artNo, unit: p.unit };
      if (typeof p.systemStock === "number") r.stockOnHand = p.systemStock;
      return r;
    });
    const byName = {};
    customers.forEach(function (c) { byName[c.id] = c.name; });
    const from = new Date(Date.now() - 240 * 86400000).toISOString().slice(0, 10);
    const orders = [];
    Object.keys(hist).forEach(function (cid) {
      (hist[cid].orders || []).forEach(function (occ, i) {
        if (occ.at < from) return;
        orders.push({ id: cid + "-" + i, customerId: cid, customerName: byName[cid] || cid, date: occ.at,
          lines: (occ.lines || []).map(function (l) { return { itemId: l.productId, qty: l.qty, unit: "pcs" }; }) });
      });
    });
    /* The tenant's export stops at orders. Everything a whole business also
       has — suppliers, invoices, payments, credit notes, quotes, purchase
       orders, bills, expenses — is derived from it by sample-business.js, so
       the sample exercises every collection the Dataset can hold. */
    const modules = window.FB_SAMPLE
      ? window.FB_SAMPLE.build(seed, orders, new Date().toISOString().slice(0, 10))
      : {};
    return { app: "sample", org: SAMPLE_ORG, customers: customers, products: products, orders: orders, modules: modules };
  }

  async function startSampleImport() {
    beginImport();
    const run = state.read.run;
    try {
      await loadSampleRecords();
    } catch (e) {
      if (!run.stopped) importFailed("We couldn’t load the sample data. Check your connection and try again.");
      return;
    }
    if (run.stopped) return;
    const raw = sampleRaw();
    if (!raw.orders.length || !raw.customers.length) {
      return importFailed("The sample data didn’t load completely. Nothing was kept.");
    }
    step(1); await pause();
    if (run.stopped) return;
    step(2); await pause();
    if (run.stopped) return;
    const ready = window.FB_DATASET.fromApp(raw);
    step(3); await pause();
    if (run.stopped) return;
    window.FB_DATASET.toEngine(ready.dataset);
    step(4); await pause();
    if (run.stopped) return;
    finishImport(ready, []);
  }

  /* A file whose one name column could be either. Asked, never guessed. */
  function askKind(name, choices) {
    const list = choices && choices.length ? choices : ["products", "customers"];
    return new Promise(function (resolve) {
      let answered = false;
      openSheet({
        title: "What’s in " + name + "?",
        body: '<div class="ob-choices">' + list.map(function (t) {
          return '<button class="ob-choice" data-kind="' + t + '"><span class="ob-choice-main"><span class="ob-choice-t">' + t.charAt(0).toUpperCase() + t.slice(1) + "</span></span></button>";
        }).join("") + "</div>",
        onClose: function () { if (!answered) resolve(null); },
        bind: function () {
          $$("[data-kind]").forEach(function (b) {
            b.addEventListener("click", function () { answered = true; state.sheet = null; draw(); resolve(b.dataset.kind); });
          });
        },
      });
    });
  }

  function finishImport(ready, parts) {
    step(5);
    setTimeout(function () {
      if (!state.read || state.read.run.stopped) return;
      state.read = null;
      state.conn = { phase: "idle" };
      state.dataReady = ready;
      state.parts = parts;
      state.order = null;
      go("found");
      /* A file that could not be read is said, on the screen that shows what
         did read — never dropped quietly. */
      const unread = (ready.notes && ready.notes.unreadFiles) || [];
      if (unread.length) {
        openSheet({
          title: "We couldn\u2019t read " + (unread.length === 1 ? unread[0] : unread.length + " files"),
          body: '<p class="ob-sheet-p">' + (unread.length === 1 ? "It" : esc(unread.join(", ")) + " each") +
            " had no orders, customers or products we could find. Everything else was read and is shown here.</p>",
          actions: '<button class="ob-cta" id="s-ok">Continue</button>',
          bind: function () { $("#s-ok").addEventListener("click", closeSheet); },
        });
      }
    }, 320);
  }

  function stopImport() {
    const back = state.read && state.read.add ? "check" : null;
    if (state.read) state.read.run.stopped = true;
    state.read = null;
    state.conn = { phase: "idle" };
    if (back === "check") return go("check");
    go(state.source === "files" || state.source === "sample" ? "source" : "connect");
  }

  function importFailed(text, opts) {
    const adding = !!(state.read && state.read.add);
    if (state.read) state.read.run.stopped = true;
    state.read = null;
    state.conn = { phase: "idle" };
    state.screen = adding ? "check"
      : state.source === "files" || state.source === "sample" ? "source" : "connect";
    save();
    openSheet({
      title: (opts && opts.title) || "We couldn’t import your data",
      body: '<p class="ob-sheet-p">' + esc(text) + "</p>",
      actions: adding
        ? '<button class="ob-cta is-ghost" id="s-retry">Close</button>'
        : '<button class="ob-cta" id="s-retry">Try again</button><button class="ob-link" id="s-other">Choose another way</button>',
      bind: function () {
        $("#s-retry").addEventListener("click", closeSheet);
        const other = $("#s-other");
        if (other) other.addEventListener("click", function () { go("source"); });
      },
    });
  }

  function drawImport() {
    const s = SOURCES[state.source] || SOURCES.files;
    const r = state.read || { done: 0 };
    const add = r.add;
    /* One file added from the check screen says what it is doing to THAT file;
       a channel import says what it is doing to the channel. */
    const first = add
      ? (add.files.length === 1 ? "Opening " + add.files[0] : "Opening " + add.files.length + " files")
      : s.mode === "sample" ? "Loading the sample data" : s.mark ? "Connecting to " + s.name : "Opening your files";
    const labels = add
      ? [first, "Reading the rows", "Matching to your data", "Adding your " + add.label, "Finishing up"]
      : [first, "Fetching data", "Processing data", "Organizing data", "Finalizing setup"];
    const dot = function (on) { return '<span class="ob-ck-dot' + (on ? " is-on" : "") + '">' + (on ? ICON.tickSm : "") + "</span>"; };
    render(
      chrome(add ? "check" : "import") +
      '<main class="ob-main">' +
        heroCloud(add ? ICON_FILE_GLYPH
          : s.mark ? s.mark(64)
          : s.mode === "sample" ? MARK.sample(64)
          : '<text x="32" y="20" text-anchor="middle" font-family="Inter, sans-serif" font-weight="700" font-size="16" fill="#2b2f35">Files</text>') +
        '<h1 class="ob-h1 is-center is-m s04-h">' + (add ? (add.files.length === 1 ? "Reading your file..." : "Reading your files...") : "Importing your data...") + "</h1>" +
        '<p class="ob-sub is-center">' + (add ? "This stays on your phone." : "This may take a few minutes.") + "</p>" +
        '<div class="ob-checks" role="status" aria-live="polite">' + labels.map(function (l, i) {
          const done = i < r.done, active = i === r.done;
          return '<div class="ob-ck ' + (done ? "is-done" : active ? "is-active" : "is-wait") + '">' + dot(done) +
            '<span class="ob-ck-t">' + esc(l) + "</span>" +
            '<span class="ob-ck-end">' + (done ? dot(true) : active ? '<span class="ob-spin"></span>' : dot(false)) + "</span></div>";
        }).join("") + "</div>" +
      "</main>"
    );
  }

  /* ════════════════════════════════════════════════════════════════════
     5 · DATA FOUND   6 · DATA CHECK
     ════════════════════════════════════════════════════════════════════ */
  /* Everything a channel can hand over. Zoho reads eight modules beyond the
     three that matter, Xero six, and a files import can carry invoices -- all
     of it landed in the Dataset and none of it reached this screen, which
     showed Products and Customers and nothing else. `c` is the Dataset
     collection each row counts. */
  const FINDINGS = [
    { k: "orders", c: "orders", l: "Sales orders", icon: ICON.orders },
    { k: "products", c: "products", l: "Products", icon: ICON.pkg },
    { k: "customers", c: "customers", l: "Customers", icon: ICON.users },
    { k: "suppliers", c: "vendors", l: "Suppliers", icon: ICON.person },
    { k: "invoices", c: "invoices", l: "Invoices", icon: ICON.receipt },
    { k: "payments", c: "payments", l: "Payments", icon: ICON.banknote },
    { k: "creditNotes", c: "creditNotes", l: "Credit notes", icon: ICON.fileMinus },
    { k: "estimates", c: "estimates", l: "Quotes", icon: ICON.docDash },
    { k: "purchaseOrders", c: "purchaseOrders", l: "Purchase orders", icon: ICON.cart },
    { k: "bills", c: "bills", l: "Bills", icon: ICON.doc },
    { k: "expenses", c: "expenses", l: "Expenses", icon: ICON.coins },
  ];
  /* Everything the flow accounts for -- which is exactly what a channel can
     return. Staff was removed on 17 Sep 2026: it never came from a channel,
     so it had no place in a manifest of what one handed over. */
  const ALL_KINDS = FINDINGS;
  function counts() {
    const d = (state.dataReady && state.dataReady.dataset) || {};
    const n = function (c) { return c && c.present && c.records ? c.records.length : 0; };
    const c = {};
    FINDINGS.forEach(function (f) { c[f.k] = n(d[f.c]); });
    return c;
  }

  function drawFound() {
    const c = counts();
    const found = FINDINGS.filter(function (x) { return c[x.k]; });
    render(
      chrome("found") +
      '<main class="ob-main">' +
        /* 21 Sep 2026: the tick sits on the title's line — the confetti hero
           took the room this screen needs for its list. */
        '<h1 class="ob-h1 is-center is-m is-found-h">' +
          TITLE_TICK +
          "<span>Great! We found this data</span></h1>" +
        /* The same manifest screen 6 uses: this is the same data, so it reads
           the same way -- one card, hairline rules, counts in a column. */
        '<div class="ob-group is-found">' + found.map(function (x) {
          return '<div class="ob-grow">' +
            '<span class="ob-grow-ic">' + x.icon + "</span>" +
            '<span class="ob-grow-t">' + x.l + "</span>" +
            '<span class="ob-grow-n">' + c[x.k].toLocaleString("en-IN") + "</span>" +
          "</div>";
        }).join("") + "</div>" +
      "</main>" +
      '<footer class="ob-foot"><button class="ob-cta" id="b-continue">Continue</button></footer>'
    );
    $("#b-continue").addEventListener("click", function () { go("check"); });
  }

  /* ── screen 6 ──────────────────────────────────────────────────────────
     MUST HAVE is not a matter of taste: toEngine() builds the reorder engine
     out of products, customers and orders and reads nothing else. Without
     those three the product cannot predict an order or create one. Suppliers
     and staff used to sit in this list and BLOCK, and nothing consumed
     either. Suppliers moved down; staff is gone entirely. */
  const MUST = ["orders", "products", "customers"];

  /* One row of the manifest. Present: the count, right-aligned. Absent: what
     it is, and a chevron, because the row itself is the way to fix it — the
     actions moved into a sheet so every row is the same height and the column
     of numbers reads straight down. */
  function checkRow(x, c, must) {
    const n = c[x.k] || 0;
    if (n) {
      return '<div class="ob-grow">' +
        '<span class="ob-grow-ic">' + x.icon + "</span>" +
        '<span class="ob-grow-t">' + x.l + "</span>" +
        '<span class="ob-grow-n">' + n.toLocaleString("en-IN") + "</span>" +
      "</div>";
    }
    return '<button class="ob-grow' + (must ? " is-need" : "") + '" data-add="' + x.k + '">' +
      '<span class="ob-grow-ic">' + x.icon + "</span>" +
      '<span class="ob-grow-t">' + x.l + "</span>" +
      '<span class="ob-grow-s">' + (must ? "Missing" : "Not added") + "</span>" +
      '<span class="ob-grow-go">' + ICON.chev + "</span>" +
    "</button>";
  }

  /* Every gap is filled the same way, through one sheet, whatever the gap is.
     What it offers depends on what can honestly be done for that collection:
     a file only where dataset.js can read one and it merges, and the sample
     business otherwise. */
  function openAddSheet(x) {
    const src = SOURCES[state.source] || SOURCES.files;
    const from = src.mode === "sample" ? "the sample data" : src.mark ? "your " + src.name : "your files";
    const opts = [];
    if (canUpload(x.k)) {
      opts.push('<label class="ob-choice" data-pick="file">' +
        '<span class="ob-choice-main"><span class="ob-choice-t">Upload files</span>' +
        '<span class="ob-choice-s">CSV or Excel, one or more, read on this phone</span></span>' +
        '<input type="file" data-file="' + x.k + '" accept="' + ACCEPT + '" multiple hidden></label>');
    }
    opts.push('<button class="ob-choice" data-sample="' + x.k + '">' +
      '<span class="ob-choice-main"><span class="ob-choice-t">Use sample data</span>' +
      '<span class="ob-choice-s">Records from the demo business</span></span></button>');
    openSheet({
      title: "Add " + x.l.toLowerCase(),
      body: '<p class="ob-sheet-p">We didn’t find any in ' + esc(from) + ".</p>" +
        '<div class="ob-choices">' + opts.join("") + "</div>",
      bind: function () {
        $$("[data-sample]").forEach(function (b) {
          b.addEventListener("click", function () {
            state.sheet = null;
            fillFromSample(b.dataset.sample);
          });
        });
        $$("input[data-file]").forEach(function (inp) {
          inp.addEventListener("change", function () {
            const files = Array.prototype.slice.call(this.files || []);
            this.value = "";
            if (files.length) { state.sheet = null; addFilesAs(files, inp.dataset.file); }
          });
        });
      },
    });
  }

  function drawCheck() {
    const c = counts();
    const src = SOURCES[state.source] || SOURCES.files;
    const where = src.mode === "sample" ? "the sample data" : src.mark ? "your " + src.name : "your files";
    const must = ALL_KINDS.filter(function (x) { return MUST.indexOf(x.k) !== -1; });
    const later = ALL_KINDS.filter(function (x) { return MUST.indexOf(x.k) === -1; });
    const short = must.filter(function (x) { return !c[x.k]; });
    /* How much of what FoodBridge can use came across: the share of record
       types present. Amber while anything it needs to order is missing. */
    const pct = Math.round(100 * ALL_KINDS.filter(function (x) { return c[x.k]; }).length / ALL_KINDS.length);

    render(
      chrome("check") +
      '<main class="ob-main is-check">' +
        '<div class="ob-dq' + (short.length ? " is-short" : "") + '" role="progressbar" aria-label="Data ready" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '">' +
          '<p class="ob-dq-t"><span>Data ready</span><b>' + pct + "%</b></p>" +
          '<i style="--p:' + pct + '%"></i></div>' +
        /* 21 Sep 2026: a slim completeness bar in place of the title, and
           nothing said when everything essential is here — the lists say it.
           A line appears only to name what is missing. */
        (short.length
          /* Every one of these labels is a plural noun -- "sales orders is
             missing" is wrong however many are short. Only the sentence's
             first letter is raised; the rest stay lowercase mid-sentence. */
          ? (function () {
              const names = short.map(function (x) { return x.l.toLowerCase(); }).join(" and ");
              return '<p class="ob-sub">' + esc(names.charAt(0).toUpperCase() + names.slice(1)) +
                " are missing from " + esc(where) + ". FoodBridge needs them to predict and create orders.</p>";
            })()
          : "") +
        '<p class="ob-glabel">Must have<span>Needed to order</span></p>' +
        '<div class="ob-group">' + must.map(function (x) { return checkRow(x, c, true); }).join("") + "</div>" +
        '<p class="ob-glabel">Can add later<span>Optional</span></p>' +
        '<div class="ob-group">' + later.map(function (x) { return checkRow(x, c, false); }).join("") + "</div>" +
      "</main>" +
      '<footer class="ob-foot"><button class="ob-cta" id="b-continue">Continue</button></footer>'
    );

    /* Never disabled: someone exploring reaches the end whatever they brought. */
    $("#b-continue").addEventListener("click", function () { go("ready"); });
    $$("[data-add]").forEach(function (b) {
      b.addEventListener("click", function () {
        const x = ALL_KINDS.filter(function (k) { return k.k === b.dataset.add; })[0];
        if (x) openAddSheet(x);
      });
    });
  }

  /* A products or customers file added from the check, read AS that kind and
     joined to what is already there. */
  /* What each kind needs in a file's first row, said in the file's own words
     when we could not find it. */
  const FILE_HINT = {
    products: "Item Name", customers: "Customer Name", suppliers: "Supplier Name",
    orders: "Customer Name, Item Name, Quantity and a date",
    invoices: "Customer Name, Total and a date", payments: "Customer Name, Amount and a date",
    creditNotes: "Customer Name, Total and a date", estimates: "Customer Name, Total and a date",
    purchaseOrders: "Supplier Name, Total and a date", bills: "Supplier Name, Total and a date",
    expenses: "Total and a date, and an Account if you have one",
  };
  /* The ledger kinds fromFiles() knows nothing about, so they are merged here
     rather than rebuilt with it. Their party column is linked to a record that
     is already there, by name; a party nobody has becomes one, from this file. */
  const LEDGER = {
    invoices: { col: "invoices", into: "customers", field: "customerId" },
    payments: { col: "payments", into: "customers", field: "customerId", amount: "amount" },
    creditNotes: { col: "creditNotes", into: "customers", field: "customerId" },
    estimates: { col: "estimates", into: "customers", field: "customerId" },
    purchaseOrders: { col: "purchaseOrders", into: "vendors", field: "vendorId" },
    bills: { col: "bills", into: "vendors", field: "vendorId" },
    expenses: { col: "expenses" },
    suppliers: { col: "vendors", names: true },
  };

  function canUpload(kind) {
    if (kind === "products" || kind === "customers" || kind === "orders") return true;
    return !!LEDGER[kind];
  }

  /* Files added from the check screen, read AS the kind whose row asked for
     them. Runs on the SAME import screen a channel uses, then returns to the
     check screen with that row's count moved on.

     A set is read one file at a time and the ones that read are kept: a
     spreadsheet nobody can parse should not throw away the three beside it
     that were fine. What could not be read is said afterwards, never dropped
     quietly -- the same bargain screen 2's import makes. */
  async function addFilesAs(files, kind) {
    const label = (FINDINGS.filter(function (x) { return x.k === kind; })[0] || { l: kind }).l.toLowerCase();
    beginImport({ kind: kind, files: files.map(function (f) { return f.name; }), label: label });
    const run = state.read.run;

    step(1); await pause();
    if (run.stopped) return;

    const fileId = "a" + Date.now();
    const added = [], failed = [];
    for (let i = 0; i < files.length; i++) {
      if (run.stopped) return;
      let out;
      try { out = await RD().files.read(files[i], [kind]); } catch (e) { out = { ok: false }; }
      if (run.stopped) return;
      const got = out && out.ok ? (out.found || []).filter(function (p) { return p.type === kind && p.records && p.records.length; }) : [];
      if (!got.length) { failed.push(files[i].name); continue; }
      got.forEach(function (p, j) {
        added.push({ id: fileId + i + "_" + j, name: files[i].name, type: p.type, records: p.records, skipped: p.skipped });
      });
    }

    if (!added.length) {
      return importFailed(
        "We couldn’t find any " + label + " in " +
        (files.length === 1 ? files[0].name : "these " + files.length + " files") +
        ". The first row needs column names, such as " + (FILE_HINT[kind] || "Name") + ".",
        { title: files.length === 1 ? "We couldn’t read " + files[0].name : "We couldn’t read these files" });
    }

    step(2); await pause();
    if (run.stopped) return;

    const led = LEDGER[kind];
    if (led && kind !== "invoices") {
      added.forEach(function (part) { mergeLedgerFile(led, part, part.id); });
    } else if (!state.dataReady || state.dataReady.provenance.kind === "files") {
      /* A files import keeps its parts, so the whole set is read again through
         the same fromFiles() the first upload used -- one code path, and the
         joins across files stay right. */
      state.parts = state.parts.concat(added);
      state.dataReady = window.FB_DATASET.fromFiles(state.parts);
    } else if (led) {
      added.forEach(function (part) { mergeLedgerFile(led, part, part.id); });
    } else {
      /* Another channel's data is already here, so these files are read on
         their own through fromFiles() -- which does the customer and product
         linking, across the whole set -- and the result is merged in.
         Re-prefixed first, because fromFiles() numbers from cu1/pr1 every time
         and a second upload would collide. */
      const mini = window.FB_DATASET.fromFiles(added);
      const ds = state.dataReady.dataset;
      const reid = {};
      ["customers", "products", "orders", "invoices"].forEach(function (c) {
        const recs = (mini.dataset[c] && mini.dataset[c].present && mini.dataset[c].records) || [];
        recs.forEach(function (r) { reid[r.id] = fileId + r.id; r.id = reid[r.id]; });
      });
      ["orders", "invoices"].forEach(function (c) {
        const recs = (mini.dataset[c] && mini.dataset[c].present && mini.dataset[c].records) || [];
        recs.forEach(function (r) {
          if (reid[r.customerId]) r.customerId = reid[r.customerId];
          (r.lines || []).forEach(function (l) { if (reid[l.productId]) l.productId = reid[l.productId]; });
        });
      });
      ["customers", "products", "orders", "invoices"].forEach(function (c) {
        const recs = (mini.dataset[c] && mini.dataset[c].present && mini.dataset[c].records) || [];
        if (recs.length) mergeById(ds, c, recs);
      });
    }

    step(3); await pause();
    if (run.stopped) return;
    window.FB_DATASET.toEngine(state.dataReady.dataset);
    state.order = null;                 // the prediction was made without this
    step(4); await pause();
    if (run.stopped) return;
    step(5);
    setTimeout(function () {
      if (!state.read || state.read.run.stopped) return;
      state.read = null;
      save();
      go("check");                      // back where the row asked for it
      /* Said on the screen that shows what DID read, never dropped quietly. */
      if (failed.length) {
        openSheet({
          title: "We couldn’t read " + (failed.length === 1 ? failed[0] : failed.length + " of these files"),
          body: '<p class="ob-sheet-p">' + (failed.length === 1 ? "It" : esc(failed.join(", ")) + " each") +
            " had no " + esc(label) + " we could find. Everything else was read and is counted here.</p>",
          actions: '<button class="ob-cta is-ghost" id="s-ok">Close</button>',
          bind: function () { $("#s-ok").addEventListener("click", closeSheet); },
        });
      }
    }, 320);
  }

  /* One ledger file into one collection, with its party linked. */
  function mergeLedgerFile(led, part, fileId) {
    const ds = state.dataReady.dataset;
    if (led.names) {
      const col = collection(ds, led.col);
      const have = {};
      col.records.forEach(function (r) { have[String(r.name).toLowerCase()] = true; });
      part.records.forEach(function (r, i) {
        if (have[String(r.name).toLowerCase()]) return;
        have[String(r.name).toLowerCase()] = true;
        col.records.push({ id: fileId + "v" + i, name: r.name, from: { kind: "file", fileId: part.id, row: r.row } });
      });
      return;
    }
    /* The party this document is with, matched to a record already here. */
    let partyId = null;
    if (led.into) {
      const pcol = collection(ds, led.into);
      const byName = {};
      pcol.records.forEach(function (r) { byName[String(r.name).toLowerCase()] = r.id; });
      partyId = function (name) {
        const k = String(name || "").toLowerCase();
        if (!k) return undefined;
        if (byName[k]) return byName[k];
        const id = fileId + "p" + pcol.records.length;
        pcol.records.push({ id: id, name: name, derived: true, from: { kind: "file", fileId: part.id } });
        byName[k] = id;
        return id;
      };
    }
    const col = collection(ds, led.col);
    part.records.forEach(function (r, i) {
      const rec = { id: fileId + "d" + i, date: r.date, from: { kind: "file", fileId: part.id, row: r.row } };
      rec[led.amount || "total"] = r.total !== undefined ? r.total : r.amount;
      if (partyId) rec[led.field] = partyId(r.party !== undefined ? r.party : r.customer);
      if (r.number) rec.number = r.number;
      if (r.balance !== undefined) rec.balance = r.balance;
      if (r.dueDate) rec.dueDate = r.dueDate;
      if (r.status) rec.status = r.status;
      if (r.account) rec.account = r.account;
      col.records.push(rec);
    });
  }

  /* ── filling one collection from the sample business ───────────────────
     Screen 6 offers this for anything the channel did not return, so nobody
     is stopped by a gap they cannot fill right now.

     It copies ONE collection out of a full sample read. The catch is that a
     collection does not stand alone: sample invoices name sample customers,
     sample orders name sample products, and dropping them into a real Zoho
     dataset alone would leave rows pointing at records that are not there —
     the reorder engine reads orders by product id. So whatever the copied
     records reference is copied with them, and only what is actually missing.

     Per-record provenance is kept (`from.kind: "sample"`), exactly as a file
     added on this screen is kept as `kind: "file"`. The product owner's call
     of 17 Sep is that the SCREEN does not label these rows. */
  let sampleDatasetCache = null;

  async function sampleDataset() {
    if (sampleDatasetCache) return sampleDatasetCache;
    await loadSampleRecords();
    sampleDatasetCache = window.FB_DATASET.fromApp(sampleRaw());
    return sampleDatasetCache;
  }

  /* The collections a copied record can point at, and the field that points. */
  const REFS = {
    orders: [["customers", "customerId"], ["products", null]],
    invoices: [["customers", "customerId"]],
    payments: [["customers", "customerId"]],
    creditNotes: [["customers", "customerId"]],
    estimates: [["customers", "customerId"]],
    purchaseOrders: [["vendors", "vendorId"]],
    bills: [["vendors", "vendorId"]],
  };

  function collection(ds, key) {
    if (!ds[key] || !ds[key].present || !ds[key].records) ds[key] = { present: true, records: [] };
    return ds[key];
  }

  /* Copies `records` into ds[key], skipping any id already there. */
  function mergeById(ds, key, records) {
    const col = collection(ds, key);
    const have = {};
    col.records.forEach(function (r) { have[r.id] = true; });
    let added = 0;
    records.forEach(function (r) { if (!have[r.id]) { col.records.push(r); have[r.id] = true; added++; } });
    return added;
  }

  async function fillFromSample(kind) {
    const f = FINDINGS.filter(function (x) { return x.k === kind; })[0];
    if (!f) return;
    let src;
    try { src = await sampleDataset(); }
    catch (e) {
      return openSheet({
        title: "We couldn’t load the sample data",
        body: '<p class="ob-sheet-p">Check your connection and try again.</p>',
        actions: '<button class="ob-cta" id="s-ok">Close</button>',
        bind: function () { $("#s-ok").addEventListener("click", closeSheet); },
      });
    }
    const from = src.dataset[f.c];
    const records = (from && from.present && from.records) || [];
    if (!records.length) return;

    const ds = state.dataReady.dataset;
    mergeById(ds, f.c, records);

    /* Whatever those records name, brought along so nothing dangles. */
    (REFS[f.c] || []).forEach(function (pair) {
      const key = pair[0], field = pair[1];
      const pool = (src.dataset[key] && src.dataset[key].records) || [];
      if (!pool.length) return;
      let wanted;
      if (field) {
        const ids = {};
        records.forEach(function (r) { if (r[field]) ids[r[field]] = true; });
        wanted = pool.filter(function (r) { return ids[r.id]; });
      } else {
        /* Products are named line by line, not by one field. */
        const ids = {};
        records.forEach(function (r) { (r.lines || []).forEach(function (l) { ids[l.productId] = true; }); });
        wanted = pool.filter(function (r) { return ids[r.id]; });
      }
      mergeById(ds, key, wanted);
    });

    window.FB_DATASET.toEngine(ds);
    state.order = null;                 // the prediction was made without this
    save();
    draw();
  }

  /* ════════════════════════════════════════════════════════════════════
     8 · READY TO ORDER
     ════════════════════════════════════════════════════════════════════ */
  /* Two ways on, asked rather than assumed. The flow's own next step is the
     first order -- the predictor has already drafted one -- but someone who
     just watched FoodBridge read their business may well want to see what it
     found before they order anything.

     The control tower is not built yet, so that choice hands off to the
     dashboard. When the page exists, only the handoff below changes. */
  function drawReady() {
    /* 21 Sep 2026: the end of setup, said once. The result sits in the middle
       of the screen; the two ways on sit at the bottom, where every other
       step keeps its button — so the eye lands on "done" and the thumb on
       what's next, with nothing between them to read. */
    render(
      chrome("ready") +
      '<main class="ob-main is-ready">' +
        '<div class="ob-done">' + tick("ob-done-tick") + '<h1 class="ob-h1">You’re all set!</h1></div>' +
      "</main>" +
      '<footer class="ob-foot is-ready">' +
        '<button class="ob-cta" id="b-order">Create your first order</button>' +
        '<button class="ob-cta is-alt" id="b-tower">Open your control tower</button>' +
      "</footer>"
    );
    $("#b-order").addEventListener("click", function () { go("order"); });
    $("#b-tower").addEventListener("click", function () { save(); handoff("control-tower"); });
  }

  /* ════════════════════════════════════════════════════════════════════
     9 · CREATE ORDER
     ════════════════════════════════════════════════════════════════════ */
  function catalogue() {
    const d = (state.dataReady && state.dataReady.dataset) || {};
    const recs = function (c) { return (c && c.present && c.records) || []; };
    return { products: recs(d.products), customers: recs(d.customers), orders: recs(d.orders) };
  }
  /* A price only where the source has one: Zoho's item rate, or what a line in
     the user's own orders was charged. Never invented. */
  function priceOf(productId) {
    const cat = catalogue();
    const p = cat.products.filter(function (x) { return x.id === productId; })[0];
    if (p && p.raw) {
      const r = Number(p.raw.rate != null ? p.raw.rate : p.raw.sales_rate);
      if (isFinite(r) && r > 0) return r;
    }
    for (let i = cat.orders.length - 1; i >= 0; i--) {
      const l = (cat.orders[i].lines || []).filter(function (x) { return x.productId === productId && x.amount > 0 && x.qty > 0; })[0];
      if (l) return Math.round((l.amount / l.qty) * 100) / 100;
    }
    return null;
  }
  const money = function (n) { return "₹" + Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  function lineOf(productId, name, qty) {
    const p = catalogue().products.filter(function (x) { return x.id === productId; })[0];
    return { productId: productId, name: name || (p && p.name) || productId, qty: Math.max(1, qty || 1), price: priceOf(productId), unit: (p && p.unit) || "" };
  }
  function engineView() { return window.FB_DATASET.toEngine(state.dataReady.dataset); }

  /* The customer the reorder engine is surest has an order due, with what it
     would propose; else the shop that ordered last, with what it ordered. */
  function prefillOrder() {
    const cat = catalogue();
    const order = { customerId: null, customerName: "", lines: [], filter: "" };
    if (!cat.customers.length) return order;
    try {
      const e = engineView();
      const opp = window.FB_EVIDENCE.missedOrders({ seed: e.seed, history: e.history, predict: window.FB_PREDICT });
      const withS = opp.shops.filter(function (s) { return s.suggestion; })[0];
      if (withS) {
        order.customerId = withS.id; order.customerName = withS.name;
        order.lines = withS.suggestion.lines.slice(0, 6).map(function (l) { return lineOf(l.productId, l.name, l.suggestedQty); });
        return order;
      }
      const recent = Object.keys(e.history).map(function (id) { return { id: id, o: e.history[id].orders[0] }; })
        .filter(function (x) { return x.o; }).sort(function (a, b) { return a.o.at < b.o.at ? 1 : -1; })[0];
      if (recent) {
        const c = cat.customers.filter(function (x) { return x.id === recent.id; })[0];
        order.customerId = recent.id; order.customerName = c ? c.name : recent.id;
        order.lines = recent.o.lines.slice(0, 6).map(function (l) { return lineOf(l.productId, null, l.qty); });
        return order;
      }
    } catch (err) { /* no history: fall through */ }
    order.customerId = cat.customers[0].id; order.customerName = cat.customers[0].name;
    return order;
  }

  /* ── the build screen, cloned from Stock Audit ─────────────────────────
     Product owner, 17 Sep 2026: "exactly like create order flow from customer
     stock audit". Its markup, its classes and its interactions are that
     screen's, under `.ob-so` (see order-stockaudit.css).

     Two deliberate differences, both decided the same day:

     1 · NO STOCK AUDIT. That screen is built on a completed shelf count --
         it drives the recommendation and the per-line stock. Onboarding never
         has one, so the audit-only parts are dropped rather than faked;
         generatePredictiveOrder() takes a null audit and falls back to order
         history, which is the signal this cut does have.
     2 · NO ZOHO. Confirm creates the order in FoodBridge and hands over to
         screen 10; it does not call FB_ZOHO.createSalesOrder(). Onboarding can
         be driven by sample data, and a real sales order in the live org for a
         demonstration customer is not something this flow may raise. */
  const OB_STATE = { q: "", focused: false, adding: false, confirm: false };

  function orderTotals(lines) {
    const active = (lines || []).filter(function (l) { return Number(l.qty) > 0; });
    return { active: active, products: active.length,
             units: active.reduce(function (n, l) { return n + (Number(l.qty) || 0); }, 0) };
  }

  /* Kick off a prediction and land on the build screen. Async only so the
     working state is actually seen -- the engine is synchronous. */
  function startOrderFor(customerId, customerName) {
    state.order = { customerId: customerId, customerName: customerName, lines: [],
                    prediction: null, loading: true, committing: false };
    OB_STATE.q = ""; OB_STATE.focused = false; OB_STATE.adding = false; OB_STATE.confirm = false;
    draw();
    setTimeout(function () {
      const o = state.order;
      if (!o || o.customerId !== customerId) return;      // left mid-generation
      try {
        const e = engineView();
        const hist = (e.history[customerId] && e.history[customerId].orders) || [];
        const res = window.FB_PREDICT.generatePredictiveOrder({
          customerId: customerId,
          latestCompletedAudit: null,                      // onboarding has none
          orders: hist,
          products: e.seed.products,
          now: new Date(),
        });
        o.prediction = res;
        o.lines = res.ok ? res.lines.map(function (l) { return lineOf(l.productId, null, l.recommendedQty); }) : [];
      } catch (err) {
        o.prediction = null; o.lines = []; o.error = err;
      }
      o.loading = false;
      if (state.screen === "order") drawOrder();
    }, 650);
  }

  const obPreviewing = function () { return !OB_STATE.q.trim() && (OB_STATE.adding || OB_STATE.focused); };
  const obSearching = function () { return !!OB_STATE.q.trim() || obPreviewing(); };

  function obRowHTML(l) {
    const qty = l.qty == null ? "" : l.qty;
    return '<div class="qc-line qc-row ord-row' + (Number(l.qty) > 0 ? " done" : "") + '" data-order-row="' + esc(l.productId) + '">' +
      '<div class="info">' +
        '<div class="nm" title="' + esc(l.name) + '">' + esc(l.name) + "</div>" +
        '<div class="meta ask">Remove?</div>' +
      "</div>" +
      '<span class="qty-col">' +
        (l.price != null ? '<span class="line-econ">' + esc(money(l.price)) + (l.unit ? "/" + esc(l.unit) : "") + "</span>" : "") +
        '<span class="pd-stepper" data-field="' + esc(l.productId) + '">' +
          '<button type="button" data-delta="-1">−</button>' +
          '<span class="val"><input type="text" inputmode="numeric" autocomplete="off" autocorrect="off" spellcheck="false" enterkeyhint="done" size="3" value="' + qty + '" placeholder="0"></span>' +
          '<button type="button" data-delta="1">+</button>' +
        "</span>" +
      "</span>" +
      '<button type="button" class="qc-remove" data-order-remove="' + esc(l.productId) + '" aria-label="Remove ' + esc(l.name) + '">' + ICON.trash + "</button>" +
      '<button type="button" class="ci-btn sm yes" data-order-remove-yes="' + esc(l.productId) + '" aria-label="Confirm removing ' + esc(l.name) + '">✓</button>' +
      '<button type="button" class="ci-btn sm no" data-order-remove-no="' + esc(l.productId) + '" aria-label="Keep ' + esc(l.name) + '">✗</button>' +
    "</div>";
  }

  function obEmptyHTML() {
    const o = state.order;
    if (o.error) return '<div class="ord-note">Couldn’t generate a recommendation</div>';
    if (o.prediction && !o.prediction.ok) return '<div class="ord-note">No recommendation</div>';
    return '<div class="ord-note">No products yet</div>';
  }

  function obFootHTML() {
    const t = orderTotals(state.order.lines);
    if (state.order.committing) return '<button type="button" class="btn-wide primary" disabled>Creating order…</button>';
    if (!OB_STATE.confirm) {
      return (obSearching() ? "" : '<button type="button" class="btn-add" id="obAdd">+ Add Product</button>') +
        '<button type="button" class="btn-wide primary" id="obConfirm"' + (t.products ? "" : " disabled") + ">Confirm Order</button>";
    }
    return '<span class="confirm-inline">' +
        '<span class="ci-copy"><span class="ci-prompt">Confirm order?</span>' +
        '<span class="ci-detail">' + esc(plural(t.products, "product", "products")) + " · " + esc(plural(t.units, "unit", "units")) + "</span></span>" +
        '<button type="button" class="ci-btn yes" id="obYes" aria-label="Confirm order">✓</button>' +
        '<button type="button" class="ci-btn no" id="obNo" aria-label="Keep editing">✗</button>' +
      "</span>";
  }

  function drawOrder() {
    if (!state.order) {
      const pre = prefillOrder();
      if (!pre.customerId) { render(chrome(null, { title: "Create Order" }) + '<main class="ob-main"><p class="ob-sub">No customers to order for.</p></main>'); return; }
      return startOrderFor(pre.customerId, pre.customerName);
    }
    const o = state.order;

    if (o.loading) {
      render(
        chrome(null, { title: "Create Order" }) +
        '<main class="ob-main ob-so">' +
          '<div class="ws-head">' +
            '<button type="button" class="ws-who">' + esc(o.customerName) + "</button>" +
            '<div class="ws-count">Preparing order…</div>' +
            '<div class="ws-bar indeterminate"><span></span></div>' +
          "</div>" +
        "</main>"
      );
      return;
    }

    const cat = catalogue();
    const q = OB_STATE.q.trim().toLowerCase();
    const chosen = o.lines.map(function (l) { return l.productId; });
    const available = cat.products.filter(function (p) { return chosen.indexOf(p.id) === -1; });
    const results = !obSearching() ? []
      : q ? available.filter(function (p) { return (p.name + " " + (p.sku || "")).toLowerCase().indexOf(q) !== -1; })
          : available.slice().sort(function (a, b) { return a.name.localeCompare(b.name); }).slice(0, 5);
    const t = orderTotals(o.lines);
    const recommended = !!(o.prediction && o.prediction.ok);

    render(
      chrome(null, { title: "Create Order" }) +
      '<main class="ob-main ob-so">' +
        '<div class="ws-head">' +
          '<button type="button" class="ws-who" id="obWho">' + esc(o.customerName) + "</button>" +
          '<div class="ws-count">' + (t.products ? esc(plural(t.products, "product", "products")) + " · " + esc(plural(t.units, "unit", "units")) : "Nothing to order yet") + "</div>" +
          '<div class="ws-bar"><span style="width:' + (o.lines.length ? Math.round((t.products / o.lines.length) * 100) : 0) + '%"></span></div>' +
        "</div>" +
        '<div class="sah-search-row"><div class="sah-search">' +
          '<input type="search" id="obQ" autocomplete="off" autocorrect="off" spellcheck="false" value="' + esc(OB_STATE.q) + '" placeholder="Search product"></div></div>' +
        (obSearching()
          ? '<div class="picker-list dropdown">' + (results.length
              ? results.map(function (p) {
                  return '<button type="button" class="picker-row" data-order-add="' + esc(p.id) + '">' +
                    '<span><span class="nm">' + esc(p.name) + "</span>" +
                    (p.sku ? '<div class="sub">' + esc(p.sku) + "</div>" : "") + "</span>" +
                    '<span class="add-ic" aria-hidden="true">+</span></button>';
                }).join("")
              : '<div class="dropdown-empty">No product found</div>') +
            (obPreviewing() && available.length > results.length
              ? '<div class="suggest-hint">Showing ' + results.length + " of " + plural(available.length, "product", "products") + " — keep typing to search all</div>"
              : "") + "</div>"
          : (o.lines.length ? '<div class="section-head-row attached"><h2>' + (recommended ? "Recommended" : "Products") + "</h2>" +
                (recommended ? '<span class="ord-basis-line">From ' + esc(plural((o.prediction.context && o.prediction.context.recentOrderCount) || 0, "order", "orders")) + "</span>" : "") + "</div>" : "") +
            (o.lines.length ? '<div class="qc-card">' + o.lines.map(obRowHTML).join("") + "</div>" : obEmptyHTML())) +
      "</main>" +
      '<footer class="sah-foot ws-foot ob-so"><div class="inner" id="obFoot">' + obFootHTML() + "</div></footer>"
    );
    wireOrderBuild();
  }

  function obRefreshChrome() {
    const o = state.order, t = orderTotals(o.lines);
    const c = $(".ws-count"); if (c) c.textContent = t.products ? plural(t.products, "product", "products") + " · " + plural(t.units, "unit", "units") : "Nothing to order yet";
    const b = $(".ws-bar > span"); if (b) b.style.width = (o.lines.length ? Math.round((t.products / o.lines.length) * 100) : 0) + "%";
    const f = $("#obFoot"); if (f) { f.innerHTML = obFootHTML(); wireOrderFoot(); }
  }

  function wireOrderBuild() {
    const o = state.order;
    const inp = $("#obQ");
    if (inp) {
      inp.addEventListener("input", function () { OB_STATE.q = inp.value; drawOrder(); });
      inp.addEventListener("focus", function () { OB_STATE.focused = true; drawOrder(); });
      inp.addEventListener("blur", function () {
        setTimeout(function () {
          if (state.screen !== "order") return;
          OB_STATE.focused = false; OB_STATE.adding = false; drawOrder();
        }, 140);
      });
    }
    const add = function (p) {
      if (!p) return;
      if (!o.lines.some(function (l) { return l.productId === p.id; })) {
        const line = lineOf(p.id, p.name, 1);
        line.qty = 0;                                    // theirs to set, not ours
        o.lines.unshift(line);
      }
      OB_STATE.q = ""; OB_STATE.adding = false; OB_STATE.focused = false;
      save(); drawOrder();
    };
    $$("[data-order-add]").forEach(function (b) {
      b.addEventListener("mousedown", function (e) { e.preventDefault(); });
      b.addEventListener("click", function () { add(cat_by_id(b.dataset.orderAdd)); });
    });

    /* Removal asks in the row, exactly as Stock Audit's does. */
    $$("[data-order-remove]").forEach(function (b) {
      b.addEventListener("click", function () {
        $$(".qc-row.confirming").forEach(function (r) { r.classList.remove("confirming"); });
        b.closest(".qc-row").classList.add("confirming");
      });
    });
    $$("[data-order-remove-no]").forEach(function (b) {
      b.addEventListener("click", function () { b.closest(".qc-row").classList.remove("confirming"); });
    });
    $$("[data-order-remove-yes]").forEach(function (b) {
      b.addEventListener("click", function () {
        o.lines = o.lines.filter(function (l) { return l.productId !== b.dataset.orderRemoveYes; });
        save(); drawOrder();
      });
    });

    /* Quantity, in place -- never a re-render, or the caret is lost mid-type. */
    $$(".ord-row .pd-stepper").forEach(function (st) {
      const line = o.lines.filter(function (l) { return l.productId === st.dataset.field; })[0];
      if (!line) return;
      const row = st.closest(".qc-row");
      const box = st.querySelector("input");
      const set = function (v) {
        const qty = Math.max(0, Math.floor(Number(v) || 0));
        box.value = qty; line.qty = qty;
        row.classList.toggle("done", qty > 0);
        save(); obRefreshChrome();
      };
      st.querySelectorAll("[data-delta]").forEach(function (b) {
        b.addEventListener("click", function () { set((Number(box.value) || 0) + Number(b.dataset.delta)); });
      });
      box.addEventListener("input", function () { set(box.value); });
    });

    const who = $("#obWho");
    if (who) who.addEventListener("click", openCustomerSheet);
    wireOrderFoot();
  }

  /* Re-wired on every footer swap, since the footer replaces its own markup. */
  function wireOrderFoot() {
    const a = $("#obAdd");
    if (a) a.addEventListener("click", function () { OB_STATE.adding = true; drawOrder(); setTimeout(function () { const i = $("#obQ"); if (i) i.focus(); }, 0); });
    const c = $("#obConfirm");
    if (c) c.addEventListener("click", function () { OB_STATE.confirm = true; obRefreshChrome(); });
    const no = $("#obNo");
    if (no) no.addEventListener("click", function () { OB_STATE.confirm = false; obRefreshChrome(); });
    const yes = $("#obYes");
    if (yes) yes.addEventListener("click", function () {
      state.order.lines = state.order.lines.filter(function (l) { return Number(l.qty) > 0; });
      state.order.committing = true;
      OB_STATE.confirm = false;
      obRefreshChrome();
      /* Created in FoodBridge, and nowhere else: no bridge call. Screen 10
         takes over from here. */
      setTimeout(createOrder, 420);
    });
  }

  function cat_by_id(id) { return catalogue().products.filter(function (p) { return p.id === id; })[0]; }


  /* Changing who the order is for starts that customer's order, the way
     Stock Audit's pick screen does -- a new customer gets their own
     recommendation, not the last one's lines. */
  function openCustomerSheet() {
    const cat = catalogue();
    let filter = "";
    const list = function () {
      const q = filter.trim().toLowerCase();
      const hits = cat.customers.filter(function (c) { return !q || c.name.toLowerCase().indexOf(q) !== -1; }).slice(0, 40);
      return hits.map(function (c) {
        return '<button class="ob-rec" data-cust="' + esc(c.id) + '"><span class="ob-rec-a">' + esc(c.name) + "</span>" +
          (c.id === state.order.customerId ? '<span class="ob-rec-b">' + ICON.check + "</span>" : "") + "</button>";
      }).join("");
    };
    openSheet({
      title: "Customer",
      body: '<label class="ob-osearch is-sheet">' + ICON.search + '<input id="c-q" type="search" autocorrect="off" autocapitalize="words" placeholder="Search ' + cat.customers.length + ' customers"></label>' +
        '<div class="ob-reclist" id="c-list">' + list() + "</div>",
      bind: function () {
        const bindList = function () {
          $$("[data-cust]").forEach(function (b) {
            b.addEventListener("click", function () {
              const c = cat.customers.filter(function (x) { return x.id === b.dataset.cust; })[0];
              state.sheet = null;
              if (!c || c.id === state.order.customerId) { draw(); return; }
              startOrderFor(c.id, c.name);
            });
          });
        };
        bindList();
        const inp = $("#c-q");
        inp.addEventListener("input", function () { filter = inp.value; $("#c-list").innerHTML = list(); bindList(); });
      },
    });
  }

  function createOrder() {
    const o = state.order;
    const orders = ls.get(ORDERS_KEY) || [];
    const priced = o.lines.every(function (l) { return l.price != null; });
    const rec = {
      no: "FB-ORD-" + String(orders.length + 1).padStart(4, "0"),
      customerId: o.customerId, customer: o.customerName, lines: o.lines,
      amount: priced ? o.lines.reduce(function (n, l) { return n + l.price * l.qty; }, 0) : null,
      items: o.lines.reduce(function (n, l) { return n + l.qty; }, 0),
      date: new Date().toISOString(), business: state.account && state.account.business,
    };
    orders.push(rec);
    ls.set(ORDERS_KEY, orders);
    state.created = rec;
    state.order = null;
    go("created");
  }

  /* ════════════════════════════════════════════════════════════════════
     10 · ORDER CREATED   11 · YOU'RE READY
     ════════════════════════════════════════════════════════════════════ */
  /* "26 May 2024", as the image writes it, on every engine: Chromium's en-GB
     says "Sept" where Safari says "Sep". */
  function shortDate(iso) {
    const d = new Date(iso);
    return d.getDate() + " " + ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getMonth()] + " " + d.getFullYear();
  }
  function orderCard(r) {
    return '<div class="ob-card is-kv">' +
      '<p class="ob-card-h">Order Details</p>' +
      '<div class="ob-kvr"><span>Order No.</span><b>' + esc(r.no) + "</b></div>" +
      '<div class="ob-kvr"><span>Customer</span><b>' + esc(r.customer) + "</b></div>" +
      '<div class="ob-kvr"><span>Order Amount</span><b>' + (r.amount != null ? money(r.amount) : plural(r.items, "item", "items")) + "</b></div>" +
      '<div class="ob-kvr"><span>Date</span><b>' + shortDate(r.date) + "</b></div>" +
    "</div>";
  }
  function drawCreated() {
    const r = state.created;
    if (!r) return go("order");
    render(
      '<div class="ob-top is-bare"></div>' +
      '<main class="ob-main">' +
        heroCheck("is-top") +
        '<h1 class="ob-h1 is-center s10-h">Order created!</h1>' +
        orderCard(r) +
      "</main>" +
      '<footer class="ob-foot"><button class="ob-cta" id="b-dash">Open your control tower</button></footer>'
    );
    /* The same destination screen 8 offers, under the same name — and since
       19 Sep 2026 it is a real screen rather than a promise pointed at the
       dashboard. See screens/control-tower.html. */
    $("#b-dash").addEventListener("click", function () { save(); handoff("control-tower"); });
  }

  /* The Order Drafts destination (?view=drafts): the orders created here. */
  function drawOrdersHome() {
    const orders = (ls.get(ORDERS_KEY) || []).slice().reverse();
    render(
      chrome(null, { wordmark: true }) +
      '<main class="ob-main">' +
        (orders.length
          ? '<h1 class="ob-h1 is-center s11-h">' + plural(orders.length, "order", "orders") + "</h1>" +
            '<p class="ob-sub is-center">Created in FoodBridge on this device.</p>' +
            orders.map(orderCard).join("")
          : HERO_STORE + '<h1 class="ob-h1 is-center">No orders yet</h1><p class="ob-sub is-center">Orders you create are listed here.</p>') +
      "</main>" +
      '<footer class="ob-foot"><button class="ob-cta" id="b-start">' + (orders.length ? "Back to onboarding" : "Start onboarding") + "</button></footer>"
    );
    $("#b-start").addEventListener("click", function () { handoff("onboarding"); });
  }

  /* ── run ─────────────────────────────────────────────────────────────── */
  function draw() {
    if (state.view === "drafts") return drawOrdersHome();
    /* Nobody without an account may land deeper in the flow. The OFFER is the
       one screen that is legitimately pre-account — it is what a new arrival
       from WhatsApp meets before deciding whether to have one — so it is
       exempt, and everything else still falls back to sign-up. */
    if (!state.account && state.screen !== "offer") state.screen = "signup";
    switch (state.screen) {
      case "offer": return drawOffer();
      case "source": return drawSource();
      case "connect": return drawConnect();
      case "import": return drawImport();
      case "found": return drawFound();
      case "check": return drawCheck();
      case "ready": return drawReady();
      case "order": return drawOrder();
      case "created": return drawCreated();
      default: return drawSignup();
    }
  }

  /* iOS never shrinks the layout viewport for the keyboard: publish how much it
     covers so the sticky footer and an open sheet sit above it. */
  function trackKeyboard() {
    const vv = window.visualViewport;
    if (!vv) return;
    let raf = 0;
    /* Measured on iOS 26.5: the visual viewport already excludes Safari's form
       accessory bar, so nothing is added for it (adding 44 left a gap). */
    const ACCESSORY = 0;
    const apply = function () {
      raf = 0;
      const hidden = window.innerHeight - (vv.offsetTop + vv.height);
      const open = hidden > 1;
      document.documentElement.style.setProperty("--ob-kb", Math.round(open ? Math.max(0, hidden) + ACCESSORY : 0) + "px");
      document.documentElement.classList.toggle("ob-kb-open", open);
    };
    const schedule = function () { if (!raf) raf = requestAnimationFrame(apply); };
    vv.addEventListener("resize", schedule);
    vv.addEventListener("scroll", schedule);
    apply();
  }
  function keepFocusVisible(e) {
    const el = e.target;
    if (!el || !/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
    setTimeout(function () {
      const r = el.getBoundingClientRect();
      const kb = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--ob-kb")) || 0;
      if (r.bottom > window.innerHeight - kb - 16 || r.top < 8) el.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 320);
  }

  /* Reads `signup=1` from this page's own query and from the platform hash
     above it — #/onboarding?signup=1 — and clears it from whichever carried
     it, so the flag acts exactly once. */
  function takeFlag(key, want) { return takeParam(key, want) != null; }
  /* The value behind `key`, taken the same way — read once, then wiped. */
  function takeParam(key, want) {
    let found = null;
    const hit = function (v) { return want ? v === want : !!v; };
    try {
      const own = new URL(location.href);
      if (hit(own.searchParams.get(key))) {
        found = own.searchParams.get(key);
        own.searchParams.delete(key);
        history.replaceState(null, "", own.pathname + own.search + own.hash);
      }
    } catch (e) { /* nothing readable here */ }
    /* The platform's hash is the frame ABOVE this one, which is not always
       `window.top`: the IVR simulator frames the platform, so from in here
       `top` is the simulator and the flag would never be seen. Walk out one
       frame at a time and take it from whichever level is carrying it. */
    var w = window;
    for (var up = 0; up < 4; up++) {
      var next;
      try { next = w.parent; } catch (e) { break; }
      if (!next || next === w) break;
      w = next;
      try {
        const h = String(w.location.hash || "");
        const q = h.indexOf("?");
        if (q === -1) continue;
        const params = new URLSearchParams(h.slice(q + 1));
        if (!hit(params.get(key))) continue;
        found = params.get(key);
        params.delete(key);
        const rest = params.toString();
        w.history.replaceState(null, "", w.location.pathname + w.location.search +
          h.slice(0, q) + (rest ? "?" + rest : ""));
        break;
      } catch (e) { /* a window we may not touch — keep climbing */ }
    }
    return found;
  }
  function takeSignupFlag() { return takeFlag("signup"); }
  /* `phone` is the number the person is chatting from, put on the link by the
     WhatsApp IVR (#/onboarding?signup=1&phone=919876543210). It rides in the
     hash, so it never reaches a server log, and it is wiped once read. */
  function takePhone() {
    const d = cleanPhone(takeParam("phone") || "");
    /* Kept for this tab only, so a reload of the form still shows it. */
    try {
      if (/^[6-9]\d{9}$/.test(d)) { sessionStorage.setItem("fb.ob.waPhone", d); return d; }
      return sessionStorage.getItem("fb.ob.waPhone") || "";
    } catch (e) { return /^[6-9]\d{9}$/.test(d) ? d : ""; }
  }
  /* `?start=new` is what the WhatsApp row "I'm new here" carries. It opens on
     the OFFER rather than the account form, because the first thing a new
     arrival should meet is a choice, not a set of fields. */
  function takeStartNew() { return takeFlag("start", "new"); }

  function mount() {
    /* ?obreset on localhost: start as a brand-new user. Removed from the address
       at once, so the return from a sign-in never replays it. */
    if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && /[?&]obreset/.test(location.search)) {
      [ACCOUNT_KEY, ORDERS_KEY].forEach(function (k) { ls.del(k); });
      [STORE_KEY, OAUTH_KEY, GUEST_KEY].forEach(function (k) { ls.del(k, sessionStorage); });
      const u = new URL(location.href); u.searchParams.delete("obreset");
      history.replaceState(null, "", u.pathname + u.search + u.hash);
    }
    trackKeyboard();
    document.addEventListener("focusin", keepFocusVisible);
    restore();
    /* "Become a part of FoodBridge", at the end of a demo, means the sign-up
       screen — not whatever account this browser was left holding. The flag
       arrives on the PLATFORM's hash (#/onboarding?signup=1), because that is
       the address the end-of-demo sheet can set from inside another module's
       iframe; it is read once and wiped, so a reload is not a second reset. */
    if (takeSignupFlag()) {
      [ACCOUNT_KEY, ORDERS_KEY].forEach(function (k) { ls.del(k); });
      [STORE_KEY, OAUTH_KEY, GUEST_KEY].forEach(function (k) { ls.del(k, sessionStorage); });
      state.account = null; state.dataReady = null; state.parts = [];
      state.order = null; state.created = null; state.screen = "signup";
    }
    /* A brand-new arrival from WhatsApp. Only ever shown to someone with no
       account on this device — a returning user who taps the wrong row should
       not be asked to set up a business they already have. */
    /* The WhatsApp number fills the phone field; they only need their name. */
    const waPhone = takePhone();
    if (waPhone && !state.account && !state.form.mobile) state.form.mobile = waPhone;
    /* A name, when the way in was the demo's exit ("Submit & set up my
       account") — typed there, so not asked for twice. Read once, wiped. */
    const inName = String(takeParam("name") || "").trim().slice(0, 60);
    if (inName && !state.account && !state.form.name) state.form.name = inName;
    if (takeStartNew() && !state.account) {
      state.sawOffer = true;
      state.screen = "offer";
    }
    handleAppReturn();
    /* Back from Zoho can restore this page from the browser cache with its frame
       dead to touch on iOS Safari; a cached restore mid sign-in is reloaded. */
    [window, RD().topWin()].forEach(function (w) {
      try {
        w.addEventListener("pageshow", function (e) {
          if (!e.persisted) return;
          if (!ls.get(OAUTH_KEY, sessionStorage) && state.conn.phase !== "opening") return;
          RD().topWin().location.reload();
        });
      } catch (x) { /* a window we may not listen to */ }
    });
    if (new URLSearchParams(location.search).get("view") === "drafts") state.view = "drafts";
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && state.sheet && !state.sheet.locked) closeSheet(); });
    draw();
    /* ?obdebug on localhost: the viewport this device actually gives the page. */
    if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && /obdebug/.test(location.search)) {
      const d = document.createElement("div");
      d.style.cssText = "position:fixed;left:4px;bottom:calc(4px + env(safe-area-inset-bottom));z-index:99;font:11px monospace;background:#000;color:#0f0;padding:3px";
      const probe = document.createElement("div");
      probe.style.cssText = "position:fixed;top:0;height:env(safe-area-inset-bottom);width:1px;visibility:hidden";
      document.body.appendChild(probe); document.body.appendChild(d);
      d.textContent = "inner " + innerWidth + "x" + innerHeight + " vv " + Math.round(visualViewport.height) + " sab " + probe.offsetHeight + " dvh-root " + $("#ob-root").offsetHeight;
    }
  }

  window.FB_ONBOARDING = { mount: mount, state: state, draw: draw, go: go, save: save, counts: counts, prefillOrder: prefillOrder };
})();
