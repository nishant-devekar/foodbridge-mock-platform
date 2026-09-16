/* ==========================================================================
   Where this page finds the FoodBridge integration API.

   This file is COMMITTED and carries the bridge's shared key, which is not a
   secret and cannot be one — a static page has to hand it to every visitor in
   order to use it. What stays out of the browser entirely is what actually
   matters: the Zoho client id, client secret, refresh token and organisation
   id live in the server's environment and are never sent here (see
   zoho-function/README.md).

   apiBaseUrl
     The deployed Zoho bridge. Points at the Vercel function by default so the
     GitHub Pages app works with nothing to configure. Override it per device
     (below) to develop against a bridge on localhost:8787 instead.

   apiKey
     Compiled in, so that confirming an order works on every browser that
     opens the app rather than only on ones provisioned from a special link.
     See the note above DEFAULT_KEY for what that trade buys and costs.

   A single deployment can also override this at runtime without a rebuild
   (there is no build step): set fb-api-base in localStorage and reload.

       localStorage.setItem("fb-api-base", "https://api.example.com")
   ========================================================================== */

(function () {
  "use strict";

  var DEFAULT_BASE = "https://zoho-function-nu.vercel.app";

  // The bridge's shared key, SHIPPED WITH THE APP on purpose.
  //
  // It used to be provisioned per device from a ?fbkey= link. That was the
  // cause of a real, recurring failure: the link deleted the key from the
  // address bar on first use, so the URL anyone then bookmarked, shared or
  // opened on a second device carried no key at all. Those browsers sent no
  // X-FB-Key, the bridge answered 401, and the rep only found out at Confirm
  // Order -- after building the whole order -- facing a "Retry Sync" button
  // that could never succeed. Clearing site data or Safari evicting
  // localStorage put an already-working device back into the same state.
  //
  // Ordering has to work on every browser that opens the app, so the key now
  // travels with the app instead of with the person who shares the link.
  //
  // WHAT THIS COSTS, stated plainly: the key is in a public repo, so it is
  // discoverable by anyone grepping GitHub rather than only by someone who
  // opens devtools on the page. That is a smaller step than it sounds -- a
  // static page has to hand the key to every visitor to use it, so it was
  // never secret from anyone holding the app. It is a speed bump against
  // scanners, not authentication, and the Zoho OAuth credentials it stands in
  // front of remain on the server and never reach this page. Rotate it by
  // editing this line and redeploying, together with FB_API_KEY on the
  // function.
  var DEFAULT_KEY = "tFcdYY4RepvrSmvdLsmG3jls3_1J2epW";

  // The bridge URL stays overridable per device, which is what local work
  // actually needs:
  //
  //   localStorage.setItem("fb-api-base", "https://<your>.vercel.app")
  //
  // A bridge run locally with FB_API_KEY unset skips the key check entirely,
  // so pointing at localhost needs no key of its own.
  function stored(name) {
    try {
      return window.localStorage.getItem(name);
    } catch (e) {
      return null; // Private mode: fall through to the compiled-in defaults.
    }
  }
  function remember(name, value) {
    try {
      window.localStorage.setItem(name, value);
    } catch (e) {
      /* private mode: this visit still works, the next one reads the default */
    }
  }
  function forget(name) {
    try {
      window.localStorage.removeItem(name);
    } catch (e) {
      /* nothing to clean up we are allowed to touch */
    }
  }

  // ?fbapi= still points a demo device at a different bridge, which is the
  // one thing a link genuinely needs to carry:
  //
  //   .../v4/?fbapi=http://localhost:8787#/customer-management/stock-audit-health
  //
  // ?fbkey= is DELIBERATELY IGNORED now, and only stripped. Old provisioning
  // links are still in people's messages and bookmarks; they must not put a
  // key back into storage that this file has since rotated past, and the key
  // should not sit in history or ride along when the URL is shared. Reading
  // the query means reaching the TOP window, because this page runs inside the
  // platform shell's iframe -- same origin, so it is readable and rewritable.
  (function readLinkOverrides() {
    var frames = [window];
    try {
      if (window.top && window.top !== window) frames.push(window.top);
    } catch (e) {
      return; // Cross-origin embed: nothing to read, nothing to strip.
    }
    for (var i = 0; i < frames.length; i++) {
      try {
        var win = frames[i];
        var params = new URLSearchParams(win.location.search);
        var base = params.get("fbapi");
        if (!params.has("fbkey") && !base) continue;
        if (base) remember("fb-api-base", base);
        params.delete("fbkey");
        params.delete("fbapi");
        var q = params.toString();
        win.history.replaceState(null, "",
          win.location.pathname + (q ? "?" + q : "") + win.location.hash);
      } catch (e) {
        /* a frame we may not touch; try the next */
      }
    }
  })();

  var override = stored("fb-api-base");

  // Any key a device stored back when provisioning was per-device is now dead
  // weight, and worse than dead: leaving it readable invites a future change
  // to prefer it and pin that browser to a key this file has since rotated
  // past. Dropped once, on load.
  forget("fb-api-key");

  window.FB_INTEGRATION = {
    apiBaseUrl: (override != null && override !== "" ? override : DEFAULT_BASE).replace(/\/+$/, ""),
    // Must equal FB_API_KEY on the function. Every browser gets the same one,
    // so ordering does not depend on how this page was opened.
    apiKey: DEFAULT_KEY,
  };
})();
