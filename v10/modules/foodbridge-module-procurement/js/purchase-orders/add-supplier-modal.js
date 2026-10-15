/*
  AddSupplierModal: "Register Supplier", the create drawer's inline supplier form (a CustomModal,
  size xl, rendered inside the drawer). The drawer opens it with the type fixed to EXTERNAL, so the
  type toggle stays hidden; the host's own copy (components/SourcingOrders/AddSupplierModal), which
  "Create Raw Material Requests" opens at z-index 110, leaves the type open: External Supplier or
  Company Department (department, head and head's phone). Tax (GST type + number, or UDIN when exempt), details, address with a
  react-select State picker (menu portalled to <body>, fixed), and an optional opening balance.

  The State options are the host's taxConfig.taxStateCodeList; GST verification is the host's.
*/
import { esc } from '../components/dom.js';
import { customModal } from '../components/modal.js';
import { buttonClass, inputClass, THEME } from '../components/windmill.js';
import { ARIA, nextSelectId } from '../components/react-select.js';

const EMPTY = () => ({ name: '', contact: '', email: '', supplierCode: '', gstType: 'regular', gstNumber: '', address: '', state: { code: '', name: '' }, postNumber: '', departmentName: '', departmentHeadName: '', openingBalanceType: '', openingBalanceAmount: '' });
const NO_ERRORS = () => ({ name: '', contact: '', email: '', supplierCode: '', gstType: '', gstNumber: '', address: '', state: '', postNumber: '', departmentName: '', departmentHeadName: '' });
const ARROW = '<svg height="20" width="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false" class="css-tj5bde-Svg"><path d="M4.516 7.548c0.436-0.446 1.043-0.481 1.576 0l3.908 3.747 3.908-3.747c0.533-0.481 1.141-0.446 1.574 0 0.436 0.445 0.408 1.197 0 1.615-0.406 0.418-4.695 4.502-4.695 4.502-0.217 0.223-0.502 0.335-0.787 0.335s-0.57-0.112-0.789-0.335c0 0-4.287-4.084-4.695-4.502s-0.436-1.17 0-1.615z"></path></svg>';
const SPIN = '<svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>';

export function createAddSupplierModal(host, { rerender, onSave, zIndex = null, defaultSupplierType = 'EXTERNAL' }) {
  const stateOptions = (host.appProp.taxConfig?.taxStateCodeList || []).map((s) => ({ value: s.code, label: s.name }));
  let m = null;
  let portal = null;

  function open() {
    m = { supplierType: defaultSupplierType ?? 'EXTERNAL', form: EMPTY(), errors: NO_ERRORS(), syncing: false, rsId: nextSelectId(), rsFocused: false, rsOpen: false, rsInput: '', rsFocus: 0, rsSelected: false };
  }
  function close() { m = null; removePortal(); }
  const isOpen = () => Boolean(m);
  const set = (field, value) => { m.form = { ...m.form, [field]: value }; m.errors = { ...m.errors, [field]: '' }; };

  function validate() {
    const f = m.form;
    const e = NO_ERRORS();
    let ok = true;
    if (m.supplierType === 'DEPARTMENT') {
      if (!f.departmentName.trim()) { e.departmentName = 'Department name is required'; ok = false; }
      if (!f.departmentHeadName.trim()) { e.departmentHeadName = 'Department head name is required'; ok = false; }
      if (!f.contact.trim()) { e.contact = 'Contact number is required'; ok = false; } else if (!/^\+?[0-9\s-]{6,15}$/.test(f.contact.trim())) { e.contact = 'Enter a valid phone number'; ok = false; }
      m.errors = e;
      return ok;
    }
    if (!f.name.trim()) { e.name = 'Supplier name is required'; ok = false; }
    if (!f.contact.trim()) { e.contact = 'Contact number is required'; ok = false; } else if (!/^\+?[0-9\s-]{6,15}$/.test(f.contact.trim())) { e.contact = 'Enter a valid phone number'; ok = false; }
    if (f.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) { e.email = 'Enter a valid email address'; ok = false; }
    if (f.postNumber.trim() && !/^\d{4,6}$/.test(f.postNumber.trim())) { e.postNumber = 'Enter a valid postal code'; ok = false; }
    m.errors = e;
    return ok;
  }
  function save() {
    if (!validate()) return;
    if (m.supplierType === 'DEPARTMENT') {
      onSave({ name: `${m.form.departmentName.trim()} - ${m.form.departmentHeadName.trim()}`, contact: m.form.contact, email: '', supplierCode: '', gstType: '', gstNumber: '', address: '', state: { code: '', name: '' }, postNumber: '', supplierType: 'DEPARTMENT' });
      close();
      return;
    }
    const payload = { ...m.form, supplierType: 'EXTERNAL' };
    delete payload.departmentName; delete payload.departmentHeadName;
    const amount = Number(m.form.openingBalanceAmount) || 0;
    if (m.form.openingBalanceType && amount > 0) { payload.openingBalanceType = m.form.openingBalanceType; payload.openingBalanceAmount = amount; } else { delete payload.openingBalanceType; delete payload.openingBalanceAmount; }
    onSave(payload);
    close();
  }

  // ── Views ──
  const label = (text, cls = 'mb-1') => `<label class="${THEME.label.base} block text-sm font-medium text-gray-700 dark:text-gray-300 ${cls}">${text}</label>`;
  const error = (k) => (m.errors[k] ? `<p class="text-red-500 text-xs mt-1.5">${esc(m.errors[k])}</p>` : '');
  const input = (k, testId, placeholder, width = 'w-full', type = 'text') => `<input class="${inputClass(`${width} rounded-lg border ${m.errors[k] ? 'border-red-400 focus:ring-red-500' : 'border-gray-300 focus:ring-emerald-500'} focus:ring-2 focus:border-transparent`)}" type="${type}" data-testid="${testId}" placeholder="${esc(placeholder)}" value="${esc(m.form[k])}" data-as-field="${k}">`;
  const divider = (text, mb = 'mb-4') => `<div class="flex items-center gap-2 ${mb}"><div class="h-px flex-1 bg-gray-200 dark:bg-gray-700"></div><span class="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">${text}</span><div class="h-px flex-1 bg-gray-200 dark:bg-gray-700"></div></div>`;
  const radio = (field, value, text, testId, shrink = '') => {
    const sel = m.form[field] === value;
    return `<label data-testid="${testId}" data-status="${sel ? 'selected' : 'unselected'}" class="flex items-center gap-2.5 cursor-pointer rounded-lg border px-4 py-2.5 transition-all select-none ${sel ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-400' : 'border-gray-200 bg-white hover:border-gray-300 dark:border-gray-600 dark:bg-gray-800'}" data-as-radio="${field}" data-value="${esc(value)}"><input type="radio" class="hidden" value="${esc(value)}"${sel ? ' checked=""' : ''}><span class="w-4 h-4 rounded-full border-2 ${shrink}flex items-center justify-center transition-all ${sel ? 'border-emerald-500' : 'border-gray-400'}">${sel ? '<span class="w-2 h-2 rounded-full bg-emerald-500"></span>' : ''}</span><span class="text-sm font-medium ${sel ? 'text-emerald-700 dark:text-emerald-300' : 'text-gray-600 dark:text-gray-300'}">${esc(text)}</span></label>`;
  };
  function verify(kind) {
    const empty = !m.form.gstNumber?.trim();
    const tip = m.syncing ? `Verifying ${kind} details...` : empty ? `Enter ${kind} Number to verify` : `Click to verify ${kind} details and auto-fill supplier information`;
    const dis = m.syncing || empty;
    return `<div data-tooltip-id="${kind.toLowerCase()}-verify-tooltip-modal" data-tooltip-content="${esc(tip)}"><button class="${buttonClass({ disabled: dis, cls: 'rounded-lg h-10 flex items-center gap-1.5 px-4 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200' })}"${dis ? ' disabled=""' : ''} type="button" data-testid="add-supplier-verify-${kind.toLowerCase()}-btn" data-as-act="verify">${m.syncing ? SPIN : ''}${m.syncing ? 'Verifying' : 'Verify'}</button></div>`;
  }
  function stateSelect() {
    const id = m.rsId;
    const value = stateOptions.find((o) => o.value === m.form.state?.code) || null;
    const focused = m.rsFocused;
    const shown = options();
    const live = !focused ? '' : m.rsOpen
      ? `<span id="aria-selection"></span><span id="aria-focused">${esc(shown[m.rsFocus] ? ARIA.focused(shown[m.rsFocus].label, m.rsFocus, shown.length) : '')}</span><span id="aria-results">${esc(ARIA.results(shown.length))}</span><span id="aria-guidance">${esc(ARIA.guidanceMenu)}</span>`
      : `<span id="aria-selection">${m.rsSelected && value ? esc(ARIA.selected(value.label)) : ''}</span><span id="aria-focused"></span><span id="aria-results"></span><span id="aria-guidance"></span>`;
    return `<div class="w-full css-b62m3t-container" data-as-select>`
      + `<span id="react-select-${id}-live-region" class="css-1f43avz-a11yText-A11yText"></span><span aria-live="polite" aria-atomic="false" aria-relevant="additions text" role="log" class="css-1f43avz-a11yText-A11yText">${live}</span>`
      + `<div class="${focused ? 'css-11xeerq-control' : 'css-g8wia4-control'}" data-as-control><div class="css-hlgwow">`
      + (value && !m.rsInput ? `<div class="css-1dimb5e-singleValue">${esc(value.label)}</div>` : !m.rsInput ? `<div class="css-1jqq78o-placeholder" id="react-select-${id}-placeholder">Select State</div>` : '')
      + `<div class="css-19bb58m" data-value="${esc(m.rsInput)}"><input class="" autocapitalize="none" autocomplete="off" autocorrect="off" id="add-supplier-state-input" spellcheck="false" tabindex="0" type="text" aria-autocomplete="list" aria-expanded="${m.rsOpen}" aria-haspopup="true" role="combobox"${value ? '' : ` aria-describedby="react-select-${id}-placeholder"`} value="${esc(m.rsInput)}" style="color: inherit; background: 0px center; opacity: ${value && focused && !m.rsOpen && !m.rsInput ? 0 : 1}; width: 100%; grid-area: 1 / 2; font: inherit; min-width: 2px; border: 0px; margin: 0px; outline: 0px; padding: 0px;"${m.rsOpen ? ` aria-controls="react-select-${id}-listbox"` : ''} data-as-rs-input></div></div>`
      + `<div class="css-1wy0on6"><span class="css-1u9des2-indicatorSeparator"></span><div class="${focused ? 'css-15lsz6c-indicatorContainer' : 'css-1xc3v61-indicatorContainer'}" aria-hidden="true">${ARROW}</div></div></div>`
      + `<input name="state" type="hidden" value="${esc(m.form.state?.code || '')}"></div>`;
  }
  const options = () => stateOptions.filter((o) => o.label.toLowerCase().includes(m.rsInput.toLowerCase()));

  const TYPE_ICONS = {
    EXTERNAL: '<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 21v-7.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349M3.75 21V9.349m0 0a3.001 3.001 0 0 0 3.75-.615A2.993 2.993 0 0 0 9.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 0 0 2.25 1.016c.896 0 1.7-.393 2.25-1.015a3.001 3.001 0 0 0 3.75.614m-16.5 0a3.004 3.004 0 0 1-.621-4.72l1.189-1.19A1.5 1.5 0 0 1 5.378 3h13.243a1.5 1.5 0 0 1 1.06.44l1.19 1.189a3 3 0 0 1-.621 4.72M6.75 18h3.75a.75.75 0 0 0 .75-.75V13.5a.75.75 0 0 0-.75-.75H6.75a.75.75 0 0 0-.75.75v3.75c0 .414.336.75.75.75Z"></path></svg>',
    DEPARTMENT: '<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21"></path></svg>',
  };
  function typeToggle() {
    if (defaultSupplierType) return '';
    const option = (key, text) => {
      const active = m.supplierType === key;
      return `<button type="button" data-testid="add-supplier-type-${key.toLowerCase()}-btn" data-status="${active ? 'selected' : 'unselected'}" class="relative overflow-hidden flex items-center gap-3 rounded-lg border-2 px-4 py-3 text-left transition-all ${active ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-400' : 'border-gray-200 bg-white hover:border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:hover:border-gray-500'}" data-as-type="${key}">`
        + `<span class="flex-shrink-0 ${active ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-gray-500'}">${TYPE_ICONS[key]}</span><span class="text-sm font-medium ${active ? 'text-emerald-700 dark:text-emerald-300' : 'text-gray-700 dark:text-gray-300'}">${text}</span>`
        + (active ? '<svg class="w-4 h-4 text-emerald-500 dark:text-emerald-400 ml-auto flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clip-rule="evenodd"></path></svg>' : '')
        + '</button>';
    };
    return `<div class="mb-6"><label class="${THEME.label.base} block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">Supplier Type</label><div class="grid grid-cols-2 gap-3">${option('EXTERNAL', 'External Supplier')}${option('DEPARTMENT', 'Company Department')}</div></div>`;
  }
  function departmentForm() {
    return '<div class="space-y-5">' + divider('Department Details', 'mb-1')
      + `<div>${label('Department Name <span class="text-red-500">*</span>')}${input('departmentName', 'add-supplier-department-name-input', 'e.g. Procurement, Kitchen, Warehouse')}${error('departmentName')}</div>`
      + '<div class="grid grid-cols-1 md:grid-cols-2 gap-4">'
      + `<div>${label('Department Head Name <span class="text-red-500">*</span>')}${input('departmentHeadName', 'add-supplier-department-head-name-input', 'Full name of the department head')}${error('departmentHeadName')}</div>`
      + `<div>${label('Department Head Phone <span class="text-red-500">*</span>')}${input('contact', 'add-supplier-department-head-phone-input', 'e.g. 9876543210')}${error('contact')}</div>`
      + '</div></div>';
  }
  function render() {
    if (!m) return '<!--add-supplier-->';
    const f = m.form;
    const body = m.supplierType === 'DEPARTMENT' ? departmentForm() : '<div class="space-y-5"><div>' + divider('Tax Information') + '<div class="space-y-4"><div>'
      + label('GST Type', 'mb-2') + `<div class="flex items-center gap-4">${radio('gstType', 'regular', host.toTitleCase('regular'), 'add-supplier-gst-type-regular-radio')}${radio('gstType', 'exempt', host.toTitleCase('exempt'), 'add-supplier-gst-type-exempt-radio')}</div>${error('gstType')}</div>`
      + (f.gstType === 'regular' ? `<div>${label('GST Number')}<div class="flex items-center gap-2">${input('gstNumber', 'add-supplier-gst-number-input', 'e.g. 22AAAAA0000A1Z5', 'flex-1')}${verify('GST')}</div>${error('gstNumber')}</div>` : '')
      + (f.gstType === 'exempt' ? `<div>${label('UDIN Number')}<div class="flex items-center gap-2">${input('gstNumber', 'add-supplier-udin-number-input', 'Enter UDIN Number', 'flex-1')}${verify('UDIN')}</div>${error('gstNumber')}</div>` : '')
      + '</div></div>'
      + '<div>' + divider('Supplier Details') + '<div class="space-y-4"><div class="grid grid-cols-1 md:grid-cols-2 gap-4">'
      + `<div>${label('Supplier Name <span class="text-red-500">*</span>')}${input('name', 'add-supplier-name-input', 'Enter supplier name')}${error('name')}</div>`
      + `<div>${label('Phone <span class="text-red-500">*</span>')}${input('contact', 'add-supplier-phone-input', 'e.g. 9876543210')}${error('contact')}</div></div>`
      + '<div class="grid grid-cols-1 md:grid-cols-2 gap-4">'
      + `<div>${label('Email')}${input('email', 'add-supplier-email-input', 'supplier@example.com')}${error('email')}</div>`
      + `<div>${label('Supplier Code')}${input('supplierCode', 'add-supplier-code-input', 'e.g. SUP-001')}${error('supplierCode')}</div></div></div></div>`
      + '<div>' + divider('Address') + '<div class="space-y-4">'
      + `<div>${label('Street Address')}${input('address', 'add-supplier-address-input', 'Building, street, locality')}${error('address')}</div>`
      + `<div class="grid grid-cols-1 md:grid-cols-2 gap-4"><div>${label('State')}${stateSelect()}${error('state')}</div><div>${label('Pin Code')}${input('postNumber', 'add-supplier-pincode-input', 'e.g. 411001')}${error('postNumber')}</div></div></div></div>`
      + '<div>' + divider('Opening Balance') + '<p class="text-xs text-gray-500 dark:text-gray-400 mb-3">Bring in any existing balance with this supplier from before they were added here — optional.</p><div class="space-y-2 mb-3">'
      + radio('openingBalanceType', 'PAYABLE', 'I owe this supplier', 'add-supplier-opening-balance-payable-radio', 'flex-shrink-0 ')
      + radio('openingBalanceType', 'ADVANCE', 'I’ve already paid this supplier in advance'.replace('’', "'"), 'add-supplier-opening-balance-advance-radio', 'flex-shrink-0 ')
      + (f.openingBalanceType ? '<button type="button" data-testid="add-supplier-clear-opening-balance-btn" class="text-xs text-gray-400 hover:text-gray-600 underline" data-as-act="clear-opening">Clear — no opening balance</button>' : '')
      + '</div>'
      + (f.openingBalanceType ? `<div>${label('Amount')}<input class="${inputClass('w-full rounded-lg border border-gray-300 focus:ring-emerald-500 focus:ring-2 focus:border-transparent')}" type="number" data-testid="add-supplier-opening-balance-amount-input" placeholder="e.g. 1000" value="${esc(f.openingBalanceAmount)}" data-as-field="openingBalanceAmount"></div>` : '')
      + '</div></div>';
    const content = '<div class="overflow-hidden flex flex-col h-full"><div class="px-6 pt-2 pb-4 border-b border-gray-100 dark:border-gray-700"><h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Register Supplier</h3><p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Choose the supplier type and fill in the required details</p></div>'
      + `<div class="flex-1 overflow-y-auto px-6 py-5 min-h-[450px]">${typeToggle()}${body}</div>`
      + '<div class="flex-shrink-0 flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">'
      + `<button class="${buttonClass({ layout: 'outline', cls: 'px-5 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap' })}" type="button" data-testid="add-supplier-cancel-btn" data-as-act="cancel">Cancel</button>`
      + `<button class="${buttonClass({ cls: 'px-5 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-sm' })}" type="button" data-testid="add-supplier-save-btn" data-as-act="save">Save Supplier</button></div></div>`;
    return customModal({ size: 'xl', testId: 'add-supplier', closeAct: 'as-close', content, ...(zIndex ? { zIndex } : {}) });
  }

  /** The State menu, portalled to <body> at the control's bottom edge (menuPosition fixed). */
  function afterRender(root) {
    if (!m || !m.rsOpen) { removePortal(); return; }
    const control = root.querySelector('[data-as-control]');
    if (!control) return;
    const r = control.getBoundingClientRect();
    const shown = options();
    const html = `<div class="css-inl1nc" style="left: ${r.left}px; position: fixed; top: ${r.bottom}px; width: ${r.width}px; z-index: 9999; box-sizing: border-box;"><div class="css-1nmdiq5-menu"><div class="css-19lsapp" role="listbox" aria-multiselectable="false" id="react-select-${m.rsId}-listbox">`
      + (shown.length ? shown.map((o, i) => `<div class="${i === m.rsFocus ? 'css-d7l1ni-option' : 'css-10wo9uf-option'}" aria-disabled="false" id="react-select-${m.rsId}-option-${i}" tabindex="-1" role="option" data-as-option="${esc(o.value)}">${esc(o.label)}</div>`).join('')
        : '<div class="css-1cbm1rq-NoOptionsMessage">No options</div>')
      + '</div></div></div>';
    if (!portal) { portal = document.createElement('div'); document.body.appendChild(portal); portal.addEventListener('mousedown', onPortalDown); }
    portal.innerHTML = html;
  }
  function removePortal() { portal?.remove(); portal = null; }
  function onPortalDown(e) {
    e.preventDefault();
    const opt = e.target.closest('[data-as-option]');
    if (!opt || !m) return;
    const o = stateOptions.find((x) => x.value === opt.dataset.asOption);
    set('state', { code: o.value, name: o.label });
    m.rsOpen = false; m.rsInput = ''; m.rsSelected = true;
    rerender();
  }

  // ── Events (routed from the drawer) ──
  function handleClick(e) {
    if (!m) return false;
    const act = e.target.closest('[data-as-act],[data-act="as-close"]');
    if (act) {
      const a = act.dataset.asAct || 'close';
      if (a === 'cancel' || a === 'close') { close(); rerender(); return true; }
      if (a === 'save') { save(); rerender(); return true; }
      if (a === 'clear-opening') { set('openingBalanceType', ''); set('openingBalanceAmount', ''); rerender(); return true; }
      if (a === 'verify') { verifyGst(); return true; }
    }
    const t = e.target.closest('[data-as-type]');
    if (t) { m.supplierType = t.dataset.asType; rerender(); return true; }
    const r = e.target.closest('[data-as-radio]');
    if (r) { set(r.dataset.asRadio, r.dataset.value); rerender(); return true; }
    return Boolean(e.target.closest('[data-testid="add-supplier-modal"]'));
  }
  function handleMouseDown(e) {
    if (!m) return false;
    const control = e.target.closest('[data-as-control]');
    if (control) {
      e.preventDefault();
      m.rsFocused = true; m.rsOpen = !m.rsOpen; m.rsFocus = Math.max(0, options().findIndex((o) => o.value === m.form.state?.code));
      rerender();
      document.getElementById('add-supplier-state-input')?.focus();
      return true;
    }
    return false;
  }
  function handleInput(e) {
    if (!m) return false;
    const el = e.target;
    if (el.matches('[data-as-field]')) { set(el.dataset.asField, el.value); rerender(); return true; }
    if (el.matches('[data-as-rs-input]')) { m.rsInput = el.value; m.rsOpen = true; m.rsFocus = 0; rerender(); return true; }
    return false;
  }
  function handleFocusOut(e) {
    if (!m || !e.target.matches('[data-as-rs-input]')) return;
    m.rsFocused = false; m.rsOpen = false; m.rsInput = ''; m.rsSelected = false; rerender();
  }
  function handleKeydown(e) {
    if (!m || !e.target.matches('[data-as-rs-input]')) return false;
    const shown = options();
    if (e.key === 'ArrowDown') { e.preventDefault(); if (!m.rsOpen) m.rsOpen = true; else m.rsFocus = Math.min(shown.length - 1, m.rsFocus + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); m.rsFocus = Math.max(0, m.rsFocus - 1); }
    else if (e.key === 'Escape') { m.rsOpen = false; m.rsInput = ''; e.stopPropagation(); }
    else if (e.key === 'Enter' && m.rsOpen && shown[m.rsFocus]) { e.preventDefault(); set('state', { code: shown[m.rsFocus].value, name: shown[m.rsFocus].label }); m.rsOpen = false; m.rsInput = ''; m.rsSelected = true; }
    else return false;
    rerender();
    return true;
  }
  /** handleGSTSync: the host's GST lookup, mapped (name, address, postalCode, stateName). */
  async function verifyGst() {
    if (!m.form.gstNumber) { host.notify('error', 'Please enter a GST number'); return; }
    try {
      m.syncing = true; rerender();
      const info = await host.verifyGst?.(m.form.gstNumber);
      if (!m) return;
      if (!info) { host.notify('error', 'Failed to fetch GST details'); return; }
      const st = stateOptions.find((s) => s.label?.toLowerCase() === String(info.stateName ?? '').toLowerCase());
      m.form = { ...m.form, name: info.name || '', address: info.address || '', postNumber: info.postalCode || '', ...(st ? { state: { code: st.value, name: st.label } } : {}) };
      host.notify('success', 'GST details synced successfully');
    } catch (err) {
      host.notify('error', err?.response?.data?.data?.isAlreadyExists ? 'This GST number is already registered with another account.' : 'Failed to fetch GST details. Please verify the GST number.');
    } finally {
      if (m) { m.syncing = false; rerender(); }
    }
  }

  return { open, close, isOpen, render, afterRender, handleClick, handleMouseDown, handleInput, handleFocusOut, handleKeydown };
}
