/*
  "Add New Item" from the create drawer (AddNewItemModal → AddItemForm, with CategorySelect,
  ImageSlot, UnitPriceModal and AddCategoryModal): pick Finished Product or Raw Material, then
  Title · Images · Category · Unit & Price. The payload is SSOT 4 F18; the module's
  POST /catalogue/product hands it to the host, which files it in MASTER and DEFAULT (or
  RAW-MATERIAL). The drawer then refreshes its catalogue and jumps to the new item.

  Form rules are react-hook-form's as the form configures them: validated on submit, re-validated
  on change after that, the first invalid registered field focused (the title — the category
  select takes no ref).
*/
import { esc, morph } from '../components/dom.js';
import { fi, lucide } from '../components/icons.js';
import { customModal } from '../components/modal.js';
import { buttonClass, inputClass, THEME } from '../components/windmill.js';
import { ARIA, nextSelectId } from '../components/react-select.js';

const T = '<!---->';
const NB = ' ';
const ROW = 'grid grid-cols-6 gap-3 md:gap-5 xl:gap-6 lg:gap-6 mb-6';
const FIELD = 'col-span-8 sm:col-span-4';
const TAX_OPTIONS = ['0%', '5%', '12%', '18%', '28%'];
const U = 'add-item-unit';
const ARTICLE_ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const CATEGORY_TITLE_PATTERN = /^(?=.*[A-Za-z])[A-Za-z0-9&@#$%?/_>.\- ]{1,}$/;
const ARROW = '<svg height="20" width="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false" class="css-tj5bde-Svg"><path d="M4.516 7.548c0.436-0.446 1.043-0.481 1.576 0l3.908 3.747 3.908-3.747c0.533-0.481 1.141-0.446 1.574 0 0.436 0.445 0.408 1.197 0 1.615-0.406 0.418-4.695 4.502-4.695 4.502-0.217 0.223-0.502 0.335-0.787 0.335s-0.57-0.112-0.789-0.335c0 0-4.287-4.084-4.695-4.502s-0.436-1.17 0-1.615z"></path></svg>';
const CROSS = '<svg height="20" width="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false" class="css-tj5bde-Svg"><path d="M14.348 14.849c-0.469 0.469-1.229 0.469-1.697 0l-2.651-3.030-2.651 3.029c-0.469 0.469-1.229 0.469-1.697 0-0.469-0.469-0.469-1.229 0-1.697l2.758-3.15-2.759-3.152c-0.469-0.469-0.469-1.228 0-1.697s1.228-0.469 1.697 0l2.652 3.031 2.651-3.031c0.469-0.469 1.228-0.469 1.697 0s0.469 1.229 0 1.697l-2.758 3.152 2.758 3.15c0.469 0.469 0.469 1.229 0 1.698z"></path></svg>';

/** SSOT 4 toTitleCase: runs of whitespace collapse; a trailing space survives. */
const titleCase = (v) => (typeof v !== 'string' || !v.trim() ? '' : v.toLowerCase().split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '));
/** Six characters, like the host's ShortUniqueId({ length: 6 }). */
const generateArticleNo = (length = 6) => { const b = new Uint8Array(length); crypto.getRandomValues(b); return Array.from(b, (x) => ARTICLE_ALPHABET[x % ARTICLE_ALPHABET.length]).join(''); };
/** F18g parseUnitMap: only three-part `strUnits` labels contribute. */
function parseUnitMap(unitMap) {
  const r = { secondaryUnits: [], baseUnits: [], palletUnits: [] };
  for (const e of Object.values(unitMap || {})) {
    const parts = String(e?.strUnits || '').split('/').map((p) => p.trim());
    if (!e?.strUnits || parts.length !== 3) continue;
    const [a, b, c] = parts;
    if (a && !r.secondaryUnits.includes(a)) r.secondaryUnits.push(a);
    if (b && !r.baseUnits.includes(b)) r.baseUnits.push(b);
    if (c && !r.palletUnits.includes(c)) r.palletUnits.push(c);
  }
  return r;
}
/** F18j: the directory's Home children, depth-first; a node with children is a heading. */
function flattenCategoryOptions(data) {
  if (!Array.isArray(data) || !Array.isArray(data[0]?.children)) return [];
  const out = [];
  const walk = (nodes, level) => { for (const n of nodes) { const parent = Array.isArray(n.children) && n.children.length > 0; out.push({ value: String(n._id), name: n.name, level, isDisabled: parent }); if (parent) walk(n.children, level + 1); } };
  walk(data[0].children, 0);
  return out;
}
const buildUnitString = (u) => (u.palletUnit ? `${u.secondaryUnit}-${u.baseUnit}-${u.palletUnit}` : `${u.secondaryUnit}-${u.baseUnit}`);
function buildPriceMap(u) { const m = { [u.secondaryUnit]: Number(u.price || 0).toFixed(4), [u.baseUnit]: Number(u.baseUnitPrice || 0).toFixed(4) }; if (u.palletUnit) m[u.palletUnit] = Number(u.palletUnitPrice || 0).toFixed(4); return m; }
const pickDisplayUnitPrice = (u, idx) => Number(idx === 2 ? u.palletUnitPrice : idx === 1 ? u.baseUnitPrice : u.price) || 0;
const localised = (lang, v) => (String(v ?? '') === '' ? {} : { [lang]: String(v ?? '') });
/** F18 buildCreateItemPayload */
function buildCreateItemPayload(form, ctx) {
  const u = form.units;
  const priceMap = buildPriceMap(u);
  const price = pickDisplayUnitPrice(u, ctx.priceCalculationUnitIndex ?? 0);
  return {
    sku: '', barcode: '', title: localised('en', form.title), description: localised('en', ''), slug: String(form.title ?? '').toLowerCase().replace(/[^A-Z0-9]+/gi, '-'),
    categories: form.categoryId ? [form.categoryId] : [], category: form.categoryId || null, isReturnableProduct: false, articleNo: form.articleNo,
    image: (form.images || []).filter((i) => typeof i === 'string' && i.length > 0), unit: buildUnitString(u), tax: u.tax, stock: 0, tag: [], warranty: null, guarantee: null,
    policyTemplateReference: null, policy: null,
    prices: { priceMap, offerPriceMap: priceMap, price: Number(price).toFixed(4), originalPrice: Number(price).toFixed(4), discount: Number(price).toFixed(4) },
    brand: '', boxes: u.conversionRate, pallets: u.palletConversionRate ?? 1, isCombination: false, variants: [], status: 'show', attributes: { taxClassificationCode: '' }, stockThreshold: null,
    ...(ctx.catalogueType ? { catalogueType: ctx.catalogueType } : {}),
  };
}
/** A refusal resolves its envelope (CataloguePort contract); only a transport failure rejects. */
const resolveRefusal = (p) => p.catch((err) => { if (err?.response?.data && typeof err.response.data === 'object') return err.response.data; throw err; });

let formModalIds = 0; // React's useId, one per FormModal mount (":r0:", ":r1:" …)

export function createAddItemModal(host, server, { rerender, onCreated }) {
  const currency = host.currency;
  const appProp = host.appProp;
  const unitIndex = Number(appProp.priceCalculationUnitIndex) || 0;
  let m = null;      // the modal: { type } — null when closed
  let f = null;      // AddItemForm, mounted while a type is chosen
  let unit = null;   // UnitPriceModal, while open
  let cat = null;    // AddCategoryModal, while open
  let portal = null; // the category menus and the unit modal, portalled to <body>

  // ── Lifecycle ──
  function open(type = null) { m = { type }; if (type) mountForm(); }
  function close() { m = null; f = null; unit = null; cat = null; clearPortal(); }
  function setType(type) { m.type = type; if (type) mountForm(); else { f = null; unit = null; cat = null; } }
  function mountForm() {
    f = {
      articleNo: generateArticleNo(), title: '', titleTouched: false, submitted: false, errors: {}, images: [null, null, null, null], uploads: 0, uploadErrors: {},
      units: null, unitError: null, submitting: false, categoryData: null, rootCategories: [], category: null, rs: selectState(), focusTitle: false,
    };
    loadCategories(); loadRoots();
  }
  const selectState = () => ({ id: nextSelectId(), focused: false, open: false, input: '', focus: 0, selected: false });
  const loadCategories = () => server.listCategories().then((res) => { if (f) { f.categoryData = Array.isArray(res) ? res : res?.data ?? res; rerender(); } }).catch(() => { if (f) { f.categoryData = []; rerender(); } });
  const loadRoots = () => server.getCategoryProductTree().then((res) => { const p = res?.data?.data || res?.data || res; if (f) { f.rootCategories = Array.isArray(p?.products) ? p.products : []; rerender(); } }).catch(() => { if (f) { f.rootCategories = []; rerender(); } });

  // ── Validation (react-hook-form) ──
  function validateTitle() {
    if (!f.title) return 'Title/Name is required!';
    if (!f.title.trim()) return 'Title/Name cannot be empty';
    return '';
  }
  const validate = () => { f.errors = { title: validateTitle(), category: f.category ? '' : 'Category is required!' }; return !f.errors.title && !f.errors.category; };

  async function submit() {
    f.submitted = true;
    if (!validate()) { if (f.errors.title) f.focusTitle = true; rerender(); return; }
    if (f.uploads > 0) { host.notify('error', 'Please wait for image upload to finish.'); return; }
    if (!f.units) { f.unitError = 'Unit is required'; rerender(); return; }
    f.submitting = true; rerender();
    const form = f;
    try {
      const payload = buildCreateItemPayload({ articleNo: form.articleNo, title: form.title, categoryId: form.category, units: form.units, images: form.images }, { catalogueType: m.type === 'RAW-MATERIAL' ? 'RAW-MATERIAL' : null, priceCalculationUnitIndex: unitIndex });
      const res = await resolveRefusal(server.createProduct(payload));
      if (res?.status) { host.notify('success', res.message); onCreated(form.articleNo, m.type); }
      else host.notify('error', res?.message || 'Failed to add product');
    } catch (err) {
      host.notify('error', err?.response?.data?.message || err?.message || 'Failed to add product');
    } finally {
      if (f === form) { f.submitting = false; rerender(); }
    }
  }

  // ── Views ──
  const labelArea = (text, required) => `<label class="${THEME.label.base} col-span-4 sm:col-span-2 font-medium text-sm">${text}${required ? '<span class="text-red-500 ml-1">*</span>' : ''}</label>`;
  const errorSpan = (msg, name) => (msg ? `<span class="text-red-400 text-sm mt-2"${name ? ` data-testid="${name}-error"` : ''}>${esc(msg)}</span>` : '');
  const inputArea = ({ name, value, placeholder, error, touched }) => `<div class="w-full"><div class="border border-gray-300 rounded-lg bg-white focus-within:border-green-500"><input class="${inputClass(`flex-1 h-10 p-2 border-none focus:ring-0 rounded-lg  ${error ? 'border-red-500 focus:border-red-500' : ''}`)}" type="text" name="${name}" autocomplete="off" placeholder="${esc(placeholder)}" value="${esc(value)}" data-ai-field="${name}"></div>${touched && error ? `<p class="text-red-500 text-sm mt-1">${esc(error)}</p>` : ''}</div>`;

  function typePicker() {
    return '<div class="py-2"><h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-1">What are you adding?</h3><p class="text-sm text-gray-500 dark:text-gray-400 mb-5">Choose the type of item you want to create. It\'ll be added to your catalogue and ready to search right away.</p><div class="grid grid-cols-1 sm:grid-cols-2 gap-3">'
      + `<button type="button" data-testid="create-order-add-item-type-product" class="flex flex-col items-start gap-2 p-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-green-500 hover:bg-green-50/50 dark:hover:bg-green-900/10 transition-all text-left" data-ai="type" data-type="PRODUCT"><div class="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">${lucide('PackagePlus', { cls: 'w-5 h-5 text-green-600 dark:text-green-400' })}</div><span class="font-semibold text-gray-900 dark:text-white">Finished Product</span><span class="text-xs text-gray-500 dark:text-gray-400">A sellable item in your store catalogue.</span></button>`
      + `<button type="button" data-testid="create-order-add-item-type-raw-material" class="flex flex-col items-start gap-2 p-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-amber-500 hover:bg-amber-50/50 dark:hover:bg-amber-900/10 transition-all text-left" data-ai="type" data-type="RAW-MATERIAL"><div class="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">${lucide('FlaskConical', { cls: 'w-5 h-5 text-amber-600 dark:text-amber-400' })}</div><span class="font-semibold text-gray-900 dark:text-white">Raw Material</span><span class="text-xs text-gray-500 dark:text-gray-400">An ingredient or input used to make other products.</span></button></div></div>`;
  }

  // CategorySelect: react-select, classNamePrefix "add-item-category", menu portalled (absolute).
  const categoryOptions = () => [{ value: 'add_new', label: 'Add New Category', isAddNewOption: true }, ...flattenCategoryOptions(f.categoryData).map((o) => {
    const raw = titleCase(typeof o.name === 'string' ? o.name : o.name && typeof o.name === 'object' ? (Object.keys(o.name).includes('en') ? o.name.en : o.name.en) : '');
    return { value: o.value, label: `${'- '.repeat(o.level)}${raw}`, rawLabel: raw, isDisabled: o.isDisabled };
  })];
  const shownCategoryOptions = () => { const q = f.rs.input.trim().toLowerCase(); return categoryOptions().filter((o) => o.isAddNewOption || !q || o.label.toLowerCase().includes(q) || String(o.value).toLowerCase().includes(q)); };
  function categorySelect() {
    const rs = f.rs;
    const selected = categoryOptions().find((o) => !o.isAddNewOption && o.value === f.category) || null;
    const P = 'add-item-category';
    const error = f.submitted && f.errors.category;
    const shown = shownCategoryOptions();
    const live = !rs.focused ? '' : rs.open
      ? `<span id="aria-selection"></span><span id="aria-focused">${esc(shown[rs.focus] ? ARIA.focused(shown[rs.focus].label, rs.focus, shown.length) : '')}</span><span id="aria-results">${esc(ARIA.results(shown.length))}</span><span id="aria-guidance">${esc(ARIA.guidanceMenu)}</span>`
      : `<span id="aria-selection">${rs.selected && selected ? esc(ARIA.selected(selected.label)) : ''}</span><span id="aria-focused"></span><span id="aria-results"></span><span id="aria-guidance"></span>`;
    const ind = rs.focused ? 'css-15lsz6c-indicatorContainer' : 'css-1xc3v61-indicatorContainer';
    return `<div data-testid="${P}" class="w-full"><div class="text-black css-b62m3t-container">`
      + `<span id="react-select-${rs.id}-live-region" class="css-1f43avz-a11yText-A11yText"></span><span aria-live="polite" aria-atomic="false" aria-relevant="additions text" role="log" class="css-1f43avz-a11yText-A11yText">${live}</span>`
      + `<div class="${P}__control${rs.focused ? ` ${P}__control--is-focused` : ''}${rs.open ? ` ${P}__control--menu-is-open` : ''} ${error ? 'css-17s7gnj-control' : 'css-1ajzppd-control'}" data-ai-rs-control="category">`
      + `<div class="${P}__value-container${selected ? ` ${P}__value-container--has-value` : ''} css-8akrpk">`
      + (selected && !rs.input ? `<div class="${P}__single-value css-1gijnra-singleValue">${esc(selected.label)}</div>` : !rs.input ? `<div class="${P}__placeholder css-yyp97q-placeholder" id="react-select-${rs.id}-placeholder">Select Category</div>` : '')
      + `<div class="${P}__input-container css-1lx7dxn" data-value="${esc(rs.input)}"><input class="${P}__input" autocapitalize="none" autocomplete="off" autocorrect="off" id="${P}-input" spellcheck="false" tabindex="0" type="text" aria-autocomplete="list" aria-expanded="${rs.open}" aria-haspopup="true" role="combobox"${selected ? '' : ` aria-describedby="react-select-${rs.id}-placeholder"`} value="${esc(rs.input)}" style="color: inherit; background: 0px center; opacity: ${selected && rs.focused && !rs.open && !rs.input ? 0 : 1}; width: 100%; grid-area: 1 / 2; font: inherit; min-width: 2px; border: 0px; margin: 0px; outline: 0px; padding: 0px;"${rs.open ? ` aria-controls="react-select-${rs.id}-listbox"` : ''} data-ai-rs-input="category"></div></div>`
      + `<div class="${P}__indicators css-1wy0on6">${selected ? `<div class="${P}__indicator ${P}__clear-indicator ${ind}" aria-hidden="true" data-ai-rs-clear="category">${CROSS}</div>` : ''}<span class="${P}__indicator-separator css-1hyfx7x"></span><div class="${P}__indicator ${P}__dropdown-indicator ${ind}" aria-hidden="true">${ARROW}</div></div></div></div></div>`;
  }
  function categoryMenu(control) {
    const r = control.getBoundingClientRect();
    const rs = f.rs;
    const shown = shownCategoryOptions();
    const q = rs.input.trim();
    const hasMatch = shown.some((o) => !o.isAddNewOption);
    return `<div class="add-item-category__menu-portal" style="left: ${r.left}px; position: absolute; top: ${r.bottom + window.scrollY}px; width: ${r.width}px; z-index: 10000;"><div class="add-item-category__menu css-12szh8u-menu"><div class="add-item-category__menu-list css-qr46ko" role="listbox" aria-multiselectable="false" id="react-select-${rs.id}-listbox">`
      + shown.map((o, i) => (o.isAddNewOption
        ? `<div id="react-select-${rs.id}-option-${i}" tabindex="-1" role="option" data-testid="add-item-category-add-new-option" class="flex items-center justify-between p-2 cursor-pointer bg-blue-50 hover:bg-blue-100" style="border-bottom: 1px solid rgb(229, 231, 235);" data-ai-option="add_new"><span class="flex items-center gap-2 text-blue-700 font-semibold">${lucide('Plus', { size: 16 })} ${T}${esc(o.label)}</span></div>`
        : `<div id="react-select-${rs.id}-option-${i}" tabindex="-1" role="option" data-testid="add-item-category-option-${esc(o.value)}" data-status="${o.isDisabled ? 'disabled' : 'enabled'}" class="p-2 cursor-pointer ${o.isDisabled ? 'opacity-40 cursor-not-allowed' : i === rs.focus ? 'bg-blue-600 text-white' : 'bg-white text-black'}" data-ai-option="${esc(o.value)}"${o.isDisabled ? ' aria-disabled="true"' : ''}>${esc(o.label)}</div>`)).join('')
      + (q && !hasMatch ? '<div class="px-3 py-2 text-center text-sm text-gray-400">No options</div>' : '')
      + '</div></div></div>';
  }

  function imageSlot(url, i) {
    const id = `add-item-image-slot-${i}`;
    const uploading = Boolean(f.uploadingSlots?.[i]);
    const err = f.uploadErrors[i];
    return `<div class="w-16 sm:w-24 text-center relative" data-testid="${id}" data-status="${url ? 'filled' : uploading ? 'uploading' : 'empty'}"><input type="file" accept="image/*" class="hidden" data-testid="${id}-file-input" data-ai-file="${i}">`
      + (url ? `<div class="relative inline-block w-16 h-16 sm:w-24 sm:h-24 rounded-md border border-gray-100 bg-white"><img class="w-full h-full object-cover rounded-md p-2" data-testid="${id}-image" src="${esc(url)}" alt="product"><div class="absolute top-0 right-0 flex gap-2 p-1 z-30"><button type="button" data-testid="${id}-remove-btn" class="text-red-500 bg-white/90 rounded-full p-0.5 shadow-sm" title="Remove image" data-ai="remove-image" data-index="${i}">${fi('FiXCircle', { cls: 'w-4 h-4' })}</button></div></div>`
        : `<div role="button" tabindex="0" data-testid="${id}-dropzone" class="border-2 border-gray-300 border-dashed rounded-md cursor-pointer w-16 h-16 sm:w-24 sm:h-24 p-2 flex items-center justify-center bg-gray-50 transition-transform duration-150 hover:scale-[1.03] active:scale-[0.97] ${uploading ? 'opacity-60 cursor-wait' : ''}" data-ai="pick-image" data-index="${i}">${uploading ? '<span class="text-[11px] font-medium text-gray-500">Uploading...</span>' : fi('FiPlusCircle', { cls: 'text-3xl text-green-500' })}</div>`)
      + (err && !uploading ? `<p data-testid="${id}-error" class="mt-1 text-[11px] text-red-500 text-left">${esc(err)}</p>` : '')
      + '</div>';
  }

  function form() {
    const summary = f.units ? { base: f.units.baseUnit, secondary: f.units.secondaryUnit, boxes: f.units.conversionRate, price: Number(pickDisplayUnitPrice(f.units, unitIndex)).toFixed(2) } : null;
    const busy = f.submitting || f.uploads > 0;
    return `<form class="flex flex-col h-full min-h-0" data-testid="add-item-form" data-ai-form><div class="px-0 pt-4 flex-1 min-h-0 w-full overflow-y-auto scrollbar-hide">`
      + `<div class="${ROW}">${labelArea('Title/Name', true)}<div class="${FIELD} title">${inputArea({ name: 'title', value: f.title, placeholder: 'Title/Name', error: f.submitted ? f.errors.title : '', touched: f.titleTouched })}${errorSpan(f.submitted ? f.errors.title : '', 'title')}</div></div>`
      + `<div class="${ROW}">${labelArea('Images')}<div class="${FIELD} grid grid-cols-4 gap-4">${f.images.map(imageSlot).join('')}</div></div>`
      + `<div class="${ROW}">${labelArea('Category', true)}<div class="${FIELD}">${categorySelect()}${f.submitted && f.errors.category ? errorSpan(f.errors.category, 'category') : ''}</div></div>`
      + `<div class="${ROW}">${labelArea('Unit &amp; Price', true)}<div class="${FIELD}"><div class="${summary ? 'flex flex-wrap items-center gap-2' : ''}">`
      + (summary
        ? `<button type="button" data-testid="add-product-form-edit-unit-price-btn" class="rounded-lg font-medium transition-colors px-2 md:py-1 py-2 h-10 border border-blue-200 flex-shrink-0 w-full sm:w-auto lg:w-48 text-sm bg-blue-50 text-blue-700 hover:text-gray-700 hover:bg-blue-100" data-ai="unit-open">Edit Unit &amp; Price</button><div class="flex flex-wrap items-center gap-1 sm:gap-2"><span class="text-sm text-blue-600 font-medium whitespace-nowrap" data-testid="add-item-unit-summary">1 ${T}${esc(summary.base)}${T} = ${T}${esc(summary.boxes)}${T} ${T}${esc(summary.secondary)}</span><span class="text-gray-400">•</span><span class="text-sm text-green-600 font-medium whitespace-nowrap">${esc(currency)}${T}${NB}${T}${esc(summary.price)}</span></div>`
        : '<button type="button" data-testid="add-product-form-select-unit-price-btn" class="rounded-lg font-medium transition-colors px-2 md:py-1 py-2 h-10 border border-gray-300 w-full lg:w-48 text-sm bg-gray-50 hover:bg-gray-100 text-gray-700" data-ai="unit-open">Select Unit &amp; Price</button>')
      + `</div>${f.unitError ? errorSpan(f.unitError, 'unit') : ''}</div></div></div>`
      + '<div class="flex-shrink-0 flex gap-3 py-3 px-0 border-t border-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"><div class="flex-1">'
      + (busy
        ? `<button class="${buttonClass({ disabled: true, cls: 'w-full h-11' })}" disabled="" type="button" data-testid="add-product-form-submit-btn"><svg class="animate-spin w-5 h-5" viewBox="0 0 50 50" aria-hidden="true"><circle cx="25" cy="25" r="20" stroke="currentColor" stroke-width="4" fill="none" stroke-dasharray="80" stroke-dashoffset="60" stroke-linecap="round"></circle></svg><span class="font-serif ml-2 font-light">${f.uploads > 0 ? 'Uploading' : 'Processing'}</span></button>`
        : `<button class="${buttonClass({ cls: 'w-full h-11' })}" type="submit" data-testid="add-product-form-submit-btn">Add Product</button>`)
      + `</div><button class="${buttonClass({ layout: 'outline', cls: 'flex-1 h-11 bg-white text-red-500 hover:bg-red-50 hover:border-red-100 hover:text-red-600 dark:bg-gray-700 dark:border-gray-700 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-red-700' })}" type="button" data-testid="add-product-form-cancel-btn" data-ai="close">Cancel</button></div></form>`;
  }

  // ── AddCategoryModal ──
  function openCategory() {
    cat = { name: '', description: '', otherParentName: '', nameTouched: false, otherTouched: false, submitted: false, errors: {}, selection: { kind: 'none' }, imageUrl: '', submitting: false, rs: selectState(), focusName: false };
  }
  const parentOptions = () => [{ value: 'other', label: 'Add New Parent Category', isAddNewOption: true }, ...(f.rootCategories || []).map((c) => ({ value: c._id ?? c.id, label: titleCase(c.name) }))];
  const shownParentOptions = () => { const q = cat.rs.input.trim().toLowerCase(); return parentOptions().filter((o) => o.isAddNewOption || !q || o.label.toLowerCase().includes(q) || String(o.value).toLowerCase().includes(q)); };
  function validateCategory() {
    const e = {};
    const n = cat.name;
    if (!n) e.name = 'Category title is required!'; else if (!n.trim()) e.name = 'Category title cannot be empty'; else if (!CATEGORY_TITLE_PATTERN.test(n)) e.name = 'Category title must include at least one letter.';
    if (cat.selection.kind === 'other') { const o = cat.otherParentName; if (!o) e.otherParentName = 'Parent Category Name is required!'; else if (!o.trim()) e.otherParentName = 'Parent Category Name cannot be empty'; }
    cat.errors = e;
    return !Object.keys(e).length;
  }
  function parentSelect() {
    const rs = cat.rs;
    const P = 'add-category-parent-select';
    const sel = cat.selection;
    const value = sel.kind === 'other' ? parentOptions()[0] : sel.kind === 'existing' ? { value: sel.id, label: sel.label } : null;
    const shown = shownParentOptions();
    const live = !rs.focused ? '' : rs.open
      ? `<span id="aria-selection"></span><span id="aria-focused">${esc(shown[rs.focus] ? ARIA.focused(shown[rs.focus].label, rs.focus, shown.length) : '')}</span><span id="aria-results">${esc(ARIA.results(shown.length))}</span><span id="aria-guidance">${esc(ARIA.guidanceMenu)}</span>`
      : `<span id="aria-selection">${rs.selected && value ? esc(ARIA.selected(value.label)) : ''}</span><span id="aria-focused"></span><span id="aria-results"></span><span id="aria-guidance"></span>`;
    const ind = rs.focused ? 'css-15lsz6c-indicatorContainer' : 'css-1xc3v61-indicatorContainer';
    return `<div class="css-b62m3t-container"><span id="react-select-${rs.id}-live-region" class="css-1f43avz-a11yText-A11yText"></span><span aria-live="polite" aria-atomic="false" aria-relevant="additions text" role="log" class="css-1f43avz-a11yText-A11yText">${live}</span>`
      + `<div class="${P}__control${rs.focused ? ` ${P}__control--is-focused` : ''}${rs.open ? ` ${P}__control--menu-is-open` : ''} ${rs.focused ? 'css-1i9w8ai-control' : 'css-11n4q5z-control'}" data-ai-rs-control="parent"><div class="${P}__value-container${value ? ` ${P}__value-container--has-value` : ''} css-8akrpk">`
      + (value && !rs.input ? `<div class="${P}__single-value css-1gijnra-singleValue">${esc(value.label)}</div>` : !rs.input ? `<div class="${P}__placeholder css-1jqq78o-placeholder" id="react-select-${rs.id}-placeholder">Select Parent Category</div>` : '')
      + `<div class="${P}__input-container css-1lx7dxn" data-value="${esc(rs.input)}"><input class="${P}__input" autocapitalize="none" autocomplete="off" autocorrect="off" id="add-category-modal-parent-select-input" spellcheck="false" tabindex="0" type="text" aria-autocomplete="list" aria-expanded="${rs.open}" aria-haspopup="true" role="combobox"${value ? '' : ` aria-describedby="react-select-${rs.id}-placeholder"`} value="${esc(rs.input)}" style="color: inherit; background: 0px center; opacity: ${value && rs.focused && !rs.open && !rs.input ? 0 : 1}; width: 100%; grid-area: 1 / 2; font: inherit; min-width: 2px; border: 0px; margin: 0px; outline: 0px; padding: 0px;"${rs.open ? ` aria-controls="react-select-${rs.id}-listbox"` : ''} data-ai-rs-input="parent"></div></div>`
      + `<div class="${P}__indicators css-1wy0on6">${value ? `<div class="${P}__indicator ${P}__clear-indicator ${ind}" aria-hidden="true" data-ai-rs-clear="parent">${CROSS}</div>` : ''}<span class="${P}__indicator-separator css-1hyfx7x"></span><div class="${P}__indicator ${P}__dropdown-indicator ${ind}" aria-hidden="true">${ARROW}</div></div></div></div>`;
  }
  function parentMenu(control) {
    const r = control.getBoundingClientRect();
    const rs = cat.rs;
    const shown = shownParentOptions();
    const q = rs.input.trim();
    return `<div class="add-category-parent-select__menu-portal" style="left: ${r.left}px; position: fixed; top: ${r.bottom}px; width: ${r.width}px; z-index: 99999;"><div class="add-category-parent-select__menu css-157veow-menu"><div class="add-category-parent-select__menu-list css-cg4jzo" role="listbox" aria-multiselectable="false" id="react-select-${rs.id}-listbox">`
      + shown.map((o, i) => (o.isAddNewOption
        ? `<div id="react-select-${rs.id}-option-${i}" tabindex="-1" role="option" data-testid="parent-category-add-new-option" class="flex cursor-pointer items-center gap-2 border-b border-gray-200 bg-blue-50 px-3 py-2 font-semibold text-blue-700 hover:bg-blue-100" data-ai-parent-option="other">${lucide('Plus', { size: 16 })}<span>${esc(o.label)}</span></div>`
        : `<div class="add-category-parent-select__option${i === rs.focus ? ' add-category-parent-select__option--is-focused' : ''} ${i === rs.focus ? 'css-d7l1ni-option' : 'css-10wo9uf-option'}" aria-disabled="false" id="react-select-${rs.id}-option-${i}" tabindex="-1" role="option" data-ai-parent-option="${esc(o.value)}">${esc(o.label)}</div>`)).join('')
      + (q && !shown.some((o) => !o.isAddNewOption) ? '<div data-testid="parent-category-menu-empty" class="px-3 py-2 text-center text-sm text-gray-400">No options</div>' : '')
      + '</div></div></div>';
  }
  function categoryModal() {
    if (!cat) return '<!--add-category-->';
    const e = cat.submitted ? cat.errors : {};
    const img = cat.imageUrl
      ? `<div class="relative inline-block"><img class="border rounded-md border-gray-100 w-24 h-24 object-cover p-2" data-testid="add-category-modal-image-uploader-image" src="${esc(cat.imageUrl)}" alt="category"><div class="absolute top-0 right-0 flex gap-2"><button type="button" class="text-blue-500" data-testid="add-category-modal-image-uploader-edit-btn" aria-label="Change image" data-ai="category-image">${fi('FiEdit')}</button></div></div>`
      : `<div role="button" tabindex="0" data-testid="add-category-modal-image-uploader-dropzone" class="border-2 border-gray-300 border-dashed rounded-md cursor-pointer px-4 py-6 flex items-center justify-center" style="height: 100%;" data-ai="category-image"><span class="mx-auto flex justify-center">${fi('FiPlusCircle', { cls: 'text-3xl text-green-500' })}</span></div>`;
    const content = '<form data-ai-category-form><div class="w-full relative dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"><div class="flex md:flex-row flex-col justify-between mr-20"><div><h4 data-testid="add-category-modal-title" class="text-xl font-medium dark:text-gray-300">Add Category</h4><p data-testid="add-category-modal-title-subtitle" class="mb-0 text-sm dark:text-gray-300">Add your Product category and necessary information from here</p></div></div></div>'
      + '<div class="pt-6">'
      + `<div class="${ROW}">${labelArea('Name', true)}<div class="${FIELD}">${inputArea({ name: 'name', value: cat.name, placeholder: 'Category Title', error: e.name, touched: cat.nameTouched })}${errorSpan(e.name, 'name')}</div></div>`
      + `<div class="${ROW}">${labelArea('Description')}<div class="${FIELD}"><textarea class="${THEME.textarea.base} ${THEME.textarea.active} border text-sm border-gray-200 focus:border-gray-300 block w-full bg-gray-100" name="description" placeholder="Description" rows="4" spellcheck="false" data-testid="add-category-modal-description" data-ai-field="description">${esc(cat.description)}</textarea></div></div>`
      + `<div class="${ROW}">${labelArea('Parent Category')}<div data-testid="add-category-modal-parent-select" class="${FIELD}">${parentSelect()}</div></div>`
      + (cat.selection.kind === 'other' ? `<div class="grid grid-cols-6 gap-3 mb-6">${labelArea('Parent Category Name', true)}<div class="${FIELD}">${inputArea({ name: 'otherParentName', value: cat.otherParentName, placeholder: 'Enter new parent category name', error: e.otherParentName, touched: cat.otherTouched })}${errorSpan(e.otherParentName, 'otherParentName')}</div></div>` : '')
      + `<div class="grid grid-cols-6 gap-3 mb-6">${labelArea('Image')}<div class="${FIELD}"><div class="w-28 text-center" data-testid="add-category-modal-image-uploader" data-status="${cat.imageUrl ? 'filled' : 'empty'}"><input type="file" accept=".jpeg,.jpg,.png,.webp,image/jpeg,image/png,image/webp" class="hidden" data-testid="add-category-modal-image-uploader-file-input" data-ai-category-file>${img}</div></div></div></div>`
      + '<div class="flex justify-end gap-4 pt-4 border-t border-gray-200 pb-4">'
      + `<button class="${buttonClass({ layout: 'outline', cls: 'text-red-500 !mr-0 bg-white hover:bg-red-50 h-10 hover:border-red-100 hover:text-red-600 dark:hover:text-red-700' })}" type="button" data-testid="add-category-modal-cancel-btn" data-ai="category-close">Cancel</button>`
      + `<button class="${buttonClass({ disabled: cat.submitting, cls: 'w-full' })}" type="button"${cat.submitting ? ' disabled=""' : ''} data-testid="add-category-modal-submit-btn" data-ai="category-submit">${cat.submitting ? 'Processing' : 'Add Category'}</button></div></form>`;
    return customModal({ size: 'md', zIndex: '70', testId: 'add-category', closeAct: 'ai-category-close', content });
  }
  async function submitCategory() {
    cat.submitted = true;
    if (!validateCategory()) { cat.focusName = Boolean(cat.errors.name); rerender(); return; }
    const c = cat;
    const roots = f.rootCategories || [];
    const sel = c.selection;
    let plan;
    if (sel.kind === 'other') {
      const parentName = String(c.otherParentName ?? '').trim();
      let existing = null;
      for (const r of roots) if (r?.name?.toLowerCase() === parentName.toLowerCase()) existing = r;
      plan = existing ? { reuse: { parentId: String(existing._id || existing.id), parentName: String(existing.name) } } : { create: { name: { en: parentName }, icon: '', lang: 'en', description: {}, parentName: 'Home' }, fallbackParentName: parentName };
    } else if (sel.kind === 'none' || !sel.label || sel.label.toLowerCase() === 'home') {
      if (roots.map((r) => r?.name?.toLowerCase()).includes(String(c.name).toLowerCase())) plan = { error: { field: 'name', message: 'Parent Category Name Already Exist' } };
      else plan = { create: { name: c.name.trim() ? { en: c.name } : {}, icon: '', lang: 'en', description: {}, parentName: 'Home' }, fallbackParentName: c.name };
    } else plan = { reuse: { parentId: sel.id, parentName: sel.label } };
    if (plan.error) { c.errors = { ...c.errors, [plan.error.field]: plan.error.message }; host.notify('error', plan.error.message); rerender(); return; }
    c.submitting = true; rerender();
    try {
      let parentId; let parentName;
      if (plan.reuse) ({ parentId, parentName } = plan.reuse);
      else {
        const pr = await resolveRefusal(server.createCategory(plan.create));
        if (!pr?.status) throw new Error(pr?.message || 'Failed to add category');
        parentId = pr?.data?.categoryRef; parentName = pr?.data?.category?.name || plan.fallbackParentName;
      }
      const res = await resolveRefusal(server.createCategory({
        name: c.name.trim() ? { en: c.name } : {}, description: String(c.description || '').trim() ? { en: c.description } : {}, parentId,
        parentName: sel.kind === 'other' ? String(parentName ?? '').trim() : parentName, icon: typeof c.imageUrl === 'string' && c.imageUrl.startsWith('data:image/') ? c.imageUrl : '', lang: 'en',
      }));
      if (!res?.status) throw new Error(res?.message || 'Failed to add category');
      // handleNewCategory: close, reload both lists, then select the new category.
      cat = null; clearPortal(); rerender();
      await Promise.all([loadCategories(), loadRoots()]);
      if (res?.data?.categoryRef && f) { f.category = res.data.categoryRef; if (f.submitted) validate(); rerender(); }
      host.notify('success', res.message);
    } catch (err) {
      host.notify('error', err?.response?.data?.message || err?.message);
    } finally {
      if (cat === c) { c.submitting = false; rerender(); }
    }
  }

  // ── UnitPriceModal (FormModal, portalled) ──
  const showPallet = () => (appProp.supportedUnitIndexLevel == null ? unitIndex > 1 : appProp.supportedUnitIndexLevel >= 2);
  const showBase = () => appProp.supportedUnitIndexLevel == null || appProp.supportedUnitIndexLevel >= 1;
  const units = () => parseUnitMap(appProp.unitMap);
  const addGst = (price, tax) => { const n = Number(price) || 0; const t = Number(tax) || 0; return t > 0 ? n * (1 + t / 100) : n; };
  const hasValue = (v) => v !== '' && v !== null && v !== undefined && parseFloat(v) > 0;
  const fmt = (v) => { const n = Number(v); return Number.isFinite(n) ? n.toFixed(2) : ''; };
  const positive = (v, d = 1) => { const n = parseFloat(v); return Number.isFinite(n) && n > 0 ? n : d; };
  function openUnits() {
    const init = f.units ? { unit: buildUnitString(f.units), boxes: f.units.conversionRate, pallets: f.units.palletConversionRate, tax: f.units.tax, priceMap: buildPriceMap(f.units) } : null;
    unit = { id: `:r${formModalIds++}:`, secondaryUnit: null, baseUnit: null, palletUnit: null, rate: 1, palletRate: 1, secondaryPrice: '', price: '', palletPrice: '', tax: `${init?.tax || 0}%`, taxType: 'With GST', menu: null, adding: false, newValue: '', init };
    if (init?.unit) {
      const [su, bu, pu] = init.unit.split('-');
      const pm = init.priceMap || {};
      Object.assign(unit, { secondaryUnit: su, baseUnit: bu, palletUnit: pu ?? null, rate: init.boxes ?? 1, palletRate: init.pallets ?? 1, secondaryPrice: hasValue(pm[su]) ? addGst(pm[su], init.tax).toFixed(2) : '', price: hasValue(pm[bu]) ? addGst(pm[bu], init.tax).toFixed(2) : '', palletPrice: pu && hasValue(pm[pu]) ? addGst(pm[pu], init.tax).toFixed(2) : '' });
    }
    unitDefaults();
    document.body.style.overflow = 'hidden';
  }
  function unitDefaults() {
    const u = units();
    if (u.palletUnits.length && !unit.palletUnit && !unit.init?.unit && !showPallet()) unit.palletUnit = 'Pallet';
    if (u.baseUnits.length && !unit.baseUnit && !unit.init?.unit && !showBase()) unit.baseUnit = 'Box';
  }
  function closeUnits() { unit = null; document.body.style.overflow = ''; clearPortal(); }
  const syncSecondary = (v, rate = unit.rate, pr = unit.palletRate) => { if (v === '') { unit.secondaryPrice = ''; unit.price = ''; unit.palletPrice = ''; return; } const s = parseFloat(v); if (!Number.isFinite(s)) return; const b = s * positive(rate); unit.secondaryPrice = v; unit.price = fmt(b); if (showPallet()) unit.palletPrice = fmt(b * positive(pr)); };
  const syncBase = (v, rate = unit.rate, pr = unit.palletRate) => { if (v === '') { unit.secondaryPrice = ''; unit.price = ''; unit.palletPrice = ''; return; } const b = parseFloat(v); if (!Number.isFinite(b)) return; unit.price = v; unit.secondaryPrice = fmt(b / positive(rate)); if (showPallet()) unit.palletPrice = fmt(b * positive(pr)); };
  const syncPallet = (v, rate = unit.rate, pr = unit.palletRate) => { if (v === '') { unit.secondaryPrice = ''; unit.price = ''; unit.palletPrice = ''; return; } const p = parseFloat(v); if (!Number.isFinite(p)) return; const b = p / positive(pr); unit.palletPrice = v; unit.price = fmt(b); unit.secondaryPrice = fmt(b / positive(rate)); };
  function saveUnits() {
    let t = unit.tax; if (t.includes('%')) t = t.split('%')[0];
    const tax = Number(t);
    const strip = (v) => { const n = parseFloat(v) || 0; return unit.taxType === 'With GST' && tax > 0 ? n / (1 + tax / 100) : n; };
    const base = strip(unit.price);
    const sel = { baseUnit: unit.baseUnit, secondaryUnit: unit.secondaryUnit, conversionRate: Number(unit.rate), tax, price: strip(unit.secondaryPrice), baseUnitPrice: base, palletUnitPrice: !showPallet() ? base : strip(unit.palletPrice), palletUnit: unit.palletUnit, palletConversionRate: parseFloat(unit.palletRate) };
    // AddItemForm.handleUnitsSave
    f.units = { secondaryUnit: sel.secondaryUnit, baseUnit: sel.baseUnit, palletUnit: sel.palletUnit && sel.palletUnit !== 'undefined' ? sel.palletUnit : null, conversionRate: sel.conversionRate || 1, palletConversionRate: sel.palletConversionRate || 1, price: sel.price || 0, baseUnitPrice: sel.baseUnitPrice || 0, palletUnitPrice: sel.palletUnitPrice || 0, tax: sel.tax || '' };
    f.unitError = null;
    closeUnits();
  }
  const infoTip = (id) => `<span data-tooltip-id="${id}" data-testid="${id}" class="text-md">${fi('FiInfo', { cls: 'w-3 h-3 ml-1 text-gray-400' })}</span>`;
  function productSelect({ key, options, value, placeholder, addNew = false, addNewLabel = 'Add new', addNewPlaceholder = 'Enter name' }) {
    const tid = `${U}-${key}`;
    const openNow = unit.menu === key;
    const valid = /^[a-zA-Z0-9 ]+$/.test(unit.newValue);
    const confirmDisabled = !unit.newValue.trim() || !valid;
    return `<div class="relative" data-ai-ps="${key}"><button type="button" data-testid="${tid}" data-status="${openNow ? 'open' : 'closed'}" class="w-full px-3 py-2 text-left text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 flex items-center justify-between " data-ai-ps-toggle="${key}"><span data-testid="${tid}-value" class="text-gray-900">${esc(value ? titleCase(value) : placeholder)}</span>${lucide('ChevronDown', { cls: 'w-5 h-5 text-gray-400 ' })}</button>`
      + (openNow ? `<div data-testid="${tid}-menu" class="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">${options.map((o) => `<div data-testid="${tid}-option-${esc(o)}" data-status="${value === o ? 'selected' : 'unselected'}" class="px-3 py-2 text-sm cursor-pointer hover:bg-gray-50 flex items-center justify-between text-gray-900" data-ai-ps-option="${key}" data-value="${esc(o)}"><span>${esc(titleCase(o))}</span>${value === o ? lucide('Check', { cls: 'w-5 h-5 text-green-600' }) : ''}</div>`).join('')}`
        + (addNew ? `<div class="border-t border-gray-200">${!unit.adding ? `<div data-testid="${tid}-add-new-btn" class="px-3 py-2 text-sm cursor-pointer hover:bg-gray-50 flex items-center gap-2 text-blue-600" data-ai-ps-add="${key}">${lucide('Plus', { cls: 'w-4 h-4' })}<span>${esc(addNewLabel)}</span></div>`
          : `<div class="px-3 py-2 flex items-center gap-2"><input type="text" data-testid="${tid}-add-new-input" class="w-[75%] px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 flex-1" placeholder="${esc(addNewPlaceholder)}" value="${esc(unit.newValue)}" data-ai-ps-new="${key}"><button type="button"${confirmDisabled ? ' disabled=""' : ''} data-testid="${tid}-add-new-confirm-btn" class="shrink-0 ${!confirmDisabled ? 'text-green-600' : 'text-gray-300 cursor-not-allowed'}" data-ai-ps-confirm="${key}">${lucide('Check', { cls: 'w-5 h-5', strokeWidth: 2.5 })}</button></div>`}</div>` : '')
        + '</div>' : '')
      + '</div>';
  }
  function unitModal() {
    const u = units();
    const sp = showPallet(); const sb = showBase();
    const chosen = unit.baseUnit && unit.secondaryUnit && (!sp || (sp && unit.palletUnit));
    const saveDisabled = !unit.baseUnit || !unit.secondaryUnit || !unit.rate || unit.rate <= 0;
    const priceStyle = `padding-left: calc(${currency.length}ch + 20px);`;
    const col = (label, tip, hint, key, options, value) => `<div><label class="flex items-center text-sm font-medium text-blue-600 mb-0.5">${label}<span class="text-red-500 ml-1">*</span>${infoTip(tip)}</label><p class="text-xs text-gray-400 mb-1.5">${hint}</p>${productSelect({ key, options, value, placeholder: 'Select or add unit' })}</div>`;
    const conv = (a, b, key, value, tip) => `<div><label class="flex items-center text-sm font-medium text-blue-600 mb-1.5">How many <span class="uppercase mx-1">${esc(a)}</span> per${T} <span class="uppercase mx-1">${esc(b)}</span>?<span class="text-red-500 ml-1">*</span>${infoTip(tip)}</label><div class="flex items-center gap-3"><span class="text-sm text-gray-400 shrink-0">1 <span class="font-semibold text-gray-600 uppercase">${esc(b)}</span> =</span><input type="number" inputmode="numeric" min="1" data-testid="${U}-${key}-conversion-input" class="w-24 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center" value="${esc(value)}" data-ai-conv="${key}"><span class="text-sm font-semibold text-gray-600 uppercase shrink-0">${esc(a)}</span></div></div>`;
    const priceRow = (which, unitName, tip, value, style, cls = 'relative flex items-center', symbolCls = 'absolute left-1 top-1/2 -translate-y-1/2 text-gray-500 whitespace-nowrap', inputCls = 'w-full pr-3 py-2') => `<div><label class="flex items-center text-sm font-medium text-blue-600 mb-1.5">Selling Price Per${T} <span class="uppercase ml-1">${esc(unitName)}</span>${infoTip(tip)}</label><div class="${cls}"><span class="${symbolCls}">${esc(currency)}</span><input type="number" min="0" step="0.01" data-testid="${U}-${which}-price-input"${style ? ` style="${style}"` : ''} class="${inputCls} border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="0.00" value="${esc(value)}" data-ai-price="${which}"></div></div>`;
    const body = `<div class="grid grid-cols-1 ${sp ? 'sm:grid-cols-3' : sb ? 'sm:grid-cols-2' : ''} gap-4 mb-4">`
      + col('Smallest Unit', 'add-item-smallest-unit-tooltip', 'e.g. Bottle, Piece, KG', 'secondary-unit', u.secondaryUnits, unit.secondaryUnit)
      + (sb ? col('Base Unit', 'add-item-base-unit-tooltip', 'e.g. Box, Carton, Dozen', 'base-unit', u.baseUnits, unit.baseUnit) : '')
      + (sp ? col('Largest Unit', 'add-item-largest-unit-tooltip', 'e.g. Pallet, Container', 'pallet-unit', u.palletUnits, unit.palletUnit) : '')
      + '</div>'
      + (chosen ? `<div class="mb-4 space-y-3">${sp ? conv(unit.baseUnit, unit.palletUnit, 'pallet', unit.palletRate, 'add-item-pallet-conversion-tooltip') : ''}${conv(unit.secondaryUnit, unit.baseUnit, 'base', unit.rate, 'add-item-base-conversion-tooltip')}</div>` : '')
      + (chosen ? `<div class="mb-5 rounded-lg border border-gray-200 bg-gray-50 p-4"><div class="mb-3"><h3 class="flex items-center text-sm font-semibold text-gray-800">Tax Settings${fi('FiInfo', { cls: 'ml-1 h-3.5 w-3.5 text-gray-400' })}</h3><p class="mt-0.5 text-xs text-gray-500">Set the GST details for pricing.</p></div><div class="grid grid-cols-1 gap-4 sm:grid-cols-2"><div><label class="mb-1.5 flex items-center text-sm font-medium text-gray-700">GST Rate (%)<span class="ml-1 text-red-500">*</span></label>${productSelect({ key: 'tax-rate', options: TAX_OPTIONS, value: unit.tax, placeholder: 'Select tax rate', addNew: true, addNewLabel: 'Add new GST rate', addNewPlaceholder: 'Enter GST rate (e.g. 12)' })}</div>`
        + `<fieldset><legend class="mb-1.5 text-sm font-medium text-gray-700">GST Treatment <span class="text-red-500">*</span></legend><div class="grid grid-cols-2 gap-2">${[['With GST', 'Included in Price', 'Price already includes GST.'], ['Without GST', 'Added Separately', 'GST will be added on top.']].map(([v, l, d]) => { const s = unit.taxType === v; return `<button type="button" data-testid="${U}-tax-type-btn-${v.toLowerCase().replace(/\s+/g, '-')}" data-status="${s ? 'selected' : 'unselected'}" class="flex min-h-[58px] items-start gap-2 rounded-md border p-2 text-left transition-colors ${s ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' : 'border-gray-300 bg-white hover:border-gray-400'}" data-ai-taxtype="${v}"><span class="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${s ? 'border-blue-500' : 'border-gray-400'}">${s ? '<span class="h-2 w-2 rounded-full bg-blue-500"></span>' : ''}</span><span><span class="block text-xs font-semibold text-gray-800">${l}</span><span class="mt-0.5 block text-[10px] leading-3 text-gray-500">${d}</span></span></button>`; }).join('')}</div></fieldset></div></div>` : '')
      + (chosen ? `<div class="grid gap-4 mb-6">${priceRow('secondary', unit.secondaryUnit, 'add-item-secondary-price-tooltip', unit.secondaryPrice, priceStyle)}${priceRow('base', unit.baseUnit, 'add-item-base-price-tooltip', unit.price, priceStyle)}${sp ? priceRow('pallet', unit.palletUnit, 'add-item-pallet-price-tooltip', unit.palletPrice, '', 'relative', 'absolute left-1 top-1/2 transform -translate-y-1/2 text-gray-500', 'w-full pl-8 pr-3 py-2') : ''}</div>` : '')
      + `<div class="mb-2"><button type="button" data-testid="${U}-save-btn" class="w-full ${saveDisabled ? 'bg-gray-300 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600'} text-white font-medium py-2 px-4 rounded-md transition-colors"${saveDisabled ? ' disabled=""' : ''} data-ai-unit-save>SAVE</button></div>`;
    return `<div class="fixed inset-0 bg-black/50" role="dialog" aria-modal="true" aria-labelledby="${unit.id}" style="z-index: 9999;" data-ai-overlay><div class="h-full w-full overflow-y-auto px-4 py-4"><div class="min-h-full flex items-start justify-center sm:items-center"><div data-testid="unit-price-modal" class="relative w-full max-w-4xl rounded-xl bg-white dark:bg-gray-800 shadow-2xl overflow-visible" data-ai-panel>`
      + `<div class="flex items-center justify-between gap-4 px-6 pt-5 pb-4 border-b border-gray-100 dark:border-gray-700"><div><h2 id="${unit.id}" class="text-lg font-semibold text-gray-800 dark:text-gray-100">Add Pricing and Unit Details</h2><p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Configure selling units, conversion quantities, GST treatment, and prices.</p></div><button data-testid="unit-price-modal-close-btn" class="shrink-0 inline-flex h-10 w-10 items-center justify-center rounded-lg text-gray-500 hover:text-gray-800 dark:text-gray-300 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 transition" aria-label="Close modal" type="button" data-ai-unit-close>${lucide('X', { cls: 'w-5 h-5' })}</button></div>`
      + `<div class="p-6 overflow-visible">${body}</div></div></div></div></div>`;
  }

  // ── Render ──
  function render() {
    if (!m) return '<!--add-new-item-->';
    const inner = m.type === null ? typePicker()
      : `<div class="flex flex-col h-full min-h-0"><div class="flex items-center gap-2 mb-3 flex-shrink-0"><button type="button" data-testid="create-order-add-item-back-btn" class="p-1.5 -ml-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors" title="Back" data-ai="back">${lucide('ChevronLeft', { cls: 'w-4 h-4' })}</button><h3 class="text-base font-semibold text-gray-900 dark:text-white">${m.type === 'RAW-MATERIAL' ? 'Add New Raw Material' : 'Add New Finished Product'}</h3></div>${categoryModal()}${form()}</div>`;
    return customModal({ size: 'lg', zIndex: '60', testId: 'create-order-add-item', closeAct: 'ai-close', content: inner });
  }
  /** Portalled parts: whichever select menu is open (category or parent) and the unit modal. */
  function afterRender(root) {
    if (!m) { clearPortal(); return; }
    if (f?.focusTitle) { f.focusTitle = false; root.querySelector('[data-ai-field="title"]')?.focus(); }
    if (cat?.focusName) { cat.focusName = false; root.querySelector('[data-ai-field="name"]')?.focus(); }
    let html = '';
    if (f?.rs.open) { const c = root.querySelector('[data-ai-rs-control="category"]'); if (c) html += categoryMenu(c); }
    if (cat?.rs.open) { const c = root.querySelector('[data-ai-rs-control="parent"]'); if (c) html += parentMenu(c); }
    if (unit) html += unitModal();
    if (!html) { clearPortal(); return; }
    if (!portal) { portal = document.createElement('div'); portal.setAttribute('data-ai-portal', ''); document.body.appendChild(portal); wirePortal(portal); }
    // Reconciled, not replaced: the focused field keeps its node, its caret and its selection.
    morph(portal, html);
    if (unit?.focusNew) { unit.focusNew = false; portal.querySelector('[data-ai-ps-new]')?.focus(); }
  }
  function clearPortal() { portal?.remove(); portal = null; }

  // ── Events ──
  function pickCategory(value) {
    const rs = f.rs;
    rs.open = false; rs.input = '';
    if (value === 'add_new') { f.category = null; if (f.submitted) validate(); openCategory(); } else { f.category = value; rs.selected = true; if (f.submitted) validate(); }
    rerender();
  }
  function pickParent(value) {
    const rs = cat.rs;
    rs.open = false; rs.input = ''; rs.selected = true;
    if (value === 'other') cat.selection = { kind: 'other' };
    else { const o = parentOptions().find((x) => String(x.value) === String(value)); cat.selection = { kind: 'existing', id: o.value, label: o.label }; }
    rerender();
  }
  function wirePortal(el) {
    el.addEventListener('mousedown', (e) => {
      const co = e.target.closest('[data-ai-option]');
      if (co) { e.preventDefault(); if (co.getAttribute('aria-disabled') !== 'true') pickCategory(co.dataset.aiOption); return; }
      const po = e.target.closest('[data-ai-parent-option]');
      if (po) { e.preventDefault(); pickParent(po.dataset.aiParentOption); return; }
      // FormModal: a press outside the panel closes it.
      if (unit && e.target.closest('[data-ai-overlay]') && !e.target.closest('[data-ai-panel]')) { closeUnits(); rerender(); return; }
      // ProductSelect: a press outside an open menu closes it.
      if (unit?.menu && !e.target.closest(`[data-ai-ps="${unit.menu}"]`)) { unit.menu = null; unit.adding = false; unit.newValue = ''; rerender(); }
    });
    el.addEventListener('click', (e) => {
      if (!unit) return;
      const t = e.target;
      if (t.closest('[data-ai-unit-close]')) { closeUnits(); rerender(); return; }
      if (t.closest('[data-ai-unit-save]')) { if (!t.closest('[data-ai-unit-save]').disabled) { saveUnits(); rerender(); } return; }
      const tog = t.closest('[data-ai-ps-toggle]');
      if (tog) { const k = tog.dataset.aiPsToggle; unit.menu = unit.menu === k ? null : k; unit.adding = false; unit.newValue = ''; rerender(); return; }
      const opt = t.closest('[data-ai-ps-option]');
      if (opt) {
        const k = opt.dataset.aiPsOption; const v = opt.dataset.value;
        if (k === 'secondary-unit') unit.secondaryUnit = v; else if (k === 'base-unit') unit.baseUnit = v; else if (k === 'pallet-unit') unit.palletUnit = v; else unit.tax = v;
        unit.menu = null; rerender(); return;
      }
      if (t.closest('[data-ai-ps-add]')) { unit.adding = true; unit.focusNew = true; rerender(); return; }
      const conf = t.closest('[data-ai-ps-confirm]');
      if (conf && !conf.disabled) { const v = unit.newValue.trim(); if (v && /^[a-zA-Z0-9 ]+$/.test(v)) { unit.tax = `${v.replace('%', '').trim()}%`; unit.newValue = ''; unit.adding = false; unit.menu = null; rerender(); } return; }
      const tt = t.closest('[data-ai-taxtype]');
      if (tt) { unit.taxType = tt.dataset.aiTaxtype; rerender(); }
    });
    el.addEventListener('input', (e) => {
      if (!unit) return;
      const t = e.target;
      if (t.matches('[data-ai-ps-new]')) { unit.newValue = t.value; rerender(); return; }
      if (t.matches('[data-ai-conv]')) {
        if (t.dataset.aiConv === 'base') { unit.rate = t.value; if (hasValue(unit.secondaryPrice)) syncSecondary(unit.secondaryPrice, t.value); } else { unit.palletRate = t.value; if (hasValue(unit.price)) syncBase(unit.price, unit.rate, t.value); }
        rerender(); return;
      }
      if (t.matches('[data-ai-price]')) {
        if (/^\d*\.?\d{0,2}$/.test(t.value)) { const w = t.dataset.aiPrice; if (w === 'secondary') syncSecondary(t.value); else if (w === 'base') syncBase(t.value); else syncPallet(t.value); }
        rerender();
      }
    });
    el.addEventListener('focusout', (e) => {
      if (!unit) return;
      const t = e.target;
      if (t.matches('[data-ai-conv]')) {
        let n = parseFloat(t.value);
        const isBase = t.dataset.aiConv === 'base';
        if (Number.isNaN(n) || n < 1) { n = 1; if (isBase) unit.rate = n; else unit.palletRate = n; }
        if (isBase) { if (hasValue(unit.secondaryPrice)) syncSecondary(unit.secondaryPrice, n); } else if (hasValue(unit.price)) syncBase(unit.price, unit.rate, n);
        rerender(); return;
      }
      if (t.matches('[data-ai-price="base"],[data-ai-price="pallet"]')) {
        const n = parseFloat(t.value);
        if (!Number.isNaN(n)) { if (t.dataset.aiPrice === 'base') syncBase(n.toFixed(2)); else syncPallet(n.toFixed(2)); rerender(); }
      }
    });
  }
  document.addEventListener('keydown', (e) => { if (unit && e.key === 'Escape') { closeUnits(); rerender(); } }, true);

  function handleClick(e) {
    if (!m) return false;
    const a = e.target.closest('[data-ai],[data-act="ai-close"],[data-act="ai-category-close"]');
    if (a) {
      const act = a.dataset.ai || (a.dataset.act === 'ai-close' ? 'close' : 'category-close');
      switch (act) {
        case 'type': setType(a.dataset.type); break;
        case 'back': setType(null); break; // in sourcing mode, back to the type step
        case 'close': close(); break;
        case 'unit-open': openUnits(); break;
        case 'category-close': cat = null; break;
        case 'category-submit': submitCategory(); return true;
        case 'pick-image': if (!f.uploadingSlots?.[a.dataset.index]) a.parentElement.querySelector('[data-ai-file]')?.click(); return true;
        case 'remove-image': f.images[a.dataset.index] = null; break;
        case 'category-image': a.closest('[data-testid="add-category-modal-image-uploader"]').querySelector('[data-ai-category-file]')?.click(); return true;
        default: return false;
      }
      rerender();
      return true;
    }
    return Boolean(e.target.closest('[data-testid="create-order-add-item-modal"]'));
  }
  function handleMouseDown(e) {
    if (!m || !f) return false;
    const clear = e.target.closest('[data-ai-rs-clear]');
    if (clear) {
      e.preventDefault();
      if (clear.dataset.aiRsClear === 'category') { f.category = null; f.rs.selected = false; if (f.submitted) validate(); } else { cat.selection = { kind: 'none' }; cat.rs.selected = false; }
      rerender(); return true;
    }
    const control = e.target.closest('[data-ai-rs-control]');
    if (control) {
      e.preventDefault();
      const which = control.dataset.aiRsControl;
      const rs = which === 'category' ? f.rs : cat.rs;
      rs.focused = true; rs.open = !rs.open;
      rs.focus = 0;
      rerender();
      document.getElementById(which === 'category' ? 'add-item-category-input' : 'add-category-modal-parent-select-input')?.focus();
      return true;
    }
    return false;
  }
  function handleInput(e) {
    if (!m || !f) return false;
    const t = e.target;
    if (t.matches('[data-ai-field]')) {
      const k = t.dataset.aiField;
      if (cat && t.closest('[data-ai-category-form]')) { cat[k] = t.value; if (cat.submitted) validateCategory(); } else { f[k] = t.value; if (f.submitted) validate(); }
      rerender(); return true;
    }
    if (t.matches('[data-ai-rs-input]')) {
      const rs = t.dataset.aiRsInput === 'category' ? f.rs : cat.rs;
      rs.input = t.value; rs.open = true; rs.focus = 0; rerender(); return true;
    }
    return false;
  }
  function handleChange(e) {
    if (!m || !f) return false;
    const t = e.target;
    if (t.matches('[data-ai-file]')) { const i = Number(t.dataset.aiFile); const file = t.files?.[0]; t.value = ''; uploadImage(i, file); return true; }
    if (t.matches('[data-ai-category-file]')) {
      const file = t.files?.[0]; t.value = '';
      if (file) { const reader = new FileReader(); reader.onload = () => { if (cat) { cat.imageUrl = reader.result; rerender(); } }; reader.readAsDataURL(file); }
      return true;
    }
    return false;
  }
  async function uploadImage(i, file) {
    if (!file) return;
    f.uploadingSlots = { ...(f.uploadingSlots || {}), [i]: true }; f.uploadErrors = { ...f.uploadErrors, [i]: '' }; f.uploads += 1; rerender();
    const form = f;
    try {
      const fd = new FormData();
      fd.append('files', file); fd.append('articleNumber', form.articleNo); fd.append('index', i); fd.append('isProductImageDeleted', false); fd.append('resolution', 'original');
      const res = await server.uploadProductImage(fd);
      const url = ((r) => { const g = (x) => (!x ? '' : typeof x === 'string' ? x : x.secure_url || x.url || x.imageUrl || g(x.data) || g(x.image)); return g(r); })(res);
      if (!url) throw new Error('No image URL returned from upload.');
      host.notify('success', 'Image uploaded successfully!');
      form.images[i] = `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`;
    } catch (err) {
      form.uploadErrors = { ...form.uploadErrors, [i]: err?.response?.data?.message || err?.message || 'Upload failed' };
    } finally {
      form.uploadingSlots = { ...form.uploadingSlots, [i]: false }; form.uploads = Math.max(0, form.uploads - 1);
      if (f === form) rerender();
    }
  }
  function handleSubmit(e) {
    if (!m || !f || !e.target.matches('[data-ai-form]')) return false;
    e.preventDefault(); submit(); return true;
  }
  function handleFocusOut(e) {
    if (!m || !f) return;
    const t = e.target;
    if (t.matches('[data-ai-rs-input]')) {
      const rs = t.dataset.aiRsInput === 'category' ? f.rs : cat?.rs;
      if (!rs) return;
      rs.focused = false; rs.open = false; rs.input = ''; rs.selected = false; rerender(); return;
    }
    if (t.matches('[data-ai-field="title"]')) { f.titleTouched = true; if (t.value) { f.title = t.value; if (f.submitted) validate(); } rerender(); }
    if (cat && t.matches('[data-ai-field="name"]')) { cat.nameTouched = true; rerender(); }
    if (cat && t.matches('[data-ai-field="otherParentName"]')) { cat.otherTouched = true; rerender(); }
  }

  return { open, close, isOpen: () => Boolean(m), render, afterRender, handleClick, handleMouseDown, handleInput, handleChange, handleSubmit, handleFocusOut };
}
