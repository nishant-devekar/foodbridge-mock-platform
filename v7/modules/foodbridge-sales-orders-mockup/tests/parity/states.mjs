/*
  The states compared, and how each is reached.

  ONE driver per state, run unchanged against both sides. Every selector is the production app's
  own — its data-testid, id or visible label — so the prototype passes only if it exposes the
  same control in the same place. A control the driver cannot find on the prototype is a control
  the prototype does not have, and the run fails rather than photographing something else.

  `scenario` is a server-side condition (empty / error / hang), set on the oracle's API and passed
  to the prototype as ?scenario=.
*/

async function openAudit(page) {
  const sel = page.locator('select[data-testid^="order-status-select-"]:not([disabled]):visible').first();
  await sel.selectOption('Ready for dispatch');
  await page.waitForTimeout(900);
}
/** Confirm one unit less of the first line — a variance. */
async function shortFirstLine(page) {
  const input = page.locator('[data-testid^="audit-drawer-item-qty-input-"]:visible').first();
  await input.fill('1');
  await page.waitForTimeout(300);
}

const first = (page, prefix) => page.locator(`[data-testid^="${prefix}"]:visible`).first();

async function typeSearch(page, text) {
  const input = page.locator('[data-testid="orders-search-input"]:visible').first();
  await input.click();
  await input.fill(text);
  await page.waitForTimeout(700); // the list debounces search by 400ms
}

const isPhone = (page) => page.viewportSize().width < 640;

async function openCreate(page) {
  if (isPhone(page)) {
    await page.locator('[data-testid="orders-create-btn-mobile"]').click();
    await page.waitForTimeout(250);
    await page.locator('[data-testid="orders-create-menu-single-btn"]').click();
  } else {
    await page.locator('[data-testid="orders-create-btn"]').click();
  }
  await page.waitForTimeout(900);
}
async function pickCustomer(page, name = 'Dinesh Store') {
  await page.locator('#create-order-select-customer-input').click({ force: true });
  await page.waitForTimeout(400);
  await page.getByText(name, { exact: true }).last().click();
  await page.waitForTimeout(1200);
}
/** + on the n-th product of the list shown (the phone has its own panel). */
async function bump(page, n, times = 1) {
  const sel = isPhone(page) ? '[data-testid^="mobile-order-product-qty-inc-btn-"]:visible' : '[data-testid^="create-order-product-qty-increment-"]:visible';
  for (let i = 0; i < times; i += 1) { await page.locator(sel).nth(n).click(); await page.waitForTimeout(150); }
  await page.waitForTimeout(500);
}
async function fillCart(page) { await openCreate(page); await pickCustomer(page); await bump(page, 0, 2); await bump(page, 2, 1); }
async function openCart(page) {
  await fillCart(page);
  await page.locator(isPhone(page) ? '[data-testid="create-order-submit-btn-mobile"]' : '[data-testid="create-order-submit-btn"]').click();
  await page.waitForTimeout(1000);
}
async function productSearch(page, text) {
  const input = page.locator('[data-testid="create-order-product-search-input"]:visible');
  await input.click();
  await input.fill(text);
  await page.waitForTimeout(700);
}

async function openReminders(page) {
  await page.locator(isPhone(page) ? '[data-testid="orders-reminders-btn-mobile"]' : '[data-testid="orders-reminders-btn"]').click();
  await page.waitForTimeout(900);
}
async function reminderWindow(page, value) {
  await page.locator('[data-testid="order-reminder-time-filter-select"]').selectOption(value);
  await page.waitForTimeout(900);
}
const reminderRow = (page, kind, n = 0) => page.locator(`[data-testid^="order-reminder-${kind}-"]:visible`).nth(n);

async function openDelivery(page) {
  await page.locator(isPhone(page) ? '[data-testid="orders-create-delivery-btn-mobile"]' : '[data-testid="orders-create-delivery-btn"]').click();
  await page.waitForTimeout(1000);
}
const pickDeliveryCustomer = async (page, n = 0) => { await page.locator('[data-testid^="create-delivery-customer-select-all-"]:visible').nth(n).click(); await page.waitForTimeout(300); };
async function deliveryToStaff(page) { await openDelivery(page); await pickDeliveryCustomer(page, 0); await pickDeliveryCustomer(page, 1); await page.locator('[data-testid="create-delivery-step1-next-btn"]').click(); await page.waitForTimeout(600); }
async function deliveryToReview(page) { await deliveryToStaff(page); await page.locator('[data-testid^="create-delivery-staff-row-"]:visible').first().click(); await page.waitForTimeout(300); await page.locator('[data-testid="create-delivery-step2-next-btn"]').click(); await page.waitForTimeout(600); }

async function openBulk(page, mode = 'STANDARD') {
  if (isPhone(page)) {
    await page.locator('[data-testid="orders-create-btn-mobile"]').click();
    await page.waitForTimeout(250);
    await page.locator(mode === 'ROUTE' ? '[data-testid="orders-create-menu-route-btn"]' : '[data-testid="orders-create-menu-bulk-btn"]').click();
  } else {
    await page.getByRole('button', { name: /^Bulk Sales Orders/ }).click();
    await page.waitForTimeout(250);
    await page.getByText(mode === 'ROUTE' ? 'Create orders for route delivery' : 'Create regular bulk orders').click();
  }
  await page.waitForTimeout(1200);
}
async function bulkCustomers(page) {
  await openBulk(page);
  await page.locator('[data-testid="configure-bulk-order-customer-search-input"]:visible').click();
  await page.waitForTimeout(600);
  await page.locator('[data-testid^="configure-bulk-order-customer-option-"]:visible').nth(0).click();
  await page.waitForTimeout(400);
  await page.locator('[data-testid^="configure-bulk-order-customer-option-"]:visible').nth(2).click();
  await page.waitForTimeout(1500);
}
async function bulkGrid(page) {
  await bulkCustomers(page);
  await page.getByText('Configure Bulk Orders').click(); // an outside press closes the customer menu
  await page.waitForTimeout(300);
  await page.locator('[data-testid="configure-bulk-order-select-all-products-btn"]:visible').click();
  await page.waitForTimeout(400);
  await page.locator('[data-testid="configure-bulk-order-proceed-btn"]:visible').click();
  await page.waitForTimeout(1500);
}
async function bulkQuantities(page) {
  await bulkGrid(page);
  const q = page.locator('[data-testid^="bulk-order-qty-input-"]:visible');
  await q.nth(0).fill('3'); await q.nth(1).fill('2'); await q.nth(3).fill('5');
  await page.keyboard.press('Tab'); // commit the last quantity
  await page.waitForTimeout(500);
}
async function openRoute(page) { await openBulk(page, 'ROUTE'); }
async function openForecast(page) { await page.locator('[data-testid="orders-forecast-btn"]').click(); await page.waitForTimeout(1200); }
async function forecastCustomer(page) { await openForecast(page); await page.locator('[data-testid^="order-forecast-customer-row-"]').first().click(); await page.waitForTimeout(1200); }
async function openDemand(page) { await page.locator(isPhone(page) ? '[data-testid="orders-demand-report-btn-mobile"]' : '[data-testid="orders-demand-report-btn"]').click(); await page.waitForTimeout(1500); }
async function demandSelect(page) {
  await openDemand(page);
  const rows = page.locator('[data-testid^="demand-report-order-row-"]');
  await rows.nth(0).click(); await page.waitForTimeout(200); await rows.nth(1).click(); await page.waitForTimeout(400);
}
async function openThermal(page) {
  await page.locator('button[data-testid^="order-invoice-btn-"]:not([disabled]):visible').first().click();
  await page.waitForTimeout(300);
  await page.getByText('Thermal Print', { exact: true }).first().click();
  await page.waitForTimeout(900);
}

export const STATES = [
  // ── Phase 1 — the list ──────────────────────────────────────────────────────────────────
  { name: 'list', viewports: ['phone', 'tablet', 'desktop', 'wide'] },
  { name: 'loading', viewports: ['phone', 'desktop'], scenario: { list: 'hang' }, expect: 'loading' },
  { name: 'empty', viewports: ['phone', 'desktop'], scenario: { list: 'empty' }, expect: 'empty' },
  { name: 'error', viewports: ['phone', 'desktop'], scenario: { list: 'error' }, expect: 'error' },
  {
    name: 'search-applied', viewports: ['phone', 'desktop'],
    steps: async (page) => { await typeSearch(page, 'Dinesh'); },
  },
  {
    // An order-number prefix (see model.js listOrders).
    name: 'search-by-number', viewports: ['phone', 'desktop'],
    steps: async (page) => { await typeSearch(page, '2026925'); },
  },
  {
    name: 'search-no-match', viewports: ['phone', 'desktop'],
    steps: async (page) => { await typeSearch(page, 'zzzz'); },
    expect: 'empty',
  },
  {
    name: 'status-menu', viewports: ['phone', 'desktop'],
    steps: async (page) => { await page.locator('#orders-status-filter-input').click({ force: true }); await page.waitForTimeout(250); },
  },
  {
    name: 'status-filtered', viewports: ['phone', 'desktop'],
    steps: async (page) => {
      // Open, then take the first option by keyboard — the way react-select is driven without
      // depending on where its menu sits in the DOM.
      await page.locator('#orders-status-filter-input').click({ force: true });
      await page.waitForTimeout(150);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(600);
    },
  },
  {
    name: 'date-range-open', viewports: ['phone', 'desktop'],
    steps: async (page) => { await page.getByPlaceholder('Filter by date range').click(); await page.waitForTimeout(250); },
  },
  {
    name: 'page-2', viewports: ['phone', 'desktop'],
    steps: async (page) => { await page.locator('[data-testid="orders-pagination-page-2"]:visible').click(); await page.waitForTimeout(600); },
  },
  {
    name: 'page-3', viewports: ['desktop'],
    steps: async (page) => { await page.locator('[data-testid="orders-pagination-next-btn"]:visible').click(); await page.waitForTimeout(500); await page.locator('[data-testid="orders-pagination-next-btn"]:visible').click(); await page.waitForTimeout(600); },
  },
  {
    name: 'row-expanded', viewports: ['desktop'],
    steps: async (page) => { await first(page, 'order-row-toggle-').click(); await page.waitForTimeout(600); },
  },
  {
    name: 'card-expanded', viewports: ['phone'],
    steps: async (page) => { await first(page, 'order-card-details-toggle-mobile-').click(); await page.waitForTimeout(600); },
  },
  {
    name: 'insights', viewports: ['desktop'],
    steps: async (page) => { await first(page, 'order-insights-btn-').hover(); await page.waitForTimeout(300); },
  },
  {
    name: 'bulk-menu', viewports: ['desktop'],
    steps: async (page) => { await page.getByRole('button', { name: /^Bulk Sales Orders/ }).click(); await page.waitForTimeout(250); },
  },
  {
    name: 'create-menu-mobile', viewports: ['phone'],
    steps: async (page) => { await page.locator('[data-testid="orders-create-btn-mobile"]').click(); await page.waitForTimeout(250); },
  },
  {
    name: 'copy-toast', viewports: ['desktop'],
    // The toast's bounce-in runs ~750ms: shoot it settled, not mid-animation (a frame's position depends on load).
    steps: async (page) => { await first(page, 'order-copy-id-btn-').click(); await page.waitForTimeout(1200); },
  },

  // ── Phase 2 — acting on an order ────────────────────────────────────────────────────────
  {
    // Moving a Pending order on opens the audit drawer (the change is not applied until submitted).
    name: 'status-change-drawer', viewports: ['phone', 'desktop'],
    steps: async (page) => {
      const sel = page.locator('select[data-testid^="order-status-select-"]:not([disabled]):visible').first();
      await sel.selectOption('Ready for dispatch');
      await page.waitForTimeout(900);
    },
  },
  {
    name: 'invoice-menu', viewports: ['phone', 'desktop'],
    steps: async (page) => { await page.locator('button[data-testid^="order-invoice-btn-"]:not([disabled]):visible').first().click(); await page.waitForTimeout(300); },
  },
  {
    name: 'edit-tooltip', viewports: ['desktop'],
    steps: async (page) => { await first(page, 'order-edit-tooltip-').hover(); await page.waitForTimeout(400); },
  },
  {
    name: 'timeline-tooltip', viewports: ['desktop'],
    steps: async (page) => { await first(page, 'order-timeline-tooltip-').hover(); await page.waitForTimeout(400); },
  },
  {
    name: 'view-click', viewports: ['desktop'],
    steps: async (page) => { await first(page, 'order-view-btn-').click(); await page.waitForTimeout(600); },
  },
  {
    name: 'timeline-click', viewports: ['desktop'],
    steps: async (page) => { await first(page, 'order-timeline-btn-').click(); await page.waitForTimeout(600); },
  },
  {
    name: 'audit-variance', viewports: ['phone', 'desktop'],
    // Tab out of the field so the quantity is committed, without touching anything else.
    steps: async (page) => { await openAudit(page); await shortFirstLine(page); await page.keyboard.press('Tab'); await page.waitForTimeout(300); },
  },
  {
    // A variance needs a reason: submitting without one is refused, and says so.
    name: 'audit-comment-required', viewports: ['desktop'],
    steps: async (page) => { await openAudit(page); await shortFirstLine(page); await page.locator('[data-testid="audit-drawer-submit-btn"]').click(); await page.waitForTimeout(600); },
  },
  {
    // Closing with unsaved input asks first.
    name: 'audit-discard-prompt', viewports: ['phone', 'desktop'],
    steps: async (page) => { await openAudit(page); await shortFirstLine(page); await page.locator('[data-testid="audit-drawer-cancel-btn"]').click(); await page.waitForTimeout(500); },
  },
  {
    // Submitted: the drawer closes, the list refreshes, the order has moved on.
    name: 'audit-submitted', viewports: ['desktop'],
    steps: async (page) => { await openAudit(page); await page.locator('[data-testid="audit-drawer-submit-btn"]').click(); await page.waitForTimeout(1500); },
  },

  // ── Phase 3 — creating an order ─────────────────────────────────────────────────────────
  { name: 'create-open', viewports: ['phone', 'desktop'], steps: openCreate },
  {
    name: 'create-customer-menu', viewports: ['phone', 'desktop'],
    steps: async (page) => { await openCreate(page); await page.locator('#create-order-select-customer-input').click({ force: true }); await page.waitForTimeout(500); },
  },
  { name: 'create-catalogue', viewports: ['phone', 'desktop'], steps: async (page) => { await openCreate(page); await pickCustomer(page); } },
  { name: 'create-search', viewports: ['phone', 'desktop'], steps: async (page) => { await openCreate(page); await pickCustomer(page); await productSearch(page, 'amul'); } },
  { name: 'create-search-none', viewports: ['phone', 'desktop'], steps: async (page) => { await openCreate(page); await pickCustomer(page); await productSearch(page, 'zzzz'); } },
  {
    name: 'create-subcategory', viewports: ['phone', 'desktop'],
    steps: async (page) => {
      await openCreate(page); await pickCustomer(page);
      await page.locator(isPhone(page) ? '[data-testid^="create-order-subcategory-chip-mobile-"]:visible' : '[data-testid^="create-order-sidebar-subcategory-"]:visible').nth(isPhone(page) ? 2 : 1).click();
      await page.waitForTimeout(600);
    },
  },
  { name: 'create-quantities', viewports: ['phone', 'desktop'], steps: fillCart },
  { name: 'create-cart', viewports: ['phone', 'desktop'], steps: openCart },
  {
    name: 'create-payment', viewports: ['phone', 'desktop'],
    steps: async (page) => { await openCart(page); await page.getByRole('button', { name: /^NEXT/ }).filter({ visible: true }).first().click(); await page.waitForTimeout(1000); },
  },
  {
    // Placed: the toast names the new order, and the drawer is ready for the next one.
    name: 'create-placed', viewports: ['phone', 'desktop'],
    steps: async (page) => {
      await openCart(page);
      await page.getByRole('button', { name: /^NEXT/ }).filter({ visible: true }).first().click(); await page.waitForTimeout(1000);
      await page.getByRole('button', { name: /^Place Order$/ }).filter({ visible: true }).first().click(); await page.waitForTimeout(1800);
    },
  },
  {
    // ...and closing the drawer shows the list with the new order on top.
    name: 'create-placed-list', viewports: ['desktop'],
    steps: async (page) => {
      await openCart(page);
      await page.getByRole('button', { name: /^NEXT/ }).filter({ visible: true }).first().click(); await page.waitForTimeout(1000);
      await page.getByRole('button', { name: /^Place Order$/ }).filter({ visible: true }).first().click(); await page.waitForTimeout(1800);
      await page.locator('[data-testid="drawer-create-order-close-btn"], [data-testid$="-close-btn"]:visible').first().click(); await page.waitForTimeout(6000);
    },
  },

  // ── Phase 4 — follow-up reminders ───────────────────────────────────────────────────────
  { name: 'reminders-open', viewports: ['phone', 'desktop'], steps: openReminders },
  { name: 'reminders-yesterday', viewports: ['phone', 'desktop'], steps: async (page) => { await openReminders(page); await reminderWindow(page, 'yesterday'); } },
  {
    name: 'reminders-search', viewports: ['desktop'],
    steps: async (page) => { await openReminders(page); await reminderWindow(page, 'yesterday'); await page.locator('[data-testid="order-reminder-search-input"]').fill('store'); await page.waitForTimeout(1000); },
  },
  { name: 'reminders-expanded', viewports: ['phone', 'desktop'], steps: async (page) => { await openReminders(page); await reminderRow(page, 'expand-btn').click(); await page.waitForTimeout(500); } },
  {
    // The bell sends a WhatsApp reminder (recorded by the oracle's fake transport — never sent).
    name: 'reminders-sent', viewports: ['desktop'],
    steps: async (page) => { await openReminders(page); await reminderWindow(page, 'yesterday'); await reminderRow(page, 'remind-btn').click(); await page.waitForTimeout(900); },
  },
  {
    name: 'reminders-selected', viewports: ['phone', 'desktop'],
    steps: async (page) => { await openReminders(page); await reminderWindow(page, 'yesterday'); await reminderRow(page, 'checkbox').click(); await reminderRow(page, 'checkbox', 2).click(); await page.waitForTimeout(400); },
  },
  {
    // "Follow-up Done" hides the ticked customers for this window (remembered in this browser).
    name: 'reminders-done', viewports: ['desktop'],
    steps: async (page) => { await openReminders(page); await reminderWindow(page, 'yesterday'); await reminderRow(page, 'checkbox').click(); await page.locator('[data-testid="order-reminder-mark-done-btn"]').click(); await page.waitForTimeout(500); },
  },
  {
    // "Create Sales Orders" on a row hands the customer to the Create drawer.
    name: 'reminders-create', viewports: ['phone', 'desktop'],
    steps: async (page) => { await openReminders(page); await reminderRow(page, 'create-order-btn').click(); await page.waitForTimeout(2000); },
  },

  // ── Phase 4 — create delivery ───────────────────────────────────────────────────────────
  { name: 'delivery-open', viewports: ['phone', 'desktop'], steps: openDelivery },
  { name: 'delivery-window', viewports: ['desktop'], steps: async (page) => { await openDelivery(page); await page.locator('[data-testid="create-delivery-days-window-select"]').selectOption('7'); await page.waitForTimeout(900); } },
  { name: 'delivery-picked', viewports: ['phone', 'desktop'], steps: async (page) => { await openDelivery(page); await pickDeliveryCustomer(page, 0); await pickDeliveryCustomer(page, 1); } },
  { name: 'delivery-expanded', viewports: ['phone', 'desktop'], steps: async (page) => { await openDelivery(page); await page.locator('[data-testid^="create-delivery-customer-toggle-"]:visible').nth(1).click(); await page.waitForTimeout(500); } },
  { name: 'delivery-search', viewports: ['desktop'], steps: async (page) => { await openDelivery(page); await page.locator('[data-testid="create-delivery-search-input"]').fill('store'); await page.waitForTimeout(600); } },
  { name: 'delivery-staff', viewports: ['phone', 'desktop'], steps: deliveryToStaff },
  { name: 'delivery-review', viewports: ['phone', 'desktop'], steps: deliveryToReview },
  {
    // Created: the orders become a route delivery; the list refreshes.
    name: 'delivery-created', viewports: ['desktop'],
    steps: async (page) => { await deliveryToReview(page); await page.locator('[data-testid="create-delivery-name-input"]').fill('Morning Route'); await page.locator('[data-testid="create-delivery-submit-btn"]').click(); await page.waitForTimeout(2500); },
  },

  // ── Tenant variant: every optional toolbar action and column on (tenant-variants.json) ────
  { name: 'features-on', viewports: ['phone', 'tablet', 'desktop', 'wide'], scenario: { tenant: 'all-features' } },

  // ── Order Forecast (all-features tenant) ─────────────────────────────────────────────────
  { name: 'forecast-open', viewports: ['desktop'], scenario: { tenant: 'all-features' }, steps: openForecast },
  { name: 'forecast-customer', viewports: ['desktop'], scenario: { tenant: 'all-features' }, steps: forecastCustomer },
  { name: 'forecast-upcoming', viewports: ['desktop'], scenario: { tenant: 'all-features' }, steps: async (page) => { await forecastCustomer(page); await page.locator('[data-testid="order-forecast-tab-upcoming"]').click(); await page.waitForTimeout(400); } },
  { name: 'forecast-search', viewports: ['desktop'], scenario: { tenant: 'all-features' }, steps: async (page) => { await openForecast(page); await page.locator('[data-testid="order-forecast-customer-search-input"]').fill('store'); await page.waitForTimeout(1000); } },
  {
    // "Add to order": Create Order opens for that customer with the picked items.
    name: 'forecast-applied', viewports: ['desktop'], scenario: { tenant: 'all-features' },
    steps: async (page) => { await forecastCustomer(page); await page.locator('[data-testid^="order-forecast-product-toggle-"]').nth(0).click(); await page.locator('[data-testid^="order-forecast-product-toggle-"]').nth(1).click(); await page.waitForTimeout(300); await page.locator('[data-testid="order-forecast-apply-btn"]').click(); await page.waitForTimeout(3000); },
  },

  // ── Generate Demand (all-features tenant) ────────────────────────────────────────────────
  { name: 'demand-open', viewports: ['phone', 'desktop'], scenario: { tenant: 'all-features' }, steps: openDemand },
  { name: 'demand-selected', viewports: ['phone', 'desktop'], scenario: { tenant: 'all-features' }, steps: demandSelect },
  { name: 'demand-name', viewports: ['desktop'], scenario: { tenant: 'all-features' }, steps: async (page) => { await demandSelect(page); await page.locator('[data-testid="demand-report-drawer-preview-btn"]').click(); await page.waitForTimeout(600); } },
  {
    name: 'demand-preview', viewports: ['desktop'], scenario: { tenant: 'all-features' },
    steps: async (page) => { await demandSelect(page); await page.locator('[data-testid="demand-report-drawer-preview-btn"]').click(); await page.waitForTimeout(600); await page.locator('[data-testid="demand-report-name-continue-btn"]').click(); await page.waitForTimeout(2500); },
  },

  // ── Google Sheet (all-features tenant): the mode menu, and what "current" does unconnected ─
  { name: 'gsheet-menu', viewports: ['desktop'], scenario: { tenant: 'all-features' }, steps: async (page) => { await page.getByRole('button', { name: /^Google Sheet/ }).click(); await page.waitForTimeout(400); } },
  { name: 'gsheet-current', viewports: ['desktop'], scenario: { tenant: 'all-features' }, steps: async (page) => { await page.getByRole('button', { name: /^Google Sheet/ }).click(); await page.waitForTimeout(400); await page.getByText('New / Current Orders').click(); await page.waitForTimeout(2500); } },

  // ── Invoice → Thermal Print: the receipt preview (the printer itself is the browser's) ─────
  { name: 'thermal', viewports: ['phone', 'desktop'], steps: openThermal },
  { name: 'thermal-80mm', viewports: ['desktop'], steps: async (page) => { await openThermal(page); await page.getByText('80mm (3.2 inch)').click(); await page.waitForTimeout(400); } },

  // ── Phase 4 — bulk orders (standard) ────────────────────────────────────────────────────
  { name: 'bulk-configure', viewports: ['phone', 'desktop'], steps: (page) => openBulk(page) },
  {
    name: 'bulk-customer-menu', viewports: ['desktop'],
    steps: async (page) => { await openBulk(page); await page.locator('[data-testid="configure-bulk-order-customer-search-input"]:visible').click(); await page.waitForTimeout(700); },
  },
  {
    name: 'bulk-catalogue-menu', viewports: ['desktop'],
    steps: async (page) => { await openBulk(page); await page.locator('#configure-bulk-order-catalogue-select-input').click(); await page.waitForTimeout(500); },
  },
  {
    // Picking a catalogue previews the customers and products it would add.
    name: 'bulk-catalogue-confirm', viewports: ['desktop'],
    steps: async (page) => { await openBulk(page); await page.locator('#configure-bulk-order-catalogue-select-input').click(); await page.waitForTimeout(400); await page.getByText('Premium', { exact: true }).click(); await page.waitForTimeout(1500); },
  },
  {
    name: 'bulk-catalogue-added', viewports: ['desktop'],
    steps: async (page) => { await openBulk(page); await page.locator('#configure-bulk-order-catalogue-select-input').click(); await page.waitForTimeout(400); await page.getByText('Premium', { exact: true }).click(); await page.waitForTimeout(1500); await page.locator('[data-testid="selection-confirmation-modal-confirm-btn"]').click(); await page.waitForTimeout(1500); },
  },
  { name: 'bulk-customers', viewports: ['phone', 'desktop'], steps: bulkCustomers },
  {
    // Closing with customers picked asks first.
    name: 'bulk-discard', viewports: ['desktop'],
    steps: async (page) => { await bulkCustomers(page); await page.locator('[data-testid="drawer-bulk-order-close-btn"]').click(); await page.waitForTimeout(600); },
  },
  { name: 'bulk-grid', viewports: ['phone', 'desktop'], steps: bulkGrid },
  { name: 'bulk-quantities', viewports: ['desktop'], steps: bulkQuantities },
  {
    // The bin asks before clearing one customer's quantity; confirmed, the cell becomes a "+".
    name: 'bulk-clear-confirm', viewports: ['desktop'],
    steps: async (page) => { await bulkQuantities(page); await page.locator('[data-testid^="bulk-order-qty-clear-btn-"]:visible').nth(0).click(); await page.waitForTimeout(400); },
  },
  {
    name: 'bulk-cleared', viewports: ['desktop'],
    steps: async (page) => { await bulkQuantities(page); await page.locator('[data-testid^="bulk-order-qty-clear-btn-"]:visible').nth(0).click(); await page.waitForTimeout(400); await page.locator('[data-testid="bulk-order-remove-confirm-modal-confirm-btn"]').click(); await page.waitForTimeout(500); },
  },
  {
    name: 'bulk-price-edit', viewports: ['desktop'],
    steps: async (page) => { await bulkQuantities(page); await page.locator('[data-testid^="bulk-order-price-edit-btn-"]:visible').nth(1).click(); await page.waitForTimeout(300); await page.keyboard.press('Control+A'); await page.keyboard.type('30'); await page.waitForTimeout(300); },
  },
  {
    name: 'bulk-price-edited', viewports: ['desktop'],
    steps: async (page) => { await bulkQuantities(page); await page.locator('[data-testid^="bulk-order-price-edit-btn-"]:visible').nth(1).click(); await page.waitForTimeout(300); await page.keyboard.press('Control+A'); await page.keyboard.type('30'); await page.keyboard.press('Enter'); await page.waitForTimeout(500); },
  },
  { name: 'bulk-preview', viewports: ['desktop'], steps: async (page) => { await bulkQuantities(page); await page.locator('[data-testid="bulk-order-preview-btn"]').click(); await page.waitForTimeout(900); } },
  {
    name: 'bulk-preview-expanded', viewports: ['phone', 'desktop'],
    steps: async (page) => { await bulkQuantities(page); await page.locator('[data-testid="bulk-order-preview-btn"]:visible').click(); await page.waitForTimeout(900); await page.locator('[data-testid^="order-preview-toggle-"]').nth(1).click(); await page.waitForTimeout(400); },
  },
  {
    name: 'bulk-created', viewports: ['desktop'],
    steps: async (page) => { await bulkQuantities(page); await page.locator('[data-testid="bulk-order-preview-btn"]').click(); await page.waitForTimeout(900); await page.locator('[data-testid="order-preview-submit-btn"]').click(); await page.waitForTimeout(2000); },
  },

  // ── Phase 4 — route bulk orders ─────────────────────────────────────────────────────────
  { name: 'route-select', viewports: ['phone', 'desktop'], steps: openRoute },
  { name: 'route-picked', viewports: ['phone', 'desktop'], steps: async (page) => { await openRoute(page); await page.locator('[data-testid^="route-select-row-"]:visible').first().click(); await page.waitForTimeout(600); } },
  {
    name: 'route-grid', viewports: ['phone', 'desktop'],
    steps: async (page) => { await openRoute(page); await page.locator('[data-testid^="route-select-row-"]:visible').first().click(); await page.waitForTimeout(600); await page.locator('[data-testid="route-select-modal-confirm-btn"]').click(); await page.waitForTimeout(2500); },
  },
  {
    // Created: one order per customer with quantities, dispatched and delivered as the route's run.
    name: 'route-created', viewports: ['desktop'],
    steps: async (page) => {
      await openRoute(page); await page.locator('[data-testid^="route-select-row-"]:visible').first().click(); await page.waitForTimeout(600);
      await page.locator('[data-testid="route-select-modal-confirm-btn"]').click(); await page.waitForTimeout(2500);
      const q = page.locator('[data-testid^="bulk-order-qty-input-"]:visible');
      await q.nth(0).fill('2'); await q.nth(2).fill('4'); await page.keyboard.press('Tab'); await page.waitForTimeout(400);
      await page.locator('[data-testid="bulk-order-preview-btn"]').click(); await page.waitForTimeout(900);
      await page.locator('[data-testid="order-preview-submit-btn"]').click(); await page.waitForTimeout(2500);
    },
  },
];
