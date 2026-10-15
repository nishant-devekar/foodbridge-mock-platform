/*
  One driver per state, run unchanged on both sides. Drivers use production's own data-testids and
  visible labels, so the same step reaches the same state on the oracle and on the prototype.

    name        file name of the capture
    viewports   phone | tablet | desktop | wide
    scenario    { list: normal|empty|error|hang, tenant: <variant> } — how the servers answer
    expect      the list end state settle() waits for (default: from the scenario)
    steps       (page, { side, viewport }) => drive the screen into the state
*/
import { fileURLToPath } from 'node:url';

const ALL = ['phone', 'tablet', 'desktop', 'wide'];
const PHONE_DESKTOP = ['phone', 'desktop'];
const RM = { tenant: 'all-features' };
const DESKTOP = ['desktop'];
const PHONE = ['phone'];

/** A purchase order's id, as js/data/documents.js mints it (po-01 → 6a1000…001). */
const PO = (n) => `6a1${String(n).padStart(21, '0')}`;
/** Wait out the search box's two 400 ms debounces (screen, then controller). */
const typed = (page) => page.waitForTimeout(1200);

export const STATES = [
  // ── The list ────────────────────────────────────────────────────────────────────────────────
  { name: 'list', viewports: ALL },
  { name: 'list-loading', viewports: PHONE_DESKTOP, scenario: { list: 'hang' }, expect: 'loading' },
  { name: 'list-empty', viewports: PHONE_DESKTOP, scenario: { list: 'empty' } },
  { name: 'list-error', viewports: PHONE_DESKTOP, scenario: { list: 'error' }, expect: 'empty' },

  // ── A row: expand, copy, documents menu ─────────────────────────────────────────────────────
  { name: 'row-expanded', viewports: ['desktop', 'wide'], steps: async (page) => { await page.getByTestId(`sourcing-toggle-suborders-${PO(1)}`).click(); } },
  { name: 'row-expanded-items', viewports: DESKTOP, steps: async (page) => { await page.getByTestId(`sourcing-toggle-suborders-${PO(1)}`).click(); await page.getByTestId(`order-fulfillment-tab-items-${PO(1)}`).click(); } },
  { name: 'row-expanded-internal', viewports: DESKTOP, steps: async (page) => { await page.getByTestId(`sourcing-toggle-suborders-${PO(2)}`).click(); } },
  { name: 'row-expanded-delivered', viewports: DESKTOP, steps: async (page) => { await page.getByTestId(`sourcing-toggle-suborders-${PO(3)}`).click(); await page.getByTestId(`sourcing-toggle-suborders-${PO(4)}`).click(); } },
  { name: 'row-panel-copied', viewports: PHONE_DESKTOP, steps: async (page, { viewport }) => {
    if (viewport === 'phone') await page.setViewportSize({ width: 768, height: 812 });
    await page.getByTestId(`sourcing-toggle-suborders-${PO(1)}`).click(); await page.getByTestId(`order-fulfillment-copy-number-btn-${PO(1)}`).click(); await page.waitForTimeout(300);
    if (viewport === 'phone') await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(300);
  } },
  { name: 'row-copied', viewports: DESKTOP, steps: async (page) => { await page.getByTestId(`sourcing-copy-id-${PO(1)}`).click(); } },
  { name: 'documents-menu', viewports: ['desktop', 'tablet'], steps: async (page) => { await page.getByTestId(`sourcing-row-${PO(3)}-documents-trigger-btn`).click(); } },
  { name: 'documents-menu-with-docs', viewports: DESKTOP, steps: async (page) => { await page.getByTestId('sourcing-table-next-btn').click(); await page.getByTestId(`sourcing-row-${PO(22)}-documents-trigger-btn`).click(); } },
  { name: 'documents-menu-internal', viewports: DESKTOP, steps: async (page) => { await page.getByTestId(`sourcing-row-${PO(2)}-documents-trigger-btn`).click(); } },
  { name: 'card-expanded', viewports: PHONE, steps: async (page) => { await page.getByTestId(`sourcing-card-toggle-expand-${PO(3)}`).click(); await page.getByTestId(`sourcing-card-toggle-expand-${PO(7)}`).click(); } },
  { name: 'card-expanded-with-docs', viewports: PHONE, steps: async (page) => { await page.getByTestId('sourcing-card-next-btn').click(); await page.getByTestId(`sourcing-card-toggle-expand-${PO(22)}`).click(); } },
  { name: 'card-expanded-internal', viewports: PHONE, steps: async (page) => { await page.getByTestId(`sourcing-card-toggle-expand-${PO(2)}`).click(); } },

  // ── Status change → UpdateAuditDrawer ──────────────────────────────────────────────────────
  { name: 'audit-drawer', viewports: ALL, steps: (page, { viewport }) => openAudit(page, viewport, 1) },
  { name: 'audit-variance', viewports: PHONE_DESKTOP, steps: async (page, { viewport }) => { await openAudit(page, viewport, 1); await lessReceived(page, viewport); } },
  { name: 'audit-variance-error', viewports: PHONE_DESKTOP, steps: async (page, { viewport }) => {
    await openAudit(page, viewport, 1); await lessReceived(page, viewport); await page.getByTestId('audit-drawer-submit-btn').click(); await page.waitForTimeout(800);
  } },
  { name: 'audit-history-open', viewports: PHONE_DESKTOP, steps: async (page, { viewport }) => { await openAudit(page, viewport, 1); await page.getByTestId('audit-drawer-history-toggle-0').click(); } },
  { name: 'audit-receipt-filled', viewports: DESKTOP, steps: async (page, { viewport }) => {
    await openAudit(page, viewport, 1); await page.getByTestId('audit-drawer-voucher-number-input').fill('VCH-2291'); await page.getByTestId('audit-drawer-received-date-input').fill('2026-09-27');
    await page.getByTestId('audit-drawer-comment-textarea').fill('Crates counted at the gate');
  } },
  { name: 'audit-discard-prompt', viewports: PHONE_DESKTOP, steps: async (page, { viewport }) => {
    await openAudit(page, viewport, 1); await page.getByTestId('audit-drawer-comment-textarea').fill('Half the crates arrived late'); await openDrawerClose(page).click(); await page.waitForTimeout(300);
  } },
  { name: 'audit-discard-wait', viewports: DESKTOP, steps: async (page, { viewport }) => {
    await openAudit(page, viewport, 1); await page.getByTestId('audit-drawer-comment-textarea').fill('Half the crates arrived late'); await openDrawerClose(page).click(); await page.waitForTimeout(300);
    await page.getByTestId('discard-changes-modal-cancel-btn').click(); await page.waitForTimeout(300);
  } },
  { name: 'audit-submitted', viewports: PHONE_DESKTOP, steps: async (page, { viewport }) => {
    await openAudit(page, viewport, 1); await page.getByTestId('audit-drawer-comment-textarea').fill('All crates received'); await page.getByTestId('audit-drawer-submit-btn').click();
    await page.getByTestId('audit-drawer').waitFor({ state: 'detached' }); await page.waitForLoadState('networkidle'); await page.waitForTimeout(600);
  } },
  { name: 'audit-submitted-variance', viewports: DESKTOP, steps: async (page, { viewport }) => {
    await openAudit(page, viewport, 1); await lessReceived(page, viewport); await page.getByTestId('audit-drawer-comment-textarea').fill('Two pouches short'); await page.getByTestId('audit-drawer-submit-btn').click();
    await page.getByTestId('audit-drawer').waitFor({ state: 'detached' }); await page.waitForLoadState('networkidle'); await page.waitForTimeout(600);
    await page.getByTestId(`sourcing-toggle-suborders-${PO(1)}`).click();
  } },
  { name: 'audit-cancelled', viewports: DESKTOP, steps: async (page, { viewport }) => {
    await openAudit(page, viewport, 1); await page.getByTestId('audit-drawer-cancel-btn').click(); await page.getByTestId('audit-drawer').waitFor({ state: 'detached' }); await page.waitForLoadState('networkidle'); await page.waitForTimeout(400);
  } },

  // ── Documents: the PO document and goods receipt (PODocumentModal) ──────────────────────────
  { name: 'doc-po', viewports: ALL, steps: (page, { viewport }) => docAction(page, viewport, 1, 'po-document') },
  { name: 'doc-po-internal', viewports: DESKTOP, steps: (page, { viewport }) => docAction(page, viewport, 2, 'po-document') },
  { name: 'doc-grn-short', viewports: PHONE_DESKTOP, steps: (page, { viewport }) => docAction(page, viewport, 3, 'grn') },
  { name: 'doc-grn-match', viewports: DESKTOP, steps: (page, { viewport }) => docAction(page, viewport, 4, 'grn') },
  { name: 'doc-po-closed', viewports: DESKTOP, steps: async (page, { viewport }) => { await docAction(page, viewport, 1, 'po-document'); await page.getByTestId('po-document-close-btn').click(); await page.waitForTimeout(200); } },

  // ── Documents: invoices and other documents (PurchaseOrderDocumentModal) ────────────────────
  { name: 'invoice-add', viewports: PHONE_DESKTOP, steps: (page, { viewport }) => docAction(page, viewport, 3, 'invoice') },
  { name: 'invoice-add-refused', viewports: PHONE_DESKTOP, steps: async (page, { viewport }) => { await docAction(page, viewport, 3, 'invoice'); await page.getByTestId('po-doc-add-save-btn').click(); await page.waitForTimeout(700); } },
  { name: 'invoice-add-filled', viewports: PHONE_DESKTOP, steps: async (page, { viewport }) => { await docAction(page, viewport, 3, 'invoice'); await fillInvoice(page); } },
  { name: 'invoice-add-expenses', viewports: PHONE_DESKTOP, steps: async (page, { viewport }) => {
    await docAction(page, viewport, 3, 'invoice'); await fillInvoice(page);
    await page.getByTestId('po-doc-expense-add-btn').click(); await page.getByTestId('po-doc-expense-0-type-input').fill('transport'); await page.getByTestId('po-doc-expense-0-amount-input').fill('450');
    await page.getByTestId('po-doc-expense-0-remarks-input').fill('Tempo from Chakan'); await page.getByTestId('po-doc-expense-add-btn').click(); await page.waitForTimeout(200);
  } },
  { name: 'invoice-expense-refused', viewports: DESKTOP, steps: async (page, { viewport }) => {
    await docAction(page, viewport, 3, 'invoice'); await fillInvoice(page);
    await page.getByTestId('po-doc-expense-add-btn').click(); await page.getByTestId('po-doc-expense-0-amount-input').fill('120');
    await page.getByTestId('po-doc-add-save-btn').click(); await page.waitForTimeout(700);
  } },
  { name: 'invoice-wrong-file', viewports: DESKTOP, steps: async (page, { viewport }) => { await docAction(page, viewport, 3, 'invoice'); await page.getByTestId('po-doc-attachment-file-input').setInputFiles(fixture('notes.txt')); await page.waitForTimeout(400); } },
  { name: 'invoice-leave-prompt', viewports: DESKTOP, steps: async (page, { viewport }) => { await docAction(page, viewport, 3, 'invoice'); await fillInvoice(page); await page.getByTestId('po-doc-close-btn').click(); await page.waitForTimeout(200); } },
  { name: 'invoice-saved', viewports: PHONE_DESKTOP, steps: async (page, { viewport }) => { await docAction(page, viewport, 3, 'invoice'); await fillInvoice(page); await saveInvoice(page); } },
  { name: 'invoice-saved-expenses', viewports: DESKTOP, steps: async (page, { viewport }) => {
    await docAction(page, viewport, 3, 'invoice'); await fillInvoice(page);
    await page.getByTestId('po-doc-expense-add-btn').click(); await page.getByTestId('po-doc-expense-0-type-input').fill('Loading'); await page.getByTestId('po-doc-expense-0-amount-input').fill('120.50');
    await saveInvoice(page);
  } },
  { name: 'invoice-payment-form', viewports: PHONE_DESKTOP, steps: async (page, { viewport }) => { await docAction(page, viewport, 3, 'invoice'); await fillInvoice(page); await saveInvoice(page); await page.getByTestId('po-doc-payment-start-btn').click(); await page.getByTestId('po-doc-payment-method-select').selectOption('upi'); } },
  { name: 'invoice-payment-saved', viewports: DESKTOP, steps: async (page, { viewport }) => {
    await docAction(page, viewport, 3, 'invoice'); await fillInvoice(page); await saveInvoice(page); await page.getByTestId('po-doc-payment-start-btn').click();
    await page.getByTestId('po-doc-payment-amount-input').fill('5000'); await page.getByTestId('po-doc-payment-save-btn').click(); await page.waitForTimeout(700);
  } },
  { name: 'invoice-skip-to-list', viewports: DESKTOP, steps: async (page, { viewport }) => { await docAction(page, viewport, 3, 'invoice'); await fillInvoice(page); await saveInvoice(page); await page.getByTestId('po-doc-payment-skip-btn').click(); await page.waitForTimeout(200); } },
  { name: 'invoice-then-menu', viewports: DESKTOP, steps: async (page, { viewport }) => {
    await docAction(page, viewport, 3, 'invoice'); await fillInvoice(page); await saveInvoice(page); await page.getByTestId('po-doc-payment-skip-btn').click(); await page.getByTestId('po-doc-close-btn').click();
    await page.getByTestId(`sourcing-row-${PO(3)}-documents-trigger-btn`).click(); await page.waitForTimeout(200);
  } },
  { name: 'invoice-list', viewports: PHONE_DESKTOP, steps: (page, { viewport }) => docAction(page, viewport, 4, 'invoice') },
  { name: 'invoice-view', viewports: PHONE_DESKTOP, steps: async (page, { viewport }) => { await docAction(page, viewport, 4, 'invoice'); await page.locator('[data-testid^="po-doc-row-"][role="button"]').first().click(); await page.waitForTimeout(200); } },
  { name: 'invoice-view-edited', viewports: DESKTOP, steps: async (page, { viewport }) => {
    await docAction(page, viewport, 4, 'invoice'); await page.locator('[data-testid^="po-doc-row-"][role="button"]').first().click();
    await page.getByTestId('po-doc-edit-amount-input').fill('14300'); await page.getByTestId('po-doc-edit-remarks-input').fill('Revised after short delivery'); await page.waitForTimeout(200);
  } },
  { name: 'invoice-view-saved', viewports: DESKTOP, steps: async (page, { viewport }) => {
    await docAction(page, viewport, 4, 'invoice'); await page.locator('[data-testid^="po-doc-row-"][role="button"]').first().click();
    await page.getByTestId('po-doc-edit-amount-input').fill('14300'); await page.getByTestId('po-doc-view-save-btn').click(); await page.waitForTimeout(700);
  } },
  { name: 'invoice-attachment-added', viewports: DESKTOP, steps: async (page, { viewport }) => {
    await docAction(page, viewport, 4, 'invoice'); await page.locator('[data-testid^="po-doc-row-"][role="button"]').first().click();
    await page.getByTestId('po-doc-add-attachment-file-input').setInputFiles(fixture('delivery-photo.png')); await page.waitForTimeout(700);
  } },
  { name: 'invoice-attachment-removed', viewports: DESKTOP, steps: async (page, { viewport }) => {
    await docAction(page, viewport, 4, 'invoice'); await page.locator('[data-testid^="po-doc-row-"][role="button"]').first().click();
    await page.getByTestId('po-doc-add-attachment-file-input').setInputFiles(fixture('delivery-photo.png')); await page.waitForTimeout(500);
    await page.locator('[data-testid$="-remove-btn"][data-testid^="po-doc-attachment-"]').first().click(); await page.waitForTimeout(700);
  } },
  { name: 'document-add', viewports: PHONE_DESKTOP, steps: (page, { viewport }) => docAction(page, viewport, 7, 'add-document') },
  { name: 'document-add-filled', viewports: DESKTOP, steps: async (page, { viewport }) => {
    await docAction(page, viewport, 7, 'add-document'); await page.getByTestId('po-doc-name-input').fill('Weighbridge slip');
    await page.getByTestId('po-doc-attachment-file-input').setInputFiles([fixture('delivery-photo.png'), fixture('supplier-invoice.pdf')]); await page.waitForTimeout(300);
  } },
  { name: 'document-saved', viewports: DESKTOP, steps: async (page, { viewport }) => {
    await docAction(page, viewport, 7, 'add-document'); await page.getByTestId('po-doc-name-input').fill('Weighbridge slip');
    await page.getByTestId('po-doc-attachment-file-input').setInputFiles(fixture('delivery-photo.png')); await page.getByTestId('po-doc-add-save-btn').click(); await page.waitForTimeout(700);
    await page.getByTestId(`sourcing-row-${PO(7)}-documents-trigger-btn`).click(); await page.waitForTimeout(200);
  } },
  { name: 'document-view', viewports: PHONE_DESKTOP, steps: (page, { viewport }) => docAction(page, viewport, 7, 'document') },

  // ── Create a purchase order (CreateOrderDrawer) ──────────────────────────────────────────────
  { name: 'create-open', viewports: ALL, steps: (page, { viewport }) => openCreate(page, viewport) },
  { name: 'create-supplier-menu', viewports: PHONE_DESKTOP, steps: async (page, { viewport }) => { await openCreate(page, viewport); await page.getByTestId('create-order-supplier-select-btn').click(); await page.waitForTimeout(200); } },
  { name: 'create-supplier-search', viewports: DESKTOP, steps: async (page, { viewport }) => { await openCreate(page, viewport); await page.getByTestId('create-order-supplier-select-btn').click(); await page.getByTestId('create-order-supplier-dropdown-search-input').fill('mill'); await page.waitForTimeout(200); } },
  { name: 'create-supplier-none', viewports: DESKTOP, steps: async (page, { viewport }) => { await openCreate(page, viewport); await page.getByTestId('create-order-supplier-select-btn').click(); await page.getByTestId('create-order-supplier-dropdown-search-input').fill('zzz'); await page.waitForTimeout(200); } },
  { name: 'create-external', viewports: ALL, steps: (page, { viewport }) => pickSupplier(page, viewport, SUP(1)) },
  { name: 'create-internal', viewports: PHONE_DESKTOP, steps: (page, { viewport }) => pickSupplier(page, viewport, LOC(2)) },
  { name: 'create-internal-small', viewports: DESKTOP, steps: (page, { viewport }) => pickSupplier(page, viewport, LOC(3)) },
  { name: 'create-subcategory', viewports: PHONE_DESKTOP, steps: async (page, { viewport }) => {
    await pickSupplier(page, viewport, SUP(1));
    await page.getByTestId(viewport === 'phone' ? `create-order-subcategory-chip-mobile-${CAT(3)}` : `create-order-sidebar-subcategory-${CAT(3)}`).click(); await page.waitForTimeout(300);
  } },
  { name: 'create-category-collapsed', viewports: DESKTOP, steps: async (page, { viewport }) => { await pickSupplier(page, viewport, SUP(1)); await page.getByTestId(`create-order-sidebar-category-toggle-${CAT(11)}`).click(); await page.waitForTimeout(300); } },
  { name: 'create-search', viewports: PHONE_DESKTOP, steps: async (page, { viewport }) => { await pickSupplier(page, viewport, SUP(1)); await page.getByTestId('create-order-product-search-input').fill('dal'); await page.waitForTimeout(700); } },
  { name: 'create-search-none', viewports: DESKTOP, steps: async (page, { viewport }) => { await pickSupplier(page, viewport, SUP(1)); await page.getByTestId('create-order-product-search-input').fill('zzz'); await page.waitForTimeout(700); } },
  { name: 'create-qty', viewports: PHONE_DESKTOP, steps: async (page, { viewport }) => { await pickSupplier(page, viewport, SUP(1)); await addQty(page, viewport, PRD(1), '6'); await addQty(page, viewport, PRD(8), '2.5'); } },
  { name: 'create-qty-stepper', viewports: DESKTOP, steps: async (page, { viewport }) => {
    await pickSupplier(page, viewport, SUP(1)); await page.getByTestId(`create-order-product-qty-increment-${PRD(2)}`).click(); await page.getByTestId(`create-order-product-qty-increment-${PRD(2)}`).click(); await page.waitForTimeout(400);
  } },
  { name: 'create-qty-invalid', viewports: DESKTOP, steps: async (page, { viewport }) => { await pickSupplier(page, viewport, SUP(1)); await page.getByTestId(`create-order-product-qty-input-${PRD(1)}`).fill('1.234'); await page.waitForTimeout(400); } },
  { name: 'create-unit-menu', viewports: DESKTOP, steps: async (page, { viewport }) => { await pickSupplier(page, viewport, SUP(1)); await page.getByTestId(`create-order-product-unit-toggle-${PRD(1)}`).click(); await page.waitForTimeout(200); } },
  { name: 'create-unit-picked', viewports: DESKTOP, steps: async (page, { viewport }) => {
    await pickSupplier(page, viewport, SUP(1)); await page.getByTestId(`create-order-product-unit-toggle-${PRD(1)}`).click(); await page.getByTestId(`create-order-product-unit-option-${PRD(1)}-Crate`).click();
    await addQty(page, viewport, PRD(1), '3');
  } },
  { name: 'create-price-edit', viewports: DESKTOP, steps: async (page, { viewport }) => { await pickSupplier(page, viewport, SUP(1)); await page.getByTestId(`create-order-product-price-edit-btn-${PRD(2)}`).click(); await page.waitForTimeout(200); } },
  { name: 'create-price-invalid', viewports: DESKTOP, steps: async (page, { viewport }) => {
    await pickSupplier(page, viewport, SUP(1)); await page.getByTestId(`create-order-product-price-edit-btn-${PRD(2)}`).click(); await page.getByTestId(`create-order-product-price-input-${PRD(2)}`).fill('');
    await page.getByTestId(`create-order-product-price-confirm-btn-${PRD(2)}`).click(); await page.waitForTimeout(200);
  } },
  { name: 'create-price-changed', viewports: DESKTOP, steps: async (page, { viewport }) => {
    await pickSupplier(page, viewport, SUP(1)); await page.getByTestId(`create-order-product-price-edit-btn-${PRD(2)}`).click(); await page.getByTestId(`create-order-product-price-input-${PRD(2)}`).fill('34.5');
    await page.getByTestId(`create-order-product-price-confirm-btn-${PRD(2)}`).click(); await addQty(page, viewport, PRD(2), '4');
  } },
  { name: 'create-cart', viewports: PHONE_DESKTOP, steps: async (page, { viewport }) => { await pickSupplier(page, viewport, SUP(1)); await addQty(page, viewport, PRD(1), '6'); await addQty(page, viewport, PRD(8), '2'); await submitCreate(page, viewport); } },
  { name: 'create-cart-internal', viewports: PHONE_DESKTOP, steps: async (page, { viewport }) => { await pickSupplier(page, viewport, LOC(2)); await addQty(page, viewport, LPRD(2, 1), '10'); await submitCreate(page, viewport); } },
  { name: 'create-submit-hint', viewports: DESKTOP, steps: async (page, { viewport }) => { await openCreate(page, viewport); await page.getByTestId('create-order-submit-btn').hover({ force: true }); await page.waitForTimeout(300); } },
  { name: 'create-cart-deleted', viewports: PHONE_DESKTOP, steps: async (page, { viewport }) => {
    await toCart(page, viewport); await page.getByTestId(`cart-item-remove-btn-${cartVariant(viewport)}-${PRD(1)}`).click(); await page.getByTestId('order-cart-tab-deleted').click(); await page.waitForTimeout(300);
  } },
  { name: 'create-cart-deleted-empty', viewports: DESKTOP, steps: async (page, { viewport }) => { await toCart(page, viewport); await page.getByTestId('order-cart-tab-deleted').click(); await page.waitForTimeout(300); } },
  { name: 'create-cart-restored', viewports: DESKTOP, steps: async (page, { viewport }) => {
    await toCart(page, viewport); await page.getByTestId(`cart-item-remove-btn-desktop-${PRD(1)}`).click(); await page.getByTestId('order-cart-tab-deleted').click();
    await page.getByTestId(`cart-deleted-item-restore-btn-desktop-${PRD(1)}`).click(); await page.getByTestId('order-cart-tab-cart').click(); await page.waitForTimeout(400);
  } },
  { name: 'create-cart-qty', viewports: PHONE_DESKTOP, steps: async (page, { viewport }) => {
    await toCart(page, viewport); await page.getByTestId(`cart-item-qty-increment-btn-${cartVariant(viewport)}-${PRD(8)}`).click(); await page.getByTestId(`cart-item-qty-increment-btn-${cartVariant(viewport)}-${PRD(8)}`).click(); await page.waitForTimeout(400);
  } },
  { name: 'create-cart-comment', viewports: DESKTOP, steps: async (page, { viewport }) => {
    await toCart(page, viewport); await page.getByTestId('order-cart-comment-card').click(); await page.getByTestId('order-cart-comment-input').fill('Deliver before 9 AM, rear gate'); await page.waitForTimeout(200);
  } },
  { name: 'create-cart-comment-added', viewports: DESKTOP, steps: async (page, { viewport }) => {
    await toCart(page, viewport); await page.getByTestId('order-cart-comment-card').click(); await page.getByTestId('order-cart-comment-input').fill('Deliver before 9 AM, rear gate'); await page.getByTestId('order-cart-comment-done-btn').click(); await page.waitForTimeout(200);
  } },
  { name: 'create-cart-summary', viewports: ['phone'], steps: async (page, { viewport }) => { await toCart(page, viewport); await page.getByTestId('mobile-summary-expand-toggle').click(); await page.waitForTimeout(300); } },
  { name: 'create-cart-summary-comment', viewports: ['phone'], steps: async (page, { viewport }) => {
    await toCart(page, viewport); await page.getByTestId('mobile-summary-expand-toggle').click(); await page.getByTestId('mobile-summary-comment-card').click(); await page.getByTestId('mobile-summary-comment-input').fill('Deliver before 9 AM'); await page.waitForTimeout(300);
  } },
  { name: 'create-placed', viewports: PHONE_DESKTOP, steps: async (page, { viewport }) => {
    await toCart(page, viewport); await page.getByTestId(viewport === 'phone' ? 'mobile-summary-confirm-btn' : 'order-cart-confirm-btn').click();
    await page.getByTestId('order-cart-modal').waitFor({ state: 'detached' }); await page.waitForLoadState('networkidle'); await page.waitForTimeout(800);
  } },
  { name: 'create-internal-payment', viewports: PHONE_DESKTOP, steps: async (page, { viewport }) => {
    await pickSupplier(page, viewport, LOC(2)); await addQty(page, viewport, LPRD(2, 1), '10'); await submitCreate(page, viewport);
    await page.getByTestId(viewport === 'phone' ? 'mobile-summary-confirm-btn' : 'order-cart-confirm-btn').click(); await page.waitForTimeout(600);
  } },
  { name: 'create-internal-payment-split', viewports: DESKTOP, steps: async (page, { viewport }) => {
    await pickSupplier(page, viewport, LOC(2)); await addQty(page, viewport, LPRD(2, 1), '10'); await submitCreate(page, viewport);
    await page.getByTestId('order-cart-confirm-btn').click(); await page.waitForTimeout(400);
    await page.getByTestId('payment-step-method-payOnline').click(); await page.getByTestId('payment-step-split-amount-input-pod').fill('100'); await page.waitForTimeout(300);
  } },
  { name: 'create-internal-payment-none', viewports: DESKTOP, steps: async (page, { viewport }) => {
    await pickSupplier(page, viewport, LOC(2)); await addQty(page, viewport, LPRD(2, 1), '10'); await submitCreate(page, viewport);
    await page.getByTestId('order-cart-confirm-btn').click(); await page.waitForTimeout(400); await page.getByTestId('payment-step-method-pod').click(); await page.waitForTimeout(300);
  } },
  { name: 'create-internal-payment-summary', viewports: ['phone'], steps: async (page, { viewport }) => {
    await pickSupplier(page, viewport, LOC(2)); await addQty(page, viewport, LPRD(2, 1), '10'); await submitCreate(page, viewport);
    await page.getByTestId('mobile-summary-confirm-btn').click(); await page.waitForTimeout(400); await page.getByTestId('mobile-summary-expand-toggle').click(); await page.waitForTimeout(300);
  } },
  { name: 'create-placed-internal', viewports: DESKTOP, steps: async (page, { viewport }) => {
    await pickSupplier(page, viewport, LOC(2)); await addQty(page, viewport, LPRD(2, 1), '10'); await submitCreate(page, viewport);
    await page.getByTestId('order-cart-confirm-btn').click(); await page.waitForTimeout(400); await page.getByTestId('order-cart-confirm-btn').click();
    await page.getByTestId('order-cart-modal').waitFor({ state: 'detached' }); await page.waitForLoadState('networkidle'); await page.waitForTimeout(800);
  } },
  { name: 'create-add-supplier', viewports: PHONE_DESKTOP, steps: (page, { viewport }) => openAddSupplier(page, viewport) },
  { name: 'create-add-supplier-invalid', viewports: DESKTOP, steps: async (page, { viewport }) => { await openAddSupplier(page, viewport); await page.getByTestId('add-supplier-save-btn').click(); await page.waitForTimeout(200); } },
  { name: 'create-add-supplier-filled', viewports: PHONE_DESKTOP, steps: async (page, { viewport }) => { await openAddSupplier(page, viewport); await fillSupplier(page); } },
  { name: 'create-add-supplier-bad-input', viewports: DESKTOP, steps: async (page, { viewport }) => {
    await openAddSupplier(page, viewport); await page.getByTestId('add-supplier-name-input').fill('Konkan Fresh Farms'); await page.getByTestId('add-supplier-phone-input').fill('98-22'); await page.getByTestId('add-supplier-email-input').fill('orders@konkan');
    await page.getByTestId('add-supplier-pincode-input').fill('41'); await page.getByTestId('add-supplier-save-btn').click(); await page.waitForTimeout(200);
  } },
  { name: 'create-add-supplier-state-menu', viewports: DESKTOP, steps: async (page, { viewport }) => { await openAddSupplier(page, viewport); await page.locator('#add-supplier-state-input').click(); await page.waitForTimeout(300); } },
  { name: 'create-add-supplier-state-picked', viewports: DESKTOP, steps: async (page, { viewport }) => {
    await openAddSupplier(page, viewport); await page.locator('#add-supplier-state-input').click(); await page.getByRole('option', { name: 'Maharashtra' }).click(); await page.waitForTimeout(300);
  } },
  { name: 'create-add-supplier-exempt', viewports: DESKTOP, steps: async (page, { viewport }) => { await openAddSupplier(page, viewport); await page.getByTestId('add-supplier-gst-type-exempt-radio').click(); await page.waitForTimeout(200); } },
  { name: 'create-add-supplier-gst-typed', viewports: DESKTOP, steps: async (page, { viewport }) => { await openAddSupplier(page, viewport); await page.getByTestId('add-supplier-gst-number-input').fill('27AAACK1234F1Z9'); await page.waitForTimeout(200); } },
  { name: 'create-add-supplier-opening', viewports: DESKTOP, steps: async (page, { viewport }) => {
    await openAddSupplier(page, viewport); await page.getByTestId('add-supplier-opening-balance-payable-radio').click(); await page.getByTestId('add-supplier-opening-balance-amount-input').fill('2500'); await page.waitForTimeout(200);
  } },
  { name: 'create-add-supplier-saved', viewports: PHONE_DESKTOP, steps: async (page, { viewport }) => {
    await openAddSupplier(page, viewport); await fillSupplier(page); await page.getByTestId('add-supplier-save-btn').click();
    await page.getByTestId('add-supplier-modal').waitFor({ state: 'detached' }); await page.waitForTimeout(800); await page.waitForLoadState('networkidle');
  } },
  { name: 'create-raw-material', viewports: PHONE_DESKTOP, steps: async (page, { viewport }) => {
    await pickSupplier(page, viewport, SUP(1)); await page.getByTestId(viewport === 'phone' ? 'create-order-catalogue-type-raw-material' : 'create-order-sidebar-raw-material-toggle').click(); await page.waitForTimeout(800); await page.waitForLoadState('networkidle');
  } },
  { name: 'create-raw-material-qty', viewports: PHONE_DESKTOP, steps: async (page, { viewport }) => {
    await pickSupplier(page, viewport, SUP(1)); await page.getByTestId(viewport === 'phone' ? 'create-order-catalogue-type-raw-material' : 'create-order-sidebar-raw-material-toggle').click(); await page.waitForTimeout(800);
    await addQty(page, viewport, PRD(51), '3'); await addQty(page, viewport, PRD(53), '1.5');
  } },
  { name: 'create-raw-material-back', viewports: DESKTOP, steps: async (page, { viewport }) => {
    await pickSupplier(page, viewport, SUP(1)); await page.getByTestId('create-order-sidebar-raw-material-toggle').click(); await page.waitForTimeout(800);
    await page.getByTestId('create-order-sidebar-raw-material-toggle').click(); await page.waitForTimeout(400);
  } },
  { name: 'create-raw-material-cart', viewports: DESKTOP, steps: async (page, { viewport }) => {
    await pickSupplier(page, viewport, SUP(1)); await page.getByTestId('create-order-sidebar-raw-material-toggle').click(); await page.waitForTimeout(800);
    await addQty(page, viewport, PRD(51), '3'); await submitCreate(page, viewport);
  } },
  { name: 'create-add-item', viewports: PHONE_DESKTOP, steps: async (page, { viewport }) => { await pickSupplier(page, viewport, SUP(1)); await page.getByTestId('create-order-add-new-item-btn').click(); await page.waitForTimeout(400); } },
  { name: 'create-add-item-product', viewports: PHONE_DESKTOP, steps: async (page, { viewport }) => {
    await pickSupplier(page, viewport, SUP(1)); await page.getByTestId('create-order-add-new-item-btn').click(); await page.getByTestId('create-order-add-item-type-product').click(); await page.waitForTimeout(800); await page.waitForLoadState('networkidle');
  } },
  { name: 'create-add-item-raw', viewports: DESKTOP, steps: async (page, { viewport }) => { await openAddItem(page, viewport, 'raw-material'); } },
  { name: 'create-add-item-back', viewports: DESKTOP, steps: async (page, { viewport }) => { await openAddItem(page, viewport, 'product'); await page.getByTestId('create-order-add-item-back-btn').click(); await page.waitForTimeout(300); } },
  { name: 'create-add-item-empty-submit', viewports: PHONE_DESKTOP, steps: async (page, { viewport }) => { await openAddItem(page, viewport, 'product'); await page.getByTestId('add-product-form-submit-btn').click(); await page.waitForTimeout(400); } },
  { name: 'create-add-item-category-menu', viewports: DESKTOP, steps: async (page, { viewport }) => { await openAddItem(page, viewport, 'product'); await page.locator('#add-item-category-input').click(); await page.waitForTimeout(300); } },
  { name: 'create-add-item-category-picked', viewports: DESKTOP, steps: async (page, { viewport }) => {
    await openAddItem(page, viewport, 'product'); await page.locator('#add-item-category-input').click(); await page.getByTestId(`add-item-category-option-${CAT(1)}`).click(); await page.waitForTimeout(300);
  } },
  { name: 'create-add-item-unit-modal', viewports: PHONE_DESKTOP, steps: async (page, { viewport }) => { await openAddItem(page, viewport, 'product'); await page.getByTestId('add-product-form-select-unit-price-btn').click(); await page.waitForTimeout(300); } },
  { name: 'create-add-item-unit-menu', viewports: DESKTOP, steps: async (page, { viewport }) => {
    await openAddItem(page, viewport, 'product'); await page.getByTestId('add-product-form-select-unit-price-btn').click(); await page.getByTestId('add-item-unit-secondary-unit').click(); await page.waitForTimeout(300);
  } },
  { name: 'create-add-category', viewports: PHONE_DESKTOP, steps: (page, { viewport }) => openAddCategory(page, viewport) },
  { name: 'create-add-category-parent-menu', viewports: DESKTOP, steps: async (page, { viewport }) => { await openAddCategory(page, viewport); await page.locator('#add-category-modal-parent-select-input').click(); await page.waitForTimeout(300); } },
  { name: 'create-add-category-invalid', viewports: DESKTOP, steps: async (page, { viewport }) => { await openAddCategory(page, viewport); await page.getByTestId('add-category-modal-submit-btn').click(); await page.waitForTimeout(400); } },
  { name: 'create-add-category-new-parent', viewports: DESKTOP, steps: async (page, { viewport }) => {
    await openAddCategory(page, viewport); await page.locator('#add-category-modal-parent-select-input').click(); await page.getByTestId('parent-category-add-new-option').click(); await page.waitForTimeout(300);
  } },
  { name: 'create-add-category-created', viewports: DESKTOP, steps: async (page, { viewport }) => {
    await openAddCategory(page, viewport); await page.locator('input[name="name"]').fill('Frozen Desserts'); await page.locator('#add-category-modal-parent-select-input').click();
    await page.getByRole('option', { name: 'Fresh', exact: true }).click(); await page.getByTestId('add-category-modal-submit-btn').click();
    await page.getByTestId('add-category-modal').waitFor({ state: 'detached' }); await page.waitForTimeout(800); await page.waitForLoadState('networkidle');
  } },
  { name: 'create-add-item-units', viewports: PHONE_DESKTOP, scenario: { tenant: 'three-part-units' }, steps: async (page, { viewport }) => { await openAddItem(page, viewport, 'product'); await page.getByTestId('add-product-form-select-unit-price-btn').click(); await fillUnits(page); } },
  { name: 'create-add-item-units-saved', viewports: DESKTOP, scenario: { tenant: 'three-part-units' }, steps: async (page, { viewport }) => {
    await openAddItem(page, viewport, 'product'); await page.getByTestId('add-product-form-select-unit-price-btn').click(); await fillUnits(page); await page.getByTestId('add-item-unit-save-btn').click(); await page.waitForTimeout(300);
  } },
  { name: 'create-add-item-created', viewports: PHONE_DESKTOP, scenario: { tenant: 'three-part-units' }, steps: async (page, { viewport }) => {
    await openAddItem(page, viewport, 'product'); await page.locator('input[name="title"]').fill('Mango Pickle Jar 400 g'); await page.locator('#add-item-category-input').click();
    await page.getByTestId(`add-item-category-option-${CAT(6)}`).click(); await page.getByTestId('add-product-form-select-unit-price-btn').click(); await fillUnits(page); await page.getByTestId('add-item-unit-save-btn').click();
    await page.getByTestId('add-product-form-submit-btn').click(); await page.getByTestId('create-order-add-item-modal').waitFor({ state: 'detached' }); await page.waitForTimeout(1200); await page.waitForLoadState('networkidle');
  } },
  { name: 'create-add-raw-created', viewports: DESKTOP, scenario: { tenant: 'three-part-units' }, steps: async (page, { viewport }) => {
    await openAddItem(page, viewport, 'raw-material'); await page.locator('input[name="title"]').fill('Citric Acid 1 Kg'); await page.locator('#add-item-category-input').click();
    await page.getByTestId(`add-item-category-option-${CAT(8)}`).click(); await page.getByTestId('add-product-form-select-unit-price-btn').click(); await fillUnits(page); await page.getByTestId('add-item-unit-save-btn').click();
    await page.getByTestId('add-product-form-submit-btn').click(); await page.getByTestId('create-order-add-item-modal').waitFor({ state: 'detached' }); await page.waitForTimeout(1200); await page.waitForLoadState('networkidle');
  } },
  { name: 'create-discard-prompt', viewports: DESKTOP, steps: async (page, { viewport }) => { await pickSupplier(page, viewport, SUP(1)); await addQty(page, viewport, PRD(1), '6'); await openDrawerClose(page).click(); await page.waitForTimeout(300); } },

  // ── Filters and paging ──────────────────────────────────────────────────────────────────────
  { name: 'search-typed', viewports: PHONE_DESKTOP, steps: async (page) => { await page.getByTestId('sourcing-search-input').fill('sahyadri'); await typed(page); } },
  { name: 'search-po-prefix', viewports: DESKTOP, steps: async (page) => { await page.getByTestId('sourcing-search-input').fill('PO-2026927'); await typed(page); } },
  { name: 'search-item', viewports: DESKTOP, steps: async (page) => { await page.getByTestId('sourcing-search-input').fill('ghee'); await page.getByTestId('sourcing-search-input').press('Enter'); await page.waitForTimeout(100); } },
  { name: 'search-no-match', viewports: PHONE_DESKTOP, expect: 'list', steps: async (page) => { await page.getByTestId('sourcing-search-input').fill('zzzz'); await typed(page); await page.getByTestId('sourcing-list-empty-filtered').waitFor(); } },
  { name: 'filters-open', viewports: PHONE, steps: async (page) => { await page.getByTestId('sourcing-mobile-filters-toggle-btn').click(); } },
  { name: 'status-filter-menu', viewports: PHONE_DESKTOP, steps: async (page, { viewport }) => { if (viewport === 'phone') await page.getByTestId('sourcing-mobile-filters-toggle-btn').click(); await statusControl(page).click(); } },
  { name: 'status-filter-picked', viewports: PHONE_DESKTOP, steps: async (page, { viewport }) => { if (viewport === 'phone') await page.getByTestId('sourcing-mobile-filters-toggle-btn').click(); await statusControl(page).click(); await rsOption(page, 'Delivered').click(); await page.waitForTimeout(100); } },
  { name: 'quick-range-menu', viewports: DESKTOP, steps: async (page) => { await page.getByTestId('sourcing-quick-range-toggle-btn').click(); } },
  { name: 'quick-range-picked', viewports: DESKTOP, steps: async (page) => { await page.getByTestId('sourcing-quick-range-toggle-btn').click(); await page.getByTestId('sourcing-quick-range-last-7-days-btn').click(); } },
  { name: 'date-picker-open', viewports: PHONE_DESKTOP, steps: async (page, { viewport }) => { if (viewport === 'phone') await page.getByTestId('sourcing-mobile-filters-toggle-btn').click(); await page.getByTestId('sourcing-date-range-field').locator('input').click(); await page.waitForTimeout(300); } },
  { name: 'date-range-start', viewports: DESKTOP, steps: async (page) => { await page.getByTestId('sourcing-date-range-field').locator('input').click(); await day(page, 14).click(); await page.waitForTimeout(300); } },
  { name: 'date-range-picked', viewports: PHONE_DESKTOP, steps: async (page, { viewport }) => {
    if (viewport === 'phone') await page.getByTestId('sourcing-mobile-filters-toggle-btn').click();
    await page.getByTestId('sourcing-date-range-field').locator('input').click(); await day(page, 14).click(); await day(page, 22).click(); await page.waitForTimeout(300);
  } },
  { name: 'date-prev-month', viewports: DESKTOP, steps: async (page) => { await page.getByTestId('sourcing-date-range-field').locator('input').click(); await page.getByRole('button', { name: 'Previous Month' }).click(); await page.waitForTimeout(300); } },
  { name: 'filters-cleared', viewports: PHONE, steps: async (page) => {
    await page.getByTestId('sourcing-mobile-filters-toggle-btn').click(); await statusControl(page).click(); await rsOption(page, 'Delivered').click();
    await page.getByTestId('sourcing-clear-filters-btn').click(); await page.waitForTimeout(100);
  } },
  { name: 'page-2', viewports: PHONE_DESKTOP, steps: async (page, { viewport }) => { await page.getByTestId(`${viewport === 'phone' ? 'sourcing-card' : 'sourcing-table'}-next-btn`).click(); await page.waitForTimeout(100); } },

  // ── Purchase forecast (banner + drawer) ─────────────────────────────────────────────────────
  { name: 'forecast-banner-expanded', viewports: ['phone'], steps: async (page) => { await page.getByTestId('purchase-forecast-banner-mobile').click(); } },
  { name: 'forecast-drawer', viewports: ALL, steps: openForecast },
  { name: 'forecast-search', viewports: PHONE_DESKTOP, steps: async (page) => { await openForecast(page); await page.getByTestId('purchase-forecast-search-input').fill('dal'); } },
  { name: 'forecast-no-match', viewports: ['desktop'], steps: async (page) => { await openForecast(page); await page.getByTestId('purchase-forecast-search-input').fill('zzz'); } },
  { name: 'forecast-category-menu', viewports: PHONE_DESKTOP, steps: async (page) => { await openForecast(page); await categoryControl(page).click(); } },
  { name: 'forecast-category-picked', viewports: PHONE_DESKTOP, steps: async (page) => { await openForecast(page); await categoryControl(page).click(); await page.getByRole('option', { name: 'Dairy', exact: true }).click(); } },
  { name: 'forecast-sorted-product', viewports: ['desktop'], steps: async (page) => { await openForecast(page); await page.getByTestId('purchase-forecast-sort-product-btn').click(); } },
  { name: 'forecast-selected', viewports: PHONE_DESKTOP, steps: async (page, { viewport }) => {
    await openForecast(page);
    const pre = viewport === 'phone' ? 'purchase-forecast-card-select-' : 'purchase-forecast-select-';
    await page.getByTestId(`${pre}FB-1001`).check(); await page.getByTestId(`${pre}FB-3003`).check();
  } },
  { name: 'forecast-qty-edited', viewports: PHONE_DESKTOP, steps: async (page, { viewport }) => {
    await openForecast(page);
    if (viewport === 'phone') { await page.getByTestId('purchase-forecast-card-qty-increase-FB-2002-btn').click(); await page.getByTestId('purchase-forecast-card-qty-increase-FB-2002-btn').click(); }
    else await page.getByTestId('purchase-forecast-qty-FB-2002-input').fill('96');
  } },
  // ── Policies (the dataset's two invented templates): badge, details, and the cart's activation ──
  { name: 'create-policy-modal', viewports: PHONE_DESKTOP, steps: async (page, { viewport }) => { await pickSupplier(page, viewport, SUP(1)); await policyBtn(page, viewport, PRD(2)).click(); await page.waitForTimeout(300); } },
  { name: 'create-policy-warranty', viewports: ['desktop'], steps: async (page, { viewport }) => { await pickSupplier(page, viewport, SUP(1)); await policyBtn(page, viewport, PRD(10)).click(); await page.waitForTimeout(300); } },
  { name: 'create-policy-closed', viewports: ['desktop'], steps: async (page, { viewport }) => { await pickSupplier(page, viewport, SUP(1)); await policyBtn(page, viewport, PRD(2)).click(); await page.getByTestId('create-order-policy-modal-close-footer-btn').click(); await page.waitForTimeout(300); } },
  { name: 'create-policy-cart', viewports: PHONE_DESKTOP, steps: async (page, { viewport }) => { await policyCart(page, viewport); } },
  { name: 'create-policy-cart-toggled', viewports: PHONE_DESKTOP, steps: async (page, { viewport }) => { await policyCart(page, viewport); await page.getByTestId(`cart-item-policy-activation-toggle-${cartVariant(viewport)}-${PRD(2)}`).click(); await page.waitForTimeout(200); } },
  { name: 'create-policy-cart-email', viewports: PHONE_DESKTOP, steps: async (page, { viewport }) => {
    await policyCart(page, viewport); await page.getByTestId(`cart-item-policy-activation-toggle-${cartVariant(viewport)}-${PRD(2)}`).click();
    await page.getByTestId(`cart-item-policy-email-input-${cartVariant(viewport)}-${PRD(2)}`).fill('stores@shreeganesh.example'); await page.waitForTimeout(200);
  } },
  // ── Raw Material Calculator (the host's RawMaterialReportDrawer; all-features) ─────────────
  { name: 'rawcalc-open', viewports: ALL, scenario: RM, steps: openRawCalc },
  { name: 'rawcalc-qty', viewports: PHONE_DESKTOP, scenario: RM, steps: async (page, o) => { await openRawCalc(page, o); await rcQty(page, 'Toned Milk 500 ml', '12'); await rcQty(page, 'Multigrain Buns (4 pcs)', '5'); } },
  { name: 'rawcalc-search', viewports: ['desktop'], scenario: RM, steps: async (page, o) => { await openRawCalc(page, o); await page.getByPlaceholder('Search by product name or article number…').fill('dal'); } },
  { name: 'rawcalc-search-none', viewports: ['desktop'], scenario: RM, steps: async (page, o) => { await openRawCalc(page, o); await page.getByPlaceholder('Search by product name or article number…').fill('zzz'); } },
  { name: 'rawcalc-orders', viewports: PHONE_DESKTOP, scenario: RM, steps: async (page, o) => { await openRawCalc(page, o); await rcTab(page, 'By Orders'); } },
  { name: 'rawcalc-orders-selected', viewports: PHONE_DESKTOP, scenario: RM, steps: async (page, o) => { await openRawCalc(page, o); await rcTab(page, 'By Orders'); await rcOrder(page, '20269271842117'); await rcOrder(page, '2026925093512'); } },
  { name: 'rawcalc-orders-all', viewports: ['desktop'], scenario: RM, steps: async (page, o) => { await openRawCalc(page, o); await rcTab(page, 'By Orders'); await page.getByText(/^Select All \(/).click(); } },
  { name: 'rawcalc-orders-search', viewports: ['desktop'], scenario: RM, steps: async (page, o) => { await openRawCalc(page, o); await rcTab(page, 'By Orders'); await page.getByPlaceholder('Search by order #, name or contact...').fill('hotel'); } },
  { name: 'rawcalc-orders-search-none', viewports: ['desktop'], scenario: RM, steps: async (page, o) => { await openRawCalc(page, o); await rcTab(page, 'By Orders'); await page.getByPlaceholder('Search by order #, name or contact...').fill('zzz'); } },
  { name: 'rawcalc-catalogue-menu', viewports: ['desktop'], scenario: RM, steps: async (page, o) => { await openRawCalc(page, o); await rcTab(page, 'By Orders'); await rcSelect(page, 'All Catalogues'); } },
  { name: 'rawcalc-catalogue-picked', viewports: ['desktop'], scenario: RM, steps: async (page, o) => { await openRawCalc(page, o); await rcTab(page, 'By Orders'); await rcSelect(page, 'All Catalogues'); await page.getByRole('option', { name: 'HoReCa', exact: true }).click(); } },
  { name: 'rawcalc-catalogue-typed', viewports: ['desktop'], scenario: RM, steps: async (page, o) => { await openRawCalc(page, o); await rcTab(page, 'By Orders'); await rcSelect(page, 'All Catalogues'); await page.keyboard.type('hor'); } },
  { name: 'rawcalc-catalogue-typed-none', viewports: ['desktop'], scenario: RM, steps: async (page, o) => { await openRawCalc(page, o); await rcTab(page, 'By Orders'); await rcSelect(page, 'All Catalogues'); await page.keyboard.type('zzz'); } },
  { name: 'rawcalc-catalogue-removed', viewports: ['desktop'], scenario: RM, steps: async (page, o) => {
    await openRawCalc(page, o); await rcTab(page, 'By Orders'); await rcSelect(page, 'All Catalogues'); await page.getByRole('option', { name: 'HoReCa', exact: true }).click();
    await page.getByRole('option', { name: 'DEFAULT', exact: true }).click(); await page.getByRole('button', { name: 'Remove HoReCa' }).click(); await page.waitForTimeout(200);
  } },
  { name: 'rawcalc-catalogue-blurred', viewports: ['desktop'], scenario: RM, steps: async (page, o) => {
    await openRawCalc(page, o); await rcTab(page, 'By Orders'); await rcSelect(page, 'All Catalogues'); await page.getByRole('option', { name: 'HoReCa', exact: true }).click(); await page.getByText(/^Select All \(/).hover(); await page.mouse.down(); await page.mouse.up(); await page.waitForTimeout(200);
  } },
  { name: 'rawcalc-date-menu', viewports: ['desktop'], scenario: RM, steps: async (page, o) => { await openRawCalc(page, o); await rcTab(page, 'By Orders'); await rcSelect(page, 'All Dates'); } },
  { name: 'rawcalc-date-picked', viewports: ['desktop'], scenario: RM, steps: async (page, o) => { await openRawCalc(page, o); await rcTab(page, 'By Orders'); await rcSelect(page, 'All Dates'); await page.getByRole('option', { name: 'This Week', exact: true }).click(); } },
  { name: 'rawcalc-name', viewports: PHONE_DESKTOP, scenario: RM, steps: async (page, o) => { await openRawCalc(page, o); await rcQty(page, 'Toned Milk 500 ml', '12'); await rcGenerate(page); } },
  { name: 'rawcalc-name-cleared', viewports: ['desktop'], scenario: RM, steps: async (page, o) => { await openRawCalc(page, o); await rcQty(page, 'Toned Milk 500 ml', '12'); await rcGenerate(page); await page.getByPlaceholder('Enter report name').fill(''); } },
  { name: 'rawcalc-report-products', viewports: ALL, scenario: RM, steps: async (page, o) => {
    await openRawCalc(page, o); await rcQty(page, 'Toned Milk 500 ml', '12'); await rcQty(page, 'Multigrain Buns (4 pcs)', '5'); await rcQty(page, 'Fresh Curd 400 g', '3'); await rcGenerate(page); await rcContinue(page);
  } },
  { name: 'rawcalc-report-orders', viewports: PHONE_DESKTOP, scenario: RM, steps: async (page, o) => {
    await openRawCalc(page, o); await rcTab(page, 'By Orders'); await page.getByText(/^Select All \(/).click(); await rcGenerate(page); await rcContinue(page);
  } },
  { name: 'rawcalc-report-back', viewports: ['desktop'], scenario: RM, steps: async (page, o) => {
    await openRawCalc(page, o); await rcQty(page, 'Toned Milk 500 ml', '12'); await rcGenerate(page); await rcContinue(page); await page.getByRole('button', { name: 'Back to Orders' }).click(); await page.waitForTimeout(300);
  } },
  { name: 'rawcalc-report-unmapped', viewports: ['desktop'], scenario: RM, steps: async (page, o) => { await openRawCalc(page, o); await rcQty(page, 'Fresh Curd 400 g', '3'); await rcGenerate(page); await rcContinue(page); } },
  { name: 'rawcalc-report-none', viewports: ['desktop'], scenario: { tenant: 'raw-calc-unmapped' }, steps: async (page, o) => { await openRawCalc(page, o); await rcQty(page, 'Toned Milk 500 ml', '12'); await rcGenerate(page); await rcContinue(page); } },
  // ── …and its "Create Raw Material Requests" (the host's CreatePurchaseOrderFromMaterialsModal) ──
  { name: 'rawcalc-po-open', viewports: PHONE_DESKTOP, scenario: RM, steps: toMaterialsPo },
  { name: 'rawcalc-po-supplier-menu', viewports: PHONE_DESKTOP, scenario: RM, steps: async (page, o) => { await toMaterialsPo(page, o); await poRowSupplier(page, 0); } },
  { name: 'rawcalc-po-supplier-search', viewports: ['desktop'], scenario: RM, steps: async (page, o) => { await toMaterialsPo(page, o); await poRowSupplier(page, 0); await page.getByPlaceholder('Search suppliers…').fill('dairy'); } },
  { name: 'rawcalc-po-assigned', viewports: PHONE_DESKTOP, scenario: RM, steps: async (page, o) => { await toMaterialsPo(page, o); await poRowSupplier(page, 0); await poPick(page, 'Deccan Grain Traders'); } },
  { name: 'rawcalc-po-internal', viewports: ['desktop'], scenario: RM, steps: async (page, o) => { await toMaterialsPo(page, o); await poRowSupplier(page, 1); await poPick(page, 'QA Store — Kothrud Outlet'); await page.waitForTimeout(600); } },
  { name: 'rawcalc-po-bulk-menu', viewports: ['desktop'], scenario: RM, steps: async (page, o) => { await toMaterialsPo(page, o); await page.getByRole('button', { name: 'Quick assign all →' }).click(); await page.waitForTimeout(300); } },
  { name: 'rawcalc-po-bulk', viewports: PHONE_DESKTOP, scenario: RM, steps: async (page, o) => { await toMaterialsPo(page, o); await page.getByRole('button', { name: 'Quick assign all →' }).click(); await poPick(page, 'Deccan Grain Traders'); } },
  { name: 'rawcalc-po-required', viewports: ['desktop'], scenario: RM, steps: async (page, o) => { await toMaterialsPo(page, o); await page.getByRole('button', { name: 'Total required' }).click(); await page.waitForTimeout(200); } },
  { name: 'rawcalc-po-priced', viewports: ['desktop'], scenario: RM, steps: async (page, o) => { await toMaterialsPo(page, o); await poRowSupplier(page, 0); await poPick(page, 'Deccan Grain Traders'); await page.locator('input[type="number"]:visible').nth(1).fill('980'); await page.waitForTimeout(200); } },
  { name: 'rawcalc-po-review', viewports: PHONE_DESKTOP, scenario: RM, steps: async (page, o) => { await toMaterialsPo(page, o); await poAssignTwo(page); await page.getByRole('button', { name: /^Review/ }).click(); await page.waitForTimeout(300); } },
  { name: 'rawcalc-po-created', viewports: PHONE_DESKTOP, scenario: RM, steps: async (page, o) => { await toMaterialsPo(page, o); await poAssignTwo(page); await page.getByRole('button', { name: /^Review/ }).click(); await page.getByRole('button', { name: /^Create \d+ order/ }).click(); await page.waitForTimeout(2500); } },
  { name: 'rawcalc-po-add-supplier', viewports: ['desktop'], scenario: RM, steps: async (page, o) => { await toMaterialsPo(page, o); await poRowSupplier(page, 0); await page.getByRole('button', { name: 'Add new supplier' }).click(); await page.waitForTimeout(400); } },
  { name: 'rawcalc-po-closed', viewports: ['desktop'], scenario: RM, steps: async (page, o) => { await toMaterialsPo(page, o); await page.getByRole('button', { name: 'Cancel', exact: true }).click(); await page.waitForTimeout(300); } },
  { name: 'rawcalc-closed', viewports: ['desktop'], scenario: RM, steps: async (page, o) => { await openRawCalc(page, o); await rcQty(page, 'Toned Milk 500 ml', '12'); await page.getByRole('button', { name: 'Cancel', exact: true }).click(); await page.waitForTimeout(600); } },
  // ── all-features in the create drawer: no scan button, though the tenant turns the scanner on ──
  { name: 'create-all-features', viewports: PHONE_DESKTOP, scenario: { tenant: 'all-features' }, steps: async (page, { viewport }) => { await pickSupplier(page, viewport, SUP(1)); } },
  // ── Forecast → Create Purchase: the forced supplier gate, then the seeded cart ─────────────
  { name: 'forecast-gate', viewports: ALL, steps: forecastToGate },
  { name: 'forecast-gate-no-match', viewports: ['desktop'], steps: async (page, o) => { await forecastToGate(page, o); await page.getByTestId('create-order-gate-supplier-search-input').fill('zzz'); } },
  { name: 'forecast-gate-add-supplier', viewports: ['desktop'], steps: async (page, o) => { await forecastToGate(page, o); await page.getByTestId('create-order-gate-create-supplier-btn').click(); await page.waitForTimeout(400); } },
  { name: 'forecast-gate-cancel', viewports: ['desktop'], steps: async (page, o) => { await forecastToGate(page, o); await page.getByTestId('create-order-gate-cancel-btn').click(); await page.waitForTimeout(600); } },
  { name: 'forecast-seeded', viewports: ALL, steps: async (page, o) => { await forecastToGate(page, o); await gateSelect(page, SUP(1)); } },
  { name: 'forecast-seeded-one', viewports: PHONE_DESKTOP, steps: async (page, o) => { await forecastToGate(page, { ...o, one: true }); await gateSelect(page, SUP(1)); } },
  { name: 'forecast-seeded-internal', viewports: ['desktop'], steps: async (page, o) => { await forecastToGate(page, o); await gateSelect(page, LOC(3)); } },
  { name: 'forecast-seeded-cart', viewports: PHONE_DESKTOP, steps: async (page, o) => { await forecastToGate(page, o); await gateSelect(page, SUP(1)); await page.waitForTimeout(5500); await submitCreate(page, o.viewport); } },
];

/** The Raw Material Calculator: the toolbar button, or the phone's action bar. */
async function openRawCalc(page, { viewport }) {
  await page.getByTestId(viewport === 'phone' ? 'sourcing-mobile-raw-material-calculator-btn' : 'sourcing-raw-material-calculator-btn').click();
  await page.getByText('Raw Material Requirement Calculator').waitFor();
  await page.waitForTimeout(1200); await page.waitForLoadState('networkidle');
}
/** The drawer has no test ids: a product card is the row holding its name. */
async function rcQty(page, name, qty) {
  await page.locator('div.grid > div').filter({ has: page.getByText(name, { exact: true }) }).locator('input[type="number"]').fill(qty);
  await page.waitForTimeout(200);
}
async function rcTab(page, label) { await page.getByRole('button', { name: new RegExp(`^${label}`) }).click(); await page.waitForTimeout(300); }
async function rcOrder(page, number) { await page.locator('div.space-y-2 > div').filter({ hasText: number }).click(); await page.waitForTimeout(200); }
async function rcSelect(page, placeholder) { await page.locator('div[class*="-control"]').filter({ hasText: placeholder }).click(); await page.waitForTimeout(300); }
async function rcGenerate(page) { await page.getByRole('button', { name: /^Generate Report/ }).click(); await page.waitForTimeout(500); }
async function rcContinue(page) { await page.getByRole('button', { name: 'Continue', exact: true }).click(); await page.waitForTimeout(1000); }
/** The all-orders report's "Create Raw Material Requests". */
async function toMaterialsPo(page, o) {
  await openRawCalc(page, o); await rcTab(page, 'By Orders'); await page.getByText(/^Select All \(/).click(); await rcGenerate(page); await rcContinue(page);
  await page.getByRole('button', { name: 'Create Raw Material Requests' }).click(); await page.waitForTimeout(800); await page.waitForLoadState('networkidle');
}
/** A material row's supplier picker (the n-th visible "Select supplier…"). */
async function poRowSupplier(page, n) { await page.getByRole('button', { name: 'Select supplier…' }).nth(n).click(); await page.waitForTimeout(300); }
async function poPick(page, name) { await page.getByRole('button').filter({ hasText: name }).last().click(); await page.waitForTimeout(400); }
async function poAssignTwo(page) { await poRowSupplier(page, 0); await poPick(page, 'Deccan Grain Traders'); await poRowSupplier(page, 0); await poPick(page, 'Shivneri Wholesale'); }
const policyBtn = (page, viewport, id) => page.getByTestId(viewport === 'phone' ? `create-order-mobile-product-policy-btn-${id}` : `create-order-product-policy-btn-${id}`);
/** The review cart with the two policy-carrying products: Fresh Curd (a guarantee) and Sunflower Oil (a warranty). */
async function policyCart(page, viewport) { await pickSupplier(page, viewport, SUP(1)); await addQty(page, viewport, PRD(2), '4'); await addQty(page, viewport, PRD(10), '3'); await submitCreate(page, viewport); }
/** Forecast drawer → two rows ticked → "Add to Purchase", or one row's own Add. Lands on the gate. */
async function forecastToGate(page, { viewport, one = false }) {
  await openForecast(page);
  const card = viewport === 'phone';
  if (one) await page.getByTestId(card ? 'purchase-forecast-card-add-FB-1001-btn' : 'purchase-forecast-add-FB-1001-btn').click();
  else {
    const pre = card ? 'purchase-forecast-card-select-' : 'purchase-forecast-select-';
    await page.getByTestId(`${pre}FB-1001`).check(); await page.getByTestId(`${pre}FB-3003`).check(); await page.getByTestId(`${pre}FB-2002`).check();
    await page.getByTestId('purchase-forecast-bulk-add-btn').click();
  }
  await page.getByTestId('create-order-gate-supplier-search-input').waitFor();
  await page.waitForTimeout(1200);
}
async function gateSelect(page, id) {
  await page.getByTestId(`create-order-gate-supplier-select-btn-${id}`).click();
  await page.waitForTimeout(1200); await page.waitForLoadState('networkidle'); await page.waitForTimeout(300);
}

async function openForecast(page) {
  if (await page.getByTestId('purchase-forecast-desktop-view-btn').isVisible()) await page.getByTestId('purchase-forecast-desktop-view-btn').click();
  else { await page.getByTestId('purchase-forecast-banner-mobile').click(); await page.getByTestId('purchase-forecast-mobile-view-btn').click(); }
  await page.getByTestId('purchase-forecast-drawer').waitFor();
  await page.waitForTimeout(500);
}
/** A react-select option (portalled), never one of the rows' native <option>s. */
const rsOption = (page, label) => page.locator('[id^="react-select-"][role="option"]').filter({ hasText: new RegExp(`^${label}$`) });
/** Change a row's status the way a user does: the native <select> on the row (table) or the card. */
async function openAudit(page, viewport, n, status = 'Delivered') {
  const id = viewport === 'phone' ? `sourcing-card-status-select-${PO(n)}` : `sourcing-status-select-${PO(n)}`;
  await page.getByTestId(id).selectOption(status);
  await page.getByTestId('audit-drawer').waitFor();
  await page.waitForTimeout(500);
}
/** Receive two fewer of the audit's first line: the stepper on a phone, the number input above it. */
async function lessReceived(page, viewport) {
  if (viewport === 'phone') { const b = page.locator('[data-testid^="audit-drawer-item-qty-decrease-"]').first(); await b.click(); await b.click(); }
  else await page.locator('[data-testid^="audit-drawer-item-qty-input-desktop-"]').first().fill('8');
}
/**
 * One of a row's document actions, the way a user reaches it: the Documents menu on the table, the
 * expanded card's buttons on a phone. `kind`: po-document | grn | invoice | add-document | document
 * (the row's first OTHER document).
 */
async function docAction(page, viewport, n, kind) {
  const id = PO(n);
  if (viewport === 'phone') {
    await page.getByTestId(`sourcing-card-toggle-expand-${id}`).click();
    const btn = kind === 'document' ? page.locator(`[data-testid^="sourcing-card-row-${id}-document-"][data-testid$="-btn"]`).first() : page.getByTestId(`sourcing-card-row-${id}-${kind}-btn`);
    await btn.click();
  } else {
    // The menu opens below its trigger, fixed to the viewport: a user scrolls the row up first.
    await page.getByTestId(`sourcing-row-${id}-documents-trigger-btn`).evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await page.getByTestId(`sourcing-row-${id}-documents-trigger-btn`).click();
    const item = kind === 'document' ? page.locator(`[data-testid^="sourcing-row-${id}-document-"][data-testid$="-item"]`).first() : page.getByTestId(`sourcing-row-${id}-${kind}-item`);
    await item.click();
  }
  await page.waitForTimeout(400);
}
const fixture = (name) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));
async function fillInvoice(page) {
  await page.getByTestId('po-doc-amount-input').fill('12127.50');
  await page.getByTestId('po-doc-remarks-input').fill('DGT/2609/118');
  await page.getByTestId('po-doc-attachment-file-input').setInputFiles(fixture('supplier-invoice.pdf'));
  await page.waitForTimeout(200);
}
async function saveInvoice(page) { await page.getByTestId('po-doc-add-save-btn').click(); await page.getByTestId('po-doc-payment-skip-btn').waitFor(); await page.waitForTimeout(500); }

const SUP = (n) => `6a4${String(n).padStart(21, '0')}`;
const LOC = (n) => `6a5${String(n).padStart(21, '0')}`;
const PRD = (n) => `6a6${String(n).padStart(21, '0')}`;
/** An internal location's own product record: location 2's are prd-2nn, location 3's prd-3nn. */
const LPRD = (loc, n) => PRD(loc * 100 + n);
const CAT = (n) => `6a7${String(n).padStart(21, '0')}`;

async function pickSupplier(page, viewport, id) {
  await openCreate(page, viewport);
  await page.getByTestId('create-order-supplier-select-btn').click();
  await page.getByTestId(`create-order-supplier-option-${id}`).click();
  await page.waitForTimeout(800);
  await page.waitForLoadState('networkidle');
}
/** A product's quantity: the table's input on a desktop, the card's on a phone. */
async function addQty(page, viewport, productId, qty) {
  const id = viewport === 'phone' ? `create-order-mobile-product-qty-input-${productId}` : `create-order-product-qty-input-${productId}`;
  await page.getByTestId(id).fill(qty);
  await page.waitForTimeout(400);
}
/** Create New Supplier, from the create drawer's supplier dropdown. */
async function openAddSupplier(page, viewport) { await openCreate(page, viewport); await page.getByTestId('create-order-supplier-select-btn').click(); await page.getByTestId('create-order-supplier-dropdown-create-btn').click(); await page.waitForTimeout(400); }
async function fillSupplier(page) {
  await page.getByTestId('add-supplier-name-input').fill('Konkan Fresh Farms'); await page.getByTestId('add-supplier-phone-input').fill('9822011099');
  await page.getByTestId('add-supplier-email-input').fill('orders@konkanfresh.example'); await page.getByTestId('add-supplier-code-input').fill('SUP-011');
  await page.getByTestId('add-supplier-address-input').fill('Plot 4, Ratnagiri MIDC'); await page.getByTestId('add-supplier-pincode-input').fill('415639'); await page.waitForTimeout(200);
}
/** Add New Item from the create drawer: the type picker, then `product` or `raw-material`. */
async function openAddItem(page, viewport, type) {
  await pickSupplier(page, viewport, SUP(1)); await page.getByTestId('create-order-add-new-item-btn').click(); await page.getByTestId(`create-order-add-item-type-${type}`).click();
  await page.waitForTimeout(800); await page.waitForLoadState('networkidle');
}
async function openAddCategory(page, viewport) {
  await openAddItem(page, viewport, 'product'); await page.locator('#add-item-category-input').click(); await page.getByTestId('add-item-category-add-new-option').click(); await page.waitForTimeout(400);
}
/** The unit modal, under the three-part-units tenant: Jar per Box of 12, ₹50 a Jar, 5% GST. */
async function fillUnits(page) {
  await page.getByTestId('add-item-unit-secondary-unit').click(); await page.getByTestId('add-item-unit-secondary-unit-option-Jar').click();
  await page.getByTestId('add-item-unit-base-unit').click(); await page.getByTestId('add-item-unit-base-unit-option-Box').click();
  await page.getByTestId('add-item-unit-base-conversion-input').fill('12'); await page.getByTestId('add-item-unit-tax-rate').click(); await page.getByTestId('add-item-unit-tax-rate-option-5%').click();
  await page.getByTestId('add-item-unit-secondary-price-input').fill('50'); await page.waitForTimeout(200);
}
/** The external review cart: two lines (6 Pouch of Toned Milk, 2 Pkt of Toor Dal). */
async function toCart(page, viewport) { await pickSupplier(page, viewport, SUP(1)); await addQty(page, viewport, PRD(1), '6'); await addQty(page, viewport, PRD(8), '2'); await submitCreate(page, viewport); }
const cartVariant = (viewport) => (viewport === 'phone' ? 'mobile' : 'desktop');
async function submitCreate(page, viewport) {
  await page.getByTestId(viewport === 'phone' ? 'create-order-submit-btn-mobile' : 'create-order-submit-btn').click();
  await page.waitForTimeout(800);
}

/** Create Purchase Orders: the toolbar button, or the phone's action bar. */
async function openCreate(page, viewport) {
  await page.getByTestId(viewport === 'phone' ? 'sourcing-mobile-create-order-btn' : 'sourcing-create-order-btn').click();
  await page.waitForTimeout(1500);
  await page.waitForLoadState('networkidle');
}

/** The ✕ of the drawer that is open (the forecast drawer stays mounted, closed, with its own). */
const openDrawerClose = (page) => page.locator('.drawer-open [data-testid="main-drawer-close-btn"]');
const statusControl = (page) => page.locator('form input[role="combobox"]').first();
const day = (page, n) => page.locator(`.react-datepicker__day--0${String(n).padStart(2, '0')}:not(.react-datepicker__day--outside-month)`).first();
const categoryControl = (page) => page.getByTestId('purchase-forecast-category-filter').locator('input[role="combobox"]');
