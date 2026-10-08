import { NavLink } from "react-router-dom";
import { NAV_ITEMS } from "./navItems";

/**
 * Phone navigation, at the bottom.
 *
 * The previous header nav was `hidden md:flex` with no replacement, so on the
 * device this product is actually used on there was no way to move between
 * screens except the browser back button. Bottom placement is not a style
 * choice either: this app is used one-handed while standing in a field, and
 * the top 40% of a modern phone screen is out of thumb reach.
 */
export default function BottomNav() {
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-clay-200 bg-white/95 backdrop-blur-md sm:hidden"
      // Clears the iOS home indicator, which otherwise sits on top of the
      // right-hand tab.
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-semibold transition-colors ${
                isActive ? "text-field-700" : "text-clay-500"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={`flex h-8 w-14 items-center justify-center rounded-full transition-colors ${
                    isActive ? "bg-field-100" : ""
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </span>
                {label}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
