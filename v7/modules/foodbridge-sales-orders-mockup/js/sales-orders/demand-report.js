/*
  Generate Demand → the report itself (production's DemandReportPDF): Legal-landscape pages drawn to
  scale — a summary of every product ordered, by category, then the demand detail: customers down,
  products across, a main and a loose row per customer.

  Inline styles throughout, as production writes them: the page is a print mockup, so its sizes
  are millimetres and points, not the screen's Tailwind scale.
*/
import { esc } from '../components/dom.js';

const PAGE = { WIDTH: '355.6mm', HEIGHT: '215.9mm', PRODUCTS_PER_PAGE: 25, CUSTOMERS_PER_PAGE: 30, FIRST_MAX: 420, NEXT_MAX: 480 };
const COLORS = [
  { header: '#EDE9FE', border: '#8b5cf6' }, { header: '#DBEAFE', border: '#3b82f6' }, { header: '#D1FAE5', border: '#10b981' },
  { header: '#FEE2E2', border: '#ef4444' }, { header: '#FEF3C7', border: '#f59e0b' }, { header: '#E0E7FF', border: '#6366f1' },
];
const byName = (a, b) => a.toLowerCase().localeCompare(b.toLowerCase());
const B = 'border: 0.5px solid rgb(156, 163, 175);';

/**
 * The report's data, from the selected orders: one customer per buyer, one product per product
 * id, quantities in the base unit (the tenant shows the base unit, so no loose quantity arises).
 */
export function demandData(m, orders) {
  const cat = new Map(m.catalogue.flatMap((c) => c.subs.flatMap((s) => s.products.map((p) => [p.id, s.name]))));
  const customers = new Map();
  const products = new Map();
  const matrix = {};
  for (const o of orders) {
    const c = m.customerOf(o);
    const name = c?.name || 'Unknown';
    if (!customers.has(o.customerId)) customers.set(o.customerId, { id: o.customerId, name: /^\d+$/.test(name.trim()) ? (c?.phone || name) : name, phone: c?.phone || 'N/A' });
    for (const l of o.items) {
      if (!products.has(l.productId)) products.set(l.productId, { id: l.productId, name: l.name, category: cat.get(l.productId) || 'Uncategorized', unit: l.unit || 'Unit' });
      const k = `${o.customerId}-${l.productId}`;
      matrix[k] = (matrix[k] || 0) + (Number(l.qty) || 0);
    }
  }
  const list = [...products.values()];
  const cs = [...customers.values()];
  const totals = Object.fromEntries(list.map((p) => [p.id, cs.reduce((s, c) => s + (matrix[`${c.id}-${p.id}`] || 0), 0)]));
  return { customers: cs, products: list, matrix, totals, categories: [...new Set(m.catalogue.flatMap((c) => c.subs.map((s) => s.name)))] };
}

function summaryPages(d, reportName, orderCount, today) {
  const map = {};
  for (const p of d.products) (map[p.category] ||= []).push({ ...p, total: d.totals[p.id] || 0 });
  const cats = Object.entries(map).filter(([, ps]) => ps.length).sort((a, b) => byName(a[0], b[0]));
  const height = (ps) => 18 + Math.ceil(ps.length / 3) * 15 + 8 + 5;
  const pages = [];
  let cur = [];
  let h = 0;
  for (const [name, ps] of cats) {
    const ch = height(ps);
    const max = !pages.length && !cur.length ? PAGE.FIRST_MAX : PAGE.NEXT_MAX;
    if (h + ch > max && cur.length) { pages.push(cur); cur = [[name, ps]]; h = ch; }
    else if (h + ch > max) { pages.push([[name, ps]]); cur = []; h = 0; }
    else { cur.push([name, ps]); h += ch; }
  }
  if (cur.length) pages.push(cur);
  const stat = (value, color, label, first) => `<div style="text-align: center;${first ? '' : ' border-left: 1px solid rgb(209, 213, 219); padding-left: 16px;'}"><p style="font-size: 13px; font-weight: bold; color: ${color}; margin: 0px;">${value}</p><p style="font-size: 9px; color: rgb(107, 114, 128); margin: 0px;">${label}</p></div>`;
  return pages.map((pageCats, idx) => {
    const blocks = pageCats.map(([name, ps], ci) => {
      const col = COLORS[ci % COLORS.length];
      const sorted = [...ps].sort((a, b) => b.total - a.total);
      const cols = [[], [], []];
      sorted.forEach((p, i) => cols[i % 3].push(p));
      const td = 'border-bottom: 1px solid rgb(243, 244, 246);';
      return `<div style="margin-bottom: 8px; break-inside: avoid;"><div style="background-color: ${col.header}; border-left: 3px solid ${col.border}; padding: 3px 8px; margin-bottom: 2px;"><h3 style="font-weight: bold; color: rgb(17, 24, 39); font-size: 10px; margin: 0px;">${esc(name.toUpperCase())}</h3></div><div style="display: table; width: 100%; table-layout: fixed;"><div style="display: table-row;">${cols.map((cp, c) => `<div style="display: table-cell; width: 33.33%; vertical-align: top; padding-right: ${c < 2 ? '8px' : '0px'};"><table style="width: 100%; font-size: 9px; border-collapse: collapse;"><tbody>${cp.map((p, i) => `<tr style="background-color: ${i % 2 === 0 ? 'rgb(255, 255, 255)' : 'rgb(249, 250, 251)'};"><td style="padding: 2px 4px; width: 15px; text-align: center; color: rgb(156, 163, 175); font-weight: 500; font-size: 8px; ${td}">${sorted.indexOf(p) + 1}</td><td style="padding: 2px 4px; color: rgb(31, 41, 55); font-size: 9px; ${td} overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 120px;">${esc(p.name)}</td><td style="padding: 2px 4px; text-align: center; color: rgb(107, 114, 128); font-size: 8px; background-color: rgb(243, 244, 246); ${td} width: 28px;">${esc(p.unit)}</td><td style="padding: 2px 4px; text-align: right; font-weight: bold; color: rgb(17, 24, 39); font-size: 9.5px; width: 32px; ${td}">${p.total}</td><td style="padding: 2px 4px; text-align: right; font-weight: 400; color: rgb(156, 163, 175); font-size: 8px; width: 50px; ${td} font-style: italic;">-</td></tr>`).join('')}</tbody></table></div>`).join('')}</div></div></div>`;
    }).join('');
    const stats = idx === 0 ? `<div style="text-align: right;"><div style="display: inline-flex; gap: 16px; font-size: 13px;">${stat(orderCount, 'rgb(37, 99, 235)', 'Orders', true)}${stat(d.customers.length, 'rgb(22, 163, 74)', 'Customers')}${stat(d.products.length, 'rgb(147, 51, 234)', 'Products')}${stat(0, 'rgb(217, 119, 6)', 'Total')}</div></div>` : '';
    return `<div class="demand-page" style="width: ${PAGE.WIDTH}; height: ${PAGE.HEIGHT}; padding: 15mm 10mm; box-sizing: border-box; overflow: hidden; margin: 0px; break-after: page; background-color: rgb(255, 255, 255);"><div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; padding-bottom: 10px; border-bottom: 2px solid rgb(209, 213, 219);"><div><h1 style="font-size: 13px; font-weight: bold; color: rgb(31, 41, 55); margin: 0px;">${esc(reportName)}<!----> - Summary</h1><p style="font-size: 9px; color: rgb(107, 114, 128); margin-top: 4px;">${today}<!----> •<!----> <!---->${d.customers.length}<!----> Customers • <!---->${d.products.length}<!----> Products</p></div>${stats}</div><div><h2 style="font-weight: bold; color: rgb(17, 24, 39); margin-bottom: 12px; font-size: 11px;">PRODUCTS BY CATEGORY</h2><div>${blocks}</div></div></div>`;
  }).join('');
}

function detailPages(d, reportName, today, generated) {
  // Products grouped by category (alphabetical, every category — an empty one as a placeholder
  // column), then most-demanded first within a category.
  const by = {};
  for (const p of d.products) (by[p.category] ||= []).push(p);
  for (const c of d.categories) by[c] ||= [];
  const grouped = Object.entries(by).sort((a, b) => byName(a[0], b[0])).flatMap(([category, ps]) => (ps.length
    ? [...ps].sort((a, b) => (d.totals[b.id] || 0) - (d.totals[a.id] || 0))
    : [{ id: `empty-${category}`, name: 'No products', category, unit: '-', _isEmpty: true }]));
  const chunk = (list, n) => { const out = []; for (let i = 0; i < list.length; i += n) out.push(list.slice(i, i + n)); return out; };
  const productChunks = chunk(grouped, PAGE.PRODUCTS_PER_PAGE);
  const customerChunks = chunk(d.customers, PAGE.CUSTOMERS_PER_PAGE);
  return productChunks.map((products, pci) => {
    const groups = [];
    for (const p of products) { const last = groups[groups.length - 1]; if (last && last.category === p.category) last.count += 1; else groups.push({ category: p.category, count: 1 }); }
    const sections = customerChunks.map((customers, cci) => {
      const first = cci === 0;
      const header = first ? `<div style="margin-bottom: 8px; padding-bottom: 5px; border-bottom: 1.5px solid rgb(209, 213, 219);"><div style="display: flex; justify-content: space-between; align-items: flex-start;"><div><h1 style="font-size: 13px; font-weight: bold; color: rgb(31, 41, 55); margin: 0px;">${esc(reportName)}<!----> - Detail</h1><p style="font-size: 9px; color: rgb(75, 85, 99); margin: 0px;">Products <!---->${pci * PAGE.PRODUCTS_PER_PAGE + 1}<!---->–<!---->${Math.min((pci + 1) * PAGE.PRODUCTS_PER_PAGE, d.products.length)}<!----> of <!---->${d.products.length}<!----> • <!---->${d.customers.length}<!----> Customers</p></div><div style="text-align: right; font-size: 8px; color: rgb(75, 85, 99);"><p style="font-weight: 600; margin: 0px;">DATE: <!---->${today}</p><p style="margin: 0px;">Generated:<!----> <!---->${generated}</p></div></div></div>` : '';
      const th = (extra) => `${B} background-color: rgb(254, 243, 199); font-weight: bold; color: rgb(31, 41, 55); ${extra}`;
      const head = `<thead><tr><th rowspan="2" style="${th('padding: 1px; text-align: center; width: 18px; font-size: 7.5px;')}">#</th><th rowspan="2" style="${th('padding: 1px 3px; text-align: left; width: 85px; font-size: 7.5px;')}">CUSTOMER</th><th rowspan="2" style="${th('padding: 1px; text-align: center; width: 50px; font-size: 7.5px;')}">PHONE</th>${groups.map((g) => `<th colspan="${g.count}" style="${B} background-color: rgb(233, 213, 255); padding: 1px; text-align: center; font-weight: bold; color: rgb(31, 41, 55); font-size: 7.5px;">${esc(String(g.category || 'Uncategorized').toUpperCase())}</th>`).join('')}<th rowspan="2" style="${th('padding: 1px; text-align: center; width: 30px; font-size: 7px; line-height: 1.1;')}">TOTAL ITEMS</th></tr><tr>${products.map((p) => `<th style="${B} background-color: rgb(191, 219, 254); padding: 1px; text-align: center; font-weight: 600; color: rgb(55, 65, 81); font-size: 7px; line-height: 1.1; overflow-wrap: break-word; max-width: 45px;">${esc(String(p.name).toUpperCase())}</th>`).join('')}</tr></thead>`;
      const rows = customers.map((c, i) => {
        const even = i % 2 === 0;
        const cells = products.map((p) => {
          if (p._isEmpty) return `<td style="${B} padding: 1px; text-align: center; background-color: rgb(243, 244, 246); color: rgb(156, 163, 175); font-size: 7px; font-style: italic;">-</td>`;
          const q = d.matrix[`${c.id}-${p.id}`] || 0;
          return `<td style="${B} padding: 1px; text-align: center; font-weight: 700; background-color: ${q > 0 ? 'rgb(198, 239, 206)' : 'transparent'}; color: ${q > 0 ? 'rgb(0, 97, 0)' : 'rgb(229, 231, 235)'}; font-size: 8px;">${q > 0 ? `${q} ${esc(p.unit)}` : '-'}</td>`;
        }).join('');
        const loose = products.map((p) => (p._isEmpty
          ? `<td style="${B} padding: 1px; text-align: center; background-color: rgb(243, 244, 246); color: rgb(156, 163, 175); font-size: 6.5px;">-</td>`
          : `<td style="${B} padding: 1px; text-align: center; ${(d.matrix[`${c.id}-${p.id}`] || 0) > 0 ? 'font-weight: 400; ' : ''}background-color: rgb(249, 250, 251); color: rgb(156, 163, 175); font-size: 6.5px;">-</td>`)).join('');
        return `<tr style="background-color: ${even ? 'rgb(255, 255, 255)' : 'rgb(249, 250, 251)'};"><td style="${B} padding: 1px; text-align: center; color: rgb(107, 114, 128); font-size: 7.5px;">${cci * PAGE.CUSTOMERS_PER_PAGE + i + 1}</td><td style="${B} padding: 1px 2px; font-weight: 500; color: rgb(31, 41, 55); text-transform: uppercase; background-color: ${even ? 'rgb(255, 235, 156)' : 'rgb(255, 242, 204)'}; font-size: 7.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${esc(c.name)}</td><td style="${B} padding: 1px; text-align: center; color: rgb(55, 65, 81); font-size: 7.5px;">${c.phone !== 'N/A' ? esc(c.phone) : ''}</td>${cells}<td style="${B} padding: 1px; text-align: center; font-weight: bold; color: rgb(31, 41, 55); font-size: 8.5px; background-color: rgb(254, 243, 199);">0</td></tr>`
          + `<tr style="background-color: ${even ? 'rgb(240, 253, 244)' : 'rgb(236, 253, 245)'};"><td style="${B} padding: 1px; text-align: center; color: rgb(156, 163, 175); font-size: 6.5px;"></td><td colspan="2" style="${B} padding: 1px 2px; font-weight: 400; color: rgb(107, 114, 128); font-size: 6.5px; font-style: italic; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; background-color: rgb(229, 231, 235);">LOOSE QTY</td>${loose}<td style="${B} padding: 1px; text-align: center; color: rgb(156, 163, 175); font-size: 6.5px; background-color: rgb(243, 244, 246);"></td></tr>`;
      }).join('');
      const totalRow = `<tr style="background-color: rgb(219, 234, 254); font-weight: bold;"><td colspan="3" style="${B} padding: 2px; text-align: center; color: rgb(31, 41, 55); text-transform: uppercase; font-size: 8px; font-weight: bold; line-height: 1.1;">TOTAL QTY</td>${products.map((p) => (p._isEmpty
        ? `<td style="${B} padding: 2px; text-align: center; background-color: rgb(243, 244, 246); color: rgb(156, 163, 175); font-size: 7px;">-</td>`
        : `<td style="${B} padding: 2px; text-align: center; font-weight: bold; background-color: rgb(191, 219, 254); color: rgb(30, 64, 175); font-size: 8.5px;" title="Total quantity for ${esc(p.name)}">${d.totals[p.id] > 0 ? d.totals[p.id] : ''}</td>`)).join('')}<td style="${B} padding: 2px; text-align: center; font-weight: bold; color: rgb(31, 41, 55); font-size: 9px; background-color: rgb(254, 243, 199);" title="Grand total of all quantities">0</td></tr>`;
      return `<div style="width: ${PAGE.WIDTH}; padding: ${first ? '15mm 10mm 8mm' : '4mm 10mm 8mm'}; box-sizing: border-box; background-color: rgb(255, 255, 255); break-inside: avoid;">${header}<div><table style="width: 100%; border-collapse: collapse; font-size: 8px; table-layout: fixed;">${head}<tbody>${rows}${totalRow}</tbody></table></div></div>`;
    }).join('');
    return `<div style="width: ${PAGE.WIDTH}; background-color: rgb(255, 255, 255);">${sections}</div>`;
  }).join('');
}

/** The report pages (inside the preview's grey scroller). */
export function renderReport(m, orders, reportName, now) {
  const d = demandData(m, orders);
  const n = new Date(now);
  const today = n.toLocaleDateString('en-GB');
  const generated = n.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const summary = d.customers.length ? summaryPages(d, reportName, orders.length, today) : '';
  const detail = d.customers.length && d.products.length ? detailPages(d, reportName, today, generated) : '<div data-testid="demand-report-pdf-empty" class="text-center py-12 text-gray-500"><p>No data available for selected orders</p></div>';
  return `<div class="bg-white mx-auto" data-demand-print style="width: ${PAGE.WIDTH}; margin: 0px auto; padding: 0px; box-sizing: border-box;">${summary}${detail}</div>`;
}
