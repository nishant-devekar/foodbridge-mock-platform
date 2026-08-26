/* ==========================================================================
   Where this page finds the FoodBridge integration API.

   This file is COMMITTED and contains NO SECRETS, by construction: the only
   thing a browser is allowed to know about the Zoho integration is the URL of
   the FoodBridge endpoint in front of it. The Zoho client id, client secret,
   refresh token and organisation id live in the server's environment and are
   never sent here (see server/README.md).

   apiBaseUrl
     The deployed Zoho bridge. Points at the Vercel function by default so the
     GitHub Pages app works with nothing to configure. Override it per device
     (below) to develop against a bridge on localhost:8787 instead.

   A single deployment can also override this at runtime without a rebuild
   (there is no build step): set fb-api-base in localStorage and reload.

       localStorage.setItem("fb-api-base", "https://api.example.com")
   ========================================================================== */

(function () {
  "use strict";

  var DEFAULT_BASE = "https://zoho-function-nu.vercel.app";

  // Per-device overrides. Both are read the same way, and both are absent from
  // this committed file on purpose: a demo laptop or phone is pointed at the
  // deployed bridge once, and the repo never carries the key.
  //
  //   localStorage.setItem("fb-api-base", "https://<your>.vercel.app")
  //   localStorage.setItem("fb-api-key",  "<FB_API_KEY from the function>")
  function stored(name) {
    try {
      return window.localStorage.getItem(name);
    } catch (e) {
      return null; // Private mode: fall through to the compiled-in defaults.
    }
  }
  var override = stored("fb-api-base");

  window.FB_INTEGRATION = {
    apiBaseUrl: (override != null && override !== "" ? override : DEFAULT_BASE).replace(/\/+$/, ""),
    // Must equal FB_API_KEY on the function. Left blank here and supplied per
    // device, so it stays out of a public repo.
    //
    // This is NOT a secret and cannot be one: whatever the browser sends, the
    // person holding the browser can read. It exists so that a public function
    // URL is not open to everything that finds it. The Zoho credentials it
    // stands in front of are on the server and never reach this page.
    apiKey: stored("fb-api-key") || "",
  };
})();
