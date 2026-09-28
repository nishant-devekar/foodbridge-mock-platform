/*
  Wires every flow the list opens into the screen's hooks: the row's fulfilment panel, the
  document modals, the status audit drawer, the forecast drawer and the create-order drawer.
*/
import { createForecastDrawer } from './forecast-drawer.js';
import { forecastStats } from './model.js';
import { fulfillmentPanel } from './fulfillment.js';
import { createAuditDrawer } from './audit-drawer.js';
import { poDocumentModal, downloadDocument, printDocument } from './po-document.js';
import { createDocumentsModal } from './po-documents-modal.js';
import { createOrderDrawer } from './create-drawer.js';
import { createRawMaterialDrawer } from './raw-material-drawer.js';
import { morphOuter } from '../components/dom.js';

export function mountFlows(host, server, screen, ctx) {
  // OrderFulfillmentMetadata: each expanded row's own state (its tab, its copied number). It is
  // unmounted when the row collapses, so re-expanding starts on Details again.
  const panels = new Map();
  ctx.renderFulfillment = (row) => {
    if (!panels.has(row.order._id)) panels.set(row.order._id, { tab: 'details', copied: '' });
    return fulfillmentPanel(row.order, row.seller, panels.get(row.order._id));
  };
  screen.store.subscribe((state, patch) => {
    if ('expanded' in patch) for (const id of [...panels.keys()]) if (!state.expanded.includes(id)) panels.delete(id);
  });
  ctx.outlet.addEventListener('click', (e) => {
    const tab = e.target.closest('[data-act="fulfillment-tab"]');
    if (tab) { panels.get(tab.dataset.id).tab = tab.dataset.tab; screen.rerender(); return; }
    const copy = e.target.closest('[data-act="fulfillment-copy"]');
    if (copy) {
      const id = copy.closest('[data-testid^="order-fulfillment-metadata-"]').dataset.testid.replace('order-fulfillment-metadata-', '');
      const value = copy.dataset.value;
      navigator.clipboard.writeText(value).then(() => {
        host.notify('success', `Order reference reference copied: ${value}`);
        panels.get(id).copied = value; screen.rerender();
        setTimeout(() => { if (panels.has(id)) { panels.get(id).copied = ''; screen.rerender(); } }, 2000);
      }).catch(() => host.notify('error', 'Failed to copy reference'));
    }
  });

  // The host's Raw Material Calculator (appProp.productRawMaterialMapping). Closing reloads the list.
  const rawMaterial = createRawMaterialDrawer(host, server, { onClosed: () => screen.reload() });
  ctx.openRawMaterial = () => rawMaterial.open();

  // A row's status change: UpdateAuditDrawer. Closing any drawer reloads the list and the sources.
  const audit = createAuditDrawer(host, server, { onClosed: () => screen.reload() });
  ctx.openAudit = (row, newStatus) => audit.open(row.order, newStatus);

  // ── A row's documents ────────────────────────────────────────────────────────────────────
  // Both modals render INLINE, after the rows of whichever layout opened them (the table's
  // <tbody>, or the card list): so the table's inherited styles reach them there, as they do in
  // production. Each layout keeps its own cache of documents added since the list loaded.
  const mountOf = (layout) => () => (layout === 'card'
    ? ctx.outlet.querySelector('[data-testid="sourcing-card-list"] > div')
    : ctx.outlet.querySelector('[data-testid="sourcing-table-list"] tbody'));
  const S = () => screen.store.state;
  const docsOf = (layout, order) => S().addedDocuments[layout][order._id] || order.purchaseOrderDocuments || [];
  const setDocs = (layout, order, list) => screen.store.set({ addedDocuments: { ...S().addedDocuments, [layout]: { ...S().addedDocuments[layout], [order._id]: list } } });

  let po = null;
  let poRoot = null;
  function renderPo() {
    if (!po) { poRoot?.remove(); poRoot = null; return; }
    const html = poDocumentModal(po.m, host);
    if (poRoot?.isConnected) { morphOuter(poRoot, html); return; }
    const tpl = document.createElement('template');
    tpl.innerHTML = html;
    poRoot = tpl.content.firstElementChild;
    const mount = po.mount();
    mount.insertBefore(poRoot, mount.querySelector(':scope > [data-keep="po-documents"]'));
    poRoot.addEventListener('click', (e) => {
      const act = e.target.closest('[data-pd-act]')?.dataset.pdAct;
      if (act === 'close') { po = null; renderPo(); }
      if (act === 'download') downloadDocument(poRoot, po.m, host);
      if (act === 'print') printDocument(poRoot);
    });
  }

  const docsModal = createDocumentsModal(host, server, {
    onUploadSuccess: (st, doc) => setDocs(st.layout, st.order, [...docsOf(st.layout, st.order), doc]),
    onAttachmentsChange: (st, id, attachments) => setDocs(st.layout, st.order, docsOf(st.layout, st.order).map((d) => (d._id === id ? { ...d, attachments, documentUrl: undefined } : d))),
    onEditSuccess: (st, id, updates) => setDocs(st.layout, st.order, docsOf(st.layout, st.order).map((d) => (d._id === id ? { ...d, ...updates } : d))),
  });

  ctx.openDocument = (act, row, docId, layout = 'table') => {
    const { order, seller } = row;
    if (act === 'doc-po' || act === 'doc-grn') {
      po = { mount: mountOf(layout), m: { orderNumber: order.order_number, orderData: { order, seller }, docType: act === 'doc-po' ? 'PO' : 'GRN' } };
      renderPo();
      return;
    }
    const documents = () => docsOf(layout, order);
    const entry = act === 'doc-other' ? documents().find((d) => String(d._id) === String(docId)) : null;
    docsModal.open({ mount: mountOf(layout), order, mode: act === 'doc-invoice' ? 'invoice' : 'document', entry, documents });
    docsModal.state.layout = layout;
  };
  // A list reload replaces the table and the cards, and the modals with them.
  screen.store.subscribe((state, patch) => {
    if (patch.loading === true) { po = null; renderPo(); if (docsModal.isOpen()) docsModal.close(); }
  });

  // Create Purchase Orders: the create drawer over the sources the screen loaded. Closing it reloads.
  const create = createOrderDrawer(host, server, { onClosed: () => screen.reload() });
  // handleUseForecastRecommendations / handleCreateBlankPurchase: a forecast hand-off opens the
  // drawer behind the supplier gate with its items waiting to be seeded; a blank one never
  // inherits a stale seed.
  ctx.openCreate = ({ forecastSeed = null } = {}) => create.open({ sourceList: screen.store.state.combinedList, forecastSeed: forecastSeed && forecastSeed.length ? forecastSeed : null });

  // PurchaseForecastBanner: its drawer mounts (closed) once the banner has something to show.
  const forecast = createForecastDrawer(host, { onAdd: (items) => ctx.openCreate?.({ forecastSeed: items }) });
  ctx.onForecastLoaded = (data) => { if (forecastStats(data).count > 0) forecast.mount(data); };
  ctx.openForecast = (data) => forecast.open(data);
}
