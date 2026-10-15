/*
  Opening a side at a state, freezing it, and photographing it — identically for both sides.

  Both sides get the same browser conditions: viewport, device scale, time zone, locale and a
  FIXED clock (every date on screen is counted back from it). Both get the same freeze CSS at
  load. The only side-specific step is normalising the production sandbox's PAGE, which is not
  part of the product: its mode badge and the browser's default 8px body margin (the module's
  stylesheet is scoped under .so-root, so it never resets <body>). The module's own markup and CSS
  are never touched.
*/

export const VIEWPORTS = {
  phone: { width: 375, height: 812, isMobile: true, hasTouch: true },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1280, height: 900 },
  wide: { width: 1440, height: 900 },
};

const FREEZE_CSS = `*, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }
.tab-enter { animation: none !important; opacity: 1 !important; transform: none !important; }`;

/*
  The HOST page the module is mounted in, restored around the production sandbox.

  The module's build scopes every rule it ships under .so-root, including its copies of the host's
  html/body rules — so standalone, the root font-size never scales and nothing sets the page's
  line-height. In production the module always renders inside storefront-frontend, whose GLOBAL
  CSS does both. Photographing the bare sandbox would compare against a page no user sees.

  Restated from the host's own sources, not from the prototype (so the two sides cannot share a
  mistake): Tailwind's preflight html/body rules, and storefront-frontend/src/assets/css/custom.css
  lines 1466-1471 (white page) and 1889-1936 (the root font-size density scale).
  The sandbox's mode badge is hidden; it is not part of the product.
*/
const REACT_PAGE_CSS = `html { line-height: 1.5; -webkit-text-size-adjust: 100%; tab-size: 4; font-family: system-ui, sans-serif, Arial, Helvetica; font-feature-settings: normal; font-variation-settings: normal; }
body { margin: 0 !important; line-height: inherit; }
html, body, :root { background-color: #ffffff !important; color: #000000 !important; color-scheme: light !important; }
@media (min-width: 640px) and (max-width: 1023px) { html { font-size: 15px; } }
@media (max-width: 639px) { html { font-size: 14.5px; } }
@media (max-width: 419px) { html { font-size: 13.5px; } }
#root > div[style*="2147483647"] { display: none !important; }`;

/**
 * What a signed-in user's browser already holds when they open /orders: the host's login writes
 * the tenant setup into storage (SidebarContext's keys) before the screen mounts. Without it the
 * production screen mounts BEFORE its first setup fetch lands, and the status filter — which
 * reads its options once, on mount — stays at "No options" until a reload. That is a real cold-
 * start race in production, but it is not the screen users see, so the oracle starts warm.
 */
export function warmStorage(setup) {
  const ap = setup.appProp || {};
  return {
    globalSetting: JSON.stringify(setup),
    appProp: JSON.stringify(ap),
    storeLocations: JSON.stringify(setup.userLoc || []),
    groupedLocationData: JSON.stringify(setup.groupedLocationData || {}),
    paymentMethods: JSON.stringify(ap.paymentMethods || {}),
    shippingMethods: JSON.stringify(ap.shippingMethods || {}),
    currency: ap.currency || '₹',
    logoText: ap.logoText || '',
    taxConfig: JSON.stringify(ap.taxConfig || {}),
    theme: 'light',
  };
}

export async function openSide(browser, side, { url, viewport, now, dpr = 1, storage = null }) {
  const vp = VIEWPORTS[viewport];
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: dpr,
    isMobile: !!vp.isMobile,
    hasTouch: !!vp.hasTouch,
    timezoneId: 'Asia/Kolkata',
    locale: 'en-IN',
    colorScheme: 'light',
  });
  await context.addInitScript(({ css, extra, host }) => {
    const inject = () => {
      const style = document.createElement('style');
      style.setAttribute('data-parity', '');
      style.textContent = css + '\n' + extra;
      (document.head || document.documentElement).appendChild(style);
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inject);
    else inject();
    // The host page's own <html lang="en" class="light"> (storefront-frontend/index.html, line 2);
    // the sandbox page declares no language. The language picks glyph variants — measurably, in
    // composited text such as tooltips — so the production page is restored exactly.
    const asHost = () => { if (host && document.documentElement) { document.documentElement.setAttribute('lang', 'en'); document.documentElement.classList.add('light'); } };
    asHost();
    document.addEventListener('DOMContentLoaded', asHost);
  }, { css: FREEZE_CSS, extra: side === 'react' ? REACT_PAGE_CSS : '', host: side === 'react' });
  if (storage) {
    await context.addInitScript((kv) => {
      if (sessionStorage.getItem('__parity_warm')) return;
      for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v);
      sessionStorage.setItem('__parity_warm', '1');
    }, storage);
  }
  const page = await context.newPage();
  await page.clock.setFixedTime(now);
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e?.message || e)));
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  return { context, page, errors };
}

/** Wait until the list has settled into one of its end states and the network is quiet. */
export async function settle(page, { expect = 'any' } = {}) {
  const sel = {
    list: '[data-testid="orders-list"] [data-testid^="order-row-"]',
    empty: '[data-testid="orders-list-empty"]',
    error: '[data-testid="orders-list-error"]',
    loading: '[data-testid="orders-list-loading"]',
    any: '[data-testid="orders-list"] [data-testid^="order-row-"], [data-testid="orders-list-empty"], [data-testid="orders-list-error"]',
  }[expect];
  await page.waitForSelector(sel, { state: 'attached', timeout: 30000 });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(400);
}

/**
 * Two images per state: the viewport as a user first sees it, and `-full` with every inner
 * scroller expanded — the shell never grows the document, so a viewport shot alone would hide
 * everything below the inner fold.
 */
export async function shoot(page, file) {
  // The pointer stays where the driver left it: hover states (insights, tooltips) are states.
  await page.screenshot({ path: `${file}.png` });
  // The -full image is for what lies below the fold. Expanding the scrollers moves content under a
  // pointer that has not moved, and what the page does with that (hover bubbles opening on rows
  // that slide past) is not a state anyone reaches. So the pointer is parked in the page corner
  // first, on both sides alike, and hover is let settle. Hover states are compared in the
  // viewport image above.
  await page.mouse.move(0, 0);
  await page.waitForTimeout(400);
  const expanded = await page.evaluate(() => {
    let n = 0;
    for (const el of document.querySelectorAll('*')) {
      const s = getComputedStyle(el);
      if (/(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 4) {
        el.style.setProperty('height', 'auto', 'important');
        el.style.setProperty('max-height', 'none', 'important');
        el.style.setProperty('overflow', 'visible', 'important');
        n += 1;
      }
    }
    for (const el of document.querySelectorAll('[class*="h-[100dvh]"], .h-screen')) {
      el.style.setProperty('height', 'auto', 'important');
    }
    return n;
  });
  await page.screenshot({ path: `${file}-full.png`, fullPage: true });
  return expanded;
}

/** The module's DOM at this state, for structural comparison. */
export async function dumpDom(page) {
  return page.evaluate(() => {
    // The screen, plus the body-level portal host the product renders every overlay into.
    const root = document.querySelector('[data-testid="sales-orders-screen-root"]') || document.querySelector('.so-root') || document.body;
    const host = document.getElementById('so-portal-host');
    return root.outerHTML + (host ? `\n<!-- portal host -->\n${host.outerHTML}` : '');
  });
}
