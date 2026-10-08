import { LayoutGrid, Map } from "lucide-react";

/**
 * The primary navigation, declared once.
 *
 * Header renders it on a wide screen and BottomNav renders it on a phone. Two
 * copies of this list is how a product ends up with a tab on one breakpoint
 * that does not exist on the other.
 */
export const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: LayoutGrid, end: true },
  { to: "/fields", label: "My fields", icon: Map, end: false },
];
