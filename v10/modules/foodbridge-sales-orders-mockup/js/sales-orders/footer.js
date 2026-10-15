/*
  The phone's sticky action bar (hidden from md up), with the create menu it opens when bulk
  ordering is on. Which buttons appear follows the same tenant flags as the desktop action bar.
*/
import { fi, lucide } from '../components/icons.js';
import { esc } from '../components/dom.js';

const SEP = '<div class="h-8 w-px bg-gray-200"></div>';
const item = (act, testid, tone, title, icon, label) => `<button data-act="${act}" data-testid="${testid}" class="flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1 py-1 rounded-lg ${tone}" title="${title}">${icon}<span class="max-w-full truncate text-[10px] font-medium">${label}</span></button>`;

export function renderFooter(m, s) {
  const f = m.features;
  const L = esc(m.label);
  const open = s.menu === 'create-mobile';
  const menu = f.bulkProxyOrder && open
    ? `<div class="fixed inset-0 z-10" data-act="create-mobile-close"></div>
       <div class="absolute bottom-full left-2 z-20 mb-2 w-56 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 text-left shadow-xl dark:border-gray-700 dark:bg-gray-800">
         <button type="button" data-act="create-order" data-testid="orders-create-menu-single-btn" class="flex w-full items-center gap-3 px-3 py-2.5 text-sm text-gray-700 hover:bg-emerald-50 dark:text-gray-200 dark:hover:bg-gray-700">${fi('plus', { cls: 'h-4 w-4 text-emerald-600' })}Create <!---->${L}</button>
         <button type="button" data-act="bulk-pick" data-mode="STANDARD" data-testid="orders-create-menu-bulk-btn" class="flex w-full items-center gap-3 px-3 py-2.5 text-sm text-gray-700 hover:bg-emerald-50 dark:text-gray-200 dark:hover:bg-gray-700">${lucide('file-spreadsheet', { cls: 'h-4 w-4 text-emerald-600' })}Bulk <!---->${L}</button>
         <button type="button" data-act="bulk-pick" data-mode="ROUTE" data-testid="orders-create-menu-route-btn" class="flex w-full items-center gap-3 px-3 py-2.5 text-sm text-gray-700 hover:bg-emerald-50 dark:text-gray-200 dark:hover:bg-gray-700">${lucide('map', { cls: 'h-4 w-4 text-emerald-600' })}Route <!---->${L}</button>
       </div>`
    : '';
  const create = `<div class="relative flex min-w-0 flex-1 justify-center">${menu}
    <button data-act="${f.bulkProxyOrder ? 'create-mobile-toggle' : 'create-order'}" data-testid="orders-create-btn-mobile" class="flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg px-1 py-1 text-emerald-700 hover:bg-emerald-50" title="Create ${L}"${f.bulkProxyOrder ? ` aria-expanded="${open}" aria-haspopup="menu"` : ''}>
      <span class="flex items-center rounded-lg bg-emerald-600 px-2.5 py-1 text-white">${fi('plus', { cls: 'h-5 w-5' })}${f.bulkProxyOrder ? lucide('chevron-up', { cls: `h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}` }) : ''}</span>
      <span class="max-w-full truncate text-[10px] font-medium"> <!---->${L}</span>
    </button></div>`;
  const parts = [create];
  if (f.createDelivery) parts.push(SEP, item('create-delivery', 'orders-create-delivery-btn-mobile', 'text-green-600 hover:bg-green-50', 'Create Delivery', lucide('truck', { cls: 'w-5 h-5' }), 'Delivery'));
  if (f.demandReport) parts.push(SEP, item('demand', 'orders-demand-report-btn-mobile', 'text-gray-600 hover:bg-gray-100', 'Demand Report', fi('fileText', { cls: 'w-5 h-5' }), 'Demand'));
  parts.push(SEP, item('reminders', 'orders-reminders-btn-mobile', 'text-amber-600 hover:bg-amber-50', 'Follow-up Reminders', lucide('bell', { cls: 'w-5 h-5' }), 'Reminders'));
  if (f.googleSheetExport) {
    parts.push(SEP, item('gsheet-current', 'orders-gsheet-export-current-btn-mobile', 'text-emerald-600 hover:bg-emerald-50', 'New / Current Orders', lucide('file-spreadsheet', { cls: 'w-5 h-5' }), 'Export'));
    parts.push(item('gsheet-history', 'orders-gsheet-export-history-btn-mobile', 'text-indigo-500 hover:bg-indigo-50', 'Historical Orders', lucide('history', { cls: 'w-5 h-5' }), 'History'));
  }
  if (f.downloadAllOrders) parts.push(SEP, item('download-all', 'orders-download-all-btn-mobile', 'text-gray-600 hover:bg-gray-100 disabled:opacity-40', `Download All ${L}`, fi('download', { cls: 'w-5 h-5' }), 'Download'));
  return `<div class="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-[0_-2px_12px_rgba(0,0,0,0.08)]"><div class="flex w-full items-center justify-around px-1 py-2 pb-[env(safe-area-inset-bottom,8px)]">${parts.join('')}</div></div><div class="md:hidden h-20"></div>`;
}
