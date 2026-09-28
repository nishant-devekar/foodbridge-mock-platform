/* The module's AILoader (components/ui/AILoader.jsx, copied from the host): ring, sparkles, dots. */
import { esc } from './dom.js';
import { lucide } from './icons.js';

const RING = { sm: 'w-8 h-8', md: 'w-12 h-12', lg: 'w-16 h-16' };
const TEXT = { sm: 'text-sm', md: 'text-base', lg: 'text-lg' };
const ICON = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-8 h-8' };

export function aiLoader({ message = 'Processing your request...', size = 'md', fullScreen = false } = {}) {
  const dot = (pos, delay) => `<div class="w-2 h-2 bg-green-500 rounded-full absolute ${pos} animate-ping"${delay ? ` style="animation-delay: ${delay};"` : ''}></div>`;
  const bounce = (delay) => `<span class="w-2 h-2 bg-green-600 rounded-full animate-bounce" style="animation-delay: ${delay};"></span>`;
  const content = '<div class="flex flex-col items-center justify-center gap-4"><div class="relative"><div class="absolute inset-0 rounded-full border-4 border-green-200 dark:border-green-800 opacity-20"></div>'
    + `<div class="${RING[size]} relative"><svg class="animate-spin" viewBox="0 0 50 50"><circle class="opacity-25" cx="25" cy="25" r="20" stroke="currentColor" stroke-width="4" fill="none"></circle><circle class="text-green-600 dark:text-green-400" cx="25" cy="25" r="20" stroke="currentColor" stroke-width="4" fill="none" stroke-dasharray="80" stroke-dashoffset="60" stroke-linecap="round"></circle></svg>`
    + `<div class="absolute inset-0 flex items-center justify-center">${lucide('Sparkles', { cls: `${ICON[size]} text-green-600 dark:text-green-400 animate-pulse` })}</div></div>`
    + `<div class="absolute -inset-2">${dot('top-0 left-1/2 -translate-x-1/2')}${dot('bottom-0 left-1/2 -translate-x-1/2', '0.2s')}${dot('left-0 top-1/2 -translate-y-1/2', '0.4s')}${dot('right-0 top-1/2 -translate-y-1/2', '0.6s')}</div></div>`
    + `<div class="flex flex-col items-center gap-2"><p class="${TEXT[size]} font-medium text-gray-700 dark:text-gray-300 text-center">${esc(message)}</p><div class="flex gap-1">${bounce('0s')}${bounce('0.2s')}${bounce('0.4s')}</div></div></div>`;
  return fullScreen ? `<div class="fixed inset-0 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm z-[100] flex items-center justify-center">${content}</div>` : content;
}

/** The small inline spinner several controls swap in while they wait (a 50×50 arc). */
export const spinner = (cls) => `<svg class="${cls}" viewBox="0 0 50 50"><circle cx="25" cy="25" r="20" stroke="currentColor" stroke-width="4" fill="none" stroke-dasharray="80" stroke-dashoffset="60" stroke-linecap="round"></circle></svg>`;
