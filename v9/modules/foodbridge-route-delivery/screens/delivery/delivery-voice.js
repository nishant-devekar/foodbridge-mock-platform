/* ==========================================================================
   DELIVERY MANAGEMENT — speak a note instead of typing it (24 Sep 2026)

   Not in the upstream app. The Control Tower's note mic, for the driver: the
   browser's own speech-to-text (Web Speech API). Words land in the note as
   they are heard and stay there to be edited like anything typed; speech is
   added after what is already written, never over it. No server of ours
   hears it. Indian English. Where the browser has none (Firefox) the note
   field draws no mic at all rather than one that fails.

   Every note field is U.NoteField, and its mic is `voice-toggle` with the
   field's data-model. This app re-renders a screen from a string, so the
   words are written to whichever textarea carries that data-model *now*,
   and reach the screen's state through the same input event typing sends.
   Leaving the screen stops listening.
   ========================================================================== */

(function () {
  "use strict";
  const SPEECH = window.SpeechRecognition || window.webkitSpeechRecognition || null;
  let talk = null;
  const V = { supported: !!SPEECH, active: null, errors: {}, errorFor: function (m) { return V.errors[m] || null; } };

  function field(model) { return document.querySelector('textarea[data-model="' + model + '"]'); }
  function put(model, text) {
    const ta = field(model);
    if (!ta) return;
    const max = Number(ta.getAttribute("maxlength")) || 500;
    ta.value = text.slice(0, max);
    ta.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function start(model) {
    if (!SPEECH || talk) return;
    const ta = field(model);
    if (!ta) return;
    const base = ta.value && !/\s$/.test(ta.value) ? ta.value + " " : ta.value;
    let heard = "";
    try { talk = new SPEECH(); } catch (e) { talk = null; return; }
    talk.lang = "en-IN";
    talk.interimResults = true;
    talk.continuous = true;
    talk.onresult = function (ev) {
      let fin = "", part = "";
      for (let i = 0; i < ev.results.length; i++) {
        if (ev.results[i].isFinal) fin += ev.results[i][0].transcript; else part += ev.results[i][0].transcript;
      }
      heard = fin;
      put(model, base + fin + part);
    };
    talk.onerror = function (ev) {
      if (ev.error === "not-allowed" || ev.error === "service-not-allowed") V.errors[model] = "The microphone is blocked — type your note instead.";
      else if (ev.error === "network") V.errors[model] = "Speaking a note needs a connection — type it instead.";
      else if (ev.error === "no-speech") V.errors[model] = "Didn't catch that — tap the mic and speak again.";
    };
    talk.onend = function () {
      put(model, (base + heard).replace(/\s+$/, ""));
      talk = null; V.active = null;
      if (window.RD) window.RD.render();
    };
    delete V.errors[model];
    V.active = model;
    try { talk.start(); } catch (e) { talk.onend(); return; }
    window.RD.render();
  }
  function stop() { if (talk) { try { talk.stop(); } catch (e) { /* already stopping */ } } }

  window.RD.action("voice-toggle", function (model) { if (V.active) stop(); else start(model); });
  window.addEventListener("hashchange", function () { stop(); V.errors = {}; });

  window.RD_VOICE = V;
})();
