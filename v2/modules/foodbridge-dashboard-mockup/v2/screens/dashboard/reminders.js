/* ============================================================
   reminders.js — the Follow-up Reminders modal
   ------------------------------------------------------------
   Destination of the amber "Follow-up Reminders" button in
   Recent Orders. Rebuilt from
     src/components/modal/OrderReminderModal.jsx
   which uses lucide-react icons (not react-icons) — hence
   ICON.lucide throughout.

   Live: search, "No Order Since" (Today · Yesterday · This Week),
   catalogue filter, per-row select, and the footer count. The
   Create Order and bell actions are the module's edges and raise
   a prototype notice — they leave this screen in the real app.

   Exposes window.REMINDERS = { open() }.
   ============================================================ */
(function () {
  'use strict';

  var ICON = window.ICON;
  var S = window.SEED;

  var host = document.createElement('div');
  document.body.appendChild(host);

  var ui = { q: '', since: 'today', catalogue: 'all', selected: {}, expanded: {} };

  // OrderReminderModal.jsx:103-107
  var TIME_FILTERS = [
    { value: 'today', label: 'Today' },
    { value: 'yesterday', label: 'Yesterday' },
    { value: 'thisWeek', label: 'This Week' }
  ];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function close() { host.innerHTML = ''; document.body.classList.remove('overflow-hidden'); }

  function rows() {
    var q = ui.q.trim().toLowerCase();
    return (S.followUpCustomers || []).filter(function (c) {
      // the app's window filter: how long the customer has been without an order
      if (ui.since === 'today' && c.daysSinceOrder < 1) return false;
      if (ui.since === 'yesterday' && c.daysSinceOrder < 2) return false;
      if (ui.since === 'thisWeek' && c.daysSinceOrder < 7) return false;
      if (ui.catalogue !== 'all' && c.catalogue !== ui.catalogue) return false;
      if (!q) return true;
      return (c.name + ' ' + c.phone + ' ' + (c.email || '') + ' ' + c.catalogue).toLowerCase().indexOf(q) !== -1;
    });
  }

  function catalogues() {
    var seen = {}, out = [];
    (S.followUpCustomers || []).forEach(function (c) {
      if (!seen[c.catalogue]) { seen[c.catalogue] = 1; out.push(c.catalogue); }
    });
    return out;
  }

  function row(c) {
    var on = !!ui.selected[c.id];
    var open = !!ui.expanded[c.id];
    return '<div class="bg-white border border-gray-200 rounded-lg hover:border-emerald-500 transition-all shadow-sm">' +
      '<div class="px-3 py-2.5">' +
        '<div class="hidden sm:flex items-center gap-3">' +
          '<button class="flex-shrink-0 p-0.5 transition-colors" data-pick="' + esc(c.id) + '" ' +
            'title="' + (on ? 'Deselect' : 'Select') + ' customer">' +
            (on ? ICON.lucide('CheckSquare', 'w-4 h-4 text-emerald-600')
                : ICON.lucide('Square', 'w-4 h-4 text-gray-400 hover:text-emerald-500')) + '</button>' +
          '<div class="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">' +
            ICON.lucide('User', 'w-4 h-4 text-gray-600') + '</div>' +
          '<span class="text-sm font-semibold text-gray-900 truncate flex-1 min-w-0">' + esc(c.name) + '</span>' +
          '<div class="flex items-center gap-1.5 text-xs text-gray-600 flex-shrink-0">' +
            ICON.lucide('Phone', 'w-3.5 h-3.5 text-emerald-600') +
            '<span class="font-medium whitespace-nowrap">' + esc(c.phone) + '</span>' +
            '<button class="p-0.5 hover:bg-gray-200 rounded transition-colors" data-copy-phone="' + esc(c.phone) + '" title="Copy phone number">' +
              ICON.lucide('Copy', 'w-3 h-3') + '</button>' +
          '</div>' +
          '<span class="inline-flex items-center px-2 py-0.5 bg-emerald-50 text-emerald-700 text-xs rounded font-medium flex-shrink-0 max-w-[130px]">' +
            '<span class="truncate">' + esc(c.catalogue) + '</span></span>' +
          '<button class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg transition-colors whitespace-nowrap flex-shrink-0" ' +
            'data-create="' + esc(c.id) + '" title="Create order for this customer">Create Order</button>' +
          '<button class="p-2 border border-amber-200 hover:bg-amber-50 rounded-md bg-amber-50 text-amber-700 flex-shrink-0" ' +
            'data-remind="' + esc(c.id) + '" title="Send a reminder to create order">' +
            ICON.lucide('Bell', 'w-4 h-4') + '</button>' +
          '<button class="p-1.5 rounded-lg transition-colors flex items-center justify-center hover:bg-gray-100 flex-shrink-0" ' +
            'data-expand-cust="' + esc(c.id) + '" title="' + (open ? 'Hide details' : 'Show email and address') + '">' +
            ICON.lucide('ChevronDown', 'w-4 h-4 text-gray-500 transition-transform' + (open ? ' rotate-180' : '')) + '</button>' +
        '</div>' +

        // mobile: two stacked rows — OrderReminderModal.jsx:857+
        '<div class="sm:hidden">' +
          '<div class="flex items-center gap-2">' +
            '<button class="flex-shrink-0 p-0.5" data-pick="' + esc(c.id) + '">' +
              (on ? ICON.lucide('CheckSquare', 'w-4 h-4 text-emerald-600')
                  : ICON.lucide('Square', 'w-4 h-4 text-gray-400')) + '</button>' +
            '<div class="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">' +
              ICON.lucide('User', 'w-4 h-4 text-gray-600') + '</div>' +
            '<span class="text-sm font-semibold text-gray-900 truncate flex-1 min-w-0">' + esc(c.name) + '</span>' +
            '<span class="inline-flex items-center px-2 py-0.5 bg-emerald-50 text-emerald-700 text-xs rounded font-medium flex-shrink-0">' +
              esc(c.catalogue) + '</span>' +
            '<button class="p-1.5 rounded-lg flex-shrink-0" data-expand-cust="' + esc(c.id) + '">' +
              ICON.lucide('ChevronDown', 'w-4 h-4 text-gray-500' + (open ? ' rotate-180' : '')) + '</button>' +
          '</div>' +
          '<div class="flex items-center gap-2 mt-2">' +
            '<div class="flex items-center gap-1.5 text-xs text-gray-600">' +
              ICON.lucide('Phone', 'w-3.5 h-3.5 text-emerald-600') +
              '<span class="font-medium">' + esc(c.phone) + '</span></div>' +
            '<div class="flex items-center gap-2 ml-auto flex-shrink-0">' +
              '<button class="inline-flex items-center gap-1 px-2.5 py-1.5 border border-amber-200 hover:bg-amber-50 rounded-md text-xs font-medium bg-amber-50 text-amber-700 flex-shrink-0" data-remind="' + esc(c.id) + '">' +
                ICON.lucide('Bell', 'w-3.5 h-3.5') + 'Remind</button>' +
              '<button class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg whitespace-nowrap flex-shrink-0" data-create="' + esc(c.id) + '">Create Order</button>' +
            '</div>' +
          '</div>' +
        '</div>' +

        (open ? '<div class="mt-2 pt-2 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">' +
          '<div><span class="text-gray-500">Email</span><p class="text-gray-800 break-all">' + esc(c.email || 'N/A') + '</p></div>' +
          '<div><span class="text-gray-500">Address</span><p class="text-gray-800">' + esc(c.address || 'N/A') + '</p></div>' +
          '<div><span class="text-gray-500">Last ordered</span><p class="text-gray-800">' + c.daysSinceOrder + ' days ago</p></div>' +
        '</div>' : '') +
      '</div></div>';
  }

  function render() {
    var list = rows();
    var label = 'block text-sm font-medium text-gray-700 mb-1.5';
    var field = 'w-full pl-3 pr-10 h-[38px] text-sm border border-gray-300 rounded-lg bg-white text-gray-900 ' +
      'placeholder-gray-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all duration-150';
    var sinceLabel = (TIME_FILTERS.filter(function (f) { return f.value === ui.since; })[0] || {}).label || '';

    host.innerHTML =
      '<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">' +
        '<div class="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col mx-4">' +

          '<div class="px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">' +
            '<div class="flex items-center gap-3 flex-1">' +
              '<div class="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center flex-shrink-0">' +
                ICON.lucide('AlertCircle', 'w-5 h-5 text-emerald-600') + '</div>' +
              '<div class="flex-1 min-w-0">' +
                '<h2 class="text-lg font-bold text-gray-900">Follow-up Customers Without Order ' + esc(sinceLabel) + '</h2>' +
                '<p class="text-xs text-gray-600 mt-1">These customers haven\'t placed order in the selected timeframe. ' +
                  'Call them to convert into sales.</p></div>' +
            '</div>' +
            '<button data-close-rem class="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0 ml-4" title="Close reminder modal">' +
              ICON.lucide('X', 'w-5 h-5 text-gray-500') + '</button>' +
          '</div>' +

          '<div class="px-6 py-3 border-b border-gray-200 bg-gray-50 flex-shrink-0">' +
            '<div class="grid grid-cols-1 lg:grid-cols-3 gap-3">' +
              '<div><label class="' + label + '">Search Customers</label>' +
                '<div class="relative"><input type="text" id="rem-q" placeholder="Search by name, phone, email..." ' +
                  'value="' + esc(ui.q) + '" class="' + field + '">' +
                  '<span class="absolute right-1 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">' +
                    ICON.lucide('Search', 'w-4 h-4') + '</span></div></div>' +
              '<div><label class="' + label + '">No Order Since</label>' +
                '<div class="relative"><select id="rem-since" class="' + field + ' appearance-none cursor-pointer">' +
                  TIME_FILTERS.map(function (f) {
                    return '<option value="' + f.value + '"' + (f.value === ui.since ? ' selected' : '') + '>' + f.label + '</option>';
                  }).join('') + '</select>' +
                  '<span class="absolute right-1 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">' +
                    ICON.lucide('ChevronDown', 'w-4 h-4') + '</span></div></div>' +
              '<div><label class="' + label + '">Filter by Catalogue</label>' +
                '<div class="relative"><select id="rem-cat" class="' + field + ' appearance-none cursor-pointer">' +
                  '<option value="all"' + (ui.catalogue === 'all' ? ' selected' : '') + '>All Catalogues</option>' +
                  catalogues().map(function (c) {
                    return '<option' + (c === ui.catalogue ? ' selected' : '') + '>' + esc(c) + '</option>';
                  }).join('') + '</select>' +
                  '<span class="absolute right-1 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">' +
                    ICON.lucide('ChevronDown', 'w-4 h-4') + '</span></div></div>' +
            '</div></div>' +

          '<div class="flex-1 overflow-y-auto px-6 py-3 space-y-2 min-h-0">' +
            (list.length ? list.map(row).join('')
              : '<p class="py-16 text-center text-sm text-gray-500">No customers match these filters.</p>') +
          '</div>' +

          '<div class="px-6 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between flex-wrap gap-2 flex-shrink-0">' +
            '<div class="flex items-center gap-4">' +
              (list.length ? '<p class="text-sm text-gray-700">' +
                  '<span class="font-bold text-emerald-600">' + list.length + '</span> ' +
                  '<span class="font-medium">' + (list.length === 1 ? 'customer' : 'customers') + ' to follow up</span></p>' +
                '<div class="h-4 w-px bg-gray-300"></div>' +
                '<p class="text-xs text-gray-600"><span class="font-medium">Tip:</span> Call them to convert into orders</p>' : '') +
            '</div>' +
            '<button data-close-rem class="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">Close</button>' +
          '</div>' +
        '</div></div>';
  }

  host.addEventListener('click', function (e) {
    var t;
    if (e.target.closest('[data-close-rem]')) { close(); return; }
    if ((t = e.target.closest('[data-pick]'))) {
      var id = t.dataset.pick;
      if (ui.selected[id]) delete ui.selected[id]; else ui.selected[id] = 1;
      render(); return;
    }
    if ((t = e.target.closest('[data-expand-cust]'))) {
      var cid = t.dataset.expandCust;
      if (ui.expanded[cid]) delete ui.expanded[cid]; else ui.expanded[cid] = 1;
      render(); return;
    }
    if ((t = e.target.closest('[data-copy-phone]'))) {
      var svg = t.innerHTML;
      t.textContent = '✓';
      setTimeout(function () { t.innerHTML = svg; }, 900);
      return;
    }
    if ((t = e.target.closest('[data-create]'))) {
      window.alert('Create Order for this customer.\n\nPrototype: the app opens its order drawer here — ' +
        'out of scope for the dashboard module.');
      return;
    }
    if ((t = e.target.closest('[data-remind]'))) {
      window.alert('Reminder queued for this customer.\n\nPrototype: the app sends it through its ' +
        'notification service — nothing is sent from here.');
    }
  });

  host.addEventListener('input', function (e) {
    if (e.target.id !== 'rem-q') return;
    ui.q = e.target.value;
    render();
    var again = document.getElementById('rem-q');
    if (again) { again.focus(); again.setSelectionRange(again.value.length, again.value.length); }
  });

  host.addEventListener('change', function (e) {
    if (e.target.id === 'rem-since') { ui.since = e.target.value; ui.selected = {}; render(); }
    else if (e.target.id === 'rem-cat') { ui.catalogue = e.target.value; render(); }
  });

  window.REMINDERS = {
    open: function () { document.body.classList.add('overflow-hidden'); render(); }
  };
})();
