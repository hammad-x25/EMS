"use client";

import { AlertTriangle, ShieldAlert } from "lucide-react";
import { Modal } from "@/components/ui/Modal";

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  consequence,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  busy = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  consequence?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "danger";
  busy?: boolean;
}) {
  return (
    <Modal
      closeDisabled={busy}
      eyebrow={variant === "danger" ? "Confirm irreversible action" : "Confirmation required"}
      onClose={onClose}
      open={open}
      size="sm"
      title={title}
    >
      <div className="space-y-4">
        <p className="text-sm leading-6 text-[var(--text-secondary)]">{description}</p>
        {consequence ? (
          <div
            className={`flex items-start gap-2.5 rounded-lg border p-3 text-sm ${
              variant === "danger"
                ? "border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]"
                : "border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]"
            }`}
          >
            {variant === "danger" ? (
              <ShieldAlert className="mt-0.5 shrink-0" size={17} />
            ) : (
              <AlertTriangle className="mt-0.5 shrink-0" size={17} />
            )}
            <span>{consequence}</span>
          </div>
        ) : null}
        <div className="flex flex-wrap justify-end gap-3 border-t border-[var(--border-subtle)] pt-4">
          <button className="btn-secondary" disabled={busy} onClick={onClose} type="button">
            {cancelLabel}
          </button>
          <button
            className={variant === "danger" ? "btn-danger-solid" : "btn-primary"}
            disabled={busy}
            onClick={onConfirm}
            type="button"
          >
            {busy ? "Processing…" : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
