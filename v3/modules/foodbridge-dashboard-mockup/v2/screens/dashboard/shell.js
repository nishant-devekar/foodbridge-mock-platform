/* ============================================================
   shell.js — the app chrome, shared by every screen
   ------------------------------------------------------------
   Sidebar + header + main container, from:
     src/components/sidebar/DesktopSidebar.jsx / SidebarContent.jsx
                            SidebarSubMenu.jsx / StoreSelector.jsx
     src/components/header/Header.jsx · MobileMenuLabel.jsx
     src/layout/Layout.jsx · Main.jsx

   dashboard.html carries this markup inline (it is the screen that
   was parity-checked first); the secondary screens render it from
   here. NAV lives here so both paths share one list.

   window.SHELL = { NAV, render({ title, icon, back }) }
   ============================================================ */
(function () {
  'use strict';

  // Icon names come from the backend menu config (globalSetting.storefrontMenus)
  // and are read off the live screenshots — see addendum-003 I1.
  var NAV = [
    { name: 'Dashboard', icon: 'LayoutDashboard', href: 'dashboard.html' },
    { name: 'Products', icon: 'Package', open: true, routes: ['All Products', 'Categories', 'Raw Materials'] },
    { name: 'Customers', icon: 'Users', open: false, routes: ['All Customers', 'Customer Groups'] },
    { name: 'Manage Routes', icon: 'Route' },
    { name: 'Order', icon: 'ShoppingCart' },
    { name: 'Deliveries', icon: 'Truck' },
    { name: 'Route Delivery', icon: 'MapPinned' },
    { name: 'Returns', icon: 'LayoutGrid', open: false, routes: ['Return Requests', 'Return Reasons'] },
    { name: 'Inventory', icon: 'Warehouse', open: true, routes: ['FG Live Stock', 'RM Live Stock', 'FG Expiry Report'] },
    { name: 'Purchase', icon: 'ShoppingBasket', open: true, routes: ['Manage Supplier', 'Purchase Orders', 'Supplier Payments'] }
  ];

  var BAG = '<svg class="w-7 h-7" width="16" height="19" viewBox="0 0 16 19" fill="none" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M12.5714 5.71429V4.57143C12.5714 2.05071 10.5207 0 8 0C5.47929 0 3.42857 2.05071 3.42857 4.57143V5.71429H0V15.4286C0 17.0065 1.27918 18.2857 2.85714 18.2857H13.1429C14.7208 18.2857 16 17.0065 16 15.4286V5.71429H12.5714ZM5.71429 4.57143C5.71429 3.31107 6.73964 2.28571 8 2.28571C9.26036 2.28571 10.2857 3.31107 10.2857 4.57143V5.71429H5.71429V4.57143ZM11.4286 8.85714C10.9552 8.85714 10.5714 8.47339 10.5714 8C10.5714 7.52661 10.9552 7.14286 11.4286 7.14286C11.902 7.14286 12.2857 7.52661 12.2857 8C12.2857 8.47339 11.902 8.85714 11.4286 8.85714ZM4.57143 8.85714C4.09804 8.85714 3.71429 8.47339 3.71429 8C3.71429 7.52661 4.09804 7.14286 4.57143 7.14286C5.04482 7.14286 5.42857 7.52661 5.42857 8C5.42857 8.47339 5.04482 8.85714 4.57143 8.85714Z" fill="#10B981"/></svg>';

  var C_LEAF = 'text-md transition-colors duration-150 w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left';
  var C_GROUP = 'w-full flex justify-between items-center gap-3 px-3 py-2 rounded-lg text-left ' +
    'text-gray-700 hover:text-green-600 hover:bg-gray-100';

  function navList(active) {
    var I = window.ICON;
    return NAV.map(function (r) {
      if (r.routes) {
        return '<li class="relative gap-y-1 rounded-md transition-colors group">' +
          '<button class="' + C_GROUP + '" data-nav-toggle>' +
            '<span class="inline-flex items-center">' + I.lucide(r.icon, 'w-5 h-5') +
              '<span class="ml-4">' + r.name + '</span></span>' +
            '<span class="pl-4 text-xs">' + I.lucide(r.open ? 'ChevronUp' : 'ChevronDown', 'h-4 w-4') + '</span>' +
          '</button>' +
          '<ul class="ml-8 mt-1 space-y-1 overflow-hidden text-sm text-gray-600 rounded-md"' + (r.open ? '' : ' hidden') + ' aria-label="submenu">' +
            r.routes.map(function (c) {
              return '<li><a class="flex items-center px-3 py-1 rounded transition-colors hover:text-gray-600 hover:bg-gray-100" href="#">' +
                I.lucide('Minus', 'mr-1 h-3 w-3') + c + '</a></li>';
            }).join('') + '</ul></li>';
      }
      var on = r.name === active;
      var state = on ? 'text-green-700 bg-green-50' : 'text-gray-600 hover:bg-gray-100';
      return '<li class="relative gap-y-1"><a class="' + C_LEAF + ' ' + state + '" href="' + (r.href || '#') + '">' +
        I.lucide(r.icon, 'w-5 h-5') + '<span>' + r.name + '</span></a></li>';
    }).join('');
  }

  function sidebarBody(active) {
    var I = window.ICON;
    return '<div class="pt-0 pb-4 px-3 z-40 text-gray-500 flex flex-col h-full" data-sidebar-body>' +
      '<div class="h-14 flex items-center border-b border-gray-200 flex-shrink-0 mb-3">' +
        '<div class="flex items-center gap-3 px-1 py-1.5 rounded-md cursor-default">' +
          '<a href="dashboard.html" class="flex-shrink-0">' + BAG + '</a>' +
          '<div class="flex flex-col min-w-0 flex-1">' +
            '<span class="text-sm font-semibold text-gray-800 truncate leading-tight">Murli</span></div>' +
        '</div></div>' +
      '<div class="flex-1 overflow-y-auto no-scrollbar" style="scrollbar-width:none;-ms-overflow-style:none">' +
        '<ul class="mt-2 space-y-2 pb-4" data-nav-list>' + navList(active) + '</ul></div>' +
      '<div class="border-t border-gray-200 pt-3 mt-1">' +
        '<a class="' + C_LEAF + ' text-gray-600 hover:bg-gray-100" href="#">' +
          I.lucide('MapPinned', 'w-5 h-5 flex-shrink-0') + '<span>Route Delivery</span></a></div>' +
      '<div class="flex-shrink-0 py-4 w-full space-y-3"></div>' +
      '</div>';
  }

  function header(opts) {
    var I = window.ICON;
    return '<header class="app-header sticky top-0 z-30 h-14 flex-shrink-0 bg-white border-b border-gray-200 shadow-sm md:flex-shrink">' +
      '<div class="header-container container-fluid flex items-center justify-between h-full px-3 sm:px-6 mx-auto">' +
        '<div class="flex min-w-0 items-center gap-1.5">' +
          '<button type="button" aria-label="Toggle sidebar" id="menu-toggle" ' +
            'class="p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50">' +
            I.feather('FiMenu', 'w-5 h-5 text-gray-600') + '</button>' +
          '<div class="flex items-center lg:hidden">' +
            '<div class="h-5 w-px bg-gray-200 mx-0.5"></div>' +
            '<div class="flex items-center gap-2 pl-1 pr-2 py-1.5 rounded-md cursor-default">' +
              '<a href="dashboard.html" class="flex-shrink-0">' + BAG + '</a></div>' +
            '<div class="h-5 w-px bg-gray-200 mx-0.5 hidden sm:block"></div>' +
          '</div>' +
          '<div class="hidden sm:flex items-center gap-2">' +
            (opts.back ? '<a href="' + opts.back + '" aria-label="Go back" ' +
              'class="flex items-center justify-center w-8 h-8 rounded-lg text-gray-600 hover:bg-gray-100 transition-all duration-200">' +
              I.feather('FiChevronLeft', 'w-5 h-5') + '</a>' : '') +
            '<h1 class="text-base font-semibold text-gray-700 tracking-tight">' + opts.title + '</h1>' +
          '</div>' +
        '</div>' +
        '<ul class="flex justify-end items-center flex-shrink-0 space-x-2 sm:space-x-4">' +
          '<li class="relative inline-block text-left">' +
            '<div class="flex items-center space-x-3 px-2 py-1 group cursor-pointer rounded-lg hover:bg-gray-50 transition-all duration-200">' +
              '<div class="flex items-center space-x-2">' +
                '<div class="relative hidden lg:block">' +
                  '<div class="rounded-full bg-gradient-to-br from-green-500 to-emerald-600 text-white h-8 w-8 sm:h-10 sm:w-10 font-semibold flex items-center justify-center ring-2 ring-green-200 shadow-md">' +
                    I.feather('FiUser', 'w-5 h-5') + '</div>' +
                  '<div class="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-white"></div></div>' +
                '<div class="flex flex-col items-start min-w-0">' +
                  '<p class="text-sm font-semibold text-gray-800 truncate max-w-32">Mahesh</p>' +
                  '<div class="flex items-center space-x-1">' +
                    '<p class="text-xs text-green-600 font-medium truncate max-w-28">Admin</p></div></div>' +
                I.feather('FiChevronDown', 'w-4 h-4 text-gray-400') +
              '</div></div></li></ul>' +
      '</div></header>';
  }

  // Renders the whole chrome into #app and returns the content container.
  function render(opts) {
    var I = window.ICON;
    var root = document.getElementById('app');
    root.className = 'flex h-[100dvh] bg-gray-50 overflow-x-hidden md:h-screen';
    root.innerHTML =
      '<aside class="z-30 flex-shrink-0 hidden shadow-sm w-64 overflow-y-auto bg-white border-r border-gray-200 lg:block">' +
        sidebarBody(opts.active) + '</aside>' +
      '<div id="mobile-backdrop" class="fixed inset-0 z-40 flex items-end bg-black bg-opacity-50 sm:items-center sm:justify-center lg:hidden" hidden></div>' +
      '<aside id="mobile-sidebar" class="fixed inset-y-0 z-[10001] flex-shrink-0 w-64 flex flex-col bg-white lg:hidden transition ease-in-out duration-150" hidden>' +
        '<div class="flex-1 overflow-y-auto">' + sidebarBody(opts.active) + '</div></aside>' +
      '<div class="flex flex-col flex-1 w-full min-h-0 overflow-hidden">' +
        header(opts) +
        '<main class="flex-1 overflow-y-auto overflow-x-hidden min-h-0">' +
          '<div class="w-full mx-auto px-3 sm:px-4 lg:px-6 pt-3 sm:pt-4" style="padding-bottom:1rem">' +
            '<div class="sm:hidden px-2 flex min-w-0 items-center gap-2.5 mb-3" aria-current="page">' +
              I.lucide(opts.icon || 'LayoutDashboard', 'h-7 w-7 flex-shrink-0 text-green-600') +
              '<h1 class="truncate text-xl font-semibold leading-6 text-gray-800">' + opts.title + '</h1></div>' +
            '<div id="content"></div>' +
          '</div></main></div>';

    // submenu toggles + mobile drawer, same behaviour as the dashboard
    document.addEventListener('click', function (e) {
      var b = e.target.closest('[data-nav-toggle]');
      if (!b) return;
      var ul = b.nextElementSibling, willOpen = ul.hidden;
      ul.hidden = !willOpen;
      b.querySelector('.pl-4').innerHTML = I.lucide(willOpen ? 'ChevronUp' : 'ChevronDown', 'h-4 w-4');
    });

    var drawer = document.getElementById('mobile-sidebar'), backdrop = document.getElementById('mobile-backdrop');
    function setOpen(open) {
      drawer.hidden = !open; backdrop.hidden = !open;
      drawer.classList.toggle('-translate-x-20', !open);
      document.body.classList.toggle('overflow-hidden', open);
    }
    setOpen(false);
    document.getElementById('menu-toggle').addEventListener('click', function () { setOpen(drawer.hidden); });
    backdrop.addEventListener('click', function () { setOpen(false); });

    return document.getElementById('content');
  }

  window.SHELL = { NAV: NAV, render: render };
})();
