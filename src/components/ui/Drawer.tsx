"use client";

import { useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { useDialogAccessibility } from "@/components/ui/useDialogAccessibility";

export function Drawer({
  open,
  onClose,
  title,
  eyebrow,
  side = "right",
  maxWidthClass = "max-w-lg",
  closeDisabled = false,
  closeLabel = "Close panel",
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: string;
  side?: "left" | "right";
  maxWidthClass?: string;
  closeDisabled?: boolean;
  closeLabel?: string;
  children: ReactNode;
}) {
  const titleId = useId();
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
      className={`fixed inset-0 z-50 flex bg-slate-950/55 backdrop-blur-[1px] ${side === "left" ? "justify-start" : "justify-end"}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !closeDisabled) {
          onClose();
        }
      }}
      role="presentation"
    >
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className={`flex h-full w-full flex-col border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-2xl ${side === "left" ? "border-r" : "border-l"} ${maxWidthClass}`}
        ref={panelRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border-subtle)] px-6 py-4">
          <div className="min-w-0">
            {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
            <h2 className="mt-1 truncate text-lg font-bold text-[var(--text-primary)]" id={titleId}>
              {title}
            </h2>
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
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </section>
    </div>
  );
}
