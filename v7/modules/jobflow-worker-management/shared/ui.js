/* The little React these two screens need, without React.
 *
 * Each page renders its whole state to an HTML string — the JSX of the
 * original component, class for class — and morph() patches the live DOM to
 * match, the way React reconciles: an input being typed in keeps its focus and
 * caret, a checkbox keeps its element, and only what changed is touched.
 * Form controls are "controlled": the rendered value wins.
 */
(function (root) {
  "use strict";

  function esc(v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  /* Tagged template: interpolations are escaped unless wrapped in raw(). */
  function Raw(s) { this.s = s; }
  function raw(s) { return new Raw(s); }
  function flat(v) {
    if (v == null || v === false || v === true) return "";
    if (v instanceof Raw) return v.s;
    if (Array.isArray(v)) return v.map(flat).join("");
    return esc(v);
  }
  /* JSX's whitespace rule, so templates can be indented like the JSX they
     port: a run of whitespace that contains a line break is dropped; spaces
     on one line are kept. Applies to the template's own text only, never to
     interpolated values. */
  function jsx(s) { return s.replace(/[ \t]*\r?\n\s*/g, ""); }
  /* React gives every {expression} its own DOM text node, and Chrome shapes
     each text node as its own run — "#42", " · ", "Lime Pickle" sit a
     sub-pixel apart from "#42 · Lime Pickle" as one node. So a text value
     outside a tag is fenced with empty comments, which keeps it a separate
     node exactly where React's would be. "" makes no node at all, as in React. */
  function inTag(s) { return s.lastIndexOf("<") > s.lastIndexOf(">"); }
  /* A textarea's content is raw text: a comment there would show as text. */
  function inTextarea(s) { return s.lastIndexOf("<textarea") > s.lastIndexOf("</textarea"); }
  function html(strings) {
    var out = jsx(strings[0]);
    for (var i = 1; i < arguments.length; i++) {
      var v = arguments[i];
      if ((typeof v === "string" || typeof v === "number") && !inTag(out) && !inTextarea(out)) out += v === "" ? "" : "<!---->" + esc(v) + "<!---->";
      else out += flat(v);
      out += jsx(strings[i]);
    }
    return raw(out);
  }

  function syncAttrs(from, to) {
    var i, a;
    for (i = from.attributes.length - 1; i >= 0; i--) {
      a = from.attributes[i];
      if (!to.hasAttribute(a.name)) from.removeAttribute(a.name);
    }
    for (i = 0; i < to.attributes.length; i++) {
      a = to.attributes[i];
      if (from.getAttribute(a.name) !== a.value) from.setAttribute(a.name, a.value);
    }
  }

  function syncControl(from, to) {
    var tag = from.nodeName;
    if (tag === "INPUT") {
      if (from.type === "checkbox" || from.type === "radio") {
        var on = to.hasAttribute("checked");
        if (from.checked !== on) from.checked = on;
      } else {
        var v = to.getAttribute("value") || "";
        if (from.value !== v) from.value = v;
      }
    } else if (tag === "TEXTAREA") {
      var tv = to.value;
      if (from.value !== tv) from.value = tv;
    } else if (tag === "SELECT") {
      var sel = to.getAttribute("data-value");
      if (sel != null && from.value !== sel) from.value = sel;
    }
  }

  function same(a, b) {
    if (a.nodeType !== b.nodeType || a.nodeName !== b.nodeName) return false;
    if (a.nodeType === 1) {
      var ka = a.getAttribute("data-key"), kb = b.getAttribute("data-key");
      if (ka !== kb) return false;
    }
    return true;
  }

  function morphChildren(from, to) {
    var fc = Array.prototype.slice.call(from.childNodes);
    var tc = Array.prototype.slice.call(to.childNodes);
    for (var i = 0; i < tc.length; i++) {
      var f = fc[i], t = tc[i];
      if (!f) { from.appendChild(t); continue; }
      if (!same(f, t)) { from.replaceChild(t, f); continue; }
      if (f.nodeType === 3 || f.nodeType === 8) { if (f.nodeValue !== t.nodeValue) f.nodeValue = t.nodeValue; continue; }
      morphEl(f, t);
    }
    for (var j = fc.length - 1; j >= tc.length; j--) from.removeChild(fc[j]);
  }

  function morphEl(from, to) {
    /* A box filled by other code (a drawn QR) is left as it is. */
    if (from.hasAttribute("data-morph-skip")) return;
    syncAttrs(from, to);
    if (from.nodeName !== "TEXTAREA") morphChildren(from, to);
    syncControl(from, to);
  }

  /* Patch `el`'s children to the markup in `markup`. */
  function morph(el, markup) {
    var tpl = document.createElement("template");
    tpl.innerHTML = flat(markup);
    var holder = document.createElement(el.nodeName);
    holder.appendChild(tpl.content);
    morphChildren(el, holder);
  }

  /* Hash router: "#/task/abc" → "/task/abc". */
  function path() {
    var h = location.hash.replace(/^#/, "");
    return h ? h.split("?")[0] : "/";
  }
  function go(to, replace) {
    var url = location.pathname + location.search + "#" + to;
    if (replace) location.replace(url); else location.hash = to;
  }

  root.JF = { esc: esc, raw: raw, html: html, morph: morph, path: path, go: go };
})(typeof self !== "undefined" ? self : this);
