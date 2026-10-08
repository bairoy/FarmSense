import { Outlet } from "react-router-dom";

import Header from "./Header";
import BottomNav from "./BottomNav";

/**
 * The signed-in shell.
 *
 * Padding lives here and only here. Pages used to each declare their own
 * `min-h-screen ... pt-24` on top of the shell's own padding, which stacked
 * into a different gap on every screen and left the nested routes - the crop
 * list, the fertilizer form - with no container at all, floating against the
 * left edge.
 */
export default function Layout() {
  return (
    <div className="min-h-dvh bg-clay-50">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-100 focus:rounded-lg focus:bg-field-700 focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>

      <Header />

      {/* pb-28 clears the phone tab bar so the last card is never trapped
          underneath it; the desktop layout drops back to normal spacing. */}
      <main
        id="main"
        className="mx-auto max-w-6xl px-4 pt-6 pb-28 sm:px-6 sm:pt-8 sm:pb-12"
      >
        <Outlet />
      </main>

      <BottomNav />
    </div>
  );
}
