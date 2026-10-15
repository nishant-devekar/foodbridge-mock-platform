/*
  The controls block above the list: the action bar, the phone page title, and the filter row
  (search, status, date range).

  The search <input> is rendered ONCE and never replaced, so typing keeps focus and caret; the
  status and date controls re-render in place (renderStatusSelect / renderDateInput).
*/
import { fi, lucide, reminderBell, selectChevron, selectCross } from '../components/icons.js';
import { esc, attr, cls } from '../components/dom.js';

const BTN = 'w-full font-medium py-1 px-2 justify-center items-center border !border-gray-200 flex hover:!bg-gray-100 rounded-md h-10 text-sm bg-white text-black';
const SLOT = 'flex-grow-0 md:flex-grow lg:flex-grow xl:flex-grow';

function actionBar(m) {
  const f = m.features;
  const L = m.label;
  const slots = [];
  if (f.createDelivery) {
    slots.push(`<button data-act="create-delivery" data-testid="orders-create-delivery-btn" class="w-full font-medium py-1 px-2 justify-center items-center border !border-green-200 flex hover:!bg-green-50 rounded-md h-10 text-sm bg-green-50 text-green-700">${lucide('truck', { size: 14, cls: 'mr-2 mt-[1px]' })}Create Delivery</button>`);
  }
  slots.push(`<button data-act="create-order" data-testid="orders-create-btn" class="${BTN}"><span class="mr-2">${fi('plus')}</span>Create <!---->${esc(L)}</button>`);
  if (f.orderForecast) {
    slots.push(`<button data-act="forecast" data-testid="orders-forecast-btn" class="${BTN}">${fi('trendingUp', { size: 14, cls: 'mr-2 mt-[1px]' })}Forecast Orders</button>`);
  }
  if (f.bulkProxyOrder) {
    slots.push(`<button type="button" data-act="bulk-menu" data-bulk-anchor class="${BTN}">${lucide('file-spreadsheet', { size: 14, cls: 'mr-2 mt-[1px]' })}Bulk <!---->${esc(L)}${lucide('chevron-down', { cls: 'h-3.5 w-3.5 ml-2 shrink-0 transition-transform duration-150" data-bulk-chevron="' })}</button>`);
  }
  if (f.demandReport) {
    slots.push(`<button data-act="demand" data-testid="orders-demand-report-btn" class="${BTN}">${fi('fileText', { size: 14, cls: 'mr-2 mt-[1px]' })}Generate Demand</button>`);
  }
  slots.push(`<button data-act="reminders" data-testid="orders-reminders-btn" class="w-full font-medium py-1 px-2 justify-center items-center border !border-amber-200 flex hover:!bg-amber-50 rounded-md h-10 text-sm bg-amber-50 text-amber-700" title="View customers who need follow-up calls to place orders">${reminderBell('w-4 h-4 mr-2')}<span class="hidden sm:inline">Follow-up Reminders</span><span class="sm:hidden">Reminders</span></button>`);

  // The Google Sheet mode picker (production's GoogleSheetToolbar with onSelectMode: no test id).
  const sheet = f.googleSheetExport || f.googleSheetSync
    ? `<button type="button" data-act="gsheet" data-gsheet-anchor class="flex items-center gap-2 px-4 h-10 rounded-md border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-gray-800 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 disabled:opacity-60 disabled:cursor-not-allowed text-sm font-medium transition">${lucide('file-spreadsheet', { cls: 'h-4 w-4 shrink-0' })}<span class="whitespace-nowrap">Google Sheet</span>${lucide('chevron-down', { cls: 'h-3.5 w-3.5 shrink-0 transition-transform duration-150' }).replace('<svg', '<svg data-gsheet-chevron')}</button>`
    : '';
  const download = f.downloadAllOrders
    ? `<div class="${SLOT}"><button data-act="download-all" data-testid="orders-download-all-btn" class="align-bottom inline-flex items-center justify-center cursor-pointer leading-5 transition-colors duration-150 font-medium focus:outline-none px-4 py-2 text-sm text-white bg-green-600 border border-transparent active:bg-green-700 hover:bg-green-700 w-full rounded-md h-10 add-product-button"><span class="mr-2">${fi('download')}</span>Download All <!---->${esc(L)}</button></div>`
    : '';

  return `<div class="hidden md:flex flex-col sm:flex-row gap-2 lg:gap-4">${slots.map((s) => `<div class="${SLOT}">${s}</div>`).join('')}<div class="flex-grow-0 flex gap-2">${sheet}</div>${download}</div>`;
}

/** The phone-only page title the screen renders inside its own controls. */
const mobileLabel = (m) => `<div class="sm:hidden px-2 flex min-w-0 items-center gap-2.5 mb-2 px-1 pb-2 " title="${esc(m.label)}" aria-current="page">${lucide('layout-dashboard', { cls: 'h-7 w-7 flex-shrink-0 text-green-600 dark:text-green-400" aria-hidden="true' })}<h1 data-testid="mobile-menu-label" class="truncate text-xl font-semibold leading-6 text-gray-800 dark:text-gray-100">${esc(m.label)}</h1></div>`;

/** The status filter, drawn as react-select draws it. */
export function renderStatusSelect(m, s) {
  const options = m.statusFilterOptions();
  const selected = options.find((o) => o.value === s.status) || null;
  const open = s.menu === 'status';
  return `<div class="text-black z-50 so-select">
    <div class="${cls('so-select__control', open && 'so-select__control--focused so-select__control--menu-is-open')}" data-act="status-toggle">
      <div class="so-select__value">
        ${selected ? `<div class="so-select__single">${esc(selected.label)}</div>` : '<div class="so-select__placeholder">All Status</div>'}
        <div class="so-select__input-wrap"><input class="so-select__input" id="orders-status-filter-input" autocapitalize="none" autocomplete="off" spellcheck="false" tabindex="0" type="text" role="combobox" aria-expanded="${open}" aria-haspopup="true" readonly value="" style="width:3.8px"></div>
      </div>
      <div class="so-select__indicators">
        ${selected ? `<div class="so-select__indicator" aria-hidden="true" data-act="status-clear">${selectCross()}</div>` : ''}
        <div class="so-select__indicator" aria-hidden="true">${selectChevron()}</div>
      </div>
    </div>
  </div>`;
}

/**
 * The open status menu. react-select portals it to the body-level portal host, in a wrapper
 * pinned under the control, so it escapes the controls card's overflow clip.
 */
export function renderStatusMenu(m, s, control) {
  const r = control.getBoundingClientRect();
  const options = m.statusFilterOptions();
  return `<div class="so-select-portal" style="left: ${r.left + window.scrollX}px; position: absolute; top: ${r.bottom + window.scrollY}px; width: ${r.width}px; z-index: 9999;"><div class="so-select__menu" data-testid="orders-status-filter-menu"><div class="so-select__list" role="listbox">${options.length
    ? options.map((o, i) => `<div class="${cls('so-select__option', i === s.statusFocus && 'so-select__option--focused')}" role="option" data-act="status-pick" data-value="${esc(o.value)}" data-index="${i}" tabindex="-1">${esc(o.label)}</div>`).join('')
    : '<div class="so-select__empty">No options</div>'}</div></div></div>`;
}

const pad = (n) => String(n).padStart(2, '0');
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** react-datepicker's "dd MMM, yyyy". */
export const fmtRangeDate = (d) => `${pad(d.getDate())} ${MON[d.getMonth()]}, ${d.getFullYear()}`;

export function renderDateInput(s) {
  const [a, b] = s.dateRange;
  const value = a ? `${fmtRangeDate(a)} - ${b ? fmtRangeDate(b) : ''}` : '';
  return `<div class="relative h-10" data-date-anchor>
      ${fi('calendar', { cls: 'pointer-events-none absolute left-2.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-gray-400' })}
      <div class="react-datepicker-wrapper orders-date-filter block h-10 w-full"><div class="react-datepicker__input-container">
        <input type="text" data-act="date-toggle" placeholder="Filter by date range" readonly class="box-border h-10 w-full cursor-pointer rounded-md border border-gray-300 bg-white py-2 pl-8 pr-7 text-xs leading-5 transition-colors hover:border-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 md:pl-10 md:pr-10 md:text-sm" value="${esc(value)}">
      </div></div>
      ${a || b ? `<button type="button" data-act="date-clear" data-testid="orders-date-range-clear-btn" class="absolute right-1 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">${fi('x', { size: 16 })}</button>` : ''}
    </div>`;
}

/** The whole controls block. Mounted once; the two filter slots re-render themselves. */
export function renderControls(m, s) {
  return `<div class="sticky isolate shrink-0 bg-gray-50 [background-clip:border-box] [backface-visibility:hidden] [overflow-anchor:none] before:pointer-events-none before:absolute before:inset-x-0 before:-top-[2px] before:h-[3px] before:bg-gray-50 after:pointer-events-none after:absolute after:inset-x-0 after:-bottom-[2px] after:h-[3px] after:bg-gray-50 dark:bg-gray-900 dark:before:bg-gray-900 dark:after:bg-gray-900 md:static md:bg-transparent md:[backface-visibility:visible] md:before:hidden md:after:hidden mobile-orders-controls z-20 pb-2 md:z-auto md:pb-0" style="top: 0px;">
  <div class="tab tab-enter max-md:!animate-none max-md:!transform-none max-md:!opacity-100">
    <div class="min-w-0 rounded-lg overflow-hidden bg-white dark:bg-gray-800 mb-0 min-w-0 overflow-hidden !bg-gray-50 shadow-xs dark:!bg-gray-900 md:mb-2 md:!bg-transparent dark:md:!bg-gray-800 lg:mb-5">
      <div class="p-4 !p-0 !pt-0 lg:!pt-6">
        <div class="pb-0 lg:pb-3 mb-2 lg:mb-5 md:pb-0 grid lg:gap-6 xl:gap-6 xl:flex">
          <div class="flex-grow-0 sm:flex-grow md:flex-grow lg:flex-grow xl:flex-grow"></div>
          ${actionBar(m)}
        </div>
        ${mobileLabel(m)}
        <form data-filters class="mt-2 grid grid-cols-2 gap-2 pb-2 md:flex md:pb-0 lg:mt-4 lg:gap-6 xl:gap-6">
          <div class="col-span-2 flex-grow-0 md:col-span-1 md:flex-grow lg:flex-grow xl:flex-grow">
            <div class="relative flex-1">
              ${lucide('search', { cls: 'absolute left-1 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4' })}
              <input class="block w-full h-10 border border-gray-200 bg-white px-3 py-1 text-sm focus:outline-none dark:text-gray-300 leading-5 rounded-md bg-gray-100 focus:bg-white dark:focus:bg-gray-700 focus:border-gray-200 border-gray-200 dark:border-gray-600 dark:focus:border-gray-500 dark:bg-gray-700 pl-9" type="search" name="search" data-testid="orders-search-input" placeholder="Search by customer name, phone, or ${esc(m.label.toLowerCase())} number"${attr('value', s.searchInput || null)}>
            </div>
            <button type="submit" class="absolute right-0 top-0 mt-5 mr-1"></button>
          </div>
          <div class="h-10 min-w-0 flex-grow-0 md:w-[192px]" data-slot="status">${renderStatusSelect(m, s)}</div>
          <div class="relative min-w-0 flex-grow-0 md:mb-2 md:w-[280px]" data-slot="date">${renderDateInput(s)}</div>
        </form>
      </div>
    </div>
  </div>
</div>`;
}
