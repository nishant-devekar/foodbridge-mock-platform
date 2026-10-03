/*
  PurchaseOrderDocumentModal: a purchase order's supplier invoices ("invoice" mode) or other
  documents ("document" mode) — never both in one modal.

    invoice mode   list (existing invoices) → add (amount, expenses, remarks, 1–3 files)
                   → after a NEW invoice: "record a payment now?" → payment form → ledger
                   list → view (edit amount/expenses/remarks; attachments save at once)
    document mode  add (name + 1–3 files) | view (rename; attachments)

  Every write is one multipart POST (/v3/purchase/purchase-order/document) whose fields decide what
  it does; the payment goes to the supplier ledger through the host. Leaving a changed invoice form
  asks first, in the footer. A refused Save shows every error at once and takes the cursor to the
  first. Expenses are stored beside the invoice amount and only ADDED to it on screen, in paise.
*/
import { esc, morphOuter } from '../components/dom.js';
import { fi } from '../components/icons.js';

const T = '<!---->';
const NBSP = ' ';
const MAX_FILES = 3;
const MAX_EXPENSES = 20;
const ALLOWED = ['pdf', 'jpg', 'jpeg', 'png'];
const MODE = { invoice: { docType: 'SUPPLIER_INVOICE', noun: 'Invoice', plural: 'Invoices' }, document: { docType: 'OTHER', noun: 'Document', plural: 'Documents' } };
const PAYMENT_METHODS = [{ value: 'cash', label: 'Cash' }, { value: 'upi', label: 'UPI' }, { value: 'neft', label: 'Bank Transfer' }, { value: 'cheque', label: 'Cheque' }];

const isMoney = (v) => /^\d*\.?\d{0,2}$/.test(v);
const ext = (s = '') => s.split('?')[0].split('.').pop()?.toLowerCase() || '';
const allowed = (name) => ALLOWED.includes(ext(name));
const bytes = (b) => { if (!b) return '0 KB'; const kb = b / 1024; return kb < 1024 ? `${kb.toFixed(1)} KB` : `${(kb / 1024).toFixed(1)} MB`; };
const fileName = (url = '') => decodeURIComponent(url.split('?')[0].split('/').pop() || 'attachment');
const attachmentsOf = (doc) => (doc?.attachments?.length ? doc.attachments : doc?.documentUrl ? [{ _id: doc._id, url: doc.documentUrl, uploadedAt: doc.uploadedAt }] : []);
const shortDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

/** InvoiceExpensesEditor's money rules: whole paise, drafts keep the typed string. */
export const addMoney = (...values) => values.reduce((p, v) => p + Math.round((Number(v) || 0) * 100), 0) / 100;
let draftSeq = 0;
const newDraft = () => ({ key: `expense-draft-${(draftSeq += 1)}`, type: '', amount: '', remarks: '' });
const toDrafts = (expenses) => (expenses || []).map((e) => ({ key: e._id ? String(e._id) : `expense-draft-${(draftSeq += 1)}`, _id: e._id, type: e.type || '', amount: e.amount != null ? String(e.amount) : '', remarks: e.remarks || '' }));
const complete = (d) => d.type.trim().length > 0 && Number(d.amount) > 0;
const allValid = (drafts) => drafts.every(complete);
const draftsTotal = (drafts) => addMoney(...drafts.map((d) => d.amount));
const signature = (drafts) => JSON.stringify(drafts.map((d) => [d._id ? String(d._id) : null, d.type.trim(), Number(d.amount) || 0, d.remarks]));
const toPayload = (drafts) => drafts.map((d) => ({ ...(d._id ? { _id: String(d._id) } : {}), type: d.type.trim(), amount: Number(d.amount), remarks: d.remarks }));
function fieldErrors(d, show) {
  const typeWrong = d.type.trim().length === 0;
  const amountWrong = !(Number(d.amount) > 0);
  const started = !typeWrong || d.amount !== '' || d.remarks.trim().length > 0;
  return {
    type: typeWrong && (show || (started && d.touched?.type)) ? 'Enter a type' : null,
    amount: amountWrong && (show || (started && d.touched?.amount)) ? 'Enter an amount greater than 0' : null,
  };
}

const ROW_GRID = 'grid grid-cols-[minmax(0,1fr)_6.5rem_2rem] sm:grid-cols-[minmax(0,1fr)_7rem_minmax(0,1fr)_2rem] gap-x-2';
const fieldClass = (bad) => `w-full h-9 px-2.5 text-sm rounded-lg border bg-white text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:!border-emerald-500 transition ${bad ? 'border-red-400' : 'border-gray-300'}`;
const MONEY_INPUT = 'flex-1 min-w-0 h-full pr-3 text-base font-bold tabular-nums bg-transparent text-gray-900 border-0 outline-none focus:outline-none focus:ring-0 focus:!border-transparent placeholder:font-normal placeholder:text-gray-300';
const SECONDARY = 'flex items-center justify-center h-11 px-4 rounded-lg font-semibold text-sm border border-gray-300 text-gray-600 bg-white hover:bg-gray-50 transition-all';
const TEXT_INPUT = 'w-full h-11 px-3 text-sm rounded-xl border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition';
const TEXT_INPUT_STRONG = 'w-full h-11 px-3 text-sm rounded-xl border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:!border-emerald-500 transition';

export function createDocumentsModal(host, server, { onUploadSuccess, onAttachmentsChange, onEditSuccess, onClosed }) {
  let st = null;
  let root = null;
  let focusNext = null; // a selector focused after the next render
  const H = (s) => esc(s);
  const money = (n) => `${H(host.currency)}${T}${NBSP}${T}${H(host.getNumberTwo(n))}`;

  // ── Open / close ──────────────────────────────────────────────────────────────────────────
  /** `documents` is a getter: the row's documents as its layout currently holds them. */
  function open({ mount, order, mode = 'invoice', entry = null, documents }) {
    const m = MODE[mode] || MODE.invoice;
    const entries = documents().filter((d) => d.type === m.docType);
    st = {
      mount, order, mode, documents, entry,
      screen: entry ? 'view' : mode === 'invoice' ? (entries.length > 0 ? 'list' : 'add') : 'add',
      viewing: entry || null, attachments: entry ? attachmentsOf(entry) : [],
      amount: '', remarks: '', name: '', drafts: [], addAttempted: false, amountTouched: false, files: [], dragging: false, submitting: false,
      editAmount: entry?.amount != null ? String(entry.amount) : '', editRemarks: entry?.remarks || '', editName: entry?.name || '', editDrafts: toDrafts(entry?.expenses), editAttempted: false, editAmountTouched: false, saving: false,
      pendingLeave: null, busy: null, replacing: null,
      savedAmount: 0, savedExpenses: 0, wantsPayment: false, paymentAmount: '', paymentMethod: 'cash', recording: false,
    };
    render();
  }
  function close() { root?.remove(); root = null; st = null; onClosed?.(); }
  const isOpen = () => Boolean(st);
  const meta = () => MODE[st.mode] || MODE.invoice;
  const entries = () => st.documents().filter((d) => d.type === meta().docType);

  // ── Derived ───────────────────────────────────────────────────────────────────────────────
  const numAmount = () => Number(st.amount) || 0;
  const canSubmit = () => (st.mode === 'invoice' ? !st.submitting : st.name.trim().length > 0 && st.files.length > 0 && !st.submitting);
  const addAmountError = () => (st.mode === 'invoice' && !(numAmount() > 0) && (st.addAttempted || st.amountTouched) ? 'Enter the invoice amount' : null);
  const addFilesError = () => (st.mode === 'invoice' && st.files.length === 0 && st.addAttempted ? 'Attach at least one file' : null);
  const isAddDirty = () => st.amount !== '' || st.remarks.trim() !== '' || st.name.trim() !== '' || st.files.length > 0 || st.drafts.length > 0;
  const isViewDirty = () => (st.mode === 'invoice' && st.viewing
    ? (Number(st.editAmount) || 0) !== (Number(st.viewing.amount) || 0) || st.editRemarks !== (st.viewing.remarks || '') || signature(st.editDrafts) !== signature(toDrafts(st.viewing.expenses))
    : false);
  const canSave = () => (st.mode === 'invoice' ? isViewDirty() && !st.saving : st.editName.trim().length > 0 && !st.saving);
  const editAmountError = () => (st.mode === 'invoice' && !(Number(st.editAmount) > 0) && (st.editAttempted || st.editAmountTouched) ? 'Enter the invoice amount' : null);
  const hasUnsaved = () => st.mode === 'invoice' && ((st.screen === 'add' && isAddDirty()) || (st.screen === 'view' && isViewDirty()));

  // ── Views ─────────────────────────────────────────────────────────────────────────────────
  function invoiceAmount({ value, error, testId }) {
    return `<div><div class="flex items-baseline justify-between mb-1.5"><label for="${testId}" class="text-xs font-semibold text-gray-600 block">Invoice amount</label><span class="text-[11px] text-gray-400">Excluding expenses</span></div>`
      + `<div class="flex items-center h-11 rounded-xl border ${error ? 'border-red-400' : 'border-gray-300'} bg-white focus-within:ring-2 focus-within:ring-emerald-500 focus-within:border-emerald-500 transition"><span class="pl-3 pr-1 text-base font-semibold text-gray-400 select-none flex-shrink-0">${H(host.currency)}</span>`
      + `<input id="${testId}" type="text" inputmode="decimal" placeholder="0.00" aria-invalid="${Boolean(error)}"${error ? ' aria-describedby="po-doc-amount-error"' : ''} data-testid="${testId}" class="${MONEY_INPUT}" value="${H(value)}" data-pm-field="${testId === 'po-doc-amount-input' ? 'amount' : 'editAmount'}" data-pm-money></div>`
      + (error ? `<p id="po-doc-amount-error" data-testid="po-doc-amount-error" class="mt-1 text-[11px] text-red-600">${error}</p>` : '')
      + `</div>`;
  }

  function expensesEditor(drafts, which, show, disabled) {
    const summary = show && !allValid(drafts);
    return `<div data-testid="po-doc-expenses"><div class="flex items-center justify-between mb-1.5"><label class="text-xs font-semibold text-gray-600 block">Expenses (optional)</label>`
      + (drafts.length >= 15 ? `<span data-testid="po-doc-expenses-counter" class="text-[11px] font-semibold text-gray-400 tabular-nums"><b class="text-emerald-700">${drafts.length}</b> / ${T}${MAX_EXPENSES}</span>` : '')
      + `</div>`
      + (drafts.length ? `<div data-testid="po-doc-expenses-headings" class="${ROW_GRID} mb-1 px-2 sm:px-0 text-[11px] font-semibold text-gray-400"><span>Type</span><span>Amount</span><span class="hidden sm:block">Remarks (optional)</span><span></span></div>` : '')
      + `<div class="space-y-2">`
      + drafts.map((d, i) => {
        const e = fieldErrors(d, show);
        const typeErr = `po-doc-expense-${d.key}-type-error`;
        const amountErr = `po-doc-expense-${d.key}-amount-error`;
        const dis = disabled ? ' disabled=""' : '';
        return `<div data-testid="po-doc-expense-${i}" class="${ROW_GRID} gap-y-1.5 items-start rounded-xl border p-2 sm:border-0 sm:p-0 ${e.type || e.amount ? 'border-red-300' : 'border-gray-200'}" data-key="${H(d.key)}">`
          + `<div class="min-w-0"><input type="text" placeholder="e.g. TRANSPORT"${dis} aria-label="Expense ${i + 1} type" aria-invalid="${Boolean(e.type)}"${e.type ? ` aria-describedby="${typeErr}"` : ''} data-testid="po-doc-expense-${i}-type-input" class="${fieldClass(e.type)}" value="${H(d.type)}" data-pm-exp="${which}:${H(d.key)}:type">${e.type ? `<p id="${typeErr}" data-testid="po-doc-expense-${i}-type-error" class="mt-1 text-[11px] leading-tight text-red-600">${e.type}</p>` : ''}</div>`
          + `<div class="min-w-0"><div class="flex items-center h-9 rounded-lg border ${e.amount ? 'border-red-400' : 'border-gray-300'} bg-white focus-within:ring-2 focus-within:ring-emerald-500 focus-within:border-emerald-500 transition"><span class="pl-2 pr-1 text-sm font-semibold text-gray-400 select-none flex-shrink-0">${H(host.currency)}</span><input type="text" inputmode="decimal" placeholder="0.00"${dis} aria-label="Expense ${i + 1} amount" aria-invalid="${Boolean(e.amount)}"${e.amount ? ` aria-describedby="${amountErr}"` : ''} data-testid="po-doc-expense-${i}-amount-input" class="flex-1 min-w-0 h-full pr-2 text-sm font-bold tabular-nums bg-transparent text-gray-900 border-0 outline-none focus:outline-none focus:ring-0 focus:!border-transparent placeholder:font-normal placeholder:text-gray-300" value="${H(d.amount)}" data-pm-exp="${which}:${H(d.key)}:amount" data-pm-money></div>${e.amount ? `<p id="${amountErr}" data-testid="po-doc-expense-${i}-amount-error" class="mt-1 text-[11px] leading-tight text-red-600">${e.amount}</p>` : ''}</div>`
          + `<div class="min-w-0 col-span-3 order-2 sm:order-none sm:col-span-1"><input type="text" placeholder="Remarks"${dis} aria-label="Expense ${i + 1} remarks" data-testid="po-doc-expense-${i}-remarks-input" class="${fieldClass(false)}" value="${H(d.remarks)}" data-pm-exp="${which}:${H(d.key)}:remarks"></div>`
          + `<button type="button"${dis} data-testid="po-doc-expense-${i}-remove-btn" class="order-1 sm:order-none w-8 h-9 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed" title="Remove expense" aria-label="Remove expense ${i + 1}" data-pm-exp-remove="${which}:${H(d.key)}">${fi('FiTrash2', { size: 14 })}</button>`
          + `</div>`;
      }).join('')
      + (summary ? '<p data-testid="po-doc-expenses-hint" class="text-[11px] text-red-600">Fix the highlighted expenses, or remove them, before saving.</p>' : '')
      + (drafts.length < MAX_EXPENSES ? `<button type="button"${disabled ? ' disabled=""' : ''} data-testid="po-doc-expense-add-btn" class="w-full flex items-center justify-center gap-1.5 h-10 rounded-xl border border-gray-300 bg-white text-xs font-semibold text-gray-700 hover:border-emerald-400 hover:text-emerald-700 hover:bg-emerald-50/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" data-pm-exp-add="${which}">${fi('FiPlus', { size: 14, cls: 'text-emerald-600' })}Add expense</button>` : '')
      + `</div></div>`;
  }

  function picker(errorId) {
    const remaining = MAX_FILES - st.files.length;
    const chips = st.files.map((f, i) => `<div class="flex items-center gap-3 border border-gray-200 bg-white rounded-xl p-2.5"><div class="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">${fi('FiFileText', { size: 16, cls: 'text-red-500' })}</div><div class="min-w-0 flex-1"><p class="text-sm font-medium text-gray-900 truncate">${H(f.name)}</p><p class="text-xs text-gray-400">${bytes(f.size)}</p></div><button type="button" data-testid="po-doc-remove-file-${i}-btn" class="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg flex-shrink-0 transition-colors" title="Remove file" data-pm-remove-file="${i}">${fi('FiX', { size: 16 })}</button></div>`).join('');
    let zone = '';
    if (remaining > 0) {
      zone = st.files.length === 0
        ? `<button type="button" data-testid="po-doc-attachment-dropzone-btn" aria-invalid="${Boolean(errorId)}"${errorId ? ` aria-describedby="${errorId}"` : ''} class="${['w-full flex flex-col items-center justify-center gap-1.5 h-28 rounded-xl border-2 border-dashed transition-colors', st.dragging ? 'border-emerald-500 bg-emerald-50' : errorId ? 'border-red-300 bg-white hover:border-emerald-400 hover:bg-emerald-50/40' : 'border-gray-300 bg-white hover:border-emerald-400 hover:bg-emerald-50/40'].join(' ')}" data-pm-pick data-pm-drop>${fi('FiUploadCloud', { size: 22, cls: st.dragging ? 'text-emerald-600' : 'text-gray-400' })}<span class="text-sm font-medium text-gray-600">Click to upload or drag and drop</span><span class="text-xs text-gray-400">PDF, JPG or PNG · up to ${T}${MAX_FILES}${T} files</span></button>`
        : `<button type="button" data-testid="po-doc-attachment-add-another-btn" class="${['w-full flex items-center justify-center gap-1.5 h-11 rounded-xl border-2 border-dashed transition-colors text-xs font-semibold', st.dragging ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-300 bg-white hover:border-emerald-400 hover:bg-emerald-50/40 text-gray-500'].join(' ')}" data-pm-pick data-pm-drop>${fi('FiPlus', { size: 14 })}Add another file</button>`;
    }
    return `<div class="flex flex-col gap-2">${chips}${zone}<input type="file" multiple="" accept=".pdf,.jpg,.jpeg,.png,image/*,application/pdf" class="hidden" data-testid="po-doc-attachment-file-input" data-pm-files="add"></div>`;
  }

  function counter(n) { return `<span class="text-[11px] font-semibold text-gray-400 tabular-nums"><b class="text-emerald-700">${n}</b> / ${T}${MAX_FILES}</span>`; }

  function addScreen() {
    const filesErr = addFilesError();
    return `<div class="space-y-4">`
      + (st.mode === 'invoice'
        ? invoiceAmount({ value: st.amount, error: addAmountError(), testId: 'po-doc-amount-input' }) + expensesEditor(st.drafts, 'add', st.addAttempted, st.submitting)
          + `<div><label class="text-xs font-semibold text-gray-600 mb-1.5 block">Remarks (optional)</label><input type="text" placeholder="e.g. Invoice #4521, partial shipment" data-testid="po-doc-remarks-input" class="${TEXT_INPUT}" value="${H(st.remarks)}" data-pm-field="remarks"></div>`
        : `<div><label class="text-xs font-semibold text-gray-600 mb-1.5 block">Document Name</label><input type="text" placeholder="e.g. Packing Slip, Quality Certificate" data-testid="po-doc-name-input" class="${TEXT_INPUT_STRONG}" value="${H(st.name)}" data-pm-field="name"></div>`)
      + `<div data-testid="po-doc-attachments"><div class="flex items-center justify-between mb-1.5"><label class="text-xs font-semibold text-gray-600 block">Attachments</label>${counter(st.files.length)}</div>`
      + picker(filesErr ? 'po-doc-attachments-error' : null)
      + (filesErr ? `<p id="po-doc-attachments-error" data-testid="po-doc-attachments-error" class="mt-1 text-[11px] text-red-600">${filesErr}</p>` : '')
      + `</div></div>`;
  }

  function viewScreen() {
    const invoice = st.mode === 'invoice';
    return `<div class="space-y-4">`
      + (invoice
        ? invoiceAmount({ value: st.editAmount, error: editAmountError(), testId: 'po-doc-edit-amount-input' }) + expensesEditor(st.editDrafts, 'edit', st.editAttempted, st.saving)
          + `<div><label class="text-xs font-semibold text-gray-600 mb-1.5 block">Remarks (optional)</label><input type="text" placeholder="e.g. Invoice #4521, partial shipment" data-testid="po-doc-edit-remarks-input" class="${TEXT_INPUT}" value="${H(st.editRemarks)}" data-pm-field="editRemarks"></div>`
        : `<div><label class="text-xs font-semibold text-gray-600 mb-1.5 block">Document Name</label><input type="text" data-testid="po-doc-edit-name-input" class="${TEXT_INPUT_STRONG}" value="${H(st.editName)}" data-pm-field="editName"></div>`)
      + `<div data-testid="po-doc-attachments" class="${invoice ? 'pt-4 border-t border-gray-100' : ''}"><div class="flex items-center justify-between mb-1.5"><label class="text-xs font-semibold text-gray-600 block">Attachments</label>${counter(st.attachments.length)}</div>`
      + (invoice ? '<p data-testid="po-doc-attachments-note" class="-mt-1 mb-2 text-[11px] text-gray-400">Changes to attachments are saved immediately.</p>' : '')
      + `<div class="space-y-2">`
      + st.attachments.map((a, i) => {
        const busy = st.busy === a._id;
        return `<div data-testid="po-doc-attachment-${H(a._id)}" class="flex items-center gap-3 border border-gray-200 rounded-xl px-3 py-2.5"><div class="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">${fi('FiFileText', { size: 14, cls: 'text-red-500' })}</div>`
          + `<div class="min-w-0 flex-1"><p class="text-xs font-semibold text-gray-900 truncate" title="${H(fileName(a.url))}">Attachment ${T}${i + 1}</p><p class="text-[11px] text-gray-400">${a.uploadedAt ? shortDate(a.uploadedAt) : ''}</p></div>`
          + `<div class="flex items-center gap-1 flex-shrink-0"><a href="${H(a.url)}" target="_blank" rel="noreferrer" data-testid="po-doc-attachment-${H(a._id)}-view-link" class="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 hover:text-emerald-700 hover:bg-emerald-50 transition-colors" title="View">${fi('FiEye', { size: 13 })}</a>`
          + `<button type="button"${busy ? ' disabled=""' : ''} data-testid="po-doc-attachment-${H(a._id)}-replace-btn" class="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center text-amber-700 hover:bg-amber-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" title="Replace" data-pm-replace="${H(a._id)}">${busy && st.replacing === a._id ? fi('FiLoader', { size: 13, cls: 'animate-spin' }) : fi('FiRefreshCw', { size: 13 })}</button>`
          + `<button type="button"${busy || st.attachments.length <= 1 ? ' disabled=""' : ''} data-testid="po-doc-attachment-${H(a._id)}-remove-btn" class="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center text-red-500 hover:bg-red-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed" title="${st.attachments.length <= 1 ? 'At least one attachment is required' : 'Remove'}" data-pm-remove="${H(a._id)}">${fi('FiTrash2', { size: 13 })}</button></div></div>`;
      }).join('')
      + (st.attachments.length < MAX_FILES ? `<button type="button"${st.busy === 'add' ? ' disabled=""' : ''} data-testid="po-doc-add-attachment-btn" class="w-full flex items-center justify-center gap-1.5 h-10 border border-dashed border-emerald-300 rounded-xl text-xs font-semibold text-emerald-700 bg-emerald-50/50 hover:bg-emerald-50 hover:border-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" data-pm-add-attachment>${st.busy === 'add' ? fi('FiLoader', { size: 13, cls: 'animate-spin' }) : fi('FiPlus', { size: 13 })}${st.busy === 'add' ? 'Adding…' : 'Add Attachment'}</button>` : '')
      + `</div><input type="file" accept=".pdf,.jpg,.jpeg,.png,image/*,application/pdf" class="hidden" data-testid="po-doc-replace-file-input" data-pm-files="replace"><input type="file" multiple="" accept=".pdf,.jpg,.jpeg,.png,image/*,application/pdf" class="hidden" data-testid="po-doc-add-attachment-file-input" data-pm-files="attach"></div></div>`;
  }

  function listScreen() {
    const m = meta();
    return `<div class="space-y-2">${entries().map((doc) => {
      const invoice = st.mode === 'invoice';
      const label = invoice ? doc.remarks || 'Supplier Invoice' : doc.name || 'Document';
      const amount = invoice ? doc.amount : null;
      const expenses = invoice ? addMoney(...(doc.expenses || []).map((e) => e.amount)) : 0;
      return `<div role="button" tabindex="0" data-testid="po-doc-row-${H(doc._id)}" class="w-full flex items-center gap-3 border border-gray-200 rounded-2xl px-3.5 py-3 text-left transition-colors hover:border-emerald-200 hover:bg-emerald-50/40 cursor-pointer" data-pm-open="${H(doc._id)}">`
        + `<div class="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">${fi('FiFileText', { size: 15, cls: 'text-gray-500' })}</div>`
        + `<div class="flex-1 min-w-0"><p class="text-sm font-semibold text-gray-800 truncate">${H(label)}</p><p class="text-xs text-gray-400">${doc.uploadedAt ? shortDate(doc.uploadedAt) : ''}</p>`
        + (amount != null && expenses > 0 ? `<p data-testid="po-doc-row-${H(doc._id)}-amount-breakdown" class="text-[11px] text-gray-400 tabular-nums">Invoice ${T}${money(amount || 0)}${T} + Expenses ${T}${money(expenses)}</p>` : '')
        + `</div>`
        + (amount != null ? `<span data-testid="po-doc-row-${H(doc._id)}-amount" class="text-sm font-bold text-gray-900 tabular-nums flex-shrink-0">${money(addMoney(amount, expenses))}</span>` : '')
        + `<a href="${H(attachmentsOf(doc)[0]?.url || '')}" target="_blank" rel="noreferrer" data-testid="po-doc-row-${H(doc._id)}-view-link" class="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 text-gray-400 hover:text-emerald-700 hover:bg-emerald-50 transition-colors" title="View" data-pm-link>${fi('FiEye', { size: 13 })}</a>`
        + `<button type="button" data-testid="po-doc-row-${H(doc._id)}-edit-btn" class="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 text-gray-400 hover:text-emerald-700 hover:bg-emerald-50 transition-colors" title="Edit" data-pm-open="${H(doc._id)}">${fi('FiEdit2', { size: 13 })}</button></div>`;
    }).join('')}<button type="button" data-testid="po-doc-list-add-btn" class="w-full flex items-center justify-center gap-1.5 h-11 border border-dashed border-emerald-300 rounded-xl text-sm font-semibold text-emerald-700 bg-emerald-50/50 hover:bg-emerald-50 hover:border-emerald-400 transition-colors mt-1" data-pm-go="add">${fi('FiPlus', { size: 15 })}Add ${T}${m.noun}</button></div>`;
  }

  function paymentScreen() {
    const withExpenses = st.savedExpenses > 0;
    const canPay = (Number(st.paymentAmount) || 0) > 0 && !st.recording;
    return `<div class="space-y-4"><div class="w-full grid grid-cols-[auto_minmax(0,1fr)] gap-3 items-start px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200">${fi('FiCheckCircle', { size: 16, cls: 'text-emerald-600 mt-0.5' })}`
      + `<div class="min-w-0 whitespace-normal text-xs text-emerald-800 leading-relaxed break-words" style="overflow-wrap: anywhere;"><p><span class="font-semibold">Invoice recorded successfully</span>${!withExpenses && st.savedAmount > 0 ? ` ${T}for ${T}${money(st.savedAmount)}` : ''}${T}.</p>`
      + (withExpenses ? `<dl data-testid="po-doc-payment-breakdown" class="my-2 space-y-0.5 tabular-nums"><div data-testid="po-doc-payment-breakdown-invoice" class="flex justify-between gap-3"><dt>Invoice</dt><dd>${money(st.savedAmount)}</dd></div><div data-testid="po-doc-payment-breakdown-expenses" class="flex justify-between gap-3"><dt>Expenses</dt><dd>${money(st.savedExpenses)}</dd></div><div data-testid="po-doc-payment-breakdown-total" class="flex justify-between gap-3 pt-0.5 border-t border-emerald-200 font-bold"><dt>Total</dt><dd>${money(addMoney(st.savedAmount, st.savedExpenses))}</dd></div></dl>` : '')
      + `<p>${st.wantsPayment ? 'Enter the payment details below.' : 'Would you like to record a payment to this supplier now?'}</p></div></div>`
      + (!st.wantsPayment
        ? `<div class="grid grid-cols-2 gap-2 pt-1"><button type="button" data-testid="po-doc-payment-skip-btn" class="flex items-center justify-center h-11 px-4 rounded-lg font-semibold text-sm border border-gray-300 text-gray-600 bg-white hover:bg-gray-50 transition-all" data-pm-go="list">Skip</button><button type="button" data-testid="po-doc-payment-start-btn" class="flex items-center justify-center gap-1.5 h-11 px-3 rounded-lg font-semibold text-sm bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm hover:shadow-md active:scale-[0.98] transition-all min-w-0" data-pm-pay="start">${fi('FiCreditCard', { size: 15, cls: 'flex-shrink-0' })}<span class="truncate">Record Payment</span></button></div>`
        : `<div><label class="text-xs font-semibold text-gray-600 mb-1.5 block">Payment Method</label><select data-testid="po-doc-payment-method-select" class="w-full h-11 px-3 text-sm rounded-xl border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:!border-emerald-500 transition" data-pm-field="paymentMethod">${PAYMENT_METHODS.map((o) => `<option value="${o.value}"${o.value === st.paymentMethod ? ' selected=""' : ''}>${o.label}</option>`).join('')}</select></div>`
          + `<div><label class="text-xs font-semibold text-gray-600 mb-1.5 block">Amount</label><div class="flex items-center h-11 rounded-xl border border-gray-300 bg-white focus-within:ring-2 focus-within:ring-emerald-500 focus-within:border-emerald-500 transition"><span class="pl-3 pr-1 text-base font-semibold text-gray-400 select-none flex-shrink-0">${H(host.currency)}</span><input type="text" inputmode="decimal" placeholder="0.00" data-testid="po-doc-payment-amount-input" class="${MONEY_INPUT}" value="${H(st.paymentAmount)}" data-pm-field="paymentAmount" data-pm-money></div></div>`
          + `<div class="grid grid-cols-2 gap-2 pt-1"><button type="button"${st.recording ? ' disabled=""' : ''} data-testid="po-doc-payment-back-btn" class="flex items-center justify-center h-11 px-4 rounded-lg font-semibold text-sm border border-gray-300 text-gray-600 bg-white hover:bg-gray-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed" data-pm-pay="back">Back</button>`
          + `<button type="button"${canPay ? '' : ' disabled=""'} data-testid="po-doc-payment-save-btn" class="flex items-center justify-center gap-1.5 h-11 px-3 rounded-lg font-semibold text-sm transition-all min-w-0 ${canPay ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm hover:shadow-md active:scale-[0.98]' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}" data-pm-pay="save">${st.recording ? `${fi('FiLoader', { cls: 'w-4 h-4 animate-spin flex-shrink-0' })}<span class="truncate">Saving…</span>` : '<span class="truncate">Save Payment</span>'}</button></div>`)
      + `</div>`;
  }

  function totalSummary(amount, drafts) {
    if (st.mode !== 'invoice' || drafts.length === 0) return '';
    const expenses = draftsTotal(drafts);
    return `<div data-testid="po-doc-total-summary" class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 mb-3 text-xs tabular-nums"><span class="text-gray-500">Invoice ${T}${money(Number(amount) || 0)}${T} + Expenses ${T}${money(expenses)}</span><span data-testid="po-doc-total-summary-total" class="text-sm font-bold text-gray-900">Total ${T}${money(addMoney(amount, expenses))}</span></div>`;
  }

  const saveButton = ({ enabled, busy, label, testId, act }) => `<button type="button"${enabled ? '' : ' disabled=""'} data-testid="${testId}" class="flex items-center justify-center gap-1.5 h-11 px-4 rounded-lg font-semibold text-sm transition-all min-w-0 ${enabled ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm hover:shadow-md active:scale-[0.98]' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}" data-pm-act="${act}">${busy ? `${fi('FiLoader', { cls: 'w-4 h-4 animate-spin flex-shrink-0' })}<span class="truncate">Saving…</span>` : `<span class="truncate">${label}</span>`}</button>`;

  function footer() {
    if (!(st.screen === 'add' || (st.screen === 'view' && st.viewing))) return '';
    const add = st.screen === 'add';
    return `<div data-testid="po-doc-footer" class="flex-shrink-0 px-6 py-4 border-t border-gray-200 bg-white">`
      + (add ? totalSummary(st.amount, st.drafts) : totalSummary(st.editAmount, st.editDrafts))
      + (st.pendingLeave
        ? `<div data-testid="po-doc-discard-prompt" class="flex flex-wrap items-center justify-end gap-2"><p class="flex-1 min-w-[10rem] text-sm font-semibold text-gray-800">Discard unsaved changes?</p><button type="button" data-testid="po-doc-discard-keep-btn" class="${SECONDARY}" data-pm-act="keep">Keep editing</button><button type="button" data-testid="po-doc-discard-confirm-btn" class="flex items-center justify-center h-11 px-4 rounded-lg font-semibold text-sm bg-red-600 hover:bg-red-700 text-white transition-all" data-pm-act="discard">Discard</button></div>`
        : add
          ? `<div class="flex justify-end gap-2"><button type="button" data-testid="po-doc-add-cancel-btn" class="${SECONDARY}" data-pm-act="back">Cancel</button>${saveButton({ enabled: canSubmit(), busy: st.submitting, label: `Save ${meta().noun}`, testId: 'po-doc-add-save-btn', act: 'submit' })}</div>`
          : `<div class="flex justify-end gap-2"><button type="button" data-testid="po-doc-view-back-btn" class="${SECONDARY}" data-pm-act="back">Back</button>${saveButton({ enabled: canSave(), busy: st.saving, label: 'Save Changes', testId: 'po-doc-view-save-btn', act: 'save' })}</div>`)
      + `</div>`;
  }

  function html() {
    const m = meta();
    const back = st.mode === 'invoice' && st.screen !== 'list' && st.screen !== 'recordPayment';
    const heading = st.screen === 'add' ? `Add ${m.noun}` : st.screen === 'view' ? m.noun : st.screen === 'recordPayment' ? 'Record Payment' : m.plural;
    const body = st.screen === 'recordPayment' ? paymentScreen() : st.screen === 'list' ? listScreen() : st.screen === 'add' ? addScreen() : st.viewing ? viewScreen() : '';
    return `<div class="fixed inset-0 z-50 flex items-center justify-center" data-keep="po-documents"><div aria-hidden="true" data-testid="po-doc-backdrop" class="absolute inset-0 bg-black bg-opacity-50" data-pm-act="close"></div>`
      + `<div role="dialog" aria-modal="true" data-testid="purchase-order-document-modal" class="relative bg-white rounded-2xl shadow-2xl w-full mx-3 sm:mx-auto max-w-lg overflow-hidden max-h-[85vh] flex flex-col whitespace-normal">`
      + `<div class="flex-shrink-0 px-6 py-5 border-b border-gray-200 bg-gray-50 flex items-start gap-3.5">`
      + (back ? `<button data-testid="po-doc-header-back-btn" class="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center flex-shrink-0 text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors" title="Back" data-pm-act="back">${fi('FiArrowLeft', { size: 17 })}</button>`
        : `<div class="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center flex-shrink-0 text-emerald-700">${st.screen === 'recordPayment' ? fi('FiCreditCard', { size: 18 }) : fi('FiFileText', { size: 18 })}</div>`)
      + `<div class="flex-1 min-w-0"><h2 class="text-base font-bold text-gray-900 leading-tight">${heading}</h2><p class="text-xs text-gray-500 mt-0.5">Order <span class="font-mono font-semibold text-gray-700">#${T}${H(st.order?.order_number)}</span></p></div>`
      + `<button data-testid="po-doc-close-btn" class="p-2 -mr-2 -mt-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0" title="Close" data-pm-act="close">${fi('FiX', { size: 18 })}</button></div>`
      + `<div data-testid="po-doc-body" class="flex-1 min-h-0 px-6 py-5 overflow-y-auto overflow-x-hidden [scrollbar-width:thin]">${body}</div>`
      + footer()
      + `</div></div>`;
  }

  function render() {
    if (!st) return;
    const markup = html();
    if (!root || !root.isConnected) {
      const tpl = document.createElement('template');
      tpl.innerHTML = markup;
      root = tpl.content.firstElementChild;
      st.mount().appendChild(root);
      bind(root);
    } else morphOuter(root, markup);
    if (focusNext) { root.querySelector(focusNext)?.focus(); focusNext = null; }
  }

  // ── Behaviour ─────────────────────────────────────────────────────────────────────────────
  function addFiles(list) {
    const chosen = Array.from(list || []);
    if (!chosen.length) return;
    if (chosen.find((f) => !allowed(f.name))) { host.notify('error', `Invalid file type. Allowed types are: ${ALLOWED.join(', ')}`); return; }
    const remaining = MAX_FILES - st.files.length;
    if (remaining <= 0) { host.notify('error', `You can attach at most ${MAX_FILES} files.`); return; }
    if (chosen.length > remaining) host.notify('error', `Only ${remaining} more file${remaining === 1 ? '' : 's'} can be added (max ${MAX_FILES}).`);
    st.files = [...st.files, ...chosen.slice(0, remaining)];
    render();
  }
  const resetAdd = () => Object.assign(st, { amount: '', remarks: '', name: '', drafts: [], addAttempted: false, amountTouched: false, files: [] });
  function openView(doc) {
    Object.assign(st, { viewing: doc, attachments: attachmentsOf(doc), editAmount: doc.amount != null ? String(doc.amount) : '', editRemarks: doc.remarks || '', editName: doc.name || '', editDrafts: toDrafts(doc.expenses), editAttempted: false, editAmountTouched: false, screen: 'view' });
    render();
  }
  function leaveScreen() {
    if (st.mode !== 'invoice') { close(); return; }
    if (st.screen === 'view') { st.viewing = null; st.screen = 'list'; render(); } else if (st.screen === 'add' && entries().length > 0) { resetAdd(); st.screen = 'list'; render(); } else close();
  }
  const requestLeave = (action) => { if (hasUnsaved()) { st.pendingLeave = action; render(); } else action(); };
  function focusFirstError() {
    requestAnimationFrame(() => {
      const first = root?.querySelector('[role="dialog"] [aria-invalid="true"]');
      if (!first) return;
      first.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
      first.focus({ preventScroll: true });
    });
  }
  const fail = (err, fallback) => host.notify('error', err?.response?.data?.message || err?.message || fallback);

  async function submit() {
    if (!canSubmit()) return;
    if (st.mode === 'invoice' && !(numAmount() > 0 && st.files.length > 0 && allValid(st.drafts))) { st.addAttempted = true; render(); focusFirstError(); return; }
    st.submitting = true; render();
    try {
      const fd = new FormData();
      st.files.forEach((f) => fd.append('files', f));
      fd.append('purchaseOrderId', st.order._id);
      fd.append('type', meta().docType);
      if (st.mode === 'invoice') {
        fd.append('amount', String(numAmount()));
        if (st.remarks) fd.append('remarks', st.remarks);
        if (st.drafts.length > 0) fd.append('expenses', JSON.stringify(toPayload(st.drafts)));
      } else fd.append('name', st.name.trim());
      const res = await server.uploadPurchaseOrderDocument(fd);
      const savedDrafts = st.drafts;
      host.notify('success', `${meta().noun} recorded successfully.`);
      onUploadSuccess?.(st, res);
      const amount = numAmount();
      resetAdd();
      if (st.mode === 'invoice') {
        const expenses = draftsTotal(savedDrafts);
        const payable = addMoney(amount, expenses);
        Object.assign(st, { savedAmount: amount, savedExpenses: expenses, paymentAmount: payable > 0 ? String(payable) : '', wantsPayment: false, screen: 'recordPayment' });
      } else { st.submitting = false; close(); return; }
    } catch (err) { fail(err, `Failed to record ${meta().noun.toLowerCase()}.`); }
    if (st) { st.submitting = false; render(); }
  }

  async function save() {
    if (!canSave() || !st.viewing) return;
    if (st.mode === 'invoice' && !(Number(st.editAmount) > 0 && allValid(st.editDrafts))) { st.editAttempted = true; render(); focusFirstError(); return; }
    st.saving = true; render();
    try {
      const fd = new FormData();
      fd.append('purchaseOrderId', st.order._id);
      fd.append('documentId', st.viewing._id);
      const updates = {};
      if (st.mode === 'invoice') {
        const amt = Number(st.editAmount);
        fd.append('amount', String(amt)); updates.amount = amt;
        fd.append('remarks', st.editRemarks); updates.remarks = st.editRemarks;
        fd.append('expenses', JSON.stringify(toPayload(st.editDrafts)));
      } else { fd.append('name', st.editName.trim()); updates.name = st.editName.trim(); }
      const res = await server.uploadPurchaseOrderDocument(fd);
      if (st.mode === 'invoice') updates.expenses = res?.expenses || [];
      host.notify('success', `${meta().noun} updated successfully.`);
      onEditSuccess?.(st, st.viewing._id, updates);
      if (st.mode === 'invoice') { st.screen = 'list'; st.viewing = null; } else { st.saving = false; close(); return; }
    } catch (err) { fail(err, `Failed to update ${meta().noun.toLowerCase()}.`); }
    if (st) { st.saving = false; render(); }
  }

  function applyAttachments(list) {
    st.attachments = list;
    st.viewing = st.viewing ? { ...st.viewing, attachments: list, documentUrl: undefined } : st.viewing;
    onAttachmentsChange?.(st, st.viewing._id, list);
  }
  async function attachmentWrite(fields, files, busyId, success, fallback) {
    st.busy = busyId; render();
    try {
      const fd = new FormData();
      files.forEach((f) => fd.append('files', f));
      fd.append('purchaseOrderId', st.order._id);
      fd.append('documentId', st.viewing._id);
      for (const [k, v] of Object.entries(fields)) fd.append(k, v);
      const res = await server.uploadPurchaseOrderDocument(fd);
      host.notify('success', success);
      applyAttachments(res?.attachments || []);
    } catch (err) { fail(err, fallback); }
    if (st) { st.busy = null; st.replacing = null; render(); }
  }

  async function recordPayment() {
    if (!((Number(st.paymentAmount) || 0) > 0) || st.recording) return;
    st.recording = true; render();
    try {
      await server.recordSupplierPayment(host.buildSupplierPaymentEntry({ supplierId: st.order.supplier_id, paymentAmount: Number(st.paymentAmount) || 0, paymentMethod: st.paymentMethod }));
      host.notify('success', 'Payment recorded successfully.');
      st.screen = 'list';
    } catch (err) { fail(err, 'Failed to record payment.'); }
    if (st) { st.recording = false; render(); }
  }

  function draftList(which) { return which === 'add' ? st.drafts : st.editDrafts; }
  function setDrafts(which, drafts) { if (which === 'add') st.drafts = drafts; else st.editDrafts = drafts; }
  function addDraft(which) {
    const list = draftList(which);
    if (list.length >= MAX_EXPENSES) return;
    const d = newDraft();
    setDrafts(which, [...list, d]);
    focusNext = `[data-pm-exp="${which}:${d.key}:type"]`;
    render();
  }

  function bind(el) {
    el.addEventListener('input', (e) => {
      const t = e.target;
      if (t.dataset.pmExp) {
        const [which, key, field] = t.dataset.pmExp.split(':');
        if (field === 'amount' && !isMoney(t.value)) { render(); return; }
        setDrafts(which, draftList(which).map((d) => (d.key === key ? { ...d, [field]: t.value } : d)));
        render();
        return;
      }
      const f = t.dataset.pmField;
      if (!f || f === 'paymentMethod') return;
      if (t.hasAttribute('data-pm-money') && !isMoney(t.value)) { render(); return; }
      st[f] = t.value;
      render();
    });
    el.addEventListener('change', (e) => {
      const t = e.target;
      if (t.dataset.pmField === 'paymentMethod') { st.paymentMethod = t.value; render(); return; }
      const which = t.dataset.pmFiles;
      if (!which) return;
      const chosen = Array.from(t.files || []);
      t.value = '';
      if (which === 'add') { addFiles(chosen); return; }
      if (which === 'replace') {
        const id = st.replacing; const file = chosen[0];
        if (!file || !st.viewing || !id) return;
        if (!allowed(file.name)) { host.notify('error', `Invalid file type. Allowed types are: ${ALLOWED.join(', ')}`); return; }
        attachmentWrite({ attachmentId: id }, [file], id, 'Attachment replaced successfully.', 'Failed to replace attachment.');
        return;
      }
      if (which === 'attach') {
        if (!chosen.length || !st.viewing) return;
        const remaining = MAX_FILES - st.attachments.length;
        if (remaining <= 0) { host.notify('error', `You can attach at most ${MAX_FILES} files.`); return; }
        const up = chosen.slice(0, remaining);
        if (chosen.length > remaining) host.notify('error', `Only ${remaining} more file${remaining === 1 ? '' : 's'} can be added (max ${MAX_FILES}).`);
        if (up.find((f) => !allowed(f.name))) { host.notify('error', `Invalid file type. Allowed types are: ${ALLOWED.join(', ')}`); return; }
        attachmentWrite({}, up, 'add', 'Attachment added successfully.', 'Failed to add attachment.');
      }
    });
    el.addEventListener('focusin', (e) => { if (e.target.matches('[data-pm-field="amount"], [data-pm-field="editAmount"], [data-pm-field="paymentAmount"]')) e.target.select(); });
    el.addEventListener('focusout', (e) => {
      const t = e.target;
      if (!st) return;
      if (t.dataset.pmField === 'amount') { if (!st.amountTouched) { st.amountTouched = true; render(); } return; }
      if (t.dataset.pmField === 'editAmount') { if (!st.editAmountTouched) { st.editAmountTouched = true; render(); } return; }
      if (t.dataset.pmExp) {
        const [which, key, field] = t.dataset.pmExp.split(':');
        if (field === 'remarks') return;
        setDrafts(which, draftList(which).map((d) => {
          if (d.key !== key) return d;
          const next = d.touched?.[field] ? d : { ...d, touched: { ...d.touched, [field]: true } };
          return field === 'type' ? { ...next, type: d.type.trim().toUpperCase() } : next;
        }));
        render();
      }
    });
    el.addEventListener('keydown', (e) => {
      const t = e.target;
      if (e.key === 'Enter' && t.dataset.pmExp) {
        e.preventDefault();
        const [which, key] = t.dataset.pmExp.split(':');
        const list = draftList(which);
        const i = list.findIndex((d) => d.key === key);
        if (i === list.length - 1) addDraft(which); else el.querySelector(`[data-pm-exp="${which}:${list[i + 1].key}:type"]`)?.focus();
      }
      if ((e.key === 'Enter' || e.key === ' ') && t.dataset.pmOpen && t.getAttribute('role') === 'button') { e.preventDefault(); openView(entries().find((d) => String(d._id) === t.dataset.pmOpen)); }
    });
    el.addEventListener('dragover', (e) => { if (e.target.closest('[data-pm-drop]')) { e.preventDefault(); if (!st.dragging) { st.dragging = true; render(); } } });
    el.addEventListener('dragleave', (e) => { if (e.target.closest('[data-pm-drop]') && st.dragging) { st.dragging = false; render(); } });
    el.addEventListener('drop', (e) => { if (e.target.closest('[data-pm-drop]')) { e.preventDefault(); st.dragging = false; addFiles(e.dataTransfer.files); } });
    el.addEventListener('click', (e) => {
      const t = e.target;
      if (t.closest('[data-pm-link]')) return; // the eye opens the file, not the row
      const act = t.closest('[data-pm-act]')?.dataset.pmAct;
      if (act === 'close') { requestLeave(close); return; }
      if (act === 'back') { requestLeave(leaveScreen); return; }
      if (act === 'keep') { st.pendingLeave = null; render(); return; }
      if (act === 'discard') { const a = st.pendingLeave; st.pendingLeave = null; a?.(); return; }
      if (act === 'submit') { submit(); return; }
      if (act === 'save') { save(); return; }
      const open = t.closest('[data-pm-open]');
      if (open) { openView(entries().find((d) => String(d._id) === open.dataset.pmOpen)); return; }
      const go = t.closest('[data-pm-go]')?.dataset.pmGo;
      if (go) { st.screen = go; render(); return; }
      const pay = t.closest('[data-pm-pay]')?.dataset.pmPay;
      if (pay === 'start') { st.wantsPayment = true; render(); return; }
      if (pay === 'back') { st.wantsPayment = false; render(); return; }
      if (pay === 'save') { recordPayment(); return; }
      if (t.closest('[data-pm-pick]')) { el.querySelector('[data-pm-files="add"]').click(); return; }
      const rm = t.closest('[data-pm-remove-file]');
      if (rm) { st.files = st.files.filter((_, i) => i !== Number(rm.dataset.pmRemoveFile)); render(); return; }
      const rep = t.closest('[data-pm-replace]');
      if (rep) { st.replacing = rep.dataset.pmReplace; el.querySelector('[data-pm-files="replace"]').click(); return; }
      const del = t.closest('[data-pm-remove]');
      if (del) {
        if (!st.viewing || st.attachments.length <= 1) return;
        attachmentWrite({ removeAttachmentId: del.dataset.pmRemove }, [], del.dataset.pmRemove, 'Attachment removed successfully.', 'Failed to remove attachment.');
        return;
      }
      if (t.closest('[data-pm-add-attachment]')) { el.querySelector('[data-pm-files="attach"]').click(); return; }
      const addExp = t.closest('[data-pm-exp-add]');
      if (addExp) { addDraft(addExp.dataset.pmExpAdd); return; }
      const rmExp = t.closest('[data-pm-exp-remove]');
      if (rmExp) { const [which, key] = rmExp.dataset.pmExpRemove.split(':'); setDrafts(which, draftList(which).filter((d) => d.key !== key)); render(); }
    });
  }

  return {
    open, close, isOpen, render,
    get state() { return st; },
  };
}
