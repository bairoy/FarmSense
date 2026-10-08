import { Sprout } from "lucide-react";
import { ButtonLink } from "../../components/ui";

/**
 * The 404.
 *
 * This route previously rendered the bare string "Page Not Found" on a white
 * page - no header, no navigation, no way back. Every mistyped or stale link
 * was a dead end that could only be escaped with the browser's back button,
 * and the Header's own "AI Assistant" link pointed at a route that did not
 * exist, so the product shipped a one-way door in its main navigation.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-clay-50 px-6 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-field-100 text-field-700">
        <Sprout className="h-8 w-8" />
      </span>

      <h1 className="mt-6 text-3xl font-extrabold text-clay-900">
        This page isn&rsquo;t here
      </h1>
      <p className="mt-2 max-w-md text-clay-600">
        The link may be out of date, or the field or crop it pointed to has been
        deleted. Your records are safe.
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <ButtonLink to="/">Go to dashboard</ButtonLink>
        <ButtonLink to="/fields" variant="secondary">
          My fields
        </ButtonLink>
      </div>
    </div>
  );
}
