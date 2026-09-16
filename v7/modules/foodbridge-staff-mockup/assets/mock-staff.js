/*
  DISCOVERY MOCK — Workforce Management (live route: /our-staff).

  Hand-port of the live storefront-frontend staff module:
    src/pages/Staff.jsx                        → renderStaffPage()
    src/components/staff/StaffTable.jsx        → renderRows()
    src/components/table/StaffRoleBadge.jsx    → roleBadge()
    src/components/table/EditDeleteButton.jsx  → rowActions()
    src/components/common/CustomPagination.jsx → renderPagination()
    src/components/table/NotFound.jsx          → renderNotFound()
    src/components/preloader/TableLoading.jsx  → renderTableLoading()
    src/components/drawer/StaffDrawer.jsx      → renderDrawer()
    src/components/drawer/MainDrawer.jsx       → drawer shell
    src/components/modal/DeleteModal.jsx       → renderDeleteModal()
    src/components/modal/DiscardChangesModal.jsx → renderDiscardModal()
    src/components/modal/CreateSubRoleModal.jsx  → renderCreateRoleModal()
    src/hooks/useFilter.js                     → applyFilter() + paging
    src/hooks/useStaffSubmit.js                → validate()

  Windmill component classes come from src/assets/theme/myTheme.js (the app's
  theme override, NOT the Windmill default) resolved to literal strings — see
  the WM map below. That is what makes the render pixel-identical.

  NOT PORTED: the Google Sheet subsystem (GoogleSheetToolbar / GoogleSheetView /
  useGoogleSheet). Excluded by decision — see addendum-002. On the reference
  tenant its `features` flags are off, so it renders nothing and the toolbar
  slot below is empty exactly as it is live.
*/
(function () {
  "use strict";

  const { esc, toTitleCaseFun, showingTranslateValue, toTitleCase } =
    window.MockShell.helpers;
  const icon = (name, cls, size) => window.MockIcons.get(name, cls, size);

  /* ── myTheme.js resolved to literal class strings ─────────────────────── */
  const WM = {
    card: "min-w-0 rounded-lg overflow-hidden bg-white dark:bg-gray-800",
    cardBody: "p-4",
    buttonPrimary:
      "align-bottom inline-flex items-center justify-center cursor-pointer leading-5 transition-colors duration-150 font-medium focus:outline-none px-4 py-2 rounded-md text-sm text-white bg-green-600 border border-transparent active:bg-green-700 hover:bg-green-700",
    buttonOutline:
      "align-bottom inline-flex items-center justify-center cursor-pointer leading-5 transition-colors duration-150 font-medium focus:outline-none px-4 py-2 rounded-md text-sm text-gray-600 border-gray-200 border dark:text-gray-400 focus:outline-none rounded-lg border bg-gray-200 border-gray-200 px-4 w-full mr-3 flex items-center justify-center cursor-pointer h-10",
    input:
      "block w-full h-10 border border-gray-200 bg-white px-3 py-1 text-sm focus:outline-none dark:text-gray-300 leading-5 rounded-md bg-gray-100 focus:bg-white dark:focus:bg-gray-700 focus:border-gray-200 border-gray-200 dark:border-gray-600 dark:focus:border-gray-500 dark:bg-gray-700",
    label: "block text-sm text-gray-800 dark:text-gray-400",
    tableContainer:
      "w-full overflow-hidden border border-gray-200 dark:border-gray-700 rounded-lg",
    tableHeader:
      "text-sm font-medium tracking-wide text-left text-zinc-500 uppercase border-b border-gray-200 dark:border-gray-700 bg-white dark:text-gray-400 dark:bg-gray-800",
    tableBody:
      "bg-white divide-y divide-gray-100 dark:divide-gray-700 dark:bg-gray-800 text-gray-800 dark:text-gray-400",
    tableRow: "",
    tableCell: "px-4 py-2",
    tableFooter:
      "px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-white text-gray-500 dark:text-gray-400 dark:bg-gray-800",
    badgeBase: "inline-flex px-2 text-xs font-medium leading-5 rounded-full",
    badge: {
      success:
        "text-emerald-600 bg-emerald-100 dark:bg-emerald-800 dark:text-emerald-100",
      danger: "text-red-500 bg-red-100 dark:text-red-100 dark:bg-red-800",
      warning: "text-yellow-600 bg-yellow-100 dark:text-white dark:bg-yellow-600",
      neutral: "text-gray-500 bg-gray-100 dark:text-gray-100 dark:bg-gray-800",
      primary: "text-blue-500 bg-blue-100 dark:text-white dark:bg-blue-800",
    },
    backdrop:
      "fixed inset-0 z-[10000] flex items-end bg-black bg-opacity-50 sm:items-center sm:justify-center",
    modal:
      "w-full px-6 py-4 overflow-hidden bg-white rounded-t-lg dark:bg-gray-800 sm:rounded-lg sm:m-4 sm:max-w-xl custom-modal",
    modalBody: "mb-6 text-sm text-gray-800 dark:text-gray-400",
    modalFooter:
      "flex flex-col items-center justify-end px-6 py-3 -mx-6 -mb-4 space-y-3 sm:space-y-0 sm:space-x-4 sm:flex-row bg-gray-50 dark:bg-gray-800",
  };

  // useFilter.js → limitData
  const RESULTS_PER_PAGE = 20;
  // Staff.jsx → useDebounce(searchInput, 400)
  const SEARCH_DEBOUNCE_MS = 400;

  /* ── State ────────────────────────────────────────────────────────────── */
  const state = {
    seed: null,
    staff: [],
    subRoles: [],
    label: "Workforce Management",
    search: "",
    currentPage: 1,
    loading: false,
    drawer: null, // null | { id: string|null }
    deleteTarget: null,
    discardOpen: false,
    createRoleOpen: false,
    form: { name: "", phone: "", email: "", subRoleId: "", notifyUser: false },
    formInitial: null,
    errors: {},
    touched: {},
    submitting: false,
    roleMenuOpen: false,
  };

  let outlet = null;
  let searchTimer = null;

  /* ── StaffTable.jsx role resolution ───────────────────────────────────── */
  function roleNameFor(staff) {
    const role = state.subRoles.find((r) => r._id === staff.subRoleRef);
    return role ? (role.name === "DEFAULT" ? "Unassigned" : role.name) : "N/A";
  }

  /* ── StaffRoleBadge.jsx ───────────────────────────────────────────────── */
  function roleBadge(roleName) {
    // Live mapping: only "packaging" → warning and "gate men" → primary.
    // Everything else falls through to neutral, which is why every badge on the
    // reference tenant renders gray.
    const roleColors = {
      warning: ["packaging"],
      primary: ["gate men"],
      success: [],
      danger: [],
      teal: [],
    };
    let badgeType = "neutral";
    Object.entries(roleColors).forEach(([color, roles]) => {
      if (roles.includes((roleName || "").toLowerCase())) badgeType = color;
    });
    const extra = badgeType === "teal" ? " dark:bg-teal-900 bg-teal-100" : "";
    const tone = WM.badge[badgeType] || WM.badge.neutral;
    return `<span class="${WM.badgeBase} ${tone}${extra}">${esc(roleName)}</span>`;
  }

  /* ── EditDeleteButton.jsx (staff variant: no view button) ─────────────── */
  function rowActions(staff) {
    const id = esc(staff._id);
    return `
      <div class="flex text-left font-sm -ml-2">
        <button data-edit="${id}" class="p-2 cursor-pointer focus:outline-none hover:text-green-600"
                data-tip="Edit">${icon("edit", "")}</button>
        <button data-delete="${id}" class="p-2 cursor-pointer hover:text-red-600 focus:outline-none"
                data-tip="Delete">${icon("trash", "")}</button>
      </div>`;
  }

  /* ── useFilter.js → searchUser branch ─────────────────────────────────── */
  function applyFilter(list, searchUser) {
    if (!searchUser) return list;
    const q = searchUser.toLowerCase();
    return list.filter(
      (s) =>
        (s.name && s.name.en ? s.name.en.toLowerCase() : "").includes(q) ||
        (s.phone ? s.phone.toString() : "").includes(q) ||
        (s.email ? s.email.toLowerCase() : "").includes(q)
    );
  }

  /* ── StaffTable.jsx rows ──────────────────────────────────────────────── */
  function renderRows(rows) {
    return rows
      .map(
        (staff) => `
      <tr class="${WM.tableRow} hover:bg-gray-50 border-b border-gray-200">
        <td class="${WM.tableCell}">
          <div class="flex items-center">
            <div>
              <div class="text-sm font-medium">${esc(
                toTitleCaseFun(showingTranslateValue(staff.name))
              )}</div>
            </div>
          </div>
        </td>
        <td class="${WM.tableCell}"><span class="text-sm">${esc(
          staff.email || ""
        )}</span> </td>
        <td class="${WM.tableCell}"><span class="text-sm ">${esc(
          staff.phone || ""
        )}</span></td>
        <td class="${WM.tableCell} text-xs">${roleBadge(roleNameFor(staff))}</td>
        <td class="${WM.tableCell}">${rowActions(staff)}</td>
      </tr>`
      )
      .join("");
  }

  /* ── CustomPagination.jsx ─────────────────────────────────────────────── */
  function renderPagination(currentPage, totalPages, resultsPerPage, totalResults) {
    const getPageNumbers = () => {
      const pages = [];
      if (totalPages <= 6) {
        for (let i = 1; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        if (currentPage > 3) pages.push("left-ellipsis");
        const start = Math.max(2, currentPage - 1);
        const end = Math.min(totalPages - 1, currentPage + 1);
        for (let i = start; i <= end; i++) pages.push(i);
        if (currentPage < totalPages - 2) pages.push("right-ellipsis");
        pages.push(totalPages);
      }
      return pages;
    };

    const button = (page) => {
      if (page === "left-ellipsis" || page === "right-ellipsis") {
        return `<span class="px-2 text-gray-500 dark:text-gray-400 font-medium">...</span>`;
      }
      const active = currentPage === page;
      return `<li><button data-page="${page}" type="button"
        class="align-bottom inline-flex items-center justify-center cursor-pointer leading-5 transition-colors duration-150 font-medium focus:outline-none px-3 py-1 rounded-md text-xs ${
          active
            ? "text-white bg-green-500 hover:bg-green-600"
            : "text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
        }">${page}</button></li>`;
    };

    const start = (currentPage - 1) * resultsPerPage + 1;
    const end = Math.min(currentPage * resultsPerPage, totalResults);

    return `
      <div class="flex flex-col sm:flex-row items-center justify-between px-4 py-3 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-sm">
        <span class="font-semibold tracking-wide uppercase text-xs">SHOWING ${start}–${end} OF ${totalResults}</span>
        <div class="mt-2 sm:mt-0">
          <nav aria-label="Table navigation">
            <ul class="inline-flex items-center space-x-2">
              <li><button data-page="${currentPage - 1}" ${
      currentPage === 1 ? "disabled" : ""
    } class="px-2 py-1 text-sm rounded-md text-gray-500 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50">‹</button></li>
              ${getPageNumbers().map(button).join("")}
              <li><button data-page="${currentPage + 1}" ${
      currentPage === totalPages ? "disabled" : ""
    } class="px-2 py-1 text-sm rounded-md text-gray-500 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50">›</button></li>
            </ul>
          </nav>
        </div>
      </div>`;
  }

  /* ── NotFound.jsx ─────────────────────────────────────────────────────── */
  const NO_RESULT_SVG =
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200"><g fill="none" stroke="#d1d5db" stroke-width="3"><rect x="60" y="45" width="200" height="120" rx="10"/><line x1="60" y1="78" x2="260" y2="78"/><line x1="90" y1="103" x2="230" y2="103"/><line x1="90" y1="126" x2="200" y2="126"/></g><circle cx="215" cy="140" r="34" fill="#fff" stroke="#9ca3af" stroke-width="4"/><line x1="239" y1="164" x2="262" y2="187" stroke="#9ca3af" stroke-width="7" stroke-linecap="round"/></svg>'
    );

  function renderNotFound(title) {
    return `
      <div class="text-center align-middle mx-auto p-5 my-5">
        <div class="flex justify-center">
          <img class="my-4 w-full max-w-xs sm:max-w-sm md:max-w-md" src="${NO_RESULT_SVG}" alt="no-result" />
        </div>
        <h2 class="text-lg md:text-xl lg:text-2xl xl:text-2xl text-center mt-2 font-medium font-serif text-gray-600">
          We're sorry, ${esc(title)}
        </h2>
      </div>`;
  }

  /* ── TableLoading.jsx (row=12 col=7 width=163 height=20) ──────────────── */
  function renderTableLoading(row = 12, col = 7, width = 163, height = 20) {
    const bar = (h, w) =>
      `<span class="skeleton mx-1 my-1" style="height:${h}px;width:${w}px"></span>`;
    const header = Array.from({ length: col }, () => bar(40, width)).join("");
    const body = Array.from(
      { length: row },
      () => `<div>${Array.from({ length: col }, () => bar(height, width)).join("")}</div>`
    ).join("");
    return `
      <div class="${WM.tableContainer} mb-8">
        <div class="text-center">${header}${body}</div>
        <div class="${WM.tableFooter} flex justify-between">
          ${bar(25, 290)}${bar(25, 290)}
        </div>
      </div>`;
  }

  /* ── Staff.jsx page body ──────────────────────────────────────────────── */
  function renderPageBody() {
    const label = esc(state.label);

    const toolbar = `
      <div class="tab tab-enter">
        <div class="${WM.card} !bg-transparent min-w-0 shadow-xs overflow-hidden dark:bg-gray-800 mb-6">
          <div class="${WM.cardBody} !p-0 !pt-6">
            <form class="py-b md:pb-0 grid gap-4 lg:gap-6 xl:gap-6 lg:flex" data-noop-form>
              <div class="flex-grow-0 sm:flex-grow md:flex-grow lg:flex-grow xl:flex-grow"></div>
              <div class="hidden md:flex flex-col sm:flex-row gap-4">
                <!-- GoogleSheetToolbar slot — renders nothing when the tenant's
                     sheet features are disabled, which is the reference case. -->
                <div class="flex-grow-0 flex gap-2"></div>
                <div class="flex-grow-0 md:flex-grow lg:flex-grow xl:flex-grow">
                  <button type="button" data-add-staff class="${WM.buttonPrimary} w-full rounded-md h-10 add-product-button">
                    <span class="mr-2">${icon("plus", "")}</span>
                    Add ${label}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>`;

    const searchCard = `
      <div class="tab tab-enter">
        <div class="${WM.card} min-w-0 shadow-xs overflow-hidden bg-white dark:bg-gray-800 rounded-t-lg rounded-0 mb-4">
          <div class="${WM.cardBody}">
            <form class="grid gap-4 lg:gap-6 xl:gap-6 md:flex xl:flex" data-noop-form>
              <div class="flex-grow-0 md:flex-grow lg:flex-grow xl:flex-grow">
                <div class="relative flex-1">
                  ${icon(
                    "search",
                    "absolute left-1 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4"
                  )}
                  <input data-search type="search" name="search" value="${esc(
                    state.search
                  )}" class="${WM.input} pl-9" placeholder="Search by name/email/phone" />
                </div>
                <button type="submit" class="absolute right-0 top-0 mt-5 mr-1"></button>
              </div>
            </form>
          </div>
        </div>
      </div>`;

    // Staff.jsx render branch order: loading → sheet → error → rows → NotFound
    let main;
    if (state.loading) {
      main = renderTableLoading();
    } else {
      const filtered = applyFilter(state.staff, state.search);
      const totalResults = filtered.length;
      const totalPages = Math.ceil((totalResults || 1) / RESULTS_PER_PAGE);
      const page = Math.min(state.currentPage, Math.max(1, totalPages));
      const rows = filtered.slice(
        (page - 1) * RESULTS_PER_PAGE,
        page * RESULTS_PER_PAGE
      );

      if (totalResults >= 1) {
        main = `
          <div class="${WM.tableContainer} mb-8 rounded-b-lg">
            <div class="w-full overflow-x-auto">
              <table class="w-full whitespace-nowrap">
                <thead class="${WM.tableHeader} !h-12">
                  <tr>
                    <td class="${WM.tableCell}">Name</td>
                    <td class="${WM.tableCell}">Email</td>
                    <td class="${WM.tableCell}">Contact</td>
                    <td class="${WM.tableCell}">Role</td>
                    <td class="${WM.tableCell}">ACTIONS</td>
                  </tr>
                </thead>
                <tbody class="${WM.tableBody}">${renderRows(rows)}</tbody>
              </table>
            </div>
            <div class="${WM.tableFooter}">
              ${renderPagination(page, totalPages, RESULTS_PER_PAGE, totalResults)}
            </div>
          </div>`;
      } else {
        main = renderNotFound("There are no staff right now.");
      }
    }

    // Mobile sticky footer — Staff.jsx, non-sheet branch
    const mobileFooter = `
      <div class="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-[0_-2px_12px_rgba(0,0,0,0.08)]">
        <div class="flex items-center justify-around px-1 py-2 pb-[env(safe-area-inset-bottom,8px)]">
          <button data-add-staff class="flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg text-emerald-700 hover:bg-emerald-50">
            <span class="rounded-lg bg-emerald-600 px-3 py-1 text-white">${icon(
              "plus",
              "w-5 h-5"
            )}</span>
            <span class="text-[10px] font-medium">Add Staff</span>
          </button>
        </div>
      </div>
      <div class="md:hidden h-16"></div>`;

    return (
      toolbar +
      searchCard +
      main +
      mobileFooter +
      renderDrawer() +
      renderDeleteModal() +
      renderDiscardModal() +
      renderCreateRoleModal()
    );
  }

  /* ── StaffDrawer.jsx + MainDrawer.jsx ─────────────────────────────────── */
  function renderDrawer() {
    const open = !!state.drawer;
    const id = state.drawer && state.drawer.id;
    const label = esc(state.label);
    const f = state.form;
    const notifyEnabled =
      state.seed &&
      state.seed.appProp &&
      state.seed.appProp.notification &&
      state.seed.appProp.notification.isEnabled;

    // The error <p> is ALWAYS rendered (hidden when clean) rather than
    // conditionally inserted. Blur then patches it in place instead of
    // re-rendering the form — see refreshFieldErrors(). Replacing innerHTML on
    // blur detaches the element the user is mid-click on, so the first click on
    // Submit gets swallowed; React's reconciliation keeps those nodes alive, so
    // live the first click always lands. Same DOM, same behaviour.
    const field = (opts) => {
      const err = state.errors[opts.name];
      const touched = state.touched[opts.name];
      const showErr = touched && err;
      return `
        <div class="grid grid-cols-6 gap-3 md:gap-5 xl:gap-6 lg:gap-6 mb-6">
          <label class="${WM.label} col-span-4 sm:col-span-2 font-medium text-sm">${esc(
        opts.label
      )}${opts.required ? '<span class="text-red-500 ml-1">*</span>' : ""}</label>
          <div class="col-span-8 sm:col-span-4 ${opts.wrapClass || ""}">
            <div class="w-full">
              <div class="border border-gray-300 rounded-lg bg-white focus-within:border-green-500">
                <input data-field="${opts.name}" name="${opts.name}" type="${
        opts.type
      }" autocomplete="off" value="${esc(opts.value)}" placeholder="${esc(
        opts.placeholder
      )}"
                  class="${WM.input} flex-1 h-10 p-2 border-none focus:ring-0 rounded-lg ${
        showErr ? "border-red-500 focus:border-red-500" : ""
      }" />
              </div>
              <p data-field-error="${opts.name}" class="text-red-500 text-sm mt-1"${
        showErr ? "" : " hidden"
      }>${showErr ? esc(err) : ""}</p>
            </div>
          </div>
        </div>`;
    };

    const selectedRole = state.subRoles.find((r) => r._id === f.subRoleId);
    const roleLabel = selectedRole
      ? toTitleCase(selectedRole.name === "DEFAULT" ? "Unassigned" : selectedRole.name)
      : null;

    const roleOptions = `
      <div class="rs-menu" ${state.roleMenuOpen ? "" : "hidden"} data-role-menu>
        <div data-role-option="__create_new__"
             class="flex items-center gap-2 px-3 py-2 cursor-pointer bg-blue-50 hover:bg-blue-100"
             style="border-bottom:1px solid #e5e7eb">
          ${icon("plus", "text-blue-700 flex-shrink-0", 14)}
          <span class="text-blue-700 font-semibold text-sm">Create new role</span>
        </div>
        ${state.subRoles
          .map(
            (sr) =>
              `<div data-role-option="${esc(sr._id)}" class="px-3 py-2 cursor-pointer text-sm bg-white text-gray-800 hover:bg-blue-600 hover:text-white">${esc(
                toTitleCase(sr.name === "DEFAULT" ? "Unassigned" : sr.name)
              )}</div>`
          )
          .join("")}
      </div>`;

    const body = `
      <form autocomplete="off" class="block" id="block" data-staff-form>
        <div class="px-6 pt-8 flex-grow scrollbar-hide w-full max-h-full pb-40 drawer-body-form">
          ${field({
            label: "Name",
            name: "name",
            type: "text",
            required: true,
            value: f.name,
            placeholder: `${state.label} name`,
            wrapClass: "staff-name",
          })}
          ${field({
            label: "Contact Number",
            name: "phone",
            type: "text",
            required: true,
            value: f.phone,
            placeholder: "Phone number",
            wrapClass: "staff-phone",
          })}
          ${field({
            label: "Email",
            name: "email",
            type: "email",
            required: false,
            value: f.email,
            placeholder: "Email (optional)",
            wrapClass: "staff_email",
          })}

          <div class="grid grid-cols-6 gap-3 md:gap-5 xl:gap-6 lg:gap-6 mb-6">
            <label class="${WM.label} col-span-4 sm:col-span-2 font-medium text-sm">Role</label>
            <div class="col-span-8 sm:col-span-4 staff-phone">
              <div class="relative">
                <div class="rs-control ${
                  state.roleMenuOpen ? "is-focused" : ""
                }" data-role-control>
                  <span class="${roleLabel ? "" : "rs-placeholder"}">${
      roleLabel ? esc(roleLabel) : "Select Role (optional)"
    }</span>
                  <span class="flex items-center gap-1">
                    ${
                      roleLabel
                        ? `<button type="button" data-role-clear class="text-gray-400 hover:text-gray-600">${icon(
                            "x",
                            "w-4 h-4"
                          )}</button>`
                        : ""
                    }
                    ${icon("chevronDown", "w-4 h-4 text-gray-400")}
                  </span>
                </div>
                ${roleOptions}
              </div>
            </div>
          </div>

          ${
            !id && notifyEnabled
              ? `<div class="grid grid-cols-6 gap-3 md:gap-5 xl:gap-6 lg:gap-6 mb-6">
                   <label class="${WM.label} col-span-4 sm:col-span-2 font-medium text-sm">Notify User</label>
                   <div class="col-span-8 sm:col-span-4">
                     <div class="flex items-center gap-2">
                       <div class="flex items-center cursor-pointer select-none" title="Send notification to user">
                         <input id="notifyUser" name="notifyUser" type="checkbox" data-field="notifyUser" ${
                           f.notifyUser ? "checked" : ""
                         }
                           class="peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" />
                       </div>
                     </div>
                   </div>
                 </div>`
              : ""
          }
        </div>

        <div class="fixed z-10 bottom-0 right-0 flex w-full gap-3 border-t border-gray-100 bg-gray-50 px-6 py-4 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 lg:gap-6 lg:py-8">
          <div class="min-w-0 flex-1 add-staff-target">
            <button type="submit" ${state.submitting ? "disabled" : ""}
              class="${WM.buttonPrimary} w-full h-12${
      state.submitting ? " opacity-50 cursor-not-allowed" : ""
    }">
              ${
                state.submitting
                  ? `<span class="font-serif ml-2 font-light">Processing</span>`
                  : id
                  ? `<span>Update ${label}</span>`
                  : `<span>Add ${label}</span>`
              }
            </button>
          </div>
          <div class="min-w-0 flex-1">
            <button type="button" data-drawer-cancel
              class="align-bottom inline-flex items-center justify-center cursor-pointer leading-5 transition-colors duration-150 font-medium focus:outline-none px-4 py-2 rounded-md text-sm text-gray-600 border-gray-200 border h-12 bg-white w-full text-red-500 hover:bg-red-50 hover:border-red-100 hover:text-red-600">
              Cancel
            </button>
          </div>
        </div>
      </form>`;

    return `
      <div class="rc-drawer ${open ? "is-open" : ""}" ${
      open ? "" : "hidden"
    } data-drawer>
        <div class="rc-drawer-mask" data-drawer-mask></div>
        <div class="rc-drawer-content">
          <button data-drawer-close aria-label="Close drawer"
            class="absolute focus:outline-none z-10 text-red-500 hover:bg-red-100 hover:text-gray-700 transition-colors duration-150 bg-white shadow-md mr-6 right-0 left-auto w-10 h-10 rounded-full block text-center"
            style="top:1.5rem">
            ${icon("x", "mx-auto")}
          </button>
          <div class="flex flex-col w-full h-full justify-between">
            <div class="w-full relative p-6 border-b border-gray-100 bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
              <div class="flex md:flex-row flex-col justify-between mr-20">
                <div>
                  <h4 class="text-xl font-medium dark:text-gray-300">${
                    id ? `Update ${label}` : `Add ${label}`
                  }</h4>
                  <p class="mb-0 text-sm dark:text-gray-300">${
                    id
                      ? `Update your ${label} necessary information from here`
                      : `Add your ${label} necessary information from here`
                  }</p>
                </div>
              </div>
            </div>
            <div class="track-horizontal thumb-horizontal w-full md:w-7/12 lg:w-8/12 xl:w-8/12 relative dark:bg-gray-700 dark:text-gray-200 flex-1 overflow-y-auto">
              ${body}
            </div>
          </div>
        </div>
      </div>`;
  }

  /* ── DeleteModal.jsx ──────────────────────────────────────────────────── */
  function renderDeleteModal() {
    if (!state.deleteTarget) return "";
    const title = toTitleCaseFun(showingTranslateValue(state.deleteTarget.name));
    return `
      <div class="${WM.backdrop} mock-backdrop is-open" data-delete-backdrop>
        <div class="${WM.modal} mock-modal" role="dialog" aria-modal="true">
          <div class="${WM.modalBody} text-center custom-modal px-6 pt-8 pb-2">
            <span class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 dark:bg-red-900/30">
              ${icon("trash", "h-5 w-5 text-red-600")}
            </span>
            <h2 class="text-base font-semibold text-gray-900 dark:text-gray-100">
              Delete <span class="text-red-600">${esc(title)}</span>?
            </h2>
            <p class="mt-1.5 text-sm text-gray-500 dark:text-gray-400">This action can't be undone. It will be permanently removed from your list.</p>
          </div>
          <div class="${WM.modalFooter} justify-center">
            <div class="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row sm:justify-end sm:gap-3">
              <button type="button" data-delete-cancel
                class="inline-flex h-10 w-full items-center justify-center rounded-md border border-gray-300 bg-white px-5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200 disabled:pointer-events-none disabled:opacity-60 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 sm:w-auto">
                Cancel
              </button>
              <button type="button" data-delete-confirm
                class="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-transparent bg-red-600 px-5 text-sm font-medium text-white transition-colors hover:bg-red-700 active:bg-red-800 focus:outline-none focus:ring-2 focus:ring-red-300 disabled:pointer-events-none disabled:opacity-70 sm:w-auto">
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>`;
  }

  /* ── DiscardChangesModal.jsx ──────────────────────────────────────────── */
  function renderDiscardModal() {
    if (!state.discardOpen) return "";
    return `
      <div class="fixed inset-0 z-[10060] flex items-end bg-black bg-opacity-50 sm:items-center sm:justify-center mock-backdrop is-open" data-discard-backdrop>
        <div class="${WM.modal} mock-modal" role="dialog" aria-modal="true">
          <div class="w-full text-center">
            <span class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 dark:bg-amber-900/30">
              ${icon("alertTriangle", "h-5 w-5 text-amber-600")}
            </span>
            <h1 class="text-base font-semibold text-gray-900 dark:text-gray-100">Discard Changes</h1>
            <p class="mt-1.5 text-sm text-gray-500 dark:text-gray-400">Are you sure you want to discard the changes ?</p>
            <div class="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-center sm:gap-3">
              <button type="button" data-discard-wait
                class="inline-flex h-10 w-full items-center justify-center rounded-md border border-gray-300 bg-white px-5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 sm:w-auto">
                No, Wait
              </button>
              <button type="button" data-discard-confirm
                class="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-transparent bg-amber-600 px-5 text-sm font-medium text-white transition-colors hover:bg-amber-700 active:bg-amber-800 focus:outline-none focus:ring-2 focus:ring-amber-300 sm:w-auto">
                Yes, Discard
              </button>
            </div>
          </div>
        </div>
      </div>`;
  }

  /* ── CreateSubRoleModal.jsx ───────────────────────────────────────────── */
  function renderCreateRoleModal() {
    if (!state.createRoleOpen) return "";
    return `
      <div class="fixed inset-0 z-[10070] flex items-end bg-black bg-opacity-50 sm:items-center sm:justify-center mock-backdrop is-open" data-createrole-backdrop>
        <div class="${WM.modal} mock-modal" role="dialog" aria-modal="true">
          <div class="w-full">
            <h1 class="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Create new role</h1>
            <input data-newrole-input type="text" placeholder="Role name"
              class="${WM.input} mb-1" />
            <p class="text-red-500 text-sm mb-2 ${
              state.errors.newRole ? "" : "hidden"
            }" data-newrole-error>${esc(state.errors.newRole || "")}</p>
            <div class="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
              <button type="button" data-createrole-cancel
                class="inline-flex h-10 w-full items-center justify-center rounded-md border border-gray-300 bg-white px-5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 sm:w-auto">
                Cancel
              </button>
              <button type="button" data-createrole-save class="${
                WM.buttonPrimary
              } h-10 w-full sm:w-auto">Create</button>
            </div>
          </div>
        </div>
      </div>`;
  }

  /* ── useStaffSubmit.js validation (InputArea rules) ───────────────────── */
  function validate() {
    const errors = {};
    const f = state.form;
    if (!f.name || !f.name.trim()) errors.name = "Name is required!";
    if (!f.phone || !f.phone.trim()) errors.phone = "Contact Number is required!";
    else if (!/^\+?\d{7,15}$/.test(f.phone.trim()))
      errors.phone = "Invalid contact number";
    if (f.email && f.email.trim() && !/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,3}$/.test(f.email.trim()))
      errors.email = "Invalid email";
    return errors;
  }

  /* Patch validation messages in place — never re-render the form for these.
     Keeps focus, caret and in-flight clicks intact, matching React. */
  function refreshFieldErrors() {
    outlet.querySelectorAll("[data-field-error]").forEach((p) => {
      const name = p.getAttribute("data-field-error");
      const show = state.touched[name] && state.errors[name];
      p.textContent = show ? state.errors[name] : "";
      if (show) p.removeAttribute("hidden");
      else p.setAttribute("hidden", "");
      const input = outlet.querySelector(`[data-field="${name}"]`);
      if (input) {
        input.classList.toggle("border-red-500", !!show);
        input.classList.toggle("focus:border-red-500", !!show);
      }
    });
  }

  function hasUnsavedChanges() {
    if (!state.formInitial) return false;
    const i = state.formInitial;
    const c = state.form;
    return (
      (i.name || "") !== (c.name || "").trim() ||
      (i.email || "") !== (c.email || "").trim() ||
      (i.phone || "") !== (c.phone || "").trim() ||
      (i.subRoleId || "") !== (c.subRoleId || "") ||
      !!i.notifyUser !== !!c.notifyUser
    );
  }

  /* ── Render + wire ────────────────────────────────────────────────────── */
  function render() {
    outlet.innerHTML = renderPageBody();
    wire();
  }

  function openDrawer(id) {
    const staff = id ? state.staff.find((s) => s._id === id) : null;
    state.form = staff
      ? {
          name: showingTranslateValue(staff.name) || "",
          phone: staff.phone || "",
          email: staff.email || "",
          subRoleId: staff.subRoleRef || "",
          notifyUser: false,
        }
      : { name: "", phone: "", email: "", subRoleId: "", notifyUser: false };
    state.formInitial = Object.assign({}, state.form);
    state.errors = {};
    state.touched = {};
    state.drawer = { id: id || null };
    render();
  }

  function requestDrawerClose() {
    if (hasUnsavedChanges()) {
      state.discardOpen = true;
      render();
      return;
    }
    state.drawer = null;
    render();
  }

  function wire() {
    const $ = (sel) => outlet.querySelector(sel);
    const $$ = (sel) => outlet.querySelectorAll(sel);

    $$("[data-noop-form]").forEach((f) =>
      f.addEventListener("submit", (e) => e.preventDefault())
    );

    // Search — debounced, resets to page 1 (Staff.jsx useEffect on debouncedSearch)
    const search = $("[data-search]");
    if (search) {
      search.addEventListener("input", (e) => {
        const v = e.target.value;
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
          state.search = v.trim();
          state.currentPage = 1;
          render();
          const el = outlet.querySelector("[data-search]");
          if (el) {
            el.focus();
            el.setSelectionRange(el.value.length, el.value.length);
          }
        }, SEARCH_DEBOUNCE_MS);
      });
    }

    $$("[data-page]").forEach((btn) =>
      btn.addEventListener("click", () => {
        const p = Number(btn.getAttribute("data-page"));
        if (!p || btn.disabled) return;
        state.currentPage = p;
        render();
      })
    );

    $$("[data-add-staff]").forEach((b) =>
      b.addEventListener("click", () => openDrawer(null))
    );
    $$("[data-edit]").forEach((b) =>
      b.addEventListener("click", () => openDrawer(b.getAttribute("data-edit")))
    );
    $$("[data-delete]").forEach((b) =>
      b.addEventListener("click", () => {
        state.deleteTarget = state.staff.find(
          (s) => s._id === b.getAttribute("data-delete")
        );
        render();
      })
    );

    // Row action tooltips (react-tooltip equivalent)
    $$("[data-tip]").forEach((el) => {
      let tip;
      el.addEventListener("mouseenter", () => {
        tip = document.createElement("div");
        tip.className = "mock-tooltip";
        tip.textContent = el.getAttribute("data-tip");
        document.body.appendChild(tip);
        const r = el.getBoundingClientRect();
        tip.style.left = r.left + r.width / 2 - tip.offsetWidth / 2 + "px";
        tip.style.top = r.top - tip.offsetHeight - 6 + "px";
        requestAnimationFrame(() => tip.classList.add("is-visible"));
      });
      el.addEventListener("mouseleave", () => {
        if (tip) tip.remove();
        tip = null;
      });
    });

    // Delete modal
    const dc = $("[data-delete-confirm]");
    if (dc)
      dc.addEventListener("click", () => {
        state.staff = state.staff.filter((s) => s._id !== state.deleteTarget._id);
        state.deleteTarget = null;
        render();
      });
    const dcx = $("[data-delete-cancel]");
    if (dcx)
      dcx.addEventListener("click", () => {
        state.deleteTarget = null;
        render();
      });

    // Drawer
    const dClose = $("[data-drawer-close]");
    if (dClose) dClose.addEventListener("click", requestDrawerClose);
    const dCancel = $("[data-drawer-cancel]");
    if (dCancel) dCancel.addEventListener("click", requestDrawerClose);
    const dMask = $("[data-drawer-mask]");
    if (dMask) dMask.addEventListener("click", requestDrawerClose);

    $$("[data-field]").forEach((input) => {
      input.addEventListener("input", (e) => {
        const name = input.getAttribute("data-field");
        state.form[name] =
          input.type === "checkbox" ? e.target.checked : e.target.value;
      });
      input.addEventListener("blur", () => {
        const name = input.getAttribute("data-field");
        state.touched[name] = true;
        state.errors = validate();
        refreshFieldErrors();
      });
    });

    const form = $("[data-staff-form]");
    if (form)
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        state.errors = validate();
        state.touched = { name: true, phone: true, email: true };
        if (Object.keys(state.errors).length) {
          refreshFieldErrors();
          return;
        }
        const id = state.drawer.id;
        if (id) {
          const s = state.staff.find((x) => x._id === id);
          s.name = { en: state.form.name.trim() };
          s.phone = state.form.phone.trim();
          s.email = state.form.email.trim();
          s.subRoleRef = state.form.subRoleId;
        } else {
          state.staff.push({
            _id: "stf-" + Date.now(),
            name: { en: state.form.name.trim() },
            phone: state.form.phone.trim(),
            email: state.form.email.trim(),
            subRoleRef: state.form.subRoleId,
          });
        }
        state.drawer = null;
        render();
      });

    // Role select
    const rc = $("[data-role-control]");
    if (rc)
      rc.addEventListener("click", () => {
        state.roleMenuOpen = !state.roleMenuOpen;
        render();
      });
    $$("[data-role-option]").forEach((opt) =>
      opt.addEventListener("click", (e) => {
        e.stopPropagation();
        const v = opt.getAttribute("data-role-option");
        state.roleMenuOpen = false;
        if (v === "__create_new__") state.createRoleOpen = true;
        else state.form.subRoleId = v;
        render();
      })
    );
    const rClear = $("[data-role-clear]");
    if (rClear)
      rClear.addEventListener("click", (e) => {
        e.stopPropagation();
        state.form.subRoleId = "";
        state.roleMenuOpen = false;
        render();
      });

    // Discard modal
    const dw = $("[data-discard-wait]");
    if (dw)
      dw.addEventListener("click", () => {
        state.discardOpen = false;
        render();
      });
    const dd = $("[data-discard-confirm]");
    if (dd)
      dd.addEventListener("click", () => {
        state.discardOpen = false;
        state.drawer = null;
        render();
      });

    // Create-role modal
    const crc = $("[data-createrole-cancel]");
    if (crc)
      crc.addEventListener("click", () => {
        state.createRoleOpen = false;
        delete state.errors.newRole;
        render();
      });
    const crs = $("[data-createrole-save]");
    if (crs)
      crs.addEventListener("click", () => {
        const input = $("[data-newrole-input]");
        const name = (input.value || "").trim();
        if (!name) {
          state.errors.newRole = "Role name is required!";
          render();
          return;
        }
        const id = "sr-" + name.toLowerCase().replace(/\s+/g, "-");
        if (!state.subRoles.some((r) => r._id === id)) {
          state.subRoles.push({ _id: id, name });
        }
        state.form.subRoleId = id;
        state.createRoleOpen = false;
        delete state.errors.newRole;
        render();
      });
  }

  /* ── Boot ─────────────────────────────────────────────────────────────── */
  async function mount(opts) {
    opts = opts || {};
    const seed = await window.MockShell.loadSeed(
      opts.seedPath || "../seed-data/seed.json"
    );
    state.seed = seed;
    state.subRoles = JSON.parse(JSON.stringify(seed.subRoles || []));

    let staff = JSON.parse(JSON.stringify(seed.staff || []));
    if (opts.dataset === "paged") {
      staff = staff.concat(JSON.parse(JSON.stringify(seed.pagedStaffExtra || [])));
    } else if (opts.dataset === "empty") {
      staff = [];
    }
    state.staff = staff;

    const menu = (seed.storefrontMenus || []).find(
      (m) => m.component === "our-staff"
    );
    state.label = (menu && menu.name) || "Our-staff";
    state.loading = !!opts.loading;

    outlet = window.MockShell.renderShell(document.getElementById("root"), seed, {
      activePath: "/our-staff",
      pageTitle: state.label,
    });

    render();

    // Initial overlay state, so each screen is standalone-openable at that state.
    if (opts.initial === "add") openDrawer(null);
    if (opts.initial === "edit") openDrawer(opts.editId || state.staff[0]._id);
    if (opts.initial === "delete") {
      state.deleteTarget = state.staff.find((s) => s._id === (opts.deleteId || state.staff[0]._id));
      render();
    }
  }

  window.MockStaff = { mount };
})();
