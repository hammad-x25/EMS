"use client";

import { useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { useDialogAccessibility } from "@/components/ui/useDialogAccessibility";

type ModalSize = "sm" | "md" | "lg" | "xl";

const SIZE_CLASS: Record<ModalSize, string> = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-3xl",
};

export function Modal({
  open,
  onClose,
  title,
  eyebrow,
  description,
  size = "md",
  closeDisabled = false,
  closeLabel = "Close dialog",
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: string;
  description?: string;
  size?: ModalSize;
  closeDisabled?: boolean;
  closeLabel?: string;
  children: ReactNode;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLElement | null>(null);

  useDialogAccessibility({
    open,
    containerRef: panelRef,
    onClose,
    closeDisabled,
  });

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-[1px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !closeDisabled) {
          onClose();
        }
      }}
      role="presentation"
    >
      <section
        aria-describedby={description ? descriptionId : undefined}
        aria-labelledby={titleId}
        aria-modal="true"
        className={`card max-h-[90vh] w-full overflow-y-auto p-6 shadow-xl ${SIZE_CLASS[size]}`}
        ref={panelRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border-subtle)] pb-4">
          <div className="min-w-0">
            {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
            <h2 className="mt-1 text-xl font-bold text-[var(--text-primary)]" id={titleId}>
              {title}
            </h2>
            {description ? (
              <p className="mt-1 text-sm text-[var(--text-secondary)]" id={descriptionId}>
                {description}
              </p>
            ) : null}
          </div>
          <button
            aria-label={closeLabel}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--text-primary)]"
            disabled={closeDisabled}
            onClick={onClose}
            type="button"
          >
            <X size={18} />
          </button>
        </div>
        <div className="mt-5">{children}</div>
      </section>
    </div>
  );
}
