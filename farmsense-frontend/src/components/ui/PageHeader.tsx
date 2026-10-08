import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

/**
 * The title block every page opens with.
 *
 * Screens used to each invent their own - different sizes, different colours,
 * some with a back link and some without - so a farmer could not tell from the
 * shape of the page where they were or how to get out. This is that answer,
 * once.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  back,
  actions,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  back?: { to: string; label: string };
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6">
      {back && (
        <Link
          to={back.to}
          className="mb-3 -ml-1 inline-flex min-h-11 items-center gap-1 rounded-lg pr-3 pl-1 text-sm font-semibold text-clay-600 transition-colors hover:text-field-700"
        >
          <ChevronLeft className="h-4 w-4" />
          {back.label}
        </Link>
      )}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && (
            <p className="mb-1 text-xs font-bold uppercase tracking-widest text-field-600">
              {eyebrow}
            </p>
          )}
          <h1 className="text-2xl font-extrabold text-clay-900 sm:text-3xl">
            {title}
          </h1>
          {description && (
            <p className="mt-1.5 max-w-2xl text-clay-600">{description}</p>
          )}
        </div>

        {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
      </div>
    </header>
  );
}
