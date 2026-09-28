/*
  The oracle page: production's /sourcing-orders route, composed exactly as storefront-frontend
  composes it, minus the two pieces of chrome the mock platform draws itself (the Sidebar and the
  Header, and with them the phone's MobileMenuLabel).

    src/main.jsx      AdminProvider → redux Provider + PersistGate → SidebarProvider → Windmill
                      (usePreferences, myTheme) → SnackbarProvider; custom.css + tailwind.css,
                      rc-tree and react-loading-skeleton CSS; the two global input behaviours
    src/App.jsx       initStorefrontConfig(), the dark-class guard, <ToastContainer zIndex 99999>,
                      <Router basename="/platform">, driver.js CSS
    src/layout/Layout.jsx + Main.jsx
                      the page frame and the scrolling <main> the route renders into
    src/pages/SourcingOrderModule.jsx
                      the host's glue mount of the module (real ports, real capabilities)

  Everything here is imported from the storefront checkout; nothing is re-implemented.
*/
import { Windmill } from "@windmill/react-ui";
import React, { Suspense, useEffect } from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import { BrowserRouter as Router } from "react-router-dom";
import { PersistGate } from "redux-persist/integration/react";
import { ToastContainer } from "react-toastify";
import { SnackbarProvider } from "notistack";

import "@/assets/css/custom.css";
import "@/assets/css/tailwind.css";
import "rc-tree/assets/index.css";
import "react-loading-skeleton/dist/skeleton.css";
import "driver.js/dist/driver.css";
import myTheme from "@/assets/theme/myTheme";
import { AdminProvider } from "@/context/AdminContext";
import { SidebarProvider } from "@/context/SidebarContext";
import "@/i18n";
import store, { persistor } from "@/reduxStore/store";
import { initStorefrontConfig } from "@/config/storefront-client-lib.init";
import { installBlurNumberInputOnWheel } from "@/utils/blurNumberInputOnWheel";
import { installSelectEditableFieldOnFocus } from "@/utils/selectEditableFieldOnFocus";
import Main from "@/layout/Main";
import SourcingOrderModule from "@/pages/SourcingOrderModule";

function Page() {
  // App.jsx: the dark class is never allowed on <html>.
  useEffect(() => {
    const observer = new MutationObserver(() => {
      if (document.documentElement.classList.contains("dark")) {
        document.documentElement.classList.remove("dark");
        document.documentElement.classList.add("light");
      }
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    initStorefrontConfig();
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <ToastContainer style={{ zIndex: 99999 }} />
      <Router basename="/platform">
        {/* Layout.jsx's frame, without <Sidebar/> and <Header/>. */}
        <div className="flex h-[100dvh] bg-gray-50 overflow-x-hidden md:h-screen">
          <div className="flex flex-col flex-1 w-full min-h-0 overflow-hidden">
            <Main>
              <div data-parity-screen="">
                <SourcingOrderModule />
              </div>
            </Main>
          </div>
        </div>
      </Router>
    </>
  );
}

function Root() {
  useEffect(() => installSelectEditableFieldOnFocus(), []);
  useEffect(() => installBlurNumberInputOnWheel(), []);
  return (
    <AdminProvider>
      <Provider store={store}>
        <PersistGate loading={null} persistor={persistor}>
          <SidebarProvider>
            <Suspense fallback={null}>
              <Windmill usePreferences theme={myTheme}>
                <SnackbarProvider
                  maxSnack={3}
                  anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
                  autoHideDuration={3000}
                >
                  <Page />
                </SnackbarProvider>
              </Windmill>
            </Suspense>
          </SidebarProvider>
        </PersistGate>
      </Provider>
    </AdminProvider>
  );
}

// App.jsx initialises the client lib inside an effect, but SidebarProvider's setup fetch runs in
// an effect that fires first (children before parents) — in production App has mounted long
// before a route renders because login precedes it. Initialising here keeps that order.
initStorefrontConfig();
ReactDOM.createRoot(document.getElementById("root")).render(<Root />);
