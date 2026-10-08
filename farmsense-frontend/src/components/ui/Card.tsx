import type { ReactNode } from "react";

/** A white panel on the clay background. The default container for content. */
export function Card({
  children,
  className = "",
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "article" | "li";
}) {
  return <Tag className={`surface ${className}`}>{children}</Tag>;
}

/** A titled section inside a card, with optional trailing controls. */
export function CardHeader({
  title,
  description,
  icon,
  action,
}: {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap">
      <div className="flex items-start gap-3 min-w-0">
        {icon && (
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-field-50 text-field-700">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-clay-900">{title}</h2>
          {description && (
            <p className="mt-0.5 text-sm text-clay-600">{description}</p>
          )}
        </div>
      </div>
      {action}
    </div>
  );
}
