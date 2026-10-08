import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle } from "lucide-react";
import { Button } from "./Button";

/**
 * Confirmation before something is destroyed.
 *
 * Deleting a field used to go through window.confirm("Delete this field?") -
 * a browser chrome dialog that does not name the field, does not say what else
 * disappears with it, and looks identical to the phishing prompts people are
 * taught to dismiss. A field carries its crops, its season of logged
 * irrigation and every photo taken of it; the farmer should be told that
 * before they answer.
 */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = "Delete",
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    // Focus the safe choice, not the destructive one. An Enter keypress that
    // was meant for the page behind should not delete a season of records.
    cancelRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);

    // The page behind must not scroll under the dialog on a phone.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onCancel]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-100 flex items-end justify-center bg-clay-950/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      onClick={onCancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-body"
        onClick={(e) => e.stopPropagation()}
        className="animate-rise w-full max-w-md rounded-t-2xl bg-white p-6 shadow-float sm:rounded-2xl"
      >
        <div className="flex gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-alert-50 text-alert-600">
            <AlertTriangle className="h-6 w-6" />
          </span>
          <div className="min-w-0">
            <h2 id="confirm-title" className="text-lg font-bold text-clay-900">
              {title}
            </h2>
            <p id="confirm-body" className="mt-1 text-sm text-clay-600">
              {body}
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button ref={cancelRef} variant="ghost" onClick={onCancel} disabled={busy}>
            Keep it
          </Button>
          <Button variant="danger" onClick={onConfirm} disabled={busy}>
            {busy ? "Deleting..." : confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
