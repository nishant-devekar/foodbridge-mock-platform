/*
  Opening a side at a state, freezing it, and photographing it — identically for both sides.

  Both sides get the same browser conditions: viewport, device scale, time zone, locale and a FIXED
  clock (every date on screen is counted back from it), and the same freeze CSS at load. The oracle
  page is already production's own page (html lang/class, body.antialiased, host CSS), so nothing
  about it is normalised beyond what a signed-in user's browser already holds: the session and the
  tenant setup in localStorage.
*/
import path from 'node:path';
import { createRequire } from 'node:module';
import { STOREFRONT } from './servers.mjs';

export const VIEWPORTS = {
  phone: { width: 375, height: 812, isMobile: true, hasTouch: true },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1280, height: 900 },
  wide: { width: 1440, height: 900 },
};

const FREEZE_CSS = `*, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }`;

/**
 * What a signed-in user's browser holds when they open /sourcing-orders: the login's adminInfo, and
 * everything SidebarContext.fetchPrivateSetup writes after its LAST setup fetch — computed with
 * storefront's own client lib (the key map narrows the raw payload), so the keys and shapes are
 * exactly the host's. Without it the screen mounts before its first setup fetch lands, and the
 * status filter (which reads its options once, on mount) stays empty: a real cold-start race, but
 * not the screen users see.
 */
export async function warmStorage(rawSetup) {
  // The lib's CommonJS build: its ESM build uses extensionless specifiers only a bundler resolves.
  const lib = path.join(STOREFRONT, 'node_modules/@nishant-devekar/storefront-client-lib/dist/cjs/lib');
  const req = createRequire(path.join(lib, 'index.js'));
  const { ClientResponseBuilder } = req(path.join(lib, 'core/utils/index.js'));
  const { PrivateSetupKeyMap } = req(path.join(lib, 'data-mappers/index.js'));
  const { data } = await ClientResponseBuilder.buildClientResponse({ status: true, data: rawSetup }, PrivateSetupKeyMap);
  const kv = {
    adminInfo: JSON.stringify({ _id: '6aa000000000000000000001', name: data.username, token: 'parity-session' }),
    globalSetting: JSON.stringify(data),
    appProp: JSON.stringify(data.appProp),
    theme: 'light',
  };
  if (data.userLoc) {
    kv.storeLocations = JSON.stringify(data.userLoc);
    kv.groupedLocationData = JSON.stringify(data.groupedLocationData);
  }
  if (data.appProp?.paymentMethods) kv.paymentMethods = JSON.stringify(data.appProp.paymentMethods);
  if (data.appProp?.shippingMethods) kv.shippingMethods = JSON.stringify(data.appProp.shippingMethods);
  if (data.appProp?.currency) kv.currency = data.appProp.currency;
  if (data.appProp?.logoText) kv.logoText = data.appProp.logoText;
  if (data.appProp?.taxConfig) kv.taxConfig = JSON.stringify(data.appProp.taxConfig);
  return kv;
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
  await context.addInitScript(({ css }) => {
    const inject = () => {
      const style = document.createElement('style');
      style.setAttribute('data-parity', '');
      style.textContent = css;
      (document.head || document.documentElement).appendChild(style);
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inject);
    else inject();
  }, { css: FREEZE_CSS });
  // Byte randomness is dice too (Add New Item mints its article number from crypto.getRandomValues):
  // a seeded mulberry32 fills byte arrays, identically on both sides, from the same start each page.
  await context.addInitScript(() => {
    let seed = 0x5eed1;
    const next = () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return (t ^ (t >>> 14)) >>> 0;
    };
    const real = crypto.getRandomValues.bind(crypto);
    crypto.getRandomValues = (arr) => {
      if (!(arr instanceof Uint8Array)) return real(arr);
      for (let i = 0; i < arr.length; i += 1) arr[i] = next() & 255;
      return arr;
    };
  });
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

/** Wait until the list has settled into one of its end states, the forecast has answered, and the network is quiet. */
export async function settle(page, { expect = 'any' } = {}) {
  const sel = {
    list: '[data-testid="sourcing-table-list"], [data-testid="sourcing-card-list"]',
    empty: '[data-testid="sourcing-list-empty"]',
    filtered: '[data-testid="sourcing-list-empty-filtered"]',
    loading: '[data-testid="sourcing-list-loading"]',
    any: '[data-testid="sourcing-table-list"], [data-testid="sourcing-list-empty"], [data-testid="sourcing-list-empty-filtered"]',
  }[expect];
  await page.waitForSelector(sel, { state: 'attached', timeout: 60000 });
  if (expect !== 'loading') await page.waitForSelector('[data-testid="purchase-forecast-banner-loading"]', { state: 'detached', timeout: 30000 }).catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(400);
}

/**
 * Two images per state: the viewport as a user first sees it, and `-full` with every inner
 * scroller expanded — the host's page shell is 100dvh with <main> scrolling inside it, so the
 * document never grows and a viewport shot alone would hide everything below the fold.
 */
export async function shoot(page, file) {
  // The pointer stays where the driver left it: hover states are states.
  await page.screenshot({ path: `${file}.png` });
  // Expanding scrollers moves content under a pointer that has not moved; park it first, on both
  // sides alike, and let hover settle. Hover states are compared in the viewport image above.
  await page.mouse.move(0, 0);
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('*')) {
      const s = getComputedStyle(el);
      if (/(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 4) {
        el.style.setProperty('height', 'auto', 'important');
        el.style.setProperty('max-height', 'none', 'important');
        el.style.setProperty('overflow', 'visible', 'important');
      }
    }
    for (const el of document.querySelectorAll('[class*="h-[100dvh]"], .h-screen')) {
      el.style.setProperty('height', 'auto', 'important');
    }
  });
  await page.screenshot({ path: `${file}-full.png`, fullPage: true });
}

/** The page's DOM at this state (the screen plus every body-level portal), for structural comparison. */
export async function dumpDom(page) {
  return page.evaluate(() => {
    const clone = document.body.cloneNode(true);
    for (const s of clone.querySelectorAll('script, style[data-parity], noscript')) s.remove();
    return clone.innerHTML;
  });
}
