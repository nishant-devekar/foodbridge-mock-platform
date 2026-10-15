/*
  Follow-up Reminders — customers who placed no order in a window, to call, remind or order for.

  The product's OrderReminderModal: search (debounced 350ms), window (Today / Yesterday / This Week)
  and catalogue filters; rows with copy-phone, Create Order, a WhatsApp reminder bell and details;
  selection with "Follow-up Done" (remembered per window in this browser). Its hover hints are
  react-tooltip's plain default.
*/
import { lucide } from '../components/icons.js';
import { esc } from '../components/dom.js';
import { refreshTooltip, hideTooltip } from '../components/tooltip.js';
import { toTitleCase } from './model.js';

const WINDOWS = [{ value: 'today', label: 'Today' }, { value: 'yesterday', label: 'Yesterday' }, { value: 'thisWeek', label: 'This Week' }];
const DONE_KEY = 'orderReminder_followUpCompleted';
const readDone = () => { try { return JSON.parse(localStorage.getItem(DONE_KEY) || '{}'); } catch { return {}; } };
const tip = (text, place) => ` data-tooltip="${esc(text)}" data-tooltip-plain${place ? ` data-tooltip-place="${place}"` : ''}`;
const SELECT_CLS = 'w-full pl-3 pr-10 h-[38px] text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 appearance-none cursor-pointer transition-all duration-150';

function row(m, r, c) {
  const id = c.id;
  const name = esc(toTitleCase(c.name));
  const cat = esc(toTitleCase(m.catalogueOf(c).name));
  const open = r.expanded.includes(id);
  const on = r.selected.includes(id);
  const box = (testid, tipId) => `<button data-act="rem-select" data-id="${id}" data-testid="${testid}" class="flex-shrink-0 p-0.5 transition-colors"${tip(on ? 'Deselect customer' : 'Select customer')}>${on ? lucide('square-check-big', { cls: 'w-4 h-4 text-emerald-600 dark:text-emerald-400' }) : lucide('square', { cls: 'w-4 h-4 text-gray-400 hover:text-emerald-500 dark:text-gray-500' })}</button>`;
  const more = c.email || c.address;
  const chevronTip = open ? 'Hide details' : more ? 'Show email and address' : 'No additional details';
  const chevron = (testid, extra = '') => `<button data-act="rem-expand" data-id="${id}" data-testid="${testid}" class="p-1.5 rounded-lg transition-colors flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 flex-shrink-0"${extra}${tip(chevronTip)}>${lucide('chevron-down', { cls: `w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform ${open ? 'rotate-180' : ''}` })}</button>`;
  const L = esc(m.label);
  const desktop = `<div class="hidden sm:flex items-center gap-3">${box(`order-reminder-checkbox-${id}`)}
    <div class="w-9 h-9 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center flex-shrink-0">${lucide('user', { cls: 'w-4 h-4 text-gray-600 dark:text-gray-400' })}</div>
    <span class="text-sm font-semibold text-gray-900 dark:text-white truncate flex-1 min-w-0"${tip(toTitleCase(c.name))}>${name}</span>
    <div class="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 flex-shrink-0">${c.phone ? `${lucide('phone', { cls: 'w-3.5 h-3.5 text-emerald-600 dark:text-emerald-500' })}<span class="font-medium whitespace-nowrap">${esc(c.phone)}</span><button data-act="rem-copy" data-phone="${esc(c.phone)}" data-testid="order-reminder-copy-phone-btn-${id}" class="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"${tip('Copy phone number')}>${lucide('copy', { cls: 'w-3 h-3' })}</button>` : '<span class="text-gray-400">—</span>'}</div>
    <span class="inline-flex items-center px-2 py-0.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 text-xs rounded font-medium flex-shrink-0 max-w-[130px]"${tip(`Catalogue: ${toTitleCase(m.catalogueOf(c).name)}`)}><span class="truncate">${cat}</span></span>
    <button data-act="rem-create" data-id="${id}" data-testid="order-reminder-create-order-btn-${id}" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg transition-colors whitespace-nowrap flex-shrink-0"${tip(`Create ${m.label.toLowerCase()} for this customer`)}>Create <!---->${L}</button>
    <button data-act="rem-remind" data-id="${id}" data-testid="order-reminder-remind-btn-${id}" class="p-2 border !border-amber-200 hover:!bg-amber-50 rounded-md bg-amber-50 text-amber-700 flex-shrink-0"${tip(`Send a reminder to create ${m.label.toLowerCase()}`)}>${lucide('bell', { cls: 'w-4 h-4' })}</button>
    ${chevron(`order-reminder-expand-btn-${id}`)}</div>`;
  // The phone's "+ Sales Orders" names a tooltip no Tooltip renders, so it shows none — as in production.
  const mobile = `<div class="sm:hidden"><div class="flex items-center gap-2">${box(`order-reminder-checkbox-mobile-${id}`)}
      <div class="w-9 h-9 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center flex-shrink-0"${tip('Customer')}>${lucide('user', { cls: 'w-4 h-4 text-gray-600 dark:text-gray-400' })}</div>
      <div class="flex-1 min-w-0 flex flex-wrap items-center gap-x-1.5 gap-y-0.5"><span class="text-sm font-semibold text-gray-900 dark:text-white truncate shrink"${tip(toTitleCase(c.name))}>${name}</span><span class="inline-flex items-center px-2 py-0.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 text-xs rounded font-medium shrink-0 max-w-[100px]"${tip(`Catalogue: ${toTitleCase(m.catalogueOf(c).name)}`)}><span class="truncate">${cat}</span></span></div>
      ${chevron(`order-reminder-expand-btn-mobile-${id}`, ` title="${open ? 'Hide details' : 'Show details'}"`)}</div>
    <div class="flex items-center gap-2 mt-2 pl-[52px]"><div class="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 flex-shrink-0">${c.phone ? `${lucide('phone', { cls: 'w-3.5 h-3.5 flex-shrink-0 text-emerald-600 dark:text-emerald-500' }).replace('<svg ', `<svg${tip('Call this customer')} `)}<span class="font-medium whitespace-nowrap"${tip(c.phone)}>${esc(c.phone)}</span><button data-act="rem-copy" data-phone="${esc(c.phone)}" data-testid="order-reminder-copy-phone-btn-mobile-${id}" class="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors flex-shrink-0"${tip('Copy phone number')}>${lucide('copy', { cls: 'w-3 h-3' })}</button>` : '<span class="text-xs text-gray-400">—</span>'}</div>
      <div class="flex items-center gap-2 ml-auto flex-shrink-0"><button data-act="rem-remind" data-id="${id}" data-testid="order-reminder-remind-btn-mobile-${id}" class="inline-flex items-center gap-1 px-2.5 py-1.5 border !border-amber-200 hover:!bg-amber-50 rounded-md text-xs font-medium bg-amber-50 text-amber-700 flex-shrink-0"${tip(`Send a reminder to create ${m.label.toLowerCase()}`)}>${lucide('bell', { cls: 'w-3.5 h-3.5' })}<span class="hidden">Remind</span></button><button data-act="rem-create" data-id="${id}" data-testid="order-reminder-create-order-btn-mobile-${id}" class="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white text-xs font-medium rounded-lg transition-colors whitespace-nowrap">+ <!---->${L}</button></div></div></div>`;
  const details = open ? `<div class="px-3 pb-2.5 pt-2 border-t border-gray-200 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-800/30"><div class="space-y-2 ml-9.5">${more
    ? `${c.email ? `<div class="flex items-start gap-2">${lucide('mail', { cls: 'w-3.5 h-3.5 text-gray-400 dark:text-gray-500 flex-shrink-0 mt-0.5' })}<div class="flex-1 min-w-0"><p class="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Email</p><p class="text-sm text-gray-700 dark:text-gray-300 truncate" title="${esc(c.email)}">${esc(c.email)}</p></div></div>` : ''}${c.address ? `<div class="flex items-start gap-2">${lucide('map-pin', { cls: 'w-3.5 h-3.5 text-gray-400 dark:text-gray-500 flex-shrink-0 mt-0.5' })}<div class="flex-1 min-w-0"><p class="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Address</p><p class="text-sm text-gray-700 dark:text-gray-300 break-words leading-relaxed">${esc(c.address)}</p></div></div>` : ''}`
    : `<div class="flex items-center gap-2 py-1">${lucide('circle-alert', { cls: 'w-3.5 h-3.5 text-gray-400 dark:text-gray-500 flex-shrink-0' })}<p class="text-xs text-gray-500 dark:text-gray-400 italic">Additional details not available</p></div>`}</div></div>` : '';
  return `<div data-testid="order-reminder-row-${id}" data-status="${on ? 'selected' : 'unselected'}" class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-emerald-500 dark:hover:border-emerald-500 transition-all shadow-sm"><div class="px-3 py-2.5">${desktop}${mobile}</div>${details}</div>`;
}

export function renderReminders(m, r) {
  const L = esc(m.label);
  const win = WINDOWS.find((w) => w.value === r.window).label;
  const done = readDone()[r.window] || {};
  const { customers, total } = m.followUp({ window: r.window, search: r.searchApplied, catalogue: r.catalogue, now: r.now });
  const shown = customers.filter((c) => !done[c.id]);
  const filtering = r.searchApplied !== '' || r.catalogue !== 'all';
  const empty = !shown.length
    ? `<div data-testid="order-reminder-list-empty" class="flex flex-col items-center justify-center py-12"><div class="w-16 h-16 bg-gradient-to-br from-green-100 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/10 rounded-full flex items-center justify-center mb-4">${!filtering && total === 0 ? '<svg class="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>' : lucide('search', { cls: 'w-8 h-8 text-gray-400' })}</div><h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">${!filtering && total === 0 ? 'Excellent! All Customers Are Active' : 'No Customers Found'}</h3><p class="text-sm text-gray-500 dark:text-gray-400 text-center max-w-md">${!filtering && total === 0 ? `All your customers have placed ${L.toLowerCase()} for ${win.toLowerCase()}. Great job maintaining customer engagement!` : 'Try adjusting your search or filter criteria to find customers.'}</p></div>`
    : '';
  const list = shown.length ? `<div class="space-y-2">${shown.map((c) => row(m, r, c)).join('')}</div>` : empty;
  const n = r.selected.length;
  const bar = n ? `<div class="px-6 py-2.5 border-t border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-between flex-wrap gap-2 flex-shrink-0"><p class="text-sm text-emerald-800 dark:text-emerald-300 font-medium">${n}<!----> <!---->${n === 1 ? 'customer' : 'customers'}<!----> selected</p><div class="flex items-center gap-2"><button data-act="rem-clear-selection" data-testid="order-reminder-clear-selection-btn" class="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"${tip('Deselect all customers')}>Clear</button><button data-act="rem-done" data-testid="order-reminder-mark-done-btn" class="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm"${tip("Mark selected customers as followed up — they won't appear in this list again for the selected period")}>${lucide('square-check-big', { cls: 'w-3.5 h-3.5' })}Follow-up Done</button></div></div>` : '';
  const footerInfo = shown.length ? `<p class="text-sm text-gray-700 dark:text-gray-300"><span class="font-bold text-emerald-600 dark:text-emerald-400">${total}</span> <span class="font-medium">${total === 1 ? 'customer' : 'customers'}<!----> <!---->to follow up</span></p><div class="h-4 w-px bg-gray-300 dark:bg-gray-600"></div><p class="text-xs text-gray-600 dark:text-gray-400"${tip('A quick call can help convert these customers into orders')}><span class="font-medium">Tip:</span> Call them to convert into orders</p>` : '';
  return `<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"><div data-testid="order-reminder-modal" class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col mx-4">
    <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-shrink-0"><div class="flex items-center gap-3 flex-1"><div class="w-10 h-10 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg flex items-center justify-center flex-shrink-0">${lucide('circle-alert', { cls: 'w-5 h-5 text-emerald-600 dark:text-emerald-400' })}</div><div class="flex-1 min-w-0"><h2 class="text-lg font-bold text-gray-900 dark:text-white">Follow-up Customers Without <!---->${L}<!----> <!---->${win}</h2><p class="text-xs text-gray-600 dark:text-gray-400 mt-1">These customers haven't placed <!---->${L.toLowerCase()}<!----> in the selected timeframe. Call them to convert into sales.</p></div></div>
      <button data-act="rem-close" data-testid="order-reminder-modal-close-btn" class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex-shrink-0 ml-4"${tip('Close reminder modal', 'left')}>${lucide('x', { cls: 'w-5 h-5 text-gray-500' })}</button></div>
    <div class="px-6 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex-shrink-0"><div class="grid grid-cols-1 lg:grid-cols-3 gap-3">
      <div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"${tip('Search by customer name, phone, email, or catalogue')}>Search Customers</label><div class="relative"><input type="text" data-rem-search data-testid="order-reminder-search-input" placeholder="Search by name, phone, email..." value="${esc(r.search)}" class="w-full pl-3 pr-10 h-[38px] text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all duration-150"${tip('Type to search by customer name, phone, email, or catalogue')}>${r.search ? `<button type="button" data-act="rem-search-clear" data-testid="order-reminder-search-clear-btn" class="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 dark:hover:text-gray-200 transition-colors" aria-label="Clear search">${lucide('x', { cls: 'w-4 h-4' })}</button>` : lucide('search', { cls: 'absolute right-1 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none' })}</div></div>
      <div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"${tip('Select timeframe to check for orders')}>No <!---->${L}<!----> Since</label><div class="relative"><select data-rem-window data-testid="order-reminder-time-filter-select" class="${SELECT_CLS}"${tip('Filter customers by time period without orders')}>${WINDOWS.map((w) => `<option value="${w.value}"${w.value === r.window ? ' selected' : ''}>${w.label}</option>`).join('')}</select>${lucide('chevron-down', { cls: 'absolute right-1 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none' })}</div> </div>
      <div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"${tip('Filter by specific customer catalogue')}>Filter by Catalogue</label><div class="relative"><select data-rem-catalogue data-testid="order-reminder-catalogue-filter-select" class="${SELECT_CLS}"${tip('Show customers from a specific catalogue only')}><option value="all">All Catalogues</option>${m.catalogues.map((k) => `<option value="${k.id}"${k.id === r.catalogue ? ' selected' : ''}>${esc(toTitleCase(k.name))}</option>`).join('')}</select>${lucide('chevron-down', { cls: 'absolute right-1 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none' })}</div></div>
    </div>${r.search || r.catalogue !== 'all' ? `<div class="mt-2 flex items-center justify-between"><div class="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">${lucide('filter', { cls: 'w-3.5 h-3.5' })}<span>Showing <!---->${shown.length}<!----> of <!---->${total}<!----> <!---->customers</span></div><button data-act="rem-reset" data-testid="order-reminder-clear-filters-btn" class="text-xs text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 font-medium"${tip('Clear all active filters')}>Clear filters</button></div>` : ''}</div>
    <div data-rem-scroll class="flex-1 overflow-y-auto px-6 py-4">${list}</div>${bar}
    <div class="px-6 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-between flex-wrap gap-2 flex-shrink-0"><div class="flex items-center gap-4">${footerInfo}</div><button data-act="rem-close" data-testid="order-reminder-modal-footer-close-btn" class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"${tip('Close this modal')}>Close</button></div>
  </div></div>`;
}

/**
 * The modal's state and interactions. `host` is the screen's modal region; `onCreate(customerId)`
 * hands a customer to the Create drawer; reminders go through the prototype's "server" (recorded,
 * never sent).
 */
export function reminderFlow({ model: m, host, toast, now, onCreate }) {
  let r = null;
  let timer = null;
  function render() {
    const scroll = host.querySelector('[data-rem-scroll]')?.scrollTop || 0;
    // The control that had focus keeps it (React keeps its element), caret included.
    const active = host.contains(document.activeElement) ? document.activeElement : null;
    const key = active?.dataset?.testid;
    const caret = active?.matches?.('[data-rem-search]') ? [active.selectionStart, active.selectionEnd] : null;
    hideTooltip();
    host.innerHTML = r ? renderReminders(m, { ...r, now: now() }) : '';
    if (!r) return;
    const sc = host.querySelector('[data-rem-scroll]');
    if (sc) sc.scrollTop = scroll;
    const el = key && host.querySelector(`[data-testid="${key}"]`);
    if (el) { el.focus({ preventScroll: true }); if (caret) el.setSelectionRange(...caret); }
    refreshTooltip();
  }
  const set = (patch) => { Object.assign(r, patch); render(); };
  const toggle = (list, id) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  const handlers = {
    'rem-close': () => { r = null; render(); },
    'rem-expand': (e, el) => { e.stopPropagation(); set({ expanded: toggle(r.expanded, el.dataset.id) }); },
    'rem-select': (e, el) => { e.stopPropagation(); set({ selected: toggle(r.selected, el.dataset.id) }); },
    'rem-clear-selection': () => set({ selected: [] }),
    'rem-done': () => {
      const done = readDone();
      done[r.window] = { ...(done[r.window] || {}) };
      for (const id of r.selected) done[r.window][id] = true;
      try { localStorage.setItem(DONE_KEY, JSON.stringify(done)); } catch { /* private mode */ }
      set({ selected: [] });
    },
    'rem-copy': (e, el) => { e.stopPropagation(); navigator.clipboard?.writeText(el.dataset.phone).catch(() => {}); },
    'rem-remind': (e) => { e.stopPropagation(); setTimeout(() => toast('Reminder sent successfully!'), 150); },
    'rem-create': (_e, el) => { const id = el.dataset.id; r = null; render(); onCreate(id); },
    'rem-search-clear': () => { clearTimeout(timer); set({ search: '', searchApplied: '' }); },
    'rem-reset': () => { clearTimeout(timer); set({ search: '', searchApplied: '', window: 'today', catalogue: 'all', selected: [] }); },
  };
  host.addEventListener('input', (e) => {
    if (!r || !e.target.matches('[data-rem-search]')) return;
    const value = e.target.value;
    const hadClear = !!r.search;
    r.search = value;
    if (!!value !== hadClear) render(); // the clear button replaces the search icon
    clearTimeout(timer);
    timer = setTimeout(() => { if (r) set({ searchApplied: value.trim() }); }, 350);
  });
  host.addEventListener('change', (e) => {
    if (!r) return;
    if (e.target.matches('[data-rem-window]')) set({ window: e.target.value, selected: [] });
    if (e.target.matches('[data-rem-catalogue]')) set({ catalogue: e.target.value });
  });
  return {
    handlers,
    open() { r = { window: 'today', search: '', searchApplied: '', catalogue: 'all', expanded: [], selected: [] }; render(); },
    isOpen: () => !!r,
    close() { r = null; render(); },
  };
}
