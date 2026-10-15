/*
  MainDrawer: the module's drawer shell (components/ui/MainDrawer.jsx) over rc-drawer 4, as it
  renders into a <div> it appends to <body>:

    div.drawer.drawer-right[.drawer-open] > div.drawer-mask
                                          + div.drawer-content-wrapper (width; translateX(100%) closed)
                                              > div.drawer-content > [close ✕] + div[data-testid=main-drawer]
                                              + div.drawer-handle (hidden by the host's CSS)

  Width is 100% at or below 575px, else 82% (or the drawer's own). While any drawer is open, <body>
  carries rc-drawer's scroll lock (class `ant-scrolling-effect`, touch-action none, overflow hidden), and rc-drawer
  focuses the drawer element itself each time it opens.

  Closing goes through MainDrawer's one confirmation path: the ✕, the mask, Escape and the browser's
  BACK (a sentinel history entry is pushed while the drawer is open) all ask the content's
  registered before-close check first, which may veto (unsaved-changes prompts). `onCloseRequest`
  replaces that path entirely for a drawer that decides its own closing (the forecast drawer).

  Re-rendering morphs the content in place, so inputs keep focus and caret.
*/
import { fi } from './icons.js';
import { morph } from './dom.js';

let openCount = 0;

export function createMainDrawer({ width, onCloseRequest, onClose } = {}) {
  const host = document.createElement('div');
  let open = false;
  let mounted = false;
  let beforeClose = null;
  let guarded = false;

  const widthNow = () => (window.innerWidth <= 575 ? '100%' : width || '82%');
  const lock = (on) => {
    openCount = Math.max(0, openCount + (on ? 1 : -1));
    document.body.classList.toggle('ant-scrolling-effect', openCount > 0);
    // rc-util's scroll locker: touch-action first, then overflow; unlocking empties the style
    // attribute but leaves it on <body>.
    document.body.style.touchAction = openCount > 0 ? 'none' : '';
    document.body.style.overflow = openCount > 0 ? 'hidden' : '';
  };

  function frame(content) {
    return `<div tabindex="-1" class="drawer drawer-right${open ? ' drawer-open' : ''}"><div class="drawer-mask" data-drawer-mask></div><div class="drawer-content-wrapper" style="${open ? '' : 'transform: translateX(100%); '}width: ${widthNow()};"><div class="drawer-content">`
      + `<button data-testid="main-drawer-close-btn" class="absolute focus:outline-none z-10 text-red-500 hover:bg-red-100 hover:text-gray-700 transition-colors duration-150 bg-white shadow-md mr-6 right-0 left-auto w-10 h-10 rounded-full block text-center" aria-label="Close drawer" style="top: calc(var(--safe-area-inset-top, env(safe-area-inset-top, 0px)) + 1.5rem);" data-drawer-close>${fi('FiX', { cls: 'mx-auto' })}</button>`
      + `<div data-testid="main-drawer" class="flex flex-col w-full h-full justify-between" style="padding-bottom: env(safe-area-inset-bottom);" data-drawer-body>${content}</div>`
      + `</div><div class="drawer-handle"><i class="drawer-handle-icon"></i></div></div></div>`;
  }

  /** MainDrawer.handleCloseRequest: the content may veto; otherwise the drawer's owner closes it. */
  async function request(source = 'programmatic') {
    if (onCloseRequest) return onCloseRequest(source);
    if (typeof beforeClose === 'function') {
      try { if ((await beforeClose({ source })) === false) return false; } catch { return false; }
    }
    onClose?.(source);
    return true;
  }

  host.addEventListener('click', (e) => {
    if (e.target.closest('[data-drawer-close]') || e.target.matches('[data-drawer-mask]')) request('mask');
  });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && open) request('esc'); });
  window.addEventListener('popstate', async () => {
    if (!open || !guarded || onCloseRequest) return;
    guarded = false;
    if (typeof beforeClose === 'function') {
      let allowed;
      try { allowed = await beforeClose({ source: 'back' }); } catch { allowed = false; }
      if (allowed === false) { history.pushState({ drawerBackGuard: true }, ''); guarded = true; return; }
    }
    onClose?.('back');
  });

  const api = {
    host,
    get open() { return open; },
    /** Renders (or re-renders) the drawer with this content, open or closed. */
    render(content, isOpen = open) {
      if (!mounted) { document.body.appendChild(host); mounted = true; }
      const opening = isOpen && !open;
      if (isOpen !== open) lock(isOpen);
      open = isOpen;
      const drawer = host.firstElementChild;
      if (!drawer) host.innerHTML = frame(content);
      else {
        drawer.className = `drawer drawer-right${open ? ' drawer-open' : ''}`;
        drawer.querySelector('.drawer-content-wrapper').setAttribute('style', `${open ? '' : 'transform: translateX(100%); '}width: ${widthNow()};`);
        morph(host.querySelector('[data-drawer-body]'), content);
      }
      if (opening) {
        host.firstElementChild.focus();
        if (!onCloseRequest) { history.pushState({ drawerBackGuard: true }, ''); guarded = true; }
      }
      return host.querySelector('[data-drawer-body]');
    },
    body: () => host.querySelector('[data-drawer-body]'),
    registerBeforeClose(fn) { beforeClose = fn; },
    unregisterBeforeClose() { beforeClose = null; },
    requestClose: request,
    /** Removes the drawer from the page (a drawer production unmounts on close). */
    destroy() {
      if (open) lock(false);
      open = false;
      host.remove();
      host.innerHTML = '';
      mounted = false;
      beforeClose = null;
      if (guarded) { guarded = false; if (history.state?.drawerBackGuard) history.back(); }
    },
  };
  return api;
}
