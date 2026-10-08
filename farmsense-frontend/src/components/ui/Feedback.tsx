import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";

/* ==========================================================================
   Alert
   --------------------------------------------------------------------------
   Replaces window.alert(), which the auth screens used for real errors. A
   native alert is a modal the farmer must dismiss before they can see the
   field they typed wrong, it cannot be styled, and on a phone it looks like
   the browser broke rather than like the form has an opinion.
   ========================================================================== */

type Tone = "error" | "warning" | "success" | "info";

const TONES: Record<Tone, { wrap: string; icon: ReactNode }> = {
  error: {
    wrap: "bg-alert-50 border-alert-200 text-alert-900",
    icon: <XCircle className="h-5 w-5 text-alert-600" />,
  },
  warning: {
    wrap: "bg-harvest-50 border-harvest-200 text-harvest-900",
    icon: <AlertTriangle className="h-5 w-5 text-harvest-700" />,
  },
  success: {
    wrap: "bg-field-50 border-field-200 text-field-900",
    icon: <CheckCircle2 className="h-5 w-5 text-field-600" />,
  },
  info: {
    wrap: "bg-water-50 border-water-200 text-water-900",
    icon: <Info className="h-5 w-5 text-water-600" />,
  },
};

export function Alert({
  tone = "info",
  title,
  children,
  className = "",
}: {
  tone?: Tone;
  title?: string;
  children?: ReactNode;
  className?: string;
}) {
  const style = TONES[tone];

  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`flex gap-3 rounded-xl border p-4 ${style.wrap} ${className}`}
    >
      <span className="mt-0.5 shrink-0">{style.icon}</span>
      <div className="min-w-0 text-sm">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? "mt-0.5" : ""}>{children}</div>}
      </div>
    </div>
  );
}

/* ==========================================================================
   Loading
   ========================================================================== */

/**
 * A skeleton, not a spinner, wherever the shape of what is coming is known.
 * A grey block the size of the card that is about to appear stops the page
 * jumping under a thumb that is already reaching for where the button will be.
 */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-xl bg-clay-200/70 ${className}`}
      aria-hidden="true"
    />
  );
}

export function LoadingPanel({ label = "Loading" }: { label?: string }) {
  return (
    <div className="space-y-4" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      <Skeleton className="h-8 w-52" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}

export function Spinner({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" aria-hidden="true">
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="3"
        fill="none"
        opacity="0.25"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

/* ==========================================================================
   Empty state
   ========================================================================== */

/**
 * An empty list is a fork in the road, not a dead end: it should name what is
 * missing and hand over the control that fixes it. "No fields created yet."
 * with nothing to press is where a farmer closes the app.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="surface field-texture flex flex-col items-center px-6 py-14 text-center">
      {icon && (
        <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-field-100 text-field-700">
          {icon}
        </span>
      )}
      <h3 className="text-xl font-bold text-clay-900">{title}</h3>
      {description && (
        <p className="mt-2 max-w-sm text-clay-600">{description}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
