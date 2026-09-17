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
      7  Quick setup (Staff)      the team, kept in this browser
      8  Ready to order           how many of the four are ready
      9  Create order             a real customer and real products, prefilled
                                  from the reorder engine where it can predict
     10  Order created            the order FoodBridge holds
     11  You're ready             into FoodBridge

   REAL: Zoho Books sign-in and read (zoho-function/onboarding.js), Excel and
   CSV read in this browser (dataset.js), FB_PREDICT. Dev stand-ins for both
   readers exist only on localhost with ?fbmock=… (readers.js guards it).
   HELD IN THIS BROWSER, and said nowhere to be anything else: the account,
   the staff list and the orders created — this cut has no backend for them.
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
    staff: lu('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="m16 11 2 2 4-4"/>'),
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
    orders: lu('<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v5h5"/><path d="M9 12h6"/><path d="M9 16h6"/>', 22),
    track: lu('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 16l4-5 3 3 3-4"/>', 22),
    grow: lu('<path d="M3 20h18"/><path d="M6 16v-3"/><path d="M11 16v-6"/><path d="M16 16v-9"/><path d="m14 5 4-2 1 4"/>', 22),
  };

  /* ── brand marks, drawn at the size screens 2 and 3 show them ────────── */
  const MARK = {
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
  const HERO_CLIP =
    '<div class="ob-hero is-clip" aria-hidden="true"><svg viewBox="0 0 106 104" xmlns="http://www.w3.org/2000/svg">' +
      '<circle cx="52" cy="46" r="40" fill="#f1f3f8"/><ellipse cx="50" cy="93" rx="46" ry="3.2" fill="#e8eaf2"/>' +
      '<path d="M8 8.5l1 2.2 2.2 1-2.2 1-1 2.2-1-2.2-2.2-1 2.2-1z M91 3l1 2.2 2.2 1-2.2 1-1 2.2-1-2.2-2.2-1 2.2-1z M4 74l.8 1.8 1.8.8-1.8.8-.8 1.8-.8-1.8-1.8-.8 1.8-.8z M99 74l.8 1.8 1.8.8-1.8.8-.8 1.8-.8-1.8-1.8-.8 1.8-.8z" fill="#e4e7f0"/>' +
      '<rect x="18" y="10" width="62" height="82" rx="4" fill="#fff" stroke="#c9cff0" stroke-width="3.2"/>' +
      '<rect x="36" y="5.5" width="26" height="9" rx="2.2" fill="#3b4258"/><circle cx="49" cy="4.5" r="3.4" fill="#3b4258"/><circle cx="49" cy="4.5" r="1.3" fill="#fff"/>' +
      '<path d="M29 29l3.2 3.2L38 25.6" fill="none" stroke="#1d4ed8" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="M29 43.5l3.2 3.2L38 40M29 58l3.2 3.2L38 54.5M29 72.5l3.2 3.2L38 69" fill="none" stroke="#c6cbeb" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="M44 29h23M44 43.5h23M44 58h19M44 72.5h11" stroke="#cfd4ee" stroke-width="2.4" stroke-linecap="round"/>' +
      '<circle cx="80" cy="74" r="20" fill="#16913f"/><path d="M71.5 74.5l6 6 11.5-11.5" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>' +
    "</svg></div>";
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
  };
  const ACCEPT = ".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  const ROLES = ["Admin", "Sales", "Delivery", "Warehouse", "Accounts"];
  const STORE_KEY = "fb.v7.flow";
  const ACCOUNT_KEY = "fb.v7.account";
  const ORDERS_KEY = "fb.v7.orders";
  const OAUTH_KEY = "fb.v7.zoho.pending";
  const PROGRESS = { source: 1, connect: 2, import: 2, found: 3, check: 3, staff: 3, ready: 3 };

  const state = {
    screen: "signup",
    view: "flow",
    form: { name: "", business: "", mobile: "", gstin: "" },
    errors: {},
    account: null,
    source: null,
    conn: { phase: "idle", handle: null, org: null },
    read: null,              // { done: steps finished, run: {stopped} }
    dataReady: null,
    parts: [],               // file parts, kept so an added file re-reads with them
    staff: [],               // [{id, name, role}]
    staffDone: false,
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
                staff: state.staff, staffDone: state.staffDone, order: state.order, created: state.created };
    if (!ls.set(STORE_KEY, v, sessionStorage)) {
      v.dataReady = withoutRaw(v.dataReady); v.parts = [];
      ls.set(STORE_KEY, v, sessionStorage);
    }
    if (state.account) ls.set(ACCOUNT_KEY, Object.assign({}, state.account, { staff: state.staff }));
  }
  function restore() {
    state.account = ls.get(ACCOUNT_KEY);
    if (!state.account) return;
    state.staff = state.account.staff || [{ id: "s1", name: state.account.name, role: "Admin" }];
    const v = ls.get(STORE_KEY, sessionStorage);
    if (!v) { state.screen = "source"; return; }
    Object.assign(state, { source: v.source, dataReady: v.dataReady, parts: v.parts || [], staff: v.staff || state.staff,
                           staffDone: !!v.staffDone, order: v.order, created: v.created });
    // A read cannot survive a reload; it starts again from where it was started.
    state.screen = v.screen === "import" ? (v.source === "files" ? "source" : "connect") : (v.screen || "source");
    if (state.screen === "connect" && !(SOURCES[state.source] && SOURCES[state.source].mode === "app")) state.screen = "source";
    if (state.screen === "signup") state.screen = "source";
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

  function chrome(screen, o) {
    o = o || {};
    if (o.wordmark) return '<p class="ob-wordmark">Food<em>Bridge</em></p>';
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

  function handoff(route) {
    try { if (window.top && window.top !== window.self) { window.top.location.hash = "#/" + route; return; } } catch (e) { /* cross-origin */ }
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
      case "source": return go("signup");
      case "connect": return go("source");
      case "import": return stopImport();
      case "found": return go("source");
      case "check": return go(state.dataReady ? "found" : "source");
      case "staff": return go(state.dataReady && !missingKinds().filter(function (k) { return k !== "staff"; }).length && state.staffDone ? "found" : "check");
      case "ready": return go("staff");
      case "order": return go("ready");
      default: return;
    }
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
      const acc = ls.get(ACCOUNT_KEY);
      if (acc && phoneKey(acc.mobile) === v) return "dup";
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
    if (problem === "dup") {
      cls = "is-bad";
      html = ICON.alertCircle + '<span>This number already has an account on this device. <button type="button" class="ob-hint-act" id="b-hint-login">Log in instead</button></span>';
    } else if (bad) {
      cls = "is-bad"; html = ICON.alertCircle + "<span>" + esc(problem) + "</span>";
    } else if (o.focused && k === "gstin" && !gstValue()) {
      cls = "is-help"; html = "<span>Optional. 15 characters, like 27AAPFU0939F1ZV.</span>";
    } else if (o.focused && k === "business" && !String(state.form.business || "").trim()) {
      cls = "is-help"; html = "<span>Optional. As it appears on your bills.</span>";
    }
    hint.className = "ob-hint" + (cls ? " " + cls : "");
    if (hint.getAttribute("data-html") !== html) { hint.innerHTML = html; hint.setAttribute("data-html", html); }
    const dl = $("#b-hint-login"); if (dl) dl.addEventListener("click", openLogin);
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
      chrome("signup", { wordmark: true }) +
      '<main class="ob-main">' +
        '<h1 class="ob-h1 is-center s01-h">Create your account</h1>' +
        '<p class="ob-sub is-center s01-sub">Let’s get your business on FoodBridge</p>' +
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
          '<button class="ob-cta" id="b-create" aria-describedby="create-note">Create account</button>' +
          '<p class="ob-sr" id="create-note">Enter your full name and phone number to continue.</p>' +
          '<p class="ob-terms">By continuing, you agree to our<br><button class="ob-tlink" id="b-terms">Terms of Use</button> &amp; <button class="ob-tlink" id="b-privacy">Privacy Policy</button></p>' +
          '<p class="ob-login">Already have an account? <button class="ob-tlink is-g" id="b-login">Log in</button></p>' +
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
    $("#b-login").addEventListener("click", openLogin);
  }

  function createAccount() {
    const f = state.form;
    state.account = {
      name: f.name.trim().replace(/\s+/g, " "), business: String(f.business || "").trim().replace(/\s+/g, " "),
      mobile: "+91 " + cleanPhone(f.mobile), gstin: gstValue(), gstVerified: gstVerified(),
      gst: gstVerified() ? { legalName: gst.result.legalName || null, tradeName: gst.result.tradeName || null, status: gst.result.status || null } : null,
      createdAt: new Date().toISOString(),
    };
    // The person signing up is the first member of the team, as screen 7 shows.
    state.staff = [{ id: "s1", name: state.account.name, role: "Admin" }];
    state.staffDone = false; state.dataReady = null; state.parts = []; state.order = null; state.created = null;
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
      actions: '<button class="ob-cta" id="s-login">Log in</button>',
      bind: function () {
        $("#s-login").addEventListener("click", function () {
          const acc = ls.get(ACCOUNT_KEY);
          const typed = phoneKey($("#f-lphone").value);
          if (!acc || typed.length !== 10 || phoneKey(acc.mobile) !== typed) {
            const e = $("#l-err"); e.hidden = false;
            e.textContent = typed.length !== 10 ? "Enter your 10-digit mobile number." : "No account with this number on this device. Create one instead.";
            return;
          }
          restore();
          state.sheet = null;
          if (state.screen === "signup") state.screen = "source";
          save(); draw();
        });
      },
    });
  }

  /* ════════════════════════════════════════════════════════════════════
     2 · WHERE IS YOUR DATA?
     ════════════════════════════════════════════════════════════════════ */
  /* 17 Sep 2026, product owner: Zoho and Xero are the live channels, with
     Files / Documents; Tally and Vyapar stay on the list as Coming soon —
     present, plainly not usable, never a button. Other and "I don't have any
     data" are gone. */
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
        '<h1 class="ob-h1 s02-h">Where is your<br>business data today?</h1>' +
        '<p class="ob-sub s02-sub">This helps us set up FoodBridge for you<br>in the fastest way.</p>' +
        '<div class="ob-list is-src">' +
          srcRow("zoho", MARK.zoho(36), "Zoho") +
          srcRow("xero", MARK.xero(24), "Xero") +
          srcRow("files", ICON.doc, "Files / Documents", "Upload invoices, challans,<br>POs, Excel, CSV etc.") +
          srcRow("tally", MARK.tally(34), "Tally", "", true) +
          srcRow("vyapar", MARK.vyapar(24), "Vyapar", "", true) +
        "</div>" +
      "</main>"
    );
    $$("button[data-src]").forEach(function (b) {
      b.addEventListener("click", function () { state.source = b.dataset.src; go("connect"); });
    });
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
  function beginImport() {
    state.read = { done: 0, run: { stopped: false } };
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
    if (state.read) state.read.run.stopped = true;
    state.read = null;
    state.conn = { phase: "idle" };
    go(state.source === "files" ? "source" : "connect");
  }

  function importFailed(text) {
    if (state.read) state.read.run.stopped = true;
    state.read = null;
    state.conn = { phase: "idle" };
    state.screen = state.source === "files" ? "source" : "connect";
    save();
    openSheet({
      title: "We couldn’t import your data",
      body: '<p class="ob-sheet-p">' + esc(text) + "</p>",
      actions: '<button class="ob-cta" id="s-retry">Try again</button><button class="ob-link" id="s-other">Choose another way</button>',
      bind: function () {
        $("#s-retry").addEventListener("click", closeSheet);
        $("#s-other").addEventListener("click", function () { go("source"); });
      },
    });
  }

  function drawImport() {
    const s = SOURCES[state.source] || SOURCES.files;
    const r = state.read || { done: 0 };
    const labels = [s.mark ? "Connecting to " + s.name : "Opening your files", "Fetching data", "Processing data", "Organizing data", "Finalizing setup"];
    const dot = function (on) { return '<span class="ob-ck-dot' + (on ? " is-on" : "") + '">' + (on ? ICON.tickSm : "") + "</span>"; };
    render(
      chrome("import") +
      '<main class="ob-main">' +
        heroCloud(s.mark ? s.mark(64) : '<text x="32" y="20" text-anchor="middle" font-family="Inter, sans-serif" font-weight="700" font-size="16" fill="#2b2f35">Files</text>') +
        '<h1 class="ob-h1 is-center is-m s04-h">Importing your data...</h1>' +
        '<p class="ob-sub is-center">This may take a few minutes.</p>' +
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
  const KINDS = [
    { k: "products", l: "Products", icon: ICON.pkg },
    { k: "customers", l: "Customers", icon: ICON.users },
    { k: "suppliers", l: "Suppliers", icon: ICON.person },
    { k: "staff", l: "Staff", icon: ICON.staff },
  ];
  function counts() {
    const d = (state.dataReady && state.dataReady.dataset) || {};
    const n = function (c) { return c && c.present && c.records ? c.records.length : 0; };
    return { products: n(d.products), customers: n(d.customers), suppliers: n(d.vendors),
             staff: state.staffDone ? state.staff.length : 0 };
  }
  function missingKinds() { const c = counts(); return KINDS.map(function (x) { return x.k; }).filter(function (k) { return !c[k]; }); }

  function drawFound() {
    const c = counts();
    const found = KINDS.filter(function (x) { return c[x.k]; });
    render(
      chrome("found") +
      '<main class="ob-main">' +
        heroCheck() +
        '<h1 class="ob-h1 is-center is-m">Great! We found this data</h1>' +
        '<p class="ob-sub is-center">Review and continue.</p>' +
        '<div class="ob-list">' + found.map(function (x) {
          return '<div class="ob-row"><span class="ob-row-ic">' + x.icon + "</span>" +
            '<span class="ob-row-main"><span class="ob-row-t">' + x.l + "</span></span>" +
            '<span class="ob-row-n">' + c[x.k].toLocaleString("en-IN") + "</span></div>";
        }).join("") + "</div>" +
      "</main>" +
      '<footer class="ob-foot"><button class="ob-cta" id="b-continue">Continue</button></footer>'
    );
    $("#b-continue").addEventListener("click", function () { go(missingKinds().length ? "check" : "staff"); });
  }

  function drawCheck() {
    const c = counts();
    const miss = missingKinds();
    const s = SOURCES[state.source] || SOURCES.files;
    const where = " in your " + (s.mark ? s.name : "files");
    const words = { products: "product", customers: "customer", suppliers: "supplier", staff: "staff" };
    const list = miss.map(function (k) { return words[k]; });
    const named = list.length > 1 ? list.slice(0, -1).join(", ") + " and " + list[list.length - 1] : list[0];
    /* The action names the first thing that can be added right here: staff on
       the next screen, products or customers from a file. Suppliers have no
       way in yet, so they never make the action. */
    const addable = miss.filter(function (k) { return k !== "suppliers"; });
    const add = addable.indexOf("staff") !== -1 ? "staff" : addable[0];
    render(
      chrome("check") +
      '<main class="ob-main">' +
        '<h1 class="ob-h1 is-center s06-h">Almost there!</h1>' +
        '<p class="ob-sub is-center">We just need a few more things.</p>' +
        '<div class="ob-list">' + KINDS.map(function (x) {
          const ok = !!c[x.k];
          const pick = !ok && (x.k === "products" || x.k === "customers");
          const tag = pick ? "label" : "div";
          return "<" + tag + ' class="ob-row is-check">' +
            '<span class="ob-row-ic' + (ok ? "" : " is-bad") + '">' + (ok ? x.icon : ICON.alertCircle) + "</span>" +
            '<span class="ob-row-main"><span class="ob-row-t">' + x.l + "</span></span>" +
            (ok ? '<span class="ob-row-tick">' + ICON.check + '</span><span class="ob-row-n">' + c[x.k].toLocaleString("en-IN") + "</span>"
                : '<span class="ob-row-tick is-bad">!</span><span class="ob-row-miss">Missing</span>') +
            (pick ? '<input type="file" data-add="' + x.k + '" accept="' + ACCEPT + '" hidden>' : "") +
            "</" + tag + ">";
        }).join("") + "</div>" +
        '<div class="ob-callout">' + ICON.info + "<p>We couldn’t find " + esc(named) + " data" + esc(where) + ". Please add it to continue.</p></div>" +
      "</main>" +
      '<footer class="ob-foot">' +
        (add === "staff" || !add
          ? '<button class="ob-cta" id="b-add">' + (add ? "Add staff" : "Continue") + "</button>"
          : '<label class="ob-cta">Add ' + esc(words[add]) + 's<input type="file" data-add="' + add + '" accept="' + ACCEPT + '" hidden></label>') +
        '<button class="ob-link" id="b-later">I’ll do this later</button>' +
      "</footer>"
    );
    const b = $("#b-add");
    if (b) b.addEventListener("click", function () { go(add ? "staff" : "ready"); });
    $("#b-later").addEventListener("click", function () { go("ready"); });
    $$("input[data-add]").forEach(function (inp) {
      inp.addEventListener("change", function () {
        const file = this.files && this.files[0];
        this.value = "";
        if (file) addFileAs(file, inp.dataset.add);
      });
    });
  }

  /* A products or customers file added from the check, read AS that kind and
     joined to what is already there. */
  async function addFileAs(file, kind) {
    openSheet({ title: "Reading " + file.name, locked: true, body: '<p class="ob-sheet-p ob-busy"><span class="ob-spin"></span>Reading on this phone…</p>' });
    let out;
    try { out = await RD().files.read(file, [kind]); } catch (e) { out = { ok: false }; }
    const got = out && out.ok ? (out.found || []).filter(function (p) { return p.type === kind && p.records && p.records.length; }) : [];
    state.sheet = null;
    if (!got.length) {
      return openSheet({
        title: "We couldn’t read " + file.name,
        body: '<p class="ob-sheet-p">We couldn’t find any ' + kind + " in this file. Its first row needs a name column, such as " + (kind === "products" ? "Item Name" : "Customer Name") + ".</p>",
        actions: '<button class="ob-cta is-ghost" id="s-close">Close</button>',
        bind: function () { $("#s-close").addEventListener("click", closeSheet); },
      });
    }
    const added = got.map(function (p, i) { return { id: "a" + Date.now() + i, name: file.name, type: p.type, records: p.records, skipped: p.skipped }; });
    if (!state.dataReady || state.dataReady.provenance.kind === "files") {
      state.parts = state.parts.concat(added);
      state.dataReady = window.FB_DATASET.fromFiles(state.parts);
    } else {
      const ds = state.dataReady.dataset;
      const col = ds[kind] && ds[kind].present ? ds[kind] : (ds[kind] = { present: true, records: [] });
      const have = {};
      col.records.forEach(function (r) { have[String(r.name).toLowerCase()] = true; });
      added[0].records.forEach(function (r, i) {
        if (have[String(r.name).toLowerCase()]) return;
        const rec = { id: "af" + Date.now() + i, name: r.name, from: { kind: "file", fileId: added[0].id, row: r.row } };
        if (r.sku) rec.sku = r.sku;
        if (r.unit) rec.unit = r.unit;
        col.records.push(rec);
      });
    }
    state.order = null;
    save(); draw();
  }

  /* ════════════════════════════════════════════════════════════════════
     7 · QUICK SETUP (STAFF)
     ════════════════════════════════════════════════════════════════════ */
  function initials(name) {
    const w = String(name || "").replace(/[^A-Za-z0-9 ]/g, " ").trim().split(/\s+/).filter(Boolean);
    return ((w[0] || "?").charAt(0) + (w[1] ? w[1].charAt(0) : "")).toUpperCase();
  }
  function drawStaff() {
    render(
      chrome("staff") +
      '<main class="ob-main">' +
        '<h1 class="ob-h1">Add your staff</h1>' +
        '<p class="ob-sub s07-sub">This helps you manage access<br>and responsibilities.</p>' +
        '<div class="ob-people">' + state.staff.map(function (p, i) {
          return '<div class="ob-person">' +
            '<button class="ob-person-open" data-edit="' + i + '"><span class="ob-avatar t' + (i % 5) + '">' + esc(initials(p.name)) + "</span>" +
              '<span class="ob-person-main"><span class="ob-person-n">' + esc(p.name) + "</span></span></button>" +
            '<label class="ob-select"><span>' + esc(p.role) + "</span>" + ICON.chevDown +
              '<select data-role="' + i + '" aria-label="Role for ' + esc(p.name) + '">' +
                ROLES.map(function (r) { return "<option" + (r === p.role ? " selected" : "") + ">" + r + "</option>"; }).join("") +
              "</select></label>" +
          "</div>";
        }).join("") + "</div>" +
        '<button class="ob-link is-add" id="b-addstaff">' + ICON.plus + "Add another staff</button>" +
      "</main>" +
      '<footer class="ob-foot"><button class="ob-cta" id="b-continue">Continue</button></footer>'
    );
    $$("select[data-role]").forEach(function (sel) {
      sel.addEventListener("change", function () { state.staff[Number(sel.dataset.role)].role = sel.value; save(); drawStaff(); });
    });
    $$("[data-edit]").forEach(function (b) { b.addEventListener("click", function () { openStaffSheet(Number(b.dataset.edit)); }); });
    $("#b-addstaff").addEventListener("click", function () { openStaffSheet(-1); });
    $("#b-continue").addEventListener("click", function () { state.staffDone = true; go("ready"); });
  }

  function openStaffSheet(i) {
    const p = i >= 0 ? state.staff[i] : { name: "", role: "Sales" };
    let role = p.role;
    openSheet({
      title: i >= 0 ? "Edit staff" : "Add staff",
      body: '<div class="ob-fields is-sheet">' + field("sname", "Name", ICON.user, p.name, { caps: "words", auto: "off", enter: "done" }) + "</div>" +
        '<div class="ob-choices is-roles" role="radiogroup" aria-label="Role">' + ROLES.map(function (r) {
          return '<button class="ob-choice' + (r === p.role ? " is-on" : "") + '" role="radio" aria-checked="' + (r === p.role) + '" data-r="' + r + '"><span class="ob-radio"></span><span class="ob-choice-t">' + r + "</span></button>";
        }).join("") + "</div>",
      actions: '<button class="ob-cta" id="s-save">' + (i >= 0 ? "Save" : "Add staff") + "</button>" +
        (i > 0 ? '<button class="ob-link is-warn" id="s-rm">Remove</button>' : ""),
      bind: function () {
        $$("[data-r]").forEach(function (b) {
          b.addEventListener("click", function () {
            role = b.dataset.r;
            $$("[data-r]").forEach(function (x) { x.classList.toggle("is-on", x === b); x.setAttribute("aria-checked", x === b); });
          });
        });
        const inp = $("#f-sname");
        $("#s-save").addEventListener("click", function () {
          const name = inp.value.trim();
          if (name.length < 2) { inp.closest(".ob-field").classList.add("is-bad"); inp.focus(); return; }
          if (i >= 0) Object.assign(state.staff[i], { name: name, role: role });
          else state.staff.push({ id: "s" + Date.now(), name: name, role: role });
          state.sheet = null; save(); draw();
        });
        const rm = $("#s-rm");
        if (rm) rm.addEventListener("click", function () { state.staff.splice(i, 1); state.sheet = null; save(); draw(); });
      },
    });
  }

  /* ════════════════════════════════════════════════════════════════════
     8 · READY TO ORDER
     ════════════════════════════════════════════════════════════════════ */
  function drawReady() {
    const c = counts();
    const ready = KINDS.filter(function (x) { return c[x.k]; }).length;
    const dot = '<span class="ob-ck-dot is-on">' + ICON.tickSm + "</span>";
    render(
      chrome("ready") +
      '<main class="ob-main">' +
        HERO_CLIP +
        '<h1 class="ob-h1 is-center">You’re all set!</h1>' +
        '<p class="ob-sub is-center s08-sub">Your setup is ready. Create your<br>first order to get started.</p>' +
        '<div class="ob-card">' +
          '<div class="ob-card-row">' + dot + "<span>" + (ready === 1 ? "1 thing is ready" : ready + " things are ready") + "</span></div>" +
          '<div class="ob-card-row">' + dot + "<span>You can always change this later</span></div>" +
        "</div>" +
      "</main>" +
      '<footer class="ob-foot"><button class="ob-cta" id="b-order">Create first order</button></footer>'
    );
    $("#b-order").addEventListener("click", function () { go("order"); });
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

  function drawOrder() {
    if (!state.order) { state.order = prefillOrder(); save(); }
    const o = state.order;
    const cat = catalogue();
    const q = (o.filter || "").trim().toLowerCase();
    const have = {};
    o.lines.forEach(function (l) { have[l.productId] = true; });
    const hits = q ? cat.products.filter(function (p) { return !have[p.id] && (p.name.toLowerCase().indexOf(q) !== -1 || String(p.sku || "").toLowerCase().indexOf(q) !== -1); }).slice(0, 8) : [];
    const items = o.lines.reduce(function (n, l) { return n + l.qty; }, 0);
    const priced = o.lines.length > 0 && o.lines.every(function (l) { return l.price != null; });
    const total = o.lines.reduce(function (n, l) { return n + (l.price || 0) * l.qty; }, 0);
    const canCreate = !!o.customerName && o.lines.length > 0;

    render(
      chrome("order", { title: "Create Order" }) +
      '<main class="ob-main is-order">' +
        '<div class="ob-ocard is-cust">' +
          '<div class="ob-ocard-main"><p class="ob-ocard-l">Customer</p><p class="ob-ocard-v">' + (o.customerName ? esc(o.customerName) : '<span class="is-ph">Choose a customer</span>') + "</p></div>" +
          '<button class="ob-ocard-a" id="e-cust">View</button>' +
        "</div>" +
        '<div class="ob-ocard is-items has-total">' +
          '<p class="ob-ocard-l">Add Items</p>' +
          '<label class="ob-osearch">' + ICON.search +
            '<input id="e-q" type="search" enterkeyhint="search" autocorrect="off" autocapitalize="none" spellcheck="false" placeholder="Search products by name / code" value="' + esc(o.filter || "") + '"></label>' +
          (q ? '<div class="ob-ohits">' +
              hits.map(function (p, k) { return '<button class="ob-ohit" data-hit="' + k + '"><span>' + esc(p.name) + "</span>" + ICON.plus + "</button>"; }).join("") +
              (!hits.length ? '<button class="ob-ohit" data-new="1"><span>Add “' + esc(o.filter.trim()) + "” as a new item</span>" + ICON.plus + "</button>" : "") +
            "</div>" : "") +
          o.lines.map(function (l, i) {
            return '<div class="ob-oline">' +
              '<span class="ob-othumb">' + ICON.pkg + "</span>" +
              '<div class="ob-oline-main"><p class="ob-oline-n">' + esc(l.name) + "</p>" +
                (l.price != null ? '<p class="ob-oline-s">' + money(l.price) + (l.unit ? " / " + esc(l.unit) : "") + "</p>" : (l.unit ? '<p class="ob-oline-s">' + esc(l.unit) + "</p>" : "")) + "</div>" +
              '<div class="ob-step">' +
                (l.qty <= 1 ? '<button class="is-rm" data-rm="' + i + '" aria-label="Remove ' + esc(l.name) + '">' + ICON.trash + "</button>"
                            : '<button data-dec="' + i + '" aria-label="One fewer ' + esc(l.name) + '">' + ICON.minus + "</button>") +
                '<input type="number" inputmode="numeric" pattern="[0-9]*" min="1" max="9999" value="' + l.qty + '" data-q="' + i + '" aria-label="Quantity for ' + esc(l.name) + '">' +
                '<button data-inc="' + i + '" aria-label="One more ' + esc(l.name) + '">' + ICON.plus + "</button>" +
              "</div>" +
              (l.price != null ? '<span class="ob-oline-t">' + money(l.price * l.qty) + "</span>" : '<span class="ob-oline-t"></span>') +
            "</div>";
          }).join("") +
          '<button class="ob-oadd" id="e-add">' + ICON.plus + "Add more items</button>" +
        "</div>" +
        '<div class="ob-ototal"><span>Total (' + items + (items === 1 ? " item" : " items") + ")</span><b>" + (priced ? money(total) : "—") + "</b></div>" +
      "</main>" +
      '<footer class="ob-foot is-order"><button class="ob-cta" id="e-create"' + (canCreate ? "" : " disabled") + ">Create order</button></footer>"
    );

    const setQty = function (i, v) { o.lines[i].qty = Math.max(1, Math.min(9999, v)); save(); drawOrder(); };
    $$("[data-inc]").forEach(function (b) { b.addEventListener("click", function () { const i = Number(b.dataset.inc); setQty(i, o.lines[i].qty + 1); }); });
    $$("[data-dec]").forEach(function (b) { b.addEventListener("click", function () { const i = Number(b.dataset.dec); setQty(i, o.lines[i].qty - 1); }); });
    $$("[data-rm]").forEach(function (b) { b.addEventListener("click", function () { o.lines.splice(Number(b.dataset.rm), 1); save(); drawOrder(); }); });
    $$("[data-q]").forEach(function (inp) {
      inp.addEventListener("focus", function () { setTimeout(function () { try { inp.select(); } catch (e) {} }, 0); });
      inp.addEventListener("change", function () { setQty(Number(inp.dataset.q), parseInt(inp.value, 10) || 1); });
    });
    const qi = $("#e-q");
    qi.addEventListener("input", function () {
      o.filter = qi.value;
      const pos = qi.selectionStart;
      drawOrder();
      const again = $("#e-q"); again.focus(); try { again.setSelectionRange(pos, pos); } catch (e) {}
    });
    $$("[data-hit]").forEach(function (b) {
      b.addEventListener("click", function () { const p = hits[Number(b.dataset.hit)]; o.lines.push(lineOf(p.id, p.name, 1)); o.filter = ""; save(); drawOrder(); });
    });
    const nw = $("[data-new]");
    if (nw) nw.addEventListener("click", function () {
      o.lines.push({ productId: "new:" + o.filter.trim().toLowerCase(), name: o.filter.trim(), qty: 1, price: null, unit: "" });
      o.filter = ""; save(); drawOrder();
    });
    $("#e-add").addEventListener("click", function () { $("#e-q").focus(); });
    $("#e-cust").addEventListener("click", openCustomerSheet);
    const cr = $("#e-create");
    if (cr && canCreate) cr.addEventListener("click", createOrder);
  }

  function openCustomerSheet() {
    const cat = catalogue();
    let filter = "";
    const list = function () {
      const q = filter.trim().toLowerCase();
      const hits = cat.customers.filter(function (c) { return !q || c.name.toLowerCase().indexOf(q) !== -1; }).slice(0, 40);
      return hits.map(function (c) {
        return '<button class="ob-rec" data-cust="' + esc(c.id) + '"><span class="ob-rec-a">' + esc(c.name) + "</span>" +
          (c.id === state.order.customerId ? '<span class="ob-rec-b">' + ICON.check + "</span>" : "") + "</button>";
      }).join("") + (q && !hits.some(function (c) { return c.name.toLowerCase() === q; })
        ? '<button class="ob-rec" data-newcust="1"><span class="ob-rec-a">Add “' + esc(filter.trim()) + "” as a new customer</span>" + '<span class="ob-rec-b">' + ICON.plus + "</span></button>" : "");
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
              if (c.id !== state.order.customerId) {
                state.order.customerId = c.id; state.order.customerName = c.name;
                // What this customer last ordered, as a start; nothing if it never has.
                try {
                  const h = engineView().history[c.id];
                  const last = h && h.orders[0];
                  state.order.lines = last ? last.lines.slice(0, 6).map(function (l) { return lineOf(l.productId, null, l.qty); }) : [];
                } catch (err) { state.order.lines = []; }
              }
              state.sheet = null; save(); draw();
            });
          });
          const nc = $("[data-newcust]");
          if (nc) nc.addEventListener("click", function () {
            state.order.customerId = "new:" + filter.trim().toLowerCase(); state.order.customerName = filter.trim();
            state.sheet = null; save(); draw();
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
        '<p class="ob-sub is-center">Your first order has been created<br>successfully.</p>' +
        orderCard(r) +
      "</main>" +
      '<footer class="ob-foot"><button class="ob-cta" id="b-dash">Go to dashboard</button></footer>'
    );
    $("#b-dash").addEventListener("click", function () { go("welcome"); });
  }

  function drawWelcome() {
    render(
      chrome("welcome", { wordmark: true }) +
      '<main class="ob-main">' +
        HERO_STORE +
        '<h1 class="ob-h1 is-center">Welcome to FoodBridge!</h1>' +
        '<p class="ob-sub is-center">You’re ready to grow your business<br>smarter and faster.</p>' +
        '<div class="ob-feats3">' +
          '<div class="ob-f3"><span class="ob-f3-c is-blue">' + ICON.orders + "</span><span>Manage orders</span></div>" +
          '<div class="ob-f3"><span class="ob-f3-c is-purple">' + ICON.track + "</span><span>Track business</span></div>" +
          '<div class="ob-f3"><span class="ob-f3-c is-green">' + ICON.grow + "</span><span>Grow profits</span></div>" +
        "</div>" +
      "</main>" +
      '<footer class="ob-foot"><button class="ob-cta" id="b-go">Go to FoodBridge</button></footer>'
    );
    $("#b-go").addEventListener("click", function () { save(); handoff("dashboard"); });
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
    if (!state.account) state.screen = "signup";
    switch (state.screen) {
      case "source": return drawSource();
      case "connect": return drawConnect();
      case "import": return drawImport();
      case "found": return drawFound();
      case "check": return drawCheck();
      case "staff": return drawStaff();
      case "ready": return drawReady();
      case "order": return drawOrder();
      case "created": return drawCreated();
      case "welcome": return drawWelcome();
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

  function mount() {
    /* ?obreset on localhost: start as a brand-new user. Removed from the address
       at once, so the return from a sign-in never replays it. */
    if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && /[?&]obreset/.test(location.search)) {
      [ACCOUNT_KEY, ORDERS_KEY].forEach(function (k) { ls.del(k); });
      [STORE_KEY, OAUTH_KEY].forEach(function (k) { ls.del(k, sessionStorage); });
      const u = new URL(location.href); u.searchParams.delete("obreset");
      history.replaceState(null, "", u.pathname + u.search + u.hash);
    }
    trackKeyboard();
    document.addEventListener("focusin", keepFocusVisible);
    restore();
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
