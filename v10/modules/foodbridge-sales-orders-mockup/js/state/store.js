/*
  The screen's state: one plain object, changed only through set(), observed through subscribe().
  Everything visible is a function of this object plus the data — which is what lets any state be
  reached by URL, by a test, or by hand in the console (window.salesOrders.store.state).
*/
export function createStore(initial) {
  let state = { ...initial };
  const listeners = new Set();
  return {
    get state() { return state; },
    set(patch) {
      const next = typeof patch === 'function' ? patch(state) : patch;
      state = { ...state, ...next };
      for (const fn of listeners) fn(state, next);
    },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };
}
