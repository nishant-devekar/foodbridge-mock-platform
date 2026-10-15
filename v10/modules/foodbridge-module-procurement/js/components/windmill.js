/*
  @windmill/react-ui under the host's theme (storefront-frontend src/assets/theme/myTheme.js): the
  class strings each component resolves to, in the order Windmill joins them. A disabled Button
  swaps its variant's `active` classes for `disabled` ones — so a disabled button never hovers.
*/
import { esc } from './dom.js';

export const THEME = {
  button: {
    base: 'align-bottom inline-flex items-center justify-center cursor-pointer leading-5 transition-colors duration-150 font-medium focus:outline-none',
    size: { larger: 'px-10 py-4 rounded-md', large: 'px-5 py-3 rounded-md', regular: 'px-4 py-2 rounded-md text-sm', small: 'px-3 py-1 rounded-md text-sm' },
    primary: { base: 'text-white bg-green-600 border border-transparent', active: 'active:bg-green-700 hover:bg-green-700', disabled: 'opacity-50 cursor-not-allowed' },
    outline: { base: 'text-gray-600 border-gray-200 border dark:text-gray-400 focus:outline-none', active: 'rounded-lg border bg-gray-200 border-gray-200 px-4 w-full mr-3 flex items-center justify-center cursor-pointer h-10', disabled: 'opacity-50 cursor-not-allowed bg-gray-300' },
    link: { base: 'text-gray-600 dark:text-gray-400 focus:outline-none border border-transparent', active: 'active:bg-transparent hover:bg-gray-100 dark:hover:bg-gray-500 dark:hover:text-gray-300 dark:hover:bg-opacity-10', disabled: 'opacity-50 cursor-not-allowed' },
  },
  input: {
    base: 'block w-full h-10 border border-gray-200 bg-white px-3 py-1 text-sm focus:outline-none dark:text-gray-300 leading-5 rounded-md bg-gray-100 focus:bg-white dark:focus:bg-gray-700',
    active: 'focus:border-gray-200 border-gray-200 dark:border-gray-600 dark:focus:border-gray-500 dark:bg-gray-700',
    disabled: 'border border-gray-400 cursor-not-allowed opacity-50 bg-gray-300 dark:bg-gray-800',
  },
  textarea: {
    base: 'block w-full border border-gray-200 bg-white focus:bg-white text-sm dark:text-gray-300 rounded-md focus:outline-none p-3',
    active: 'border border-gray-200 dark:border-gray-600 dark:focus:border-gray-600 dark:bg-gray-700',
  },
  label: { base: 'block text-sm text-gray-800 dark:text-gray-400' },
};

/** Windmill <Button>'s class string. */
export function buttonClass({ layout = 'primary', size = 'regular', disabled = false, cls = '' } = {}) {
  const b = THEME.button;
  return [b.base, b.size[size], b[layout].base, disabled ? b[layout].disabled : b[layout].active, cls].filter(Boolean).join(' ');
}

/** Windmill <Input>'s class string (type text/number/date/search…). */
export const inputClass = (cls = '', disabled = false) => [THEME.input.base, disabled ? THEME.input.disabled : THEME.input.active, cls].filter(Boolean).join(' ');

/**
 * The host's DisplayImage for a product with no image of its own (no image base URL is configured
 * for this tenant): the fallback placeholder, once its load check has run.
 */
export function displayImage({ size = 32, cls = 'hidden mr-2 md:block shadow-none rounded-custom', testId } = {}) {
  return `<span class="contents"><img class="${cls} object-fit-scale-down"${testId ? ` data-testid="${esc(testId)}"` : ''} src="assets/img/Errorimage.png" alt="product" loading="lazy" decoding="async" style="width: ${size}px; height: ${size}px;"></span>`;
}
