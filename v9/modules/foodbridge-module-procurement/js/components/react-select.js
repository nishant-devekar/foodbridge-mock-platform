/*
  A react-select 5.10 look-alike: the same DOM and the same emotion class names production renders
  (css/react-select.css carries those classes' rules, copied from the live page), for the host's
  status filter (SelectOrderByStatus) and the module's own selects.

  Only markup here; behaviour lives with the screen that owns the select.
*/
import { esc } from './dom.js';

/** react-select's isTouchCapable(): whether document.createEvent('TouchEvent') works. */
export const TOUCH = (() => { try { document.createEvent('TouchEvent'); return true; } catch { return false; } })();

/**
 * react-select's instanceId: one page-wide counter, bumped by every select that mounts. The page's
 * own selects (status filter, forecast categories) hold 1–2; each modal select mounted later takes
 * the next number, so `react-select-N-…` ids match production's in any order of opening.
 */
let instanceCount = 2;
export function nextSelectId() { instanceCount += 1; return instanceCount; }

const ARROW = '<svg height="20" width="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false" class="css-tj5bde-Svg"><path d="M4.516 7.548c0.436-0.446 1.043-0.481 1.576 0l3.908 3.747 3.908-3.747c0.533-0.481 1.141-0.446 1.574 0 0.436 0.445 0.408 1.197 0 1.615-0.406 0.418-4.695 4.502-4.695 4.502-0.217 0.223-0.502 0.335-0.787 0.335s-0.57-0.112-0.789-0.335c0 0-4.287-4.084-4.695-4.502s-0.436-1.17 0-1.615z"></path></svg>';
const CROSS = '<svg height="20" width="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false" class="css-tj5bde-Svg"><path d="M14.348 14.849c-0.469 0.469-1.229 0.469-1.697 0l-2.651-3.030-2.651 3.029c-0.469 0.469-1.229 0.469-1.697 0-0.469-0.469-0.469-1.229 0-1.697l2.758-3.15-2.759-3.152c-0.469-0.469-0.469-1.228 0-1.697s1.228-0.469 1.697 0l2.652 3.031 2.651-3.031c0.469-0.469 1.228-0.469 1.697 0s0.469 1.229 0 1.697l-2.758 3.152 2.758 3.15c0.469 0.469 0.469 1.229 0 1.698z"></path></svg>';

/**
 * The host's SelectOrderByStatus (react-select, clearable, placeholder "All Status").
 * `aria` holds the live region's four messages; react-select renders them only while focused.
 */
export function statusSelect({ id, value, placeholder = 'All Status', focused = false, open = false, inputHidden = false, aria = null, containerClass = 'text-black z-50' }) {
  const c = STATUS_SELECT(focused);
  const live = focused && aria
    ? `<span id="aria-selection">${esc(aria.selection || '')}</span><span id="aria-focused">${esc(aria.focused || '')}</span><span id="aria-results">${esc(aria.results || '')}</span><span id="aria-guidance">${esc(aria.guidance || '')}</span>`
    : '';
  return `<div class="${containerClass} ${c.container}" data-rs="${id}">`
    + `<span id="react-select-${id}-live-region" class="css-1f43avz-a11yText-A11yText"></span>`
    + `<span aria-live="polite" aria-atomic="false" aria-relevant="additions text" role="log" class="css-1f43avz-a11yText-A11yText">${live}</span>`
    + `<div class="${c.control}" data-rs-control>`
    + `<div class="${c.valueContainer}">`
    + (value
      ? `<div class="${c.singleValue}">${esc(value)}</div>`
      : `<div class="${c.placeholder}" id="react-select-${id}-placeholder">${esc(placeholder)}</div>`)
    + `<div class="${c.inputContainer}" data-value=""><input class="" autocapitalize="none" autocomplete="off" autocorrect="off" id="react-select-${id}-input" spellcheck="false" tabindex="0" type="text" aria-autocomplete="list" aria-expanded="${open}" aria-haspopup="true" role="combobox"${value ? '' : ` aria-describedby="react-select-${id}-placeholder"`} value="" style="color: inherit; background: 0px center; opacity: ${inputHidden ? 0 : 1}; width: 100%; grid-area: 1 / 2; font: inherit; min-width: 2px; border: 0px; margin: 0px; outline: 0px; padding: 0px;"${open ? ` aria-controls="react-select-${id}-listbox"` : ''} data-rs-input></div>`
    + `</div>`
    + `<div class="${c.indicators}">`
    + (value ? `<div class="${c.indicator}" aria-hidden="true" data-rs-clear>${CROSS}</div>` : '')
    + `<span class="${c.separator}"></span>`
    + `<div class="${c.indicator}" aria-hidden="true" data-rs-dropdown>${ARROW}</div>`
    + `</div></div></div>`;
}

// Emotion classes of the host's status filter, focused or not (from the production page).
function STATUS_SELECT(focused) {
  return {
    container: 'css-fyq6mk-container',
    control: focused ? 'css-ksdqqy-control' : 'css-jo6or0-control',
    valueContainer: 'css-1vxsu9a',
    placeholder: 'css-1jqq78o-placeholder',
    singleValue: 'css-1dimb5e-singleValue',
    inputContainer: 'css-1lx7dxn',
    indicators: 'css-1wbpri1',
    separator: 'css-1hyfx7x',
    indicator: focused ? 'css-u5qniv-indicatorContainer' : 'css-1u4v5nq-indicatorContainer',
  };
}

/** The status filter's menu: the same menu/option classes as the forecast's category filter. */
export const STATUS_MENU = {
  menu: 'css-18j1mm5-menu',
  menuList: 'css-qr46ko',
  option: (focused) => (focused ? 'css-99m3py-option' : 'css-1t1iol9-option'),
};

/** react-select's default aria messages (accessibility/index.ts), for a searchable single select. */
export const ARIA = {
  guidanceMenu: 'Use Up and Down to choose options, press Enter to select the currently focused option, press Escape to exit the menu, press Tab to select the option and exit the menu.',
  focused: (label, i, n) => `${label}, ${i + 1} of ${n}.`,
  results: (n) => `${n} result${n !== 1 ? 's' : ''} available.`,
  selected: (label) => `option ${label}, selected.`,
};

/** Emotion classes of the forecast table's category filter (PurchaseForecastTable SELECT_STYLES). */
export const CATEGORY_SELECT = {
  container: 'css-b62m3t-container',
  control: 'css-1dml1wx-control',
  valueContainer: 'css-hlgwow',
  valueContainerFilled: 'css-1dyz3mf',
  placeholder: 'css-1jqq78o-placeholder',
  inputContainer: 'css-19bb58m',
  indicators: 'css-1wy0on6',
  separator: 'css-1u9des2-indicatorSeparator',
  indicator: (focused) => (focused ? 'css-15lsz6c-indicatorContainer' : 'css-1xc3v61-indicatorContainer'),
  menu: 'css-18j1mm5-menu',
  menuList: 'css-qr46ko',
  option: (focused) => (focused ? 'css-99m3py-option' : 'css-1t1iol9-option'),
  multiValue: 'css-1p3m7a8-multiValue',
  multiValueLabel: 'css-9jq23d',
  multiValueRemove: 'css-v7duua',
};

const REMOVE14 = CROSS.replace('height="20" width="20"', 'height="14" width="14"');

/** A react-select multi select (isMulti): chips, clear-all, separator, dropdown indicator. */
export function multiSelect({ id, values, placeholder, focused, open, containerClass, c, ariaSelection = '' }) {
  const live = ariaSelection
    ? `<span id="aria-selection">${esc(ariaSelection)}</span><span id="aria-focused"></span><span id="aria-results"></span><span id="aria-guidance"></span>`
    : '';
  return `<div class="${containerClass} ${c.container}" data-rs="${id}">`
    + `<span id="react-select-${id}-live-region" class="css-1f43avz-a11yText-A11yText"></span>`
    + `<span aria-live="polite" aria-atomic="false" aria-relevant="additions text" role="log" class="css-1f43avz-a11yText-A11yText">${live}</span>`
    + `<div class="${c.control}" data-rs-control>`
    + `<div class="${values.length ? c.valueContainerFilled : c.valueContainer}">`
    + (values.length
      ? values.map((v) => `<div class="${c.multiValue}"><div class="${c.multiValueLabel}">${esc(v.label)}</div><div role="button" class="${c.multiValueRemove}" aria-label="Remove ${esc(v.label)}" data-rs-remove="${esc(v.value)}">${REMOVE14}</div></div>`).join('')
      : `<div class="${c.placeholder}" id="react-select-${id}-placeholder">${esc(placeholder)}</div>`)
    + `<div class="${c.inputContainer}" data-value=""><input class="" autocapitalize="none" autocomplete="off" autocorrect="off" id="react-select-${id}-input" spellcheck="false" tabindex="0" type="text" aria-autocomplete="list" aria-expanded="${open}" aria-haspopup="true"${open ? ` aria-controls="react-select-${id}-listbox" aria-owns="react-select-${id}-listbox"` : ''} role="combobox"${values.length ? '' : ` aria-describedby="react-select-${id}-placeholder"`} value="" style="color: inherit; background: 0px center; opacity: 1; width: 100%; grid-area: 1 / 2; font: inherit; min-width: 2px; border: 0px; margin: 0px; outline: 0px; padding: 0px;" data-rs-input></div>`
    + `</div><div class="${c.indicators}">`
    + (values.length ? `<div class="${c.indicator(focused)}" aria-hidden="true" data-rs-clear>${CROSS}</div>` : '')
    + `<span class="${c.separator}"></span><div class="${c.indicator(focused)}" aria-hidden="true">${ARROW}</div>`
    + `</div></div></div>`;
}

/** The open menu, portalled to <body> under the control (react-select's menuPortal). */
export function menuPortal({ id, rect, options, focusedIndex = 0, multi, c }) {
  const style = `left: ${rect.left}px; position: absolute; top: ${rect.top + rect.height + window.scrollY}px; width: ${rect.width}px; z-index: 9999;`;
  return `<div style="${style}" data-rs-portal="${id}"><div class="${c.menu}"><div class="${c.menuList}" role="listbox" aria-multiselectable="${Boolean(multi)}" id="react-select-${id}-listbox">`
    + options.map((o, i) => `<div class="${c.option(i === focusedIndex)}" aria-disabled="false" id="react-select-${id}-option-${o.index ?? i}" tabindex="-1" role="option" data-rs-option="${esc(o.value)}">${esc(o.label)}</div>`).join('')
    + `</div></div></div>`;
}
