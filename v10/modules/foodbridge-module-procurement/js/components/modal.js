/*
  The module's CustomModal (components/ui/CustomModal.jsx) and the modals built on it. CustomModal
  is NOT portalled: it renders where its owner renders, as a fixed overlay — so a modal opened from
  inside a drawer lives inside that drawer's DOM, as it does in production.
*/
import { esc } from './dom.js';
import { lucide } from './icons.js';

const SIZES = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-2xl', xl: 'max-w-4xl', '3xl': 'max-w-6xl', '5xl': 'max-w-7xl', full: 'w-[98.5%]', other: 'w-[98.5%] md:min-h-[65vh]' };

export function customModal({ size = 'md', zIndex = '50', fixedHeight = false, hideCloseButton = false, testId, closeAct = 'modal-close', content }) {
  const height = size === 'other' ? 'h-full max-h-[100vh] md:h-auto md:max-h-[88vh]'
    : size === 'full' ? (fixedHeight ? 'h-[88vh]' : 'max-h-[88vh]') : (fixedHeight ? 'h-[90vh]' : 'max-h-[90vh]');
  const outer = size === 'other' ? 'p-0 md:p-4' : 'p-4';
  const z = Number(String(zIndex).replace(/[[\]]/g, '')) || 50;
  return `<div class="fixed inset-0 flex items-center justify-center ${outer} bg-black/50 backdrop-blur-sm" style="z-index: ${z};"${testId ? ` data-testid="${esc(testId)}-modal"` : ''}>`
    + `<div class="bg-white dark:bg-gray-800 ${size === 'other' ? 'rounded-none md:rounded-xl' : 'rounded-xl'} shadow-2xl relative w-full ${SIZES[size]} ${height} flex flex-col overflow-hidden">`
    + `<div class="flex-shrink-0 bg-white dark:bg-gray-800 ${size === 'other' ? 'p-1 md:p-6' : 'p-3'} pb-0 relative">`
    + (hideCloseButton ? '' : `<button class="absolute top-2 right-2 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all z-[1]" aria-label="Close modal"${testId ? ` data-testid="${esc(testId)}-modal-close-btn"` : ''} data-act="${closeAct}">${lucide('X', { cls: 'w-5 h-5' })}</button>`)
    + `</div>`
    + `<div class="flex-1 min-h-0 ${size === 'other' ? 'px-4 pb-0 pt-0 md:px-6 md:pb-4 md:pt-2 overflow-hidden md:overflow-y-auto scrollbar-hide' : 'px-2 pb-2 pt-2 md:px-4 md:pb-4 overflow-y-auto scrollbar-hide'} flex flex-col">${content}</div>`
    + `</div></div>`;
}

/** DiscardChangesModal: "No, Wait" keeps editing, "Yes, Discard" lets the close go through. */
export function discardChangesModal({ title, description, waitAct = 'discard-wait', discardAct = 'discard-confirm' }) {
  return customModal({
    size: 'sm', zIndex: '[60]', testId: 'discard-changes', closeAct: waitAct,
    content: `<div class="w-full text-center"><span class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 dark:bg-amber-900/30">${lucide('AlertTriangle', { cls: 'h-5 w-5 text-amber-600' })}</span>`
      + `<h1 class="text-base font-semibold text-gray-900 dark:text-gray-100">${esc(title || 'Discard changes?')}</h1>`
      + `<p class="mt-1.5 text-sm text-gray-500 dark:text-gray-400">${esc(description || 'Your unsaved changes will be lost.')}</p>`
      + `<div class="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-center sm:gap-3">`
      + `<button type="button" data-testid="discard-changes-modal-cancel-btn" class="inline-flex h-10 w-full items-center justify-center rounded-md border border-gray-300 bg-white px-5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 sm:w-auto" data-act="${waitAct}">No, Wait</button>`
      + `<button type="button" data-testid="discard-changes-modal-confirm-btn" class="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-transparent bg-amber-600 px-5 text-sm font-medium text-white transition-colors hover:bg-amber-700 active:bg-amber-800 focus:outline-none focus:ring-2 focus:ring-amber-300 sm:w-auto" data-act="${discardAct}">Yes, Discard</button>`
      + `</div></div>`,
  });
}
