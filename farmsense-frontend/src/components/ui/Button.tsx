import { Link } from "react-router-dom";
import type { ReactNode } from "react";

/**
 * The one button in the product.
 *
 * Before this existed there were six: green, blue, purple, yellow and two
 * shades of emerald, sized and rounded differently on every screen. Colour was
 * decorative rather than meaningful, so nothing on a page told a farmer which
 * control was the important one.
 *
 * Here colour carries meaning and nothing else:
 *   primary   - the one thing this screen is for
 *   secondary - a real but lesser action
 *   ghost     - navigation and dismissal
 *   danger    - destroys data
 *
 * Every variant is at least 44px tall. That is the smallest target a thumb can
 * reliably hit, and this app is used one-handed, standing up, outdoors.
 */

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-field-700 text-white shadow-sm hover:bg-field-800 active:bg-field-900 disabled:bg-field-300",
  secondary:
    "bg-white text-field-800 border border-clay-300 hover:bg-field-50 hover:border-field-300 active:bg-field-100 disabled:text-clay-400",
  ghost:
    "bg-transparent text-clay-700 hover:bg-clay-100 active:bg-clay-200 disabled:text-clay-400",
  danger:
    "bg-white text-alert-700 border border-alert-200 hover:bg-alert-50 hover:border-alert-300 active:bg-alert-100 disabled:text-clay-400",
};

const SIZES: Record<Size, string> = {
  sm: "min-h-11 px-3.5 text-sm gap-1.5",
  md: "min-h-11 px-5 text-[0.9375rem] gap-2",
  lg: "min-h-13 px-6 text-base gap-2.5",
};

const BASE =
  "inline-flex items-center justify-center rounded-xl font-semibold " +
  "transition-colors duration-150 select-none " +
  "disabled:cursor-not-allowed disabled:shadow-none";

type CommonProps = {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  className?: string;
  children: ReactNode;
};

const classes = ({ variant = "primary", size = "md", block, className = "" }: CommonProps) =>
  [BASE, VARIANTS[variant], SIZES[size], block ? "w-full" : "", className]
    .filter(Boolean)
    .join(" ");

export function Button({
  variant,
  size,
  block,
  className,
  children,
  ...rest
}: CommonProps & React.ComponentPropsWithRef<"button">) {
  return (
    <button
      className={classes({ variant, size, block, className, children })}
      {...rest}
    >
      {children}
    </button>
  );
}

export function ButtonLink({
  to,
  variant,
  size,
  block,
  className,
  children,
  ...rest
}: CommonProps & { to: string } & Omit<
    React.ComponentProps<typeof Link>,
    "to" | "className" | "children"
  >) {
  return (
    <Link
      to={to}
      className={classes({ variant, size, block, className, children })}
      {...rest}
    >
      {children}
    </Link>
  );
}
