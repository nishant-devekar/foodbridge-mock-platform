/*
  A react-toastify 9.1.3 look-alike for the host's notifySuccess / notifyError (utils/toast.js):
  top-center, autoClose 3000, close on click, pause on hover and on focus loss, and a toastId of
  `${type}-${message}-***`, so the same message is never shown twice at once.

  Timing is the library's own: the toast enters with the bounce animation (its classes come off on
  animationend), closes when its progress bar's animation ends, and leaves with bounce-exit. Where
  animations do not run, the toast stays — as react-toastify's does.
*/
import { esc } from './dom.js';

const ICON = {
  success: '<svg viewBox="0 0 24 24" width="100%" height="100%" fill="var(--toastify-icon-color-success)"><path d="M12 0a12 12 0 1012 12A12.014 12.014 0 0012 0zm6.927 8.2l-6.845 9.289a1.011 1.011 0 01-1.43.188l-4.888-3.908a1 1 0 111.25-1.562l4.076 3.261 6.227-8.451a1 1 0 111.61 1.183z"></path></svg>',
  error: '<svg viewBox="0 0 24 24" width="100%" height="100%" fill="var(--toastify-icon-color-error)"><path d="M11.983 0a12.206 12.206 0 00-8.51 3.653A11.8 11.8 0 000 12.207 11.779 11.779 0 0011.8 24h.214A12.111 12.111 0 0024 11.791 11.766 11.766 0 0011.983 0zM10.5 16.542a1.476 1.476 0 011.449-1.53h.027a1.527 1.527 0 011.523 1.47 1.475 1.475 0 01-1.449 1.53h-.027a1.529 1.529 0 01-1.523-1.47zM11 12.5v-6a1 1 0 012 0v6a1 1 0 11-2 0z"></path></svg>',
};
const CLOSE = '<svg aria-hidden="true" viewBox="0 0 14 16"><path fill-rule="evenodd" d="M7.71 8.23l3.75 3.75-1.48 1.48-3.75-3.75-3.75 3.75L1 11.98l3.75-3.75L1 4.48 2.48 3l3.75 3.75L9.98 3l1.48 1.48-3.75 3.75z"></path></svg>';

export function createToaster(root) {
  const toasts = []; // { id, type, message, style, el }
  let container = null;
  const running = () => document.hasFocus();

  function renumber() {
    toasts.forEach((t, i) => t.el.style.cssText = `${t.style || ''}--nth: ${i + 1}; --len: ${toasts.length};`);
    if (!toasts.length && container) { container.remove(); container = null; }
  }

  function show(type, message, { style = '' } = {}) {
    const id = `${type}-${message}-***`;
    if (toasts.some((t) => t.id === id)) return;
    if (!container) {
      container = document.createElement('div');
      container.className = 'Toastify__toast-container Toastify__toast-container--top-center';
      container.style.zIndex = '99999';
      root.appendChild(container);
    }
    const el = document.createElement('div');
    el.id = id;
    el.className = `Toastify__toast Toastify__toast-theme--light Toastify__toast--${type} Toastify__toast--close-on-click Toastify--animate Toastify__bounce-enter--top-center`;
    el.innerHTML = `<div role="alert" class="Toastify__toast-body"><div class="Toastify__toast-icon Toastify--animate-icon Toastify__zoom-enter">${ICON[type]}</div><div>${esc(message)}</div></div>`
      + `<button class="Toastify__close-button Toastify__close-button--light" type="button" aria-label="close">${CLOSE}</button>`
      + `<div role="progressbar" aria-hidden="false" aria-label="notification timer" class="Toastify__progress-bar Toastify__progress-bar--animated Toastify__progress-bar-theme--light Toastify__progress-bar--${type}" style="animation-duration: 3000ms; animation-play-state: ${running() ? 'running' : 'paused'}; opacity: 1;"></div>`;
    const t = { id, type, message, style: style ? `${style} ` : '', el };
    toasts.push(t);
    container.appendChild(el);
    renumber();

    const bar = el.querySelector('.Toastify__progress-bar');
    const play = (on) => { bar.style.animationPlayState = on ? 'running' : 'paused'; };
    el.addEventListener('animationend', (e) => {
      if (e.target === el && el.classList.contains('Toastify__bounce-enter--top-center')) el.classList.remove('Toastify--animate', 'Toastify__bounce-enter--top-center');
      if (e.target.classList.contains('Toastify__zoom-enter')) e.target.classList.remove('Toastify--animate-icon', 'Toastify__zoom-enter');
    });
    bar.addEventListener('animationend', () => close(t));
    el.addEventListener('mouseenter', () => play(false));
    el.addEventListener('mouseleave', () => play(running()));
    el.addEventListener('click', () => close(t));
    window.addEventListener('focus', () => play(true));
    window.addEventListener('blur', () => play(false));
  }

  function close(t) {
    if (t.closing) return;
    t.closing = true;
    t.el.classList.add('Toastify--animate', 'Toastify__bounce-exit--top-center');
    t.el.addEventListener('animationend', () => {
      toasts.splice(toasts.indexOf(t), 1);
      t.el.remove();
      renumber();
    }, { once: true });
  }

  return {
    success: (message) => show('success', message),
    error: (message) => show('error', message, { style: 'width: 335px;' }),
  };
}
