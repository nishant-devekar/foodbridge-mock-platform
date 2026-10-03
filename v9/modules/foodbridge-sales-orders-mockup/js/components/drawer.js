/*
  The side drawer every Sales Orders flow opens in (the product's MainDrawer on rc-drawer):
  a 30% black mask, a white panel from the right — 82% wide (85% for the large variant), full
  width at 575px and below — and a round red close button in its top-right corner.

  Rendered into the body-level overlay host, like the product's. `content` is the panel's HTML;
  the caller owns everything inside it.
*/
import { fi } from './icons.js';

export function drawerWidth(size = 'regular') {
  if (window.innerWidth <= 575) return '100%';
  return size === 'xxlarge' ? '85%' : '82%';
}

export function renderDrawer({ testId, content, size = 'regular', entering = false, open = true }) {
  const top = size === 'xxlarge' ? '0.75rem' : '1.5rem';
  return `<div data-drawer><div tabindex="-1" class="drawer drawer-right${open ? ' drawer-open' : ''}${entering ? ' is-entering' : ''}">
    <div class="drawer-mask" data-act="drawer-close"></div>
    <div class="drawer-content-wrapper" style="width: ${drawerWidth(size)};${open ? '' : ' transform: translateX(100%);'}"><div class="drawer-content">
      <button data-act="drawer-close" data-testid="${testId}-close-btn" class="absolute focus:outline-none z-10 text-red-500 hover:bg-red-100 hover:text-gray-700 transition-colors duration-150 bg-white shadow-md mr-6 right-0 left-auto w-10 h-10 rounded-full block text-center" aria-label="Close drawer" style="top: calc(env(safe-area-inset-top, 0px) + ${top});">${fi('x', { cls: 'mx-auto' })}</button>
      <div data-testid="${testId}" class="flex flex-col w-full h-full justify-between" style="padding-bottom: env(safe-area-inset-bottom);">${content}</div>
    </div></div>
  </div></div>`;
}

/**
 * The product's CustomModal: a blurred 50% black backdrop and a rounded card. `other` is the
 * checkout's variant — full-screen on a phone, a near-full-width card from md up.
 */
export function renderModal({ testId, content, size = 'md', zIndex = 50, closeButton = true }) {
  const other = size === 'other';
  const width = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-2xl', xl: 'max-w-4xl', other: 'w-[98.5%] md:min-h-[65vh]' }[size] || 'max-w-md';
  const close = closeButton ? `<button data-act="modal-close" class="absolute top-2 right-2 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all z-[1]" aria-label="Close modal" data-testid="${testId}-modal-close-btn"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-x w-5 h-5"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg></button>` : '';
  return `<div data-modal class="fixed inset-0 flex items-center justify-center ${other ? 'p-0 md:p-4' : 'p-4'} bg-black/50 backdrop-blur-sm" style="z-index: ${zIndex};" data-testid="${testId}-modal">
    <div class="bg-white dark:bg-gray-800 ${other ? 'rounded-none md:rounded-xl' : 'rounded-xl'} shadow-2xl relative w-full ${width} ${other ? 'h-full max-h-[100vh] md:h-auto md:max-h-[88vh]' : 'max-h-[90vh]'} flex flex-col overflow-hidden">
      <div class="flex-shrink-0 bg-white dark:bg-gray-800 ${other ? 'p-1 md:p-6' : 'p-3'} pb-0 relative">${close}</div>
      <div class="flex-1 min-h-0 ${other ? 'px-4 pb-0 pt-0 md:px-6 md:pb-4 md:pt-2 overflow-hidden md:overflow-y-auto scrollbar-hide' : 'px-2 pb-2 pt-2 md:px-4 md:pb-4 overflow-y-auto scrollbar-hide'} flex flex-col">${content}</div>
    </div>
  </div>`;
}
