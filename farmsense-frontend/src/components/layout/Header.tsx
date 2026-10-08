import { useEffect, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { LogOut, User } from "lucide-react";

import { Wordmark } from "../../brand";
import { NAV_ITEMS } from "./navItems";
import { useAuthStore } from "../../store/authStore";

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();

  // A dropdown that only closes by pressing its own trigger is a trap on a
  // touchscreen - the obvious gesture is to tap anywhere else.
  useEffect(() => {
    if (!menuOpen) return;

    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const initial = user?.name?.trim()?.[0]?.toUpperCase();

  return (
    <header className="sticky top-0 z-50 border-b border-clay-200 bg-clay-50/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <NavLink to="/" aria-label="FarmSense home" className="shrink-0">
          <Wordmark />
        </NavLink>

        {/* Primary navigation. On a phone this moves to the bottom bar, where
            a thumb can actually reach it. */}
        <nav className="hidden items-center gap-1 sm:flex">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors ${
                  isActive
                    ? "bg-field-100 text-field-800"
                    : "text-clay-600 hover:bg-clay-100 hover:text-clay-900"
                }`
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div ref={menuRef} className="relative shrink-0">
          <button
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            className="flex min-h-11 items-center gap-2 rounded-xl px-2 transition-colors hover:bg-clay-100"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-field-700 text-sm font-bold text-white">
              {initial ?? <User className="h-4 w-4" />}
            </span>
            <span className="hidden max-w-32 truncate text-sm font-semibold text-clay-700 md:block">
              {user?.name ?? "Account"}
            </span>
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="animate-rise absolute right-0 mt-2 w-60 overflow-hidden rounded-xl border border-clay-200 bg-white shadow-lift"
            >
              <div className="border-b border-clay-100 px-4 py-3">
                <p className="truncate text-sm font-bold text-clay-900">
                  {user?.name}
                </p>
                <p className="truncate text-xs text-clay-500">{user?.email}</p>
              </div>

              <button
                role="menuitem"
                onClick={handleLogout}
                className="flex w-full min-h-11 items-center gap-2.5 px-4 text-left text-sm font-semibold text-alert-700 transition-colors hover:bg-alert-50"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
