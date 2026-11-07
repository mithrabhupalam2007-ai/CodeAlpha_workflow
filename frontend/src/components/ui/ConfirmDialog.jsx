import { TriangleAlert } from "lucide-react";

import Modal from "./Modal.jsx";
import Button from "./Button.jsx";

/**
 * Destructive-action confirmation (delete, remove, …).
 * `variant="danger"` renders the rose confirm button.
 */
export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  loading = false,
  variant = "danger",
}) {
  return (
    <Modal
      open={open}
      onClose={loading ? () => {} : onClose}
      title={title}
      size="sm"
      closeOnBackdrop={!loading}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            onClick={onConfirm}
            loading={loading}
            className={
              variant === "danger"
                ? "bg-rose-600 text-white shadow-card hover:bg-rose-700"
                : undefined
            }
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-3">
        <span
          className={
            variant === "danger"
              ? "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-500"
              : "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-500"
          }
        >
          <TriangleAlert className="h-5 w-5" />
        </span>
        <p className="pt-1.5 text-sm leading-relaxed text-slate-600">{message}</p>
      </div>
    </Modal>
  );
}
