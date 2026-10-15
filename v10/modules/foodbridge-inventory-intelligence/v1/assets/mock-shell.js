/*
  DISCOVERY MOCK — app shell (sidebar + header + main).

  Hand-port of the live storefront-frontend shell:
    src/layout/Layout.jsx            → renderShell()
    src/layout/Main.jsx              → <main> wrapper
    src/components/sidebar/*         → renderSidebar()
    src/components/header/Header.jsx → renderHeader()
    src/components/header/MobileMenuLabel.jsx → renderMobileMenuLabel()

  Every Tailwind class string below is copied verbatim from the source JSX so
  the rendered DOM carries the same classes the live app does. Behaviour that
  came from React state (submenu toggle, profile dropdown, sidebar drawer) is
  reimplemented in vanilla JS with the same transitions.

  Data comes from seed-data/seed.json — nothing here talks to a real API.
*/
(function () {
  "use strict";

  const icon = (name, cls, size) => window.MockIcons.get(name, cls, size);

  // Escapes seed-sourced strings. Seed data is trusted, but the live app renders
  // these through React (which escapes), so doing the same keeps behaviour equal
  // for values containing & or <.
  const esc = (s) =>
    String(s == null ? "" : s).replace(
      /[&<>"']/g,
      (c) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );

  // src/hooks/useUtilsFunction.js → toTitleCaseFun
  const toTitleCaseFun = (str, withSpaces = true) => {
    if (typeof str !== "string") return "";
    if (!str.trim()) return "";
    return str
      .toLowerCase()
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(withSpaces ? " " : "");
  };

  // src/hooks/useUtilsFunction.js → showingTranslateValue (lang fixed to "en" here)
  const showingTranslateValue = (data, lang = "en") =>
    data !== undefined && Object.keys(data || {}).includes(lang)
      ? data[lang]
      : data && data.en;

  // src/utils/casing.js → toTitleCase
  const toTitleCase = (str) =>
    str == null
      ? str
      : str
          .toLowerCase()
          .split(" ")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ");

  /* The storefront bag logo (src/assets/img/bag.svg equivalent). Inlined as a
     data URI so the mock has no external image dependency. */
  const BAG_ICON =
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#16a34a"/><path d="M10 12h12l-1 11a1.5 1.5 0 0 1-1.5 1.3h-8A1.5 1.5 0 0 1 10 23z" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"/><path d="M13 12v-1.5a3 3 0 0 1 6 0V12" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>'
    );

  /* ── StoreSelector.jsx (stacked variant) ──────────────────────────────
     The reference tenant has a single location, so `canSwitch` is false:
     no chevron, no second line, cursor-default. */
  function renderStoreSelector(seed, stacked) {
    const name = esc(seed.store && seed.store.name);
    if (stacked) {
      return `
        <div class="relative">
          <div class="flex items-center gap-3 px-1 py-1.5 rounded-md transition-colors cursor-default">
            <a href="#" onclick="return false" class="flex-shrink-0">
              <img src="${BAG_ICON}" alt="Storefront Logo" class="w-7 h-7" />
            </a>
            <div class="flex flex-col min-w-0 flex-1">
              <span class="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate leading-tight" title="${name}">${name}</span>
            </div>
          </div>
        </div>`;
    }
    return `
      <div class="relative">
        <div class="flex items-center gap-2 pl-1 pr-2 py-1.5 rounded-md transition-colors cursor-default">
          <a href="#" onclick="return false" class="flex-shrink-0">
            <img src="${BAG_ICON}" alt="Storefront Logo" class="w-5 h-5" />
          </a>
          <span class="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate max-w-[110px] hidden sm:block" title="${name}">${name}</span>
        </div>
      </div>`;
  }

  /* ── SidebarSubMenu.jsx ───────────────────────────────────────────────── */
  function renderSubMenu(menu, activePath) {
    const isChildActive = (menu.submenus || []).some((s) => s.path === activePath);
    // Live default is useState(true); see seed `_submenuOpenComment`.
    const open = menu.initiallyOpen !== undefined ? menu.initiallyOpen : true;

    const children = (menu.submenus || [])
      .map((child) => {
        const active = child.path === activePath;
        return `
          <li>
            <a href="#" onclick="return false"
               class="flex items-center px-3 py-1 rounded transition-colors ${
                 active
                   ? "text-green-700 bg-green-100"
                   : "hover:text-gray-600 hover:bg-gray-100"
               }">
              ${icon("minus", "mr-1 h-3 w-3")}${esc(child.name)}
            </a>
          </li>`;
      })
      .join("");

    return `
      <li class="relative gap-y-1 rounded-md transition-colors group" data-submenu>
        <button type="button" data-submenu-toggle
          class="w-full flex justify-between items-center gap-3 px-3 py-2 rounded-lg text-left text-gray-600 hover:bg-gray-100 ${
            isChildActive
              ? "text-green-700 bg-green-50"
              : "text-gray-700 dark:text-gray-300 hover:text-green-600 hover:bg-gray-100"
          }">
          <span class="inline-flex items-center">
            ${icon(menu.icon, "w-5 h-5")}
            <span class="ml-4">${esc(menu.name)}</span>
          </span>
          <span class="pl-4 text-xs" data-submenu-chevron>
            ${open ? icon("chevronUp", "h-4 w-4") : icon("chevronDown", "h-4 w-4")}
          </span>
        </button>
        <ul class="ml-8 mt-1 space-y-1 overflow-hidden text-sm text-gray-600 dark:text-gray-400 dark:bg-gray-900 rounded-md"
            aria-label="submenu" data-submenu-list ${open ? "" : "hidden"}>
          ${children}
        </ul>
      </li>`;
  }

  /* ── SidebarContent.jsx ───────────────────────────────────────────────── */
  function renderSidebarContent(seed, activePath) {
    const items = (seed.storefrontMenus || [])
      .map((menu) => {
        if (menu.submenus && menu.submenus.length) {
          return renderSubMenu(menu, activePath);
        }
        const isActive = menu.path === activePath;
        return `
          <li class="relative gap-y-1">
            <a href="#" onclick="return false"
               class="text-md transition-colors duration-150 w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left ${
                 isActive
                   ? "text-green-700 bg-green-50"
                   : "text-gray-600 hover:bg-gray-100 dark:hover:text-gray-200"
               }">
              ${icon(menu.icon, "w-5 h-5")}
              <span>${esc(menu.name)}</span>
            </a>
          </li>`;
      })
      .join("");

    const appProp = seed.appProp || {};
    const routeDelivery = appProp.isRouteDeliveryEnabled
      ? `<div class="border-t border-gray-200 dark:border-gray-700 pt-3 mt-1">
           <a href="#" onclick="return false"
              class="text-md transition-colors duration-150 w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-gray-600 hover:bg-gray-100 dark:hover:text-gray-200">
             ${icon("mapPinned", "w-5 h-5")}
             <span>Route Delivery</span>
           </a>
         </div>`
      : "";

    const storeQr =
      appProp.isStoreQrCode && appProp.isStoreQrCode.isEnabled
        ? `<button type="button"
             class="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 dark:hover:text-gray-200 transition-colors">
             ${icon("qrCode", "w-5 h-5 flex-shrink-0 text-green-600")}
             <span>Store QR Code</span>
           </button>`
        : "";

    return `
      <div class="pt-0 pb-4 px-3 lg:relative z-40 text-gray-500 dark:text-gray-400 flex flex-col h-full">
        <div class="h-14 flex items-center border-b border-gray-200 dark:border-gray-700 flex-shrink-0 mb-3">
          ${renderStoreSelector(seed, true)}
        </div>
        <div class="flex-1 overflow-y-auto sidebar-scroll">
          <ul class="mt-2 space-y-2 pb-4">${items}</ul>
        </div>
        ${routeDelivery}
        <div class="flex-shrink-0 py-4 w-full space-y-3">${storeQr}</div>
      </div>`;
  }

  /* ── Header.jsx ───────────────────────────────────────────────────────── */
  function renderHeader(seed, pageTitle) {
    const user = seed.user || {};
    const displayName = esc(user.displayName || "Admin");
    const role = esc(user.role || "User");

    return `
      <header class="app-header sticky top-0 z-30 flex-shrink-0 bg-white border-gray-200 shadow-sm dark:bg-gray-800 dark:border-gray-700 md:flex-shrink transition-[height,opacity,border-color] duration-300 ease-in-out h-14 opacity-100 border-b overflow-visible">
        <div class="header-container container-fluid flex items-center justify-between h-full px-3 sm:px-6 mx-auto">
          <div class="flex min-w-0 items-center gap-1.5">
            <button type="button" aria-label="Toggle sidebar" data-sidebar-toggle
              class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50">
              ${icon("menu", "w-5 h-5 text-gray-600 dark:text-gray-300")}
            </button>

            <div class="hidden sm:flex items-center gap-2">
              <h1 class="text-base font-semibold text-gray-700 dark:text-gray-200 tracking-tight">${esc(
                pageTitle
              )}</h1>
            </div>
          </div>

          <ul class="flex justify-end items-center flex-shrink-0 space-x-2 sm:space-x-4">
            <li class="relative inline-block text-left" data-profile-root>
              <div class="flex items-center space-x-3 px-2 py-1 group cursor-pointer rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-all duration-200" data-profile-toggle>
                <div class="flex items-center space-x-2">
                  <div class="relative hidden lg:block">
                    <div class="rounded-full bg-gradient-to-br from-green-500 to-emerald-600 text-white h-8 w-8 sm:h-10 sm:w-10 font-semibold flex items-center justify-center ring-2 ring-green-200 dark:ring-green-700 shadow-md transition-all duration-200 group-hover:ring-green-300 dark:group-hover:ring-green-600">
                      ${icon("user", "w-5 h-5")}
                    </div>
                    <div class="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-white dark:border-gray-800"></div>
                  </div>

                  <div class="flex flex-col items-start min-w-0">
                    <p class="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate max-w-32">${displayName}</p>
                    <div class="flex items-center space-x-1">
                      <p class="text-xs text-green-600 dark:text-green-400 font-medium truncate max-w-28">${role}</p>
                    </div>
                  </div>

                  <span data-profile-chevron class="inline-flex transition-all duration-200">
                    ${icon(
                      "chevronDown",
                      "w-4 h-4 text-gray-400 dark:text-gray-500 transition-all duration-200 group-hover:text-gray-600 dark:group-hover:text-gray-300"
                    )}
                  </span>
                </div>
              </div>

              <ul data-profile-menu hidden
                  class="origin-top-right absolute right-0 mt-2 w-56 rounded-lg shadow-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 focus:outline-none overflow-hidden z-50">
                <div class="py-1">
                  <li>
                    <a href="#" onclick="return false"
                       class="flex items-center justify-between px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-green-50 dark:hover:bg-green-900/20 hover:text-green-600 dark:hover:text-green-300 transition-all duration-150 group">
                      <div class="flex items-center min-w-0">
                        ${icon(
                          "nodeTree",
                          "w-4 h-4 text-gray-500 dark:text-gray-400 mr-3 group-hover:text-green-600 dark:group-hover:text-green-400 flex-shrink-0"
                        )}
                        <span class="truncate">My Network</span>
                      </div>
                      <span class="flex items-center gap-0.5 px-1.5 py-0.5 ml-2 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-[10px] font-medium whitespace-nowrap flex-shrink-0">
                        ${icon("sparkles", "w-2.5 h-2.5")}
                        Preview
                      </span>
                    </a>
                  </li>
                  <li>
                    <a href="#" onclick="return false"
                       class="flex items-center px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-green-50 dark:hover:bg-green-900/20 hover:text-green-600 dark:hover:text-green-300 transition-all duration-150">
                      ${icon("settings", "w-4 h-4 text-gray-500 dark:text-gray-400 mr-3")}
                      <span>Edit Profile</span>
                    </a>
                  </li>
                </div>
                <div class="border-t border-gray-200 dark:border-gray-600">
                  <li>
                    <button type="button"
                      class="w-full flex items-center px-4 py-2.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-150">
                      ${icon("logOut", "w-4 h-4 text-red-500 dark:text-red-400 mr-3")}
                      <span>Log Out</span>
                    </button>
                  </li>
                </div>
              </ul>
            </li>
          </ul>
        </div>
      </header>`;
  }

  /* ── MobileMenuLabel.jsx ──────────────────────────────────────────────── */
  function renderMobileMenuLabel(seed, activePath, label) {
    const menu = (seed.storefrontMenus || []).find((m) => m.path === activePath);
    return `
      <div class="sm:hidden px-2 flex min-w-0 items-center gap-2.5 mb-2 px-1 pb-2 " title="${esc(
        label
      )}" aria-current="page">
        ${
          menu
            ? icon(menu.icon, "h-7 w-7 flex-shrink-0 text-green-600 dark:text-green-400")
            : ""
        }
        <h1 class="truncate text-xl font-semibold leading-6 text-gray-800 dark:text-gray-100">${esc(
          label
        )}</h1>
      </div>`;
  }

  /* ── Layout.jsx + Main.jsx ────────────────────────────────────────────── */
  function renderShell(root, seed, opts) {
    const activePath = opts.activePath;
    const pageTitle = opts.pageTitle;

    root.innerHTML = `
      <div class="flex h-[100dvh] bg-gray-50 overflow-x-hidden md:h-screen" data-app-root>
        <aside data-desktop-sidebar
          class="z-30 flex-shrink-0 hidden shadow-sm overflow-y-auto overflow-x-hidden bg-white dark:bg-gray-800 lg:block transition-[width,border-color] duration-300 ease-in-out w-64 border-r border-gray-200">
          ${renderSidebarContent(seed, activePath)}
        </aside>

        <div data-mobile-sidebar hidden>
          <div class="fixed inset-0 z-40 flex items-end bg-black bg-opacity-50 sm:items-center sm:justify-center" data-mobile-backdrop></div>
          <aside class="fixed inset-y-0 z-[10001] flex-shrink-0 w-64 flex flex-col bg-white dark:bg-gray-800 lg:hidden">
            <div class="flex-1 overflow-y-auto">
              ${renderSidebarContent(seed, activePath)}
            </div>
          </aside>
        </div>

        <div class="flex flex-col flex-1 w-full min-h-0 overflow-hidden">
          ${renderHeader(seed, pageTitle)}
          <main class="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
            <div class="w-full mx-auto px-3 sm:px-4 lg:px-6 pt-3 sm:pt-4" style="padding-bottom:1rem">
              ${renderMobileMenuLabel(seed, activePath, pageTitle)}
              <div data-page-outlet></div>
            </div>
          </main>
        </div>
      </div>`;

    wireShell(root);
    return root.querySelector("[data-page-outlet]");
  }

  function wireShell(root) {
    // Submenu expand/collapse — SidebarSubMenu.jsx setOpen(prev => !prev)
    root.querySelectorAll("[data-submenu-toggle]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const li = btn.closest("[data-submenu]");
        const list = li.querySelector("[data-submenu-list]");
        const chevron = li.querySelector("[data-submenu-chevron]");
        const nowOpen = list.hasAttribute("hidden");
        if (nowOpen) list.removeAttribute("hidden");
        else list.setAttribute("hidden", "");
        chevron.innerHTML = nowOpen
          ? icon("chevronUp", "h-4 w-4")
          : icon("chevronDown", "h-4 w-4");
      });
    });

    // Profile dropdown — Header.jsx profileOpen + click-outside handler
    const profileRoot = root.querySelector("[data-profile-root]");
    if (profileRoot) {
      const toggle = profileRoot.querySelector("[data-profile-toggle]");
      const menu = profileRoot.querySelector("[data-profile-menu]");
      const chevron = profileRoot.querySelector("[data-profile-chevron]");
      toggle.addEventListener("click", () => {
        const open = menu.hasAttribute("hidden");
        if (open) menu.removeAttribute("hidden");
        else menu.setAttribute("hidden", "");
        chevron.classList.toggle("rotate-180", open);
      });
      document.addEventListener("mousedown", (e) => {
        if (!profileRoot.contains(e.target)) {
          menu.setAttribute("hidden", "");
          chevron.classList.remove("rotate-180");
        }
      });
    }

    // Sidebar toggle — Header.jsx: mobile opens the drawer, desktop collapses the panel
    const sidebarBtn = root.querySelector("[data-sidebar-toggle]");
    const desktop = root.querySelector("[data-desktop-sidebar]");
    const mobile = root.querySelector("[data-mobile-sidebar]");
    if (sidebarBtn) {
      sidebarBtn.addEventListener("click", () => {
        if (window.innerWidth <= 1024) {
          mobile.hidden = !mobile.hidden;
        } else {
          const collapsed = desktop.classList.contains("w-0");
          desktop.classList.toggle("w-0", !collapsed);
          desktop.classList.toggle("border-r-0", !collapsed);
          desktop.classList.toggle("w-64", collapsed);
          desktop.classList.toggle("border-r", collapsed);
        }
      });
    }
    const backdrop = root.querySelector("[data-mobile-backdrop]");
    if (backdrop) backdrop.addEventListener("click", () => (mobile.hidden = true));
  }

  /* ── Seed loading ─────────────────────────────────────────────────────── */
  async function loadSeed(path) {
    try {
      const res = await fetch(path);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      // fetch() on file:// is blocked by CORS. The live template screen has the
      // same constraint; surface it instead of rendering a blank page.
      document.body.innerHTML = `
        <div style="font-family:system-ui,sans-serif;max-width:44rem;margin:4rem auto;padding:0 1.5rem;line-height:1.6">
          <h1 style="font-size:1.25rem;margin-bottom:.5rem">Seed data could not be loaded</h1>
          <p style="color:#4b5563">These prototypes read <code>${esc(
            path
          )}</code> over <code>fetch()</code>, which the browser blocks on <code>file://</code>.</p>
          <p style="color:#4b5563">Serve the folder over HTTP instead, from <code>discovery/</code>:</p>
          <pre style="background:#f3f4f6;padding:.75rem 1rem;border-radius:.5rem;overflow:auto">python3 -m http.server 8000</pre>
          <p style="color:#4b5563">then open <code>http://localhost:8000/</code>.</p>
          <p style="color:#9ca3af;font-size:.875rem">Underlying error: ${esc(err.message)}</p>
        </div>`;
      throw err;
    }
  }

  window.MockShell = {
    renderShell,
    loadSeed,
    helpers: { esc, toTitleCaseFun, showingTranslateValue, toTitleCase, icon },
  };
})();
