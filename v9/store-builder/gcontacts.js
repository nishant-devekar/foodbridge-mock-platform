/* Store Builder · Google Contacts, in any browser (1 Oct 2026).

   A web page can open the phone's own contact list only in Chrome on Android
   and in Safari on an iPhone (send/send.js hands every other browser to one of
   those). Google Contacts works everywhere: most Android phones keep their
   contacts there, so he signs in with Google, says yes once, and his contacts
   come in -- on the phone page, or straight on the computer with no phone.

   Read-only (contacts.readonly), names and numbers only, and the access is
   handed back to Google as soon as the list is read.

   Switched on by an OAuth client id: Google Cloud › APIs & Services › People
   API on, and a Web client whose JavaScript origins are the Pages site and
   http://localhost:8007. Empty: the option is not shown anywhere. A browser
   can try one without a deploy: localStorage "fb-google-client-id". */

(function (root) {
  "use strict";

  const CLIENT_ID = "";
  const SCOPE = "https://www.googleapis.com/auth/contacts.readonly";
  const IMP = root.SB_IMPORT;

  function clientId() {
    try { return localStorage.getItem("fb-google-client-id") || CLIENT_ID; } catch (e) { return CLIENT_ID; }
  }
  function ready() { return !!clientId(); }

  /* Google's sign-in script, loaded ahead: the sign-in window has to open inside his tap. */
  let loading = null;
  function preload() {
    if (!ready()) return Promise.resolve(false);
    if (root.google && root.google.accounts && root.google.accounts.oauth2) return Promise.resolve(true);
    if (!loading) loading = new Promise(function (res) {
      const s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true;
      s.onload = function () { res(true); };
      s.onerror = function () { loading = null; res(false); };
      document.head.appendChild(s);
    });
    return loading;
  }

  function token() {
    return new Promise(function (res, rej) {
      const go = function () {
        const c = root.google.accounts.oauth2.initTokenClient({
          client_id: clientId(), scope: SCOPE,
          callback: function (r) { if (r && r.access_token) res(r.access_token); else rej(new Error((r && r.error) || "denied")); },
          error_callback: function (e) { rej(new Error((e && e.type) || "closed")); },
        });
        c.requestAccessToken();
      };
      if (root.google && root.google.accounts && root.google.accounts.oauth2) go();
      else preload().then(function (ok) { if (ok) go(); else rej(new Error("offline")); });
    });
  }

  async function connections(tok) {
    const out = [];
    let page = "";
    do {
      const r = await fetch("https://people.googleapis.com/v1/people/me/connections?personFields=names,phoneNumbers&pageSize=1000" +
        (page ? "&pageToken=" + encodeURIComponent(page) : ""), { headers: { Authorization: "Bearer " + tok } });
      if (!r.ok) throw new Error("people_" + r.status);
      const j = await r.json();
      (j.connections || []).forEach(function (p) {
        const tels = (p.phoneNumbers || []).map(function (x) { return x.canonicalForm || x.value; }).filter(Boolean);
        if (!tels.length) return;   // a contact with no number is no use to a distributor
        out.push({ name: ((p.names || [])[0] || {}).displayName || "", phone: IMP.pickPhone(tels) });
      });
      page = j.nextPageToken || "";
    } while (page && out.length < 20000);
    return out;
  }

  /* His Google contacts with a number, as [{ name, phone }]. Rejects if he says no or closes the window. */
  async function read() {
    const tok = await token();
    try { return await connections(tok); }
    finally { try { root.google.accounts.oauth2.revoke(tok, function () {}); } catch (e) { /* gone anyway within the hour */ } }
  }

  const logo = '<svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';

  root.SB_GOOGLE = { ready: ready, preload: preload, read: read, logo: logo };
})(window);
